export type ModelerOntologyScope = 0 | 1 | 2;
export type ModelerOntologyEnvironment = "foundation" | "varsim" | "tradeDecision";

export interface ModelerOntologyNode {
  id: string;
  semanticId: string;
  label: string;
  kind: string;
  environment: ModelerOntologyEnvironment;
  level: ModelerOntologyScope;
  x: number;
  y: number;
  recalled?: boolean;
  optional?: boolean;
  baseline?: boolean;
}

export interface ModelerOntologyConnection {
  id: string;
  source: string;
  target: string;
  predicate: string;
  level: ModelerOntologyScope;
}

export interface ModelerOntologyActivity {
  id: ModelerOntologyEnvironment;
  label: readonly string[];
  level: ModelerOntologyScope;
  height: number;
}

export interface ModelerOntologyGroup {
  environment: ModelerOntologyEnvironment;
  y: number;
  label: string;
}

export interface ModelerOntologyPoint { x: number; y: number }
export interface ModelerOntologyBox extends ModelerOntologyPoint { width: number; height: number }
export interface ModelerOntologyRoute {
  points: ModelerOntologyPoint[];
  midpoint: ModelerOntologyPoint;
  sourcePort: ModelerOntologyPoint;
  targetPort: ModelerOntologyPoint;
}
export interface ModelerOntologyBand extends ModelerOntologyBox {
  environment: ModelerOntologyEnvironment;
  label: string;
}
export interface ModelerOntologyActivityLayout extends ModelerOntologyActivity { y: number }
export interface ModelerOntologyGroupLayout extends ModelerOntologyGroup { absoluteY: number }
export interface ModelerScopeOntologyLayout {
  width: number;
  height: number;
  nodes: ModelerOntologyNode[];
  connections: ModelerOntologyConnection[];
  positions: Map<string, ModelerOntologyBox>;
  routes: Map<string, ModelerOntologyRoute>;
  bands: ModelerOntologyBand[];
  activities: ModelerOntologyActivityLayout[];
  groups: ModelerOntologyGroupLayout[];
  routingErrors: string[];
}

export const modelerScopeLabels: Record<ModelerOntologyScope, string> = {
  0: "Architecture building",
  1: "Architecture building + simulation",
  2: "Trade Study"
};

export const modelerOntologyActivities: readonly ModelerOntologyActivity[] = [
  { id: "foundation", label: ["Mission and problem", "Requirements and", "architecture definition"], level: 0, height: 1040 },
  { id: "varsim", label: ["Variability, realization", "and simulation"], level: 1, height: 660 },
  { id: "tradeDecision", label: ["Trade Study, decision", "and baseline"], level: 2, height: 610 }
];

export const modelerOntologyGroups: readonly ModelerOntologyGroup[] = [
  { environment: "foundation", y: 24, label: "MISSION AND PROBLEM DEFINITION" },
  { environment: "foundation", y: 290, label: "REQUIREMENTS DEFINITION" },
  { environment: "foundation", y: 485, label: "PRODUCT ARCHITECTURE" },
  { environment: "foundation", y: 755, label: "INDUSTRIAL ARCHITECTURE" },
  { environment: "varsim", y: 24, label: "VARIABILITY" },
  { environment: "varsim", y: 225, label: "100% REALIZATION" },
  { environment: "varsim", y: 430, label: "SIMULATION" },
  { environment: "tradeDecision", y: 24, label: "STUDY DEFINITION" },
  { environment: "tradeDecision", y: 180, label: "CANDIDATES AND EVALUATED ALTERNATIVES" },
  { environment: "tradeDecision", y: 390, label: "COMPARISON, DECISION AND BASELINE" }
];

