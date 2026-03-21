import { useState } from "react";
import { generateRestockOrder } from "../services/restockAgent";
import { generateZaloMessage } from "../services/zaloMessenger";
import { getSuppliers } from "../services/scanHistory";
import type { RestockItem, Supplier, RestockOrder } from "../types";

type Stage = "idle" | "generating" | "review" | "confirmed";

export function useRestockOrder() {
  const [stage, setStage] = useState<Stage>("idle");
  const [order, setOrder] = useState<RestockOrder>({
    items: [],
    supplier: null,
    totalCost: 0,
    generatedAt: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const suppliers = getSuppliers();

  const generate = async () => {
    setStage("generating");
    setError(null);
    try {
      const items = await generateRestockOrder();
      const totalCost = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
      setOrder({
        items,
        supplier: suppliers[0] || null,
        totalCost,
        generatedAt: Date.now(),
      });
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate order");
      setStage("idle");
    }
  };

  const updateQty = (index: number, qty: number) => {
    setOrder((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], qty };
      const totalCost = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
      return { ...prev, items, totalCost };
    });
  };

  const selectSupplier = (supplier: Supplier) => {
    setOrder((prev) => ({ ...prev, supplier }));
  };

  const confirm = () => setStage("confirmed");
  const reset = () => {
    setStage("idle");
    setOrder({ items: [], supplier: null, totalCost: 0, generatedAt: 0 });
  };

  const zaloMessage =
    order.supplier
      ? generateZaloMessage(order.items, order.supplier, order.totalCost)
      : "";

  return {
    stage,
    order,
    error,
    suppliers,
    zaloMessage,
    generate,
    updateQty,
    selectSupplier,
    confirm,
    reset,
  };
}
