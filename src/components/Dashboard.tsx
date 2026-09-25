import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDot,
  Layers3,
  Target
} from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  dashboardWorkflow,
  scopeLabels,
  type DashboardActivity,
  type DashboardStepStatus,
  type DashboardWorkflowStep
} from "../domain/dashboardWorkflow";
import { calculateSemanticScope } from "../domain/semanticScope";
import type { OverallScope } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { SectionRecap } from "./SectionRecap";

const scopes: Array<{ id: OverallScope; label: string; detail: string }> = [
  {
    id: "architectureBuilding",
    label: "Architecture building",
    detail: "Define the problem and build the functional, product and industrial architecture."
  },
  {
    id: "architectureAndSimulation",
    label: "Architecture building + simulation",
    detail: "Build one architecture, complete its parameters and simulate it."
  },
  {
    id: "tradeStudy",
    label: "Trade Study",
    detail: "Build configurable alternatives, simulate architectures, compare and decide."
  }
];

const statusStyle: Record<DashboardStepStatus, {
  label: string;
  card: string;
  badge: string;
  Icon: typeof Circle;
}> = {
  notStarted: { label: "Not started", card: "border-slate-200 bg-white", badge: "bg-slate-100 text-slate-700", Icon: Circle },
  inProgress: { label: "In progress", card: "border-blue-300 bg-blue-50/60", badge: "bg-blue-100 text-blue-800", Icon: CircleDot },
  complete: { label: "Complete", card: "border-green-300 bg-green-50/70", badge: "bg-green-100 text-green-800", Icon: CheckCircle2 },
  blocked: { label: "Blocked", card: "border-red-300 bg-red-50/70", badge: "bg-red-100 text-red-800", Icon: AlertOctagon }
};

