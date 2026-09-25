import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { ModelElement } from "../domain/types";
import { useAppStore } from "../store/useAppStore";

describe("application shell", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());
  afterEach(() => vi.restoreAllMocks());

  it("renders the editable Stage A sample dashboard", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Configurable Coffee Machine Product Line" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overall scope" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Problem Space" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Solution Space" })).toBeInTheDocument();
    const solutionSpace = screen.getByRole("region", { name: "Solution Space" });
    expect(within(solutionSpace).getByText("Map variability to architecture")).toBeInTheDocument();
    expect(within(solutionSpace).getByText("Simulate architectures")).toBeInTheDocument();
    expect(screen.getByText(/Preliminary engineering estimate/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main workspaces" })).toBeInTheDocument();
  });

  it("opens workflow steps in their contextual model view", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Build the 150% architecture/ }));
    fireEvent.click(screen.getByRole("button", { name: "Product functions" }));
    expect(screen.getByRole("heading", { name: "Model - Product Functional" })).toBeInTheDocument();
    expect(screen.getByText("Product-function architecture and hierarchy")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveValue("hierarchy");
    expect(screen.getByRole("combobox", { name: "Graph relationships" })).toHaveValue("structure");
    expect(screen.getByRole("combobox", { name: "Graph card detail" })).toHaveValue("compact");
    expect(screen.getByRole("button", { name: "Auto-arrange" })).toBeEnabled();
    expect(screen.getByText("Workflow task context")).toBeInTheDocument();
  });

  it("returns from an exact editor to the same workflow step", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Build the 150% architecture/ }));
    fireEvent.click(screen.getByRole("button", { name: "Product functions" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to workflow" }));
    expect(screen.getByRole("heading", { name: "Overall scope" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Build the 150% architecture" })).toHaveLength(2);
    expect(useAppStore.getState().uiPreferences.dashboardFocusedStepId).toBe("build-150-architecture");
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });

  it("creates, switches, duplicates and deletes named projects from the compact frame", async () => {
    render(<App />);
    const originalId = useAppStore.getState().activeProjectId!;
    fireEvent.click(screen.getByText("Project actions"));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    const nameDialog = screen.getByRole("dialog", { name: "Enter a value" });
    fireEvent.change(within(nameDialog).getByRole("textbox"), { target: { value: "Scope review project" } });
    fireEvent.click(within(nameDialog).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.getByText("Scope review project", { selector: "h1" })).toBeInTheDocument());
    expect(useAppStore.getState().projects).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate project" }));
    expect(useAppStore.getState().projects).toHaveLength(3);
    expect(useAppStore.getState().projects.find((project) => project.id === useAppStore.getState().activeProjectId)?.name).toMatch(/Copy/);
    fireEvent.change(screen.getByRole("combobox", { name: "Switch active project" }), { target: { value: originalId } });
    expect(useAppStore.getState().activeProjectId).toBe(originalId);
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const deleteDialog = screen.getByRole("dialog", { name: "Confirm" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(useAppStore.getState().projects).toHaveLength(2));
    expect(useAppStore.getState().projects.some((project) => project.id === originalId)).toBe(false);
  });

  it("exposes first-class project save and load actions backed by the validated project package", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Project actions"));
    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));
    expect(screen.getByRole("heading", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download project file" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Load Project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Saved project file")).toHaveAttribute("accept", expect.stringContaining(".json"));

    fireEvent.click(screen.getByRole("button", { name: "Project Workflow" }));
    fireEvent.click(screen.getByRole("button", { name: "Load Project" }));
    await waitFor(() => expect(screen.getByLabelText("Saved project file")).toHaveFocus());
  });

  it("opens workflow shortcuts directly from expandable left-navigation sections", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Problem Space/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Solution Space/ })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "Build the 150% architecture" }));
    expect(screen.getByRole("heading", { name: "Model - Product Functional" })).toBeInTheDocument();
    expect(screen.getByText("Product-function architecture and hierarchy")).toBeInTheDocument();
  });

  it("opens element properties from the Model Digital Thread", () => {
    useAppStore.getState().setWorkspace("model");
    useAppStore.getState().setModelTab("traceability");
    useAppStore.getState().setModelView("overview");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Model Digital Thread" })).toBeInTheDocument();
    const missionLinks = screen.getAllByRole("button", { name: "Deliver a configurable coffee experience" });
    fireEvent.click(missionLinks[0]);
    const editor = screen.getByRole("complementary", { name: "Element details" });
    expect(editor).toHaveTextContent("Mission");
    expect(within(editor).getByRole("heading", { name: "Deliver a configurable coffee experience" }).parentElement?.parentElement).toHaveClass("sticky", "top-0");
    fireEvent.change(within(editor).getByLabelText("Name"), { target: { value: "Updated coffee mission" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save element" }));
    expect(screen.queryByRole("complementary", { name: "Element details" })).not.toBeInTheDocument();
    expect(useAppStore.getState().projects[0].elements).toContainEqual(expect.objectContaining({ elementType: "mission", name: "Updated coffee mission" }));
  });

  it("opens the product input/output editor before a process sequence exists", () => {
    const store = useAppStore.getState();
    const project = store.projects.find((item) => item.id === store.activeProjectId)!;
    project.functionSequences = project.functionSequences.filter((sequence) => sequence.domain !== "process");
    store.setWorkspace("model");
    store.setModelTab("process-functional");
    store.setModelView("diagram");
    store.setWorkflowFocus("process-item-flows");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Product input/output flows" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Flow process function" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Flow product component" })).toBeInTheDocument();
    const processFunction = project.elements.find((element) => element.name === "Test completed coffee machine")!;
    const productComponent = project.elements.find((element) => element.name === "Verified coffee machine")!;
    fireEvent.change(screen.getByRole("combobox", { name: "Flow process function" }), { target: { value: processFunction.id } });
    fireEvent.change(screen.getByRole("combobox", { name: "Flow product component" }), { target: { value: productComponent.id } });
    fireEvent.click(screen.getByRole("button", { name: "Add product flow" }));
    const updated = useAppStore.getState().projects.find((item) => item.id === store.activeProjectId)!;
    const created = updated.relationships.find((relationship) =>
      relationship.sourceId === processFunction.id
      && relationship.targetId === productComponent.id
      && relationship.relationshipType === "consumes"
    )!;
    expect(created).toMatchObject({ quantity: 1, unit: "part" });
    const quantityField = screen.getByLabelText(`Quantity of ${created.id}`);
    fireEvent.change(quantityField, { target: { value: "3" } });
    fireEvent.click(within(quantityField.closest("tr")!).getByRole("button", { name: "Save" }));
    const saved = useAppStore.getState().projects
      .find((item) => item.id === store.activeProjectId)!
      .relationships.find((relationship) => relationship.id === created.id);
    expect(saved?.quantity).toBe(3);
  });

  it("shows an unlinked newly created function in the product matrix", () => {
    const now = new Date().toISOString();
    const element: ModelElement = {
      id: "review-unlinked-function",
      elementType: "productFunction",
      name: "Unlinked review function",
      description: "",
      status: "draft",
      architectureScope: "common",
      parameters: [],
      customAttributeValues: {},
      tags: [],
      metadata: {},
      createdAt: now,
      updatedAt: now
    };
    useAppStore.getState().addElement(element);
    useAppStore.getState().setWorkspace("model");
    useAppStore.getState().setModelTab("product-functional");
    useAppStore.getState().setModelView("matrix");
    render(<App />);
    expect(screen.getByRole("button", { name: "Unlinked review function" })).toBeInTheDocument();
    expect(screen.getByText("Product function · outside working scope")).toBeInTheDocument();
  });

  it("removes incompatible precedence links without rewriting function hierarchy", () => {
    const store = useAppStore.getState();
    const project = store.projects.find((item) => item.id === store.activeProjectId)!;
    const sequence = project.functionSequences.find((item) => item.domain === "product")!;
    const retainedFunctionId = sequence.functionIds[0];
    const refinesBefore = project.relationships.filter((relationship) => relationship.relationshipType === "refines");
    store.updateFunctionSequence(sequence.id, { functionIds: [retainedFunctionId] });
    const updated = useAppStore.getState().projects.find((item) => item.id === store.activeProjectId)!;
    expect(updated.relationships.filter((relationship) => relationship.sequenceId === sequence.id)).toEqual([]);
    expect(updated.relationships.filter((relationship) => relationship.relationshipType === "refines")).toEqual(refinesBefore);
  });

  it("binds a nested parameter and reuses canonical owner satisfaction", () => {
    const store = useAppStore.getState();
    const project = store.projects.find((item) => item.id === store.activeProjectId)!;
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    const owner = project.elements.find((element) => element.elementType === "productComponent")!;
    const parameter = {
      id: "parameter-review-binding",
      ownerElementId: owner.id,
      name: "Review binding parameter",
      semanticKey: "review_binding_parameter",
      description: "Parameter added to verify nested parameter traceability.",
      dataType: "number" as const,
      value: 42,
      unit: "kg",
      valueOrigin: "entered" as const,
      applicableConfigurationIds: []
    };
    store.addParameter(owner.id, parameter);
    expect(store.bindRequirementParameter(requirement.id, parameter.id)).toBeNull();
    const updated = useAppStore.getState().projects.find((item) => item.id === store.activeProjectId)!;
    const updatedRequirement = updated.elements.find((element) => element.id === requirement.id)!;
    expect(updatedRequirement.requirementFormula?.bindings).toContainEqual(expect.objectContaining({
      kind: "parameter",
      targetId: parameter.id
    }));
    expect(updated.relationships).toContainEqual(expect.objectContaining({
      sourceId: requirement.id,
      targetId: owner.id,
      relationshipType: "satisfiedBy"
    }));
  });

  it("opens the functional Stage-B variability workspace", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Variability" }));
    expect(screen.getByRole("heading", { name: "Variability" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feature model" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Configurator" }));
    expect(screen.getAllByText("Essential Capsule").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("combobox", { name: "Saved configuration" }), { target: { value: "configuration-manual" } });
    expect(screen.getByRole("button", { name: "Derive 100% model" })).toBeInTheDocument();
  });

  it("changes scope and recalculates the visible workflow", () => {
    render(<App />);
    expect(within(screen.getByRole("region", { name: "Solution Space" })).getByText("Map variability to architecture")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Architecture building \+ simulation/ }));
    expect(screen.queryByText("Map variability to architecture")).not.toBeInTheDocument();
    const solutionSpace = screen.getByRole("region", { name: "Solution Space" });
    expect(within(solutionSpace).getByText("Complete architecture parameters")).toBeInTheDocument();
    expect(within(solutionSpace).getByText("Simulate architecture")).toBeInTheDocument();
  });

  it("creates and cancels features through an explicit side-editor draft", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Variability" }));
    const originalCount = useAppStore.getState().projects[0].features.length;
    fireEvent.click(screen.getByRole("button", { name: "Feature" }));
    const editor = screen.getByRole("complementary", { name: "New feature editor" });
    fireEvent.change(within(editor).getByLabelText("Name"), { target: { value: "Review-side-editor feature" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save" }));
    expect(useAppStore.getState().projects[0].features).toContainEqual(expect.objectContaining({ name: "Review-side-editor feature" }));

    fireEvent.click(screen.getByRole("button", { name: "Feature" }));
    fireEvent.change(screen.getByRole("complementary", { name: "New feature editor" }).querySelector("input")!, { target: { value: "Discarded draft" } });
    fireEvent.click(within(screen.getByRole("complementary", { name: "New feature editor" })).getByRole("button", { name: "Cancel" }));
    expect(useAppStore.getState().projects[0].features).toHaveLength(originalCount + 1);
  });

  it("opens the structured variation-point editor and remembers graph filters", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Variability" }));
    fireEvent.click(screen.getByRole("button", { name: "Variation Points" }));
    fireEvent.click(screen.getByLabelText("Mission and Context"));
    expect(useAppStore.getState().uiPreferences.variationGraphSections).toContain("mission-context");
    fireEvent.click(screen.getByRole("button", { name: "Variation point" }));
    const editor = screen.getByRole("complementary", { name: "New variation point editor" });
    expect(within(editor).getByText("ImpactedByFeature")).toBeInTheDocument();
    expect(within(editor).getByText("Impacted feature value(s)")).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "AND" })).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
  });

  it("creates configurations through the side editor and generates the paired architecture", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Variability" }));
    fireEvent.click(screen.getByRole("button", { name: "Configurator" }));
    fireEvent.click(screen.getByRole("button", { name: "New configuration" }));
    const editor = screen.getByRole("complementary", { name: "New configuration editor" });
    fireEvent.change(within(editor).getByLabelText("Configuration name"), { target: { value: "Review configuration" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save" }));
    const project = useAppStore.getState().projects[0];
    const configuration = project.configurations.find((candidate) => candidate.name === "Review configuration");
    expect(configuration).toBeDefined();
    expect(project.architectures.find((architecture) => architecture.id === configuration?.architectureId)?.name).toBe("Review configuration");
  });

  it("opens engineering inputs and searchable exact-token formula editing", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Parameters and KPIs" }));
    expect(screen.getByText("Engineering input table")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "KPI definitions" }));
    const formulaCard = screen.getByText("Beverage throughput KPI").closest("article")!;
    fireEvent.click(within(formulaCard).getByRole("button", { name: "Edit metadata" }));
    expect(screen.getByPlaceholderText("Search parameters and KPIs")).toBeInTheDocument();
    expect(screen.getByText(/Formula editor · Beverage throughput KPI/)).toBeInTheDocument();
  });

  it("opens simulation controls and read-only history", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Simulation" }));
    expect(screen.getByRole("heading", { name: "Simulation" })).toBeInTheDocument();
    expect(screen.getByText("Prepare run")).toBeInTheDocument();
    expect(screen.getByText("Read-only run history")).toBeInTheDocument();
  });

  it("runs architecture-and-simulation scope without requiring a configuration", async () => {
    const active = useAppStore.getState().projects[0];
    const totalMass = active.kpis.find((kpi) => kpi.standardAlgorithmKey === "totalMass")!;
    useAppStore.setState({
      projects: [{ ...active, overallScope: "architectureAndSimulation", configurations: [], kpis: [totalMass] }],
      uiPreferences: { ...useAppStore.getState().uiPreferences, activePerspective: "modeler", activeWorkspace: "simulation" }
    });
    const before = useAppStore.getState().projects[0].simulationRuns.length;
    render(<App />);

    expect(screen.getByRole("radio", { name: "Configured 100% model" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Current architecture · no configuration required" })).toBeChecked();
    expect(screen.queryByRole("option", { name: "Select a configuration" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Validate and run" }));
    await waitFor(() => {
      const acknowledgeButton = screen.queryByRole("button", { name: "Acknowledge" });
      if (acknowledgeButton) fireEvent.click(acknowledgeButton);
      expect(useAppStore.getState().projects[0].simulationRuns).toHaveLength(before + 1);
    });
    const runs = useAppStore.getState().projects[0].simulationRuns;
    expect(runs.at(-1)?.configurationId).toBeUndefined();
    expect(runs.at(-1)?.results).toContainEqual(expect.objectContaining({ name: totalMass.name, value: expect.any(Number) }));
    expect(screen.queryByText(/Select an active saved configuration/)).not.toBeInTheDocument();
  });

  it("opens the Architecture Trade Study workflow and saved sample evidence", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Architecture Trade Study" }));
    expect(screen.getByRole("heading", { level: 1, name: "Architecture Trade Study" })).toBeInTheDocument();
    expect(screen.getAllByText("Coffee-machine architecture selection").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "1. Define study" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "2. Compare" }));
    expect(screen.getByRole("heading", { name: "Feasibility and ranking" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run comparison" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "3. Decide" }));
    expect(screen.getByRole("heading", { name: "Decision and rationale" })).toBeInTheDocument();
  });

  it("uses guided Problem Space setup and defers alternatives to Compare and decide", () => {
    useAppStore.getState().setWorkspace("comparison");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Variability axes and feature-model foundation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evaluation KPIs" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select configuration-derived alternatives" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "2. Compare" }));
    expect(screen.getByRole("heading", { name: "Select configuration-derived alternatives" })).toBeInTheDocument();
  });

  it("opens direct Trade Study framing and the expert evidence ledger", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Architecture Trade Study" }));
    expect(screen.getByRole("heading", { name: "Decision question" })).toBeInTheDocument();
    expect(screen.getByLabelText("Decision question")).toHaveValue(
      "Which coffee-machine architecture should become the product-line baseline?"
    );
    expect(screen.getByRole("heading", { name: "Evaluation KPIs" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expert view" }));
    fireEvent.click(screen.getByRole("tab", { name: "2. Inspect evidence" }));
    expect(screen.getByRole("heading", { name: "Expert evidence ledger" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requirement evidence" })).toBeInTheDocument();
  });

  it("opens save/load, snapshot, selective export, PDF, and demo delivery tabs", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("heading", { name: "Snapshots and Delivery" })).toBeInTheDocument();
    expect(screen.getByText("Basic local snapshots — not enterprise version control.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Save / Load Project" }));
    expect(screen.getByRole("heading", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Load Project" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Selective Export" }));
    expect(screen.getByRole("heading", { name: "Shared JSON/XLSX scope" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "PDF Report" }));
    expect(screen.getByRole("heading", { name: "PDF report scope" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Demo Checklist" }));
    expect(screen.getByRole("heading", { name: "In-app demo checklist" })).toBeInTheDocument();
  });
});
