import { ArrowDown, ArrowRight, CheckCircle2, CircleDashed, GitBranch, ShieldCheck } from "lucide-react";
import { dashboardWorkflow, scopeLabels } from "../domain/dashboardWorkflow";
import { requirementSatisfaction } from "../domain/traceability";
import type { Project } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

export function ProjectRecapWorkspace({ project: suppliedProject, compact = false }: { project?: Project; compact?: boolean }) {
  const activeProject = useAppStore(selectActiveProject);
  const project = suppliedProject ?? activeProject;
  if (!project) return null;
  const workflow = dashboardWorkflow(project);
  const steps = [...workflow.problemSpace, ...workflow.solutionSpace];
  const completeSteps = steps.filter((step) => step.status === "complete").length;
  const unresolved = project.validationResults.filter((finding) => !finding.resolved);
  const errors = unresolved.filter((finding) => finding.severity === "error");
  const warnings = unresolved.filter((finding) => finding.severity === "warning");
  const requirements = project.elements.filter((element) => element.elementType === "systemRequirement");
  const requirementStates = requirements.map((requirement) => requirementSatisfaction(project, requirement));
  const satisfied = requirementStates.filter((state) => state.status === "satisfied").length;
  const architecture = project.architectures.find((item) => item.id === (project.baselineArchitectureId ?? project.activeArchitectureId)) ?? project.architectures.find((item) => !item.archivedAt);
  const configuration = project.configurations.find((item) => item.architectureId === architecture?.id);
  const latestRun = [...project.simulationRuns].filter((run) => !configuration || run.configurationId === configuration.id).sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
  const decision = [...project.decisions].filter((item) => item.status === "approved").sort((left, right) => (right.decisionDate ?? right.updatedAt).localeCompare(left.decisionDate ?? left.updatedAt))[0];
  const study = project.comparisonStudies.find((item) => decision?.supportingComparisonStudyIds.includes(item.id)) ?? project.comparisonStudies.find((item) => item.id === project.activeComparisonStudyId);
  const approvedTradeBaseline = project.overallScope === "tradeStudy" && decision?.status === "approved" && Boolean(project.baselineArchitectureId);
  const architectureHeading = project.overallScope === "tradeStudy" ? approvedTradeBaseline ? "Baseline Architecture" : "Evaluated Architectures" : "Architecture summary";
  const candidateCount = study?.alternativeRefs.length || study?.candidateRefs.length || project.configurations.filter((item) => !item.archivedAt).length;
  const traceStages = [
    { label: "Mission and context", value: `${project.elements.filter((item) => ["mission", "system", "externalSystem", "stakeholder"].includes(item.elementType)).length} elements`, complete: workflow.problemSpace[0]?.status === "complete" },
    { label: "Intent and requirements", value: `${requirements.length} requirements`, complete: satisfied === requirements.length && requirements.length > 0 },
    { label: "Architecture", value: architecture?.name ?? "Not defined", complete: Boolean(architecture) },
    ...(project.overallScope !== "architectureBuilding" ? [{ label: "Evaluation", value: latestRun ? `${latestRun.results.length} results` : "Not simulated", complete: Boolean(latestRun) }] : []),
    ...(project.overallScope === "tradeStudy" ? [{ label: "Decision", value: decision?.selectedAlternative ?? "Not approved", complete: decision?.status === "approved" }] : [])
  ];
  const parameters = (configuration?.derivation?.realizedElements ?? project.elements)
    .filter((element) => element.elementType === "productComponent")
    .flatMap((element) => element.parameters.map((parameter) => ({ owner: element.name, parameter })))
    .filter(({ parameter }) => parameter.value !== undefined && parameter.value !== null)
    .slice(0, 8);
  return <div className={compact ? "space-y-4" : "space-y-5 p-4 sm:p-6 lg:p-8"}>
    {!compact && <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Project-wide digital thread</div><h1 className="mt-1 text-2xl font-bold">Project Recap</h1><p className="mt-2 max-w-4xl text-sm text-slate-600">A scope-aware summary from mission to the current architecture, evaluation evidence and decision.</p></div>}
    <section className="card overflow-hidden"><div className="flex flex-wrap items-start gap-3 border-b border-slate-200 p-5"><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 font-bold"><GitBranch size={18} />Workflow traceability</h2><p className="mt-1 text-xs text-slate-500">{scopeLabels[project.overallScope ?? "architectureBuilding"]} · {completeSteps}/{steps.length} workflow steps complete</p></div><span className={`badge ${errors.length ? "bg-red-100 text-red-800" : completeSteps === steps.length ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{errors.length ? `${errors.length} blocking issue(s)` : completeSteps === steps.length ? "Scope complete" : "Work in progress"}</span></div>
      <div className="overflow-x-auto p-5"><div className="flex min-w-[720px] items-stretch gap-2">{traceStages.map((stage, index) => <div className="contents" key={stage.label}><article className={`min-w-0 flex-1 rounded-xl border p-3 ${stage.complete ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"}`}><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">{stage.complete ? <CheckCircle2 size={15} className="text-green-600" /> : <CircleDashed size={15} className="text-slate-400" />}{stage.label}</div><strong className="mt-2 block text-sm">{stage.value}</strong></article>{index < traceStages.length - 1 && <ArrowRight className="mt-8 shrink-0 text-slate-400" size={18} />}</div>)}</div></div>
    </section>
    {project.overallScope === "tradeStudy" && decision?.status === "approved" && project.baselineArchitectureId && <section className="rounded-xl border border-green-200 bg-green-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-green-700" /><div><div className="text-xs font-bold uppercase tracking-wide text-green-700">Decision approved</div><h2 className="mt-1 text-xl font-bold text-green-950">Trade study completed · new baseline defined</h2><p className="mt-1 text-sm text-green-900">{decision.selectedAlternative}. {decision.rationale}</p></div></div></section>}
    <div className="grid gap-4 lg:grid-cols-2"><section className="card p-5"><h2 className="font-bold">{architectureHeading}</h2><dl className="mt-3 grid grid-cols-[150px_1fr] gap-2 text-sm">{project.overallScope === "tradeStudy" && !approvedTradeBaseline && <><dt className="text-slate-500">Candidate count</dt><dd className="font-semibold">{candidateCount}</dd></>}<dt className="text-slate-500">Architecture</dt><dd className="font-semibold">{architecture?.name ?? "Not defined"}</dd><dt className="text-slate-500">State</dt><dd>{architecture?.status ?? "—"}</dd><dt className="text-slate-500">Configuration</dt><dd>{configuration?.name ?? "Not configured"}</dd><dt className="text-slate-500">100% realization</dt><dd>{configuration?.derivation ? "Available" : "Not available"}</dd><dt className="text-slate-500">Requirements</dt><dd>{satisfied}/{requirements.length} met or explicitly assumed</dd></dl>{parameters.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Key architecture values</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{parameters.map(({ owner, parameter }) => <div className="rounded-lg bg-slate-50 p-2 text-xs" key={parameter.id}><strong>{parameter.name}</strong><div>{String(parameter.value)} {parameter.unit ?? ""}</div><div className="truncate text-slate-500">{owner}</div></div>)}</div></div>}</section>
      <section className="card p-5"><h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} />Scope validation</h2><div className="mt-3 grid grid-cols-4 gap-2 max-sm:grid-cols-2"><RecapMetric label="Complete steps" value={`${completeSteps}/${steps.length}`} /><RecapMetric label="Requirements" value={`${satisfied}/${requirements.length}`} /><RecapMetric label="Errors" value={String(errors.length)} /><RecapMetric label="Warnings" value={String(warnings.length)} /></div>{errors.length ? <ul className="mt-4 space-y-2 text-sm text-red-700">{errors.slice(0, 6).map((finding) => <li key={finding.id}><strong>{finding.ruleId}</strong> · {finding.message}</li>)}</ul> : <p className="mt-4 text-sm text-green-700">No unresolved blocking validation findings.</p>}{warnings.length > 0 && <p className="mt-2 text-sm text-amber-700">{warnings.length} unresolved warning{warnings.length === 1 ? "" : "s"}; informational findings are excluded from these counts.</p>}{project.overallScope !== "architectureBuilding" && <div className="mt-4 border-t border-slate-200 pt-3 text-sm"><strong>Latest evaluation:</strong> {latestRun?.name ?? "No simulation run available."}{latestRun && <div className="mt-2 flex flex-wrap gap-2">{latestRun.results.filter((result) => result.kpiId).slice(0, 6).map((result) => <span className="badge bg-blue-50 text-blue-800" key={result.id}>{project.kpis.find((kpi) => kpi.id === result.kpiId)?.name ?? result.kpiId}: {result.value ?? "—"} {result.unit ?? ""}</span>)}</div>}</div>}{project.overallScope === "tradeStudy" && <div className="mt-4 border-t border-slate-200 pt-3 text-sm"><strong>Trade study:</strong> {study?.question ?? "Not defined"}<div className="mt-1 text-slate-600">{decision ? `${decision.status} · ${decision.selectedAlternative ?? "selection pending"}` : "Decision not recorded."}</div></div>}</section></div>
    {!compact && <section className="card p-5"><h2 className="font-bold">Workflow status</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{steps.map((step) => <div className="flex items-start gap-2 rounded-lg border border-slate-200 p-3" key={step.id}>{step.status === "complete" ? <CheckCircle2 size={17} className="mt-0.5 text-green-600" /> : <ArrowDown size={17} className="mt-0.5 text-slate-400" />}<div><strong className="text-sm">{step.label}</strong><p className="mt-1 text-xs text-slate-600">{step.message}</p></div></div>)}</div></section>}
  </div>;
}

function RecapMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3 text-center"><div className="text-lg font-bold">{value}</div><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div></div>;
}
