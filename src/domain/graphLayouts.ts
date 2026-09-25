import { elementTypeLabels, type ElementType, type ModelElement, type Relationship, type RelationshipType } from "./types";

export type LayoutDirection = "DOWN" | "RIGHT";

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
  "mission",
  "system",
  "externalSystem",
  "stakeholder",
  "need",
  "objective",
  "useCase",
  "systemRequirement",
  "productFunction",
  "productComponent",
  "productInterface",
  "processFunction",
  "industrialSystemComponent",
  "processInterface",
  "resource",
  "verificationMethod"
];

const semanticTypeIndex = new Map(semanticTypeOrder.map((type, index) => [type, index]));

export const primaryHierarchyRelationshipTypes = new Set<RelationshipType>([
  "hasSOI",
  "hasStakeholder",
  "participatesInMission",
  "hasNeed",
  "hasObjective",
  "involvedIn",
  "hasFunction",
  "derives",
  "satisfiedBy",
  "realizedBy",
  "refines",
  "verifies",
  "allocatedTo",
  "requiresResource"
]);

export function isPrimaryHierarchyRelationship(relationship: Relationship) {
  return primaryHierarchyRelationshipTypes.has(relationship.relationshipType);
}

export function semanticElementLayers(elements: ModelElement[]) {
  const presentTypes = [...new Set(elements.map((element) => element.elementType))]
    .sort((a, b) => (semanticTypeIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (semanticTypeIndex.get(b) ?? Number.MAX_SAFE_INTEGER));
  const compactIndex = new Map(presentTypes.map((type, index) => [type, index]));
  return Object.fromEntries(elements.map((element) => [element.id, {
    layer: compactIndex.get(element.elementType) ?? 0,
    label: elementTypeLabels[element.elementType]
  }]));
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
    const nextTrail = new Set(trail).add(id);
    const value = depth(node.parentId, nextTrail) + 1;
    memo.set(id, value);
    return value;
  };
  return Object.fromEntries(nodes.map((node) => [node.id, {
    layer: depth(node.id),
    label: node.label ?? `Level ${depth(node.id) + 1}`
  }]));
}

const center = (position: LayoutPoint, node: LayeredLayoutNode) => ({
  x: position.x + node.width / 2,
  y: position.y + node.height / 2
});

const uniquePoints = (points: LayoutPoint[]) => points.filter((point, index) => {
  const previous = points[index - 1];
  return !previous || previous.x !== point.x || previous.y !== point.y;
});

