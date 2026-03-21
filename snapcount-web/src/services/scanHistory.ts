// src/services/scanHistory.ts

export interface ScanRecord {
  id: string;
  timestamp: string;
  thumbnailUrl: string;
  results: {
    items: Array<{
      name: string;
      count: number;
      ocrText: string;
    }>;
    totalObjects: number;
    occlusionDelta: number;
  };
}

const STORAGE_KEY = "snapcount_scans";
const MAX_RECORDS = 30;

export function saveRecord(record: ScanRecord): void {
  const history = getHistory();
  history.push(record);
  if (history.length > MAX_RECORDS) {
    history.splice(0, history.length - MAX_RECORDS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getHistory(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestRecord(): ScanRecord | null {
  const history = getHistory();
  return history.length > 0 ? history[history.length - 1] : null;
}

export function getProductHistory(
  productName: string
): Array<{ date: string; count: number }> {
  return getHistory()
    .map((record) => {
      const item = record.results.items.find(
        (i) => i.name.toLowerCase().includes(productName.toLowerCase())
      );
      return {
        date: record.timestamp.split("T")[0],
        count: item?.count ?? 0,
      };
    })
    .filter((entry) => entry.count > 0);
}

export function getAllProductNames(): string[] {
  const names = new Set<string>();
  for (const record of getHistory()) {
    for (const item of record.results.items) {
      names.add(item.name);
    }
  }
  return Array.from(names);
}

export function getProductTrends(): Array<{
  name: string;
  dataPoints: Array<{ date: string; count: number }>;
  currentStock: number;
  dailySalesRate: number;
  daysUntilEmpty: number;
  status: "critical" | "low" | "ok";
}> {
  const history = getHistory();
  if (history.length === 0) return [];

  const productMap = new Map<string, Array<{ date: string; count: number }>>();

  for (const record of history) {
    const date = record.timestamp.split("T")[0];
    for (const item of record.results.items) {
      if (!productMap.has(item.name)) {
        productMap.set(item.name, []);
      }
      productMap.get(item.name)!.push({ date, count: item.count });
    }
  }

  const trends = [];
  for (const [name, dataPoints] of productMap) {
    const sorted = dataPoints.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const currentStock = sorted[sorted.length - 1].count;
    const firstCount = sorted[0].count;
    const daySpan = Math.max(1, sorted.length - 1);
    const totalSold = Math.max(0, firstCount - currentStock);
    const dailySalesRate = Math.round((totalSold / daySpan) * 10) / 10;
    const daysUntilEmpty =
      dailySalesRate > 0
        ? Math.round((currentStock / dailySalesRate) * 10) / 10
        : 999;

    let status: "critical" | "low" | "ok" = "ok";
    if (currentStock <= 3 || daysUntilEmpty <= 2) status = "critical";
    else if (currentStock <= 8 || daysUntilEmpty <= 5) status = "low";

    trends.push({
      name,
      dataPoints: sorted,
      currentStock,
      dailySalesRate,
      daysUntilEmpty,
      status,
    });
  }

  return trends.sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty);
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// --- DEMO DATA ---

export function seedDemoData(): void {
  if (getHistory().length > 0) return;

  const products = [
    { name: "Coca-Cola can", counts: [24, 22, 18, 15, 12, 8, 5], ocr: "Coca-Cola" },
    { name: "Fanta Orange bottle", counts: [18, 18, 16, 14, 11, 9, 7], ocr: "Fanta" },
    { name: "Mì Hảo Hảo tôm chua cay", counts: [30, 28, 25, 20, 16, 10, 4], ocr: "Hảo Hảo" },
    { name: "Nước mắm Chin-Su", counts: [12, 12, 11, 11, 10, 10, 9], ocr: "Chin-Su" },
    { name: "Trà xanh C2", counts: [20, 17, 14, 12, 9, 6, 3], ocr: "C2" },
    { name: "Monster Energy", counts: [10, 9, 8, 7, 5, 3, 1], ocr: "Monster" },
    { name: "Bia Tiger", counts: [36, 34, 30, 28, 24, 20, 18], ocr: "Tiger" },
    { name: "Bánh mì Kinh Đô", counts: [15, 13, 10, 8, 5, 3, 1], ocr: "Kinh Đô" },
  ];

  const records: ScanRecord[] = [];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(8, 30, 0, 0);

    const dayIndex = 6 - dayOffset;

    records.push({
      id: crypto.randomUUID(),
      timestamp: date.toISOString(),
      thumbnailUrl: "",
      results: {
        items: products.map((p) => ({
          name: p.name,
          count: p.counts[dayIndex],
          ocrText: p.ocr,
        })),
        totalObjects: products.reduce((sum, p) => sum + p.counts[dayIndex], 0),
        occlusionDelta: Math.floor(Math.random() * 4) + 1,
      },
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
