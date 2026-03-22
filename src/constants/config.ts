// API Keys
export const ROBOFLOW_API_KEY = import.meta.env.VITE_ROBOFLOW_API_KEY || "";
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
export const HUGGINGFACE_TOKEN = import.meta.env.VITE_HUGGINGFACE_TOKEN || "";

// Endpoints
export const ROBOFLOW_DINO_URL = "https://infer.roboflow.com/grounding_dino/infer";
export const HUGGINGFACE_DINOV2_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/facebook/dinov2-base";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const GEMINI_MODEL = "google/gemini-2.5-flash";

// Image processing
export const MAX_IMAGE_SIZE = 1024;
export const JPEG_QUALITY = 0.8;
export const THUMBNAIL_SIZE = 200;
export const THUMBNAIL_QUALITY = 0.6;

// Catalog
export const CATALOG_SIMILARITY_THRESHOLD = 0.7;

// Default vocabulary — generic categories for open detection
// Specific product names are identified by Gemini after detection
export const DEFAULT_VOCABULARY: string[] = [
  "bottle", "can", "box", "bag", "package", "container", "fruit",
];

// Prompts
// Note: Multi-angle prompt is built dynamically in geminiMultiAngle.ts (variable frame count)

// Single photo: detect + count visible items, return bounding boxes + price
export const SINGLE_PHOTO_PROMPT = `You are counting inventory on a Vietnamese convenience store shelf.

The detection system identified these products:
{DETECTION_RESULTS}

Count only what is VISIBLE in this single photo. Do not estimate hidden items.

For each product:
- REQUIRED: Provide bounding boxes as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale. Draw ONE box per visible instance (up to 10 per product). Every product MUST have at least one box.
- ESTIMATE the typical Vietnamese retail sell price in VND (realistic Ho Chi Minh City prices 2024-2026). Examples: Coca-Cola can ~10000đ, instant noodle pack ~5000đ, beer can ~15000đ

Return ONLY valid JSON, no markdown:
{
  "products": [
    { "product": "Coca-Cola can", "visible_count": 5, "boxes": [[120, 340, 250, 450], [120, 500, 250, 600]], "estimated_price": 10000, "notes": "" }
  ],
  "total_items": 20,
  "note": "Single angle — take a side photo to see depth"
}`;

export const OCR_PROMPT = `Read ALL visible text from product labels in this image.
Return ONLY a JSON array of strings, no markdown:
["Coca-Cola", "Fanta Orange", "Instant Noodle"]`;

export const RESTOCK_PROMPT = `You are a store inventory assistant. Based on these stock levels and trends, generate a restock purchase order.

Return JSON:
{
  "items": [
    { "name": "Coca-Cola can", "currentStock": 5, "suggestedQty": 24, "unitPrice": 8000 }
  ],
  "urgency": "high",
  "notes": "Running low on instant noodles, order urgently"
}

Prices in VND. Return ONLY valid JSON.`;
