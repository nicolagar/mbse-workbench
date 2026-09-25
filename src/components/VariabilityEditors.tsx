import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { parseFeatureExpression } from "../domain/featureExpressions";
import type {
  Configuration,
  ElementType,
  Feature,
  FeatureConstraint,
  FeatureGroup,
  FeatureValueCondition,
  ModelElement,
  Relationship,
  RelationshipType,
  ScalarValue,
  VariationPoint,
  VariationScope,
  VariationValueRule
} from "../domain/types";
import { elementTypeLabels, elementTypes } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { SideEditor } from "./SideEditor";

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const scopes: VariationScope[] = ["requirements", "structure", "behavior", "process", "resources", "verification"];

export function FeatureEditor({
  initial,
  onSave,
  onCancel,
  onDelete
}: {
  initial: Feature;
  onSave: (feature: Feature) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const project = useAppStore(selectActiveProject)!;
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState("");
  const save = () => {
    if (!draft.name.trim()) return setError("Feature name is required.");
    if (draft.featureType !== "root" && !draft.parentId) return setError("A non-root feature requires a parent feature.");
    if (["xor", "or"].includes(draft.featureType) && !draft.groupId?.trim()) return setError("XOR and OR members require a group ID.");
    if (draft.valueType === "enumeration" && !(draft.allowedValues?.length)) return setError("An enumeration feature requires at least one allowed value.");
    onSave({
      ...draft,
      name: draft.name.trim(),
      groupId: ["xor", "or"].includes(draft.featureType) ? draft.groupId?.trim() : undefined,
      allowedValues: draft.valueType === "enumeration" ? draft.allowedValues : [],
      defaultValue: draft.valueType === "enumeration" ? draft.defaultValue : false
    });
  };
  return <SideEditor title={initial.name || "New feature"} eyebrow="Feature Model" onSave={save} onCancel={onCancel} onDelete={onDelete}>
    <label><span className="label">Name</span><input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <label><span className="label">Description</span><textarea className="field min-h-20" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <label><span className="label">Cardinality / feature type</span><select className="field" value={draft.featureType} onChange={(event) => setDraft({ ...draft, featureType: event.target.value as Feature["featureType"], parentId: event.target.value === "root" ? undefined : draft.parentId })}><option>root</option><option>mandatory</option><option>optional</option><option>xor</option><option>or</option></select></label>
    {draft.featureType !== "root" && <label><span className="label">Parent feature</span><select className="field" value={draft.parentId ?? ""} onChange={(event) => setDraft({ ...draft, parentId: event.target.value || undefined })}><option value="">Select parent…</option>{project.features.filter((feature) => feature.id !== draft.id).map((feature) => <option key={feature.id} value={feature.id}>{feature.name} · {feature.id}</option>)}</select></label>}
    {["xor", "or"].includes(draft.featureType) && <label><span className="label">Cardinality group ID</span><input className="field" value={draft.groupId ?? ""} onChange={(event) => setDraft({ ...draft, groupId: event.target.value })} /></label>}
    <label><span className="label">Organizational group</span><select className="field" value={draft.parentGroupId ?? ""} onChange={(event) => setDraft({ ...draft, parentGroupId: event.target.value || undefined })}><option value="">No organizational group</option>{project.featureGroups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3">
      <label><span className="label">Value type</span><select className="field" value={draft.valueType ?? "boolean"} onChange={(event) => setDraft({ ...draft, valueType: event.target.value as Feature["valueType"], allowedValues: event.target.value === "enumeration" ? draft.allowedValues ?? [] : [], defaultValue: event.target.value === "enumeration" ? draft.allowedValues?.[0] ?? "" : false })}><option>boolean</option><option>enumeration</option></select></label>
      <label><span className="label">Variability classification</span><select className="field" value={draft.variabilityScope ?? "external"} onChange={(event) => setDraft({ ...draft, variabilityScope: event.target.value as Feature["variabilityScope"] })}><option>external</option><option>internal</option></select></label>
    </div>
    {draft.valueType === "enumeration" && <>
      <label><span className="label">Allowed values (comma-separated)</span><input className="field" value={draft.allowedValues?.join(", ") ?? ""} onChange={(event) => {
        const allowedValues = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
        setDraft({ ...draft, allowedValues, defaultValue: allowedValues.includes(String(draft.defaultValue)) ? draft.defaultValue : allowedValues[0] ?? "" });
      }} /></label>
      <label><span className="label">Default value</span><select className="field" value={String(draft.defaultValue ?? "")} onChange={(event) => setDraft({ ...draft, defaultValue: event.target.value })}><option value="">Select default…</option>{draft.allowedValues?.map((value) => <option key={value}>{value}</option>)}</select></label>
    </>}
    <label><span className="label">Sibling sort order</span><input className="field" type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

export function FeatureGroupEditor({ initial, onSave, onCancel, onDelete }: { initial: FeatureGroup; onSave: (group: FeatureGroup) => void; onCancel: () => void; onDelete?: () => void }) {
  const project = useAppStore(selectActiveProject)!;
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState("");
  return <SideEditor title={initial.name || "New organizational group"} eyebrow="Feature Model group" onSave={() => {
    if (!draft.name.trim()) return setError("Group name is required.");
    if (!draft.parentFeatureId && !draft.parentGroupId) return setError("Choose a parent feature or parent organizational group.");
    onSave({ ...draft, name: draft.name.trim(), parentGroupId: draft.parentFeatureId ? undefined : draft.parentGroupId });
  }} onCancel={onCancel} onDelete={onDelete}>
    <label><span className="label">Name</span><input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <label><span className="label">Description</span><textarea className="field min-h-20" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <label><span className="label">Parent feature</span><select className="field" value={draft.parentFeatureId ?? ""} onChange={(event) => setDraft({ ...draft, parentFeatureId: event.target.value || undefined, parentGroupId: event.target.value ? undefined : draft.parentGroupId })}><option value="">Nested under a group…</option>{project.features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select></label>
    {!draft.parentFeatureId && <label><span className="label">Parent organizational group</span><select className="field" value={draft.parentGroupId ?? ""} onChange={(event) => setDraft({ ...draft, parentGroupId: event.target.value || undefined })}><option value="">Select group…</option>{project.featureGroups.filter((group) => group.id !== draft.id).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
    <label><span className="label">Sort order</span><input className="field" type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

export function FeatureConstraintEditor({ initial, onSave, onCancel, onDelete }: { initial: FeatureConstraint; onSave: (constraint: FeatureConstraint) => string | null; onCancel: () => void; onDelete?: () => void }) {
  const project = useAppStore(selectActiveProject)!;
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState("");
  const save = () => {
    if (!draft.sourceFeatureId || !draft.targetFeatureId) return setError("Source and target features are required.");
    const validationError = onSave(draft);
    if (validationError) setError(validationError);
  };
  return <SideEditor title={initial.id.startsWith("constraint-new") ? "New feature constraint" : "Feature constraint"} eyebrow="Display requires / excludes" onSave={save} onCancel={onCancel} onDelete={onDelete}>
    <label><span className="label">Source feature</span><select className="field" value={draft.sourceFeatureId} onChange={(event) => setDraft({ ...draft, sourceFeatureId: event.target.value })}><option value="">Select source…</option>{project.features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select></label>
    <label><span className="label">Relationship type</span><select className="field" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as FeatureConstraint["type"] })}><option>requires</option><option>excludes</option></select></label>
    <label><span className="label">Target feature</span><select className="field" value={draft.targetFeatureId} onChange={(event) => setDraft({ ...draft, targetFeatureId: event.target.value })}><option value="">Select target…</option>{project.features.filter((feature) => feature.id !== draft.sourceFeatureId).map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select></label>
    <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Requires is directional. Excludes prevents both selected features from being active together.</p>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

function featureGroupPath(feature: Feature, features: Feature[], groups: FeatureGroup[]) {
  const names: string[] = [];
  let group = groups.find((candidate) => candidate.id === feature.parentGroupId);
  const seen = new Set<string>();
  while (group && !seen.has(group.id)) {
    seen.add(group.id);
    names.unshift(group.name);
    group = group.parentGroupId ? groups.find((candidate) => candidate.id === group?.parentGroupId) : undefined;
  }
  let parent = features.find((candidate) => candidate.id === feature.parentId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    names.unshift(parent.name);
    parent = features.find((candidate) => candidate.id === parent?.parentId);
  }
  return names.join(" / ") || "Root";
}

function FeatureExpressionEditor({ value, onChange, features, groups, label = "ImpactedByFeature" }: { value: string; onChange: (value: string) => void; features: Feature[]; groups: FeatureGroup[]; label?: string }) {
  const [search, setSearch] = useState("");
  const matches = useMemo(() => features.filter((feature) => `${feature.name} ${feature.id} ${featureGroupPath(feature, features, groups)}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8), [features, groups, search]);
  const append = (token: string) => onChange(`${value}${value && !/[\s(]$/.test(value) ? " " : ""}${token}`);
  return <section className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
    <label><span className="label">{label}</span><textarea className="field min-h-20 font-mono" value={value} onChange={(event) => onChange(event.target.value)} placeholder="feature-id AND NOT other-feature-id" /></label>
    <p className="mt-1 text-[11px] text-slate-600">Blank means always active. Use feature IDs with AND, OR, NOT and parentheses.</p>
    <div className="mt-2 flex flex-wrap gap-1">{["AND", "OR", "NOT", "(", ")"].map((token) => <button type="button" className="btn bg-white px-2 py-1 text-xs" key={token} onClick={() => append(token)}>{token}</button>)}</div>
    <input className="field mt-2" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search feature name, ID or group path" />
    {search && <div className="mt-2 max-h-40 space-y-1 overflow-auto">{matches.map((feature) => <button type="button" className="w-full rounded border bg-white p-2 text-left text-xs hover:border-blue-300" key={feature.id} onClick={() => { append(feature.id); setSearch(""); }}><strong>{feature.name}</strong><span className="block font-mono text-[10px] text-slate-500">{feature.id}</span><span className="block text-[10px] text-purple-700">{featureGroupPath(feature, features, groups)}</span></button>)}</div>}
  </section>;
}

function ConditionRows({ value, onChange, features }: { value: FeatureValueCondition[]; onChange: (value: FeatureValueCondition[]) => void; features: Feature[] }) {
  const enumerations = features.filter((feature) => feature.valueType === "enumeration");
  return <section className="rounded-lg border border-purple-200 bg-purple-50/30 p-3">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">Impacted feature value(s)</h3><p className="text-[11px] text-slate-600">Optional conditions compare the selected value of an enumeration feature.</p></div><button type="button" className="btn" disabled={!enumerations.length} onClick={() => {
      const feature = enumerations[0];
      onChange([...value, { featureId: feature.id, operator: "equals", value: feature.allowedValues?.[0] ?? "" }]);
    }}><Plus size={13} /> Condition</button></div>
    <div className="mt-2 space-y-2">{value.map((condition, index) => {
      const feature = enumerations.find((candidate) => candidate.id === condition.featureId);
      return <div className="grid grid-cols-[1fr_100px_1fr_36px] gap-1 max-sm:grid-cols-1" key={`${condition.featureId}-${index}`}><select className="field px-2 text-xs" value={condition.featureId} onChange={(event) => {
        const nextFeature = enumerations.find((candidate) => candidate.id === event.target.value)!;
        onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, featureId: nextFeature.id, value: nextFeature.allowedValues?.[0] ?? "" } : item));
      }}>{enumerations.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select><select className="field px-2 text-xs" value={condition.operator} onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as FeatureValueCondition["operator"] } : item))}><option value="equals">equals</option><option value="notEquals">not equals</option></select><select className="field px-2 text-xs" value={String(condition.value)} onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}>{feature?.allowedValues?.map((allowed) => <option key={allowed}>{allowed}</option>)}</select><button type="button" className="btn btn-danger p-2" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button></div>;
    })}</div>
  </section>;
}

function parseRuleValue(input: string): ScalarValue | string[] {
  const trimmed = input.trim();
  if (trimmed === "null" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) return parsed;
    throw new Error("Array values must contain strings only.");
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

function RuleEditor({ rule, index, features, groups, onChange, onDelete }: { rule: VariationValueRule; index: number; features: Feature[]; groups: FeatureGroup[]; onChange: (rule: VariationValueRule) => void; onDelete: () => void }) {
  const [rawValue, setRawValue] = useState(() => typeof rule.value === "string" ? rule.value : JSON.stringify(rule.value));
  return <details className="rounded-lg border border-slate-200 bg-slate-50 p-3" open><summary className="cursor-pointer text-sm font-semibold">Rule {index + 1}{rule.isDefault ? " · default" : !rule.featureExpression ? " · always" : ""}</summary><div className="mt-3 space-y-3">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(rule.isDefault)} onChange={(event) => onChange({ ...rule, isDefault: event.target.checked })} />Default when no other rule matches</label>
    <FeatureExpressionEditor label="Rule feature expression" value={rule.featureExpression} onChange={(featureExpression) => onChange({ ...rule, featureExpression })} features={features} groups={groups} />
    <ConditionRows value={rule.featureValueConditions} onChange={(featureValueConditions) => onChange({ ...rule, featureValueConditions })} features={features} />
    <label><span className="label">Realized value</span><input className="field font-mono" value={rawValue} onChange={(event) => setRawValue(event.target.value)} onBlur={() => {
      try { onChange({ ...rule, value: parseRuleValue(rawValue) }); } catch { /* validated on parent save */ }
    }} /><span className="mt-1 block text-[10px] text-slate-500">Number, text, true/false, null or a JSON string array.</span></label>
    <button type="button" className="btn btn-danger" onClick={onDelete}><Trash2 size={13} /> Delete rule</button>
  </div></details>;
}

export function VariationPointEditor({ initial, onSave, onCancel, onDelete }: { initial: VariationPoint; onSave: (variationPoint: VariationPoint) => string | null; onCancel: () => void; onDelete?: () => void }) {
  const project = useAppStore(selectActiveProject)!;
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [targetType, setTargetType] = useState<"element" | "relationship">(initial.constrainedRelationshipIds.length ? "relationship" : "element");
  const [targetSearch, setTargetSearch] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    try {
      if (!draft.name.trim()) throw new Error("Variation-point name is required.");
      if (!(targetType === "element" ? draft.constrainedElementIds : draft.constrainedRelationshipIds).length) throw new Error("Select at least one target.");
      parseFeatureExpression(draft.featureExpression, project.features);
      draft.valueRules.forEach((rule) => parseFeatureExpression(rule.featureExpression, project.features));
      if (draft.kind !== "existence" && !draft.propertyPath?.trim()) throw new Error("A property or tag variation requires a safe property path.");
      if (draft.kind !== "existence" && !draft.valueRules.length) throw new Error("A property or tag variation requires at least one value rule.");
      const validationError = onSave({
        ...draft,
        name: draft.name.trim(),
        constrainedElementIds: targetType === "element" ? draft.constrainedElementIds : [],
        constrainedRelationshipIds: targetType === "relationship" ? draft.constrainedRelationshipIds : [],
        propertyPath: draft.kind === "existence" ? undefined : draft.propertyPath?.trim(),
        valueRules: draft.kind === "existence" ? [] : draft.valueRules,
        updatedAt: new Date().toISOString()
      });
      if (validationError) setError(validationError);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invalid variation point.");
    }
  };
  const selectedTargets = targetType === "element" ? draft.constrainedElementIds : draft.constrainedRelationshipIds;
  const targets = (targetType === "element"
    ? project.elements.map((element, order) => ({ id: element.id, label: `${element.name} · ${element.elementType}`, search: `${element.name} ${element.elementType} ${element.id}`.toLowerCase(), order }))
    : project.relationships.map((relationship, order) => ({ id: relationship.id, label: `${project.elements.find((element) => element.id === relationship.sourceId)?.name ?? relationship.sourceId} → ${project.elements.find((element) => element.id === relationship.targetId)?.name ?? relationship.targetId} · ${relationship.relationshipType}`, search: `${relationship.relationshipType} ${relationship.id} ${project.elements.find((element) => element.id === relationship.sourceId)?.name ?? ""} ${project.elements.find((element) => element.id === relationship.targetId)?.name ?? ""}`.toLowerCase(), order })))
    .filter((target) => target.search.includes(targetSearch.trim().toLowerCase()))
    .sort((left, right) => Number(selectedTargets.includes(right.id)) - Number(selectedTargets.includes(left.id)) || left.order - right.order);
  return <SideEditor title={initial.name || "New variation point"} eyebrow="Variation Point" onSave={save} onCancel={onCancel} onDelete={onDelete}>
    <label><span className="label">Name</span><input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <label><span className="label">Description</span><textarea className="field min-h-20" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label><span className="label">Kind</span><select className="field" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as VariationPoint["kind"], propertyPath: event.target.value === "existence" ? undefined : draft.propertyPath, valueRules: event.target.value === "existence" ? [] : draft.valueRules.length ? draft.valueRules : [{ id: uid("variation-rule"), featureExpression: "", featureValueConditions: [], value: null }] })}><option value="existence">Existence</option><option value="primitiveProperty">Primitive Property</option><option value="primitiveTag">Primitive Tag</option><option value="elementProperty">Element Property</option></select></label>
      <label><span className="label">Target type</span><select className="field" value={targetType} onChange={(event) => setTargetType(event.target.value as typeof targetType)}><option>element</option><option>relationship</option></select></label>
    </div>
    <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">Targets</legend><input aria-label="Search variation point targets" className="field mb-2" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Search name, stereotype or ID…" /><div className="max-h-52 space-y-1 overflow-auto">{targets.map((target) => <label className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${selectedTargets.includes(target.id) ? "bg-blue-50" : ""}`} key={target.id}><input className="mt-0.5" type="checkbox" checked={selectedTargets.includes(target.id)} onChange={(event) => setDraft(targetType === "element" ? { ...draft, constrainedElementIds: event.target.checked ? [...draft.constrainedElementIds, target.id] : draft.constrainedElementIds.filter((id) => id !== target.id) } : { ...draft, constrainedRelationshipIds: event.target.checked ? [...draft.constrainedRelationshipIds, target.id] : draft.constrainedRelationshipIds.filter((id) => id !== target.id) })} /><span>{target.label}<span className="block font-mono text-[9px] text-slate-400">{target.id}</span></span></label>)}{!targets.length && <p className="p-3 text-center text-xs text-slate-500">No targets match this search.</p>}</div></fieldset>
    <FeatureExpressionEditor value={draft.featureExpression} onChange={(featureExpression) => setDraft({ ...draft, featureExpression })} features={project.features} groups={project.featureGroups} />
    <ConditionRows value={draft.featureValueConditions} onChange={(featureValueConditions) => setDraft({ ...draft, featureValueConditions })} features={project.features} />
    <label><span className="label">Realization domain</span><select className="field" value={draft.scope ?? ""} onChange={(event) => setDraft({ ...draft, scope: event.target.value as VariationScope || undefined })}><option value="">Every scope</option>{scopes.map((scope) => <option key={scope}>{scope}</option>)}</select></label>
    {draft.kind !== "existence" && <>
      <label><span className="label">When no rule matches</span><select className="field" value={draft.unmatchedBehavior ?? "retainBase"} onChange={(event) => setDraft({ ...draft, unmatchedBehavior: event.target.value as "retainBase" | "error" })}><option value="retainBase">Retain the base value</option><option value="error">Block derivation until resolved</option></select></label>
      <p className="text-xs text-slate-600">A blank condition always matches. Conflicting matches block derivation; list order does not choose a winner.</p>
      <label><span className="label">Safe property path</span><input className="field font-mono" value={draft.propertyPath ?? ""} onChange={(event) => setDraft({ ...draft, propertyPath: event.target.value })} /><span className="mt-1 block text-[10px] text-slate-500">Examples: description, metadata:duration, parameter:&lt;id&gt;:value, tags, sourceId, targetId, architectureId.</span></label>
      <section><div className="flex items-center justify-between"><h3 className="font-bold">Value rules</h3><button type="button" className="btn" onClick={() => setDraft({ ...draft, valueRules: [...draft.valueRules, { id: uid("variation-rule"), featureExpression: "", featureValueConditions: [], value: null }] })}><Plus size={13} /> Rule</button></div><div className="mt-2 space-y-2">{draft.valueRules.map((rule, index) => <RuleEditor key={rule.id} rule={rule} index={index} features={project.features} groups={project.featureGroups} onChange={(next) => setDraft({ ...draft, valueRules: draft.valueRules.map((candidate) => candidate.id === rule.id ? next : candidate) })} onDelete={() => setDraft({ ...draft, valueRules: draft.valueRules.filter((candidate) => candidate.id !== rule.id) })} />)}</div></section>
    </>}
    <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Enabled</label>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

export function ConfigurationEditor({ initial, onSave, onCancel, onDelete }: { initial: Configuration; onSave: (configuration: Configuration) => void; onCancel: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [error, setError] = useState("");
  return <SideEditor title={initial.name || "New configuration"} eyebrow="Configurator" onSave={() => {
    if (!draft.name.trim()) return setError("Configuration name is required.");
    onSave({ ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString(), validationStatus: "notValidated" });
  }} onCancel={onCancel} onDelete={onDelete}>
    <label><span className="label">Configuration name</span><input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">The linked architecture is generated automatically with the same name. It is not edited independently.</section>
    <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">Realization scope</legend><label className="block text-sm"><input className="mr-2" type="checkbox" checked={!draft.realizationScopes?.length} onChange={() => setDraft({ ...draft, realizationScopes: [] })} />Entire compatible model</label><div className="mt-2 grid grid-cols-2 gap-2">{scopes.map((scope) => <label className="text-sm capitalize" key={scope}><input className="mr-2" type="checkbox" checked={draft.realizationScopes?.includes(scope) ?? false} onChange={(event) => setDraft({ ...draft, realizationScopes: event.target.checked ? [...new Set([...(draft.realizationScopes ?? []), scope])] : (draft.realizationScopes ?? []).filter((candidate) => candidate !== scope) })} />{scope}</label>)}</div></fieldset>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

export function ModelRelationshipDraftEditor({
  sourceId,
  targetId,
  allowedTypes,
  onSave,
  onCancel
}: {
  sourceId: string;
  targetId: string;
  allowedTypes: RelationshipType[];
  onSave: (relationship: Relationship) => string | null;
  onCancel: () => void;
}) {
  const project = useAppStore(selectActiveProject)!;
  const now = new Date().toISOString();
  const [draft, setDraft] = useState<Relationship>({ id: uid("relationship"), sourceId, targetId, relationshipType: allowedTypes[0], createdAt: now, updatedAt: now });
  const [error, setError] = useState("");
  const isFlow = ["consumes", "produces"].includes(draft.relationshipType);
  const hasQuantity = isFlow || draft.relationshipType === "requiresResource";
  return <SideEditor title="New relationship" eyebrow="150% Product-Line Model" onSave={() => {
    const validationError = onSave({ ...draft, quantity: hasQuantity ? draft.quantity : undefined, requiredQuantity: draft.relationshipType === "requiresResource" ? draft.quantity : undefined, updatedAt: new Date().toISOString() });
    if (validationError) setError(validationError);
  }} onCancel={onCancel}>
    <div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{project.elements.find((element) => element.id === sourceId)?.name}</strong> → <strong>{project.elements.find((element) => element.id === targetId)?.name}</strong></div>
    <label><span className="label">Allowed relationship type</span><select className="field" value={draft.relationshipType} onChange={(event) => setDraft({ ...draft, relationshipType: event.target.value as RelationshipType })}>{allowedTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
    <label><span className="label">Name</span><input className="field" value={draft.name ?? ""} onChange={(event) => setDraft({ ...draft, name: event.target.value || undefined })} /></label>
    {isFlow && <label><span className="label">Item flow name</span><input className="field" value={draft.itemFlowName ?? ""} onChange={(event) => setDraft({ ...draft, itemFlowName: event.target.value || undefined })} /></label>}
    {hasQuantity && <div className="grid grid-cols-2 gap-3"><label><span className="label">Quantity</span><input className="field" type="number" min="0.01" value={draft.quantity ?? ""} onChange={(event) => setDraft({ ...draft, quantity: event.target.value === "" ? undefined : Number(event.target.value) })} /></label><label><span className="label">Unit</span><input className="field" value={draft.unit ?? ""} onChange={(event) => setDraft({ ...draft, unit: event.target.value || undefined })} /></label></div>}
    <label><span className="label">Description</span><textarea className="field min-h-20" value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value || undefined })} /></label>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

export function NewModelElementEditor({ configurationName, onSave, onCancel }: { configurationName?: string; onSave: (element: ModelElement, common: boolean) => void; onCancel: () => void }) {
  const now = new Date().toISOString();
  const [elementType, setElementType] = useState<ElementType>("productComponent");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [duration, setDuration] = useState("");
  const [durationUnit, setDurationUnit] = useState<ModelElement["metadata"]["durationUnit"]>();
  const [common, setCommon] = useState(true);
  const [error, setError] = useState("");
  return <SideEditor title="New model element" eyebrow="Editable 150% Product-Line Model" onSave={() => {
    if (!name.trim()) return setError("Element name is required.");
    if (elementType === "processFunction" && duration !== "" && (!Number.isFinite(Number(duration)) || Number(duration) <= 0 || !durationUnit)) return setError("Process duration must be positive and have a unit.");
    onSave({
      id: uid(elementType),
      elementType,
      name: name.trim(),
      description,
      status: "draft",
      architectureScope: "common",
      parameters: [],
      customAttributeValues: {},
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).length ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [elementType],
      metadata: elementType === "processFunction" && duration !== "" ? { duration: Number(duration), durationUnit } : {},
      createdAt: now,
      updatedAt: now
    }, common);
  }} onCancel={onCancel} saveLabel="Create element">
    <label><span className="label">Element type</span><select className="field" value={elementType} onChange={(event) => setElementType(event.target.value as ElementType)}>{elementTypes.map((type) => <option key={type} value={type}>{elementTypeLabels[type]}</option>)}</select></label>
    <label><span className="label">Name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label><span className="label">Description</span><textarea className="field min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label><span className="label">Tags (comma-separated)</span><input className="field" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
    {elementType === "processFunction" && <div className="grid grid-cols-2 gap-3"><label><span className="label">Duration</span><input className="field" type="number" min="0" value={duration} onChange={(event) => setDuration(event.target.value)} /></label><label><span className="label">Duration unit</span><select className="field" value={durationUnit ?? ""} onChange={(event) => setDurationUnit(event.target.value as ModelElement["metadata"]["durationUnit"])}><option value="">Select…</option><option>minute</option><option>hour</option><option>day</option></select></label></div>}
    {configurationName && <label className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><input className="mt-0.5" type="checkbox" checked={common} onChange={(event) => setCommon(event.target.checked)} /><span><strong>Common to every configuration</strong><span className="block text-xs text-slate-600">Clear this to create an internal applicability feature and existence variation for {configurationName}.</span></span></label>}
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  </SideEditor>;
}

export const newFeature = (projectFeatures: Feature[]): Feature => ({
  id: uid("feature"),
  name: "",
  parentId: projectFeatures.find((feature) => feature.featureType === "root")?.id,
  featureType: "optional",
  sortOrder: projectFeatures.length,
  description: "",
  valueType: "boolean",
  allowedValues: [],
  defaultValue: false,
  variabilityScope: "external"
});

export const newFeatureGroup = (projectFeatures: Feature[], groups: FeatureGroup[]): FeatureGroup => ({
  id: uid("feature-group"),
  name: "",
  description: "",
  parentFeatureId: projectFeatures.find((feature) => feature.featureType === "root")?.id,
  sortOrder: groups.length
});

export const newFeatureConstraint = (features: Feature[], sourceFeatureId = "", targetFeatureId = ""): FeatureConstraint => ({
  id: `constraint-new-${crypto.randomUUID()}`,
  type: "requires",
  sourceFeatureId: sourceFeatureId || features[0]?.id || "",
  targetFeatureId: targetFeatureId || features.find((feature) => feature.id !== (sourceFeatureId || features[0]?.id))?.id || ""
});

export const newVariationPoint = (preset?: { elementId?: string; relationshipId?: string; kind?: VariationPoint["kind"]; propertyPath?: string }): VariationPoint => {
  const now = new Date().toISOString();
  const kind = preset?.kind ?? "existence";
  return {
    id: uid("variation"),
    name: "",
    description: "",
    kind,
    constrainedElementIds: preset?.elementId ? [preset.elementId] : [],
    constrainedRelationshipIds: preset?.relationshipId ? [preset.relationshipId] : [],
    featureExpression: "",
    featureValueConditions: [],
    propertyPath: preset?.propertyPath,
    unmatchedBehavior: "error",
    valueRules: kind === "existence" ? [] : [{ id: uid("variation-rule"), featureExpression: "", featureValueConditions: [], value: null }],
    enabled: true,
    createdAt: now,
    updatedAt: now
  };
};

export const newConfiguration = (): Configuration => {
  const now = new Date().toISOString();
  return { id: uid("configuration"), name: "", architectureId: "", manuallySelectedFeatureIds: [], automaticConstraintFeatureIds: [], effectiveSelectedFeatureIds: [], autoSelectedFeatureIds: [], featureValues: {}, validationStatus: "notValidated", validationMessages: [], derivedElementIds: [], excludedElementIds: [], createdAt: now, updatedAt: now };
};
