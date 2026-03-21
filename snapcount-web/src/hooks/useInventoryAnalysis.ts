import { useState, useCallback } from "react";
import { detectWithFlorence } from "../services/florenceDetector";
import { analyzeOcclusion } from "../services/vision";
import { buildMergedResult, mergeMultiAngleFlorenceResults } from "../services/localAnalysis";
import { getApiKey } from "../constants/config";
import type { MergedResult } from "../types";

interface AnalysisState {
  loading: boolean;
  result: MergedResult | null;
  error: string | null;
  progressText: string;
}

export function useInventoryAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    loading: false,
    result: null,
    error: null,
    progressText: "",
  });

  const analyzeSingle = useCallback(async (base64Image: string) => {
    setState({ loading: true, result: null, error: null, progressText: "Running YOLO-World + Florence-2 + DINOv2..." });

    try {
      const florence = await detectWithFlorence(base64Image);
      setState((p) => ({ ...p, progressText: "Analyzing with Gemini AI..." }));

      const apiKey = getApiKey();
      let sceneDescription = `Detected ${florence.total_objects} objects.`;
      let occlusionSeverity = "none";
      let occlusionNotes = "";
      let qwenItems: Array<{ name: string; visible: number; estimated_hidden: number; reasoning: string }> = [];

      if (apiKey) {
        try {
          const qwen = await analyzeOcclusion(
            base64Image, florence.predictions, florence.class_counts, florence.ocr_texts, apiKey
          );
          sceneDescription = qwen.scene_description;
          occlusionSeverity = qwen.occlusion_severity;
          occlusionNotes = qwen.occlusion_notes;
          qwenItems = qwen.items;
        } catch (e: any) {
          console.warn("Gemini analysis failed, using Florence-only:", e.message);
        }
      }

      setState((p) => ({ ...p, progressText: "Building results..." }));
      const merged = buildMergedResult(
        florence.predictions, florence.class_counts, florence.ocr_texts,
        qwenItems, sceneDescription, occlusionSeverity, occlusionNotes,
        florence.image_width, florence.image_height, florence.inference_time_ms,
        "single", 1
      );

      setState({ loading: false, result: merged, error: null, progressText: "" });
    } catch (err: any) {
      setState({ loading: false, result: null, error: err.message, progressText: "" });
    }
  }, []);

  const analyzeMulti = useCallback(async (base64Images: string[]) => {
    setState({ loading: true, result: null, error: null, progressText: "Running triple-model pipeline..." });

    try {
      const florenceResults = [];
      for (let i = 0; i < base64Images.length; i++) {
        setState((p) => ({ ...p, progressText: `Triple-model: photo ${i + 1}/${base64Images.length}...` }));
        const r = await detectWithFlorence(base64Images[i]);
        florenceResults.push(r);
      }

      setState((p) => ({ ...p, progressText: "Merging multi-angle results..." }));
      const merged = mergeMultiAngleFlorenceResults(florenceResults);

      setState((p) => ({ ...p, progressText: "Analyzing with Gemini AI..." }));
      const apiKey = getApiKey();
      let sceneDescription = `Detected ${merged.predictions.length} objects across ${base64Images.length} photos.`;
      let occlusionSeverity = "none";
      let occlusionNotes = "";
      let qwenItems: Array<{ name: string; visible: number; estimated_hidden: number; reasoning: string }> = [];

      if (apiKey) {
        try {
          const qwen = await analyzeOcclusion(
            base64Images[0], merged.predictions, merged.class_counts, merged.ocr_texts, apiKey
          );
          sceneDescription = qwen.scene_description;
          occlusionSeverity = qwen.occlusion_severity;
          occlusionNotes = qwen.occlusion_notes;
          qwenItems = qwen.items;
        } catch (e: any) {
          console.warn("Gemini analysis failed, using Florence-only:", e.message);
        }
      }

      const result = buildMergedResult(
        merged.predictions, merged.class_counts, merged.ocr_texts,
        qwenItems, sceneDescription, occlusionSeverity, occlusionNotes,
        merged.image_width, merged.image_height, merged.inference_time_ms,
        "multi-angle", base64Images.length
      );
      result.crossReferenceInsights = `Multi-angle analysis used ${base64Images.length} photos. Best count per category selected across angles.`;

      setState({ loading: false, result, error: null, progressText: "" });
    } catch (err: any) {
      setState({ loading: false, result: null, error: err.message, progressText: "" });
    }
  }, []);

  return { ...state, analyzeSingle, analyzeMulti };
}
