import { useState } from "react";
import OrderDeadlinesCard from "../components/OrderDeadlinesCard";
import StockBars from "../components/StockBars";
import RevenueStrip from "../components/RevenueStrip";
import PriceEditor from "../components/PriceEditor";
import EmailReportButton from "../components/EmailReportButton";
import { getRestockThreshold, setRestockThreshold } from "../services/settingsStore";

type SortOption = "name" | "urgency" | "stock";
type FilterOption = "all" | "critical" | "low" | "healthy";

export default function DashboardPage() {
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all");
  const [threshold, setThreshold] = useState(getRestockThreshold);
  const [editingThreshold, setEditingThreshold] = useState(false);

  const handleThresholdChange = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1) {
      setThreshold(n);
      setRestockThreshold(n);
    }
  };

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <OrderDeadlinesCard />

      <div className="section">
        <div className="dash-stock-header">
          <h2 className="section-heading">Inventory</h2>
          <button
            className="dash-threshold-btn mono"
            onClick={() => setEditingThreshold(!editingThreshold)}
          >
            Threshold: {threshold}
          </button>
        </div>

        {editingThreshold && (
          <div className="dash-threshold-editor">
            <label className="dash-threshold-label">Restock threshold (qty)</label>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
              className="dash-threshold-input mono"
            />
          </div>
        )}

        <div className="dash-controls">
          <div className="dash-filter-group">
            {(["all", "critical", "low", "healthy"] as FilterOption[]).map((f) => (
              <button
                key={f}
                className={`dash-filter-btn${filterStatus === f ? " active" : ""}`}
                onClick={() => setFilterStatus(f)}
              >
                {f === "all" ? "All" : f === "critical" ? "Critical" : f === "low" ? "Low" : "Healthy"}
              </button>
            ))}
          </div>
          <select
            className="dash-sort-select mono"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="urgency">Urgency</option>
            <option value="name">Name A-Z</option>
            <option value="stock">Quantity</option>
          </select>
        </div>

        <StockBars sortBy={sortBy} filterStatus={filterStatus} />
      </div>

      <RevenueStrip onOpenPriceEditor={() => setShowPriceEditor(true)} />

      <EmailReportButton />

      {showPriceEditor && <PriceEditor onClose={() => setShowPriceEditor(false)} />}
    </div>
  );
}
