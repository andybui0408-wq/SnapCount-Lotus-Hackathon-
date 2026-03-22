import { ROBOFLOW_API_KEY, ROBOFLOW_DINO_URL, DEFAULT_VOCABULARY } from "../constants/config";

// ── Grounding DINO response types ────────────────────────────────

export interface DINOPrediction {
  x: number;      // center x
  y: number;      // center y
  width: number;
  height: number;
  confidence: number;
  class: string;
}

export interface DINOResponse {
  predictions: DINOPrediction[];
  image: { width: number; height: number };
}

export interface FlatPrediction {
  class: string;
  confidence: number;
  polygon: number[][]; // [[x,y], ...] — 4-corner rectangle as polygon
  box: { x: number; y: number; width: number; height: number }; // original center-coord box
  catalogMatch?: string;
  catalogSimilarity?: number;
  ocrText?: string;
  idMethod: "catalog" | "dino" | "ocr";
}

// ── Vocabulary management ────────────────────────────────────────

const VOCAB_KEY = "countr_vocabulary";

function loadCustomVocabulary(): string[] | null {
  const raw = localStorage.getItem(VOCAB_KEY);
  if (!raw) return null;
  const names: string[] = JSON.parse(raw);
  return names.length > 0 ? names : null;
}

let currentVocabulary: string[] = loadCustomVocabulary() || [...DEFAULT_VOCABULARY];

export function setVocabulary(vocab: string[]) {
  currentVocabulary = [...vocab];
}

export function getVocabulary(): string[] {
  return [...currentVocabulary];
}

export function saveCustomVocabulary(names: string[]) {
  const existing = loadCustomVocabulary() || [];
  const merged = [...new Set([...existing, ...names])];
  localStorage.setItem(VOCAB_KEY, JSON.stringify(merged));
  currentVocabulary = merged;
}

export function hasCustomVocabulary(): boolean {
  return loadCustomVocabulary() !== null;
}

export function removeFromVocabulary(name: string) {
  const custom = loadCustomVocabulary();
  if (!custom) return;
  const filtered = custom.filter((v) => v.toLowerCase() !== name.toLowerCase());
  localStorage.setItem(VOCAB_KEY, JSON.stringify(filtered));
  currentVocabulary = filtered.length > 0 ? filtered : [...DEFAULT_VOCABULARY];
}

export function reloadVocabulary() {
  currentVocabulary = loadCustomVocabulary() || [...DEFAULT_VOCABULARY];
}

// ── NMS (Non-Maximum Suppression) ────────────────────────────────

function computeIoU(a: DINOPrediction, b: DINOPrediction): number {
  const ax1 = a.x - a.width / 2, ay1 = a.y - a.height / 2;
  const ax2 = a.x + a.width / 2, ay2 = a.y + a.height / 2;
  const bx1 = b.x - b.width / 2, by1 = b.y - b.height / 2;
  const bx2 = b.x + b.width / 2, by2 = b.y + b.height / 2;

  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function applyNMS(predictions: DINOPrediction[], iouThreshold = 0.5): DINOPrediction[] {
  const sorted = [...predictions].sort((a, b) => b.confidence - a.confidence);
  const kept: DINOPrediction[] = [];

  for (const pred of sorted) {
    let dominated = false;
    for (const k of kept) {
      if (computeIoU(pred, k) > iouThreshold) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(pred);
  }
  return kept;
}

// ── Grounding DINO API call ──────────────────────────────────────

export async function detectProducts(
  base64Image: string,
  prompts?: string[],
): Promise<DINOResponse> {
  if (!ROBOFLOW_API_KEY) throw new Error("Roboflow API key not set");

  const vocab = prompts || currentVocabulary;
  const text = vocab.join(". ") + ".";

  console.log("[COUNTR] DINO request: %d classes, text='%s', image length: %d chars",
    vocab.length, text, base64Image.length);

  const res = await fetch(ROBOFLOW_DINO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: ROBOFLOW_API_KEY,
      image: { type: "base64", value: base64Image },
      text,
      box_threshold: 0.2,
      text_threshold: 0.2,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[COUNTR] DINO HTTP error:", res.status, errBody.slice(0, 500));
    throw new Error(`Grounding DINO error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const rawData = await res.json();
  console.log("[COUNTR] DINO raw response keys:", Object.keys(rawData));
  console.log("[COUNTR] DINO raw predictions count:", rawData.predictions?.length ?? "MISSING");
  if (rawData.predictions?.length > 0) {
    console.log("[COUNTR] DINO sample prediction:", JSON.stringify(rawData.predictions[0]));
  }

  const data: DINOResponse = {
    predictions: Array.isArray(rawData.predictions) ? rawData.predictions : [],
    image: rawData.image || { width: 0, height: 0 },
  };

  // Apply NMS to remove overlapping duplicate boxes
  data.predictions = applyNMS(data.predictions);

  console.log("[COUNTR] DINO found %d boxes (after NMS)", data.predictions.length);
  return data;
}

// ── Flatten DINO results to FlatPredictions ──────────────────────

export function flattenDINOResults(dinoResponse: DINOResponse): FlatPrediction[] {
  return dinoResponse.predictions.map((pred) => {
    const halfW = pred.width / 2;
    const halfH = pred.height / 2;
    return {
      class: pred.class,
      confidence: pred.confidence,
      polygon: [
        [pred.x - halfW, pred.y - halfH], // top-left
        [pred.x + halfW, pred.y - halfH], // top-right
        [pred.x + halfW, pred.y + halfH], // bottom-right
        [pred.x - halfW, pred.y + halfH], // bottom-left
      ],
      box: { x: pred.x, y: pred.y, width: pred.width, height: pred.height },
      idMethod: "dino" as const,
    };
  });
}

// ── Crop bounding box region to Blob (for DINOv2 catalog) ────────

export function cropBoxRegion(img: HTMLImageElement, box: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const left = box.x - box.width / 2;
  const top = box.y - box.height / 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width));
  canvas.height = Math.max(1, Math.round(box.height));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    img,
    left, top, box.width, box.height,
    0, 0, canvas.width, canvas.height,
  );
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9),
  );
}
