import { useEffect, useState } from "react";
import { ScanProvider } from "./context/ScanContext";
import { ScanPage } from "./pages/ScanPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RestockPage } from "./pages/RestockPage";
import { HistoryPage } from "./pages/HistoryPage";
import { seedDemoData } from "./services/scanHistory";
import { seedDemoSuppliers } from "./services/zaloMessenger";
import { COLORS } from "./constants/config";
import "./App.css";

type Tab = "scan" | "dashboard" | "restock" | "history";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "scan", label: "Scan", icon: "📷" },
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "restock", label: "Restock", icon: "📦" },
  { key: "history", label: "History", icon: "📋" },
];

function App() {
  const [tab, setTab] = useState<Tab>("scan");

  useEffect(() => {
    seedDemoData();
    seedDemoSuppliers();
  }, []);

  return (
    <ScanProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: COLORS.background }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {tab === "scan" && <ScanPage />}
          {tab === "dashboard" && <DashboardPage />}
          {tab === "restock" && <RestockPage />}
          {tab === "history" && <HistoryPage />}
        </div>

        {/* Tab bar */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          display: "flex", background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          paddingBottom: "env(safe-area-inset-bottom, 8px)",
        }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 2, padding: "10px 0 8px", background: "none", border: "none",
                cursor: "pointer", opacity: tab === t.key ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: tab === t.key ? COLORS.accentLight : COLORS.textSecondary,
              }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </ScanProvider>
  );
}

export default App;
