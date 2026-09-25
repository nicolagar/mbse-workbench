import { Boxes, MessageSquareText } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";

export function PerspectiveSelection() {
  const setPerspective = useAppStore((state) => state.setPerspective);
  const architectButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => architectButtonRef.current?.focus(), []);
  return <main className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-100 p-4" role="dialog" aria-modal="true" aria-labelledby="perspective-heading" aria-describedby="perspective-description">
    <section className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">MBSE / MBPLE Workbench</div>
      <h1 id="perspective-heading" className="mt-2 text-3xl font-bold text-slate-950">How would you like to work?</h1>
      <p id="perspective-description" className="mt-3 max-w-2xl text-slate-600">Both perspectives use the same project. You can switch later without losing model content.</p>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <button ref={architectButtonRef} className="rounded-xl border-2 border-blue-500 bg-blue-50 p-6 text-left transition hover:bg-blue-100" onClick={() => setPerspective("architect")}>
          <MessageSquareText className="text-blue-700" aria-hidden="true" />
          <span className="mt-4 block text-xl font-bold text-slate-950">Architect view</span>
          <span className="mt-2 block text-sm leading-6 text-slate-600">Suggested for Architecture Definition and Architecture + Simulation scopes. Build and review the model through one guided question at a time.</span>
        </button>
        <button className="rounded-xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-slate-400 hover:bg-slate-50" onClick={() => setPerspective("modeler")}>
          <Boxes className="text-slate-700" aria-hidden="true" />
          <span className="mt-4 block text-xl font-bold text-slate-950">Modeler view</span>
          <span className="mt-2 block text-sm leading-6 text-slate-600">Suitable for every project scope. Open the complete dashboard, model editors, matrices, formulas and analysis workspaces.</span>
        </button>
      </div>
    </section>
  </main>;
}
