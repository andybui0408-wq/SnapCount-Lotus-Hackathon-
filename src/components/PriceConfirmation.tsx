import { useState, useMemo } from "react";
import { getPrefilledPrice, savePrices } from "../services/priceStore";
import type { MergedItem } from "../types";

interface Props {
  items: MergedItem[];
  onConfirm: () => void;
}

export default function PriceConfirmation({ items, onConfirm }: Props) {
  const prefilled = useMemo(() => {
    return items.map(item => {
      const { price, source } = getPrefilledPrice(
        item.name,
        item.estimated_price || 0,
      );
      return { name: item.name, price, source };
    });
  }, [items]);

  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of prefilled) {
      map[p.name] = p.price;
    }
    return map;
  });

  const hasNewProducts = prefilled.some(p => p.source === "ai");

  const handleConfirm = () => {
    const priceList = items.map(item => ({
      name: item.name,
      sellPrice: prices[item.name] || 0,
    }));
    savePrices(priceList);
    onConfirm();
  };

  return (
    <div className="price-confirm">
      <div className="price-confirm-header">
        <span className="price-confirm-title">Sell Price</span>
        <span className="price-confirm-subtitle">
          {hasNewProducts ? "Confirm prices to see revenue" : "Prices saved from last time"}
        </span>
      </div>
      <div className="price-confirm-list">
        {items.map((item) => {
          const pre = prefilled.find(p => p.name === item.name);
          return (
            <div key={item.name} className="price-confirm-row">
              <div className="price-confirm-name">
                {item.name}
                {pre?.source === "ai" && <span className="price-confirm-ai">AI</span>}
              </div>
              <div className="price-input-wrap">
                <input
                  type="number"
                  className="price-input"
                  step="1000"
                  min="0"
                  value={prices[item.name] || ""}
                  onChange={(e) => setPrices(prev => ({
                    ...prev,
                    [item.name]: parseInt(e.target.value) || 0,
                  }))}
                />
                <span className="price-suffix">đ</span>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn btn-confirm-prices" onClick={handleConfirm}>
        Confirm Prices
      </button>
    </div>
  );
}
