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


import sys
from types import ModuleType

import pytest


@pytest.fixture
def clean_database():
    from backend.database import SessionLocal, initialize_database
    from backend.models import Item

    initialize_database()
    with SessionLocal() as db:
        db.query(Item).delete()
        db.commit()
    yield
    with SessionLocal() as db:
        db.query(Item).delete()
        db.commit()


class FakeEmbedding:
    def squeeze(self, _dimension=0):
        return self

    def tolist(self):
        return [1.0 / (512 ** 0.5)] * 512


def install_fake_matcher(monkeypatch):
    fake_matcher = ModuleType("ml.image_matcher")
    fake_matcher.get_image_embedding = lambda _path: FakeEmbedding()
    monkeypatch.setitem(sys.modules, "ml.image_matcher", fake_matcher)


def test_create_and_list_item_report(clean_database, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
    install_fake_matcher(monkeypatch)

    response = client.post(
        "/api/items",
        data={
            "item_type": "lost",
            "title": "Black wallet",
            "category": "Accessories",
            "campus": "Gachon University",
            "location": "Central Library",
            "description": "Small black wallet with a zipper.",
        },
        files={"file": ("wallet.png", make_png(), "image/png")},
    )

    assert response.status_code == 201, response.text
    item = response.json()["item"]
    assert item["item_type"] == "lost"
    assert item["title"] == "Black wallet"
    assert item["campus"] == "Gachon University"
    assert item["status"] == "active"

    listed = client.get("/api/items?item_type=lost")
    assert listed.status_code == 200
    assert listed.json()["count"] == 1
    assert listed.json()["items"][0]["id"] == item["id"]


def test_vector_matches_only_return_opposite_item_type(clean_database, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
    install_fake_matcher(monkeypatch)

    def create_report(item_type, title):
        return client.post(
            "/api/items",
            data={
                "item_type": item_type,
                "title": title,
                "category": "Accessories",
                "campus": "Gachon University",
                "location": "Student Center",
            },
            files={"file": (f"{title}.png", make_png(), "image/png")},
        )

    lost = create_report("lost", "Lost wallet")
    found = create_report("found", "Found wallet")
    another_lost = create_report("lost", "Another lost wallet")
    assert lost.status_code == found.status_code == another_lost.status_code == 201

    lost_id = lost.json()["item"]["id"]
    response = client.get(f"/api/items/{lost_id}/matches")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["match_count"] == 1
    assert payload["matches"][0]["title"] == "Found wallet"
    assert "not proof of ownership" in payload["note"]


def test_resolve_item_removes_it_from_active_listing(clean_database, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
    install_fake_matcher(monkeypatch)

    created = client.post(
        "/api/items",
        data={
            "item_type": "found",
            "title": "Blue umbrella",
            "category": "Personal item",
            "campus": "Gachon University",
            "location": "Engineering Building",
        },
        files={"file": ("umbrella.png", make_png(), "image/png")},
    )
    assert created.status_code == 201
    item_id = created.json()["item"]["id"]

    resolved = client.patch(f"/api/items/{item_id}/resolve")
    assert resolved.status_code == 200
    assert resolved.json()["item"]["status"] == "resolved"

    listing = client.get("/api/items")
    assert listing.status_code == 200
    assert listing.json()["count"] == 0


def test_readiness_check(clean_database):
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "connected"}
