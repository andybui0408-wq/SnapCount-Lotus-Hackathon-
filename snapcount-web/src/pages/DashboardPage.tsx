import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { COLORS } from "../constants/config";
import { getProductTrends, getHistory } from "../services/scanHistory";
import { getLowStockCount } from "../services/lowStockAgent";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#f472b6", "#38bdf8"];

export function DashboardPage() {
  const [trends, setTrends] = useState<ReturnType<typeof getProductTrends>>([]);
  const [stockCounts, setStockCounts] = useState({ critical: 0, low: 0, ok: 0 });
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    setTrends(getProductTrends());
    setStockCounts(getLowStockCount());
    setScanCount(getHistory().length);
  }, []);

  const trendDates = [...new Set(trends.flatMap((t) => t.dataPoints.map((d) => d.date)))].sort();
  const shortDates = trendDates.map((d) => {
    const [, m, day] = d.split("-");
    return `${day}/${m}`;
  });

  const lineData = {
    labels: shortDates,
    datasets: trends.slice(0, 8).map((t, i) => ({
      label: t.name,
      data: trendDates.map((date) => {
        const point = t.dataPoints.find((p) => p.date === date);
        return point?.count ?? null;
      }),
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "33",
      tension: 0.3,
      pointRadius: 3,
      borderWidth: 2,
    })),
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "bottom" as const, labels: { color: COLORS.textSecondary, font: { size: 11 } } },
    },
    scales: {
      x: { ticks: { color: COLORS.textSecondary }, grid: { color: COLORS.border } },
      y: { ticks: { color: COLORS.textSecondary }, grid: { color: COLORS.border }, beginAtZero: true },
    },
  };

  const depletionData = {
    labels: trends.slice(0, 8).map((t) => t.name.length > 15 ? t.name.slice(0, 15) + "..." : t.name),
    datasets: [{
      label: "Daily Sales Rate",
      data: trends.slice(0, 8).map((t) => t.dailySalesRate),
      backgroundColor: trends.slice(0, 8).map((t) =>
        t.status === "critical" ? COLORS.danger + "cc" : t.status === "low" ? COLORS.warning + "cc" : COLORS.accentLight + "cc"
      ),
      borderRadius: 6,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { ticks: { color: COLORS.textSecondary }, grid: { color: COLORS.border }, beginAtZero: true },
      y: { ticks: { color: COLORS.textSecondary, font: { size: 11 } }, grid: { display: false } },
    },
  };

  return (
    <div style={{ flex: 1, overflow: "auto", background: COLORS.background, padding: "16px 0 100px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", width: "100%", padding: "0 16px" }}>
        <h1 style={{ color: COLORS.accentLight, fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Dashboard</h1>

        {/* Summary cards */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            { label: "Total Scans", value: scanCount, color: COLORS.accentLight },
            { label: "Critical", value: stockCounts.critical, color: COLORS.danger },
            { label: "Low Stock", value: stockCounts.low, color: COLORS.warning },
            { label: "OK", value: stockCounts.ok, color: COLORS.accentLight },
          ].map((c) => (
            <div key={c.label} style={{
              flex: 1, background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`,
              padding: 12, textAlign: "center",
            }}>
              <div style={{ color: COLORS.textSecondary, fontSize: 10, fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
              <div style={{ color: c.color, fontSize: 24, fontWeight: 800, fontFamily: "monospace" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Stock trend chart */}
        {trends.length > 0 && (
          <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 16 }}>
            <h3 style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Stock Levels Over Time</h3>
            <div style={{ height: 280 }}>
              <Line data={lineData} options={lineOptions} />
            </div>
          </div>
        )}

        {/* Depletion rate chart */}
        {trends.length > 0 && (
          <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 16 }}>
            <h3 style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Daily Sales Velocity</h3>
            <div style={{ height: Math.max(200, trends.slice(0, 8).length * 36) }}>
              <Bar data={depletionData} options={barOptions} />
            </div>
          </div>
        )}

        {/* Depletion table */}
        {trends.length > 0 && (
          <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16 }}>
            <h3 style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Depletion Forecast</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Product", "Stock", "Rate/day", "Days Left", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trends.map((t) => (
                    <tr key={t.name}>
                      <td style={{ padding: "8px 6px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 500 }}>{t.name}</td>
                      <td style={{ padding: "8px 6px", color: COLORS.textPrimary, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>{t.currentStock}</td>
                      <td style={{ padding: "8px 6px", color: COLORS.textSecondary, fontSize: 13, fontFamily: "monospace" }}>{t.dailySalesRate}</td>
                      <td style={{ padding: "8px 6px", color: t.daysUntilEmpty <= 2 ? COLORS.danger : t.daysUntilEmpty <= 5 ? COLORS.warning : COLORS.textPrimary, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>
                        {t.daysUntilEmpty >= 999 ? "—" : t.daysUntilEmpty.toFixed(1)}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                          color: t.status === "critical" ? COLORS.danger : t.status === "low" ? COLORS.warning : COLORS.accentLight,
                          background: (t.status === "critical" ? COLORS.danger : t.status === "low" ? COLORS.warning : COLORS.accentLight) + "22",
                        }}>{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {trends.length === 0 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: COLORS.textSecondary, fontSize: 15 }}>No scan data yet. Run a scan to see trends.</p>
          </div>
        )}
      </div>
    </div>
  );
}
