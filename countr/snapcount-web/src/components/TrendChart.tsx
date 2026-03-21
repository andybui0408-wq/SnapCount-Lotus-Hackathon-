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
  "#34d399", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa",
  "#fb923c", "#38bdf8", "#4ade80",
];

interface Props {
  labels: string[];
  datasets: { name: string; data: number[] }[];
}

export default function TrendChart({ labels, datasets }: Props) {
  const chartData = {
    labels,
    datasets: datasets.map((ds, i) => ({
      label: ds.name,
      data: ds.data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + "33",
      tension: 0.3,
      pointRadius: 3,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#e2e8e0", font: { size: 11 } },
      },
    },
    scales: {
      x: {
        ticks: { color: "#6b8f7b" },
        grid: { color: "#1a2722" },
      },
      y: {
        ticks: { color: "#6b8f7b" },
        grid: { color: "#1a2722" },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="chart-wrapper">
      <Line data={chartData} options={options} />
    </div>
  );
}
