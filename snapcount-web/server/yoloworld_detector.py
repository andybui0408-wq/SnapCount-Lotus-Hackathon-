"""
YOLO-World: Open-vocabulary detection.
Detects specific products by name — not generic "bottle" but "Coca-Cola can".
The vocabulary is user-configurable at runtime.
"""
from ultralytics import YOLOWorld
from PIL import Image
import numpy as np


# Default vocabulary for Vietnamese convenience stores
DEFAULT_VOCABULARY = [
    # Drinks
    "Coca-Cola can", "Coca-Cola bottle", "Pepsi can", "Pepsi bottle",
    "Fanta Orange can", "Fanta Orange bottle", "Sprite can", "Sprite bottle",
    "Monster Energy can", "Red Bull can",
    "Tiger beer can", "Tiger beer bottle", "Saigon beer can", "333 beer can",
    "water bottle", "milk carton", "juice box",
    "C2 green tea bottle", "Trà xanh Không Độ bottle",
    # Food
    "instant noodle pack", "rice bag", "bread loaf",
    "snack bag", "chip bag", "candy bar", "chocolate bar",
    "cookie package", "cracker box", "canned food",
    # Condiments
    "fish sauce bottle", "soy sauce bottle", "cooking oil bottle",
    "chili sauce bottle", "salt container", "sugar bag", "MSG packet",
    # Household
    "soap bar", "shampoo bottle", "toothpaste tube",
    "detergent box", "tissue box", "toilet paper roll",
    # Produce
    "banana", "apple", "orange", "mango", "watermelon",
    "tomato", "onion", "garlic", "chili pepper", "lime",
]


class YOLOWorldDetector:
    def __init__(self):
        print("[YOLO-World] Loading yolov8x-worldv2...")
        self.model = YOLOWorld("yolov8x-worldv2.pt")
        self.class_names: list[str] = []
        self.set_vocabulary(DEFAULT_VOCABULARY)
        print("[YOLO-World] Loaded.")

    def set_vocabulary(self, class_names: list[str]):
        """Update the detection vocabulary at runtime."""
        self.class_names = class_names
        self.model.set_classes(class_names)

    def detect(self, image: Image.Image, confidence: float = 0.1) -> list[dict]:
        """
        Detect objects using the current vocabulary.
        Returns list of {x, y, width, height, confidence, class, class_id, source}
        in center-format.
        """
        results = self.model.predict(
            source=np.array(image),
            conf=confidence,
            verbose=False,
        )

        predictions = []
        if results and len(results) > 0:
            r = results[0]
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                w = x2 - x1
                h = y2 - y1
                cx = x1 + w / 2
                cy = y1 + h / 2
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = (
                    self.class_names[cls_id]
                    if cls_id < len(self.class_names)
                    else f"class_{cls_id}"
                )

                predictions.append({
                    "x": round(cx, 1),
                    "y": round(cy, 1),
                    "width": round(w, 1),
                    "height": round(h, 1),
                    "confidence": round(conf, 3),
                    "class": cls_name,
                    "class_id": cls_id,
                    "source": "yoloworld",
                })

        return predictions
