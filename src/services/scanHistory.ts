import type { ScanResult, InventorySnapshot, Supplier } from "../types";

const SCANS_KEY = "snapcount_scans";
const SNAPSHOTS_KEY = "snapcount_snapshots";
const SUPPLIERS_KEY = "snapcount_suppliers";
const SEEDED_KEY = "snapcount_seeded";

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

// ── Demo data ───────────────────────────────────────────────────────

export function seedDemoData(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;

  const products: Record<string, number[]> = {
    "Coca-Cola lon": [24, 22, 18, 15, 12, 8, 5],
    "Fanta Orange": [18, 18, 16, 14, 11, 9, 7],
    "Mì Hảo Hảo": [30, 28, 25, 20, 16, 10, 4],
    "Nước mắm Chin-Su": [12, 12, 11, 11, 10, 10, 9],
    "Trà xanh C2": [20, 17, 14, 12, 9, 6, 3],
    "Monster Energy": [10, 9, 8, 7, 5, 3, 1],
    "Bia Tiger": [36, 34, 30, 28, 24, 20, 18],
    "Bánh mì Kinh Đô": [15, 13, 10, 8, 5, 3, 1],
  };

  const snapshots: InventorySnapshot[] = [];
  const now = Date.now();

  for (let i = 0; i < 7; i++) {
    const d = new Date(now - (6 - i) * 86400000);
    const prods: Record<string, number> = {};
    for (const [name, vals] of Object.entries(products)) {
      prods[name] = vals[i];
    }
    snapshots.push({
      date: formatDate(d),
      timestamp: d.getTime(),
      products: prods,
    });
  }

  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));

  const suppliers: Supplier[] = [
    { id: "s1", name: "Đại lý Minh Phát", phone: "0912345678", category: "drinks" },
    { id: "s2", name: "Hương Giang", phone: "0987654321", category: "food" },
    { id: "s3", name: "NPP Tiger", phone: "0909876543", category: "beer" },
  ];
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
  localStorage.setItem(SEEDED_KEY, "true");
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