type NodeInput = readonly [string, string, string, ModelerOntologyEnvironment, ModelerOntologyScope, number, number, boolean?, string?];
const nodeInputs: readonly NodeInput[] = [
  ["mission", "Mission", "mission", "foundation", 0, 430, 42],
  ["system", "System of Interest", "system", "foundation", 0, 190, 125],
  ["stakeholder", "Stakeholder", "stakeholder", "foundation", 0, 425, 125],
  ["externalSystem", "External System", "externalSystem", "foundation", 0, 660, 125],
  ["need", "Need", "need", "foundation", 0, 300, 220],
  ["objective", "Objective", "objective", "foundation", 0, 445, 220],
  ["useCase", "Use Case", "useCase", "foundation", 0, 650, 220],

  ["needRequirement", "Need", "need", "foundation", 0, 180, 325, true, "need"],
  ["objectiveRequirement", "Objective", "objective", "foundation", 0, 335, 325, true, "objective"],
  ["useCaseRequirement", "Use Case", "useCase", "foundation", 0, 490, 325, true, "useCase"],
  ["verificationMethod", "Verification Method", "verificationMethod", "foundation", 0, 180, 415],
  ["systemRequirement", "System Requirement", "systemRequirement", "foundation", 0, 430, 415],

  ["useCaseProduct", "Use Case", "useCase", "foundation", 0, 170, 525, true, "useCase"],
  ["systemRequirementProduct", "System Requirement", "systemRequirement", "foundation", 0, 170, 625, true, "systemRequirement"],
  ["productFunction", "Product Function", "productFunction", "foundation", 0, 350, 525],
  ["productComponent", "Product Component", "productComponent", "foundation", 0, 350, 615],
  ["productInterface", "Product Interface", "productInterface", "foundation", 0, 350, 705],
  ["parameter", "Parameter", "parameter", "foundation", 0, 510, 525],
  ["architectureProduct", "150% Architecture", "architecture", "foundation", 0, 675, 615],

  ["useCaseIndustrial", "Use Case", "useCase", "foundation", 0, 170, 785, true, "useCase"],
  ["systemRequirementIndustrial", "System Requirement", "systemRequirement", "foundation", 0, 170, 875, true, "systemRequirement"],
  ["processFunction", "Process Function", "processFunction", "foundation", 0, 350, 785],
  ["industrialSystemComponent", "Industrial System Component", "industrialSystemComponent", "foundation", 0, 350, 875],
  ["resource", "Resource", "resource", "foundation", 0, 350, 965],
  ["processInterface", "Process Interface", "processInterface", "foundation", 0, 510, 965],
  ["architectureIndustrial", "150% Architecture", "architecture", "foundation", 0, 675, 875, true, "architecture"],

  ["tradeStudyAxis", "Trade Study", "tradeStudy", "varsim", 2, 165, 65, true, "tradeStudy"],
  ["variabilityAxis", "Variability Axis", "variabilityAxis", "varsim", 2, 315, 65],
  ["featureGroup", "Feature Group", "featureGroup", "varsim", 2, 465, 65],
  ["feature", "Feature", "feature", "varsim", 2, 630, 65],
  ["configuration", "Configuration", "configuration", "varsim", 2, 315, 150],
  ["variationPoint", "Variation Point", "variationPoint", "varsim", 2, 630, 150],
  ["configurationRealization", "Configuration", "configuration", "varsim", 2, 170, 270, true, "configuration"],
  ["architectureRealization", "150% Architecture", "architecture", "varsim", 2, 170, 350, true, "architecture"],
  ["variationPointRealization", "Variation Point", "variationPoint", "varsim", 2, 405, 270, true, "variationPoint"],
  ["realization", "100% Realization", "realization", "varsim", 2, 650, 310],
  ["parameterSimulation", "Parameter", "parameter", "varsim", 1, 165, 475, true, "parameter"],
  ["kpi", "KPI", "kpi", "varsim", 1, 315, 475],
  ["simulationRun", "Simulation Run", "simulationRun", "varsim", 1, 505, 475],
  ["simulationResult", "Simulation Result", "simulationResult", "varsim", 1, 670, 475],
  ["architectureSimulation", "150% Architecture", "architecture", "varsim", 1, 165, 555, true, "architecture"],
  ["realizationSimulation", "100% Realization", "realization", "varsim", 2, 315, 555, true, "realization"],

  ["openDecision", "Open Decision", "openDecision", "tradeDecision", 2, 165, 65],
  ["tradeStudy", "Trade Study", "tradeStudy", "tradeDecision", 2, 325, 65],
  ["studyCriterion", "Study Criterion", "studyCriterion", "tradeDecision", 2, 485, 65],
  ["kpiTrade", "KPI", "kpi", "tradeDecision", 2, 660, 65, true, "kpi"],
  ["tradeStudyOptions", "Trade Study", "tradeStudy", "tradeDecision", 2, 165, 240, true, "tradeStudy"],
  ["candidate", "Candidate", "candidate", "tradeDecision", 2, 350, 205],
  ["configurationTrade", "Configuration", "configuration", "tradeDecision", 2, 590, 205, true, "configuration"],
  ["alternative", "Alternative", "alternative", "tradeDecision", 2, 350, 305],
  ["simulationRunTrade", "Simulation Run", "simulationRun", "tradeDecision", 2, 590, 305, true, "simulationRun"],
  ["simulationResultTrade", "Simulation Result", "simulationResult", "tradeDecision", 2, 165, 455, true, "simulationResult"],
  ["comparisonResult", "Comparison Result", "comparisonResult", "tradeDecision", 2, 350, 455],
  ["alternativeDecision", "Alternative", "alternative", "tradeDecision", 2, 350, 535, true, "alternative"],
  ["decision", "Decision", "decision", "tradeDecision", 2, 535, 455],
  ["baseline", "Architecture", "architecture", "tradeDecision", 2, 700, 455]
];

