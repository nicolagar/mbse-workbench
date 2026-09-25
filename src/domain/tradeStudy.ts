import { derivationStatus } from "./derivation";
import { simulationStatus } from "./simulation";
import type {
  ComparisonStudy,
  Project,
  StudyCriterion,
  TradeStudyCandidateRef,
  TradeStudyStatus,
  ValidationResult,
  WorkspaceId
} from "./types";
import { validateConfiguration } from "./variability";
import { modelConsistencyErrors } from "./validation";

export interface CandidateReadiness {
  candidateId: string;
  label: string;
  configurationId: string;
  architectureId: string;
  configurationPresent: boolean;
  validationReady: boolean;
  derivationReady: boolean;
  modelRevisionReady: boolean;
  simulationReady: boolean;
  requiredKpiIds: string[];
  coveredKpiIds: string[];
  kpiCoveragePercent: number;
  simulationRunId?: string;
  state: "Ready" | "Blocked";
  missing: Array<{
    id: "configuration" | "validation" | "derivation" | "modelRevision" | "simulation" | "kpiCoverage" | "consistency";
    label: string;
    workspace: WorkspaceId;
  }>;
}

export interface TradeStudyWorkflowStep {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  workspace: WorkspaceId;
  tab: string;
}

const unique = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export function requiredStudyKpiIds(study: ComparisonStudy): string[] {
  return unique([
    ...study.selectedKpiIds,
    ...study.criteria.map((criterion) => criterion.kpiId)
  ]);
}

function latestCandidateRun(project: Project, candidate: TradeStudyCandidateRef) {
  return [...project.simulationRuns]
    .filter((run) =>
      run.configurationId === candidate.configurationId
      && run.architectureId === candidate.architectureId
    )
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
}

export function candidateReadiness(
  project: Project,
  study: ComparisonStudy,
  candidate: TradeStudyCandidateRef
): CandidateReadiness {
  const configuration = project.configurations.find((item) => item.id === candidate.configurationId);
  const architecture = project.architectures.find((item) => item.id === candidate.architectureId);
  const configurationPresent = Boolean(
    configuration
    && architecture
    && configuration.architectureId === architecture.id
    && architecture.configurationId === configuration.id
    && !configuration.archivedAt
    && architecture.status !== "archived"
  );
  const validationReady = Boolean(
    configurationPresent
    && configuration?.validationStatus === "valid"
    && !validateConfiguration(project, configuration).some((finding) => finding.severity === "error")
  );
  const requiredKpiIds = requiredStudyKpiIds(study);
  const run = configurationPresent ? latestCandidateRun(project, candidate) : undefined;
  const currentConfiguredRun = Boolean(
    run
    && run.configurationId === candidate.configurationId
    && run.derivationId
    && run.inputSnapshot.configurationId === candidate.configurationId
    && run.inputSnapshot.realizedElements.length
    && run.projectModelRevisionAtRun === project.modelRevision
  );
  const derivationReady = Boolean(
    validationReady
    && configuration
    && (derivationStatus(project, configuration) === "Current" || currentConfiguredRun)
  );
  const modelRevisionReady = Boolean(
    derivationReady
    && (
      configuration?.derivation?.sourceModelRevision === project.modelRevision
      || run?.projectModelRevisionAtRun === project.modelRevision
    )
  );
  const coveredKpiIds = run
    ? requiredKpiIds.filter((kpiId) =>
        run.results.some((result) => result.kpiId === kpiId && typeof result.value === "number" && Number.isFinite(result.value))
      )
    : [];
  const simulationReady = Boolean(
    run
    && run.configurationId
    && run.inputSnapshot.configurationId
    && run.inputSnapshot.realizedElements.length
    && simulationStatus(project, run) === "Current"
  );
  const kpiCoveragePercent = requiredKpiIds.length
    ? Math.round(coveredKpiIds.length / requiredKpiIds.length * 100)
    : 0;
  const missing: CandidateReadiness["missing"] = [];
  if (!configurationPresent) missing.push({ id: "configuration", label: "Create or restore the configuration and architecture", workspace: "variability" });
  if (configurationPresent && !validationReady) missing.push({ id: "validation", label: "Validate the configuration", workspace: "variability" });
  if (validationReady && !derivationReady) missing.push({ id: "derivation", label: "Derive the 100% architecture", workspace: "variability" });
  if (derivationReady && !modelRevisionReady) missing.push({ id: "modelRevision", label: "Re-derive at the current model revision", workspace: "variability" });
  if (configuration?.derivation && derivationStatus(project, configuration) === "Current" && modelConsistencyErrors(configuration.derivation.validationSnapshot).length) missing.push({ id: "consistency", label: "Resolve model consistency findings", workspace: "model" });
  if (!simulationReady) missing.push({ id: "simulation", label: "Run a configured 100% simulation", workspace: "simulation" });
  if (!requiredKpiIds.length || kpiCoveragePercent < 100) {
    missing.push({
      id: "kpiCoverage",
      label: requiredKpiIds.length
        ? `Simulate all required KPIs (${coveredKpiIds.length}/${requiredKpiIds.length})`
        : "Define at least one KPI-backed criterion",
      workspace: requiredKpiIds.length ? "simulation" : "parameters"
    });
  }
  return {
    candidateId: candidate.id,
    label: candidate.label,
    configurationId: candidate.configurationId,
    architectureId: candidate.architectureId,
    configurationPresent,
    validationReady,
    derivationReady,
    modelRevisionReady,
    simulationReady,
    requiredKpiIds,
    coveredKpiIds,
    kpiCoveragePercent,
    simulationRunId: run?.id,
    state: missing.length ? "Blocked" : "Ready",
    missing
  };
}

