import { elementTypeLabels, type ElementType, type ModelElement, type Relationship, type RelationshipType } from "./types";

export type LayoutDirection = "DOWN" | "RIGHT";
export type LayoutSide = "top" | "right" | "bottom" | "left";

export interface LayeredLayoutNode {
  id: string;
  width: number;
  height: number;
  layer: number;
  layerLabel: string;
  orderHint?: string;
}

export interface LayeredLayoutEdge {
  id: string;
  source: string;
  target: string;
  primary: boolean;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutPort {
  id: string;
  nodeId: string;
  edgeId: string;
  role: "source" | "target";
  side: LayoutSide;
  offset: number;
  point: LayoutPoint;
}

export interface LayoutEdgePorts {
  source: LayoutPort;
  target: LayoutPort;
}

export interface LayoutBand {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayeredLayoutResult {
  positions: Record<string, LayoutPoint>;
  routes: Record<string, LayoutPoint[]>;
  edgePorts: Record<string, LayoutEdgePorts>;
  nodePorts: Record<string, LayoutPort[]>;
  bands: LayoutBand[];
  width: number;
  height: number;
}

export interface LayeredLayoutRequest {
  nodes: LayeredLayoutNode[];
  edges: LayeredLayoutEdge[];
  direction?: LayoutDirection;
  nodeGap?: number;
  layerGap?: number;
  bandPadding?: number;
}

const semanticTypeOrder: ElementType[] = [
  "mission", "system", "externalSystem", "stakeholder", "need", "objective", "useCase",
  "systemRequirement", "productFunction", "productComponent", "productInterface", "processFunction",
  "industrialSystemComponent", "processInterface", "resource", "verificationMethod"
];
const semanticTypeIndex = new Map(semanticTypeOrder.map((type, index) => [type, index]));

// Closely related kinds share a semantic region. ELK can arrange them in subrows while
// region order continues to express the engineering workflow.
const semanticRegions: Array<{ types: ElementType[]; label: string }> = [
  { types: ["mission"], label: "Mission" },
  { types: ["system", "externalSystem", "stakeholder"], label: "System context and stakeholders" },
  { types: ["need", "objective"], label: "Needs and objectives" },
  { types: ["useCase"], label: "Use cases" },
  { types: ["systemRequirement"], label: "System requirements" },
  { types: ["productFunction"], label: "Product functions" },
  { types: ["productComponent", "productInterface"], label: "Product architecture" },
  { types: ["processFunction"], label: "Industrial functions" },
  { types: ["industrialSystemComponent", "processInterface", "resource"], label: "Industrial architecture and resources" },
  { types: ["verificationMethod"], label: "Verification" }
];
const semanticRegionByType = new Map(semanticRegions.flatMap((region, layer) =>
  region.types.map((type) => [type, { layer, label: region.label }] as const)));

export const primaryHierarchyRelationshipTypes = new Set<RelationshipType>([
  "hasSOI", "hasStakeholder", "participatesInMission", "hasNeed", "hasObjective", "involvedIn",
  "hasFunction", "derives", "satisfiedBy", "realizedBy", "refines", "verifies", "allocatedTo", "requiresResource"
]);

export function isPrimaryHierarchyRelationship(relationship: Relationship) {
  return primaryHierarchyRelationshipTypes.has(relationship.relationshipType);
}

export function semanticElementLayers(elements: ModelElement[]) {
  const presentRegions = [...new Set(elements.map((element) =>
    semanticRegionByType.get(element.elementType)?.layer ?? semanticTypeIndex.get(element.elementType) ?? 0))]
    .sort((a, b) => a - b);
  const compact = new Map(presentRegions.map((region, index) => [region, index]));
  return Object.fromEntries(elements.map((element) => {
    const region = semanticRegionByType.get(element.elementType);
    const rawLayer = region?.layer ?? semanticTypeIndex.get(element.elementType) ?? 0;
    return [element.id, {
      layer: compact.get(rawLayer) ?? 0,
      label: region?.label ?? elementTypeLabels[element.elementType]
    }];
  }));
}

export function containmentNodeLayers(nodes: Array<{ id: string; parentId?: string; label?: string }>) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const memo = new Map<string, number>();
  const depth = (id: string, trail = new Set<string>()): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (trail.has(id)) return 0;
    const node = byId.get(id);
    if (!node?.parentId || !byId.has(node.parentId)) {
      memo.set(id, 0);
      return 0;
    }
    const value = depth(node.parentId, new Set(trail).add(id)) + 1;
    memo.set(id, value);
    return value;
  };
  return Object.fromEntries(nodes.map((node) => [node.id, {
    layer: depth(node.id),
    label: node.label ?? `Level ${depth(node.id) + 1}`
  }]));
}

