import { describe, expect, it } from "vitest";
import { createOhscSampleProject } from "../data/ohscSample";
import {
  computeLaneTraceNet,
  computeLaneTraceOrders,
  emptyLaneTraceSelection,
  hasActiveLaneTraceSelection,
  isLaneTraceCollapsed,
  laneTraceElementState,
  layoutLaneTraceGraph,
  type LaneTraceSelection
} from "../domain/laneTraceGraph";
import type { ElementType, ModelElement, Relationship } from "../domain/types";

const now = "2026-07-23T10:00:00.000Z";
function element(id: string, elementType: ElementType, name = id): ModelElement {
  return {
    id,
    elementType,
    name,
    description: "",
    status: "reviewed",
    architectureScope: "common",
    parameters: [],
    customAttributeValues: {},
    tags: [],
    metadata: {},
    createdAt: now,
    updatedAt: now
  };
}
function relationship(id: string, sourceId: string, targetId: string): Relationship {
  return { id, relationshipType: "derives", sourceId, targetId, createdAt: now, updatedAt: now };
}
function selectionOf(patch: Partial<LaneTraceSelection>): LaneTraceSelection {
  return { ...emptyLaneTraceSelection(), ...patch };
}

// A -> B -> C (need -> objective -> useCase), plus an unrelated D (stakeholder) with no edges.
const A = element("A", "need");
const B = element("B", "objective");
const C = element("C", "useCase");
const D = element("D", "stakeholder");
const elements = [A, B, C, D];
const edgeAB = relationship("e-ab", "A", "B");
const edgeBC = relationship("e-bc", "B", "C");
const relationships = [edgeAB, edgeBC];

describe("computeLaneTraceNet", () => {
  it("returns an empty net with no seeds", () => {
    const net = computeLaneTraceNet(relationships, []);
    expect(net.reachedIds.size).toBe(0);
    expect(net.walkedEdgeIds.size).toBe(0);
  });

  it("walks downstream from a seed, tracking both reached nodes and the edges actually crossed", () => {
    const net = computeLaneTraceNet(relationships, [{ id: "A", direction: "downstream" }]);
    expect(net.reachedIds).toEqual(new Set(["B", "C"]));
    expect(net.walkedEdgeIds).toEqual(new Set(["e-ab", "e-bc"]));
  });

  it("walks upstream from a seed using the reverse direction", () => {
    const net = computeLaneTraceNet(relationships, [{ id: "C", direction: "upstream" }]);
    expect(net.reachedIds).toEqual(new Set(["B", "A"]));
    expect(net.walkedEdgeIds).toEqual(new Set(["e-bc", "e-ab"]));
  });

  it("never reaches an element with no path to any seed", () => {
    const net = computeLaneTraceNet(relationships, [{ id: "A", direction: "downstream" }]);
    expect(net.reachedIds.has("D")).toBe(false);
  });
});

describe("laneTraceElementState", () => {
  it("classifies a selected element as direct even if it is also reached", () => {
    const net = computeLaneTraceNet(relationships, [{ id: "A", direction: "downstream" }]);
    const selection = selectionOf({ selectedIds: new Set(["B"]), seeds: [{ id: "A", direction: "downstream" }] });
    expect(laneTraceElementState("B", selection, net)).toBe("direct");
  });

  it("classifies a reached-but-unselected element as reached", () => {
    const net = computeLaneTraceNet(relationships, [{ id: "A", direction: "downstream" }]);
    const selection = selectionOf({ seeds: [{ id: "A", direction: "downstream" }] });
    expect(laneTraceElementState("C", selection, net)).toBe("reached");
  });

  it("classifies everything else as hidden", () => {
    const net = computeLaneTraceNet(relationships, [{ id: "A", direction: "downstream" }]);
    const selection = selectionOf({ seeds: [{ id: "A", direction: "downstream" }] });
    expect(laneTraceElementState("D", selection, net)).toBe("hidden");
  });
});

describe("isLaneTraceCollapsed", () => {
  const elementsById = new Map(elements.map((e) => [e.id, e]));

  it("never collapses a lane when nothing is selected at all", () => {
    expect(isLaneTraceCollapsed("stakeholder", elementsById, emptyLaneTraceSelection())).toBe(false);
  });

  it("collapses every lane once a trace is committed", () => {
    const selection = selectionOf({ seeds: [{ id: "A", direction: "downstream" }] });
    expect(isLaneTraceCollapsed("stakeholder", elementsById, selection)).toBe(true);
  });

  it("does not collapse a lane the caller force-expanded", () => {
    const selection = selectionOf({ seeds: [{ id: "A", direction: "downstream" }], forceExpandedTypes: new Set(["stakeholder" as ElementType]) });
    expect(isLaneTraceCollapsed("stakeholder", elementsById, selection)).toBe(false);
  });
});

describe("computeLaneTraceOrders", () => {
  it("keeps natural order when no selection is active", () => {
    const net = computeLaneTraceNet(relationships, []);
    const orders = computeLaneTraceOrders(elements, relationships, ["need", "objective", "useCase", "stakeholder"], undefined, emptyLaneTraceSelection(), net, {});
    expect(orders.need).toEqual(["A"]);
    expect(orders.stakeholder).toEqual(["D"]);
  });

  it("is stable across repeated calls with the same previous order (no gratuitous reshuffling)", () => {
    const seeds = [{ id: "A", direction: "downstream" as const }];
    const net = computeLaneTraceNet(relationships, seeds);
    const selection = selectionOf({ seeds });
    const first = computeLaneTraceOrders(elements, relationships, ["need", "objective", "useCase", "stakeholder"], undefined, selection, net, {});
    const second = computeLaneTraceOrders(elements, relationships, ["need", "objective", "useCase", "stakeholder"], undefined, selection, net, first);
    expect(second).toEqual(first);
  });
});

