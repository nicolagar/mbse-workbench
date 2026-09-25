import { ONTOLOGY_VERSION } from "./ontologyRegistry";
import { GraphBuilder, SemanticContractError } from "./semanticGraphBuilder";
import { decisionAdapter, governanceAdapter } from "./semanticGraphDecision";
import { derivationAdapter, evidenceIndexAdapter, simulationAdapter } from "./semanticGraphEvidence";
import { canonicalJson, compareText, fingerprint } from "./semanticGraphIdentity";
import { architectureAdapter, modelAdapter } from "./semanticGraphModel";
import { variabilityAdapter } from "./semanticGraphVariability";
import type { DeepReadonly, SemanticContext, SemanticGraphBuildResult } from "./semanticGraphTypes";
import type { Project } from "./types";
export function buildSemanticGraph(project: DeepReadonly<Project>, options: { context?: SemanticContext } = {}): SemanticGraphBuildResult {
  const context = options.context ?? { type: "live" };
  const b = new GraphBuilder(project.id, context);
  const adapter = (name: string, fn: () => void) => { try { fn(); } catch (error) { if (error instanceof SemanticContractError) throw error; b.warn("SG-BUILD-ADAPTER", `${name}: ${error instanceof Error ? error.message : "failed"}`, name); } };
  if (context.type === "live") {
    adapter("architectures", () => architectureAdapter(b, project));
    adapter("model", () => modelAdapter(b, project.elements, project.relationships, project.kpis, "Project"));
    adapter("variability", () => variabilityAdapter(b, project, id => ({ kind: project.elements.find(e => e.id === id)?.elementType ?? "systemRequirement", id })));
    adapter("evidence", () => evidenceIndexAdapter(b, project));
    adapter("governance", () => governanceAdapter(b, project));
  } else if (context.type === "derivation") {
    const d = project.configurations.find(c => c.id === context.configurationId)?.derivation;
    if (!d || d.id !== context.derivationId) b.warn("SG-CTX-UNAVAILABLE", "Requested derivation is no longer available; current derivation was not substituted.", canonicalJson(context));
    else adapter("derivation", () => derivationAdapter(b, d));
  } else if (context.type === "simulation") {
    const run = project.simulationRuns.find(r => r.id === context.simulationRunId);
    if (!run) b.warn("SG-CTX-UNAVAILABLE", "Requested simulation is unavailable.", canonicalJson(context));
    else adapter("simulation", () => simulationAdapter(b, run, true));
  } else {
    const decision = project.decisions.find(d => d.id === context.decisionId);
    if (!decision) b.warn("SG-CTX-UNAVAILABLE", "Requested decision is unavailable.", canonicalJson(context));
    else adapter("decision", () => decisionAdapter(b, project, decision, true));
  }
  let graph = b.finish();
  // Relationship targets remain metadata references to actual graph edges, not fabricated nodes.
  const edgeByRelationship = new Map(graph.edges.filter(e => e.provenance.type === "storedRelationship").map(e => [e.provenance.type === "storedRelationship" ? e.provenance.relationshipId : "", e.id]));
  graph = { ...graph, nodes: graph.nodes.map(n => n.kind !== "variationPoint" && n.kind !== "realization" ? n : { ...n, attributes: { ...n.attributes, ...(n.kind === "variationPoint" ? { affectedSemanticEdgeIds: ((n.attributes.affectedRelationshipIds ?? []) as string[]).flatMap(id => edgeByRelationship.has(id) ? [edgeByRelationship.get(id)!] : []) } : { realizedSemanticEdgeIds: context.type === "live" ? [] : [...edgeByRelationship.values()].sort() }) } }) };
  const diagnostics = [...new Map(b.diagnostics.map(d => [canonicalJson(d), d])).values()].sort((a, b) => compareText(canonicalJson(a), canonicalJson(b)));
  return { graph, diagnostics, completeness: diagnostics.length ? "partial" : "complete", sourceFingerprint: fingerprint({ ontology: ONTOLOGY_VERSION, projectId: project.id, ...(context.type === "live" ? { modelRevision: project.modelRevision, activeArchitectureId: project.activeArchitectureId, baselineArchitectureId: project.baselineArchitectureId } : {}), context, nodes: graph.nodes.map(n => [n.id, n.label, n.description, n.lifecycleState, n.resolution, n.source.locator, n.attributes]), edges: graph.edges.map(e => [e.id, e.provenance, e.attributes]), diagnostics }) };
}
