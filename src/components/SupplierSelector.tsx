import type { Supplier } from "../types";

interface Props {
  suppliers: Supplier[];
  selected: Supplier | null;
  onSelect: (supplier: Supplier) => void;
}

export default function SupplierSelector({ suppliers, selected, onSelect }: Props) {
  return (
    <div className="supplier-selector">
      <label>Supplier</label>
      <select
        value={selected?.id || ""}
        onChange={(e) => {
          const s = suppliers.find((s) => s.id === e.target.value);
          if (s) onSelect(s);
        }}
      >
        <option value="">Select supplier...</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {s.phone} ({s.category})
          </option>
        ))}
      </select>
    </div>
  );
}
