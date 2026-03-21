import type { TabId } from "../types";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function BottomTabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="bottom-tab-bar">
      <div className="bottom-tab-bar-inner">
        {/* Home */}
        <button
          className={`tab-item ${activeTab === "home" ? "active" : ""}`}
          onClick={() => onTabChange("home")}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="tab-label">Home</span>
        </button>

        {/* Analysis */}
        <button
          className={`tab-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => onTabChange("dashboard")}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <span className="tab-label">Analysis</span>
        </button>

        {/* Scan — center elevated logo */}
        <button
          className={`tab-item-scan ${activeTab === "scan" ? "active" : ""}`}
          onClick={() => onTabChange("scan")}
        >
          <div className="scan-btn-elevated">
            <img src="/logoshelf.svg" alt="Scan" />
          </div>
        </button>

        {/* Restock */}
        <button
          className={`tab-item ${activeTab === "restock" ? "active" : ""}`}
          onClick={() => onTabChange("restock")}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </span>
          <span className="tab-label">Restock</span>
        </button>

        {/* Profile */}
        <button
          className={`tab-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => onTabChange("profile")}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="tab-label">Profile</span>
        </button>
      </div>
    </div>
  );
}
