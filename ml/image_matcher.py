from functools import lru_cache
from pathlib import Path

import open_clip
import torch
import torch.nn.functional as F
from PIL import Image


@lru_cache(maxsize=1)
def _load_model():
    """Load CLIP only when the first image-matching request needs it."""
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Loading FindIt AI CLIP model on: {device}")

    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32",
        pretrained="laion2b_s34b_b79k",
    )
    model = model.to(device)
    model.eval()
    return model, preprocess, device


@lru_cache(maxsize=512)
def _cached_embedding(path_string: str, modified_ns: int, size_bytes: int):
    """Cache an embedding until the source file changes."""
    model, preprocess, device = _load_model()

    with Image.open(path_string) as image:
        image_tensor = preprocess(image.convert("RGB")).unsqueeze(0).to(device)

    with torch.inference_mode():
        embedding = model.encode_image(image_tensor)
        embedding = F.normalize(embedding, dim=-1)

    # Keep cached embeddings on CPU to avoid occupying accelerator memory.
    return embedding.cpu()


def get_image_embedding(image_path):
    """Convert an image into a normalized, cached CLIP embedding."""
    path = Path(image_path).resolve()
    stat = path.stat()
    return _cached_embedding(str(path), stat.st_mtime_ns, stat.st_size)


def compare_images(image1_path, image2_path):
    """Calculate cosine similarity between two images (not ownership probability)."""
    embedding1 = get_image_embedding(image1_path)
    embedding2 = get_image_embedding(image2_path)
    return F.cosine_similarity(embedding1, embedding2).item()


def find_similar_images(query_image_path, image_directory, top_k=5):
    """Rank other images in a directory by visual similarity to the query image."""
    query_path = Path(query_image_path).resolve()
    image_dir = Path(image_directory)
    query_embedding = get_image_embedding(query_path)

    supported_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    results = []

    for candidate in image_dir.iterdir():
        if not candidate.is_file() or candidate.suffix.lower() not in supported_extensions:
            continue
        if candidate.resolve() == query_path:
            continue

        candidate_embedding = get_image_embedding(candidate)
        score = F.cosine_similarity(query_embedding, candidate_embedding).item()
        results.append({
            "filename": candidate.name,
            "similarity": round(float(score), 4),
        })

    results.sort(key=lambda item: item["similarity"], reverse=True)
    return results[:top_k]


if __name__ == "__main__":
    _load_model()
    print("FindIt AI image matching engine is ready!")
