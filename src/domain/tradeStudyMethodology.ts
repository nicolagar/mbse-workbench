import { assessRequirement } from "./requirementAssessment";
import { baselineRequirementIds } from "./ontology";
import {
  compatibleRun,
  leadingAlternativeIds,
  runComparison,
  validateComparisonStudy
} from "./comparison";
import type {
  AlternativeFeasibility,
  BoundedRobustnessResult,
  ComparisonResult,
  ComparisonRisk,
  ComparisonScenario,
  ComparisonScenarioEffect,
  ComparisonStudy,
  ParetoAlternativeResult,
  Project,
  RequirementComplianceEvidence,
  RobustnessCaseResult,
  StakeholderValueFunction,
  StudyCriterion,
  WeightSensitivityResult
} from "./types";
import { simulationStatus } from "./simulation";
import { calculateSemanticScope } from "./semanticScope";
import { validateConfiguration } from "./variability";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const round = (value: number, precision = 2) => {
  const scale = 10 ** precision;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};
const clamp = (value: number) => Math.min(100, Math.max(0, value));

export interface MethodologyAttempt {
  result?: ComparisonResult;
  errors: string[];
  warnings: string[];
}

export interface RiskSummary {
  alternativeId: string;
  totalResidualExposure: number;
  maximumResidualExposure: number;
  unresolvedHighCriticalCount: number;
}

export function inherentExposure(risk: ComparisonRisk): number {
  return risk.inherentLikelihood * risk.inherentImpact;
}

export function residualExposure(risk: ComparisonRisk): number {
  return risk.residualLikelihood * risk.residualImpact;
}

export function riskBand(exposure: number): "low" | "moderate" | "high" | "critical" {
  if (exposure >= 20) return "critical";
  if (exposure >= 12) return "high";
  if (exposure >= 6) return "moderate";
  return "low";
}

export function summarizeRisks(
  project: Project,
  study: ComparisonStudy
): Record<string, RiskSummary> {
  return Object.fromEntries(study.alternativeRefs.map((alternative) => {
    const risks = project.comparisonRisks.filter((risk) =>
      risk.comparisonStudyId === study.id && risk.alternativeId === alternative.id
    );
    const exposures = risks.map(residualExposure);
    return [alternative.id, {
      alternativeId: alternative.id,
      totalResidualExposure: exposures.reduce((sum, value) => sum + value, 0),
      maximumResidualExposure: exposures.length ? Math.max(...exposures) : 0,
      unresolvedHighCriticalCount: risks.filter((risk) =>
        risk.status !== "closed" && residualExposure(risk) >= 12
      ).length
    }];
  }));
}

export function validateStakeholderValueFunction(
  valueFunction?: StakeholderValueFunction
): string[] {
  if (!valueFunction) return ["A fixed stakeholder value function is required."];
  const errors: string[] = [];
  const numeric = (value: unknown, label: string) => {
    if (!finite(value)) errors.push(`${label} must be finite.`);
  };
  if (valueFunction.type === "piecewiseLinear") {
    const points = valueFunction.points ?? [];
    if (points.length < 2) errors.push("A piecewise-linear function requires at least two points.");
    points.forEach((point, index) => {
      numeric(point.input, `Point ${index + 1} input`);
      numeric(point.value, `Point ${index + 1} value`);
      if (finite(point.value) && (point.value < 0 || point.value > 100)) {
        errors.push(`Point ${index + 1} value must be between 0 and 100.`);
      }
      if (index > 0 && point.input <= points[index - 1].input) {
        errors.push("Piecewise-linear inputs must be strictly increasing.");
      }
    });
    return errors;
  }
  numeric(valueFunction.worst, "Worst bound");
  numeric(valueFunction.best, "Best bound");
  if (finite(valueFunction.worst) && finite(valueFunction.best)
    && valueFunction.worst === valueFunction.best) {
    errors.push("Worst and best bounds must differ.");
  }
  if (valueFunction.type === "target") {
    numeric(valueFunction.target, "Target");
    if (finite(valueFunction.worst) && finite(valueFunction.best) && finite(valueFunction.target)) {
      const lower = Math.min(valueFunction.worst, valueFunction.best);
      const upper = Math.max(valueFunction.worst, valueFunction.best);
      if (valueFunction.target <= lower || valueFunction.target >= upper) {
        errors.push("Target must be strictly inside the fixed bounds.");
      }
    }
  }
  if (valueFunction.type === "acceptableRange") {
    numeric(valueFunction.acceptableMinimum, "Acceptable minimum");
    numeric(valueFunction.acceptableMaximum, "Acceptable maximum");
    if (
      finite(valueFunction.worst)
      && finite(valueFunction.best)
      && finite(valueFunction.acceptableMinimum)
      && finite(valueFunction.acceptableMaximum)
    ) {
      const lower = Math.min(valueFunction.worst, valueFunction.best);
      const upper = Math.max(valueFunction.worst, valueFunction.best);
      if (
        valueFunction.acceptableMinimum > valueFunction.acceptableMaximum
        || valueFunction.acceptableMinimum < lower
        || valueFunction.acceptableMaximum > upper
      ) errors.push("Acceptable range must be ordered and inside the fixed bounds.");
    }
  }
  return errors;
}

