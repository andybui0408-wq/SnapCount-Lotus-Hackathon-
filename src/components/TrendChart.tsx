import { useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const COLORS = [
  "#0A0A0A", // black
  "#E63946", // red
  "#457B9D", // steel blue
  "#2A9D8F", // teal
  "#F4A261", // sandy brown
  "#6A4C93", // purple
];

interface Props {
  labels: string[];
  datasets: { name: string; data: number[] }[];
}

export default function TrendChart({ labels, datasets }: Props) {
  const [selected, setSelected] = useState("all");

  const visibleDatasets =
    selected === "all"
      ? datasets.slice(0, 5) // cap at 5 when showing all
      : datasets.filter((ds) => ds.name === selected);

  const chartData = {
    labels,
    datasets: visibleDatasets.map((ds, i) => {
      const originalIdx = datasets.indexOf(ds);
      const colorIdx = selected === "all" ? i : originalIdx;
      return {
        label: ds.name,
        data: ds.data,
        borderColor: COLORS[colorIdx % COLORS.length],
        backgroundColor: COLORS[colorIdx % COLORS.length] + "22",
        tension: 0.3,
        pointRadius: selected === "all" ? 2 : 4,
        borderWidth: selected === "all" ? 1.5 : 2.5,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: selected === "all" && visibleDatasets.length > 1,
        position: "bottom" as const,
        labels: {
          color: "#5A5A54",
          font: { size: 10, family: "'JetBrains Mono', monospace" },
          boxWidth: 10,
          padding: 8,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#9A9A92",
          font: { size: 10, family: "'JetBrains Mono', monospace" },
        },
        grid: { color: "rgba(224,224,197,0.3)" },
      },
      y: {
        ticks: {
          color: "#9A9A92",
          font: { size: 10, family: "'JetBrains Mono', monospace" },
        },
        grid: { color: "rgba(224,224,197,0.3)" },
        beginAtZero: true,
      },
    },
  };

  return (
    <div>
      <select
        className="chart-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="all">All Products (top 5)</option>
        {datasets.map((ds) => (
          <option key={ds.name} value={ds.name}>
            {ds.name}
          </option>
        ))}
      </select>
      <div className="chart-wrapper">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
