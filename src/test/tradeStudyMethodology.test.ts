import { describe, expect, it } from "vitest";
import {
  createCoffeeMachineSampleProject,
  createSampleProject
} from "../data/sample";
import {
  buildExportPackage,
  defaultExportFilters,
  parseExportPackage,
  serializeExportPackage,
  validateProjectReferences
} from "../domain/exportImport";
import {
  inherentExposure,
  residualExposure,
  riskBand,
  runBoundedRobustness,
  runFixedWeightSensitivity,
  runTradeStudyMethodology,
  stakeholderValue,
  summarizeRisks,
  validateStakeholderValueFunction
} from "../domain/tradeStudyMethodology";
import type { ComparisonRisk } from "../domain/types";
import { buildXlsxWorkbook } from "../domain/xlsxExport";
import { CURRENT_SCHEMA_VERSION, migrateProject } from "../store/persistence";

const time = new Date("2026-07-31T10:00:00.000Z");

describe("fixed stakeholder value methodology", () => {
  it("supports and validates every fixed value-function family", () => {
    expect(stakeholderValue(5, { type: "maximize", worst: 0, best: 10 })).toBe(50);
    expect(stakeholderValue(5, { type: "minimize", worst: 10, best: 0 })).toBe(50);
    expect(stakeholderValue(5, { type: "target", worst: 0, target: 5, best: 10 })).toBe(100);
    expect(stakeholderValue(5, {
      type: "acceptableRange",
      worst: 0,
      acceptableMinimum: 4,
      acceptableMaximum: 6,
      best: 10
    })).toBe(100);
    expect(stakeholderValue(5, {
      type: "piecewiseLinear",
      points: [{ input: 0, value: 0 }, { input: 10, value: 100 }]
    })).toBe(50);
    expect(validateStakeholderValueFunction({
      type: "piecewiseLinear",
      points: [{ input: 1, value: 20 }, { input: 1, value: 120 }]
    })).toEqual(expect.arrayContaining([
      "Piecewise-linear inputs must be strictly increasing.",
      "Point 2 value must be between 0 and 100."
    ]));
  });

  it("keeps fixed values stable when an unrelated alternative is removed", () => {
    const project = createCoffeeMachineSampleProject();
    const fullStudy = structuredClone(project.comparisonStudies[0]);
    const full = runTradeStudyMethodology(project, fullStudy, time).result!;
    const reducedStudy = structuredClone(fullStudy);
    const removed = reducedStudy.alternativeRefs.shift()!;
    reducedStudy.candidateRefs = reducedStudy.candidateRefs.filter((candidate) =>
      candidate.architectureId !== removed.architectureId
    );
    const reduced = runTradeStudyMethodology(project, reducedStudy, time).result!;
    reducedStudy.alternativeRefs.forEach((alternative) => {
      expect(reduced.stakeholderValues?.[alternative.id])
        .toEqual(full.stakeholderValues?.[alternative.id]);
      expect(reduced.stakeholderValueScores?.[alternative.id])
        .toBe(full.stakeholderValueScores?.[alternative.id]);
    });
  });

  it("retains but excludes an infeasible alternative from Pareto and recommendation", () => {
    const project = createCoffeeMachineSampleProject();
    const study = structuredClone(project.comparisonStudies[0]);
    study.criteria.push({
      id: "criterion-mandatory-grinder",
      name: "Automatic grinder required",
      description: "Mandatory feature screen used to prove exact exclusion.",
      type: "mandatory",
      sourceObjectiveIds: [],
      sourceRequirementIds: [],
      requiredFeatureId: "feature-automated-feeding"
    });
    const attempt = runTradeStudyMethodology(project, study, time);
    const essential = study.alternativeRefs.find((alternative) =>
      alternative.configurationId === "configuration-manual"
    )!;
    expect(attempt.errors).toEqual([]);
    expect(attempt.result?.feasibility?.[essential.id].status).toBe("infeasible");
    expect(attempt.result?.pareto?.[essential.id].status).toBe("infeasible");
    expect(attempt.result?.recommendedAlternativeIds).not.toContain(essential.id);
    expect(attempt.result?.rawValues[essential.id]).toBeDefined();
  });
});

