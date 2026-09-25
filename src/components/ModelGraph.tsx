import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance
} from "@xyflow/react";
import { RefreshCw, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isPrimaryHierarchyRelationship, semanticElementLayers, type LayeredLayoutRequest } from "../domain/modelGraphV04Layouts";
import type { ContextConnection } from "../domain/contextConnections";
import { compatibleRelationshipTypes } from "../domain/relationships";
import { analyzeSequence } from "../domain/sequences";
import { elementTypeColors, elementTypeLabels, type FunctionSequence, type GraphLayoutMode, type ModelElement, type Relationship, type RelationshipType } from "../domain/types";
import { useModelGraphV04Layout } from "../hooks/useModelGraphV04Layout";
import { useNodeMeasurements } from "../hooks/useNodeMeasurements";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { graphPortId, ModelGraphNode, type MeasuredGraphNodeData } from "./MeasuredGraphNodes";
import { ModelGraphV04Edge, type ModelGraphV04EdgeData } from "./ModelGraphV04Edge";
import { ModelWorkflowOverview } from "./GraphReadabilityOverview";
import { contextConnections } from "../domain/contextConnections";
import { useDialogs } from "./dialogs/DialogProvider";

type GraphDensity = "compact" | "detailed";
type RelationshipView = "structure" | "all" | "selection";
type GraphPresentation = "overview" | "canvas";
type GraphConnection = (Relationship & { context?: false }) | (ContextConnection & { context: true });

const MODEL_NODE_WIDTH = 225;
const routedEdgeTypes = { routed: ModelGraphV04Edge };
const modelNodeTypes = { modelGraphNode: ModelGraphNode };

const modelNodeHeight = (
  element: ModelElement,
  density: GraphDensity,
  flags: { stage: boolean; status: boolean; outsideScope: boolean; unlinked: boolean }
) => {
  let height = 62;
  if (flags.stage) height += 25;
  if (density === "detailed") {
    if (element.parameters.length) height += 25 + element.parameters.length * 15;
    if (element.metadata.duration !== undefined) height += 18;
    height += 20;
  }
  if (flags.status) height += 17;
  if (flags.outsideScope) height += 24;
  if (flags.unlinked) height += 24;
  return Math.max(82, height);
};

