import { OCR_PROMPT } from "../constants/config";
import { callGemini } from "./geminiAPI";

export async function readLabelsFromImage(base64Image: string): Promise<string[]> {
  const text = await callGemini([
    {
      role: "user",
      content: [
        { type: "text", text: OCR_PROMPT },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
      ],
    },
  ]);

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // If not valid JSON array, split by common separators
    return text.split(/[,\n]/).map((s) => s.replace(/["\[\]]/g, "").trim()).filter(Boolean);
  }
  return [];
}
