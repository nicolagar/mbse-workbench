import { elementTypeColors, elementTypeLabels, elementTypes, type ElementType, type ModelElement, type Relationship } from "./types";

/**
 * Lane-trace digital-thread layout: one vertical lane per element type present
 * in the model, color-coded by `elementTypeColors`, with System requirements
 * rendered as a single wide horizontal row beneath the rest (it is the
 * highest-degree connective type - most relationships pass through it - so
 * giving it a row instead of a column keeps the diagram from being dominated
 * by one very tall lane).
 *
 * The user can click elements to select them, then trace upstream or
 * downstream from a lane's selected elements; tracing filters every other
 * lane down to only what is actually connected (via BFS over relationships),
 * collapses lanes to just what is relevant, and reorders each lane's visible
 * elements with a barycenter heuristic (the ordering step from Sugiyama-style
 * layered graph drawing) so connectors cross each other as little as
 * possible. All geometry here is a pure function of (elements, relationships,
 * selection state) - no DOM measurement - so it is fully unit-testable and,
 * like `layoutSemanticGraph`, safe to call on every render.
 */

export type TraceDirection = "upstream" | "downstream";

export interface TraceSeed {
  id: string;
  direction: TraceDirection;
}

export interface LaneTraceSelection {
  selectedIds: ReadonlySet<string>;
  seeds: readonly TraceSeed[];
  forceExpandedTypes: ReadonlySet<ElementType>;
}

export function emptyLaneTraceSelection(): LaneTraceSelection {
  return { selectedIds: new Set(), seeds: [], forceExpandedTypes: new Set() };
}

export function hasActiveLaneTraceSelection(selection: LaneTraceSelection): boolean {
  return selection.seeds.length > 0 || selection.selectedIds.size > 0;
}

export interface LaneTraceNet {
  reachedIds: Set<string>;
  walkedEdgeIds: Set<string>;
}

/** BFS from every seed; an edge only counts as "walked" if some seed's trace actually crossed it. */
export function computeLaneTraceNet(relationships: Relationship[], seeds: readonly TraceSeed[]): LaneTraceNet {
  const reachedIds = new Set<string>();
  const walkedEdgeIds = new Set<string>();
  if (!seeds.length) return { reachedIds, walkedEdgeIds };
  const outgoing = new Map<string, Relationship[]>();
  const incoming = new Map<string, Relationship[]>();
  relationships.forEach((relationship) => {
    if (!outgoing.has(relationship.sourceId)) outgoing.set(relationship.sourceId, []);
    outgoing.get(relationship.sourceId)!.push(relationship);
    if (!incoming.has(relationship.targetId)) incoming.set(relationship.targetId, []);
    incoming.get(relationship.targetId)!.push(relationship);
  });
  seeds.forEach((seed) => {
    const visited = new Set<string>([seed.id]);
    const queue: string[] = [seed.id];
    const adjacency = seed.direction === "upstream" ? incoming : outgoing;
    while (queue.length) {
      const current = queue.shift()!;
      for (const relationship of adjacency.get(current) ?? []) {
        walkedEdgeIds.add(relationship.id);
        const next = seed.direction === "upstream" ? relationship.sourceId : relationship.targetId;
        if (!visited.has(next)) {
          visited.add(next);
          reachedIds.add(next);
          queue.push(next);
        }
      }
    }
  });
  return { reachedIds, walkedEdgeIds };
}

export type LaneTraceCardState = "direct" | "reached" | "hidden";

export function laneTraceElementState(id: string, selection: LaneTraceSelection, net: LaneTraceNet): LaneTraceCardState {
  // A BFS never marks its own starting node as "reached" (that set is strictly
  // what it walked *to*), so without this check, seeding a trace from an element
  // that was later deselected - or that a caller never added to `selectedIds`
  // in the first place - would make that root disappear along with every edge
  // leaving it, even though it is still actively driving the trace.
  if (selection.selectedIds.has(id) || selection.seeds.some((seed) => seed.id === id)) return "direct";
  if (net.reachedIds.has(id)) return "reached";
  return "hidden";
}

