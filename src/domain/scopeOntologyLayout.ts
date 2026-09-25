import {
  ontologyEnvironmentOrder,
  scopeOntologyNodes,
  visibleScopeOntology,
  type OntologyDensity,
  type OntologyEnvironmentId,
  type OntologyScopeLevel,
  type ScopeOntologyConnection,
  type ScopeOntologyNode
} from "./scopeOntology";

export interface OntologyPoint { x: number; y: number }
export interface OntologyBox extends OntologyPoint {
  width: number;
  height: number;
  environment: OntologyEnvironmentId;
  referenceId?: string;
  terminal?: boolean;
}
export interface OntologySectionLayout extends OntologyBox {
  id: OntologyEnvironmentId;
  nodeTop: number;
  referenceIds: string[];
}
export interface OntologyRoute {
  points: OntologyPoint[];
  ports: [OntologyPoint, OntologyPoint];
  midpoint: OntologyPoint;
  midpointFraction: number;
  labelBox: OntologyBox;
}
export interface ScopeOntologyLayout {
  width: number;
  height: number;
  nodes: ScopeOntologyNode[];
  connections: ScopeOntologyConnection[];
  positions: Map<string, OntologyBox>;
  referencePositions: Map<string, OntologyBox>;
  sections: OntologySectionLayout[];
  routes: Map<string, OntologyRoute>;
  stageBounds: Map<string, { top: number; bottom: number }>;
  routingErrors: string[];
}

export const ontologySectionMeta: Record<OntologyEnvironmentId, { label: string; note: string; fill: string }> = {
  model: { label: "Architecture modelling", note: "Mission, scope, and product / industrial architecture", fill: "#eaf4f8" },
  trade: { label: "Trade study & variability", note: "Study framing, feature model, mappings, and 100% derivation", fill: "#f5f0fa" },
  eval: { label: "Simulation & evaluation", note: "Parameters, KPI definitions, execution, and immutable results", fill: "#eef8f3" },
  decision: { label: "Comparison & decision", note: "Compared alternatives, evidence, and engineering decision", fill: "#f5f0fa" }
};

const placement: Record<string, readonly [number, number]> = {
  mission: [0, .5], stakeholder: [1, .22], system: [1, .5], external: [1, .78],
  useCase: [2, .5], need: [3, .35], objective: [3, .65], requirement: [4, .5],
  productFunction: [5, .28], processFunction: [5, .72], productComponent: [6, .14],
  productInterface: [6, .38], industrialComponent: [6, .62], processInterface: [6, .86],
  parameter: [7, .28], resource: [7, .72], architecture: [8, .5], study: [0, .5],
  feature: [1, .22], featureGroup: [1, .5], axis: [1, .78], variationPoint: [2, .5],
  configuration: [3, .5], derivation: [4, .5], kpi: [0, .38], run: [1, .5],
  simulationResult: [2, .62], alternative: [0, .34], comparisonResult: [0, .66], decision: [1, .5]
};

const canvasWidth = 1240;
const grid = 8;
const decisionNodeIds = new Set(["alternative", "comparisonResult", "decision"]);
const nodeById = new Map(scopeOntologyNodes.map((node) => [node.id, node]));
const environmentOf = (node: ScopeOntologyNode) => decisionNodeIds.has(node.id) ? "decision" : node.environment;
const roundGrid = (value: number) => Math.round(value / grid) * grid;

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, padding = 0) {
  return a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y;
}

function orderedReferences(environment: OntologyEnvironmentId, ids: string[], connections: ScopeOntologyConnection[]) {
  if (environment === "trade" && ids.length === 3 && ["productComponent", "objective", "architecture"].every((id) => ids.includes(id))) {
    return ["productComponent", "objective", "architecture"];
  }
  const score = (id: string) => {
    const targets = connections
      .filter((connection) => connection.source === id || connection.target === id)
      .map((connection) => connection.source === id ? connection.target : connection.source)
      .map((targetId) => nodeById.get(targetId))
      .filter((node): node is ScopeOntologyNode => Boolean(node) && environmentOf(node!) === environment);
    return targets.reduce((sum, node) => sum + (placement[node.id]?.[1] ?? .5) + (placement[node.id]?.[0] ?? 0) * .025, 0) / Math.max(1, targets.length);
  };
  return [...ids].sort((a, b) => score(a) - score(b) || scopeOntologyNodes.findIndex((node) => node.id === a) - scopeOntologyNodes.findIndex((node) => node.id === b));
}

interface PortData {
  point: OntologyPoint;
  escape: OntologyPoint;
  axis: 0 | 1;
  stubKeys: string[];
}

