import { useEffect } from "react";
import { useRestockOrder } from "../hooks/useRestockOrder";
import { COLORS } from "../constants/config";
import type { MergedResult } from "../types";

interface Props {
  scanResult: MergedResult;
  onBack: () => void;
  onNewScan: () => void;
}

function urgencyColor(u: string) {
  if (u === "critical") return COLORS.danger;
  if (u === "low") return COLORS.warning;
  if (u === "restock") return COLORS.info;
  return COLORS.textSecondary;
}

function fmtVND(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

export function RestockScreen({ scanResult, onBack, onNewScan }: Props) {
  const { status, order, error, editedQty, generate, updateQuantity, removeItem, confirm, resetOrder } = useRestockOrder();

  useEffect(() => {
    if (status === "idle") generate(scanResult);
  }, []);

  const liveItems = order?.items.map((item) => {
    const qty = editedQty[item.name] ?? item.reorder_quantity;
    return { ...item, reorder_quantity: qty, estimated_line_total_vnd: qty * item.estimated_unit_cost_vnd };
  }) ?? [];
  const liveCost = liveItems.reduce((s, i) => s + i.estimated_line_total_vnd, 0);
  const liveQty = liveItems.reduce((s, i) => s + i.reorder_quantity, 0);
  const liveUSD = Math.round((liveCost / 25000) * 100) / 100;

  const center: React.CSSProperties = {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", background: COLORS.background, padding: 32,
  };

  if (status === "generating") return (
    <div style={center}>
      <div className="spinner" style={{ width: 40, height: 40, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accentLight, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <p style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 600, marginTop: 20 }}>Generating restock order...</p>
    </div>
  );

  if (status === "error") return (
    <div style={center}>
      <p style={{ color: COLORS.danger, fontSize: 36, fontWeight: 800 }}>!</p>
      <p style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Generation Failed</p>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 }}>{error}</p>
      <button onClick={() => generate(scanResult)} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "12px 32px", borderRadius: 10, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>Retry</button>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accentLight, cursor: "pointer" }}>← Back to results</button>
    </div>
  );

  if (status === "confirmed" && order) return (
    <div style={center}>
      <div style={{ width: 72, height: 72, borderRadius: 36, background: COLORS.accent + "22", border: `2px solid ${COLORS.accentLight}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <span style={{ color: COLORS.accentLight, fontSize: 32, fontWeight: 700 }}>✓</span>
      </div>
      <h2 style={{ color: COLORS.textPrimary, fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Order Confirmed</h2>
      <p style={{ color: COLORS.textSecondary, fontSize: 13, fontFamily: "monospace", marginBottom: 20 }}>{order.order_id}</p>
      <div style={{ width: "100%", maxWidth: 360, background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 16 }}>
        {[
          ["Items", `${order.total_items_to_order} units`],
          ["Total (VND)", fmtVND(order.estimated_total_cost_vnd)],
          ["Total (USD)", `$${order.estimated_total_cost_usd}`],
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>{l}</span>
            <span style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>{v}</span>
          </div>
        ))}
      </div>
      {order.recommended_action && <p style={{ color: COLORS.textSecondary, fontSize: 13, fontStyle: "italic", textAlign: "center", marginBottom: 24 }}>{order.recommended_action}</p>}
      <button onClick={() => { resetOrder(); onNewScan(); }} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "14px 40px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
        New Scan
      </button>
    </div>
  );

  if (!order) return (
    <div style={center}>
      <p style={{ color: COLORS.textSecondary }}>No scan data.</p>
      <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accentLight, cursor: "pointer", marginTop: 12 }}>← Back</button>
    </div>
  );

  // Review state
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: COLORS.background }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "40px 20px 12px", background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
        <button onClick={() => { resetOrder(); onBack(); }} style={{ background: "none", border: "none", color: COLORS.accentLight, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>← Back</button>
        <span style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }}>Restock Order</span>
        <span style={{ width: 50 }} />
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingBottom: 120 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
          {/* Order info */}
          <div style={{ padding: "16px 16px 8px" }}>
            <div style={{ color: COLORS.accentLight, fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>{order.order_id}</div>
            {order.store_context && <div style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 4 }}>{order.store_context}</div>}
            {order.summary && <div style={{ color: COLORS.textPrimary, fontSize: 14, marginTop: 8, fontStyle: "italic" }}>{order.summary}</div>}
          </div>

          {/* Items */}
          {liveItems.map((item) => (
            <div key={item.name} style={{ margin: "12px 16px 0", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  <span style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600 }}>{item.name}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase", color: urgencyColor(item.urgency), background: urgencyColor(item.urgency) + "22" }}>{item.urgency}</span>
                </div>
                <button onClick={() => removeItem(item.name)} style={{ background: "none", border: "none", color: COLORS.danger, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove</button>
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                {[
                  { l: "Current", v: String(item.current_stock) },
                  { l: "Unit Cost", v: fmtVND(item.estimated_unit_cost_vnd) },
                  { l: "Line Total", v: fmtVND(item.estimated_line_total_vnd), c: COLORS.accentLight },
                ].map((d) => (
                  <div key={d.l} style={{ flex: 1 }}>
                    <div style={{ color: COLORS.textSecondary, fontSize: 10, marginBottom: 2 }}>{d.l}</div>
                    <div style={{ color: d.c || COLORS.textPrimary, fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{d.v}</div>
                  </div>
                ))}
              </div>

              {/* Stepper */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                <span style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 500 }}>Order Qty</span>
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button onClick={() => updateQuantity(item.name, Math.max(0, item.reorder_quantity - 1))} style={{
                    width: 36, height: 36, borderRadius: 8, background: COLORS.background, border: `1px solid ${COLORS.border}`,
                    color: COLORS.accentLight, fontSize: 20, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>−</button>
                  <span style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 800, fontFamily: "monospace", minWidth: 44, textAlign: "center" }}>{item.reorder_quantity}</span>
                  <button onClick={() => updateQuantity(item.name, item.reorder_quantity + 1)} style={{
                    width: 36, height: 36, borderRadius: 8, background: COLORS.background, border: `1px solid ${COLORS.border}`,
                    color: COLORS.accentLight, fontSize: 20, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>+</button>
                </div>
              </div>
              {item.reason && <p style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 8, fontStyle: "italic" }}>{item.reason}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "14px 20px 28px",
      }}>
        <div>
          <div style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>{liveQty} items · {fmtVND(liveCost)}</div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, fontFamily: "monospace" }}>≈ ${liveUSD}</div>
        </div>
        <button onClick={confirm} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "14px 24px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          Confirm Order
        </button>
      </div>
    </div>
  );
}