export function stakeholderValue(
  raw: number,
  valueFunction: StakeholderValueFunction
): number {
  const errors = validateStakeholderValueFunction(valueFunction);
  if (errors.length) throw new Error(errors.join(" "));
  if (valueFunction.type === "piecewiseLinear") {
    const points = valueFunction.points!;
    if (raw <= points[0].input) return round(points[0].value, 8);
    if (raw >= points.at(-1)!.input) return round(points.at(-1)!.value, 8);
    const upperIndex = points.findIndex((point) => point.input >= raw);
    const lower = points[upperIndex - 1];
    const upper = points[upperIndex];
    const ratio = (raw - lower.input) / (upper.input - lower.input);
    return round(clamp(lower.value + ratio * (upper.value - lower.value)), 8);
  }
  const worst = valueFunction.worst!;
  const best = valueFunction.best!;
  if (valueFunction.type === "maximize" || valueFunction.type === "minimize") {
    return round(clamp((raw - worst) / (best - worst) * 100), 8);
  }
  if (valueFunction.type === "target") {
    const target = valueFunction.target!;
    if (raw === target) return 100;
    const boundary = raw < target
      ? Math.min(worst, best)
      : Math.max(worst, best);
    return round(clamp((raw - boundary) / (target - boundary) * 100), 8);
  }
  const minimum = valueFunction.acceptableMinimum!;
  const maximum = valueFunction.acceptableMaximum!;
  if (raw >= minimum && raw <= maximum) return 100;
  const boundary = raw < minimum ? Math.min(worst, best) : Math.max(worst, best);
  const acceptable = raw < minimum ? minimum : maximum;
  return round(clamp((raw - boundary) / (acceptable - boundary) * 100), 8);
}

function runEvidenceProject(
  project: Project,
  study: ComparisonStudy,
  alternativeId: string,
  effects: ComparisonScenarioEffect[] = []
): Project | undefined {
  const alternative = study.alternativeRefs.find((item) => item.id === alternativeId);
  if (!alternative) return undefined;
  const run = compatibleRun(project, alternative);
  if (!run) return undefined;
  const evidenceProject = {
    ...project,
    elements: structuredClone(run.inputSnapshot.realizedElements),
    relationships: structuredClone(run.inputSnapshot.realizedRelationships),
    kpis: structuredClone(project.kpis)
  };
  run.results.forEach((result) => {
    if (!result.kpiId) return;
    const kpi = evidenceProject.kpis.find((item) => item.id === result.kpiId);
    if (kpi) kpi.lastCalculatedValue = result.value;
  });
  effects.forEach((effect) => {
    if (effect.type !== "parameterPercent" && effect.type !== "parameterRange") return;
    evidenceProject.elements.forEach((element) => {
      const parameter = element.parameters.find((item) => item.id === effect.targetId);
      if (!parameter || !finite(parameter.value)) return;
      parameter.value = effect.type === "parameterPercent"
        ? parameter.value * (1 + effect.percent / 100)
        : (effect.minimum + effect.maximum) / 2;
    });
  });
  return evidenceProject;
}

export function evaluateMandatoryFeasibility(
  project: Project,
  study: ComparisonStudy,
  alternativeId: string,
  effects: ComparisonScenarioEffect[] = []
): AlternativeFeasibility {
  const alternative = study.alternativeRefs.find((item) => item.id === alternativeId);
  const run = alternative ? compatibleRun(project, alternative) : undefined;
  const evidenceProject = run ? runEvidenceProject(project, study, alternativeId, effects) : undefined;
  const evidence: RequirementComplianceEvidence[] = baselineRequirementIds(project, study).map((requirementId) => {
    const requirement = evidenceProject?.elements.find((item) => item.id === requirementId)
      ?? project.elements.find((item) => item.id === requirementId);
    if (!run || !requirement || !evidenceProject?.elements.some((item) => item.id === requirementId) || run.projectModelRevisionAtRun !== project.modelRevision) {
      return {
        requirementId,
        requirementName: requirement?.name ?? requirementId,
        status: "missing",
        evidence: run
          ? "Requirement is absent from the immutable realized model."
          : "A compatible immutable simulation run is missing.",
        simulationRunId: run?.id ?? ""
      };
    }
    const evaluation = assessRequirement(evidenceProject!, requirement, alternative?.configurationId);
    const status = ["met", "assumed"].includes(evaluation.status)
      ? "satisfied"
      : evaluation.status === "notMet"
        ? "failed"
        : "missing";
    return {
      requirementId,
      requirementName: requirement.name,
      status,
      basis: evaluation.basis,
      expression: requirement.requirementFormula?.expression,
      evidence: `${evaluation.label}. ${evaluation.detail} Evidence: simulation ${run.id}, model revision ${run.projectModelRevisionAtRun}.`,
      simulationRunId: run.id
    };
  });
  const configuration = alternative?.configurationId
    ? project.configurations.find((item) => item.id === alternative.configurationId)
    : undefined;
  study.criteria.filter((criterion) => criterion.type === "mandatory" && criterion.requiredFeatureId)
    .forEach((criterion) => {
      const requiredFeatureId = criterion.requiredFeatureId!;
      const satisfied = Boolean(configuration?.effectiveSelectedFeatureIds.includes(requiredFeatureId));
      evidence.push({
        requirementId: `feature:${requiredFeatureId}`,
        requirementName: criterion.name,
        status: satisfied ? "satisfied" : configuration ? "failed" : "missing",
        evidence: satisfied
          ? `Required feature ${requiredFeatureId} is selected in configuration ${configuration!.id}.`
          : `Required feature ${requiredFeatureId} is not selected in the referenced configuration.`,
        simulationRunId: run?.id ?? ""
      });
    });
  const failedRequirementIds = evidence.filter((item) => item.status === "failed").map((item) => item.requirementId);
  const missingRequirementIds = evidence.filter((item) => item.status === "missing").map((item) => item.requirementId);
  const exception = study.feasibilityExceptions?.[alternativeId];
  const exceptionApproved = exception?.approvalState === "approved";
  return {
    status: exceptionApproved
      ? "exceptionApproved"
      : failedRequirementIds.length
        ? "infeasible"
        : missingRequirementIds.length
          ? "unknown"
          : "feasible",
    requirementEvidence: evidence,
    failedRequirementIds,
    missingRequirementIds,
    exceptionRationale: exception?.rationale,
    exceptionApproved
  };
}

