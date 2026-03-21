"""DINOv2-base visual product fingerprinting + catalog matching (Meta, Apache 2.0)."""

import json
import os
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

CATALOG_DIR = Path(__file__).parent / "catalog"
CATALOG_FILE = CATALOG_DIR / "catalog.json"


class ProductCatalog:
    def __init__(self):
        model_id = "facebook/dinov2-base"
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.processor = AutoImageProcessor.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id).to(self.device)
        self.model.eval()
        self.catalog: dict[str, list[float]] = {}
        self._load_catalog()
        print(f"[DINOv2] Loaded on {self.device}, catalog has {len(self.catalog)} products")

    def _load_catalog(self):
        if CATALOG_FILE.exists():
            with open(CATALOG_FILE, "r") as f:
                self.catalog = json.load(f)

    def _save_catalog(self):
        CATALOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CATALOG_FILE, "w") as f:
            json.dump(self.catalog, f, indent=2)

    def get_embedding(self, image: Image.Image) -> np.ndarray:
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
        embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy().flatten()
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding

    def add_product(self, name: str, image: Image.Image):
        embedding = self.get_embedding(image)
        self.catalog[name] = embedding.tolist()
        self._save_catalog()
        print(f"[DINOv2] Added '{name}' to catalog (total: {len(self.catalog)})")

    def remove_product(self, name: str) -> bool:
        if name in self.catalog:
            del self.catalog[name]
            self._save_catalog()
            print(f"[DINOv2] Removed '{name}' from catalog")
            return True
        return False

    def list_products(self) -> list[str]:
        return list(self.catalog.keys())

    def match(self, image: Image.Image, threshold: float = 0.7) -> tuple[str | None, float]:
        """Match a crop against the catalog. Returns (name, similarity) or (None, 0.0)."""
        if not self.catalog:
            return None, 0.0

        query = self.get_embedding(image)
        best_name = None
        best_sim = 0.0

        for name, emb_list in self.catalog.items():
            emb = np.array(emb_list)
            similarity = float(np.dot(query, emb))
            if similarity > best_sim:
                best_sim = similarity
                best_name = name

        if best_sim >= threshold:
            return best_name, round(best_sim, 3)
        return None, round(best_sim, 3)