export function tradeStudyReadiness(project: Project, study: ComparisonStudy): CandidateReadiness[] {
  return study.candidateRefs.map((candidate) => candidateReadiness(project, study, candidate));
}

export function mixedEvidenceWarning(project: Project, study: ComparisonStudy): string | undefined {
  const kinds = new Set(study.alternativeRefs.map((alternative) => {
    const run = project.simulationRuns.find((candidate) => candidate.id === alternative.simulationRunId);
    return alternative.configurationId && run?.configurationId ? "configured100" : "architecture150";
  }));
  return kinds.size > 1
    ? "150% architecture-only evidence is mixed with configured 100% evidence. These evidence bases are not directly comparable; the manager workflow excludes the 150% alternative."
    : undefined;
}

export function managerReadyAlternatives(project: Project, study: ComparisonStudy) {
  const readyConfigurationIds = new Set(
    tradeStudyReadiness(project, study)
      .filter((item) => item.state === "Ready")
      .map((item) => item.configurationId)
  );
  return study.alternativeRefs.filter((alternative) =>
    Boolean(alternative.configurationId && readyConfigurationIds.has(alternative.configurationId))
  );
}

export function deriveTradeStudyStatus(project: Project, study: ComparisonStudy): TradeStudyStatus {
  if (project.decisions.some((decision) =>
    decision.status === "approved" && decision.supportingComparisonStudyIds.includes(study.id)
  )) return "decided";
  if (study.results.length) return "analyzed";
  const readiness = tradeStudyReadiness(project, study);
  if (readiness.length >= 2 && readiness.every((item) => item.state === "Ready")) return "ready";
  if (study.candidateRefs.length >= 2) return "collectingEvidence";
  if (study.candidateRefs.length) return "definingCandidates";
  return "framing";
}

export function tradeStudyWorkflow(project: Project, study: ComparisonStudy): TradeStudyWorkflowStep[] {
  const readiness = tradeStudyReadiness(project, study);
  const requiredKpis = requiredStudyKpiIds(study);
  const sameKpisReady = readiness.length >= 2
    && requiredKpis.length > 0
    && readiness.every((item) => item.kpiCoveragePercent === 100);
  const approvedDecision = project.decisions.find((decision) =>
    decision.status === "approved" && decision.supportingComparisonStudyIds.includes(study.id)
  );
  return [
    { id: "frame", label: "1. Frame decision question", detail: "Connect an unresolved planning question to the Trade Study.", complete: Boolean(study.question.trim() && study.originatingOpenDecisionId), workspace: "comparison", tab: "Framing and Criteria" },
    { id: "objectives", label: "2. Select needs and objectives", detail: "Use first-class objective records to state what creates value.", complete: study.objectiveIds.length > 0, workspace: "comparison", tab: "Framing and Criteria" },
    { id: "criteria", label: "3. Define constraints and criteria", detail: "Separate mandatory feasibility from optimization and context criteria.", complete: study.mandatoryRequirementIds.length > 0 && study.criteria.length > 0, workspace: "comparison", tab: "Framing and Criteria" },
    { id: "features", label: "4. Select design axes", detail: "Identify the features intentionally explored by the study.", complete: study.exploredFeatureIds.length > 0, workspace: "comparison", tab: "Framing and Criteria" },
    { id: "candidates", label: "5. Create candidate configurations", detail: "Create at least two named, study-owned candidate configurations.", complete: study.candidateRefs.length >= 2, workspace: "comparison", tab: "Candidates and Readiness" },
    { id: "derive", label: "6. Validate and derive 100%", detail: "Every candidate needs a valid, current 100% realization.", complete: readiness.length >= 2 && readiness.every((item) => item.validationReady && item.derivationReady && item.modelRevisionReady), workspace: "comparison", tab: "Candidates and Readiness" },
    { id: "simulate", label: "7. Simulate the same KPIs", detail: "Produce current evidence for the same required KPI set.", complete: sameKpisReady, workspace: "comparison", tab: "Candidates and Readiness" },
    { id: "readiness", label: "8. Check evidence readiness", detail: "Review configuration, derivation, revision and KPI coverage together.", complete: readiness.length >= 2 && readiness.every((item) => item.state === "Ready"), workspace: "comparison", tab: "Candidates and Readiness" },
    {
      id: "analyze",
      label: "9. Analyze feasibility, Pareto, value and robustness",
      detail: "Screen mandatory evidence, evaluate feasible-only Pareto and fixed SMART/MAVT value, then review sensitivity, residual risk and bounded robustness.",
      complete: Boolean(
        study.results.some((result) => result.methodology === "fixed-smart-mavt")
        && study.sensitivityResult
        && study.robustnessResults?.length
      ),
      workspace: "comparison",
      tab: "Manager Summary"
    },
    { id: "decide", label: "10. Record decision and baseline", detail: "Approve with rationale and establish the selected architecture baseline.", complete: Boolean(approvedDecision && project.baselineArchitectureId), workspace: "comparison", tab: "Decision Rationale" }
  ];
}

