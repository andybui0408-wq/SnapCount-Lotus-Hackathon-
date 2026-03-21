// Rule-based restock logic with keyword-based pricing for Florence-2 labels

import type { MergedResult, RestockOrder, RestockItem } from "../types";

// Keyword → VND price. Searched in item name + OCR text.
const KEYWORD_PRICES: Record<string, number> = {
  "coca-cola": 8000, "pepsi": 8000, "fanta": 7000, "sprite": 7000, "7up": 7000,
  "monster": 15000, "red bull": 15000, "beer": 12000, "wine": 50000,
  "water": 5000, "juice": 10000, "milk": 15000, "coffee": 12000, "tea": 8000,
  "soda": 7000, "energy": 15000,
  "chips": 10000, "cookies": 12000, "chocolate": 15000, "candy": 5000,
  "noodle": 5000, "ramen": 5000, "rice": 15000, "bread": 8000,
  "can": 8000, "bottle": 10000, "box": 15000, "bag": 12000,
  "cup": 5000, "bowl": 12000, "glass": 15000,
  "soap": 8000, "shampoo": 20000, "toothpaste": 12000, "toothbrush": 6000,
  "phone": 500000, "laptop": 5000000, "keyboard": 120000, "mouse": 50000,
};
const DEFAULT_PRICE = 10000;

function estimatePrice(itemName: string, ocrLabels?: string[]): number {
  const searchText = `${itemName} ${(ocrLabels ?? []).join(" ")}`.toLowerCase();
  for (const [keyword, price] of Object.entries(KEYWORD_PRICES)) {
    if (searchText.includes(keyword)) return price;
  }
  return DEFAULT_PRICE;
}

const DRINK_KEYWORDS = ["can", "bottle", "cup", "glass", "drink", "cola", "pepsi", "fanta", "beer", "wine", "juice", "water", "soda", "coffee", "tea", "energy", "milk"];

function isDrinkItem(name: string): boolean {
  const lower = name.toLowerCase();
  return DRINK_KEYWORDS.some((k) => lower.includes(k));
}

function getUrgency(stock: number): "critical" | "low" | "restock" | "adequate" {
  if (stock <= 2) return "critical";
  if (stock <= 5) return "low";
  if (stock <= 10) return "restock";
  return "adequate";
}

function getReorderQty(stock: number, name: string): number {
  const urgency = getUrgency(stock);
  if (urgency === "adequate") return 0;
  const drink = isDrinkItem(name);
  if (urgency === "critical") return drink ? 24 : 10;
  if (urgency === "low") return drink ? 12 : 5;
  return drink ? 6 : 5;
}

function getReason(stock: number): string {
  const urgency = getUrgency(stock);
  if (urgency === "critical") return `Only ${stock} remaining — immediate reorder needed`;
  if (urgency === "low") return `${stock} in stock — running low, reorder soon`;
  if (urgency === "restock") return `${stock} in stock — restock when convenient`;
  return `${stock} in stock — adequate supply`;
}

export function generateLocalRestock(scanResult: MergedResult): RestockOrder {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const orderId = `PO-${dateStr}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;

  const restockItems: RestockItem[] = [];

  for (const item of scanResult.items) {
    const stock = item.totalEstimate;
    const urgency = getUrgency(stock);
    if (urgency === "adequate") continue;

    const reorderQty = getReorderQty(stock, item.name);
    const unitCost = estimatePrice(item.name, item.ocrLabels);

    restockItems.push({
      name: item.name,
      current_stock: stock,
      reorder_quantity: reorderQty,
      estimated_unit_cost_vnd: unitCost,
      estimated_line_total_vnd: reorderQty * unitCost,
      urgency,
      reason: getReason(stock),
    });
  }

  const urgencyOrder = { critical: 0, low: 1, restock: 2, adequate: 3 };
  restockItems.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  const totalItems = restockItems.reduce((s, i) => s + i.reorder_quantity, 0);
  const totalCostVnd = restockItems.reduce((s, i) => s + i.estimated_line_total_vnd, 0);
  const totalCostUsd = Math.round((totalCostVnd / 25000) * 100) / 100;

  const topItems = scanResult.items.slice(0, 3).map((i) => i.name).join(", ");

  return {
    order_id: orderId,
    generated_at: now.toISOString(),
    store_context: `Inventory area with ${topItems}`,
    items: restockItems,
    total_items_to_order: totalItems,
    estimated_total_cost_vnd: totalCostVnd,
    estimated_total_cost_usd: totalCostUsd,
    summary: restockItems.length > 0
      ? `${restockItems.length} items need restocking. ${restockItems.filter((i) => i.urgency === "critical").length} critical.`
      : "All items are adequately stocked.",
    recommended_action: restockItems.some((i) => i.urgency === "critical")
      ? "Place order immediately — critical items running out."
      : restockItems.length > 0
      ? "Schedule restock within the week."
      : "No action needed — inventory levels are healthy.",
  };
}
