"""Florence-2-base OCR — reads text from product labels (Microsoft, MIT license)."""

from PIL import Image
from transformers import AutoProcessor, AutoModelForCausalLM
import torch


class FlorenceOCR:
    def __init__(self):
        model_id = "microsoft/Florence-2-base"
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, trust_remote_code=True, attn_implementation="eager"
        ).to(self.device)
        self.model.eval()
        print(f"[Florence-2] Loaded on {self.device}")

    def read_text(self, image: Image.Image) -> list[str]:
        """Run OCR on an image. Returns list of detected text strings."""
        task = "<OCR_WITH_REGION>"
        inputs = self.processor(text=task, images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            generated = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=512,
                num_beams=3,
            )
        decoded = self.processor.batch_decode(generated, skip_special_tokens=False)[0]
        result = self.processor.post_process_generation(decoded, task=task, image_size=image.size)
        texts = []
        if task in result and "labels" in result[task]:
            texts = [t.strip() for t in result[task]["labels"] if t.strip()]
        return texts

    def read_text_for_crop(self, crop: Image.Image) -> str:
        """Run OCR on a single crop, return best text or empty string."""
        texts = self.read_text(crop)
        return texts[0] if texts else ""