export function Dashboard() {
  const project = useAppStore(selectActiveProject)!;
  const updateProject = useAppStore((state) => state.updateProject);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setModelTab = useAppStore((state) => state.setModelTab);
  const setModelView = useAppStore((state) => state.setModelView);
  const setElementTypeFilter = useAppStore((state) => state.setElementTypeFilter);
  const setElementTypeGroup = useAppStore((state) => state.setElementTypeGroup);
  const setWorkflowFocus = useAppStore((state) => state.setWorkflowFocus);
  const setVariabilityTab = useAppStore((state) => state.setVariabilityTab);
  const setTradeStudyTab = useAppStore((state) => state.setTradeStudyTab);
  const setDashboardContext = useAppStore((state) => state.setDashboardContext);
  const focusedStepId = useAppStore((state) => state.uiPreferences.dashboardFocusedStepId);
  const savedScrollY = useAppStore((state) => state.uiPreferences.dashboardScrollY ?? 0);
  const workflow = useMemo(() => dashboardWorkflow(project), [project]);
  const semanticScope = useMemo(() => calculateSemanticScope(project), [project]);
  const allSteps = [...workflow.problemSpace, ...workflow.solutionSpace];
  const focusedStep = allSteps.find((item) => item.id === focusedStepId);

  useEffect(() => {
    if (savedScrollY <= 0) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: savedScrollY }));
    return () => cancelAnimationFrame(frame);
  }, [project.id, savedScrollY]);

  const selectStep = (step: DashboardWorkflowStep, reveal = false) => {
    setDashboardContext(step.id, window.scrollY);
    if (!reveal) return;
    requestAnimationFrame(() => {
      const details = document.getElementById("dashboard-step-details");
      if (details && typeof details.scrollIntoView === "function") {
        details.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };
  const openActivity = (step: DashboardWorkflowStep, item: DashboardActivity) => {
    setDashboardContext(step.id, window.scrollY);
    setWorkflowFocus(`dashboard:${step.id}`);
    if (item.modelTab) setModelTab(item.modelTab);
    if (item.modelView) setModelView(item.modelView);
    if (item.elementTypes) setElementTypeGroup(item.elementTypes);
    else if (item.elementType) setElementTypeFilter(item.elementType);
    if (item.variabilityTab) setVariabilityTab(item.variabilityTab);
    if (item.tradeStudyTab) setTradeStudyTab(item.tradeStudyTab);
    setWorkspace(item.workspace);
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Project workflow</div>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">{project.name}</h1>
        <p className="mt-2 max-w-4xl text-slate-600">Choose the project outcome, then complete the model activities shown in Problem Space and Solution Space.</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Preliminary engineering estimate — not a verified detailed-design result.</div>
    </section>

    <section className="card p-5" aria-labelledby="overall-scope-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="overall-scope-heading" className="text-lg font-bold">Overall scope</h2><p className="mt-1 text-sm text-slate-600">Changing scope preserves project data and recalculates completion from existing evidence.</p></div>
        <span className="badge bg-blue-50 text-blue-800">Selected: {scopeLabels[workflow.scope]}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 max-lg:grid-cols-1">
        {scopes.map((scope) => <label key={scope.id} className={`cursor-pointer rounded-xl border p-4 transition hover:border-blue-400 ${workflow.scope === scope.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}>
          <div className="flex items-start gap-3"><input className="mt-1" type="radio" name="overall-scope" checked={workflow.scope === scope.id} onChange={() => {
            updateProject({ overallScope: scope.id });
            setDashboardContext(undefined, 0);
          }} /><div><div className="font-bold text-slate-900">{scope.label}</div><p className="mt-1 text-sm text-slate-600">{scope.detail}</p></div></div>
        </label>)}
      </div>
    </section>

    <StatusLegend />

    <WorkflowSection id="problem-space" title="Problem Space" subtitle="Define what the system must achieve and the evidence that will judge it." icon={Target} steps={workflow.problemSpace} recommendedStepId={workflow.recommendedStepId} focusedStepId={focusedStepId} onSelect={selectStep} />
    {focusedStep && workflow.problemSpace.some((step) => step.id === focusedStep.id) && <StepDetails focusedStep={focusedStep} semanticScope={semanticScope} onOpen={openActivity} />}
    <WorkflowSection id="solution-space" title="Solution Space" subtitle="Build, realize and validate only the solution activities required by the selected scope." icon={Layers3} steps={workflow.solutionSpace} recommendedStepId={workflow.recommendedStepId} focusedStepId={focusedStepId} onSelect={selectStep} />
    {focusedStep && workflow.solutionSpace.some((step) => step.id === focusedStep.id) && <StepDetails focusedStep={focusedStep} semanticScope={semanticScope} onOpen={openActivity} />}
  </div>;
}

function StepDetails({ focusedStep, semanticScope, onOpen }: { focusedStep: DashboardWorkflowStep; semanticScope: ReturnType<typeof calculateSemanticScope>; onOpen: (step: DashboardWorkflowStep, item: DashboardActivity) => void }) {
  const tabs = [...new Set(focusedStep.activities.flatMap((activity) => activity.modelTab ? [activity.modelTab] : []))];
  return <section id="dashboard-step-details" className="card scroll-mt-24 border-blue-200 p-5" aria-live="polite">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Step details</div><h2 className="mt-1 text-xl font-bold">{focusedStep.label}</h2><p className="mt-2 text-sm text-slate-600">{focusedStep.description}</p></div>
        <StatusBadge status={focusedStep.status} />
      </div>
      <div className={`mt-4 rounded-lg border p-3 text-sm ${focusedStep.status === "blocked" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{focusedStep.message}</div>
      {focusedStep.id === "define-scope" && <div className="mt-4 grid grid-cols-5 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <ScopeSummary label="Active use cases" value={semanticScope.workingUseCases.length} />
        <ScopeSummary label="Stakeholders" value={semanticScope.stakeholders.length} />
        <ScopeSummary label="Needs" value={semanticScope.needs.length} />
        <ScopeSummary label="Objectives" value={semanticScope.objectives.length} />
        <ScopeSummary label="Requirements" value={semanticScope.requirements.length} />
        {semanticScope.invalidUseCaseIds.length > 0 && <div className="col-span-full rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{semanticScope.invalidUseCaseIds.length} selected use case{semanticScope.invalidUseCaseIds.length === 1 ? " is" : "s are"} outside the system-of-interest scope.</div>}
      </div>}
      <div className="mt-4 flex flex-wrap gap-2">{focusedStep.activities.map((item) => <button className="btn btn-primary" key={`${focusedStep.id}-${item.label}`} onClick={() => onOpen(focusedStep, item)}>{item.label}<ArrowRight size={15} /></button>)}</div>
      {tabs.length > 0 && <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">{tabs.map((tab) => <SectionRecap key={tab} tab={tab} />)}</div>}
    </section>;
}

function ScopeSummary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-950">{value}</div></div>;
}

function WorkflowSection({ id, title, subtitle, icon: Icon, steps, recommendedStepId, focusedStepId, onSelect }: {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Target;
  steps: DashboardWorkflowStep[];
  recommendedStepId?: string;
  focusedStepId?: string;
  onSelect: (step: DashboardWorkflowStep, reveal?: boolean) => void;
}) {
  const complete = steps.filter((item) => item.status === "complete").length;
  return <section id={id} className="card p-5" aria-labelledby={`${id}-heading`}>
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3"><div className="rounded-lg bg-slate-950 p-2 text-white"><Icon size={20} /></div><div><h2 id={`${id}-heading`} className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-600">{subtitle}</p><p className="mt-1 text-xs font-bold text-slate-600">Double-click a step to open and focus its details.</p></div></div>
      <span className="badge bg-slate-100 text-slate-800">{complete}/{steps.length} complete</span>
    </div>
    <ol className="mt-5 grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
      {steps.map((item, index) => {
        const style = statusStyle[item.status];
        const recommended = item.id === recommendedStepId;
        return <li key={item.id}><button onClick={() => onSelect(item)} onDoubleClick={() => onSelect(item, true)} className={`h-full w-full rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow ${style.card} ${focusedStepId === item.id ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}>
          <div className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{item.label}</h3>{recommended && <span className="badge bg-purple-100 text-purple-800">Recommended next</span>}</div><p className="mt-2 text-sm text-slate-600">{item.description}</p><div className="mt-3"><StatusBadge status={item.status} /></div></div></div>
        </button></li>;
      })}
    </ol>
  </section>;
}

function StatusBadge({ status }: { status: DashboardStepStatus }) {
  const style = statusStyle[status];
  return <span className={`badge inline-flex items-center gap-1 ${style.badge}`}><style.Icon size={13} />{style.label}</span>;
}

function StatusLegend() {
  return <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600" aria-label="Workflow status legend"><span className="mr-1 font-semibold">Status:</span>{(Object.keys(statusStyle) as DashboardStepStatus[]).map((status) => <StatusBadge status={status} key={status} />)}</div>;
}