const stableNodeOrder = (nodes: LayeredLayoutNode[]) => nodes.slice().sort((a, b) =>
  a.layer - b.layer || (a.orderHint ?? "").localeCompare(b.orderHint ?? "") || a.id.localeCompare(b.id));
const stableEdges = (edges: LayeredLayoutEdge[]) => edges.slice().sort((a, b) => a.id.localeCompare(b.id));
const portId = (role: "source" | "target", edgeId: string) => `${role}:${edgeId}`;

function edgeSides(
  edge: LayeredLayoutEdge,
  byId: Map<string, LayeredLayoutNode>,
  order: Map<string, number>,
  direction: LayoutDirection,
  positions?: Record<string, LayoutPoint>
) {
  const source = byId.get(edge.source)!;
  const target = byId.get(edge.target)!;
  if (positions?.[source.id] && positions[target.id]) {
    const sourceCenter = {
      x: positions[source.id].x + source.width / 2,
      y: positions[source.id].y + source.height / 2
    };
    const targetCenter = {
      x: positions[target.id].x + target.width / 2,
      y: positions[target.id].y + target.height / 2
    };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { source: dx >= 0 ? "right" : "left", target: dx >= 0 ? "left" : "right" } as const;
    }
    return { source: dy >= 0 ? "bottom" : "top", target: dy >= 0 ? "top" : "bottom" } as const;
  }
  if (source.layer !== target.layer) {
    const forward = source.layer < target.layer;
    return direction === "DOWN"
      ? { source: forward ? "bottom" : "top", target: forward ? "top" : "bottom" } as const
      : { source: forward ? "right" : "left", target: forward ? "left" : "right" } as const;
  }
  const forward = (order.get(source.id) ?? 0) <= (order.get(target.id) ?? 0);
  return direction === "DOWN"
    ? { source: forward ? "right" : "left", target: forward ? "left" : "right" } as const
    : { source: forward ? "bottom" : "top", target: forward ? "top" : "bottom" } as const;
}

interface PlannedPort {
  id: string;
  nodeId: string;
  edgeId: string;
  role: "source" | "target";
  side: LayoutSide;
  order: number;
}

