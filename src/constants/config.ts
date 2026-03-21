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

// EmailJS
export const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "";
export const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "";
export const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "";

// Default vocabulary — specific product names for tighter DINO boxes
export const DEFAULT_VOCABULARY: string[] = [
  "Coca-Cola can", "Coca-Cola bottle", "Pepsi can",
  "Fanta Orange can", "Fanta Orange bottle", "Sprite can",
  "Monster Energy can", "Red Bull can",
  "Tiger beer can", "Tiger beer bottle", "Saigon beer can", "333 beer can",
  "water bottle", "milk carton", "juice box", "C2 green tea bottle",
  "instant noodle pack", "rice bag", "bread loaf", "snack bag", "chip bag",
  "candy bar", "chocolate bar", "cookie package", "canned food",
  "fish sauce bottle", "soy sauce bottle", "cooking oil bottle", "chili sauce bottle",
  "soap bar", "shampoo bottle", "toothpaste tube", "detergent box", "tissue box",
  "banana", "apple", "orange", "mango", "tomato", "onion", "garlic", "lime",
];

// Prompts
// Note: Multi-angle prompt is built dynamically in geminiMultiAngle.ts (variable frame count)

// Single photo: detect + count visible items, return bounding boxes
export const SINGLE_PHOTO_PROMPT = `You are counting inventory on a Vietnamese convenience store shelf.

The detection system identified these products:
{DETECTION_RESULTS}

Count only what is VISIBLE in this single photo. Do not estimate hidden items.

For each product, provide bounding boxes as [ymin, xmin, ymax, xmax] coordinates normalized to 0-1000 scale (where 0,0 is top-left and 1000,1000 is bottom-right of the image). Include one box per visible instance or group.

Return ONLY valid JSON, no markdown:
{
  "products": [
    { "product": "Coca-Cola can", "visible_count": 5, "boxes": [[120, 340, 250, 450], [120, 500, 250, 610]], "notes": "" }
  ],
  "total_items": 20,
  "note": "Single angle — take a side photo to see depth"
}`;

export const OCR_PROMPT = `Read ALL visible text from product labels in this image.
Return ONLY a JSON array of strings, no markdown:
["Coca-Cola", "Fanta Orange", "Hảo Hảo"]`;

export const RESTOCK_PROMPT = `You are a Vietnamese store inventory assistant. Based on these stock levels and trends, generate a restock purchase order.

Return JSON:
{
  "items": [
    { "name": "Coca-Cola lon", "currentStock": 5, "suggestedQty": 24, "unitPrice": 8000 }
  ],
  "urgency": "high",
  "notes": "Mì Hảo Hảo sắp hết, cần đặt gấp"
}

Use Vietnamese product names. Prices in VND. Return ONLY valid JSON.`;
