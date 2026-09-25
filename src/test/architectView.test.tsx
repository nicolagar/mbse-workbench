import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { ArchitectCompletion } from "../components/ArchitectView";
import { createCoffeeMachineSampleProject } from "../data/sample";
import {
  applyArchitectAnswer,
  architectQuestionValueError,
  architectReadiness,
  buildArchitectQuestions,
  projectedArchitectValue,
  requirementHasSatisfaction
} from "../domain/architectView";
import { validateProject } from "../domain/validation";
import type { PersistedAppState } from "../domain/types";
import { CURRENT_SCHEMA_VERSION, loadPersistedState, serializeState } from "../store/persistence";
import { useAppStore } from "../store/useAppStore";

describe("Architect view", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication("empty"));

  it("opens with an untimed perspective choice and keeps Skip untimed", () => {
    render(<App />);
    const dialog = screen.getByRole("dialog", { name: "How would you like to work?" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Architect view/ }));
    expect(screen.getByRole("heading", { name: "What is the Aim of this Project?" })).toBeInTheDocument();
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip).toHaveTextContent(/^Skip$/);
    fireEvent.click(skip);
    expect(screen.getByRole("heading", { name: "What should this study include?" })).toBeInTheDocument();
    expect(useAppStore.getState().projects[0].architectSession?.answers["AV-A01"].status).toBe("skipped");
  });

  it("defines the system separately from stakeholders and preserves canonical mission links", () => {
    let project = useAppStore.getState().projects[0];
    let questions = buildArchitectQuestions(project);
    project = applyArchitectAnswer(project, questions.find((item) => item.id === "AV-A04")!, "Provide personalized coffee while reducing office-manager maintenance overhead").project;
    questions = buildArchitectQuestions(project);
    project = applyArchitectAnswer(project, questions.find((item) => item.id === "AV-B01")!, "Office Employee; Office Manager").project;
    questions = buildArchitectQuestions(project);

    const stakeholderIndex = questions.findIndex((item) => item.id === "AV-B01");
    const systemIndex = questions.findIndex((item) => item.id === "AV-A05");
    const needsIndex = questions.findIndex((item) => item.id === "AV-B03");
    expect(stakeholderIndex).toBeLessThan(systemIndex);
    expect(systemIndex).toBeLessThan(needsIndex);
    const systemQuestion = questions[systemIndex];
    expect(systemQuestion.inputKind).toBe("text");
    expect(systemQuestion.prompt).toBe("What system are you designing?");
    expect(project.relationships.filter((relationship) => relationship.relationshipType === "hasStakeholder")).toHaveLength(2);
    project = applyArchitectAnswer(project, systemQuestion, "Coffee Machine Product Line").project;
    expect(project.elements.filter((element) => element.elementType === "system")).toHaveLength(1);
    expect(project.elements.find((element) => element.elementType === "system")?.name).toBe("Coffee Machine Product Line");
    expect(project.relationships).toContainEqual(expect.objectContaining({
      relationshipType: "hasSOI",
      sourceId: project.elements.find((element) => element.elementType === "mission")?.id,
      targetId: project.elements.find((element) => element.elementType === "system")?.id
    }));
  });

  it("creates named external systems with canonical mission participation and stores each role", () => {
    let project = createCoffeeMachineSampleProject();
    const removedIds = new Set(project.elements.filter((element) => element.elementType === "externalSystem").map((element) => element.id));
    project.elements = project.elements.filter((element) => !removedIds.has(element.id));
    project.relationships = project.relationships.filter((relationship) => !removedIds.has(relationship.sourceId) && !removedIds.has(relationship.targetId));
    project.architectSession = undefined;

    const namesQuestion = buildArchitectQuestions(project).find((question) => question.id === "AV-B06")!;
    project = applyArchitectAnswer(project, namesQuestion, "Corporate identity service; Facility power network").project;
    const missionId = project.elements.find((element) => element.elementType === "mission")!.id;
    const externalSystems = project.elements.filter((element) => element.elementType === "externalSystem");
    expect(externalSystems.map((element) => element.name)).toEqual(["Corporate identity service", "Facility power network"]);
    expect(externalSystems.every((external) => project.relationships.some((relationship) =>
      relationship.relationshipType === "participatesInMission"
      && relationship.sourceId === missionId
      && relationship.targetId === external.id
    ))).toBe(true);

    const roleQuestion = buildArchitectQuestions(project).find((question) => question.id === "AV-B07" && question.instanceKey === externalSystems[0].id)!;
    project = applyArchitectAnswer(project, roleQuestion, "Authenticates authorized operators.").project;
    expect(project.elements.find((element) => element.id === externalSystems[0].id)?.description).toBe("Authenticates authorized operators.");
  });

  it("uses simple object-oriented wording and states what each affected answer creates", () => {
    const project = createCoffeeMachineSampleProject();
    const questions = buildArchitectQuestions(project);
    const system = project.elements.find((element) => element.elementType === "system")!;
    const stakeholder = project.elements.find((element) => element.elementType === "stakeholder")!;
    expect(questions.find((item) => item.id === "AV-B02" && item.instanceKey === stakeholder.id)).toMatchObject({
      prompt: `What is ${stakeholder.name}'s role in this study?`,
      explanation: expect.stringContaining("Documentation only")
    });
    expect(questions.find((item) => item.id === "AV-B03" && item.instanceKey === stakeholder.id)).toMatchObject({
      prompt: `What does ${stakeholder.name} need?`,
      explanation: expect.stringContaining("creates a Need")
    });
    expect(questions.find((item) => item.id === "AV-C01")).toMatchObject({
      prompt: `Which use cases should be created for ${system.name}?`,
      explanation: expect.stringContaining("creates a Use Case")
    });
    expect(questions.find((item) => item.id === "AV-G01")?.explanation).toContain("creates a Process Function");
    expect(questions.find((item) => item.id === "AV-G04")?.example).toContain("Manual assembly station");
    expect(questions.find((item) => item.id === "AV-G09")?.example).toContain("Torque wrench");
    expect(questions.find((item) => item.id === "AV-H02")?.explanation).toContain("does not create a parameter");
  });

  it("checks satisfaction from requirements outward without forcing every function or component to link", () => {
    const project = createCoffeeMachineSampleProject();
    const questions = buildArchitectQuestions(project);
    expect(questions.find((item) => item.id === "AV-E03")?.required).toBe(false);
    expect(questions.find((item) => item.id === "AV-F02")?.required).toBe(false);
    expect(questions.find((item) => item.id === "AV-G03")?.required).toBe(false);
    expect(questions.find((item) => item.id === "AV-G05")?.required).toBe(false);
    const satisfactionQuestion = questions.find((item) => item.id === "AV-H02")!;
    expect(satisfactionQuestion.required).toBe(!requirementHasSatisfaction(project, satisfactionQuestion.instanceKey!));
    const parameterOption = satisfactionQuestion.options?.find((option) =>
      project.elements.some((element) => element.parameters.some((parameter) => parameter.id === option.id))
    );
    expect(parameterOption?.detail).toMatch(/^Owned by /);
    const requirementId = satisfactionQuestion.instanceKey!;
    const parameterId = parameterOption!.id;
    const ownerId = project.elements.find((element) => element.parameters.some((parameter) => parameter.id === parameterId))!.id;
    const architectBound = applyArchitectAnswer(project, satisfactionQuestion, [parameterId]).project;
    expect(architectBound.elements.find((element) => element.id === requirementId)?.requirementFormula?.bindings).toContainEqual(expect.objectContaining({
      kind: "parameter",
      targetId: parameterId
    }));
    expect(architectBound.relationships).toContainEqual(expect.objectContaining({
      sourceId: requirementId,
      targetId: ownerId,
      relationshipType: "satisfiedBy"
    }));

    const store = useAppStore.getState();
    store.resetEntireApplication();
    const active = useAppStore.getState().projects[0];
    const requirement = active.elements.find((element) => element.elementType === "systemRequirement" && element.requirementFormula)!;
    const owner = active.elements.find((element) => ["productFunction", "productComponent", "processFunction", "industrialSystemComponent"].includes(element.elementType) && element.parameters.length)!;
    const parameter = owner.parameters[0];
    requirement.requirementFormula = { expression: "", bindings: [] };
    expect(useAppStore.getState().bindRequirementParameter(requirement.id, parameter.id)).toBeNull();
    const updated = useAppStore.getState().projects[0];
    expect(updated.elements.find((element) => element.id === requirement.id)?.requirementFormula?.bindings.some((binding) => binding.targetId === parameter.id)).toBe(true);
    expect(updated.relationships.some((relationship) => relationship.sourceId === requirement.id && relationship.targetId === owner.id && relationship.relationshipType === "satisfiedBy")).toBe(true);
  });

  it("selects consumed and produced items only from previously defined product components", () => {
    const project = createCoffeeMachineSampleProject();
    const question = buildArchitectQuestions(project).find((item) => item.id === "AV-G07")!;
    const productComponentIds = project.elements.filter((element) => element.elementType === "productComponent").map((element) => element.id);
    expect(question.options?.every((option) => productComponentIds.includes(option.id))).toBe(true);
    const componentId = question.options![0].id;
    const result = applyArchitectAnswer(project, question, [{ componentId, quantity: 2, unit: "module", itemFlowName: "Modules in" }]).project;
    expect(result.relationships.some((relationship) =>
      relationship.sourceId === question.instanceKey
      && relationship.targetId === componentId
      && relationship.relationshipType === "consumes"
      && relationship.quantity === 2
      && relationship.unit === "module"
    )).toBe(true);
  });

  it("persists the active perspective and Architect session without changing schema 9", () => {
    const project = createCoffeeMachineSampleProject();
    const scopeQuestion = buildArchitectQuestions(project).find((item) => item.id === "AV-A02")!;
    const answered = applyArchitectAnswer(project, scopeQuestion, "tradeStudy").project;
    const state: PersistedAppState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activeProjectId: answered.id,
      projects: [answered],
      snapshots: [],
      uiPreferences: { ...useAppStore.getState().uiPreferences, activePerspective: "architect" }
    };
    const loaded = loadPersistedState({ getItem: () => serializeState(state) });
    expect(loaded.error).toBeUndefined();
    expect(loaded.state?.uiPreferences.activePerspective).toBe("architect");
    expect(loaded.state?.projects[0].architectSession?.answers["AV-A02"].value).toBe("tradeStudy");
  });

  it("creates a quantitative parameter intent, canonical parameter, formula binding and owner trace", () => {
    let project = createCoffeeMachineSampleProject();
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    const owner = project.elements.find((element) => element.elementType === "productComponent")!;
    let question = buildArchitectQuestions(project).find((item) => item.id === "AV-D04" && item.instanceKey === requirement.id)!;
    project = applyArchitectAnswer(project, question, "quantitative").project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-D05" && item.instanceKey === requirement.id)!;
    expect(question.prompt).toBe(`How should “${requirement.name}” be checked quantitatively?`);
    expect(question.explanation).toBe("Define the measured property, comparison, target and unit. This creates the formal formula used to evaluate the requirement. The semantic key identifies the property for formulas and KPI calculations.");
    const meaning = { propertyName: "Beverage throughput", semanticKey: "throughput", operator: ">=" as const, target: 10, unit: "beverages/h" };
    expect(architectQuestionValueError(question, meaning)).toBeNull();
    project = applyArchitectAnswer(project, question, meaning).project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-D06" && item.instanceKey === requirement.id)!;
    project = applyArchitectAnswer(project, question, { sourceKind: "existing", ownerElementId: owner.id }).project;
    const intent = project.architectSession!.parameterIntents[requirement.id];
    const parameter = project.elements.find((element) => element.id === owner.id)!.parameters.find((item) => item.id === intent.parameterId)!;
    expect(parameter).toMatchObject({ name: "Beverage throughput", semanticKey: "throughput", unit: "beverages/h" });
    expect(project.elements.find((element) => element.id === requirement.id)?.requirementFormula).toMatchObject({ expression: "@throughput >= 10" });
    expect(requirementHasSatisfaction(project, requirement.id)).toBe(true);
  });

  it("suggests a satisfying product component as parameter owner and reuses its matching parameter", () => {
    let project = createCoffeeMachineSampleProject();
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    const owner = project.elements.find((element) => element.elementType === "productComponent")!;
    const existing = {
      id: "existing-mass-parameter",
      ownerElementId: owner.id,
      name: "Mass",
      semanticKey: "mass",
      description: "Existing product mass.",
      dataType: "number" as const,
      value: 12,
      unit: "kg",
      valueOrigin: "entered" as const,
      applicableConfigurationIds: []
    };
    owner.parameters.push(existing);
    if (!project.relationships.some((relationship) => relationship.sourceId === requirement.id && relationship.targetId === owner.id && relationship.relationshipType === "satisfiedBy")) {
      project.relationships.push({ id: "suggest-owner", sourceId: requirement.id, targetId: owner.id, relationshipType: "satisfiedBy", createdAt: project.updatedAt, updatedAt: project.updatedAt });
    }
    let question = buildArchitectQuestions(project).find((item) => item.id === "AV-D04" && item.instanceKey === requirement.id)!;
    project = applyArchitectAnswer(project, question, "quantitative").project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-D05" && item.instanceKey === requirement.id)!;
    project = applyArchitectAnswer(project, question, { propertyName: "Mass", semanticKey: "mass", operator: "<=", target: 20, unit: "kg" }).project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-F03" && item.instanceKey === requirement.id)!;

    expect(question.options?.find((option) => option.id === owner.id)?.detail).toContain("Suggested");
    expect(projectedArchitectValue(project, question)).toBe(owner.id);
    const parameterCount = owner.parameters.filter((parameter) => parameter.semanticKey === "mass" && parameter.name === "Mass").length;
    project = applyArchitectAnswer(project, question, owner.id).project;
    const updatedOwner = project.elements.find((element) => element.id === owner.id)!;
    expect(updatedOwner.parameters.filter((parameter) => parameter.semanticKey === "mass" && parameter.name === "Mass")).toHaveLength(parameterCount);
    expect(project.architectSession?.parameterIntents[requirement.id].parameterId).toBe(existing.id);
  });

  it("creates process duration, resource quantity and verification evidence from structured answers", () => {
    let project = createCoffeeMachineSampleProject();
    const processFunction = project.elements.find((element) => element.elementType === "processFunction")!;
    const industrialComponent = project.elements.find((element) => element.elementType === "industrialSystemComponent")!;
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    let question = buildArchitectQuestions(project).find((item) => item.id === "AV-G06" && item.instanceKey === processFunction.id)!;
    project = applyArchitectAnswer(project, question, { duration: 12, durationUnit: "minute", source: "Time study", valueOrigin: "entered" }).project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-G09" && item.instanceKey === industrialComponent.id)!;
    project = applyArchitectAnswer(project, question, "Assembly technician").project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-G10" && item.instanceKey?.startsWith(`${industrialComponent.id}|`))!;
    project = applyArchitectAnswer(project, question, { quantity: 2, unit: "person", resourceType: "person", hourlyRate: 55, costUnit: "EUR/h", availabilityPercent: 85 }).project;
    question = buildArchitectQuestions(project).find((item) => item.id === "AV-H01" && item.instanceKey === requirement.id)!;
    project = applyArchitectAnswer(project, question, { category: "test", name: "Beverage performance test", description: "Measure the result.", allocatedProcessFunctionId: processFunction.id }).project;
    expect(project.elements.find((element) => element.id === processFunction.id)?.metadata.duration).toBe(12);
    expect(project.relationships).toContainEqual(expect.objectContaining({ sourceId: industrialComponent.id, relationshipType: "requiresResource", requiredQuantity: 2 }));
    const method = project.elements.find((element) => element.elementType === "verificationMethod" && element.name === "Beverage performance test")!;
    expect(project.relationships).toContainEqual(expect.objectContaining({ sourceId: method.id, targetId: requirement.id, relationshipType: "verifies" }));
    expect(project.relationships).toContainEqual(expect.objectContaining({ sourceId: method.id, targetId: processFunction.id, relationshipType: "allocatedTo" }));
  });

  it("exposes every Phase-1 section and reports targeted readiness links", () => {
    const project = createCoffeeMachineSampleProject();
    const ids = new Set(buildArchitectQuestions(project).map((item) => item.id));
    ["AV-B05", "AV-C05", "AV-D10", "AV-E02", "AV-E04", "AV-F06", "AV-G02", "AV-G06", "AV-G09", "AV-G10", "AV-G12", "AV-H01", "AV-H02", "AV-H04"].forEach((id) => expect(ids.has(id)).toBe(true));
    const readiness = architectReadiness(project);
    expect(readiness.blockingCount).toBeGreaterThan(0);
    expect(readiness.findings.some((finding) => finding.questionKey)).toBe(true);
  });

  it("validates requirement satisfaction from the requirement outward rather than requiring all four domains", () => {
    const project = createCoffeeMachineSampleProject();
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    const evidence = project.relationships.filter((relationship) => relationship.sourceId === requirement.id && relationship.relationshipType === "satisfiedBy");
    project.relationships = project.relationships.filter((relationship) => relationship.sourceId !== requirement.id || relationship.relationshipType !== "satisfiedBy" || relationship.id === evidence[0]?.id);
    requirement.requirementFormula = undefined;
    expect(requirementHasSatisfaction(project, requirement.id)).toBe(true);
    const findings = validateProject(project).filter((finding) => finding.affectedElementIds.includes(requirement.id));
    expect(findings.some((finding) => finding.ruleId === "PMA-120")).toBe(false);
    expect(findings.some((finding) => ["PMA-121", "PMA-122", "PMA-123"].includes(finding.ruleId))).toBe(false);
  });

  it("shows a completion screen after the final question and opens the stakeholder recap", () => {
    useAppStore.getState().resetEntireApplication("empty");
    useAppStore.getState().updateProject({ overallScope: "architectureBuilding" });
    useAppStore.getState().setPerspective("architect");
    const project = useAppStore.getState().projects[0];
    const finalQuestion = buildArchitectQuestions(project).at(-1)!;
    useAppStore.getState().setArchitectCurrentQuestion(finalQuestion.key);
    render(<App />);

    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm that this concise overview is accurate/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByRole("heading", { name: "Guided modelling finished with blocking issues" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Model Digital Thread" }));
    expect(screen.getByRole("heading", { name: "Model Digital Thread" })).toBeInTheDocument();
  });

  it("uses green, amber and red completion states without a manual refresh state", () => {
    const callbacks = { onBack: () => undefined, onOpenRecap: () => undefined, onOpenValidation: () => undefined };
    let project = createCoffeeMachineSampleProject();
    project.elements = project.elements.filter((element) => element.elementType !== "systemRequirement");
    project.architectSession = undefined;
    const { rerender } = render(<ArchitectCompletion project={project} readiness={{ status: "ready", findings: [], blockingCount: 0, warningCount: 0 }} {...callbacks} />);
    expect(screen.getByRole("heading", { name: "Guided modelling complete" })).toBeInTheDocument();
    expect(screen.getByText("The model is valid and all guided answers are reviewed.")).toBeInTheDocument();

    const question = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-A04")!;
    project = applyArchitectAnswer(project, question, "Provide useful service").project;
    project.architectSession!.answers[question.key].status = "needsReview";
    rerender(<ArchitectCompletion project={project} readiness={{ status: "outOfDate", findings: [{ id: `AVR-answer-${question.key}`, severity: "blocking", message: "Review the answer." }], blockingCount: 1, warningCount: 0 }} {...callbacks} />);
    expect(screen.getByRole("heading", { name: "Guided modelling finished with items to review" })).toBeInTheDocument();
    expect(screen.getByText(/overview already reflects the current model/i)).toBeInTheDocument();

    rerender(<ArchitectCompletion project={project} readiness={{ status: "blocked", findings: [{ id: "AVR-model", severity: "blocking", message: "Fix the model." }], blockingCount: 1, warningCount: 0 }} {...callbacks} />);
    expect(screen.getByRole("heading", { name: "Guided modelling finished with blocking issues" })).toBeInTheDocument();
    expect(screen.queryByText(/refresh/i)).not.toBeInTheDocument();
  });
});
