import { Fragment, useMemo, useState, type ReactNode } from "react";
import { assessRequirement, assessmentModel } from "../domain/requirementAssessment";
import { satisfactionEvidence } from "../domain/traceability";
import type { ModelElement, Project } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

const unique = (items: ModelElement[]) => [...new Map(items.map((item) => [item.id, item])).values()];

interface RecapGroup {
  id: string;
  mission?: ModelElement;
  context?: ModelElement;
  intent?: ModelElement;
  requirement?: ModelElement;
}

function linked(project: Project, id: string, type: string, reverse = false) {
  return project.relationships
    .filter((edge) => edge.relationshipType === type && (reverse ? edge.targetId : edge.sourceId) === id)
    .map((edge) => project.elements.find((item) => item.id === (reverse ? edge.sourceId : edge.targetId)))
    .filter((item): item is ModelElement => Boolean(item));
}

function contextMission(project: Project, context: ModelElement) {
  const type = context.elementType === "system"
    ? "hasSOI"
    : context.elementType === "externalSystem"
      ? "participatesInMission"
      : "hasStakeholder";
  return linked(project, context.id, type, true).find((item) => item.elementType === "mission");
}

function recapGroups(project: Project): RecapGroup[] {
  const contexts = project.elements.filter((item) => ["system", "stakeholder", "externalSystem"].includes(item.elementType));
  const groups: RecapGroup[] = [];
  contexts.forEach((context) => {
    const mission = contextMission(project, context);
    const intents = ["stakeholder", "system"].includes(context.elementType)
      ? unique([...linked(project, context.id, "hasNeed"), ...linked(project, context.id, "hasObjective")])
      : [];
    if (!intents.length) {
      groups.push({ id: `context-${context.id}`, mission, context });
      return;
    }
    intents.forEach((intent) => {
      const requirements = linked(project, intent.id, "derives").filter((item) => item.elementType === "systemRequirement");
      if (!requirements.length) groups.push({ id: `intent-${context.id}-${intent.id}`, mission, context, intent });
      requirements.forEach((requirement) => groups.push({ id: `trace-${context.id}-${intent.id}-${requirement.id}`, mission, context, intent, requirement }));
    });
  });
  const representedRequirementIds = new Set(groups.flatMap((group) => group.requirement ? [group.requirement.id] : []));
  project.elements.filter((item) => item.elementType === "systemRequirement" && !representedRequirementIds.has(item.id))
    .forEach((requirement) => groups.push({ id: `unowned-${requirement.id}`, requirement }));
  return groups;
}

