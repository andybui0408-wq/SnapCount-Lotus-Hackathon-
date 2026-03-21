import { useState } from "react";
import { readLabelsFromImage } from "../services/geminiOCR";
import { detectProducts, flattenDINOResults, cropBoxRegion } from "../services/groundingDinoAPI";
import type { FlatPrediction, DINOResponse } from "../services/groundingDinoAPI";
import { analyzeWithConsensus, analyzeSinglePhoto } from "../services/geminiMultiAngle";
import { matchCatalog, getCatalog } from "../services/productCatalog";
import { mergeConsensus, mergeSinglePhoto } from "../services/mergeResults";
import { buildFrameDetections, computeConsensus } from "../services/consensusCount";
import { saveScan } from "../services/scanHistory";
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

// Format DINO detections as text for Gemini context (single photo path)
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
      // Get dimensions for all frames in parallel
      const allDims = await Promise.all(photos.map((p) => getImageDims(p)));
      const imgDims = allDims[0];

      // ═══════════════════════════════════════════════════════════
      // Step 1: Grounding DINO on ALL frames + OCR (in parallel)
      // ═══════════════════════════════════════════════════════════
      console.log("[COUNTR] Step 1: Grounding DINO on %d frames + OCR...", photos.length);

      // Stagger DINO requests 250ms apart to avoid API rate limiting
      const dinoStarted: Promise<DINOResponse | null>[] = [];
      for (let i = 0; i < photos.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 250));
        dinoStarted.push(
          detectProducts(photos[i]).then(
            (res) => { console.log("[COUNTR] DINO frame %d: %d predictions", i, res.predictions.length); return res; },
            (err) => { console.error("[COUNTR] DINO frame %d FAILED:", i, err); return null; },
          ),
        );
      }

      // OCR runs in parallel with the DINO calls
      const [dinoResults, ocrSettled] = await Promise.all([
        Promise.all(dinoStarted),
        readLabelsFromImage(photos[0]).catch(() => [] as string[]),
      ]);

      const ocrTexts = ocrSettled;

      // Flatten DINO results for each frame
      const perFrameFlat: FlatPrediction[][] = dinoResults.map((dr) =>
        dr ? flattenDINOResults(dr) : [],
      );

      const flatPredictions = perFrameFlat[0];
      console.log("[COUNTR] DINO frame 0: %d boxes, total across frames: %d",
        flatPredictions.length, perFrameFlat.reduce((s, f) => s + f.length, 0));

      // ═══════════════════════════════════════════════════════════
      // Step 2: DINOv2 catalog matching on frame 0 box crops
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

      let predictions = flatToMerged(flatPredictions);
      let items: MergedItem[];
      let depthNotes = "";

      if (mode === "multi" && photos.length >= 2) {
        // ═══════════════════════════════════════════════════════════
        // Step 3: Consensus counting — DINO on all frames
        // ═══════════════════════════════════════════════════════════
        console.log("[COUNTR] Step 3: Building consensus from %d frames...", photos.length);

        const frameDetections = buildFrameDetections(perFrameFlat, allDims);
        const consensus = computeConsensus(frameDetections, photos.length);

        console.log("[COUNTR] Consensus: %s",
          consensus.map(c => `${c.product}=${c.consensusCount}(${c.confidence})`).join(", "));

        // ═══════════════════════════════════════════════════════════
        // Step 4: Gemini consensus verification (all frames + consensus data)
        // ═══════════════════════════════════════════════════════════
        console.log("[COUNTR] Step 4: Gemini consensus verification...");

        const geminiResult = await analyzeWithConsensus(photos, consensus, frameDetections).catch((err) => {
          console.error("[COUNTR] Gemini consensus verification failed:", err);
          return null;
        });

        console.log("[COUNTR] Gemini consensus result:", geminiResult);

        items = mergeConsensus(geminiResult, consensus);
        depthNotes = geminiResult?.depth_notes || "Multi-angle consensus counting";
      } else {
        // ═══════════════════════════════════════════════════════════
        // Single photo: Gemini counts visible items + price
        // ═══════════════════════════════════════════════════════════
        console.log("[COUNTR] Single photo: Gemini counting...");

        const detectionContext = formatDetectionResults(flatPredictions);
        const geminiResult = await analyzeSinglePhoto(photos[0], detectionContext).catch(() => null);
        items = mergeSinglePhoto(predictions, geminiResult);
        depthNotes = geminiResult?.note || "Single angle — take a side photo to see depth";
      }

      // ═══════════════════════════════════════════════════════════
      // Build per-frame angle annotations (each frame's own DINO boxes)
      // ═══════════════════════════════════════════════════════════
      const angleAnnotations: AngleAnnotation[] = photos.map((_, i) => {
        const framePreds = flatToMerged(perFrameFlat[i]);
        return {
          predictions: framePreds,
          imageWidth: allDims[i].width,
          imageHeight: allDims[i].height,
          label: `Frame ${i + 1}`,
        };
      });

      // Primary predictions = frame 0's annotations
      predictions = angleAnnotations[0].predictions;

      console.log("[COUNTR] Per-frame boxes: %s",
        angleAnnotations.map((a, i) => `frame${i}=${a.predictions.length}`).join(", "));

      const thumbnail = await makeThumbnail(photos[0]);

      const totalFront = items.reduce((sum, i) => sum + i.front_visible, 0);
      const totalDepth = items.reduce((sum, i) => sum + i.depth_visible, 0);
      const totalItems = items.reduce((sum, i) => sum + i.total, 0);

      console.log("[COUNTR] Final: front=%d depth=%d total=%d",
        totalFront, totalDepth, totalItems);

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
        angleAnnotations,
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
