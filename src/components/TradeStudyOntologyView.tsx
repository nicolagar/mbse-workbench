import { SemanticParallelPanel } from "./SemanticWorkspace";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LayeredLayoutRequest } from "../domain/graphLayouts";
import { deriveTradeStudyOntology, type OntologyDomain, type OntologyNode } from "../domain/tradeStudyOntology";
import type { ComparisonStudy } from "../domain/types";
import { useLayeredLayout } from "../hooks/useLayeredLayout";
import { useNodeMeasurements } from "../hooks/useNodeMeasurements";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { graphPortId, graphPositionForSide, OntologyGraphNode, type MeasuredGraphNodeData } from "./MeasuredGraphNodes";
import { RoutedEdge, type RoutedEdgeData } from "./RoutedEdge";

const ontologyEdgeTypes = { routed: RoutedEdge };
const ontologyNodeTypes = { ontologyGraphNode: OntologyGraphNode };
const domainColors: Record<OntologyDomain, { background: string; border: string; minimap: string }> = {
  engineering: { background: "#eff6ff", border: "#60a5fa", minimap: "#3b82f6" },
  variability: { background: "#f5f3ff", border: "#a78bfa", minimap: "#8b5cf6" },
  evidence: { background: "#f0fdf4", border: "#4ade80", minimap: "#22c55e" },
  decision: { background: "#fffbeb", border: "#fbbf24", minimap: "#f59e0b" }
};

const ontologyKindOrder = [
  "Open decision",
  "Trade Study",
  "Objective",
  "Requirement",
  "Study criterion",
  "Feature",
  "Configuration",
  "100% architecture",
  "Simulation run",
  "KPI",
  "Decision",
  "Baseline"
];

const ontologyLayer = (node: OntologyNode) => {
  const index = ontologyKindOrder.findIndex((kind) => node.kind.startsWith(kind));
  return index < 0 ? ontologyKindOrder.length : index;
};

const secondaryRelationships = new Set(["measures", "explores"]);

