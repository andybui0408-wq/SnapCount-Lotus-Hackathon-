import type { MergedPrediction, MergedItem } from "../types";
import type { MultiAngleResult, SinglePhotoResult } from "./geminiMultiAngle";

// Safely coerce to number — Gemini sometimes returns strings or undefined
function num(v: unknown): number {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function mergeMultiAngle(
  predictions: MergedPrediction[],
  gemini: MultiAngleResult | null,
): MergedItem[] {
  const items: Map<string, MergedItem> = new Map();

  if (gemini?.products) {
    for (const gp of gemini.products) {
      const front = num(gp.front_visible);
      const depth = num(gp.depth_visible);
      const total = num(gp.total) || (front + depth);
      items.set(gp.product.toLowerCase(), {
        name: gp.product,
        front_visible: front,
        depth_visible: depth,
        total,
        id_method: "gemini",
        notes: gp.notes,
      });
    }
  }

  const predCounts: Map<string, { count: number; method: MergedItem["id_method"] }> = new Map();
  for (const p of predictions) {
    const name = p.catalog_match || p.class;
    const key = name.toLowerCase();
    const existing = predCounts.get(key);
    if (existing) existing.count += 1;
    else predCounts.set(key, { count: 1, method: p.id_method });
  }

  for (const [key, info] of predCounts) {
    if (!items.has(key)) {
      items.set(key, {
        name: key,
        front_visible: info.count,
        depth_visible: 0,
        total: info.count,
        id_method: info.method,
      });
    } else {
      const existing = items.get(key)!;
      if (info.method === "catalog") existing.id_method = "catalog";
    }
  }

  return Array.from(items.values());
}

export function mergeSinglePhoto(
  predictions: MergedPrediction[],
  gemini: SinglePhotoResult | null,
): MergedItem[] {
  const items: Map<string, MergedItem> = new Map();

  if (gemini?.products) {
    for (const gp of gemini.products) {
      // Gemini may return visible_count, count, or front_visible
      const raw = gp as unknown as Record<string, unknown>;
      const count = num(raw.visible_count ?? raw.count ?? raw.front_visible ?? 0);
      items.set(gp.product.toLowerCase(), {
        name: gp.product,
        front_visible: count,
        depth_visible: 0,
        total: count,
        id_method: "gemini",
        notes: gp.notes,
      });
    }
  }

  const predCounts: Map<string, { count: number; method: MergedItem["id_method"] }> = new Map();
  for (const p of predictions) {
    const name = p.catalog_match || p.class;
    const key = name.toLowerCase();
    const existing = predCounts.get(key);
    if (existing) existing.count += 1;
    else predCounts.set(key, { count: 1, method: p.id_method });
  }

  for (const [key, info] of predCounts) {
    if (!items.has(key)) {
      items.set(key, {
        name: key,
        front_visible: info.count,
        depth_visible: 0,
        total: info.count,
        id_method: info.method,
      });
    }
  }

  return Array.from(items.values());
}
