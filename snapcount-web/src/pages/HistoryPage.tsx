import { useEffect, useState } from "react";
import { COLORS } from "../constants/config";
import { getHistory, clearHistory, type ScanRecord } from "../services/scanHistory";

export function HistoryPage() {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setRecords(getHistory().reverse());
  }, []);

  function handleClear() {
    if (!confirm("Clear all scan history?")) return;
    clearHistory();
    setRecords([]);
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} ${h}:${m}`;
  }

  return (
    <div style={{ flex: 1, overflow: "auto", background: COLORS.background, padding: "16px 0 100px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", width: "100%", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ color: COLORS.accentLight, fontSize: 24, fontWeight: 800 }}>Scan History</h1>
          {records.length > 0 && (
            <button onClick={handleClear} style={{
              background: "none", border: `1px solid ${COLORS.danger}44`, borderRadius: 8,
              color: COLORS.danger, fontSize: 12, padding: "6px 12px", cursor: "pointer",
            }}>Clear All</button>
          )}
        </div>

        {records.length === 0 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: COLORS.textSecondary, fontSize: 15 }}>No scans recorded yet.</p>
          </div>
        )}

        {records.map((record) => (
          <div
            key={record.id}
            onClick={() => setExpanded(expanded === record.id ? null : record.id)}
            style={{
              background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`,
              padding: 14, marginBottom: 8, cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 600 }}>
                  {record.results.totalObjects} objects detected
                </div>
                <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {formatDate(record.timestamp)} · {record.results.items.length} categories
                  {record.results.occlusionDelta > 0 && ` · +${record.results.occlusionDelta} hidden`}
                </div>
              </div>
              <span style={{ color: COLORS.textSecondary, fontSize: 18 }}>{expanded === record.id ? "−" : "+"}</span>
            </div>

            {expanded === record.id && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                {record.results.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</span>
                      {item.ocrText && (
                        <span style={{
                          marginLeft: 6, padding: "1px 6px", borderRadius: 3, background: COLORS.info + "22",
                          color: COLORS.info, fontSize: 10, fontFamily: "monospace",
                        }}>{item.ocrText}</span>
                      )}
                    </div>
                    <span style={{ color: COLORS.accentLight, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
