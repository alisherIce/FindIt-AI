
import torch
import open_clip
from PIL import Image
import torch.nn.functional as F

# Choose Apple GPU when available
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

print(f"Loading FindIt AI on: {DEVICE}")

# Load pretrained CLIP model
model, _, preprocess = open_clip.create_model_and_transforms(
    "ViT-B-32",
    pretrained="laion2b_s34b_b79k"
)

model = model.to(DEVICE)
model.eval()


def get_image_embedding(image_path):
    """Convert an image into a normalized CLIP embedding."""

    image = Image.open(image_path).convert("RGB")
    image_tensor = preprocess(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        embedding = model.encode_image(image_tensor)
        embedding = F.normalize(embedding, dim=-1)

    return embedding


def compare_images(image1_path, image2_path):
    """Calculate visual similarity between two images."""

    embedding1 = get_image_embedding(image1_path)
    embedding2 = get_image_embedding(image2_path)

    similarity = F.cosine_similarity(
        embedding1,
        embedding2
    ).item()

    return similarity


if __name__ == "__main__":
    print("FindIt AI image matching engine is ready!")
