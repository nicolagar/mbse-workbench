import { SemanticElementInspector } from "./SemanticWorkspace";
import { assessRequirement, assessmentModel, recordRequirementReview } from "../domain/requirementAssessment";
import { Copy, Link2, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { allowedCalculatedParameterIds } from "../domain/calculatedParameters";
import { evaluateFormula } from "../domain/formulas";
import { contextConnectionsForElement } from "../domain/contextConnections";
import { elementTypeLabels, type FormulaBinding, type ModelElement, type Parameter, type Relationship, type ScalarValue } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { useDialogs } from "./dialogs/DialogProvider";

export function ElementEditor({ element, onSave }: { element: ModelElement; onSave?: () => void }) {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const updateElement = useAppStore((state) => state.updateElement);
  const addRelationship = useAppStore((state) => state.addRelationship);
  const updateRelationship = useAppStore((state) => state.updateRelationship);
  const deleteRelationship = useAppStore((state) => state.deleteRelationship);
  const duplicateElement = useAppStore((state) => state.duplicateElement);
  const deleteElement = useAppStore((state) => state.deleteElement);
  const selectElement = useAppStore((state) => state.selectElement);
  const selectRelationship = useAppStore((state) => state.selectRelationship);
  const addParameter = useAppStore((state) => state.addParameter);
  const updateParameter = useAppStore((state) => state.updateParameter);
  const deleteParameter = useAppStore((state) => state.deleteParameter);
  const hasSoiRelationships = useMemo(() => project.relationships.filter((relationship) =>
    relationship.relationshipType === "hasSOI" && relationship.targetId === element.id
  ), [project.relationships, element.id]);
  const [draft, setDraft] = useState(element);
  const [missionId, setMissionId] = useState(hasSoiRelationships[0]?.sourceId ?? "");
  useEffect(() => {
    setDraft(element);
    setMissionId(hasSoiRelationships[0]?.sourceId ?? "");
  }, [element, hasSoiRelationships]);
  const incoming = project.relationships.filter((relationship) => relationship.targetId === element.id);
  const outgoing = project.relationships.filter((relationship) => relationship.sourceId === element.id);
  const contextReferences = contextConnectionsForElement(project, element);
  const allTags = useMemo(() => [...new Set(project.elements.flatMap((item) => item.tags))].sort(), [project.elements]);
  const definitions = project.customAttributeDefinitions.filter((definition) => definition.elementType === element.elementType);

  const configurationId = project.architectures.find((item) => item.id === project.activeArchitectureId)?.configurationId;
  const assessmentContext = useMemo(() => element.elementType === "systemRequirement" ? assessmentModel(project, configurationId).project : project, [project, configurationId, element.elementType]);
  const assessmentElement = assessmentContext.elements.find((item) => item.id === element.id) ?? element;
  const result = element.elementType === "systemRequirement" ? assessRequirement(assessmentContext, assessmentElement, configurationId) : undefined;
  const setReview = (value: "met" | "notMet" | "assumed" | "notChecked") => {
    const copy = { ...project, elements: project.elements.map((item) => item.id === draft.id ? structuredClone(draft) : item) };
    recordRequirementReview(copy, draft.id, value, configurationId);
    setDraft(copy.elements.find((item) => item.id === draft.id)!);
  };
  const save = () => {
    const next = {
      ...draft,
      architectureScope: "common" as const,
      architectureId: undefined
    };
    updateElement(element.id, next);
    const [primary, ...duplicates] = hasSoiRelationships;
    if (!missionId) {
      hasSoiRelationships.forEach((relationship) => deleteRelationship(relationship.id));
    } else if (primary) {
      if (primary.sourceId !== missionId) updateRelationship(primary.id, { sourceId: missionId });
      duplicates.forEach((relationship) => deleteRelationship(relationship.id));
    } else {
      const now = new Date().toISOString();
      const relationship: Relationship = {
        id: `relationship-has-soi-${element.id}-${crypto.randomUUID()}`,
        relationshipType: "hasSOI",
        sourceId: missionId,
        targetId: element.id,
        name: "Has system of interest",
        description: "Identifies the system of interest governed by this mission.",
        createdAt: now,
        updatedAt: now
      };
      addRelationship(relationship);
    }
    onSave?.();
  };

  const addNewParameter = () => {
    const parameter: Parameter = {
      id: `parameter-${crypto.randomUUID()}`,
      ownerElementId: element.id,
      name: "New parameter",
      semanticKey: "new_parameter",
      description: "",
      dataType: "number",
      value: null,
      valueOrigin: "entered",
      applicableConfigurationIds: []
    };
    addParameter(element.id, parameter);
  };

  const remove = async () => {
    const affected = incoming.length + outgoing.length;
    if (await confirm(`Delete "${element.name}"? ${affected} relationships and ${contextReferences.length} typed context references will also be removed.`, { confirmLabel: "Delete", tone: "danger" })) {
      deleteElement(element.id);
      selectElement(null);
    }
  };

  return (
    <aside className="card sticky overflow-auto" style={{ top: "calc(var(--workbench-header-height, var(--architect-header-height, 64px)) + 16px)", maxHeight: "calc(100vh - var(--workbench-header-height, var(--architect-header-height, 64px)) - 32px)" }} aria-label="Element details">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white p-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-slate-500">{elementTypeLabels[element.elementType]}</div>
          <h2 className="truncate font-bold">{element.name}</h2>
        </div>
        <button className="btn p-2" aria-label="Close details" onClick={() => selectElement(null)}><X size={16} /></button>
      </div>
      <div className="space-y-4 p-4">
        <SemanticElementInspector elementId={element.id} kind={element.elementType} />
        <label><span className="label">Name</span><input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label><span className="label">Description</span><textarea className="field min-h-24" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label><span className="label">Record review</span><select className="field" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ModelElement["status"] })}><option>draft</option><option>reviewed</option><option>approved</option></select></label>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">This element belongs to the canonical 150% Product-Line Model. Configure its existence or property effects with variation points.</div>
        {draft.elementType === "system" && <div className="space-y-3 rounded-lg border border-purple-200 p-3">
          <label className="block"><span className="label">Mission served</span><select className="field" value={missionId} onChange={(event) => setMissionId(event.target.value)}><option value="">Select mission…</option>{project.elements.filter((item) => item.elementType === "mission").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="block"><span className="label">System boundary</span><textarea className="field" value={draft.metadata.systemBoundary ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, systemBoundary: event.target.value } })} /></label>
          <label className="block"><span className="label">Represented by product assembly</span><select className="field" value={draft.metadata.architectureRootId ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, architectureRootId: event.target.value || undefined } })}><option value="">Select assembly…</option>{project.elements.filter((item) => item.elementType === "productComponent").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>}
        {draft.elementType === "useCase" && <label className="block"><span className="label">System being used</span><select className="field" value={draft.metadata.subjectSystemId ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, subjectSystemId: event.target.value || undefined } })}><option value="">Select system…</option>{project.elements.filter((item) => item.elementType === "system").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {["productComponent", "industrialSystemComponent"].includes(draft.elementType) && <label className="block"><span className="label">Part of assembly</span><select className="field" value={draft.metadata.parentAssemblyId ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, parentAssemblyId: event.target.value || undefined } })}><option value="">Top-level / no parent</option>{project.elements.filter((item) => item.elementType === draft.elementType && item.id !== draft.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {draft.elementType === "productComponent" && <div className="space-y-2"><label className="block"><span className="label">Mass accounting</span><select className="field" value={draft.metadata.massAccounting ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, massAccounting: event.target.value as ModelElement["metadata"]["massAccounting"] } })}><option value="">Not declared</option><option value="contributes">Own mass contribution</option><option value="includedElsewhere">Included in another contribution</option><option value="outsideBoundary">Outside the modeled mass boundary</option></select></label>{draft.metadata.massAccounting && draft.metadata.massAccounting !== "contributes" && <label className="block"><span className="label">Where is its mass accounted for?</span><input className="field" value={draft.metadata.massAccountingNote ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, massAccountingNote: event.target.value } })} /></label>}</div>}
        {result && <div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{result.label}</strong><p className="mt-1 text-xs text-slate-600">{result.detail}</p></div>}
        {draft.elementType === "systemRequirement" && !draft.requirementFormula?.expression.trim() && <label className="block"><span className="label">What is the current result for this requirement?</span><select className="field" value={draft.metadata.requirementReviews?.[configurationId ?? "model"]?.result ?? "notChecked"} onChange={(event) => setReview(event.target.value as "met" | "notMet" | "assumed" | "notChecked")}><option value="notChecked">Not checked</option><option value="met">Met by review</option><option value="notMet">Not met by review</option><option value="assumed">Assumed for demonstration</option></select><span className="mt-1 block text-xs text-slate-500">Saved for {project.configurations.find((item) => item.id === configurationId)?.name ?? "the product-line model"}. Use Description / Source for the review basis.</span></label>}
        <label>
          <span className="label">Tags (comma-separated; existing tags are suggested)</span>
          <input className="field" list="model-tag-suggestions" value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
          <datalist id="model-tag-suggestions">{allTags.map((tag) => <option key={tag} value={tag} />)}</datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Owner</span><input className="field" value={draft.metadata.owner ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, owner: event.target.value } })} /></label>
          <label><span className="label">Source</span><input className="field" value={draft.metadata.source ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, source: event.target.value } })} /></label>
        </div>
        {draft.elementType === "processFunction" && <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Duration</span><input className="field" type="number" min="0" value={draft.metadata.duration ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, duration: event.target.value === "" ? undefined : Number(event.target.value) } })} /></label>
          <label><span className="label">Duration unit</span><select className="field" value={draft.metadata.durationUnit ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, durationUnit: event.target.value as "minute" | "hour" | "day" } })}><option value="">Select…</option><option>minute</option><option>hour</option><option>day</option></select></label>
        </div>}
        {draft.elementType === "resource" && <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Resource type</span><select className="field" value={draft.metadata.resourceType ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, resourceType: event.target.value as NonNullable<ModelElement["metadata"]["resourceType"]> } })}><option value="">Select…</option>{["person", "role", "skill", "tool", "machine", "software", "facility"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span className="label">Hourly rate</span><input className="field" type="number" min="0" value={draft.metadata.hourlyRate ?? ""} onChange={(event) => setDraft({ ...draft, metadata: { ...draft.metadata, hourlyRate: event.target.value === "" ? undefined : Number(event.target.value) } })} /></label>
        </div>}

        {definitions.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="font-bold">Custom attributes</h3>
            <div className="mt-3 space-y-3">
              {definitions.map((definition) => (
                <label key={definition.id}>
                  <span className="label">{definition.name}{definition.unit ? ` (${definition.unit})` : ""}{definition.required ? " *" : ""}</span>
                  {definition.dataType === "boolean" ? (
                    <select className="field" value={String(draft.customAttributeValues[definition.id] ?? "")} onChange={(event) => setDraft({ ...draft, customAttributeValues: { ...draft.customAttributeValues, [definition.id]: event.target.value === "" ? null : event.target.value === "true" } })}><option value="">Not set</option><option value="true">True</option><option value="false">False</option></select>
                  ) : (
                    <input className="field" type={definition.dataType === "number" ? "number" : "text"} value={String(draft.customAttributeValues[definition.id] ?? "")} onChange={(event) => setDraft({ ...draft, customAttributeValues: { ...draft.customAttributeValues, [definition.id]: parseScalar(event.target.value, definition.dataType) } })} />
                  )}
                </label>
              ))}
            </div>
          </section>
        )}

        {draft.elementType === "systemRequirement" && <FormulaEditor draft={draft} setDraft={setDraft} />}
        <button className="btn btn-primary w-full" onClick={save}><Save size={15} /> Save element</button>

        <section className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between"><h3 className="font-bold">Parameters</h3><button className="btn" onClick={addNewParameter}><Plus size={14} /> Add</button></div>
          <div className="mt-3 space-y-3">
            {element.parameters.map((parameter) => {
              const supportsFormula = ["productComponent", "industrialSystemComponent"].includes(element.elementType);
              return (
              <div key={parameter.id} className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-[1fr_96px_36px] gap-2">
                  <input aria-label="Parameter name" className="field" value={parameter.name} onChange={(event) => updateParameter(element.id, parameter.id, { name: event.target.value, semanticKey: event.target.value.toLowerCase().replace(/\W+/g, "_") })} />
                  <select aria-label="Value origin" className="field px-2" value={parameter.valueOrigin} onChange={(event) => {
                    const valueOrigin = event.target.value as Parameter["valueOrigin"];
                    updateParameter(element.id, parameter.id, {
                      valueOrigin,
                      calculation: valueOrigin === "calculated" && supportsFormula
                        ? parameter.calculation ?? { expression: "", bindings: [] }
                        : undefined,
                      calculationStatus: undefined,
                      calculationMessage: undefined
                    });
                  }}><option>entered</option><option>assumed</option>{supportsFormula && <option>calculated</option>}<option>simulated</option></select>
                  <button className="btn btn-danger p-2" aria-label="Delete parameter" onClick={() => deleteParameter(element.id, parameter.id)}><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input aria-label="Parameter value" className={`field ${parameter.calculation ? "bg-slate-50" : ""}`} readOnly={Boolean(parameter.calculation)} type={parameter.dataType === "number" ? "number" : "text"} value={parameter.value === null ? "" : String(parameter.value)} onChange={(event) => updateParameter(element.id, parameter.id, { value: parseScalar(event.target.value, parameter.dataType) })} />
                  <input aria-label="Parameter unit" className={`field ${parameter.calculation ? "bg-slate-50" : ""}`} readOnly={Boolean(parameter.calculation)} placeholder="Unit" key={`${parameter.id}-${parameter.unit}`} defaultValue={parameter.unit ?? ""} onBlur={(event) => { if (event.target.value !== (parameter.unit ?? "")) updateParameter(element.id, parameter.id, { unit: event.target.value }); }} />
                </div>
                {parameter.semanticKey === "mass" && <div className="mt-2 space-y-2"><label className="block"><span className="label">Contribution basis</span><select className="field" value={parameter.contributionBasis ?? "local"} onChange={(event) => updateParameter(element.id, parameter.id, { contributionBasis: event.target.value as "local" | "aggregate" })}><option value="local">Local contribution</option><option value="aggregate">Includes child masses</option></select></label><label className="block"><span className="label">Quantity already represented by this value</span><input className="field" value={parameter.quantityBasis ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { quantityBasis: event.target.value })} placeholder="For example: all latches in one modeled segment" /></label></div>}
                <label className="mt-2 block"><span className="label">Source / provenance</span><input aria-label={`Source of ${parameter.name}`} className="field" placeholder="Document, calculation, supplier, assumption…" value={parameter.source ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { source: event.target.value })} /></label>
                {parameter.dataType === "number" && <div className="mt-2 grid grid-cols-3 gap-2">
                  <label><span className="label">Minimum</span><input aria-label={`Minimum of ${parameter.name}`} className="field" type="number" value={parameter.minimum ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { minimum: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                  <label><span className="label">Maximum</span><input aria-label={`Maximum of ${parameter.name}`} className="field" type="number" value={parameter.maximum ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { maximum: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                  <label><span className="label">Uncertainty ±%</span><input aria-label={`Uncertainty of ${parameter.name}`} className="field" type="number" min="0" max="100" value={parameter.uncertaintyPercent ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { uncertaintyPercent: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
                </div>}
                <fieldset className="mt-2 rounded-lg border border-slate-200 p-2">
                  <legend className="px-1 text-[11px] font-semibold text-slate-600">Applicable configurations</legend>
                  <p className="mb-1 text-[10px] text-slate-500">No selection means every configuration.</p>
                  <div className="max-h-24 space-y-1 overflow-auto">{project.configurations.filter((configuration) => !configuration.archivedAt).map((configuration) => <label className="flex items-center gap-2 text-xs" key={configuration.id}><input type="checkbox" checked={parameter.applicableConfigurationIds.includes(configuration.id)} onChange={(event) => updateParameter(element.id, parameter.id, { applicableConfigurationIds: event.target.checked ? [...parameter.applicableConfigurationIds, configuration.id] : parameter.applicableConfigurationIds.filter((id) => id !== configuration.id) })} />{configuration.name}</label>)}</div>
                </fieldset>
                {parameter.calculation && <CalculatedParameterFields element={element} parameter={parameter} />}
              </div>
            );})}
            {!element.parameters.length && <p className="text-sm text-slate-500">No parameters assigned.</p>}
          </div>
        </section>

        <section className="border-t border-slate-200 pt-4">
          <h3 className="flex items-center gap-2 font-bold"><Link2 size={16} /> Connected elements</h3>
          <div className="mt-2 space-y-1 text-sm">
            {[...incoming, ...outgoing].map((relationship) => {
              const otherId = relationship.sourceId === element.id ? relationship.targetId : relationship.sourceId;
              const other = project.elements.find((item) => item.id === otherId);
              return (
                <button key={relationship.id} className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-50" onClick={() => { selectElement(otherId); selectRelationship(relationship.id); }}>
                  <span className="truncate">{other?.name ?? "Missing element"}</span>
                  <span className="text-xs text-slate-400">{relationship.relationshipType}</span>
                </button>
              );
            })}
            {contextReferences.map((relationship) => {
              const otherId = relationship.sourceId === element.id ? relationship.targetId : relationship.sourceId;
              const other = project.elements.find((item) => item.id === otherId);
              return <button key={relationship.id} className="flex w-full items-center justify-between rounded bg-teal-50 px-2 py-1 text-left hover:bg-teal-100" onClick={() => selectElement(relationship.ownerId === element.id ? otherId : relationship.ownerId)}><span className="truncate">{other?.name ?? "Missing element"}</span><span className="text-xs text-teal-700">{relationship.label} · reference</span></button>;
            })}
            {!incoming.length && !outgoing.length && !contextReferences.length && <p className="text-slate-500">No connectivity yet.</p>}
          </div>
        </section>
        <div className="flex gap-2 border-t border-slate-200 pt-4">
          <button className="btn flex-1" onClick={() => duplicateElement(element.id)}><Copy size={15} /> Duplicate</button>
          <button className="btn btn-danger flex-1" onClick={remove}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
    </aside>
  );
}

function parseScalar(value: string, dataType: Parameter["dataType"]): ScalarValue {
  if (value === "") return null;
  if (dataType === "number") return Number(value);
  if (dataType === "boolean") return value === "true";
  return value;
}

function CalculatedParameterFields({ element, parameter }: { element: ModelElement; parameter: Parameter }) {
  const project = useAppStore(selectActiveProject)!;
  const updateParameter = useAppStore((state) => state.updateParameter);
  const [selectedReference, setSelectedReference] = useState("");
  const calculation = parameter.calculation!;
  const allowedIds = allowedCalculatedParameterIds(project, element.id);
  const references = project.elements.flatMap((owner) => owner.parameters
    .filter((candidate) => allowedIds.has(candidate.id) && candidate.id !== parameter.id)
    .map((candidate) => ({
      value: candidate.id,
      label: `${owner.name} · ${candidate.name}${candidate.unit ? ` (${candidate.unit})` : ""}`,
      symbol: candidate.semanticKey || candidate.name.toLowerCase().replace(/\W+/g, "_")
    })));
  const patchCalculation = (patch: Partial<NonNullable<Parameter["calculation"]>>) =>
    updateParameter(element.id, parameter.id, { calculation: { ...calculation, ...patch } });
  const addBinding = () => {
    const reference = references.find((item) => item.value === selectedReference);
    if (!reference) return;
    let symbol = reference.symbol;
    let suffix = 2;
    while (calculation.bindings.some((binding) => binding.symbol === symbol)) symbol = `${reference.symbol}_${suffix++}`;
    patchCalculation({
      expression: `${calculation.expression}${calculation.expression ? " " : ""}@${symbol}`,
      bindings: [...calculation.bindings, {
        id: `binding-${crypto.randomUUID()}`,
        symbol,
        kind: "parameter",
        targetId: reference.value
      }]
    });
    setSelectedReference("");
  };
  const tone = parameter.calculationStatus === "calculated"
    ? "border-green-200 bg-green-50 text-green-800"
    : parameter.calculationStatus === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/40 p-3">
      <div className="font-semibold">Calculated parameter formula</div>
      <p className="mt-1 text-[11px] text-slate-600">Use +, −, ×, ÷, parentheses, sqrt and ^/** powers. References are limited to this component and its transitive refiners.</p>
      <textarea aria-label={`Calculation formula for ${parameter.name}`} className="field mt-2 min-h-16 font-mono" placeholder="@length_1 + @length_2" value={calculation.expression} onChange={(event) => patchCalculation({ expression: event.target.value })} />
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <select aria-label={`Calculation reference for ${parameter.name}`} className="field" value={selectedReference} onChange={(event) => setSelectedReference(event.target.value)}><option value="">Select hierarchy parameter…</option>{references.map((reference) => <option value={reference.value} key={reference.value}>{reference.label}</option>)}</select>
        <button className="btn" disabled={!selectedReference} onClick={addBinding}><Plus size={13} /> Insert</button>
      </div>
      <label className="mt-2 block"><span className="label">Requested output unit (optional)</span><input className="field" placeholder="Infer automatically" value={calculation.requestedUnit ?? ""} onChange={(event) => patchCalculation({ requestedUnit: event.target.value || undefined })} /></label>
      <div className="mt-2 space-y-1">{calculation.bindings.map((binding) => {
        const reference = references.find((item) => item.value === binding.targetId);
        return <div className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs" key={binding.id}><code className="font-semibold text-purple-700">@{binding.symbol}</code><span className="min-w-0 flex-1 truncate">{reference?.label ?? "Missing reference"}</span><button aria-label={`Remove calculated parameter binding ${binding.symbol}`} onClick={() => patchCalculation({ bindings: calculation.bindings.filter((item) => item.id !== binding.id) })}><X size={12} /></button></div>;
      })}</div>
      <div className={`mt-2 rounded border p-2 text-xs ${tone}`}><strong>{parameter.calculationStatus ?? "pending"}</strong> · {parameter.calculationMessage ?? "Assign variables and enter a formula."}</div>
    </div>
  );
}

function FormulaEditor({ draft, setDraft }: { draft: ModelElement; setDraft: (element: ModelElement) => void }) {
  const project = useAppStore(selectActiveProject)!;
  const [selectedReference, setSelectedReference] = useState("");
  const formula = draft.requirementFormula ?? { expression: "", bindings: [] };
  const evaluation = evaluateFormula(project, formula);
  const references = [
    ...project.elements.flatMap((owner) => owner.parameters.map((parameter) => ({
      value: `parameter:${parameter.id}`,
      label: `${owner.name} · ${parameter.name}${parameter.unit ? ` (${parameter.unit})` : ""}`,
      symbol: parameter.semanticKey || parameter.name.toLowerCase().replace(/\W+/g, "_"),
      kind: "parameter" as const,
      targetId: parameter.id
    }))),
    ...project.kpis.map((kpi) => ({
      value: `kpi:${kpi.id}`,
      label: `KPI · ${kpi.name} (${kpi.outputUnit})`,
      symbol: kpi.name.toLowerCase().replace(/\W+/g, "_"),
      kind: "kpi" as const,
      targetId: kpi.id
    }))
  ];
  const addBinding = () => {
    const reference = references.find((item) => item.value === selectedReference);
    if (!reference) return;
    let symbol = reference.symbol;
    let suffix = 2;
    while (formula.bindings.some((binding) => binding.symbol === symbol)) symbol = `${reference.symbol}_${suffix++}`;
    const binding: FormulaBinding = {
      id: `binding-${crypto.randomUUID()}`,
      symbol,
      kind: reference.kind,
      targetId: reference.targetId
    };
    setDraft({
      ...draft,
      requirementFormula: {
        ...formula,
        expression: `${formula.expression}${formula.expression ? " " : ""}@${symbol}`,
        bindings: [...formula.bindings, binding]
      }
    });
    setSelectedReference("");
  };
  const tone = {
    satisfied: "border-green-200 bg-green-50 text-green-800",
    failed: "border-red-200 bg-red-50 text-red-800",
    pending: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
    notDefined: "border-slate-200 bg-slate-50 text-slate-600"
  }[evaluation.status];
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <h3 className="font-bold">Requirement formula</h3>{formula.comparisonUnit && <p className="mt-1 text-xs text-slate-600">Numeric limit is authored in {formula.comparisonUnit}; changing an input display unit does not change this limit.</p>}
      <p className="mt-1 text-xs text-slate-600">Use arithmetic, parentheses and one comparison. References are stored by immutable ID. Manually entered variables may be saved, but remain pending and count as failed until assigned to a parameter or future KPI.</p>
      <textarea className="field mt-3 min-h-20 font-mono" aria-label="Requirement formula" placeholder="@mass <= 1000" value={formula.expression} onChange={(event) => setDraft({ ...draft, requirementFormula: { ...formula, expression: event.target.value } })} />
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <select className="field" aria-label="Formula reference" value={selectedReference} onChange={(event) => setSelectedReference(event.target.value)}>
          <option value="">Select parameter or future KPI…</option>
          {references.map((reference) => <option key={reference.value} value={reference.value}>{reference.label}</option>)}
        </select>
        <button className="btn" disabled={!selectedReference} onClick={addBinding}><Plus size={14} /> Insert</button>
      </div>
      <div className="mt-2 space-y-1">
        {formula.bindings.map((binding) => {
          const label = references.find((reference) => reference.targetId === binding.targetId && reference.kind === binding.kind)?.label ?? "Missing reference";
          return (
            <div className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs" key={binding.id}>
              <code className="font-semibold text-blue-700">@{binding.symbol}</code>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <button aria-label={`Remove @${binding.symbol}`} onClick={() => setDraft({ ...draft, requirementFormula: { ...formula, bindings: formula.bindings.filter((item) => item.id !== binding.id), bindingUnits: Object.fromEntries(Object.entries(formula.bindingUnits ?? {}).filter(([symbol]) => symbol !== binding.symbol)), comparisonUnit: formula.bindings.length === 1 ? undefined : formula.comparisonUnit } })}><X size={13} /></button>
            </div>
          );
        })}
      </div>
      <div className={`mt-3 rounded border p-2 text-xs ${tone}`}><strong>{evaluation.status}</strong> · {evaluation.message}</div>
    </section>
  );
}
