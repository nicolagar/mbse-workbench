import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { KpiFormulaBuilder } from "../components/KpiFormulaBuilder";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { dashboardWorkflow } from "../domain/dashboardWorkflow";
import { calculateSemanticScope } from "../domain/semanticScope";
import { analyzeSequence, sequenceFunctionHierarchy } from "../domain/sequences";
import { processHandoffStatus } from "../domain/processFlows";
import { runTraceableTradeStudy } from "../domain/tradeStudyMethodology";
import type { ModelElement, Relationship } from "../domain/types";
import { validateProject } from "../domain/validation";
import { useAppStore } from "../store/useAppStore";

const now = "2026-08-13T10:00:00.000Z";

function unrelatedObjective(): ModelElement {
  return {
    id: "objective-unrelated-review",
    elementType: "objective",
    name: "Unrelated review objective",
    description: "Must not leak into the active semantic scope.",
    status: "draft",
    architectureScope: "common",
    parameters: [],
    customAttributeValues: {},
    tags: ["unrelated"],
    metadata: {},
    createdAt: now,
    updatedAt: now
  };
}

describe("semantic scope and workflow rework", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());

  it("derives needs, objectives and requirements only through selected use-case stakeholders", () => {
    const project = createCoffeeMachineSampleProject();
    project.elements.push(unrelatedObjective());
    const scope = calculateSemanticScope(project);
    expect(scope.systemOfInterest?.name).toBe("Coffee Machine System");
    expect(new Set(scope.workingUseCases.map((useCase) => useCase.id))).toEqual(new Set(project.selectedUseCaseIds));
    expect(scope.objectives.map((objective) => objective.id)).not.toContain("objective-unrelated-review");
    expect(scope.requirements.length).toBeGreaterThan(0);
  });

  it("requires Mission and mission-to-stakeholder traceability in Problem Space Step 1", () => {
    const project = createCoffeeMachineSampleProject();
    project.elements = project.elements.filter((element) => element.elementType !== "mission");
    project.relationships = project.relationships.filter((relationship) => relationship.relationshipType !== "hasStakeholder");
    const step = dashboardWorkflow(project).problemSpace[0];
    expect(step.label).toBe("Define mission, system and intent");
    expect(step.status).not.toBe("complete");
    expect(step.message).toMatch(/mission/i);
    expect(step.activities.map((activity) => activity.label)).toContain("Mission");
  });

  it("exposes working-scope checkboxes and disables a use case outside the system-of-interest scope", () => {
    const project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    project.elements.push({
      id: "use-case-unrelated-review",
      elementType: "useCase",
      name: "Unrelated review use case",
      description: "",
      status: "draft",
      architectureScope: "common",
      parameters: [],
      customAttributeValues: {},
      tags: [],
      metadata: {},
      createdAt: now,
      updatedAt: now
    });
    const selectedName = project.elements.find((element) => element.id === project.selectedUseCaseIds[0])!.name;
    const store = useAppStore.getState();
    store.setWorkspace("model");
    store.setModelTab("mission-context");
    store.setModelView("table");
    store.setElementTypeFilter("useCase");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "More columns" }));
    expect(screen.getByLabelText(`Include ${selectedName} in working scope`)).toBeChecked();
    expect(screen.getByLabelText("Include Unrelated review use case in working scope")).toBeDisabled();
  });

  it("filters the Trade Study KPI objective selector to objectives selected in the study", () => {
    const project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    project.elements.push(unrelatedObjective());
    useAppStore.getState().setWorkspace("comparison");
    render(<App />);
    const createHeading = screen.getByRole("heading", { name: "Create and select KPI" });
    const createCard = createHeading.parentElement!;
    const objectiveSelector = within(createCard).getByRole("combobox", { name: "Objective measured" });
    expect(within(objectiveSelector).queryByRole("option", { name: "Unrelated review objective" })).not.toBeInTheDocument();
    project.comparisonStudies[0].objectiveIds.forEach((objectiveId) => {
      const name = project.elements.find((element) => element.id === objectiveId)?.name;
      expect(within(objectiveSelector).getByRole("option", { name })).toBeInTheDocument();
    });
  });
});