export const modelerScopeOntologyNodes: readonly ModelerOntologyNode[] = nodeInputs.map(([id, label, kind, environment, level, x, y, recalled = false, semanticId = id]) => ({
  id, semanticId, label, kind, environment, level, x, y, recalled,
  optional: ["externalSystem", "verificationMethod", "productInterface", "processInterface", "resource"].includes(kind),
  baseline: id === "baseline"
}));

type ConnectionInput = readonly [string, string, string, ModelerOntologyScope];
const connectionInputs: readonly ConnectionInput[] = [
  ["mission", "hasSystemOfInterest", "system", 0], ["mission", "hasStakeholder", "stakeholder", 0], ["mission", "hasMissionParticipant", "externalSystem", 0],
  ["stakeholder", "hasNeed", "need", 0], ["stakeholder", "hasObjective", "objective", 0], ["stakeholder", "involvedInUseCase", "useCase", 0],
  ["externalSystem", "involvedInUseCase", "useCase", 0], ["useCase", "hasSubjectSystem", "system", 0], ["useCase", "addresses", "need", 0], ["useCase", "addresses", "objective", 0],
  ["needRequirement", "derivesRequirement", "systemRequirement", 0], ["objectiveRequirement", "derivesRequirement", "systemRequirement", 0], ["verificationMethod", "verifies", "systemRequirement", 0],
  ["useCaseProduct", "requiresFunction", "productFunction", 0], ["systemRequirementProduct", "satisfiedBy", "productFunction", 0], ["systemRequirementProduct", "satisfiedBy", "productComponent", 0], ["systemRequirementProduct", "evaluatedAgainst", "parameter", 0],
  ["productFunction", "realizedBy", "productComponent", 0], ["productComponent", "connects", "productInterface", 0],
  ["productFunction", "belongsToArchitecture", "architectureProduct", 0], ["productComponent", "belongsToArchitecture", "architectureProduct", 0], ["productInterface", "belongsToArchitecture", "architectureProduct", 0],
  ["useCaseIndustrial", "requiresFunction", "processFunction", 0], ["systemRequirementIndustrial", "satisfiedBy", "processFunction", 0], ["systemRequirementIndustrial", "satisfiedBy", "industrialSystemComponent", 0],
  ["processFunction", "realizedBy", "industrialSystemComponent", 0], ["industrialSystemComponent", "requiresResource", "resource", 0], ["industrialSystemComponent", "connects", "processInterface", 0],
  ["processFunction", "belongsToArchitecture", "architectureIndustrial", 0], ["industrialSystemComponent", "belongsToArchitecture", "architectureIndustrial", 0], ["resource", "belongsToArchitecture", "architectureIndustrial", 0], ["processInterface", "belongsToArchitecture", "architectureIndustrial", 0],
  ["tradeStudyAxis", "exploresAxis", "variabilityAxis", 2], ["variabilityAxis", "organizesFeatureGroup", "featureGroup", 2], ["featureGroup", "containsFeature", "feature", 2], ["configuration", "selectsFeature", "feature", 2], ["feature", "conditionsVariationPoint", "variationPoint", 2],
  ["configurationRealization", "configuresArchitecture", "architectureRealization", 2], ["configurationRealization", "derivesRealization", "realization", 2], ["architectureRealization", "isRealizedAs", "realization", 2], ["variationPointRealization", "contributesToRealization", "realization", 2],
  ["parameterSimulation", "providesInputTo", "kpi", 1], ["kpi", "isEvaluatedIn", "simulationRun", 1], ["architectureSimulation", "evaluatedBy", "simulationRun", 1], ["realizationSimulation", "evaluatedBy", "simulationRun", 2], ["simulationRun", "producesResult", "simulationResult", 1],
  ["openDecision", "initiatesStudy", "tradeStudy", 2], ["tradeStudy", "definesCriterion", "studyCriterion", 2], ["studyCriterion", "evaluatedByKpi", "kpiTrade", 2],
  ["tradeStudyOptions", "definesCandidate", "candidate", 2], ["candidate", "referencesConfiguration", "configurationTrade", 2], ["tradeStudyOptions", "evaluatesAlternative", "alternative", 2], ["alternative", "referencesSimulationRun", "simulationRunTrade", 2],
  ["simulationResultTrade", "supportsComparison", "comparisonResult", 2], ["comparisonResult", "informsDecision", "decision", 2], ["alternativeDecision", "selectedBy", "decision", 2], ["decision", "selectsArchitecture", "baseline", 2]
];

