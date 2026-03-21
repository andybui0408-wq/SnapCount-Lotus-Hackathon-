// API Keys
export const ROBOFLOW_API_KEY = import.meta.env.VITE_ROBOFLOW_API_KEY || "";
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
export const HUGGINGFACE_TOKEN = import.meta.env.VITE_HUGGINGFACE_TOKEN || "";

// Endpoints
export const ROBOFLOW_GROUNDING_DINO_URL = "https://infer.roboflow.com/grounding_dino/infer";
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

// Default vocabulary (period-separated for Grounding DINO)
export const DEFAULT_VOCABULARY =
  "Coca-Cola can. Coca-Cola bottle. Pepsi can. Pepsi bottle. " +
  "Fanta Orange can. Fanta Orange bottle. Sprite can. Sprite bottle. " +
  "Monster Energy can. Red Bull can. Tiger beer can. Tiger beer bottle. " +
  "Saigon beer can. 333 beer can. water bottle. milk carton. " +
  "juice box. C2 green tea bottle. " +
  "instant noodle pack. rice bag. bread loaf. snack bag. chip bag. " +
  "candy bar. chocolate bar. cookie package. canned food. " +
  "fish sauce bottle. soy sauce bottle. cooking oil bottle. chili sauce bottle. " +
  "soap bar. shampoo bottle. toothpaste tube. detergent box. tissue box. " +
  "banana. apple. orange. mango. tomato. onion. garlic. lime.";

// Prompts

// Step 1: Count items from a single angle (run on each photo independently)
export const PER_ANGLE_PROMPT = `You are an expert inventory counter for a Vietnamese convenience store.

TASK: Count every individual item visible in this ONE photo AND draw ONE bounding box per PRODUCT GROUP showing the region where that product is located.

COUNTING RULES:
1. Count EVERY individual can, bottle, box, or package — each one counts separately
2. Partially visible items at edges count as 1
3. Only count what is VISIBLE — do not estimate hidden items
4. Be precise — count each item one by one

BOUNDING BOX RULES:
- Draw exactly ONE bounding box per product type (not per individual item)
- The box should enclose the ENTIRE REGION where all items of that product are grouped together
- If a product appears in multiple separate clusters, draw one box that covers the main cluster
- Coordinates in pixels relative to the image dimensions
- Format: [x_min, y_min, x_max, y_max] (top-left corner to bottom-right corner)

Return ONLY valid JSON, no markdown:
{
  "products": [
    { "product": "Coca-Cola can", "count": 5 }
  ],
  "bboxes": [
    { "label": "Coca-Cola can", "box": [95, 210, 195, 390] }
  ],
  "total_items": 20,
  "image_width": 1024,
  "image_height": 768
}`;

// Step 2: Reconcile per-angle counts into final cross-verified result
export const RECONCILE_PROMPT = `You are an expert inventory counter. You have counted the SAME shelf from {NUM_ANGLES} different angles independently.

Here are the per-angle counts:
{PER_ANGLE_RESULTS}

Now look at ALL the photos together and produce the FINAL reconciled count.
Also draw ONE bounding box per PRODUCT GROUP in Photo 1 (the front view) showing the region where that product is located.

RECONCILIATION RULES:
1. The SAME shelf is photographed from different angles — don't add counts across angles
2. For each product, compare counts across angles:
   - front_visible = count from the FRONT photo (Angle 1)
   - depth_visible = ADDITIONAL items only visible from side angles, NOT already counted in front
   - total = front_visible + depth_visible
3. If Angle 1 shows 4 cans and Angle 2 shows 6 of the same product, it means 4 in front + 2 extra from side = total 6 (NOT 10)
4. Remove any product that appears in only one angle with very low count (likely misidentification)
5. Merge duplicate names (e.g. "Coca Cola can" and "Coca-Cola can" are the same)

BOUNDING BOX RULES (Photo 1 only):
- Draw exactly ONE bounding box per product type (not per individual item)
- The box should enclose the ENTIRE REGION where all items of that product are grouped
- Coordinates in pixels relative to Photo 1 dimensions
- Format: [x_min, y_min, x_max, y_max] (top-left corner to bottom-right corner)

Return ONLY valid JSON, no markdown:
{
  "products": [
    {
      "product": "Coca-Cola can",
      "front_visible": 4,
      "depth_visible": 2,
      "total": 6,
      "notes": "4 visible from front, side reveals 2 more behind"
    }
  ],
  "bboxes": [
    { "label": "Coca-Cola can", "box": [95, 210, 195, 390] }
  ],
  "total_items": 42,
  "angles_used": 2,
  "depth_notes": "Side angles revealed additional depth stacking",
  "image_width": 1024,
  "image_height": 768
}`;

export const SINGLE_PHOTO_PROMPT = `You are an expert inventory counter for a Vietnamese convenience store.

TASK: Count every individual item AND draw ONE bounding box per PRODUCT GROUP showing the region where that product is located.

{DETECTION_RESULTS}

COUNTING RULES:
1. Count EVERY individual can, bottle, box, or package you can see — each one counts
2. Partially visible items at edges count as 1
3. Only count what is VISIBLE — do not estimate hidden items

BOUNDING BOX RULES:
- Draw exactly ONE bounding box per product type (not per individual item)
- The box should enclose the ENTIRE REGION where all items of that product are grouped
- If a product appears in multiple separate clusters, draw one box that covers the main cluster
- Coordinates in pixels relative to the image dimensions
- Format: [x_min, y_min, x_max, y_max] (top-left corner to bottom-right corner)

Return ONLY valid JSON, no markdown:
{
  "products": [
    { "product": "Coca-Cola can", "visible_count": 5, "notes": "" }
  ],
  "bboxes": [
    { "label": "Coca-Cola can", "box": [95, 210, 195, 390] }
  ],
  "total_items": 20,
  "note": "Single angle — take a side photo to see depth",
  "image_width": 1024,
  "image_height": 768
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