export function isLaneTraceCollapsed(
  type: ElementType,
  elementsById: Map<string, ModelElement>,
  selection: LaneTraceSelection
): boolean {
  if (selection.forceExpandedTypes.has(type)) return false;
  if (!hasActiveLaneTraceSelection(selection)) return false;
  const hasSeedInLane = selection.seeds.some((seed) => elementsById.get(seed.id)?.elementType === type);
  if (hasSeedInLane) return true;
  const hasDirectInLane = [...selection.selectedIds].some((id) => elementsById.get(id)?.elementType === type);
  return hasDirectInLane || selection.seeds.length > 0;
}

/** Barycenter crossing-minimization: each lane's visible elements are reordered toward
 *  the average position of what they're connected to, iterated a few passes so lanes
 *  settle relative to each other. `previousOrder` is both the starting point and the
 *  tie-break, so an element only moves when there is a real crossing to resolve. */
export function computeLaneTraceOrders(
  elements: ModelElement[],
  relationships: Relationship[],
  laneTypesInOrder: ElementType[],
  wideType: ElementType | undefined,
  selection: LaneTraceSelection,
  net: LaneTraceNet,
  previousOrder: Readonly<Record<string, string[]>>
): Record<string, string[]> {
  const orderTypes = wideType ? [...laneTypesInOrder, wideType] : laneTypesInOrder;
  const byType = new Map<ElementType, ModelElement[]>();
  elements.forEach((element) => {
    if (!byType.has(element.elementType)) byType.set(element.elementType, []);
    byType.get(element.elementType)!.push(element);
  });

  const orders: Record<string, string[]> = {};
  const active = hasActiveLaneTraceSelection(selection);
  orderTypes.forEach((type) => {
    const natural = (byType.get(type) ?? []).map((element) => element.id);
    if (!active) {
      orders[type] = natural;
      return;
    }
    const naturalSet = new Set(natural);
    const prev = (previousOrder[type] ?? []).filter((id) => naturalSet.has(id));
    const prevSet = new Set(prev);
    orders[type] = [...prev, ...natural.filter((id) => !prevSet.has(id))];
  });
  if (!active) return orders;

  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const neighborsOf = new Map<string, string[]>();
  relationships.forEach((relationship) => {
    if (!net.walkedEdgeIds.has(relationship.id)) return;
    if (!neighborsOf.has(relationship.sourceId)) neighborsOf.set(relationship.sourceId, []);
    neighborsOf.get(relationship.sourceId)!.push(relationship.targetId);
    if (!neighborsOf.has(relationship.targetId)) neighborsOf.set(relationship.targetId, []);
    neighborsOf.get(relationship.targetId)!.push(relationship.sourceId);
  });
  const isVisible = (id: string) => laneTraceElementState(id, selection, net) !== "hidden";
  const normalizedRank = (id: string): number => {
    const type = elementsById.get(id)?.elementType;
    const arr = type ? orders[type] : undefined;
    if (!arr) return 0.5;
    const index = arr.indexOf(id);
    return index < 0 || arr.length <= 1 ? 0.5 : (index + 0.5) / arr.length;
  };
  const reorderLane = (type: ElementType) => {
    const all = orders[type] ?? [];
    const visibleIds = all.filter(isVisible);
    const hiddenIds = all.filter((id) => !isVisible(id));
    const scored = visibleIds.map((id, index) => {
      const neighbors = (neighborsOf.get(id) ?? []).filter(isVisible);
      const values = neighbors.map(normalizedRank);
      const bary = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return { id, bary, prevIndex: index };
    });
    scored.sort((a, b) => {
      const av = a.bary === null ? a.prevIndex / (visibleIds.length || 1) : a.bary;
      const bv = b.bary === null ? b.prevIndex / (visibleIds.length || 1) : b.bary;
      return Math.abs(av - bv) < 1e-9 ? a.prevIndex - b.prevIndex : av - bv;
    });
    orders[type] = [...scored.map((s) => s.id), ...hiddenIds];
  };
  for (let iteration = 0; iteration < 3; iteration += 1) {
    laneTypesInOrder.forEach(reorderLane);
    if (wideType) reorderLane(wideType);
    [...laneTypesInOrder].reverse().forEach(reorderLane);
    if (wideType) reorderLane(wideType);
  }
  return orders;
}

