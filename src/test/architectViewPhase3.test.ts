import { describe, expect, it } from "vitest";
import { createCoffeeMachineSampleProject } from "../data/sample";
import {
  applyArchitectAnswer,
  architectReadiness,
  buildArchitectQuestions
} from "../domain/architectView";
import { derivationStatus } from "../domain/derivation";
import { simulationStatus } from "../domain/simulation";
import type { ArchitectAnswerStatus, Project } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

function answer(project: Project, id: string, value: unknown, instanceKey?: string, status: ArchitectAnswerStatus = "answered") {
  const question = buildArchitectQuestions(project).find((candidate) => candidate.id === id && (instanceKey === undefined || candidate.instanceKey === instanceKey));
  expect(question, `${id}${instanceKey ? `:${instanceKey}` : ""} should be available`).toBeDefined();
  return applyArchitectAnswer(project, question!, value, status).project;
}

function cleanTradeProject() {
  const project = createCoffeeMachineSampleProject();
  project.overallScope = "tradeStudy";
  project.architectSession = undefined;
  project.features = [];
  project.featureGroups = [];
  project.variabilityAxes = [];
  project.featureConstraints = [];
  project.variationPoints = [];
  project.configurations = [];
  project.architectures = [];
  project.activeArchitectureId = undefined;
  project.baselineArchitectureId = undefined;
  project.simulationRuns = [];
  project.comparisonStudies = [];
  project.activeComparisonStudyId = undefined;
  project.openDecisions = [];
  project.decisions = [];
  return project;
}

function frameTrade(project: Project) {
  project = answer(project, "AV-T01", "Coffee-machine concept comparison");
  project = answer(project, "AV-T02", "Which coffee-machine concept should become the baseline?");
  project = answer(project, "AV-T03", "Personalized beverages; Safe operation");
  project = answer(project, "AV-T04", "Brewing approach");
  project = answer(project, "AV-T05", [
    { id: "concept-manual", name: "Manual-assisted", description: "Simpler preparation path" },
    { id: "concept-automatic", name: "Automatic", description: "Automated preparation path" }
  ]);
  return project;
}

function defineVariability(project: Project) {
  project = answer(project, "AV-J01", { name: "Coffee-machine family", description: "Complete 150% family" });
  project = answer(project, "AV-J02", "Safe operation");
  project = answer(project, "AV-J03", { mode: "xor", choices: "Manual brew; Automatic brew" }, "brewing-approach");
  return project;
}

