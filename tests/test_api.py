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
