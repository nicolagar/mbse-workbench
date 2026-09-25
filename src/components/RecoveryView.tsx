import { AlertTriangle, Download, RotateCcw } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useDialogs } from "./dialogs/DialogProvider";

export function RecoveryView() {
  const raw = useAppStore((state) => state.corruptRaw);
  const error = useAppStore((state) => state.recoveryError);
  const recover = useAppStore((state) => state.recoverFromCorruptStorage);
  const { confirm } = useDialogs();
  if (raw === undefined) return null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mbse-mbple-workbench-corrupt-storage.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-8">
      <section className="card max-w-2xl p-8" aria-labelledby="recovery-title">
        <AlertTriangle className="mb-4 text-amber-600" size={36} />
        <h1 id="recovery-title" className="text-2xl font-bold text-slate-900">Local data needs recovery</h1>
        <p className="mt-3 text-slate-600">The stored application data is invalid and has not been overwritten.</p>
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>
        <div className="mt-6 flex gap-3">
          <button className="btn" onClick={download}><Download size={16} /> Download raw stored value</button>
          <button className="btn btn-primary" onClick={async () => {
            if (await confirm("Reset local data and load the editable sample project? The corrupt value will be removed.", { confirmLabel: "Reset", tone: "danger" })) recover();
          }}><RotateCcw size={16} /> Reset to sample</button>
        </div>
      </section>
    </main>
  );
}
