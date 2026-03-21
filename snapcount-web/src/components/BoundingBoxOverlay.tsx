import type { BoundingBox } from "../types";
import { COLORS } from "../constants/config";

interface Props {
  predictions: BoundingBox[];
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
}

function idColor(method?: string): string {
  if (method === "catalog") return COLORS.accentLight; // green — highest confidence
  if (method === "yoloworld") return COLORS.info;      // blue — YOLO-World
  return COLORS.warning;                                // amber — unmatched
}

function idBadge(method?: string): string {
  if (method === "catalog") return "CAT";
  if (method === "yoloworld") return "YOLO";
  return "?";
}

export function BoundingBoxOverlay({ predictions, imageWidth, imageHeight, containerWidth, containerHeight }: Props) {
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {predictions.map((pred, i) => {
        const left = (pred.x - pred.width / 2) * scaleX;
        const top = (pred.y - pred.height / 2) * scaleY;
        const w = pred.width * scaleX;
        const h = pred.height * scaleY;
        const color = idColor(pred.id_method);
        const label = pred.class.length > 25 ? pred.class.slice(0, 25) + "..." : pred.class;
        const badge = idBadge(pred.id_method);
        const simText = pred.catalog_similarity && pred.catalog_similarity > 0
          ? ` ${Math.round(pred.catalog_similarity * 100)}%`
          : ` ${Math.round(pred.confidence * 100)}%`;

        return (
          <div key={i} style={{
            position: "absolute", left, top, width: w, height: h,
            border: `2px solid ${color}`, borderRadius: 4,
          }}>
            <span style={{
              position: "absolute", top: -18, left: -2,
              background: color, color: "#000",
              fontSize: 10, fontWeight: 700, fontFamily: "monospace",
              padding: "1px 4px", borderRadius: 2, whiteSpace: "nowrap",
              display: "flex", gap: 3, alignItems: "center",
            }}>
              <span style={{
                background: "rgba(0,0,0,0.3)", padding: "0 3px", borderRadius: 2,
                fontSize: 8, fontWeight: 800,
              }}>{badge}</span>
              {label}{simText}
            </span>
            {pred.ocr_text && (
              <span style={{
                position: "absolute", bottom: -16, left: -2,
                background: COLORS.info, color: "#000",
                fontSize: 9, fontWeight: 600, fontFamily: "monospace",
                padding: "1px 4px", borderRadius: 2, whiteSpace: "nowrap",
              }}>
                {pred.ocr_text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
