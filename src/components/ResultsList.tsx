import type { MergedItem } from "../types";

const METHOD_BADGE: Record<string, { label: string; className: string }> = {
  catalog: { label: "Catalog", className: "badge-green" },
  "grounding-dino": { label: "DINO", className: "badge-blue" },
  gemini: { label: "Gemini", className: "badge-purple" },
  unmatched: { label: "Unknown", className: "badge-amber" },
};

interface Props {
  items: MergedItem[];
}

export default function ResultsList({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="results-list">
      <h3>Items Found</h3>
      {items.map((item, i) => {
        const badge = METHOD_BADGE[item.id_method] || METHOD_BADGE.unmatched;
        return (
          <div key={i} className="result-row">
            <div className="result-info">
              <span className="result-name">{item.name}</span>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>
            <div className="result-counts">
              <span className="result-count">{item.total}</span>
              {item.depth_visible > 0 && (
                <span className="result-hidden">({item.front_visible}+{item.depth_visible})</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
