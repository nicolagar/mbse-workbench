import { GitBranch } from "lucide-react";
import { analyzeSequence, sequenceRelationships } from "../domain/sequences";
import type { FunctionSequenceDomain, Project } from "../domain/types";
import { ModelGraph } from "./ModelGraph";

export function AllSequencesOverview({ project, domain }: { project: Project; domain: FunctionSequenceDomain }) {
  const sequences = project.functionSequences.filter((sequence) => sequence.domain === domain && (!project.activeArchitectureId || !sequence.architectureId || sequence.architectureId === project.activeArchitectureId));
  const useCases = [...new Set(sequences.flatMap((sequence) => sequence.useCaseIds))].map((id) => project.elements.find((element) => element.id === id)).filter((element): element is NonNullable<typeof element> => Boolean(element));
  return <section className="card overflow-hidden">
    <div className="border-b border-slate-200 p-4"><h2 className="flex items-center gap-2 font-bold"><GitBranch size={17} />All {domain} sequences</h2><p className="mt-1 text-xs text-slate-500">Every named sequence shows its actual directed precedence graph, including parallel branches and joins.</p></div>
    <div className="space-y-5 p-4">{useCases.map((useCase) => <section key={useCase.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Use case</div><h3 className="mt-1 font-bold text-blue-950">{useCase.name}</h3>
      <div className="mt-4 space-y-4">{sequences.filter((sequence) => sequence.useCaseIds.includes(useCase.id)).map((sequence) => {
        const analysis = analyzeSequence(project, sequence);
        const functionIds = new Set(sequence.functionIds);
        const elements = project.elements.filter((element) => functionIds.has(element.id));
        const relationships = sequenceRelationships(project, sequence);
        return <article key={sequence.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3"><div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Sequence</div><strong className="block text-sm">{sequence.name || "Unnamed sequence"}</strong></div><span className={`badge ${analysis.errors.length ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{analysis.errors.length ? `${analysis.errors.length} issue(s)` : "Valid directed order"}</span></div>
          <ModelGraph elements={elements} relationships={relationships} sequence={sequence} layoutMode="sequence" layoutKey={`all-sequences:${sequence.id}`} readOnly allowDetailed={false} heightClass="h-[360px]" />
          {analysis.errors.length > 0 && <ul className="border-t border-red-100 bg-red-50 p-3 text-xs text-red-800">{analysis.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        </article>;
      })}</div>
    </section>)}
      {!sequences.length && <p className="p-6 text-center text-sm text-slate-500">No {domain} sequences are defined for this model context.</p>}
      {sequences.some((sequence) => sequence.useCaseIds.length !== 1) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Some sequences do not identify exactly one use case and cannot be grouped in this overview.</div>}
    </div>
  </section>;
}
