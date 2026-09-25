import { Save, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

export function SideEditor({
  title,
  eyebrow,
  children,
  onSave,
  onCancel,
  onDelete,
  saveLabel = "Save"
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saveLabel?: string;
}) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full overflow-auto border-l border-slate-200 bg-white shadow-2xl sm:w-[460px]" aria-label={`${title} editor`}>
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white p-4">
        <div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{eyebrow}</div><h2 className="truncate text-lg font-bold">{title}</h2></div>
        <button className="btn p-2" aria-label="Close editor" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="space-y-4 p-4">{children}</div>
      <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white p-4">
        <button className="btn btn-primary flex-1" onClick={onSave}><Save size={15} /> {saveLabel}</button>
        <button className="btn flex-1" onClick={onCancel}>Cancel</button>
        {onDelete && <button className="btn btn-danger" aria-label={`Delete ${title}`} onClick={onDelete}><Trash2 size={15} /></button>}
      </div>
    </aside>
  );
}
