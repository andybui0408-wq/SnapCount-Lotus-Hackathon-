import { useState } from "react";
import { sendInventoryReport } from "../services/emailReport";
import { generateInventoryReportHTML } from "../services/reportGenerator";
import { getProductTrends, getDepletionData } from "../services/scanHistory";

const EMAIL_KEY = "countr_email";

interface Props {
  disabled?: boolean;
}

export default function EmailReportButton({ disabled }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async () => {
    if (!email.trim()) return;

    setSending(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      localStorage.setItem(EMAIL_KEY, email.trim());

      const trends = getProductTrends();
      const depletion = getDepletionData();
      const now = new Date();
      const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

      const html = generateInventoryReportHTML(trends.datasets, depletion, dateStr);
      await sendInventoryReport(email.trim(), html, `COUNTR. Inventory Report — ${dateStr}`);

      setStatus("success");
      setTimeout(() => {
        setShowModal(false);
        setStatus("idle");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
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
        <div className="modal-overlay" onClick={() => !sending && setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Email Report</h2>
              <button className="modal-close" onClick={() => setShowModal(false)} disabled={sending}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="text-secondary" style={{ fontSize: 12 }}>
                Send a branded inventory report with stock status and trends.
              </p>
              <input
                type="email"
                placeholder="Email address..."
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
                disabled={sending || !email.trim()}
              >
                {sending ? "Sending..." : "Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