export const modelerScopeOntologyConnections: readonly ModelerOntologyConnection[] = connectionInputs.map(([source, predicate, target, level], index) => ({
  id: `modeler-scope-connection-${index + 1}`, source, target, predicate, level
}));

export function visibleModelerScopeOntology(scope: ModelerOntologyScope) {
  const nodes = modelerScopeOntologyNodes.filter(node => node.level <= scope);
  const nodeIds = new Set(nodes.map(node => node.id));
  return { nodes, connections: modelerScopeOntologyConnections.filter(connection => connection.level <= scope && nodeIds.has(connection.source) && nodeIds.has(connection.target)) };
}

const WIDTH = 1180;
const RAIL = 190;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 58;
const Y_SCALE = 1.2;
const DESIGN_CONTENT_LEFT = 154;
const DESIGN_CONTENT_RIGHT = 700;
const CONTENT_LEFT = RAIL + 20;
const CONTENT_RIGHT = WIDTH - NODE_WIDTH - 16;
const GRID = 5;
const CLEARANCE = 13;
type Side = "top" | "right" | "bottom" | "left";
interface Port extends ModelerOntologyPoint { side: Side }

const environmentLabels: Record<ModelerOntologyEnvironment, string> = {
  foundation: "MODELLING",
  varsim: "VARIABILITY / REALIZATION / SIMULATION",
  tradeDecision: "TRADE STUDY / DECISION / BASELINE"
};

const sideOverrides: Readonly<Record<string, readonly [Side, Side]>> = {
  "useCase->system": ["right", "bottom"],
  "systemRequirementProduct->parameter": ["left", "left"],
  "industrialSystemComponent->processInterface": ["left", "left"],
  "resource->architectureIndustrial": ["right", "left"],
  "realizationSimulation->simulationRun": ["right", "bottom"],
  "architectureSimulation->simulationRun": ["right", "left"],
  "configurationRealization->realization": ["right", "top"]
};

