# CLAUDE.md — COUNTR. (Hosted APIs Only)

## What is this?

COUNTR. is an AI-powered inventory management website for Vietnamese small businesses. A shop owner photographs their shelf from multiple angles → Grounding DINO detects product locations with tight bounding boxes, Gemini verifies, identifies, and counts accurately using all angles, DINOv2 recognizes products from a learned catalog → tracks stock over days, predicts depletion, generates purchase orders, sends them via Zalo, and emails professional inventory reports.

**Hackathon**: LotusHacks x HackHarvard (March 2026, VNG Campus, HCMC)
**Track**: Enterprise by TinyFish — "Build tools that transform how businesses operate"
**Tagline**: "Precision Inventory Intelligence"

---

## Brand guidelines — COUNTR.

### Colors
| Name | HEX | RGB | Role |
|------|-----|-----|------|
| Pure White | #FFFFFF | 255, 255, 255 | Primary background |
| Ink Black | #0A0A0A | 10, 10, 10 | Primary text, headings |
| Off White | #F5F5F3 | 245, 245, 243 | Surface / card backgrounds |
| Charcoal | #5A5A54 | 90, 90, 84 | Secondary text |
| Stone Grey | #9A9A92 | 154, 154, 146 | Muted text, placeholders |
| Pale Border | #E0E0C5 | 224, 224, 229 | Dividers, borders |

### Typography
| Font | Role | Weights used |
|------|------|-------------|
| **Syne** | Display / Headings | 700 (bold), 800 (extra-bold) |
| **Outfit** | Body / UI Text | 300, 400, 500, 600 |
| **JetBrains Mono** | Data / Code / Labels (quantities, SKUs, prices) | 400, 500, 700 |

### Heading sizes
- Hero / display: 88px / 800 weight
- Section heading: 36px / 700 weight
- Card title: 22px / 600 weight

