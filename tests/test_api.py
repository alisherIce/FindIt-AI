from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from backend import main


client = TestClient(main.app)


def make_png() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (12, 8), color="red").save(buffer, format="PNG")
    return buffer.getvalue()


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_upload_valid_png(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

    response = client.post(
        "/api/upload",
        files={"file": ("item.png", make_png(), "image/png")},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "saved"
    assert payload["content_type"] == "image/png"
    assert payload["width"] == 12
    assert payload["height"] == 8
    assert (tmp_path / payload["filename"]).is_file()


def test_reject_unsupported_mime_type():
    response = client.post(
        "/api/upload",
        files={"file": ("item.gif", b"not an image", "image/gif")},
    )
    assert response.status_code == 415


def test_reject_invalid_image_bytes():
    response = client.post(
        "/api/upload",
        files={"file": ("item.png", b"not really a PNG", "image/png")},
    )
    assert response.status_code == 400


def test_reject_oversized_upload(monkeypatch):
    monkeypatch.setattr(main, "MAX_FILE_SIZE", 10)
    response = client.post(
        "/api/upload",
        files={"file": ("item.png", make_png(), "image/png")},
    )
    assert response.status_code == 413


def test_reject_excessive_image_dimensions(monkeypatch):
    monkeypatch.setattr(main, "MAX_IMAGE_PIXELS", 50)
    response = client.post(
        "/api/upload",
        files={"file": ("item.png", make_png(), "image/png")},
    )
    assert response.status_code == 413


def test_find_matches_for_uploaded_image(tmp_path, monkeypatch):
    import sys
    from types import ModuleType

    query_image = tmp_path / "query.jpg"
    query_image.write_bytes(b"test image placeholder")
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)

    fake_matcher = ModuleType("ml.image_matcher")
    fake_matcher.find_similar_images = lambda query, directory, top_k: [
        {"filename": "similar.jpg", "similarity": 0.8123}
    ][:top_k]
    monkeypatch.setitem(sys.modules, "ml.image_matcher", fake_matcher)

    response = client.get("/api/matches/query.jpg?limit=3")

    assert response.status_code == 200
    payload = response.json()
    assert payload["query_filename"] == "query.jpg"
    assert payload["match_count"] == 1
    assert payload["matches"][0]["filename"] == "similar.jpg"
    assert payload["matches"][0]["similarity"] == 0.8123
    assert "not proof of ownership" in payload["note"]


def test_matches_return_404_for_unknown_upload(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
    response = client.get("/api/matches/missing.jpg")
    assert response.status_code == 404
