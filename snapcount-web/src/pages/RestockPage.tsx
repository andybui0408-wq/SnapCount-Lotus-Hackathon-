import { useState } from "react";
import { COLORS } from "../constants/config";
import { generateRestockFromTrends, type RestockRecommendation } from "../services/lowStockAgent";
import { getSuppliers, seedDemoSuppliers, type Supplier } from "../services/zaloMessenger";
import { copyAndOpenZalo, formatVND } from "../services/zaloMessenger";

function urgencyColor(u: string) {
  if (u === "critical") return COLORS.danger;
  if (u === "low") return COLORS.warning;
  return COLORS.textSecondary;
}

export function RestockPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RestockRecommendation | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    seedDemoSuppliers();
    return getSuppliers();
  });
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [zaloSent, setZaloSent] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setZaloSent(false);
    try {
      const rec = await generateRestockFromTrends();
      setRecommendation(rec);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendZalo() {
    if (!recommendation || !selectedSupplier) return;
    const supplier = suppliers.find((s) => s.id === selectedSupplier);
    if (!supplier) return;

    const result = await copyAndOpenZalo(supplier, recommendation.supplier_message_vi);
    if (result.success) {
      setZaloSent(true);
    } else {
      alert("Failed to open Zalo. Please copy the message manually.");
    }
  }

  return (
    <div style={{ flex: 1, overflow: "auto", background: COLORS.background, padding: "16px 0 100px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", width: "100%", padding: "0 16px" }}>
        <h1 style={{ color: COLORS.accentLight, fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Smart Restock</h1>
        <p style={{ color: COLORS.textSecondary, fontSize: 13, marginBottom: 20 }}>
          AI generates restock orders based on stock trends + Vietnamese supplier messaging
        </p>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: "100%", padding: 16, borderRadius: 12, background: COLORS.accent, color: "#fff",
            fontSize: 16, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1, marginBottom: 16,
          }}
        >
          {loading ? "Generating with AI..." : "Generate Restock Order"}
        </button>

        {error && (
          <div style={{ padding: 14, background: COLORS.danger + "18", borderRadius: 10, border: `1px solid ${COLORS.danger}44`, marginBottom: 16 }}>
            <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>
          </div>
        )}

        {recommendation && (
          <>
            {/* Summary */}
            <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 12 }}>
              <p style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{recommendation.summary}</p>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>Total VND</span>
                  <div style={{ color: COLORS.accentLight, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{formatVND(recommendation.total_order_cost_vnd)}</div>
                </div>
                <div>
                  <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>Total USD</span>
                  <div style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>${recommendation.total_order_cost_usd}</div>
                </div>
              </div>
            </div>

            {/* Items */}
            {recommendation.urgent_items.map((item, i) => (
              <div key={i} style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    color: urgencyColor(item.urgency), background: urgencyColor(item.urgency) + "22",
                  }}>{item.urgency}</span>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 6 }}>
                  {[
                    { l: "Stock", v: item.current_stock },
                    { l: "Rate/day", v: item.daily_sales_rate },
                    { l: "Days left", v: item.days_until_empty.toFixed(1) },
                    { l: "Order", v: item.recommended_order_qty },
                  ].map((d) => (
                    <div key={d.l}>
                      <div style={{ color: COLORS.textSecondary, fontSize: 10 }}>{d.l}</div>
                      <div style={{ color: COLORS.textPrimary, fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>{d.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>{formatVND(item.unit_cost_vnd)}/unit</span>
                  <span style={{ color: COLORS.accentLight, fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{formatVND(item.line_total_vnd)}</span>
                </div>
                <p style={{ color: COLORS.textSecondary, fontSize: 11, fontStyle: "italic", marginTop: 6 }}>{item.reasoning}</p>
              </div>
            ))}

            {/* Zalo message preview */}
            {recommendation.supplier_message_vi && (
              <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.info}33`, padding: 16, marginTop: 16 }}>
                <h3 style={{ color: COLORS.info, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Zalo Message Preview</h3>
                <pre style={{
                  color: COLORS.textPrimary, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  background: COLORS.background, padding: 12, borderRadius: 8, marginBottom: 12,
                }}>{recommendation.supplier_message_vi}</pre>

                {/* Supplier selector */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ color: COLORS.textSecondary, fontSize: 12, display: "block", marginBottom: 6 }}>Send to supplier:</label>
                  <select
                    value={selectedSupplier || ""}
                    onChange={(e) => setSelectedSupplier(e.target.value || null)}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8, background: COLORS.background,
                      border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary, fontSize: 13,
                    }}
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.phone}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSendZalo}
                  disabled={!selectedSupplier || zaloSent}
                  style={{
                    width: "100%", padding: 14, borderRadius: 10, border: "none", cursor: "pointer",
                    background: zaloSent ? COLORS.accentLight + "33" : "#0068FF",
                    color: zaloSent ? COLORS.accentLight : "#fff",
                    fontSize: 15, fontWeight: 700,
                    opacity: !selectedSupplier ? 0.4 : 1,
                  }}
                >
                  {zaloSent ? "Message Copied + Zalo Opened" : "Copy & Open Zalo"}
                </button>
              </div>
            )}
          </>
        )}

        {!recommendation && !loading && (
          <div style={{ textAlign: "center", padding: 30, color: COLORS.textSecondary, fontSize: 13 }}>
            Click the button above to analyze stock trends and generate a smart restock order with AI.
          </div>
        )}
      </div>
    </div>
  );
}
