import { useState, useMemo } from "react";
import { getPrices, savePrices } from "../services/revenueEstimator";
import type { ProductPrice } from "../services/revenueEstimator";
import { getSnapshots } from "../services/scanHistory";

interface Props {
  onClose: () => void;
}

export default function PriceEditor({ onClose }: Props) {
  // Get all known product names from snapshots
  const productNames = useMemo(() => {
    const snapshots = getSnapshots();
    const names = new Set<string>();
    for (const s of snapshots) {
      for (const p of Object.keys(s.products)) names.add(p);
    }
    return Array.from(names).sort();
  }, []);

  const existingPrices = useMemo(() => getPrices(), []);

  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of existingPrices) map[p.name] = p.sellPrice;
    return map;
  });

  const handleSave = () => {
    const result: ProductPrice[] = productNames
      .filter((name) => prices[name] && prices[name] > 0)
      .map((name) => ({ name, sellPrice: prices[name] }));
    savePrices(result);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal price-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Product Prices</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="price-list">
            {productNames.map((name) => (
              <div key={name} className="price-row">
                <span className="price-product-name">{name}</span>
                <div className="price-input-wrap">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0đ"
                    value={prices[name] || ""}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [name]: parseInt(e.target.value) || 0 }))
                    }
                    className="price-input"
                  />
                  <span className="price-suffix">đ</span>
                </div>
              </div>
            ))}
          </div>
          {productNames.length === 0 && (
            <p className="text-secondary">Scan inventory first to get your product list.</p>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            Save Prices
          </button>
        </div>
      </div>
    </div>
  );
}
