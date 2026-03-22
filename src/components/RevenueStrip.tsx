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
        Set prices to view revenue estimates
      </button>
    );
  }

  if (!revenue) return null;

  return (
    <div className="revenue-strip">
      <div className="revenue-cell">
        <div className="revenue-value">{formatVND(revenue.weeklyRevenue)}</div>
        <div className="revenue-label">THIS WEEK</div>
      </div>
      <div className="revenue-cell">
        <div className="revenue-value">{formatVND(revenue.dailyAvgRevenue)}</div>
        <div className="revenue-label">DAILY AVG</div>
      </div>
      <div className="revenue-cell">
        <div className="revenue-value revenue-name">{revenue.topSeller.name}</div>
        <div className="revenue-label">TOP SELLER</div>
      </div>
    </div>
  );
}
