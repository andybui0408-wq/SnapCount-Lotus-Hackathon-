import { useState, useCallback } from "react";
import { generateLocalRestock } from "../services/localRestock";
import type { RestockOrder, MergedResult } from "../types";

type Status = "idle" | "generating" | "review" | "confirmed" | "error";

export function useRestockOrder() {
  const [status, setStatus] = useState<Status>("idle");
  const [order, setOrder] = useState<RestockOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedQty, setEditedQty] = useState<Record<string, number>>({});

  const generate = useCallback((scanResult: MergedResult) => {
    setStatus("generating");
    try {
      const o = generateLocalRestock(scanResult);
      const qty: Record<string, number> = {};
      o.items.forEach((i) => (qty[i.name] = i.reorder_quantity));
      setOrder(o);
      setEditedQty(qty);
      setStatus("review");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  const updateQuantity = useCallback((name: string, val: number) => {
    setEditedQty((p) => ({ ...p, [name]: val }));
  }, []);

  const removeItem = useCallback((name: string) => {
    setOrder((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((i) => i.name !== name) };
    });
    setEditedQty((p) => { const n = { ...p }; delete n[name]; return n; });
  }, []);

  const confirm = useCallback(() => {
    if (!order) return;
    const finalItems = order.items.map((item) => {
      const qty = editedQty[item.name] ?? item.reorder_quantity;
      return { ...item, reorder_quantity: qty, estimated_line_total_vnd: qty * item.estimated_unit_cost_vnd };
    });
    const totalVnd = finalItems.reduce((s, i) => s + i.estimated_line_total_vnd, 0);
    const totalQty = finalItems.reduce((s, i) => s + i.reorder_quantity, 0);
    setOrder({
      ...order,
      items: finalItems,
      total_items_to_order: totalQty,
      estimated_total_cost_vnd: totalVnd,
      estimated_total_cost_usd: Math.round((totalVnd / 25000) * 100) / 100,
    });
    setStatus("confirmed");
  }, [order, editedQty]);

  const resetOrder = useCallback(() => {
    setStatus("idle");
    setOrder(null);
    setError(null);
    setEditedQty({});
  }, []);

  return { status, order, error, editedQty, generate, updateQuantity, removeItem, confirm, resetOrder };
}
