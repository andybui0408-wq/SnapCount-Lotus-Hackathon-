import type { MergedItem } from "../types";

const METHOD_BADGE: Record<string, { label: string; className: string }> = {
  catalog: { label: "Catalog", className: "badge-green" },
  dino: { label: "DINO", className: "badge-blue" },
  gemini: { label: "Gemini", className: "badge-purple" },
  consensus: { label: "Consensus", className: "badge-green" },
  unmatched: { label: "Unknown", className: "badge-amber" },
};

const CONF_COLORS: Record<string, string> = {
  high: "var(--black)",
  medium: "var(--charcoal)",
  low: "var(--stone)",
};

interface Props {
  items: MergedItem[];
}

export default function ResultsList({ items }: Props) {
  if (items.length === 0) return null;

  const hasConsensus = items.some(i => i.id_method === "consensus");

  return (
    <div className="results-list">
      <h3>Items Found</h3>
      {items.map((item, i) => {
        const badge = METHOD_BADGE[item.id_method] || METHOD_BADGE.unmatched;
        const confPct = item.confidence === "high" ? 100 : item.confidence === "medium" ? 65 : 30;
        const confColor = CONF_COLORS[item.confidence || "medium"] || CONF_COLORS.medium;

        return (
          <div key={i} className={`result-row ${hasConsensus ? "result-row-consensus" : ""}`}>
            <div className="result-info">
              <span className="result-name">{item.name}</span>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>

            {hasConsensus ? (
              <div className="result-consensus-detail">
                <div className="result-count-line">
                  <span className="result-count-breakdown">
                    {item.front_visible} across angles
                    {item.depth_visible > 0 && <> &middot; +{item.depth_visible} depth</>}
                    {" = "}
                  </span>
                  <span className="result-count">{item.total}</span>
                </div>

                {item.confidence && (
                  <div className="result-conf-row">
                    <div className="result-conf-bar">
                      <div
                        className="result-conf-fill"
                        style={{ width: `${confPct}%`, background: confColor }}
                      />
                    </div>
                    <span className="result-conf-label" style={{ color: confColor }}>
                      {item.confidence.toUpperCase()}
                    </span>
                  </div>
                )}

                {item.framesDetected != null && item.totalFrames != null && (
                  <span className="result-frame-info">
                    Seen in {item.framesDetected}/{item.totalFrames} frames
                    {item.spread != null && <> &middot; spread: {item.spread}</>}
                  </span>
                )}

                {item.adjusted && item.adjustment_reason && (
                  <span className="result-adjustment">
                    Adjusted: {item.adjustment_reason}
                  </span>
                )}
              </div>
            ) : (
              <div className="result-counts">
                <span className="result-count">{item.total}</span>
                {item.depth_visible > 0 && (
                  <span className="result-hidden">({item.front_visible}+{item.depth_visible})</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