export const LANE_TRACE_CARD_WIDTH = 208;
export const LANE_TRACE_CARD_HEIGHT = 58;
const CARD_ROW_GAP = 8;
export const LANE_TRACE_HEADER_HEIGHT = 56;
const LANE_HEADER_HEIGHT = LANE_TRACE_HEADER_HEIGHT;
const LANE_TOP_PADDING = 10;
const LANE_BAND_PADDING_X = 10;
const LANE_GAP_COMPACT = 28;
const LANE_GAP_ACTIVE = 96;
const OVERHEAD_MARGIN = 72;
const OVERHEAD_Y = 34;
const CORRIDOR_HEIGHT = 70;
const MIN_LANE_HEIGHT = 130;
export const LANE_TRACE_WIDE_ROW_LABEL_WIDTH = 190;
const WIDE_ROW_LABEL_WIDTH = LANE_TRACE_WIDE_ROW_LABEL_WIDTH;
/** Reserved so a collapsed lane's "+" reopen button always lands clearly below
 *  its last visible card, never on top of it - a lane collapsed to just one or
 *  two cards is exactly the case a fixed height without this margin would clip. */
const PLUS_ROW_HEIGHT = 34;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  midX: number;
  midY: number;
}

function rectFromBox(x: number, y: number, width: number, height: number): Rect {
  return { left: x, right: x + width, top: y, bottom: y + height, midX: x + width / 2, midY: y + height / 2 };
}

