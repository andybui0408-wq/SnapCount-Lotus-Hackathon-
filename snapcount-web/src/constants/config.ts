export const IMAGE_MAX_SIZE = 1024;

export const FLORENCE_SERVER_URL = "http://localhost:8000";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const VISION_MODEL = "google/gemini-2.5-flash";

export function getApiKey(): string {
  return localStorage.getItem("snapcount_openrouter_key") || "";
}

export const COLORS = {
  background: "#0a0f0d",
  surface: "#0d1a14",
  border: "#1a2722",
  accent: "#059669",
  accentLight: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  info: "#60a5fa",
  textPrimary: "#e2e8e0",
  textSecondary: "#6b8f7b",
} as const;
