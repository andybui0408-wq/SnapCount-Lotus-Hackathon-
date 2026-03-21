import { ROBOFLOW_API_KEY, ROBOFLOW_GROUNDING_DINO_URL, DEFAULT_VOCABULARY } from "../constants/config";

export interface DinoPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
}

export interface DinoResponse {
  predictions: DinoPrediction[];
  image: { width: number; height: number };
}

let currentVocabulary = DEFAULT_VOCABULARY;

export function setVocabulary(vocab: string) {
  currentVocabulary = vocab;
}

export function getVocabulary(): string {
  return currentVocabulary;
}

export async function detectWithGroundingDINO(
  base64Image: string,
  text?: string
): Promise<DinoResponse> {
  if (!ROBOFLOW_API_KEY) throw new Error("Roboflow API key not set");

  const res = await fetch(ROBOFLOW_GROUNDING_DINO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: ROBOFLOW_API_KEY,
      image: { type: "base64", value: base64Image },
      text: text || currentVocabulary,
      box_threshold: 0.15,
      text_threshold: 0.15,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Grounding DINO error ${res.status}: ${errBody}`);
  }

  const raw = await res.json();
  console.log("[SnapCount] Raw DINO API response keys:", Object.keys(raw));
  console.log("[SnapCount] Raw DINO API response:", JSON.stringify(raw).slice(0, 500));

  // Normalize response — Roboflow may use different field names
  const predictions: DinoPrediction[] = (raw.predictions || raw.results || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => ({
      x: p.x ?? p.cx ?? 0,
      y: p.y ?? p.cy ?? 0,
      width: p.width ?? p.w ?? 0,
      height: p.height ?? p.h ?? 0,
      confidence: p.confidence ?? p.score ?? 0,
      class: p.class ?? p.class_name ?? p.label ?? "unknown",
    })
  );

  const image = raw.image || {
    width: raw.width || raw.image_width || 1024,
    height: raw.height || raw.image_height || 768,
  };

  console.log("[SnapCount] Normalized predictions:", predictions.length, predictions.slice(0, 3));

  return { predictions, image };
}