describe("layoutLaneTraceGraph", () => {
  it("produces no edges and every element visible when nothing is selected", () => {
    const layout = layoutLaneTraceGraph(elements, relationships, emptyLaneTraceSelection(), {});
    expect(layout.edges).toHaveLength(0);
    const allCardIds = layout.lanes.flatMap((lane) => lane.cards.map((card) => card.id));
    expect(new Set(allCardIds)).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("draws one connector per walked relationship, and only for walked relationships", () => {
    const selection = selectionOf({ seeds: [{ id: "A", direction: "downstream" }] });
    const layout = layoutLaneTraceGraph(elements, relationships, selection, {});
    expect(layout.edges.map((edge) => edge.id).sort()).toEqual(["e-ab", "e-bc"]);
    layout.edges.forEach((edge) => expect(edge.path.startsWith("M ")).toBe(true));
  });

  it("collapses unrelated lanes down to nothing once a trace is active", () => {
    const selection = selectionOf({ seeds: [{ id: "A", direction: "downstream" }] });
    const layout = layoutLaneTraceGraph(elements, relationships, selection, {});
    const stakeholderLane = layout.lanes.find((lane) => lane.type === "stakeholder")!;
    expect(stakeholderLane.collapsed).toBe(true);
    expect(stakeholderLane.cards).toHaveLength(0);
  });

  it("lays out lane bands without any horizontal overlap", () => {
    const layout = layoutLaneTraceGraph(elements, relationships, emptyLaneTraceSelection(), {});
    const bands = layout.lanes.filter((lane) => !lane.wide).map((lane) => ({ left: lane.x, right: lane.x + lane.width }));
    for (let i = 0; i < bands.length; i += 1) {
      for (let j = i + 1; j < bands.length; j += 1) {
        const overlaps = bands[i].left < bands[j].right && bands[j].left < bands[i].right;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("lays out a lane's own cards without vertical overlap", () => {
    const layout = layoutLaneTraceGraph(elements, relationships, emptyLaneTraceSelection(), {});
    layout.lanes.forEach((lane) => {
      const sorted = [...lane.cards].sort((a, b) => (lane.wide ? a.x - b.x : a.y - b.y));
      for (let i = 1; i < sorted.length; i += 1) {
        if (lane.wide) expect(sorted[i].x).toBeGreaterThanOrEqual(sorted[i - 1].x + sorted[i - 1].width);
        else expect(sorted[i].y).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].height);
      }
    });
  });

  it("returns a wide row for systemRequirement laid out horizontally, separate from the vertical lanes", () => {
    const withRequirement = [...elements, element("R", "systemRequirement")];
    const withRequirementEdges = [...relationships, relationship("e-cr", "C", "R")];
    const layout = layoutLaneTraceGraph(withRequirement, withRequirementEdges, emptyLaneTraceSelection(), {});
    const wideLane = layout.lanes.find((lane) => lane.type === "systemRequirement")!;
    expect(wideLane.wide).toBe(true);
    expect(layout.lanes.filter((lane) => !lane.wide).some((lane) => lane.type === "systemRequirement")).toBe(false);
  });

  it("omits the wide row entirely when there are no systemRequirement elements", () => {
    const layout = layoutLaneTraceGraph(elements, relationships, emptyLaneTraceSelection(), {});
    expect(layout.lanes.some((lane) => lane.wide)).toBe(false);
  });
});

describe("layoutLaneTraceGraph against the real OHSC sample project", () => {
  const project = createOhscSampleProject();

  it("runs end-to-end on the full model with no active selection", () => {
    const layout = layoutLaneTraceGraph(project.elements, project.relationships, emptyLaneTraceSelection(), {});
    expect(layout.edges).toHaveLength(0);
    expect(layout.lanes.length).toBeGreaterThan(0);
    expect(layout.lanes.some((lane) => lane.type === "systemRequirement" && lane.wide)).toBe(true);
  });

  it("traces upstream from a real product component and only shows what is actually connected", () => {
    const door = project.elements.find((e) => e.id === "PC-02")!;
    expect(door).toBeDefined();
    const selection = selectionOf({ selectedIds: new Set([door.id]), seeds: [{ id: door.id, direction: "upstream" }] });
    expect(hasActiveLaneTraceSelection(selection)).toBe(true);
    const layout = layoutLaneTraceGraph(project.elements, project.relationships, selection, {});
    expect(layout.edges.length).toBeGreaterThan(0);
    const net = computeLaneTraceNet(project.relationships, selection.seeds);
    layout.edges.forEach((edge) => expect(net.walkedEdgeIds.has(edge.id)).toBe(true));
    const productComponentLane = layout.lanes.find((lane) => lane.type === "productComponent")!;
    expect(productComponentLane.collapsed).toBe(true);
    expect(productComponentLane.cards.map((card) => card.id)).toContain(door.id);
  });
});
