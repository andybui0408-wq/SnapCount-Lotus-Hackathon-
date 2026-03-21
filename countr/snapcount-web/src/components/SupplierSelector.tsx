import type { Supplier } from "../types";

interface Props {
  suppliers: Supplier[];
  selected: Supplier | null;
  onSelect: (supplier: Supplier) => void;
}

export default function SupplierSelector({ suppliers, selected, onSelect }: Props) {
  return (
    <div className="supplier-selector">
      <label>Nhà cung cấp</label>
      <select
        value={selected?.id || ""}
        onChange={(e) => {
          const s = suppliers.find((s) => s.id === e.target.value);
          if (s) onSelect(s);
        }}
      >
        <option value="">Chọn nhà cung cấp...</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {s.phone} ({s.category})
          </option>
        ))}
      </select>
    </div>
  );
}
