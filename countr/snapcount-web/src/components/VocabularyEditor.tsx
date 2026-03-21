import { useState } from "react";
import { getVocabulary, setVocabulary } from "../services/groundingDinoAPI";

interface Props {
  onClose: () => void;
}

export default function VocabularyEditor({ onClose }: Props) {
  const [vocabText, setVocabText] = useState(getVocabulary());
  const [saved, setSaved] = useState(false);

  const classes = vocabText.split(".").map((s) => s.trim()).filter(Boolean);

  const handleSave = () => {
    setVocabulary(vocabText);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Grounding DINO Vocabulary</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="text-secondary" style={{ fontSize: 12 }}>
            Period-separated product names. Example: "Coca-Cola can. Fanta bottle."
          </p>
          <textarea
            className="vocab-textarea"
            value={vocabText}
            onChange={(e) => setVocabText(e.target.value)}
            rows={10}
          />
          <p className="vocab-count">{classes.length} classes</p>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? "Saved!" : "Save Vocabulary"}
          </button>
        </div>
      </div>
    </div>
  );
}