function optimizationCriteria(study: ComparisonStudy): StudyCriterion[] {
  return study.criteria.filter((criterion) =>
    criterion.type === "optimization" && criterion.kpiId
  );
}

function paretoFromRaw(
  study: ComparisonStudy,
  rawValues: ComparisonResult["rawValues"],
  feasibility: Record<string, AlternativeFeasibility>
): Record<string, ParetoAlternativeResult> {
  const criteria = optimizationCriteria(study);
  const pareto: Record<string, ParetoAlternativeResult> = {};
  const feasible = study.alternativeRefs.filter((alternative) =>
    feasibility[alternative.id]?.status === "feasible"
  );
  const comparable = feasible.filter((alternative) =>
    criteria.length > 0
    && criteria.every((criterion) => finite(rawValues[alternative.id]?.[criterion.kpiId!]))
  );
  const dominates = (leftId: string, rightId: string) => {
    let strictlyBetter = false;
    for (const criterion of criteria) {
      const kpiId = criterion.kpiId!;
      const left = rawValues[leftId][kpiId] as number;
      const right = rawValues[rightId][kpiId] as number;
      const direction = study.kpiSettings[kpiId]?.optimizationDirection ?? "minimize";
      if (direction === "maximize" ? left < right : left > right) return false;
      if (left !== right) strictlyBetter = true;
    }
    return strictlyBetter;
  };
  study.alternativeRefs.forEach((alternative) => {
    const feasibilityStatus = feasibility[alternative.id]?.status;
    if (feasibilityStatus === "infeasible" || feasibilityStatus === "exceptionApproved") {
      pareto[alternative.id] = {
        status: "infeasible",
        dominatedByAlternativeIds: [],
        dominatesAlternativeIds: [],
        explanation: feasibilityStatus === "exceptionApproved"
          ? "A documented feasibility exception exists; this alternative is excluded from the normal feasible Pareto set."
          : "Mandatory feasibility failed; this alternative remains visible outside the feasible Pareto set."
      };
      return;
    }
    if (!comparable.some((item) => item.id === alternative.id)) {
      pareto[alternative.id] = {
        status: "unknown",
        dominatedByAlternativeIds: [],
        dominatesAlternativeIds: [],
        explanation: "Pareto status is Unknown because comparable finite evidence is incomplete."
      };
      return;
    }
    const dominatedByAlternativeIds = comparable
      .filter((other) => other.id !== alternative.id && dominates(other.id, alternative.id))
      .map((other) => other.id);
    const dominatesAlternativeIds = comparable
      .filter((other) => other.id !== alternative.id && dominates(alternative.id, other.id))
      .map((other) => other.id);
    pareto[alternative.id] = {
      status: dominatedByAlternativeIds.length ? "dominated" : "nonDominated",
      dominatedByAlternativeIds,
      dominatesAlternativeIds,
      explanation: dominatedByAlternativeIds.length
        ? `Dominated by ${dominatedByAlternativeIds.join(", ")} across comparable criteria, with at least one strict improvement.`
        : dominatesAlternativeIds.length
          ? `Non-dominated and dominates ${dominatesAlternativeIds.join(", ")} across comparable criteria.`
          : "Non-dominated; no feasible alternative is at least as good on every comparable criterion and strictly better on one."
    };
  });
  return pareto;
}