### Design principles
- Clean, minimal, lots of whitespace
- Black and white primary — no bright accent colors in the UI
- Data in JetBrains Mono always (quantities, prices, percentages, dates)
- Subtle borders (#E0E0C5), no heavy shadows
- Logo: **COUNTR.** in Syne Extra-Bold, always with the period

### Google Fonts import
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## Tech stack

| Layer | Technology | How accessed |
|-------|-----------|-------------|
| Frontend | React + Vite + TypeScript | Browser (localhost:5173) |
| Detection (visual boxes) | Grounding DINO (IDEA Research, ECCV 2024) | Roboflow serverless API |
| Catalog matching | DINOv2 embeddings (Meta) | HuggingFace Inference API |
| Identification + Counting + OCR + Depth + Orders | Gemini 2.5 Flash (Google) | OpenRouter API |
| Email reports | EmailJS (browser-side) | EmailJS SDK |
| Charts | Chart.js + react-chartjs-2 | npm package |
| Storage | localStorage | Browser |
| Messaging | Zalo deep links | Browser → Zalo app |

**NO Python server. NO local model downloads. Everything runs from the React website via hosted API calls.**

**Key architecture**: Grounding DINO finds WHERE products are (tight bounding boxes as visual overlays). Gemini is the brain — accurate counting, identification, OCR, depth reasoning, order generation. DINOv2 handles product catalog recognition. Each model does what it's best at.

---

## API keys needed (4 total)

```
VITE_ROBOFLOW_API_KEY=""      // roboflow.com → free account → profile → API Key
VITE_HUGGINGFACE_TOKEN=""     // huggingface.co → free account → Settings → Access Tokens
VITE_OPENROUTER_API_KEY=""    // openrouter.ai → sign in → Settings → Keys → add $5 credits
VITE_EMAILJS_PUBLIC_KEY=""    // emailjs.com → free account → Account → API Keys
VITE_EMAILJS_SERVICE_ID=""    // emailjs.com → Email Services → add Gmail/Outlook → copy ID
VITE_EMAILJS_TEMPLATE_ID=""  // emailjs.com → Email Templates → create template → copy ID
```

Create a `.env` file in the project root with these.

---

## Setup

```bash
npm create vite@latest countr-web -- --template react-ts
cd countr-web
npm install chart.js react-chartjs-2 @emailjs/browser
npm run dev
```

---

## The AI models and their roles

### Model 1: Grounding DINO via Roboflow — DETECTION (tight visual boxes)

**Role**: Find WHERE products are. Returns bounding boxes. These are visual overlays — NOT the source of truth for counting. Gemini counts.

**Endpoint**: POST https://infer.roboflow.com/grounding_dino/infer

```typescript
// src/services/groundingDinoAPI.ts
async function detectProducts(base64Image: string, text: string) {
  const response = await fetch("https://infer.roboflow.com/grounding_dino/infer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: ROBOFLOW_API_KEY,
      image: { type: "base64", value: base64Image },  // raw base64, NO data: prefix
      text: text,  // period-separated classes
      // TIGHTER DETECTION PARAMETERS:
      box_threshold: 0.35,   // raised from 0.2 — fewer false positive boxes
      text_threshold: 0.25,  // slightly raised — better text-box matching
    }),
  });
  return await response.json();
}
```

**Tuning for tighter boxes**:
- `box_threshold: 0.35` — only show boxes the model is reasonably confident about. Eliminates loose/ghost boxes. If too few detections, lower to 0.25. If too many false positives, raise to 0.45.
- `text_threshold: 0.25` — how confident the text-to-box matching must be. Higher = fewer but more accurate labels.
- Use SPECIFIC product names in the text prompt, not generic ones. "Coca-Cola 330ml can" detects tighter than "drink can".
- Keep prompts SHORT per class — long descriptions make boxes looser.

**Response format** (center coordinates):
```json
{
  "predictions": [
    { "x": 245.5, "y": 130.2, "width": 80, "height": 120, "confidence": 0.82, "class": "Coca-Cola can" }
  ],
  "image": { "width": 1024, "height": 768 }
}
```

Text prompt format: PERIOD-separated. Example:
`"Coca-Cola can. Fanta bottle. instant noodle pack. fish sauce bottle."`

Box coordinates: x,y = center. Top-left: `left = x - width/2`, `top = y - height/2`.

**Post-processing for tighter boxes** — apply Non-Maximum Suppression (NMS) in the browser to remove overlapping duplicate detections:

```typescript
function applyNMS(predictions: any[], iouThreshold = 0.5): any[] {
  const sorted = [...predictions].sort((a, b) => b.confidence - a.confidence);
  const kept: any[] = [];

  for (const pred of sorted) {
    let dominated = false;
    for (const k of kept) {
      if (computeIoU(pred, k) > iouThreshold) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(pred);
  }
  return kept;
}

function computeIoU(a: any, b: any): number {
  const ax1 = a.x - a.width / 2, ay1 = a.y - a.height / 2;
  const ax2 = a.x + a.width / 2, ay2 = a.y + a.height / 2;
  const bx1 = b.x - b.width / 2, by1 = b.y - b.height / 2;
  const bx2 = b.x + b.width / 2, by2 = b.y + b.height / 2;

  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const union = a.width * a.height + b.width * b.height - inter;
  return inter / union;
}
```

### Model 2: DINOv2 Embeddings via HuggingFace — CATALOG MATCHING

**Role**: Visual fingerprinting. Owner photographs product once → embedding stored → recognized forever.
**Endpoint**: POST https://api-inference.huggingface.co/pipeline/feature-extraction/facebook/dinov2-base

```typescript
// src/services/dinov2API.ts
async function getEmbedding(imageBlob: Blob): Promise<number[]> {
  const response = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/facebook/dinov2-base",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${HUGGINGFACE_TOKEN}` },
      body: imageBlob,
    }
  );
  const data = await response.json();
  let embedding = data;
  while (Array.isArray(embedding) && Array.isArray(embedding[0])) {
    embedding = embedding[0];
  }
  return embedding; // 768-dim
}
```

Cold start: if `error: "Model is loading"`, wait 10s, retry once.

**Catalog**: localStorage key `"countr_catalog"`. Interface: `{ name: string; embedding: number[] }`.
**Matching**: cosine similarity, threshold 0.7. Runs in browser.

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

### Model 3: Gemini 2.5 Flash via OpenRouter — THE BRAIN

**Role**: Source of truth for counting, identification, OCR, depth reasoning, order generation, Zalo messages.
**Endpoint**: POST https://openrouter.ai/api/v1/chat/completions

```typescript
// src/services/geminiAPI.ts
async function callGemini(messages: any[]) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://countr.app",
      "X-Title": "COUNTR",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 2048, messages }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}
