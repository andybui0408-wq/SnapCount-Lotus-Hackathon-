import { useMemo } from "react";
import { getSnapshots } from "../services/scanHistory";

interface StockBarItem {
  name: string;
  current: number;
  maxHistorical: number;
  fillPct: number;
  status: "critical" | "low" | "healthy";
}

export default function StockBars() {
  const items = useMemo<StockBarItem[]>(() => {
    const snapshots = getSnapshots();
    if (snapshots.length === 0) return [];

    const allProducts = new Set<string>();
    for (const s of snapshots) {
      for (const p of Object.keys(s.products)) allProducts.add(p);
    }

    return Array.from(allProducts)
      .map((name) => {
        const values = snapshots.map((s) => s.products[name] ?? 0);
        const current = values[values.length - 1];
        const maxHistorical = Math.max(...values, 1);
        const fillPct = Math.round((current / maxHistorical) * 100);

        // Determine status based on fill percentage
        const status: StockBarItem["status"] =
          fillPct <= 15 ? "critical" : fillPct <= 40 ? "low" : "healthy";

        return { name, current, maxHistorical, fillPct, status };
      })
      .sort((a, b) => a.fillPct - b.fillPct); // most empty first
  }, []);

  if (items.length === 0) {
    return <p className="text-secondary">Chua co du lieu ton kho.</p>;
  }

  const statusLabel: Record<string, string> = {
    critical: "Can nhap gap",
    low: "Sap het",
    healthy: "On dinh",
  };

  return (
    <div className="stock-bars">
      {items.map((item) => {
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
