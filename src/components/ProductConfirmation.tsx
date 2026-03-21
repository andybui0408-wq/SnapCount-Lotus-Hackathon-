import { useState, useEffect, useCallback } from "react";
import type { MergedItem, MergedPrediction } from "../types";
import { getPrice, savePrices } from "../services/priceStore";
import { addToCatalog, getCatalog } from "../services/productCatalog";
import { saveCustomVocabulary, reloadVocabulary, cropBoxRegion } from "../services/groundingDinoAPI";

interface ConfirmableProduct {
  id: string;
  cropDataUrl: string | null;
  cropBlob: Blob | null;
  detectedName: string;
  editedName: string;
  estimatedPrice: number;
  editedPrice: number;
  count: number;
  status: "confirmed" | "edited" | "removed" | "pending";
  isNew: boolean;
  box: { x: number; y: number; width: number; height: number } | null;
}

interface Props {
  items: MergedItem[];
  predictions: MergedPrediction[];
  photoBase64: string;
  imageWidth: number;
  imageHeight: number;
  onSaved: () => void;
}

export default function ProductConfirmation({
  items,
  predictions,
  photoBase64,
  imageWidth,
  imageHeight,
  onSaved,
}: Props) {
  const [products, setProducts] = useState<ConfirmableProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Build confirmable products from items + find best prediction crop for each
  useEffect(() => {
    const catalogNames = new Set(getCatalog().map(c => c.name.toLowerCase()));

    const confirmable: ConfirmableProduct[] = items.map((item, idx) => {
      const isNew = !catalogNames.has(item.name.toLowerCase());
      const savedPrice = getPrice(item.name);

      // Find best matching prediction for this item (highest confidence)
      const matchingPreds = predictions.filter(
        p => (p.catalog_match || p.class).toLowerCase() === item.name.toLowerCase()
      );
      const bestPred = matchingPreds.sort((a, b) => b.confidence - a.confidence)[0];

      // Derive box from polygon
      let box: ConfirmableProduct["box"] = null;
      if (bestPred?.polygon?.length >= 4) {
        const xs = bestPred.polygon.map(p => p[0]);
        const ys = bestPred.polygon.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        box = {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: maxX - minX,
          height: maxY - minY,
        };
      }

      return {
        id: `prod-${idx}`,
        cropDataUrl: null,
        cropBlob: null,
        detectedName: item.name,
        editedName: item.name,
        estimatedPrice: item.estimated_price || 0,
        editedPrice: savedPrice ?? item.estimated_price ?? 0,
        count: item.total,
        status: isNew ? "pending" as const : "confirmed" as const,
        isNew,
        box,
      };
    });

    setProducts(confirmable);
  }, [items, predictions]);

  // Generate crop thumbnails from the photo
  useEffect(() => {
    if (products.length === 0 || !photoBase64) return;

    const img = new Image();
    img.onload = () => {
      products.forEach(async (product) => {
        if (!product.box || product.cropDataUrl) return;
        try {
          const blob = await cropBoxRegion(img, product.box);
          const dataUrl = URL.createObjectURL(blob);
          setProducts(prev =>
            prev.map(p =>
              p.id === product.id ? { ...p, cropDataUrl: dataUrl, cropBlob: blob } : p
            )
          );
        } catch {
          // Crop failed — leave blank
        }
      });
    };
    img.src = `data:image/jpeg;base64,${photoBase64}`;
  }, [products.length, photoBase64]);

  const updateProduct = useCallback((id: string, updates: Partial<ConfirmableProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const confirmedCount = products.filter(
    p => p.status === "confirmed" || p.status === "edited"
  ).length;

  const handleSave = async () => {
    setSaving(true);
    const confirmed = products.filter(
      p => p.status === "confirmed" || p.status === "edited"
    );

    // Step 1: Save prices
    savePrices(
      confirmed
        .filter(p => p.editedPrice > 0)
        .map(p => ({ name: p.editedName, sellPrice: p.editedPrice }))
    );

    // Step 2: Save custom vocabulary
    const names = confirmed.map(p => p.editedName);
    saveCustomVocabulary(names);
    reloadVocabulary();

    // Step 3: Build DINOv2 catalog for new products with crops
    const newWithCrops = confirmed.filter(p => p.isNew && p.cropBlob);
    for (const product of newWithCrops) {
      try {
        await addToCatalog(product.editedName, product.cropBlob!);
      } catch (e) {
        console.warn(`Failed to add ${product.editedName} to catalog`, e);
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => onSaved(), 1200);
  };

  if (saved) {
    return (
      <div className="pc-saved">
        Saved {confirmedCount} products to your store
      </div>
    );
  }

  const hasNewProducts = products.some(p => p.isNew);

  return (
    <div className="product-confirm">
      <div className="pc-header">
        <span className="pc-title">
          {hasNewProducts ? "Confirm Your Products" : "Products Found"}
        </span>
        <span className="pc-subtitle">
          {hasNewProducts
            ? "Review what we found. Fix any mistakes."
            : "All products recognized from your store."}
        </span>
      </div>

      <div className="pc-list">
        {products.map((product) => (
          <div
            key={product.id}
            className={`pc-card ${product.status === "removed" ? "pc-card-removed" : ""}`}
          >
            {/* Crop thumbnail */}
            <div className="pc-crop">
              {product.cropDataUrl ? (
                <img src={product.cropDataUrl} alt={product.editedName} />
              ) : (
                <div className="pc-crop-placeholder" />
              )}
            </div>

            {/* Product info */}
            <div className="pc-info">
              {editingId === product.id ? (
                <input
                  className="pc-name-input"
                  type="text"
                  value={product.editedName}
                  autoFocus
                  onChange={(e) =>
                    updateProduct(product.id, { editedName: e.target.value })
                  }
                  onBlur={() => {
                    setEditingId(null);
                    if (product.editedName !== product.detectedName) {
                      updateProduct(product.id, { status: "edited" });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setEditingId(null);
                      if (product.editedName !== product.detectedName) {
                        updateProduct(product.id, { status: "edited" });
                      }
                    }
                  }}
                />
              ) : (
                <span className="pc-name">{product.editedName}</span>
              )}

              <span className="pc-meta">
                {product.isNew ? "New product" : "In your store"}
                {product.count > 0 && <> &middot; {product.count} found</>}
              </span>

              {/* Price input */}
              {product.status !== "removed" && (
                <div className="pc-price-row">
                  <input
                    type="number"
                    className="pc-price-input"
                    step="1000"
                    min="0"
                    value={product.editedPrice || ""}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        editedPrice: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="pc-price-suffix">d</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="pc-actions">
              {product.status !== "removed" ? (
                <>
                  <button
                    className="pc-action-btn"
                    onClick={() => setEditingId(product.id)}
                    title="Edit name"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                  </button>
                  <button
                    className="pc-action-btn pc-action-remove"
                    onClick={() => updateProduct(product.id, { status: "removed" })}
                    title="Remove"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  className="pc-action-btn"
                  onClick={() => updateProduct(product.id, { status: "pending" })}
                  title="Undo remove"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving || confirmedCount === 0}
      >
        {saving
          ? "Saving..."
          : `Save to My Store — ${confirmedCount} product${confirmedCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