function fixedScores(
  study: ComparisonStudy,
  rawValues: ComparisonResult["rawValues"]
) {
  const criteria = optimizationCriteria(study);
  const totalWeight = criteria.reduce((sum, criterion) => sum + Math.max(0, criterion.weight ?? 0), 0);
  const stakeholderValues: NonNullable<ComparisonResult["stakeholderValues"]> = {};
  const weightedContributions: NonNullable<ComparisonResult["weightedContributions"]> = {};
  const stakeholderValueScores: NonNullable<ComparisonResult["stakeholderValueScores"]> = {};
  const dataCoveragePercent: ComparisonResult["dataCoveragePercent"] = {};
  const explanations: NonNullable<ComparisonResult["calculationExplanations"]> = {};
  study.alternativeRefs.forEach((alternative) => {
    stakeholderValues[alternative.id] = {};
    weightedContributions[alternative.id] = {};
    explanations[alternative.id] = {};
    let availableWeight = 0;
    let contribution = 0;
    criteria.forEach((criterion) => {
      const kpiId = criterion.kpiId!;
      const raw = rawValues[alternative.id]?.[kpiId];
      const weight = Math.max(0, criterion.weight ?? 0);
      if (!finite(raw) || !criterion.stakeholderValueFunction) {
        stakeholderValues[alternative.id][kpiId] = null;
        weightedContributions[alternative.id][kpiId] = null;
        explanations[alternative.id][kpiId] = !finite(raw)
          ? "Missing immutable KPI evidence; missing is never converted to zero."
          : "A fixed stakeholder value function is missing.";
        return;
      }
      const value = stakeholderValue(raw, criterion.stakeholderValueFunction);
      stakeholderValues[alternative.id][kpiId] = value;
      weightedContributions[alternative.id][kpiId] = round(value * weight);
      explanations[alternative.id][kpiId] =
        `${raw} transformed by fixed ${criterion.stakeholderValueFunction.type} value function to ${round(value)}; raw weight ${weight}.`;
      availableWeight += weight;
      contribution += value * weight;
    });
    stakeholderValueScores[alternative.id] = availableWeight > 0
      ? round(contribution / availableWeight)
      : null;
    dataCoveragePercent[alternative.id] = totalWeight > 0
      ? round(availableWeight / totalWeight * 100)
      : 0;
  });
  return {
    stakeholderValues,
    weightedContributions,
    stakeholderValueScores,
    dataCoveragePercent,
    calculationExplanations: explanations
  };
}

export function validateFixedMethodology(project: Project, study: ComparisonStudy): string[] {
  const errors = validateComparisonStudy(project, study)
    .filter((finding) => finding.severity === "error")
    .map((finding) => `${finding.ruleId}: ${finding.message}`);
  optimizationCriteria(study).forEach((criterion) => {
    validateStakeholderValueFunction(criterion.stakeholderValueFunction)
      .forEach((message) => errors.push(`${criterion.name}: ${message}`));
    if (!finite(criterion.weight) || (criterion.weight ?? 0) < 0) {
      errors.push(`${criterion.name}: weight must be finite and non-negative.`);
    }
  });
  if (!optimizationCriteria(study).some((criterion) => (criterion.weight ?? 0) > 0)) {
    errors.push("At least one optimization criterion must have a positive weight.");
  }
  return [...new Set(errors)];
}

export function runTradeStudyMethodology(
  project: Project,
  study: ComparisonStudy,
  now = new Date()
): MethodologyAttempt {
  const errors = validateFixedMethodology(project, study);
  if (errors.length) return { errors, warnings: [] };
  const legacy = runComparison(project, study, now);
  if (!legacy.result) return legacy;
  const feasibility = Object.fromEntries(study.alternativeRefs.map((alternative) => [
    alternative.id,
    evaluateMandatoryFeasibility(project, study, alternative.id)
  ]));
  const fixed = fixedScores(study, legacy.result.rawValues);
  const pareto = paretoFromRaw(study, legacy.result.rawValues, feasibility);
  const eligibleScores = Object.fromEntries(study.alternativeRefs.map((alternative) => [
    alternative.id,
    feasibility[alternative.id].status === "feasible"
      ? fixed.stakeholderValueScores[alternative.id]
      : null
  ]));
  const recommendedAlternativeIds = leadingAlternativeIds(eligibleScores);
  const warnings = [...legacy.warnings];
  study.alternativeRefs.forEach((alternative) => {
    const item = feasibility[alternative.id];
    if (item.status === "infeasible") {
      warnings.push(`PMC-401: ${alternative.label} is infeasible and excluded from the normal recommendation.`);
    } else if (item.status === "unknown") {
      warnings.push(`PMC-402: ${alternative.label} has unknown mandatory feasibility.`);
    } else if (item.status === "exceptionApproved") {
      warnings.push(`PMC-403: ${alternative.label} has an approved exception and is not a normal feasible leader.`);
    }
  });
  if (recommendedAlternativeIds.length > 1) warnings.push("PMC-404: Feasible stakeholder-value leaders are tied.");
  return {
    result: {
      ...legacy.result,
      id: `methodology-result-${crypto.randomUUID()}`,
      methodology: "fixed-smart-mavt",
      feasibility,
      stakeholderValues: fixed.stakeholderValues,
      weightedContributions: fixed.weightedContributions,
      stakeholderValueScores: fixed.stakeholderValueScores,
      dataCoveragePercent: fixed.dataCoveragePercent,
      calculationExplanations: fixed.calculationExplanations,
      pareto,
      recommendedAlternativeIds,
      recommendationLabel: "Highest stakeholder value among alternatives satisfying every mandatory requirement.",
      warnings: [...new Set(warnings)]
    },
    errors: [],
    warnings: [...new Set(warnings)]
  };
}

function normalizeAgainstFeasible(
  values: Record<string, number | null>,
  feasibleAlternativeIds: string[],
  direction: "minimize" | "maximize"
): Record<string, number | null> {
  const anchors = feasibleAlternativeIds
    .map((id) => values[id])
    .filter(finite);
  if (!anchors.length) return Object.fromEntries(Object.keys(values).map((id) => [id, null]));
  const minimum = Math.min(...anchors);
  const maximum = Math.max(...anchors);
  if (minimum === maximum) {
    return Object.fromEntries(Object.entries(values).map(([id, value]) => [id, finite(value) ? 100 : null]));
  }
  return Object.fromEntries(Object.entries(values).map(([id, value]) => {
    if (!finite(value)) return [id, null];
    const score = direction === "maximize"
      ? 100 * (value - minimum) / (maximum - minimum)
      : 100 * (maximum - value) / (maximum - minimum);
    return [id, round(clamp(score), 8)];
  }));
}

