import { Background, Controls, MarkerType, MiniMap, Position, ReactFlow, type Connection, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { containmentNodeLayers, type LayeredLayoutRequest } from "../domain/graphLayouts";
import type { Configuration, Feature, FeatureGroup } from "../domain/types";
import { useLayeredLayout } from "../hooks/useLayeredLayout";
import { useNodeMeasurements } from "../hooks/useNodeMeasurements";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { FeatureGraphNode, graphPortId, type MeasuredGraphNodeData } from "./MeasuredGraphNodes";
import { RoutedEdge, type RoutedEdgeData } from "./RoutedEdge";
import { SideEditor } from "./SideEditor";
import { useDialogs } from "./dialogs/DialogProvider";

const featureEdgeTypes = { routed: RoutedEdge };
const featureNodeTypes = { featureGraphNode: FeatureGraphNode };

type FeatureGraphProps = {
  configuration?: Configuration;
  invalidFeatureIds?: Set<string>;
  onToggleFeature?: (feature: Feature, selected: boolean) => void;
  onSelectFeature?: (feature: Feature) => void;
  readOnly?: boolean;
};

const nearestFeatureContext = (group: FeatureGroup, groups: FeatureGroup[]): string | undefined => {
  const byId = new Map(groups.map((candidate) => [candidate.id, candidate]));
  let current: FeatureGroup | undefined = group;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentFeatureId) return current.parentFeatureId;
    current = current.parentGroupId ? byId.get(current.parentGroupId) : undefined;
  }
  return undefined;
};

