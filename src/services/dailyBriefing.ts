import { callGemini } from "./geminiAPI";
import { getSnapshots, getDepletionData } from "./scanHistory";

const CACHE_KEY = "countr_briefing_cache";
const CACHE_TTL = 3600000; // 1 hour

interface BriefingCache {
  text: string;
  timestamp: number;
}

const VIETNAMESE_WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function formatViDate(d: Date): string {
  const weekday = VIETNAMESE_WEEKDAYS[d.getDay()];
  return `${weekday} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export async function getDailyBriefing(): Promise<string> {
  // Check cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const c: BriefingCache = JSON.parse(cached);
    if (Date.now() - c.timestamp < CACHE_TTL) return c.text;
  }

  const snapshots = getSnapshots().slice(-7);
  if (snapshots.length < 2) return "Chưa có đủ dữ liệu. Quét hàng tồn kho để bắt đầu theo dõi.";

  const depletion = getDepletionData();
  if (depletion.length === 0) return "Chưa có dữ liệu xu hướng.";

  // Build inventory data string
  const inventoryLines = depletion.map(
    (d) => `${d.name}: còn ${d.currentStock}, tiêu thụ ${d.avgPerDay}/ngày, còn ~${d.daysLeft} ngày`,
  );

  // Build trend data string
  const trendLines = depletion.map((d) => {
    const values = snapshots.map((s) => s.products[d.name] ?? 0);
    return `${d.name}: [${values.join(", ")}]`;
  });

  const today = formatViDate(new Date());

  const prompt = `You are an AI inventory assistant for a Vietnamese convenience store owner. Speak to them directly in Vietnamese, warmly and conversationally — like a trusted employee giving a morning report.

Here is their current inventory data:
${inventoryLines.join("\n")}

Here are the 7-day stock trends (product: [day1, day2, ..., today]):
${trendLines.join("\n")}

Today's date: ${today}

Write a SHORT briefing (3-5 sentences max) in Vietnamese that tells them:
1. What's running out FIRST — name the products and how many are left
2. Which product is selling the FASTEST this week
3. A specific action deadline: "Đặt hàng trước [weekday] nếu không [day] sẽ hết [product]"
   Calculate the actual day it will run out based on the daily consumption rate.

Rules:
- Write in casual Vietnamese (use "anh/chị ơi" or "anh ơi")
- Use real product names from the data
- Be specific with numbers: "còn 3 lon" not "sắp hết"
- Include the ORDER DEADLINE — the day they must order by (run-out date minus 1 day for delivery)
- Keep it under 5 sentences. No bullet points. Just flowing text like a person talking.
- Do NOT include any JSON or markdown formatting.`;

  const text = await callGemini([{ role: "user", content: prompt }]);

  // Cache the result
  localStorage.setItem(CACHE_KEY, JSON.stringify({ text, timestamp: Date.now() } as BriefingCache));

  return text;
}

export function clearBriefingCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
