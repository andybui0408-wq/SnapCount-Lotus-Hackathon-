import { useState, useRef } from "react";
import { listCatalogNames, removeFromCatalog, addToCatalog, clearCatalog } from "../services/productCatalog";

interface Props {
  onClose: () => void;
}

export default function CatalogBuilder({ onClose }: Props) {
  const [products, setProducts] = useState<string[]>(listCatalogNames());
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addToCatalog(name.trim(), file);
      setProducts(listCatalogNames());
      setName("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    }
    setAdding(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : "");
  };

  const handleRemove = (productName: string) => {
    removeFromCatalog(productName);
    setProducts(listCatalogNames());
  };

  const handleClearAll = () => {
    if (!confirm("Clear all catalog entries? This cannot be undone.")) return;
    clearCatalog();
    setProducts([]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal catalog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Product Catalog</h2>
            <p className="catalog-subtitle">Train the system to recognize your products</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Add product section */}
          <div className="catalog-add-section">
            <label className="catalog-field-label">Product Name</label>
            <input
              type="text"
              className="catalog-name-input"
              placeholder="e.g. Coca-Cola 330ml"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label className="catalog-field-label">Reference Photo</label>
            <button
              className="catalog-file-btn"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>{fileName || "Choose image..."}</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              hidden
            />

            <button
              className="btn btn-primary catalog-add-btn"
              onClick={handleAdd}
              disabled={adding || !name.trim() || !fileName}
            >
              {adding ? "Processing..." : "Add to Catalog"}
            </button>
          </div>

          {error && <div className="error-box">{error}</div>}

          {/* Product list */}
          {products.length > 0 ? (
            <>
              <div className="catalog-list-header">
                <span className="catalog-field-label">{products.length} Product{products.length !== 1 ? "s" : ""}</span>
                <button className="catalog-clear-btn" onClick={handleClearAll}>Clear All</button>
              </div>
              <div className="catalog-product-list">
                {products.map((p) => (
                  <div key={p} className="catalog-product-row">
                    <div className="catalog-product-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                    </div>
                    <span className="catalog-product-name">{p}</span>
                    <button className="catalog-remove-btn" onClick={() => handleRemove(p)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="catalog-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <p className="catalog-empty-title">No products yet</p>
              <p className="catalog-empty-desc">
                Add products with reference photos to improve detection accuracy
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