export function FeatureGraph({ configuration, invalidFeatureIds, onToggleFeature, onSelectFeature, readOnly = false }: FeatureGraphProps) {
  const { alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const selectedFeatureId = useAppStore((state) => state.selectedFeatureId);
  const updateFeature = useAppStore((state) => state.updateFeature);
  const updateFeatureGroup = useAppStore((state) => state.updateFeatureGroup);
  const addConstraint = useAppStore((state) => state.addFeatureConstraint);
  const [pendingConnection, setPendingConnection] = useState<{ connection: Connection; type: "containment" | "requires" | "excludes" } | null>(null);
  const [connectionEditorOpen, setConnectionEditorOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"automatic" | "horizontal" | "manual">("automatic");
  const [showConstraints, setShowConstraints] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const { measurements, reportMeasurement } = useNodeMeasurements();
  const flowInstance = useRef<ReactFlowInstance>();
  const containmentModels = useMemo(() => [
    ...project.features.flatMap((feature) => {
      const source = feature.parentGroupId ? `group:${feature.parentGroupId}` : feature.parentId;
      return source ? [{ id: `contains:${source}:${feature.id}`, source, target: feature.id, label: "contains" }] : [];
    }),
    ...project.featureGroups.flatMap((group) => {
      const source = group.parentGroupId ? `group:${group.parentGroupId}` : group.parentFeatureId;
      return source ? [{ id: `contains:${source}:group:${group.id}`, source, target: `group:${group.id}`, label: "organizes" }] : [];
    })
  ], [project.featureGroups, project.features]);
  const layerDefinitions = useMemo(() => {
    const entries = [
      ...project.features.map((feature) => ({
        id: feature.id,
        parentId: feature.parentGroupId ? `group:${feature.parentGroupId}` : feature.parentId
      })),
      ...project.featureGroups.map((group) => ({
        id: `group:${group.id}`,
        parentId: group.parentGroupId ? `group:${group.parentGroupId}` : group.parentFeatureId
      }))
    ];
    const raw = containmentNodeLayers(entries);
    return Object.fromEntries(entries.map((entry) => [entry.id, {
      layer: raw[entry.id].layer,
      label: raw[entry.id].layer === 0 ? "Root feature" : `Feature level ${raw[entry.id].layer}`
    }]));
  }, [project.featureGroups, project.features]);
  const layoutRequest = useMemo<LayeredLayoutRequest>(() => ({
    direction: layoutMode === "horizontal" ? "RIGHT" : "DOWN",
    nodeGap: 92,
    layerGap: 190,
    bandPadding: 96,
    nodes: [
      ...project.features.map((feature) => ({
        id: feature.id,
        width: measurements[feature.id]?.width ?? 220,
        height: measurements[feature.id]?.height ?? (configuration ? 126 : 96),
        layer: layerDefinitions[feature.id]?.layer ?? 0,
        layerLabel: layerDefinitions[feature.id]?.label ?? "Features",
        orderHint: `${String(feature.sortOrder).padStart(5, "0")}:${feature.name}`
      })),
      ...project.featureGroups.map((group) => ({
        id: `group:${group.id}`,
        width: measurements[`group:${group.id}`]?.width ?? 220,
        height: measurements[`group:${group.id}`]?.height ?? 90,
        layer: layerDefinitions[`group:${group.id}`]?.layer ?? 0,
        layerLabel: layerDefinitions[`group:${group.id}`]?.label ?? "Feature groups",
        orderHint: group.name
      }))
    ],
    edges: [
      ...containmentModels.map((edge) => ({ ...edge, primary: true })),
      ...project.featureConstraints.map((constraint) => ({
        id: constraint.id,
        source: constraint.sourceFeatureId,
        target: constraint.targetFeatureId,
        primary: false
      }))
    ]
  }), [configuration, containmentModels, layerDefinitions, layoutMode, measurements, project.featureConstraints, project.featureGroups, project.features]);
  const automaticLayout = useLayeredLayout(layoutRequest, layoutRevision);

  useEffect(() => {
    if (layoutMode === "manual") return;
    const frame = requestAnimationFrame(() => flowInstance.current?.fitView({ padding: 0.16, duration: 250 }));
    return () => cancelAnimationFrame(frame);
  }, [automaticLayout, layoutMode]);

  const bandNodes: Node[] = layoutMode === "manual" ? [] : automaticLayout.bands.map((band, index) => ({
    id: `__feature-${band.id}`,
    type: "group",
    position: { x: band.x, y: band.y },
    data: { label: <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{band.label}</div> },
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
  const featureNodes: Node[] = useMemo(() => project.features.map((feature, index) => {
    const selected = configuration?.effectiveSelectedFeatureIds.includes(feature.id) ?? false;
    const manual = configuration?.manuallySelectedFeatureIds.includes(feature.id) ?? false;
    const invalid = invalidFeatureIds?.has(feature.id) ?? false;
    return {
      id: feature.id,
      type: "featureGraphNode",
      position: (layoutMode !== "manual" ? automaticLayout.positions[feature.id] : feature.graphPosition)
        ?? automaticLayout.positions[feature.id]
        ?? { x: (index % 4) * 260, y: Math.floor(index / 4) * 150 },
      data: {
        content: <div className="min-w-44 text-left">
          <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Feature · {feature.featureType}</div>
          <div className="font-semibold">{feature.name}</div>
          <div className="mt-1 text-[10px] text-slate-500">{feature.valueType === "enumeration" ? feature.allowedValues?.join(" / ") : "Boolean"} · {feature.variabilityScope ?? "external"}</div>
          {configuration && <label className="nodrag mt-2 flex items-center gap-1 rounded bg-white/80 px-2 py-1 text-[10px]" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              disabled={readOnly || feature.featureType === "root" || feature.featureType === "mandatory"}
              checked={selected}
              onChange={(event) => onToggleFeature?.(feature, event.target.checked)}
            />
            {manual ? "Manual" : selected ? "Automatic" : invalid ? "Invalid" : "Not selected"}
          </label>}
        </div>,
        accessibleLabel: `Feature: ${feature.name}`,
        width: 220,
        minimumHeight: configuration ? 126 : 96,
        variant: "feature",
        borderColor: selectedFeatureId === feature.id ? "#1d4ed8" : invalid ? "#dc2626" : selected ? "#2563eb" : "#93c5fd",
        background: invalid ? "#fef2f2" : selected ? "#eff6ff" : "white",
        onMeasure: reportMeasurement
      } satisfies MeasuredGraphNodeData
    };
  }), [automaticLayout.positions, configuration, invalidFeatureIds, layoutMode, onToggleFeature, project.features, readOnly, reportMeasurement, selectedFeatureId]);
  const groupNodes: Node[] = useMemo(() => project.featureGroups.map((group, index) => ({
    id: `group:${group.id}`,
    type: "featureGraphNode",
    position: (layoutMode !== "manual" ? automaticLayout.positions[`group:${group.id}`] : group.graphPosition)
      ?? automaticLayout.positions[`group:${group.id}`]
      ?? { x: (index % 3) * 300 + 80, y: 560 + Math.floor(index / 3) * 130 },
    data: {
      content: <div className="min-w-44 text-left">
        <div className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Organizational group</div>
        <div className="font-semibold">{group.name}</div>
        <div className="mt-1 text-[10px] text-slate-500">{project.features.some((feature) => feature.parentGroupId === group.id && feature.featureType === "xor") ? "Choose exactly one (XOR)" : project.features.some((feature) => feature.parentGroupId === group.id && feature.featureType === "or") ? "Choose one or more (OR)" : "Organizational grouping"}</div>
      </div>,
      accessibleLabel: `Feature group: ${group.name}`,
      width: 220,
      minimumHeight: 90,
      variant: "featureGroup",
      borderColor: "#8b5cf6",
      borderStyle: "dashed",
      background: "#faf5ff",
      onMeasure: reportMeasurement
    } satisfies MeasuredGraphNodeData
  })), [automaticLayout.positions, layoutMode, project.featureGroups, project.features, reportMeasurement]);
  const horizontal = layoutMode === "horizontal";
  const containmentEdges: Edge[] = containmentModels.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourcePosition: horizontal ? Position.Right : Position.Bottom,
    targetPosition: horizontal ? Position.Left : Position.Top,
    sourceHandle: graphPortId("source", horizontal ? Position.Right : Position.Bottom),
    targetHandle: graphPortId("target", horizontal ? Position.Left : Position.Top),
    label: layoutMode !== "manual" ? undefined : edge.label,
    type: layoutMode !== "manual" ? "routed" : "smoothstep",
    data: layoutMode !== "manual" ? { points: automaticLayout.routes[edge.id], label: edge.label, primary: true } satisfies RoutedEdgeData : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b", width: 14, height: 14 },
    style: { stroke: "#64748b", strokeWidth: 1.7, strokeDasharray: edge.label === "organizes" ? "5 4" : undefined },
    labelStyle: { fontSize: 9, fill: "#64748b" }
  }));
  const constraintEdges: Edge[] = showConstraints ? project.featureConstraints.map((constraint) => ({
    id: constraint.id,
    source: constraint.sourceFeatureId,
    target: constraint.targetFeatureId,
    sourcePosition: horizontal ? Position.Right : Position.Bottom,
    targetPosition: horizontal ? Position.Left : Position.Top,
    sourceHandle: graphPortId("source", horizontal ? Position.Right : Position.Bottom),
    targetHandle: graphPortId("target", horizontal ? Position.Left : Position.Top),
    label: layoutMode !== "manual" ? undefined : constraint.type,
    type: layoutMode !== "manual" ? "routed" : "smoothstep",
    data: layoutMode !== "manual" ? { points: automaticLayout.routes[constraint.id], label: constraint.type, primary: false } satisfies RoutedEdgeData : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: constraint.type === "requires" ? "#16a34a" : "#dc2626" },
    style: { stroke: constraint.type === "requires" ? "#16a34a" : "#dc2626", strokeWidth: 2.5 },
    labelStyle: { fontSize: 10, fontWeight: 700, fill: constraint.type === "requires" ? "#15803d" : "#b91c1c" }
  })) : [];
  const groupSubtree = (groupId: string) => {
    const ids = new Set([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      project.featureGroups.forEach((group) => {
        if (group.parentGroupId && ids.has(group.parentGroupId) && !ids.has(group.id)) {
          ids.add(group.id);
          changed = true;
        }
      });
    }
    return ids;
  };
  const synchronizeGroupFeatureContext = (groupId: string, parentFeatureId?: string) => {
    const groups = groupSubtree(groupId);
    project.features.filter((feature) => feature.parentGroupId && groups.has(feature.parentGroupId))
      .forEach((feature) => updateFeature(feature.id, { parentId: parentFeatureId }));
  };
  const applyConnection = (connection: Connection, type: "containment" | "requires" | "excludes") => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const sourceIsGroup = connection.source.startsWith("group:");
    const targetIsGroup = connection.target.startsWith("group:");
    if (!sourceIsGroup && !targetIsGroup) {
      if (type === "containment") {
        updateFeature(connection.target, { parentId: connection.source, parentGroupId: undefined });
      } else if (type === "requires" || type === "excludes") {
        const error = addConstraint({
          id: `constraint-${crypto.randomUUID()}`,
          type,
          sourceFeatureId: connection.source,
          targetFeatureId: connection.target
        });
        if (error) void alertUser(error);
      }
      return;
    }
    if (!sourceIsGroup && targetIsGroup) {
      updateFeatureGroup(connection.target.slice(6), { parentFeatureId: connection.source, parentGroupId: undefined });
      synchronizeGroupFeatureContext(connection.target.slice(6), connection.source);
      return;
    }
    if (sourceIsGroup && targetIsGroup) {
      updateFeatureGroup(connection.target.slice(6), { parentGroupId: connection.source.slice(6), parentFeatureId: undefined });
      const sourceGroup = project.featureGroups.find((candidate) => candidate.id === connection.source.slice(6));
      synchronizeGroupFeatureContext(connection.target.slice(6), sourceGroup ? nearestFeatureContext(sourceGroup, project.featureGroups) : undefined);
      return;
    }
    const group = project.featureGroups.find((candidate) => candidate.id === connection.source.slice(6));
    if (!group) return;
    updateFeature(connection.target, {
      parentGroupId: group.id,
      parentId: nearestFeatureContext(group, project.featureGroups)
    });
  };
  const onConnect = (connection: Connection) => {
    if (readOnly || !connection.source || !connection.target || connection.source === connection.target) return;
    const groupConnection = connection.source.startsWith("group:") || connection.target.startsWith("group:");
    setPendingConnection({ connection, type: groupConnection ? "containment" : "containment" });
    setConnectionEditorOpen(true);
  };
  const sourceLabel = pendingConnection?.connection.source?.startsWith("group:")
    ? project.featureGroups.find((group) => group.id === pendingConnection.connection.source?.slice(6))?.name
    : project.features.find((feature) => feature.id === pendingConnection?.connection.source)?.name;
  const targetLabel = pendingConnection?.connection.target?.startsWith("group:")
    ? project.featureGroups.find((group) => group.id === pendingConnection.connection.target?.slice(6))?.name
    : project.features.find((feature) => feature.id === pendingConnection?.connection.target)?.name;
  const featureToFeature = Boolean(pendingConnection?.connection.source && pendingConnection.connection.target && !pendingConnection.connection.source.startsWith("group:") && !pendingConnection.connection.target.startsWith("group:"));
  return <><div aria-label="Feature model graph">
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3"><div className="min-w-52 flex-1"><div className="text-xs font-bold text-slate-700">Feature hierarchy</div><p className="text-[11px] text-slate-500">Containment defines the tree; routed lanes separate cross-tree constraints from group branches.</p></div><label className="w-48"><span className="label">Layout</span><select aria-label="Feature graph layout" className="field" value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as typeof layoutMode)}><option value="automatic">Top-down hierarchy</option><option value="horizontal">Left-to-right hierarchy</option><option value="manual">Manual positions</option></select></label><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"><input type="checkbox" checked={showConstraints} onChange={(event) => setShowConstraints(event.target.checked)} />Display requires / excludes</label><button className="btn" disabled={layoutMode === "manual"} onClick={() => setLayoutRevision((current) => current + 1)}><RefreshCw size={14} /> Auto-arrange</button></div>
    <div className="h-[640px]">
    <ReactFlow
      nodes={[...bandNodes, ...featureNodes, ...groupNodes]}
      edges={[...containmentEdges, ...constraintEdges]}
      edgeTypes={featureEdgeTypes}
      nodeTypes={featureNodeTypes}
      onInit={(instance) => {
        flowInstance.current = instance;
      }}
      onConnect={onConnect}
      onNodeClick={(_, node) => {
        if (!node.id.startsWith("group:") && !node.id.startsWith("__feature-band:")) {
          const feature = project.features.find((candidate) => candidate.id === node.id);
          if (feature) onSelectFeature?.(feature);
        }
      }}
      onNodeDragStop={(_, node) => {
        if (readOnly || layoutMode !== "manual") return;
        if (node.id.startsWith("group:")) updateFeatureGroup(node.id.slice(6), { graphPosition: node.position });
        else updateFeature(node.id, { graphPosition: node.position });
      }}
      nodesDraggable={!readOnly && layoutMode === "manual"}
      fitView
      fitViewOptions={{ padding: 0.16 }}
      minZoom={0.12}
      maxZoom={1.8}
    >
      <Background gap={24} size={1} color="#e2e8f0" />
      <MiniMap nodeColor={(node) => node.id.startsWith("__feature-band:") ? "transparent" : node.id.startsWith("group:") ? "#8b5cf6" : "#3b82f6"} />
      <Controls />
    </ReactFlow>
    </div>
  </div>{connectionEditorOpen && pendingConnection && <SideEditor title="New feature-model relationship" eyebrow="Feature Model" onSave={() => {
    applyConnection(pendingConnection.connection, pendingConnection.type);
    setConnectionEditorOpen(false);
  }} onCancel={() => setConnectionEditorOpen(false)}>
    <div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{sourceLabel ?? "Unknown"}</strong> → <strong>{targetLabel ?? "Unknown"}</strong></div>
    {featureToFeature ? <label><span className="label">Relationship type</span><select className="field" value={pendingConnection.type} onChange={(event) => setPendingConnection({ ...pendingConnection, type: event.target.value as typeof pendingConnection.type })}><option value="containment">containment</option><option value="requires">requires</option><option value="excludes">excludes</option></select></label> : <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">This connection organizes the target under the selected feature or organizational group.</div>}
  </SideEditor>}</>;
}
