import type { SemanticGraph } from "./semanticGraphTypes";
export const semanticLanes = ["context", "problem", "solution", "variability", "evidence", "decision"] as const;
export interface SemanticBox { x: number; y: number; width: number; height: number }
export interface SemanticPoint { x: number; y: number }
// Fixed geometry, independent of label expansion, selection, search and zoom. No layout writes.
export function layoutSemanticGraph(graph: SemanticGraph) {
  const positions = new Map<string, SemanticBox>();
  const bands: (SemanticBox & { id: string })[] = [];
  let y = 64;
  for (const lane of semanticLanes) {
    const nodes = graph.nodes.filter(n => n.domain === lane);
    if (!nodes.length) continue;
    const ranks: Record<string, number> = { mission: 0, system: 1, stakeholder: 1, externalSystem: 1, useCase: 0, need: 1, objective: 1, systemRequirement: 2, productFunction: 0, processFunction: 0, productComponent: 1, industrialSystemComponent: 1, productInterface: 2, processInterface: 2, resource: 2, architecture: 3, parameter: 4, featureModel: 0, featureGroup: 1, variabilityAxis: 1, feature: 2, variationPoint: 3, configuration: 4, realization: 5, kpi: 0, verificationMethod: 1, simulationRun: 2, simulationResult: 3, comparisonResult: 4, openDecision: 0, tradeStudy: 1, studyCriterion: 2, candidate: 3, alternative: 4, decision: 5, risk: 6 };
    const levels = [...new Set(nodes.map(n => ranks[n.kind] ?? 9))].sort((a,b) => a-b);
    const rows = levels.flatMap(level => { const group = nodes.filter(n => (ranks[n.kind] ?? 9) === level); return Array.from({ length: Math.ceil(group.length / 3) }, (_,i) => group.slice(i * 3, i * 3 + 3)); });
    const height = rows.length * 140 + 60;
    bands.push({ id: lane, x: 24, y: y - 36, width: 1000, height });
    rows.forEach((row, index) => row.forEach((n, col) => positions.set(n.id, { x: 56 + (3 - row.length) * 158 + col * 316, y: y + index * 140 + 20, width: 248, height: 72 })));
    y += height + 32;
  }
  const ports = new Map<string, string[]>();
  for (const e of graph.edges) for (const id of [e.source, e.target]) { const ids = ports.get(id) ?? []; ids.push(e.id); ports.set(id, ids); }
  const routes = new Map<string, { points: SemanticPoint[]; midpoint: SemanticPoint; labelBox: SemanticBox }>();
  const positionEntries = [...positions.entries()];
  const occupied: SemanticBox[] = [];

  const overlaps = (a: SemanticBox, b: SemanticBox) => a.x < b.x + b.width + 6 && a.x + a.width + 6 > b.x && a.y < b.y + b.height + 6 && a.y + a.height + 6 > b.y;
  graph.edges.forEach((e, index) => {
    const s = positions.get(e.source), t = positions.get(e.target); if (!s || !t) return;
    const port = (id: string, box: SemanticBox) => box.x + 12 + (box.width - 24) * ((ports.get(id)!.indexOf(e.id) + 1) / (ports.get(id)!.length + 1));
    const sx = port(e.source, s), tx = port(e.target, t), track = 1056 + index * 5;
    const sy = s.y + s.height, ty = t.y;
    const exit = sy + 14 + (index % 4) * 5, entry = ty - 14 - (index % 4) * 5;
    let points = [{ x: sx, y: sy }, { x: sx, y: exit }, { x: track, y: exit }, { x: track, y: entry }, { x: tx, y: entry }, { x: tx, y: ty }];
    if (ty > sy) {
      const midY = (sy + ty) / 2;
      const direct = [{ x: sx, y: sy }, { x: sx, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }];
      const blocked = direct.slice(1).some((end, i) => positionEntries.some(([id, box]) => {
        if (id === e.source || id === e.target) return false;
        const start = direct[i];
        return start.x === end.x ? start.x > box.x - 5 && start.x < box.x + box.width + 5 && Math.max(start.y, end.y) > box.y - 5 && Math.min(start.y, end.y) < box.y + box.height + 5 : start.y > box.y - 5 && start.y < box.y + box.height + 5 && Math.max(start.x, end.x) > box.x - 5 && Math.min(start.x, end.x) < box.x + box.width + 5;
      }));
      if (!blocked) points = direct;
    }
    const segments = points.slice(1).map((end, i) => ({ start: points[i], end, length: Math.abs(end.x - points[i].x) + Math.abs(end.y - points[i].y) })).sort((a,b) => b.length - a.length);
    let midpoint: SemanticPoint | undefined;
    for (const segment of segments) {
      const { start, end, length } = segment;
      if (!length) continue;
      for (let offset = 0; offset < length / 2 - 12; offset += 28) {
        for (const sign of [1, -1]) {
          const ratio = .5 + sign * offset / length;
          const point = { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
          const box = { x: point.x - 10, y: point.y - 10, width: 20, height: 20 };
          if (!occupied.some(other => overlaps(box, other))) { midpoint = point; occupied.push(box); break; }
        }
        if (midpoint) break;
      }
      if (midpoint) break;
    }
    // The outer vertical track always remains available for very dense exceptional graphs.
    midpoint ??= { x: track, y: Math.max(exit, entry) + 28 + index * 28 };
    const labelBox = { x: midpoint.x + 20, y: midpoint.y - 14, width: 240, height: 28 };
    routes.set(e.id, { points, midpoint, labelBox });
  });
  const labels: SemanticBox[] = [];
  for (const route of routes.values()) {
    let chosen: SemanticBox | undefined;
    for (let offset = 0; offset <= 360 && !chosen; offset += 36) for (const sign of [1, -1]) {
      for (const x of [route.midpoint.x + 20, route.midpoint.x - 260, route.midpoint.x - 120]) {
        const box = { x: Math.max(24, x), y: Math.max(24, route.midpoint.y - 14 + sign * offset), width: 240, height: 28 };
        if (![...positionEntries.map(([, box]) => box), ...occupied, ...labels].some(other => overlaps(box, other))) { chosen = box; break; }
      }
      if (chosen) break;
    }
    route.labelBox = chosen ?? { x: 1110 + graph.edges.length * 5, y: 40 + labels.length * 36, width: 240, height: 28 };
    labels.push(route.labelBox);
  }
  return { positions, bands, routes, width: Math.max(1080, 1120 + graph.edges.length * 5, ...labels.map(box => box.x + box.width + 30)), height: Math.max(y + 40, ...labels.map(box => box.y + box.height + 30)) };
}
