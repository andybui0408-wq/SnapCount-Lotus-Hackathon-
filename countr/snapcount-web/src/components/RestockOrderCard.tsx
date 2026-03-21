import type { RestockItem } from "../types";
import { formatVND } from "../services/scanHistory";

interface Props {
  item: RestockItem;
  onChangeQty: (qty: number) => void;
}

export default function RestockOrderCard({ item, onChangeQty }: Props) {
  return (
    <div className="restock-card">
      <div className="restock-info">
        <span className="restock-name">{item.name}</span>
        <span className="restock-stock">Tồn kho: {item.currentStock}</span>
      </div>
      <div className="restock-controls">
        <button
          className="qty-btn"
          onClick={() => onChangeQty(Math.max(0, item.qty - 1))}
        >
          −
        </button>
        <span className="qty-value mono">{item.qty}</span>
        <button
          className="qty-btn"
          onClick={() => onChangeQty(item.qty + 1)}
        >
          +
        </button>
      </div>
      <div className="restock-price">
        <span className="unit-price">{formatVND(item.unitPrice)}/pc</span>
        <span className="line-total mono">{formatVND(item.unitPrice * item.qty)}</span>
      </div>
    </div>
  );
}
