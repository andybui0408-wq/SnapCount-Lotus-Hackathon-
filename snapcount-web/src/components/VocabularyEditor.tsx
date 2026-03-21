import { useEffect, useState } from "react";
import { COLORS } from "../constants/config";
import { getVocabulary, setVocabulary } from "../services/florenceDetector";

export function VocabularyEditor() {
  const [classes, setClasses] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVocabulary().then(setClasses).catch(() => {});
  }, []);

  async function handleAdd() {
    const trimmed = newItem.trim();
    if (!trimmed || classes.includes(trimmed)) return;
    const updated = [...classes, trimmed];
    setLoading(true);
    setError(null);
    try {
      await setVocabulary(updated);
      setClasses(updated);
      setNewItem("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(item: string) {
    const updated = classes.filter((c) => c !== item);
    setLoading(true);
    try {
      await setVocabulary(updated);
      setClasses(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 12 : 0 }}>
        <div>
          <h3 style={{ color: COLORS.info, fontSize: 14, fontWeight: 700, margin: 0 }}>YOLO-World Vocabulary</h3>
          <p style={{ color: COLORS.textSecondary, fontSize: 11, margin: "2px 0 0" }}>
            {classes.length} product types defined
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{
          background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6,
          color: COLORS.textSecondary, fontSize: 12, padding: "4px 10px", cursor: "pointer",
        }}>
          {expanded ? "Hide" : "Edit"}
        </button>
      </div>

      {expanded && (
        <>
          {error && <p style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</p>}

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="e.g. Trà đá ly"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              style={{
                flex: 1, background: COLORS.background, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, color: COLORS.textPrimary, padding: "8px 10px", fontSize: 13,
              }}
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newItem.trim()}
              style={{
                background: COLORS.accent, color: "#fff", border: "none", borderRadius: 6,
                padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: loading ? 0.5 : 1,
              }}
            >Add</button>
          </div>

          <div style={{ maxHeight: 200, overflow: "auto", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {classes.map((cls) => (
              <span key={cls} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6, background: COLORS.info + "22",
                color: COLORS.info, fontSize: 11, fontWeight: 600,
              }}>
                {cls}
                <button
                  onClick={() => handleRemove(cls)}
                  style={{
                    background: "none", border: "none", color: COLORS.danger,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1,
                  }}
                >x</button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
