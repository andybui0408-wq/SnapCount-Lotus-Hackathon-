"""YOLO-World v2 open-vocabulary detector (Tencent ARC Lab, CVPR 2024)."""

import numpy as np
from PIL import Image
from ultralytics import YOLOWorld

DEFAULT_VOCABULARY = [
    # Drinks
    "Coca-Cola can", "Coca-Cola bottle", "Pepsi can", "Pepsi bottle",
    "Fanta Orange can", "Fanta Orange bottle", "Sprite can", "Sprite bottle",
    "Monster Energy can", "Red Bull can",
    "Tiger beer can", "Tiger beer bottle", "Saigon beer can", "333 beer can",
    "water bottle", "milk carton", "juice box",
    "C2 green tea bottle", "Trà xanh Không Độ bottle",
    # Food
    "instant noodle pack", "rice bag", "bread loaf", "snack bag", "chip bag",
    "candy bar", "chocolate bar", "cookie package", "cracker box", "canned food",
    # Condiments
    "fish sauce bottle", "soy sauce bottle", "cooking oil bottle",
    "chili sauce bottle", "salt container", "sugar bag", "MSG packet",
    # Household
    "soap bar", "shampoo bottle", "toothpaste tube", "detergent box",
    "tissue box", "toilet paper roll",
    # Produce
    "banana", "apple", "orange", "mango", "watermelon",
    "tomato", "onion", "garlic", "chili pepper", "lime",
]


class YOLOWorldDetector:
    def __init__(self):
        self.model = YOLOWorld("yolov8s-worldv2.pt")
        self.vocabulary = list(DEFAULT_VOCABULARY)
        self.model.set_classes(self.vocabulary)
        print(f"[YOLO-World] Loaded with {len(self.vocabulary)} classes")

    def set_vocabulary(self, classes: list[str]):
        self.vocabulary = list(classes)
        self.model.set_classes(self.vocabulary)
        print(f"[YOLO-World] Vocabulary updated: {len(self.vocabulary)} classes")

    def get_vocabulary(self) -> list[str]:
        return list(self.vocabulary)

    def detect(self, image: Image.Image, confidence: float = 0.1) -> list[dict]:
        img_array = np.array(image)
        results = self.model.predict(img_array, conf=confidence, verbose=False)
        predictions = []
        for r in results:
            boxes = r.boxes
            for i in range(len(boxes)):
                box = boxes[i]
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                cx = float((x1 + x2) / 2)
                cy = float((y1 + y2) / 2)
                w = float(x2 - x1)
                h = float(y2 - y1)
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())
                label = self.vocabulary[cls_id] if cls_id < len(self.vocabulary) else "unknown"
                predictions.append({
                    "x": round(cx, 1),
                    "y": round(cy, 1),
                    "width": round(w, 1),
                    "height": round(h, 1),
                    "confidence": round(conf, 3),
                    "yolo_label": label,
                })
        return predictions
