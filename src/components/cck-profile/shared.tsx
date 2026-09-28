import { Pencil, Check, X } from "lucide-react";

// Pink accent color for CCK hub
export const PINK = "#e83e8c";
export const PINK_SUBTLE = "rgba(232,62,140,0.15)";
export const PINK_BORDER = "rgba(232,62,140,0.3)";

export const STATUSES = [
  "Active",
  "Trialing",
  "Past Due",
  "Canceled",
  "Non-Member",
];

export const formatDateStr = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "bg-emerald-500 text-white";
    case "Trialing":
      return "bg-blue-500 text-white";
    case "Past Due":
      return "bg-orange-500 text-white";
    case "Canceled":
      return "bg-red-500 text-white";
    case "Non-Member":
      return "bg-gray-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export function EditToggle({
  editing,
  onEdit,
  onSave,
  onCancel,
}: {
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <button
        onClick={onEdit}
        style={{ color: "rgba(232,62,140,0.6)" }}
        className="hover:opacity-100 transition-opacity p-1 rounded"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onSave}
        className="text-emerald-400 hover:text-emerald-300 transition-colors p-1 rounded"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="text-red-400 hover:text-red-300 transition-colors p-1 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
