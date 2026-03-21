"""
FastAPI server with triple-model detection + product catalog management.

Models:
1. YOLO-World (yolov8x-worldv2) — open-vocabulary detection
2. Florence-2-base (Microsoft) — OCR only
3. DINOv2-base (Meta) — product catalog fingerprinting
"""
import base64
import io
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from pipeline import DetectionPipeline

pipeline: DetectionPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline
    pipeline = DetectionPipeline()
    yield


app = FastAPI(title="SnapCount Triple-Model API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Detection ---

@app.post("/detect")
async def detect(
    file: UploadFile | None = File(None),
    image_base64: str | None = Form(None),
    confidence: float = Form(0.1),
):
    """Accepts either file upload or base64 form field (backwards compatible)."""
    if pipeline is None:
        raise HTTPException(503, detail="Models not loaded yet")

    try:
        if file is not None:
            data = await file.read()
            image = Image.open(io.BytesIO(data)).convert("RGB")
        elif image_base64 is not None:
            clean = image_base64.split(",")[-1] if "," in image_base64 else image_base64
            data = base64.b64decode(clean)
            image = Image.open(io.BytesIO(data)).convert("RGB")
        else:
            raise HTTPException(400, detail="Provide 'file' or 'image_base64'")

        start = time.time()
        result = pipeline.detect(image, confidence=confidence)
        elapsed = (time.time() - start) * 1000

        return {
            **result,
            "image_width": image.width,
            "image_height": image.height,
            "inference_time_ms": round(elapsed, 1),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))


# --- Vocabulary management ---

class VocabRequest(BaseModel):
    classes: list[str]


@app.post("/set-vocabulary")
async def set_vocabulary(req: VocabRequest):
    if pipeline is None:
        raise HTTPException(503, detail="Models not loaded yet")
    pipeline.yolo.set_vocabulary(req.classes)
    return {"classes": req.classes, "count": len(req.classes)}


@app.get("/get-vocabulary")
async def get_vocabulary():
    if pipeline is None:
        raise HTTPException(503, detail="Models not loaded yet")
    return {"classes": pipeline.yolo.class_names}


# --- Product catalog ---

@app.post("/catalog/add")
async def add_to_catalog(name: str = Form(...), image: UploadFile = File(...)):
    """Owner photographs a product -> DINOv2 embedding stored."""
    if pipeline is None:
        raise HTTPException(503, detail="Models not loaded yet")
    try:
        img = Image.open(io.BytesIO(await image.read())).convert("RGB")
        result = pipeline.catalog.add_product(name, img)
        # Also add to YOLO-World vocabulary if not already there
        if name not in pipeline.yolo.class_names:
            new_vocab = pipeline.yolo.class_names + [name]
            pipeline.yolo.set_vocabulary(new_vocab)
        return result
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/catalog/list")
async def list_catalog():
    if pipeline is None:
        raise HTTPException(503, detail="Models not loaded yet")
    return {
        "products": pipeline.catalog.list_products(),
        "count": len(pipeline.catalog.catalog),
    }


@app.delete("/catalog/remove/{name}")
async def remove_from_catalog(name: str):
    if pipeline is None:
        raise HTTPException(503, detail="Models not loaded yet")
    success = pipeline.catalog.remove_product(name)
    return {"removed": success, "name": name}


# --- Health ---

@app.get("/health")
async def health():
    return {
        "status": "ok" if pipeline else "loading",
        "model_loaded": pipeline is not None,
        "models": {
            "yoloworld": "yolov8x-worldv2",
            "florence_ocr": "Florence-2-base",
            "dinov2_catalog": "dinov2-base",
        },
        "vocabulary_size": len(pipeline.yolo.class_names) if pipeline else 0,
        "catalog_size": len(pipeline.catalog.catalog) if pipeline else 0,
    }