function tradeStudyFinding(
  ruleId: string,
  severity: ValidationResult["severity"],
  message: string
): ValidationResult {
  return {
    id: `${ruleId}-${message}`,
    ruleId,
    severity,
    title: "Trade Study integrity",
    message,
    affectedElementIds: [],
    affectedRelationshipIds: [],
    category: "comparison",
    resolved: false
  };
}

export function validateTradeStudyReferences(project: Project, study: ComparisonStudy): ValidationResult[] {
  const findings: ValidationResult[] = [];
  const objectiveIds = new Set(project.elements.filter((element) => element.elementType === "objective").map((element) => element.id));
  const requirementIds = new Set(project.elements.filter((element) => element.elementType === "systemRequirement").map((element) => element.id));
  const featureIds = new Set(project.features.map((feature) => feature.id));
  const kpiIds = new Set(project.kpis.map((kpi) => kpi.id));
  const configurationIds = new Set(project.configurations.map((configuration) => configuration.id));
  const architectureIds = new Set(project.architectures.map((architecture) => architecture.id));
  if (study.originatingOpenDecisionId && !project.openDecisions.some((decision) => decision.id === study.originatingOpenDecisionId)) {
    findings.push(tradeStudyFinding("PMC-301", "error", `${study.name} references a missing originating open decision.`));
  }
  study.objectiveIds.filter((id) => !objectiveIds.has(id))
    .forEach((id) => findings.push(tradeStudyFinding("PMC-302", "error", `${study.name} references missing objective ${id}.`)));
  study.mandatoryRequirementIds.filter((id) => !requirementIds.has(id))
    .forEach((id) => findings.push(tradeStudyFinding("PMC-303", "error", `${study.name} references missing mandatory requirement ${id}.`)));
  study.exploredFeatureIds.filter((id) => !featureIds.has(id))
    .forEach((id) => findings.push(tradeStudyFinding("PMC-304", "error", `${study.name} references missing explored feature ${id}.`)));
  study.criteria.forEach((criterion: StudyCriterion) => {
    criterion.sourceObjectiveIds.filter((id) => !objectiveIds.has(id))
      .forEach((id) => findings.push(tradeStudyFinding("PMC-305", "error", `${criterion.name} references missing objective ${id}.`)));
    criterion.sourceRequirementIds.filter((id) => !requirementIds.has(id))
      .forEach((id) => findings.push(tradeStudyFinding("PMC-306", "error", `${criterion.name} references missing requirement ${id}.`)));
    if (criterion.kpiId && !kpiIds.has(criterion.kpiId)) findings.push(tradeStudyFinding("PMC-307", "error", `${criterion.name} references missing KPI ${criterion.kpiId}.`));
    if (criterion.requiredFeatureId && !featureIds.has(criterion.requiredFeatureId)) findings.push(tradeStudyFinding("PMC-308", "error", `${criterion.name} references missing feature ${criterion.requiredFeatureId}.`));
  });
  study.candidateRefs.forEach((candidate) => {
    if (!configurationIds.has(candidate.configurationId) || !architectureIds.has(candidate.architectureId)) {
      findings.push(tradeStudyFinding("PMC-309", "error", `${candidate.label} references a missing configuration or architecture.`));
    }
  });
  const mixed = mixedEvidenceWarning(project, study);
  if (mixed) findings.push(tradeStudyFinding("PMC-310", "warning", mixed));
  return findings;
}