/**
 * Minimal traceable Trade Study method used by the simplified workflow.
 * Historical fixed SMART/MAVT results remain readable and immutable.
 */
export function runTraceableTradeStudy(
  project: Project,
  study: ComparisonStudy,
  now = new Date()
): MethodologyAttempt {
  const errors: string[] = [];
  const selectedNeedIds = study.needIds ?? [];
  const selectedUseCaseIds = study.useCaseIds ?? [];
  const semanticScope = calculateSemanticScope(project, selectedUseCaseIds);
  if (!study.name.trim()) errors.push("Enter the Trade Study name.");
  if (!study.question.trim()) errors.push("Enter the decision question.");
  if (!selectedNeedIds.length) errors.push("Select at least one existing need.");
  if (!study.objectiveIds.length) errors.push("Select at least one existing objective.");
  if (!selectedUseCaseIds.length) errors.push("Select at least one active use case.");
  if (!semanticScope.systemOfInterest) errors.push("Designate exactly one system of interest before defining the Trade Study scope.");
  if (semanticScope.invalidUseCaseIds.length) errors.push("Every Trade Study use case must be in the project working scope and involve the system of interest.");
  const eligibleNeedIds = new Set(semanticScope.needs.map((need) => need.id));
  const eligibleObjectiveIds = new Set(semanticScope.objectives.map((objective) => objective.id));
  const eligibleSelectedObjectiveIds = new Set(study.objectiveIds.filter((id) => eligibleObjectiveIds.has(id)));
  selectedNeedIds.forEach((id) => {
    if (!project.elements.some((item) => item.id === id && item.elementType === "need")) errors.push(`Selected need ${id} no longer exists.`);
    else if (!eligibleNeedIds.has(id)) errors.push(`Selected need ${id} is outside the selected use-case stakeholder scope.`);
  });
  study.objectiveIds.forEach((id) => {
    if (!project.elements.some((item) => item.id === id && item.elementType === "objective")) errors.push(`Selected objective ${id} no longer exists.`);
    else if (!eligibleObjectiveIds.has(id)) errors.push(`Selected objective ${id} is outside the selected use-case stakeholder scope.`);
  });
  selectedUseCaseIds.forEach((id) => {
    if (!project.selectedUseCaseIds.includes(id)
      || !project.elements.some((item) => item.id === id && item.elementType === "useCase")) {
      errors.push(`Selected use case ${id} is not in the active project scope.`);
    }
  });
  const scopedSourceIds = new Set([...selectedNeedIds, ...study.objectiveIds]);
  const tracedRequirementIds = [...new Set(project.relationships
    .filter((relationship) =>
      relationship.relationshipType === "derives"
      && scopedSourceIds.has(relationship.sourceId)
      && project.elements.some((item) => item.id === relationship.targetId && item.elementType === "systemRequirement")
    )
    .map((relationship) => relationship.targetId))];
  if (!tracedRequirementIds.length) errors.push("The selected scope must trace to at least one requirement.");
  const roots = project.features.filter((feature) => feature.featureType === "root");
  if (roots.length !== 1 || study.rootFeatureId !== roots[0]?.id) {
    errors.push("Link the active Trade Study to the single project Root Feature.");
  }
  const selectedAxisIds = study.selectedVariabilityAxisIds ?? [];
  if (!selectedAxisIds.length) errors.push("Select at least one reusable variability axis.");
  selectedAxisIds.forEach((axisId) => {
    const axis = project.variabilityAxes.find((candidate) => candidate.id === axisId);
    if (!axis || !project.featureGroups.some((group) => group.id === axis.featureGroupId && group.parentFeatureId === study.rootFeatureId)) {
      errors.push(`Variability axis ${axisId} or its linked FeatureGroup is missing.`);
    }
  });
  if (study.alternativeRefs.length < 2) errors.push("Select at least two valid configuration-derived alternatives.");
  if (!study.selectedKpiIds.length) errors.push("Select at least one existing KPI.");

  const globalSettings = Object.fromEntries(study.selectedKpiIds.map((kpiId) => {
    const kpi = project.kpis.find((item) => item.id === kpiId);
    if (!kpi) errors.push(`Selected KPI ${kpiId} no longer exists.`);
    if (kpi && (!finite(kpi.weight) || kpi.weight < 0)) errors.push(`${kpi.name} has an invalid global weight.`);
    if (kpi && !kpi.objectiveIds.length) errors.push(`${kpi.name} must link to at least one objective.`);
    if (kpi && !kpi.objectiveIds.some((objectiveId) => eligibleSelectedObjectiveIds.has(objectiveId))) errors.push(`${kpi.name} must link to an eligible objective selected in this Trade Study.`);
    if (kpi && !kpi.outputUnit.trim()) errors.push(`${kpi.name} must define an output unit.`);
    if (kpi && !kpi.formula?.trim() && !kpi.standardAlgorithmKey) errors.push(`${kpi.name} must define a formula or standard algorithm.`);
    return [kpiId, {
      weight: kpi?.weight ?? 0,
      optimizationDirection: kpi?.optimizationDirection ?? "minimize"
    }];
  }));
  if (study.selectedKpiIds.length && !Object.values(globalSettings).some((setting) => setting.weight > 0)) {
    errors.push("At least one selected KPI must have a positive global weight.");
  }
  const configuredStudy: ComparisonStudy = {
    ...structuredClone(study),
    mandatoryRequirementIds: study.mandatoryRequirementIds,
    baselineRequirementIds: baselineRequirementIds(project, study),
    criteria: study.criteria.filter((criterion) => criterion.type === "optimization"),
    kpiSettings: globalSettings
  };
  const configurationIds = configuredStudy.alternativeRefs.map((alternative) => alternative.configurationId);
  if (new Set(configurationIds).size !== configurationIds.length) errors.push("Each alternative must use a different configuration.");
  configuredStudy.alternativeRefs.forEach((alternative) => {
    const run = compatibleRun(project, alternative);
    const configuration = alternative.configurationId
      ? project.configurations.find((item) => item.id === alternative.configurationId)
      : undefined;
    if (!configuration || !run?.configurationId) {
      errors.push(`${alternative.label} must reference a configuration-derived 100% architecture run.`);
      return;
    }
    if (configuration.archivedAt
      || configuration.validationStatus !== "valid"
      || validateConfiguration(project, configuration).some((finding) => finding.severity === "error")) {
      errors.push(`${alternative.label} must reference an active valid configuration.`);
    }
    if (configuration.architectureId !== alternative.architectureId) {
      errors.push(`${alternative.label} does not reference its configuration-owned architecture.`);
    }
    if (configuration.derivation?.sourceModelRevision !== project.modelRevision) {
      errors.push(`${alternative.label} requires a current saved 100% architecture derivation.`);
    } else if (run.derivationId !== configuration.derivation.id) {
      errors.push(`${alternative.label} requires a simulation from its current saved 100% architecture derivation.`);
    }
    if (simulationStatus(project, run) !== "Current") errors.push(`${alternative.label} requires a current simulation run.`);
    configuredStudy.selectedKpiIds.forEach((kpiId) => {
      const exact = run.results.find((result) => result.kpiId === kpiId);
      if (!exact || !finite(exact.value)) errors.push(`${alternative.label} requires a current numeric result for KPI ${kpiId}.`);
    });
  });
  if (errors.length) return { errors: [...new Set(errors)], warnings: [] };

  const base = runComparison(project, configuredStudy, now, Number.POSITIVE_INFINITY);
  if (!base.result) return base;
  const feasibility = Object.fromEntries(configuredStudy.alternativeRefs.map((alternative) => [
    alternative.id,
    evaluateMandatoryFeasibility(project, configuredStudy, alternative.id)
  ]));
  configuredStudy.alternativeRefs.forEach((alternative) => {
    if (feasibility[alternative.id].status === "unknown") {
      errors.push(`${alternative.label} has missing requirement evidence; comparison is blocked.`);
    }
  });
  if (errors.length) return { errors: [...new Set(errors)], warnings: [] };

  const feasibleAlternativeIds = configuredStudy.alternativeRefs
    .filter((alternative) => feasibility[alternative.id].status === "feasible")
    .map((alternative) => alternative.id);
  const normalizedScores: ComparisonResult["normalizedScores"] = Object.fromEntries(
    configuredStudy.alternativeRefs.map((alternative) => [alternative.id, {}])
  );
  configuredStudy.selectedKpiIds.forEach((kpiId) => {
    const values = Object.fromEntries(configuredStudy.alternativeRefs.map((alternative) => [
      alternative.id,
      base.result!.rawValues[alternative.id][kpiId]
    ]));
    const scores = normalizeAgainstFeasible(
      values,
      feasibleAlternativeIds,
      globalSettings[kpiId].optimizationDirection
    );
    configuredStudy.alternativeRefs.forEach((alternative) => {
      normalizedScores[alternative.id][kpiId] = scores[alternative.id];
    });
  });
  const totalWeight = configuredStudy.selectedKpiIds.reduce((sum, kpiId) => sum + globalSettings[kpiId].weight, 0);
  const weightedContributions: NonNullable<ComparisonResult["weightedContributions"]> = {};
  const weightedScores: ComparisonResult["weightedScores"] = {};
  configuredStudy.alternativeRefs.forEach((alternative) => {
    weightedContributions[alternative.id] = {};
    let total = 0;
    configuredStudy.selectedKpiIds.forEach((kpiId) => {
      const score = normalizedScores[alternative.id][kpiId];
      const contribution = finite(score) ? score * globalSettings[kpiId].weight : null;
      weightedContributions[alternative.id][kpiId] = finite(contribution) ? round(contribution) : null;
      if (finite(contribution)) total += contribution;
    });
    weightedScores[alternative.id] = totalWeight > 0 ? round(total / totalWeight) : null;
  });
  const eligibleScores = Object.fromEntries(configuredStudy.alternativeRefs.map((alternative) => [
    alternative.id,
    feasibleAlternativeIds.includes(alternative.id) ? weightedScores[alternative.id] : null
  ]));
  const recommendedAlternativeIds = leadingAlternativeIds(eligibleScores);
  const warnings = [...base.warnings];
  configuredStudy.alternativeRefs.forEach((alternative) => {
    if (feasibility[alternative.id].status === "infeasible") {
      warnings.push(`PMC-401: ${alternative.label} is infeasible. Its diagnostic score remains visible, but it cannot be selected as preferred.`);
    }
  });
  if (!feasibleAlternativeIds.length) warnings.push("No alternative satisfies every linked requirement; no preferred alternative is available.");
  if (feasibleAlternativeIds.length === 1) warnings.push("Only one alternative is feasible; no competitive feasible ranking exists.");
  if (recommendedAlternativeIds.length > 1) warnings.push("PMC-404: Feasible weighted-score leaders are tied; explicit user selection is required.");
  const explanations = Object.fromEntries(configuredStudy.alternativeRefs.map((alternative) => [
    alternative.id,
    Object.fromEntries(configuredStudy.selectedKpiIds.map((kpiId) => [
      kpiId,
      `Raw value normalized against requirement-feasible alternatives using ${globalSettings[kpiId].optimizationDirection}; global weight ${globalSettings[kpiId].weight}.`
    ]))
  ]));
  return {
    result: {
      ...base.result,
      id: `traceable-result-${crypto.randomUUID()}`,
      methodology: "traceable-feasible-weighted",
      normalizedScores,
      weightedScores,
      dataCoveragePercent: Object.fromEntries(configuredStudy.alternativeRefs.map((alternative) => [alternative.id, 100])),
      thresholdViolations: [],
      feasibility,
      stakeholderValues: normalizedScores,
      weightedContributions,
      stakeholderValueScores: weightedScores,
      calculationExplanations: explanations,
      recommendedAlternativeIds,
      recommendationLabel: "Highest weighted score among requirement-feasible alternatives using the selected global KPI definitions.",
      warnings: [...new Set(warnings)]
    },
    errors: [],
    warnings: [...new Set(warnings)]
  };
}

