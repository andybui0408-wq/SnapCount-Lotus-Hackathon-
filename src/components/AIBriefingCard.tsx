import { useState, useEffect, useCallback } from "react";
import { getDailyBriefing, clearBriefingCache } from "../services/dailyBriefing";

export default function AIBriefingCard() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const text = await getDailyBriefing();
      // Split into lines, filter empty ones for spacing
      setLines(text.split("\n"));
    } catch {
      setLines(["Could not load briefing. Try again later."]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const handleRefresh = () => {
    clearBriefingCache();
    fetchBriefing();
  };

  return (
    <div className="briefing-card">
      <div className="briefing-header">
        <div className="briefing-label">AI BRIEFING</div>
        <button className="briefing-refresh" onClick={handleRefresh} disabled={loading} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "briefing-spin" : ""}>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
      {loading ? (
        <div className="briefing-skeleton">
          <div className="skeleton-line" style={{ width: "90%" }} />
          <div className="skeleton-line" style={{ width: "75%" }} />
          <div className="skeleton-line" style={{ width: "60%" }} />
        </div>
      ) : (
        <div className="briefing-lines">
          {lines.map((line, i) =>
            line.trim() === "" ? (
              <div key={i} className="briefing-spacer" />
            ) : (
              <div
                key={i}
                className={`briefing-line ${line.startsWith("⚠") ? "briefing-line-critical" : line.startsWith("📦") ? "briefing-line-low" : ""}`}
              >
                {line}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
