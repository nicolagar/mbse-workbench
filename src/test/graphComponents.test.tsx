import { ReactFlow } from "@xyflow/react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureGraph } from "../components/FeatureGraph";
import { DialogProvider } from "../components/dialogs/DialogProvider";
import { ModelGraphNode, type MeasuredGraphNodeData } from "../components/MeasuredGraphNodes";
import { TradeStudyOntologyView } from "../components/TradeStudyOntologyView";
import { useAppStore } from "../store/useAppStore";

describe("measured semantic graph components", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication());

  it("renders the Feature Model through dedicated measured nodes and explicit ports", async () => {
    render(<DialogProvider><FeatureGraph readOnly /></DialogProvider>);

    expect(screen.getByLabelText("Feature model graph")).toBeInTheDocument();
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
});
