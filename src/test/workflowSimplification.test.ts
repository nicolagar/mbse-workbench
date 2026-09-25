import { describe, expect, it } from "vitest";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { dashboardWorkflow } from "../domain/dashboardWorkflow";
import { runTraceableTradeStudy } from "../domain/tradeStudyMethodology";
import { migrateProject } from "../store/persistence";

describe("scope-specific dashboard workflow", () => {
  it("shows only the required steps for each independent scope", () => {
    const project = createCoffeeMachineSampleProject();

    project.overallScope = "architectureBuilding";
    let workflow = dashboardWorkflow(project);
    expect(workflow.problemSpace).toHaveLength(2);
    expect(workflow.solutionSpace.map((step) => step.label)).toEqual([
      "Build the product functional & technical architecture",
      "Build the industrial system functional & technical architecture"
    ]);
    expect(workflow.solutionSpace[0].activities.map((item) => item.label)).toEqual([
      "Product functions",
      "Product architecture"
    ]);
    expect(workflow.solutionSpace[1].activities.map((item) => item.label)).toEqual([
      "Industrial system functions",
      "Industrial system architecture"
    ]);

    project.overallScope = "architectureAndSimulation";
    workflow = dashboardWorkflow(project);
    expect(workflow.problemSpace).toHaveLength(3);
    expect(workflow.solutionSpace.map((step) => step.label)).toEqual([
      "Build the product functional & technical architecture",
      "Build the industrial system functional & technical architecture",
      "Complete architecture parameters",
      "Simulate architecture"
    ]);
    expect(workflow.solutionSpace[0].activities.map((item) => item.label)).toEqual([
      "Product functions",
      "Product architecture"
    ]);
    expect(workflow.solutionSpace[1].activities.map((item) => item.label)).toEqual([
      "Industrial system functions",
      "Industrial system architecture"
    ]);

    project.overallScope = "tradeStudy";
    workflow = dashboardWorkflow(project);
    expect(workflow.problemSpace).toHaveLength(3);
    expect(workflow.problemSpace.map((step) => step.label)).toEqual([
      "Define mission, system and intent",
      "Define use-case and requirement scope",
      "Define Trade Study, variability axes and evaluation KPIs"
    ]);
    expect(workflow.problemSpace[2].status).toBe("complete");
    expect(workflow.solutionSpace.map((step) => step.label)).toEqual([
      "Build the 150% architecture",
      "Define the feature model and constraints",
      "Map variability to architecture",
      "Create valid configurations",
      "Derive 100% architectures",
      "Simulate architectures",
      "Compare and decide"
    ]);
    expect(workflow.solutionSpace[0].activities.map((item) => item.label)).toEqual([
      "Product functions",
      "Product architecture",
      "Industrial system functions",
      "Industrial system architecture"
    ]);
  });

  it("uses automatic status states and blocks downstream work on missing prerequisites", () => {
    const project = createCoffeeMachineSampleProject();
    project.overallScope = "tradeStudy";
    project.variationPoints = [];
    const workflow = dashboardWorkflow(project);
    expect(workflow.solutionSpace.find((step) => step.id === "map-variability")?.status).not.toBe("complete");
    expect(workflow.solutionSpace.find((step) => step.id === "create-configurations")?.status).toBe("blocked");
    expect(workflow.recommendedStepId).toBe("map-variability");
  });
});

describe("schema-9 dashboard-step migration", () => {
  it("infers the existing workflow scope without changing canonical IDs", () => {
    const source = createCoffeeMachineSampleProject();
    const elementIds = source.elements.map((item) => item.id);
    const legacy = structuredClone(source);
    legacy.schemaVersion = 8;
    delete legacy.overallScope;
    delete legacy.activeComparisonStudyId;
    delete (legacy as Partial<typeof legacy>).variabilityAxes;
    legacy.comparisonStudies.forEach((study) => {
      delete study.needIds;
      delete study.useCaseIds;
      delete study.rootFeatureId;
      delete study.selectedVariabilityAxisIds;
    });
    const migrated = migrateProject(legacy);
    expect(migrated.schemaVersion).toBe(14);
    expect(migrated.overallScope).toBe("tradeStudy");
    expect(migrated.elements.map((item) => item.id)).toEqual(elementIds);
    expect(migrated.comparisonStudies[0].needIds?.length).toBeGreaterThan(0);
    expect(migrated.comparisonStudies[0].useCaseIds).toEqual(migrated.selectedUseCaseIds);
    expect(migrated.activeComparisonStudyId).toBe(migrated.comparisonStudies[0].id);
    expect(migrated.comparisonStudies[0].rootFeatureId).toBe("feature-machine");
    expect(migrated.variabilityAxes).toEqual([]);
    expect(migrated.comparisonStudies[0].selectedVariabilityAxisIds).toEqual([]);
  });
});