function roundGrid(value: number) { return Math.round(value / GRID) * GRID; }
function endpointKey(connection: ModelerOntologyConnection, source: boolean) { return `${connection.id}:${source ? "source" : "target"}`; }
function preferredSides(source: ModelerOntologyBox, target: ModelerOntologyBox, positions: Map<string, ModelerOntologyBox>): [Side, Side] {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const dx = targetCenter.x - sourceCenter.x, dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dy) < NODE_HEIGHT * 1.45 && Math.abs(dx) > NODE_WIDTH * .35) {
    const left = Math.min(source.x + NODE_WIDTH, target.x + NODE_WIDTH), right = Math.max(source.x, target.x);
    const blocked = [...positions.values()].some(box => box !== source && box !== target && box.x < right && box.x + NODE_WIDTH > left && box.y < sourceCenter.y && box.y + NODE_HEIGHT > sourceCenter.y);
    if (!blocked) return dx >= 0 ? ["right", "left"] : ["left", "right"];
    return ["bottom", "bottom"];
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}
function port(box: ModelerOntologyBox, side: Side, index: number, count: number): Port {
  const fraction = (index + 1) / (count + 1);
  if (side === "top") return { x: roundGrid(box.x + NODE_WIDTH * fraction), y: box.y, side };
  if (side === "bottom") return { x: roundGrid(box.x + NODE_WIDTH * fraction), y: box.y + NODE_HEIGHT, side };
  if (side === "left") return { x: box.x, y: roundGrid(box.y + NODE_HEIGHT * fraction), side };
  return { x: box.x + NODE_WIDTH, y: roundGrid(box.y + NODE_HEIGHT * fraction), side };
}
function outsidePort(value: Port, distance = 20) {
  if (value.side === "top") return { x: value.x, y: value.y - distance };
  if (value.side === "bottom") return { x: value.x, y: value.y + distance };
  if (value.side === "left") return { x: value.x - distance, y: value.y };
  return { x: value.x + distance, y: value.y };
}
function simplify(points: ModelerOntologyPoint[]) {
  return points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y).filter((point, index, all) => !index || index === all.length - 1 || !((all[index - 1].x === point.x && point.x === all[index + 1].x) || (all[index - 1].y === point.y && point.y === all[index + 1].y)));
}
function halfway(points: ModelerOntologyPoint[]) {
  const lengths = points.slice(1).map((point, index) => Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index]) {
      const first = points[index], second = points[index + 1], ratio = lengths[index] ? remaining / lengths[index] : 0;
      return { x: first.x + (second.x - first.x) * ratio, y: first.y + (second.y - first.y) * ratio };
    }
    remaining -= lengths[index];
  }
  return points[0];
}

class MinHeap<T extends { priority: number }> {
  private items: T[] = [];
  push(item: T) { this.items.push(item); let index = this.items.length - 1; while (index) { const parent = (index - 1) >> 1; if (this.items[parent].priority <= item.priority) break; this.items[index] = this.items[parent]; index = parent; } this.items[index] = item; }
  pop() { const first = this.items[0], last = this.items.pop(); if (this.items.length && last) { let index = 0; while (true) { let child = index * 2 + 1; if (child >= this.items.length) break; if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child += 1; if (this.items[child].priority >= last.priority) break; this.items[index] = this.items[child]; index = child; } this.items[index] = last; } return first; }
  get size() { return this.items.length; }
}

function buildPorts(connections: ModelerOntologyConnection[], positions: Map<string, ModelerOntologyBox>) {
  const records = connections.map((connection, index) => {
    const source = positions.get(connection.source)!, target = positions.get(connection.target)!;
    let [sourceSide, targetSide] = preferredSides(source, target, positions);
    const override = sideOverrides[`${connection.source}->${connection.target}`];
    if (override) [sourceSide, targetSide] = override;
    return { connection, index, source, target, sourceSide, targetSide };
  });
  const groups = new Map<string, Array<{ record: typeof records[number]; source: boolean; other: number }>>();
  const add = (record: typeof records[number], source: boolean, id: string, side: Side, other: number) => { const key = `${id}|${side}`, group = groups.get(key) ?? []; group.push({ record, source, other }); groups.set(key, group); };
  records.forEach(record => {
    const sourceCenter = { x: record.source.x + NODE_WIDTH / 2, y: record.source.y + NODE_HEIGHT / 2 }, targetCenter = { x: record.target.x + NODE_WIDTH / 2, y: record.target.y + NODE_HEIGHT / 2 };
    add(record, true, record.connection.source, record.sourceSide, record.sourceSide === "top" || record.sourceSide === "bottom" ? targetCenter.x : targetCenter.y);
    add(record, false, record.connection.target, record.targetSide, record.targetSide === "top" || record.targetSide === "bottom" ? sourceCenter.x : sourceCenter.y);
  });
  const ports = new Map<string, Port>();
  groups.forEach(group => {
    group.sort((first, second) => first.other - second.other || first.record.index - second.record.index);
    group.forEach((entry, index) => ports.set(endpointKey(entry.record.connection, entry.source), port(entry.source ? entry.record.source : entry.record.target, entry.source ? entry.record.sourceSide : entry.record.targetSide, index, group.length)));
  });
  return ports;
}