interface RouteRecord {
  connection: ScopeOntologyConnection;
  sourceBox: OntologyBox;
  targetBox: OntologyBox;
  sourceSide: "top" | "bottom" | "left" | "right";
  targetSide: "top" | "bottom" | "left" | "right";
  sourcePort?: PortData;
  targetPort?: PortData;
}

const segmentKey = (a: OntologyPoint, b: OntologyPoint) =>
  a.x < b.x || (a.x === b.x && a.y < b.y)
    ? `${a.x},${a.y}|${b.x},${b.y}`
    : `${b.x},${b.y}|${a.x},${a.y}`;

function compactPoints(raw: OntologyPoint[]) {
  const points: OntologyPoint[] = [];
  raw.forEach((point) => {
    const last = points.at(-1);
    if (last?.x === point.x && last.y === point.y) return;
    while (points.length >= 2) {
      const first = points.at(-2)!;
      const second = points.at(-1)!;
      if ((first.x === second.x && second.x === point.x) || (first.y === second.y && second.y === point.y)) points.pop();
      else break;
    }
    points.push(point);
  });
  return points;
}

function pointOnRoute(points: OntologyPoint[], fraction: number) {
  const segments = points.slice(1).map((point, index) => ({
    from: points[index],
    to: point,
    length: Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y)
  }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = total * fraction;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const progress = segment.length ? remaining / segment.length : 0;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * progress,
        y: segment.from.y + (segment.to.y - segment.from.y) * progress
      };
    }
    remaining -= segment.length;
  }
  return points.at(-1) ?? { x: 0, y: 0 };
}

