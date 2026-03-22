import { useMemo } from "react";
import { getScans, getDepletionData } from "../services/scanHistory";
import type { TabId } from "../types";

interface Props {
  onTabChange: (tab: TabId) => void;
}

export default function HomePage({ onTabChange }: Props) {
  const scans = useMemo(() => getScans(), []);
  const depletion = useMemo(() => getDepletionData(), []);

  const criticalCount = depletion.filter((d) => d.status === "critical").length;
  const totalItems = depletion.reduce((sum, d) => sum + d.currentStock, 0);
  const criticalItems = depletion.filter((d) => d.status === "critical");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)", overflow: "hidden", padding: "0 20px" }}>
      {/* Brand header */}
      <div style={{ paddingTop: "var(--space-xl)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>COUNTR.</h1>
      </div>

      {/* Tools */}
      <div>
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-title">Tools</span>
          </div>
        </div>
        <div className="home-tools">
          <button className="home-tool-btn" onClick={() => onTabChange("dashboard")}>
            <span className="home-tool-icon">
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            <span className="home-tool-label">Analysis</span>
          </button>
          <button className="home-tool-btn" onClick={() => onTabChange("dashboard")}>
            <span className="home-tool-icon">
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <span className="home-tool-label">Report</span>
          </button>
          <button className="home-tool-btn" onClick={() => onTabChange("restock")}>
            <span className="home-tool-icon">
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
            <span className="home-tool-label">Restock</span>
          </button>
        </div>
      </div>

      {/* Stats in Vietnamese */}
      <div className="home-stats">
        <div className="home-stat">
          <div className="home-stat-number">{criticalCount}</div>
          <div className="home-stat-label">San pham can nhap</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-number">{totalItems}</div>
          <div className="home-stat-label">Tong san pham</div>
        </div>
      </div>

      {/* Critical items list */}
      {criticalItems.length > 0 && (
        <div>
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">San pham sap het</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {criticalItems.map((item) => (
              <div key={item.name} className="home-critical-item">
                <span className="home-critical-name">{item.name}</span>
                <span className="home-critical-count mono">{item.currentStock} con lai</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent scans summary */}
      {scans.length > 0 && (
        <div>
          <div className="home-section">
            <div className="home-section-header">
              <span className="home-section-title">Quet gan day</span>
              <span className="home-section-arrow" onClick={() => onTabChange("history")} style={{ cursor: "pointer" }}>&rarr;</span>
            </div>
          </div>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            {scans.length} lan quet · Lan cuoi: {new Date(scans[0].timestamp).toLocaleDateString("vi-VN")}
          </p>
        </div>
      )}
    </div>
  );
}
