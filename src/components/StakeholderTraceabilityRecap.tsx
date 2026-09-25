import { useMemo } from "react";
import { assessRequirement, assessmentModel } from "../domain/requirementAssessment";
import { satisfactionEvidence } from "../domain/traceability";
import { systemOfInterest } from "../domain/ontology";
import type { ModelElement } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { ElementEditor } from "./ElementEditor";

const unique = (items: ModelElement[]) => [...new Map(items.map((item) => [item.id, item])).values()];

export function RequirementsValidationOverview({ embedded = false }: { embedded?: boolean }) {
  const project = useAppStore(selectActiveProject)!;
  const selectElement = useAppStore((state) => state.selectElement);
  const selectedId = useAppStore((state) => state.selectedElementId);
  const setActiveArchitecture = useAppStore((state) => state.setActiveArchitecture);
  const architecture = project.architectures.find((item) => item.id === project.activeArchitectureId);
  const configurationId = architecture?.configurationId;
  const context = useMemo(() => assessmentModel(project, configurationId), [project, configurationId]);
  const model = context.project;
  const selected = project.elements.find((item) => item.id === selectedId);
  const study = project.comparisonStudies.find((item) => item.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0];
  const decision = project.decisions.find((item) => item.supportingComparisonStudyIds.includes(study?.id ?? ""));
  const linked = (id: string, type: string, reverse = false) => model.relationships.filter((edge) => edge.relationshipType === type && (reverse ? edge.targetId : edge.sourceId) === id).map((edge) => model.elements.find((item) => item.id === (reverse ? edge.sourceId : edge.targetId))).filter((item): item is ModelElement => Boolean(item));
  const connectedInterfaces = (items: ModelElement[], interfaceType: "productInterface" | "processInterface") => unique(items.flatMap((item) => linked(item.id, "connects")).filter((candidate) => candidate.elementType === interfaceType));
  const externalContext = (interfaces: ModelElement[]) => unique(interfaces.flatMap((item) => linked(item.id, "connects", true)).filter((candidate) => candidate.elementType === "externalSystem"));
  const names = (items: ModelElement[], label?: string) => items.length ? <div className="mb-2"><span className="text-xs text-slate-500">{label}</span>{unique(items).map((item) => <button key={item.id} className="block w-full text-left text-sm text-blue-700 hover:underline" onClick={() => selectElement(item.id)}>{item.name}</button>)}</div> : null;
  const requirements = project.elements.filter((item) => item.elementType === "systemRequirement");
  return <div className="space-y-4"><section className="card overflow-hidden">
    <div className="space-y-2 border-b border-slate-200 p-4">
      <h2 className="font-bold">Requirements &amp; Validation Overview</h2>
      <p className="text-sm text-slate-600">Follow the intent, requirement, design and result in one row. Connections explain the design; the result states what was checked or assumed.</p>
      <div className="text-sm"><strong>Mission:</strong> {project.elements.filter((item) => item.elementType === "mission").map((item) => item.name).join("; ") || "Not defined"}</div>
      <div className="text-sm"><strong>System:</strong> {systemOfInterest(project)?.name ?? "Not defined"} · <strong>Represented by:</strong> {project.elements.find((item) => item.id === systemOfInterest(project)?.metadata.architectureRootId)?.name ?? "Not linked"} · <strong>Context:</strong> {architecture?.name ?? "150% product-line model"}</div>
      {embedded && project.architectures.length > 0 && <label className="block text-sm">Configuration / architecture<select className="field mt-1" value={project.activeArchitectureId ?? ""} onChange={(event) => setActiveArchitecture(event.target.value || undefined)}><option value="">150% product-line model</option>{project.architectures.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {context.errors.length > 0 && <p role="alert" className="text-sm text-red-700">{context.errors.join(" ")}</p>}
    </div>
    <table className="ontology-recap w-full table-fixed text-left text-sm" aria-label="End-to-end engineering recap">
      <thead><tr>{["Why is it needed?", "What must be achieved?", "What addresses it in the product?", "What supports it industrially?", "What is the result?"].map((label) => <th className="table-cell whitespace-normal" key={label}>{label}</th>)}</tr></thead>
      <tbody>{requirements.map((requirement) => {
        const effective = model.elements.find((item) => item.id === requirement.id);
        const origins = project.relationships.filter((edge) => edge.targetId === requirement.id && edge.relationshipType === "derives").map((edge) => project.elements.find((item) => item.id === edge.sourceId)).filter((item): item is ModelElement => Boolean(item));
        const originIds = new Set(origins.map((item) => item.id));
        const owners = project.relationships.filter((edge) => originIds.has(edge.targetId) && ["hasNeed", "hasObjective"].includes(edge.relationshipType)).map((edge) => project.elements.find((item) => item.id === edge.sourceId)).filter((item): item is ModelElement => Boolean(item));
        const cases = model.relationships.filter((edge) => originIds.has(edge.targetId) && edge.relationshipType === "addresses").map((edge) => model.elements.find((item) => item.id === edge.sourceId)).filter((item): item is ModelElement => Boolean(item));
        const productFunctions = linked(requirement.id, "satisfiedBy").filter((item) => item.elementType === "productFunction");
        const components = satisfactionEvidence(model, requirement, "productComponent");
        const parameterIds = new Set(requirement.requirementFormula?.bindings.flatMap((binding) => binding.kind === "parameter" ? [binding.targetId] : context.results.find((result) => result.kpiId === binding.targetId)?.sourceParameterIds ?? []) ?? []);
        const boundOwners = model.elements.filter((item) => item.parameters.some((parameter) => parameterIds.has(parameter.id)));
        const product = unique([...components, ...boundOwners.filter((item) => item.elementType === "productComponent")]);
        const productInterfaces = connectedInterfaces([...productFunctions, ...product], "productInterface");
        const productExternals = externalContext(productInterfaces);
        const processes = unique([...linked(requirement.id, "satisfiedBy").filter((item) => item.elementType === "processFunction"), ...product.flatMap((item) => ["produces", "consumes", "allocatedTo"].flatMap((type) => linked(item.id, type, true))).filter((item) => item.elementType === "processFunction")]);
        const industrial = unique([...satisfactionEvidence(model, requirement, "industrialSystemComponent"), ...processes.flatMap((item) => linked(item.id, "realizedBy"))]);
        const resources = industrial.flatMap((item) => linked(item.id, "requiresResource"));
        const processInterfaces = connectedInterfaces([...processes, ...industrial], "processInterface");
        const processExternals = externalContext(processInterfaces);
        const assessment = effective && !context.errors.length ? assessRequirement(model, effective, configurationId) : { status: "notChecked", label: "Not checked", detail: "Requirement or configuration is missing or unresolved in this context." };
        const methods = linked(requirement.id, "verifies", true);
        const usedParameters = boundOwners.flatMap((owner) => owner.parameters.filter((parameter) => parameterIds.has(parameter.id)).map((parameter) => ({ owner, parameter })));
        const productParameters = usedParameters.filter(({ owner }) => owner.elementType === "productComponent");
        const industrialParameters = usedParameters.filter(({ owner }) => owner.elementType === "industrialSystemComponent");
        return <tr key={requirement.id} className="align-top">
          <td className="table-cell" data-label="Why is it needed?">{names(owners)}{names(origins)}{names(cases, "Use cases")}{!origins.length && <span className="text-amber-800">No linked need or objective</span>}</td>
          <td className="table-cell" data-label="What must be achieved?"><button className="text-left font-medium text-blue-700 hover:underline" onClick={() => selectElement(requirement.id)}>{requirement.name}</button><div className="mt-1 break-all text-xs text-slate-500">{requirement.id}</div></td>
          <td className="table-cell" data-label="What addresses it in the product?">{names(productFunctions, "Functions")}{names(product, "Components")}{productParameters.map(({ owner, parameter }) => <button key={parameter.id} onClick={() => selectElement(owner.id)} className="mb-1 block text-left text-xs text-blue-700">{parameter.name}: {String(parameter.value ?? "missing")} {parameter.unit}</button>)}{names(productInterfaces, "Boundary interfaces")}{names(productExternals, "External context")}{!productFunctions.length && !product.length && !productParameters.length && <span className="text-slate-500">No product allocation</span>}</td>
          <td className="table-cell" data-label="What supports it industrially?">{names(processes, "Processes")}{names(industrial, "Equipment / workplaces")}{industrialParameters.map(({ owner, parameter }) => <button key={parameter.id} onClick={() => selectElement(owner.id)} className="mb-1 block text-left text-xs text-blue-700">{parameter.name}: {String(parameter.value ?? "missing")} {parameter.unit}</button>)}{names(resources, "Resources")}{names(processInterfaces, "Process interfaces")}{names(processExternals, "External context")}{!processes.length && !industrial.length && <span className="text-slate-500">No industrial path modeled</span>}</td>
          <td className="table-cell" data-label="What is the result?"><span className={`inline-block rounded px-2 py-1 font-medium ${assessment.status === "met" ? "bg-green-100 text-green-800" : assessment.status === "notMet" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{assessment.label}</span><div className="mt-2 break-words text-xs text-slate-600">{assessment.detail}</div>{names(methods, "Check method")}</td>
        </tr>;
      })}</tbody>
      <tfoot><tr><td colSpan={5} className="table-cell bg-slate-50"><strong>Study outcome:</strong> {study?.question ?? "No trade study defined."}<div className="mt-1">{decision ? `${decision.status === "approved" ? "Recorded preferred configuration" : "Proposed configuration"}: ${decision.selectedAlternative}. ${decision.rationale}` : "Decision not recorded."}</div>{decision?.evidenceSnapshot && decision.evidenceSnapshot.projectModelRevision !== project.modelRevision && <div className="mt-1 text-amber-800">Historical decision: the current model has changed. Reassess before making a new decision.</div>}</td></tr></tfoot>
    </table>
    {!requirements.length && <p className="p-4 text-sm text-slate-500">Create requirements to populate the engineering story.</p>}
  </section>{embedded && selected && <ElementEditor element={selected} />}</div>;
}

/** Backward-compatible name used by the Architect review questions. */
export const StakeholderTraceabilityRecap = RequirementsValidationOverview;
