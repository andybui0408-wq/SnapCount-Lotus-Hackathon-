interface Props {
  frontCount: number;
  depthCount: number;
  totalItems: number;
  ocrLabels: number;
}

export default function SummaryCards({ frontCount, depthCount, totalItems, ocrLabels }: Props) {
  return (
    <div className="summary-cards">
      <div className="summary-card">
        <div className="summary-value">{frontCount}</div>
        <div className="summary-label">Front View</div>
      </div>
      <div className="summary-card accent-info">
        <div className="summary-value">{depthCount}</div>
        <div className="summary-label">Depth</div>
      </div>
      <div className="summary-card">
        <div className="summary-value">{totalItems}</div>
        <div className="summary-label">Total</div>
      </div>
      <div className="summary-card accent-warning">
        <div className="summary-value">{ocrLabels}</div>
        <div className="summary-label">Labels Read</div>
      </div>
    </div>
  );
}