describe("sensitivity, risk and bounded robustness", () => {
  it("runs fixed-value weight sensitivity without changing the saved study", () => {
    const project = createCoffeeMachineSampleProject();
    const study = project.comparisonStudies[0];
    const before = structuredClone(study);
    const attempt = runFixedWeightSensitivity(project, study, time);
    expect(attempt.errors).toEqual([]);
    expect(attempt.result?.series).toHaveLength(4);
    expect(attempt.result?.series.every((series) => series.points.length === 9)).toBe(true);
    expect(study).toEqual(before);
  });

  it("calculates inherent and residual exposure and summarizes unresolved severity", () => {
    const project = createCoffeeMachineSampleProject();
    const study = project.comparisonStudies[0];
    const risk: ComparisonRisk = {
      ...project.comparisonRisks[0],
      inherentLikelihood: 5,
      inherentImpact: 5,
      residualLikelihood: 4,
      residualImpact: 4,
      status: "open"
    };
    project.comparisonRisks = [risk];
    expect(inherentExposure(risk)).toBe(25);
    expect(residualExposure(risk)).toBe(16);
    expect(riskBand(25)).toBe("critical");
    expect(riskBand(16)).toBe("high");
    expect(summarizeRisks(project, study)[risk.alternativeId])
      .toMatchObject({ totalResidualExposure: 16, unresolvedHighCriticalCount: 1 });
  });

  it("migrates qualitative schema-6 risks conservatively and flags review", () => {
    const source = createSampleProject() as unknown as {
      schemaVersion: number;
      comparisonRisks: Array<Record<string, unknown>>;
    };
    source.schemaVersion = 6;
    source.comparisonRisks[0] = {
      ...source.comparisonRisks[0],
      likelihood: "high",
      impact: "medium"
    };
    delete source.comparisonRisks[0].inherentLikelihood;
    delete source.comparisonRisks[0].inherentImpact;
    delete source.comparisonRisks[0].residualLikelihood;
    delete source.comparisonRisks[0].residualImpact;
    const migrated = migrateProject(source);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.comparisonRisks[0]).toMatchObject({
      inherentLikelihood: 5,
      inherentImpact: 3,
      residualLikelihood: 5,
      residualImpact: 3,
      reviewRequired: true
    });
  });

  it("produces labeled immutable bounded cases and named scenarios", () => {
    const project = createCoffeeMachineSampleProject();
    const study = project.comparisonStudies[0];
    const baseline = runTradeStudyMethodology(project, study, time).result!;
    const before = structuredClone(study);
    const result = runBoundedRobustness(project, study, baseline, time);
    expect(result.label).toBe("Bounded robustness analysis");
    expect(result.cases.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "nominal",
      "combinedPessimistic",
      "combinedOptimistic",
      "scenario"
    ]));
    expect(result.cases.filter((item) => item.kind === "scenario")).toHaveLength(study.scenarios?.length ?? 0);
    expect(study).toEqual(before);
  });
});

describe("coffee-machine delivery contract", () => {
  it("ships three alternatives and a complete approved decision snapshot", () => {
    const project = createCoffeeMachineSampleProject();
    const study = project.comparisonStudies[0];
    const decision = project.decisions[0];
    expect(project.schemaVersion).toBe(14);
    expect(study.alternativeRefs.map((item) => item.label)).toEqual([
      "Essential Capsule",
      "Balanced Bean-to-Cup",
      "Premium Dual Boiler"
    ]);
    expect(study.results.at(-1)?.methodology).toBe("fixed-smart-mavt");
    expect(decision).toMatchObject({
      status: "approved",
      baselineApprovalConfirmed: true,
      evidenceSnapshot: {
        question: study.question,
        candidateAlternatives: expect.any(Array),
        mandatoryCompliance: expect.any(Object),
        rawEvidence: expect.any(Object),
        transformedEvidence: expect.any(Object),
        scenarios: expect.any(Array),
        robustnessResults: expect.any(Array)
      }
    });
    expect(decision.evidenceSnapshot?.simulationRunIds).toHaveLength(3);
    expect(project.baselineArchitectureId).toBeDefined();
  });

  it("round-trips schema-7 evidence through JSON and exposes it in XLSX", () => {
    const project = createCoffeeMachineSampleProject();
    const payload = buildExportPackage(project, defaultExportFilters(), time);
    const parsed = parseExportPackage(serializeExportPackage(payload), migrateProject);
    expect(parsed.errors).toEqual([]);
    expect(parsed.package?.project).toEqual(migrateProject(payload.project));
    expect(validateProjectReferences(payload.project)).toEqual([]);
    expect(buildXlsxWorkbook(payload).SheetNames).toEqual(expect.arrayContaining([
      "Feasibility and Pareto",
      "Manager Summary",
      "Risks",
      "Risk Scenarios",
      "Bounded Robustness",
      "Decisions"
    ]));
  });
});
