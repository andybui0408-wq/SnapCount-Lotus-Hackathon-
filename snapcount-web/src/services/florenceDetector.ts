import { FLORENCE_SERVER_URL } from "../constants/config";
import type { BoundingBox } from "../types";

export interface DetectionResponse {
  predictions: BoundingBox[];
  total_objects: number;
  class_counts: Record<string, number>;
  ocr_texts: string[];
  vocabulary: string[];
  catalog_size: number;
  image_width: number;
  image_height: number;
  inference_time_ms: number;
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${FLORENCE_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await resp.json();
    return data.status === "ok" && data.model_loaded;
  } catch {
    return false;
  }
}

export async function detectWithFlorence(base64Image: string): Promise<DetectionResponse> {
  const formData = new FormData();
  formData.append("image_base64", base64Image);

  const resp = await fetch(`${FLORENCE_SERVER_URL}/detect`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || `Server returned ${resp.status}`);
  }

  return resp.json();
}

// --- Vocabulary management ---

export async function getVocabulary(): Promise<string[]> {
  const resp = await fetch(`${FLORENCE_SERVER_URL}/get-vocabulary`);
  if (!resp.ok) throw new Error("Failed to fetch vocabulary");
  const data = await resp.json();
  return data.classes;
}

export async function setVocabulary(classes: string[]): Promise<void> {
  const resp = await fetch(`${FLORENCE_SERVER_URL}/set-vocabulary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classes }),
  });
  if (!resp.ok) throw new Error("Failed to update vocabulary");
}

// --- Product catalog ---

export async function addToCatalog(name: string, imageFile: File): Promise<{ name: string; catalog_size: number }> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("image", imageFile);

  const resp = await fetch(`${FLORENCE_SERVER_URL}/catalog/add`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) throw new Error("Failed to add product to catalog");
  return resp.json();
}

export async function listCatalog(): Promise<{ products: string[]; count: number }> {
  const resp = await fetch(`${FLORENCE_SERVER_URL}/catalog/list`);
  if (!resp.ok) throw new Error("Failed to fetch catalog");
  return resp.json();
}

export async function removeFromCatalog(name: string): Promise<void> {
  const resp = await fetch(`${FLORENCE_SERVER_URL}/catalog/remove/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!resp.ok) throw new Error("Failed to remove product");
}
