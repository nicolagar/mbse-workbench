import {
  BarChart3, Boxes, Calculator, ChevronDown, ChevronRight, Circle, ClipboardCheck, Download,
  FlaskConical, GitBranch, GitCompare, LayoutDashboard, Layers3, Menu,
  Settings2, Target, X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { dashboardWorkflow, type DashboardActivity, type DashboardWorkflowStep } from "../domain/dashboardWorkflow";
import { modelSectionOrder, modelSections } from "../domain/modelViews";
import type { ModelTabId, WorkspaceId } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { ProjectHeader } from "./ProjectHeader";

const navigation: Array<{ id: WorkspaceId; label: string; icon: typeof Menu }> = [
  { id: "variability", label: "Variability", icon: Settings2 },
  { id: "parameters", label: "Parameters and KPIs", icon: Calculator },
  { id: "simulation", label: "Simulation", icon: FlaskConical },
  { id: "comparison", label: "Architecture Trade Study", icon: GitCompare },
  { id: "ontology", label: "Scope Ontology", icon: GitBranch },
  { id: "export", label: "Export", icon: Download }
];

export function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(true);
  const [modelExpanded, setModelExpanded] = useState(true);
  const [expandedWorkflow, setExpandedWorkflow] = useState({ problem: true, solution: true });
  const project = useAppStore(selectActiveProject);
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => shellRef.current?.style.setProperty("--workbench-header-height", `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [project?.id]);
  const workspace = useAppStore((state) => state.uiPreferences.activeWorkspace);
  const activeModelTab = useAppStore((state) => state.uiPreferences.activeModelTab);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setModelTab = useAppStore((state) => state.setModelTab);
  const setModelView = useAppStore((state) => state.setModelView);
  const setElementTypeFilter = useAppStore((state) => state.setElementTypeFilter);
  const setWorkflowFocus = useAppStore((state) => state.setWorkflowFocus);
  const setDashboardContext = useAppStore((state) => state.setDashboardContext);
  const setVariabilityTab = useAppStore((state) => state.setVariabilityTab);
  const setTradeStudyTab = useAppStore((state) => state.setTradeStudyTab);
  const dashboardFocusedStepId = useAppStore((state) => state.uiPreferences.dashboardFocusedStepId);
  const dashboardScrollY = useAppStore((state) => state.uiPreferences.dashboardScrollY ?? 0);
  if (!project) return null;
  const workflow = dashboardWorkflow(project);
  const openModelSection = (tab: ModelTabId) => {
    setModelTab(tab);
    setElementTypeFilter(undefined);
    setWorkspace("model");
    setMenuOpen(false);
  };
  const openActivity = (step: DashboardWorkflowStep, item?: DashboardActivity) => {
    setDashboardContext(step.id, 0);
    setWorkflowFocus(`dashboard:${step.id}`);
    if (!item) {
      setWorkspace("dashboard");
      setMenuOpen(false);
      return;
    }
    if (item.modelTab) setModelTab(item.modelTab);
    if (item.modelView) setModelView(item.modelView);
    if (item.elementType) setElementTypeFilter(item.elementType);
    if (item.variabilityTab) setVariabilityTab(item.variabilityTab);
    if (item.tradeStudyTab) setTradeStudyTab(item.tradeStudyTab);
    setWorkspace(item.workspace);
    setMenuOpen(false);
  };
  return (
    <div ref={shellRef} className="flex min-h-screen bg-slate-100">
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-slate-950/40 md:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform md:w-16 md:translate-x-0 lg:w-72 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-center gap-3"><BarChart3 className="shrink-0 text-blue-400" /><div className="md:hidden lg:block"><div className="font-bold">MBSE / MBPLE</div><div className="text-xs text-slate-400">Programme workbench</div></div><button className="ml-auto md:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main workspaces">
          <div className="block border-b border-slate-800 pb-2 md:hidden lg:block">
            <div className={`flex items-center rounded-lg ${workspace === "dashboard" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
              <button title="Project Workflow" aria-label="Project Workflow" onClick={() => { setWorkspace("dashboard"); setMenuOpen(false); }} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm"><LayoutDashboard className="shrink-0" size={18} /><span>Project Workflow</span></button>
              <button className="px-3 py-2.5" aria-label={`${dashboardExpanded ? "Collapse" : "Expand"} Project Workflow`} aria-expanded={dashboardExpanded} onClick={() => setDashboardExpanded((expanded) => !expanded)}>{dashboardExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            </div>
            {dashboardExpanded && <div className="ml-4 border-l border-slate-800 pl-1 pt-1">
              <WorkflowNavSection title="Problem Space" icon={Target} expanded={expandedWorkflow.problem} steps={workflow.problemSpace} focusedStepId={dashboardFocusedStepId} onToggle={() => setExpandedWorkflow((current) => ({ ...current, problem: !current.problem }))} onOpen={openActivity} />
              <WorkflowNavSection title="Solution Space" icon={Layers3} expanded={expandedWorkflow.solution} steps={workflow.solutionSpace} focusedStepId={dashboardFocusedStepId} onToggle={() => setExpandedWorkflow((current) => ({ ...current, solution: !current.solution }))} onOpen={openActivity} />
            </div>}
          </div>
          <button title="Project Workflow" aria-label="Project Workflow compact navigation" onClick={() => { setWorkspace("dashboard"); setMenuOpen(false); }} className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm md:flex lg:hidden ${workspace === "dashboard" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}><LayoutDashboard className="shrink-0" size={18} /></button>
          <button title="Project Recap" aria-label="Project Recap" onClick={() => { setWorkspace("recap"); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${workspace === "recap" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}><ClipboardCheck className="shrink-0" size={18} /><span className="md:hidden lg:inline">Project Recap</span></button>
          <div className="block px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 md:hidden lg:block">Workspaces</div>
          <div className="block md:hidden lg:block"><div className={`flex items-center rounded-lg ${workspace === "model" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}><button title="Model" aria-label="Model" onClick={() => openModelSection(activeModelTab)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm"><Boxes className="shrink-0" size={18} /><span>Model</span></button><button className="px-3 py-2.5" aria-label={`${modelExpanded ? "Collapse" : "Expand"} Model sections`} aria-expanded={modelExpanded} onClick={() => setModelExpanded((expanded) => !expanded)}>{modelExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></div>{modelExpanded && <div className="ml-4 space-y-1 border-l border-slate-800 py-1 pl-2">{modelSectionOrder.map((tab) => <button key={tab} className={`w-full rounded-md px-3 py-2 text-left text-xs ${workspace === "model" && activeModelTab === tab ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800"}`} onClick={() => openModelSection(tab)}>{modelSections[tab].label}</button>)}</div>}</div>
          <button title="Model" aria-label="Model compact navigation" onClick={() => openModelSection(activeModelTab)} className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm md:flex lg:hidden ${workspace === "model" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}><Boxes size={18} /></button>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} title={label} aria-label={label} onClick={() => { setWorkspace(id); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${workspace === id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
              <Icon className="shrink-0" size={18} /><span className="md:hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4 text-xs text-slate-400 md:hidden lg:block">
          <p>Simplified engineering demonstrator</p>
          <p className="mt-1">Workflow v1.8.0 · schema 14</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1 md:ml-16 lg:ml-72">
        <header ref={headerRef} className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4 lg:px-6">
          <ProjectHeader perspective="modeler" onOpenNavigation={() => setMenuOpen(true)} navigationLabel="Open navigation" />
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

const workflowStatusClass: Record<DashboardWorkflowStep["status"], string> = {
  notStarted: "bg-slate-500",
  inProgress: "bg-blue-400",
  complete: "bg-green-400",
  blocked: "bg-red-400"
};

function WorkflowNavSection({ title, icon: Icon, expanded, steps, focusedStepId, onToggle, onOpen }: {
  title: string;
  icon: typeof Target;
  expanded: boolean;
  steps: DashboardWorkflowStep[];
  focusedStepId?: string;
  onToggle: () => void;
  onOpen: (step: DashboardWorkflowStep, activity?: DashboardActivity) => void;
}) {
  return <section className="py-1">
    <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-300 hover:bg-slate-800" aria-expanded={expanded} onClick={onToggle}>
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Icon size={15} />{title}<span className="ml-auto text-[10px] font-normal text-slate-500">{steps.filter((step) => step.status === "complete").length}/{steps.length}</span>
    </button>
    {expanded && <ol className="mt-1 space-y-1 px-1">{steps.map((step) => <li key={step.id}><a href={`#workflow-${step.id}`} className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-slate-800 ${focusedStepId === step.id ? "bg-slate-800 text-white" : "text-slate-300"}`} title={`Open ${step.activities[0]?.label ?? step.label}`} onClick={(event) => { event.preventDefault(); onOpen(step, step.activities[0]); }}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${workflowStatusClass[step.status]}`} aria-hidden="true" /><span className="min-w-0 flex-1 leading-4">{step.label}</span><Circle className="mt-0.5 shrink-0 opacity-30" size={10} />
    </a></li>)}</ol>}
  </section>;
}
