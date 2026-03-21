// src/services/zaloMessenger.ts

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  categories: string[];
}

const SUPPLIERS_KEY = "snapcount_suppliers";

// --- Supplier management ---

export function getSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSupplier(supplier: Supplier): void {
  const suppliers = getSuppliers();
  const existing = suppliers.findIndex((s) => s.id === supplier.id);
  if (existing >= 0) {
    suppliers[existing] = supplier;
  } else {
    suppliers.push(supplier);
  }
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
}

export function removeSupplier(id: string): void {
  const suppliers = getSuppliers().filter((s) => s.id !== id);
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
}

// --- Demo suppliers ---

export function seedDemoSuppliers(): void {
  if (getSuppliers().length > 0) return;

  const demoSuppliers: Supplier[] = [
    {
      id: crypto.randomUUID(),
      name: "Đại lý nước giải khát Minh Phát",
      phone: "0912345678",
      categories: ["drinks", "beer"],
    },
    {
      id: crypto.randomUUID(),
      name: "Cửa hàng thực phẩm Hương Giang",
      phone: "0987654321",
      categories: ["food", "noodles", "snacks"],
    },
    {
      id: crypto.randomUUID(),
      name: "NPP Bia Tiger khu vực HCM",
      phone: "0909876543",
      categories: ["beer"],
    },
  ];

  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(demoSuppliers));
}

// --- Zalo messaging ---

export async function copyAndOpenZalo(
  supplier: Supplier,
  message: string
): Promise<{ success: boolean; method: string }> {
  try {
    // Step 1: Copy message to clipboard
    await navigator.clipboard.writeText(message);

    // Step 2: Open Zalo chat with supplier's phone number
    // zalo.me/PHONE opens the Zalo app or web chat
    const zaloUrl = `https://zalo.me/${supplier.phone}`;
    window.open(zaloUrl, "_blank");

    return { success: true, method: "clipboard+zalo_deeplink" };
  } catch (err) {
    // Fallback: if clipboard API fails (non-HTTPS), use textarea trick
    try {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      window.open(`https://zalo.me/${supplier.phone}`, "_blank");
      return { success: true, method: "fallback_copy+zalo_deeplink" };
    } catch {
      return { success: false, method: "failed" };
    }
  }
}

// Format VND currency the Vietnamese way
export function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}
