import { copyToClipboard, openZaloLink } from "../services/zaloMessenger";
import { useState } from "react";

interface Props {
  message: string;
  phone: string;
}

export default function ZaloSendButton({ message, phone }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="zalo-actions">
      <button className="btn btn-secondary" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy Message"}
      </button>
      <button className="btn btn-primary" style={{ width: "auto", padding: "10px 20px" }} onClick={() => openZaloLink(phone)}>
        Send via Zalo
      </button>
    </div>
  );
}
