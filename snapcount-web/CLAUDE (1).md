# CLAUDE.md — SnapCount Project Context

## What is this project?

SnapCount is an AI-powered inventory management website for Vietnamese small businesses (cửa hàng tạp hóa). A shop owner takes a photo of their shelf → AI identifies every specific product by brand name, counts items including hidden ones, tracks stock over days, predicts when items run out, generates purchase orders in Vietnamese, and sends them to suppliers via Zalo.

**Hackathon**: LotusHacks x HackHarvard (March 20-22, 2026, VNG Campus, Ho Chi Minh City)
**Track**: Enterprise by TinyFish — "Build tools that transform how businesses operate"
**Target user**: Vietnamese small shop owners who count inventory by hand (30-60 min/day)

## Tech stack

| Layer | Technology | Runs on |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript | Browser (localhost:5173) |
| Detection | Florence-2 Large (Microsoft, 0.77B, MIT license) | Python FastAPI server on Mac (localhost:8000) |
| Reasoning | Gemini 2.5 Flash via OpenRouter | Cloud API |
| Charts | Chart.js + react-chartjs-2 | Browser |
| Storage | localStorage | Browser |
| Messaging | Zalo deep links (zalo.me/PHONE) | Browser → Zalo app |

**This is a WEBSITE, not a mobile app. No React Native. No Expo. Pure web React.**

## Project structure

```
snapcount-web/
├── index.html
├── vite.config.ts
├── package.json
├── src/
│   ├── main.tsx                    # Entry point, calls seedDemoData() + seedDemoSuppliers()
│   ├── App.tsx                     # Tab navigation: Scan | Dashboard | Restock | History
│   ├── pages/
│   │   ├── ScanPage.tsx            # Photo upload/camera → Florence + Gemini analysis → results
│   │   ├── DashboardPage.tsx       # Trend charts, depletion table, alert cards
│   │   ├── RestockPage.tsx         # AI-generated purchase order + Zalo send
│   │   └── HistoryPage.tsx         # Past scans timeline
│   ├── components/
│   │   ├── BoundingBoxOverlay.tsx   # Absolute-positioned divs over <img> for detection boxes
│   │   ├── PhotoCollector.tsx       # Multi-angle: 3 photo slots, min 2 required
│   │   ├── SummaryCards.tsx         # Detected / Estimated / Hidden / Labels read
│   │   ├── ResultsList.tsx          # Per-item rows with OCR tags
│   │   ├── TrendChart.tsx           # Chart.js <Line> wrapper
│   │   ├── DepletionTable.tsx       # Sortable table: product, stock, days until empty
│   │   ├── RestockOrderCard.tsx     # Line item with +/- qty stepper
│   │   ├── SupplierSelector.tsx     # Dropdown of saved suppliers
│   │   └── ZaloSendButton.tsx       # Copy message + open zalo.me link
│   ├── services/
│   │   ├── florenceDetector.ts      # POST to localhost:8000/detect (Florence-2 backend)
│   │   ├── vision.ts               # POST to OpenRouter — single photo Gemini analysis
│   │   ├── multiAngleVision.ts     # POST to OpenRouter — 2-3 photos in ONE call
│   │   ├── mergeResults.ts         # Combines Florence boxes + Gemini reasoning
│   │   ├── scanHistory.ts          # localStorage CRUD, product trends, demo data seeding
│   │   ├── lowStockAgent.ts        # Gemini agent: stock trends → restock recommendation
│   │   ├── restockAgent.ts         # Gemini agent: scan results → purchase order
│   │   └── zaloMessenger.ts        # Supplier CRUD, Zalo deep links, VND formatting
│   ├── hooks/
│   │   ├── useInventoryAnalysis.ts  # Orchestrates Florence + Gemini in parallel
│   │   └── useRestockOrder.ts       # Generate → review → edit → confirm flow
│   ├── types/index.ts               # All TypeScript interfaces
│   ├── constants/config.ts          # API keys, endpoints, prompts
│   └── context/
│       └── ScanContext.tsx           # Shares images + results across pages
```

## Two AI backends

### Florence-2 server (localhost:8000)

Python FastAPI running Microsoft Florence-2-large. Does THREE tasks per photo in one model:
1. `<OD>` — bounding boxes with labels
2. `<DENSE_REGION_CAPTION>` — specific descriptions: "a red Coca-Cola can"
3. `<OCR_WITH_REGION>` — reads text from labels: "Coca-Cola", "Hảo Hảo"

**Response format:**
```json
{
  "predictions": [
    { "x": 245, "y": 130, "width": 80, "height": 120, "confidence": 0.85,
      "class": "a red Coca-Cola can [Coca-Cola]", "ocr_text": "Coca-Cola",
      "source": "dense_caption" }
  ],
  "total_objects": 15,
  "class_counts": {"a red Coca-Cola can": 5},
  "ocr_texts": ["Coca-Cola", "Fanta", "Hảo Hảo"],
  "image_width": 1024, "image_height": 768, "inference_time_ms": 2400
}
```

If server is offline (check GET /health on startup), fall back to Gemini-only mode.

### Gemini 2.5 Flash via OpenRouter (cloud)