function assessmentClass(status?: string) {
  if (status === "met") return "bg-green-100 text-green-800";
  if (status === "notMet") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export function ModellingRecap() {
  const project = useAppStore(selectActiveProject)!;
  const selectElement = useAppStore((state) => state.selectElement);
  const architecture = project.architectures.find((item) => item.id === project.activeArchitectureId);
  const configurationId = architecture?.configurationId;
  const context = useMemo(() => assessmentModel(project, configurationId), [project, configurationId]);
  const model = context.project;
  const groups = useMemo(() => recapGroups(project), [project]);
  const [filters, setFilters] = useState<string[]>(Array(9).fill(""));
  const setFilter = (index: number, value: string) => setFilters((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  const matches = (index: number, value: string) => !filters[index].trim() || value.toLowerCase().includes(filters[index].trim().toLowerCase());
  const button = (item?: ModelElement, detail?: string): ReactNode => item
    ? <button className="block w-full text-left text-sm text-blue-700 hover:underline" onClick={() => selectElement(item.id)}>{detail ? <><span className="text-[10px] font-semibold uppercase text-slate-500">{detail}</span><br /></> : null}{item.name}</button>
    : <span className="text-slate-400">—</span>;
  const cellEntry = (item: ModelElement, label?: string) => <div key={`${label}-${item.id}`} className="mb-1">{button(item, label)}</div>;

  return <section className="card overflow-hidden">
    <div className="border-b border-slate-200 p-4">
      <h2 className="font-bold">Model Digital Thread</h2>
      <p className="mt-1 text-sm text-slate-600">Follow the complete digital thread from mission and context through requirements, product and industrial realization, and the current validation result.</p>
      <p className="mt-2 text-xs text-slate-500">Context: {architecture?.name ?? "150% product-line model"}. Stored relationships and schema-defined context references retain their distinct meanings.</p>
      {context.errors.length > 0 && <p role="alert" className="mt-2 text-sm text-red-700">{context.errors.join(" ")}</p>}
    </div>
    <div className="max-h-[75vh] overflow-auto">
      <table className="ontology-recap min-w-[1500px] w-full table-fixed text-left text-sm" aria-label="Complete modelling overview">
        <thead className="sticky top-0 z-20 bg-slate-50"><tr>{[
          "Mission",
          "System of interest / stakeholder / external system",
          "Need / objective",
          "Requirement",
          "Product function",
          "Product component / parameter / interface",
          "Process function",
          "Industrial component / interface / parameter / resource",
          "Validation result"
        ].map((label, index) => <th className="table-cell align-top whitespace-normal" key={label}><span className="block min-h-9">{label}</span><input aria-label={`Filter ${label}`} className="field mt-1 py-1 text-xs font-normal" value={filters[index]} onChange={(event) => setFilter(index, event.target.value)} placeholder="Filter…" /></th>)}</tr></thead>
        <tbody>{groups.map((group) => {
          const requirement = group.requirement;
          if (!requirement) {
            if (![matches(0, group.mission?.name ?? ""), matches(1, `${group.context?.name ?? ""} ${group.context?.elementType ?? ""}`), matches(2, `${group.intent?.name ?? ""} ${group.intent?.elementType ?? ""}`)].every(Boolean)) return null;
            return <tr key={group.id} className="align-top">
            <td className="table-cell">{button(group.mission)}</td><td className="table-cell">{button(group.context, group.context?.elementType)}</td><td className="table-cell">{button(group.intent, group.intent?.elementType)}</td><td className="table-cell" colSpan={6}><span className="text-slate-500">No derived requirement or downstream trace is recorded for this context item.</span></td>
          </tr>;
          }
          const effective = model.elements.find((item) => item.id === requirement.id);
          const productFunctions = linked(model, requirement.id, "satisfiedBy").filter((item) => item.elementType === "productFunction");
          const productComponents = satisfactionEvidence(model, requirement, "productComponent");
          const parameterIds = new Set(requirement.requirementFormula?.bindings.flatMap((binding) => binding.kind === "parameter"
            ? [binding.targetId]
            : context.results.find((result) => result.kpiId === binding.targetId)?.sourceParameterIds ?? []) ?? []);
          const boundOwners = model.elements.filter((item) => item.parameters.some((parameter) => parameterIds.has(parameter.id)));
          const product = unique([...productComponents, ...boundOwners.filter((item) => item.elementType === "productComponent")]);
          const productInterfaces = unique([...productFunctions, ...product].flatMap((item) => linked(model, item.id, "connects")).filter((item) => item.elementType === "productInterface"));
          const processes = unique([
            ...linked(model, requirement.id, "satisfiedBy").filter((item) => item.elementType === "processFunction"),
            ...product.flatMap((item) => ["produces", "consumes", "allocatedTo"].flatMap((type) => linked(model, item.id, type, true))).filter((item) => item.elementType === "processFunction")
          ]);
          const industrial = unique([...satisfactionEvidence(model, requirement, "industrialSystemComponent"), ...processes.flatMap((item) => linked(model, item.id, "realizedBy"))]);
          const processInterfaces = unique([...processes, ...industrial].flatMap((item) => linked(model, item.id, "connects")).filter((item) => item.elementType === "processInterface"));
          const resources = unique(industrial.flatMap((item) => linked(model, item.id, "requiresResource")));
          const productDetails: ReactNode[] = [
            ...product.map((item) => cellEntry(item, "Component")),
            ...boundOwners.filter((item) => item.elementType === "productComponent").flatMap((owner) => owner.parameters.filter((parameter) => parameterIds.has(parameter.id)).map((parameter) => <button key={parameter.id} className="mb-1 block text-left text-xs text-blue-700" onClick={() => selectElement(owner.id)}><span className="font-semibold text-slate-500">Parameter</span><br />{owner.name} — {parameter.name}: {String(parameter.value ?? "missing")} {parameter.unit ?? ""}</button>)),
            ...productInterfaces.map((item) => cellEntry(item, "Interface"))
          ];
          const industrialDetails: ReactNode[] = [
            ...industrial.map((item) => cellEntry(item, "Component")),
            ...boundOwners.filter((item) => item.elementType === "industrialSystemComponent").flatMap((owner) => owner.parameters.filter((parameter) => parameterIds.has(parameter.id)).map((parameter) => <button key={parameter.id} className="mb-1 block text-left text-xs text-blue-700" onClick={() => selectElement(owner.id)}><span className="font-semibold text-slate-500">Parameter</span><br />{owner.name} — {parameter.name}: {String(parameter.value ?? "missing")} {parameter.unit ?? ""}</button>)),
            ...processInterfaces.map((item) => cellEntry(item, "Interface")),
            ...resources.map((item) => cellEntry(item, "Resource"))
          ];
          const columns: ReactNode[][] = [
            productFunctions.map((item) => cellEntry(item)),
            productDetails,
            processes.map((item) => cellEntry(item)),
            industrialDetails
          ];
          const rowCount = Math.max(1, ...columns.map((items) => items.length));
          const assessment = effective && !context.errors.length
            ? assessRequirement(model, effective, configurationId)
            : { status: "notChecked" as const, label: "Not checked", detail: "Requirement or configuration is unresolved in this context." };
          const columnText = [
            group.mission?.name ?? "",
            `${group.context?.name ?? ""} ${group.context?.elementType ?? ""}`,
            `${group.intent?.name ?? ""} ${group.intent?.elementType ?? ""}`,
            `${requirement.name} ${requirement.id}`,
            productFunctions.map((item) => `${item.name} ${item.elementType}`).join(" "),
            [...product, ...productInterfaces, ...boundOwners.filter((item) => item.elementType === "productComponent")].map((item) => `${item.name} ${item.elementType} ${item.parameters.map((parameter) => parameter.name).join(" ")}`).join(" "),
            processes.map((item) => `${item.name} ${item.elementType}`).join(" "),
            [...industrial, ...processInterfaces, ...resources, ...boundOwners.filter((item) => item.elementType === "industrialSystemComponent")].map((item) => `${item.name} ${item.elementType} ${item.parameters.map((parameter) => parameter.name).join(" ")}`).join(" "),
            `${assessment.label} ${assessment.detail}`
          ];
          if (!columnText.every((value, index) => matches(index, value))) return null;
          return <Fragment key={group.id}>{Array.from({ length: rowCount }, (_, index) => <tr key={`${group.id}-${index}`} className="align-top">
            {index === 0 && <>
              <td className="table-cell" rowSpan={rowCount}>{button(group.mission)}</td>
              <td className="table-cell" rowSpan={rowCount}>{button(group.context, group.context?.elementType)}</td>
              <td className="table-cell" rowSpan={rowCount}>{button(group.intent, group.intent?.elementType)}</td>
              <td className="table-cell" rowSpan={rowCount}>{button(requirement)}<div className="mt-1 break-all text-xs text-slate-500">{requirement.id}</div></td>
            </>}
            {columns.map((items, columnIndex) => <td className="table-cell" key={columnIndex}>{items[index] ?? <span className="text-slate-400">—</span>}</td>)}
            {index === 0 && <td className="table-cell" rowSpan={rowCount}><span className={`inline-block rounded px-2 py-1 font-medium ${assessmentClass(assessment.status)}`}>{assessment.label}</span><div className="mt-2 break-words text-xs text-slate-600">{assessment.detail}</div></td>}
          </tr>)}</Fragment>;
        })}</tbody>
      </table>
    </div>
    {!groups.length && <p className="p-4 text-sm text-slate-500">Create mission and context elements to populate the modelling overview.</p>}
  </section>;
}
