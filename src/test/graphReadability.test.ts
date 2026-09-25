import { beforeAll, describe, expect, it } from "vitest";
import {
  calculateLayeredLayout,
  containmentNodeLayers,
  routeManualLayout,
  type LayeredLayoutRequest,
  type LayeredLayoutResult,
  type LayoutPoint
} from "../domain/graphLayouts";
import {
  fallbackLayeredLayout as fallbackModelGraphV04Layout,
  type LayeredLayoutRequest as ModelGraphV04LayoutRequest
} from "../domain/modelGraphV04Layouts";

const denseRequest: LayeredLayoutRequest = {
  direction: "DOWN",
  nodeGap: 64,
  layerGap: 150,
  bandPadding: 72,
  nodes: [
    { id: "hub", width: 220, height: 90, layer: 0, layerLabel: "Root", orderHint: "Hub" },
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `middle-${index}`, width: 210, height: 92, layer: 1, layerLabel: "Middle", orderHint: `Middle ${index}`
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `leaf-${index}`, width: 210, height: 92, layer: 2, layerLabel: "Leaves", orderHint: `Leaf ${index}`
    }))
  ],
  edges: [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `hub-middle-${index}`, source: "hub", target: `middle-${index}`, primary: true
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `middle-leaf-${index}`, source: `middle-${index}`, target: `leaf-${5 - index}`, primary: true
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `hub-leaf-${index}`, source: "hub", target: `leaf-${index}`, primary: false
    })),
    { id: "cross-0", source: "middle-0", target: "middle-5", primary: false },
    { id: "cross-1", source: "middle-1", target: "middle-4", primary: false }
  ]
};

const intersects = (
  one: { position: LayoutPoint; width: number; height: number },
  two: { position: LayoutPoint; width: number; height: number }
) => one.position.x < two.position.x + two.width
  && one.position.x + one.width > two.position.x
  && one.position.y < two.position.y + two.height
  && one.position.y + one.height > two.position.y;

const intervalOverlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));

const segmentHitsNode = (
  start: LayoutPoint,
  end: LayoutPoint,
  position: LayoutPoint,
  width: number,
  height: number
) => start.x === end.x
  ? start.x > position.x && start.x < position.x + width
    && intervalOverlap(start.y, end.y, position.y, position.y + height) > 0
  : start.y > position.y && start.y < position.y + height
    && intervalOverlap(start.x, end.x, position.x, position.x + width) > 0;

