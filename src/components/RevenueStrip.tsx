import { useMemo } from "react";
import { estimateRevenue, hasPrices } from "../services/revenueEstimator";
import { formatVND } from "../services/scanHistory";

interface Props {
  onOpenPriceEditor: () => void;
}

export default function RevenueStrip({ onOpenPriceEditor }: Props) {
  const revenue = useMemo(() => estimateRevenue(), []);
  const hasSetPrices = hasPrices();

  if (!hasSetPrices) {
    return (
      <button className="revenue-prompt" onClick={onOpenPriceEditor}>
        Nhập giá bán để xem doanh thu →
      </button>
    );
  }

  if (!revenue) return null;

  return (
    <div className="revenue-strip">
      <div className="revenue-cell">
        <div className="revenue-value">{formatVND(revenue.weeklyRevenue)}</div>
        <div className="revenue-label">TUẦN NÀY</div>
      </div>
      <div className="revenue-cell">
        <div className="revenue-value">{formatVND(revenue.dailyAvgRevenue)}</div>
        <div className="revenue-label">TRUNG BÌNH / NGÀY</div>
      </div>
      <div className="revenue-cell">
        <div className="revenue-value revenue-name">{revenue.topSeller.name}</div>
        <div className="revenue-label">BÁN CHẠY NHẤT</div>
      </div>
    </div>
  );
}
