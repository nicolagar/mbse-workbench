import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import {
  scopeOntologyNodes,
  type OntologyScopeLevel
} from "../domain/scopeOntology";
import { semanticScopeOntologyConnections as scopeOntologyConnections, visibleSemanticScopeOntology as visibleScopeOntology } from "../domain/scopeOntologySemantics";
import { buildScopeOntologyLayout } from "../domain/scopeOntologyLayout";
import { createSampleProject } from "../data/sample";
import { useAppStore } from "../store/useAppStore";
import { disableSemanticGraphPreviews } from "../features/semanticGraphFlags";

describe("scope ontology explorer", () => {
  beforeEach(() => {
    disableSemanticGraphPreviews();
    const project = createSampleProject();
    project.overallScope = "tradeStudy";
    useAppStore.setState({
      projects: [project],
      activeProjectId: project.id,
      uiPreferences: {
        ...useAppStore.getState().uiPreferences,
        activePerspective: "modeler",
        activeWorkspace: "ontology"
      }
    });
  });

  it("uses only known endpoints and preserves the three context-to-use-case links", () => {
    const nodeIds = new Set(scopeOntologyNodes.map((node) => node.id));
    scopeOntologyConnections.forEach((connection) => {
      expect(nodeIds.has(connection.source)).toBe(true);
      expect(nodeIds.has(connection.target)).toBe(true);
    });
    expect(scopeOntologyConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "stakeholder", target: "useCase", label: "involvedIn", provenance: "stored", role: "canonical" }),
      expect.objectContaining({ source: "external", target: "useCase", label: "involvedIn", provenance: "stored", role: "canonical" }),
      expect.objectContaining({ source: "useCase", target: "system", label: "UseCase.metadata.subjectSystemId", provenance: "typed", role: "canonical" })
    ]));
  });

  it("scales entity and connection sets with project scope", () => {
    const architecture = visibleScopeOntology(0, "thread");
    const simulation = visibleScopeOntology(1, "thread");
    const trade = visibleScopeOntology(2, "thread");
    expect(architecture.nodes.some((node) => node.id === "kpi")).toBe(false);
    expect(simulation.nodes.some((node) => node.id === "kpi")).toBe(true);
    expect(simulation.nodes.some((node) => node.id === "study")).toBe(false);
    expect(trade.nodes.some((node) => node.id === "study")).toBe(true);
    expect(architecture.nodes.length).toBeLessThan(simulation.nodes.length);
    expect(simulation.nodes.length).toBeLessThan(trade.nodes.length);
    expect(trade.connections.length).toBeGreaterThan(simulation.connections.length);
    expect(trade.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "ComparisonStudy.rootFeatureId", provenance: "typed", role: "canonical", thread: false })
    ]));
    expect(architecture.connections.some(connection => connection.label === "connects" && connection.role === "supporting" && !connection.thread)).toBe(false);
  });

  it("keeps the minimum Trade Study view navigable from Mission to Architecture / baseline", () => {
    const graph = visibleScopeOntology(2, "thread");
    const reached = new Set(["mission"]);
    const queue = ["mission"];
    while (queue.length) {
      const current = queue.shift()!;
      graph.connections.forEach((connection) => {
        const next = connection.source === current ? connection.target : connection.target === current ? connection.source : undefined;
        if (next && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      });
    }
    expect(reached.has("architecture")).toBe(true);
    expect(graph.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "run", target: "configuration", label: "SimulationRun.configurationId" }),
      expect.objectContaining({ source: "alternative", target: "run", label: "ComparisonAlternativeRef.simulationRunId" }),
      expect.objectContaining({ source: "decision", target: "alternative", label: "Decision.selectedAlternative" })
    ]));
  });

  it("routes every scope orthogonally with distinct block ports", () => {
    ([0, 1, 2] as OntologyScopeLevel[]).forEach((scope) => {
      (["thread", "all"] as const).forEach((density) => {
        const layout = buildScopeOntologyLayout(scope, density);
        expect(layout.routingErrors).toEqual([]);
        expect(layout.routes.size).toBe(layout.connections.length);
        const ports = new Set<string>();
        const labelBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
        const blocks = [...layout.positions.values(), ...layout.referencePositions.values()];
        layout.routes.forEach((route) => {
          route.points.slice(1).forEach((point, index) => {
            const previous = route.points[index];
            expect(point.x === previous.x || point.y === previous.y).toBe(true);
          });
          route.ports.forEach((port) => {
            const key = `${port.x},${port.y}`;
            expect(ports.has(key)).toBe(false);
            ports.add(key);
          });
          const overlaps = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) =>
            first.x < second.x + second.width + 4
            && first.x + first.width + 4 > second.x
            && first.y < second.y + second.height + 4
            && first.y + first.height + 4 > second.y;
          expect(blocks.some((block) => overlaps(route.labelBox, block))).toBe(false);
          expect(labelBoxes.some((label) => overlaps(route.labelBox, label))).toBe(false);
          labelBoxes.push(route.labelBox);
        });
      });
    });
  });

  it("keeps connector geometry fixed while a hidden relationship name expands", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { name: "Scope ontology" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Show hasSystemOfInterest" });
    const connection = toggle.closest("g")!.parentElement!.previousElementSibling;
    const pathBefore = container.querySelector("path[marker-end='url(#modeler-ontology-arrow)']")?.getAttribute("d");
    const transformBefore = toggle.getAttribute("transform");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide hasSystemOfInterest" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("hasSystemOfInterest")).toBeInTheDocument();
    expect(container.querySelector("path[marker-end='url(#modeler-ontology-arrow)']")?.getAttribute("d")).toBe(pathBefore);
    expect(screen.getByRole("button", { name: "Hide hasSystemOfInterest" })).toHaveAttribute("transform", transformBefore);
    expect(connection).toBeTruthy();
  });
});
