import { useState, useMemo } from "react";
import { getScans, clearScans } from "../services/scanHistory";
import type { ScanResult } from "../types";

export default function HistoryPage() {
  const [revision, setRevision] = useState(0);
  const scans = useMemo(() => getScans(), [revision]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleClear = () => {
    if (!confirm("Clear all scan history?")) return;
    clearScans();
    setRevision((r) => r + 1);
  };

  if (scans.length === 0) {
    return (
      <div className="page">
        <h1>History</h1>
        <p className="text-secondary">No scans yet. Go to Scan to get started.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>History</h1>
        <button className="btn btn-danger" onClick={handleClear}>Clear History</button>
      </div>
      <div className="history-list">
        {scans.map((scan: ScanResult) => {
          const date = new Date(scan.timestamp);
          const expanded = expandedId === scan.id;

          return (
            <div
              key={scan.id}
              className={`history-card ${expanded ? "expanded" : ""}`}
              onClick={() => setExpandedId(expanded ? null : scan.id)}
            >
              <div className="history-header">
                {scan.thumbnail && (
                  <img
                    src={`data:image/jpeg;base64,${scan.thumbnail}`}
                    alt="Scan"
                    className="history-thumb"
                  />
                )}
                <div className="history-meta">
                  <div className="history-date">
                    {date.toLocaleDateString("en-US")} {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="history-summary">
                    {scan.total_items} items
                    {scan.total_depth > 0 && ` (${scan.total_front} front + ${scan.total_depth} depth)`}
                  </div>
                </div>
              </div>

              {expanded && (
                <div className="history-detail">
                  {scan.items.map((item, i) => (
                    <div key={i} className="history-item">
                      <span>{item.name}</span>
                      <span className="mono">
                        {item.total}
                        {item.depth_visible > 0 && ` (${item.front_visible}+${item.depth_visible})`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
