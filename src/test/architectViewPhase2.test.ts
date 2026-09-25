import { describe, expect, it } from "vitest";
import { createCoffeeMachineSampleProject } from "../data/sample";
import {
  applyArchitectAnswer,
  architectQuestionValueError,
  architectReadiness,
  buildArchitectQuestions
} from "../domain/architectView";
import type { ArchitectAnswerStatus, Project } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

function answer(project: Project, id: string, value: unknown, instanceKey?: string, status: ArchitectAnswerStatus = "answered") {
  const question = buildArchitectQuestions(project).find((candidate) => candidate.id === id && (instanceKey === undefined || candidate.instanceKey === instanceKey));
  expect(question, `${id}${instanceKey ? `:${instanceKey}` : ""} should be available`).toBeDefined();
  return applyArchitectAnswer(project, question!, value, status).project;
}

describe("Architect view Phase 2", () => {
  it("branches KPI and simulation questions only into analysis scopes", () => {
    const architecture = createCoffeeMachineSampleProject();
    architecture.overallScope = "architectureBuilding";
    expect(buildArchitectQuestions(architecture).some((question) => question.id.startsWith("AV-I"))).toBe(false);

    architecture.overallScope = "architectureAndSimulation";
    const ids = new Set(buildArchitectQuestions(architecture).map((question) => question.id));
    ["AV-I01", "AV-I11", "AV-I12"].forEach((id) => expect(ids.has(id)).toBe(true));
    ["AV-I07", "AV-I09", "AV-I10"].forEach((id) => expect(ids.has(id)).toBe(false));
  });

  it("creates selected standard KPIs, links objectives, and records units and limits without preference questions", () => {
    let project = createCoffeeMachineSampleProject();
    project.overallScope = "architectureAndSimulation";
    project.kpis = [];
    const objectiveId = project.elements.find((element) => element.elementType === "objective")!.id;
    project = answer(project, "AV-I01", ["architect-kpi-totalMass"]);
    expect(project.kpis).toContainEqual(expect.objectContaining({ id: "architect-kpi-totalMass", standardAlgorithmKey: "totalMass" }));
    project = answer(project, "AV-I02", [objectiveId], "architect-kpi-totalMass");
    project = answer(project, "AV-I03", "standardAlgorithm", "architect-kpi-totalMass");
    project = answer(project, "AV-I04", true, "architect-kpi-totalMass");
    project = answer(project, "AV-I06", { outputUnit: "kg", maximumThreshold: 80 }, "architect-kpi-totalMass");
    expect(project.kpis[0]).toMatchObject({ objectiveIds: [objectiveId], outputUnit: "kg", maximumThreshold: 80 });
    expect(buildArchitectQuestions(project).some((question) => question.id === "AV-I07")).toBe(false);
  });

  it("stores guided formulas with exact parameter and KPI references", () => {
    let project = createCoffeeMachineSampleProject();
    project.overallScope = "architectureAndSimulation";
    const formulaKpi = project.kpis.find((kpi) => kpi.calculationMode === "formula")!;
    const parameter = project.elements.flatMap((element) => element.parameters).find((candidate) => typeof candidate.value === "number")!;
    const dependency = project.kpis.find((kpi) => kpi.id !== formulaKpi.id)!;
    project = answer(project, "AV-I01", [formulaKpi.id, dependency.id]);
    project = answer(project, "AV-I03", "formula", formulaKpi.id);
    const formula = `param("${parameter.id}") + kpi("${dependency.id}")`;
    const formulaQuestion = buildArchitectQuestions(project).find((question) => question.id === "AV-I05" && question.instanceKey === formulaKpi.id)!;
    expect(architectQuestionValueError(formulaQuestion, formula)).toBeNull();
    project = applyArchitectAnswer(project, formulaQuestion, formula).project;
    expect(project.kpis.find((kpi) => kpi.id === formulaKpi.id)).toMatchObject({ formula, inputParameterIds: [parameter.id], dependsOnKpiIds: [dependency.id] });
  });

  it("generates a missing-input question and creates an explicit canonical parameter", () => {
    let project = createCoffeeMachineSampleProject();
    project.overallScope = "architectureAndSimulation";
    project.kpis = [];
    project.elements.forEach((element) => { element.parameters = element.parameters.filter((parameter) => parameter.semanticKey !== "mass"); });
    project = answer(project, "AV-I01", ["architect-kpi-totalMass"]);
    const missing = buildArchitectQuestions(project).find((question) => question.id === "AV-I08" && question.instanceKey?.includes("semantic:mass"))!;
    const ownerId = missing.options![0].id;
    const input = { ownerElementId: ownerId, propertyName: "Assembly mass", semanticKey: "mass", value: 42, unit: "kg", source: "Supplier data sheet", valueOrigin: "entered", uncertaintyPercent: 5 };
    expect(architectQuestionValueError(missing, input)).toBeNull();
    project = applyArchitectAnswer(project, missing, input).project;
    expect(project.elements.find((element) => element.id === ownerId)?.parameters).toContainEqual(expect.objectContaining({ semanticKey: "mass", value: 42, unit: "kg", source: "Supplier data sheet", uncertaintyPercent: 5 }));
  });

  it("executes and stores a current immutable architecture-only run, then detects staleness", () => {
    let project = createCoffeeMachineSampleProject();
    project.overallScope = "architectureAndSimulation";
    project.simulationRuns = [];
    const kpi = project.kpis.find((candidate) => candidate.standardAlgorithmKey === "totalMass")!;
    const objectiveId = project.elements.find((element) => element.elementType === "objective")!.id;
    project = answer(project, "AV-I01", [kpi.id]);
    project = answer(project, "AV-I02", [objectiveId], kpi.id);
    project = answer(project, "AV-I03", "standardAlgorithm", kpi.id);
    project = answer(project, "AV-I04", true, kpi.id);
    project = answer(project, "AV-I06", { outputUnit: "kg" }, kpi.id);
    project = answer(project, "AV-I11", { name: "Architect mass evidence", execute: true });
    expect(project.simulationRuns).toHaveLength(1);
    expect(project.simulationRuns[0]).toMatchObject({ name: "Architect mass evidence", selectedKpiIds: [kpi.id] });
    expect(project.simulationRuns[0].inputSnapshot.kpiDefinitions[0].id).toBe(kpi.id);
    expect(architectReadiness(project).findings.some((finding) => finding.id === "AVR-010")).toBe(false);

    const stale = { ...project, modelRevision: project.simulationRuns[0].projectModelRevisionAtRun + 1 };
    expect(architectReadiness(stale).findings).toContainEqual(expect.objectContaining({ id: "AVR-010", questionKey: "AV-I11" }));
  });

  it("keeps reviews and simulation storage revision-neutral so evidence does not stale itself", () => {
    useAppStore.getState().resetEntireApplication();
    useAppStore.getState().updateProject({ overallScope: "architectureAndSimulation" });
    const answerInStore = (id: string, value: unknown, instanceKey?: string) => {
      const project = selectActiveProject(useAppStore.getState())!;
      const question = buildArchitectQuestions(project).find((candidate) => candidate.id === id && (instanceKey === undefined || candidate.instanceKey === instanceKey))!;
      useAppStore.getState().answerArchitectQuestion(question, value);
    };
    let project = selectActiveProject(useAppStore.getState())!;
    const kpi = project.kpis.find((candidate) => candidate.standardAlgorithmKey === "totalMass")!;
    const objectiveId = project.elements.find((element) => element.elementType === "objective")!.id;
    answerInStore("AV-I01", [kpi.id]);
    answerInStore("AV-I02", [objectiveId], kpi.id);
    answerInStore("AV-I03", "standardAlgorithm", kpi.id);
    answerInStore("AV-I04", true, kpi.id);
    answerInStore("AV-I06", { outputUnit: "kg" }, kpi.id);
    answerInStore("AV-I11", { name: "Revision-neutral evidence", execute: true });
    project = selectActiveProject(useAppStore.getState())!;
    const revision = project.modelRevision;
    expect(project.simulationRuns.at(-1)?.projectModelRevisionAtRun).toBe(revision);
    answerInStore("AV-I12", true);
    project = selectActiveProject(useAppStore.getState())!;
    expect(project.modelRevision).toBe(revision);
    expect(project.simulationRuns.at(-1)?.projectModelRevisionAtRun).toBe(revision);
  });
});