export function ModelGraph({
  elements,
  relationships,
  contextRelationships = [],
  sequence,
  layoutMode = sequence ? "sequence" : "hierarchy",
  layoutKey = sequence?.id ?? "model",
  scopedElementIds,
  readOnly = false,
  elementStatuses,
  relationshipStatuses,
  allowDetailed = true,
  heightClass = "h-[620px]",
  layerOverrides,
  workflowOverview,
  onElementDoubleClick,
  onElementAttributeDoubleClick,
  onRelationshipDoubleClick,
  onConnectionRequest
}: {
  elements: ModelElement[];
  relationships: Relationship[];
  contextRelationships?: ContextConnection[];
  sequence?: FunctionSequence;
  layoutMode?: GraphLayoutMode;
  layoutKey?: string;
  scopedElementIds?: Set<string>;
  readOnly?: boolean;
  elementStatuses?: Record<string, "common" | "included" | "excluded" | "modified">;
  relationshipStatuses?: Record<string, "common" | "included" | "excluded" | "modified">;
  allowDetailed?: boolean;
  heightClass?: string;
  layerOverrides?: Record<string, { layer: number; label: string }>;
  workflowOverview?: boolean;
  onElementDoubleClick?: (elementId: string) => void;
  onElementAttributeDoubleClick?: (elementId: string, propertyPath: string, kind?: "primitiveProperty" | "primitiveTag") => void;
  onRelationshipDoubleClick?: (relationshipId: string) => void;
  onConnectionRequest?: (connection: Connection, allowedTypes: RelationshipType[]) => void;
}) {
  const { alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const selectElement = useAppStore((state) => state.selectElement);
  const selectedRelationshipId = useAppStore((state) => state.selectedRelationshipId);
  const selectRelationship = useAppStore((state) => state.selectRelationship);
  const addRelationship = useAppStore((state) => state.addRelationship);
  const updateElement = useAppStore((state) => state.updateElement);
  const overviewEnabled = workflowOverview ?? (!sequence && layoutMode !== "sequence" && layoutMode !== "horizontal");
  const [temporaryRelationshipId, setTemporaryRelationshipId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ connection: Connection; types: RelationshipType[] } | null>(null);
  const [density, setDensity] = useState<GraphDensity>("compact");
  const [relationshipView, setRelationshipView] = useState<RelationshipView>("structure");
  const [presentation, setPresentation] = useState<GraphPresentation>(() => overviewEnabled && (elements.length >= 24 || relationships.length + contextRelationships.length >= 40) ? "overview" : "canvas");
  const [graphSelectedElementId, setGraphSelectedElementId] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const { measurements, reportMeasurement } = useNodeMeasurements();
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>();
  const flowInstance = useRef<ReactFlowInstance>();
  const ids = useMemo(() => new Set(elements.map((element) => element.id)), [elements]);
  const allConnections = useMemo<GraphConnection[]>(() => [
    ...relationships.map((relationship) => ({ ...relationship, context: false as const })),
    ...contextRelationships.map((relationship) => ({ ...relationship, context: true as const }))
  ], [contextRelationships, relationships]);
  const sequenceAnalysis = useMemo(() => sequence ? analyzeSequence(project, sequence) : undefined, [project, sequence]);
  const semanticLayers = useMemo(() => ({
    ...semanticElementLayers(elements),
    ...layerOverrides
  }), [elements, layerOverrides]);
  const horizontalLayout = layoutMode === "sequence" || layoutMode === "horizontal";
  const layoutLayers = useMemo(() => {
    if (layoutMode !== "sequence" || !sequence || !sequenceAnalysis) return semanticLayers;
    const functionType = sequence.domain === "product" ? "productFunction" : "processFunction";
    const functionLayers = elements
      .filter((element) => element.elementType === functionType)
      .map((element) => semanticLayers[element.id]?.layer ?? 0);
    const functionLayer = functionLayers.length > 0 ? Math.min(...functionLayers) : 0;
    const stageById = new Map(sequenceAnalysis.stages.flatMap((stage, index) => stage.map((id) => [id, index] as const)));
    const stageCount = Math.max(1, sequenceAnalysis.stages.length);
    return Object.fromEntries(elements.map((element) => {
      const semantic = semanticLayers[element.id];
      const stage = stageById.get(element.id);
      if (element.elementType === functionType) {
        return [element.id, stage === undefined
          ? { layer: functionLayer + stageCount, label: "Unsequenced functions" }
          : { layer: functionLayer + stage, label: `Stage ${stage + 1}` }];
      }
      return [element.id, semantic.layer > functionLayer
        ? { layer: semantic.layer + stageCount, label: semantic.label }
        : semantic];
    }));
  }, [elements, layoutMode, semanticLayers, sequence, sequenceAnalysis]);
  const primaryById = useMemo(() => new Map(allConnections.map((relationship) => {
    if (relationship.context) return [relationship.id, true];
    const inSequence = Boolean(sequence && relationship.sequenceId === sequence.id && relationship.relationshipType === "precedes");
    const isProcessItemFlow = Boolean(sequence?.domain === "process" && ["consumes", "produces"].includes(relationship.relationshipType));
    const exposesExternalContext = relationship.relationshipType === "connects" && [relationship.sourceId, relationship.targetId]
      .some((elementId) => elements.find((element) => element.id === elementId)?.elementType === "externalSystem");
    return [relationship.id, layoutMode === "sequence"
      ? inSequence || isProcessItemFlow
      : isPrimaryHierarchyRelationship(relationship) || exposesExternalContext];
  })), [allConnections, elements, layoutMode, sequence]);
  const nodeHeights = useMemo(() => Object.fromEntries(elements.map((element) => [element.id, modelNodeHeight(element, density, {
    stage: Boolean(sequenceAnalysis?.stageLabels[element.id]),
    status: Boolean(elementStatuses?.[element.id]),
    outsideScope: Boolean(scopedElementIds && !scopedElementIds.has(element.id)),
    unlinked: !allConnections.some((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id)
  })])), [allConnections, density, elementStatuses, elements, scopedElementIds, sequenceAnalysis]);
  const layoutRequest = useMemo<LayeredLayoutRequest>(() => ({
    direction: horizontalLayout ? "RIGHT" : "DOWN",
    nodeGap: horizontalLayout ? 78 : 88,
    layerGap: horizontalLayout ? 185 : 175,
    bandPadding: 96,
    nodes: elements.map((element) => ({
      id: element.id,
      width: measurements[element.id]?.width ?? MODEL_NODE_WIDTH,
      height: measurements[element.id]?.height ?? nodeHeights[element.id],
      layer: layoutLayers[element.id]?.layer ?? 0,
      layerLabel: layoutLayers[element.id]?.label ?? elementTypeLabels[element.elementType],
      orderHint: element.name
    })),
    edges: allConnections
      .filter((relationship) => ids.has(relationship.sourceId) && ids.has(relationship.targetId))
      .map((relationship) => ({
        id: relationship.id,
        source: relationship.sourceId,
        target: relationship.targetId,
        primary: primaryById.get(relationship.id) ?? false
      }))
  }), [allConnections, elements, horizontalLayout, ids, layoutLayers, measurements, nodeHeights, primaryById]);
  const automaticLayout = useModelGraphV04Layout(layoutRequest, layoutRevision);

  useEffect(() => {
    if (layoutMode === "manual" || presentation !== "canvas") return;
    const frame = requestAnimationFrame(() => flowInstance.current?.fitView({ padding: 0.16, duration: 250 }));
    return () => cancelAnimationFrame(frame);
  }, [automaticLayout, layoutMode, presentation]);

  const connectedToSelection = useMemo(() => new Set(allConnections.flatMap((relationship) =>
    relationship.sourceId === graphSelectedElementId ? [relationship.targetId]
      : relationship.targetId === graphSelectedElementId ? [relationship.sourceId]
        : []
  )), [allConnections, graphSelectedElementId]);
  const visibleRelationships = useMemo(() => allConnections.filter((relationship) => {
    if (!ids.has(relationship.sourceId) || !ids.has(relationship.targetId)) return false;
    if (relationshipView === "all") return true;
    if (relationshipView === "selection" && graphSelectedElementId) {
      return relationship.sourceId === graphSelectedElementId || relationship.targetId === graphSelectedElementId;
    }
    return primaryById.get(relationship.id) ?? false;
  }), [allConnections, ids, primaryById, relationshipView, graphSelectedElementId]);
  // The workflow overview covers the whole active model, regardless of which
  // workspace projection supplied the Full graph below it.
  const overviewRelationships = useMemo(() => [
    ...project.relationships,
    ...contextConnections(project)
  ], [project]);
  const bandNodes: Node[] = layoutMode === "manual" ? [] : automaticLayout.bands.map((band, index) => ({
    id: `__${band.id}`,
    type: "group",
    position: { x: band.x, y: band.y },
    data: { label: <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{band.label}</div>, band: true },
    style: {
      width: band.width,
      height: band.height,
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      background: index % 2 ? "rgba(248,250,252,0.72)" : "rgba(241,245,249,0.52)",
      pointerEvents: "none",
      zIndex: -2
    },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false
  }));
  const modelNodes: Node[] = useMemo(() => elements.map((element, index) => {
    const focused = relationshipView !== "selection" || !graphSelectedElementId || graphSelectedElementId === element.id || connectedToSelection.has(element.id);
    return {
      id: element.id,
      type: "modelGraphNode",
      position: (layoutMode !== "manual" ? automaticLayout.positions[element.id] : undefined)
        ?? element.metadata.graphPositions?.[layoutKey]
        ?? element.metadata.graphPosition
        ?? automaticLayout.positions[element.id]
        ?? { x: (index % 4) * 250, y: Math.floor(index / 4) * 135 },
      data: {
        content: (
          <div className="overflow-hidden">
            <div className="text-xs opacity-70">{elementTypeLabels[element.elementType]}</div>
            <div className="flex items-center justify-between gap-2 font-semibold"><span className="truncate">{element.name}</span>{project.variationPoints.some((variationPoint) => variationPoint.constrainedElementIds.includes(element.id)) && <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-800">Var</span>}</div>
            {sequenceAnalysis?.stageLabels[element.id] && <div className="mt-1 inline-flex rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">Stage {sequenceAnalysis.stageLabels[element.id]}</div>}
            {density === "detailed" && element.parameters.length > 0 && <div className="mt-2 border-t border-slate-200 pt-1 text-left text-[10px] opacity-75"><div className="font-semibold uppercase tracking-wide">Parameters</div>{element.parameters.map((parameter) => <div className="nodrag truncate rounded pl-2 hover:bg-white/70" key={parameter.id} onDoubleClick={(event) => {
              event.stopPropagation();
              onElementAttributeDoubleClick?.(element.id, `parameter:${parameter.id}:value`, "primitiveProperty");
            }}>↳ {parameter.name}: {parameter.value ?? "—"}{parameter.unit ? ` ${parameter.unit}` : ""}</div>)}</div>}
            {density === "detailed" && element.metadata.duration !== undefined && <div className="nodrag mt-1 truncate rounded text-left text-[10px] opacity-75 hover:bg-white/70" onDoubleClick={(event) => {
              event.stopPropagation();
              onElementAttributeDoubleClick?.(element.id, "metadata:duration", "primitiveProperty");
            }}>Duration: {element.metadata.duration} {element.metadata.durationUnit ?? ""}</div>}
            {density === "detailed" && <div className="nodrag mt-1 truncate rounded text-left text-[10px] opacity-75 hover:bg-white/70" onDoubleClick={(event) => {
              event.stopPropagation();
              onElementAttributeDoubleClick?.(element.id, "tags", "primitiveTag");
            }}>Tags: {element.tags.join(", ") || "—"}</div>}
            {elementStatuses?.[element.id] && <div className="mt-1 text-[10px] font-bold uppercase">{elementStatuses[element.id]}</div>}
            {scopedElementIds && !scopedElementIds.has(element.id) && <div className="mt-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Outside working scope</div>}
            {!allConnections.some((relationship) => relationship.sourceId === element.id || relationship.targetId === element.id) && <div className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Unlinked</div>}
          </div>
        ),
        accessibleLabel: `${elementTypeLabels[element.elementType]}: ${element.name}`,
        width: MODEL_NODE_WIDTH,
        minimumHeight: nodeHeights[element.id],
        variant: "model",
        borderColor: graphSelectedElementId === element.id ? "#1d4ed8" : elementStatuses?.[element.id] === "excluded" ? "#dc2626" : elementStatuses?.[element.id] === "included" ? "#16a34a" : elementStatuses?.[element.id] === "modified" ? "#d97706" : elementTypeColors[element.elementType],
        background: elementStatuses?.[element.id] === "excluded" ? "#fef2f2" : elementStatuses?.[element.id] === "included" ? "#f0fdf4" : elementStatuses?.[element.id] === "modified" ? "#fffbeb" : "white",
        opacity: focused ? scopedElementIds && !scopedElementIds.has(element.id) ? 0.72 : 1 : 0.24,
        onMeasure: reportMeasurement,
        elementType: element.elementType
      } satisfies MeasuredGraphNodeData
    };
  }), [allConnections, automaticLayout.positions, connectedToSelection, density, elementStatuses, elements, layoutKey, layoutMode, nodeHeights, onElementAttributeDoubleClick, project.variationPoints, relationshipView, reportMeasurement, scopedElementIds, graphSelectedElementId, sequenceAnalysis]);
  const nodes: Node[] = [...bandNodes, ...modelNodes];
  const edges: Edge[] = useMemo(() => visibleRelationships.map((relationship) => {
      const storedRelationship = relationship.context ? undefined : relationship;
      const highlighted = relationship.id === selectedRelationshipId || relationship.id === temporaryRelationshipId;
      const variabilityStatus = relationshipStatuses?.[relationship.id];
      const inSequence = Boolean(storedRelationship && sequence && storedRelationship.sequenceId === sequence.id);
      const isProcessItemFlow = Boolean(
        storedRelationship
        &&
        sequence?.domain === "process"
        && (storedRelationship.relationshipType === "consumes" || storedRelationship.relationshipType === "produces")
      );
      const isContextual = relationship.context || inSequence || isProcessItemFlow;
      const primary = primaryById.get(relationship.id) ?? false;
      const flowQuantity = storedRelationship?.quantity ?? storedRelationship?.requiredQuantity;
      const label = relationship.context ? relationship.label : isProcessItemFlow
        ? [
            storedRelationship?.relationshipType,
            storedRelationship?.itemFlowName,
            flowQuantity !== undefined ? `${flowQuantity} ${storedRelationship?.unit ?? ""}`.trim() : undefined
          ].filter(Boolean).join(" · ")
        : storedRelationship?.itemFlowName
          ? `${storedRelationship.relationshipType} · ${storedRelationship.itemFlowName}`
          : storedRelationship?.containment ? "part of" : storedRelationship?.relationshipType ?? "context";
      const variationCount = storedRelationship ? project.variationPoints.filter((variationPoint) => variationPoint.constrainedRelationshipIds.includes(relationship.id)).length : 0;
      const contextualStroke = relationship.context ? "#0f766e" : storedRelationship?.relationshipType === "consumes"
        ? "#2563eb"
        : storedRelationship?.relationshipType === "produces"
          ? "#059669"
          : inSequence ? "#7c3aed" : primary ? "#64748b" : "#94a3b8";
      const stroke = highlighted ? "#dc2626" : variabilityStatus === "excluded" ? "#dc2626" : variabilityStatus === "included" ? "#16a34a" : variabilityStatus === "modified" ? "#d97706" : contextualStroke;
      const layerSource = layoutLayers[relationship.sourceId]?.layer ?? 0;
      const layerTarget = layoutLayers[relationship.targetId]?.layer ?? 0;
      const automatic = layoutMode !== "manual";
      const sourcePosition = horizontalLayout
        ? layerSource <= layerTarget ? Position.Right : Position.Left
        : layerSource <= layerTarget ? Position.Bottom : Position.Top;
      const targetPosition = horizontalLayout
        ? layerSource <= layerTarget ? Position.Left : Position.Right
        : layerSource <= layerTarget ? Position.Top : Position.Bottom;
      return {
        id: relationship.id,
        source: relationship.sourceId,
        target: relationship.targetId,
        sourcePosition,
        targetPosition,
        sourceHandle: graphPortId("source", sourcePosition),
        targetHandle: graphPortId("target", targetPosition),
        label: automatic ? undefined : variationCount ? `Var(${variationCount}) · ${label}` : label,
        type: automatic ? "routed" : "smoothstep",
        data: automatic ? {
          points: automaticLayout.routes[relationship.id],
          label: variationCount ? `Var(${variationCount}) · ${label}` : label,
          primary
        } satisfies ModelGraphV04EdgeData : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
        animated: highlighted,
        style: {
          stroke,
          strokeWidth: highlighted ? 3 : isContextual ? 2.5 : primary ? 1.7 : 1.25,
          opacity: primary || isContextual ? 0.92 : 0.55,
          strokeDasharray: relationship.context ? "7 4" : undefined
        },
        labelStyle: { fontSize: 10, fill: highlighted ? "#b91c1c" : "#475569", fontWeight: highlighted ? 700 : 400 }
      };
    }), [automaticLayout.routes, horizontalLayout, layoutLayers, layoutMode, primaryById, project.variationPoints, relationshipStatuses, selectedRelationshipId, sequence, temporaryRelationshipId, visibleRelationships]);

  const createConnection = (connection: Connection, relationshipType: RelationshipType) => {
    if (!connection.source || !connection.target) return;
    const source = project.elements.find((element) => element.id === connection.source);
    const target = project.elements.find((element) => element.id === connection.target);
    const architectureId = source?.architectureScope === "specific"
      ? source.architectureId
      : target?.architectureScope === "specific"
        ? target.architectureId
        : undefined;
    const now = new Date().toISOString();
    const error = addRelationship({
      id: `relationship-${crypto.randomUUID()}`,
      sourceId: connection.source,
      targetId: connection.target,
      relationshipType,
      sequenceId: relationshipType === "precedes" ? sequence?.id : undefined,
      architectureId,
      createdAt: now,
      updatedAt: now
    });
    if (error) void alertUser(error);
    setPendingConnection(null);
  };

  const onConnect = (connection: Connection) => {
    if (readOnly) return;
    const source = project.elements.find((element) => element.id === connection.source);
    const target = project.elements.find((element) => element.id === connection.target);
    if (!source || !target) return;
    if (sequence) {
      const expected = sequence.domain === "product" ? "productFunction" : "processFunction";
      if (source.elementType !== expected || target.elementType !== expected) {
        void alertUser(`Sequence links must connect two ${elementTypeLabels[expected]} elements.`);
        return;
      }
      createConnection(connection, "precedes");
      return;
    }
    const types = compatibleRelationshipTypes(source.elementType, target.elementType).filter((type) => type !== "precedes");
    if (!types.length) {
      void alertUser(`${elementTypeLabels[source.elementType]} cannot be connected to ${elementTypeLabels[target.elementType]}.`);
    } else if (onConnectionRequest) {
      onConnectionRequest(connection, types);
    } else if (types.length === 1) {
      createConnection(connection, types[0]);
    } else {
      setPendingConnection({ connection, types });
    }
  };

  if (!elements.length) return <div className={`grid ${heightClass} place-items-center text-slate-500`}>No elements match the current filters.</div>;
  const selectedRelationship = project.relationships.find((relationship) => relationship.id === selectedRelationshipId);
  return (
    <div aria-label="Model navigation graph">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
        {overviewEnabled && <label className="w-40"><span className="label">Presentation</span><select aria-label="Graph presentation" className="field" value={presentation} onChange={(event) => { const next = event.target.value as GraphPresentation; if (next === "overview" && relationshipView === "selection") setRelationshipView("structure"); setPresentation(next); }}><option value="overview">Workflow overview</option><option value="canvas">Full graph</option></select></label>}
        {presentation === "canvas" && <label className="w-40"><span className="label">Relationships</span><select aria-label="Graph relationships" className="field" value={relationshipView} onChange={(event) => setRelationshipView(event.target.value as RelationshipView)}><option value="structure">Primary structure</option><option value="all">All relationships</option><option value="selection">Selected element</option></select></label>}
        {presentation === "canvas" && allowDetailed && <label className="w-32"><span className="label">Card detail</span><select aria-label="Graph card detail" className="field" value={density} onChange={(event) => setDensity(event.target.value as GraphDensity)}><option value="compact">Compact</option><option value="detailed">Detailed</option></select></label>}
        {presentation === "canvas" && <button className="btn" disabled={layoutMode === "manual"} onClick={() => setLayoutRevision((current) => current + 1)}><RefreshCw size={14} /> Auto-arrange</button>}
      </div>
      {presentation === "overview" && overviewEnabled ? <ModelWorkflowOverview elements={project.elements} connections={overviewRelationships} projectId={project.id} selectionKey={`${project.id}:${layoutKey}`} heightClass={heightClass} onElementDoubleClick={(id) => { selectElement(id); onElementDoubleClick?.(id); }} /> : <div className={`relative ${heightClass}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          edgeTypes={routedEdgeTypes}
          nodeTypes={modelNodeTypes}
          onInit={(instance) => {
            flowInstance.current = instance;
          }}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            if (!node.id.startsWith("__band:")) setGraphSelectedElementId(node.id);
          }}
          onNodeDoubleClick={(_, node) => {
            if (!node.id.startsWith("__band:")) {
              setGraphSelectedElementId(node.id);
              selectElement(node.id);
              onElementDoubleClick?.(node.id);
            }
          }}
          onNodeDragStop={(_, node) => {
            if (readOnly || layoutMode !== "manual") return;
            const element = project.elements.find((item) => item.id === node.id);
            if (!element) return;
            updateElement(element.id, {
              metadata: {
                ...element.metadata,
                graphPositions: {
                  ...element.metadata.graphPositions,
                  [layoutKey]: node.position
                }
              }
            });
          }}
          nodesDraggable={!readOnly && layoutMode === "manual"}
          onEdgeClick={(_, edge) => {
            clearTimeout(highlightTimer.current);
            setTemporaryRelationshipId(edge.id);
            highlightTimer.current = setTimeout(() => setTemporaryRelationshipId(null), 1800);
          }}
          onEdgeDoubleClick={(_, edge) => {
            clearTimeout(highlightTimer.current);
            setTemporaryRelationshipId(null);
            const contextRelationship = contextRelationships.find((relationship) => relationship.id === edge.id);
            if (contextRelationship) selectElement(contextRelationship.ownerId);
            else if (onRelationshipDoubleClick) onRelationshipDoubleClick(edge.id);
            else if (!readOnly) selectRelationship(edge.id);
          }}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.12}
          maxZoom={1.8}
        >
          <Background gap={24} size={1} color="#e2e8f0" />
          <MiniMap nodeColor={(node) => node.id.startsWith("__band:") ? "transparent" : elementTypeColors[(node.data as { elementType: keyof typeof elementTypeColors }).elementType] ?? "#94a3b8"} />
          <Controls />
        </ReactFlow>
        {!readOnly && pendingConnection && (
          <div className="absolute left-1/2 top-4 z-10 w-80 -translate-x-1/2 rounded-xl border border-blue-200 bg-white p-4 shadow-xl">
            <h3 className="font-bold">Choose relationship type</h3>
            <p className="mt-1 text-xs text-slate-500">The graph connection has more than one valid semantic.</p>
            <div className="mt-3 space-y-2">{pendingConnection.types.map((type) => <button className="btn w-full" key={type} onClick={() => createConnection(pendingConnection.connection, type)}>{type}</button>)}</div>
            <button className="btn mt-3 w-full" onClick={() => setPendingConnection(null)}>Cancel</button>
          </div>
        )}
        {!readOnly && selectedRelationship && <GraphRelationshipEditor relationship={selectedRelationship} onClose={() => selectRelationship(null)} />}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">
          {readOnly ? "Read-only realization · single-click highlights · double-click inspects" : <>{layoutMode === "manual" ? "Drag nodes to persist positions · " : "Automatic layout keeps connectors outside cards · "}drag between handles to create · double-click for variability</>}
        </div>
      </div>}
    </div>
  );
}

function GraphRelationshipEditor({ relationship, onClose }: { relationship: Relationship; onClose: () => void }) {
  const { confirm, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const updateRelationship = useAppStore((state) => state.updateRelationship);
  const deleteRelationship = useAppStore((state) => state.deleteRelationship);
  const [name, setName] = useState(relationship.name ?? "");
  const [itemFlowName, setItemFlowName] = useState(relationship.itemFlowName ?? "");
  const [quantity, setQuantity] = useState(String(relationship.quantity ?? relationship.requiredQuantity ?? ""));
  const [unit, setUnit] = useState(relationship.unit ?? "");
  const [description, setDescription] = useState(relationship.description ?? "");
  const source = project.elements.find((element) => element.id === relationship.sourceId);
  const target = project.elements.find((element) => element.id === relationship.targetId);
  const isFlow = ["consumes", "produces"].includes(relationship.relationshipType);
  const hasQuantity = isFlow || relationship.relationshipType === "requiresResource";
  return (
    <aside className="absolute right-3 top-3 z-10 w-96 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase text-slate-500">{relationship.relationshipType}</div>
          <h3 className="font-bold">Relationship details</h3>
        </div>
        <button className="btn p-2" aria-label="Close relationship details" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="mt-3 rounded bg-slate-50 p-2 text-xs"><strong>{source?.name ?? "Missing"}</strong> → <strong>{target?.name ?? "Missing"}</strong></div>
      <div className="mt-3 space-y-2">
        <label><span className="label">Name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
        {isFlow && <label><span className="label">Item flow</span><input className="field" value={itemFlowName} onChange={(event) => setItemFlowName(event.target.value)} /></label>}
        {hasQuantity && <div className="grid grid-cols-2 gap-2"><label><span className="label">Quantity</span><input className="field" type="number" min="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label><span className="label">Unit</span><input className="field" value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div>}
        <label><span className="label">Description</span><textarea className="field" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-primary flex-1" onClick={() => {
          const parsedQuantity = hasQuantity && quantity !== "" ? Number(quantity) : undefined;
          const error = updateRelationship(relationship.id, {
            name: name || undefined,
            itemFlowName: isFlow ? itemFlowName || undefined : undefined,
            quantity: parsedQuantity,
            requiredQuantity: relationship.relationshipType === "requiresResource" ? parsedQuantity : undefined,
            unit: hasQuantity ? unit || undefined : undefined,
            description: description || undefined
          });
          if (error) void alertUser(error);
        }}><Save size={14} /> Save</button>
        <button className="btn btn-danger" onClick={async () => {
          if (await confirm("Delete this relationship?", { confirmLabel: "Delete", tone: "danger" })) {
            deleteRelationship(relationship.id);
            onClose();
          }
        }}><Trash2 size={14} /> Delete</button>
      </div>
    </aside>
  );
}
