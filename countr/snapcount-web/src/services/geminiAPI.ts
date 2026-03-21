import { OPENROUTER_URL, OPENROUTER_API_KEY, GEMINI_MODEL } from "../constants/config";

function stripBackticks(text: string): string {
  return text.replace(/```json\s?/g, "").replace(/```/g, "").trim();
}

export async function callGemini(messages: unknown[]): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://snapcount.app",
      "X-Title": "SnapCount",
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      max_tokens: 2048,
      messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No response from Gemini");
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  return stripBackticks(text);
}

export async function callGeminiJSON<T>(messages: unknown[]): Promise<T> {
  const text = await callGemini(messages);
  return JSON.parse(text) as T;
}
