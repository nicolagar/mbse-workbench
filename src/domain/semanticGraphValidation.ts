import { acceptsEndpoints } from "./ontologyRegistry";
import { contextKey } from "./semanticGraphIdentity";
import type { SemanticDiagnostic, SemanticGraph } from "./semanticGraphTypes";
export function validateSemanticGraph(g: SemanticGraph): SemanticDiagnostic[] {
  const nodes = new Map(g.nodes.map(n => [n.id, n])), diagnostics: SemanticDiagnostic[] = [];
  const warn = (code: string, message: string, locator: string) => diagnostics.push({ code, message, locator, severity: "warning" });
  for (const e of g.edges) {
    const s = nodes.get(e.source), t = nodes.get(e.target);
    if (!s || !t) warn("SG-REF-ENDPOINT", "Dangling semantic edge.", e.id);
    else if (!acceptsEndpoints(e.predicate, s.kind, t.kind)) warn("SG-PRED-ENDPOINT", "Invalid semantic endpoint types.", e.id);
    if (contextKey(e.context) !== contextKey(g.context) || s && contextKey(s.context) !== contextKey(g.context) || t && contextKey(t.context) !== contextKey(g.context)) warn("SG-CTX-MIXED", "An edge crosses evidence contexts.", e.id);
  }
  // Explicit alternatives for requirement provenance: direct satisfaction OR formula-bound evidence.
  for (const n of g.nodes.filter(n => n.kind === "systemRequirement")) {
    if (!g.edges.some(e => e.source === n.id && ["satisfiedBy", "evaluatedAgainst", "evaluatedAgainstKpi"].includes(e.predicate))) warn("SG-CONT-REQUIREMENT", "No satisfaction or formula evidence is recorded for this requirement.", n.id);
  }
  return diagnostics;
}
