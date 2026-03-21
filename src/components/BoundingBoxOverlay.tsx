import { useRef, useEffect } from "react";
import type { MergedPrediction, MergedItem } from "../types";

interface Props {
  imageSrc: string;
  predictions: MergedPrediction[];
  imageWidth: number;
  imageHeight: number;
  items?: MergedItem[];
}

// Distinct colors for different product groups
const GROUP_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function BoundingBoxOverlay({ imageSrc, predictions, imageWidth, imageHeight, items }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      console.log("[BBoxOverlay] img=%dx%d, props=%dx%d, predictions=%d",
        img.width, img.height, imageWidth, imageHeight, predictions.length);

      const scaleX = img.width / imageWidth;
      const scaleY = img.height / imageHeight;
      const lineW = Math.max(2, Math.round(img.width / 400));
      const fontSize = Math.max(13, Math.round(img.width / 70));

      // Build a count map from items for labels
      const countMap = new Map<string, number>();
      if (items) {
        for (const item of items) {
          countMap.set(item.name.toLowerCase(), item.total);
        }
      }

      // Assign a color per unique label
      const labelColors = new Map<string, string>();
      let colorIdx = 0;
      for (const pred of predictions) {
        const key = pred.class.toLowerCase();
        if (!labelColors.has(key)) {
          labelColors.set(key, GROUP_COLORS[colorIdx % GROUP_COLORS.length]);
          colorIdx++;
        }
      }

      for (let pi = 0; pi < predictions.length; pi++) {
        const pred = predictions[pi];
        const pts = pred.polygon;
        if (!pts || pts.length < 3) {
          console.warn("[BBoxOverlay] skip pred %d: pts=%o", pi, pts);
          continue;
        }

        // Scale polygon points
        const scaled = pts.map(([px, py]) => [px * scaleX, py * scaleY]);
        if (pi < 3) console.log("[BBoxOverlay] pred %d '%s': pts=%o scaled=%o", pi, pred.class, pts, scaled);

        const color = labelColors.get(pred.class.toLowerCase()) || GROUP_COLORS[0];
        const count = countMap.get(pred.class.toLowerCase());
        const displayName = pred.class.length > 25 ? pred.class.slice(0, 25) + "…" : pred.class;
        const label = count ? `${displayName} ×${count}` : displayName;

        // Draw polygon path
        ctx.beginPath();
        ctx.moveTo(scaled[0][0], scaled[0][1]);
        for (let i = 1; i < scaled.length; i++) {
          ctx.lineTo(scaled[i][0], scaled[i][1]);
        }
        ctx.closePath();

        // Semi-transparent fill
        ctx.fillStyle = hexToRgba(color, 0.15);
        ctx.fill();

        // Dashed polygon border
        ctx.strokeStyle = color;
        ctx.lineWidth = lineW;
        ctx.setLineDash([lineW * 3, lineW * 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Find top-left point for label placement
        const minX = Math.min(...scaled.map((p) => p[0]));
        const minY = Math.min(...scaled.map((p) => p[1]));

        // Label background pill
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
        const tm = ctx.measureText(label);
        const padX = Math.round(fontSize * 0.45);
        const padY = Math.round(fontSize * 0.3);
        const labelH = fontSize + padY * 2;
        const labelW = tm.width + padX * 2;

        const labelX = minX + lineW;
        const labelY = minY + lineW;

        // Rounded rectangle background
        const r = Math.round(fontSize * 0.25);
        ctx.fillStyle = hexToRgba(color, 0.92);
        ctx.beginPath();
        ctx.moveTo(labelX + r, labelY);
        ctx.lineTo(labelX + labelW - r, labelY);
        ctx.quadraticCurveTo(labelX + labelW, labelY, labelX + labelW, labelY + r);
        ctx.lineTo(labelX + labelW, labelY + labelH - r);
        ctx.quadraticCurveTo(labelX + labelW, labelY + labelH, labelX + labelW - r, labelY + labelH);
        ctx.lineTo(labelX + r, labelY + labelH);
        ctx.quadraticCurveTo(labelX, labelY + labelH, labelX, labelY + labelH - r);
        ctx.lineTo(labelX, labelY + r);
        ctx.quadraticCurveTo(labelX, labelY, labelX + r, labelY);
        ctx.closePath();
        ctx.fill();

        // Label text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, labelX + padX, labelY + fontSize + padY * 0.35);
      }
    };
    img.src = imageSrc;
  }, [imageSrc, predictions, imageWidth, imageHeight, items]);

  return (
    <div className="bbox-container">
      <canvas ref={canvasRef} className="bbox-canvas" />
    </div>
  );
}
