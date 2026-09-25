import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import { contextConnections } from "../domain/contextConnections";
import { dashboardWorkflow } from "../domain/dashboardWorkflow";
import { modelSections } from "../domain/modelViews";
import { analyzeSequence } from "../domain/sequences";
import { elementTypeLabels, type ModelElement, type ModelTabId, type Project } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

interface Obligation {
  label: string;
  complete: number;
  expected: number;
  detail: string;
}

const relationTouches = (project: Project, element: ModelElement, relationshipType?: string) => [
  ...project.relationships,
  ...contextConnections(project)
].filter((relationship) =>
  (!relationshipType || ("relationshipType" in relationship ? relationship.relationshipType : relationship.label) === relationshipType)
  && (relationship.sourceId === element.id || relationship.targetId === element.id)
);

function obligationsForTab(project: Project, tab: ModelTabId): Obligation[] {
  const elements = project.elements;
  const byType = (type: ModelElement["elementType"]) => elements.filter((element) => element.elementType === type);
  const coverage = (label: string, candidates: ModelElement[], predicate: (element: ModelElement) => boolean, detail: string): Obligation => ({
    label,
    expected: candidates.length,
    complete: candidates.filter(predicate).length,
    detail
  });
  if (tab === "mission-context") {
    const systems = byType("system");
    const stakeholders = byType("stakeholder");
    const externalSystems = byType("externalSystem");
    const useCases = byType("useCase");
    return [
      coverage("System context defined", systems, (element) => relationTouches(project, element, "hasSOI").length > 0 && Boolean(element.metadata.architectureRootId), "Each system identifies its mission through hasSOI and its represented product architecture."),
      coverage("Stakeholders connected", stakeholders, (element) => relationTouches(project, element, "hasStakeholder").length > 0, "Every stakeholder participates in a mission context."),
      coverage("External systems connected", externalSystems, (element) => relationTouches(project, element, "participatesInMission").length > 0, "Every external system participates in a mission."),
      coverage("Use-case subjects defined", useCases, (element) => Boolean(element.metadata.subjectSystemId), "Each use case identifies the system it concerns.")
    ];
  }
  if (tab === "requirements-validation") {
    const intents = [...byType("need"), ...byType("objective")];
    const requirements = byType("systemRequirement");
    return [
      coverage("Intent formalized", intents, (element) => project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "derives") || (element.elementType === "objective" && project.kpis.some((kpi) => kpi.objectiveIds.includes(element.id))), "Every need or objective has a requirement path, KPI path, or both."),
      coverage("Requirements allocated", requirements, (element) => project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "satisfiedBy"), "Each requirement identifies what addresses it."),
      coverage("Verification defined", requirements, (element) => project.relationships.some((relationship) => relationship.targetId === element.id && relationship.relationshipType === "verifies"), "Each requirement has a verification method.")
    ];
  }
  if (tab === "product-functional" || tab === "process-functional") {
    const functionType = tab === "product-functional" ? "productFunction" : "processFunction";
    const functions = byType(functionType);
    const useCases = byType("useCase").filter((useCase) => project.selectedUseCaseIds.includes(useCase.id));
    const sequences = project.functionSequences.filter((sequence) => sequence.domain === (tab === "product-functional" ? "product" : "process"));
    return [
      coverage("Use cases allocated to functions", useCases, (element) => project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "hasFunction" && ["productFunction", "processFunction"].includes(project.elements.find((candidate) => candidate.id === relationship.targetId)?.elementType ?? "")), "Each working use case has at least one product or process function."),
      coverage("Functions connected", functions, (element) => relationTouches(project, element).length > 0, "Functions participate in the model trace."),
      { label: "Sequences valid", expected: sequences.length, complete: sequences.filter((sequence) => analyzeSequence(project, sequence).errors.length === 0).length, detail: "Every defined sequence has a valid ordered function flow." }
    ];
  }
  if (tab === "product-technical" || tab === "process-technical") {
    const functionType = tab === "product-technical" ? "productFunction" : "processFunction";
    const componentType = tab === "product-technical" ? "productComponent" : "industrialSystemComponent";
    const functions = byType(functionType);
    const components = byType(componentType);
    const obligations = [
      coverage("Functions realized", functions, (element) => project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "realizedBy"), `Each ${functionType === "productFunction" ? "product" : "process"} function identifies its realizing component.`),
      coverage("Components connected", components, (element) => relationTouches(project, element).length > 0, "Components participate in hierarchy, realization, interfaces or satisfaction.")
    ];
    if (tab === "process-technical") obligations.push(coverage("Resource demand defined", components, (element) => project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "requiresResource"), "Industrial components identify required resources."));
    return obligations;
  }
  if (tab === "interfaces") {
    const interfaces = [...byType("productInterface"), ...byType("processInterface")];
    return [coverage("Interface endpoints connected", interfaces, (element) => relationTouches(project, element, "connects").length >= 2, "Each interface connects at least two participating elements across a boundary.")];
  }
  const relevant = elements.filter((element) => modelSections.traceability.projectionTypes.includes(element.elementType));
  return [coverage("Elements in the digital thread", relevant, (element) => relationTouches(project, element).length > 0, "Every model element has a canonical relationship or typed context reference.")];
}