function createRouter(positions: Map<string, ModelerOntologyBox>, height: number) {
  const columns = Math.floor(WIDTH / GRID), rows = Math.floor(height / GRID);
  const blocked = Array.from({ length: rows + 1 }, () => new Uint8Array(columns + 1));
  positions.forEach(box => {
    const left = box.x - CLEARANCE, right = box.x + box.width + CLEARANCE, top = box.y - CLEARANCE, bottom = box.y + box.height + CLEARANCE;
    for (let row = 0; row <= rows; row += 1) { const y = row * GRID; if (y <= top || y >= bottom) continue; for (let column = 0; column <= columns; column += 1) { const x = column * GRID; if (x > left && x < right) blocked[row][column] = 1; } }
  });
  const usedSegments = new Set<string>(), usedPoints = new Set<string>();
  const segmentKey = (ax: number, ay: number, bx: number, by: number) => ax < bx || (ax === bx && ay <= by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
  const grid = (point: ModelerOntologyPoint) => ({ column: Math.max(1, Math.min(columns - 1, Math.round(point.x / GRID))), row: Math.max(1, Math.min(rows - 1, Math.round(point.y / GRID))) });
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  function reserve(points: ModelerOntologyPoint[]) {
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1], second = points[index];
      if (first.x === second.x && Math.abs(first.x / GRID - Math.round(first.x / GRID)) < .01) { const column = Math.round(first.x / GRID), low = Math.ceil(Math.min(first.y, second.y) / GRID), high = Math.floor(Math.max(first.y, second.y) / GRID); for (let row = low; row < high; row += 1) { usedSegments.add(segmentKey(column, row, column, row + 1)); usedPoints.add(`${column},${row}`); usedPoints.add(`${column},${row + 1}`); } }
      else if (first.y === second.y && Math.abs(first.y / GRID - Math.round(first.y / GRID)) < .01) { const row = Math.round(first.y / GRID), low = Math.ceil(Math.min(first.x, second.x) / GRID), high = Math.floor(Math.max(first.x, second.x) / GRID); for (let column = low; column < high; column += 1) { usedSegments.add(segmentKey(column, row, column + 1, row)); usedPoints.add(`${column},${row}`); usedPoints.add(`${column + 1},${row}`); } }
    }
  }
  function find(start: ReturnType<typeof grid>, goal: ReturnType<typeof grid>) {
    type State = typeof start & { direction: number; score: number; priority: number; key: string };
    const heap = new MinHeap<State>(), scores = new Map<string, number>(), previous = new Map<string, string>();
    const startKey = `${start.column},${start.row},4`;
    scores.set(startKey, 0); heap.push({ ...start, direction: 4, score: 0, priority: Math.abs(goal.column - start.column) + Math.abs(goal.row - start.row), key: startKey });
    let final: State | undefined;
    while (heap.size) {
      const current = heap.pop()!;
      if (current.score !== scores.get(current.key)) continue;
      if (current.column === goal.column && current.row === goal.row) { final = current; break; }
      for (let direction = 0; direction < directions.length; direction += 1) {
        const column = current.column + directions[direction][0], row = current.row + directions[direction][1];
        if (column < 1 || column >= columns || row < 1 || row >= rows) continue;
        if (blocked[row][column] && !(column === goal.column && row === goal.row)) continue;
        const segment = segmentKey(current.column, current.row, column, row);
        if (usedSegments.has(segment) || (usedPoints.has(`${column},${row}`) && !(column === goal.column && row === goal.row))) continue;
        const score = current.score + 1 + (current.direction !== 4 && current.direction !== direction ? 2.8 : 0), key = `${column},${row},${direction}`;
        if (score >= (scores.get(key) ?? Infinity)) continue;
        scores.set(key, score); previous.set(key, current.key);
        heap.push({ column, row, direction, score, priority: score + Math.abs(goal.column - column) + Math.abs(goal.row - row), key });
      }
    }
    if (!final) return undefined;
    const points: Array<ModelerOntologyPoint & { column: number; row: number }> = [];
    let key: string | undefined = final.key;
    while (key) { const [column, row] = key.split(",").map(Number); points.push({ column, row, x: column * GRID, y: row * GRID }); key = previous.get(key); }
    return points.reverse();
  }
  return (sourcePort: Port, targetPort: Port) => {
    const sourceOutside = outsidePort(sourcePort), targetOutside = outsidePort(targetPort), start = grid(sourceOutside), goal = grid(targetOutside);
    blocked[start.row][start.column] = 0; blocked[goal.row][goal.column] = 0;
    const route = find(start, goal);
    if (!route) return undefined;
    const first = route[0], last = route.at(-1)!;
    const points: ModelerOntologyPoint[] = [sourcePort, sourceOutside];
    if (sourceOutside.x !== first.x && sourceOutside.y !== first.y) points.push(sourcePort.side === "top" || sourcePort.side === "bottom" ? { x: first.x, y: sourceOutside.y } : { x: sourceOutside.x, y: first.y });
    points.push({ x: first.x, y: first.y }, ...route.slice(1, -1).map(point => ({ x: point.x, y: point.y })), { x: last.x, y: last.y });
    if (targetOutside.x !== last.x && targetOutside.y !== last.y) points.push(targetPort.side === "top" || targetPort.side === "bottom" ? { x: last.x, y: targetOutside.y } : { x: targetOutside.x, y: last.y });
    points.push(targetOutside, targetPort);
    const simplified = simplify(points); reserve(simplified); return simplified;
  };
}

