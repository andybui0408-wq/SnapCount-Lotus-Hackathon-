import { useMemo } from "react";
import { getSnapshots } from "../services/scanHistory";

interface StockBarItem {
  name: string;
  current: number;
  maxHistorical: number;
  fillPct: number;
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
        return { name, current, maxHistorical, fillPct };
      })
      .sort((a, b) => a.fillPct - b.fillPct); // most empty first
  }, []);

  if (items.length === 0) {
    return <p className="text-secondary">Chưa có dữ liệu tồn kho.</p>;
  }

  return (
    <div className="stock-bars">
      {items.map((item) => {
        const barColor =
          item.fillPct <= 15 ? "var(--black)" :
          item.fillPct <= 40 ? "var(--charcoal)" :
          "var(--stone)";

        return (
          <div key={item.name} className="stock-bar-item">
            <div className="stock-bar-header">
              <span className="stock-bar-name">{item.name}</span>
              <span className="stock-bar-qty">{item.current}</span>
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
