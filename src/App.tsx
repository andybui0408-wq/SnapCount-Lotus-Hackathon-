import { useState } from "react";
import HomePage from "./pages/HomePage";
import ScanPage from "./pages/ScanPage";
import DashboardPage from "./pages/DashboardPage";
import RestockPage from "./pages/RestockPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import BottomTabBar from "./components/BottomTabBar";
import type { TabId } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  return (
    <div className="app-shell">
      <div className="app-content">
        {activeTab === "home" && <HomePage onTabChange={setActiveTab} />}
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "scan" && <ScanPage />}
        {activeTab === "restock" && <RestockPage />}
        {activeTab === "history" && <HistoryPage />}
        {activeTab === "profile" && <ProfilePage />}
      </div>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
