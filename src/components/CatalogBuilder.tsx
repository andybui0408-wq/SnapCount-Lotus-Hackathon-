import { useState, useRef } from "react";
import { listCatalogNames, removeFromCatalog, addToCatalog } from "../services/productCatalog";

interface Props {
  onClose: () => void;
}

export default function CatalogBuilder({ onClose }: Props) {
  const [products, setProducts] = useState<string[]>(listCatalogNames());
  const [name, setName] = useState("");
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
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    }
    setAdding(false);
  };

  const handleRemove = (productName: string) => {
    removeFromCatalog(productName);
    setProducts(listCatalogNames());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Product Catalog (DINOv2)</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="catalog-add-row">
            <input
              type="text"
              placeholder="Product name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input ref={fileRef} type="file" accept="image/*" />
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !name.trim()}>
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
          {error && <div className="error-box">{error}</div>}
          <div className="catalog-grid">
            {products.map((p) => (
              <div key={p} className="catalog-item">
                <span>{p}</span>
                <button className="vocab-remove" onClick={() => handleRemove(p)}>×</button>
              </div>
            ))}
          </div>
          <p className="vocab-count">{products.length} products in catalog</p>
        </div>
      </div>
    </div>
  );
}
