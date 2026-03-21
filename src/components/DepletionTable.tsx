import { useState, useMemo } from "react";

interface DepletionRow {
  name: string;
  currentStock: number;
  change: number;
  avgPerDay: number;
  daysLeft: number;
  status: "critical" | "low" | "healthy";
}

interface Props {
  data: DepletionRow[];
}

const STATUS_STYLE: Record<string, string> = {
  critical: "status-critical",
  low: "status-low",
  healthy: "status-healthy",
};

const STATUS_LABEL: Record<string, string> = {
  critical: "Critical",
  low: "Low",
  healthy: "OK",
};

type StatusFilter = "all" | "critical" | "low" | "healthy";

export default function DepletionTable({ data }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let rows = [...data].sort((a, b) => a.daysLeft - b.daysLeft);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    return rows;
  }, [data, search, statusFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {/* Filters row */}
      <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            height: 36,
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0 10px",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--black)",
            outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={{
            height: 36,
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--black)",
            textTransform: "uppercase" as const,
            cursor: "pointer",
          }}
        >
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="low">Low</option>
          <option value="healthy">OK</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="depletion-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock</th>
              <th>Change</th>
              <th>Avg/day</th>
              <th>Days Left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="mono">{row.currentStock}</td>
                <td className="mono" style={{ color: row.change < 0 ? "var(--black)" : "var(--stone)" }}>
                  {row.change > 0 ? "+" : ""}{row.change}
                </td>
                <td className="mono">{row.avgPerDay}</td>
                <td className="mono">{row.daysLeft === 999 ? "—" : row.daysLeft}</td>
                <td>
                  <span className={`status-badge ${STATUS_STYLE[row.status]}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--stone)", padding: 20 }}>
                  No matching products
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
