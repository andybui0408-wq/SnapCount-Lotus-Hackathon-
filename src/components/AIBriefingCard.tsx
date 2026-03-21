import { useState, useEffect } from "react";
import { getDailyBriefing } from "../services/dailyBriefing";

export default function AIBriefingCard() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDailyBriefing()
      .then(setText)
      .catch(() => setText("Could not load briefing. Try again later."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="briefing-card">
      <div className="briefing-label">AI BRIEFING</div>
      {loading ? (
        <div className="briefing-skeleton">
          <div className="skeleton-line" style={{ width: "90%" }} />
          <div className="skeleton-line" style={{ width: "75%" }} />
          <div className="skeleton-line" style={{ width: "60%" }} />
        </div>
      ) : (
        <div className="briefing-text">{text}</div>
      )}
    </div>
  );
}
