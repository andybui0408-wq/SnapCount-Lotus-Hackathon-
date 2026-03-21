import type { RestockItem, Supplier } from "../types";
import { formatVND } from "./scanHistory";

export function generateZaloMessage(
  items: RestockItem[],
  supplier: Supplier,
  totalCost: number
): string {
  const lines = items.map(
    (item) =>
      `- ${item.name}: ${item.qty} (${formatVND(item.unitPrice * item.qty)})`
  );

  return [
    `Chào ${supplier.name},`,
    ``,
    `Em muốn đặt hàng:`,
    ...lines,
    ``,
    `Tổng cộng: ${formatVND(totalCost)}`,
    ``,
    `Nhờ anh/chị xác nhận giúp em. Cảm ơn!`,
  ].join("\n");
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function openZaloLink(phone: string): void {
  const cleaned = phone.replace(/\D/g, "");
  window.open(`https://zalo.me/${cleaned}`, "_blank");
}