export function runFixedWeightSensitivity(
  project: Project,
  study: ComparisonStudy,
  now = new Date()
): { result?: WeightSensitivityResult; errors: string[] } {
  const baseline = runTradeStudyMethodology(project, study, now);
  if (!baseline.result) return { errors: baseline.errors };
  const baselineLeaders = baseline.result.recommendedAlternativeIds ?? [];
  const criteria = optimizationCriteria(study);
  return {
    result: {
      studyId: study.id,
      timestamp: now.toISOString(),
      series: criteria.map((criterion) => {
        const baseWeight = criterion.weight ?? 0;
        const points = (baseWeight === 0 ? [0] : Array.from({ length: 9 }, (_, index) => index * 25))
          .map((multiplierPercent) => {
            const candidate = structuredClone(study);
            const changed = candidate.criteria.find((item) => item.id === criterion.id)!;
            changed.weight = baseWeight * multiplierPercent / 100;
            const alternativeScores = fixedScores(candidate, baseline.result!.rawValues).stakeholderValueScores;
            const feasibleScores = Object.fromEntries(study.alternativeRefs.map((alternative) => [
              alternative.id,
              baseline.result!.feasibility?.[alternative.id]?.status === "feasible"
                ? alternativeScores[alternative.id]
                : null
            ]));
            return {
              multiplierPercent,
              alternativeScores,
              leadingAlternativeIds: leadingAlternativeIds(feasibleScores)
            };
          });
        const leaderChanged = points.some((point) =>
          point.leadingAlternativeIds.length !== baselineLeaders.length
          || point.leadingAlternativeIds.some((id) => !baselineLeaders.includes(id))
        );
        return {
          kpiId: criterion.kpiId!,
          points,
          leaderChanged,
          warnings: baseWeight === 0
            ? ["PMC-205: Percentage variation cannot influence a zero baseline weight."]
            : leaderChanged
              ? ["PMC-201: Leading feasible alternative changed during fixed-value weight sensitivity."]
              : []
        };
      })
    },
    errors: []
  };
}

