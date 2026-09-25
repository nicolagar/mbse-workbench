import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { Dashboard } from "../components/Dashboard";
import { SimplifiedTradeStudyWorkspace } from "../components/SimplifiedTradeStudyWorkspace";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { VariabilityWorkspace } from "../components/VariabilityWorkspace";
import { DialogProvider } from "../components/dialogs/DialogProvider";
import { createOhscSampleProject } from "../data/ohscSample";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { configurationReadiness } from "../domain/configurationReadiness";
import { dashboardWorkflow } from "../domain/dashboardWorkflow";
import { modelSectionOrder, modelSections } from "../domain/modelViews";
import { validateProjectReferences } from "../domain/exportImport";
import { useAppStore } from "../store/useAppStore";

describe("Ontology feedback Rev01", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());

  it("stores canonical mission relationships for every sample system and external system", () => {
    [createCoffeeMachineSampleProject(), createOhscSampleProject()].forEach((project) => {
      const missions = new Set(project.elements.filter((item) => item.elementType === "mission").map((item) => item.id));
      const system = project.elements.find((item) => item.elementType === "system")!;
      const soiLinks = project.relationships.filter((relationship) => relationship.relationshipType === "hasSOI" && relationship.targetId === system.id);
      expect(soiLinks).toHaveLength(1);
      expect(missions.has(soiLinks[0].sourceId)).toBe(true);
      expect(system.metadata.missionId).toBeUndefined();
      const externalSystems = project.elements.filter((item) => item.elementType === "externalSystem");
      expect(externalSystems.length).toBeGreaterThan(0);
      externalSystems.forEach((external) => {
        const links = project.relationships.filter((relationship) => relationship.relationshipType === "participatesInMission" && relationship.targetId === external.id);
        expect(links).toHaveLength(1);
        expect(missions.has(links[0].sourceId)).toBe(true);
      });
      expect(validateProjectReferences(project)).toEqual([]);
    });
  }, 20_000);

  it("renders canonical mission links as normal stored relationships", () => {
    const ohsc = createOhscSampleProject();
    const mission = ohsc.elements.find((item) => item.elementType === "mission")!;
    const system = ohsc.elements.find((item) => item.elementType === "system")!;
    const external = ohsc.elements.find((item) => item.elementType === "externalSystem")!;
    render(<DialogProvider><TraceabilityMatrix
      elements={[mission, system, external]}
      relationships={ohsc.relationships}
      columnTypes={["system", "externalSystem"]}
    /></DialogProvider>);
    expect(screen.getByText("→ hasSOI")).toBeInTheDocument();
    expect(screen.getByText("→ participatesInMission")).toBeInTheDocument();
  });

  it("offers Model Digital Thread everywhere and the requirement overview only in its section", () => {
    modelSectionOrder.forEach((section) => expect(modelSections[section].availableViews).toContain("overview"));
    expect(modelSections["requirements-validation"].availableViews).toContain("requirementsOverview");
    modelSectionOrder.filter((section) => section !== "requirements-validation")
      .forEach((section) => expect(modelSections[section].availableViews).not.toContain("requirementsOverview"));

    const store = useAppStore.getState();
    store.setWorkspace("model");
    store.setModelTab("requirements-validation");
    store.setModelView("matrix");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Editable traceability matrix" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Requirements & Validation Overview" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Requirements & Validation Overview" }));
    expect(screen.getByRole("heading", { name: "Requirements & Validation Overview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Model Digital Thread" }));
    expect(screen.getByRole("heading", { name: "Model Digital Thread" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Complete modelling overview" })).toBeInTheDocument();
  });

  it("routes Dashboard Step 1 to the grouped context-entity table", () => {
    const project = createCoffeeMachineSampleProject();
    const activity = dashboardWorkflow(project).problemSpace[0].activities.find((item) => item.label.startsWith("System of interest"));
    expect(activity?.elementTypes).toEqual(["system", "stakeholder", "externalSystem"]);
    const store = useAppStore.getState();
    store.setElementTypeGroup(activity?.elementTypes);
    expect(useAppStore.getState().uiPreferences.activeElementTypes).toEqual(["system", "stakeholder", "externalSystem"]);
  });

  it("uses explicit Trade Study eligibility reasons and exposes resolved property effects", () => {
    const ohsc = createOhscSampleProject();
    const capacity = ohsc.configurations.find((item) => item.id === "CFG-B")!;
    expect(configurationReadiness(ohsc, capacity).eligibility).toBe("No — 1 requirement not met");

    const coffee = createCoffeeMachineSampleProject();
    useAppStore.setState({ projects: [coffee], activeProjectId: coffee.id, selectedConfigurationId: "configuration-balanced" });
    useAppStore.getState().setVariabilityTab("Configurator");
    render(<DialogProvider><VariabilityWorkspace /></DialogProvider>);
    expect(screen.getByRole("heading", { name: "Configuration Recap" })).toBeInTheDocument();
    expect(screen.getByText("Eligible for Trade-off Study")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Applied property values/i });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("removes the Dashboard study selector and lists focused requirements on separate rows", () => {
    const project = createOhscSampleProject();
    useAppStore.setState({ projects: [project], activeProjectId: project.id });
    useAppStore.getState().setDashboardContext("define-trade-study");
    const dashboard = render(<Dashboard />);
    expect(screen.queryByLabelText("Active Trade Study")).not.toBeInTheDocument();
    dashboard.unmount();

    render(<DialogProvider><SimplifiedTradeStudyWorkspace /></DialogProvider>);
    const list = screen.getByRole("list", { name: "Requirements highlighted by study focus" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(project.comparisonStudies[0].mandatoryRequirementIds.length);
    expect(screen.getByRole("heading", { name: "Reference baseline and retained requirements" })).toBeInTheDocument();
  });
});
