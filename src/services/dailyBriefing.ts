import { callGemini } from "./geminiAPI";
import { getSnapshots, getDepletionData } from "./scanHistory";

const CACHE_KEY = "countr_briefing_cache";
const CACHE_TTL = 3600000; // 1 hour

interface BriefingCache {
  text: string;
  timestamp: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getDailyBriefing(): Promise<string> {
  // Check cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const c: BriefingCache = JSON.parse(cached);
    if (Date.now() - c.timestamp < CACHE_TTL) return c.text;
  }

  const snapshots = getSnapshots().slice(-7);
  if (snapshots.length < 2) return "Not enough data yet. Scan your inventory to start tracking.";

  const depletion = getDepletionData();
  if (depletion.length === 0) return "No trend data available.";

  // Build concise inventory summary
  const critical = depletion.filter(d => d.status === "critical");
  const low = depletion.filter(d => d.status === "low");

  const inventoryLines = depletion.map(
    (d) => `${d.name}: ${d.currentStock} left, ${d.avgPerDay}/day, ~${d.daysLeft} days remaining`,
  );

  const today = new Date();
  const dateStr = `${WEEKDAYS[today.getDay()]}, ${today.getMonth() + 1}/${today.getDate()}`;

  const prompt = `You are a concise inventory assistant. Today: ${dateStr}.

Stock data:
${inventoryLines.join("\n")}

${critical.length > 0 ? `CRITICAL (≤1 day): ${critical.map(d => d.name).join(", ")}` : ""}
${low.length > 0 ? `LOW (≤3 days): ${low.map(d => d.name).join(", ")}` : ""}

Write a brief inventory alert in 2-3 short sentences:
- Start with any URGENT warnings (items running out within 1-2 days)
- State exactly when to restock (specific day)
- Keep it direct and actionable — no greetings, no filler
- Use format: "⚠️ [Product]: [X] left, restock by [day]." for critical items
- End with one line on fastest-selling item this week
- Plain text only, no markdown`;

  const text = await callGemini([{ role: "user", content: prompt }]);

  // Cache the result
  localStorage.setItem(CACHE_KEY, JSON.stringify({ text, timestamp: Date.now() } as BriefingCache));

  return text;
}

export function clearBriefingCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
