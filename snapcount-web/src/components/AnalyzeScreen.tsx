import { useEffect, useRef, useState } from "react";
import { useInventoryAnalysis } from "../hooks/useInventoryAnalysis";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";
import { COLORS } from "../constants/config";
import type { MergedResult, MergedItem } from "../types";

interface Props {
  mode: "single" | "multi-angle";
  imageUris: string[];
  base64Images: string[];
  onBack: () => void;
  onRestock: (result: MergedResult) => void;
}

export function AnalyzeScreen({ mode, imageUris, base64Images, onBack, onRestock }: Props) {
  const { result, loading, error, progressText, analyzeSingle, analyzeMulti } = useInventoryAnalysis();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [expected, setExpected] = useState<Record<string, string>>({});
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 450 });

  useEffect(() => {
    if (base64Images.length === 0) return;
    if (mode === "single") analyzeSingle(base64Images[0]);
    else analyzeMulti(base64Images);
  }, []);

  useEffect(() => {
    const el = imgContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function confColor(c: string) {
    if (c === "high") return COLORS.accentLight;
    if (c === "medium") return COLORS.warning;
    return COLORS.danger;
  }

  const displayUri = imageUris[0] ?? "";
  const ocrCount = result?.ocrTexts?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: COLORS.background }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "40px 20px 12px", background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.accentLight, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
          ← Back
        </button>
        <span style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }}>
          {mode === "multi-angle" ? `Multi-Angle (${imageUris.length})` : "Analysis"}
        </span>
        <span style={{ width: 50 }} />
      </div>

      <div style={{ flex: 1, overflow: "auto", paddingBottom: 40 }}>
        <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
          {/* Image + overlay */}
          <div ref={imgContainerRef} style={{
            position: "relative", width: "100%", aspectRatio: "4/3", background: "#000",
          }}>
            {displayUri && <img src={displayUri} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
            {result && result.boundingBoxes.length > 0 && (
              <BoundingBoxOverlay
                predictions={result.boundingBoxes}
                imageWidth={result.imageWidth}
                imageHeight={result.imageHeight}
                containerWidth={containerSize.w}
                containerHeight={containerSize.h}
              />
            )}
            {loading && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div className="spinner" style={{ width: 40, height: 40, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accentLight, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <p style={{ color: COLORS.textPrimary, fontSize: 14, fontFamily: "monospace", marginTop: 16 }}>{progressText || "Processing..."}</p>
                <p style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>YOLO-World + Florence-2 + DINOv2</p>
              </div>
            )}
          </div>

          {/* Multi-angle thumbs */}
          {mode === "multi-angle" && imageUris.length > 1 && (
            <div style={{ display: "flex", gap: 8, padding: "8px 16px" }}>
              {imageUris.map((uri, i) => (
                <img key={i} src={uri} alt="" style={{ width: 56, height: 56, borderRadius: 8, border: `1px solid ${COLORS.border}`, objectFit: "cover" }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ margin: 16, padding: 16, background: COLORS.danger + "18", borderRadius: 12, border: `1px solid ${COLORS.danger}44`, textAlign: "center" }}>
              <p style={{ color: COLORS.danger, fontSize: 14, margin: "0 0 12px" }}>{error}</p>
              <button onClick={() => mode === "single" ? analyzeSingle(base64Images[0]) : analyzeMulti(base64Images)} style={{
                background: COLORS.accent, color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, fontWeight: 600, cursor: "pointer",
              }}>Retry</button>
            </div>
          )}

          {/* Results */}
          {result && (
            <>
              {/* Scene + inference time */}
              {result.sceneDescription && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "12px 16px" }}>
                  <p style={{ color: COLORS.textSecondary, fontSize: 13, fontStyle: "italic", flex: 1 }}>{result.sceneDescription}</p>
                  {result.inferenceTimeMs && (
                    <span style={{ color: COLORS.textSecondary, fontSize: 11, fontFamily: "monospace", marginLeft: 12, whiteSpace: "nowrap" }}>
                      {(result.inferenceTimeMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}

              {/* Summary cards — 4 cards */}
              <div style={{ display: "flex", gap: 6, padding: "16px 12px" }}>
                {[
                  { label: "Detected", value: result.totalBoxDetections, color: COLORS.accentLight, sub: "YOLO-World" },
                  { label: "Estimated", value: result.totalVisionEstimate, color: COLORS.textPrimary, sub: "Total" },
                  { label: "Hidden", value: result.occlusionDelta, color: COLORS.warning, sub: "Gemini AI" },
                  { label: "Labels", value: ocrCount, color: COLORS.info, sub: "Florence OCR" },
                ].map((c) => (
                  <div key={c.label} style={{
                    flex: 1, background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`,
                    padding: 12, textAlign: "center",
                  }}>
                    <div style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ color: c.color, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{c.value}</div>
                    <div style={{ color: COLORS.textSecondary, fontSize: 9, marginTop: 2 }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* OCR texts found */}
              {result.ocrTexts && result.ocrTexts.length > 0 && (
                <div style={{ margin: "0 16px 12px", padding: 12, background: COLORS.info + "14", borderRadius: 10, border: `1px solid ${COLORS.info}33` }}>
                  <div style={{ color: COLORS.info, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Labels Read from Products</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.ocrTexts.map((text, i) => (
                      <span key={i} style={{
                        padding: "3px 8px", borderRadius: 4, background: COLORS.info + "22",
                        color: COLORS.info, fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                      }}>{text}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-reference insights */}
              {result.crossReferenceInsights && (
                <div style={{ margin: "0 16px 12px", padding: 14, background: COLORS.info + "14", borderRadius: 12, border: `1px solid ${COLORS.info}33` }}>
                  <div style={{ color: COLORS.info, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Cross-Reference Insights</div>
                  <div style={{ color: COLORS.textPrimary, fontSize: 13, lineHeight: 1.5 }}>{result.crossReferenceInsights}</div>
                </div>
              )}

              {/* Occlusion */}
              {result.occlusionSeverity !== "none" && (
                <div style={{ margin: "0 16px 12px", padding: 10, background: COLORS.warning + "14", borderRadius: 8, border: `1px solid ${COLORS.warning}33` }}>
                  <div style={{ color: COLORS.warning, fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>Occlusion: {result.occlusionSeverity}</div>
                  {result.occlusionNotes && <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>{result.occlusionNotes}</div>}
                </div>
              )}

              {/* Items */}
              <h3 style={{ color: COLORS.textPrimary, fontSize: 17, fontWeight: 700, margin: "20px 16px 8px" }}>Inventory Items</h3>
              {result.items.map((item: MergedItem, i: number) => (
                <div key={i} onClick={() => setExpandedItem(expandedItem === i ? null : i)} style={{
                  margin: "0 16px 8px", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`,
                  padding: 14, cursor: "pointer",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <div style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                      {/* OCR labels */}
                      {item.ocrLabels && item.ocrLabels.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                          {item.ocrLabels.map((label, j) => (
                            <span key={j} style={{
                              padding: "2px 6px", borderRadius: 4, background: COLORS.info + "22",
                              color: COLORS.info, fontSize: 10, fontFamily: "monospace", fontWeight: 600,
                            }}>{label}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 12 }}>
                        {[
                          { l: "Visible", v: item.visibleCount, c: COLORS.textPrimary },
                          { l: "Hidden", v: item.hiddenCount, c: COLORS.warning },
                          { l: "Total", v: item.totalEstimate, c: COLORS.textPrimary },
                        ].map((x) => (
                          <span key={x.l} style={{ color: COLORS.textSecondary, fontSize: 12, fontFamily: "monospace" }}>
                            {x.l}: <strong style={{ color: x.c }}>{x.v}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                    <span style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      fontFamily: "monospace", textTransform: "uppercase",
                      color: confColor(item.confidence),
                      background: confColor(item.confidence) + "22",
                    }}>{item.confidence}</span>
                  </div>
                  {expandedItem === i && (
                    <p style={{
                      color: COLORS.textSecondary, fontSize: 12, marginTop: 10, lineHeight: 1.5,
                      borderTop: `1px solid ${COLORS.border}`, paddingTop: 10,
                    }}>{item.reasoning}</p>
                  )}
                </div>
              ))}

              {/* Actions */}
              <button onClick={() => onRestock(result)} style={{
                display: "block", width: "calc(100% - 32px)", margin: "20px 16px 0",
                padding: 16, borderRadius: 12, background: COLORS.accent, color: "#fff",
                fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
              }}>Generate Restock Order</button>

              <button onClick={() => setShowCompare(!showCompare)} style={{
                display: "block", width: "calc(100% - 32px)", margin: "12px 16px 0",
                padding: 14, borderRadius: 12, background: COLORS.surface, color: COLORS.accentLight,
                fontSize: 15, fontWeight: 600, border: `1px solid ${COLORS.accent}`, cursor: "pointer",
              }}>{showCompare ? "Hide Comparison" : "Compare with Expected"}</button>

              {showCompare && (
                <div style={{ margin: "12px 16px", background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 14 }}>
                  {result.items.map((item, i) => {
                    const exp = parseInt(expected[item.name] || "0", 10) || 0;
                    const diff = item.totalEstimate - exp;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ flex: 1, color: COLORS.textPrimary, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                        <input type="number" placeholder="0" value={expected[item.name] || ""} onChange={(e) => setExpected((p) => ({ ...p, [item.name]: e.target.value }))}
                          style={{
                            width: 60, background: COLORS.background, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                            color: COLORS.textPrimary, textAlign: "center", padding: "6px", fontSize: 14, fontFamily: "monospace", margin: "0 10px",
                          }}
                        />
                        <span style={{
                          width: 40, fontSize: 14, fontWeight: 700, fontFamily: "monospace", textAlign: "right",
                          color: diff === 0 ? COLORS.accentLight : diff > 0 ? COLORS.warning : COLORS.danger,
                        }}>{diff > 0 ? `+${diff}` : diff}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
