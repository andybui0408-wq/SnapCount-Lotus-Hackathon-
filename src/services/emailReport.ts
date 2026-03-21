import emailjs from "@emailjs/browser";
import { EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID } from "../constants/config";

let initialized = false;

function ensureInit() {
  if (!initialized && EMAILJS_PUBLIC_KEY) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    initialized = true;
  }
}

export async function sendInventoryReport(
  recipientEmail: string,
  reportHTML: string,
  subject: string,
): Promise<void> {
  ensureInit();

  if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
    throw new Error("EmailJS not configured. Set VITE_EMAILJS_* in .env");
  }

  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: recipientEmail,
    subject,
    html_content: reportHTML,
  });
}