function planPorts(request: LayeredLayoutRequest, positions?: Record<string, LayoutPoint>) {
  const nodes = stableNodeOrder(request.nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const planned: PlannedPort[] = [];
  stableEdges(request.edges).forEach((edge) => {
    if (!byId.has(edge.source) || !byId.has(edge.target)) return;
    const sides = edgeSides(edge, byId, order, request.direction ?? "DOWN", positions);
    planned.push({
      id: portId("source", edge.id), nodeId: edge.source, edgeId: edge.id,
      role: "source", side: sides.source, order: order.get(edge.target) ?? 0
    });
    planned.push({
      id: portId("target", edge.id), nodeId: edge.target, edgeId: edge.id,
      role: "target", side: sides.target, order: order.get(edge.source) ?? 0
    });
  });
  return {
    byId,
    planned: planned.sort((a, b) =>
      a.nodeId.localeCompare(b.nodeId) || a.side.localeCompare(b.side) || a.order - b.order || a.edgeId.localeCompare(b.edgeId))
  };
}

function materializePorts(
  request: LayeredLayoutRequest,
  positions: Record<string, LayoutPoint>,
  elkPorts?: Map<string, { x: number; y: number }>,
  geometricSides = false
) {
  const { byId, planned } = planPorts(request, geometricSides ? positions : undefined);
  const grouped = new Map<string, PlannedPort[]>();
  planned.forEach((port) => {
    const key = `${port.nodeId}:${port.side}`;
    grouped.set(key, [...(grouped.get(key) ?? []), port]);
  });
  const nodePorts: Record<string, LayoutPort[]> = Object.fromEntries(request.nodes.map((node) => [node.id, []]));
  const edgePorts: Record<string, Partial<LayoutEdgePorts>> = {};
  grouped.forEach((ports) => ports.forEach((plannedPort, index) => {
    const node = byId.get(plannedPort.nodeId)!;
    const position = positions[node.id] ?? { x: 0, y: 0 };
    const elk = elkPorts?.get(plannedPort.id);
    const length = plannedPort.side === "top" || plannedPort.side === "bottom" ? node.width : node.height;
    const offset = elk
      ? plannedPort.side === "top" || plannedPort.side === "bottom" ? elk.x + 0.5 : elk.y + 0.5
      : ((index + 1) / (ports.length + 1)) * length;
    const point = plannedPort.side === "top" ? { x: position.x + offset, y: position.y }
      : plannedPort.side === "bottom" ? { x: position.x + offset, y: position.y + node.height }
        : plannedPort.side === "left" ? { x: position.x, y: position.y + offset }
          : { x: position.x + node.width, y: position.y + offset };
    const port: LayoutPort = { ...plannedPort, offset, point };
    nodePorts[node.id].push(port);
    edgePorts[plannedPort.edgeId] = { ...(edgePorts[plannedPort.edgeId] ?? {}), [plannedPort.role]: port };
  }));
  return { nodePorts, edgePorts: edgePorts as Record<string, LayoutEdgePorts> };
}

const uniquePoints = (points: LayoutPoint[]) => points.filter((point, index) => {
  const previous = points[index - 1];
  return !previous || previous.x !== point.x || previous.y !== point.y;
});
type Segment = { a: LayoutPoint; b: LayoutPoint; edgeId: string };
const routeSegments = (points: LayoutPoint[], edgeId: string) =>
  points.slice(1).map((point, index) => ({ a: points[index], b: point, edgeId }));
const intervalOverlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
const collinearOverlap = (one: Segment, two: Segment) => {
  if (one.a.x === one.b.x && two.a.x === two.b.x && one.a.x === two.a.x) {
    return intervalOverlap(one.a.y, one.b.y, two.a.y, two.b.y) > 3;
  }
  if (one.a.y === one.b.y && two.a.y === two.b.y && one.a.y === two.a.y) {
    return intervalOverlap(one.a.x, one.b.x, two.a.x, two.b.x) > 3;
  }
  return false;
};
const segmentHitsRect = (
  segment: Segment,
  x: number,
  y: number,
  width: number,
  height: number,
  margin = 8
) => {
  const left = x - margin;
  const right = x + width + margin;
  const top = y - margin;
  const bottom = y + height + margin;
  if (segment.a.x === segment.b.x) {
    return segment.a.x > left && segment.a.x < right && intervalOverlap(segment.a.y, segment.b.y, top, bottom) > 0;
  }
  return segment.a.y > top && segment.a.y < bottom && intervalOverlap(segment.a.x, segment.b.x, left, right) > 0;
};

function routeAtPositions(
  request: LayeredLayoutRequest,
  positions: Record<string, LayoutPoint>,
  ports: Record<string, LayoutEdgePorts>
) {
  const byId = new Map(request.nodes.map((node) => [node.id, node]));
  const used: Segment[] = [];
  const bounds = request.nodes.reduce((acc, node) => {
    const position = positions[node.id] ?? { x: 0, y: 0 };
    return {
      minX: Math.min(acc.minX, position.x),
      minY: Math.min(acc.minY, position.y),
      maxX: Math.max(acc.maxX, position.x + node.width),
      maxY: Math.max(acc.maxY, position.y + node.height)
    };
  }, { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  let outerLane = 0;
  const routes: Record<string, LayoutPoint[]> = {};
  const clear = (edge: LayeredLayoutEdge, points: LayoutPoint[]) => {
    const segments = routeSegments(points, edge.id);
    const hitsNode = segments.some((segment) => request.nodes.some((node) =>
      node.id !== edge.source && node.id !== edge.target &&
      segmentHitsRect(segment, positions[node.id].x, positions[node.id].y, node.width, node.height)));
    return !hitsNode && !segments.some((segment) => used.some((other) => collinearOverlap(segment, other)));
  };

  stableEdges(request.edges).forEach((edge) => {
    const edgePort = ports[edge.id];
    if (!edgePort || !byId.has(edge.source) || !byId.has(edge.target)) return;
    const start = edgePort.source.point;
    const end = edgePort.target.point;
    const vertical = ["top", "bottom"].includes(edgePort.source.side) && ["top", "bottom"].includes(edgePort.target.side);
    const candidates: LayoutPoint[][] = [];
    if (vertical) {
      const middle = (start.y + end.y) / 2;
      [0, 18, -18, 36, -36, 54, -54].forEach((shift) =>
        candidates.push(uniquePoints([start, { x: start.x, y: middle + shift }, { x: end.x, y: middle + shift }, end])));
      const clearance = start.y <= end.y ? 28 : -28;
      const laneBase = (start.x + end.x) / 2;
      [0, 32, -32, 64, -64, 96, -96].forEach((shift) => candidates.push(uniquePoints([
        start,
        { x: start.x, y: start.y + clearance },
        { x: laneBase + shift, y: start.y + clearance },
        { x: laneBase + shift, y: end.y - clearance },
        { x: end.x, y: end.y - clearance },
        end
      ])));
    } else {
      const middle = (start.x + end.x) / 2;
      [0, 18, -18, 36, -36, 54, -54].forEach((shift) =>
        candidates.push(uniquePoints([start, { x: middle + shift, y: start.y }, { x: middle + shift, y: end.y }, end])));
      const clearance = start.x <= end.x ? 28 : -28;
      const laneBase = (start.y + end.y) / 2;
      [0, 32, -32, 64, -64, 96, -96].forEach((shift) => candidates.push(uniquePoints([
        start,
        { x: start.x + clearance, y: start.y },
        { x: start.x + clearance, y: laneBase + shift },
        { x: end.x - clearance, y: laneBase + shift },
        { x: end.x - clearance, y: end.y },
        end
      ])));
    }
    let route = candidates.find((candidate) => clear(edge, candidate));
    if (!route) {
      const lane = 44 + outerLane++ * 18;
      route = vertical
        ? uniquePoints([
            start,
            { x: start.x, y: start.y + (start.y <= end.y ? 24 : -24) },
            { x: bounds.minX - lane, y: start.y + (start.y <= end.y ? 24 : -24) },
            { x: bounds.minX - lane, y: end.y + (start.y <= end.y ? -24 : 24) },
            { x: end.x, y: end.y + (start.y <= end.y ? -24 : 24) },
            end
          ])
        : uniquePoints([
            start,
            { x: start.x + (start.x <= end.x ? 24 : -24), y: start.y },
            { x: start.x + (start.x <= end.x ? 24 : -24), y: bounds.minY - lane },
            { x: end.x + (start.x <= end.x ? -24 : 24), y: bounds.minY - lane },
            { x: end.x + (start.x <= end.x ? -24 : 24), y: end.y },
            end
          ]);
    }
    routes[edge.id] = route;
    used.push(...routeSegments(route, edge.id));
  });
  return routes;
}

function bandsFor(
  request: LayeredLayoutRequest,
  positions: Record<string, LayoutPoint>,
  routes: Record<string, LayoutPoint[]>
) {
  const padding = request.bandPadding ?? 72;
  const layers = [...new Set(request.nodes.map((node) => node.layer))].sort((a, b) => a - b);
  const routePoints = Object.values(routes).flat();
  const nodeMaxX = Math.max(0, ...request.nodes.map((node) => (positions[node.id]?.x ?? 0) + node.width));
  const nodeMaxY = Math.max(0, ...request.nodes.map((node) => (positions[node.id]?.y ?? 0) + node.height));
  const minX = Math.min(-padding, ...routePoints.map((point) => point.x));
  const maxX = Math.max(nodeMaxX + padding, ...routePoints.map((point) => point.x));
  const minY = Math.min(-padding, ...routePoints.map((point) => point.y));
  const maxY = Math.max(nodeMaxY + padding, ...routePoints.map((point) => point.y));
  const bands = layers.map((layer) => {
    const nodes = request.nodes.filter((node) => node.layer === layer);
    const left = Math.min(...nodes.map((node) => positions[node.id].x));
    const top = Math.min(...nodes.map((node) => positions[node.id].y));
    const right = Math.max(...nodes.map((node) => positions[node.id].x + node.width));
    const bottom = Math.max(...nodes.map((node) => positions[node.id].y + node.height));
    return request.direction === "RIGHT"
      ? {
          id: `band:${layer}`, label: nodes[0]?.layerLabel ?? `Level ${layer + 1}`,
          x: left - padding / 2, y: minY - 16, width: right - left + padding, height: maxY - minY + 32
        }
      : {
          id: `band:${layer}`, label: nodes[0]?.layerLabel ?? `Level ${layer + 1}`,
          x: minX - 16, y: top - padding / 2, width: maxX - minX + 32, height: bottom - top + padding
        };
  });
  return { bands, width: nodeMaxX, height: nodeMaxY };
}

function barycentricOrder(request: LayeredLayoutRequest) {
  const order = new Map(stableNodeOrder(request.nodes).map((node, index) => [node.id, index]));
  const adjacency = new Map<string, string[]>();
  request.edges.forEach((edge) => {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  });
  for (let pass = 0; pass < 4; pass += 1) {
    [...new Set(request.nodes.map((node) => node.layer))]
      .sort((a, b) => pass % 2 ? b - a : a - b)
      .forEach((layer) => {
        request.nodes.filter((node) => node.layer === layer).sort((a, b) => {
          const score = (node: LayeredLayoutNode) => {
            const linked = adjacency.get(node.id) ?? [];
            return linked.length
              ? linked.reduce((sum, id) => sum + (order.get(id) ?? 0), 0) / linked.length
              : order.get(node.id) ?? 0;
          };
          return score(a) - score(b) ||
            (a.orderHint ?? "").localeCompare(b.orderHint ?? "") ||
            a.id.localeCompare(b.id);
        }).forEach((node, index) => order.set(node.id, index));
      });
  }
  return order;
}

export function fallbackLayeredLayout(request: LayeredLayoutRequest): LayeredLayoutResult {
  const direction = request.direction ?? "DOWN";
  const nodeGap = request.nodeGap ?? 72;
  const layerGap = request.layerGap ?? 150;
  const order = barycentricOrder(request);
  const layers = [...new Set(request.nodes.map((node) => node.layer))].sort((a, b) => a - b);
  const grouped = new Map(layers.map((layer) => [layer, request.nodes.filter((node) => node.layer === layer)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) ||
      (a.orderHint ?? "").localeCompare(b.orderHint ?? "") || a.id.localeCompare(b.id))]));
  const primarySizes = new Map(layers.map((layer) => {
    const nodes = grouped.get(layer) ?? [];
    return [layer, nodes.reduce((sum, node) => sum + (direction === "DOWN" ? node.width : node.height), 0) +
      Math.max(0, nodes.length - 1) * nodeGap];
  }));
  const maximum = Math.max(0, ...primarySizes.values());
  const positions: Record<string, LayoutPoint> = {};
  let layerCursor = 0;
  layers.forEach((layer) => {
    const nodes = grouped.get(layer) ?? [];
    let cursor = (maximum - (primarySizes.get(layer) ?? 0)) / 2;
    nodes.forEach((node) => {
      positions[node.id] = direction === "DOWN" ? { x: cursor, y: layerCursor } : { x: layerCursor, y: cursor };
      cursor += (direction === "DOWN" ? node.width : node.height) + nodeGap;
    });
    layerCursor += Math.max(0, ...nodes.map((node) => direction === "DOWN" ? node.height : node.width)) + layerGap;
  });
  const { nodePorts, edgePorts } = materializePorts(request, positions);
  const routes = routeAtPositions(request, positions, edgePorts);
  return {
    positions, routes, edgePorts, nodePorts,
    ...bandsFor({ ...request, direction }, positions, routes)
  };
}

export function routeManualLayout(
  request: LayeredLayoutRequest,
  positions: Record<string, LayoutPoint>
): LayeredLayoutResult {
  const completed = Object.fromEntries(request.nodes.map((node) => [node.id, positions[node.id] ?? { x: 0, y: 0 }]));
  const { nodePorts, edgePorts } = materializePorts(request, completed, undefined, true);
  const routes = routeAtPositions(request, completed, edgePorts);
  return { positions: completed, routes, edgePorts, nodePorts, ...bandsFor(request, completed, routes) };
}

export async function calculateLayeredLayout(request: LayeredLayoutRequest): Promise<LayeredLayoutResult> {
  if (!request.nodes.length) return fallbackLayeredLayout(request);
  const direction = request.direction ?? "DOWN";
  const sortedNodes = stableNodeOrder(request.nodes);
  const validIds = new Set(sortedNodes.map((node) => node.id));
  const sortedEdges = stableEdges(request.edges).filter((edge) => validIds.has(edge.source) && validIds.has(edge.target));
  const normalized: LayeredLayoutRequest = { ...request, direction, nodes: sortedNodes, edges: sortedEdges };
  const { planned } = planPorts(normalized);
  const byNode = new Map<string, PlannedPort[]>();
  planned.forEach((port) => byNode.set(port.nodeId, [...(byNode.get(port.nodeId) ?? []), port]));

  try {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const elk = new ELK();
    const result = await elk.layout({
      id: "semantic-layout",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": direction,
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.partitioning.activate": "true",
        "elk.spacing.nodeNode": String(request.nodeGap ?? 72),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(request.layerGap ?? 150),
        "elk.layered.spacing.edgeNodeBetweenLayers": "34",
        "elk.layered.spacing.edgeEdgeBetweenLayers": "18",
        "elk.spacing.edgeEdge": "14",
        "elk.spacing.edgeNode": "24",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
        "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
        "elk.layered.mergeEdges": "false",
        "elk.separateConnectedComponents": "false"
      },
      children: sortedNodes.map((node) => ({
        id: node.id,
        width: node.width,
        height: node.height,
        layoutOptions: {
          "elk.partitioning.partition": String(node.layer),
          "org.eclipse.elk.portConstraints": "FIXED_SIDE"
        },
        ports: (byNode.get(node.id) ?? []).map((port) => ({
          id: port.id,
          width: 1,
          height: 1,
          layoutOptions: {
            "org.eclipse.elk.port.side": {
              top: "NORTH",
              right: "EAST",
              bottom: "SOUTH",
              left: "WEST"
            }[port.side]
          }
        }))
      })),
      edges: sortedEdges.map((edge) => ({
        id: edge.id,
        sources: [portId("source", edge.id)],
        targets: [portId("target", edge.id)],
        layoutOptions: { "elk.layered.priority.direction": edge.primary ? "10" : "1" }
      }))
    });
    const layoutResult = result as unknown as {
      children?: Array<{ id: string; x?: number; y?: number; ports?: Array<{ id: string; x?: number; y?: number }> }>;
      edges?: Array<{ id: string; sections?: Array<{ startPoint?: LayoutPoint; endPoint?: LayoutPoint; bendPoints?: LayoutPoint[] }> }>;
    };
    const positions = Object.fromEntries((layoutResult.children ?? []).map((node) =>
      [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
    if (Object.keys(positions).length !== sortedNodes.length) throw new Error("ELK omitted a node");
    const elkPorts = new Map<string, { x: number; y: number }>();
    (layoutResult.children ?? []).forEach((node) => (node.ports ?? []).forEach((port) =>
      elkPorts.set(port.id, { x: port.x ?? 0, y: port.y ?? 0 })));
    const { nodePorts, edgePorts } = materializePorts(normalized, positions, elkPorts);
    const routes: Record<string, LayoutPoint[]> = Object.fromEntries((layoutResult.edges ?? []).flatMap((edge) => {
      const section = edge.sections?.[0];
      if (!section?.startPoint || !section?.endPoint) return [];
      return [[edge.id, uniquePoints([section.startPoint, ...(section.bendPoints ?? []), section.endPoint])]];
    }));
    sortedEdges.forEach((edge) => {
      if (!routes[edge.id]) {
        routes[edge.id] = routeAtPositions({ ...normalized, edges: [edge] }, positions, edgePorts)[edge.id];
      }
    });
    return {
      positions, routes, edgePorts, nodePorts,
      ...bandsFor(normalized, positions, routes)
    };
  } catch {
    return fallbackLayeredLayout(normalized);
  }
}

export function hierarchyNodePositions(elements: ModelElement[], relationships: Relationship[]) {
  const layers = semanticElementLayers(elements);
  return fallbackLayeredLayout({
    nodes: elements.map((element) => ({
      id: element.id,
      width: 225,
      height: 96,
      layer: layers[element.id].layer,
      layerLabel: layers[element.id].label,
      orderHint: element.name
    })),
    edges: relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
      primary: isPrimaryHierarchyRelationship(relationship)
    }))
  }).positions;
}
