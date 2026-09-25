import { ReactFlow } from "@xyflow/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureGraph } from "../components/FeatureGraph";
import { DialogProvider } from "../components/dialogs/DialogProvider";
import {
  calculateWorkflowSelection,
  crossAreaConnections,
  workflowConnections,
  workflowAreaForElementType,
  workflowAreas
} from "../components/GraphReadabilityOverview";
import { ModelGraph } from "../components/ModelGraph";
import { ModelGraphNode, type MeasuredGraphNodeData } from "../components/MeasuredGraphNodes";
import { routePath, RoutedEdgeLabel } from "../components/RoutedEdge";
import { TradeStudyOntologyView } from "../components/TradeStudyOntologyView";
import { useAppStore } from "../store/useAppStore";

describe("measured semantic graph components", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());

  it("renders the Feature Model through dedicated measured nodes and explicit ports", async () => {
    render(<DialogProvider><FeatureGraph readOnly /></DialogProvider>);

    expect(screen.getByLabelText("Feature model graph")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Feature graph presentation" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Feature graph layout" })).toHaveValue("automatic");
    await waitFor(() => expect(screen.getAllByTestId("feature-graph-node").length).toBeGreaterThan(0));
    expect(screen.getAllByLabelText(/Incoming top port for Feature:/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Outgoing bottom port for Feature:/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("featureGroup-graph-node").length).toBeGreaterThan(0);
  });

  it("renders the Trade Study ontology through dedicated measured nodes and routed evidence bands", async () => {
    const project = useAppStore.getState().projects[0];
    render(<TradeStudyOntologyView study={project.comparisonStudies[0]} />);

    expect(screen.getByRole("heading", { name: "Ontology and digital thread" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Typed relationship table" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId("ontology-graph-node").length).toBeGreaterThan(0));
    expect(screen.getAllByLabelText(/Incoming top port for/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Outgoing bottom port for/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Secondary cross-links")).not.toBeChecked();
  });

  it("reports the rendered DOM card dimensions back to the layout owner", async () => {
    const onMeasure = vi.fn();
    const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 241,
      height: 119,
      x: 0,
      y: 0,
      top: 0,
      right: 241,
      bottom: 119,
      left: 0,
      toJSON: () => ({})
    });
    const data: MeasuredGraphNodeData = {
      content: <span>Measured node</span>,
      accessibleLabel: "Measured model node",
      width: 225,
      minimumHeight: 82,
      variant: "model",
      borderColor: "#64748b",
      background: "white",
      onMeasure
    };

    render(<div style={{ width: 600, height: 400 }}><ReactFlow
      nodes={[{ id: "measured", type: "modelGraphNode", position: { x: 0, y: 0 }, data }]}
      edges={[]}
      nodeTypes={{ modelGraphNode: ModelGraphNode }}
    /></div>);

    await waitFor(() => expect(onMeasure).toHaveBeenCalledWith("measured", { width: 241, height: 119 }));
    expect(screen.getByLabelText("Incoming top port for Measured model node")).toBeInTheDocument();
    expect(screen.getByLabelText("Outgoing right port for Measured model node")).toBeInTheDocument();
    bounds.mockRestore();
  });

  it("keeps Model node positions stable across Primary, All and Selected relationship views", async () => {
    const project = useAppStore.getState().projects[0];
    const ids = new Set(project.elements.map((element) => element.id));
    const relationships = project.relationships.filter((relationship) =>
      ids.has(relationship.sourceId) && ids.has(relationship.targetId));
    const { container } = render(<DialogProvider><ModelGraph
      elements={project.elements}
      relationships={relationships}
      readOnly
      heightClass="h-[500px]"
    /></DialogProvider>);
    fireEvent.change(screen.getByRole("combobox", { name: "Graph presentation" }), { target: { value: "canvas" } });
    const nodeId = project.elements[0].id;
    const transform = () => container.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`)?.style.transform;
    await waitFor(() => expect(transform()).toMatch(/translate/));
    const initial = transform();

    fireEvent.change(screen.getByRole("combobox", { name: "Graph relationships" }), { target: { value: "all" } });
    expect(transform()).toBe(initial);
    fireEvent.click(container.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`)!);
    expect(useAppStore.getState().selectedElementId).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Graph relationships" }), { target: { value: "selection" } });
    expect(transform()).toBe(initial);
  });

  it("uses the same Feature Model coordinates when a Configurator selection is shown", async () => {
    const project = useAppStore.getState().projects[0];
    const featureId = project.features[0].id;
    const { container, rerender } = render(<DialogProvider><FeatureGraph readOnly /></DialogProvider>);
    const transform = () => container.querySelector<HTMLElement>(`.react-flow__node[data-id="${featureId}"]`)?.style.transform;
    await waitFor(() => expect(transform()).toMatch(/translate/));
    const base = transform();
    rerender(<DialogProvider><FeatureGraph readOnly configuration={project.configurations[0]} /></DialogProvider>);
    expect(transform()).toBe(base);
  });

  it("uses V04 Full graph only for variability projections", async () => {
    const project = useAppStore.getState().projects[0];
    const survivor = project.elements[Math.min(2, project.elements.length - 1)];
    const realized = project.elements.filter((element) => element.id === survivor.id);
    render(<DialogProvider><div>
      <ModelGraph
        elements={project.elements}
        relationships={project.relationships}
        workflowOverview={false}
        readOnly
        heightClass="h-[420px]"
      />
      <ModelGraph
        elements={realized}
        relationships={[]}
        workflowOverview={false}
        readOnly
        heightClass="h-[420px]"
      />
    </div></DialogProvider>);
    expect(screen.queryByRole("combobox", { name: "Graph presentation" })).not.toBeInTheDocument();
    expect(screen.queryByText("Workflow overview")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Model navigation graph")).toHaveLength(2);
  });

  it("expands a routed relationship label without changing route or node geometry", async () => {
    const points = [{ x: 225, y: 40 }, { x: 300, y: 40 }, { x: 300, y: 200 }, { x: 400, y: 200 }];
    const geometry = routePath(points);
    const { container } = render(<div>
      <div data-testid="node-a" style={{ transform: "translate(0px, 0px)" }} />
      <div data-testid="node-b" style={{ transform: "translate(400px, 160px)" }} />
      <RoutedEdgeLabel edgeId="edge" label="satisfiedBy" position={{ x: 300, y: 120 }} primary />
    </div>);
    const beforeNodes = ["node-a", "node-b"].map((id) =>
      screen.getByTestId(id).getAttribute("style"));
    expect(screen.queryByText("satisfiedBy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show relationship label: satisfiedBy" }));
    expect(screen.getByText("satisfiedBy")).toBeInTheDocument();
    expect(routePath(points)).toBe(geometry);
    expect(["node-a", "node-b"].map((id) =>
      screen.getByTestId(id).getAttribute("style"))).toEqual(beforeNodes);
    expect(container.querySelector('[aria-label="Hide relationship label: satisfiedBy"]')).toBeInTheDocument();
  });

  it("opens dense Model workspaces as the selectable workflow overview without element focus", async () => {
    const project = useAppStore.getState().projects[0];
    render(<DialogProvider><ModelGraph elements={project.elements} relationships={project.relationships} readOnly heightClass="h-[500px]" /></DialogProvider>);

    expect(screen.queryByRole("heading", { name: "Selectable workflow overview" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mission" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System of Interest" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requirements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full screen" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Element focus" })).not.toBeInTheDocument();
    expect(screen.getByTestId("workflow-overview-surface").querySelectorAll(":scope > svg > path")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /relationship label/i })).not.toBeInTheDocument();
    const first = project.elements.find((element) => element.elementType === "stakeholder")!;
    fireEvent.click(screen.getByRole("button", { name: `Select ${first.name}` }));
    expect(screen.getByLabelText(`Directly selected: ${first.name}`)).toBeInTheDocument();
    expect(screen.getByTestId("workflow-overview-surface").querySelectorAll(":scope > svg > path")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: `Expand downstream from ${first.name}` }));
    await waitFor(() => expect(screen.getByTestId("workflow-overview-surface").querySelectorAll(":scope > svg > path").length).toBeGreaterThan(0));
    expect(useAppStore.getState().selectedElementId).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Graph presentation" }), { target: { value: "canvas" } });
    expect(screen.queryByTestId("workflow-overview-surface")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Graph presentation" }), { target: { value: "overview" } });
    expect(screen.getByLabelText(`Directly selected: ${first.name}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByLabelText(`Directly selected: ${first.name}`)).not.toBeInTheDocument();
  });

  it("keeps every environment in the overview when a workspace graph supplies a small projection", () => {
    const project = useAppStore.getState().projects[0];
    render(<DialogProvider><ModelGraph elements={project.elements.filter((element) => element.elementType === "stakeholder")} relationships={[]} workflowOverview /></DialogProvider>);
    fireEvent.change(screen.getByRole("combobox", { name: "Graph presentation" }), { target: { value: "overview" } });
    expect(screen.getByTestId("workflow-overview-surface").querySelectorAll("[data-overview-element]")).toHaveLength(project.elements.length);
    expect(screen.queryByRole("button", { name: /^Select .*Mission/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand selected downstream in Context" })).toBeDisabled();
  });

  it("opens properties from a double click and provides zoom in full screen", async () => {
    const project = useAppStore.getState().projects[0];
    render(<DialogProvider><ModelGraph elements={project.elements} relationships={project.relationships} /></DialogProvider>);
    const stakeholder = project.elements.find((element) => element.elementType === "stakeholder")!;
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: `Select ${stakeholder.name}` }));
    await waitFor(() => expect(useAppStore.getState().selectedElementId).toBe(stakeholder.id));
  });

  it("uses only actual cross-area relationships for requirement satisfaction and item flow", () => {
    const project = useAppStore.getState().projects[0];
    const req = project.elements.find((element) => element.elementType === "systemRequirement")!;
    const product = project.elements.find((element) => element.elementType === "productComponent")!;
    const process = project.elements.find((element) => element.elementType === "processFunction")!;
    const method = project.elements.find((element) => element.elementType === "verificationMethod")!;
    const unrelated = project.elements.find((element) => element.elementType === "productFunction")!;
    const connections = workflowConnections(project.elements, [
      { id: "satisfied", sourceId: req.id, targetId: product.id, relationshipType: "satisfiedBy" },
      { id: "realized", sourceId: unrelated.id, targetId: product.id, relationshipType: "realizedBy" },
      { id: "consumed", sourceId: process.id, targetId: product.id, relationshipType: "consumes" },
      { id: "verified", sourceId: method.id, targetId: req.id, relationshipType: "verifies" }
    ]);
    const fromRequirement = calculateWorkflowSelection(project.elements, connections, [{ elementId: req.id, direction: "downstream" }]);
    expect(fromRequirement.visibleConnectionIds.has("satisfied")).toBe(true);
    expect(fromRequirement.visibleConnectionIds.has("verified")).toBe(true);
    expect(fromRequirement.visibleConnectionIds.has("realized")).toBe(false);
    expect(fromRequirement.reachedElementIds.has(unrelated.id)).toBe(false);
    expect(connections.find((connection) => connection.id === "consumed")).toMatchObject({ sourceId: product.id, targetId: process.id });
    expect(calculateWorkflowSelection(project.elements, connections, [{ elementId: process.id, direction: "upstream" }]).visibleConnectionIds.has("consumed")).toBe(true);
  });

  it("keeps only cross-area relationships in deterministic workflow traversal", () => {
    const project = useAppStore.getState().projects[0];
    const eligible = crossAreaConnections(project.elements, project.relationships);
    eligible.forEach((relationship) => {
      const source = project.elements.find((element) => element.id === relationship.sourceId)!;
      const target = project.elements.find((element) => element.id === relationship.targetId)!;
      expect(workflowAreaForElementType(source.elementType)).not.toBe(workflowAreaForElementType(target.elementType));
    });
    expect(workflowAreas.map((area) => area.id)).toEqual([
      "mission", "system", "context", "intent", "useCases", "productFunctions", "productArchitecture",
      "processFunctions", "industrialArchitecture", "resources", "verification", "requirements"
    ]);

    const connection = eligible[0];
    expect(connection).toBeDefined();
    const selection = calculateWorkflowSelection(project.elements, project.relationships, [
      { elementId: connection.sourceId, direction: "downstream" }
    ]);
    expect(selection.directElementIds.has(connection.sourceId)).toBe(true);
    expect(selection.reachedElementIds.has(connection.targetId)).toBe(true);
    expect(selection.visibleConnectionIds.has(connection.id)).toBe(true);

    const sameAreaElements = project.elements.filter((element, index, all) =>
      all.some((candidate, candidateIndex) => candidateIndex !== index
        && workflowAreaForElementType(candidate.elementType) === workflowAreaForElementType(element.elementType)));
    expect(sameAreaElements.length).toBeGreaterThanOrEqual(2);
    const sameAreaConnection = { id: "same-area", sourceId: sameAreaElements[0].id, targetId: sameAreaElements[1].id };
    const sameAreaSelection = calculateWorkflowSelection(project.elements, [sameAreaConnection], [
      { elementId: sameAreaElements[0].id, direction: "downstream" }
    ]);
    expect(sameAreaSelection.visibleConnectionIds.has(sameAreaConnection.id)).toBe(false);
    expect(sameAreaSelection.reachedElementIds.has(sameAreaElements[1].id)).toBe(false);
  });

  it("does not open Feature properties on a single click", async () => {
    const project = useAppStore.getState().projects[0];
    const onSelectFeature = vi.fn();
    const { container } = render(<DialogProvider><FeatureGraph readOnly onSelectFeature={onSelectFeature} /></DialogProvider>);
    const featureId = project.features[0].id;
    const node = await waitFor(() => container.querySelector<HTMLElement>(`.react-flow__node[data-id="${featureId}"]`));
    expect(node).not.toBeNull();
    const featureName = screen.getByText(project.features[0].name);
    fireEvent.click(featureName);
    expect(onSelectFeature).not.toHaveBeenCalled();
    expect(screen.getByLabelText(`Feature: ${project.features[0].name}`)).toHaveStyle({ borderColor: "#1d4ed8" });
  });
});
