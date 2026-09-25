import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { allowedRelationships } from "../domain/relationships";
import { elementTypeLabels, type Relationship, type RelationshipType } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { useDialogs } from "./dialogs/DialogProvider";

const carriesQuantity = (type: RelationshipType) => ["requiresResource", "consumes", "produces"].includes(type);
const carriesItemFlow = (type: RelationshipType) => ["consumes", "produces"].includes(type);

export function RelationshipManager() {
  const { confirm, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addRelationship = useAppStore((state) => state.addRelationship);
  const updateRelationship = useAppStore((state) => state.updateRelationship);
  const deleteRelationship = useAppStore((state) => state.deleteRelationship);
  const selectElement = useAppStore((state) => state.selectElement);
  const selectRelationship = useAppStore((state) => state.selectRelationship);
  const [sourceId, setSourceId] = useState("");
  const [relation, setRelation] = useState<RelationshipType | "">("");
  const [targetId, setTargetId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [itemFlowName, setItemFlowName] = useState("");
  const [error, setError] = useState("");
  const source = project.elements.find((element) => element.id === sourceId);
  const relationOptions = useMemo(
    () => source
      ? [...new Set(allowedRelationships.filter(([type]) => type === source.elementType).map(([, item]) => item))]
      : [],
    [source]
  );
  const targetTypes = source && relation
    ? allowedRelationships.filter(([type, item]) => type === source.elementType && item === relation).map(([, , type]) => type)
    : [];
  const targetOptions = project.elements.filter((element) => targetTypes.includes(element.elementType));

  const create = () => {
    if (!sourceId || !relation || !targetId) {
      setError("Select a compatible source, relationship, and target.");
      return;
    }
    const now = new Date().toISOString();
    const selectedSource = project.elements.find((element) => element.id === sourceId);
    const selectedTarget = project.elements.find((element) => element.id === targetId);
    const architectureId = selectedSource?.architectureScope === "specific"
      ? selectedSource.architectureId
      : selectedTarget?.architectureScope === "specific"
        ? selectedTarget.architectureId
        : undefined;
    const parsedQuantity = carriesQuantity(relation) && quantity !== "" ? Number(quantity) : undefined;
    const candidate: Relationship = {
      id: `relationship-${crypto.randomUUID()}`,
      sourceId,
      targetId,
      relationshipType: relation,
      architectureId,
      quantity: parsedQuantity,
      requiredQuantity: relation === "requiresResource" ? parsedQuantity : undefined,
      unit: carriesQuantity(relation) ? unit || undefined : undefined,
      itemFlowName: carriesItemFlow(relation) ? itemFlowName || undefined : undefined,
      createdAt: now,
      updatedAt: now
    };
    const message = addRelationship(candidate);
    setError(message ?? "");
    if (!message) {
      setTargetId("");
      setRelation("");
      setQuantity("1");
      setUnit("");
      setItemFlowName("");
    }
  };

  return (
    <section className="card">
      <div className="border-b border-slate-200 p-4">
        <h2 className="font-bold">Relationship editor</h2>
        <p className="text-xs text-slate-500">Create or modify canonical connectivity. Every saved change updates tables, matrices, diagrams and validation.</p>
      </div>
      <div className="grid grid-cols-[1.25fr_1fr_1.25fr_90px_100px_1fr_auto] gap-3 border-b border-slate-200 p-4 max-2xl:grid-cols-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <label><span className="label">Source</span><select className="field" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setRelation(""); setTargetId(""); }}><option value="">Select source…</option>{project.elements.map((element) => <option key={element.id} value={element.id}>{elementTypeLabels[element.elementType]} · {element.name}</option>)}</select></label>
        <label><span className="label">Relationship</span><select className="field" value={relation} disabled={!source} onChange={(event) => { setRelation(event.target.value as RelationshipType); setTargetId(""); }}><option value="">Select…</option>{relationOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="label">Target</span><select className="field" value={targetId} disabled={!relation} onChange={(event) => setTargetId(event.target.value)}><option value="">Select target…</option>{targetOptions.map((element) => <option key={element.id} value={element.id}>{elementTypeLabels[element.elementType]} · {element.name}</option>)}</select></label>
        <label><span className="label">Quantity</span><input className="field" type="number" min="0.01" step="0.01" disabled={!relation || !carriesQuantity(relation)} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label><span className="label">Unit</span><input className="field" disabled={!relation || !carriesQuantity(relation)} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="part" /></label>
        <label><span className="label">Item flow</span><input className="field" disabled={!relation || !carriesItemFlow(relation)} value={itemFlowName} onChange={(event) => setItemFlowName(event.target.value)} placeholder="Optional flow name" /></label>
        <button className="btn btn-primary self-end" onClick={create}><Plus size={15} /> Create</button>
        {error && <p className="col-span-7 rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-max min-w-full">
          <thead><tr className="[&>th]:whitespace-nowrap"><th className="table-cell">Source</th><th className="table-cell">Relationship</th><th className="table-cell">Target</th><th className="table-cell">Name / item flow</th><th className="table-cell">Quantity / unit</th><th className="table-cell">Description</th><th className="table-cell">Actions</th></tr></thead>
          <tbody>{project.relationships.map((edge) => (
            <RelationshipRow
              key={edge.id}
              edge={edge}
              onNavigate={() => { selectRelationship(edge.id); selectElement(edge.sourceId); }}
              onSave={(patch) => {
                const nextSourceId = patch.sourceId ?? edge.sourceId;
                const nextTargetId = patch.targetId ?? edge.targetId;
                const nextSource = project.elements.find((element) => element.id === nextSourceId);
                const nextTarget = project.elements.find((element) => element.id === nextTargetId);
                const architectureId = nextSource?.architectureScope === "specific"
                  ? nextSource.architectureId
                  : nextTarget?.architectureScope === "specific"
                    ? nextTarget.architectureId
                    : undefined;
                const message = updateRelationship(edge.id, { ...patch, architectureId });
                if (message) void alertUser(message);
              }}
              onDelete={async () => {
                if (await confirm("Delete this relationship?", { confirmLabel: "Delete", tone: "danger" })) deleteRelationship(edge.id);
              }}
            />
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function RelationshipRow({ edge, onNavigate, onSave, onDelete }: {
  edge: Relationship;
  onNavigate: () => void;
  onSave: (patch: Partial<Relationship>) => void;
  onDelete: () => void;
}) {
  const project = useAppStore(selectActiveProject)!;
  const [sourceId, setSourceId] = useState(edge.sourceId);
  const [relationshipType, setRelationshipType] = useState(edge.relationshipType);
  const [targetId, setTargetId] = useState(edge.targetId);
  const [name, setName] = useState(edge.name ?? "");
  const [itemFlowName, setItemFlowName] = useState(edge.itemFlowName ?? "");
  const [quantity, setQuantity] = useState(String(edge.quantity ?? edge.requiredQuantity ?? ""));
  const [unit, setUnit] = useState(edge.unit ?? "");
  const [description, setDescription] = useState(edge.description ?? "");
  const source = project.elements.find((element) => element.id === sourceId);
  const allowedTypes = source
    ? [...new Set(allowedRelationships.filter(([type]) => type === source.elementType).map(([, type]) => type))]
    : [];
  const targetTypes = source
    ? allowedRelationships.filter(([sourceType, type]) => sourceType === source.elementType && type === relationshipType).map(([, , type]) => type)
    : [];
  const targets = project.elements.filter((element) => targetTypes.includes(element.elementType));
  return (
    <tr>
      <td className="table-cell min-w-52"><select aria-label="Relationship source" className="field" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setRelationshipType("" as RelationshipType); setTargetId(""); }}><option value="">Select…</option>{project.elements.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}</select></td>
      <td className="table-cell min-w-40"><select aria-label="Relationship type" className="field" value={relationshipType} onChange={(event) => { setRelationshipType(event.target.value as RelationshipType); setTargetId(""); }}><option value="">Select…</option>{allowedTypes.map((type) => <option key={type}>{type}</option>)}</select></td>
      <td className="table-cell min-w-52"><select aria-label="Relationship target" className="field" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Select…</option>{targets.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}</select></td>
      <td className="table-cell min-w-48"><input aria-label="Relationship name" className="field mb-1" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />{carriesItemFlow(relationshipType) && <input aria-label="Item flow name" className="field" placeholder="Item flow" value={itemFlowName} onChange={(event) => setItemFlowName(event.target.value)} />}</td>
      <td className="table-cell min-w-44">{carriesQuantity(relationshipType) && <div className="grid grid-cols-2 gap-1"><input aria-label="Relationship quantity" className="field" type="number" min="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><input aria-label="Relationship unit" className="field" placeholder="Unit" value={unit} onChange={(event) => setUnit(event.target.value)} /></div>}</td>
      <td className="table-cell min-w-56"><input aria-label="Relationship description" className="field" value={description} onChange={(event) => setDescription(event.target.value)} /></td>
      <td className="table-cell min-w-40"><div className="flex gap-2"><button className="btn p-2" aria-label="Open relationship" onClick={onNavigate}>Open</button><button className="btn p-2" aria-label="Save relationship" onClick={() => onSave({
        sourceId,
        targetId,
        relationshipType,
        name: name || undefined,
        itemFlowName: carriesItemFlow(relationshipType) ? itemFlowName || undefined : undefined,
        quantity: carriesQuantity(relationshipType) && quantity !== "" ? Number(quantity) : undefined,
        requiredQuantity: relationshipType === "requiresResource" && quantity !== "" ? Number(quantity) : undefined,
        unit: carriesQuantity(relationshipType) ? unit || undefined : undefined,
        description: description || undefined
      })}><Save size={14} /></button><button className="btn btn-danger p-2" aria-label="Delete relationship" onClick={onDelete}><Trash2 size={14} /></button></div></td>
    </tr>
  );
}