describe("Architect view Phase 3", () => {
  it("places trade framing immediately after requirements and excludes Phase 3 from non-trade scopes", () => {
    const trade = cleanTradeProject();
    const questions = buildArchitectQuestions(trade);
    const requirementRecap = questions.findIndex((question) => question.id === "AV-D10");
    const decisionQuestion = questions.findIndex((question) => question.id === "AV-T02");
    const evaluationQuestion = questions.findIndex((question) => question.id === "AV-I01");
    const productBehavior = questions.findIndex((question) => question.id === "AV-E01");
    expect(questions.find((question) => question.id === "AV-T04")?.example).toBe("Brewing technology; Milk preparation system; User-interface type");
    expect(questions.some((question) => ["AV-I09", "AV-I10", "AV-I11", "AV-I12"].includes(question.id))).toBe(false);
    expect(requirementRecap).toBeLessThan(decisionQuestion);
    expect(decisionQuestion).toBeLessThan(evaluationQuestion);
    expect(evaluationQuestion).toBeLessThan(productBehavior);

    trade.overallScope = "architectureBuilding";
    const architectureIds = buildArchitectQuestions(trade).map((question) => question.id);
    expect(architectureIds.some((id) => /^AV-[TJKL]/.test(id))).toBe(false);
    expect(architectureIds.filter((id) => id.startsWith("AV-M"))).toEqual(["AV-M02", "AV-M03", "AV-M04"]);
    trade.overallScope = "architectureAndSimulation";
    expect(buildArchitectQuestions(trade).some((question) => question.id === "AV-I11")).toBe(true);
    expect(buildArchitectQuestions(trade).some((question) => ["AV-I09", "AV-I10"].includes(question.id))).toBe(false);
  });

  it("creates one canonical study, open decision, feature family, axis, constraint and variation point", () => {
    let project = frameTrade(cleanTradeProject());
    expect(project.comparisonStudies).toHaveLength(1);
    expect(project.openDecisions).toContainEqual(expect.objectContaining({
      question: "Which coffee-machine concept should become the baseline?",
      status: "open"
    }));

    project = defineVariability(project);
    const root = project.features.find((feature) => feature.featureType === "root")!;
    const choices = project.features.filter((feature) => feature.featureType === "xor");
    expect(root.name).toBe("Coffee-machine family");
    expect(choices.map((feature) => feature.name)).toEqual(["Manual brew", "Automatic brew"]);
    expect(project.variabilityAxes).toContainEqual(expect.objectContaining({ name: "Brewing approach" }));

    project = answer(project, "AV-J05", [{ type: "excludes", sourceFeatureId: choices[0].id, targetFeatureId: choices[1].id }]);
    const component = project.elements.find((element) => element.elementType === "productComponent")!;
    project = answer(project, "AV-J06", [{ elementId: component.id, featureId: choices[1].id }]);
    expect(project.featureConstraints).toContainEqual(expect.objectContaining({ type: "excludes", sourceFeatureId: choices[0].id, targetFeatureId: choices[1].id }));
    expect(project.variationPoints).toContainEqual(expect.objectContaining({ kind: "existence", constrainedElementIds: [component.id], featureExpression: choices[1].id }));
  });

  it("validates two alternatives, derives current 100% architectures and stores comparable configured runs", () => {
    let project = defineVariability(frameTrade(cleanTradeProject()));
    const kpi = project.kpis.find((candidate) => candidate.id === "kpi-handling-rate")!;
    project = answer(project, "AV-I01", [kpi.id]);
    const manual = project.features.find((feature) => feature.name === "Manual brew")!;
    const automatic = project.features.find((feature) => feature.name === "Automatic brew")!;

    project = answer(project, "AV-K01", { name: "Manual-assisted", selectedFeatureIds: [manual.id], automaticConstraintFeatureIds: [], featureValues: {} }, "concept-manual");
    project = answer(project, "AV-K01", { name: "Automatic", selectedFeatureIds: [automatic.id], automaticConstraintFeatureIds: [], featureValues: {} }, "concept-automatic");
    expect(buildArchitectQuestions(project).some((question) => question.id === "AV-S03")).toBe(false);
    expect(buildArchitectQuestions(project).find((question) => question.id === "AV-S01")?.explanation).toContain("Simulation is locked");
    for (const configuration of [...project.configurations]) {
      expect(configuration.validationStatus).toBe("valid");
      project = answer(project, "AV-K04", { execute: true }, configuration.id);
      const derived = project.configurations.find((candidate) => candidate.id === configuration.id)!;
      expect(derivationStatus(project, derived)).toBe("Current");
    }
    const readyQuestions = buildArchitectQuestions(project);
    expect(readyQuestions.some((question) => question.id === "AV-K06")).toBe(false);
    expect(readyQuestions.findIndex((question) => question.id === "AV-K04")).toBeLessThan(readyQuestions.findIndex((question) => question.id === "AV-S01"));
    expect(readyQuestions.findIndex((question) => question.id === "AV-S01")).toBeLessThan(readyQuestions.findIndex((question) => question.id === "AV-S03"));
    expect(readyQuestions.findIndex((question) => question.id === "AV-S03")).toBeLessThan(readyQuestions.findIndex((question) => question.id === "AV-L01"));
    project = answer(project, "AV-S01", true);
    if (buildArchitectQuestions(project).some((question) => question.id === "AV-S02")) project = answer(project, "AV-S02", true);
    project = answer(project, "AV-S03", { name: "Comparable KPI evidence", execute: true });

    expect(project.simulationRuns).toHaveLength(2);
    project.simulationRuns.forEach((run) => {
      expect(run.configurationId).toBeTruthy();
      expect(run.derivationId).toBeTruthy();
      expect(run.selectedKpiIds).toEqual([kpi.id]);
      expect(simulationStatus(project, run)).toBe("Current");
    });
  });

  it("keeps derivation and configured evidence revision-neutral in the application store", () => {
    let project = defineVariability(frameTrade(cleanTradeProject()));
    const kpi = project.kpis.find((candidate) => candidate.id === "kpi-handling-rate")!;
    project = answer(project, "AV-I01", [kpi.id]);
    const choices = project.features.filter((feature) => feature.featureType === "xor");
    project = answer(project, "AV-K01", { name: "Manual-assisted", selectedFeatureIds: [choices[0].id], automaticConstraintFeatureIds: [], featureValues: {} }, "concept-manual");
    project = answer(project, "AV-K01", { name: "Automatic", selectedFeatureIds: [choices[1].id], automaticConstraintFeatureIds: [], featureValues: {} }, "concept-automatic");
    useAppStore.setState({ projects: [project], activeProjectId: project.id });

    const revision = project.modelRevision;
    let active = selectActiveProject(useAppStore.getState())!;
    for (const configuration of [...active.configurations]) {
      const question = buildArchitectQuestions(active).find((candidate) => candidate.id === "AV-K04" && candidate.instanceKey === configuration.id)!;
      useAppStore.getState().answerArchitectQuestion(question, { execute: true });
      active = selectActiveProject(useAppStore.getState())!;
      expect(active.modelRevision).toBe(revision);
      expect(active.configurations.find((candidate) => candidate.id === configuration.id)?.derivation?.sourceModelRevision).toBe(revision);
    }
    const assumptionQuestion = buildArchitectQuestions(active).find((candidate) => candidate.id === "AV-S02");
    if (assumptionQuestion) { useAppStore.getState().answerArchitectQuestion(assumptionQuestion, true); active = selectActiveProject(useAppStore.getState())!; }
    const batchQuestion = buildArchitectQuestions(active).find((candidate) => candidate.id === "AV-S03")!;
    useAppStore.getState().answerArchitectQuestion(batchQuestion, { name: "Comparable evidence", execute: true });
    active = selectActiveProject(useAppStore.getState())!;
    expect(active.modelRevision).toBe(revision);
    expect(active.simulationRuns).toHaveLength(2);
    active.simulationRuns.forEach((run) => { expect(run.projectModelRevisionAtRun).toBe(revision); expect(simulationStatus(active, run)).toBe("Current"); });
  });

  it("uses exact run references and study-specific settings, then requires explicit approval before setting a baseline", () => {
    let project = defineVariability(frameTrade(cleanTradeProject()));
    const kpi = project.kpis.find((candidate) => candidate.id === "kpi-handling-rate")!;
    project = answer(project, "AV-I01", [kpi.id]);
    const choiceIds = project.features.filter((feature) => feature.featureType === "xor").map((feature) => feature.id);
    for (const [conceptId, name, featureId] of [["concept-manual", "Manual-assisted", choiceIds[0]], ["concept-automatic", "Automatic", choiceIds[1]]] as const) {
      project = answer(project, "AV-K01", { name, selectedFeatureIds: [featureId], automaticConstraintFeatureIds: [], featureValues: {} }, conceptId);
      const configurationId = `architect-configuration-${conceptId}`;
      project = answer(project, "AV-K04", { execute: true }, configurationId);
    }
    if (buildArchitectQuestions(project).some((question) => question.id === "AV-S02")) project = answer(project, "AV-S02", true);
    project = answer(project, "AV-S03", { name: "Comparable evidence", execute: true });

    const runIds = project.simulationRuns.map((run) => run.id);
    const mandatory = project.elements.find((element) => element.requirementFormula?.expression.includes("throughput"))!;
    project = answer(project, "AV-L01", runIds);
    project = answer(project, "AV-L02", [mandatory.id]);
    project = answer(project, "AV-L03", [kpi.id]);
    project = answer(project, "AV-L04", 3, kpi.id);
    project = answer(project, "AV-L05", { optimizationDirection: "maximize", minimum: 10, thresholdMode: "warning" }, kpi.id);
    project = answer(project, "AV-L06", true);
    project = answer(project, "AV-L07", { execute: true });

    const study = project.comparisonStudies[0], result = study.results.at(-1)!;
    expect(study.alternativeRefs.map((alternative) => alternative.simulationRunId)).toEqual(runIds);
    expect(study.kpiSettings[kpi.id]).toMatchObject({ weight: 3, optimizationDirection: "maximize", threshold: { minimum: 10, mode: "warning" } });
    expect(result.methodology).toBe("traceable-feasible-weighted");
    expect(Object.values(result.feasibility ?? {}).every((state) => state.status === "feasible")).toBe(true);

    const selected = study.alternativeRefs[0];
    project = answer(project, "AV-L09", selected.id);
    expect(project.baselineArchitectureId).toBeUndefined();
    project = answer(project, "AV-L10", { rationale: "Meets mandatory requirements with acceptable KPI evidence.", owner: "Chief architect", decisionDate: "2026-08-29", status: "proposed", baselineApprovalConfirmed: false });
    expect(project.baselineArchitectureId).toBeUndefined();
    project = answer(project, "AV-L10", { rationale: "Meets mandatory requirements with acceptable KPI evidence.", owner: "Chief architect", decisionDate: "2026-08-29", status: "approved", baselineApprovalConfirmed: true });
    expect(project.baselineArchitectureId).toBe(selected.architectureId);
    expect(project.decisions[0]).toMatchObject({ status: "approved", baselineApprovalConfirmed: true });
    expect(architectReadiness(project).findings.some((finding) => finding.id === "AVR-021")).toBe(false);
  });
});