```

Vision: `content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }]`
Multiple images: add more `image_url` objects.
Strip backticks: `text.replace(/```json\s?/g,"").replace(/```/g,"").trim()`

---

## Gemini prompts

### Single photo (quick scan):

```typescript
const SINGLE_PHOTO_PROMPT = `You are an expert inventory counter for Vietnamese convenience stores.

A detection system found these approximate product locations:
{DINO_RESULTS}

Your job:
1. VERIFY each detection — remove false positives.
2. IDENTIFY each product by reading labels and recognizing brands. Vietnamese names where visible.
3. COUNT every instance you can see. The detector may have missed some.
4. READ text on labels (OCR).

Return ONLY valid JSON:
{
  "products": [
    { "name": "Coca-Cola can", "count": 5, "ocr_text": "Coca-Cola", "confidence": "high", "notes": "" }
  ],
  "total_items": 20,
  "ocr_all": ["Coca-Cola", "Fanta", "Hảo Hảo"],
  "missed_by_detector": ["2 water bottles top shelf"],
  "false_positives": ["1 price tag misdetected"],
  "note": "Single angle — take side photo for depth"
}`;
```

### Multi-angle depth (primary mode):

```typescript
function buildMultiAnglePrompt(frameCount: number, dinoResults: string): string {
  const photoList = Array.from({ length: frameCount }, (_, i) =>
    `- Photo ${i + 1}: ${i === 0 ? "front view" : `angle ${i}`}`
  ).join("\n");

  return `You are an expert inventory counter for Vietnamese convenience stores.

You have ${frameCount} photos of the SAME shelf from different angles:
${photoList}

Detection system found these locations from front photo:
${dinoResults}

Your job:
1. VERIFY detections — remove false positives.
2. IDENTIFY products by reading labels.
3. COUNT front-visible products.
4. USE SIDE ANGLES to count depth rows. Only count what you SEE — no guessing.
5. READ all label text across all photos.
6. FIND products the detector missed.

Return ONLY valid JSON:
{
  "products": [
    { "name": "Coca-Cola can", "front_visible": 5, "depth_visible": 8, "total": 13, "ocr_text": "Coca-Cola", "confidence": "high", "notes": "side shows 2 rows of 4 behind front" }
  ],
  "total_items": 42,
  "angles_used": ${frameCount},
  "ocr_all": ["Coca-Cola", "Fanta Orange", "Hảo Hảo"],
  "missed_by_detector": ["3 fish sauce bottles bottom shelf"],
  "false_positives": [],
  "depth_notes": "Side angles revealed 2-3 rows deep on drink shelves"
}`;
}
```

### Restock order prompt:

```typescript
const RESTOCK_PROMPT = `You are a purchasing assistant for a Vietnamese convenience store.

Current stock and trends:
{DEPLETION_DATA}

Generate a purchase order with realistic Vietnamese wholesale VND prices.

Return ONLY valid JSON:
{
  "items": [
    { "product": "Coca-Cola lon 330ml", "currentStock": 5, "orderQty": 24, "unitPrice": 8000, "unit": "lon" }
  ],
  "totalVND": 500000,
  "urgency": "high",
  "reasoning": "6 products critically low"
}`;
```

### Zalo message prompt:

```typescript
const ZALO_PROMPT = `Write a polite Vietnamese supplier message for this order.
Supplier: {SUPPLIER_NAME}
Order items:
{ORDER_ITEMS_WITH_QUANTITIES}
Total: {TOTAL_VND}

Include greeting, item list with quantities and prices, total, delivery request (tomorrow), thank you.
Return message text only.`;
```

---

## Detection pipeline

### Multi-angle (primary):
```
User provides 2-3 photos
  │
  ├──→ Grounding DINO on Photo 1 → bounding boxes
  │    Apply NMS (IoU 0.5) to remove duplicate/overlapping boxes
  │
  ├──→ Each DINO box → crop → DINOv2 → catalog match
  │
  └──→ Gemini with ALL photos + DINO results + catalog matches
       Source of truth: verified products, accurate counts, depth
       │
       ▼
  MERGE: DINO boxes displayed with Gemini-verified labels
  Counts from Gemini (NOT from counting DINO boxes)
  Save to localStorage
