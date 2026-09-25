import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { createSampleProject } from "../data/sample";
import {
  buildModelerScopeOntologyLayout,
  modelerScopeOntologyConnections,
  modelerScopeOntologyNodes,
  visibleModelerScopeOntology,
  type ModelerOntologyBox,
  type ModelerOntologyPoint,
  type ModelerOntologyScope
} from "../domain/modelerScopeOntology";
import { disableSemanticGraphPreviews } from "../features/semanticGraphFlags";
import { useAppStore } from "../store/useAppStore";

function intersectsInterior(first: ModelerOntologyPoint, second: ModelerOntologyPoint, box: ModelerOntologyBox) {
  if (first.x === second.x) {
    const low = Math.min(first.y, second.y), high = Math.max(first.y, second.y);
    return first.x > box.x && first.x < box.x + box.width && high > box.y && low < box.y + box.height;
  }
  const low = Math.min(first.x, second.x), high = Math.max(first.x, second.x);
  return first.y > box.y && first.y < box.y + box.height && high > box.x && low < box.x + box.width;
}

function overlapLength(a: ModelerOntologyPoint, b: ModelerOntologyPoint, c: ModelerOntologyPoint, d: ModelerOntologyPoint) {
  if (a.y === b.y && c.y === d.y && a.y === c.y) {
    return Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
  }
  if (a.x === b.x && c.x === d.x && a.x === c.x) {
    return Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
  }
  return 0;
}

function segmentsCross(a: ModelerOntologyPoint, b: ModelerOntologyPoint, c: ModelerOntologyPoint, d: ModelerOntologyPoint) {
  const horizontal = a.y === b.y ? [a, b] : c.y === d.y ? [c, d] : undefined;
  const vertical = a.x === b.x ? [a, b] : c.x === d.x ? [c, d] : undefined;
  if (!horizontal || !vertical) return false;
  const x = vertical[0].x, y = horizontal[0].y;
  return x > Math.min(horizontal[0].x, horizontal[1].x)
    && x < Math.max(horizontal[0].x, horizontal[1].x)
    && y > Math.min(vertical[0].y, vertical[1].y)
    && y < Math.max(vertical[0].y, vertical[1].y);
}