function adjustedRawValues(
  project: Project,
  study: ComparisonStudy,
  baseline: ComparisonResult,
  effects: ComparisonScenarioEffect[]
): ComparisonResult["rawValues"] {
  const adjusted = structuredClone(baseline.rawValues);
  study.alternativeRefs.forEach((alternative) => {
    const run = compatibleRun(project, alternative);
    if (!run) return;
    effects.forEach((effect) => {
      if (effect.type === "kpiPercent" || effect.type === "kpiAdditive") {
        const current = adjusted[alternative.id]?.[effect.targetId];
        if (!finite(current)) return;
        adjusted[alternative.id][effect.targetId] = effect.type === "kpiPercent"
          ? current * (1 + effect.percent / 100)
          : current + effect.amount;
        return;
      }
      run.results.forEach((result) => {
        if (!result.kpiId || !result.sourceParameterIds.includes(effect.targetId)) return;
        const current = adjusted[alternative.id]?.[result.kpiId];
        if (!finite(current)) return;
        if (effect.type === "parameterPercent") {
          adjusted[alternative.id][result.kpiId] = current * (1 + effect.percent / 100);
        } else {
          const nominal = run.inputSnapshot.parameterValues[effect.targetId];
          if (finite(nominal) && nominal !== 0) {
            const midpoint = (effect.minimum + effect.maximum) / 2;
            adjusted[alternative.id][result.kpiId] = current * midpoint / nominal;
          }
        }
      });
    });
  });
  return adjusted;
}