function routeEdges(
  nodes: LayeredLayoutNode[],
  edges: LayeredLayoutEdge[],
  positions: Record<string, LayoutPoint>,
  direction: LayoutDirection,
  width: number,
  height: number,
  bandPadding: number
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let leftLane = 0;
  let rightLane = 0;
  let topLane = 0;
  let bottomLane = 0;
  return Object.fromEntries(edges.flatMap((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const sourcePosition = positions[edge.source];
    const targetPosition = positions[edge.target];
    if (!source || !target || !sourcePosition || !targetPosition) return [];
    const sourceCenter = center(sourcePosition, source);
    const targetCenter = center(targetPosition, target);
    const sameLayer = source.layer === target.layer;
    const adjacent = Math.abs(source.layer - target.layer) === 1;

    if (direction === "DOWN") {
      if (sameLayer) {
        const sourceOnLeft = sourceCenter.x <= targetCenter.x;
        const start = { x: sourceOnLeft ? sourcePosition.x + source.width : sourcePosition.x, y: sourceCenter.y };
        const end = { x: sourceOnLeft ? targetPosition.x : targetPosition.x + target.width, y: targetCenter.y };
        const laneY = Math.max(sourcePosition.y + source.height, targetPosition.y + target.height) + 28 + bottomLane++ * 18;
        return [[edge.id, uniquePoints([start, { x: start.x, y: laneY }, { x: end.x, y: laneY }, end])]];
      }
      const forward = source.layer < target.layer;
      const start = { x: sourceCenter.x, y: forward ? sourcePosition.y + source.height : sourcePosition.y };
      const end = { x: targetCenter.x, y: forward ? targetPosition.y : targetPosition.y + target.height };
      if (edge.primary && adjacent) {
        const middleY = (start.y + end.y) / 2;
        return [[edge.id, uniquePoints([start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end])]];
      }
      const useLeft = sourceCenter.x + targetCenter.x < width;
      const laneX = useLeft
        ? -bandPadding - 22 - leftLane++ * 16
        : width + bandPadding + 22 + rightLane++ * 16;
      const exitY = start.y + (forward ? 28 : -28);
      const entryY = end.y + (forward ? -28 : 28);
      return [[edge.id, uniquePoints([
        start,
        { x: start.x, y: exitY },
        { x: laneX, y: exitY },
        { x: laneX, y: entryY },
        { x: end.x, y: entryY },
        end
      ])]];
    }

    if (sameLayer) {
      const sourceAbove = sourceCenter.y <= targetCenter.y;
      const start = { x: sourceCenter.x, y: sourceAbove ? sourcePosition.y + source.height : sourcePosition.y };
      const end = { x: targetCenter.x, y: sourceAbove ? targetPosition.y : targetPosition.y + target.height };
      const laneX = Math.max(sourcePosition.x + source.width, targetPosition.x + target.width) + 28 + rightLane++ * 18;
      return [[edge.id, uniquePoints([start, { x: laneX, y: start.y }, { x: laneX, y: end.y }, end])]];
    }
    const forward = source.layer < target.layer;
    const start = { x: forward ? sourcePosition.x + source.width : sourcePosition.x, y: sourceCenter.y };
    const end = { x: forward ? targetPosition.x : targetPosition.x + target.width, y: targetCenter.y };
    if (edge.primary && adjacent) {
      const middleX = (start.x + end.x) / 2;
      return [[edge.id, uniquePoints([start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end])]];
    }
    const useTop = sourceCenter.y + targetCenter.y < height;
    const laneY = useTop
      ? -bandPadding - 22 - topLane++ * 16
      : height + bandPadding + 22 + bottomLane++ * 16;
    const exitX = start.x + (forward ? 28 : -28);
    const entryX = end.x + (forward ? -28 : 28);
    return [[edge.id, uniquePoints([
      start,
      { x: exitX, y: start.y },
      { x: exitX, y: laneY },
      { x: entryX, y: laneY },
      { x: entryX, y: end.y },
      end
    ])]];
  }));
}

function arrangeByLayer(
  nodes: LayeredLayoutNode[],
  orderById: Map<string, number>,
  direction: LayoutDirection,
  nodeGap: number,
  layerGap: number,
  bandPadding: number,
  edges: LayeredLayoutEdge[]
): LayeredLayoutResult {
  const layers = [...new Set(nodes.map((node) => node.layer))].sort((a, b) => a - b);
  const grouped = new Map(layers.map((layer) => [layer, nodes
    .filter((node) => node.layer === layer)
    .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0) || (a.orderHint ?? a.id).localeCompare(b.orderHint ?? b.id))]));
  const layerPrimarySize = new Map(layers.map((layer) => {
    const row = grouped.get(layer) ?? [];
    const size = row.reduce((total, node) => total + (direction === "DOWN" ? node.width : node.height), 0)
      + Math.max(0, row.length - 1) * nodeGap;
    return [layer, size];
  }));
  const maxPrimarySize = Math.max(0, ...layerPrimarySize.values());
  const positions: Record<string, LayoutPoint> = {};
  const bands: LayoutBand[] = [];
  let layerCursor = 0;

  layers.forEach((layer) => {
    const row = grouped.get(layer) ?? [];
    const layerCrossSize = Math.max(0, ...row.map((node) => direction === "DOWN" ? node.height : node.width));
    let nodeCursor = (maxPrimarySize - (layerPrimarySize.get(layer) ?? 0)) / 2;
    row.forEach((node) => {
      positions[node.id] = direction === "DOWN"
        ? { x: nodeCursor, y: layerCursor }
        : { x: layerCursor, y: nodeCursor };
      nodeCursor += (direction === "DOWN" ? node.width : node.height) + nodeGap;
    });
    const label = row[0]?.layerLabel ?? `Level ${layer + 1}`;
    bands.push(direction === "DOWN"
      ? {
          id: `band:${layer}`,
          label,
          x: -bandPadding,
          y: layerCursor - bandPadding / 2,
          width: maxPrimarySize + bandPadding * 2,
          height: layerCrossSize + bandPadding
        }
      : {
          id: `band:${layer}`,
          label,
          x: layerCursor - bandPadding / 2,
          y: -bandPadding,
          width: layerCrossSize + bandPadding,
          height: maxPrimarySize + bandPadding * 2
        });
    layerCursor += layerCrossSize + layerGap;
  });

  const width = direction === "DOWN" ? maxPrimarySize : Math.max(0, layerCursor - layerGap);
  const height = direction === "DOWN" ? Math.max(0, layerCursor - layerGap) : maxPrimarySize;
  const routes = routeEdges(nodes, edges, positions, direction, width, height, bandPadding);
  const routePoints = Object.values(routes).flat();
  const minRouteX = Math.min(-bandPadding, ...routePoints.map((point) => point.x));
  const maxRouteX = Math.max(width + bandPadding, ...routePoints.map((point) => point.x));
  const minRouteY = Math.min(-bandPadding, ...routePoints.map((point) => point.y));
  const maxRouteY = Math.max(height + bandPadding, ...routePoints.map((point) => point.y));
  const expandedBands = bands.map((band) => direction === "DOWN"
    ? { ...band, x: minRouteX - 16, width: maxRouteX - minRouteX + 32 }
    : { ...band, y: minRouteY - 16, height: maxRouteY - minRouteY + 32 });
  return {
    positions,
    bands: expandedBands,
    width,
    height,
    routes
  };
}

