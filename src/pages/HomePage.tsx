import { useState } from "react";
import { getScans, getDepletionData } from "../services/scanHistory";
import AIBriefingCard from "../components/AIBriefingCard";
import type { TabId } from "../types";

interface Props {
  onTabChange: (tab: TabId) => void;
}

export default function HomePage({ onTabChange }: Props) {
  const scans = getScans();
  const depletion = getDepletionData();
  const [search, setSearch] = useState("");

  // Use depletion data if available (needs 2+ snapshots), otherwise use latest scan
  const latestScan = scans[0];
  const criticalCount = depletion.filter((d) => d.status === "critical").length;
  const totalItems = depletion.length > 0
    ? depletion.reduce((sum, d) => sum + d.currentStock, 0)
    : latestScan?.total_items ?? 0;
  const criticalItems = depletion.filter((d) => d.status === "critical");

  const query = search.trim().toLowerCase();
  const filteredScans = query
    ? scans.filter((s) => {
        const dateStr = new Date(s.timestamp).toLocaleDateString("vi-VN");
        const productNames = s.items.map((i) => i.name.toLowerCase()).join(" ");
        return dateStr.includes(query) || productNames.includes(query);
      })
    : scans;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)", padding: "var(--space-xl) 20px 0" }}>
      {/* Brand header */}
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>COUNTR.</h1>

      {/* Tools */}
      <div>
        <div className="home-section-header">
          <span className="home-section-title">Tools</span>
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

      {/* AI Briefing */}
      <AIBriefingCard />

      {/* Stats in Vietnamese — full width */}
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
          <div className="home-section-header">
            <span className="home-section-title">San pham sap het</span>
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

      {/* Recent scans with search */}
      {scans.length > 0 && (
        <div>
          <div className="home-section-header">
            <span className="home-section-title">Quet gan day</span>
            <span className="home-section-arrow" onClick={() => onTabChange("history")} style={{ cursor: "pointer" }}>&rarr;</span>
          </div>

          {/* Search bar */}
          <div className="home-search">
            <svg className="home-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="home-search-input"
              placeholder="Tim kiem san pham hoac ngay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="home-search-clear" onClick={() => setSearch("")}>&times;</button>
            )}
          </div>

          {/* Scan cards */}
          {filteredScans.length > 0 ? (
            <div className="home-scan-list">
              {filteredScans.slice(0, 10).map((scan) => {
                const date = new Date(scan.timestamp);
                const topProducts = scan.items.slice(0, 3).map((i) => i.name).join(", ");
                return (
                  <div key={scan.id} className="home-scan-card-row" onClick={() => onTabChange("history")}>
                    {scan.thumbnail ? (
                      <img
                        src={`data:image/jpeg;base64,${scan.thumbnail}`}
                        alt="Scan"
                        className="home-scan-row-thumb"
                      />
                    ) : (
                      <div className="home-scan-row-thumb-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    )}
                    <div className="home-scan-row-info">
                      <span className="home-scan-row-date mono">
                        {date.toLocaleDateString("vi-VN")} · {date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="home-scan-row-count">
                        {scan.total_items} san pham · {scan.items.length} loai
                      </span>
                      <span className="home-scan-row-products">{topProducts}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-secondary" style={{ fontSize: 13, textAlign: "center", padding: "var(--space-md) 0" }}>
              Khong tim thay ket qua cho "{search}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