```

### Graceful degradation:
If DINO fails → Gemini still counts (no overlay boxes, text results only).
If DINOv2 fails → Gemini + DINO still work (no catalog matching).
If Gemini fails → DINO boxes + catalog matches shown (no verified counts).

---

## Merging DINO + Gemini + Catalog

```typescript
// src/services/mergeResults.ts
interface MergedDetection {
  x: number; y: number; width: number; height: number;
  dinoClass: string;
  dinoConfidence: number;
  catalogMatch?: string;
  catalogSimilarity?: number;
  geminiName?: string;
  geminiCount?: number;
  ocrText?: string;
  displayName: string;
  idMethod: "gemini" | "catalog" | "dino";
}

function mergeResults(dinoPreds: any[], geminiProducts: any[], catalogMatches: Map<number, {name:string;similarity:number}>): MergedDetection[] {
  return dinoPreds.map((pred, i) => {
    const gemini = geminiProducts.find(gp =>
      gp.name.toLowerCase().includes(pred.class.toLowerCase()) ||
      pred.class.toLowerCase().includes(gp.name.toLowerCase())
    );
    const catalog = catalogMatches.get(i);
    const displayName = gemini?.name || catalog?.name || pred.class;
    const idMethod = gemini ? "gemini" : catalog ? "catalog" : "dino";
    return {
      x: pred.x, y: pred.y, width: pred.width, height: pred.height,
      dinoClass: pred.class, dinoConfidence: pred.confidence,
      catalogMatch: catalog?.name, catalogSimilarity: catalog?.similarity,
      geminiName: gemini?.name, geminiCount: gemini?.total || gemini?.count,
      ocrText: gemini?.ocr_text, displayName, idMethod,
    };
  });
}
```

---

## BoundingBoxOverlay

```typescript
// Semi-transparent boxes over the <img> using absolute-positioned divs
// Scale: scaleX = displayWidth / imageWidth

// Colors (monochrome per brand):
// Confirmed (gemini verified): border #0A0A0A, bg rgba(10,10,10,0.08)
// Catalog match: border #5A5A54, bg rgba(90,90,84,0.08)
// DINO only: border #9A9A92, bg rgba(154,154,146,0.08)

// Label pill above each box:
//   font: JetBrains Mono 11px
//   bg: #0A0A0A, text: #FFFFFF, borderRadius: 2px, padding: 1px 6px
//   content: "{displayName} ×{count}"
```

---

## Email report feature

### Setup: EmailJS (free tier, browser-side, no backend)

1. Sign up at emailjs.com (free: 200 emails/month)
2. Add an email service (Gmail, Outlook, etc)
3. Create an email template with variable `{html_content}` in the body
4. Template should be set to HTML content type

```typescript
// src/services/emailReport.ts
import emailjs from "@emailjs/browser";

emailjs.init(EMAILJS_PUBLIC_KEY);

async function sendInventoryReport(recipientEmail: string, reportHTML: string, subject: string) {
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: recipientEmail,
    subject: subject,
    html_content: reportHTML,
  });
}
```

### EmailJS template setup

In emailjs.com → Email Templates, create a template:
- To: `{{to_email}}`
- Subject: `{{subject}}`
- Body (set content type to HTML): `{{{html_content}}}`

The triple braces `{{{ }}}` in EmailJS templates render raw HTML.

### Report HTML generation

Generate the full HTML report in the browser. The report follows the COUNTR. brand exactly.

```typescript
// src/services/reportGenerator.ts

