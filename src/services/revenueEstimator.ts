import { getSnapshots } from "./scanHistory";

const PRICES_KEY = "countr_prices";

export interface ProductPrice {
  name: string;
  sellPrice: number; // VND per unit
}

export interface RevenueResult {
  weeklyRevenue: number;
  dailyAvgRevenue: number;
  topSeller: { name: string; unitsSold: number; revenue: number };
  perProduct: { name: string; unitsSold: number; revenue: number }[];
}

export function getPrices(): ProductPrice[] {
  const raw = localStorage.getItem(PRICES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function savePrices(prices: ProductPrice[]): void {
  localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
}

export function hasPrices(): boolean {
  return getPrices().length > 0;
}

export function estimateRevenue(): RevenueResult | null {
  const prices = getPrices();
  if (prices.length === 0) return null;

  const snapshots = getSnapshots().slice(-7);
  if (snapshots.length < 2) return null;

  const perProduct: { name: string; unitsSold: number; revenue: number }[] = [];
  let totalRevenue = 0;

  const allProducts = new Set<string>();
  for (const s of snapshots) {
    for (const p of Object.keys(s.products)) allProducts.add(p);
  }

  for (const product of allProducts) {
    const values = snapshots.map((s) => s.products[product] ?? 0);
    const first = values[0];
    const last = values[values.length - 1];
    const unitsSold = Math.max(0, first - last);
    const price = prices.find((p) => p.name === product)?.sellPrice || 0;
    const revenue = unitsSold * price;
    perProduct.push({ name: product, unitsSold, revenue });
    totalRevenue += revenue;
  }

  perProduct.sort((a, b) => b.revenue - a.revenue);
  const days = 7;

  return {
    weeklyRevenue: totalRevenue,
    dailyAvgRevenue: Math.round(totalRevenue / days),
    topSeller: perProduct[0] || { name: "—", unitsSold: 0, revenue: 0 },
    perProduct,
  };
}
