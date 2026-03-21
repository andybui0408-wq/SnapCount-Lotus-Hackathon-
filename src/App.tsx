import { useState } from "react";
import ScanPage from "./pages/ScanPage";
import DashboardPage from "./pages/DashboardPage";
import RestockPage from "./pages/RestockPage";
import HistoryPage from "./pages/HistoryPage";
import type { TabId } from "./types";

const TABS: { id: TabId; label: string }[] = [
  { id: "scan", label: "Scan" },
  { id: "dashboard", label: "Dashboard" },
  { id: "restock", label: "Restock" },
  { id: "history", label: "History" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("scan");

  return (
    <div className="app">
      <nav className="tab-nav">
        <div className="nav-brand">SnapCount</div>
        <div className="tab-list">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="main-content">
        {activeTab === "scan" && <ScanPage />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "restock" && <RestockPage />}
        {activeTab === "history" && <HistoryPage />}
      </main>
    </div>
  );
}
