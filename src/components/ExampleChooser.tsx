import { RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { exampleProjectDefinitions, type ExampleProjectId } from "../data/examples";
import { useAppStore } from "../store/useAppStore";

export function ExampleChooser() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const loadExampleProject = useAppStore((state) => state.loadExampleProject);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const choose = (exampleId: ExampleProjectId, name: string) => {
    if (!window.confirm(`Replace the active project with “${name}”? Other projects and snapshots will be retained.`)) return;
    loadExampleProject(exampleId);
    setOpen(false);
  };

  return <>
    <button ref={triggerRef} className="btn" onClick={() => setOpen(true)}><RotateCcw size={15} /> Load example</button>
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 text-left shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="example-chooser-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="example-chooser-title" className="text-lg font-bold text-slate-950">Load an example</h2>
            <p className="mt-1 text-sm text-slate-600">The selected example replaces only the active project.</p>
          </div>
          <button ref={closeRef} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close example chooser" onClick={close}><X size={18} /></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {exampleProjectDefinitions.map((example) => <button key={example.id} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => choose(example.id, example.name)}>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700">{example.purpose}</span>
            <span className="mt-1 block font-bold text-slate-950">{example.name}</span>
            <span className="mt-2 block text-sm leading-5 text-slate-600">{example.description}</span>
          </button>)}
        </div>
      </section>
    </div>}
  </>;
}