export interface LaneTraceCard {
  id: string;
  name: string;
  laneType: ElementType;
  state: LaneTraceCardState;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaneTraceLane {
  type: ElementType;
  label: string;
  color: string;
  wide: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  visibleCount: number;
  totalCount: number;
  cards: LaneTraceCard[];
}

export interface LaneTraceEdge {
  id: string;
  path: string;
  color: string;
  endX: number;
  endY: number;
}

export interface LaneTraceLayout {
  lanes: LaneTraceLane[];
  edges: LaneTraceEdge[];
  width: number;
  height: number;
  newOrder: Record<string, string[]>;
}

function buildChannelOffsetFn(
  groupOrder: string[],
  groupInfo: Map<string, { sourceType: ElementType; targetType: ElementType }>,
  columnIndex: Map<ElementType, number>,
  wideType: ElementType | undefined
) {
  const channelMembers = new Map<string, string[]>();
  const register = (channelKey: string, key: string) => {
    if (!channelMembers.has(channelKey)) channelMembers.set(channelKey, []);
    channelMembers.get(channelKey)!.push(key);
  };
  groupOrder.forEach((key) => {
    const { sourceType, targetType } = groupInfo.get(key)!;
    if (wideType && targetType === wideType && sourceType !== wideType) register(`reqExit:${sourceType}`, key);
    else if (wideType && sourceType === wideType) register(`reqEntry:${targetType}`, key);
    else if (Math.abs((columnIndex.get(targetType) ?? 0) - (columnIndex.get(sourceType) ?? 0)) <= 1) register(`adj:${sourceType}>${targetType}`, key);
    else {
      register(`rise:${sourceType}`, key);
      register(`fall:${targetType}`, key);
    }
  });
  channelMembers.forEach((members) => members.sort());
  return (channelKey: string, key: string, budget: number): number => {
    const members = channelMembers.get(channelKey) ?? [key];
    const index = members.indexOf(key);
    const count = members.length;
    if (count <= 1) return 0;
    const spacing = Math.min(budget / (count - 1), 9);
    return (index - (count - 1) / 2) * spacing;
  };
}

/** Continuation-only V-segment path commands (no leading M - it chains onto the previous segment),
 *  inserting a small arc "line jump" at each y where a different path's horizontal crosses this one. */
function verticalSegmentCommands(x: number, y1: number, y2: number, jumpYs: number[] | undefined): string {
  if (!jumpYs || !jumpYs.length) return ` L ${x} ${y2}`;
  const direction = y2 > y1 ? 1 : -1;
  const ys = [...jumpYs].sort((a, b) => direction * (a - b));
  let d = "";
  let cursor = y1;
  ys.forEach((jy) => {
    if ((jy - cursor) * direction <= 2 || (y2 - jy) * direction <= 2) return;
    d += ` L ${x} ${jy - 3 * direction}`;
    d += ` A 4 4 0 0 ${direction > 0 ? 1 : 0} ${x} ${jy + 3 * direction}`;
    cursor = jy + 3 * direction;
  });
  d += ` L ${x} ${y2}`;
  return d;
}

type Segment =
  | { type: "H"; y: number; x1: number; x2: number }
  | { type: "V"; x: number; y1: number; y2: number };

export function layoutLaneTraceGraph(
  elements: ModelElement[],
  relationships: Relationship[],
  selection: LaneTraceSelection,
  previousOrder: Readonly<Record<string, string[]>>
): LaneTraceLayout {
  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const net = computeLaneTraceNet(relationships, selection.seeds);
  const active = hasActiveLaneTraceSelection(selection);

  const presentTypes = elementTypes.filter((type) => elements.some((element) => element.elementType === type));
  const wideType: ElementType | undefined = presentTypes.includes("systemRequirement") ? "systemRequirement" : undefined;
  const laneTypesInOrder = presentTypes.filter((type) => type !== wideType);

  const orders = computeLaneTraceOrders(elements, relationships, laneTypesInOrder, wideType, selection, net, previousOrder);

  const laneGap = active ? LANE_GAP_ACTIVE : LANE_GAP_COMPACT;
  const laneBandWidth = LANE_TRACE_CARD_WIDTH + LANE_BAND_PADDING_X * 2;

  interface LanePrep {
    type: ElementType;
    x: number;
    visibleIds: string[];
    totalCount: number;
    height: number;
  }

  const lanePreps: LanePrep[] = [];
  let cursorX = 0;
  laneTypesInOrder.forEach((type) => {
    const collapsed = isLaneTraceCollapsed(type, elementsById, selection);
    const order = orders[type] ?? [];
    const visibleIds = order.filter((id) => !collapsed || laneTraceElementState(id, selection, net) !== "hidden");
    const totalCount = order.filter((id) => laneTraceElementState(id, selection, net) !== "hidden").length;
    const height = Math.max(MIN_LANE_HEIGHT, LANE_HEADER_HEIGHT + LANE_TOP_PADDING + visibleIds.length * (LANE_TRACE_CARD_HEIGHT + CARD_ROW_GAP) + PLUS_ROW_HEIGHT);
    lanePreps.push({ type, x: cursorX, visibleIds, totalCount, height });
    cursorX += laneBandWidth + laneGap;
  });
  const upperRowWidth = Math.max(0, cursorX - laneGap);
  const upperRowHeight = lanePreps.length ? Math.max(...lanePreps.map((lane) => lane.height)) : MIN_LANE_HEIGHT;

  const upperRowTop = OVERHEAD_MARGIN;
  const upperRowBottom = upperRowTop + upperRowHeight;
  const betweenY = upperRowBottom + CORRIDOR_HEIGHT / 2;
  const wideRowTop = upperRowBottom + CORRIDOR_HEIGHT;

  const positions = new Map<string, { x: number; y: number }>();
  const laneRects = new Map<ElementType, { left: number; right: number }>();
  lanePreps.forEach((lane) => {
    laneRects.set(lane.type, { left: lane.x, right: lane.x + laneBandWidth });
    lane.visibleIds.forEach((id, index) => {
      positions.set(id, {
        x: lane.x + LANE_BAND_PADDING_X,
        y: upperRowTop + LANE_HEADER_HEIGHT + LANE_TOP_PADDING + index * (LANE_TRACE_CARD_HEIGHT + CARD_ROW_GAP)
      });
    });
  });

  let wideLane: LaneTraceLane | undefined;
  let wideVisibleIds: string[] = [];
  if (wideType) {
    const collapsed = isLaneTraceCollapsed(wideType, elementsById, selection);
    const order = orders[wideType] ?? [];
    wideVisibleIds = order.filter((id) => !collapsed || laneTraceElementState(id, selection, net) !== "hidden");
    const totalCount = order.filter((id) => laneTraceElementState(id, selection, net) !== "hidden").length;
    wideVisibleIds.forEach((id, index) => {
      positions.set(id, {
        x: WIDE_ROW_LABEL_WIDTH + index * (LANE_TRACE_CARD_WIDTH + CARD_ROW_GAP),
        y: wideRowTop + LANE_HEADER_HEIGHT
      });
    });
    laneRects.set(wideType, { left: WIDE_ROW_LABEL_WIDTH, right: WIDE_ROW_LABEL_WIDTH + Math.max(1, wideVisibleIds.length) * (LANE_TRACE_CARD_WIDTH + CARD_ROW_GAP) });
    const wideWidth = Math.max(upperRowWidth, WIDE_ROW_LABEL_WIDTH + wideVisibleIds.length * (LANE_TRACE_CARD_WIDTH + CARD_ROW_GAP));
    wideLane = {
      type: wideType,
      label: elementTypeLabels[wideType],
      color: elementTypeColors[wideType],
      wide: true,
      x: 0,
      y: wideRowTop,
      width: wideWidth,
      height: LANE_HEADER_HEIGHT + LANE_TRACE_CARD_HEIGHT + LANE_TOP_PADDING,
      collapsed,
      visibleCount: totalCount,
      totalCount: order.length,
      cards: wideVisibleIds.map((id) => ({
        id,
        name: elementsById.get(id)?.name ?? id,
        laneType: wideType!,
        state: laneTraceElementState(id, selection, net),
        ...positions.get(id)!,
        width: LANE_TRACE_CARD_WIDTH,
        height: LANE_TRACE_CARD_HEIGHT
      }))
    };
  }

  const lanes: LaneTraceLane[] = lanePreps.map((lane) => ({
    type: lane.type,
    label: elementTypeLabels[lane.type],
    color: elementTypeColors[lane.type],
    wide: false,
    x: lane.x,
    y: upperRowTop,
    width: laneBandWidth,
    height: lane.height,
    collapsed: isLaneTraceCollapsed(lane.type, elementsById, selection),
    visibleCount: lane.totalCount,
    totalCount: (orders[lane.type] ?? []).length,
    cards: lane.visibleIds.map((id) => ({
      id,
      name: elementsById.get(id)?.name ?? id,
      laneType: lane.type,
      state: laneTraceElementState(id, selection, net),
      ...positions.get(id)!,
      width: LANE_TRACE_CARD_WIDTH,
      height: LANE_TRACE_CARD_HEIGHT
    }))
  }));
  if (wideLane) lanes.push(wideLane);

  const columnIndex = new Map(laneTypesInOrder.map((type, index) => [type, index]));
  const visibleEdges = relationships.filter(
    (relationship) => net.walkedEdgeIds.has(relationship.id) && positions.has(relationship.sourceId) && positions.has(relationship.targetId)
  );

  const edges: LaneTraceEdge[] = [];
  if (visibleEdges.length) {
    const groups = new Map<string, Relationship[]>();
    const groupInfo = new Map<string, { sourceType: ElementType; targetType: ElementType }>();
    visibleEdges.forEach((relationship) => {
      const sourceType = elementsById.get(relationship.sourceId)!.elementType;
      const targetType = elementsById.get(relationship.targetId)!.elementType;
      const key = `${relationship.sourceId}>${targetType}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        groupInfo.set(key, { sourceType, targetType });
      }
      groups.get(key)!.push(relationship);
    });
    const groupOrder = [...groups.keys()].sort();
    const channelOffset = buildChannelOffsetFn(groupOrder, groupInfo, columnIndex, wideType);

    const orderIndexOf = (id: string): number => {
      const type = elementsById.get(id)?.elementType;
      const arr = type ? orders[type] : undefined;
      const index = arr ? arr.indexOf(id) : -1;
      return index < 0 ? 0 : index;
    };
    const arrivalSlot = new Map<string, { index: number; count: number }>();
    const byTarget = new Map<string, Relationship[]>();
    visibleEdges.forEach((relationship) => {
      if (!byTarget.has(relationship.targetId)) byTarget.set(relationship.targetId, []);
      byTarget.get(relationship.targetId)!.push(relationship);
    });
    byTarget.forEach((edgeList) => {
      edgeList
        .slice()
        .sort((a, b) => orderIndexOf(a.sourceId) - orderIndexOf(b.sourceId) || a.id.localeCompare(b.id))
        .forEach((relationship, index) => arrivalSlot.set(relationship.id, { index, count: edgeList.length }));
    });
    const arrivalY = (relationship: Relationship, rect: Rect): number => {
      const slot = arrivalSlot.get(relationship.id)!;
      const frac = (slot.index + 1) / (slot.count + 1);
      return rect.top + (rect.bottom - rect.top) * frac;
    };
    const arrivalX = (relationship: Relationship, rect: Rect): number => {
      const slot = arrivalSlot.get(relationship.id)!;
      const frac = (slot.index + 1) / (slot.count + 1);
      return rect.left + (rect.right - rect.left) * frac;
    };
    const rectOf = (id: string): Rect => {
      const p = positions.get(id)!;
      return rectFromBox(p.x, p.y, LANE_TRACE_CARD_WIDTH, LANE_TRACE_CARD_HEIGHT);
    };

    interface PathInfo {
      segs: Segment[];
      color: string;
      edgeId: string;
    }
    const paths: PathInfo[] = [];

    groupOrder.forEach((key) => {
      const groupEdges = groups.get(key)!;
      const { sourceType, targetType } = groupInfo.get(key)!;
      const sourceId = groupEdges[0].sourceId;
      const sourceRect = rectOf(sourceId);
      const color = elementTypeColors[sourceType];
      const isToRequirements = wideType !== undefined && targetType === wideType && sourceType !== wideType;
      const isFromRequirements = wideType !== undefined && sourceType === wideType;
      const columnGap = Math.abs((columnIndex.get(targetType) ?? 0) - (columnIndex.get(sourceType) ?? 0));

      if (isToRequirements) {
        const srcLaneRect = laneRects.get(sourceType)!;
        const exitGutterX = srcLaneRect.right + 14 + channelOffset(`reqExit:${sourceType}`, key, 26);
        const corridorY1 = betweenY + channelOffset(`reqExit:${sourceType}`, key, 12);
        groupEdges.forEach((relationship) => {
          const targetRect = rectOf(relationship.targetId);
          const tx = arrivalX(relationship, targetRect);
          paths.push({
            segs: [
              { type: "H", y: sourceRect.midY, x1: sourceRect.right, x2: exitGutterX },
              { type: "V", x: exitGutterX, y1: sourceRect.midY, y2: corridorY1 },
              { type: "H", y: corridorY1, x1: exitGutterX, x2: tx },
              { type: "V", x: tx, y1: corridorY1, y2: targetRect.top }
            ],
            color,
            edgeId: relationship.id
          });
        });
      } else if (isFromRequirements) {
        const exitX = (sourceRect.left + sourceRect.right) / 2;
        const corridorY2 = betweenY + channelOffset(`reqEntry:${targetType}`, key, 12);
        const targetLaneRect = laneRects.get(targetType)!;
        const gutterX = targetLaneRect.left - 14 - channelOffset(`reqEntry:${targetType}`, key, 26);
        groupEdges.forEach((relationship) => {
          const targetRect = rectOf(relationship.targetId);
          const ty = arrivalY(relationship, targetRect);
          paths.push({
            segs: [
              { type: "V", x: exitX, y1: sourceRect.top, y2: corridorY2 },
              { type: "H", y: corridorY2, x1: exitX, x2: gutterX },
              { type: "V", x: gutterX, y1: corridorY2, y2: ty },
              { type: "H", y: ty, x1: gutterX, x2: targetRect.left }
            ],
            color,
            edgeId: relationship.id
          });
        });
      } else if (columnGap <= 1) {
        const adjKey = `adj:${sourceType}>${targetType}`;
        const pivotX = sourceRect.right + 30 + channelOffset(adjKey, key, 30);
        groupEdges.forEach((relationship) => {
          const targetRect = rectOf(relationship.targetId);
          const ty = arrivalY(relationship, targetRect);
          paths.push({
            segs: [
              { type: "H", y: sourceRect.midY, x1: sourceRect.right, x2: pivotX },
              { type: "V", x: pivotX, y1: sourceRect.midY, y2: ty },
              { type: "H", y: ty, x1: pivotX, x2: targetRect.left }
            ],
            color,
            edgeId: relationship.id
          });
        });
      } else {
        const riseKey = `rise:${sourceType}`;
        const fallKey = `fall:${targetType}`;
        const corridorY = OVERHEAD_Y - channelOffset(riseKey, key, 14);
        const riseX = sourceRect.right + 18 + channelOffset(riseKey, key, 26);
        groupEdges.forEach((relationship) => {
          const targetRect = rectOf(relationship.targetId);
          const ty = arrivalY(relationship, targetRect);
          const fallX = targetRect.left - 18 - channelOffset(fallKey, key, 26);
          paths.push({
            segs: [
              { type: "H", y: sourceRect.midY, x1: sourceRect.right, x2: riseX },
              { type: "V", x: riseX, y1: sourceRect.midY, y2: corridorY },
              { type: "H", y: corridorY, x1: riseX, x2: fallX },
              { type: "V", x: fallX, y1: corridorY, y2: ty },
              { type: "H", y: ty, x1: fallX, x2: targetRect.left }
            ],
            color,
            edgeId: relationship.id
          });
        });
      }
    });

    const allH: { x1: number; x2: number; y: number; pathIndex: number }[] = [];
    const allV: { y1: number; y2: number; x: number; pathIndex: number; seg: Segment }[] = [];
    paths.forEach((pathInfo, pathIndex) => {
      pathInfo.segs.forEach((seg) => {
        if (seg.type === "H") allH.push({ x1: Math.min(seg.x1, seg.x2), x2: Math.max(seg.x1, seg.x2), y: seg.y, pathIndex });
        else allV.push({ y1: Math.min(seg.y1, seg.y2), y2: Math.max(seg.y1, seg.y2), x: seg.x, pathIndex, seg });
      });
    });
    const crossings = new Map<Segment, number[]>();
    allV.forEach((v) => {
      allH.forEach((h) => {
        if (h.pathIndex === v.pathIndex) return;
        if (h.y > v.y1 + 1 && h.y < v.y2 - 1 && h.x1 < v.x - 1 && h.x2 > v.x + 1) {
          const list = crossings.get(v.seg) ?? [];
          list.push(h.y);
          crossings.set(v.seg, list);
        }
      });
    });

    paths.forEach((pathInfo) => {
      const first = pathInfo.segs[0];
      let d = first.type === "H" ? `M ${first.x1} ${first.y}` : `M ${first.x} ${first.y1}`;
      pathInfo.segs.forEach((seg) => {
        if (seg.type === "H") d += ` L ${seg.x2} ${seg.y}`;
        else d += verticalSegmentCommands(seg.x, seg.y1, seg.y2, crossings.get(seg));
      });
      const last = pathInfo.segs[pathInfo.segs.length - 1];
      const endX = last.type === "H" ? last.x2 : last.x;
      const endY = last.type === "H" ? last.y : last.y2;
      edges.push({ id: pathInfo.edgeId, path: d, color: pathInfo.color, endX, endY });
    });
  }

  const width = Math.max(upperRowWidth, wideLane?.width ?? 0) + 60;
  const height = (wideLane ? wideLane.y + wideLane.height : upperRowBottom) + 40;

  return { lanes, edges, width, height, newOrder: orders };
}
