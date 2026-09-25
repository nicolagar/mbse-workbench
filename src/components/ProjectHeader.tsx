import { ArrowLeft, ChevronDown, FolderOpen, Menu, MessageSquareText, Plus, Save, Trash2 } from "lucide-react";
import { ExampleChooser } from "./ExampleChooser";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

export function ProjectHeader({
  perspective,
  onOpenNavigation,
  navigationLabel,
  navigationControls,
  navigationExpanded
}: {
  perspective: "architect" | "modeler";
  onOpenNavigation?: () => void;
  navigationLabel?: string;
  navigationControls?: string;
  navigationExpanded?: boolean;
}) {
  const project = useAppStore(selectActiveProject)!;
  const projects = useAppStore((state) => state.projects);
  const workspace = useAppStore((state) => state.uiPreferences.activeWorkspace);
  const dashboardFocusedStepId = useAppStore((state) => state.uiPreferences.dashboardFocusedStepId);
  const dashboardScrollY = useAppStore((state) => state.uiPreferences.dashboardScrollY ?? 0);
  const switchProject = useAppStore((state) => state.switchProject);
  const createProject = useAppStore((state) => state.createProject);
  const duplicateProject = useAppStore((state) => state.duplicateProject);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const resetAll = useAppStore((state) => state.resetEntireApplication);
  const saveStatus = useAppStore((state) => state.saveStatus);
  const setPerspective = useAppStore((state) => state.setPerspective);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setWorkflowFocus = useAppStore((state) => state.setWorkflowFocus);

  const openDelivery = (mode: "save" | "load") => {
    setWorkflowFocus(`delivery:${mode}`);
    setWorkspace("export");
    setPerspective("modeler");
  };

  return <div className="flex w-full flex-wrap items-center gap-3">
    {onOpenNavigation && <button
      className="btn md:hidden"
      aria-label={navigationLabel ?? "Open navigation"}
      aria-controls={navigationControls}
      aria-expanded={navigationExpanded}
      onClick={onOpenNavigation}
    ><Menu size={18} /></button>}
    <div className="mr-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">{perspective === "architect" ? "Architect view" : "Modeler view"}</div>
    <label className="sr-only" htmlFor={`${perspective}-project-switcher`}>Switch active project</label>
    <select id={`${perspective}-project-switcher`} className="field min-w-44 max-w-xs font-semibold" value={project.id} onChange={(event) => switchProject(event.target.value)}>
      {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <button aria-label={perspective === "architect" ? "Modeler view" : "Architect view"} className="btn border-teal-200 bg-teal-50 text-teal-800" onClick={() => setPerspective(perspective === "architect" ? "modeler" : "architect")}>
      <MessageSquareText size={15} />Switch to {perspective === "architect" ? "Modeler" : "Architect"} view
    </button>
    <ExampleChooser />
    {perspective === "modeler" && workspace !== "dashboard" && dashboardFocusedStepId && <button className="btn border-blue-200 bg-blue-50 text-blue-800" onClick={() => {
      setWorkspace("dashboard");
      requestAnimationFrame(() => window.scrollTo({ top: dashboardScrollY }));
    }}><ArrowLeft size={15} />Return to workflow</button>}
    <div className="ml-auto flex items-center gap-2">
      <span className={`badge whitespace-nowrap ${saveStatus === "Save error" ? "bg-red-100 text-red-700" : saveStatus === "Saving" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}><Save size={13} className="mr-1" />{saveStatus}</span>
      <span className="badge bg-blue-50 text-blue-700">Revision {project.modelRevision}</span>
      <details className="relative">
        <summary className="btn cursor-pointer list-none whitespace-nowrap">Project actions <ChevronDown size={14} /></summary>
        <div className="absolute right-0 z-[80] mt-2 grid w-60 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
          <button className="btn justify-start" onClick={() => createProject(window.prompt("Project name", "New engineering study") ?? "")}><Plus size={15} />New project</button>
          <button className="btn justify-start" onClick={duplicateProject}>Duplicate project</button>
          <button className="btn justify-start border-blue-200 bg-blue-50 text-blue-800" onClick={() => openDelivery("save")}><Save size={15} />Save Project</button>
          <button className="btn justify-start border-purple-200 bg-purple-50 text-purple-800" onClick={() => openDelivery("load")}><FolderOpen size={15} />Load Project</button>
          <button className="btn btn-danger justify-start" onClick={() => {
            if (window.confirm(`Delete “${project.name}”? This cannot be undone.`)) deleteProject(project.id);
          }}><Trash2 size={15} />Delete project</button>
          <button className="btn btn-danger justify-start" onClick={() => {
            if (window.confirm("Reset the entire local application? All projects will be removed.")) resetAll("empty");
          }}>Reset all</button>
        </div>
      </details>
    </div>
  </div>;
}
