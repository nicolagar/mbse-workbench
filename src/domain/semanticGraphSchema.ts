import { ontologyRegistry, semanticNodeKinds, nodeLabel, nodeDomain } from "./ontologyRegistry";
import type { SemanticGraph } from "./semanticGraphTypes";
import { semanticEdgeId, semanticNodeId } from "./semanticGraphIdentity";
export function buildSemanticSchema(): SemanticGraph {
  const context = { type: "live" } as const;
  return { context, nodes: semanticNodeKinds.filter(kind => kind !== "unresolvedReference").map(kind => ({
    id: semanticNodeId(context, kind, kind), recordId: kind, kind, label: nodeLabel(kind), domain: nodeDomain(kind), description: "Schema type; this is not a project instance.", context, resolution: "live", source: { projectId: "schema", context, locator: `ontologyRegistry.nodeKinds.${kind}` }, attributes: { schemaType: true }
  })), edges: ontologyRegistry.flatMap(def => (def.pairs ?? def.sourceKinds.flatMap(s => def.targetKinds.map(t => [s, t] as const))).map(([source, target]) => {
    const s = semanticNodeId(context, source, source), t = semanticNodeId(context, target, target), locator = `ontologyRegistry.${def.id}.${source}.${target}`;
    return { id: semanticEdgeId(context, def.id, s, t, locator), source: s, target: t, predicate: def.id, role: def.role, context, direction: "sourceToTarget", provenance: { type: "derivedProjection", ruleId: "schemaDefinition", inputIds: [def.id] }, authoritativeSource: { projectId: "schema", context, locator }, attributes: { storedPredicate: def.storedPredicate, storedDirection: def.storedDirection, authority: def.authority } };
  })) };
}
