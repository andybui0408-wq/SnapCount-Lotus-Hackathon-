import { useState } from "react";
import { generateInventoryReportHTML } from "../services/reportGenerator";
import { getProductTrends, getDepletionData } from "../services/scanHistory";

const EMAIL_KEY = "countr_email";

interface Props {
  disabled?: boolean;
}

export default function EmailReportButton({ disabled }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const generateReport = () => {
    const trends = getProductTrends();
    const depletion = getDepletionData();
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    return { html: generateInventoryReportHTML(trends.datasets, depletion, dateStr), dateStr };
  };

  const handleSendViaMailApp = () => {
    if (!email.trim()) return;

    try {
      localStorage.setItem(EMAIL_KEY, email.trim());
      const { html, dateStr } = generateReport();

      // Build a plain-text summary from depletion data for the mailto body
      const depletion = getDepletionData();
      const lines = depletion.map(
        (d) => `${d.name}: ${d.currentStock} left (${d.daysLeft >= 999 ? "stable" : `~${d.daysLeft.toFixed(0)} days`}) [${d.status.toUpperCase()}]`,
      );
      const body = `COUNTR. Inventory Report — ${dateStr}\n\n${lines.join("\n")}\n\n(Full HTML report attached or view below)`;

      const subject = `COUNTR. Inventory Report — ${dateStr}`;
      const mailtoUrl = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, "_blank");

      // Also save full HTML report for download
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `COUNTR-Report-${dateStr.replace(/\//g, "-")}.html`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("success");
      setTimeout(() => {
        setShowModal(false);
        setStatus("idle");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate report");
    }
  };

  const handleDownloadOnly = () => {
    try {
      const { html, dateStr } = generateReport();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `COUNTR-Report-${dateStr.replace(/\//g, "-")}.html`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("success");
      setTimeout(() => {
        setShowModal(false);
        setStatus("idle");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate report");
    }
  };

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setShowModal(true)}
        disabled={disabled}
      >
        Email Report
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Send Report</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="text-secondary" style={{ fontSize: 12 }}>
                Opens your email app with a summary. Full report downloads as HTML.
              </p>
              <input
                type="email"
                placeholder="Recipient email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendViaMailApp()}
                style={{
                  width: "100%",
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--black)",
                  padding: "10px 12px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                }}
              />

              {status === "success" && (
                <div className="success-box">Report ready!</div>
              )}
              {status === "error" && (
                <div className="error-box">{errorMsg}</div>
              )}

              <button
                className="btn btn-primary btn-large"
                onClick={handleSendViaMailApp}
                disabled={!email.trim()}
              >
                Open Mail App
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleDownloadOnly}
                style={{ marginTop: 4 }}
              >
                Download Report Only
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