describe("coffee-machine product and manufacturing semantics", () => {
  it("models product technical components separately from the industrial system that manufactures them", () => {
    const project = createCoffeeMachineSampleProject();
    const names = (type: ModelElement["elementType"]) => project.elements
      .filter((element) => element.elementType === type)
      .map((element) => element.name);

    expect(names("productComponent")).toEqual(expect.arrayContaining([
      "Ingredient-handling module",
      "Brewing and heating module",
      "Beverage sensing module",
      "Integrated coffee machine",
      "Verified coffee machine"
    ]));
    expect(names("processFunction")).toEqual(expect.arrayContaining([
      "Manufacture coffee-machine modules",
      "Integrate coffee-machine modules",
      "Test completed coffee machine"
    ]));
    expect(names("industrialSystemComponent")).toEqual(expect.arrayContaining([
      "Module assembly workstation",
      "Coffee-machine integration cell",
      "End-of-line test station"
    ]));
    expect(names("processFunction")).not.toEqual(expect.arrayContaining([
      "Dose ingredients",
      "Extract beverage",
      "Check beverage"
    ]));
  });

  it("traces manufacturing equipment, product flows, and sequenced handoffs through canonical relationships", () => {
    const project = createCoffeeMachineSampleProject();
    const find = (name: string) => project.elements.find((element) => element.name === name)!;
    const manufacture = find("Manufacture coffee-machine modules");
    const integrate = find("Integrate coffee-machine modules");
    const test = find("Test completed coffee machine");
    const ingredientModule = find("Ingredient-handling module");
    const brewingModule = find("Brewing and heating module");
    const sensingModule = find("Beverage sensing module");
    const integratedMachine = find("Integrated coffee machine");

    expect(project.relationships).toContainEqual(expect.objectContaining({
      sourceId: manufacture.id,
      relationshipType: "realizedBy",
      targetId: find("Module assembly workstation").id
    }));
    [ingredientModule, brewingModule, sensingModule].forEach((component) => {
      expect(project.relationships).toContainEqual(expect.objectContaining({
        sourceId: manufacture.id,
        relationshipType: "produces",
        targetId: component.id,
        quantity: 1,
        unit: "module"
      }));
      expect(project.relationships).toContainEqual(expect.objectContaining({
        sourceId: integrate.id,
        relationshipType: "consumes",
        targetId: component.id,
        quantity: 1,
        unit: "module"
      }));
    });
    expect(project.relationships).toContainEqual(expect.objectContaining({
      sourceId: integrate.id,
      relationshipType: "produces",
      targetId: integratedMachine.id,
      unit: "machine"
    }));
    expect(project.relationships).toContainEqual(expect.objectContaining({
      sourceId: test.id,
      relationshipType: "consumes",
      targetId: integratedMachine.id,
      unit: "machine"
    }));

    const precedes = project.relationships.filter((relationship) =>
      relationship.relationshipType === "precedes"
      && [manufacture.id, integrate.id, test.id].includes(relationship.sourceId)
    );
    expect(precedes).toHaveLength(2);
    expect(precedes.every((relationship) => processHandoffStatus(project, relationship).complete)).toBe(true);
    expect(validateProject(project).filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("allocates required resources to realizing industrial-system components", () => {
    const project = createCoffeeMachineSampleProject();
    const byId = new Map(project.elements.map((element) => [element.id, element]));
    const assignments = project.relationships.filter((relationship) => relationship.relationshipType === "requiresResource");
    expect(assignments.length).toBeGreaterThan(0);
    assignments.forEach((assignment) => {
      expect(byId.get(assignment.sourceId)?.elementType).toBe("industrialSystemComponent");
      expect(byId.get(assignment.targetId)?.elementType).toBe("resource");
      expect(project.relationships.some((relationship) =>
        relationship.relationshipType === "realizedBy"
        && relationship.targetId === assignment.sourceId
        && byId.get(relationship.sourceId)?.elementType === "processFunction"
      )).toBe(true);
    });
    expect(project.relationships.some((relationship) =>
      relationship.relationshipType === "requiresResource"
      && byId.get(relationship.sourceId)?.elementType === "processFunction"
    )).toBe(false);
  });
});

describe("guided KPI formula construction", () => {
  it("finds a parameter by its own name and inserts its immutable token with owner context", () => {
    const project = createCoffeeMachineSampleProject();
    const owner = project.elements.find((element) => element.parameters.length > 0)!;
    const parameter = owner.parameters[0];
    const save = vi.fn();
    render(<KpiFormulaBuilder project={project} value="" onSave={save} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search formula parameters" }), { target: { value: parameter.name } });
    const result = screen.getByText(parameter.name, { selector: "strong" }).closest("button")!;
    expect(result).toHaveTextContent(owner.name);
    fireEvent.click(result);
    expect(screen.getByRole("textbox", { name: "KPI formula" })).toHaveValue(`param("${parameter.id}")`);
    expect(screen.getByText(new RegExp(`${owner.name} / ${parameter.name}`))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Validate and use formula" }));
    expect(save).toHaveBeenCalledWith(`param("${parameter.id}")`, expect.objectContaining({ parameterIds: [parameter.id] }));
  });

  it("blocks addition of model parameters with incompatible units before saving", () => {
    const project = createCoffeeMachineSampleProject();
    const parameters = project.elements.flatMap((element) => element.parameters);
    const throughput = parameters.find((parameter) => parameter.unit === "beverage/h")!;
    const mass = parameters.find((parameter) => parameter.unit === "kg")!;
    const save = vi.fn();
    render(<KpiFormulaBuilder project={project} value={`param("${throughput.id}") + param("${mass.id}")`} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Validate and use formula" }));
    expect(screen.getByText(/equal units/i)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("use-case-driven function sequences", () => {
  it("shows parents as context, exposes only leaf functions, and rejects parent sequence steps", () => {
    const project = createCoffeeMachineSampleProject();
    const sequence = project.functionSequences.find((candidate) => candidate.domain === "product")!;
    const parent = project.elements.find((element) => element.id === sequence.functionIds[0])!;
    const child: ModelElement = {
      ...structuredClone(parent),
      id: "product-function-review-leaf",
      name: "Review leaf function",
      parameters: [],
      createdAt: now,
      updatedAt: now
    };
    const refines: Relationship = {
      id: "relationship-review-refines",
      relationshipType: "refines",
      sourceId: child.id,
      targetId: parent.id,
      createdAt: now,
      updatedAt: now
    };
    project.elements.push(child);
    project.relationships.push(refines);
    const rows = sequenceFunctionHierarchy(project, sequence);
    expect(rows.find((row) => row.element.id === parent.id)).toMatchObject({ selectable: false, depth: 0 });
    expect(rows.find((row) => row.element.id === child.id)).toMatchObject({ selectable: true, depth: 1, parentId: parent.id });
    expect(analyzeSequence(project, sequence).errors.join(" ")).toMatch(/leaf functions/i);
  });

  it("creates an empty editor, selects one use case and updates the sequence as leaf functions are added", () => {
    const store = useAppStore.getState();
    const project = store.projects.find((candidate) => candidate.id === store.activeProjectId)!;
    project.functionSequences = project.functionSequences.filter((sequence) => sequence.domain !== "product");
    project.relationships = project.relationships.filter((relationship) => relationship.sequenceId !== "sequence-product-assembly");
    store.setWorkspace("model");
    store.setModelTab("product-functional");
    store.setModelView("diagram");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Create sequence" }));
    fireEvent.change(screen.getByPlaceholderText("Enter a sequence name"), { target: { value: "Use-case behavior" } });
    const useCase = calculateSemanticScope(project).workingUseCases.find((candidate) => project.relationships.some((relationship) =>
      relationship.sourceId === candidate.id
      && relationship.relationshipType === "hasFunction"
      && project.elements.find((element) => element.id === relationship.targetId)?.elementType === "productFunction"
    ))!;
    fireEvent.change(screen.getByRole("combobox", { name: "Sequence use case" }), { target: { value: useCase.id } });
    expect(screen.queryByRole("combobox", { name: /function level/i })).not.toBeInTheDocument();
    const sequence = useAppStore.getState().projects.find((candidate) => candidate.id === store.activeProjectId)!.functionSequences.find((candidate) => candidate.name === "Use-case behavior")!;
    const addFunction = screen.getAllByRole("checkbox", { name: /Add .* to sequence/ })[0];
    fireEvent.click(addFunction);
    const updated = useAppStore.getState().projects.find((candidate) => candidate.id === store.activeProjectId)!.functionSequences.find((candidate) => candidate.id === sequence.id)!;
    expect(updated.useCaseIds).toEqual([useCase.id]);
    expect(updated.functionIds).toHaveLength(1);
  });
});

describe("Trade Study execution scope validation", () => {
  it("rejects out-of-scope objectives and KPIs linked only to them", () => {
    const project = createCoffeeMachineSampleProject();
    const objective = unrelatedObjective();
    project.elements.push(objective);
    const kpi = { ...structuredClone(project.kpis[0]), id: "kpi-unrelated-review", name: "Unrelated KPI", objectiveIds: [objective.id] };
    project.kpis.push(kpi);
    const study = structuredClone(project.comparisonStudies[0]);
    study.objectiveIds.push(objective.id);
    study.selectedKpiIds = [kpi.id];
    const errors = runTraceableTradeStudy(project, study).errors.join(" ");
    expect(errors).toMatch(/outside the selected use-case stakeholder scope/i);
    expect(errors).toMatch(/must link to an eligible objective selected in this Trade Study/i);
  });
});
