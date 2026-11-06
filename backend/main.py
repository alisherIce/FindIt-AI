from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

app = FastAPI(
    title="FindIt AI",
    description="Smart Lost and Found Platform",
    version="0.1.0",
)

# Local development storage. Uploaded files are intentionally not public.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Match the declared MIME type to the image format decoded by Pillow.
ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


@app.get("/")
def home():
    return {"message": "Welcome to FindIt AI", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "FindIt AI"}


@app.post("/api/upload", status_code=201)
async def upload_image(file: UploadFile = File(...)):
    """Validate and privately save one lost/found item photo."""

    contents = await file.read(MAX_FILE_SIZE + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller.")

    try:
        with Image.open(BytesIO(contents)) as image:
            image_format = image.format
            if image_format not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=415,
                    detail="Only JPEG, PNG, and WEBP images are supported.",
                )

            expected_mime, extension = ALLOWED_FORMATS[image_format]
            if file.content_type != expected_mime:
                raise HTTPException(
                    status_code=415,
                    detail="The file content does not match its declared image type.",
                )

            image.load()
            width, height = image.size

            # Re-encoding removes embedded metadata such as EXIF GPS coordinates.
            cleaned_image = image.convert("RGB")
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            filename = f"{uuid4().hex}{extension}"
            destination = UPLOAD_DIR / filename

            save_options = {"quality": 90, "optimize": True} if image_format in {"JPEG", "WEBP"} else {"optimize": True}
            cleaned_image.save(destination, format=image_format, **save_options)

    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    return {
        "message": "Image uploaded successfully.",
        "filename": filename,
        "content_type": expected_mime,
        "size_bytes": len(contents),
        "width": width,
        "height": height,
        "status": "saved",
    }
