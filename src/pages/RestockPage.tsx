import { useRestockOrder } from "../hooks/useRestockOrder";
import RestockOrderCard from "../components/RestockOrderCard";
import SupplierSelector from "../components/SupplierSelector";
import ZaloSendButton from "../components/ZaloSendButton";
import { formatVND } from "../services/scanHistory";

export default function RestockPage() {
  const {
    stage,
    order,
    error,
    suppliers,
    zaloMessage,
    generate,
    updateQty,
    selectSupplier,
    confirm,
    reset,
  } = useRestockOrder();

  return (
    <div className="page">
      <h1>Restock</h1>

      {stage === "idle" && (
        <div className="center-content">
          <p className="text-secondary">
            Generate an AI-powered purchase order based on your stock levels.
          </p>
          <button className="btn btn-primary" onClick={generate}>
            Generate Order
          </button>
          {error && <div className="error-box">{error}</div>}
        </div>
      )}

      {stage === "generating" && (
        <div className="center-content">
          <div className="spinner" />
          <p>Generating restock order...</p>
        </div>
      )}

      {stage === "review" && (
        <>
          <SupplierSelector
            suppliers={suppliers}
            selected={order.supplier}
            onSelect={selectSupplier}
          />

          <div className="restock-list">
            {order.items.map((item, i) => (
              <RestockOrderCard
                key={item.name}
                item={item}
                onChangeQty={(qty) => updateQty(i, qty)}
              />
            ))}
          </div>

          <div className="order-total">
            <span>Total</span>
            <span className="mono">{formatVND(order.totalCost)}</span>
          </div>

          <div className="order-actions">
            <button className="btn btn-ghost" onClick={reset}>Cancel</button>
            <button className="btn btn-primary" style={{ width: "auto", padding: "10px 24px" }} onClick={confirm}>Confirm Order</button>
          </div>
        </>
      )}

      {stage === "confirmed" && (
        <div className="confirmed-order">
          <div className="success-box">Order confirmed!</div>

          {order.supplier ? (
            <div className="zalo-section">
              <h3>Send to {order.supplier.name}</h3>
              <pre className="zalo-preview">{zaloMessage}</pre>
              <ZaloSendButton message={zaloMessage} phone={order.supplier.phone} />
            </div>
          ) : (
            <p className="text-secondary">Select a supplier to send the order via Zalo.</p>
          )}

          <button className="btn btn-ghost" onClick={reset}>New Order</button>
        </div>
      )}
    </div>
  );
}
