"""FastAPI server for SnapCount detection pipeline."""

import base64
import io

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from pipeline import DetectionPipeline

app = FastAPI(title="SnapCount Detection Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = DetectionPipeline()


# ── Request/Response models ──────────────────────────────────────────

class DetectRequest(BaseModel):
    image: str  # base64-encoded JPEG/PNG
    confidence: float = 0.1


class VocabularyRequest(BaseModel):
    classes: list[str]


# ── Endpoints ────────────────────────────────────────────────────────

@app.post("/detect")
async def detect(req: DetectRequest):
    try:
        img_bytes = base64.b64decode(req.image)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    result = pipeline.detect(image, confidence=req.confidence)
    return result


@app.post("/set-vocabulary")
async def set_vocabulary(req: VocabularyRequest):
    pipeline.yolo.set_vocabulary(req.classes)
    return {"status": "ok", "count": len(req.classes)}


@app.get("/get-vocabulary")
async def get_vocabulary():
    return {"classes": pipeline.yolo.get_vocabulary()}


@app.post("/catalog/add")
async def catalog_add(name: str = Form(...), image: UploadFile = File(...)):
    contents = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    pipeline.catalog.add_product(name, pil_image)

    # Also add to YOLO vocabulary if not present
    vocab = pipeline.yolo.get_vocabulary()
    if name not in vocab:
        vocab.append(name)
        pipeline.yolo.set_vocabulary(vocab)

    return {"status": "ok", "catalog_size": len(pipeline.catalog.list_products())}


@app.get("/catalog/list")
async def catalog_list():
    return {"products": pipeline.catalog.list_products()}


@app.delete("/catalog/remove/{name}")
async def catalog_remove(name: str):
    removed = pipeline.catalog.remove_product(name)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Product '{name}' not in catalog")
    return {"status": "ok", "catalog_size": len(pipeline.catalog.list_products())}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": {
            "yoloworld": "loaded",
            "florence2": "loaded",
            "dinov2": "loaded",
        },
        "vocabulary_size": len(pipeline.yolo.get_vocabulary()),
        "catalog_size": len(pipeline.catalog.list_products()),
    }
