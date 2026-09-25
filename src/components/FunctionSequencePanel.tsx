import { GitBranch, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { processFunctionFlowStatus, processHandoffStatus } from "../domain/processFlows";
import { calculateSemanticScope } from "../domain/semanticScope";
import { analyzeSequence, sequenceFunctionHierarchy } from "../domain/sequences";
import type { FunctionSequence, FunctionSequenceDomain, GraphLayoutMode, ModelElement, Relationship, RelationshipType } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { ModelGraph } from "./ModelGraph";
import { AllSequencesOverview } from "./AllSequencesOverview";

export function FunctionSequencePanel({
  domain,
  contextElements,
  layoutMode,
  onLayoutModeChange,
  scopedElementIds
}: {
  domain: FunctionSequenceDomain;
  contextElements: ModelElement[];
  layoutMode: GraphLayoutMode;
  onLayoutModeChange: (mode: GraphLayoutMode) => void;
  scopedElementIds: Set<string>;
}) {
  const project = useAppStore(selectActiveProject)!;
  const addSequence = useAppStore((state) => state.addFunctionSequence);
  const updateSequence = useAppStore((state) => state.updateFunctionSequence);
  const deleteSequence = useAppStore((state) => state.deleteFunctionSequence);
  const addRelationship = useAppStore((state) => state.addRelationship);
  const updateRelationship = useAppStore((state) => state.updateRelationship);
  const deleteRelationship = useAppStore((state) => state.deleteRelationship);
  const sequences = project.functionSequences.filter((sequence) =>
    sequence.domain === domain
    && (!project.activeArchitectureId || !sequence.architectureId || sequence.architectureId === project.activeArchitectureId)
  );
  const [selectedId, setSelectedId] = useState(sequences[0]?.id ?? "");
  const [sequenceView, setSequenceView] = useState<"individual" | "overview">("individual");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const selected = sequences.find((sequence) => sequence.id === selectedId) ?? sequences[0];
  const contextIds = new Set(contextElements.map((element) => element.id));
  const projectScope = calculateSemanticScope(project);
  const useCases = projectScope.workingUseCases;
  const fallbackProcessFunctionIds = projectScope.processFunctions
    .filter((element) => !project.relationships.some((relationship) => relationship.relationshipType === "refines" && relationship.targetId === element.id))
    .map((element) => element.id);
  const hierarchyRows = selected
    ? sequenceFunctionHierarchy(project, selected).filter((row) => contextIds.has(row.element.id))
    : [];
  const selectableFunctionIds = hierarchyRows.filter((row) => row.selectable).map((row) => row.element.id);
  const analysis = useMemo(() => selected ? analyzeSequence(project, selected) : undefined, [project, selected]);
  const sequenceRelationships = selected
    ? project.relationships.filter((relationship) => relationship.sequenceId === selected.id && relationship.relationshipType === "precedes")
    : [];
  const selectedItemFlowRelationships = selected && domain === "process"
    ? project.relationships.filter((relationship) =>
        selected.functionIds.includes(relationship.sourceId)
        && (relationship.relationshipType === "consumes" || relationship.relationshipType === "produces")
      )
    : [];

  const createSequence = () => {
    const now = new Date().toISOString();
    const sequence: FunctionSequence = {
      id: `sequence-${crypto.randomUUID()}`,
      name: "",
      description: "",
      domain,
      architectureId: undefined,
      useCaseIds: [],
      functionIds: [],
      relationshipIds: [],
      createdAt: now,
      updatedAt: now
    };
    addSequence(sequence);
    setSelectedId(sequence.id);
    onLayoutModeChange("sequence");
  };

  const changeUseCase = (useCaseId: string) => {
    if (!selected) return;
    if ((selected.functionIds.length || sequenceRelationships.length) && !window.confirm("Changing the use case removes the current sequence functions and connectors. Continue?")) return;
    updateSequence(selected.id, { useCaseIds: useCaseId ? [useCaseId] : [], functionIds: [], relationshipIds: [] });
    setSourceId("");
    setTargetId("");
  };

  const addEdge = () => {
    if (!selected || !sourceId || !targetId) return;
    const now = new Date().toISOString();
    const error = addRelationship({
      id: `relationship-${crypto.randomUUID()}`,
      relationshipType: "precedes",
      sourceId,
      targetId,
      sequenceId: selected.id,
      architectureId: selected.architectureId,
      createdAt: now,
      updatedAt: now
    });
    if (error) window.alert(error);
    else {
      setSourceId("");
      setTargetId("");
    }
  };

  if (!selected) {
    return (
      <div className="space-y-4">{domain === "process" && <ProcessItemFlowEditor functionIds={fallbackProcessFunctionIds} />}<section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Function sequences</h2><p className="text-sm text-slate-500">Create a sequence, name it, then select one system-of-interest use case.</p></div><button className="btn btn-primary" onClick={createSequence}><Plus size={15} /> Create sequence</button></div></section></div>
    );
  }

  if (sequenceView === "overview") return <div className="space-y-3"><div className="flex gap-2"><button className="btn" onClick={() => setSequenceView("individual")}>Individual sequence</button><button className="btn btn-primary">All sequences</button></div><AllSequencesOverview project={project} domain={domain} /></div>;

  const graphIds = new Set([
    ...selected.functionIds,
    ...selectedItemFlowRelationships.map((relationship) => relationship.targetId)
  ]);
  const graphElements = project.elements.filter((element) => graphIds.has(element.id));
  const graphRelationships = project.relationships.filter((relationship) =>
    graphIds.has(relationship.sourceId)
    && graphIds.has(relationship.targetId)
    && (relationship.sequenceId === selected.id || selectedItemFlowRelationships.some((item) => item.id === relationship.id))
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2"><button className="btn btn-primary">Individual sequence</button><button className="btn" onClick={() => setSequenceView("overview")}>All sequences</button></div>
      <section className="card p-4">
        <div className="mb-4 border-b border-slate-200 pb-3"><h2 className="text-lg font-bold">Function sequence definition</h2><p className="text-sm text-slate-500">Select one eligible use case, add every related leaf function, then draw predecessor/successor connectors in the diagram.</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-72 flex-1"><span className="label">Named sequence</span><select className="field" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{sequences.map((sequence) => <option value={sequence.id} key={sequence.id}>{sequence.name}</option>)}</select></label>
          <button className="btn" onClick={createSequence}><Plus size={15} /> Create sequence</button>
          <button className="btn btn-danger" onClick={() => {
            if (window.confirm(`Delete “${selected.name}” and its precedence links?`)) {
              deleteSequence(selected.id);
              setSelectedId(sequences.find((sequence) => sequence.id !== selected.id)?.id ?? "");
            }
          }}><Trash2 size={14} /> Delete</button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          <label><span className="label">Sequence name</span><input autoFocus={!selected.name} className="field" value={selected.name} onChange={(event) => updateSequence(selected.id, { name: event.target.value })} placeholder="Enter a sequence name" /></label>
          <label><span className="label">Use case described</span><select aria-label="Sequence use case" className="field" value={selected.useCaseIds[0] ?? ""} onChange={(event) => changeUseCase(event.target.value)}><option value="">Select one use case…</option>{useCases.map((useCase) => <option value={useCase.id} key={useCase.id}>{useCase.name}</option>)}</select><span className="mt-1 block text-[11px] text-slate-500">Only project working-scope use cases involving the system of interest are available.</span></label>
          <label><span className="label">Architecture</span><input className="field bg-slate-50" readOnly value={project.architectures.find((architecture) => architecture.id === selected.architectureId)?.name ?? "Common / all"} /></label>
        </div>
        <label className="mt-3 block"><span className="label">Description</span><input className="field" value={selected.description} onChange={(event) => updateSequence(selected.id, { description: event.target.value })} /></label>
        <fieldset className="mt-4 rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">Related function hierarchy</legend><p className="mb-2 text-xs text-slate-500">Parent functions provide hierarchy context. Only leaf functions without children can be added to the sequence.</p><div className="max-h-64 space-y-1 overflow-auto">{hierarchyRows.map((row) => {
          const checked = selected.functionIds.includes(row.element.id);
          return <div className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${row.selectable ? "hover:bg-blue-50" : "bg-slate-50 font-semibold text-slate-600"}`} style={{ marginLeft: `${row.depth * 22}px` }} key={row.element.id}>{row.selectable ? <label className="flex min-w-0 flex-1 items-center gap-2"><input aria-label={`Add ${row.element.name} to sequence`} type="checkbox" checked={checked} onChange={() => updateSequence(selected.id, { functionIds: checked ? selected.functionIds.filter((id) => id !== row.element.id) : [...selected.functionIds, row.element.id] })} /><span className="truncate">{row.element.name}</span><span className="ml-auto text-[10px] font-normal uppercase text-blue-700">Leaf function</span></label> : <><span className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-200" aria-hidden="true" /><span className="truncate">{row.element.name}</span><span className="ml-auto text-[10px] font-normal uppercase text-slate-500">Parent context</span></>}</div>;
        })}{selected.useCaseIds.length === 0 && <p className="p-3 text-sm text-amber-700">Select a use case to load its related function hierarchy.</p>}{selected.useCaseIds.length === 1 && !hierarchyRows.length && <p className="p-3 text-sm text-amber-700">No {domain} function is related to this use case.</p>}</div></fieldset>
        <div className={`mt-3 rounded border p-3 text-sm ${analysis?.errors.length ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          <strong>{analysis?.errors.length ? "Sequence requires attention" : "Sequence valid"}</strong>
          {analysis?.errors.length
            ? <ul className="mt-1 list-disc pl-5">{analysis.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            : <span> · {analysis?.startFunctionIds.length} start, {analysis?.endFunctionIds.length} end; parallel branches use AND semantics.</span>}
        </div>
      </section>

      {domain === "process" && selected.useCaseIds.length === 1 && <ProcessItemFlowEditor functionIds={selectableFunctionIds} />}

      <section className="card overflow-hidden">
        <div className="flex items-center gap-4 border-b border-slate-200 p-4"><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 font-bold"><GitBranch size={17} /> Function sequence</h2><p className="text-xs text-slate-500">Selected leaf functions appear immediately. Drag from one node handle to another to create a directed predecessor/successor connector.</p></div><label className="w-48"><span className="label">Layout</span><select className="field" value={layoutMode} onChange={(event) => onLayoutModeChange(event.target.value as GraphLayoutMode)}><option value="manual">Manual</option><option value="hierarchy">Hierarchy</option><option value="sequence">Sequence</option></select></label></div>
        <ModelGraph elements={graphElements} relationships={graphRelationships} sequence={selected} layoutMode={layoutMode} layoutKey={`sequence:${selected.id}`} scopedElementIds={scopedElementIds} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4"><h2 className="font-bold">Synchronized predecessor/successor table</h2></div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-slate-200 p-3 max-md:grid-cols-1">
          <select aria-label="Sequence predecessor" className="field" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Predecessor…</option>{selected.functionIds.map((id) => <option value={id} key={id}>{project.elements.find((element) => element.id === id)?.name}</option>)}</select>
          <select aria-label="Sequence successor" className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Successor…</option>{selected.functionIds.filter((id) => id !== sourceId).map((id) => <option value={id} key={id}>{project.elements.find((element) => element.id === id)?.name}</option>)}</select>
          <button className="btn btn-primary" disabled={!sourceId || !targetId} onClick={addEdge}><Plus size={14} /> Link</button>
        </div>
        <table className="min-w-full"><thead><tr><th className="table-cell">Stage</th><th className="table-cell">Predecessor</th><th className="table-cell">Successor</th><th className="table-cell">Description</th><th className="table-cell">Handoff</th><th className="table-cell">Semantics</th><th className="table-cell">Action</th></tr></thead><tbody>{sequenceRelationships.map((relationship) => {
          const handoff = domain === "process" ? processHandoffStatus(project, relationship) : undefined;
          const products = handoff?.matchedComponentIds.map((id) => project.elements.find((element) => element.id === id)?.name ?? id);
          return <tr key={relationship.id}><td className="table-cell">{analysis?.stageLabels[relationship.sourceId]} → {analysis?.stageLabels[relationship.targetId]}</td><td className="table-cell">{project.elements.find((element) => element.id === relationship.sourceId)?.name}</td><td className="table-cell">{project.elements.find((element) => element.id === relationship.targetId)?.name}</td><td className="table-cell"><input className="field min-w-52" aria-label={`Description of sequence relationship ${relationship.id}`} value={relationship.description ?? ""} onChange={(event) => updateRelationship(relationship.id, { description: event.target.value })} /></td><td className="table-cell text-xs">{handoff ? <span className={handoff.complete ? "text-green-700" : "text-red-700"}>{handoff.complete ? products?.join(", ") : handoff.matchedComponentIds.length ? "Unit mismatch" : "Missing product handoff"}</span> : "—"}</td><td className="table-cell text-xs">Immediate precedence · AND split/join</td><td className="table-cell"><button className="btn btn-danger" onClick={() => deleteRelationship(relationship.id)}><Trash2 size={13} /> Delete</button></td></tr>;
        })}</tbody></table>
      </section>
    </div>
  );
}

function ProcessItemFlowEditor({ functionIds }: { functionIds: string[] }) {
  const project = useAppStore(selectActiveProject)!;
  const addRelationship = useAppStore((state) => state.addRelationship);
  const [flowFunctionId, setFlowFunctionId] = useState("");
  const [flowType, setFlowType] = useState<Extract<RelationshipType, "consumes" | "produces">>("consumes");
  const [flowProductId, setFlowProductId] = useState("");
  const [flowQuantity, setFlowQuantity] = useState("1");
  const [flowUnit, setFlowUnit] = useState("part");
  const [flowName, setFlowName] = useState("");
  const productComponents = project.elements.filter((element) =>
    element.elementType === "productComponent"
    && (!project.activeArchitectureId || element.architectureScope === "common" || element.architectureId === project.activeArchitectureId)
  );
  const itemFlowRelationships = project.relationships.filter((relationship) =>
    functionIds.includes(relationship.sourceId)
    && (relationship.relationshipType === "consumes" || relationship.relationshipType === "produces")
  );
  const addItemFlow = () => {
    if (!flowFunctionId || !flowProductId) return;
    const source = project.elements.find((element) => element.id === flowFunctionId);
    const target = project.elements.find((element) => element.id === flowProductId);
    const architectureId = source?.architectureScope === "specific"
      ? source.architectureId
      : target?.architectureScope === "specific"
        ? target.architectureId
        : undefined;
    const now = new Date().toISOString();
    const error = addRelationship({
      id: `relationship-${crypto.randomUUID()}`,
      relationshipType: flowType,
      sourceId: flowFunctionId,
      targetId: flowProductId,
      itemFlowName: flowName.trim() || undefined,
      quantity: Number(flowQuantity),
      unit: flowUnit.trim(),
      architectureId,
      createdAt: now,
      updatedAt: now
    });
    if (error) window.alert(error);
    else {
      setFlowProductId("");
      setFlowName("");
    }
  };
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 p-4">
        <h2 className="font-bold">Product input/output flows</h2>
        <p className="mt-1 text-xs text-slate-500">Define these before or after sequencing. Each flow requires a product component, positive quantity and unit. Start functions produce; intermediate and isolated functions consume and produce; end functions consume.</p>
      </div>
      <div className="grid grid-cols-6 gap-2 border-b border-slate-200 p-3">
        <label><span className="label">Process function</span><select aria-label="Flow process function" className="field" value={flowFunctionId} onChange={(event) => setFlowFunctionId(event.target.value)}><option value="">Function…</option>{functionIds.map((id) => <option value={id} key={id}>{project.elements.find((element) => element.id === id)?.name}</option>)}</select></label>
        <label><span className="label">Direction</span><select aria-label="Flow direction" className="field" value={flowType} onChange={(event) => setFlowType(event.target.value as typeof flowType)}><option value="consumes">Consumes</option><option value="produces">Produces</option></select></label>
        <label><span className="label">Product component</span><select aria-label="Flow product component" className="field" value={flowProductId} onChange={(event) => setFlowProductId(event.target.value)}><option value="">Product…</option>{productComponents.map((element) => <option value={element.id} key={element.id}>{element.name}</option>)}</select></label>
        <label><span className="label">Quantity</span><input aria-label="Flow quantity" className="field" type="number" min="0.000001" step="any" value={flowQuantity} onChange={(event) => setFlowQuantity(event.target.value)} /></label>
        <label><span className="label">Unit</span><input aria-label="Flow unit" className="field" value={flowUnit} onChange={(event) => setFlowUnit(event.target.value)} /></label>
        <label><span className="label">Item-flow name (optional)</span><input aria-label="Item-flow name" className="field" value={flowName} onChange={(event) => setFlowName(event.target.value)} /></label>
        <div className="col-span-6 flex justify-end"><button className="btn btn-primary" disabled={!flowFunctionId || !flowProductId || !flowQuantity || !flowUnit.trim()} onClick={addItemFlow}><Plus size={14} /> Add product flow</button></div>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">{functionIds.map((id) => {
          const status = processFunctionFlowStatus(project, id);
          const name = project.elements.find((element) => element.id === id)?.name ?? id;
          return <span className={`badge ${status.complete ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} key={id}>{name} · {status.roles.join("/")} · {status.consumes.length} in / {status.produces.length} out</span>;
        })}</div>
      </div>
      <table className="min-w-full">
        <thead><tr><th className="table-cell">Function</th><th className="table-cell">Direction</th><th className="table-cell">Product component</th><th className="table-cell">Quantity</th><th className="table-cell">Unit</th><th className="table-cell">Item-flow name</th><th className="table-cell">Action</th></tr></thead>
        <tbody>
          {itemFlowRelationships.map((relationship) => <ProcessItemFlowRow relationship={relationship} key={relationship.id} />)}
          {!itemFlowRelationships.length && <tr><td className="table-cell py-8 text-center text-slate-500" colSpan={7}>No product input/output flows are defined in this architecture context.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function ProcessItemFlowRow({ relationship }: { relationship: Relationship }) {
  const project = useAppStore(selectActiveProject)!;
  const updateRelationship = useAppStore((state) => state.updateRelationship);
  const deleteRelationship = useAppStore((state) => state.deleteRelationship);
  const [quantity, setQuantity] = useState(String(relationship.quantity ?? relationship.requiredQuantity ?? ""));
  const [unit, setUnit] = useState(relationship.unit ?? "");
  const [itemFlowName, setItemFlowName] = useState(relationship.itemFlowName ?? "");
  const save = () => {
    const error = updateRelationship(relationship.id, {
      quantity: Number(quantity),
      requiredQuantity: undefined,
      unit: unit.trim(),
      itemFlowName: itemFlowName.trim() || undefined
    });
    if (error) window.alert(error);
  };
  return (
    <tr>
      <td className="table-cell">{project.elements.find((element) => element.id === relationship.sourceId)?.name}</td>
      <td className="table-cell font-semibold">{relationship.relationshipType}</td>
      <td className="table-cell">{project.elements.find((element) => element.id === relationship.targetId)?.name}</td>
      <td className="table-cell"><input aria-label={`Quantity of ${relationship.id}`} className="field min-w-24" type="number" min="0.000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></td>
      <td className="table-cell"><input aria-label={`Unit of ${relationship.id}`} className="field min-w-24" value={unit} onChange={(event) => setUnit(event.target.value)} /></td>
      <td className="table-cell"><input aria-label={`Item-flow name of ${relationship.id}`} className="field min-w-40" value={itemFlowName} onChange={(event) => setItemFlowName(event.target.value)} /></td>
      <td className="table-cell"><div className="flex gap-2"><button className="btn" onClick={save}>Save</button><button className="btn btn-danger" onClick={() => deleteRelationship(relationship.id)}><Trash2 size={13} /> Delete</button></div></td>
    </tr>
  );
}
