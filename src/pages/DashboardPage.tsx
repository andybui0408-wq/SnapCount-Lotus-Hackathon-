import { useMemo } from "react";
import TrendChart from "../components/TrendChart";
import DepletionTable from "../components/DepletionTable";
import EmailReportButton from "../components/EmailReportButton";
import { getProductTrends, getDepletionData } from "../services/scanHistory";

export default function DashboardPage() {
  const trends = useMemo(() => getProductTrends(), []);
  const depletion = useMemo(() => getDepletionData(), []);

  const critical = depletion.filter((d) => d.status === "critical");
  const low = depletion.filter((d) => d.status === "low");
  const healthy = depletion.filter((d) => d.status === "healthy");

  return (
    <div className="page">
      <h1>Analysis</h1>

      {/* Alert cards */}
      <div className="alert-cards">
        <div className="alert-card alert-critical">
          <div className="alert-count">{critical.length}</div>
          <div className="alert-label">Critical</div>
          <div className="alert-items">
            {critical.map((d) => d.name).join(", ") || "None"}
          </div>
        </div>
        <div className="alert-card alert-low">
          <div className="alert-count">{low.length}</div>
          <div className="alert-label">Low Stock</div>
          <div className="alert-items">
            {low.map((d) => d.name).join(", ") || "None"}
          </div>
        </div>
        <div className="alert-card alert-healthy">
          <div className="alert-count">{healthy.length}</div>
          <div className="alert-label">Healthy</div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="section">
        <h2>7-Day Trends</h2>
        {trends.labels.length > 0 ? (
          <TrendChart labels={trends.labels} datasets={trends.datasets} />
        ) : (
          <p className="text-secondary">No data yet. Scan inventory to start tracking.</p>
        )}
      </div>

      {/* Depletion table */}
      <div className="section">
        <h2>Stock Depletion</h2>
        {depletion.length > 0 ? (
          <DepletionTable data={depletion} />
        ) : (
          <p className="text-secondary">No trend data available.</p>
        )}
      </div>

      {/* Email report button — full width at bottom */}
      <EmailReportButton />
    </div>
  );
}
