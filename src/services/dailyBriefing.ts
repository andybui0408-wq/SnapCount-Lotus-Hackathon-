import { callGemini } from "./geminiAPI";
import { getScans } from "./scanHistory";
import { getRestockThreshold } from "./settingsStore";

const CACHE_KEY = "countr_briefing_cache";
const CACHE_TTL = 600000; // 10 minutes

interface BriefingCache {
  text: string;
  timestamp: number;
  scanCount: number;
}

export async function getDailyBriefing(): Promise<string> {
  const scans = getScans();
  const scanCount = scans.length;

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const c: BriefingCache = JSON.parse(cached);
    if (Date.now() - c.timestamp < CACHE_TTL && c.scanCount === scanCount) {
      return c.text;
    }
  }

  if (scans.length === 0) return "Chua co du lieu. Quet hang hoa de bat dau theo doi.";

  const threshold = getRestockThreshold();
  const latestScan = scans[0];

  const products = latestScan.items.map((i) => `${i.name}: ${i.total} units`);
  const urgentItems = latestScan.items.filter((i) => i.total <= threshold);
  const criticalItems = latestScan.items.filter((i) => i.total <= Math.floor(threshold * 0.3));

  const prompt = `You are a friendly Vietnamese store inventory assistant. Be conversational and brief.

CURRENT STOCK:
${products.join("\n")}
Total: ${latestScan.total_items} items, ${latestScan.items.length} product types

Restock threshold: ${threshold} units
${urgentItems.length > 0 ? `NEEDS RESTOCK (≤${threshold}): ${urgentItems.map((i) => `${i.name} (${i.total})`).join(", ")}` : "All products above restock threshold."}
${criticalItems.length > 0 ? `CRITICAL (≤${Math.floor(threshold * 0.3)}): ${criticalItems.map((i) => `${i.name} (${i.total})`).join(", ")}` : ""}

Write a SHORT briefing with EXACTLY this format — each item on its own line:

Line 1: One short sentence — total items and how many products need restocking
Line 2: (blank)
${criticalItems.length > 0 ? 'For each critical product: "⚠️ [Product]: [X] con lai — can nhap hang ngay"\n' : ""}${urgentItems.length > 0 ? 'For each low-stock product: "📦 [Product]: [X] con lai — nen nhap them"\n' : ""}Line: (blank)
Last line: One short actionable tip

Rules:
- Mix Vietnamese naturally
- NO store name, NO scan counts, NO snapshot counts
- Each warning on its own line
- Keep it short and scannable
- Plain text only with emoji prefixes for warnings
- Conversational friendly tone`;

  const text = await callGemini([{ role: "user", content: prompt }]);

  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ text, timestamp: Date.now(), scanCount } as BriefingCache),
  );

  return text;
}

export function clearBriefingCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
