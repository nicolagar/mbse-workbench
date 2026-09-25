import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ArchitectView } from "../components/ArchitectView";
import { ProjectRecapWorkspace } from "../components/ProjectRecapWorkspace";
import { SectionRecap } from "../components/SectionRecap";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { VariabilityWorkspace } from "../components/VariabilityWorkspace";
import { DialogProvider } from "../components/dialogs/DialogProvider";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { createColdChainSimulationExample, createEmergencyLightingExample } from "../data/scopeExamples";
import { contextConnections } from "../domain/contextConnections";
import { withCanonicalArchitectAnswers } from "../domain/architectView";
import { modelSectionOrder, modelSections } from "../domain/modelViews";
import type { ModelElement } from "../domain/types";
import { useAppStore } from "../store/useAppStore";

describe("version 1.8 usability feedback", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());

  it("keeps Interfaces and Traceability separate and gives every section a recap", () => {
    expect(modelSectionOrder).toEqual([
      "mission-context", "requirements-validation", "product-functional", "product-technical",
      "process-functional", "process-technical", "interfaces", "traceability"
    ]);
    expect(modelSections.interfaces.tableTypes).toEqual(["productInterface", "processInterface"]);
    expect(modelSections.traceability.projectionTypes.length).toBeGreaterThan(modelSections.interfaces.projectionTypes.length);
    modelSectionOrder.forEach((tab) => expect(modelSections[tab].availableViews).toContain("sectionRecap"));
  });

  it("filters a sticky traceability matrix by element stereotype and connected relationship type", () => {
    const project = createCoffeeMachineSampleProject();
    useAppStore.setState({ projects: [project], activeProjectId: project.id });
    render(<DialogProvider><TraceabilityMatrix
      elements={project.elements}
      relationships={project.relationships}
      contextRelationships={contextConnections(project)}
      columnTypes={["systemRequirement", "productFunction"]}
    /></DialogProvider>);
    const table = screen.getByRole("table", { name: "Editable traceability matrix" });
    const processFunctionCount = project.elements.filter((element) => element.elementType === "processFunction").length;
    fireEvent.change(screen.getByLabelText("Filter selected elements"), { target: { value: "Process Function" } });
    expect(within(table).getAllByRole("row")).toHaveLength(processFunctionCount + 1);
    fireEvent.change(screen.getByLabelText("Filter selected elements"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter connected System requirement"), { target: { value: "satisfiedBy" } });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    expect(within(table).getAllByRole("row").length).toBeLessThan(project.elements.length + 1);
    expect(screen.getByText(/of .* rows/)).toBeInTheDocument();
  });

  it("derives section expectations from newly added model content", () => {
    const project = createEmergencyLightingExample();
    const now = new Date().toISOString();
    const unallocated: ModelElement = {
      id: "PF-UNALLOCATED", elementType: "productFunction", name: "Signal maintenance need", description: "",
      status: "draft", architectureScope: "common", parameters: [], customAttributeValues: {}, tags: [], metadata: {}, createdAt: now, updatedAt: now
    };
    project.elements.push(unallocated);
    render(<SectionRecap project={project} tab="product-technical" />);
    const obligation = screen.getByText("Functions realized").closest("div")!;
    expect(obligation).toHaveTextContent("3/4");
    expect(obligation).toHaveTextContent("Each product function identifies its realizing component");
  });

  it("shows feature groups and their cardinality in the configuration hierarchy", () => {
    const project = createCoffeeMachineSampleProject();
    useAppStore.setState({ projects: [project], activeProjectId: project.id, selectedConfigurationId: project.configurations[0].id });
    useAppStore.getState().setVariabilityTab("Configurator");
    render(<DialogProvider><VariabilityWorkspace /></DialogProvider>);
    expect(screen.getByRole("heading", { name: "Feature selection hierarchy" })).toBeInTheDocument();
    expect(screen.getAllByText("Choose exactly one (XOR)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coffee input system").length).toBeGreaterThan(0);
  });

  it("keeps Project Recap scope-aware and Architect graph detail intentionally compact", () => {
    const architecture = createEmergencyLightingExample();
    const { rerender, unmount } = render(<ProjectRecapWorkspace project={architecture} />);
    expect(screen.getByRole("heading", { name: "Project Recap" })).toBeInTheDocument();
    expect(screen.queryByText("Decision", { selector: "div" })).not.toBeInTheDocument();
    const simulated = createColdChainSimulationExample();
    rerender(<ProjectRecapWorkspace project={simulated} />);
    expect(screen.getByText(/baseline simulation/)).toBeInTheDocument();
    unmount();

    const coffee = withCanonicalArchitectAnswers(createCoffeeMachineSampleProject());
    coffee.architectSession!.completedAt = undefined;
    coffee.architectSession!.currentQuestionKey = Object.keys(coffee.architectSession!.answers).at(-1);
    useAppStore.setState({ projects: [coffee], activeProjectId: coffee.id });
    render(<DialogProvider><ArchitectView /></DialogProvider>);
    expect(screen.getByRole("heading", { name: "Model created so far" })).toBeInTheDocument();
    expect(screen.getByText(/semantic left-to-right digital thread/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Graph card detail")).not.toBeInTheDocument();
  });
});
