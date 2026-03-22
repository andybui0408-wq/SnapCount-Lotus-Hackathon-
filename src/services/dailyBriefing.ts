import { callGemini } from "./geminiAPI";
import { getScans, getSnapshots, getDepletionData } from "./scanHistory";

const CACHE_KEY = "countr_briefing_cache";
const CACHE_TTL = 600000; // 10 minutes

interface BriefingCache {
  text: string;
  timestamp: number;
  scanCount: number; // invalidate when new scans arrive
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getDailyBriefing(): Promise<string> {
  const scans = getScans();
  const scanCount = scans.length;

  // Check cache — invalidate if new scans were added or TTL expired
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const c: BriefingCache = JSON.parse(cached);
    if (Date.now() - c.timestamp < CACHE_TTL && c.scanCount === scanCount) {
      return c.text;
    }
  }

  if (scans.length === 0) return "Chua co du lieu. Quet hang hoa de bat dau theo doi.";

  const today = new Date();
  const dateStr = `${WEEKDAYS[today.getDay()]}, ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  // Build context from latest scan + depletion trends
  const latestScan = scans[0];
  const latestDate = new Date(latestScan.timestamp);
  const latestProducts = latestScan.items.map(
    (i) => `${i.name}: ${i.total} units (${i.estimated_price ? i.estimated_price.toLocaleString() + "d" : "no price"})`,
  );

  const snapshots = getSnapshots().slice(-7);
  const depletion = getDepletionData();
  const critical = depletion.filter((d) => d.status === "critical");
  const low = depletion.filter((d) => d.status === "low");
  const healthy = depletion.filter((d) => d.status === "healthy");

  const trendLines = depletion.length > 0
    ? depletion.map(
        (d) => `${d.name}: ${d.currentStock} con lai, tieu thu ${d.avgPerDay}/ngay, con ~${d.daysLeft} ngay`,
      )
    : [];

  const prompt = `You are COUNTR., a Vietnamese store inventory assistant. Today: ${dateStr}.

LATEST SCAN (${latestDate.toLocaleDateString("vi-VN")} ${latestDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}):
${latestProducts.join("\n")}
Total: ${latestScan.total_items} items, ${latestScan.items.length} product types

${trendLines.length > 0 ? `7-DAY TRENDS:\n${trendLines.join("\n")}` : "No trend data yet (need 2+ days of scans)."}

${critical.length > 0 ? `CRITICAL (<=1 day left): ${critical.map((d) => d.name).join(", ")}` : ""}
${low.length > 0 ? `LOW STOCK (<=3 days left): ${low.map((d) => d.name).join(", ")}` : ""}
${healthy.length > 0 ? `HEALTHY: ${healthy.map((d) => d.name).join(", ")}` : ""}

Total scans recorded: ${scans.length} | Snapshots: ${snapshots.length} days

Write a brief inventory briefing with EXACTLY this format — each item on its own line:

Line 1: One-sentence overall status summary
Line 2: (blank)
${critical.length > 0 ? 'Lines for each critical item: "⚠️ [Product]: [X] con lai — can nhap hang truoc [day]"' : ""}
${low.length > 0 ? 'Lines for each low-stock item: "📦 [Product]: [X] con lai — theo doi"' : ""}
Line: (blank)
Last line: One actionable suggestion or fastest-selling product insight

Rules:
- Mix Vietnamese and product names naturally
- Each warning/announcement on its own line
- Keep each line short and scannable
- No markdown, no bullet points, no asterisks
- Plain text only with emoji prefixes for warnings`;

  const text = await callGemini([{ role: "user", content: prompt }]);

  // Cache with scan count for invalidation
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ text, timestamp: Date.now(), scanCount } as BriefingCache),
  );

  return text;
}

export function clearBriefingCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
