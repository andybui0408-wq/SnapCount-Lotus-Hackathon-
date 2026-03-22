import { useState } from "react";
import { detectProducts, flattenDINOResults, cropBoxRegion } from "../services/groundingDinoAPI";
import type { FlatPrediction, DINOResponse } from "../services/groundingDinoAPI";
import { analyzeWithConsensus, analyzeSinglePhoto } from "../services/geminiMultiAngle";
import { matchCatalog, getCatalog } from "../services/productCatalog";
import { mergeConsensus, mergeSinglePhoto } from "../services/mergeResults";
import { buildFrameDetections, computeConsensus } from "../services/consensusCount";
import { saveScan } from "../services/scanHistory";
import { savePrices, getPrice } from "../services/priceStore";
import type { ScanResult, MergedPrediction, MergedItem, AngleAnnotation } from "../types";
import { THUMBNAIL_SIZE, THUMBNAIL_QUALITY } from "../constants/config";

interface AnalysisState {
  loading: boolean;
  error: string | null;
  result: ScanResult | null;
}

function makeThumbnail(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(THUMBNAIL_SIZE / img.width, THUMBNAIL_SIZE / img.height);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY).split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function getImageDims(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function flatToMerged(flat: FlatPrediction[]): MergedPrediction[] {
  return flat.map((f) => ({
    polygon: f.polygon,
    confidence: f.confidence,
    class: f.class,
    catalog_match: f.catalogMatch || null,
    catalog_similarity: f.catalogSimilarity || 0,
    id_method: (f.idMethod === "catalog" ? "catalog" : f.idMethod === "dino" ? "dino" : "unmatched") as MergedPrediction["id_method"],
  }));
}

/** Convert Gemini's normalized 0-1000 boxes to MergedPredictions in pixel coords */
function geminiBoxesToPredictions(
  products: Array<{ product: string; boxes?: number[][]; visible_count?: number }>,
  imgW: number,
  imgH: number,
): MergedPrediction[] {
  const preds: MergedPrediction[] = [];
  for (const gp of products) {
    if (!gp.boxes || gp.boxes.length === 0) continue;
    for (const box of gp.boxes) {
      if (box.length < 4) continue;
      // Gemini format: [ymin, xmin, ymax, xmax] normalized 0-1000
      const [ymin, xmin, ymax, xmax] = box;
      const x1 = (xmin / 1000) * imgW;
      const y1 = (ymin / 1000) * imgH;
      const x2 = (xmax / 1000) * imgW;
      const y2 = (ymax / 1000) * imgH;
      preds.push({
        polygon: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
        confidence: 0.8,
        class: gp.product,
        catalog_match: null,
        catalog_similarity: 0,
        id_method: "dino",
      });
    }
  }
  return preds;
}

function formatDetectionResults(flat: FlatPrediction[]): string {
  if (flat.length === 0) return "No products detected by the detection system.";

  const counts = new Map<string, number>();
  for (const f of flat) {
    const name = f.catalogMatch || f.class;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const lines = Array.from(counts.entries()).map(
    ([name, count]) => `- ${name}: ${count} instance${count > 1 ? "s" : ""} detected`,
  );
  return lines.join("\n");
}

export function useInventoryAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    loading: false,
    error: null,
    result: null,
  });

  const analyze = async (photos: string[], mode: "quick" | "multi") => {
    setState({ loading: true, error: null, result: null });

    try {
      const allDims = await Promise.all(photos.map((p) => getImageDims(p)));
      const imgDims = allDims[0];

      // Step 1: Grounding DINO on ALL frames (parallel)
      console.log("[COUNTR] Step 1: DINO on %d frames (parallel)...", photos.length);

      const dinoResults: (DINOResponse | null)[] = await Promise.all(
        photos.map((photo, i) =>
          detectProducts(photo).then(
            (res) => { console.log("[COUNTR] DINO frame %d: %d predictions", i, res.predictions.length); return res; },
            (err) => { console.error("[COUNTR] DINO frame %d FAILED:", i, err); return null; },
          ),
        ),
      );

      const perFrameFlat: FlatPrediction[][] = dinoResults.map((dr) =>
        dr ? flattenDINOResults(dr) : [],
      );

      const flatPredictions = perFrameFlat[0];
      console.log("[COUNTR] DINO total boxes across frames: %d",
        perFrameFlat.reduce((s, f) => s + f.length, 0));

      // Step 1b: DINOv2 catalog matching (only if catalog exists)
      const hasCatalog = getCatalog().length > 0;

      if (hasCatalog && flatPredictions.length > 0) {
        console.log("[COUNTR] Catalog matching on %d boxes...", flatPredictions.length);
        const img = await loadImage(photos[0]);

        await Promise.allSettled(
          flatPredictions.map(async (pred) => {
            try {
              const blob = await cropBoxRegion(img, pred.box);
              const match = await matchCatalog(blob);
              if (match.name) {
                pred.catalogMatch = match.name;
                pred.catalogSimilarity = match.similarity;
                pred.idMethod = "catalog";
              }
            } catch {
              // keep DINO label
            }
          }),
        );
      }

      const dinoPredictions = flatToMerged(flatPredictions);
      let predictions = dinoPredictions;
      let items: MergedItem[];
      let depthNotes = "";

      if (mode === "multi" && photos.length >= 2) {
        // Step 2: Consensus counting
        console.log("[COUNTR] Step 2: Building consensus...");

        const frameDetections = buildFrameDetections(perFrameFlat, allDims);
        const consensus = computeConsensus(frameDetections, photos.length);

        // Step 3: Gemini verification
        console.log("[COUNTR] Step 3: Gemini verification...");

        const geminiResult = await analyzeWithConsensus(photos, consensus, frameDetections).catch((err) => {
          console.error("[COUNTR] Gemini failed:", err);
          return null;
        });

        items = mergeConsensus(geminiResult, consensus);
        depthNotes = geminiResult?.depth_notes || "";

        // Always prefer Gemini boxes — they match the items Gemini identified
        if (geminiResult?.products) {
          const gBoxes = geminiResult.products.map(p => ({
            product: p.name,
            boxes: p.boxes,
          }));
          const geminiPreds = geminiBoxesToPredictions(gBoxes, imgDims.width, imgDims.height);
          console.log("[COUNTR] Gemini consensus boxes: %d (DINO had %d)", geminiPreds.length, dinoPredictions.length);
          if (geminiPreds.length > 0) {
            predictions = geminiPreds;
          }
        }
      } else {
        // Single photo
        console.log("[COUNTR] Single photo: Gemini counting...");

        const detectionContext = formatDetectionResults(flatPredictions);
        const geminiResult = await analyzeSinglePhoto(photos[0], detectionContext).catch(() => null);
        items = mergeSinglePhoto(dinoPredictions, geminiResult);
        depthNotes = geminiResult?.note || "";

        // Always prefer Gemini boxes — they match the identified products
        if (geminiResult?.products) {
          const geminiPreds = geminiBoxesToPredictions(geminiResult.products, imgDims.width, imgDims.height);
          console.log("[COUNTR] Gemini single-photo boxes: %d (DINO had %d)", geminiPreds.length, dinoPredictions.length);
          if (geminiPreds.length > 0) {
            predictions = geminiPreds;
          }
        }
      }

      // Per-frame annotations — each frame gets its own DINO boxes
      // Frame 0: prefer Gemini boxes (product-specific names), others: DINO per-frame
      const angleAnnotations: AngleAnnotation[] = photos.map((_, i) => {
        const dinoPreds = flatToMerged(perFrameFlat[i]);
        const framePreds = i === 0
          ? (predictions.length > 0 ? predictions : dinoPreds)
          : (dinoPreds.length > 0 ? dinoPreds : predictions);
        console.log("[COUNTR] Frame %d annotations: %d boxes (source: %s)", i, framePreds.length,
          i === 0 && predictions.length > 0 ? "gemini" : dinoPreds.length > 0 ? "dino" : "fallback");
        return {
          predictions: framePreds,
          imageWidth: allDims[i].width,
          imageHeight: allDims[i].height,
          label: `Frame ${i + 1}`,
        };
      });

      // Main predictions = frame 0's annotations (Gemini preferred)
      predictions = angleAnnotations[0].predictions;

      const thumbnail = await makeThumbnail(photos[0]);

      const totalFront = items.reduce((sum, i) => sum + i.front_visible, 0);
      const totalDepth = items.reduce((sum, i) => sum + i.depth_visible, 0);
      const totalItems = items.reduce((sum, i) => sum + i.total, 0);

      const scan: ScanResult = {
        id: Date.now().toString(36),
        timestamp: Date.now(),
        items,
        total_front: totalFront,
        total_depth: totalDepth,
        total_items: totalItems,
        ocr_texts: [],
        depth_notes: depthNotes,
        thumbnail,
        predictions,
        imageWidth: imgDims.width,
        imageHeight: imgDims.height,
        angleAnnotations,
      };

      saveScan(scan);

      // Auto-save Gemini-estimated prices for products that don't have saved prices yet
      const aiPrices = scan.items
        .filter((i) => i.estimated_price && i.estimated_price > 0 && getPrice(i.name) === null)
        .map((i) => ({ name: i.name, sellPrice: i.estimated_price! }));
      if (aiPrices.length > 0) savePrices(aiPrices);

      setState({ loading: false, error: null, result: scan });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        result: null,
      });
    }
  };

  return { ...state, analyze };
}
