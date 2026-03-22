interface ProductPrice {
  name: string;
  sellPrice: number;
}

const STORAGE_KEY = "countr_prices";

export function getPrices(): ProductPrice[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getPrice(productName: string): number | null {
  const prices = getPrices();
  const found = prices.find(p => p.name.toLowerCase() === productName.toLowerCase());
  return found?.sellPrice ?? null;
}

export function savePrices(prices: ProductPrice[]): void {
  const existing = getPrices();
  const merged = new Map(existing.map(p => [p.name.toLowerCase(), p]));
  for (const p of prices) {
    if (p.sellPrice > 0) {
      merged.set(p.name.toLowerCase(), p);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...merged.values()]));
}

export function removePrice(productName: string): void {
  const prices = getPrices().filter(p => p.name.toLowerCase() !== productName.toLowerCase());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
}

export function getPrefilledPrice(
  productName: string,
  geminiEstimate: number,
): { price: number; source: "saved" | "ai" } {
  const saved = getPrice(productName);
  if (saved !== null) return { price: saved, source: "saved" };
  return { price: geminiEstimate, source: "ai" };
}