export function buildModelerScopeOntologyLayout(scope: ModelerOntologyScope): ModelerScopeOntologyLayout {
  const view = visibleModelerScopeOntology(scope);
  const activities = modelerOntologyActivities.filter(activity => activity.level <= scope).map(activity => ({ ...activity, height: (scope === 1 && activity.id === "varsim" ? 220 : activity.height) * Y_SCALE }));
  const activityLayouts: ModelerOntologyActivityLayout[] = [];
  let y = 0;
  activities.forEach(activity => { activityLayouts.push({ ...activity, y }); y += activity.height; });
  const activityById = new Map(activityLayouts.map(activity => [activity.id, activity]));
  const positions = new Map<string, ModelerOntologyBox>();
  view.nodes.forEach(node => {
    const activity = activityById.get(node.environment)!;
    const shift = scope === 1 && node.environment === "varsim" ? -430 : 0;
    const scaledX = CONTENT_LEFT + (node.x - DESIGN_CONTENT_LEFT) * (CONTENT_RIGHT - CONTENT_LEFT) / (DESIGN_CONTENT_RIGHT - DESIGN_CONTENT_LEFT);
    positions.set(node.id, { x: roundGrid(scaledX), y: roundGrid(activity.y + (node.y + shift) * Y_SCALE), width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  const bands = activityLayouts.map(activity => ({ x: RAIL, y: activity.y, width: WIDTH - RAIL, height: activity.height, environment: activity.id, label: environmentLabels[activity.id] }));
  const groups = modelerOntologyGroups.filter(group => activityById.has(group.environment)).flatMap(group => { const shift = scope === 1 && group.environment === "varsim" ? -430 : 0; if (group.y + shift < 0) return []; return [{ ...group, absoluteY: activityById.get(group.environment)!.y + (group.y + shift) * Y_SCALE }]; });
  const ports = buildPorts([...view.connections], positions), router = createRouter(positions, y), routes = new Map<string, ModelerOntologyRoute>(), routingErrors: string[] = [];
  [...view.connections].map(connection => { const source = positions.get(connection.source)!, target = positions.get(connection.target)!; return { connection, distance: Math.abs(source.x - target.x) + Math.abs(source.y - target.y) }; }).sort((first, second) => first.distance - second.distance || first.connection.id.localeCompare(second.connection.id)).forEach(({ connection }) => {
    const sourcePort = ports.get(endpointKey(connection, true))!, targetPort = ports.get(endpointKey(connection, false))!, points = router(sourcePort, targetPort);
    if (!points) { routingErrors.push(`No route for ${connection.source} → ${connection.predicate} → ${connection.target}`); return; }
    routes.set(connection.id, { points, midpoint: halfway(points), sourcePort, targetPort });
  });
  return { width: WIDTH, height: y, nodes: view.nodes, connections: view.connections, positions, routes, bands, activities: activityLayouts, groups, routingErrors };
}
