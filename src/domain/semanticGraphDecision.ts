import { GraphBuilder, ref, type Ref } from "./semanticGraphBuilder";
import type { DeepReadonly } from "./semanticGraphTypes";
import type { ComparisonAlternativeRef, ComparisonRisk, ComparisonStudy, Decision, Project, StudyCriterion } from "./types";
function criterion(b: GraphBuilder, c: DeepReadonly<StudyCriterion>, owner: Ref, path: string, historical: boolean) {
  const n = b.node(ref("studyCriterion", c.id, owner.id), c.name, `${path}.criteria[${c.id}]`, { type: c.type, weight: c.weight, stakeholderValueFunction: c.stakeholderValueFunction }, c.description);
  b.edge(owner, n, "definesCriterion", `${path}.criteria[${c.id}]`);
  for (const [kind, ids, predicate] of [["objective", c.sourceObjectiveIds, "drivesCriterion"], ["systemRequirement", c.sourceRequirementIds, "constrainsCriterion"]] as const) for (const id of ids) {
    if (historical) b.reference(ref(kind, id), `${path}.criteria[${c.id}]`);
    b.edge(ref(kind, id), n, predicate, `${path}.criteria[${c.id}].${predicate}[${id}]`);
  }
  if (c.kpiId) { if (historical) b.reference(ref("kpi", c.kpiId), path); b.edge(n, ref("kpi", c.kpiId), "evaluatedByKpi", `${path}.criteria[${c.id}].kpiId`); }
  if (c.requiredFeatureId) { if (historical) b.reference(ref("feature", c.requiredFeatureId), path); b.edge(n, ref("feature", c.requiredFeatureId), "requiresFeature", `${path}.criteria[${c.id}].requiredFeatureId`); }
}
function alternative(b: GraphBuilder, a: DeepReadonly<ComparisonAlternativeRef>, owner: Ref, path: string, historical: boolean) {
  const n = b.node(ref("alternative", a.id, owner.id), a.label, `${path}.alternatives[${a.id}]`, { architectureId: a.architectureId, configurationId: a.configurationId, simulationRunId: a.simulationRunId });
  b.edge(owner, n, "evaluatesAlternative", `${path}.alternatives[${a.id}]`);
  for (const [kind, id, predicate] of [["architecture", a.architectureId, "referencesArchitecture"], ["configuration", a.configurationId, "referencesConfiguration"], ["simulationRun", a.simulationRunId, "referencesSimulationRun"]] as const) if (id) {
    if (historical) b.reference(ref(kind, id), `${path}.alternatives[${a.id}].${kind}Id`);
    b.edge(n, ref(kind, id), predicate, `${path}.alternatives[${a.id}].${kind}Id`);
  }
}
function risk(b: GraphBuilder, r: DeepReadonly<ComparisonRisk>, path: string, historical: boolean) {
  const n = b.node(ref("risk", r.id), r.title, `${path}[${r.id}]`, { inherentLikelihood: r.inherentLikelihood, inherentImpact: r.inherentImpact, residualLikelihood: r.residualLikelihood, residualImpact: r.residualImpact, mitigation: r.mitigation, owner: r.owner }, r.description, r.status);
  for (const [kind, ids] of [["architecture", r.applicableArchitectureIds], ["configuration", r.applicableConfigurationIds], ["systemRequirement", r.applicableRequirementIds], ["parameter", r.applicableParameterIds], ["kpi", r.applicableKpiIds]] as const) for (const id of ids ?? []) {
    if (historical) b.reference(ref(kind, id), `${path}[${r.id}].applicable${kind}`);
    b.edge(n, ref(kind, id), "appliesTo", `${path}[${r.id}].applicable${kind}[${id}]`);
  }
  if (!historical) {
    b.edge(n, ref("tradeStudy", r.comparisonStudyId), "appliesTo", `${path}[${r.id}].comparisonStudyId`);
    if (r.alternativeId) b.edge(n, ref("alternative", r.alternativeId, r.comparisonStudyId), "appliesTo", `${path}[${r.id}].alternativeId`);
  }
}
export function studyAdapter(b: GraphBuilder, s: DeepReadonly<ComparisonStudy>) {
  const path = `Project.comparisonStudies[${s.id}]`;
  const n = b.node(ref("tradeStudy", s.id), s.name, path, { question: s.question, intendedOutcome: s.intendedOutcome, settingsUpdatedAt: s.settingsUpdatedAt }, s.description, s.status);
  if (s.originatingOpenDecisionId) b.edge(ref("openDecision", s.originatingOpenDecisionId), n, "initiatesStudy", `${path}.originatingOpenDecisionId`);
  for (const [kind, field, ids] of [["need", "needIds", s.needIds], ["objective", "objectiveIds", s.objectiveIds], ["useCase", "useCaseIds", s.useCaseIds], ["systemRequirement", "mandatoryRequirementIds", s.mandatoryRequirementIds], ["systemRequirement", "baselineRequirementIds", s.baselineRequirementIds]] as const) for (const id of ids ?? []) b.edge(n, ref(kind, id), "scopes", `${path}.${field}[${id}]`);
  if (s.rootFeatureId) b.edge(n, ref("feature", s.rootFeatureId), "usesFeatureModelRoot", `${path}.rootFeatureId`);
  if (s.referenceArchitectureId) b.edge(n, ref("architecture", s.referenceArchitectureId), "referencesArchitecture", `${path}.referenceArchitectureId`);
  for (const id of s.selectedVariabilityAxisIds ?? []) b.edge(n, ref("variabilityAxis", id), "exploresAxis", `${path}.selectedVariabilityAxisIds[${id}]`);
  for (const id of s.exploredFeatureIds) b.edge(n, ref("feature", id), "exploresFeature", `${path}.exploredFeatureIds[${id}]`);
  for (const id of s.selectedKpiIds) b.edge(n, ref("kpi", id), "evaluatesKpi", `${path}.selectedKpiIds[${id}]`);
  b.each(s.criteria, `${path}.criteria`, c => criterion(b, c, n, path, false));
  b.each(s.candidateRefs, `${path}.candidateRefs`, c => {
    const cn = b.node(ref("candidate", c.id, s.id), c.label, `${path}.candidateRefs[${c.id}]`);
    b.edge(n, cn, "definesCandidate", `${path}.candidateRefs[${c.id}]`);
    b.edge(cn, ref("configuration", c.configurationId), "referencesConfiguration", `${path}.candidateRefs[${c.id}].configurationId`);
    b.edge(cn, ref("architecture", c.architectureId), "referencesArchitecture", `${path}.candidateRefs[${c.id}].architectureId`);
  });
  b.each(s.alternativeRefs, `${path}.alternativeRefs`, a => alternative(b, a, n, path, false));
  b.each(s.results, `${path}.results`, r => {
    const rn = b.node(ref("comparisonResult", r.id, s.id), `Comparison ${r.timestamp}`, `${path}.results[${r.id}]`, { timestamp: r.timestamp, inputProjectModelRevision: r.inputProjectModelRevision, rawValues: r.rawValues, normalizedScores: r.normalizedScores, weightedScores: r.weightedScores, warnings: r.warnings, feasibility: r.feasibility, pareto: r.pareto });
    b.edge(n, rn, "producesComparisonResult", `${path}.results[${r.id}]`);
  });
}
export function decisionAdapter(b: GraphBuilder, p: DeepReadonly<Project>, d: DeepReadonly<Decision>, historical: boolean) {
  const path = `Project.decisions[${d.id}]`, snapshot = d.evidenceSnapshot;
  const n = b.node(ref("decision", d.id), snapshot?.question ?? d.question, path, historical && snapshot ? { ...snapshot } : { status: d.status, rationale: d.rationale, selectedAlternative: d.selectedAlternative, evidenceContext: { type: "decision", decisionId: d.id }, capturedAt: snapshot?.capturedAt }, "", historical ? undefined : d.status, historical && !snapshot ? "currentDisplayFallback" : undefined);
  if (historical && !snapshot) b.warn("SG-CTX-DECISION-NO-SNAPSHOT", "Decision has no frozen evidence; only recorded support IDs are shown.", path);
  const runIds = historical && snapshot ? snapshot.simulationRunIds : d.supportingSimulationRunIds;
  for (const id of runIds) {
    if (historical) b.reference(ref("simulationRun", id), `${path}.evidenceSnapshot.simulationRunIds`);
    b.edge(ref("simulationRun", id), n, "informsDecision", `${path}.${historical && snapshot ? "evidenceSnapshot.simulationRunIds" : "supportingSimulationRunIds"}[${id}]`);
  }
  for (const id of d.supportingComparisonStudyIds) {
    if (historical) b.reference(ref("tradeStudy", id), `${path}.supportingComparisonStudyIds`);
    b.edge(ref("tradeStudy", id), n, "informsDecision", `${path}.supportingComparisonStudyIds[${id}]`);
  }
  if (historical && snapshot) {
    b.each(snapshot.criteria, `${path}.evidenceSnapshot.criteria`, c => criterion(b, c, n, `${path}.evidenceSnapshot`, true));
    b.each(snapshot.candidateAlternatives, `${path}.evidenceSnapshot.candidateAlternatives`, a => alternative(b, a, n, `${path}.evidenceSnapshot`, true));
    b.each(snapshot.risks, `${path}.evidenceSnapshot.risks`, r => risk(b, r, `${path}.evidenceSnapshot.risks`, true));
  }
  // Live decisions with frozen evidence expose no current selection projection; the frozen context owns it.
  if (!historical && snapshot) return;
  if (historical && !snapshot) return;
  const selected = historical ? snapshot?.selectedAlternative : d.selectedAlternative;
  if (!selected) return;
  const alternatives = historical && snapshot ? snapshot.candidateAlternatives.map(a => ({ a, ownerId: d.id })) : p.comparisonStudies.filter(s => d.supportingComparisonStudyIds.includes(s.id)).flatMap(s => s.alternativeRefs.map(a => ({ a, ownerId: s.id })));
  const byId = alternatives.filter(({ a }) => a.id === selected);
  const matches = byId.length ? byId : alternatives.filter(({ a }) => a.label === selected);
  if (matches.length !== 1) { b.warn("SG-REF-DECISION-SELECTION", `Selected alternative resolves to ${matches.length} scoped records.`, `${path}.selectedAlternative`); return; }
  const { a, ownerId } = matches[0];
  b.edge(n, ref("alternative", a.id, ownerId), "selectsAlternative", `${path}.${historical ? "evidenceSnapshot." : ""}selectedAlternative`);
  if (historical) b.reference(ref("architecture", a.architectureId), `${path}.evidenceSnapshot.candidateAlternatives[${a.id}].architectureId`);
  b.edge(n, ref("architecture", a.architectureId), "selectsArchitecture", `${path}.${historical ? "evidenceSnapshot." : ""}selectedAlternative.architectureId`);
  if (!historical && d.status === "approved" && d.baselineApprovalConfirmed && p.baselineArchitectureId !== a.architectureId) b.warn("SG-BASE-DECISION", "Current baseline differs from the selected architecture; no repair performed.", path);
}
export function governanceAdapter(b: GraphBuilder, p: DeepReadonly<Project>) {
  b.each(p.openDecisions, "Project.openDecisions", d => b.node(ref("openDecision", d.id), d.question, `Project.openDecisions[${d.id}]`, {}, "", d.status));
  b.each(p.comparisonStudies, "Project.comparisonStudies", s => studyAdapter(b, s));
  b.each(p.comparisonRisks, "Project.comparisonRisks", r => risk(b, r, "Project.comparisonRisks", false));
  b.each(p.decisions, "Project.decisions", d => decisionAdapter(b, p, d, false));
}
