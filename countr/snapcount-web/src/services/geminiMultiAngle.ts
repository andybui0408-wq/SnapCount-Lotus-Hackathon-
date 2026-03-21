import { PER_ANGLE_PROMPT, SINGLE_PHOTO_PROMPT, RECONCILE_PROMPT } from "../constants/config";
import { callGeminiJSON } from "./geminiAPI";

// ── Shared bbox type ─────────────────────────────────────────────

export interface BboxEntry {
  label: string;
  box: [number, number, number, number]; // [x_min, y_min, x_max, y_max]
}

// ── Per-angle result (Step 1) ────────────────────────────────────

export interface PerAngleProduct {
  product: string;
  count: number;
}

export interface PerAngleResult {
  products: PerAngleProduct[];
  bboxes?: BboxEntry[];
  total_items: number;
  image_width?: number;
  image_height?: number;
}

// ── Reconciled result (Step 2 / final) ───────────────────────────

export interface MultiAngleProduct {
  product: string;
  front_visible: number;
  depth_visible: number;
  total: number;
  notes: string;
}

export interface MultiAngleResult {
  products: MultiAngleProduct[];
  bboxes?: BboxEntry[];
  total_items: number;
  angles_used: number;
  depth_notes: string;
  image_width?: number;
  image_height?: number;
}

// ── Single photo types ───────────────────────────────────────────

export interface SinglePhotoProduct {
  product: string;
  visible_count: number;
  notes: string;
}

export interface SinglePhotoResult {
  products: SinglePhotoProduct[];
  bboxes?: BboxEntry[];
  total_items: number;
  note: string;
  image_width?: number;
  image_height?: number;
}

// ── Step 1: Count each angle independently ───────────────────────

export async function countSingleAngle(base64Image: string): Promise<PerAngleResult> {
  return callGeminiJSON<PerAngleResult>([
    {
      role: "user",
      content: [
        { type: "text", text: PER_ANGLE_PROMPT },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
      ],
    },
  ]);
}

// ── Step 2: Reconcile all per-angle counts ───────────────────────

export async function reconcileAngles(
  base64Images: string[],
  perAngleResults: PerAngleResult[]
): Promise<MultiAngleResult> {
  const anglesSummary = perAngleResults
    .map((r, i) => {
      const label = i === 0 ? "Front" : i === 1 ? "Side" : `Angle ${i + 1}`;
      const items = r.products.map((p) => `  - ${p.product}: ${p.count}`).join("\n");
      return `Angle ${i + 1} (${label}) — ${r.total_items} total:\n${items}`;
    })
    .join("\n\n");

  const prompt = RECONCILE_PROMPT
    .replace("{NUM_ANGLES}", String(base64Images.length))
    .replace("{PER_ANGLE_RESULTS}", anglesSummary);

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

// ── Single photo ─────────────────────────────────────────────────

export async function analyzeSinglePhoto(
  base64Image: string,
  detectionResults: string
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