export function fallbackLayeredLayout(request: LayeredLayoutRequest): LayeredLayoutResult {
  const direction = request.direction ?? "DOWN";
  const order = new Map(request.nodes
    .slice()
    .sort((a, b) => (a.orderHint ?? a.id).localeCompare(b.orderHint ?? b.id))
    .map((node, index) => [node.id, index]));
  return arrangeByLayer(
    request.nodes,
    order,
    direction,
    request.nodeGap ?? 72,
    request.layerGap ?? 150,
    request.bandPadding ?? 96,
    request.edges
  );
}

export async function calculateLayeredLayout(request: LayeredLayoutRequest): Promise<LayeredLayoutResult> {
  if (!request.nodes.length) return fallbackLayeredLayout(request);
  const direction = request.direction ?? "DOWN";
  const byId = new Map(request.nodes.map((node) => [node.id, node]));
  const layoutEdges = request.edges.flatMap((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!edge.primary || !source || !target || source.layer === target.layer) return [];
    return [source.layer < target.layer
      ? { id: edge.id, sources: [edge.source], targets: [edge.target] }
      : { id: edge.id, sources: [edge.target], targets: [edge.source] }];
  });

  try {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const elk = new ELK();
    const result = await elk.layout({
      id: "semantic-layout",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": direction,
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.nodeNode": String(request.nodeGap ?? 72),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(request.layerGap ?? 150),
        "elk.layered.spacing.edgeNodeBetweenLayers": "36",
        "elk.layered.spacing.edgeEdgeBetweenLayers": "24",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
        "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
        "elk.separateConnectedComponents": "false"
      },
      children: request.nodes.map((node) => ({ id: node.id, width: node.width, height: node.height })),
      edges: layoutEdges
    });
    const order = new Map((result.children ?? [])
      .slice()
      .sort((a, b) => direction === "DOWN" ? (a.x ?? 0) - (b.x ?? 0) : (a.y ?? 0) - (b.y ?? 0))
      .map((node, index) => [node.id, index]));
    return arrangeByLayer(
      request.nodes,
      order,
      direction,
      request.nodeGap ?? 72,
      request.layerGap ?? 150,
      request.bandPadding ?? 96,
      request.edges
    );
  } catch {
    return fallbackLayeredLayout(request);
  }
}

export function hierarchyNodePositions(elements: ModelElement[], relationships: Relationship[]) {
  const layers = semanticElementLayers(elements);
  const request: LayeredLayoutRequest = {
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
  };
  return fallbackLayeredLayout(request).positions;
}
