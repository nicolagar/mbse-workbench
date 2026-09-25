import type { SemanticGraph, SemanticPredicate, SemanticRole } from "./semanticGraphTypes";
export interface TraceOptions { direction?: "upstream" | "downstream" | "both"; roles?: readonly SemanticRole[]; predicates?: readonly SemanticPredicate[]; maxDepth?: number }
export const getNode = (g: SemanticGraph, id: string) => g.nodes.find(n => n.id === id);
export function traceSemanticGraph(g: SemanticGraph, startId: string, options: TraceOptions = {}): SemanticGraph {
  const selected = new Set<string>(g.nodes.some(n => n.id === startId) ? [startId] : []), edgeIds = new Set<string>();
  const adjacency = new Map<string, typeof g.edges[number][]>();
  const direction = options.direction ?? "both";
  for (const e of g.edges) {
    if (options.roles && !options.roles.includes(e.role) || options.predicates && !options.predicates.includes(e.predicate)) continue;
    const keys = direction === "upstream" ? [e.target] : direction === "downstream" ? [e.source] : [e.source, e.target];
    for (const key of keys) { const list = adjacency.get(key) ?? []; list.push(e); adjacency.set(key, list); }
  }
  let frontier = [...selected];
  for (let depth = 0; frontier.length && depth < (options.maxDepth ?? g.nodes.length); depth++) {
    const next: string[] = [];
    for (const id of frontier) for (const e of adjacency.get(id) ?? []) {
      edgeIds.add(e.id); const neighbor = e.source === id ? e.target : e.source;
      if (!selected.has(neighbor)) { selected.add(neighbor); next.push(neighbor); }
    }
    frontier = next;
  }
  return { ...g, nodes: g.nodes.filter(n => selected.has(n.id)), edges: g.edges.filter(e => edgeIds.has(e.id)) };
}
export const traceCanonical = (g: SemanticGraph, id: string, options: Omit<TraceOptions, "roles"> = {}) => traceSemanticGraph(g, id, { ...options, roles: ["canonical"] });
export const neighbors = (g: SemanticGraph, id: string, options: TraceOptions = {}) => traceSemanticGraph(g, id, { ...options, maxDepth: 1 });
export const getEvidence = (g: SemanticGraph, id: string) => traceSemanticGraph(g, id, { roles: ["evidence"] });
export const explainProvenance = (g: SemanticGraph, id: string) => g.edges.filter(e => e.source === id || e.target === id).map(e => ({ predicate: e.predicate, source: e.authoritativeSource, provenance: e.provenance }));
export function findPath(g: SemanticGraph, source: string, target: string, options: TraceOptions = {}): readonly string[] {
  const queue: string[][] = [[source]], visited = new Set([source]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i], current = path[path.length - 1]; if (current === target && getNode(g, current)) return path;
    if (path.length - 1 >= (options.maxDepth ?? g.nodes.length)) continue;
    for (const n of neighbors(g, current, options).nodes) if (!visited.has(n.id)) { visited.add(n.id); queue.push([...path, n.id]); }
  }
  return [];
}