Handles reasoning tasks Florence can't do:
- Occlusion inference ("3 items hidden behind front row")
- Multi-angle cross-referencing (multiple photos in one request)
- Restock order generation with VND pricing
- Low stock analysis + Vietnamese Zalo message writing

**OpenRouter format (OpenAI-compatible, NOT Anthropic):**
```typescript
fetch("https://openrouter.ai/api/v1/chat/completions", {
  headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash", max_tokens: 1024,
    messages: [{ role: "user", content: [...] }]
  })
})
// Response: data.choices[0].message.content (string)
```

For vision: content = [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }]
For multi-angle: same but with multiple image_url entries.
For text-only (restock agent): plain string content with system + user messages.

## Key patterns and rules

### API calls
- Always use `Promise.allSettled` (not `Promise.all`) when running Florence + Gemini in parallel. One failing must not crash the other.
- Always strip markdown backticks from Gemini responses before JSON.parse: `text.replace(/```json\s?/g, "").replace(/```/g, "").trim()`
- Florence server might be offline — always gracefully degrade.

### Image handling
- Compress via Canvas before any API call: max 1024px, JPEG quality 0.8
- Thumbnails for localStorage: compress to 200px, quality 0.6 (~10-15KB each)
- Florence wants raw base64 (no `data:image/...` prefix)
- OpenRouter wants full data URI (`data:image/jpeg;base64,...`)

### BoundingBoxOverlay scaling
Florence returns center coordinates. Convert to top-left for CSS:
```
scaleX = displayedImageWidth / response.image_width
scaleY = displayedImageHeight / response.image_height
left = (pred.x - pred.width / 2) * scaleX
top = (pred.y - pred.height / 2) * scaleY
boxWidth = pred.width * scaleX
boxHeight = pred.height * scaleY
```
Get displayed dimensions from img.onLoad or a ref with getBoundingClientRect().

### localStorage
- Scan history: key `snapcount_scans`, max 30 records
- Suppliers: key `snapcount_suppliers`
- On first load, seed demo data (7 days Vietnamese products) + 3 demo suppliers

### Formatting
- Dates: DD/MM format (Vietnamese style), NOT MM/DD
- Currency: `192.000đ` (dot separator, đ suffix). Use `amount.toLocaleString("vi-VN") + "đ"`
- Timezone: UTC+7 (Vietnam)

## UI theme

Dark theme throughout:
```
Background:     #0a0f0d
Surface:        #0d1a14
Border:         #1a2722
Accent:         #059669 → #34d399 (emerald green)
Warning:        #fbbf24 (amber)
Danger:         #f87171 (red)
Info:           #60a5fa (blue)
Text primary:   #e2e8e0
Text secondary: #6b8f7b
```
- All numbers rendered in monospace font
- Confidence badges: high=green, medium=amber, low=red
- Status badges: critical=red, low=amber, ok=green
- Urgency badges on restock items: critical=red, low=amber

## Navigation

4 tabs in top bar: **Scan** | **Dashboard** | **Restock** | **History**
Active tab: emerald underline. Simple state-based routing (conditional render by active tab). No react-router needed.

## Demo data

Pre-seeded on first load via `seedDemoData()` and `seedDemoSuppliers()`:

**8 products over 7 days (declining stock):**
- Coca-Cola can: 24→22→18→15→12→8→5
- Fanta Orange bottle: 18→18→16→14→11→9→7
- Mì Hảo Hảo tôm chua cay: 30→28→25→20→16→10→4
- Nước mắm Chin-Su: 12→12→11→11→10→10→9
- Trà xanh C2: 20→17→14→12→9→6→3
- Monster Energy: 10→9→8→7→5→3→1
- Bia Tiger: 36→34→30→28→24→20→18
- Bánh mì Kinh Đô: 15→13→10→8→5→3→1

**3 demo suppliers:**
- Đại lý nước giải khát Minh Phát — 0912345678 — drinks
- Cửa hàng thực phẩm Hương Giang — 0987654321 — food, noodles
- NPP Bia Tiger khu vực HCM — 0909876543 — beer

## The agentic workflow (end-to-end)

```
Owner takes photo of shelf
  → Florence-2 detects + identifies products + reads labels (local, free)
  → Gemini reasons about hidden items + counts total (cloud, cheap)
  → Results saved to localStorage
  → Dashboard shows 7-day trends via Chart.js
  → Low stock agent detects critical items automatically
  → Gemini generates restock order in Vietnamese with VND prices
  → Owner taps "Send via Zalo" → message copied + Zalo chat opens
  → Supplier receives order → delivers stock
```

## Commands

```bash
npm run dev          # Start frontend (localhost:5173)
npm run build        # Production build
# In separate terminal:
cd server && uvicorn main:app --host 0.0.0.0 --port 8000  # Florence-2 backend
```

## Dependencies

```json
{
  "react": "^18",
  "react-dom": "^18",
  "typescript": "^5",
  "vite": "^5",
  "chart.js": "^4",
  "react-chartjs-2": "^5"
}
```

No React Native packages. No Expo. No react-router. No Tailwind. No UI library. Pure React + inline styles/CSS matching the dark theme.
