# CLAUDE.md — SnapCount (Hosted APIs Only)

## What is this?

SnapCount is an AI-powered inventory management website for Vietnamese small businesses. A shop owner photographs their shelf from multiple angles → AI detects every product, reads labels, matches against a learned catalog, and uses the extra angles to reason about depth and hidden items → tracks stock over days, predicts depletion, generates purchase orders in Vietnamese, sends them via Zalo.

**Hackathon**: LotusHacks x HackHarvard (March 2026, VNG Campus, HCMC)
**Track**: Enterprise by TinyFish — "Build tools that transform how businesses operate"
**One-line pitch**: "SnapCount turns any phone camera into an enterprise inventory system — purpose-built for Vietnamese small businesses."

---

## Tech stack

| Layer | Technology | How accessed |
|-------|-----------|-------------|
| Frontend | React + Vite + TypeScript | Browser (localhost:5173) |
| Detection | Grounding DINO (IDEA Research, ECCV 2024) | Roboflow hosted API |
| OCR | Gemini vision (reads label text) | OpenRouter API |
| Catalog matching | DINOv2 embeddings (Meta) | HuggingFace Inference API |
| Reasoning + Depth | Gemini 2.5 Flash (Google) | OpenRouter API |
| Charts | Chart.js + react-chartjs-2 | npm package |
| Storage | localStorage | Browser |
| Messaging | Zalo deep links | Browser → Zalo app |

**NO Python server. NO local model downloads. NO PyTorch. Everything runs from the React website via hosted API calls.**

---

## API keys needed (3 total)

```
VITE_ROBOFLOW_API_KEY=""      // roboflow.com → free account → profile → API Key
VITE_HUGGINGFACE_TOKEN=""     // huggingface.co → free account → Settings → Access Tokens
VITE_OPENROUTER_API_KEY=""    // openrouter.ai → sign in → Settings → Keys → add $5 credits
```

---

## The AI models (all hosted, all via fetch())

### Model 1: Grounding DINO via Roboflow
**Purpose**: Zero-shot object detection. Better than YOLO-World at dense/overlapping items on shelves.
**Why over YOLO-World**: Transformer-based (not CNN), handles occlusion and crowded objects significantly better. 52.5 AP on COCO zero-shot. Same Roboflow API pattern.
**Endpoint**: POST https://infer.roboflow.com/grounding_dino/infer

```typescript
async function detectWithGroundingDINO(base64Image: string, text: string) {
  const response = await fetch("https://infer.roboflow.com/grounding_dino/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: ROBOFLOW_API_KEY,
      image: { type: "base64", value: base64Image },  // raw base64, no data: prefix
      text: text,  // period-separated: "Coca-Cola can. Fanta bottle. instant noodle pack."
      box_threshold: 0.2,
      text_threshold: 0.2,
    }),
  });
  return await response.json();
  // { predictions: [{ x, y, width, height, confidence, class }], image: { width, height } }
}
```

**Key difference from YOLO-World**: text prompt uses PERIOD-separated classes, not an array.
Example: `"Coca-Cola can. Fanta bottle. instant noodle pack. fish sauce bottle."`

Response format is the same Roboflow standard: x,y are center coordinates.

### Model 2: DINOv2 Embeddings via HuggingFace
**Purpose**: Visual product fingerprinting. Owner photographs product once → recognized forever.
**Endpoint**: POST https://api-inference.huggingface.co/pipeline/feature-extraction/facebook/dinov2-base

```typescript
async function getEmbedding(imageBlob: Blob): Promise<number[]> {
  const response = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/facebook/dinov2-base",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${HUGGINGFACE_TOKEN}` },
      body: imageBlob,  // raw image Blob, NOT base64
    }
  );
  const data = await response.json();
  let embedding = data;
  while (Array.isArray(embedding) && Array.isArray(embedding[0])) {
    embedding = embedding[0];
  }
  return embedding; // 768-dim vector
}
```

Handle HuggingFace cold start: if response has `error: "Model is loading"`, wait 10s and retry once.

**Catalog stored in localStorage** (key: "snapcount_catalog"):
```typescript
interface CatalogProduct { name: string; embedding: number[]; }
```

**Matching runs in browser** (no API call):
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```
Threshold: 0.7 = match.

