import { RESTOCK_PROMPT } from "../constants/config";
import { callGeminiJSON } from "./geminiAPI";
import { getScans, getDepletionData } from "./scanHistory";
import { getRestockThreshold } from "./settingsStore";
import type { RestockItem } from "../types";

interface LowStockItem {
  name: string;
  currentStock: number;
  avgPerDay: number;
  status: string;
}

export async function generateRestockOrder(): Promise<RestockItem[]> {
  const threshold = getRestockThreshold();

  // Try depletion data first (needs 2+ snapshots)
  let lowStock: LowStockItem[] = getDepletionData()
    .filter((d) => d.currentStock <= threshold)
    .map((d) => ({ name: d.name, currentStock: d.currentStock, avgPerDay: d.avgPerDay, status: d.status }));

  // Fallback: use latest scan if no depletion data
  if (lowStock.length === 0) {
    const scans = getScans();
    if (scans.length === 0) throw new Error("Chua co du lieu quet. Hay quet hang hoa truoc.");
    const latest = scans[0];
    lowStock = latest.items
      .filter((i) => i.total <= threshold)
      .map((i) => ({ name: i.name, currentStock: i.total, avgPerDay: 1, status: i.total <= Math.floor(threshold * 0.3) ? "critical" : "low" }));
  }

  if (lowStock.length === 0) throw new Error("Tat ca san pham deu on dinh — khong can nhap hang.");

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
    return lowStock.map((d) => ({
      name: d.name,
      currentStock: d.currentStock,
      suggestedQty: Math.max(1, Math.ceil(d.avgPerDay * 7)),
      unitPrice: 10000,
      qty: Math.max(1, Math.ceil(d.avgPerDay * 7)),
    }));
  }
}