describe("shared graph readability layout", () => {
  let dense: LayeredLayoutResult;

  beforeAll(async () => {
    dense = await calculateLayeredLayout(denseRequest);
  });

  it("is deterministic for identical geometry and is independent of input array order", async () => {
    const repeated = await calculateLayeredLayout(denseRequest);
    const shuffled = await calculateLayeredLayout({
      ...denseRequest,
      nodes: denseRequest.nodes.slice().reverse(),
      edges: denseRequest.edges.slice().reverse()
    });
    expect(repeated).toEqual(dense);
    expect(shuffled.positions).toEqual(dense.positions);
    expect(shuffled.routes).toEqual(dense.routes);
  });

  it("keeps every automatic node rectangle separate", () => {
    denseRequest.nodes.forEach((node, index) => {
      denseRequest.nodes.slice(index + 1).forEach((other) => {
        expect(intersects(
          { position: dense.positions[node.id], width: node.width, height: node.height },
          { position: dense.positions[other.id], width: other.width, height: other.height }
        ), `${node.id} overlaps ${other.id}`).toBe(false);
      });
    });
  });

  it("keeps routed relationship segments out of unrelated cards", () => {
    denseRequest.edges.forEach((edge) => {
      const route = dense.routes[edge.id];
      expect(route.length).toBeGreaterThanOrEqual(2);
      route.slice(1).forEach((point, index) => {
        const previous = route[index];
        denseRequest.nodes
          .filter((node) => node.id !== edge.source && node.id !== edge.target)
          .forEach((node) => {
            expect(segmentHitsNode(previous, point, dense.positions[node.id], node.width, node.height),
              `${edge.id} crosses ${node.id}`).toBe(false);
          });
      });
    });
  });

  it("allocates distinct stable slots to a high-degree node", () => {
    const hubPorts = dense.nodePorts.hub.filter((port) => port.role === "source");
    expect(hubPorts).toHaveLength(12);
    expect(new Set(hubPorts.map((port) => `${port.side}:${port.offset.toFixed(3)}`)).size).toBe(hubPorts.length);
    expect(new Set(hubPorts.map((port) => port.id)).size).toBe(hubPorts.length);
  });

  it("does not merge parallel departures into a coincident first segment", () => {
    const firstSegments = denseRequest.edges
      .filter((edge) => edge.source === "hub")
      .map((edge) => dense.routes[edge.id].slice(0, 2));
    const keys = firstSegments.map(([start, end]) => `${start.x},${start.y}:${end.x},${end.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps unrelated relationships out of coincident collinear channels", () => {
    const segments = denseRequest.edges.flatMap((edge) => dense.routes[edge.id].slice(1).map((point, index) => ({
      edgeId: edge.id,
      start: dense.routes[edge.id][index],
      end: point
    })));
    segments.forEach((segment, index) => segments.slice(index + 1).forEach((other) => {
      if (segment.edgeId === other.edgeId) return;
      const verticalOverlap = segment.start.x === segment.end.x
        && other.start.x === other.end.x
        && segment.start.x === other.start.x
        && intervalOverlap(segment.start.y, segment.end.y, other.start.y, other.end.y) > 3;
      const horizontalOverlap = segment.start.y === segment.end.y
        && other.start.y === other.end.y
        && segment.start.y === other.start.y
        && intervalOverlap(segment.start.x, segment.end.x, other.start.x, other.end.x) > 3;
      expect(verticalOverlap || horizontalOverlap,
        `${segment.edgeId} overlaps ${other.edgeId}`).toBe(false);
    }));
  });

  it("preserves containment depth and deterministic sibling ordering", async () => {
    const hierarchy = [
      { id: "root" },
      { id: "group", parentId: "root" },
      { id: "child-b", parentId: "group" },
      { id: "child-a", parentId: "group" }
    ];
    const depths = containmentNodeLayers(hierarchy);
    const request: LayeredLayoutRequest = {
      direction: "DOWN",
      nodes: hierarchy.map((node) => ({
        id: node.id,
        width: 180,
        height: 80,
        layer: depths[node.id].layer,
        layerLabel: `Depth ${depths[node.id].layer}`,
        orderHint: node.id
      })),
      edges: hierarchy.flatMap((node) => node.parentId
        ? [{ id: `contains:${node.parentId}:${node.id}`, source: node.parentId, target: node.id, primary: true }]
        : [])
    };
    const one = await calculateLayeredLayout(request);
    const two = await calculateLayeredLayout({ ...request, nodes: request.nodes.slice().reverse() });
    expect(one.positions.root.y).toBeLessThan(one.positions.group.y);
    expect(one.positions.group.y).toBeLessThan(one.positions["child-a"].y);
    expect(one.positions).toEqual(two.positions);
  });

  it("preserves explicit manual coordinates while routing with independent ports", () => {
    const request: LayeredLayoutRequest = {
      direction: "DOWN",
      nodes: denseRequest.nodes.slice(0, 4),
      edges: denseRequest.edges.filter((edge) =>
        ["hub", "middle-0", "middle-1", "middle-2"].includes(edge.source)
        && ["hub", "middle-0", "middle-1", "middle-2"].includes(edge.target))
    };
    const positions = {
      hub: { x: 420, y: 40 },
      "middle-0": { x: 40, y: 320 },
      "middle-1": { x: 360, y: 340 },
      "middle-2": { x: 700, y: 300 }
    };
    const manual = routeManualLayout(request, positions);
    expect(manual.positions).toEqual(positions);
    expect(new Set(manual.nodePorts.hub.map((port) => `${port.side}:${port.offset}`)).size).toBe(manual.nodePorts.hub.length);
  });

  it("restores V04 independent compaction for a 100% realization", () => {
    const canonicalRequest: ModelGraphV04LayoutRequest = {
      direction: "DOWN",
      nodes: [
        { id: "mission", width: 220, height: 90, layer: 0, layerLabel: "Mission" },
        { id: "function", width: 220, height: 90, layer: 1, layerLabel: "Function" },
        { id: "component", width: 220, height: 90, layer: 2, layerLabel: "Component" }
      ],
      edges: [
        { id: "mission-function", source: "mission", target: "function", primary: true },
        { id: "function-component", source: "function", target: "component", primary: true }
      ]
    };
    const canonical = fallbackModelGraphV04Layout(canonicalRequest);
    const realization = fallbackModelGraphV04Layout({
      ...canonicalRequest,
      nodes: canonicalRequest.nodes.filter((node) => node.id === "component"),
      edges: []
    });
    expect(canonical.positions.component.y).toBeGreaterThan(0);
    expect(realization.positions.component.y).toBe(0);
    expect(realization.positions.component).not.toEqual(canonical.positions.component);
  });

  it("never changes canonical relationship endpoints while arranging", () => {
    expect(denseRequest.edges.map(({ id, source, target }) => ({ id, source, target }))).toEqual([
      ...Array.from({ length: 6 }, (_, index) => ({ id: `hub-middle-${index}`, source: "hub", target: `middle-${index}` })),
      ...Array.from({ length: 6 }, (_, index) => ({ id: `middle-leaf-${index}`, source: `middle-${index}`, target: `leaf-${5 - index}` })),
      ...Array.from({ length: 6 }, (_, index) => ({ id: `hub-leaf-${index}`, source: "hub", target: `leaf-${index}` })),
      { id: "cross-0", source: "middle-0", target: "middle-5" },
      { id: "cross-1", source: "middle-1", target: "middle-4" }
    ]);
  });
});
