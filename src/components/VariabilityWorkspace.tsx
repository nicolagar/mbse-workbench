import { ConfigurationReadiness } from "./ConfigurationReadiness";
import type { Connection } from "@xyflow/react";
import { Copy, GitBranch, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { architectureCompatibleModel, derivationStatus } from "../domain/derivation";
import { featureExpressionSummary, parseFeatureExpression } from "../domain/featureExpressions";
import { modelSections, sectionProjectionElements } from "../domain/modelViews";
import { elementTypeLabels, elementTypes, type Configuration, type ElementType, type Feature, type FeatureConstraint, type FeatureGroup, type ModelElement, type ModelTabId, type RelationshipType, type VariationPoint, type VariabilityTab } from "../domain/types";
import { descendantsOf, validateConfiguration } from "../domain/variability";
import { applyVariationPoints, referencedFeatureIds, type PreviewStatus } from "../domain/variationPoints";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { ElementEditor } from "./ElementEditor";
import { FeatureGraph } from "./FeatureGraph";
import { ModelGraph } from "./ModelGraph";
import { useDialogs } from "./dialogs/DialogProvider";
import {
  ConfigurationEditor,
  FeatureConstraintEditor,
  FeatureEditor,
  FeatureGroupEditor,
  ModelRelationshipDraftEditor,
  newConfiguration,
  newFeature,
  newFeatureConstraint,
  newFeatureGroup,
  newVariationPoint,
  NewModelElementEditor,
  VariationPointEditor
} from "./VariabilityEditors";

const tabs: VariabilityTab[] = ["Feature Model", "Variation Points", "Configurator", "150% Preview", "100% Realization", "Derivation Summary"];
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function VariabilityWorkspace() {
  const project = useAppStore(selectActiveProject)!;
  const tab = useAppStore((state) => state.uiPreferences.activeVariabilityTab);
  const setTab = useAppStore((state) => state.setVariabilityTab);
  const selectedConfigurationId = useAppStore((state) => state.selectedConfigurationId);
  const setSelectedConfigurationId = useAppStore((state) => state.selectConfiguration);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setModelView = useAppStore((state) => state.setModelView);
  const setValidationFilters = useAppStore((state) => state.setValidationFilters);
  const configurationId = selectedConfigurationId ?? "";
  const configuration = project.configurations.find((item) => item.id === configurationId);
  const openValidation = () => {
    setValidationFilters({ severity: "all", category: "all", domain: "variability" });
    setWorkspace("model");
    setModelView("quality");
  };
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Variability</h1>
        <p className="mt-1 text-slate-600">One canonical feature model drives validated selections and non-mutating 150% → 100% derivation.</p></div>
        <button className="btn" onClick={openValidation}><ShieldCheck size={15} /> Variability validation</button>
      </header>
      <nav className="card flex flex-wrap gap-2 p-2">
        {tabs.map((item) => <button key={item} className={`btn ${tab === item ? "btn-primary" : ""}`} onClick={() => setTab(item)}>{item}</button>)}
      </nav>
      {["150% Preview", "100% Realization", "Derivation Summary"].includes(tab) && <section className="card flex flex-wrap items-center gap-3 p-3"><label className="min-w-0 flex-1"><span className="label">Model-view configuration overlay</span><select className="field" value={configurationId} onChange={(event) => setSelectedConfigurationId(event.target.value || null)}><option value="">150% Product-Line Model (no configuration)</option>{project.configurations.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="min-w-0 flex-[2] text-sm text-slate-500">The canonical 150% model is always available. Generated configuration views are overlays or immutable realizations.</p></section>}
      {tab === "Feature Model" && <FeatureModel />}
      {tab === "Variation Points" && <VariationPoints />}
      {tab === "Configurator" && <Configurator configurationId={configurationId} setConfigurationId={(id) => setSelectedConfigurationId(id || null)} />}
      {tab === "150% Preview" && <PreviewModel configuration={configuration} />}
      {tab === "100% Realization" && <DerivedModel configuration={configuration} />}
      {tab === "Derivation Summary" && <DerivationSummary configuration={configuration} />}
    </div>
  );
}

function FeatureModel() {
  const { confirm, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addFeature = useAppStore((state) => state.addFeature);
  const updateFeature = useAppStore((state) => state.updateFeature);
  const duplicateFeature = useAppStore((state) => state.duplicateFeature);
  const deleteFeature = useAppStore((state) => state.deleteFeatureReferences);
  const addFeatureGroup = useAppStore((state) => state.addFeatureGroup);
  const updateFeatureGroup = useAppStore((state) => state.updateFeatureGroup);
  const deleteFeatureGroup = useAppStore((state) => state.deleteFeatureGroup);
  const addConstraint = useAppStore((state) => state.addFeatureConstraint);
  const updateConstraint = useAppStore((state) => state.updateFeatureConstraint);
  const removeConstraint = useAppStore((state) => state.deleteFeatureConstraint);
  const selectedFeatureId = useAppStore((state) => state.selectedFeatureId);
  const selectFeature = useAppStore((state) => state.selectFeature);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"graph" | "table">("graph");
  const [editor, setEditor] = useState<
    | { kind: "feature"; value: Feature; isNew: boolean }
    | { kind: "group"; value: FeatureGroup; isNew: boolean }
    | { kind: "constraint"; value: FeatureConstraint; isNew: boolean }
    | null
  >(null);
  const featureRows = useMemo(() => {
    const rows: Array<{ kind: "feature"; value: Feature; depth: number } | { kind: "group"; value: FeatureGroup; depth: number }> = [];
    const visitedFeatures = new Set<string>(), visitedGroups = new Set<string>();
    const byOrder = <T extends { sortOrder: number; name: string }>(left: T, right: T) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
    const visitFeature = (feature: Feature, depth: number) => {
      if (visitedFeatures.has(feature.id)) return;
      visitedFeatures.add(feature.id); rows.push({ kind: "feature", value: feature, depth });
      project.featureGroups.filter((group) => group.parentFeatureId === feature.id && !group.parentGroupId).sort(byOrder).forEach((group) => visitGroup(group, depth + 1));
      project.features.filter((candidate) => candidate.parentId === feature.id && !candidate.parentGroupId && !candidate.groupId).sort(byOrder).forEach((child) => visitFeature(child, depth + 1));
    };
    const visitGroup = (group: FeatureGroup, depth: number) => {
      if (visitedGroups.has(group.id)) return;
      visitedGroups.add(group.id); rows.push({ kind: "group", value: group, depth });
      project.featureGroups.filter((candidate) => candidate.parentGroupId === group.id).sort(byOrder).forEach((child) => visitGroup(child, depth + 1));
      project.features.filter((feature) => feature.parentGroupId === group.id || feature.groupId === group.id).sort(byOrder).forEach((feature) => visitFeature(feature, depth + 1));
    };
    project.features.filter((feature) => !feature.parentId && !feature.parentGroupId && !feature.groupId).sort(byOrder).forEach((feature) => visitFeature(feature, 0));
    project.featureGroups.filter((group) => !group.parentFeatureId && !group.parentGroupId).sort(byOrder).forEach((group) => visitGroup(group, 0));
    project.features.filter((feature) => !visitedFeatures.has(feature.id)).sort(byOrder).forEach((feature) => visitFeature(feature, 0));
    project.featureGroups.filter((group) => !visitedGroups.has(group.id)).sort(byOrder).forEach((group) => visitGroup(group, 0));
    const query = search.trim().toLowerCase();
    return query ? rows.filter((row) => row.value.name.toLowerCase().includes(query) || row.value.id.toLowerCase().includes(query)) : rows;
  }, [project.featureGroups, project.features, search]);
  useEffect(() => {
    if (!selectedFeatureId) return;
    const selected = project.features.find((feature) => feature.id === selectedFeatureId);
    if (selected) setEditor({ kind: "feature", value: structuredClone(selected), isNew: false });
    selectFeature(null);
  }, [project.features, selectFeature, selectedFeatureId]);
  const remove = async (feature: Feature) => {
    const descendants = descendantsOf(project.features, feature.id);
    const constraints = project.featureConstraints.filter((item) => [item.sourceFeatureId, item.targetFeatureId].some((id) => id === feature.id || descendants.includes(id)));
    const configurations = project.configurations.filter((item) => item.effectiveSelectedFeatureIds.some((id) => id === feature.id || descendants.includes(id)));
    const variationPoints = project.variationPoints.filter((item) =>
      item.featureExpression.includes(feature.id)
      || item.featureValueConditions.some((condition) => condition.featureId === feature.id)
      || item.valueRules.some((rule) => rule.featureExpression.includes(feature.id) || rule.featureValueConditions.some((condition) => condition.featureId === feature.id))
    );
    const detail = `${descendants.length} descendant(s), ${constraints.length} constraint(s), ${configurations.length} configuration(s), and ${variationPoints.length} variation point(s) will be cleaned up.`;
    if (await confirm(`Delete "${feature.name}" and its references?\n\n${detail}\n\nAffected variation points are removed completely, never silently rewritten.`, { confirmLabel: "Delete", tone: "danger" })) deleteFeature(feature.id);
  };
  const featureName = (id: string) => project.features.find((feature) => feature.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">Feature model</h2><p className="text-sm text-slate-500">Containment is neutral; requires is green and directional; excludes is red. Organizational groups are recursive and nonselectable.</p></div>
        <div className="flex flex-wrap items-center justify-end gap-2"><div className="flex shrink-0 gap-2"><button className={`btn ${view === "graph" ? "btn-primary" : ""}`} onClick={() => setView("graph")}>Graph</button><button className={`btn ${view === "table" ? "btn-primary" : ""}`} onClick={() => setView("table")}>Table</button></div><div className="flex shrink-0 gap-2"><button className="btn" onClick={() => setEditor({ kind: "group", value: newFeatureGroup(project.features, project.featureGroups), isNew: true })}><Plus size={15} /> Group</button><button className="btn" onClick={() => setEditor({ kind: "constraint", value: newFeatureConstraint(project.features), isNew: true })}><Plus size={15} /> Constraint</button><button className="btn btn-primary" onClick={() => setEditor({ kind: "feature", value: newFeature(project.features), isNew: true })}><Plus size={15} /> Feature</button></div></div>
      </div>
      {view === "graph" && <div className="mt-4 overflow-hidden rounded-xl border"><FeatureGraph onSelectFeature={(feature) => setEditor({ kind: "feature", value: structuredClone(feature), isNew: false })} /></div>}
      {view === "table" && <><div className="mt-4"><input className="field w-72" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search features" /></div><div className="mt-4 overflow-auto">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Tree / name</th><th>ID</th><th>Cardinality</th><th>Value</th><th>Scope</th><th>Parent / group</th><th /></tr></thead>
          <tbody>{featureRows.map((row) => row.kind === "group" ? <tr className="border-b border-purple-100 bg-purple-50/70" key={`group-${row.value.id}`}>
            <td className="p-2 font-semibold text-purple-950" style={{ paddingLeft: `${8 + row.depth * 22}px` }}>{row.depth > 0 && "↳ "}{row.value.name}</td><td className="font-mono text-xs text-purple-700">{row.value.id}</td><td><span className="badge bg-purple-100 text-purple-800">Group · nonselectable</span></td><td>—</td><td>Organization</td><td><span className="font-mono text-xs">{row.value.parentGroupId ?? row.value.parentFeatureId ?? "—"}</span><div className="text-xs text-slate-500">order {row.value.sortOrder}</div></td>
            <td className="whitespace-nowrap text-right"><button className="btn mr-1" onClick={() => setEditor({ kind: "group", value: structuredClone(row.value), isNew: false })}>Edit</button><button className="btn btn-danger" onClick={async () => {
              if (project.variabilityAxes.some((axis) => axis.featureGroupId === row.value.id)) return void alertUser("This FeatureGroup is managed by a variability axis. Delete the axis from guided Trade Study setup.");
              if (await confirm(`Delete "${row.value.name}" and its nested organizational groups? Features remain in the canonical feature model and are detached from the deleted groups.`, { confirmLabel: "Delete", tone: "danger" })) deleteFeatureGroup(row.value.id);
            }}><Trash2 size={14} /></button></td>
          </tr> : <tr className="border-b border-slate-100" key={row.value.id}>
            <td className="p-2 font-semibold" style={{ paddingLeft: `${8 + row.depth * 22}px` }}>{row.depth > 0 && "↳ "}{row.value.name}</td><td className="font-mono text-xs">{row.value.id}</td><td><span className="badge bg-blue-50 text-blue-700">{row.value.featureType}</span></td><td>{row.value.valueType === "enumeration" ? row.value.allowedValues?.join(" / ") : "Boolean"}</td><td>{row.value.variabilityScope ?? "external"}</td><td><span className="font-mono text-xs">{row.value.parentId ?? row.value.parentGroupId ?? "—"}</span><div className="text-xs text-slate-500">{row.value.groupId ?? `order ${row.value.sortOrder}`}</div></td>
            <td className="whitespace-nowrap text-right"><button className="btn mr-1" onClick={() => setEditor({ kind: "feature", value: structuredClone(row.value), isNew: false })}>Edit</button>{row.value.featureType !== "root" && <button className="btn mr-1" title="Duplicate" onClick={() => duplicateFeature(row.value.id)}><Copy size={14} /></button>}<button className="btn btn-danger" onClick={() => remove(row.value)}><Trash2 size={14} /></button></td>
          </tr>)}</tbody>
        </table>
      </div></>}
    </section>
    <section className="card p-5">
      <h3 className="font-bold">Constraints in the canonical feature model</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{project.featureConstraints.map((constraint) => <div className={`flex items-center gap-3 rounded-lg border p-3 ${constraint.type === "requires" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`} key={constraint.id}><GitBranch size={16} /><span className="flex-1"><strong>{featureName(constraint.sourceFeatureId)}</strong> {constraint.type} <strong>{featureName(constraint.targetFeatureId)}</strong></span><button className="btn" onClick={() => setEditor({ kind: "constraint", value: structuredClone(constraint), isNew: false })}>Edit</button><button className="btn btn-danger" onClick={() => removeConstraint(constraint.id)}><Trash2 size={14} /></button></div>)}</div>
    </section>
    {editor?.kind === "feature" && <FeatureEditor initial={editor.value} onCancel={() => setEditor(null)} onSave={(feature) => {
      if (editor.isNew) addFeature(feature); else updateFeature(feature.id, feature);
      setEditor(null);
    }} onDelete={editor.isNew ? undefined : async () => { await remove(editor.value); setEditor(null); }} />}
    {editor?.kind === "group" && <FeatureGroupEditor initial={editor.value} onCancel={() => setEditor(null)} onSave={(group) => {
      if (editor.isNew) addFeatureGroup(group); else updateFeatureGroup(group.id, group);
      setEditor(null);
    }} onDelete={editor.isNew ? undefined : async () => {
      if (project.variabilityAxes.some((axis) => axis.featureGroupId === editor.value.id)) {
        void alertUser("This FeatureGroup is managed by a variability axis. Delete the axis from guided Trade Study setup.");
        return;
      }
      if (await confirm(`Delete "${editor.value.name}" and its nested organizational groups?`, { confirmLabel: "Delete", tone: "danger" })) deleteFeatureGroup(editor.value.id);
      setEditor(null);
    }} />}
    {editor?.kind === "constraint" && <FeatureConstraintEditor initial={editor.value} onCancel={() => setEditor(null)} onSave={(constraint) => {
      const error = editor.isNew ? addConstraint({ ...constraint, id: uid("constraint") }) : updateConstraint(constraint.id, constraint);
      if (!error) setEditor(null);
      return error;
    }} onDelete={editor.isNew ? undefined : () => { removeConstraint(editor.value.id); setEditor(null); }} />}
    </div>
  );
}

function VariationPoints() {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const add = useAppStore((state) => state.addVariationPoint);
  const update = useAppStore((state) => state.updateVariationPoint);
  const remove = useAppStore((state) => state.deleteVariationPoint);
  const addRelationship = useAppStore((state) => state.addRelationship);
  const selectedVariationPointId = useAppStore((state) => state.selectedVariationPointId);
  const selectVariationPoint = useAppStore((state) => state.selectVariationPoint);
  const view = useAppStore((state) => state.uiPreferences.variationPointView);
  const setView = useAppStore((state) => state.setVariationPointView);
  const selectedSections = useAppStore((state) => state.uiPreferences.variationGraphSections);
  const selectedElementTypes = useAppStore((state) => state.uiPreferences.variationGraphElementTypes);
  const setFilters = useAppStore((state) => state.setVariationGraphFilters);
  const [editor, setEditor] = useState<VariationPoint | null>(null);
  const [chooser, setChooser] = useState<VariationPoint[]>([]);
  const [pendingConnection, setPendingConnection] = useState<{ connection: Connection; types: RelationshipType[] } | null>(null);
  const names = new Map(project.features.map((feature) => [feature.id, feature.name]));
  const targetName = (id: string) =>
    project.elements.find((element) => element.id === id)?.name
    ?? project.relationships.find((relationship) => relationship.id === id)?.name
    ?? id;
  const sectionOptions = Object.keys(modelSections) as ModelTabId[];
  const allSectionsActive = selectedSections.length === 0;
  const allTypesActive = selectedElementTypes.length === 0;
  const sectionElementIds = new Set((allSectionsActive ? project.elements : selectedSections.flatMap((section) => sectionProjectionElements(project, section).map((element) => element))).map((element) => element.id));
  const visibleElements = project.elements.filter((element) => sectionElementIds.has(element.id) && (allTypesActive || selectedElementTypes.includes(element.elementType)));
  const visibleIds = new Set(visibleElements.map((element) => element.id));
  const visibleRelationships = project.relationships.filter((relationship) => visibleIds.has(relationship.sourceId) && visibleIds.has(relationship.targetId));

  useEffect(() => {
    if (!selectedVariationPointId) return;
    const selected = project.variationPoints.find((variationPoint) => variationPoint.id === selectedVariationPointId);
    if (selected) setEditor(structuredClone(selected));
    selectVariationPoint(null);
  }, [project.variationPoints, selectVariationPoint, selectedVariationPointId]);

  const openTarget = (preset: { elementId?: string; relationshipId?: string; kind?: VariationPoint["kind"]; propertyPath?: string }) => {
    const existing = project.variationPoints.filter((variationPoint) =>
      preset.elementId
        ? variationPoint.constrainedElementIds.includes(preset.elementId) && (!preset.propertyPath || variationPoint.propertyPath === preset.propertyPath)
        : preset.relationshipId
          ? variationPoint.constrainedRelationshipIds.includes(preset.relationshipId) && (!preset.propertyPath || variationPoint.propertyPath === preset.propertyPath)
          : false
    );
    if (existing.length === 1) setEditor(structuredClone(existing[0]));
    else if (existing.length > 1) setChooser(existing);
    else setEditor(newVariationPoint(preset));
  };

  const toggleSection = (section: ModelTabId, checked: boolean) => setFilters(
    checked ? [...new Set([...selectedSections, section])] : selectedSections.filter((candidate) => candidate !== section),
    selectedElementTypes
  );
  const toggleType = (type: ElementType, checked: boolean) => setFilters(
    selectedSections,
    checked ? [...new Set([...selectedElementTypes, type])] : selectedElementTypes.filter((candidate) => candidate !== type)
  );

  return <div className="space-y-4">
    <section className="card p-3"><div className="flex flex-wrap items-center gap-2"><button className={`btn ${view === "graph" ? "btn-primary" : ""}`} onClick={() => setView("graph")}>Graph</button><button className={`btn ${view === "list" ? "btn-primary" : ""}`} onClick={() => setView("list")}>List</button><button className="btn btn-primary ml-auto" onClick={() => setEditor(newVariationPoint())}><Plus size={15} /> Variation point</button></div></section>
    {view === "graph" && <>
      <section className="card p-4"><div className="grid gap-4 lg:grid-cols-2"><fieldset><legend className="text-sm font-bold">Modeling sections</legend><div className="mt-2 flex flex-wrap gap-2"><button className={`btn text-xs ${allSectionsActive ? "btn-primary" : ""}`} onClick={() => setFilters([], selectedElementTypes)}>All</button>{sectionOptions.map((section) => <label className={`rounded border px-2 py-1 text-xs ${selectedSections.includes(section) ? "border-blue-300 bg-blue-50" : ""}`} key={section}><input className="mr-1" type="checkbox" checked={selectedSections.includes(section)} onChange={(event) => toggleSection(section, event.target.checked)} />{modelSections[section].label}</label>)}</div></fieldset><fieldset><legend className="text-sm font-bold">Element types</legend><div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-auto"><button className={`btn text-xs ${allTypesActive ? "btn-primary" : ""}`} onClick={() => setFilters(selectedSections, [])}>All</button>{elementTypes.map((type) => <label className={`rounded border px-2 py-1 text-xs ${selectedElementTypes.includes(type) ? "border-blue-300 bg-blue-50" : ""}`} key={type}><input className="mr-1" type="checkbox" checked={selectedElementTypes.includes(type)} onChange={(event) => toggleType(type, event.target.checked)} />{elementTypeLabels[type]}</label>)}</div></fieldset></div><p className="mt-3 text-xs text-slate-500">{visibleElements.length} element(s) and {visibleRelationships.length} relationship(s). A relationship is shown only when both endpoints are visible.</p></section>
      <section className="card overflow-hidden">
      <div className="border-b p-4"><h2 className="font-bold">Cross-domain variation-point graph</h2><p className="text-xs text-slate-500">Double-click an element body for Existence, a parameter or attribute for Property/Tag, or a connector for a relationship variation point. Existing mappings open for editing.</p></div>
      <ModelGraph
        elements={visibleElements}
        relationships={visibleRelationships}
        layoutKey="variability:variation-points"
        workflowOverview={false}
        onElementDoubleClick={(elementId) => openTarget({ elementId, kind: "existence" })}
        onElementAttributeDoubleClick={(elementId, propertyPath, kind = "primitiveProperty") => openTarget({ elementId, kind, propertyPath })}
        onRelationshipDoubleClick={(relationshipId) => openTarget({ relationshipId, kind: "existence" })}
        onConnectionRequest={(connection, types) => setPendingConnection({ connection, types })}
      />
    </section></>}
    {view === "list" && <section className="card p-5">
    <div><h2 className="text-lg font-bold">Variation-point list</h2><p className="text-sm text-slate-500">Every constrained element or relationship may have multiple independently editable variation points.</p></div>
    <div className="mt-4 space-y-3">{project.variationPoints.map((variationPoint) => {
      let summary = "Always active";
      try {
        const parsed = parseFeatureExpression(variationPoint.featureExpression, project.features);
        if (parsed.tokens.length) summary = featureExpressionSummary(parsed.ast, names);
      } catch (error) {
        summary = error instanceof Error ? error.message : "Invalid condition";
      }
      return <article className={`rounded-lg border p-4 ${variationPoint.enabled ? "" : "opacity-60"}`} key={variationPoint.id}>
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{variationPoint.name}</strong><span className="badge bg-blue-50 text-blue-700">{variationPoint.kind}</span>{variationPoint.scope && <span className="badge bg-slate-100">{variationPoint.scope}</span>}{!variationPoint.enabled && <span className="badge bg-slate-100">disabled</span>}</div><code className="mt-1 block text-xs">{variationPoint.featureExpression || "always"}{variationPoint.featureValueConditions.length ? ` · ${variationPoint.featureValueConditions.map((condition) => `${condition.featureId}${condition.operator === "equals" ? "=" : "!="}${condition.value}`).join(", ")}` : ""}</code><p className="text-xs text-slate-500">{summary}</p></div><button className="btn" onClick={() => setEditor(structuredClone(variationPoint))}>Edit</button><button className="btn" onClick={() => update(variationPoint.id, { enabled: !variationPoint.enabled })}>{variationPoint.enabled ? "Disable" : "Enable"}</button><button className="btn btn-danger" onClick={async () => { if (await confirm(`Delete "${variationPoint.name}"?`, { confirmLabel: "Delete", tone: "danger" })) remove(variationPoint.id); }}><Trash2 size={14} /></button></div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2"><div><span className="font-semibold">Targets</span><div>{[...variationPoint.constrainedElementIds, ...variationPoint.constrainedRelationshipIds].map(targetName).join(", ")}</div></div><div><span className="font-semibold">Effect</span><div>{variationPoint.kind === "existence" ? "Include when condition is true; otherwise remove." : `${variationPoint.propertyPath ?? "Missing property"} · ${variationPoint.valueRules.length} value rule(s)`}</div></div></div>
        {variationPoint.kind !== "existence" && <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs"><strong>Ordered value rules</strong>{variationPoint.valueRules.map((rule, index) => <div className="mt-2 flex items-center gap-2" key={rule.id}><span>{index + 1}.</span><code className="flex-1">{rule.featureExpression || "fallback"}{rule.featureValueConditions.length ? ` · ${rule.featureValueConditions.map((condition) => `${condition.featureId}${condition.operator === "equals" ? "=" : "!="}${condition.value}`).join(", ")}` : ""} → {JSON.stringify(rule.value)}</code></div>)}</div>}
      </article>;
    })}</div>
  </section>}
    {editor && <VariationPointEditor initial={editor} onCancel={() => setEditor(null)} onSave={(variationPoint) => {
      if (project.variationPoints.some((candidate) => candidate.id === variationPoint.id)) update(variationPoint.id, variationPoint);
      else add(variationPoint);
      setEditor(null);
      return null;
    }} onDelete={project.variationPoints.some((candidate) => candidate.id === editor.id) ? async () => {
      if (await confirm(`Delete "${editor.name}"?`, { confirmLabel: "Delete", tone: "danger" })) remove(editor.id);
      setEditor(null);
    } : undefined} />}
    {chooser.length > 0 && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl"><h3 className="font-bold">Choose variation point to edit</h3><p className="mt-1 text-sm text-slate-500">Several variation points affect this target.</p><div className="mt-3 space-y-2">{chooser.map((variationPoint) => <button className="btn w-full justify-start" key={variationPoint.id} onClick={() => { setEditor(structuredClone(variationPoint)); setChooser([]); }}>{variationPoint.name} · {variationPoint.kind}</button>)}</div><button className="btn mt-3 w-full" onClick={() => setChooser([])}>Cancel</button></section></div>}
    {pendingConnection?.connection.source && pendingConnection.connection.target && <ModelRelationshipDraftEditor sourceId={pendingConnection.connection.source} targetId={pendingConnection.connection.target} allowedTypes={pendingConnection.types} onCancel={() => setPendingConnection(null)} onSave={(relationship) => {
      const error = addRelationship(relationship);
      if (!error) setPendingConnection(null);
      return error;
    }} />}
  </div>;
}

type ConfiguratorFeatureRow =
  | { kind: "feature"; feature: Feature; depth: number }
  | { kind: "group"; group: FeatureGroup; depth: number; cardinality: string };

function configuratorFeatureRows(features: Feature[], groups: FeatureGroup[]): ConfiguratorFeatureRow[] {
  const rows: ConfiguratorFeatureRow[] = [];
  const orderedFeatures = [...features].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const orderedGroups = [...groups].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const visitedFeatures = new Set<string>();
  const visitedGroups = new Set<string>();
  const walkFeature = (feature: Feature, depth: number) => {
    if (visitedFeatures.has(feature.id)) return;
    visitedFeatures.add(feature.id);
    rows.push({ kind: "feature", feature, depth });
    orderedGroups.filter((group) => group.parentFeatureId === feature.id && !group.parentGroupId).forEach((group) => walkGroup(group, depth + 1));
    orderedFeatures.filter((candidate) => candidate.parentId === feature.id && !candidate.parentGroupId).forEach((candidate) => walkFeature(candidate, depth + 1));
  };
  const walkGroup = (group: FeatureGroup, depth: number) => {
    if (visitedGroups.has(group.id)) return;
    visitedGroups.add(group.id);
    const choices = orderedFeatures.filter((feature) => feature.parentGroupId === group.id);
    const kinds = new Set(choices.map((feature) => feature.featureType));
    const cardinality = kinds.has("xor") ? "Choose exactly one (XOR)" : kinds.has("or") ? "Choose one or more (OR)" : "Grouped features";
    rows.push({ kind: "group", group, depth, cardinality });
    orderedGroups.filter((candidate) => candidate.parentGroupId === group.id).forEach((candidate) => walkGroup(candidate, depth + 1));
    choices.forEach((feature) => walkFeature(feature, depth + 1));
  };
  orderedFeatures.filter((feature) => feature.featureType === "root" || !feature.parentId).forEach((feature) => walkFeature(feature, 0));
  orderedGroups.filter((group) => !visitedGroups.has(group.id)).forEach((group) => walkGroup(group, 0));
  orderedFeatures.filter((feature) => !visitedFeatures.has(feature.id)).forEach((feature) => walkFeature(feature, 0));
  return rows;
}

function Configurator({ configurationId, setConfigurationId }: { configurationId: string; setConfigurationId: (id: string) => void }) {
  const { confirm, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const add = useAppStore((state) => state.addConfiguration);
  const update = useAppStore((state) => state.updateConfiguration);
  const remove = useAppStore((state) => state.deleteConfiguration);
  const validate = useAppStore((state) => state.validateConfigurationById);
  const derive = useAppStore((state) => state.deriveConfigurationById);
  const setVariabilityTab = useAppStore((state) => state.setVariabilityTab);
  const configuration = project.configurations.find((item) => item.id === configurationId);
  const activeConfigurations = project.configurations.filter((item) => !item.archivedAt);
  const archivedConfigurations = project.configurations.filter((item) => item.archivedAt);
  const findings = configuration ? validateConfiguration(project, configuration) : [];
  const [configurationDraft, setConfigurationDraft] = useState<Configuration | null>(null);
  const toggle = async (feature: Feature, selected: boolean) => {
    if (!configuration || feature.featureType === "root" || feature.featureType === "mandatory") return;
    let manual = [...configuration.manuallySelectedFeatureIds];
    let automatic = [...configuration.automaticConstraintFeatureIds];
    if (selected) {
      if (feature.featureType === "xor") {
        const siblings = project.features.filter((candidate) => candidate.parentId === feature.parentId && candidate.groupId === feature.groupId).map((candidate) => candidate.id);
        manual = manual.filter((id) => !siblings.includes(id));
        automatic = automatic.filter((id) => !siblings.includes(id));
      }
      manual.push(feature.id);
      for (const constraint of project.featureConstraints.filter((item) => item.type === "requires" && item.sourceFeatureId === feature.id)) {
        if (configuration.effectiveSelectedFeatureIds.includes(constraint.targetFeatureId)) continue;
        const target = project.features.find((item) => item.id === constraint.targetFeatureId);
        if (await confirm(`${feature.name} requires ${target?.name ?? constraint.targetFeatureId}. Select it now?`, { confirmLabel: "Select" })) {
          if (await confirm(`Should ${target?.name ?? constraint.targetFeatureId} be a manual selection?`, { confirmLabel: "Manual", cancelLabel: "Automatic" })) manual.push(constraint.targetFeatureId);
          else automatic.push(constraint.targetFeatureId);
        }
      }
    } else {
      manual = manual.filter((id) => id !== feature.id && !descendantsOf(project.features, feature.id).includes(id));
      automatic = automatic.filter((id) => id !== feature.id && !descendantsOf(project.features, feature.id).includes(id));
    }
    update(configuration.id, { manuallySelectedFeatureIds: [...new Set(manual)], automaticConstraintFeatureIds: [...new Set(automatic)], validationStatus: "notValidated", updatedAt: new Date().toISOString() });
  };
  const runDerivation = async () => {
    if (!configuration) return;
    const status = derivationStatus(project, configuration);
    if (status === "Current") return void alertUser("The 150% → 100% transformation has already been performed for the current model revision. The existing realization is unchanged.");
    if (status === "Stale" && !(await confirm("The existing 100% realization is stale. Rederive it from the current 150% model?", { confirmLabel: "Rederive" }))) return;
    const warnings = findings.filter((finding) => finding.severity !== "error");
    if (findings.some((finding) => finding.severity === "error")) return void alertUser("Derivation is blocked. Validate and correct the listed errors.");
    if (warnings.length && !(await confirm(`Acknowledge ${warnings.length} non-blocking finding(s) before derivation?\n\n${warnings.map((finding) => `${finding.ruleId}: ${finding.message}`).join("\n")}`, { confirmLabel: "Acknowledge" }))) return;
    const errors = derive(configuration.id);
    if (errors.length) void alertUser(errors.join("\n"));
    else setVariabilityTab("100% Realization");
  };
  const setFeatureValue = (feature: Feature, value: string) => {
    if (!configuration) return;
    update(configuration.id, {
      featureValues: { ...(configuration.featureValues ?? {}), [feature.id]: value },
      validationStatus: "notValidated",
      updatedAt: new Date().toISOString()
    });
  };
  const invalidFeatureIds = new Set(project.features.filter((feature) =>
    findings.some((finding) => finding.severity === "error" && (finding.message.includes(feature.id) || finding.message.includes(`“${feature.name}”`)))
  ).map((feature) => feature.id));
  const featureRows = useMemo(() => configuratorFeatureRows(project.features, project.featureGroups), [project.featureGroups, project.features]);
  const propertyEffects = useMemo(() => {
    if (!configuration) return [];
    const preview = applyVariationPoints(project, configuration, { elements: project.elements, relationships: project.relationships });
    return preview.appliedVariations.filter((effect) => {
      const variationPoint = project.variationPoints.find((item) => item.id === effect.variationPointId);
      return effect.effect === "modified" && variationPoint?.kind === "primitiveProperty";
    });
  }, [configuration, project]);
  return <section className="grid grid-cols-[300px_1fr] gap-4 max-lg:grid-cols-1">
    <aside className="card p-4"><label><span className="label">Saved configuration</span><select className="field" value={configurationId} onChange={(event) => setConfigurationId(event.target.value)}><option value="">Select a configuration</option>{activeConfigurations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <div className="mt-3 grid gap-2"><button className="btn btn-primary" onClick={() => setConfigurationDraft(newConfiguration())}>New configuration</button>{configuration && <><button className="btn" disabled={Boolean(configuration.archivedAt)} onClick={() => setConfigurationDraft(structuredClone(configuration))}>Edit configuration</button><button className="btn" onClick={() => {
        const copy = { ...structuredClone(configuration), id: uid("configuration"), architectureId: "", name: `${configuration.name} — Copy`, derivation: undefined, archivedAt: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        add(copy); setConfigurationId(copy.id);
      }}>Duplicate configuration</button>{!configuration.archivedAt && <><button className="btn" onClick={() => update(configuration.id, { manuallySelectedFeatureIds: [], automaticConstraintFeatureIds: [], featureValues: {}, validationStatus: "notValidated" })}>Reset selection</button><button className="btn btn-danger" onClick={async () => {
        const hasHistory = project.simulationRuns.some((run) => run.configurationId === configuration.id);
        const action = hasHistory ? "archive it and its generated architecture" : "permanently delete it and its generated architecture";
        if (await confirm(`${configuration.name} has ${hasHistory ? "historical simulation runs" : "no historical simulation runs"}. This will ${action}. Continue?`, { confirmLabel: "Continue", tone: "danger" })) {
          remove(configuration.id);
          setConfigurationId("");
        }
      }}>{project.simulationRuns.some((run) => run.configurationId === configuration.id) ? "Archive" : "Delete"}</button></>}</>}</div>
      {archivedConfigurations.length > 0 && <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Archived ({archivedConfigurations.length})</summary><div className="mt-2 space-y-1">{archivedConfigurations.map((item) => <button className="btn w-full justify-start" key={item.id} onClick={() => setConfigurationId(item.id)}>{item.name}</button>)}</div></details>}
    </aside>
    <div className="space-y-4">{configuration ? <>
      <section className="card p-5"><div className="flex items-center justify-between gap-4"><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">{configuration.name}</h2><p className="mt-1 text-sm text-slate-500">The linked architecture is generated automatically and always uses the same name. There is no independent architecture input.</p></div><span className="badge bg-slate-100">{project.architectures.find((architecture) => architecture.id === configuration.architectureId)?.status ?? "missing architecture"}</span></div>
        {configuration.archivedAt && <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">Archived configuration: retained read-only because immutable simulation history references it. Duplicate it to create an active editable configuration.</div>}
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"><strong>Realization scope:</strong> {configuration.realizationScopes?.length ? configuration.realizationScopes.join(", ") : "Entire compatible model"}<p className="mt-1 text-xs text-slate-500">Use Edit configuration to change the scope.</p></div>
        <ConfigurationReadiness project={project} configuration={configuration} emphasized showDetails={false} />
        <div className="mt-4 overflow-hidden rounded-xl border"><FeatureGraph configuration={configuration} invalidFeatureIds={invalidFeatureIds} onToggleFeature={toggle} readOnly={Boolean(configuration.archivedAt)} /></div>
        <div className="mt-4"><h3 className="font-bold">Feature selection hierarchy</h3><p className="mt-1 text-xs text-slate-500">Groups and indentation mirror the canonical Feature Model. Cardinality states how many choices the configuration requires.</p></div><div className="mt-2 overflow-hidden rounded-xl border border-slate-200">{featureRows.map((row) => {
          if (row.kind === "group") return <div key={row.group.id} className="border-b border-purple-100 bg-purple-50 px-3 py-2" style={{ paddingLeft: `${12 + row.depth * 22}px` }}><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-purple-950">{row.group.name}</strong><span className="badge bg-white text-purple-800">{row.cardinality}</span></div><p className="mt-0.5 text-xs text-purple-800">{row.group.description}</p></div>;
          const feature = row.feature;
          const effective = configuration.effectiveSelectedFeatureIds.includes(feature.id);
          const manual = configuration.manuallySelectedFeatureIds.includes(feature.id);
          const invalid = findings.some((finding) => finding.severity === "error" && finding.message.includes(feature.id));
          return <label key={feature.id} className={`block border-b border-slate-100 px-3 py-2.5 last:border-b-0 ${invalid ? "bg-red-50" : effective ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`} style={{ paddingLeft: `${12 + row.depth * 22}px` }}><span className="flex items-start gap-2"><input className="mt-1" type="checkbox" disabled={feature.featureType === "root" || feature.featureType === "mandatory" || Boolean(configuration.archivedAt)} checked={effective} onChange={(event) => toggle(feature, event.target.checked)} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong>{feature.name}</strong><span className="badge bg-slate-100 text-slate-700">{feature.featureType}</span><span className="text-xs text-slate-500">{manual ? "Manual" : effective ? "Automatic" : invalid ? "Invalid" : "Not selected"}</span></span><span className="mt-0.5 block text-xs text-slate-500">{feature.description}</span>{feature.valueType === "enumeration" && effective && <select className="field mt-2 max-w-md" disabled={Boolean(configuration.archivedAt)} value={String(configuration.featureValues?.[feature.id] ?? "")} onChange={(event) => setFeatureValue(feature, event.target.value)}><option value="">Select a value (suggested: {String(feature.defaultValue ?? feature.allowedValues?.[0] ?? "none")})</option>{(feature.allowedValues ?? []).map((value) => <option key={value} value={value}>{value}</option>)}</select>}</span></span></label>;
        })}</div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 p-3"><h4 className="font-semibold">Applied property values</h4><p className="mt-1 text-xs text-slate-500">Resolved primitive-property effects for this configuration. Values are calculated automatically from the selected features.</p></div><div className="overflow-x-auto"><table aria-label="Applied property values" className="w-full min-w-[760px] text-left text-sm"><thead><tr><th className="table-cell">Selected feature</th><th className="table-cell">Variation point</th><th className="table-cell">Affected element and property</th><th className="table-cell">Applied value</th></tr></thead><tbody>{propertyEffects.map((effect, index) => {
          const variationPoint = project.variationPoints.find((item) => item.id === effect.variationPointId)!;
          const target = effect.targetKind === "element" ? project.elements.find((item) => item.id === effect.targetId) : undefined;
          const featureNames = referencedFeatureIds(variationPoint, project.features).filter((id) => configuration.effectiveSelectedFeatureIds.includes(id)).map((id) => project.features.find((item) => item.id === id)?.name ?? id);
          const parameterId = effect.propertyPath?.startsWith("parameter:") ? effect.propertyPath.split(":")[1] : undefined;
          const parameter = target?.parameters.find((item) => item.id === parameterId);
          const unit = parameter?.unit ? ` ${parameter.unit}` : "";
          return <tr key={`${effect.variationPointId}-${effect.targetId}-${effect.propertyPath}-${index}`}><td className="table-cell">{featureNames.join(", ") || "Always applicable"}</td><td className="table-cell">{variationPoint.name}</td><td className="table-cell"><strong>{target?.name ?? effect.targetId}</strong><div className="text-xs text-slate-500">{parameter?.name ?? effect.propertyPath}</div></td><td className="table-cell"><strong>{String(effect.nextValue)}{unit}</strong><div className="text-xs text-slate-500">Previously {String(effect.previousValue ?? "not set")}{unit}</div></td></tr>;
        })}{!propertyEffects.length && <tr><td className="table-cell text-slate-500" colSpan={4}>No primitive-property value is applied by this configuration.</td></tr>}</tbody></table></div></div>
        <div className="mt-4 flex flex-wrap gap-2"><button className="btn" disabled={Boolean(configuration.archivedAt)} onClick={() => validate(configuration.id)}>Validate</button><button className="btn btn-primary" disabled={Boolean(configuration.archivedAt) || findings.some((finding) => finding.severity === "error")} onClick={runDerivation}>Derive 100% model</button><span className={`badge ${configuration.validationStatus === "valid" ? "bg-green-100 text-green-700" : configuration.validationStatus === "invalid" ? "bg-red-100 text-red-700" : "bg-slate-100"}`}>Feature choices: {configuration.validationStatus === "notValidated" ? "Not validated" : configuration.validationStatus === "valid" ? "Valid" : "Invalid"}</span><span className="badge bg-slate-100">100% architecture: {derivationStatus(project, configuration)}</span></div>
      </section>
      <section className="card p-5"><h3 className="font-bold">Ordered validation summary</h3><div className="mt-2 space-y-1">{findings.map((finding) => <div key={finding.id} className={`text-sm ${finding.severity === "error" ? "text-red-700" : finding.severity === "warning" ? "text-amber-700" : "text-slate-500"}`}><strong>{finding.ruleId}</strong> · {finding.message}</div>)}</div></section>
    </> : <section className="card p-8 text-center text-slate-500">Create or select a configuration.</section>}</div>
    {configurationDraft && <ConfigurationEditor initial={configurationDraft} onCancel={() => setConfigurationDraft(null)} onSave={(next) => {
      if (project.configurations.some((candidate) => candidate.id === next.id)) update(next.id, next);
      else { add(next); setConfigurationId(next.id); }
      setConfigurationDraft(null);
    }} onDelete={project.configurations.some((candidate) => candidate.id === configurationDraft.id) ? async () => {
      const hasHistory = project.simulationRuns.some((run) => run.configurationId === configurationDraft.id);
      const action = hasHistory ? "archive it and its generated architecture" : "permanently delete it and its generated architecture";
      if (await confirm(`${configurationDraft.name} has ${hasHistory ? "historical simulation runs" : "no historical simulation runs"}. This will ${action}. Continue?`, { confirmLabel: "Continue", tone: "danger" })) {
        remove(configurationDraft.id);
        setConfigurationId("");
      }
      setConfigurationDraft(null);
    } : undefined} />}
  </section>;
}

function TransformationButton({ configuration }: { configuration?: Configuration }) {
  const { confirm, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const derive = useAppStore((state) => state.deriveConfigurationById);
  const setTab = useAppStore((state) => state.setVariabilityTab);
  const transform = async () => {
    if (!configuration) return;
    const status = derivationStatus(project, configuration);
    if (status === "Current") {
      void alertUser("The 150% → 100% transformation has already been performed for the current model revision. The existing result remains unchanged.");
      return;
    }
    if (status === "Stale" && !(await confirm("The existing 100% realization is stale. Rederive it from the current 150% model?", { confirmLabel: "Rederive" }))) return;
    const findings = validateConfiguration(project, configuration);
    const errors = findings.filter((finding) => finding.severity === "error");
    if (errors.length) {
      void alertUser(`Transformation is blocked:\n\n${errors.map((finding) => `${finding.ruleId}: ${finding.message}`).join("\n")}`);
      return;
    }
    const warnings = findings.filter((finding) => finding.severity !== "error");
    if (warnings.length && !(await confirm(`Acknowledge ${warnings.length} non-blocking finding(s) before transformation?\n\n${warnings.map((finding) => `${finding.ruleId}: ${finding.message}`).join("\n")}`, { confirmLabel: "Acknowledge" }))) return;
    const derivationErrors = derive(configuration.id);
    if (derivationErrors.length) void alertUser(derivationErrors.join("\n"));
    else setTab("100% Realization");
  };
  return <button className="btn btn-primary" disabled={!configuration || Boolean(configuration.archivedAt)} onClick={transform}>Transform 150% → 100%</button>;
}

function StatusLegend() {
  return <div className="flex flex-wrap gap-2 text-xs"><span className="badge border border-slate-200 bg-white">Common</span><span className="badge border border-green-300 bg-green-50 text-green-800">Included</span><span className="badge border border-red-300 bg-red-50 text-red-800">Excluded</span><span className="badge border border-amber-300 bg-amber-50 text-amber-800">Modified</span></div>;
}

function PreviewModel({ configuration }: { configuration?: Configuration }) {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addElement = useAppStore((state) => state.addElement);
  const addFeature = useAppStore((state) => state.addFeature);
  const addVariationPoint = useAppStore((state) => state.addVariationPoint);
  const updateVariationPoint = useAppStore((state) => state.updateVariationPoint);
  const deleteVariationPoint = useAppStore((state) => state.deleteVariationPoint);
  const updateConfiguration = useAppStore((state) => state.updateConfiguration);
  const addRelationship = useAppStore((state) => state.addRelationship);
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const selectElement = useAppStore((state) => state.selectElement);
  const [newElementOpen, setNewElementOpen] = useState(false);
  const [variationDraft, setVariationDraft] = useState<VariationPoint | null>(null);
  const [chooser, setChooser] = useState<VariationPoint[]>([]);
  const [pendingConnection, setPendingConnection] = useState<{ connection: Connection; types: RelationshipType[] } | null>(null);
  const source = architectureCompatibleModel(project, configuration?.architectureId ?? "");
  const preview = configuration ? applyVariationPoints(project, configuration, source) : undefined;
  const selected = project.elements.find((element) => element.id === selectedElementId);
  const openTarget = (preset: { elementId?: string; relationshipId?: string; kind?: VariationPoint["kind"]; propertyPath?: string }) => {
    const existing = project.variationPoints.filter((variationPoint) =>
      preset.elementId
        ? variationPoint.constrainedElementIds.includes(preset.elementId) && (!preset.propertyPath || variationPoint.propertyPath === preset.propertyPath)
        : preset.relationshipId
          ? variationPoint.constrainedRelationshipIds.includes(preset.relationshipId) && (!preset.propertyPath || variationPoint.propertyPath === preset.propertyPath)
          : false
    );
    if (existing.length === 1) setVariationDraft(structuredClone(existing[0]));
    else if (existing.length > 1) setChooser(existing);
    else setVariationDraft({ ...newVariationPoint(preset), description: "Created from the editable 150% Product-Line Model." });
  };
  const createElement = (element: ModelElement, common: boolean) => {
    const now = new Date().toISOString();
    addElement(element);
    selectElement(element.id);
    setNewElementOpen(false);
    if (configuration && !common) {
      const featureId = `feature-configuration-${configuration.id}`;
      if (!project.features.some((feature) => feature.id === featureId)) {
        addFeature({
          id: featureId,
          parentId: project.features.find((feature) => feature.featureType === "root")?.id,
          name: `${configuration.name} applicability`,
          featureType: "optional",
          sortOrder: project.features.length,
          description: "Internal feature created for configuration-specific 150% model content.",
          valueType: "boolean",
          allowedValues: [],
          defaultValue: false,
          variabilityScope: "internal"
        });
      }
      updateConfiguration(configuration.id, {
        manuallySelectedFeatureIds: [...new Set([...configuration.manuallySelectedFeatureIds, featureId])]
      });
      addVariationPoint({
        id: uid("variation"),
        name: `${element.name} existence`,
        description: `Automatically created for ${configuration.name}.`,
        kind: "existence",
        constrainedElementIds: [element.id],
        constrainedRelationshipIds: [],
        featureExpression: featureId,
        featureValueConditions: [],
        valueRules: [],
        enabled: true,
        createdAt: now,
        updatedAt: now
      });
    }
  };
  return <div className="space-y-4">
    <section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Editable 150% Product-Line Model</h2><p className="text-sm text-slate-500">{configuration ? `${configuration.name} overlays the canonical source without changing it.` : "Complete cross-domain source with no configuration applied."}</p></div><div className="flex items-center gap-2"><StatusLegend /><TransformationButton configuration={configuration} /><button className="btn btn-primary" onClick={() => setNewElementOpen(true)}><Plus size={15} /> Element</button></div></div>{preview && preview.errors.length > 0 && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{preview.errors.join(" ")}</div>}</section>
    <section className={`card overflow-hidden ${selected ? "grid grid-cols-[minmax(0,1fr)_410px] max-xl:grid-cols-1" : ""}`}>
      <ModelGraph
        elements={source.elements}
        relationships={source.relationships}
        layoutKey="variability:150-percent"
        workflowOverview={false}
        elementStatuses={preview?.elementStatus}
        relationshipStatuses={preview?.relationshipStatus}
        onElementDoubleClick={(elementId) => openTarget({ elementId, kind: "existence" })}
        onElementAttributeDoubleClick={(elementId, propertyPath, kind = "primitiveProperty") => openTarget({ elementId, kind, propertyPath })}
        onRelationshipDoubleClick={(relationshipId) => openTarget({ relationshipId, kind: "existence" })}
        onConnectionRequest={(connection, types) => setPendingConnection({ connection, types })}
      />
      {selected && <ElementEditor element={selected} />}
    </section>
    {newElementOpen && <NewModelElementEditor configurationName={configuration?.name} onCancel={() => setNewElementOpen(false)} onSave={createElement} />}
    {variationDraft && <VariationPointEditor initial={variationDraft} onCancel={() => setVariationDraft(null)} onSave={(variationPoint) => {
      if (project.variationPoints.some((candidate) => candidate.id === variationPoint.id)) updateVariationPoint(variationPoint.id, variationPoint);
      else addVariationPoint(variationPoint);
      setVariationDraft(null);
      return null;
    }} onDelete={project.variationPoints.some((candidate) => candidate.id === variationDraft.id) ? async () => {
      if (await confirm(`Delete "${variationDraft.name}"?`, { confirmLabel: "Delete", tone: "danger" })) deleteVariationPoint(variationDraft.id);
      setVariationDraft(null);
    } : undefined} />}
    {chooser.length > 0 && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl"><h3 className="font-bold">Choose variation point to edit</h3><div className="mt-3 space-y-2">{chooser.map((variationPoint) => <button className="btn w-full justify-start" key={variationPoint.id} onClick={() => { setVariationDraft(structuredClone(variationPoint)); setChooser([]); }}>{variationPoint.name} · {variationPoint.kind}</button>)}</div><button className="btn mt-3 w-full" onClick={() => setChooser([])}>Cancel</button></section></div>}
    {pendingConnection?.connection.source && pendingConnection.connection.target && <ModelRelationshipDraftEditor sourceId={pendingConnection.connection.source} targetId={pendingConnection.connection.target} allowedTypes={pendingConnection.types} onCancel={() => setPendingConnection(null)} onSave={(relationship) => {
      const error = addRelationship(relationship);
      if (!error) setPendingConnection(null);
      return error;
    }} />}
  </div>;
}

function DerivedModel({ configuration }: { configuration?: Configuration }) {
  const project = useAppStore(selectActiveProject)!;
  const [showRemoved, setShowRemoved] = useState(false);
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const derivation = configuration?.derivation;
  if (!configuration) return <section className="card p-8 text-center text-slate-500">Select a generated configuration to inspect its 100% realization.</section>;
  if (!derivation) return <section className="card p-8 text-center"><p className="text-slate-500">No explicit realization exists for this configuration. Transform the canonical 150% model to create it.</p><div className="mt-4 flex justify-center"><TransformationButton configuration={configuration} /></div></section>;
  const included = derivation.realizedElements ?? derivation.sourceElements.filter((element) => derivation.includedElementIds.includes(element.id));
  const excluded = derivation.sourceElements.filter((element) => derivation.excludedElementIds.includes(element.id));
  const removedRelationships = derivation.sourceRelationships.filter((relationship) => derivation.removedRelationshipIds.includes(relationship.id));
  const renderedElements = showRemoved ? [...included, ...excluded] : included;
  const renderedRelationships = showRemoved ? [...derivation.realizedRelationships, ...removedRelationships] : derivation.realizedRelationships;
  const statuses = Object.fromEntries(included.map((element) => [
    element.id,
    derivation.modifiedElementIds?.includes(element.id) ? "modified" : "included"
  ])) as Record<string, PreviewStatus>;
  const allStatuses = {
    ...statuses,
    ...Object.fromEntries(excluded.map((element) => [element.id, "excluded" as const]))
  };
  const relationshipStatuses = Object.fromEntries(renderedRelationships.map((relationship) => [
    relationship.id,
    derivation.removedRelationshipIds.includes(relationship.id)
      ? "excluded"
      : derivation.modifiedRelationshipIds.includes(relationship.id)
        ? "modified"
        : "included"
  ])) as Record<string, PreviewStatus>;
  const inspected = renderedElements.find((element) => element.id === selectedElementId);
  return <div className="space-y-4">
    <section className="card flex items-center gap-3 p-4"><span className="badge bg-slate-100">Read-only immutable 100% realization</span><span className="badge bg-blue-50 text-blue-700">{derivationStatus(project, configuration)}</span><TransformationButton configuration={configuration} /><label className="ml-auto text-sm"><input className="mr-2" type="checkbox" checked={showRemoved} onChange={(event) => setShowRemoved(event.target.checked)} />Show removed content as red audit overlay</label></section>
    <section className={`card overflow-hidden ${inspected ? "grid grid-cols-[minmax(0,1fr)_360px] max-xl:grid-cols-1" : ""}`}>
      <ModelGraph
        elements={renderedElements}
        relationships={renderedRelationships}
        layoutKey={`realization:${configuration.id}`}
        workflowOverview={false}
        readOnly
        elementStatuses={allStatuses}
        relationshipStatuses={relationshipStatuses}
      />
      {inspected && <aside className="border-l bg-white p-5 max-xl:border-l-0 max-xl:border-t"><div className="text-xs font-bold uppercase text-slate-500">{elementTypeLabels[inspected.elementType]} · read-only inspector</div><h3 className="mt-1 text-lg font-bold">{inspected.name}</h3><p className="mt-2 text-sm text-slate-600">{inspected.description || "No description."}</p><dl className="mt-4 grid grid-cols-[110px_1fr] gap-2 text-xs max-sm:grid-cols-1"><dt className="font-semibold">ID</dt><dd className="font-mono">{inspected.id}</dd><dt className="font-semibold">Status</dt><dd>{allStatuses[inspected.id]}</dd><dt className="font-semibold">Parameters</dt><dd>{inspected.parameters.map((parameter) => `${parameter.name}: ${parameter.value ?? "—"} ${parameter.unit ?? ""}`).join("; ") || "None"}</dd></dl></aside>}
    </section>
    <section className="card p-5"><h3 className="font-bold">Applied variation audit</h3><div className="mt-2 space-y-2 text-sm">{derivation.appliedVariations?.map((variation, index) => <div className="rounded-lg bg-slate-50 p-3" key={`${variation.variationPointId}-${variation.targetId}-${index}`}><strong>{project.variationPoints.find((item) => item.id === variation.variationPointId)?.name ?? variation.variationPointId}</strong> · {variation.effect} {variation.targetKind} <code>{variation.targetId}</code>{variation.propertyPath && <> · <code>{variation.propertyPath}</code>: {JSON.stringify(variation.previousValue)} → {JSON.stringify(variation.nextValue)}</>}</div>) ?? <div>No variation audit is available for this legacy derivation.</div>}</div></section>
  </div>;
}

function DerivationSummary({ configuration }: { configuration?: Configuration }) {
  const project = useAppStore(selectActiveProject)!;
  const result = configuration?.derivation;
  if (!configuration || !result) return <section className="card p-8 text-center text-slate-500">Derive a valid configuration to create a summary.</section>;
  const names = (ids: string[]) => ids.map((id) => project.features.find((feature) => feature.id === id)?.name ?? id).join(", ") || "None";
  const typedValues = project.features.filter((feature) => feature.valueType === "enumeration").map((feature) => `${feature.name}: ${result.featureValues?.[feature.id] ?? "Not set"}`).join(", ") || "None";
  return <section className="card p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-bold">Derivation summary</h2><span className="badge bg-blue-50 text-blue-700">{derivationStatus(project, configuration)}</span></div><dl className="mt-4 grid grid-cols-[220px_1fr] gap-3 text-sm max-sm:grid-cols-1"><dt className="font-semibold">Manual selections</dt><dd>{names(result.manuallySelectedFeatureIds)}</dd><dt className="font-semibold">Automatic selections</dt><dd>{names(result.autoSelectedFeatureIds)}</dd><dt className="font-semibold">Effective selections</dt><dd>{names(result.effectiveSelectedFeatureIds)}</dd><dt className="font-semibold">Typed feature values</dt><dd>{typedValues}</dd><dt className="font-semibold">Realization scope</dt><dd>{result.realizationScopes?.join(", ") || "Entire compatible model"}</dd><dt className="font-semibold">Included / excluded</dt><dd>{result.includedElementIds.length} / {result.excludedElementIds.length}</dd><dt className="font-semibold">Modified elements / relationships</dt><dd>{result.modifiedElementIds?.length ?? 0} / {result.modifiedRelationshipIds?.length ?? 0}</dd><dt className="font-semibold">Applied variation effects</dt><dd>{result.appliedVariations?.length ?? 0}</dd><dt className="font-semibold">Removed relationships</dt><dd>{result.removedRelationshipIds.length} · {result.removedRelationshipIds.join(", ") || "None"}</dd><dt className="font-semibold">Source revision</dt><dd>{result.sourceModelRevision}</dd><dt className="font-semibold">Timestamp</dt><dd>{new Date(result.timestamp).toLocaleString()}</dd><dt className="font-semibold">Variant KPI snapshot</dt><dd>{Object.entries(result.calculatedKpiValues).map(([id, value]) => `${project.kpis.find((kpi) => kpi.id === id)?.name ?? id}: ${value ?? "Not available"}`).join(" · ")}</dd><dt className="font-semibold">Warnings / missing data</dt><dd>{result.warnings.join(" ") || "None"}</dd></dl></section>;
}
