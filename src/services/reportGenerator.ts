// Generates a branded HTML report for email delivery

interface DepletionRow {
  name: string;
  currentStock: number;
  avgPerDay: number;
  daysLeft: number;
  status: "critical" | "low" | "healthy";
}

interface TrendDataset {
  name: string;
  data: number[];
}

export function generateInventoryReportHTML(
  datasets: TrendDataset[],
  depletion: DepletionRow[],
  scanDate: string,
): string {
  const critical = depletion.filter((d) => d.status === "critical");
  const low = depletion.filter((d) => d.status === "low");
  const healthy = depletion.filter((d) => d.status === "healthy");

  const depletionRows = depletion
    .map(
      (d) => `
    <tr>
      <td>${d.name}</td>
      <td class="mono">${d.currentStock}</td>
      <td class="mono">${d.avgPerDay.toFixed(1)}</td>
      <td class="mono">${d.daysLeft >= 999 ? "—" : d.daysLeft.toFixed(0)}</td>
      <td>${
        d.status === "critical"
          ? '<span class="status-critical">CRITICAL</span>'
          : d.status === "low"
            ? '<span class="status-low">LOW</span>'
            : '<span class="status-ok">OK</span>'
      }</td>
    </tr>`,
    )
    .join("");

  const trendRows = datasets
    .map((ds) => {
      const first = ds.data[0] ?? 0;
      const last = ds.data[ds.data.length - 1] ?? 0;
      const change = last - first;
      return `
    <tr>
      <td>${ds.name}</td>
      <td class="mono">${first}</td>
      <td class="mono">${last}</td>
      <td class="mono">${change > 0 ? "+" : ""}${change}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif;
      color: #0A0A0A;
      background: #FFFFFF;
      padding: 40px;
      max-width: 680px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #0A0A0A;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .logo {
      font-family: 'Syne', 'Georgia', serif;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 13px;
      color: #9A9A92;
      font-weight: 400;
      margin-top: 4px;
    }
    .report-date {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12px;
      color: #5A5A54;
      margin-top: 8px;
    }
    h2 {
      font-family: 'Syne', 'Georgia', serif;
      font-size: 22px;
      font-weight: 700;
      margin: 32px 0 16px 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: #F5F5F3;
      border: 1px solid #E0E0C5;
      padding: 20px;
    }
    .summary-card .label {
      font-size: 12px;
      color: #9A9A92;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 500;
    }
    .summary-card .value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 36px;
      font-weight: 700;
      margin-top: 4px;
    }
    .summary-card .sub {
      font-size: 12px;
      color: #5A5A54;
      margin-top: 2px;
    }
    .critical { border-left: 4px solid #0A0A0A; }
    .low { border-left: 4px solid #9A9A92; }
    .healthy { border-left: 4px solid #E0E0C5; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 32px 0;
    }
    th {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #9A9A92;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #0A0A0A;
      font-weight: 500;
    }
    td {
      font-size: 14px;
      padding: 10px 12px;
      border-bottom: 1px solid #E0E0C5;
    }
    td.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .status-critical {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      background: #0A0A0A;
      color: #FFFFFF;
      padding: 2px 8px;
      display: inline-block;
    }
    .status-low {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid #5A5A54;
      padding: 2px 8px;
      display: inline-block;
    }
    .status-ok {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #9A9A92;
      padding: 2px 8px;
      display: inline-block;
    }
    .footer {
      border-top: 1px solid #E0E0C5;
      padding-top: 20px;
      margin-top: 40px;
      font-size: 12px;
      color: #9A9A92;
    }
    .footer .logo-sm {
      font-family: 'Syne', serif;
      font-weight: 800;
      font-size: 14px;
      color: #0A0A0A;
    }
    .section-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #9A9A92;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">COUNTR.</div>
    <div class="tagline">${typeof window !== "undefined" && localStorage.getItem("countr_shop_name") ? localStorage.getItem("countr_shop_name") : "Precision Inventory Intelligence"}</div>
    <div class="report-date">REPORT GENERATED · ${scanDate}</div>
  </div>

  <div class="section-label">Inventory Overview</div>
  <div class="summary-grid">
    <div class="summary-card critical">
      <div class="label">Critical</div>
      <div class="value">${critical.length}</div>
      <div class="sub">≤ 1 day remaining</div>
    </div>
    <div class="summary-card low">
      <div class="label">Low Stock</div>
      <div class="value">${low.length}</div>
      <div class="sub">1–3 days remaining</div>
    </div>
    <div class="summary-card healthy">
      <div class="label">Healthy</div>
      <div class="value">${healthy.length}</div>
      <div class="sub">> 3 days remaining</div>
    </div>
  </div>

  <h2>Stock Status</h2>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Daily Use</th>
        <th>Days Left</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${depletionRows}
    </tbody>
  </table>

  <h2>7-Day Trends</h2>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>7d Ago</th>
        <th>Now</th>
        <th>Change</th>
      </tr>
    </thead>
    <tbody>
      ${trendRows}
    </tbody>
  </table>

  <div class="footer">
    <div class="logo-sm">COUNTR.</div>
    <div style="margin-top:4px;">Precision Inventory Intelligence · Generated automatically</div>
  </div>
</body>
</html>`;
}
