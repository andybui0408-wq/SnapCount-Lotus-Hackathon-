import { OPENROUTER_BASE_URL, VISION_MODEL } from "../constants/config";
import type { BoundingBox } from "../types";

export interface VisionOcclusionResult {
  items: Array<{
    name: string;
    visible: number;
    estimated_hidden: number;
    reasoning: string;
  }>;
  scene_description: string;
  occlusion_severity: "none" | "mild" | "moderate" | "severe";
  occlusion_notes: string;
}

export async function analyzeOcclusion(
  base64Image: string,
  _detections: BoundingBox[],
  classCounts: Record<string, number>,
  ocrTexts: string[],
  apiKey: string
): Promise<VisionOcclusionResult> {
  const summary = Object.entries(classCounts)
    .map(([cls, count]) => `- ${cls}: ${count}`)
    .join("\n");

  const ocrSummary =
    ocrTexts.length > 0 ? `\nOCR labels read from products: ${ocrTexts.join(", ")}` : "";

  const prompt = `You are an inventory analyst. I'm showing you a photo of a store shelf/inventory area.

A vision model detected these items:
${summary}
${ocrSummary}

For each detected item category:
1. How many are clearly visible?
2. How many do you estimate are hidden behind other items (based on shelf depth, stacking, partial occlusions)?
3. Brief reasoning.

Also describe the scene and rate occlusion severity as: none, mild, moderate, or severe.

Respond in this exact JSON format (no markdown, no code blocks):
{"items":[{"name":"...","visible":N,"estimated_hidden":N,"reasoning":"..."}],"scene_description":"...","occlusion_severity":"none|mild|moderate|severe","occlusion_notes":"..."}`;

  const dataUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "SnapCount",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as any).error?.message || `OpenRouter returned ${response.status}`
    );
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(raw);
}
