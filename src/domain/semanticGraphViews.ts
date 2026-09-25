import { elementTypes } from "./types";
import type { SemanticGraph } from "./semanticGraphTypes";
import { findPath, traceSemanticGraph } from "./semanticGraphTraversal";
export function studySemanticView(graph: SemanticGraph, studyId: string): SemanticGraph {
  const nodes = graph.nodes.filter(n => n.kind !== "tradeStudy" || n.recordId === studyId).filter(n => !["studyCriterion", "alternative", "candidate", "comparisonResult"].includes(n.kind) || n.ownerId === studyId);
  const ids = new Set(nodes.map(n => n.id));
  const scoped = { ...graph, nodes, edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
  const study = nodes.find(n => n.kind === "tradeStudy" && n.recordId === studyId);
  return study ? traceSemanticGraph(scoped, study.id) : { ...scoped, nodes: [], edges: [] };
}
export function architectSemanticView(graph: SemanticGraph, visibleElementIds: ReadonlySet<string>): SemanticGraph {
  const nodes = graph.nodes.filter(n => elementTypes.some(kind => kind === n.kind) && visibleElementIds.has(n.recordId));
  const ids = new Set(nodes.map(n => n.id));
  return { ...graph, nodes, edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
}

const digitalThreadRoles = ["canonical", "supporting", "evidence"] as const;

/**
 * Produces a readable workflow trace from Mission through the available
 * engineering, variability, evidence and decision milestones to the confirmed
 * baseline. Traversal is bidirectional for navigation, while every returned
 * edge retains its authoritative stored direction.
 */
export function missionToBaselineSemanticView(graph: SemanticGraph): SemanticGraph {
  const ordered = (kind: string) => graph.nodes.filter(node => node.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
  const missions = ordered("mission");
  const baselines = ordered("architecture").filter(node => node.attributes.isBaseline === true || node.lifecycleState === "baseline");
  if (!missions.length || !baselines.length) return { ...graph, nodes: [], edges: [] };

  const selectedNodeIds = new Set<string>();
  const selectedEdgeIds = new Set<string>();
  let current = missions[0];
  selectedNodeIds.add(current.id);
  const milestones = ["systemRequirement", "architecture", "configuration", "realization", "simulationRun", "tradeStudy", "decision"];
  const targets = [...milestones.map(kind => ordered(kind)), baselines];

  for (const candidates of targets) {
    const choices = candidates.map(target => ({ target, path: findPath(graph, current.id, target.id, { direction: "both", roles: digitalThreadRoles }) }))
      .filter(choice => choice.path.length > 0)
      .sort((a, b) => a.path.length - b.path.length || a.target.id.localeCompare(b.target.id));
    const choice = choices[0];
    if (!choice) continue;
    choice.path.forEach(id => selectedNodeIds.add(id));
    choice.path.slice(1).forEach((id, index) => {
      const previous = choice.path[index];
      graph.edges.filter(edge => digitalThreadRoles.includes(edge.role as typeof digitalThreadRoles[number])
        && (edge.source === previous && edge.target === id || edge.source === id && edge.target === previous))
        .forEach(edge => selectedEdgeIds.add(edge.id));
    });
    current = choice.target;
  }

  return {
    ...graph,
    nodes: graph.nodes.filter(node => selectedNodeIds.has(node.id)),
    edges: graph.edges.filter(edge => selectedEdgeIds.has(edge.id))
  };
}
