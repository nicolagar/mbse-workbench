import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { applyArchitectAnswer, architectAnswerComplete, architectQuestionValueError, architectReadiness, buildArchitectQuestions, projectedArchitectValue } from "../domain/architectView";
import { derivationStatus } from "../domain/derivation";
import { buildExportPackage, defaultExportFilters, parseExportPackage, serializeExportPackage } from "../domain/exportImport";
import { calculateSemanticScope } from "../domain/semanticScope";
import { migrateProject } from "../store/persistence";
import { useAppStore } from "../store/useAppStore";

describe("Architect feedback regression", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());

  it("treats the stakeholder answer as authoritative and removes stale stakeholder loops", () => {
    let project = createCoffeeMachineSampleProject();
    const stakeholders = project.elements.filter((element) => element.elementType === "stakeholder");
    const retained = stakeholders[0];
    const removedIds = new Set(stakeholders.slice(1).map((stakeholder) => stakeholder.id));
    const question = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-B01")!;
    project = applyArchitectAnswer(project, question, retained.name).project;

    expect(project.elements.filter((element) => element.elementType === "stakeholder").map((element) => element.id)).toEqual([retained.id]);
    expect(buildArchitectQuestions(project).filter((candidate) => candidate.instanceKey && removedIds.has(candidate.instanceKey))).toHaveLength(0);
    expect(project.relationships.some((relationship) => removedIds.has(relationship.sourceId) || removedIds.has(relationship.targetId))).toBe(false);
  });

  it("filters use-case needs and objectives by its participants and stores canonical addresses relationships", () => {
    let project = createCoffeeMachineSampleProject();
    const useCase = project.elements.find((element) => element.elementType === "useCase")!;
    const stakeholders = project.elements.filter((element) => element.elementType === "stakeholder");
    const system = stakeholders.find((stakeholder) => stakeholder.metadata.isSystemOfInterest) ?? stakeholders[0];
    const participant = stakeholders.find((stakeholder) => stakeholder.id !== system.id)!;
    const involvedStakeholderIds = [system.id, participant.id, useCase.metadata.subjectSystemId!];
    const participantNeeds = project.relationships.filter((relationship) => involvedStakeholderIds.includes(relationship.sourceId) && relationship.relationshipType === "hasNeed").map((relationship) => relationship.targetId);
    const participantObjectives = project.relationships.filter((relationship) => involvedStakeholderIds.includes(relationship.sourceId) && relationship.relationshipType === "hasObjective").map((relationship) => relationship.targetId);
    const involvement = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-C02" && candidate.instanceKey === useCase.id)!;
    project = applyArchitectAnswer(project, involvement, [system.id, participant.id]).project;

    const questions = buildArchitectQuestions(project);
    const needsQuestion = questions.find((candidate) => candidate.id === "AV-C03" && candidate.instanceKey === useCase.id)!;
    const eligibleIntentIds = [...participantNeeds, ...participantObjectives].sort();
    expect(needsQuestion.prompt).toContain("needs or objectives");
    expect(needsQuestion.options?.map((option) => option.id).sort()).toEqual(eligibleIntentIds);
    project = applyArchitectAnswer(project, needsQuestion, eligibleIntentIds).project;
    expect(project.relationships.filter((relationship) => relationship.sourceId === useCase.id && relationship.relationshipType === "addresses").map((relationship) => relationship.targetId).sort()).toEqual(eligibleIntentIds);
    project.selectedUseCaseIds = [useCase.id];
    const scopedIntentIds = [...calculateSemanticScope(project).needs, ...calculateSemanticScope(project).objectives].map((element) => element.id).sort();
    expect(scopedIntentIds).toEqual(eligibleIntentIds);
    expect(questions.find((candidate) => candidate.id === "AV-C04")?.options?.some((option) => option.id === useCase.id)).toBe(true);
  });

  it("collects separate authoritative values and sources from several KPI input owners", () => {
    let project = createCoffeeMachineSampleProject();
    project.overallScope = "architectureAndSimulation";
    project.kpis = [];
    project.elements.forEach((element) => { element.parameters = element.parameters.filter((parameter) => parameter.semanticKey !== "mass"); });
    project = applyArchitectAnswer(project, buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-I01")!, ["architect-kpi-totalMass"]).project;
    const question = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-I08" && candidate.instanceKey?.includes("semantic:mass"))!;
    const [first, second] = question.options!.slice(0, 2);
    const value = { propertyName: "Mass", semanticKey: "mass", owners: [
      { ownerElementId: first.id, value: 12, unit: "kg", source: "CAD mass properties", valueOrigin: "calculated" },
      { ownerElementId: second.id, value: 7, unit: "kg", source: "Supplier datasheet", valueOrigin: "entered" }
    ] };
    expect(architectQuestionValueError(question, value)).toBeNull();
    project = applyArchitectAnswer(project, question, value).project;
    expect(project.elements.find((element) => element.id === first.id)?.parameters).toContainEqual(expect.objectContaining({ semanticKey: "mass", value: 12, source: "CAD mass properties" }));
    expect(project.elements.find((element) => element.id === second.id)?.parameters).toContainEqual(expect.objectContaining({ semanticKey: "mass", value: 7, source: "Supplier datasheet" }));
  });

  it("prefills the sample quantitative interpretations from canonical requirement formulas", () => {
    const project = createCoffeeMachineSampleProject();
    const requirements = project.elements.filter((element) => element.elementType === "systemRequirement" && element.requirementFormula);
    expect(requirements.length).toBeGreaterThan(0);
    requirements.forEach((requirement) => {
      const questions = buildArchitectQuestions(project);
      const kindQuestion = questions.find((candidate) => candidate.id === "AV-D04" && candidate.instanceKey === requirement.id)!;
      const interpretationQuestion = questions.find((candidate) => candidate.id === "AV-D05" && candidate.instanceKey === requirement.id)!;
      expect(projectedArchitectValue(project, kindQuestion)).toBe("quantitative");
      expect(projectedArchitectValue(project, interpretationQuestion)).toEqual(expect.objectContaining({
        propertyName: expect.any(String),
        semanticKey: expect.stringMatching(/\S/),
        operator: expect.stringMatching(/^(<=|>=|==|!=|<|>|=)$/),
        target: expect.any(Number),
        unit: expect.stringMatching(/\S/)
      }));
    });
  });

  it("prefills sample use-case intent from canonical addresses relationships", () => {
    const project = createCoffeeMachineSampleProject();
    const useCase = project.elements.find((element) => element.elementType === "useCase" && project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "addresses"))!;
    const question = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-C03" && candidate.instanceKey === useCase.id)!;
    const expected = project.relationships.filter((relationship) => relationship.sourceId === useCase.id && relationship.relationshipType === "addresses").map((relationship) => relationship.targetId).sort();
    expect((projectedArchitectValue(project, question) as string[]).sort()).toEqual(expected);
  });

  it("loads the worked coffee-machine example as a complete zero-input Architect workflow", async () => {
    const project = useAppStore.getState().projects[0];
    const session = project.architectSession!;
    const questions = buildArchitectQuestions(project);
    const incomplete = questions.filter((question) => !architectAnswerComplete(question, session.answers[question.key]));

    expect(project.name).toBe("Configurable Coffee Machine Product Line");
    expect(incomplete.map((question) => question.key)).toEqual([]);
    expect(architectReadiness(project)).toEqual(expect.objectContaining({ status: "ready", blockingCount: 0, warningCount: 0 }));
    expect(session.status).toBe("ready");
    expect(session.completedAt).toBeTruthy();

    expect(session.answers["AV-T03"]?.value).toContain("Common Brew Control");
    expect(session.answers["AV-T04"]?.value).toContain("Brewing technology");
    expect(session.answers["AV-T05"]?.value).toHaveLength(3);
    expect(questions.filter((question) => question.sectionId === "traceability").every((question) => architectAnswerComplete(question, session.answers[question.key]))).toBe(true);
    expect(questions.filter((question) => ["variability", "configurations"].includes(question.sectionId)).every((question) => architectAnswerComplete(question, session.answers[question.key]))).toBe(true);

    expect(project.configurations).toHaveLength(3);
    project.configurations.forEach((configuration) => expect(derivationStatus(project, configuration)).toBe("Current"));
    const comparisonQuestion = questions.find((question) => question.id === "AV-L01")!;
    expect(comparisonQuestion.options).toHaveLength(3);
    expect(session.answers[comparisonQuestion.key]?.value).toHaveLength(3);

    useAppStore.getState().setPerspective("architect");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Guided modelling complete" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Architect progress" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("round-trips Architect answers, canonical intent links and requirement formulas through a complete project package", () => {
    let project = createCoffeeMachineSampleProject();
    const useCase = project.elements.find((element) => element.elementType === "useCase" && project.relationships.some((relationship) => relationship.sourceId === element.id && relationship.relationshipType === "addresses"))!;
    const question = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-C03" && candidate.instanceKey === useCase.id)!;
    const addressedIds = project.relationships.filter((relationship) => relationship.sourceId === useCase.id && relationship.relationshipType === "addresses").map((relationship) => relationship.targetId);
    project = applyArchitectAnswer(project, question, addressedIds).project;
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement" && element.requirementFormula)!;

    const raw = serializeExportPackage(buildExportPackage(project, defaultExportFilters()));
    const restored = parseExportPackage(raw, migrateProject);

    expect(restored.errors).toEqual([]);
    expect(restored.package?.project.architectSession?.answers[question.key]?.value).toEqual(addressedIds);
    expect(restored.package?.project.relationships.filter((relationship) => relationship.sourceId === useCase.id && relationship.relationshipType === "addresses").map((relationship) => relationship.targetId).sort()).toEqual([...addressedIds].sort());
    expect(restored.package?.project.elements.find((element) => element.id === requirement.id)?.requirementFormula).toEqual(requirement.requirementFormula);
  });

  it("exposes the requested low-level UI controls in Modeler view", () => {
    useAppStore.getState().setModelView("table");
    render(<App />);
    expect(screen.getByRole("button", { name: "Architect view" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Project actions"));
    expect(screen.getByRole("button", { name: "Load example" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collapse Project Workflow/ })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Model" }));
    expect(screen.getByRole("button", { name: "Add element" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add column" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model - Mission and Context" })).toHaveClass("text-[32px]");
    expect(screen.getByRole("button", { name: /Relationship editor/ })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Parameters and KPIs" }));
    fireEvent.click(screen.getByRole("button", { name: "Project units" }));
    const unitDialog = screen.getByRole("dialog", { name: "Unit catalogue" });
    expect(unitDialog).toBeInTheDocument();
    fireEvent.click(within(unitDialog).getByRole("button", { name: /Close/ }));

    fireEvent.click(screen.getByRole("button", { name: "Architecture Trade Study" }));
    expect(screen.getByRole("button", { name: "Project units" })).toBeInTheDocument();
  });

  it("loads OHSC from the shared chooser without changing project identity or other projects", () => {
    const store = useAppStore.getState();
    const activeProjectId = store.activeProjectId!;
    store.duplicateProject();
    const retainedProjectId = useAppStore.getState().activeProjectId!;
    const retainedProjectName = useAppStore.getState().projects.find((project) => project.id === retainedProjectId)!.name;
    useAppStore.getState().switchProject(activeProjectId);
    const snapshotIds = useAppStore.getState().snapshots.map((snapshot) => snapshot.id);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);
    fireEvent.click(screen.getByText("Project actions"));
    fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    const chooser = screen.getByRole("dialog", { name: "Load an example" });
    expect(within(chooser).getByRole("button", { name: /Coffee-machine product line/ })).toBeInTheDocument();
    fireEvent.click(within(chooser).getByRole("button", { name: /Aircraft OHSC product family/ }));

    const state = useAppStore.getState();
    const loaded = state.projects.find((project) => project.id === state.activeProjectId)!;
    expect(state.activeProjectId).toBe(activeProjectId);
    expect(loaded.name).toBe("Aircraft OHSC Product Family");
    expect(loaded.elements.filter((element) => element.elementType === "systemRequirement")).toHaveLength(30);
    expect(architectReadiness(loaded).status).toBe("ready");
    expect(state.projects.find((project) => project.id === retainedProjectId)?.name).toBe(retainedProjectName);
    expect(state.snapshots.map((snapshot) => snapshot.id)).toEqual(snapshotIds);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Aircraft OHSC product family"));
    confirm.mockRestore();
  }, 20_000);

  it("exposes project management controls in the Architect header", () => {
    useAppStore.getState().setPerspective("architect");
    render(<App />);
    fireEvent.click(screen.getByText("Project actions"));
    expect(screen.getByRole("button", { name: "Delete project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load example" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset all" })).toBeInTheDocument();
    expect(document.getElementById("architect-progress")?.className).toContain("md:top-[var(--architect-header-height)]");

    const projectCount = useAppStore.getState().projects.length;
    fireEvent.click(screen.getByRole("button", { name: "Duplicate project" }));
    expect(useAppStore.getState().projects).toHaveLength(projectCount + 1);
    expect(useAppStore.getState().projects.find((project) => project.id === useAppStore.getState().activeProjectId)?.name).toMatch(/Copy/);

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));
    expect(useAppStore.getState().uiPreferences.activePerspective).toBe("modeler");
    expect(useAppStore.getState().uiPreferences.activeWorkspace).toBe("export");
    expect(useAppStore.getState().uiPreferences.workflowFocus).toBe("delivery:save");
  });
});
