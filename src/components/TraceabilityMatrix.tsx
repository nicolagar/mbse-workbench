import { Filter, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ContextConnection } from "../domain/contextConnections";
import { compatibleRelationshipDirections } from "../domain/relationships";
import { elementTypeLabels, type ElementType, type ModelElement, type Relationship } from "../domain/types";
import { useAppStore } from "../store/useAppStore";
import { useDialogs } from "./dialogs/DialogProvider";

export function TraceabilityMatrix({
  elements,
  relationships,
  contextRelationships = [],
  columnTypes,
  scopedElementIds
}: {
  elements: ModelElement[];
  relationships: Relationship[];
  contextRelationships?: ContextConnection[];
  columnTypes?: ElementType[];
  scopedElementIds?: Set<string>;
}) {
  const { confirm, alertUser } = useDialogs();
  const addRelationship = useAppStore((state) => state.addRelationship);
  const bindRequirementParameter = useAppStore((state) => state.bindRequirementParameter);
  const deleteRelationship = useAppStore((state) => state.deleteRelationship);
  const selectElement = useAppStore((state) => state.selectElement);
  const selectRelationship = useAppStore((state) => state.selectRelationship);
  const types = columnTypes ?? [...new Set(elements.map((element) => element.elementType))];
  const [rowFilter, setRowFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<ElementType, string>>>({});
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [pending, setPending] = useState<{ rowSourceId: string; counterpartType: ElementType } | null>(null);
  const [targetChoice, setTargetChoice] = useState("");
  const [relationshipChoice, setRelationshipChoice] = useState("");
  const source = elements.find((element) => element.id === pending?.rowSourceId);
  const targets = pending ? elements.filter((element) => element.elementType === pending.counterpartType && element.id !== pending.rowSourceId) : [];
  const [targetKind, targetId] = targetChoice.split(":");
  const selectedTarget = targetKind === "element" ? elements.find((element) => element.id === targetId) : undefined;
  const parameterOwner = targetKind === "parameter"
    ? elements.find((element) => element.parameters.some((parameter) => parameter.id === targetId))
    : undefined;
  const selectedParameter = parameterOwner?.parameters.find((parameter) => parameter.id === targetId);
  const relationshipOptions = source && selectedTarget
    ? compatibleRelationshipDirections(source.elementType, selectedTarget.elementType).map(({ direction, relationshipType }) => ({
        direction,
        type: relationshipType,
        label: direction === "forward"
          ? `${source.name} → ${relationshipType} → ${selectedTarget.name}`
          : `${selectedTarget.name} → ${relationshipType} → ${source.name} (canonical direction)`
      }))
    : [];
  const canBindParameters = source?.elementType === "systemRequirement"
    && pending
    && ["productFunction", "productComponent", "processFunction", "industrialSystemComponent"].includes(pending.counterpartType);
  const connectionTerms = (row: ModelElement, counterpartType: ElementType) => {
    const terms: string[] = [];
    relationships.forEach((relationship) => {
      const otherId = relationship.sourceId === row.id ? relationship.targetId : relationship.targetId === row.id ? relationship.sourceId : undefined;
      const counterpart = otherId ? elements.find((element) => element.id === otherId && element.elementType === counterpartType) : undefined;
      if (counterpart) terms.push(counterpart.name, counterpart.id, relationship.relationshipType);
    });
    contextRelationships.forEach((relationship) => {
      const otherId = relationship.sourceId === row.id ? relationship.targetId : relationship.targetId === row.id ? relationship.sourceId : undefined;
      const counterpart = otherId ? elements.find((element) => element.id === otherId && element.elementType === counterpartType) : undefined;
      if (counterpart) terms.push(counterpart.name, counterpart.id, relationship.label);
    });
    if (row.elementType === "systemRequirement") (row.requirementFormula?.bindings ?? []).forEach((binding) => {
      if (binding.kind !== "parameter") return;
      const owner = elements.find((element) => element.elementType === counterpartType && element.parameters.some((parameter) => parameter.id === binding.targetId));
      const parameter = owner?.parameters.find((item) => item.id === binding.targetId);
      if (owner && parameter) terms.push(owner.name, parameter.name, binding.symbol, "parameter binding");
    });
    return terms;
  };
  const filteredRows = elements.filter((row) => {
    const rowQuery = rowFilter.trim().toLowerCase();
    if (rowQuery && !`${row.name} ${row.id} ${elementTypeLabels[row.elementType]} ${row.elementType}`.toLowerCase().includes(rowQuery)) return false;
    const allTerms = types.flatMap((type) => connectionTerms(row, type));
    if (connectedOnly && allTerms.length === 0) return false;
    return types.every((type) => {
      const query = columnFilters[type]?.trim().toLowerCase();
      return !query || connectionTerms(row, type).some((term) => term.toLowerCase().includes(query));
    });
  });

  const create = () => {
    if (!source) return;
    if (selectedParameter) {
      const error = bindRequirementParameter(source.id, selectedParameter.id);
      if (error) void alertUser(error);
      else {
        setPending(null);
        setTargetChoice("");
        setRelationshipChoice("");
      }
      return;
    }
    const selected = relationshipOptions.find((option) => `${option.direction}:${option.type}` === relationshipChoice);
    if (!selectedTarget || !selected) return;
    const canonicalSource = selected.direction === "forward" ? source : selectedTarget;
    const canonicalTarget = selected.direction === "forward" ? selectedTarget : source;
    const architectureId = canonicalSource.architectureScope === "specific"
      ? canonicalSource.architectureId
      : canonicalTarget.architectureScope === "specific"
        ? canonicalTarget.architectureId
        : undefined;
    const now = new Date().toISOString();
    const error = addRelationship({
      id: `relationship-${crypto.randomUUID()}`,
      sourceId: canonicalSource.id,
      targetId: canonicalTarget.id,
      relationshipType: selected.type,
      architectureId,
      createdAt: now,
      updatedAt: now
    });
    if (error) void alertUser(error);
    else {
      setPending(null);
      setTargetChoice("");
      setRelationshipChoice("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span className="flex items-center gap-1 font-semibold text-slate-700"><Filter size={14} /> Matrix filters</span><label className="flex items-center gap-2"><input type="checkbox" checked={connectedOnly} onChange={(event) => setConnectedOnly(event.target.checked)} />Connected rows only</label>{(rowFilter || Object.values(columnFilters).some(Boolean) || connectedOnly) && <button className="text-blue-700 hover:underline" onClick={() => { setRowFilter(""); setColumnFilters({}); setConnectedOnly(false); }}>Clear filters</button>}<span className="ml-auto text-slate-500">{filteredRows.length} of {elements.length} rows</span></div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-max min-w-full border-collapse" aria-label="Editable traceability matrix">
          <thead><tr><th className="table-cell sticky left-0 top-0 z-30 w-64 min-w-64 bg-slate-50"><span className="block whitespace-nowrap">Selected element</span><input aria-label="Filter selected elements" className="field mt-2 py-1 text-xs font-normal" value={rowFilter} onChange={(event) => setRowFilter(event.target.value)} placeholder="Name or stereotype…" /></th>{types.map((type) => <th className="table-cell sticky top-0 z-20 min-w-64 bg-slate-50" key={type}><span className="block whitespace-nowrap">Connected: {elementTypeLabels[type]}</span><input aria-label={`Filter connected ${elementTypeLabels[type]}`} className="field mt-2 py-1 text-xs font-normal" value={columnFilters[type] ?? ""} onChange={(event) => setColumnFilters((current) => ({ ...current, [type]: event.target.value }))} placeholder="Name or relationship…" /></th>)}</tr></thead>
          <tbody>
            {filteredRows.map((rowSource) => (
              <tr key={rowSource.id}>
                <th className="table-cell sticky left-0 z-10 w-64 min-w-64 max-w-64 bg-white font-medium"><button className="text-left text-blue-700 hover:underline" onClick={() => selectElement(rowSource.id)}>{rowSource.name}</button><div className="text-[10px] font-normal text-slate-400">{elementTypeLabels[rowSource.elementType]}{scopedElementIds && !scopedElementIds.has(rowSource.id) ? " · outside working scope" : ""}</div>{rowSource.parameters.length > 0 && <div className="mt-1 space-y-0.5 border-l-2 border-slate-200 pl-2 text-left text-[10px] font-normal text-slate-500">{rowSource.parameters.map((parameter) => <div key={parameter.id}>↳ {parameter.name}: {parameter.value ?? "—"}{parameter.unit ? ` ${parameter.unit}` : ""}</div>)}</div>}</th>
                {types.map((type) => {
                  const matches = relationships.filter((relationship) => {
                    const otherId = relationship.sourceId === rowSource.id
                      ? relationship.targetId
                      : relationship.targetId === rowSource.id
                        ? relationship.sourceId
                        : undefined;
                    return Boolean(otherId && elements.find((element) => element.id === otherId)?.elementType === type);
                  });
                  const contextMatches = contextRelationships.filter((relationship) => {
                    const otherId = relationship.sourceId === rowSource.id
                      ? relationship.targetId
                      : relationship.targetId === rowSource.id
                        ? relationship.sourceId
                        : undefined;
                    return Boolean(otherId && elements.find((element) => element.id === otherId)?.elementType === type);
                  });
                  const parameterBindings = rowSource.elementType === "systemRequirement"
                    ? (rowSource.requirementFormula?.bindings ?? []).flatMap((binding) => {
                        if (binding.kind !== "parameter") return [];
                        const owner = elements.find((element) => element.elementType === type && element.parameters.some((parameter) => parameter.id === binding.targetId));
                        const parameter = owner?.parameters.find((item) => item.id === binding.targetId);
                        return owner && parameter ? [{ binding, owner, parameter }] : [];
                      })
                    : [];
                  const canCreate = targetsForType(elements, rowSource, type).some((target) =>
                    compatibleRelationshipDirections(rowSource.elementType, target.elementType).length > 0
                    || (rowSource.elementType === "systemRequirement"
                      && ["productFunction", "productComponent", "processFunction", "industrialSystemComponent"].includes(target.elementType)
                      && target.parameters.length > 0)
                  );
                  return (
                    <td className="table-cell w-64 min-w-64 max-w-64" key={type}>
                      {matches.map((relationship) => {
                        const outgoing = relationship.sourceId === rowSource.id;
                        const counterpart = elements.find((element) => element.id === (outgoing ? relationship.targetId : relationship.sourceId));
                        return (
                          <div key={relationship.id} className="mb-1 flex items-start gap-1 rounded bg-blue-50 p-2 text-xs text-blue-800">
                            <button className="min-w-0 flex-1 text-left" title={`${relationship.sourceId} —${relationship.relationshipType}→ ${relationship.targetId}`} onClick={() => { selectRelationship(relationship.id); selectElement(counterpart?.id ?? null); }}>
                              <strong>{outgoing ? "→" : "←"} {relationship.relationshipType}</strong><br /><span className="line-clamp-2">{counterpart?.name}</span>
                            </button>
                            <button aria-label={`Delete ${relationship.relationshipType} relationship`} className="rounded p-1 hover:bg-red-100 hover:text-red-700" onClick={async () => { if (await confirm("Delete this relationship?", { confirmLabel: "Delete", tone: "danger" })) deleteRelationship(relationship.id); }}><Trash2 size={12} /></button>
                          </div>
                        );
                      })}
                      {contextMatches.map((relationship) => {
                        const outgoing = relationship.sourceId === rowSource.id;
                        const counterpart = elements.find((element) => element.id === (outgoing ? relationship.targetId : relationship.sourceId));
                        return <button key={relationship.id} className="mb-1 block w-full rounded border border-teal-100 bg-teal-50 p-2 text-left text-xs text-teal-800" title="Typed context reference · edit from element details" onClick={() => selectElement(relationship.ownerId)}><strong>{outgoing ? "→" : "←"} {relationship.label}</strong><br /><span className="line-clamp-2">{counterpart?.name}</span><span className="mt-1 block text-[10px]">Reference · edit in details</span></button>;
                      })}
                      {parameterBindings.map(({ binding, owner, parameter }) => <button key={binding.id} className="mb-1 block w-full rounded border border-purple-100 bg-purple-50 p-2 text-left text-[11px] text-purple-800" onClick={() => selectElement(rowSource.id)}><strong>@{binding.symbol}</strong><br />↳ {owner.name} · {parameter.name}</button>)}
                      {canCreate && <button className="mt-1 flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline" onClick={() => { setPending({ rowSourceId: rowSource.id, counterpartType: type }); setTargetChoice(""); setRelationshipChoice(""); }}><Plus size={12} /> Link</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredRows.length && <p className="p-8 text-center text-slate-500">No elements match the current matrix filters.</p>}
      </div>
      {pending && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-6">
          <section className="card w-full max-w-lg p-5" role="dialog" aria-modal="true" aria-label="Create matrix relationship">
            <div className="flex items-start gap-2"><div className="flex-1"><h2 className="font-bold">Create traceability link</h2><p className="text-sm text-slate-500">{source?.name} ↔ {elementTypeLabels[pending.counterpartType]}</p></div><button className="btn p-2" aria-label="Close" onClick={() => setPending(null)}><X size={15} /></button></div>
            <div className="mt-4 space-y-3">
              <label><span className="label">Element or nested parameter</span><select className="field" value={targetChoice} onChange={(event) => { setTargetChoice(event.target.value); setRelationshipChoice(""); }}><option value="">Select…</option>{targets.map((target) => <optgroup label={target.name} key={target.id}><option value={`element:${target.id}`}>{target.name}</option>{canBindParameters && target.parameters.map((parameter) => <option value={`parameter:${parameter.id}`} key={parameter.id}>↳ {parameter.name}{parameter.unit ? ` (${parameter.unit})` : ""}</option>)}</optgroup>)}</select></label>
              {selectedParameter
                ? <div className="rounded border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">Creates or reuses <strong>Requirement → satisfiedBy → {parameterOwner?.name}</strong> and stores an immutable formula binding to <strong>{selectedParameter.name}</strong>. Complete the formula expression in requirement properties when needed.</div>
                : <label><span className="label">Canonical relationship</span><select className="field" value={relationshipChoice} disabled={!selectedTarget} onChange={(event) => setRelationshipChoice(event.target.value)}><option value="">Select…</option>{relationshipOptions.map((option) => <option value={`${option.direction}:${option.type}`} key={`${option.direction}:${option.type}`}>{option.label}</option>)}</select></label>}
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setPending(null)}>Cancel</button><button className="btn btn-primary" disabled={!selectedParameter && !relationshipChoice} onClick={create}>{selectedParameter ? "Bind parameter" : "Create relationship"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function targetsForType(elements: ModelElement[], source: ModelElement, type: ElementType) {
  return elements.filter((element) => element.id !== source.id && element.elementType === type);
}

export { StakeholderTraceabilityRecap } from "./StakeholderTraceabilityRecap";
