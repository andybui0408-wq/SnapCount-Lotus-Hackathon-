const THRESHOLD_KEY = "countr_restock_threshold";
const DEFAULT_THRESHOLD = 5;

export function getRestockThreshold(): number {
  const raw = localStorage.getItem(THRESHOLD_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_THRESHOLD;
}

export function setRestockThreshold(value: number): void {
  localStorage.setItem(THRESHOLD_KEY, JSON.stringify(Math.max(1, Math.round(value))));
}
