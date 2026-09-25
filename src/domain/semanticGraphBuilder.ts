import { acceptsEndpoints, nodeDomain, predicateById, semanticNodeKinds, type SemanticNodeKind, type SemanticPredicate } from "./ontologyRegistry";
import { canonicalJson, compareText, recordKey, semanticEdgeId, semanticNodeId } from "./semanticGraphIdentity";
import type { SemanticContext, SemanticDiagnostic, SemanticEdge, SemanticNode, SemanticProvenance } from "./semanticGraphTypes";
export interface Ref { kind: SemanticNodeKind; id: string; ownerId?: string }
export const ref = (kind: SemanticNodeKind, id: string, ownerId?: string): Ref => ({ kind, id, ownerId });
export class SemanticContractError extends Error {}
export class GraphBuilder {
  readonly nodes = new Map<string, SemanticNode>();
  readonly diagnostics: SemanticDiagnostic[] = [];
  private pending: { source: Ref; target: Ref; predicate: SemanticPredicate; locator: string; provenance: SemanticProvenance; attributes: Record<string, unknown> }[] = [];
  constructor(readonly projectId: string, readonly context: SemanticContext) {}
  warn(code: string, message: string, locator: string) { this.diagnostics.push({ code, message, locator, severity: "warning" }); }
  each<T>(items: readonly T[] | undefined, locator: string, fn: (item: T) => void) {
    if (!items) return;
    if (!Array.isArray(items)) { this.warn("SG-BUILD-COLLECTION", "Expected a collection.", locator); return; }
    const seen = new Set<string>();
    // Stable collision winner, independent of input ordering.
    for (const { item } of items.map(item => ({ item, key: canonicalJson(item) })).sort((a, b) => compareText(a.key, b.key))) {
      const id = (item as { id?: string })?.id;
      if (typeof id === "string" && seen.has(id)) { this.warn("SG-ID-COLLISION", `Duplicate record ID ${id}; deterministic first retained.`, locator); continue; }
      if (typeof id === "string") seen.add(id);
      try { fn(item); } catch (error) { if (error instanceof SemanticContractError) throw error;
        this.warn("SG-BUILD-RECORD", error instanceof Error ? error.message : "Record could not be projected.", `${locator}:${(item as { id?: string })?.id ?? "unknown"}`); }
    }
  }
  node(r: Ref, label: string, locator: string, attributes: Record<string, unknown> = {}, description = "", lifecycleState?: string, resolution?: SemanticNode["resolution"]): Ref {
    if (!semanticNodeKinds.includes(r.kind)) throw new Error(`Unknown node kind ${r.kind}.`);
    if (!r.id || typeof r.id !== "string") throw new Error("Record has no stable ID.");
    const key = recordKey(r.kind, r.id, r.ownerId);
    const node: SemanticNode = { id: semanticNodeId(this.context, r.kind, r.id, r.ownerId), recordId: r.id, ownerId: r.ownerId, kind: r.kind, label: label || r.id,
      domain: nodeDomain(r.kind), description, context: this.context, resolution: resolution ?? (this.context.type === "live" ? "live" : "frozen"), lifecycleState,
      source: { projectId: this.projectId, context: this.context, locator }, attributes: JSON.parse(canonicalJson(attributes)) };
    const previous = this.nodes.get(key);
    if (previous) {
      if (canonicalJson(previous) !== canonicalJson(node)) this.warn("SG-ID-COLLISION", `Conflicting identity ${r.id}; deterministic first record retained.`, locator);
    } else this.nodes.set(key, node);
    return r;
  }
  reference(r: Ref, locator: string, displayLabel?: string) {
    const key = recordKey(r.kind, r.id, r.ownerId);
    const previous = this.nodes.get(key);
    if (previous?.attributes.referenceOnly && compareText(locator, previous.source.locator) < 0) this.nodes.set(key, { ...previous, source: { ...previous.source, locator } });
    if (!previous) this.node(r, displayLabel ?? r.id, locator, { referenceOnly: true }, "Identity captured by an authoritative reference; definition is not captured.", undefined, displayLabel ? "currentDisplayFallback" : "frozen");
    return r;
  }
  edge(source: Ref, target: Ref, predicate: SemanticPredicate, locator: string, provenance?: SemanticProvenance, attributes: Record<string, unknown> = {}) {
    if (!predicateById.has(predicate)) throw new SemanticContractError(`Unregistered predicate: ${predicate}`);
    const inverseOwner = ["containsFeature", "containsFeatureGroup", "providesInputTo", "providesInputToParameter", "providesInputToKpi", "evaluatedBy", "providesEvidenceInput", "initiatesStudy", "drivesCriterion", "constrainsCriterion", "informsDecision"].includes(predicate);
    const inferred: SemanticProvenance = this.context.type === "live"
      ? { type: "typedReference", ownerId: inverseOwner ? target.id : source.id, field: locator }
      : { type: "historicalSnapshot", ownerId: this.context.type === "derivation" ? this.context.derivationId : this.context.type === "simulation" ? this.context.simulationRunId : this.context.decisionId, field: locator };
    this.pending.push({ source, target, predicate, locator, provenance: provenance ?? inferred, attributes });
  }
  finish() {
    const edges = new Map<string, SemanticEdge>();
    const resolve = (r: Ref, locator: string) => {
      const exact = this.nodes.get(recordKey(r.kind, r.id, r.ownerId));
      if (exact) return exact;
      // Parameter IDs are operationally referenced without owner; ambiguity must never guess.
      const matches = r.ownerId === undefined ? [...this.nodes.values()].filter(n => n.kind === r.kind && n.recordId === r.id) : [];
      if (matches.length === 1) return matches[0];
      this.warn(matches.length ? "SG-REF-AMBIGUOUS" : "SG-REF-MISSING", `${r.kind} ${r.id} ${matches.length ? "has multiple owners" : "is unavailable"}.`, locator);
      this.node(ref("unresolvedReference", recordKey(r.kind, r.id, r.ownerId)), `${r.kind}: ${r.id}`, locator, { expectedKind: r.kind, expectedId: r.id }, "Reference could not be resolved.", undefined, "unresolved");
    };
    for (const { p } of this.pending.map(p => ({ p, key: canonicalJson(p) })).sort((a, b) => compareText(a.key, b.key))) {
      const source = resolve(p.source, p.locator), target = resolve(p.target, p.locator);
      if (!source || !target) continue;
      if (!acceptsEndpoints(p.predicate, source.kind, target.kind)) { this.warn("SG-PRED-ENDPOINT", `${source.kind} → ${p.predicate} → ${target.kind} is not registered.`, p.locator); continue; }
      const id = semanticEdgeId(this.context, p.predicate, source.id, target.id, p.locator);
      const edge: SemanticEdge = { id, source: source.id, target: target.id, predicate: p.predicate, role: predicateById.get(p.predicate)!.role,
        context: this.context, direction: "sourceToTarget", provenance: p.provenance, authoritativeSource: { projectId: this.projectId, context: this.context, locator: p.locator }, attributes: JSON.parse(canonicalJson(p.attributes)) };
      if (edges.has(id) && canonicalJson(edges.get(id)) !== canonicalJson(edge)) this.warn("SG-ID-EDGE-COLLISION", "Conflicting edge identity; deterministic first retained.", p.locator);
      else if (!edges.has(id)) edges.set(id, edge);
    }
    const domains = ["context", "problem", "solution", "variability", "evidence", "decision"];
    const roles = ["canonical", "supporting", "constraint", "evidence"];
    const nodes = [...this.nodes.values()].sort((a, b) => domains.indexOf(a.domain) - domains.indexOf(b.domain) || compareText(a.kind, b.kind) || compareText(a.recordId, b.recordId) || compareText(a.id, b.id));
    const sortedEdges = [...edges.values()].sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role) || compareText(a.predicate, b.predicate) || compareText(a.source, b.source) || compareText(a.target, b.target) || compareText(a.id, b.id));
    return { nodes, edges: sortedEdges, context: this.context };
  }
}
