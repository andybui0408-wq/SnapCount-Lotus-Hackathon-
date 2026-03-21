import { SINGLE_PHOTO_PROMPT } from "../constants/config";
import { callGeminiJSON } from "./geminiAPI";
import type { ProductConsensus, FrameDetections } from "./consensusCount";

// ── Multi-angle result (legacy, kept for type compat) ────────────

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
  estimated_price?: number;
}

export interface SinglePhotoResult {
  products: SinglePhotoProduct[];
  total_items: number;
  note: string;
}

// ── Consensus verification result ────────────────────────────────

export interface ConsensusProduct {
  name: string;
  consensus_count: number;
  your_count: number;
  adjusted: boolean;
  adjustment_reason: string;
  depth_additional: number;
  total: number;
  estimated_price: number;
  ocr_text: string;
  confidence: string;
}

export interface ConsensusResult {
  products: ConsensusProduct[];
  total_items: number;
  products_missed_by_detector: string[];
  false_positives_removed: string[];
  depth_notes: string;
}

// ── Build consensus verification prompt ──────────────────────────

function buildConsensusPrompt(
  frameCount: number,
  consensus: ProductConsensus[],
  perFrameDetections: FrameDetections[],
): string {
  const frameData = perFrameDetections.map((fd, i) => {
    const counts = Object.entries(fd.productCounts)
      .map(([product, count]) => `${product}: ${count}`)
      .join(", ");
    return `Frame ${i + 1}: ${counts || "no detections"}`;
  }).join("\n");

  const consensusData = consensus.map(c =>
    `${c.product}: consensus=${c.consensusCount}, counts=[${c.countsPerFrame.join(",")}], mode=${c.mode}, median=${c.median}, spread=${c.spread}, confidence=${c.confidence}, seen_in=${c.framesDetected}/${c.totalFrames}_frames`,
  ).join("\n");

  return `You are an expert inventory counter for a Vietnamese convenience store.

You have ${frameCount} photos of the SAME shelf from different angles.
A detection model ran on EVERY frame independently. Here are the raw counts per frame:

${frameData}

We computed a consensus count for each product using mode (most common count) and median:

${consensusData}

Your job:
1. Review the consensus counts. For HIGH confidence items (low spread, seen in most frames), TRUST the consensus — do not change it unless you see a clear error in the photos.
2. For MEDIUM and LOW confidence items, look at the actual photos carefully and decide the correct count.
3. If a product was only detected in 1-2 frames, verify whether it actually exists or was a false positive.
4. READ text from labels (OCR) to confirm product identity.
5. Check the side-angle photos for additional DEPTH — rows behind the front row that detection might have missed entirely. If you see depth, ADD to the consensus count.
6. Identify any products visible in the photos that the detector completely missed.
7. For each product, ESTIMATE the typical Vietnamese retail sell price in VND. Use realistic prices for Ho Chi Minh City 2024-2026. Examples: Coca-Cola can ~10000đ, instant noodle pack ~5000đ, beer can ~15000đ.
8. For each product, provide bounding boxes on the FIRST photo as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale. One box per visible instance (up to 10 boxes per product).

IMPORTANT: Start with the consensus count as your baseline. Only adjust UP or DOWN if you have visual evidence from the photos.

Return ONLY valid JSON, no markdown:
{
  "products": [
    {
      "name": "Coca-Cola can",
      "consensus_count": 5,
      "your_count": 5,
      "adjusted": false,
      "adjustment_reason": "",
      "depth_additional": 0,
      "total": 5,
      "estimated_price": 10000,
      "ocr_text": "Coca-Cola",
      "confidence": "high",
      "boxes": [[120, 340, 250, 450]]
    }
  ],
  "total_items": 42,
  "products_missed_by_detector": [],
  "false_positives_removed": [],
  "depth_notes": ""
}`;
}

// ── Consensus verification: ALL photos + consensus → Gemini ──────

export async function analyzeWithConsensus(
  base64Images: string[],
  consensus: ProductConsensus[],
  perFrameDetections: FrameDetections[],
): Promise<ConsensusResult> {
  const prompt = buildConsensusPrompt(base64Images.length, consensus, perFrameDetections);

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: prompt },
  ];

  for (const img of base64Images) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${img}` },
    });
  }

  return callGeminiJSON<ConsensusResult>([{ role: "user", content }]);
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
