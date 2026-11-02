
from image_matcher import compare_images

image1 = input("Enter first image path: ")
image2 = input("Enter second image path: ")

score = compare_images(image1, image2)

print("\n========== FINDIT AI ==========")
print(f"Visual similarity: {score:.4f}")
print(f"Similarity percentage: {score * 100:.2f}%")
print("================================")
print("Note: Similarity is not proof of ownership.")
