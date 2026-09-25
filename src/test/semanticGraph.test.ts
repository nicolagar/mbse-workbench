import { describe, expect, it } from "vitest";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { createOhscSampleProject } from "../data/ohscSample";
import { buildSemanticGraph } from "../domain/semanticGraph";
import { GraphBuilder, ref, SemanticContractError } from "../domain/semanticGraphBuilder";
import { canonicalJson, semanticNodeId } from "../domain/semanticGraphIdentity";
import { acceptsEndpoints, ontologyRegistry, semanticNodeKinds, storedPredicateMap, type SemanticPredicate } from "../domain/ontologyRegistry";
import { allowedRelationships } from "../domain/relationships";
import { relationshipTypes, type Project } from "../domain/types";
import { semanticGraphExport } from "../domain/semanticGraphExport";
import { buildSemanticSchema } from "../domain/semanticGraphSchema";
import { validateSemanticGraph } from "../domain/semanticGraphValidation";
import { getEvidence, traceCanonical, traceSemanticGraph } from "../domain/semanticGraphTraversal";
import { layoutSemanticGraph } from "../domain/semanticGraphLayout";
import { missionToBaselineSemanticView } from "../domain/semanticGraphViews";
import { assessRequirement } from "../domain/requirementAssessment";
import { validateConfiguration } from "../domain/variability";
import { buildExportPackage, defaultExportFilters, serializeExportPackage } from "../domain/exportImport";
function freeze<T>(x: T): T { if (x && typeof x === "object") { Object.freeze(x); Object.values(x).forEach(freeze); } return x; }
const sample = () => createCoffeeMachineSampleProject();
const contexts = (p: Project) => [{ type: "live" } as const, ...p.configurations.flatMap(c => c.derivation ? [{ type: "derivation" as const, configurationId: c.id, derivationId: c.derivation.id }] : []), ...p.simulationRuns.map(r => ({ type: "simulation" as const, simulationRunId: r.id })), ...p.decisions.map(d => ({ type: "decision" as const, decisionId: d.id }))];
describe("semantic graph contract", () => {
  it("covers all stored predicates and exact allowed triples", () => {
    expect(Object.keys(storedPredicateMap).sort()).toEqual([...relationshipTypes].sort());
    for (const [s, p, t] of allowedRelationships) expect(acceptsEndpoints(storedPredicateMap[p].predicate, s, t)).toBe(true);
    expect(acceptsEndpoints("realizedBy", "productFunction", "industrialSystemComponent")).toBe(false);
    const schema = buildSemanticSchema();
    expect(schema.nodes.length).toBe(semanticNodeKinds.length - 1);
    expect(new Set(schema.edges.map(e => e.predicate)).size).toBe(ontologyRegistry.length);
    expect(validateSemanticGraph(schema).filter(d => !d.code.startsWith("SG-CONT"))).toEqual([]);
  });
  it("encodes owner and context tuples without separator collisions", () => {
    expect(semanticNodeId({type:"live"}, "parameter", "b/c", "a")).not.toBe(semanticNodeId({type:"live"}, "parameter", "c", "a/b"));
    expect(semanticNodeId({type:"derivation", configurationId:"a", derivationId:"b:c"}, "realization", "d")).not.toBe(semanticNodeId({type:"derivation", configurationId:"a:b", derivationId:"c"}, "realization", "d"));
  });
  for (const [name, make] of [["Coffee", createCoffeeMachineSampleProject], ["OHSC", createOhscSampleProject]] as const) {
    it(`${name}: deterministic, immutable, direction-preserving projection of every context`, () => {
      const p = freeze(make()); const bytes = JSON.stringify(p);
      for (const context of contexts(p)) {
        const a = buildSemanticGraph(p, {context}), b = buildSemanticGraph(p, {context});
        expect(a).toEqual(b);
        expect(semanticGraphExport(p, context)).toBe(semanticGraphExport(p, context));
        expect(validateSemanticGraph(a.graph).filter(d => !d.code.startsWith("SG-CONT"))).toEqual([]);
        for (const n of a.graph.nodes) expect(canonicalJson(n.context)).toBe(canonicalJson(context));
        expect(a.graph.nodes.some(n => (n.kind as string) === "baseline")).toBe(false);
        if (a.graph.nodes[0]) { traceCanonical(a.graph, a.graph.nodes[0].id); getEvidence(a.graph, a.graph.nodes[0].id); }
      }
      const live = buildSemanticGraph(p);
      expect(live.graph.edges.filter(e => e.provenance.type === "storedRelationship")).toHaveLength(p.relationships.length);
      for (const r of p.relationships) {
        const e = live.graph.edges.find(e => e.provenance.type === "storedRelationship" && e.provenance.relationshipId === r.id)!;
        expect(live.graph.nodes.find(n => n.id === e.source)?.recordId).toBe(r.sourceId);
        expect(live.graph.nodes.find(n => n.id === e.target)?.recordId).toBe(r.targetId);
      }
      expect(JSON.stringify(p)).toBe(bytes);
    }, name === "OHSC" ? 20_000 : 10_000);
    it(`${name}: source permutation leaves semantic JSON identical`, () => {
      const p = make(), shuffled = structuredClone(p);
      for (const key of ["architectures", "elements", "relationships", "features", "featureGroups", "variabilityAxes", "featureConstraints", "variationPoints", "configurations", "kpis", "simulationRuns", "comparisonStudies", "comparisonRisks", "decisions", "validationResults"] as const) shuffled[key].reverse();
      shuffled.elements.forEach(e => e.parameters.reverse());
      shuffled.comparisonStudies.forEach(s => { s.criteria.reverse(); s.candidateRefs.reverse(); s.alternativeRefs.reverse(); s.results.reverse(); });
      expect(buildSemanticGraph(shuffled)).toEqual(buildSemanticGraph(p));
    });
    it(`${name}: requirement, configuration, evidence and native export parity`, () => {
      const p = make();
      const outputs = () => ({ requirements: p.elements.filter(e => e.elementType === "systemRequirement").map(e => assessRequirement(p, e)), configurations: p.configurations.map(c => validateConfiguration(p, c)), runs: p.simulationRuns, decisions: p.decisions, studies: p.comparisonStudies, derivations: p.configurations.map(c => c.derivation), baseline: p.baselineArchitectureId, export: serializeExportPackage(buildExportPackage(p, defaultExportFilters(), new Date("2026-09-16T12:00:00Z"))) });
      const before = JSON.stringify(outputs());
      contexts(p).forEach(context => buildSemanticGraph(p, {context}));
      expect(JSON.stringify(outputs())).toBe(before);
    });
  }
  it("preserves parallel authoritative relationships and deterministic duplicate winners", () => {
    const p = sample(), r = p.relationships[0]; p.relationships.push({...r, id:"parallel"});
    const graph = buildSemanticGraph(p).graph;
    expect(graph.edges.filter(e => e.provenance.type === "storedRelationship")).toHaveLength(p.relationships.length);
    p.elements.push({...p.elements[0], name:"Conflicting duplicate"});
    const a = buildSemanticGraph(p); p.elements.reverse();
    expect(buildSemanticGraph(p)).toEqual(a);
    expect(a.diagnostics.some(d => d.code === "SG-ID-COLLISION")).toBe(true);
  });
  it("resolves duplicate embedded parameter IDs conservatively", () => {
    const p = sample(); const owner = p.elements.find(e => e.parameters.length)!;
    const other = p.elements.find(e => e.id !== owner.id)!;
    other.parameters.push({...owner.parameters[0], ownerElementId:other.id});
    p.kpis[0].inputParameterIds.push(owner.parameters[0].id);
    const result = buildSemanticGraph(p);
    expect(result.graph.nodes.filter(n => n.kind === "parameter" && n.recordId === owner.parameters[0].id)).toHaveLength(2);
    expect(result.diagnostics.some(d => d.code === "SG-REF-AMBIGUOUS")).toBe(true);
  });
  it("contains record and adapter failures without dangling edges", () => {
    const p = sample(); p.relationships[0].targetId = "missing";
    p.variationPoints.push(null as never);
    const result = buildSemanticGraph(p);
    expect(result.completeness).toBe("partial");
    expect(result.diagnostics.some(d => d.code === "SG-BUILD-RECORD")).toBe(true);
    expect(result.graph.nodes.some(n => n.kind === "mission")).toBe(true);
    expect(validateSemanticGraph(result.graph).some(d => d.code === "SG-REF-ENDPOINT")).toBe(false);
    p.featureGroups = null as never;
    expect(buildSemanticGraph(p).graph.nodes.some(n => n.kind === "decision")).toBe(true);
  });
  it("rejects an unregistered programming predicate", () => {
    const b = new GraphBuilder("p", {type:"live"});
    expect(() => b.edge(ref("mission","a"), ref("system","b"), "unregistered" as SemanticPredicate, "test")).toThrow(SemanticContractError);
  });
  it("represents NOT and value-rule references as conditions, not activation", () => {
    const p = sample(), v = p.variationPoints[0]; const f = p.features[0];
    v.featureExpression = `NOT ${f.id}`;
    const result = buildSemanticGraph(p);
    const edges = result.graph.edges.filter(e => e.predicate === "conditionsVariationPoint");
    expect(edges.some(e => e.attributes.expression === `NOT ${f.id}`)).toBe(true);
    expect(edges.every(e => e.role === "constraint" && e.attributes.activationAsserted === false)).toBe(true);
  });
  it("does not rewrite simulation history after live rename, deletion or baseline changes", () => {
    const p = sample(), run = p.simulationRuns[0], context = {type:"simulation" as const, simulationRunId:run.id};
    const before = buildSemanticGraph(p, {context});
    p.elements = []; p.kpis = []; p.variationPoints = []; p.configurations = []; p.architectures.forEach(a => a.name = "Renamed"); p.baselineArchitectureId = "changed";
    expect(buildSemanticGraph(p, {context})).toEqual(before);
    expect(before.graph.nodes.some(n => n.kind === "simulationResult")).toBe(true);
  });
  it("never substitutes a later derivation when the requested ID is gone", () => {
    const p = sample(), c = p.configurations.find(c => c.derivation)!;
    const r = buildSemanticGraph(p, {context:{type:"derivation", configurationId:c.id, derivationId:"not-current"}});
    expect(r.graph.nodes).toHaveLength(0); expect(r.completeness).toBe("partial");
  });
  it("scopes Decision labels and gives IDs priority; ambiguous labels never select", () => {
    const p = sample(), s = p.comparisonStudies[0], d = p.decisions[0]; delete d.evidenceSnapshot;
    d.supportingComparisonStudyIds = [s.id]; const a = s.alternativeRefs[0];
    s.alternativeRefs.push({...a, id:"duplicate", label:a.label}); d.selectedAlternative = a.label;
    expect(buildSemanticGraph(p).diagnostics.some(d => d.code === "SG-REF-DECISION-SELECTION")).toBe(true);
    d.selectedAlternative = a.id;
    expect(buildSemanticGraph(p).graph.edges.some(e => e.predicate === "selectsAlternative")).toBe(true);
  });
  it("distinguishes strict canonical traversal from evidence-inclusive traversal", () => {
    const g = buildSemanticGraph(sample()).graph, run = g.nodes.find(n => n.kind === "simulationRun")!;
    expect(traceCanonical(g, run.id).edges).toHaveLength(0);
    expect(traceSemanticGraph(g, run.id, {roles:["evidence"]}).edges.length).toBeGreaterThan(0);
  });
  it("builds a Mission-to-baseline view without changing edge direction", () => {
    const graph = buildSemanticGraph(sample()).graph;
    const thread = missionToBaselineSemanticView(graph);
    for (const kind of ["mission", "systemRequirement", "architecture", "configuration", "realization", "simulationRun", "tradeStudy", "decision"])
      expect(thread.nodes.some(node => node.kind === kind), kind).toBe(true);
    expect(thread.nodes.some(node => node.kind === "architecture" && node.attributes.isBaseline === true)).toBe(true);
    expect(thread.edges.length).toBeGreaterThan(0);
    expect(thread.edges.every(edge => graph.edges.includes(edge))).toBe(true);
  });
  it("uses orthogonal, distinct ports and stable layout geometry", () => {
    const g = buildSemanticGraph(sample()).graph, a = layoutSemanticGraph(g);
    expect(a).toEqual(layoutSemanticGraph(g)); const ports = new Set<string>();
    const labels: {x:number;y:number;width:number;height:number}[] = [];
    const overlaps = (x: typeof labels[number], y: typeof labels[number]) => x.x < y.x + y.width && x.x + x.width > y.x && x.y < y.y + y.height && x.y + x.height > y.y;
    for (const route of a.routes.values()) {
      expect([...a.positions.values()].some(box => overlaps(route.labelBox, box))).toBe(false);
      expect(labels.some(box => overlaps(route.labelBox, box))).toBe(false);
      labels.push(route.labelBox);
    }
    for (const r of a.routes.values()) {
      r.points.slice(1).forEach((p,i) => expect(p.x === r.points[i].x || p.y === r.points[i].y).toBe(true));
      for (const p of [r.points[0], r.points.at(-1)!]) { const key = `${p.x},${p.y}`; expect(ports.has(key)).toBe(false); ports.add(key); }
    }
  });
});
