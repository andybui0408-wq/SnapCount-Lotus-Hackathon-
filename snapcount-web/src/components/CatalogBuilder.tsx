import { useEffect, useRef, useState } from "react";
import { COLORS } from "../constants/config";
import { addToCatalog, listCatalog, removeFromCatalog } from "../services/florenceDetector";

export function CatalogBuilder() {
  const [products, setProducts] = useState<string[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listCatalog()
      .then((data) => {
        setProducts(data.products);
        setCatalogCount(data.count);
      })
      .catch(() => {});
  }, []);

  async function handleAdd() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0 || !newName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await addToCatalog(newName.trim(), files[0]);
      setCatalogCount(result.catalog_size);
      setProducts((p) => [...p, newName.trim()]);
      setNewName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(name: string) {
    try {
      await removeFromCatalog(name);
      setProducts((p) => p.filter((n) => n !== name));
      setCatalogCount((c) => c - 1);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 12 : 0 }}>
        <div>
          <h3 style={{ color: COLORS.accentLight, fontSize: 14, fontWeight: 700, margin: 0 }}>Product Catalog (DINOv2)</h3>
          <p style={{ color: COLORS.textSecondary, fontSize: 11, margin: "2px 0 0" }}>
            {catalogCount} product{catalogCount !== 1 ? "s" : ""} fingerprinted
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{
          background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6,
          color: COLORS.textSecondary, fontSize: 12, padding: "4px 10px", cursor: "pointer",
        }}>
          {expanded ? "Hide" : "Manage"}
        </button>
      </div>

      {expanded && (
        <>
          {error && <p style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</p>}

          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Product name, e.g. Mì Hảo Hảo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{
                width: "100%", background: COLORS.background, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, color: COLORS.textPrimary, padding: "8px 10px", fontSize: 13,
                marginBottom: 6,
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{
                flex: 1, background: COLORS.background, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, color: COLORS.textSecondary, padding: "6px 8px", fontSize: 12,
              }} />
              <button
                onClick={handleAdd}
                disabled={loading || !newName.trim()}
                style={{
                  background: COLORS.accent, color: "#fff", border: "none", borderRadius: 6,
                  padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: loading ? 0.5 : 1, whiteSpace: "nowrap",
                }}
              >{loading ? "..." : "Add"}</button>
            </div>
          </div>

          {products.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {products.map((name) => (
                <span key={name} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 6, background: COLORS.accentLight + "22",
                  color: COLORS.accentLight, fontSize: 12, fontWeight: 600,
                }}>
                  {name}
                  <button
                    onClick={() => handleRemove(name)}
                    style={{
                      background: "none", border: "none", color: COLORS.danger,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1,
                    }}
                  >x</button>
                </span>
              ))}
            </div>
          )}

          {products.length === 0 && (
            <p style={{ color: COLORS.textSecondary, fontSize: 12, fontStyle: "italic" }}>
              No products yet. Photograph each product once to teach the system.
            </p>
          )}
        </>
      )}
    </div>
  );
}
