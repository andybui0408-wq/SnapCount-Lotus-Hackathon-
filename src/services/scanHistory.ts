import type { ScanResult, InventorySnapshot, Supplier } from "../types";

const SCANS_KEY = "countr_scans";
const SNAPSHOTS_KEY = "countr_snapshots";
const SUPPLIERS_KEY = "countr_suppliers";
const SEEDED_KEY = "countr_seeded";
const PRICES_KEY = "countr_prices";

// ── CRUD ────────────────────────────────────────────────────────────

export function getScans(): ScanResult[] {
  const raw = localStorage.getItem(SCANS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveScan(scan: ScanResult): void {
  const scans = getScans();
  scans.unshift(scan);
  localStorage.setItem(SCANS_KEY, JSON.stringify(scans));
  updateSnapshot(scan);
}

export function clearScans(): void {
  localStorage.removeItem(SCANS_KEY);
}

export function clearAllData(): void {
  localStorage.removeItem(SCANS_KEY);
  localStorage.removeItem(SNAPSHOTS_KEY);
  localStorage.removeItem(SUPPLIERS_KEY);
  localStorage.removeItem(SEEDED_KEY);
  localStorage.removeItem(PRICES_KEY);
  localStorage.removeItem("countr_catalog");
  localStorage.removeItem("countr_vocabulary");
}

export function getSnapshots(): InventorySnapshot[] {
  const raw = localStorage.getItem(SNAPSHOTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function updateSnapshot(scan: ScanResult): void {
  const snapshots = getSnapshots();
  const today = formatDate(new Date());
  let existing = snapshots.find((s) => s.date === today);
  if (!existing) {
    existing = { date: today, timestamp: Date.now(), products: {} };
    snapshots.push(existing);
  }
  for (const item of scan.items) {
    existing.products[item.name] = item.total;
  }
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

// ── Suppliers ───────────────────────────────────────────────────────

export function getSuppliers(): Supplier[] {
  const raw = localStorage.getItem(SUPPLIERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSuppliers(suppliers: Supplier[]): void {
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
}

// ── Trends ──────────────────────────────────────────────────────────

export function getProductTrends(): { labels: string[]; datasets: { name: string; data: number[] }[] } {
  const snapshots = getSnapshots().slice(-7);
  const labels = snapshots.map((s) => s.date);
  const allProducts = new Set<string>();
  for (const s of snapshots) {
    for (const p of Object.keys(s.products)) allProducts.add(p);
  }
  const datasets = Array.from(allProducts).map((name) => ({
    name,
    data: snapshots.map((s) => s.products[name] ?? 0),
  }));
  return { labels, datasets };
}

export function getDepletionData(): Array<{
  name: string;
  currentStock: number;
  change: number;
  avgPerDay: number;
  daysLeft: number;
  status: "critical" | "low" | "healthy";
}> {
  const snapshots = getSnapshots().slice(-7);
  if (snapshots.length < 2) return [];

  const allProducts = new Set<string>();
  for (const s of snapshots) {
    for (const p of Object.keys(s.products)) allProducts.add(p);
  }

  return Array.from(allProducts).map((name) => {
    const values = snapshots.map((s) => s.products[name] ?? 0);
    const current = values[values.length - 1];
    const first = values[0];
    const change = current - first;
    const days = snapshots.length - 1;
    const avgPerDay = days > 0 ? Math.abs(change) / days : 0;
    const daysLeft = avgPerDay > 0 ? current / avgPerDay : 999;
    const status: "critical" | "low" | "healthy" =
      daysLeft <= 1 ? "critical" : daysLeft <= 3 ? "low" : "healthy";
    return {
      name,
      currentStock: current,
      change,
      avgPerDay: Math.round(avgPerDay * 10) / 10,
      daysLeft: Math.round(daysLeft * 10) / 10,
      status,
    };
  });
}

/** Remove a specific product from all snapshot history */
export function removeProductFromHistory(productName: string): void {
  const snapshots = getSnapshots();
  for (const snap of snapshots) {
    delete snap.products[productName];
  }
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}
