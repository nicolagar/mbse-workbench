import { storedPredicateMap } from "./ontologyRegistry";
import { GraphBuilder, ref, type Ref } from "./semanticGraphBuilder";
import type { DeepReadonly } from "./semanticGraphTypes";
import type { FormulaBinding, KPI, ModelElement, Project, Relationship } from "./types";
export function modelAdapter(b: GraphBuilder, elements: DeepReadonly<ModelElement[]>, relationships: DeepReadonly<Relationship[]>, kpis: DeepReadonly<KPI[]>, locator: string) {
  const elementById = new Map(elements.filter(Boolean).map(e => [e.id, e]));
  const er = (id: string): Ref => ref(elementById.get(id)?.elementType ?? "systemRequirement", id);
  b.each(elements, `${locator}.elements`, e => {
    const n = b.node(ref(e.elementType, e.id), e.name, `${locator}.elements[${e.id}]`, { architectureScope: e.architectureScope, architectureId: e.architectureId, tags: e.tags, requirementFormula: e.requirementFormula, requirementReviews: e.metadata?.requirementReviews, featureExpression: e.featureExpression }, e.description, e.status);
    if (e.architectureScope === "specific" && e.architectureId) b.edge(n, ref("architecture", e.architectureId), "belongsToArchitecture", `${locator}.elements[${e.id}].architectureId`);
    if (e.elementType === "useCase" && e.metadata?.subjectSystemId) b.edge(n, ref("system", e.metadata.subjectSystemId), "hasSubjectSystem", `${locator}.elements[${e.id}].metadata.subjectSystemId`);
    const binding = (from: Ref, v: DeepReadonly<FormulaBinding>, path: string, parameterCalculation = false) => b.edge(parameterCalculation ? ref(v.kind, v.targetId) : from, parameterCalculation ? from : ref(v.kind, v.targetId), parameterCalculation ? "providesInputToParameter" : v.kind === "parameter" ? "evaluatedAgainst" : "evaluatedAgainstKpi", `${path}[${v.id}]`);
    b.each(e.parameters, `${locator}.elements[${e.id}].parameters`, p => {
      const path = `${locator}.elements[${e.id}].parameters[${p.id}]`;
      const pn = b.node(ref("parameter", p.id, e.id), p.name, path, { value: p.value, unit: p.unit, valueOrigin: p.valueOrigin, semanticKey: p.semanticKey, minimum: p.minimum, maximum: p.maximum, uncertaintyPercent: p.uncertaintyPercent, calculation: p.calculation }, p.description);
      if (p.ownerElementId !== e.id) b.warn("SG-REF-PARAMETER-OWNER", "Embedded owner and ownerElementId disagree.", path);
      b.edge(n, pn, "ownsParameter", path, { type: "embeddedRecord", ownerId: e.id, field: "parameters", recordId: p.id });
      b.each(p.calculation?.bindings, `${path}.calculation.bindings`, v => binding(pn, v, `${path}.calculation.bindings`, true));
    });
    b.each(e.requirementFormula?.bindings, `${locator}.elements[${e.id}].requirementFormula.bindings`, v => binding(n, v, `${locator}.elements[${e.id}].requirementFormula.bindings`));
  });
  b.each(relationships, `${locator}.relationships`, r => {
    const mapped = storedPredicateMap[r.relationshipType];
    if (!mapped) { b.warn("SG-PRED-UNKNOWN-STORED", `Unknown stored relationship ${r.relationshipType}.`, r.id); return; }
    b.edge(er(r.sourceId), er(r.targetId), mapped.predicate, `${locator}.relationships[${r.id}]`, { type: "storedRelationship", relationshipId: r.id, orientation: "direct" }, { relationshipId: r.id, quantity: r.quantity ?? r.requiredQuantity, unit: r.unit, flowName: r.itemFlowName, sequenceId: r.sequenceId, architectureId: r.architectureId, containment: r.containment, displayPredicate: r.containment && r.relationshipType === "refines" ? "partOf" : mapped.predicate });
  });
  b.each(kpis, `${locator}.kpis`, k => {
    const n = b.node(ref("kpi", k.id), k.name, `${locator}.kpis[${k.id}]`, { unit: k.outputUnit, formula: k.formula, algorithm: k.standardAlgorithmKey, value: k.lastCalculatedValue, optimizationDirection: k.optimizationDirection }, k.description);
    for (const id of k.objectiveIds ?? []) b.edge(n, ref("objective", id), "measuresObjective", `${locator}.kpis[${k.id}].objectiveIds[${id}]`);
    for (const id of k.needIds ?? []) b.edge(n, ref("need", id), "measuresNeed", `${locator}.kpis[${k.id}].needIds[${id}]`);
    for (const id of k.inputParameterIds ?? []) b.edge(ref("parameter", id), n, "providesInputTo", `${locator}.kpis[${k.id}].inputParameterIds[${id}]`);
    for (const id of k.dependsOnKpiIds ?? []) b.edge(ref("kpi", id), n, "providesInputToKpi", `${locator}.kpis[${k.id}].dependsOnKpiIds[${id}]`);
  });
  return er;
}
export function architectureAdapter(b: GraphBuilder, p: DeepReadonly<Project>) {
  const baselines = p.architectures.filter(a => a?.status === "baseline");
  const coherent = baselines.length === 1 && baselines[0].id === p.baselineArchitectureId;
  if ((p.baselineArchitectureId || baselines.length) && !coherent) b.warn("SG-BASE-INCONSISTENT", "Baseline ID and architecture statuses disagree.", "Project.baselineArchitectureId");
  b.each(p.architectures, "Project.architectures", a => b.node(ref("architecture", a.id), a.name, `Project.architectures[${a.id}]`, { declaredStatus: a.status, isBaseline: coherent && a.id === p.baselineArchitectureId }, a.description, a.status === "baseline" && !coherent ? "unconfirmed" : a.status));
}