export function buildScopeOntologyLayout(scope: OntologyScopeLevel, density: OntologyDensity): ScopeOntologyLayout {
  const { nodes, connections } = visibleScopeOntology(scope, density);
  const environments = ontologyEnvironmentOrder(scope);
  const environmentIndex = new Map(environments.map((environment, index) => [environment, index]));
  const positions = new Map<string, OntologyBox>();
  const referencePositions = new Map<string, OntologyBox>();
  const stageBounds = new Map<string, { top: number; bottom: number }>();
  const sections: OntologySectionLayout[] = [];
  const references = new Map(environments.map((environment) => [environment, new Set<string>()]));

  connections.forEach((connection) => {
    const source = nodeById.get(connection.source)!;
    const target = nodeById.get(connection.target)!;
    const sourceEnvironment = environmentOf(source);
    const targetEnvironment = environmentOf(target);
    if (sourceEnvironment === targetEnvironment) return;
    const earlier = (environmentIndex.get(sourceEnvironment) ?? 0) < (environmentIndex.get(targetEnvironment) ?? 0);
    references.get(earlier ? targetEnvironment : sourceEnvironment)?.add(earlier ? connection.source : connection.target);
  });

  let y = 24;
  environments.forEach((environment) => {
    const group = nodes.filter((node) => environmentOf(node) === environment);
    const allReferences = orderedReferences(environment, [...(references.get(environment) ?? [])], connections);
    const terminalReferences = environment === "decision" && allReferences.includes("architecture") ? ["architecture"] : [];
    const referenceIds = allReferences.filter((id) => !terminalReferences.includes(id));
    const referenceRows = Math.ceil(referenceIds.length / 5);
    const nodeTop = y + 96 + referenceRows * 72;
    const maxRow = Math.max(...group.map((node) => placement[node.id]?.[0] ?? 0), 0);
    const height = 126 + referenceRows * 72 + (maxRow + 1) * 184 + (terminalReferences.length ? 86 : 0);
    const section: OntologySectionLayout = {
      id: environment,
      x: 28,
      y,
      width: 1184,
      height,
      environment,
      nodeTop,
      referenceIds: [...referenceIds, ...terminalReferences]
    };
    sections.push(section);

    referenceIds.forEach((id, index) => {
      const row = Math.floor(index / 5);
      const column = index % 5;
      const itemsInRow = Math.min(5, referenceIds.length - row * 5);
      const totalWidth = itemsInRow * 178 + (itemsInRow - 1) * 14;
      referencePositions.set(`${environment}:${id}`, {
        x: roundGrid(section.x + (section.width - totalWidth) / 2 + column * 192),
        y: roundGrid(y + 66 + row * 72),
        width: 176,
        height: 40,
        environment,
        referenceId: id
      });
    });
    terminalReferences.forEach((id) => {
      const box: OntologyBox = {
        x: roundGrid(section.x + section.width / 2 - 112),
        y: roundGrid(nodeTop + (maxRow + 1) * 184 + 2),
        width: 224,
        height: 48,
        environment,
        referenceId: id,
        terminal: true
      };
      referencePositions.set(`${environment}:${id}`, box);
      stageBounds.set("baseline", { top: box.y, bottom: box.y + box.height });
    });
    group.forEach((node) => {
      const [row, slot] = placement[node.id] ?? [0, .5];
      const box: OntologyBox = {
        x: roundGrid(section.x + section.width * slot - 104),
        y: roundGrid(nodeTop + row * 184),
        width: 208,
        height: 80,
        environment
      };
      positions.set(node.id, box);
      if (!(scope === 2 && node.stage === "baseline")) {
        const current = stageBounds.get(node.stage);
        stageBounds.set(node.stage, {
          top: Math.min(current?.top ?? box.y, box.y),
          bottom: Math.max(current?.bottom ?? box.y + box.height, box.y + box.height)
        });
      }
    });
    y += height + 24;
  });

  const endpoint = (connection: ScopeOntologyConnection, id: string, source: boolean) => {
    const node = nodeById.get(id)!;
    const other = nodeById.get(source ? connection.target : connection.source)!;
    const nodeEnvironment = environmentOf(node);
    const otherEnvironment = environmentOf(other);
    const nodeIndex = environments.indexOf(nodeEnvironment);
    const otherIndex = environments.indexOf(otherEnvironment);
    if (nodeIndex === otherIndex) return positions.get(id)!;
    const laterEnvironment = nodeIndex > otherIndex ? nodeEnvironment : otherEnvironment;
    return nodeIndex < otherIndex ? referencePositions.get(`${laterEnvironment}:${id}`)! : positions.get(id)!;
  };

  const records: RouteRecord[] = connections.map((connection) => {
    const sourceBox = endpoint(connection, connection.source, true);
    const targetBox = endpoint(connection, connection.target, false);
    const difference = targetBox.y - sourceBox.y;
    const sameRow = Math.abs(difference) < 48;
    return {
      connection,
      sourceBox,
      targetBox,
      sourceSide: sameRow ? (sourceBox.x < targetBox.x ? "right" : "left") : (difference > 0 ? "bottom" : "top"),
      targetSide: sameRow ? (sourceBox.x < targetBox.x ? "left" : "right") : (difference > 0 ? "top" : "bottom")
    };
  });

  const portGroups = new Map<string, Array<{ record: RouteRecord; box: OntologyBox; side: RouteRecord["sourceSide"]; end: "source" | "target"; other: OntologyBox }>>();
  records.forEach((record) => {
    ([
      [record.sourceBox, record.sourceSide, "source", record.targetBox],
      [record.targetBox, record.targetSide, "target", record.sourceBox]
    ] as const).forEach(([box, side, end, other]) => {
      const nodeId = end === "source" ? record.connection.source : record.connection.target;
      const key = `${box.environment}:${box.referenceId ?? nodeId}:${side}`;
      const group = portGroups.get(key) ?? [];
      group.push({ record, box, side, end, other });
      portGroups.set(key, group);
    });
  });

  const allStubs = new Map<string, string>();
  portGroups.forEach((group) => {
    group.sort((a, b) => ((a.side === "top" || a.side === "bottom") ? a.other.x - b.other.x : a.other.y - b.other.y) || a.record.connection.id.localeCompare(b.record.connection.id));
    group.forEach((item, index) => {
      const horizontal = item.side === "top" || item.side === "bottom";
      const length = horizontal ? item.box.width : item.box.height;
      const along = roundGrid(16 + (length - 32) * (index + 1) / (group.length + 1));
      const point = {
        x: item.box.x + (horizontal ? along : item.side === "left" ? 0 : item.box.width),
        y: item.box.y + (horizontal ? item.side === "top" ? 0 : item.box.height : along)
      };
      const vector: readonly [number, number] = item.side === "top" ? [0, -1] : item.side === "bottom" ? [0, 1] : item.side === "left" ? [-1, 0] : [1, 0];
      const port: PortData = {
        point,
        escape: { x: point.x + vector[0] * 24, y: point.y + vector[1] * 24 },
        axis: horizontal ? 1 : 0,
        stubKeys: []
      };
      for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
        const from = { x: point.x + vector[0] * stepIndex * grid, y: point.y + vector[1] * stepIndex * grid };
        const to = { x: from.x + vector[0] * grid, y: from.y + vector[1] * grid };
        const key = segmentKey(from, to);
        allStubs.set(key, item.record.connection.id);
        port.stubKeys.push(key);
      }
      if (item.end === "source") item.record.sourcePort = port;
      else item.record.targetPort = port;
    });
  });

  const rawRoutes = new Map<string, Omit<OntologyRoute, "midpoint" | "midpointFraction" | "labelBox">>();
  const routingErrors: string[] = [];
  environments.forEach((environment) => {
    const section = sections.find((candidate) => candidate.id === environment)!;
    const minX = 32;
    const maxX = 1208;
    const minY = Math.ceil((section.y + 60) / grid) * grid;
    const maxY = Math.floor((section.y + section.height - 12) / grid) * grid;
    const columns = (maxX - minX) / grid + 1;
    const rows = (maxY - minY) / grid + 1;
    const size = columns * rows;
    const obstacles = [...positions.values(), ...referencePositions.values()].filter((box) => box.environment === environment);
    const blocked = new Uint8Array(size);
    const used = new Set<string>();
    const occupied = new Set<number>();
    const at = (point: OntologyPoint) => Math.round((point.y - minY) / grid) * columns + Math.round((point.x - minX) / grid);
    const point = (id: number) => ({ x: minX + (id % columns) * grid, y: minY + Math.floor(id / columns) * grid });
    for (let id = 0; id < size; id += 1) {
      const candidate = point(id);
      if (obstacles.some((box) => candidate.x > box.x - 5 && candidate.x < box.x + box.width + 5 && candidate.y > box.y - 5 && candidate.y < box.y + box.height + 5)) blocked[id] = 1;
    }

    const localRecords = records
      .filter((record) => record.sourceBox.environment === environment && record.sourcePort && record.targetPort)
      .sort((a, b) => {
        const first = Math.abs(a.sourcePort!.escape.y - a.targetPort!.escape.y) + Math.abs(a.sourcePort!.escape.x - a.targetPort!.escape.x);
        const second = Math.abs(b.sourcePort!.escape.y - b.targetPort!.escape.y) + Math.abs(b.sourcePort!.escape.x - b.targetPort!.escape.x);
        return first - second;
      });

    localRecords.forEach((record) => {
      const sourcePort = record.sourcePort!;
      const targetPort = record.targetPort!;
      const start = at(sourcePort.escape);
      const goal = at(targetPort.escape);
      const distance = new Float64Array(size * 2).fill(Infinity);
      const previous = new Int32Array(size * 2).fill(-1);
      const heap: Array<{ state: number; cost: number; score: number }> = [];
      const push = (state: number, cost: number, score: number) => {
        let index = heap.length;
        heap.push({ state, cost, score });
        while (index) {
          const parent = (index - 1) >> 1;
          if (heap[parent].score <= score) break;
          heap[index] = heap[parent];
          index = parent;
        }
        heap[index] = { state, cost, score };
      };
      const pop = () => {
        const first = heap[0];
        const last = heap.pop()!;
        if (heap.length) {
          let index = 0;
          while (true) {
            let child = index * 2 + 1;
            if (child >= heap.length) break;
            if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child += 1;
            if (heap[child].score >= last.score) break;
            heap[index] = heap[child];
            index = child;
          }
          heap[index] = last;
        }
        return first;
      };
      const heuristic = (id: number) => {
        const current = point(id);
        const end = point(goal);
        return Math.abs(current.x - end.x) + Math.abs(current.y - end.y);
      };
      const initial = start * 2 + sourcePort.axis;
      distance[initial] = 0;
      push(initial, 0, heuristic(start));
      let finalState = -1;
      while (heap.length) {
        const current = pop();
        if (current.cost !== distance[current.state]) continue;
        const id = current.state >> 1;
        const axis = current.state % 2;
        if (id === goal) {
          finalState = current.state;
          break;
        }
        const currentPoint = point(id);
        const neighbors: Array<[number, 0 | 1]> = [];
        if (id % columns > 0) neighbors.push([id - 1, 0]);
        if (id % columns < columns - 1) neighbors.push([id + 1, 0]);
        if (id >= columns) neighbors.push([id - columns, 1]);
        if (id < size - columns) neighbors.push([id + columns, 1]);
        neighbors.forEach(([next, direction]) => {
          if (blocked[next] && next !== goal && next !== start) return;
          const key = segmentKey(currentPoint, point(next));
          if (used.has(key) || (allStubs.has(key) && allStubs.get(key) !== record.connection.id)) return;
          const nearOccupied = [next - 1, next + 1, next - columns, next + columns].some((neighbor) => occupied.has(neighbor));
          const cost = current.cost + grid + (direction !== axis ? 26 : 0) + (occupied.has(next) ? 100 : nearOccupied ? 9 : 0);
          const state = next * 2 + direction;
          if (cost >= distance[state]) return;
          distance[state] = cost;
          previous[state] = current.state;
          push(state, cost, cost + heuristic(next));
        });
      }
      if (finalState < 0) {
        routingErrors.push(`${record.connection.label}: no collision-free route`);
        return;
      }
      const chain: OntologyPoint[] = [];
      for (let state = finalState; state >= 0; state = previous[state]) chain.push(point(state >> 1));
      chain.reverse();
      const points = compactPoints([sourcePort.point, ...chain, targetPort.point]);
      for (let index = 1; index < chain.length; index += 1) used.add(segmentKey(chain[index - 1], chain[index]));
      chain.forEach((chainPoint) => occupied.add(at(chainPoint)));
      sourcePort.stubKeys.concat(targetPort.stubKeys).forEach((key) => used.add(key));
      rawRoutes.set(record.connection.id, { points, ports: [sourcePort.point, targetPort.point] });
    });
  });

  const blockObstacles = [...positions.values(), ...referencePositions.values()];
  const toggleBoxes: OntologyBox[] = [];
  const midpointByConnection = new Map<string, { point: OntologyPoint; fraction: number }>();
  connections.forEach((connection) => {
    const route = rawRoutes.get(connection.id);
    if (!route) return;
    const fractions = [.5, .46, .54, .42, .58, .38, .62, .34, .66];
    const fraction = fractions.find((candidate) => {
      const midpoint = pointOnRoute(route.points, candidate);
      const box = { x: midpoint.x - 12, y: midpoint.y - 12, width: 24, height: 24 };
      return ![...blockObstacles, ...toggleBoxes].some((obstacle) => boxesOverlap(box, obstacle, 4));
    }) ?? .5;
    const point = pointOnRoute(route.points, fraction);
    toggleBoxes.push({ x: point.x - 12, y: point.y - 12, width: 24, height: 24, environment: positions.get(connection.source)?.environment ?? referencePositions.values().next().value?.environment ?? "model" });
    midpointByConnection.set(connection.id, { point, fraction });
  });

  const labelBoxes: OntologyBox[] = [];
  const routes = new Map<string, OntologyRoute>();
  connections.forEach((connection) => {
    const route = rawRoutes.get(connection.id);
    const midpoint = midpointByConnection.get(connection.id);
    if (!route || !midpoint) return;
    const width = Math.max(70, connection.label.length * 6.6 + 20);
    const candidates: OntologyPoint[] = [];
    [18, 48, 78, 108, 138, 168].forEach((distance) => {
      candidates.push(
        { x: midpoint.point.x - width / 2, y: midpoint.point.y - distance - 21 },
        { x: midpoint.point.x - width / 2, y: midpoint.point.y + distance },
        { x: midpoint.point.x + distance, y: midpoint.point.y - 10.5 },
        { x: midpoint.point.x - width - distance, y: midpoint.point.y - 10.5 }
      );
    });
    const environment = endpoint(connection, connection.source, true).environment;
    let labelBox = candidates
      .map((candidate) => ({ x: Math.max(34, Math.min(canvasWidth - width - 34, candidate.x)), y: candidate.y, width, height: 21, environment }))
      .find((candidate) => ![...blockObstacles, ...toggleBoxes, ...labelBoxes].some((obstacle) => boxesOverlap(candidate, obstacle, 5)));
    if (!labelBox) {
      const offsets: OntologyPoint[] = [];
      [0, -30, 30, -60, 60, -90, 90, -120, 120].forEach((dy) => [0, -90, 90, -180, 180, -270, 270].forEach((dx) => offsets.push({ x: dx, y: dy })));
      labelBox = offsets
        .map((offset) => ({
          x: Math.max(8, Math.min(canvasWidth - width - 8, midpoint.point.x - width / 2 + offset.x)),
          y: Math.max(8, midpoint.point.y - 12 + offset.y),
          width,
          height: 21,
          environment
        }))
        .find((candidate) => ![...blockObstacles, ...toggleBoxes, ...labelBoxes].some((obstacle) => boxesOverlap(candidate, obstacle, 5)));
    }
    labelBox ??= { x: midpoint.point.x - width / 2, y: midpoint.point.y - 30, width, height: 21, environment };
    labelBoxes.push(labelBox);
    routes.set(connection.id, {
      ...route,
      midpoint: midpoint.point,
      midpointFraction: midpoint.fraction,
      labelBox
    });
  });

  return {
    width: canvasWidth,
    height: y + 16,
    nodes,
    connections,
    positions,
    referencePositions,
    sections,
    routes,
    stageBounds,
    routingErrors
  };
}
