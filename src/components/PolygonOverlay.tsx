import { useState, useRef, useEffect } from "react";
import type { MergedPrediction, MergedItem } from "../types";

interface Props {
  imageSrc: string;
  predictions: MergedPrediction[];
  imageWidth: number;
  imageHeight: number;
  items?: MergedItem[];
}

// Colors by identification method
const METHOD_COLORS: Record<string, { fill: string; stroke: string }> = {
  catalog: { fill: "rgba(5,150,105,0.25)", stroke: "#34d399" },
  sam3: { fill: "rgba(96,165,250,0.25)", stroke: "#60a5fa" },
  unmatched: { fill: "rgba(251,191,36,0.25)", stroke: "#fbbf24" },
};

function getColor(method: string) {
  return METHOD_COLORS[method] || METHOD_COLORS.sam3;
}

function polygonCentroid(points: number[][]): { cx: number; cy: number } {
  let cx = 0, cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  return { cx: cx / points.length, cy: cy / points.length };
}

export default function PolygonOverlay({ imageSrc, predictions, imageWidth, imageHeight, items }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Track rendered image size for scaling
  useEffect(() => {
    const updateSize = () => {
      if (imgRef.current) {
        setDisplaySize({
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
        });
      }
    };

    const img = imgRef.current;
    if (img) {
      if (img.complete) updateSize();
      img.addEventListener("load", updateSize);
      window.addEventListener("resize", updateSize);
    }

    return () => {
      if (img) img.removeEventListener("load", updateSize);
      window.removeEventListener("resize", updateSize);
    };
  }, [imageSrc]);

  const scaleX = displaySize.width / (imageWidth || 1);
  const scaleY = displaySize.height / (imageHeight || 1);

  // Build count map from items
  const countMap = new Map<string, number>();
  if (items) {
    for (const item of items) {
      countMap.set(item.name.toLowerCase(), item.total);
    }
  }

  return (
    <div ref={containerRef} className="polygon-overlay-container">
      <img
        ref={imgRef}
        src={imageSrc}
        alt="Scan result"
        className="polygon-overlay-img"
      />
      {displaySize.width > 0 && (
        <svg
          className="polygon-overlay-svg"
          width={displaySize.width}
          height={displaySize.height}
          viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
        >
          {predictions.map((pred, i) => {
            if (!pred.polygon || pred.polygon.length < 3) return null;

            const color = getColor(pred.id_method);
            const scaled = pred.polygon.map(([x, y]) => [x * scaleX, y * scaleY]);
            const pointsStr = scaled.map(([x, y]) => `${x},${y}`).join(" ");
            const { cx, cy } = polygonCentroid(scaled);

            const displayName = pred.catalog_match || pred.class;
            const count = countMap.get(pred.class.toLowerCase());
            const label = count ? `${displayName} x${count}` : displayName;
            const conf = pred.confidence >= 0.01 ? ` ${Math.round(pred.confidence * 100)}%` : "";

            return (
              <g key={i}>
                <polygon
                  points={pointsStr}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="2"
                />
                <rect
                  x={cx - 4}
                  y={cy - 10}
                  width={Math.max((label.length + conf.length) * 6.5 + 12, 40)}
                  height={18}
                  rx="4"
                  fill="rgba(0,0,0,0.75)"
                />
                <text
                  x={cx + 2}
                  y={cy + 3}
                  fill="white"
                  fontSize="11"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="600"
                >
                  {label}{conf}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
