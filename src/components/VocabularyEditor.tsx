import { useState } from "react";
import { getVocabulary, setVocabulary } from "../services/groundingDinoAPI";

interface Props {
  onClose: () => void;
}

export default function VocabularyEditor({ onClose }: Props) {
  const [items, setItems] = useState<string[]>(getVocabulary());
  const [newItem, setNewItem] = useState("");
  const [saved, setSaved] = useState(false);

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems([...items, trimmed]);
    setNewItem("");
  };

  const handleRemove = (item: string) => {
    setItems(items.filter((i) => i !== item));
  };

  const handleSave = () => {
    setVocabulary(items);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Detection Vocabulary</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="text-secondary" style={{ fontSize: 12 }}>
            Each item becomes a Grounding DINO text prompt for product detection.
          </p>
          <div className="vocab-input-row">
            <input
              type="text"
              placeholder="Add product name..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newItem.trim()}>
              Add
            </button>
          </div>
          <div className="vocab-list">
            {items.map((item) => (
              <div key={item} className="vocab-item">
                <span>{item}</span>
                <button className="vocab-remove" onClick={() => handleRemove(item)}>×</button>
              </div>
            ))}
          </div>
          <p className="vocab-count">{items.length} prompts</p>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? "Saved!" : "Save Vocabulary"}
          </button>
        </div>
      </div>
    </div>
  );
}
