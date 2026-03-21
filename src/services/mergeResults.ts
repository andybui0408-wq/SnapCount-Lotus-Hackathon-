import type { MergedPrediction, MergedItem } from "../types";
import type { SinglePhotoResult, ConsensusResult } from "./geminiMultiAngle";
import type { ProductConsensus } from "./consensusCount";

// Safely coerce to number — Gemini sometimes returns strings or undefined
function num(v: unknown): number {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// ── Merge consensus verification result ─────────────────────────

export function mergeConsensus(
  gemini: ConsensusResult | null,
  consensus: ProductConsensus[],
): MergedItem[] {
  if (gemini?.products && gemini.products.length > 0) {
    return gemini.products.map(gp => {
      const cs = consensus.find(c => c.product.toLowerCase() === gp.name.toLowerCase());

      return {
        name: gp.name,
        front_visible: num(gp.your_count),
        depth_visible: num(gp.depth_additional),
        total: num(gp.total) || (num(gp.your_count) + num(gp.depth_additional)),
        id_method: "consensus" as const,
        notes: gp.adjustment_reason || undefined,
        estimated_price: num(gp.estimated_price),
        consensus_count: num(gp.consensus_count),
        adjusted: gp.adjusted,
        adjustment_reason: gp.adjustment_reason || undefined,
        confidence: (gp.confidence || cs?.confidence || "medium") as "high" | "medium" | "low",
        framesDetected: cs?.framesDetected,
        totalFrames: cs?.totalFrames,
        spread: cs?.spread,
      };
    });
  }

  // Fallback: use consensus counts directly (Gemini failed)
  return consensus.map(c => ({
    name: c.product,
    front_visible: c.consensusCount,
    depth_visible: 0,
    total: c.consensusCount,
    id_method: "consensus" as const,
    confidence: c.confidence,
    consensus_count: c.consensusCount,
    framesDetected: c.framesDetected,
    totalFrames: c.totalFrames,
    spread: c.spread,
  }));
}

// ── Merge single photo result ───────────────────────────────────

export function mergeSinglePhoto(
  predictions: MergedPrediction[],
  gemini: SinglePhotoResult | null,
): MergedItem[] {
  const items: Map<string, MergedItem> = new Map();

  if (gemini?.products) {
    for (const gp of gemini.products) {
      const raw = gp as unknown as Record<string, unknown>;
      const count = num(raw.visible_count ?? raw.count ?? raw.front_visible ?? 0);
      items.set(gp.product.toLowerCase(), {
        name: gp.product,
        front_visible: count,
        depth_visible: 0,
        total: count,
        id_method: "gemini",
        notes: gp.notes,
        estimated_price: num(raw.estimated_price),
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
