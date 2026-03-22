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
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const generateReport = () => {
    const trends = getProductTrends();
    const depletion = getDepletionData();
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    return { html: generateInventoryReportHTML(trends.datasets, depletion, dateStr), dateStr };
  };

  const handleSend = async () => {
    if (!email.trim()) return;
    setStatus("sending");

    try {
      localStorage.setItem(EMAIL_KEY, email.trim());
      const { html, dateStr } = generateReport();

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.trim(),
          subject: `COUNTR. Inventory Report — ${dateStr}`,
          html,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      setStatus("success");
      setTimeout(() => {
        setShowModal(false);
        setStatus("idle");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send email");
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
                Send the inventory report directly to your email.
              </p>
              <input
                type="email"
                placeholder="Recipient email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
                <div className="success-box">Report sent!</div>
              )}
              {status === "error" && (
                <div className="error-box">{errorMsg}</div>
              )}

              <button
                className="btn btn-primary btn-large"
                onClick={handleSend}
                disabled={!email.trim() || status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Send Email"}
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