### Model 3: Gemini 2.5 Flash via OpenRouter
**Purpose**: ALL reasoning — OCR, multi-angle depth inference, restock orders, Zalo messages.
**Endpoint**: POST https://openrouter.ai/api/v1/chat/completions

```typescript
async function callGemini(messages: any[]) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://snapcount.app",
      "X-Title": "SnapCount",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 2048, messages }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}
```

For vision: `content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }]`
Multiple images: just add more image_url objects in the content array.
Always strip backticks: `text.replace(/```json\s?/g,"").replace(/```/g,"").trim()`

---

## Multi-angle depth reasoning (THE KEY FEATURE)

This is SnapCount's core differentiator. Instead of guessing hidden items, the user takes 2-3 photos from different angles, and Gemini SEES the depth.

### How it works:
1. **Photo 1**: Front-on shot (standard shelf view)
2. **Photo 2**: Side angle (~30-45° from the left or right)
3. **Photo 3** (optional): Other side or top-down

Grounding DINO runs on Photo 1 (the front shot) to get bounding boxes and labels.
ALL photos go to Gemini in a SINGLE request for depth reasoning.

### The multi-angle Gemini prompt:

```typescript
const MULTI_ANGLE_PROMPT = `You are counting inventory on a Vietnamese convenience store shelf.

You have been given multiple photos of the SAME shelf taken from different angles.
- Photo 1: front view
- Photo 2: side/angled view showing depth
- Photo 3 (if provided): another angle

The detection system has already identified these products from the front view:
{DETECTION_RESULTS}

Using the SIDE ANGLE photo(s), you can now see how many rows deep each product goes.
Count what you can actually SEE across all angles. Do not guess or estimate — only count items visible in at least one photo.

For each product, report:
- product: name
- front_visible: count from front photo
- depth_visible: additional items visible from side angle(s)
- total: front_visible + depth_visible
- notes: what the side angle revealed (e.g. "side view shows 2 rows of 4 cans behind front row")

Return ONLY valid JSON, no markdown:
{
  "products": [
    { "product": "Coca-Cola can", "front_visible": 5, "depth_visible": 8, "total": 13, "notes": "side angle shows 2 additional rows of ~4 cans each" }
  ],
  "total_items": 42,
  "angles_used": 2,
  "depth_notes": "Side angle revealed significant depth on drink shelves, noodle packs stacked 3 deep"
}`;
```

### Single photo mode:
When only 1 photo is provided, Gemini just counts what's visible. No estimation, no guessing:

```typescript
const SINGLE_PHOTO_PROMPT = `You are counting inventory on a Vietnamese convenience store shelf.

The detection system identified these products:
{DETECTION_RESULTS}

Count only what is VISIBLE in this single photo. Do not estimate hidden items.

Return ONLY valid JSON:
{
  "products": [
    { "product": "Coca-Cola can", "visible_count": 5, "notes": "" }
  ],
  "total_items": 20,
  "note": "Single angle — take a side photo to see depth"
}`;
```

### OCR prompt (also Gemini):
```typescript
const OCR_PROMPT = `Read ALL visible text from product labels in this image.
Return ONLY a JSON array of strings, no markdown:
["Coca-Cola", "Fanta Orange", "Hảo Hảo"]`;
```

---

## Detection pipeline (all in browser)

### Multi-angle scan (primary mode):
```
User takes 2-3 photos
  │
  ├─→ Grounding DINO (Roboflow) on Photo 1
  │   Returns: bounding boxes + labels from front view
  │
  ├─→ For each detection crop → DINOv2 (HuggingFace) → catalog match
  │   Cosine similarity > 0.7 = known product
  │
  ├─→ Gemini OCR (OpenRouter) on Photo 1
  │   Returns: array of text strings read from labels
  │
  └─→ Gemini multi-angle reasoning (OpenRouter)
      Receives: ALL photos + detection results
      Returns: per-product counts including depth from side angles
      │
      ▼
  MERGE all signals:
    - Product identity: catalog match > Grounding DINO label > OCR enrichment
    - Product count: Gemini multi-angle total (uses all photos to count)
    - Save to localStorage
```

### Quick scan (single photo):
Same pipeline but Gemini only counts visible items, no depth inference.

### Parallel execution:
```typescript
const [dinoResult, ocrResult] = await Promise.allSettled([
  detectWithGroundingDINO(base64Photo1, vocabularyString),
  readLabelsFromImage(base64Photo1),
]);

// After DINO returns, crop detections for DINOv2 catalog matching
const cropPromises = predictions.map(pred => cropAndMatch(img, pred));
const catalogMatches = await Promise.allSettled(cropPromises);

// Then send ALL photos + detection context to Gemini for counting
const geminiCount = await callGeminiMultiAngle(allPhotos, mergedDetections);
```

---

## Cropping detections for DINOv2 matching

```typescript
async function cropDetection(img: HTMLImageElement, pred: any): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const x = pred.x - pred.width / 2;
  const y = pred.y - pred.height / 2;
  canvas.width = pred.width;
  canvas.height = pred.height;
  canvas.getContext("2d")!.drawImage(img, x, y, pred.width, pred.height, 0, 0, pred.width, pred.height);
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), "image/jpeg", 0.9));
}
```

---

## Project structure

```
snapcount-web/
├── index.html
├── vite.config.ts
├── package.json
├── CLAUDE.md
├── .env
├── src/
│   ├── main.tsx
│   ├── App.tsx                      # Scan | Dashboard | Restock | History
│   ├── pages/
│   │   ├── ScanPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── RestockPage.tsx
│   │   └── HistoryPage.tsx
│   ├── components/
│   │   ├── BoundingBoxOverlay.tsx
│   │   ├── PhotoCollector.tsx       # Multi-angle: 3 photo slots
│   │   ├── SummaryCards.tsx
│   │   ├── ResultsList.tsx
│   │   ├── TrendChart.tsx
│   │   ├── DepletionTable.tsx
│   │   ├── RestockOrderCard.tsx
│   │   ├── SupplierSelector.tsx
│   │   ├── ZaloSendButton.tsx
│   │   ├── VocabularyEditor.tsx
│   │   └── CatalogBuilder.tsx
│   ├── services/
│   │   ├── groundingDinoAPI.ts      # Roboflow hosted Grounding DINO
│   │   ├── dinov2API.ts             # HuggingFace hosted DINOv2
│   │   ├── productCatalog.ts        # localStorage catalog + cosine matching
│   │   ├── geminiAPI.ts             # OpenRouter Gemini (base caller)
│   │   ├── geminiOCR.ts             # Gemini reads label text
│   │   ├── geminiMultiAngle.ts      # Gemini multi-angle depth reasoning
│   │   ├── mergeResults.ts          # Combines detection + catalog + Gemini
│   │   ├── scanHistory.ts           # localStorage scans + trends + demo data
│   │   ├── restockAgent.ts          # Gemini: trends → purchase order
│   │   └── zaloMessenger.ts         # Supplier CRUD + Zalo deep links
│   ├── types/index.ts
│   └── constants/config.ts          # API keys + vocabulary + prompts
```

NO server/ folder. NO Python.

---

## Pages

### 1. Scan Page
- **Multi-angle is the default and primary mode**
- PhotoCollector shows 3 slots: "Front" / "Side angle" / "Other angle (optional)"
- Each slot: file input or camera capture
- Minimum: 2 photos (front + side). 3rd is optional.
- Quick scan toggle for single-photo mode (counts visible only)
- On scan: compress all photos via Canvas (1024px max, JPEG 0.8)
- Run pipeline, show results:
  - Photo 1 with BoundingBoxOverlay (green=catalog, blue=grounding-dino, amber=unmatched)
  - Summary cards: Detected types / Front count / Depth count / Total
  - Per-product list with front_visible, depth_visible, total
  - Gemini's depth_notes shown as insight text
- Auto-save to localStorage

### 2. Dashboard Page
- Alert cards: Critical (red ≤3 units), Low (amber 4-8), Healthy (green 9+)
- Chart.js trend lines (7 days, one line per product)
- Depletion table: Product | Current | Change | Avg/day | Days left | Status
- Pre-seeded demo data on first load

### 3. Restock Page
- Gemini generates order from trends → review → edit qty with +/- → confirm
- Supplier dropdown, total VND cost
- "Send via Zalo": copies Vietnamese message + opens zalo.me/PHONE

### 4. History Page
- Past scans with thumbnails, most recent first

### 5. Vocabulary Editor (modal)
- Edit Grounding DINO text prompt (period-separated product names)

### 6. Catalog Builder (modal)
- Upload photo + name → DINOv2 embedding → localStorage

---

## Navigation
4 tabs: Scan | Dashboard | Restock | History. State-based routing. No react-router.

---

## Demo data (pre-seeded on first load)

8 products, 7 days declining:
- Coca-Cola can: 24→22→18→15→12→8→5
- Fanta Orange bottle: 18→18→16→14→11→9→7
- Mì Hảo Hảo tôm chua cay: 30→28→25→20→16→10→4
- Nước mắm Chin-Su: 12→12→11→11→10→10→9
- Trà xanh C2: 20→17→14→12→9→6→3
- Monster Energy: 10→9→8→7→5→3→1
- Bia Tiger: 36→34→30→28→24→20→18
- Bánh mì Kinh Đô: 15→13→10→8→5→3→1

3 demo suppliers:
- Đại lý nước giải khát Minh Phát / 0912345678 / drinks
- Cửa hàng thực phẩm Hương Giang / 0987654321 / food, noodles
- NPP Bia Tiger khu vực HCM / 0909876543 / beer

---

## UI theme
Background: #0a0f0d | Surface: #0d1a14 | Border: #1a2722
Accent: #059669→#34d399 | Warning: #fbbf24 | Danger: #f87171 | Info: #60a5fa
Text: #e2e8e0 primary, #6b8f7b secondary
Numbers: monospace | Dates: DD/MM | Currency: 192.000đ

---

## BoundingBox scaling
```
scaleX = displayedWidth / response.image.width
scaleY = displayedHeight / response.image.height
left = (pred.x - pred.width/2) * scaleX
top = (pred.y - pred.height/2) * scaleY
```

---

## Key patterns
- Promise.allSettled for all parallel API calls — never crash on single failure
- Strip backticks from Gemini: text.replace(/```json\s?/g,"").replace(/```/g,"").trim()
- Grounding DINO: raw base64 in image.value (no data: prefix), text is PERIOD-separated
- OpenRouter Gemini: full data URI in image_url.url (data:image/jpeg;base64,...)
- Multiple images to Gemini: multiple image_url objects in the content array
- DINOv2: raw Blob body (not base64)
- Image compression via Canvas (no libraries)
- localStorage ~5MB limit — thumbnails 200px JPEG 0.6, embeddings ~6KB each
- Zalo: https://zalo.me/PHONE works mobile + desktop

---

## Default vocabulary (Grounding DINO format — period-separated)

```typescript
const DEFAULT_VOCABULARY =
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
```

---

## Commands
```bash
npm create vite@latest snapcount-web -- --template react-ts
cd snapcount-web && npm install chart.js react-chartjs-2 && npm run dev
```

No Python. No pip. No server. Just the React app.
