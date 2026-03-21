import { useState } from "react";
import { readLabelsFromImage } from "../services/geminiOCR";
import { detectProducts, flattenDINOResults, cropBoxRegion } from "../services/groundingDinoAPI";
import type { FlatPrediction } from "../services/groundingDinoAPI";
import { analyzeMultiAngle, analyzeSinglePhoto } from "../services/geminiMultiAngle";
import { matchCatalog, getCatalog } from "../services/productCatalog";
import { mergeMultiAngle, mergeSinglePhoto } from "../services/mergeResults";
import { saveScan } from "../services/scanHistory";
import type { ScanResult, MergedPrediction, MergedItem } from "../types";
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

// Convert FlatPredictions (from Grounding DINO) into MergedPredictions for overlay
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

// Convert Gemini bounding boxes (normalized 0-1000) to MergedPredictions
function geminiBboxToPredictions(
  products: Array<{ product: string; boxes?: number[][] }>,
  imageWidth: number,
  imageHeight: number,
): MergedPrediction[] {
  const preds: MergedPrediction[] = [];
  for (const gp of products) {
    if (!gp.boxes || !Array.isArray(gp.boxes)) continue;
    for (const box of gp.boxes) {
      if (!Array.isArray(box) || box.length < 4) continue;
      const [ymin, xmin, ymax, xmax] = box;
      const x1 = (xmin / 1000) * imageWidth;
      const y1 = (ymin / 1000) * imageHeight;
      const x2 = (xmax / 1000) * imageWidth;
      const y2 = (ymax / 1000) * imageHeight;
      preds.push({
        polygon: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
        confidence: 1.0,
        class: gp.product,
        catalog_match: null,
        catalog_similarity: 0,
        id_method: "dino",
      });
    }
  }
  return preds;
}

// Format DINO detections as text for Gemini context
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
      const imgDims = await getImageDims(photos[0]);

      // ═══════════════════════════════════════════════════════════
      // Step 1: Grounding DINO detection + OCR (in parallel)
      // ═══════════════════════════════════════════════════════════
      console.log("[COUNTR] Step 1: Grounding DINO + OCR on Photo 1...");

      const settled = await Promise.allSettled([
        detectProducts(photos[0]),
        readLabelsFromImage(photos[0]),
      ]);

      let dinoResult = null;
      let dinoError = "";
      if (settled[0].status === "fulfilled") {
        dinoResult = settled[0].value;
        console.log("[COUNTR] DINO raw response: %d predictions, image=%dx%d",
          dinoResult.predictions.length, dinoResult.image?.width, dinoResult.image?.height);
      } else {
        dinoError = settled[0].reason instanceof Error ? settled[0].reason.message : String(settled[0].reason);
        console.error("[COUNTR] DINO FAILED:", dinoError);
      }

      const ocrTexts = settled[1].status === "fulfilled" ? settled[1].value : [] as string[];
      if (settled[1].status === "rejected") {
        console.error("[COUNTR] OCR FAILED:", settled[1].reason);
      }

      // Flatten DINO results (bounding boxes → polygon format)
      const flatPredictions: FlatPrediction[] = dinoResult
        ? flattenDINOResults(dinoResult)
        : [];

      console.log("[COUNTR] DINO found %d boxes", flatPredictions.length);

      // ═══════════════════════════════════════════════════════════
      // Step 2: DINOv2 catalog matching on each box crop
      // ═══════════════════════════════════════════════════════════
      const hasCatalog = getCatalog().length > 0;

      if (hasCatalog && flatPredictions.length > 0) {
        console.log("[COUNTR] Step 2: DINOv2 catalog matching...");
        const img = await loadImage(photos[0]);

        const matchPromises = flatPredictions.map(async (pred) => {
          try {
            const blob = await cropBoxRegion(img, pred.box);
            const match = await matchCatalog(blob);
            if (match.name) {
              pred.catalogMatch = match.name;
              pred.catalogSimilarity = match.similarity;
              pred.idMethod = "catalog";
            }
          } catch {
            // Catalog match failed — keep DINO label
          }
        });

        await Promise.allSettled(matchPromises);
        console.log("[COUNTR] Catalog matching complete");
      }

      // Build detection context for Gemini
      const detectionContext = formatDetectionResults(flatPredictions);
      let predictions = flatToMerged(flatPredictions);

      let items: MergedItem[];
      let depthNotes = "";

      let geminiProducts: Array<{ product: string; boxes?: number[][] }> = [];

      if (mode === "multi" && photos.length >= 2) {
        // ═══════════════════════════════════════════════════════════
        // Step 3: Gemini multi-angle depth reasoning (single call)
        // ═══════════════════════════════════════════════════════════
        console.log("[COUNTR] Step 3: Gemini multi-angle reasoning...");

        const geminiResult = await analyzeMultiAngle(photos, detectionContext).catch(() => null);

        console.log("[COUNTR] Gemini multi-angle result:", geminiResult);

        if (geminiResult) {
          items = mergeMultiAngle(predictions, geminiResult);
          depthNotes = geminiResult.depth_notes || "";
          geminiProducts = (geminiResult.products || []).map((p) => ({
            product: p.product,
            boxes: p.boxes,
          }));
        } else {
          items = mergeMultiAngle(predictions, null);
          depthNotes = "Gemini depth reasoning failed — showing detection counts only";
        }
      } else {
        // ═══════════════════════════════════════════════════════════
        // Single photo: Gemini counts visible items
        // ═══════════════════════════════════════════════════════════
        console.log("[COUNTR] Single photo: Gemini counting...");

        const geminiResult = await analyzeSinglePhoto(photos[0], detectionContext).catch(() => null);
        items = mergeSinglePhoto(predictions, geminiResult);
        depthNotes = geminiResult?.note || "Single angle — take a side photo to see depth";
        if (geminiResult?.products) {
          geminiProducts = geminiResult.products.map((p) => ({
            product: p.product,
            boxes: p.boxes,
          }));
        }
      }

      // ═══════════════════════════════════════════════════════════
      // Fallback: Use Gemini bounding boxes when DINO found nothing
      // ═══════════════════════════════════════════════════════════
      if (predictions.length === 0 && geminiProducts.length > 0) {
        console.log("[COUNTR] DINO returned 0 boxes — using Gemini bounding boxes as fallback");
        const geminiBboxes = geminiBboxToPredictions(geminiProducts, imgDims.width, imgDims.height);
        if (geminiBboxes.length > 0) {
          predictions = geminiBboxes;
          console.log("[COUNTR] Gemini provided %d bounding boxes", predictions.length);
        }
      }

      const thumbnail = await makeThumbnail(photos[0]);

      const totalFront = items.reduce((sum, i) => sum + i.front_visible, 0);
      const totalDepth = items.reduce((sum, i) => sum + i.depth_visible, 0);
      const totalItems = items.reduce((sum, i) => sum + i.total, 0);

      console.log("[COUNTR] Final: front=%d depth=%d total=%d boxes=%d",
        totalFront, totalDepth, totalItems, predictions.length);

      const scan: ScanResult = {
        id: Date.now().toString(36),
        timestamp: Date.now(),
        items,
        total_front: totalFront,
        total_depth: totalDepth,
        total_items: totalItems,
        ocr_texts: ocrTexts as string[],
        depth_notes: depthNotes,
        thumbnail,
        predictions,
        imageWidth: imgDims.width,
        imageHeight: imgDims.height,
      };

      saveScan(scan);
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
