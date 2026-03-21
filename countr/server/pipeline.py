"""Orchestrates YOLO-World + Florence-2 + DINOv2 into a single detection pipeline."""

import time
from PIL import Image

from yoloworld_detector import YOLOWorldDetector
from florence_ocr import FlorenceOCR
from product_catalog import ProductCatalog


class DetectionPipeline:
    def __init__(self):
        print("[Pipeline] Loading models...")
        self.yolo = YOLOWorldDetector()
        self.florence = FlorenceOCR()
        self.catalog = ProductCatalog()
        print("[Pipeline] All models loaded.")

    def detect(self, image: Image.Image, confidence: float = 0.1) -> dict:
        start = time.time()
        w, h = image.size

        # Step 1: YOLO-World detection
        yolo_preds = self.yolo.detect(image, confidence)

        # Step 2: Run OCR on full image
        all_ocr_texts = self.florence.read_text(image)

        # Step 3: For each detection, run OCR on crop + catalog match
        predictions = []
        class_counts: dict[str, int] = {}

        for pred in yolo_preds:
            cx, cy = pred["x"], pred["y"]
            bw, bh = pred["width"], pred["height"]
            x1 = max(0, int(cx - bw / 2))
            y1 = max(0, int(cy - bh / 2))
            x2 = min(w, int(cx + bw / 2))
            y2 = min(h, int(cy + bh / 2))

            crop = image.crop((x1, y1, x2, y2))

            # OCR on crop
            ocr_text = self.florence.read_text_for_crop(crop) if crop.size[0] > 10 and crop.size[1] > 10 else ""

            # Catalog match
            cat_name, cat_sim = self.catalog.match(crop)

            # Determine id_method and final class name
            yolo_label = pred["yolo_label"]
            if cat_name and cat_sim >= 0.7:
                id_method = "catalog"
                final_class = cat_name
            else:
                id_method = "yoloworld"
                final_class = yolo_label

            # Append OCR text to class name
            display_class = f"{final_class} [{ocr_text}]" if ocr_text else final_class

            entry = {
                "x": pred["x"],
                "y": pred["y"],
                "width": pred["width"],
                "height": pred["height"],
                "confidence": pred["confidence"],
                "class": display_class,
                "yolo_label": yolo_label,
                "ocr_text": ocr_text,
                "catalog_match": cat_name,
                "catalog_similarity": cat_sim,
                "id_method": id_method,
            }
            predictions.append(entry)

            class_counts[final_class] = class_counts.get(final_class, 0) + 1

        elapsed_ms = round((time.time() - start) * 1000)

        return {
            "predictions": predictions,
            "total_objects": len(predictions),
            "class_counts": class_counts,
            "ocr_texts": all_ocr_texts,
            "vocabulary": self.yolo.get_vocabulary(),
            "catalog_size": len(self.catalog.list_products()),
            "image_width": w,
            "image_height": h,
            "inference_time_ms": elapsed_ms,
        }