export function SectionRecap({ tab, project: suppliedProject }: { tab: ModelTabId; project?: Project }) {
  const activeProject = useAppStore(selectActiveProject);
  const project = suppliedProject ?? activeProject;
  if (!project) return null;
  const section = modelSections[tab];
  const elements = project.elements.filter((element) => section.tableTypes.includes(element.elementType));
  const obligations = obligationsForTab(project, tab);
  const workflow = dashboardWorkflow(project);
  const workflowSteps = [...workflow.problemSpace, ...workflow.solutionSpace].filter((step) => step.activities.some((activity) => activity.modelTab === tab));
  const complete = obligations.reduce((sum, item) => sum + item.complete, 0);
  const expected = obligations.reduce((sum, item) => sum + item.expected, 0);
  const ready = obligations.every((item) => item.expected === 0 || item.complete === item.expected) && workflowSteps.every((step) => step.status === "complete");
  const parameterCount = elements.reduce((sum, element) => sum + element.parameters.length, 0);
  const relationshipCount = project.relationships.filter((relationship) => elements.some((element) => element.id === relationship.sourceId || element.id === relationship.targetId)).length;
  return <section className="card overflow-hidden" aria-label={`${section.label} section recap`}>
    <div className={`border-b p-5 ${ready ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3">{ready ? <CheckCircle2 className="mt-0.5 text-green-700" /> : <AlertTriangle className="mt-0.5 text-amber-700" />}<div><div className="text-xs font-bold uppercase tracking-wide text-slate-600">Section Recap</div><h2 className="text-xl font-bold">{section.label}</h2><p className="mt-1 text-sm text-slate-700">{ready ? "The rule-derived expectations for this section are complete." : "The section has useful model content, but some rule-derived expectations remain open."}</p></div></div></div>
    <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4"><Metric label="Elements" value={elements.length} /><Metric label="Types represented" value={new Set(elements.map((element) => element.elementType)).size} /><Metric label="Parameters" value={parameterCount} /><Metric label="Relationships" value={relationshipCount} /></div>
    <div className="p-4"><h3 className="font-bold">Expected versus current</h3><div className="mt-3 space-y-2">{obligations.map((item) => {
      const satisfied = item.expected === 0 || item.complete === item.expected;
      return <div key={item.label} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[22px_minmax(180px,1fr)_auto_2fr]">{satisfied ? <CheckCircle2 size={17} className="mt-0.5 text-green-600" /> : <CircleDashed size={17} className="mt-0.5 text-amber-600" />}<strong className="text-sm">{item.label}</strong><span className={`badge ${satisfied ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{item.complete}/{item.expected || 0}</span><span className="text-xs text-slate-600">{item.detail}</span></div>;
    })}</div></div>
    <div className="border-t border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap gap-2">{section.tableTypes.map((type) => <span className="badge bg-white text-slate-700" key={type}>{elementTypeLabels[type]} · {elements.filter((element) => element.elementType === type).length}</span>)}</div>{workflowSteps.map((step) => <p className="mt-2 text-xs text-slate-600" key={step.id}><strong>{step.label}:</strong> {step.message}</p>)}</div>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}