function LegacyTradeStudyOntologyView({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [showSecondary, setShowSecondary] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const { measurements, reportMeasurement } = useNodeMeasurements();
  const flowInstance = useRef<ReactFlowInstance>();
  const ontology = useMemo(() => deriveTradeStudyOntology(project, study), [project, study]);
  const layerById = useMemo(() => {
    const presentLayers = [...new Set(ontology.nodes.map(ontologyLayer))].sort((a, b) => a - b);
    const compact = new Map(presentLayers.map((layer, index) => [layer, index]));
    return Object.fromEntries(ontology.nodes.map((node) => [node.id, {
      layer: compact.get(ontologyLayer(node)) ?? 0,
      label: node.kind.startsWith("Study criterion") ? "Study criteria" : node.kind
    }]));
  }, [ontology.nodes]);
  const primaryById = useMemo(() => new Map(ontology.edges.map((edge) => [edge.id, !secondaryRelationships.has(edge.relationship)])), [ontology.edges]);
  const request = useMemo<LayeredLayoutRequest>(() => ({
    direction: "DOWN",
    nodeGap: 76,
    layerGap: 165,
    bandPadding: 96,
    nodes: ontology.nodes.map((node) => ({
      id: node.id,
      width: measurements[node.id]?.width ?? 225,
      height: measurements[node.id]?.height ?? 78,
      layer: layerById[node.id]?.layer ?? 0,
      layerLabel: layerById[node.id]?.label ?? node.kind,
      orderHint: node.label
    })),
    edges: ontology.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      primary: primaryById.get(edge.id) ?? false
    }))
  }), [layerById, measurements, ontology.edges, ontology.nodes, primaryById]);
  const layout = useLayeredLayout(request, layoutRevision);

  useEffect(() => {
    const frame = requestAnimationFrame(() => flowInstance.current?.fitView({ padding: 0.16, duration: 250 }));
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  const connectedIds = useMemo(() => new Set(ontology.edges.flatMap((edge) =>
    edge.source === selectedNodeId ? [edge.target] : edge.target === selectedNodeId ? [edge.source] : []
  )), [ontology.edges, selectedNodeId]);
  const bandNodes: Node[] = layout.bands.map((band, index) => ({
    id: `__ontology-${band.id}`,
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
  const semanticNodes: Node[] = ontology.nodes.map((node) => {
    const colors = domainColors[node.domain];
    const focused = !selectedNodeId || selectedNodeId === node.id || connectedIds.has(node.id);
    return {
      id: node.id,
      type: "ontologyGraphNode",
      position: layout.positions[node.id] ?? { x: 0, y: 0 },
      data: {
        content: <div className="overflow-hidden text-left"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{node.kind}</div><div className="mt-1 truncate text-xs font-semibold">{node.label}</div></div>,
        accessibleLabel: `${node.kind}: ${node.label}`,
        width: 225,
        minimumHeight: 78,
        variant: "ontology",
        borderColor: selectedNodeId === node.id ? "#1d4ed8" : colors.border,
        background: colors.background,
        opacity: focused ? 1 : 0.24,
        onMeasure: reportMeasurement,
        domain: node.domain,
        ports: layout.nodePorts[node.id] ?? []
      } satisfies MeasuredGraphNodeData,
      draggable: false
    };
  });
  const edges = useMemo<Edge[]>(() => ontology.edges
    .filter((edge) => showSecondary || primaryById.get(edge.id))
    .map((edge) => {
      const primary = primaryById.get(edge.id) ?? false;
      const focused = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;
      const sourceLayer = layerById[edge.source]?.layer ?? 0;
      const targetLayer = layerById[edge.target]?.layer ?? 0;
      const stroke = primary ? "#64748b" : "#94a3b8";
      const sourcePosition = sourceLayer <= targetLayer ? Position.Bottom : Position.Top;
      const targetPosition = sourceLayer <= targetLayer ? Position.Top : Position.Bottom;
      const ports = layout.edgePorts[edge.id];
      const routedSourcePosition = ports ? graphPositionForSide(ports.source.side) : sourcePosition;
      const routedTargetPosition = ports ? graphPositionForSide(ports.target.side) : targetPosition;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourcePosition: routedSourcePosition,
        targetPosition: routedTargetPosition,
        sourceHandle: ports?.source.id ?? graphPortId("source", routedSourcePosition),
        targetHandle: ports?.target.id ?? graphPortId("target", routedTargetPosition),
        type: "routed",
        data: { points: layout.routes[edge.id], label: edge.relationship, primary } satisfies RoutedEdgeData,
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
        style: { stroke, strokeWidth: primary ? 1.8 : 1.25, opacity: focused ? primary ? 0.92 : 0.6 : 0.14 }
      };
    }), [layerById, layout.edgePorts, layout.routes, ontology.edges, primaryById, selectedNodeId, showSecondary]);
  const selected = ontology.nodes.find((node) => node.id === selectedNodeId);

  return <div className="space-y-4">
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-5">
        <div className="min-w-72 flex-1"><h2 className="text-xl font-bold">Ontology and digital thread</h2><p className="mt-1 text-sm text-slate-600">Top-down evidence chain derived from canonical typed references. Colors identify domains; vertical bands identify semantic levels.</p></div>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"><input type="checkbox" checked={showSecondary} onChange={(event) => setShowSecondary(event.target.checked)} />Secondary cross-links</label>
        <button className="btn" onClick={() => setLayoutRevision((current) => current + 1)}><RefreshCw size={14} /> Auto-arrange</button>
      </div>
      <div className="h-[720px] bg-slate-50">
        <ReactFlow
          nodes={[...bandNodes, ...semanticNodes]}
          edges={edges}
          edgeTypes={ontologyEdgeTypes}
          nodeTypes={ontologyNodeTypes}
          onInit={(instance) => {
            flowInstance.current = instance;
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => {
            if (!node.id.startsWith("__ontology-band:")) setSelectedNodeId((current) => current === node.id ? "" : node.id);
          }}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.12}
          maxZoom={1.5}
        >
          <Background gap={24} size={1} color="#e2e8f0" />
          <Controls />
          <MiniMap pannable zoomable nodeColor={(node) => node.id.startsWith("__ontology-band:") ? "transparent" : domainColors[(node.data as { domain: OntologyDomain }).domain]?.minimap ?? "#94a3b8"} />
        </ReactFlow>
      </div>
      {selected && <div className="m-4 rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-blue-700">{selected.domain} · {selected.kind}</div><h3 className="mt-1 font-bold text-blue-950">{selected.label}</h3><p className="mt-1 text-sm text-blue-900">{selected.detail || "No additional description."}</p><code className="mt-2 block text-xs text-blue-800">{selected.recordId}</code></div>}
    </section>
    <section className="card overflow-hidden">
      <div className="p-5"><h2 className="text-lg font-bold">Typed relationship table</h2><p className="mt-1 text-sm text-slate-600">This textual view is the accessible, exact counterpart of the graph.</p></div>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Source</th><th>Relationship</th><th>Target</th><th>Canonical basis</th></tr></thead><tbody>{ontology.edges.map((edge) => {
        const source = ontology.nodes.find((node) => node.id === edge.source);
        const target = ontology.nodes.find((node) => node.id === edge.target);
        return <tr key={edge.id}><td><strong>{source?.label}</strong><div className="text-xs text-slate-500">{source?.kind} · {source?.recordId}</div></td><td><span className="badge bg-slate-100 text-slate-700">{edge.relationship}</span></td><td><strong>{target?.label}</strong><div className="text-xs text-slate-500">{target?.kind} · {target?.recordId}</div></td><td className="text-xs text-slate-600">Typed immutable-ID reference</td></tr>;
      })}</tbody></table></div>
      {!ontology.edges.length && <p className="p-5 text-sm text-slate-500">Complete the framing and candidate references to populate the digital thread.</p>}
    </section>
  </div>;
}

export function TradeStudyOntologyView({ study }: { study: ComparisonStudy }) {
  return <SemanticParallelPanel flag="useSemanticTradeStudyView" label="Open semantic Trade Study preview" studyId={study.id}><LegacyTradeStudyOntologyView study={study} /></SemanticParallelPanel>;
}
