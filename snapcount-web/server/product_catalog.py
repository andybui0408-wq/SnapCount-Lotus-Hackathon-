"""
DINOv2 Product Catalog: Visual fingerprinting + nearest-neighbor matching.

The shop owner photographs each product ONCE.
DINOv2 computes a 768-dim embedding for each photo.
Future detections are cropped and matched against this catalog.

Even local Vietnamese products (Hảo Hảo, Chin-Su, C2) that no model
has been trained on get recognized — because the owner taught the
system with one reference photo.
"""
import json
import os
import numpy as np
import torch
from PIL import Image
from transformers import AutoModel, AutoImageProcessor

CATALOG_DIR = os.path.join(os.path.dirname(__file__), "catalog")
CATALOG_PATH = os.path.join(CATALOG_DIR, "catalog.json")


class ProductCatalog:
    def __init__(self, model_id: str = "facebook/dinov2-base"):
        print("[DINOv2] Loading for product catalog...")
        self.processor = AutoImageProcessor.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id).eval()
        self.catalog: list[dict] = []  # [{name, embedding, image_path}]
        self.embeddings_matrix: np.ndarray | None = None
        self._load_catalog()
        print(f"[DINOv2] Loaded. Catalog has {len(self.catalog)} products.")

    def _get_embedding(self, image: Image.Image) -> np.ndarray:
        """Compute DINOv2 embedding for an image crop."""
        inputs = self.processor(images=image, return_tensors="pt")
        with torch.no_grad():
            outputs = self.model(**inputs)
        # CLS token = global image descriptor
        emb = outputs.last_hidden_state[:, 0].squeeze().numpy()
        # L2 normalize for cosine similarity
        emb = emb / (np.linalg.norm(emb) + 1e-8)
        return emb

    def add_product(self, name: str, image: Image.Image, image_path: str = "") -> dict:
        """
        Add a product to the catalog.
        Shop owner takes ONE photo → stored as reference embedding.
        """
        emb = self._get_embedding(image)
        entry = {
            "name": name,
            "embedding": emb.tolist(),
            "image_path": image_path,
        }
        self.catalog.append(entry)
        self._rebuild_matrix()
        self._save_catalog()
        return {"name": name, "catalog_size": len(self.catalog)}

    def match(self, crop: Image.Image, threshold: float = 0.6) -> dict | None:
        """
        Match a detection crop against the product catalog.
        Returns the best match if similarity > threshold, else None.
        """
        if not self.catalog or self.embeddings_matrix is None:
            return None

        emb = self._get_embedding(crop)
        similarities = self.embeddings_matrix @ emb
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])

        if best_score < threshold:
            return None

        return {
            "name": self.catalog[best_idx]["name"],
            "similarity": round(best_score, 3),
            "catalog_index": best_idx,
        }

    def match_batch(self, crops: list[Image.Image], threshold: float = 0.6) -> list[dict | None]:
        """Match multiple crops at once."""
        if not self.catalog or self.embeddings_matrix is None:
            return [None] * len(crops)

        embs = []
        for crop in crops:
            embs.append(self._get_embedding(crop))
        emb_matrix = np.stack(embs)

        sims = emb_matrix @ self.embeddings_matrix.T

        results = []
        for i in range(len(crops)):
            best_idx = int(np.argmax(sims[i]))
            best_score = float(sims[i][best_idx])
            if best_score < threshold:
                results.append(None)
            else:
                results.append({
                    "name": self.catalog[best_idx]["name"],
                    "similarity": round(best_score, 3),
                })
        return results

    def list_products(self) -> list[str]:
        return [p["name"] for p in self.catalog]

    def remove_product(self, name: str) -> bool:
        before = len(self.catalog)
        self.catalog = [p for p in self.catalog if p["name"] != name]
        if len(self.catalog) < before:
            self._rebuild_matrix()
            self._save_catalog()
            return True
        return False

    def _rebuild_matrix(self):
        if self.catalog:
            self.embeddings_matrix = np.array([p["embedding"] for p in self.catalog])
        else:
            self.embeddings_matrix = None

    def _save_catalog(self):
        os.makedirs(CATALOG_DIR, exist_ok=True)
        with open(CATALOG_PATH, "w") as f:
            json.dump(self.catalog, f)

    def _load_catalog(self):
        if os.path.exists(CATALOG_PATH):
            try:
                with open(CATALOG_PATH) as f:
                    self.catalog = json.load(f)
                self._rebuild_matrix()
            except Exception:
                self.catalog = []