describe("generic Modeler scope ontology", () => {
  beforeEach(() => {
    disableSemanticGraphPreviews();
    const project = createSampleProject();
    project.overallScope = "architectureBuilding";
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

  it("uses generic stereotypes and excludes the removed concepts", () => {
    const ids = new Set(modelerScopeOntologyNodes.map(node => node.id));
    expect(ids.has("featureModel")).toBe(false);
    expect(ids.has("risk")).toBe(false);
    expect(ids.has("validationFinding")).toBe(false);
    expect(ids.has("unresolvedReference")).toBe(false);
    expect(modelerScopeOntologyNodes.every(node => !node.label.includes("Coffee"))).toBe(true);
  });

  it("connects System Requirement to exactly the five requested stereotype types", () => {
    const nodes = new Map(modelerScopeOntologyNodes.map(node => [node.id, node]));
    const targets = new Set(modelerScopeOntologyConnections
      .filter(connection => nodes.get(connection.source)?.kind === "systemRequirement")
      .map(connection => nodes.get(connection.target)?.kind));
    expect([...targets].sort()).toEqual([
      "industrialSystemComponent",
      "parameter",
      "processFunction",
      "productComponent",
      "productFunction"
    ]);
  });

  it("connects Architecture to exactly the seven requested engineering stereotype types", () => {
    const nodes = new Map(modelerScopeOntologyNodes.map(node => [node.id, node]));
    const sources = new Set(modelerScopeOntologyConnections
      .filter(connection => connection.predicate === "belongsToArchitecture" && nodes.get(connection.target)?.kind === "architecture")
      .map(connection => nodes.get(connection.source)?.kind));
    expect([...sources].sort()).toEqual([
      "industrialSystemComponent",
      "processFunction",
      "processInterface",
      "productComponent",
      "productFunction",
      "productInterface",
      "resource"
    ]);
  });

  it("adds simulation and Trade Study stereotypes progressively", () => {
    const architecture = visibleModelerScopeOntology(0);
    const simulation = visibleModelerScopeOntology(1);
    const trade = visibleModelerScopeOntology(2);
    expect(architecture.nodes.some(node => node.id === "kpi")).toBe(false);
    expect(simulation.nodes.some(node => node.id === "kpi")).toBe(true);
    expect(simulation.nodes.some(node => node.id === "tradeStudy")).toBe(false);
    expect(trade.nodes.some(node => node.id === "tradeStudy")).toBe(true);
    expect(trade.connections).toEqual(expect.arrayContaining([expect.objectContaining({ source: "tradeStudyAxis", predicate: "exploresAxis", target: "variabilityAxis" })]));
    expect(buildModelerScopeOntologyLayout(2).activities).toHaveLength(3);
    expect(trade.nodes.some(node => node.recalled)).toBe(true);
    const nodes = new Map(trade.nodes.map(node => [node.id, node]));
    expect(trade.connections.every(connection => nodes.get(connection.source)?.environment === nodes.get(connection.target)?.environment)).toBe(true);
  });

  it("routes orthogonally without crossing nodes or sharing connector segments", () => {
    ([0, 1, 2] as ModelerOntologyScope[]).forEach(scope => {
      const layout = buildModelerScopeOntologyLayout(scope);
      expect(layout.width).toBe(1180);
      expect([...layout.positions.values()].every(box => box.width === 150 && box.height === 58)).toBe(true);
      expect(layout.routingErrors).toEqual([]);
      expect(layout.routes.size).toBe(layout.connections.length);
      const segments: Array<{ connectionId: string; first: ModelerOntologyPoint; second: ModelerOntologyPoint }> = [];
      layout.connections.forEach(connection => {
        const route = layout.routes.get(connection.id)!;
        route.points.slice(1).forEach((point, index) => {
          const previous = route.points[index];
          expect(point.x === previous.x || point.y === previous.y).toBe(true);
          layout.positions.forEach((box, nodeId) => {
            if (nodeId !== connection.source && nodeId !== connection.target) expect(intersectsInterior(previous, point, box)).toBe(false);
          });
          segments.forEach(existing => {
            expect(overlapLength(previous, point, existing.first, existing.second), `${connection.id} overlaps ${existing.connectionId}`).toBeLessThanOrEqual(0);
            expect(segmentsCross(previous, point, existing.first, existing.second), `${connection.id} crosses ${existing.connectionId}`).toBe(false);
          });
          segments.push({ connectionId: connection.id, first: previous, second: point });
        });
      });
    });
  });

  it("lets the user select all three scopes and filters the generic elements", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { name: "Scope ontology" })).toBeInTheDocument();
    expect(screen.getByText("See how each model element connects to the next. Follow the arrows in either direction to explore the workflow.")).toBeVisible();
    const tradeStudyNavigation = screen.getByRole("button", { name: "Architecture Trade Study" });
    const scopeOntologyNavigation = screen.getByRole("button", { name: "Scope Ontology" });
    const exportNavigation = screen.getByRole("button", { name: "Export" });
    expect(tradeStudyNavigation.compareDocumentPosition(scopeOntologyNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scopeOntologyNavigation.compareDocumentPosition(exportNavigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "System Requirement stereotype" }));
    expect(container.querySelectorAll('[data-semantic-id="systemRequirement"].dimmed')).toHaveLength(0);
    expect(container.querySelectorAll('[data-node-id="system"] .label tspan')).toHaveLength(2);
    expect(container.querySelector('.modeler-ontology__activity')?.querySelectorAll("tspan")).toHaveLength(3);
    const viewport = screen.getByRole("region", { name: "Architecture building scope ontology graph" });
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 1180 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 600 });
    fireEvent.click(screen.getByRole("button", { name: "Fit graph" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("98%");
    expect(screen.getByRole("button", { name: "Architecture building" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "KPI stereotype" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Architecture building + simulation" }));
    expect(screen.getByRole("button", { name: "KPI stereotype" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trade Study stereotype" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trade Study" }));
    expect(screen.getByRole("button", { name: "Trade Study stereotype" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Variability Axis stereotype" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show exploresAxis" })).toBeInTheDocument();
  });
});
