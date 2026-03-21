import { useState } from "react";
import { readLabelsFromImage } from "../services/geminiOCR";
import { countSingleAngle, reconcileAngles, analyzeSinglePhoto } from "../services/geminiMultiAngle";
import type { MultiAngleResult, SinglePhotoResult, PerAngleResult, BboxEntry } from "../services/geminiMultiAngle";
import { mergeSinglePhoto } from "../services/mergeResults";
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

// Convert Gemini's bboxes array into MergedPredictions for canvas drawing
// Gemini returns [x_min, y_min, x_max, y_max] format
function bboxesToPredictions(
  bboxes: BboxEntry[] | undefined,
  geminiW: number,
  geminiH: number,
  actualW: number,
  actualH: number,
): MergedPrediction[] {
  if (!bboxes || bboxes.length === 0) return [];

  const scaleX = actualW / (geminiW || actualW);
  const scaleY = actualH / (geminiH || actualH);

  return bboxes.map((b) => ({
    // box is [x_min, y_min, x_max, y_max]
    x: b.box[0] * scaleX,
    y: b.box[1] * scaleY,
    width: (b.box[2] - b.box[0]) * scaleX,
    height: (b.box[3] - b.box[1]) * scaleY,
    confidence: 1.0,
    class: b.label,
    dino_label: b.label,
    catalog_match: null,
    catalog_similarity: 0,
    id_method: "grounding-dino" as const,
  }));
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

      // OCR runs in parallel with everything else
      const ocrPromise = readLabelsFromImage(photos[0]).catch(() => [] as string[]);

      let items: MergedItem[];
      let depthNotes = "";
      let predictions: MergedPrediction[] = [];
      let angleAnnotations: AngleAnnotation[] = [];

      if (mode === "multi" && photos.length >= 2) {
        // ═══════════════════════════════════════════════════════════
        // MULTI-ANGLE PIPELINE: Per-angle → Reconcile
        // ═══════════════════════════════════════════════════════════

        // Step 1: Count each angle independently (in parallel)
        console.log("[SnapCount] Step 1: Counting each angle independently...");
        const perAnglePromises = photos.map((photo) =>
          countSingleAngle(photo).catch(() => null)
        );
        const perAngleSettled = await Promise.all(perAnglePromises);
        const perAngleResults: PerAngleResult[] = perAngleSettled.filter(
          (r): r is PerAngleResult => r !== null
        );

        console.log("[SnapCount] Per-angle results:", perAngleResults.map((r, i) => ({
          angle: i + 1,
          total: r.total_items,
          products: r.products.map((p) => `${p.product}: ${p.count}`),
          bboxCount: r.bboxes?.length ?? 0,
        })));

        // Build per-angle annotations for all photos
        const angleLabels = ["Front", "Side", "Top"];
        const allDimsPromises = photos.map((p) => getImageDims(p));
        const allDims = await Promise.all(allDimsPromises);

        // Map settled results back to original photo indices
        for (let i = 0; i < photos.length; i++) {
          const r = perAngleSettled[i];
          if (r !== null) {
            const dims = allDims[i];
            const preds = bboxesToPredictions(
              r.bboxes,
              r.image_width || dims.width,
              r.image_height || dims.height,
              dims.width, dims.height,
            );
            angleAnnotations.push({
              predictions: preds,
              imageWidth: dims.width,
              imageHeight: dims.height,
              label: angleLabels[i] || `Angle ${i + 1}`,
            });
          }
        }

        // Step 2: Reconcile across all angles
        console.log("[SnapCount] Step 2: Reconciling across angles...");
        let reconciled: MultiAngleResult | null = null;

        if (perAngleResults.length >= 2) {
          reconciled = await reconcileAngles(photos, perAngleResults).catch(() => null);
        }

        console.log("[SnapCount] Reconciled result:", reconciled);

        if (reconciled) {
          items = reconciled.products.map((p) => ({
            name: p.product,
            front_visible: p.front_visible,
            depth_visible: p.depth_visible,
            total: p.total,
            id_method: "gemini" as const,
            notes: p.notes,
          }));
          depthNotes = reconciled.depth_notes || "";

          // Use reconciled bboxes (Photo 1 coordinates)
          predictions = bboxesToPredictions(
            reconciled.bboxes,
            reconciled.image_width || imgDims.width,
            reconciled.image_height || imgDims.height,
            imgDims.width, imgDims.height,
          );

          // Fallback: if reconciliation didn't return bboxes, use front angle's
          if (predictions.length === 0 && perAngleResults[0]?.bboxes) {
            predictions = bboxesToPredictions(
              perAngleResults[0].bboxes,
              perAngleResults[0].image_width || imgDims.width,
              perAngleResults[0].image_height || imgDims.height,
              imgDims.width, imgDims.height,
            );
          }
        } else if (perAngleResults.length > 0) {
          // Fallback: use the front angle's count if reconciliation failed
          const front = perAngleResults[0];
          items = front.products.map((p) => ({
            name: p.product,
            front_visible: p.count,
            depth_visible: 0,
            total: p.count,
            id_method: "gemini" as const,
          }));
          depthNotes = "Reconciliation failed — showing front angle count only";
          predictions = bboxesToPredictions(
            front.bboxes,
            front.image_width || imgDims.width,
            front.image_height || imgDims.height,
            imgDims.width, imgDims.height,
          );
        } else {
          items = [];
          depthNotes = "All angle analyses failed";
        }
      } else {
        // ═══════════════════════════════════════════════════════════
        // SINGLE PHOTO
        // ═══════════════════════════════════════════════════════════
        const geminiResult = await analyzeSinglePhoto(photos[0], "").catch(() => null);
        items = mergeSinglePhoto([], geminiResult);
        depthNotes = geminiResult?.note || "Single angle — take a side photo to see depth";

        if (geminiResult) {
          predictions = bboxesToPredictions(
            geminiResult.bboxes,
            geminiResult.image_width || imgDims.width,
            geminiResult.image_height || imgDims.height,
            imgDims.width, imgDims.height,
          );
        }
      }

      const ocrTexts = await ocrPromise;
      const thumbnail = await makeThumbnail(photos[0]);

      const totalFront = items.reduce((sum, i) => sum + i.front_visible, 0);
      const totalDepth = items.reduce((sum, i) => sum + i.depth_visible, 0);
      const totalItems = items.reduce((sum, i) => sum + i.total, 0);

      console.log("[SnapCount] Final: front=%d depth=%d total=%d bboxes=%d",
        totalFront, totalDepth, totalItems, predictions.length);

      const scan: ScanResult = {
        id: Date.now().toString(36),
        timestamp: Date.now(),
        items,
        total_front: totalFront,
        total_depth: totalDepth,
        total_items: totalItems,
        ocr_texts: ocrTexts,
        depth_notes: depthNotes,
        thumbnail,
        predictions,
        imageWidth: imgDims.width,
        imageHeight: imgDims.height,
        ...(angleAnnotations.length > 0 && { angleAnnotations }),
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
