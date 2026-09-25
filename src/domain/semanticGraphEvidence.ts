import { canonicalJson } from "./semanticGraphIdentity";
import { GraphBuilder, ref } from "./semanticGraphBuilder";
import { modelAdapter } from "./semanticGraphModel";
import type { DeepReadonly } from "./semanticGraphTypes";
import type { AppliedVariation, DerivationResult, Project, SimulationRun } from "./types";
function variationEvidence(b: GraphBuilder, variations: DeepReadonly<AppliedVariation[]>, realizationId: string, path: string, ownerId?: string) {
  b.each(variations, path, v => {
    b.reference(ref("variationPoint", v.variationPointId), path);
    b.edge(ref("variationPoint", v.variationPointId), ref("realization", realizationId, ownerId), "contributesToRealization", `${path}[${canonicalJson(v)}]`, { type: "historicalSnapshot", ownerId: realizationId, field: path }, { ...v });
  });
}
export function derivationAdapter(b: GraphBuilder, d: DeepReadonly<DerivationResult>) {
  const path = `DerivationResult[${d.id}]`;
  const n = b.node(ref("realization", d.id), `100% realization ${d.id}`, path, { sourceModelRevision: d.sourceModelRevision, timestamp: d.timestamp, featureValues: d.featureValues, calculatedKpiValues: d.calculatedKpiValues, excludedElementIds: [...d.excludedElementIds].sort(), removedRelationshipIds: [...d.removedRelationshipIds].sort(), validationSnapshot: d.validationSnapshot });
  b.reference(ref("configuration", d.configurationId), `${path}.configurationId`);
  b.reference(ref("architecture", d.sourceArchitectureId), `${path}.sourceArchitectureId`);
  b.edge(ref("configuration", d.configurationId), n, "derivesRealization", `${path}.configurationId`);
  b.edge(n, ref("architecture", d.sourceArchitectureId), "derivedFromArchitecture", `${path}.sourceArchitectureId`);
  for (const [id, value] of Object.entries(d.calculatedKpiValues ?? {}).sort(([a],[b]) => a < b ? -1 : 1)) b.node(ref("kpi", id), id, `${path}.calculatedKpiValues[${id}]`, { value, referenceOnly: true, definitionCaptured: false }, "Frozen calculated value; KPI definition and unit were not captured in this derivation.");
  const elements = d.realizedElements ?? d.sourceElements?.filter(e => d.includedElementIds.includes(e.id));
  const relationships = d.realizedRelationships ?? d.sourceRelationships?.filter(r => d.preservedRelationshipIds.includes(r.id));
  if (!d.realizedElements || !d.realizedRelationships) b.warn("SG-CTX-LEGACY-DERIVATION", "Only frozen source membership is available; property changes may be absent.", path);
  if (!elements || !relationships) { b.warn("SG-CTX-MISSING-SNAPSHOT", "Realized model is unavailable.", path); return; }
  for (const e of elements) if (e.architectureId) b.reference(ref("architecture", e.architectureId), `${path}.realizedElements[${e.id}].architectureId`);
  modelAdapter(b, elements, relationships, [], path);
  for (const id of d.effectiveSelectedFeatureIds) {
    b.reference(ref("feature", id), `${path}.effectiveSelectedFeatureIds`);
    b.edge(ref("configuration", d.configurationId), ref("feature", id), "selectsFeature", `${path}.effectiveSelectedFeatureIds[${id}]`);
  }
  for (const e of elements) b.edge(n, ref(e.elementType, e.id), "containsRealizedElement", `${path}.realizedElements[${e.id}]`);
  variationEvidence(b, d.appliedVariations, d.id, `${path}.appliedVariations`);
}
export function simulationAdapter(b: GraphBuilder, run: DeepReadonly<SimulationRun>, full: boolean) {
  const path = `SimulationRun[${run.id}]`, s = run.inputSnapshot;
  const n = b.node(ref("simulationRun", run.id), run.name, path, { timestamp: run.timestamp, modelRevision: run.projectModelRevisionAtRun, referenceOnly: !full, evidenceContext: { type: "simulation", simulationRunId: run.id } });
  if (full && !s) { b.warn("SG-CTX-MISSING-SNAPSHOT", "Simulation input snapshot is unavailable.", path); return; }
  const architectureId = full ? s.architectureId : run.architectureId;
  const configurationId = full ? s.configurationId : run.configurationId;
  const derivationId = full ? s.derivationId : run.derivationId;
  for (const [kind, id] of [["architecture", architectureId], ["configuration", configurationId]] as const) if (id) {
    if (full) b.reference(ref(kind, id), `${path}.inputSnapshot.${kind}Id`);
    b.edge(ref(kind, id), n, "evaluatedBy", `${path}.${full ? "inputSnapshot." : ""}${kind}Id`);
  }
  if (derivationId) {
    // The run may contain a background derivation absent from current Configuration.derivation.
    const indexed = !full ? [...b.nodes.values()].filter(n => n.kind === "realization" && n.recordId === derivationId && n.ownerId === configurationId) : [];
    const rn = indexed.length === 1 ? ref("realization", derivationId, indexed[0].ownerId) : b.node(ref("realization", derivationId, run.id), `100% realization ${derivationId}`, `${path}.inputSnapshot.derivationId`, { referenceOnly: !full, capturedByRun: run.id, backgroundRealization: s?.backgroundRealization });
    b.edge(rn, n, "evaluatedBy", `${path}.derivationId`);
    if (full) {
      b.edge(rn, ref("architecture", architectureId), "derivedFromArchitecture", `${path}.inputSnapshot.architectureId`);
      if (configurationId) b.edge(ref("configuration", configurationId), rn, "derivesRealization", `${path}.inputSnapshot.derivationId`);
      variationEvidence(b, s.appliedVariations, derivationId, `${path}.inputSnapshot.appliedVariations`, run.id);
    }
  }
  if (!full) return;
  for (const e of s.realizedElements ?? []) if (e.architectureId) b.reference(ref("architecture", e.architectureId), `${path}.inputSnapshot.realizedElements[${e.id}].architectureId`);
  const evaluatedElements = (s.realizedElements ?? []).map(e => ({ ...e, parameters: e.parameters.map(p => ({ ...p, value: Object.prototype.hasOwnProperty.call(s.parameterValues ?? {}, p.id) ? s.parameterValues[p.id] : p.value })) }));
  modelAdapter(b, evaluatedElements, s.realizedRelationships ?? [], s.kpiDefinitions ?? [], `${path}.inputSnapshot`);
  if (!s.realizedElements || !s.realizedRelationships) b.warn("SG-CTX-MISSING-SNAPSHOT", "Frozen simulation model arrays are unavailable.", path);
  if (derivationId) for (const e of s.realizedElements ?? []) b.edge(ref("realization", derivationId, run.id), ref(e.elementType, e.id), "containsRealizedElement", `${path}.inputSnapshot.realizedElements[${e.id}]`);
  b.each(run.results, `${path}.results`, r => {
    const rn = b.node(ref("simulationResult", r.id, run.id), r.name, `${path}.results[${r.id}]`, { value: r.value, unit: r.unit, formulaOrAlgorithm: r.formulaOrAlgorithm, algorithmKey: r.algorithmKey, inputSources: r.inputSources, assumptions: r.assumptions, warnings: r.warnings, breakdown: r.breakdown, missingInformation: r.missingInformation });
    b.edge(n, rn, "producesResult", `${path}.results[${r.id}]`, { type: "embeddedRecord", ownerId: run.id, field: "results", recordId: r.id });
    if (r.kpiId && s.kpiDefinitions?.some(k => k.id === r.kpiId)) b.edge(rn, ref("kpi", r.kpiId), "reportsKpi", `${path}.results[${r.id}].kpiId`);
    else if (r.kpiId && !r.algorithmKey) b.warn("SG-REF-RESULT-KPI", `Frozen KPI ${r.kpiId} is unavailable.`, `${path}.results[${r.id}]`);
    for (const id of r.sourceParameterIds) b.edge(ref("parameter", id), rn, "providesEvidenceInput", `${path}.results[${r.id}].sourceParameterIds[${id}]`);
  });
}
export function evidenceIndexAdapter(b: GraphBuilder, p: DeepReadonly<Project>) {
  b.each(p.simulationRuns, "Project.simulationRuns", run => simulationAdapter(b, run, false));
  b.each(p.validationResults, "Project.validationResults", v => {
    const n = b.node(ref("validationFinding", v.id), v.title, `Project.validationResults[${v.id}]`, { ruleId: v.ruleId, severity: v.severity, resolved: v.resolved, affectedRelationshipIds: [...v.affectedRelationshipIds].sort() }, v.message);
    for (const id of v.affectedElementIds) { const e = p.elements.find(e => e.id === id); b.edge(n, ref(e?.elementType ?? "systemRequirement", id), "reportsFinding", `Project.validationResults[${v.id}].affectedElementIds[${id}]`); }
  });
}