describe("minimal traceable Trade Study method", () => {
  it("uses requirements first and global KPI definitions for complete configured evidence", () => {
    const project = createCoffeeMachineSampleProject();
    const study = structuredClone(project.comparisonStudies[0]);
    study.kpiSettings = Object.fromEntries(study.selectedKpiIds.map((id) => [id, {
      weight: 999,
      optimizationDirection: "maximize" as const
    }]));
    study.mandatoryRequirementIds = [];
    const attempt = runTraceableTradeStudy(project, study, new Date("2026-08-12T10:00:00.000Z"));
    expect(attempt.errors).toEqual([]);
    expect(attempt.result).toMatchObject({
      methodology: "traceable-feasible-weighted",
      recommendationLabel: "Highest weighted score among requirement-feasible alternatives using the selected global KPI definitions."
    });
    expect(Object.values(attempt.result!.dataCoveragePercent)).toEqual([100, 100, 100]);
    expect(attempt.result!.recommendedAlternativeIds?.length).toBeGreaterThan(0);
    study.selectedKpiIds.forEach((kpiId) => {
      const global = project.kpis.find((item) => item.id === kpiId)!;
      study.alternativeRefs.forEach((alternative) => {
        expect(attempt.result!.calculationExplanations?.[alternative.id]?.[kpiId]).toContain(`global weight ${global.weight}`);
      });
    });
  });

  it("blocks comparison when problem-space scope or current numeric evidence is missing", () => {
    const project = createCoffeeMachineSampleProject();
    const study = structuredClone(project.comparisonStudies[0]);
    study.needIds = [];
    const noScope = runTraceableTradeStudy(project, study);
    expect(noScope.errors.join(" ")).toMatch(/need/i);
    study.needIds = [...(project.comparisonStudies[0].needIds ?? [])];
    const run = project.simulationRuns.find((item) => item.id === study.alternativeRefs[0].simulationRunId)!;
    run.results.find((item) => item.kpiId === study.selectedKpiIds[0])!.value = null;
    const missingEvidence = runTraceableTradeStudy(project, study);
    expect(missingEvidence.errors.join(" ")).toMatch(/current numeric result/i);
  });

  it("blocks comparison until a Root Feature and reusable variability axes are selected", () => {
    const project = createCoffeeMachineSampleProject();
    const study = structuredClone(project.comparisonStudies[0]);
    study.selectedVariabilityAxisIds = [];
    expect(runTraceableTradeStudy(project, study).errors.join(" ")).toMatch(/variability axis/i);
    study.selectedVariabilityAxisIds = ["axis-loading"];
    study.rootFeatureId = undefined;
    expect(runTraceableTradeStudy(project, study).errors.join(" ")).toMatch(/Root Feature/i);
  });

  it("keeps an infeasible alternative diagnostic but excludes it from preference", () => {
    const project = createCoffeeMachineSampleProject();
    const study = structuredClone(project.comparisonStudies[0]);
    const premium = study.alternativeRefs.find((alternative) => alternative.id === "alternative-premium")!;
    const run = project.simulationRuns.find((item) => item.id === premium.simulationRunId)!;
    const throughputRequirement = run.inputSnapshot.realizedElements.find((element) =>
      element.requirementFormula?.expression.includes("throughput")
    )!;
    const parameterId = throughputRequirement.requirementFormula!.bindings[0].targetId;
    const parameter = run.inputSnapshot.realizedElements
      .flatMap((element) => element.parameters)
      .find((item) => item.id === parameterId)!;
    parameter.value = 0;

    const attempt = runTraceableTradeStudy(project, study);
    expect(attempt.errors).toEqual([]);
    expect(attempt.result!.feasibility?.[premium.id].status).toBe("infeasible");
    expect(attempt.result!.weightedScores[premium.id]).not.toBeNull();
    expect(attempt.result!.recommendedAlternativeIds).not.toContain(premium.id);
    expect(attempt.result!.normalizedScores[premium.id]["kpi-cost"]).toBe(0);
    expect(attempt.warnings.join(" ")).toMatch(/diagnostic score remains visible/i);
  });
});
