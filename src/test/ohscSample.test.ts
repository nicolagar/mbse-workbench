import { describe, expect, it } from "vitest";
import { createOhscSampleProject } from "../data/ohscSample";
import { architectReadiness, buildArchitectQuestions, withCanonicalArchitectAnswers } from "../domain/architectView";
import { buildExportPackage, defaultExportFilters, parseExportPackage, serializeExportPackage } from "../domain/exportImport";
import { evaluateRequirement } from "../domain/formulas";
import { evaluateMandatoryFeasibility } from "../domain/tradeStudyMethodology";
import { validateProject } from "../domain/validation";
import { validateConfiguration } from "../domain/variability";
import { migrateProject } from "../store/persistence";

describe("OHSC example", () => {
  it("implements the accepted complete baseline and four-configuration study", () => {
    const project = createOhscSampleProject();
    const requirements = project.elements.filter((element) => element.elementType === "systemRequirement");

    expect(requirements).toHaveLength(30);
    expect(requirements.filter((requirement) => requirement.requirementFormula)).toHaveLength(18);
    expect(project.customAttributeDefinitions.some((definition) => definition.name === "Applicability")).toBe(false);
    expect(project.configurations).toHaveLength(4);
    expect(project.configurations.every((configuration) => configuration.validationStatus === "valid")).toBe(true);
    expect(project.configurations.every((configuration) => configuration.derivation)).toBe(true);
    expect(project.configurations.map((configuration) => configuration.effectiveSelectedFeatureIds.length)).toEqual([14, 15, 15, 14]);
    expect(project.configurations.map((configuration) => configuration.manuallySelectedFeatureIds)).toEqual([
      ["FEAT-AX01-COMPACT", "FEAT-AX02-STANDARD", "FEAT-AX03-PIVOTING", "FEAT-AX05-STANDARD-KIT", "FEAT-AX06-STANDARD-LATCH", "FEAT-AX07-STANDARD-ROUTE", "FEAT-AX08-MANUAL-EVIDENCE"],
      ["FEAT-AX01-EXTENDED", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX06-QUICK-LATCH", "FEAT-AX08-DIGITAL-EVIDENCE"],
      ["FEAT-AX01-BALANCED", "FEAT-AX02-WEIGHT-OPT", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX06-QUICK-LATCH", "FEAT-AX07-MODULAR-ROUTE"],
      ["FEAT-AX01-COMPACT", "FEAT-AX02-WEIGHT-OPT", "FEAT-AX03-PIVOTING", "FEAT-AX06-QUICK-LATCH", "FEAT-AX07-LIGHTWEIGHT-ROUTE", "FEAT-AX08-DIGITAL-EVIDENCE"]
    ]);
    expect(project.configurations.map((configuration) => configuration.automaticConstraintFeatureIds)).toEqual([
      [],
      ["FEAT-AX02-REINFORCED", "FEAT-AX04-PASSIVE-ASSIST", "FEAT-AX05-REINFORCED-KIT", "FEAT-AX07-CAPACITY-ROUTE"],
      ["FEAT-AX04-PASSIVE-ASSIST", "FEAT-AX05-MODULAR-KIT", "FEAT-AX08-DIGITAL-EVIDENCE"],
      ["FEAT-AX05-LIGHTWEIGHT-KIT"]
    ]);
    expect(project.variationPoints.filter((point) => point.kind === "existence")).toHaveLength(6);
    expect(project.variationPoints.filter((point) => point.kind === "primitiveProperty")).toHaveLength(38);
    expect(project.featureConstraints).toHaveLength(16);
    expect(project.functionSequences).toHaveLength(9);
    expect(project.selectedUseCaseIds).toEqual(["UC-01", "UC-02", "UC-03", "UC-04", "UC-05", "UC-06", "UC-07", "UC-08"]);
    expect(project.simulationRuns).toHaveLength(4);
    expect(project.comparisonStudies[0].alternativeRefs).toHaveLength(4);
    expect(project.comparisonStudies[0].question).toBe("Which combination of OHSC product-design, integration/service and industrialisation choices provides the preferred balance of storage, mass, cost, installation effort and maintainability while satisfying the established requirements?");
    expect(project.comparisonStudies[0].scenarios).toHaveLength(5);
    expect(project).not.toHaveProperty("assumptions");
    expect(project.comparisonRisks).toHaveLength(9);
    expect(project.comparisonRisks.every((risk) => risk.owner && risk.status && risk.applicableArchitectureIds.length && risk.applicableConfigurationIds.length)).toBe(true);
    expect(project.decisions.find((decision) => decision.id === "DEC-OHSC-A")?.evidenceSnapshot).toBeDefined();
    expect(project.decisions.find((decision) => decision.id === "DEC-OHSC-NEW")?.selectedAlternative).toBe("Change Solution 2 — Balanced Modular");
    expect(project.architectures.filter((architecture) => architecture.status === "baseline").map((architecture) => architecture.id)).toEqual(["ARCH-OHSC-BALANCED"]);
    expect(requirements.every((requirement) => requirement.metadata.source && project.relationships.some((relationship) => relationship.sourceId === requirement.id && relationship.relationshipType === "satisfiedBy") && project.relationships.some((relationship) => relationship.targetId === requirement.id && relationship.relationshipType === "verifies"))).toBe(true);
    expect(project.variationPoints.every((point) => project.configurations.some((configuration) => configuration.derivation?.appliedVariations.some((variation) => variation.variationPointId === point.id)))).toBe(true);

    const invalid = structuredClone(project.configurations[0]);
    invalid.manuallySelectedFeatureIds = ["FEAT-AX01-EXTENDED", "FEAT-AX02-WEIGHT-OPT"];
    invalid.automaticConstraintFeatureIds = [];
    invalid.effectiveSelectedFeatureIds = [...invalid.manuallySelectedFeatureIds];
    expect(validateConfiguration(project, invalid).some((finding) => finding.severity === "error")).toBe(true);
  }, 20_000);

  it("keeps Standard A feasible and applies parameter-value variation points", () => {
    const project = createOhscSampleProject();
    const study = project.comparisonStudies[0];
    const feasibility = evaluateMandatoryFeasibility(project, study, "ALT-CFG-A");
    expect(feasibility.status).toBe("feasible");
    expect(feasibility.failedRequirementIds).toEqual([]);

    const values = Object.fromEntries(project.simulationRuns.map((run) => [
      run.configurationId!,
      Object.fromEntries(run.results.map((result) => [result.kpiId!, result.value]))
    ]));
    expect(values["CFG-A"]).toMatchObject({ "KPI-01": 760, "KPI-02": 31.5, "KPI-03": 100, "KPI-04": 14, "KPI-05": 1.1 });
    expect(values["CFG-B"]).toMatchObject({ "KPI-01": 1060, "KPI-02": 34, "KPI-03": 112, "KPI-04": 15, "KPI-05": 0.9 });
    expect(values["CFG-C"]).toMatchObject({ "KPI-01": 900, "KPI-02": 29, "KPI-03": 118, "KPI-04": 10, "KPI-05": 0.6 });
    expect(values["CFG-D"]["KPI-01"]).toBeCloseTo(800);
    expect(values["CFG-D"]["KPI-02"]).toBeCloseTo(24.5);
    expect(values["CFG-D"]["KPI-03"]).toBeCloseTo(128);
    expect(values["CFG-D"]["KPI-04"]).toBeCloseTo(8.5);
    expect(values["CFG-D"]["KPI-05"]).toBeCloseTo(0.75);
    expect(evaluateMandatoryFeasibility(project, study, "ALT-CFG-B").failedRequirementIds).toEqual(["OHSC-REQ-010"]);

    const standardARun = project.simulationRuns.find((run) => run.configurationId === "CFG-A")!;
    const evidenceProject = {
      ...project,
      elements: structuredClone(standardARun.inputSnapshot.realizedElements),
      relationships: structuredClone(standardARun.inputSnapshot.realizedRelationships),
      kpis: project.kpis.map((kpi) => ({ ...kpi, lastCalculatedValue: standardARun.results.find((result) => result.kpiId === kpi.id)?.value }))
    };
    const formulaRequirements = evidenceProject.elements.filter((element) => element.elementType === "systemRequirement" && element.requirementFormula);
    expect(formulaRequirements).toHaveLength(18);
    expect(formulaRequirements.map((requirement) => evaluateRequirement(evidenceProject, requirement).status)).toEqual(Array(18).fill("satisfied"));

    const result = study.results.at(-1)!;
    expect(result.dataCoveragePercent).toEqual({ "ALT-CFG-A": 100, "ALT-CFG-B": 100, "ALT-CFG-C": 100, "ALT-CFG-D": 100 });
    expect(result.stakeholderValueScores?.["ALT-CFG-A"]).toBeCloseTo(18.89, 1);
    expect(result.stakeholderValueScores?.["ALT-CFG-B"]).toBeCloseTo(46.71, 1);
    expect(result.stakeholderValueScores?.["ALT-CFG-C"]).toBeCloseTo(59.6, 1);
    expect(result.stakeholderValueScores?.["ALT-CFG-D"]).toBeCloseTo(55.17, 1);
    expect(result.recommendedAlternativeIds).toEqual(["ALT-CFG-C"]);
  }, 20_000);

  it("has no project validation errors and completes the Architect projection", () => {
    const project = createOhscSampleProject();
    const currentFindings = validateProject(project).filter((finding) => finding.severity !== "information");
    expect(currentFindings).toEqual([]);

    const answered = withCanonicalArchitectAnswers(project);
    const questions = buildArchitectQuestions(answered);
    const missing = questions
      .filter((question) => !answered.architectSession?.answers[question.key])
      .map((question) => ({ key: question.key, prompt: question.prompt }));
    expect(missing).toEqual([]);
    expect(Object.keys(answered.architectSession?.answers ?? {})).toHaveLength(questions.length);
    const readiness = architectReadiness(answered);
    expect(readiness.findings).toEqual([]);
    expect(readiness.status).toBe("ready");
  }, 30_000);

  it("round-trips the complete OHSC project and canonical Architect session", () => {
    const source = withCanonicalArchitectAnswers(createOhscSampleProject());
    const raw = serializeExportPackage(buildExportPackage(source, defaultExportFilters()));
    const restored = parseExportPackage(raw, migrateProject);
    expect(restored.errors).toEqual([]);
    expect(restored.package?.project.elements.filter((element) => element.elementType === "systemRequirement")).toHaveLength(30);
    expect(restored.package?.project.configurations).toHaveLength(4);
    expect(restored.package?.project.simulationRuns).toHaveLength(4);
    expect(restored.package?.project.comparisonRisks).toHaveLength(9);
    expect(Object.keys(restored.package?.project.architectSession?.answers ?? {})).toHaveLength(Object.keys(source.architectSession?.answers ?? {}).length);
  }, 30_000);
});
