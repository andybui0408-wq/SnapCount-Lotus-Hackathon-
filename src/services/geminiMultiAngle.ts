import { SINGLE_PHOTO_PROMPT } from "../constants/config";
import { callGeminiJSON } from "./geminiAPI";

// ── Multi-angle result ───────────────────────────────────────────

export interface MultiAngleProduct {
  product: string;
  front_visible: number;
  depth_visible: number;
  total: number;
  boxes?: number[][];
  notes: string;
}

export interface MultiAngleResult {
  products: MultiAngleProduct[];
  total_items: number;
  angles_used: number;
  depth_notes: string;
}

// ── Single photo result ──────────────────────────────────────────

export interface SinglePhotoProduct {
  product: string;
  visible_count: number;
  boxes?: number[][];
  notes: string;
}

export interface SinglePhotoResult {
  products: SinglePhotoProduct[];
  total_items: number;
  note: string;
}

// ── Build dynamic multi-angle prompt for variable frame count ────

function buildMultiAnglePrompt(frameCount: number, detectionResults: string): string {
  const photoList = Array.from({ length: frameCount }, (_, i) =>
    `- Photo ${i + 1}: ${i === 0 ? "front/initial view" : `angle ${i} (different perspective)`}`,
  ).join("\n");

  return `You are counting inventory on a Vietnamese convenience store shelf.

You have been given ${frameCount} photos of the SAME shelf taken from different angles during a walkthrough video.
${photoList}

The detection system has already identified these products from the first photo:
${detectionResults}

Using ALL the angled photos, count what you can actually SEE across all views combined.
Do not guess or estimate — only count items visible in at least one photo.
More photos from more angles means you can see deeper into the shelves.

For each product, report:
- product: name
- front_visible: count from the front/first photo
- depth_visible: additional items visible from other angles
- total: front_visible + depth_visible
- boxes: array of bounding boxes [ymin, xmin, ymax, xmax] normalized 0-1000 (where 0,0=top-left, 1000,1000=bottom-right). Include one box per visible group in the FIRST photo.
- notes: what the extra angles revealed

Return ONLY valid JSON, no markdown:
{
  "products": [
    { "product": "Coca-Cola can", "front_visible": 5, "depth_visible": 8, "total": 13, "boxes": [[120, 340, 250, 450]], "notes": "angled views show 2 rows behind front" }
  ],
  "total_items": 42,
  "angles_used": ${frameCount},
  "depth_notes": "Multiple angles revealed depth on drink shelves"
}`;
}

// ── Multi-angle: ALL photos + detection results → Gemini ─────────

export async function analyzeMultiAngle(
  base64Images: string[],
  detectionResults: string,
): Promise<MultiAngleResult> {
  const prompt = buildMultiAnglePrompt(base64Images.length, detectionResults);

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: prompt },
  ];

  for (const img of base64Images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${img}` },
    });
  }

  return callGeminiJSON<MultiAngleResult>([{ role: "user", content }]);
}

// ── Single photo: 1 photo + detection results → Gemini ───────────

export async function analyzeSinglePhoto(
  base64Image: string,
  detectionResults: string,
): Promise<SinglePhotoResult> {
  const prompt = SINGLE_PHOTO_PROMPT.replace("{DETECTION_RESULTS}", detectionResults);

  return callGeminiJSON<SinglePhotoResult>([
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
      ],
    },
  ]);
}
