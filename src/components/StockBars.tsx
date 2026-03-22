import { useMemo } from "react";
import { getScans, getSnapshots } from "../services/scanHistory";
import { getRestockThreshold } from "../services/settingsStore";

interface StockBarItem {
  name: string;
  current: number;
  maxHistorical: number;
  fillPct: number;
  status: "critical" | "low" | "healthy";
}

interface Props {
  sortBy?: "name" | "urgency" | "stock";
  filterStatus?: "all" | "critical" | "low" | "healthy";
}

export default function StockBars({ sortBy = "urgency", filterStatus = "all" }: Props) {
  const threshold = getRestockThreshold();

  const items = useMemo<StockBarItem[]>(() => {
    const snapshots = getSnapshots();

    // If no snapshots, use latest scan
    if (snapshots.length === 0) {
      const scans = getScans();
      if (scans.length === 0) return [];
      const latest = scans[0];
      return latest.items.map((item) => {
        const maxRef = Math.max(threshold * 2, item.total, 1);
        const fillPct = Math.min(100, Math.round((item.total / maxRef) * 100));
        const status: StockBarItem["status"] =
          item.total <= Math.floor(threshold * 0.3) ? "critical" :
          item.total <= threshold ? "low" : "healthy";
        return { name: item.name, current: item.total, maxHistorical: maxRef, fillPct, status };
      });
    }

    const allProducts = new Set<string>();
    for (const s of snapshots) {
      for (const p of Object.keys(s.products)) allProducts.add(p);
    }

    return Array.from(allProducts).map((name) => {
      const values = snapshots.map((s) => s.products[name] ?? 0);
      const current = values[values.length - 1];
      const maxHistorical = Math.max(...values, 1);
      const fillPct = Math.round((current / maxHistorical) * 100);
      const status: StockBarItem["status"] =
        current <= Math.floor(threshold * 0.3) ? "critical" :
        current <= threshold ? "low" : "healthy";
      return { name, current, maxHistorical, fillPct, status };
    });
  }, [threshold]);

  // Filter
  const filtered = filterStatus === "all" ? items : items.filter((i) => i.status === filterStatus);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "stock") return a.current - b.current;
    const order = { critical: 0, low: 1, healthy: 2 };
    return order[a.status] - order[b.status] || a.current - b.current;
  });

  if (sorted.length === 0) {
    return <p className="text-secondary">Khong co san pham phu hop.</p>;
  }

  const statusLabel: Record<string, string> = {
    critical: "Can nhap gap",
    low: "Sap het",
    healthy: "On dinh",
  };

  return (
    <div className="stock-bars">
      {sorted.map((item) => {
        const barColor =
          item.status === "critical" ? "var(--black)" :
          item.status === "low" ? "var(--charcoal)" :
          "var(--stone)";

        return (
          <div key={item.name} className="stock-bar-item">
            <div className="stock-bar-header">
              <span className="stock-bar-name">{item.name}</span>
              <div className="stock-bar-right">
                <span className={`stock-bar-tag stock-bar-tag-${item.status}`}>
                  {statusLabel[item.status]}
                </span>
                <span className="stock-bar-qty">{item.current}</span>
              </div>
            </div>
            <div className="stock-bar-track">
              <div
                className="stock-bar-fill"
                style={{ width: `${Math.max(item.fillPct, 2)}%`, background: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
