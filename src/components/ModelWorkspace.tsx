import { SemanticParallelPanel } from "./SemanticWorkspace";
import { ArrowDownAZ, ChevronDown, ChevronRight, GitBranch, GripVertical, Grid3X3, List, Plus, Ruler, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isViewAvailable, modelSections, sectionProjectionElements } from "../domain/modelViews";
import { contextConnections } from "../domain/contextConnections";
import { calculateWorkflowProgress, workingScopeElementIds } from "../domain/traceability";
import { architectureApplies } from "../domain/validation";
import { applyVariationPoints } from "../domain/variationPoints";
import { calculateSemanticScope } from "../domain/semanticScope";
import {
  elementTypeColors,
  elementTypeLabels,
  elementTypes,
  type AttributeDataType,
  type ElementType,
  type GraphLayoutMode,
  type ModelElement,
  type Relationship,
  type ScalarValue
} from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { ElementEditor } from "./ElementEditor";
import { FunctionSequencePanel } from "./FunctionSequencePanel";
import { ModelGraph } from "./ModelGraph";
import { ModellingRecap } from "./ModellingRecap";
import { RelationshipManager } from "./RelationshipManager";
import { RequirementsValidationOverview } from "./StakeholderTraceabilityRecap";
import { TraceabilityMatrix } from "./TraceabilityMatrix";
import { ValidationPanel } from "./ValidationPanel";
import { UnitCatalogueDialog } from "./UnitCatalogueDialog";
import { SectionRecap } from "./SectionRecap";

