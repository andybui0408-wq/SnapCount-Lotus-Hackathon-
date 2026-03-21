import { useState, useMemo } from "react";
import { getScans, getDepletionData } from "../services/scanHistory";
import AIBriefingCard from "../components/AIBriefingCard";
import type { TabId } from "../types";

interface Props {
  onTabChange: (tab: TabId) => void;
}

export default function HomePage({ onTabChange }: Props) {
  const scans = useMemo(() => getScans(), []);
  const depletion = useMemo(() => getDepletionData(), []);

  const criticalCount = depletion.filter((d) => d.status === "critical").length;
  const totalItems = depletion.reduce((sum, d) => sum + d.currentStock, 0);
  const minDays = depletion.length > 0
    ? Math.min(...depletion.map((d) => d.daysLeft === 999 ? 99 : d.daysLeft))
    : 0;

  const [searchQuery, setSearchQuery] = useState("");

  const filteredScans = useMemo(() => {
    if (!searchQuery.trim()) return scans;
    const q = searchQuery.toLowerCase();
    return scans.filter((s) =>
      s.items.some((item) => item.name.toLowerCase().includes(q))
    );
  }, [scans, searchQuery]);

  const displayScans = filteredScans.length > 0 ? filteredScans : scans;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)", overflow: "hidden" }}>
      {/* Search bar */}
      <div className="home-search">
        <input
          type="text"
          className="home-search-input"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* AI Briefing */}
      <div style={{ padding: "0 20px" }}>
        <AIBriefingCard />
      </div>

      {/* Previous scans */}
      <div style={{ overflow: "hidden" }}>
        <div className="home-section">
          <div className="home-section-header">
            <span className="home-section-title">Previous</span>
            <span className="home-section-arrow">&rarr;</span>
          </div>
        </div>
        <div className="home-scan-scroll">
          {displayScans.slice(0, 10).map((scan) => {
            const date = new Date(scan.timestamp);
            const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const itemNames = scan.items.map((i) => i.name).join(", ");
            return (
              <div
                key={scan.id}
                className="home-scan-card"
                onClick={() => onTabChange("history")}
              >
                {scan.thumbnail ? (
                  <img
                    src={`data:image/jpeg;base64,${scan.thumbnail}`}
                    alt="Scan"
                    className="home-scan-thumb"
                  />
                ) : (
                  <div className="home-scan-thumb-placeholder">
                    <img src="/logoshelf.svg" alt="" />
                  </div>
                )}
                <div className="home-scan-info">
                  <div className="home-scan-date">{dateStr}</div>
                  <div className="home-scan-title">{scan.total_items} items</div>
                  <div className="home-scan-summary">{itemNames || "No items detected"}</div>
                </div>
              </div>
            );
          })}
          {scans.length === 0 && (
            <div className="home-scan-card" onClick={() => onTabChange("scan")}>
              <div className="home-scan-thumb-placeholder">
                <img src="/logoshelf.svg" alt="" />
              </div>
              <div className="home-scan-info">
                <div className="home-scan-date">Get started</div>
                <div className="home-scan-title">No scans yet</div>
                <div className="home-scan-summary">Tap to start scanning inventory</div>
              </div>
            </div>
          )}
        </div>
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

      {/* Quick stats */}
      <div className="home-stats">
        <div className="home-stat">
          <div className="home-stat-number">{criticalCount}</div>
          <div className="home-stat-label">Critical Items</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-number">{totalItems}</div>
          <div className="home-stat-label">Total Items</div>
        </div>
        <div className="home-stat">
          <div className="home-stat-number">{minDays > 90 ? "—" : `${Math.round(minDays)}d`}</div>
          <div className="home-stat-label">Until Restock</div>
        </div>
      </div>
    </div>
  );
}