function generateInventoryReportHTML(
  products: ProductTrend[],
  depletionData: DepletionRow[],
  scanDate: string
): string {
  const criticalItems = depletionData.filter(d => d.daysLeft <= 2);
  const lowItems = depletionData.filter(d => d.daysLeft > 2 && d.daysLeft <= 5);
  const healthyItems = depletionData.filter(d => d.daysLeft > 5);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif;
      color: #0A0A0A;
      background: #FFFFFF;
      padding: 40px;
      max-width: 680px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #0A0A0A;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .logo {
      font-family: 'Syne', 'Georgia', serif;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 13px;
      color: #9A9A92;
      font-weight: 400;
      margin-top: 4px;
    }
    .report-date {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12px;
      color: #5A5A54;
      margin-top: 8px;
    }
    h2 {
      font-family: 'Syne', 'Georgia', serif;
      font-size: 22px;
      font-weight: 700;
      margin: 32px 0 16px 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: #F5F5F3;
      border: 1px solid #E0E0C5;
      padding: 20px;
    }
    .summary-card .label {
      font-size: 12px;
      color: #9A9A92;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 500;
    }
    .summary-card .value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 36px;
      font-weight: 700;
      margin-top: 4px;
    }
    .summary-card .sub {
      font-size: 12px;
      color: #5A5A54;
      margin-top: 2px;
    }
    .critical { border-left: 4px solid #0A0A0A; }
    .low { border-left: 4px solid #9A9A92; }
    .healthy { border-left: 4px solid #E0E0C5; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 32px 0;
    }
    th {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9A9A92;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #0A0A0A;
      font-weight: 500;
    }
    td {
      font-size: 14px;
      padding: 10px 12px;
      border-bottom: 1px solid #E0E0C5;
    }
    td.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .status-critical {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #0A0A0A;
      background: #0A0A0A;
      color: #FFFFFF;
      padding: 2px 8px;
      display: inline-block;
    }
    .status-low {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid #5A5A54;
      padding: 2px 8px;
      display: inline-block;
    }
    .status-ok {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #9A9A92;
      padding: 2px 8px;
      display: inline-block;
    }
    .trend-up { }
    .trend-down { font-weight: 600; }
    .footer {
      border-top: 1px solid #E0E0C5;
      padding-top: 20px;
      margin-top: 40px;
      font-size: 12px;
      color: #9A9A92;
    }
    .footer .logo-sm {
      font-family: 'Syne', serif;
      font-weight: 800;
      font-size: 14px;
      color: #0A0A0A;
    }
    .section-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #9A9A92;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">COUNTR.</div>
    <div class="tagline">Precision Inventory Intelligence</div>
    <div class="report-date">REPORT GENERATED · ${scanDate}</div>
  </div>

  <div class="section-label">Inventory Overview</div>
  <div class="summary-grid">
    <div class="summary-card critical">
      <div class="label">Critical</div>
      <div class="value">${criticalItems.length}</div>
      <div class="sub">≤ 2 days remaining</div>
    </div>
    <div class="summary-card low">
      <div class="label">Low Stock</div>
      <div class="value">${lowItems.length}</div>
      <div class="sub">3–5 days remaining</div>
    </div>
    <div class="summary-card healthy">
      <div class="label">Healthy</div>
      <div class="value">${healthyItems.length}</div>
      <div class="sub">> 5 days remaining</div>
    </div>
  </div>

  <h2>Stock Status</h2>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Daily Use</th>
        <th>Days Left</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${depletionData.map(d => `
      <tr>
        <td>${d.product}</td>
        <td class="mono">${d.current}</td>
        <td class="mono">${d.avgPerDay.toFixed(1)}</td>
        <td class="mono">${d.daysLeft === Infinity ? '—' : d.daysLeft}</td>
        <td>${
          d.daysLeft <= 2 ? '<span class="status-critical">CRITICAL</span>' :
          d.daysLeft <= 5 ? '<span class="status-low">LOW</span>' :
          '<span class="status-ok">OK</span>'
        }</td>
      </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>7-Day Trends</h2>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>7d Ago</th>
        <th>Now</th>
        <th>Change</th>
      </tr>
    </thead>
    <tbody>
      ${products.map(p => {
        const first = p.trend[0]?.count ?? 0;
        const last = p.trend[p.trend.length - 1]?.count ?? 0;
        const change = last - first;
        return `
      <tr>
        <td>${p.name}</td>
        <td class="mono">${first}</td>
        <td class="mono">${last}</td>
        <td class="mono trend-down">${change > 0 ? '+' : ''}${change}</td>
      </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="footer">
    <div class="logo-sm">COUNTR.</div>
    <div style="margin-top:4px;">Precision Inventory Intelligence · Generated automatically</div>
  </div>
</body>
</html>`;
}
```

### Email send button in Dashboard

A "Email Report" button on the Dashboard page. On click:
1. Prompt user for email address (show a small modal input, pre-fill from localStorage if saved before).
2. Generate report HTML from current trend + depletion data.
3. Send via EmailJS.
4. Show success/failure toast.
5. Save email to localStorage so they don't have to type it again.

---

## Restock page — editable quantities + Zalo auto-send

### Editable quantity input

Each restock item has a direct number input field PLUS increment/decrement buttons:

```typescript
// RestockOrderCard.tsx — per item row

<div className="qty-control">
  <button onClick={() => updateQty(item.product, item.orderQty - 1)}>−</button>
  <input
    type="number"
    min="0"
    value={item.orderQty}
    onChange={(e) => updateQty(item.product, parseInt(e.target.value) || 0)}
    style={{
      width: "72px",
      textAlign: "center",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "16px",
      fontWeight: 700,
      border: "1px solid #E0E0C5",
      padding: "8px 4px",
    }}
  />
  <button onClick={() => updateQty(item.product, item.orderQty + 1)}>+</button>
</div>
```

Line total recalculates live: `lineTotal = item.orderQty * item.unitPrice`.
Grand total at bottom recalculates on every change.
All prices in JetBrains Mono, VND format: `192.000đ`.

### Zalo send flow — test number 0971920305

When user clicks "Send via Zalo":

1. Generate Vietnamese order message using Gemini (or pre-built template).
2. Copy message to clipboard using `navigator.clipboard.writeText(message)`.
3. Open Zalo to the test number: `window.open("https://zalo.me/0971920305", "_blank")`.
4. Show toast: "Message copied! Paste it in the Zalo chat."

```typescript
// src/services/zaloMessenger.ts

const TEST_ZALO_NUMBER = "0971920305";

function generateOrderMessage(items: RestockItem[], supplierName: string, totalVND: number): string {
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const tomorrow = new Date(now.getTime() + 86400000);
  const deliveryStr = `${tomorrow.getDate()}/${tomorrow.getMonth() + 1}/${tomorrow.getFullYear()}`;

  const itemLines = items
    .filter(i => i.orderQty > 0)
    .map(i => `• ${i.product}: ${i.orderQty} ${i.unit} × ${formatVND(i.unitPrice)} = ${formatVND(i.orderQty * i.unitPrice)}`)
    .join("\n");

  return `Xin chào ${supplierName},

Em muốn đặt hàng như sau:

${itemLines}

Tổng cộng: ${formatVND(totalVND)}

Anh/chị giao giúp em ngày ${deliveryStr} được không ạ?

Cảm ơn anh/chị!
— COUNTR.`;
}

function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}

async function sendViaZalo(message: string, phone: string = TEST_ZALO_NUMBER) {
  await navigator.clipboard.writeText(message);
  window.open(`https://zalo.me/${phone}`, "_blank");
  // Returns true — caller shows toast "Message copied! Paste in Zalo."
  return true;
}
```

### Supplier management

localStorage key: `"countr_suppliers"`. Pre-seeded with:
- Đại lý nước giải khát Minh Phát / 0912345678 / drinks
- Cửa hàng thực phẩm Hương Giang / 0987654321 / food
- NPP Bia Tiger khu vực HCM / 0909876543 / beer
- **Test Supplier / 0971920305 / all** (pre-selected for demo)

User selects supplier → message generated with their name → sent to their Zalo number.

For the hackathon demo: "Test Supplier" with number 0971920305 is pre-selected so judges can see the Zalo flow immediately.

---

## Project structure

```
countr-web/
├── index.html
├── vite.config.ts
├── package.json
├── CLAUDE.md
├── .env
├── src/
│   ├── main.tsx                     # Seeds demo data + suppliers
│   ├── App.tsx                      # Scan | Dashboard | Restock | History
│   ├── pages/
│   │   ├── ScanPage.tsx
│   │   ├── DashboardPage.tsx        # Includes "Email Report" button
│   │   ├── RestockPage.tsx          # Editable qty + Zalo send
│   │   └── HistoryPage.tsx
│   ├── components/
│   │   ├── BoundingBoxOverlay.tsx
│   │   ├── PhotoCollector.tsx
│   │   ├── SummaryCards.tsx
│   │   ├── ResultsList.tsx
│   │   ├── TrendChart.tsx
│   │   ├── DepletionTable.tsx
│   │   ├── RestockOrderCard.tsx     # Number input + ±  buttons
│   │   ├── SupplierSelector.tsx
│   │   ├── ZaloSendButton.tsx
│   │   ├── EmailReportButton.tsx    # Email modal + send
│   │   ├── VocabularyEditor.tsx
│   │   └── CatalogBuilder.tsx
│   ├── services/
│   │   ├── groundingDinoAPI.ts
│   │   ├── dinov2API.ts
│   │   ├── productCatalog.ts
│   │   ├── geminiAPI.ts
│   │   ├── geminiAnalysis.ts
│   │   ├── mergeResults.ts
│   │   ├── scanHistory.ts
│   │   ├── restockAgent.ts
│   │   ├── zaloMessenger.ts
│   │   ├── emailReport.ts          # EmailJS integration
│   │   └── reportGenerator.ts      # HTML report builder
│   ├── types/index.ts
│   └── constants/config.ts
```

---

## Pages

### 1. Scan Page
- Multi-angle default: 3 photo slots (Front / Side / Other)
- Quick scan toggle for single photo
- Compress via Canvas 1024px JPEG 0.8
- Pipeline: DINO + Gemini parallel, DINOv2 catalog per crop
- Display: Photo 1 with BoundingBoxOverlay + Gemini-verified labels
- Summary cards + per-product breakdown
- Auto-save to localStorage

### 2. Dashboard Page
- Summary cards: Critical / Low / Healthy counts
- Chart.js trend lines (7 days)
- Depletion table sorted by urgency
- **"Email Report" button** → modal for email → sends branded HTML report
- Pre-seeded demo data on first load

### 3. Restock Page
- Gemini generates order → user reviews
- **Editable qty: number input field + ±  buttons** per item
- Line totals + grand total recalculate live in VND
- Supplier dropdown (pre-seeded with test number 0971920305)
- **"Send via Zalo" button** → generates Vietnamese message → copies to clipboard → opens zalo.me/{phone}
- Toast confirmation: "Message copied! Paste it in the Zalo chat."

### 4. History Page
- Past scans with thumbnails, most recent first

---

## Navigation
4 tabs: **Scan** | **Dashboard** | **Restock** | **History**
State-based routing. No react-router.

---

## Demo data

8 products, 7 days declining:
- Coca-Cola can: 24→22→18→15→12→8→5
- Fanta Orange bottle: 18→18→16→14→11→9→7
- Mì Hảo Hảo tôm chua cay: 30→28→25→20→16→10→4
- Nước mắm Chin-Su: 12→12→11→11→10→10→9
- Trà xanh C2: 20→17→14→12→9→6→3
- Monster Energy: 10→9→8→7→5→3→1
- Bia Tiger: 36→34→30→28→24→20→18
- Bánh mì Kinh Đô: 15→13→10→8→5→3→1

4 demo suppliers:
- Đại lý nước giải khát Minh Phát / 0912345678 / drinks
- Cửa hàng thực phẩm Hương Giang / 0987654321 / food
- NPP Bia Tiger khu vực HCM / 0909876543 / beer
- Test Supplier / 0971920305 / all (pre-selected)

---

## Default vocabulary (Grounding DINO — period-separated)

```typescript
const DEFAULT_VOCABULARY =
  "Coca-Cola can. Coca-Cola bottle. Pepsi can. " +
  "Fanta Orange can. Fanta Orange bottle. Sprite can. " +
  "Monster Energy can. Red Bull can. " +
  "Tiger beer can. Tiger beer bottle. Saigon beer can. 333 beer can. " +
  "water bottle. milk carton. juice box. C2 green tea bottle. " +
  "instant noodle pack. rice bag. bread loaf. snack bag. chip bag. " +
  "candy bar. chocolate bar. cookie package. canned food. " +
  "fish sauce bottle. soy sauce bottle. cooking oil bottle. chili sauce bottle. " +
  "soap bar. shampoo bottle. toothpaste tube. detergent box. tissue box. " +
  "banana. apple. orange. mango. tomato. onion. garlic. lime.";
```

---

## Key patterns
- Promise.allSettled for all parallel API calls
- Strip backticks from Gemini before JSON.parse
- Grounding DINO: raw base64 (no data: prefix), period-separated text
- OpenRouter Gemini: full data URI (data:image/jpeg;base64,...) in image_url.url
- DINOv2: raw Blob body
- NMS post-processing on DINO results (IoU 0.5)
- Image compression via Canvas
- localStorage keys prefixed with "countr_"
- All data text in JetBrains Mono
- Zalo: https://zalo.me/PHONE
- VND formatting: `amount.toLocaleString("vi-VN") + "đ"`
- Dates: DD/MM format

## Commands
```bash
npm create vite@latest countr-web -- --template react-ts
cd countr-web && npm install chart.js react-chartjs-2 @emailjs/browser && npm run dev
```
