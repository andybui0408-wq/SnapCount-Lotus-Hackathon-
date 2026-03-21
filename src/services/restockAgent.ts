import { RESTOCK_PROMPT } from "../constants/config";
import { callGeminiJSON } from "./geminiAPI";
import { getDepletionData } from "./scanHistory";
import type { RestockItem } from "../types";

export async function generateRestockOrder(): Promise<RestockItem[]> {
  const depletion = getDepletionData();
  const lowStock = depletion.filter((d) => d.status !== "healthy");
  const context = JSON.stringify(lowStock);

  try {
    const parsed = await callGeminiJSON<{ items: RestockItem[] }>([
      {
        role: "user",
        content: `${RESTOCK_PROMPT}\n\nLow stock items:\n${context}`,
      },
    ]);
    return (parsed.items || []).map((item) => ({
      ...item,
      qty: item.suggestedQty,
    }));
  } catch {
    // Fallback: generate locally
    return lowStock.map((d) => ({
      name: d.name,
      currentStock: d.currentStock,
      suggestedQty: Math.max(1, Math.ceil(d.avgPerDay * 7)),
      unitPrice: 10000,
      qty: Math.max(1, Math.ceil(d.avgPerDay * 7)),
    }));
  }
}