function robustnessCase(
  project: Project,
  study: ComparisonStudy,
  baseline: ComparisonResult,
  id: string,
  name: string,
  kind: RobustnessCaseResult["kind"],
  effects: ComparisonScenarioEffect[],
  scenarioId?: string
): RobustnessCaseResult {
  const raw = adjustedRawValues(project, study, baseline, effects);
  const fixed = fixedScores(study, raw);
  const baselineFeasibility = baseline.feasibility ?? Object.fromEntries(study.alternativeRefs.map((alternative) => [
    alternative.id,
    evaluateMandatoryFeasibility(project, study, alternative.id)
  ]));
  const feasibility = Object.fromEntries(study.alternativeRefs.map((alternative) => [
    alternative.id,
    evaluateMandatoryFeasibility(project, study, alternative.id, effects)
  ]));
  const pareto = paretoFromRaw(study, raw, feasibility);
  const eligible = Object.fromEntries(study.alternativeRefs.map((alternative) => [
    alternative.id,
    feasibility[alternative.id].status === "feasible"
      ? fixed.stakeholderValueScores[alternative.id]
      : null
  ]));
  const leading = leadingAlternativeIds(eligible);
  const baselineLeaders = baseline.recommendedAlternativeIds ?? [];
  return {
    id,
    name,
    kind,
    scenarioId,
    changedFeasibilityAlternativeIds: study.alternativeRefs
      .filter((alternative) =>
        feasibility[alternative.id].status !== baselineFeasibility[alternative.id]?.status
      )
      .map((alternative) => alternative.id),
    changedParetoAlternativeIds: study.alternativeRefs
      .filter((alternative) => pareto[alternative.id].status !== baseline.pareto?.[alternative.id]?.status)
      .map((alternative) => alternative.id),
    leadingAlternativeIds: leading,
    recommendationChanged: leading.length !== baselineLeaders.length
      || leading.some((item) => !baselineLeaders.includes(item)),
    notes: effects.length
      ? effects.map((effect) => `${effect.type} effect applied to ${effect.targetId}.`)
      : ["Nominal immutable evidence; no effect applied."]
  };
}

export function runBoundedRobustness(
  project: Project,
  study: ComparisonStudy,
  baseline: ComparisonResult,
  now = new Date()
): BoundedRobustnessResult {
  const uncertainParameters = study.alternativeRefs.flatMap((alternative) => {
    const run = compatibleRun(project, alternative);
    return run?.inputSnapshot.realizedElements.flatMap((element) => element.parameters)
      .filter((parameter) =>
        finite(parameter.uncertaintyPercent)
        || (finite(parameter.minimum) && finite(parameter.maximum))
      ) ?? [];
  });
  const uniqueParameters = [...new Map(uncertainParameters.map((parameter) => [parameter.id, parameter])).values()];
  const cases: RobustnessCaseResult[] = [
    robustnessCase(project, study, baseline, "robustness-nominal", "Nominal", "nominal", [])
  ];
  uniqueParameters.forEach((parameter) => {
    const percent = parameter.uncertaintyPercent
      ?? (finite(parameter.value) && parameter.value !== 0 && finite(parameter.minimum) && finite(parameter.maximum)
        ? Math.max(
            Math.abs((parameter.minimum - parameter.value) / parameter.value * 100),
            Math.abs((parameter.maximum - parameter.value) / parameter.value * 100)
          )
        : 0);
    cases.push(
      robustnessCase(project, study, baseline, `robustness-${parameter.id}-lower`, `${parameter.name} lower`, "oneAtATimeLower", [{
        id: `effect-${parameter.id}-lower`,
        type: "parameterPercent",
        targetId: parameter.id,
        percent: -percent
      }]),
      robustnessCase(project, study, baseline, `robustness-${parameter.id}-upper`, `${parameter.name} upper`, "oneAtATimeUpper", [{
        id: `effect-${parameter.id}-upper`,
        type: "parameterPercent",
        targetId: parameter.id,
        percent
      }])
    );
  });
  const pessimisticEffects: ComparisonScenarioEffect[] = optimizationCriteria(study).map((criterion) => ({
    id: `effect-pessimistic-${criterion.kpiId}`,
    type: "kpiPercent",
    targetId: criterion.kpiId!,
    percent: (study.kpiSettings[criterion.kpiId!]?.optimizationDirection ?? "minimize") === "minimize" ? 10 : -10
  }));
  const optimisticEffects: ComparisonScenarioEffect[] = optimizationCriteria(study).map((criterion) => ({
    id: `effect-optimistic-${criterion.kpiId}`,
    type: "kpiPercent",
    targetId: criterion.kpiId!,
    percent: (study.kpiSettings[criterion.kpiId!]?.optimizationDirection ?? "minimize") === "minimize" ? -10 : 10
  }));
  cases.push(
    robustnessCase(project, study, baseline, "robustness-pessimistic", "Combined pessimistic", "combinedPessimistic", pessimisticEffects),
    robustnessCase(project, study, baseline, "robustness-optimistic", "Combined optimistic", "combinedOptimistic", optimisticEffects)
  );
  (study.scenarios ?? []).forEach((scenario: ComparisonScenario) => {
    cases.push(robustnessCase(
      project,
      study,
      baseline,
      `robustness-scenario-${scenario.id}`,
      scenario.name,
      "scenario",
      scenario.effects,
      scenario.id
    ));
  });
  return {
    id: `robustness-${crypto.randomUUID()}`,
    studyId: study.id,
    timestamp: now.toISOString(),
    baselineComparisonResultId: baseline.id,
    label: "Bounded robustness analysis",
    cases
  };
}

