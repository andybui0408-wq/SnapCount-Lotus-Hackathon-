import type { MergedItem } from "../types";

interface Props {
  items: MergedItem[];
}

export default function ResultsList({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="results-list">
      <h3>Items Found</h3>
      {items.map((item, i) => (
        <div key={i} className="result-row">
          <span className="result-name">{item.name}</span>
          <span className="result-count">{item.total}</span>
        </div>
      ))}
    </div>
  );
}
