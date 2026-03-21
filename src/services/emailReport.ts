export async function sendInventoryReport(
  recipientEmail: string,
  reportHTML: string,
  subject: string,
): Promise<void> {
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipientEmail,
      subject,
      html: reportHTML,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to send email" }));
    throw new Error(data.error || `Email failed (${res.status})`);
  }
}
