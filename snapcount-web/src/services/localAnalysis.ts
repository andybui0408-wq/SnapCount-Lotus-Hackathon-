// Builds MergedResult from Florence-2 detections + optional Qwen reasoning

import type { BoundingBox, MergedResult, MergedItem } from "../types";

interface QwenItem {
  name: string;
  visible: number;
  estimated_hidden: number;
  reasoning: string;
}

function findBestQwenMatch(className: string, qwenItems: QwenItem[]): QwenItem | undefined {
  const lower = className.toLowerCase();
  return qwenItems.find(
    (qi) => lower.includes(qi.name.toLowerCase()) || qi.name.toLowerCase().includes(lower)
  );
}

export function buildMergedResult(
  boundingBoxes: BoundingBox[],
  classCounts: Record<string, number>,
  ocrTexts: string[],
  qwenItems: QwenItem[],
  sceneDescription: string,
  occlusionSeverity: string,
  occlusionNotes: string,
  imageWidth: number,
  imageHeight: number,
  inferenceTimeMs: number,
  scanMode: "single" | "multi-angle" = "single",
  photoCount: number = 1
): MergedResult {
  const items: MergedItem[] = [];

  for (const [className, count] of Object.entries(classCounts)) {
    const qwen = findBestQwenMatch(className, qwenItems);
    const visible = qwen?.visible ?? count;
    const hidden = qwen?.estimated_hidden ?? 0;
    const reasoning = qwen?.reasoning ?? `Detected ${count} ${className}.`;

    const classBoxes = boundingBoxes.filter((b) => b.class === className);
    const ocrLabels = [
      ...new Set(classBoxes.map((b) => b.ocr_text).filter((t): t is string => !!t)),
    ];

    items.push({
      name: className,
      boxCount: count,
      visibleCount: visible,
      hiddenCount: hidden,
      totalEstimate: visible + hidden,
      confidence: "high",
      reasoning,
      ocrLabels: ocrLabels.length > 0 ? ocrLabels : undefined,
    });
  }

  items.sort((a, b) => b.totalEstimate - a.totalEstimate);

  const totalVisible = items.reduce((s, i) => s + i.visibleCount, 0);
  const totalHidden = items.reduce((s, i) => s + i.hiddenCount, 0);

  return {
    items,
    boundingBoxes,
    totalBoxDetections: totalVisible,
    totalVisionEstimate: totalVisible + totalHidden,
    occlusionDelta: totalHidden,
    sceneDescription,
    occlusionSeverity,
    occlusionNotes,
    imageWidth,
    imageHeight,
    ocrTexts,
    inferenceTimeMs,
    scanMode,
    photoCount,
  };
}

// Multi-angle: merge Florence results, take max per class
export function mergeMultiAngleFlorenceResults(
  results: Array<{
    predictions: BoundingBox[];
    class_counts: Record<string, number>;
    ocr_texts: string[];
    image_width: number;
    image_height: number;
    inference_time_ms: number;
  }>
): {
  predictions: BoundingBox[];
  class_counts: Record<string, number>;
  ocr_texts: string[];
  image_width: number;
  image_height: number;
  inference_time_ms: number;
} {
  const bestPerClass = new Map<string, { count: number; boxes: BoundingBox[] }>();
  const allOcr = new Set<string>();
  let totalTime = 0;

  for (const r of results) {
    totalTime += r.inference_time_ms;
    for (const t of r.ocr_texts) allOcr.add(t);

    const groups = new Map<string, BoundingBox[]>();
    for (const p of r.predictions) {
      if (!groups.has(p.class)) groups.set(p.class, []);
      groups.get(p.class)!.push(p);
    }
    for (const [cls, boxes] of groups) {
      const existing = bestPerClass.get(cls);
      if (!existing || boxes.length > existing.count) {
        bestPerClass.set(cls, { count: boxes.length, boxes });
      }
    }
  }

  const predictions: BoundingBox[] = [];
  const class_counts: Record<string, number> = {};
  for (const [cls, { count, boxes }] of bestPerClass) {
    predictions.push(...boxes);
    class_counts[cls] = count;
  }

  return {
    predictions,
    class_counts,
    ocr_texts: [...allOcr],
    image_width: results[0].image_width,
    image_height: results[0].image_height,
    inference_time_ms: totalTime,
  };
}
