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

export default function DepletionTable({ data }: Props) {
  const sorted = [...data].sort((a, b) => a.daysLeft - b.daysLeft);

  return (
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
          {sorted.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td className="mono">{row.currentStock}</td>
              <td className={`mono ${row.change < 0 ? "text-danger" : "text-success"}`}>
                {row.change > 0 ? "+" : ""}{row.change}
              </td>
              <td className="mono">{row.avgPerDay}</td>
              <td className="mono">{row.daysLeft === 999 ? "—" : row.daysLeft}</td>
              <td>
                <span className={`status-badge ${STATUS_STYLE[row.status]}`}>
                  {row.status === "critical" ? "Sắp hết" : row.status === "low" ? "Thấp" : "Đủ"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
