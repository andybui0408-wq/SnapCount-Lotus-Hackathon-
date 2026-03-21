import type { MergedPrediction, MergedItem } from "../types";
import type { MultiAngleResult, SinglePhotoResult } from "./geminiMultiAngle";

export function mergeMultiAngle(
  predictions: MergedPrediction[],
  gemini: MultiAngleResult | null
): MergedItem[] {
  const items: Map<string, MergedItem> = new Map();

  // Gemini multi-angle counts incorporate depth — use as primary source
  if (gemini?.products) {
    for (const gp of gemini.products) {
      items.set(gp.product, {
        name: gp.product,
        front_visible: gp.front_visible,
        depth_visible: gp.depth_visible,
        total: gp.total,
        id_method: "gemini",
        notes: gp.notes,
      });
    }
  }

  // Enrich with detection method from predictions
  const predCounts: Map<string, { count: number; method: MergedItem["id_method"] }> = new Map();
  for (const p of predictions) {
    const name = p.catalog_match || p.dino_label;
    const existing = predCounts.get(name);
    if (existing) existing.count += 1;
    else predCounts.set(name, { count: 1, method: p.id_method });
  }

  for (const [name, info] of predCounts) {
    if (!items.has(name)) {
      items.set(name, {
        name,
        front_visible: info.count,
        depth_visible: 0,
        total: info.count,
        id_method: info.method,
      });
    } else {
      const existing = items.get(name)!;
      if (info.method === "catalog") existing.id_method = "catalog";
    }
  }

  return Array.from(items.values());
}

export function mergeSinglePhoto(
  predictions: MergedPrediction[],
  gemini: SinglePhotoResult | null
): MergedItem[] {
  const items: Map<string, MergedItem> = new Map();

  if (gemini?.products) {
    for (const gp of gemini.products) {
      items.set(gp.product, {
        name: gp.product,
        front_visible: gp.visible_count,
        depth_visible: 0,
        total: gp.visible_count,
        id_method: "gemini",
        notes: gp.notes,
      });
    }
  }

  const predCounts: Map<string, { count: number; method: MergedItem["id_method"] }> = new Map();
  for (const p of predictions) {
    const name = p.catalog_match || p.dino_label;
    const existing = predCounts.get(name);
    if (existing) existing.count += 1;
    else predCounts.set(name, { count: 1, method: p.id_method });
  }

  for (const [name, info] of predCounts) {
    if (!items.has(name)) {
      items.set(name, {
        name,
        front_visible: info.count,
        depth_visible: 0,
        total: info.count,
        id_method: info.method,
      });
    }
  }

  return Array.from(items.values());
}
