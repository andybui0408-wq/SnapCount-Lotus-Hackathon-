// src/services/lowStockAgent.ts

import { OPENROUTER_BASE_URL, VISION_MODEL, getApiKey } from "../constants/config";
import { getProductTrends } from "./scanHistory";

export interface RestockRecommendation {
  urgent_items: Array<{
    name: string;
    current_stock: number;
    daily_sales_rate: number;
    days_until_empty: number;
    recommended_order_qty: number;
    unit_cost_vnd: number;
    line_total_vnd: number;
    urgency: "critical" | "low";
    reasoning: string;
  }>;
  total_order_cost_vnd: number;
  total_order_cost_usd: number;
  supplier_message_vi: string;
  summary: string;
}

const RESTOCK_PROMPT = `You are an inventory management AI for a Vietnamese retail shop (cửa hàng tạp hóa).

Given stock levels and daily sales trends, generate a restock order.

Rules:
1. Items with 0-3 units or ≤2 days until empty: CRITICAL
2. Items with 4-8 units or 3-5 days until empty: LOW
3. Skip items with 9+ units AND 6+ days remaining
4. Order quantities: enough for 7-10 days based on daily sales rate
5. Round to wholesale units: 6-packs, thùng 12/24, hộp 10
6. Use realistic Vietnamese wholesale prices in VND
7. Generate a supplier_message_vi — a natural Vietnamese Zalo message 
   the shop owner can copy-paste to their supplier. Include:
   - Polite greeting (Chào anh/chị)
   - Itemized list with quantities and estimated costs
   - Total cost
   - Delivery request (giao trong hôm nay / ngày mai)
   - Sign off (Cảm ơn anh/chị!)

Return ONLY valid JSON, no markdown, no backticks:
{
  "urgent_items": [
    {
      "name": "Product name",
      "current_stock": 3,
      "daily_sales_rate": 3.5,
      "days_until_empty": 0.9,
      "recommended_order_qty": 24,
      "unit_cost_vnd": 8000,
      "line_total_vnd": 192000,
      "urgency": "critical",
      "reasoning": "Brief Vietnamese shop context reason"
    }
  ],
  "total_order_cost_vnd": 560000,
  "total_order_cost_usd": 22.4,
  "supplier_message_vi": "Full Vietnamese message ready to send via Zalo",
  "summary": "One sentence summary in English"
}`;

export async function generateRestockFromTrends(): Promise<RestockRecommendation> {
  const trends = getProductTrends();

  const needsRestock = trends.filter(
    (t) => t.status === "critical" || t.status === "low"
  );

  if (needsRestock.length === 0) {
    return {
      urgent_items: [],
      total_order_cost_vnd: 0,
      total_order_cost_usd: 0,
      supplier_message_vi: "",
      summary: "All stock levels are healthy. No restocking needed.",
    };
  }

  const stockSummary = needsRestock
    .map(
      (t) =>
        `- ${t.name}: ${t.currentStock} units left, selling ${t.dailySalesRate}/day, empty in ${t.daysUntilEmpty} days (${t.status})`
    )
    .join("\n");

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("No API key set. Add your OpenRouter key in Settings.");
  }

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
      max_tokens: 1500,
      messages: [
        { role: "system", content: RESTOCK_PROMPT },
        {
          role: "user",
          content: `Here are the products that need restocking:\n\n${stockSummary}\n\nGenerate a restock order and Zalo message.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Low stock agent error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const cleaned = text.replace(/```json\s?/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse restock response:", cleaned);
    throw new Error("Restock agent returned invalid JSON");
  }
}

export function getLowStockCount(): { critical: number; low: number; ok: number } {
  const trends = getProductTrends();
  return {
    critical: trends.filter((t) => t.status === "critical").length,
    low: trends.filter((t) => t.status === "low").length,
    ok: trends.filter((t) => t.status === "ok").length,
  };
}
