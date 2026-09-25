import type {
  ComparisonAlternativeRef,
  ComparisonResult,
  ComparisonStudy,
  ComparisonThreshold,
  Project,
  ThresholdViolation,
  ValidationResult,
  WeightSensitivityResult
} from "./types";

export interface ComparisonAttempt {
  result?: ComparisonResult;
  errors: string[];
  warnings: string[];
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number, precision = 2) => {
  const scale = 10 ** precision;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

function finding(
  ruleId: string,
  severity: ValidationResult["severity"],
  message: string
): ValidationResult {
  return {
    id: `${ruleId}-${message}`,
    ruleId,
    severity,
    title: ruleId,
    message,
    affectedElementIds: [],
    affectedRelationshipIds: [],
    category: "comparison",
    resolved: false
  };
}

export function compatibleRun(
  project: Project,
  alternative: ComparisonAlternativeRef
) {
  const run = project.simulationRuns.find((candidate) => candidate.id === alternative.simulationRunId);
  if (!run || run.architectureId !== alternative.architectureId) return undefined;
  if (alternative.configurationId === undefined) {
    return run.configurationId === undefined ? run : undefined;
  }
  return run.configurationId === alternative.configurationId ? run : undefined;
}

export function validateComparisonStudy(project: Project, study: ComparisonStudy, maximumAlternatives = 6): ValidationResult[] {
  const results: ValidationResult[] = [];
  if (study.alternativeRefs.length < 2) results.push(finding("PMC-001", "error", "Comparison requires at least two alternatives."));
  if (study.alternativeRefs.length > maximumAlternatives) results.push(finding("PMC-002", "error", `Comparison supports at most ${maximumAlternatives} alternatives.`));
  if (!study.selectedKpiIds.length) results.push(finding("PMC-003", "error", "Select at least one KPI."));
  const uniqueAlternativeIds = new Set(study.alternativeRefs.map((alternative) => alternative.id));
  if (uniqueAlternativeIds.size !== study.alternativeRefs.length) {
    results.push(finding("PMC-016", "error", "Alternative IDs must be unique within a study."));
  }
  const uniqueKpiIds = new Set(study.selectedKpiIds);
  if (uniqueKpiIds.size !== study.selectedKpiIds.length) {
    results.push(finding("PMC-016", "error", "Selected KPI IDs must be unique."));
  }
  let positiveWeight = false;
  study.selectedKpiIds.forEach((kpiId) => {
    const kpi = project.kpis.find((candidate) => candidate.id === kpiId);
    const setting = study.kpiSettings[kpiId];
    if (!kpi || !setting) {
      results.push(finding("PMC-006", "error", `Selected KPI ${kpiId} or its study setting is missing.`));
      return;
    }
    if (!finite(setting.weight) || setting.weight < 0) {
      results.push(finding("PMC-005", "error", `${kpi.name} has a negative or non-finite weight.`));
    } else if (setting.weight > 0) positiveWeight = true;
    const threshold = setting.threshold;
    if (threshold) {
      if ((threshold.minimum !== undefined && !finite(threshold.minimum))
        || (threshold.maximum !== undefined && !finite(threshold.maximum))
        || (threshold.minimum !== undefined && threshold.maximum !== undefined && threshold.minimum > threshold.maximum)) {
        results.push(finding("PMC-007", "error", `${kpi.name} has invalid threshold bounds.`));
      }
    }
  });
  if (study.selectedKpiIds.length && !positiveWeight) {
    results.push(finding("PMC-004", "error", "At least one selected KPI weight must be greater than zero."));
  }
  study.alternativeRefs.forEach((alternative) => {
    const architecture = project.architectures.find((candidate) => candidate.id === alternative.architectureId);
    const configuration = alternative.configurationId
      ? project.configurations.find((candidate) => candidate.id === alternative.configurationId)
      : undefined;
    if (!architecture || (alternative.configurationId && !configuration)
      || !project.simulationRuns.some((run) => run.id === alternative.simulationRunId)) {
      results.push(finding("PMC-006", "error", `${alternative.label} references a missing architecture, configuration, or simulation run.`));
      return;
    }
    if (!compatibleRun(project, alternative)) {
      results.push(finding("PMC-013", "error", `${alternative.label}'s simulation run does not match its architecture/configuration pair.`));
      return;
    }
    const run = compatibleRun(project, alternative)!;
    study.selectedKpiIds.forEach((kpiId) => {
      if (!run.results.some((result) => result.kpiId === kpiId)) {
        results.push(finding("PMC-014", "error", `${alternative.label}'s simulation lacks exact KPI result ${kpiId}.`));
      }
    });
  });
  return results;
}

function normalizeValues(
  values: Record<string, number | null>,
  direction: "minimize" | "maximize"
): { scores: Record<string, number | null>; equal: boolean } {
  const available = Object.entries(values).filter((entry): entry is [string, number] => finite(entry[1]));
  const scores: Record<string, number | null> = Object.fromEntries(Object.keys(values).map((id) => [id, null]));
  if (!available.length) return { scores, equal: false };
  const raw = available.map(([, value]) => value);
  const minimum = Math.min(...raw);
  const maximum = Math.max(...raw);
  if (maximum === minimum) {
    available.forEach(([id]) => { scores[id] = 100; });
    return { scores, equal: true };
  }
  available.forEach(([id, value]) => {
    const normalized = direction === "maximize"
      ? 100 * (value - minimum) / (maximum - minimum)
      : 100 * (maximum - value) / (maximum - minimum);
    scores[id] = Math.min(100, Math.max(0, round(normalized, 8)));
  });
  return { scores, equal: false };
}

function thresholdViolation(
  alternativeId: string,
  kpiId: string,
  value: number,
  threshold?: ComparisonThreshold
): ThresholdViolation[] {
  if (!threshold) return [];
  const messages: string[] = [];
  if (threshold.minimum !== undefined && value < threshold.minimum) {
    messages.push(`${value} is below the required minimum ${threshold.minimum}.`);
  }
  if (threshold.maximum !== undefined && value > threshold.maximum) {
    messages.push(`${value} is above the allowed maximum ${threshold.maximum}.`);
  }
  return messages.map((message) => ({
    alternativeId,
    kpiId,
    value,
    message,
    severity: threshold.mode === "hard" ? "error" : "warning"
  }));
}

export function runComparison(
  project: Project,
  study: ComparisonStudy,
  now = new Date(),
  maximumAlternatives = 6
): ComparisonAttempt {
  const findings = validateComparisonStudy(project, study, maximumAlternatives);
  const errors = findings.filter((item) => item.severity === "error").map((item) => `${item.ruleId}: ${item.message}`);
  if (errors.length) return { errors, warnings: [] };
  const warnings: string[] = [];
  const rawValues: ComparisonResult["rawValues"] = {};
  const normalizedScores: ComparisonResult["normalizedScores"] = {};
  const thresholdViolations: ThresholdViolation[] = [];
  const availabilitySignatures = new Set<string>();

  study.alternativeRefs.forEach((alternative) => {
    const run = compatibleRun(project, alternative)!;
    if (run.projectModelRevisionAtRun < project.modelRevision) {
      warnings.push(`PMC-105: ${alternative.label} uses a stale simulation run.`);
    }
    rawValues[alternative.id] = {};
    study.selectedKpiIds.forEach((kpiId) => {
      const exact = run.results.find((result) => result.kpiId === kpiId)!;
      rawValues[alternative.id][kpiId] = finite(exact.value) ? exact.value : null;
      if (!finite(exact.value)) warnings.push(`PMC-101: ${alternative.label} is missing KPI ${kpiId}.`);
      else thresholdViolations.push(...thresholdViolation(
        alternative.id,
        kpiId,
        exact.value,
        study.kpiSettings[kpiId].threshold
      ));
    });
  });

  study.selectedKpiIds.forEach((kpiId) => {
    const values = Object.fromEntries(study.alternativeRefs.map((alternative) => [
      alternative.id,
      rawValues[alternative.id][kpiId]
    ]));
    const normalized = normalizeValues(values, study.kpiSettings[kpiId].optimizationDirection);
    if (normalized.equal) warnings.push(`PMC-102: KPI ${kpiId} does not differentiate available alternatives.`);
    const availableScores = Object.values(normalized.scores).filter(finite);
    if (availableScores.length > 1 && new Set(availableScores.map((value) => round(value))).size < availableScores.length) {
      warnings.push(`PMC-202: Alternatives are tied for KPI ${kpiId}.`);
    }
    study.alternativeRefs.forEach((alternative) => {
      normalizedScores[alternative.id] ??= {};
      normalizedScores[alternative.id][kpiId] = normalized.scores[alternative.id];
    });
  });

  const totalWeight = study.selectedKpiIds.reduce((sum, kpiId) => sum + study.kpiSettings[kpiId].weight, 0);
  const weightedScores: Record<string, number | null> = {};
  const dataCoveragePercent: Record<string, number> = {};
  study.alternativeRefs.forEach((alternative) => {
    const availableKpis = study.selectedKpiIds.filter((kpiId) => finite(normalizedScores[alternative.id][kpiId]));
    const applicableWeight = availableKpis.reduce((sum, kpiId) => sum + study.kpiSettings[kpiId].weight, 0);
    availabilitySignatures.add(availableKpis.sort().join("|"));
    dataCoveragePercent[alternative.id] = totalWeight > 0 ? round(applicableWeight / totalWeight * 100) : 0;
    weightedScores[alternative.id] = applicableWeight > 0
      ? round(availableKpis.reduce((sum, kpiId) =>
        sum + (normalizedScores[alternative.id][kpiId] as number) * study.kpiSettings[kpiId].weight, 0
      ) / applicableWeight)
      : null;
  });
  if (availabilitySignatures.size > 1) {
    warnings.push("PMC-104: Weighted scores use different KPI subsets; applicable weights were renormalized per alternative.");
  }
  thresholdViolations.forEach((violation) => {
    warnings.push(`${violation.severity === "error" ? "PMC-103" : "Threshold warning"}: ${violation.message}`);
  });
  const leaders = leadingAlternativeIds(weightedScores);
  if (leaders.length > 1) warnings.push("PMC-204: Leading alternatives are tied.");
  if (leaders.some((id) => dataCoveragePercent[id] < Math.max(...Object.values(dataCoveragePercent)))) {
    warnings.push("PMC-109: A leading score has incomplete data coverage.");
  }
  return {
    result: {
      id: `comparison-result-${crypto.randomUUID()}`,
      studyId: study.id,
      timestamp: now.toISOString(),
      settingsUpdatedAt: study.settingsUpdatedAt,
      inputProjectModelRevision: project.modelRevision,
      rawValues,
      normalizedScores,
      weightedScores,
      dataCoveragePercent,
      thresholdViolations,
      warnings: [...new Set(warnings)]
    },
    errors: [],
    warnings: [...new Set(warnings)]
  };
}

export function leadingAlternativeIds(scores: Record<string, number | null>, precision = 2): string[] {
  const available = Object.entries(scores).filter((entry): entry is [string, number] => finite(entry[1]));
  if (!available.length) return [];
  const maximum = Math.max(...available.map(([, value]) => round(value, precision)));
  return available.filter(([, value]) => round(value, precision) === maximum).map(([id]) => id);
}

export function normalizedWeightPercentages(study: ComparisonStudy): Record<string, number> {
  const total = study.selectedKpiIds.reduce((sum, id) => sum + Math.max(0, study.kpiSettings[id]?.weight ?? 0), 0);
  return Object.fromEntries(study.selectedKpiIds.map((id) => [
    id,
    total > 0 ? round(Math.max(0, study.kpiSettings[id]?.weight ?? 0) / total * 100) : 0
  ]));
}

export function runWeightSensitivity(
  project: Project,
  study: ComparisonStudy,
  now = new Date()
): { result?: WeightSensitivityResult; errors: string[] } {
  const baseline = runComparison(project, study, now);
  if (!baseline.result) return { errors: baseline.errors };
  const baselineLeaders = leadingAlternativeIds(baseline.result.weightedScores);
  const series = study.selectedKpiIds.map((kpiId) => {
    const baseWeight = study.kpiSettings[kpiId].weight;
    const multipliers = baseWeight === 0 ? [0] : Array.from({ length: 9 }, (_, index) => index * 25);
    const points = multipliers.map((multiplierPercent) => {
      const candidate: ComparisonStudy = structuredClone(study);
      candidate.kpiSettings[kpiId].weight = baseWeight * multiplierPercent / 100;
      const attempt = runComparison(project, candidate, now);
      const alternativeScores = attempt.result?.weightedScores
        ?? Object.fromEntries(study.alternativeRefs.map((alternative) => [alternative.id, null]));
      return {
        multiplierPercent,
        alternativeScores,
        leadingAlternativeIds: leadingAlternativeIds(alternativeScores)
      };
    });
    const leaderChanged = points.some((point) =>
      point.leadingAlternativeIds.length !== baselineLeaders.length
      || point.leadingAlternativeIds.some((id) => !baselineLeaders.includes(id))
    );
    return {
      kpiId,
      points,
      leaderChanged,
      warnings: baseWeight === 0
        ? ["PMC-205: Percentage variation cannot influence a zero baseline weight."]
        : leaderChanged
          ? ["PMC-201: Leading alternative changed during sensitivity."]
          : []
    };
  });
  return {
    result: {
      studyId: study.id,
      timestamp: now.toISOString(),
      series
    },
    errors: []
  };
}

export function comparisonStatus(
  project: Project,
  study: ComparisonStudy,
  result: ComparisonResult
): "Current" | "Stale" {
  if (study.settingsUpdatedAt > result.timestamp) return "Stale";
  if (study.selectedKpiIds.some((kpiId) => {
    const kpi = project.kpis.find((candidate) => candidate.id === kpiId);
    return !kpi || kpi.updatedAt > result.timestamp;
  })) return "Stale";
  if (study.alternativeRefs.some((alternative) => {
    const run = project.simulationRuns.find((candidate) => candidate.id === alternative.simulationRunId);
    return !run || run.projectModelRevisionAtRun < project.modelRevision;
  })) return "Stale";
  return "Current";
}
