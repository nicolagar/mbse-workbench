import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScopeOntologyWorkspace } from "../components/ScopeOntologyWorkspace";
import { SemanticGraphErrorBoundary } from "../components/SemanticGraphErrorBoundary";
import { SemanticParallelPanel, SemanticProjectPanel } from "../components/SemanticWorkspace";
import { getSemanticGraphFlags, resetSemanticGraphFlags, setSemanticGraphFlag } from "../features/semanticGraphFlags";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { useAppStore } from "../store/useAppStore";
import { buildSemanticGraph } from "../domain/semanticGraph";
import { architectSemanticView } from "../domain/semanticGraphViews";
let project = createCoffeeMachineSampleProject();
beforeEach(() => { resetSemanticGraphFlags(); project = createCoffeeMachineSampleProject(); useAppStore.setState({ projects:[project], activeProjectId:project.id }); });
afterEach(() => { cleanup(); resetSemanticGraphFlags(); });
describe("semantic parallel rollout", () => {
  it("keeps the Scope Ontology page focused on the generic workflow map", () => {
    expect(getSemanticGraphFlags().showProjectDigitalThreadTab).toBe(true);
    expect(getSemanticGraphFlags().useRegistryForSchemaView).toBe(true);
    expect(Object.entries(getSemanticGraphFlags()).filter(([name]) => !["showProjectDigitalThreadTab", "useRegistryForSchemaView"].includes(name)).every(([, value]) => !value)).toBe(true);
    render(<ScopeOntologyWorkspace />);
    expect(screen.getByRole("heading",{name:"Scope ontology"})).toBeVisible();
    expect(screen.queryByRole("button",{name:"Project Digital Thread"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Ontology Schema"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Stored schema graph / register"})).not.toBeInTheDocument();
    expect(screen.queryByText("Semantic view controls")).not.toBeInTheDocument();
  });
  it("keeps the standalone semantic explorer immutable with fixed geometry", () => {
    const bytes = JSON.stringify(project);
    const {container} = render(<SemanticProjectPanel project={project} />);
    const path = container.querySelector("[data-semantic-edge]")?.getAttribute("d");
    const positions = [...container.querySelectorAll("[data-semantic-node]")].map(n=>n.getAttribute("transform"));
    fireEvent.click(screen.getAllByRole("button",{name:/Show semantic/})[0]);
    expect(container.querySelector("[data-semantic-edge]")?.getAttribute("d")).toBe(path);
    expect([...container.querySelectorAll("[data-semantic-node]")].map(n=>n.getAttribute("transform"))).toEqual(positions);
    fireEvent.change(screen.getByRole("textbox",{name:"Search semantic model"}),{target:{value:"mission"}});
    fireEvent.click(screen.getByRole("button",{name:"Semantic zoom in"}));
    expect(JSON.stringify(useAppStore.getState().projects[0])).toBe(bytes);
  });
  it("shows frozen simulation evidence and an independently paged read-only matrix", () => {
    setSemanticGraphFlag("showSemanticMatrix",true); const bytes = JSON.stringify(project);
    render(<SemanticProjectPanel project={project} />);
    const context = {type:"simulation",simulationRunId:project.simulationRuns[0].id};
    const select = screen.getByRole("combobox",{name:"Semantic context"});
    const option = within(select).getAllByRole("option").find(o=>o.textContent?.startsWith("Simulation"))!;
    fireEvent.change(select,{target:{value:(option as HTMLOptionElement).value}});
    expect(screen.getByRole("region",{name:"Semantic graph canvas"})).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Full model"}));
    fireEvent.click(screen.getByRole("button",{name:"Read-only matrix"}));
    expect(screen.getByRole("button",{name:"Next targets"})).toBeVisible();
    expect(screen.queryByRole("button",{name:/Create relationship/})).not.toBeInTheDocument();
    expect(JSON.stringify(project)).toBe(bytes);
    expect(context.simulationRunId).toBeTruthy();
  });
  it("contains render failures locally with a legacy action", () => {
    const error = vi.spyOn(console,"error").mockImplementation(()=>{}), legacy = vi.fn();
    const Broken = (): never => {throw new Error("adapter failed")};
    render(<SemanticGraphErrorBoundary onLegacy={legacy}><Broken /></SemanticGraphErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("existing tools remain available");
    fireEvent.click(screen.getByRole("button",{name:"Open legacy view"})); expect(legacy).toHaveBeenCalledOnce(); error.mockRestore();
  });
  it("retains the legacy consumer and has a one-action rollback", () => {
    setSemanticGraphFlag("useSemanticTradeStudyView",true);
    render(<SemanticParallelPanel flag="useSemanticTradeStudyView" label="Preview" studyId={project.comparisonStudies[0].id}><div>Original Trade Study</div></SemanticParallelPanel>);
    fireEvent.click(screen.getByRole("button",{name:"Preview"}));
    expect(screen.getByText("Original Trade Study")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:"Open legacy view"}));
    expect(screen.getByText("Original Trade Study")).toBeVisible();
  });
  it("filters Architect projection by exactly the existing reveal IDs", () => {
    const ids = new Set(project.elements.slice(0,3).map(e=>e.id));
    const graph = architectSemanticView(buildSemanticGraph(project).graph,ids);
    expect(new Set(graph.nodes.map(n=>n.recordId))).toEqual(ids);
    expect(graph.edges.every(e=>graph.nodes.some(n=>n.id===e.source)&&graph.nodes.some(n=>n.id===e.target))).toBe(true);
  });
});
