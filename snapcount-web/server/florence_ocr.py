"""
Florence-2: OCR only.
Reads text from product labels to confirm brand names.
Only runs <OCR_WITH_REGION> — slimmed down from the full Florence pipeline.

Fixes for Apple Silicon (MPS):
- Uses dtype= instead of deprecated torch_dtype=
- attn_implementation="eager" avoids SDPA compatibility issues
- Explicit tensor casting to avoid NoneType shape errors
"""
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForCausalLM


def _pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class FlorenceOCR:
    def __init__(self, model_id: str = "microsoft/Florence-2-base"):
        self.device = _pick_device()
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32

        print(f"[Florence-2 OCR] Loading {model_id} on {self.device}...")
        self.processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            dtype=self.dtype,
            attn_implementation="eager",
        ).to(self.device).eval()
        print("[Florence-2 OCR] Loaded.")

    def read_text(self, image: Image.Image) -> dict:
        """
        Read all text visible in the image with region locations.
        Returns {quad_boxes: [...], labels: ["Coca-Cola", "Hảo Hảo", ...]}
        """
        prompt = "<OCR_WITH_REGION>"
        inputs = self.processor(text=prompt, images=image, return_tensors="pt")

        # Explicitly move tensors to device to avoid NoneType errors
        input_ids = inputs["input_ids"].to(self.device)
        pixel_values = inputs["pixel_values"].to(self.device, self.dtype)

        with torch.no_grad():
            ids = self.model.generate(
                input_ids=input_ids,
                pixel_values=pixel_values,
                max_new_tokens=512,
                num_beams=3,
                do_sample=False,
            )

        text = self.processor.batch_decode(ids, skip_special_tokens=False)[0]
        result = self.processor.post_process_generation(
            text, task=prompt, image_size=(image.width, image.height)
        )

        ocr_data = result.get("<OCR_WITH_REGION>", {"quad_boxes": [], "labels": []})
        return {
            "quad_boxes": ocr_data.get("quad_boxes", []),
            "labels": [t.strip() for t in ocr_data.get("labels", []) if t and t.strip()],
        }
