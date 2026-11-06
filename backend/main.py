import logging
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Item, User
from backend.schemas import RegisterRequest
from backend.security import create_access_token, get_current_user, hash_password, verify_password

logger = logging.getLogger(__name__)

app = FastAPI(
    title="FindIt AI",
    description="Smart Lost and Found Platform",
    version="0.2.0",
)

# Local development storage. Uploaded files are intentionally not public.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_IMAGE_PIXELS = 20_000_000

ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


def _save_image(contents: bytes, content_type: str) -> dict:
    """Validate, re-encode and privately save an image."""
    allowed_mime_types = {mime for mime, _extension in ALLOWED_FORMATS.values()}
    if content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, and WEBP images are supported.",
        )

    try:
        with Image.open(BytesIO(contents)) as image:
            image_format = image.format
            if image_format not in ALLOWED_FORMATS:
                raise HTTPException(status_code=415, detail="Unsupported image format.")

            expected_mime, extension = ALLOWED_FORMATS[image_format]
            if content_type != expected_mime:
                raise HTTPException(
                    status_code=415,
                    detail="The file content does not match its declared image type.",
                )

            width, height = image.size
            if width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")

            image.load()
            cleaned_image = image.convert("RGB")
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            filename = f"{uuid4().hex}{extension}"
            destination = UPLOAD_DIR / filename

            save_options = (
                {"quality": 90, "optimize": True}
                if image_format in {"JPEG", "WEBP"}
                else {"optimize": True}
            )
            cleaned_image.save(destination, format=image_format, **save_options)

    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    return {
        "filename": filename,
        "content_type": expected_mime,
        "width": width,
        "height": height,
    }


def _read_upload(file: UploadFile) -> bytes:
    """Read at most the configured upload limit plus one byte."""
    # Check MIME type before reading the body.
    allowed_mime_types = {mime for mime, _extension in ALLOWED_FORMATS.values()}
    if file.content_type not in allowed_mime_types:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WEBP images are supported.")

    # UploadFile has already been parsed by Starlette; enforce the application limit here.
    contents = file.file.read(MAX_FILE_SIZE + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller.")
    return contents


def _item_summary(item: Item) -> dict:
    return {
        "id": item.id,
        "owner_id": item.owner_id,
        "item_type": item.item_type,
        "title": item.title,
        "category": item.category,
        "campus": item.campus,
        "location": item.location,
        "description": item.description,
        "image_filename": item.image_filename,
        "status": item.status,
        "created_at": item.created_at.isoformat(),
    }


@app.get("/")
def home():
    return {"message": "Welcome to FindIt AI", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "FindIt AI"}


@app.get("/api/health/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Report ready only when PostgreSQL and pgvector can be reached."""
    from sqlalchemy import text

    db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "connected"}


@app.post("/api/upload", status_code=201)
async def upload_image(file: UploadFile = File(...)):
    """Validate and privately save one standalone item photo."""
    contents = _read_upload(file)
    saved = _save_image(contents, file.content_type or "")
    return {
        "message": "Image uploaded successfully.",
        **saved,
        "size_bytes": len(contents),
        "status": "saved",
    }




@app.post("/api/auth/register", status_code=201)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        logger.exception("Account registration failed")
        raise HTTPException(status_code=503, detail="Could not create the account.")

    return {"message": "Account created.", "user": {"id": user.id, "email": user.email}}


@app.post("/api/auth/login")
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }


@app.get("/api/auth/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}

@app.post("/api/items", status_code=201)
async def create_item(
    item_type: str = Form(..., pattern="^(lost|found)$"),
    title: str = Form(..., min_length=2, max_length=120),
    category: str = Form(..., min_length=2, max_length=60),
    campus: str = Form(..., min_length=2, max_length=120),
    location: str = Form(..., min_length=2, max_length=160),
    description: str = Form(default="", max_length=1000),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a lost/found report and store its CLIP image embedding."""
    contents = _read_upload(file)
    saved = _save_image(contents, file.content_type or "")
    image_path = UPLOAD_DIR / saved["filename"]

    try:
        # Lazy import: the CLIP model loads only when an item is submitted.
        from ml.image_matcher import get_image_embedding

        embedding_tensor = get_image_embedding(image_path)
        embedding = embedding_tensor.squeeze(0).tolist()
        if len(embedding) != 512:
            raise ValueError("The configured CLIP model must produce 512-dimensional embeddings.")

        item = Item(
            owner_id=current_user.id,
            item_type=item_type,
            title=title.strip(),
            category=category.strip(),
            campus=campus.strip(),
            location=location.strip(),
            description=description.strip(),
            image_filename=saved["filename"],
            embedding=embedding,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
    except HTTPException:
        image_path.unlink(missing_ok=True)
        raise
    except Exception:
        db.rollback()
        image_path.unlink(missing_ok=True)
        logger.exception("Could not create item report")
        raise HTTPException(
            status_code=503,
            detail="Could not process the item image or save the report. Check database and AI setup.",
        )

    return {
        "message": "Item report created successfully.",
        "item": _item_summary(item),
    }


@app.get("/api/matches/{filename}")
def find_uploaded_image_matches(
    filename: str,
    limit: int = Query(default=5, ge=1, le=10),
):
    """Legacy local-folder search; item reports should use the database match route."""
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid image filename.")

    query_path = UPLOAD_DIR / filename
    if not query_path.is_file():
        raise HTTPException(status_code=404, detail="Uploaded image was not found.")

    try:
        from ml.image_matcher import find_similar_images

        matches = find_similar_images(query_path, UPLOAD_DIR, top_k=limit)
    except Exception:
        logger.exception("FindIt AI local image matching failed")
        raise HTTPException(
            status_code=503,
            detail="AI matching is unavailable. Check the ML dependencies and model setup.",
        )

    return {
        "query_filename": filename,
        "match_count": len(matches),
        "matches": matches,
        "note": "Visual similarity is a suggestion, not proof of ownership.",
    }


@app.get("/api/items")
def list_items(
    item_type: str | None = Query(default=None, pattern="^(lost|found)$"),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Item).filter(Item.status == "active")
    if item_type:
        query = query.filter(Item.item_type == item_type)
    items = query.order_by(Item.created_at.desc()).limit(limit).all()
    return {"count": len(items), "items": [_item_summary(item) for item in items]}


@app.get("/api/items/{item_id}/matches")
def find_item_matches(
    item_id: str,
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Find opposite-type active reports nearest in CLIP vector space."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item report was not found.")

    distance = Item.embedding.cosine_distance(item.embedding)
    candidates = (
        db.query(Item, distance.label("distance"))
        .filter(
            Item.item_type != item.item_type,
            Item.status == "active",
            Item.id != item.id,
        )
        .order_by(distance)
        .limit(limit)
        .all()
    )

    matches = []
    for candidate, candidate_distance in candidates:
        matches.append({
            **_item_summary(candidate),
            "visual_similarity": round(1 - float(candidate_distance), 4),
        })

    return {
        "item_id": item.id,
        "match_count": len(matches),
        "matches": matches,
        "note": "Visual similarity is a suggestion, not proof of ownership. Verify privately before handover.",
    }


@app.patch("/api/items/{item_id}/resolve")
def resolve_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item report was not found.")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the report owner can mark it as resolved.")
    item.status = "resolved"
    db.commit()
    db.refresh(item)
    return {"message": "Item marked as resolved.", "item": _item_summary(item)}
