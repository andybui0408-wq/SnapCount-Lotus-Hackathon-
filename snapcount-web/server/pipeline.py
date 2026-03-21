"""
Triple-model pipeline orchestrator.
Runs YOLO-World → Florence-2 OCR → DINOv2 catalog match.
Merges all three signals into final product identification.
"""
from PIL import Image
from yoloworld_detector import YOLOWorldDetector
from florence_ocr import FlorenceOCR
from product_catalog import ProductCatalog


class DetectionPipeline:
    def __init__(self):
        self.yolo = YOLOWorldDetector()
        self.ocr = FlorenceOCR()
        self.catalog = ProductCatalog()

    def detect(self, image: Image.Image, confidence: float = 0.1) -> dict:
        """
        Full pipeline:
        1. YOLO-World detects + classifies by text prompt vocabulary
        2. Florence-2 reads text from product labels (OCR)
        3. DINOv2 matches each detection crop against product catalog
        4. Merge: YOLO label + OCR text + catalog match → final ID
        """
        w, h = image.size

        # Step 1: YOLO-World detection
        detections = self.yolo.detect(image, confidence=confidence)

        # Step 2: Florence-2 OCR
        ocr_result = self.ocr.read_text(image)
        ocr_quads = ocr_result.get("quad_boxes", [])
        ocr_labels = ocr_result.get("labels", [])

        # Step 3: For each detection, crop and match against catalog
        crops = []
        for det in detections:
            x1 = max(0, int(det["x"] - det["width"] / 2))
            y1 = max(0, int(det["y"] - det["height"] / 2))
            x2 = min(w, int(det["x"] + det["width"] / 2))
            y2 = min(h, int(det["y"] + det["height"] / 2))
            crop = image.crop((x1, y1, x2, y2))
            crops.append(crop)

        catalog_matches = self.catalog.match_batch(crops) if crops else []

        # Step 4: Merge all signals
        final_predictions = []
        class_counts: dict[str, int] = {}

        for i, det in enumerate(detections):
            yolo_label = det["class"]
            yolo_conf = det["confidence"]

            # Find nearest OCR text
            ocr_text = self._find_nearest_ocr(det, ocr_quads, ocr_labels)

            # Get catalog match
            cat_match = catalog_matches[i] if i < len(catalog_matches) else None

            # Determine final product name (priority order):
            # 1. Catalog match (highest confidence — owner taught this exact product)
            # 2. YOLO-World label (good for known product categories)
            # 3. Enriched with OCR text if available
            if cat_match and cat_match["similarity"] > 0.7:
                final_name = cat_match["name"]
                id_method = "catalog"
                id_confidence = cat_match["similarity"]
            else:
                final_name = yolo_label
                id_method = "yoloworld"
                id_confidence = yolo_conf

            final_predictions.append({
                "x": det["x"],
                "y": det["y"],
                "width": det["width"],
                "height": det["height"],
                "confidence": round(id_confidence, 3),
                "class": final_name,
                "yolo_label": yolo_label,
                "yolo_confidence": yolo_conf,
                "ocr_text": ocr_text or "",
                "catalog_match": cat_match["name"] if cat_match else "",
                "catalog_similarity": cat_match["similarity"] if cat_match else 0,
                "id_method": id_method,
                "source": id_method,
            })

            # Count by base name (without OCR enrichment)
            base = cat_match["name"] if cat_match and cat_match["similarity"] > 0.7 else yolo_label
            class_counts[base] = class_counts.get(base, 0) + 1

        return {
            "predictions": final_predictions,
            "total_objects": len(final_predictions),
            "class_counts": class_counts,
            "ocr_texts": ocr_labels,
            "vocabulary": self.yolo.class_names,
            "catalog_size": len(self.catalog.catalog),
        }

    def _find_nearest_ocr(
        self, det: dict, quads: list, labels: list, threshold: float = 0.3
    ) -> str:
        """Find OCR text whose region overlaps the detection box."""
        if not quads or not labels:
            return ""

        x1 = det["x"] - det["width"] / 2
        y1 = det["y"] - det["height"] / 2
        x2 = det["x"] + det["width"] / 2
        y2 = det["y"] + det["height"] / 2

        best_text = ""
        best_overlap = 0.0

        for quad, text in zip(quads, labels):
            if not text or not text.strip():
                continue
            qxs = [quad[j] for j in range(0, len(quad), 2)]
            qys = [quad[j] for j in range(1, len(quad), 2)]
            qx1, qy1 = min(qxs), min(qys)
            qx2, qy2 = max(qxs), max(qys)

            ix1 = max(x1, qx1)
            iy1 = max(y1, qy1)
            ix2 = min(x2, qx2)
            iy2 = min(y2, qy2)

            if ix2 > ix1 and iy2 > iy1:
                intersection = (ix2 - ix1) * (iy2 - iy1)
                ocr_area = max(1, (qx2 - qx1) * (qy2 - qy1))
                overlap = intersection / ocr_area
                if overlap > best_overlap and overlap > threshold:
                    best_overlap = overlap
                    best_text = text.strip()

        return best_text