export function ModelWorkspace() {
  const project = useAppStore(selectActiveProject)!;
  const activeTab = useAppStore((state) => state.uiPreferences.activeModelTab);
  const view = useAppStore((state) => state.uiPreferences.activeModelView);
  const setView = useAppStore((state) => state.setModelView);
  const preferredType = useAppStore((state) => state.uiPreferences.activeElementType);
  const preferredTypes = useAppStore((state) => state.uiPreferences.activeElementTypes);
  const sortModes = useAppStore((state) => state.uiPreferences.tableSortModeByType);
  const graphLayoutModes = useAppStore((state) => state.uiPreferences.graphLayoutModeByTab);
  const workflowFocus = useAppStore((state) => state.uiPreferences.workflowFocus);
  const setPreferredType = useAppStore((state) => state.setElementTypeFilter);
  const setPreferredTypes = useAppStore((state) => state.setElementTypeGroup);
  const setTableSortMode = useAppStore((state) => state.setTableSortMode);
  const setGraphLayoutMode = useAppStore((state) => state.setGraphLayoutMode);
  const setWorkflowFocus = useAppStore((state) => state.setWorkflowFocus);
  const setActiveArchitecture = useAppStore((state) => state.setActiveArchitecture);
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const selectElement = useAppStore((state) => state.selectElement);
  const addElement = useAppStore((state) => state.addElement);
  const addRelationship = useAppStore((state) => state.addRelationship);
  const duplicateElement = useAppStore((state) => state.duplicateElement);
  const deleteElement = useAppStore((state) => state.deleteElement);
  const addCustomAttributeDefinition = useAppStore((state) => state.addCustomAttributeDefinition);
  const [search, setSearch] = useState("");
  const tab = modelSections[activeTab];
  const type: ElementType | "all" = preferredType && tab.tableTypes.includes(preferredType) ? preferredType : "all";
  const groupedTypes = preferredTypes?.filter((item) => tab.tableTypes.includes(item));
  const contextEntityGroupActive = activeTab === "mission-context" && Boolean(groupedTypes?.length);
  const [architectureId, setArchitectureId] = useState(project.activeArchitectureId ?? "");
  const [newElementType, setNewElementType] = useState<ElementType>(tab.tableTypes[0]);
  useEffect(() => setArchitectureId(project.activeArchitectureId ?? ""), [project.activeArchitectureId]);
  useEffect(() => {
    if (!tab.tableTypes.includes(newElementType)) setNewElementType(tab.tableTypes[0]);
  }, [newElementType, tab.tableTypes]);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [relationshipEditorOpen, setRelationshipEditorOpen] = useState(false);
  useEffect(() => setRelationshipEditorOpen(false), [activeTab]);
  const selected = project.elements.find((element) => element.id === selectedElementId);
  const selectedConfiguration = project.configurations.find((configuration) =>
    project.architectures.find((architecture) => architecture.id === architectureId)?.configurationId === configuration.id
  );
  const configurationElementIds = useMemo(() => {
    if (!selectedConfiguration) return undefined;
    const projection = applyVariationPoints(project, selectedConfiguration, {
      elements: project.elements,
      relationships: project.relationships
    });
    return projection.errors.length ? undefined : new Set(projection.elements.map((element) => element.id));
  }, [project, selectedConfiguration]);
  const visibleTypes = tab.tableTypes;
  const filtered = useMemo(() => {
    const matches = project.elements.filter((element) => {
    if (configurationElementIds && !configurationElementIds.has(element.id)) return false;
    if (!visibleTypes.includes(element.elementType)) return false;
    if (contextEntityGroupActive && !groupedTypes?.includes(element.elementType)) return false;
    if (type !== "all" && element.elementType !== type) return false;
    if (!architectureApplies(element, architectureId || undefined)) return false;
    const parameters = element.parameters.map((parameter) => `${parameter.name} ${String(parameter.value ?? "")} ${parameter.unit ?? ""}`).join(" ");
    const haystack = `${element.name} ${element.description} ${element.tags.join(" ")} ${parameters}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
    const typeIndex = new Map(elementTypes.map((item, index) => [item, index]));
    return matches.sort((left, right) => {
      const group = (typeIndex.get(left.elementType) ?? 0) - (typeIndex.get(right.elementType) ?? 0);
      if (group) return group;
      const mode = sortModes[left.elementType] || "manual";
      if (mode === "az") return left.name.localeCompare(right.name);
      if (mode === "za") return right.name.localeCompare(left.name);
      const order = project.rowOrderByType[left.elementType] ?? [];
      const leftIndex = order.indexOf(left.id);
      const rightIndex = order.indexOf(right.id);
      return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    });
  }, [project, visibleTypes, type, architectureId, configurationElementIds, contextEntityGroupActive, groupedTypes, search, sortModes]);
  const createElement = () => {
    if (newElementType === "system") { const existing = project.elements.find((item) => item.elementType === "system"); if (existing) { selectElement(existing.id); return; } }
    const now = new Date().toISOString();
    const definitions = project.customAttributeDefinitions.filter((definition) => definition.elementType === newElementType);
    const element: ModelElement = {
      id: `${newElementType}-${crypto.randomUUID()}`,
      elementType: newElementType,
      name: `New ${elementTypeLabels[newElementType].toLowerCase()}`,
      description: "",
      status: "draft",
      architectureScope: "common",
      architectureId: undefined,
      parameters: [],
      customAttributeValues: Object.fromEntries(definitions.map((definition) => [definition.id, definition.defaultValue])),
      tags: [newElementType],
      metadata: {
        owner: "",
        source: "",
        ...(newElementType === "useCase" ? { subjectSystemId: project.elements.find((item) => item.elementType === "system")?.id } : {})
      },
      createdAt: now,
      updatedAt: now
    };
    addElement(element);
    const mission = newElementType === "system" && project.elements.filter((item) => item.elementType === "mission").length === 1
      ? project.elements.find((item) => item.elementType === "mission")
      : undefined;
    if (mission) {
      const relationship: Relationship = {
        id: `relationship-has-soi-${element.id}`,
        relationshipType: "hasSOI",
        sourceId: mission.id,
        targetId: element.id,
        name: "Has system of interest",
        description: "Identifies the system of interest governed by this mission.",
        createdAt: now,
        updatedAt: now
      };
      addRelationship(relationship);
    }
    selectElement(element.id);
  };

  const scopeIds = workingScopeElementIds(project);
  const diagramElements = sectionProjectionElements(project, activeTab, architectureId || undefined)
    .filter((element) => !configurationElementIds || configurationElementIds.has(element.id));
  const diagramIds = new Set(diagramElements.map((element) => element.id));
  const allContextRelationships = contextConnections(project);
  const diagramContextRelationships = allContextRelationships.filter((relationship) =>
    diagramIds.has(relationship.sourceId) && diagramIds.has(relationship.targetId)
  );
  const diagramRelationships = project.relationships.filter((relationship) =>
    diagramIds.has(relationship.sourceId)
    && diagramIds.has(relationship.targetId)
    && (!architectureId || !relationship.architectureId || relationship.architectureId === architectureId)
  );
  const effectiveView = isViewAvailable(activeTab, view) ? view : "graph";
  const layoutMode = graphLayoutModes[activeTab] ?? (effectiveView === "diagram" ? "sequence" : "hierarchy");
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-[32px] font-bold text-slate-900">Model - {tab.label}</h1><p className="mt-1 text-slate-600">Build the mission-to-validation thread in any order; the workflow and validation remain live.</p></div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select aria-label="New element type" className="field sm:w-56" value={newElementType} onChange={(event) => setNewElementType(event.target.value as ElementType)}>{visibleTypes.map((elementType) => <option key={elementType} value={elementType}>{elementTypeLabels[elementType]}</option>)}</select>
            <button className="btn btn-primary whitespace-nowrap" onClick={createElement}><Plus size={16} /> Add element</button>
            <button className="btn whitespace-nowrap" onClick={() => setUnitDialogOpen(true)}><Ruler size={16} /> Units</button>
          </div>
        </div>
      </div>
      <section className="card p-4">
        <div className="grid grid-cols-[minmax(240px,1fr)_220px_minmax(260px,420px)] gap-3 max-lg:grid-cols-1">
          <label className="relative"><span className="sr-only">Search model</span><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input className="field pl-9" placeholder="Search elements, tags, parameters…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><span className="sr-only">Element type</span><select className="field" value={contextEntityGroupActive ? "contextEntities" : type} onChange={(event) => {
            if (event.target.value === "contextEntities") setPreferredTypes(["system", "stakeholder", "externalSystem"]);
            else setPreferredType(event.target.value === "all" ? undefined : event.target.value as ElementType);
          }}><option value="all">All types</option>{activeTab === "mission-context" && <option value="contextEntities">System / stakeholders / external entities</option>}{visibleTypes.map((item) => <option key={item} value={item}>{elementTypeLabels[item]}</option>)}</select></label>
          <label><span className="sr-only">Model view</span><select className="field" value={architectureId} onChange={(event) => { setArchitectureId(event.target.value); setActiveArchitecture(event.target.value || undefined); }}><option value="">150% Product-Line Model</option>{project.architectures.filter((architecture) => architecture.status !== "archived").map((architecture) => <option key={architecture.id} value={architecture.id}>Configuration / architecture: {architecture.name} · {architecture.status}</option>)}</select></label>
        </div>
      </section>
      {workflowFocus && <section className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase tracking-wide text-purple-700">Workflow task context</div><h2 className="font-bold text-purple-950">{calculateWorkflowProgress(project).find((step) => step.id === workflowFocus)?.label ?? workflowFocus}</h2><p className="mt-1 text-sm text-purple-800">{calculateWorkflowProgress(project).find((step) => step.id === workflowFocus)?.detail}</p>{project.validationResults.filter((finding) => finding.severity === "error").length > 0 && <p className="mt-2 text-xs text-purple-700">{project.validationResults.filter((finding) => finding.severity === "error").length} current validation errors remain visible in Model quality and relevant traceability cells.</p>}</div><button className="btn" onClick={() => setWorkflowFocus(undefined)}>Clear task</button></div>
      </section>}
      <div className="flex flex-wrap gap-2">
        {tab.availableViews.includes("table") && <ViewButton active={effectiveView === "table"} icon={List} label="Editable table" onClick={() => setView("table")} />}
        {tab.availableViews.includes("graph") && <ViewButton active={effectiveView === "graph"} icon={GitBranch} label={activeTab === "requirements-validation" ? "Trace diagram" : activeTab === "mission-context" ? "Context graph" : activeTab === "traceability" ? "Cross-domain graph" : "Architecture & hierarchy"} onClick={() => setView("graph")} />}
        {tab.availableViews.includes("diagram") && <ViewButton active={effectiveView === "diagram"} icon={GitBranch} label="Function sequence" onClick={() => { setView("diagram"); setGraphLayoutMode(activeTab, "sequence"); }} />}
        {tab.availableViews.includes("requirementsOverview") && <ViewButton active={effectiveView === "requirementsOverview"} icon={List} label="Requirements & Validation Overview" onClick={() => setView("requirementsOverview")} />}
        {tab.availableViews.includes("matrix") && <ViewButton active={effectiveView === "matrix"} icon={Grid3X3} label={activeTab === "traceability" ? "Global traceability" : "Traceability matrix"} onClick={() => setView("matrix")} />}
        {tab.availableViews.includes("sectionRecap") && <ViewButton active={effectiveView === "sectionRecap"} icon={Grid3X3} label="Section recap" onClick={() => setView("sectionRecap")} />}
        {tab.availableViews.includes("overview") && <ViewButton active={effectiveView === "overview"} icon={Grid3X3} label="Model Digital Thread" onClick={() => setView("overview")} />}
        {tab.availableViews.includes("quality") && <ViewButton active={effectiveView === "quality"} icon={ShieldCheck} label="Model quality" onClick={() => setView("quality")} />}
        {effectiveView === "table" && <label className="ml-auto flex items-center gap-2 text-sm text-slate-500"><ArrowDownAZ size={16} /><span className="sr-only">Table order</span><select className="field w-44" value={sortModes[type === "all" ? newElementType : type] ?? "manual"} onChange={(event) => setTableSortMode(type === "all" ? newElementType : type, event.target.value as "manual" | "az" | "za")}><option value="manual">Manual order</option><option value="az">Alphabetical A–Z</option><option value="za">Alphabetical Z–A</option></select></label>}
        <span className="ml-auto self-center text-sm text-slate-500">{filtered.length} of {project.elements.length} elements</span>
      </div>
      <div>
        <div className="min-w-0 space-y-4">
          {effectiveView === "table" && <>
            <ElementTable elements={filtered} onSelect={selectElement} onDuplicate={duplicateElement} onDelete={(element) => {
              const storedCount = project.relationships.filter((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id).length;
              const referenceCount = contextConnections(project).filter((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id).length;
              if (window.confirm(`Delete “${element.name}”? ${storedCount} relationships and ${referenceCount} typed context references will also be removed.`)) deleteElement(element.id);
            }} />
            <section className="card overflow-hidden"><button className="flex w-full items-center gap-2 p-4 text-left font-bold" aria-expanded={relationshipEditorOpen} onClick={() => setRelationshipEditorOpen((open) => !open)}>{relationshipEditorOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}Relationship editor<span className="ml-auto text-xs font-normal text-slate-500">{relationshipEditorOpen ? "Hide" : "Show"}</span></button>{relationshipEditorOpen && <div className="border-t border-slate-200 p-4"><RelationshipManager /></div>}</section>
          </>}
          {effectiveView === "graph" && <section className="card overflow-hidden"><div className="flex items-center gap-4 border-b border-slate-200 p-4"><div className="min-w-0 flex-1"><h2 className="font-bold">{tab.graphLabel}</h2><p className="text-xs text-slate-500">{tab.graphDescription} Newly created elements appear immediately; typed context references are shown as dashed teal connections.</p></div><label className="w-48"><span className="label">Layout</span><select className="field" value={layoutMode} onChange={(event) => setGraphLayoutMode(activeTab, event.target.value as GraphLayoutMode)}>{tab.graphLayoutModes.map((mode) => <option value={mode} key={mode}>{mode === "manual" ? "Manual positions" : mode === "hierarchy" ? "Automatic hierarchy" : mode === "horizontal" ? "Left-to-right hierarchy" : "Sequence stages"}</option>)}</select></label></div><ModelGraph elements={diagramElements} relationships={diagramRelationships} contextRelationships={diagramContextRelationships} layoutMode={layoutMode} layoutKey={`tab:${activeTab}`} scopedElementIds={scopeIds} /></section>}
          {effectiveView === "diagram" && tab.sequenceDomain && <FunctionSequencePanel domain={tab.sequenceDomain} contextElements={diagramElements} layoutMode={layoutMode} onLayoutModeChange={(mode) => setGraphLayoutMode(activeTab, mode)} scopedElementIds={scopeIds} />}
          {effectiveView === "requirementsOverview" && <RequirementsValidationOverview />}
          {effectiveView === "sectionRecap" && <SectionRecap tab={activeTab} />}
          {effectiveView === "overview" && <ModellingRecap />}
          {effectiveView === "matrix" && <SemanticParallelPanel flag="showSemanticMatrix" label="Open read-only Digital Thread matrix"><section className="card overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold">{activeTab === "traceability" ? "Global editable traceability matrix" : "Editable traceability matrix"}</h2><p className="text-xs text-slate-500">{activeTab === "traceability" ? "Every model element is available in one cross-domain overview." : "Previous-step and current-step elements remain visible even before they are connected."} Teal cells are typed references edited in element details; other links use canonical stored directions.</p></div><TraceabilityMatrix elements={diagramElements} relationships={diagramRelationships} contextRelationships={diagramContextRelationships} columnTypes={tab.matrixTypes} scopedElementIds={scopeIds} /></section></SemanticParallelPanel>}
          {effectiveView === "quality" && <ValidationPanel />}
        </div>
      </div>
      {selected && effectiveView !== "quality" && <><button className="fixed inset-0 z-40 bg-slate-950/30" aria-label="Close element details" onClick={() => selectElement(null)} /><div className="fixed bottom-0 right-0 top-[var(--workbench-header-height,64px)] z-50 w-full max-w-[440px] border-l border-slate-200 bg-white shadow-2xl"><ElementEditor element={selected} onSave={() => selectElement(null)} /></div></>}
      {columnDialogOpen && <CustomColumnDialog initialType={type === "all" ? newElementType : type} onClose={() => setColumnDialogOpen(false)} onCreate={(definition) => { addCustomAttributeDefinition(definition); setColumnDialogOpen(false); }} />}
      {unitDialogOpen && <UnitCatalogueDialog onClose={() => setUnitDialogOpen(false)} />}
    </div>
  );
}

function ViewButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof List; label: string; onClick: () => void }) {
  return <button className={`btn ${active ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`} onClick={onClick}><Icon size={16} />{label}</button>;
}

function ElementTable({ elements, onSelect, onDuplicate, onDelete }: {
  elements: ModelElement[];
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (element: ModelElement) => void;
}) {
  const project = useAppStore(selectActiveProject)!;
  const updateElement = useAppStore((state) => state.updateElement);
  const updateParameter = useAppStore((state) => state.updateParameter);
  const moveElement = useAppStore((state) => state.moveElement);
  const setSelectedUseCases = useAppStore((state) => state.setSelectedUseCases);
  const sortModes = useAppStore((state) => state.uiPreferences.tableSortModeByType);
  const [draggedId, setDraggedId] = useState("");
  const [showMoreColumns, setShowMoreColumns] = useState(false);
  const definitions = project.customAttributeDefinitions.filter((definition) => elements.some((element) => element.elementType === definition.elementType));
  const showsUseCases = elements.some((element) => element.elementType === "useCase");
  const eligibleUseCaseIds = new Set(calculateSemanticScope(project).eligibleUseCases.map((element) => element.id));
  const referenceRelationships = contextConnections(project);
  return (
    <section className="card overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2"><p className="text-xs text-slate-500">Primary engineering fields remain visible. Expand secondary record-management fields when needed.</p><button className="btn whitespace-nowrap" aria-expanded={showMoreColumns} onClick={() => setShowMoreColumns((shown) => !shown)}>{showMoreColumns ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{showMoreColumns ? "Hide extra columns" : "More columns"}</button></div><div className="max-h-[70vh] overflow-auto">
      <table className="w-max min-w-full">
        <thead className="bg-slate-50"><tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:whitespace-nowrap [&>th]:bg-slate-50"><th className="table-cell left-0 z-30 min-w-72">Name</th><th className="table-cell">Type</th><th className="table-cell">Authoritative duration</th><th className="table-cell">Parameters and recommended ranges</th><th className="table-cell">Actions</th>{showMoreColumns && <>{showsUseCases && <th className="table-cell">Working scope</th>}<th className="table-cell">Record review</th>{definitions.map((definition) => <th className="table-cell" key={definition.id}>{definition.name}{definition.unit ? ` (${definition.unit})` : ""}</th>)}<th className="table-cell">Tags</th><th className="table-cell">Connections</th></>}</tr></thead>
        <tbody>{elements.map((element) => {
          const connections = project.relationships.filter((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id).length
            + referenceRelationships.filter((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id).length;
          return (
            <tr key={element.id} style={{ borderLeft: `5px solid ${elementTypeColors[element.elementType]}` }} className="hover:bg-slate-50" onDragOver={(event) => {
              if (draggedId && sortModes[element.elementType] !== "az" && sortModes[element.elementType] !== "za") event.preventDefault();
            }} onDrop={() => {
              const dragged = project.elements.find((item) => item.id === draggedId);
              if (dragged?.elementType === element.elementType) moveElement(element.elementType, draggedId, element.id);
              setDraggedId("");
            }}>
              <td className="table-cell sticky left-0 z-10 min-w-72 bg-white"><div className="flex items-start gap-2"><button draggable={(sortModes[element.elementType] ?? "manual") === "manual"} onDragStart={() => setDraggedId(element.id)} onDragEnd={() => setDraggedId("")} className={`mt-2 rounded p-1 ${(sortModes[element.elementType] ?? "manual") === "manual" ? "cursor-grab text-slate-500 hover:bg-slate-100" : "cursor-not-allowed text-slate-300"}`} title={(sortModes[element.elementType] ?? "manual") === "manual" ? `Drag to reorder ${elementTypeLabels[element.elementType]} rows` : "Return to Manual order to drag rows"}><GripVertical size={16} /></button><div className="min-w-0 flex-1"><input aria-label={`Name of ${element.name}`} className="field font-semibold" value={element.name} onChange={(event) => updateElement(element.id, { name: event.target.value })} /><button className="mt-1 text-xs text-blue-700 hover:underline" onClick={() => onSelect(element.id)}>Open full details</button></div></div></td>
              <td className="table-cell min-w-44 whitespace-nowrap"><span className="badge text-white" style={{ backgroundColor: elementTypeColors[element.elementType] }}>{elementTypeLabels[element.elementType]}</span></td>
              <td className="table-cell min-w-56">{element.elementType === "processFunction" ? <div className="grid grid-cols-[1fr_110px] gap-2"><input aria-label={`Duration of ${element.name}`} className="field" type="number" min="0" value={element.metadata.duration ?? ""} onChange={(event) => updateElement(element.id, { metadata: { ...element.metadata, duration: event.target.value === "" ? undefined : Number(event.target.value) } })} /><select aria-label={`Duration unit of ${element.name}`} className="field" value={element.metadata.durationUnit ?? ""} onChange={(event) => updateElement(element.id, { metadata: { ...element.metadata, durationUnit: event.target.value as ModelElement["metadata"]["durationUnit"] } })}><option value="">Unit…</option><option>minute</option><option>hour</option><option>day</option></select></div> : <span className="text-xs text-slate-300">—</span>}</td>
              <td className="table-cell min-w-[420px]">{element.parameters.length ? <div className="space-y-2">{element.parameters.map((parameter) => <div key={parameter.id} className="rounded border border-slate-100 p-2 text-xs"><div><strong>{parameter.name}</strong>: {String(parameter.value ?? "—")} {parameter.unit}</div>{parameter.dataType === "number" && <div className="mt-1 grid grid-cols-3 gap-1"><input aria-label={`Minimum of ${parameter.name}`} className="field px-2 py-1 text-xs" type="number" placeholder="Minimum" value={parameter.minimum ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { minimum: event.target.value === "" ? undefined : Number(event.target.value) })} /><input aria-label={`Maximum of ${parameter.name}`} className="field px-2 py-1 text-xs" type="number" placeholder="Maximum" value={parameter.maximum ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { maximum: event.target.value === "" ? undefined : Number(event.target.value) })} /><input aria-label={`Uncertainty of ${parameter.name}`} className="field px-2 py-1 text-xs" type="number" min="0" max="100" placeholder="± %" value={parameter.uncertaintyPercent ?? ""} onChange={(event) => updateParameter(element.id, parameter.id, { uncertaintyPercent: event.target.value === "" ? undefined : Number(event.target.value) })} /></div>}</div>)}</div> : <span className="text-xs text-slate-400">No parameters</span>}</td>
              <td className="table-cell min-w-[18rem]"><div className="flex gap-2"><button className="btn" onClick={() => onSelect(element.id)}>Edit</button><button className="btn" onClick={() => onDuplicate(element.id)}>Duplicate</button><button className="btn btn-danger" onClick={() => onDelete(element)}>Delete</button></div></td>
              {showMoreColumns && <>{showsUseCases && <td className="table-cell min-w-48">{element.elementType === "useCase" ? <label className="flex items-start gap-2 text-sm"><input aria-label={`Include ${element.name} in working scope`} className="mt-1" type="checkbox" checked={project.selectedUseCaseIds.includes(element.id)} disabled={!eligibleUseCaseIds.has(element.id) && !project.selectedUseCaseIds.includes(element.id)} onChange={(event) => setSelectedUseCases(toggleId(project.selectedUseCaseIds, element.id, event.target.checked))} /><span>{eligibleUseCaseIds.has(element.id) ? "In working scope" : <span className="text-red-700">Not linked to the system of interest</span>}</span></label> : <span className="text-slate-300">—</span>}</td>}<td className="table-cell"><select className="field min-w-28" value={element.status} onChange={(event) => updateElement(element.id, { status: event.target.value as ModelElement["status"] })}><option>draft</option><option>reviewed</option><option>approved</option></select></td>{definitions.map((definition) => <td className="table-cell min-w-40" key={definition.id}>{definition.elementType === element.elementType ? <InlineCustomValue value={element.customAttributeValues[definition.id]} dataType={definition.dataType} onChange={(value) => updateElement(element.id, { customAttributeValues: { ...element.customAttributeValues, [definition.id]: value } })} /> : <span className="text-slate-300">—</span>}</td>)}<td className="table-cell min-w-40"><input className="field" aria-label={`Tags for ${element.name}`} value={element.tags.join(", ")} onChange={(event) => updateElement(element.id, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></td><td className="table-cell min-w-28 text-center">{connections}</td></>}
            </tr>
          );
        })}</tbody>
      </table>
      {!elements.length && <div className="p-12 text-center text-slate-500">No elements match the current search and filters.</div>}
    </div></section>
  );
}

function toggleId(ids: string[], id: string, selected: boolean) {
  return selected ? [...new Set([...ids, id])] : ids.filter((candidate) => candidate !== id);
}

function InlineCustomValue({ value, dataType, onChange }: { value: ScalarValue | undefined; dataType: AttributeDataType; onChange: (value: ScalarValue) => void }) {
  if (dataType === "boolean") return <select className="field" value={String(value ?? "")} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "true")}><option value="">Not set</option><option value="true">True</option><option value="false">False</option></select>;
  return <input className="field" type={dataType === "number" ? "number" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value === "" ? null : dataType === "number" ? Number(event.target.value) : event.target.value)} />;
}

function CustomColumnDialog({ initialType, onClose, onCreate }: {
  initialType: ElementType;
  onClose: () => void;
  onCreate: (definition: {
    id: string;
    elementType: ElementType;
    name: string;
    dataType: AttributeDataType;
    unit?: string;
    required: boolean;
    defaultValue: ScalarValue;
    description: string;
  }) => void;
}) {
  const [elementType, setElementType] = useState(initialType);
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<AttributeDataType>("string");
  const [unit, setUnit] = useState("");
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-6">
      <section className="card w-full max-w-xl p-5" role="dialog" aria-modal="true" aria-label="Add custom attribute column">
        <div className="flex items-start gap-2"><div className="flex-1"><h2 className="text-lg font-bold">Add reusable custom-attribute column</h2><p className="text-sm text-slate-500">The definition and its default value apply to every element of the selected type.</p></div><button className="btn p-2" aria-label="Close" onClick={onClose}><X size={15} /></button></div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label><span className="label">Element type</span><select className="field" value={elementType} onChange={(event) => setElementType(event.target.value as ElementType)}>{elementTypes.map((type) => <option key={type} value={type}>{elementTypeLabels[type]}</option>)}</select></label>
          <label><span className="label">Column name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span className="label">Data type</span><select className="field" value={dataType} onChange={(event) => setDataType(event.target.value as AttributeDataType)}><option>string</option><option>number</option><option>boolean</option></select></label>
          <label><span className="label">Unit (optional)</span><input className="field" value={unit} onChange={(event) => setUnit(event.target.value)} disabled={dataType !== "number"} /></label>
          <label><span className="label">Default value</span><input className="field" value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} /></label>
          <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 p-2 text-sm"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /> Required</label>
          <label className="col-span-2"><span className="label">Description</span><textarea className="field" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!name.trim()} onClick={() => onCreate({
          id: `attribute-${crypto.randomUUID()}`,
          elementType,
          name: name.trim(),
          dataType,
          unit: dataType === "number" && unit.trim() ? unit.trim() : undefined,
          required,
          defaultValue: defaultValue === "" ? null : dataType === "number" ? Number(defaultValue) : dataType === "boolean" ? defaultValue.toLowerCase() === "true" : defaultValue,
          description: description.trim()
        })}>Create column</button></div>
      </section>
    </div>
  );
}
