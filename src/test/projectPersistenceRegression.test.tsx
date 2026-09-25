import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { buildExportPackage, defaultExportFilters, serializeExportPackage } from "../domain/exportImport";
import { CURRENT_SCHEMA_VERSION, loadPersistedState, migrateProject, STORAGE_KEY } from "../store/persistence";
import { createInitialEmptyState, useAppStore } from "../store/useAppStore";

describe("project persistence regressions", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetEntireApplication();
  });

  it("creates one empty active project for a clean first launch", () => {
    const initial = createInitialEmptyState();

    expect(initial.projects).toHaveLength(1);
    expect(initial.activeProjectId).toBe(initial.projects[0].id);
    expect(initial.snapshots).toEqual([]);
    expect(initial.projects[0]).toMatchObject({
      name: "New project",
      overallScope: "architectureBuilding",
      elements: [],
      relationships: [],
      features: [],
      configurations: [],
      simulationRuns: []
    });
  });

  it("omits live assumption fields from current projects and newly generated sample runs", () => {
    const project = createCoffeeMachineSampleProject("project-current-evidence");
    expect(project).not.toHaveProperty("assumptions");
    expect(project.simulationRuns.every((run) => !Object.prototype.hasOwnProperty.call(run, "assumptions"))).toBe(true);
  });

  it("creates an internally consistent empty project that can open Save Project and persist", async () => {
    useAppStore.getState().createProject("Blank study");
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Save Project" }));
    expect(screen.getByRole("heading", { name: "Save Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download project file" })).toBeEnabled();

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull(), { timeout: 2000 });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const saved = stored.projects.find((project: { name: string }) => project.name === "Blank study");
    expect(saved).toBeDefined();
  });

  it("loads a saved empty project as a new active project", () => {
    const store = useAppStore.getState();
    store.createProject("Portable blank study");
    const source = useAppStore.getState().projects.find((project) => project.id === useAppStore.getState().activeProjectId)!;
    const raw = serializeExportPackage(buildExportPackage(source, defaultExportFilters()));

    store.switchProject(useAppStore.getState().projects[0].id);
    const result = store.importProjectPackage(raw, "new");

    expect(result.errors).toEqual([]);
    const active = useAppStore.getState().projects.find((project) => project.id === useAppStore.getState().activeProjectId)!;
    expect(active.name).toBe("Portable blank study");
    expect(active.elements).toEqual([]);
  });

  it("recalculates imported validation so obsolete per-domain satisfaction errors are removed", () => {
    const source = createCoffeeMachineSampleProject("project-obsolete-validation");
    source.validationResults.push({
      id: "PMA-121-obsolete",
      ruleId: "PMA-121",
      severity: "error",
      title: "Obsolete satisfaction rule",
      message: "Previously required product-component evidence.",
      category: "traceability",
      affectedElementIds: [source.elements.find((element) => element.elementType === "systemRequirement")!.id],
      affectedRelationshipIds: [],
      resolved: false
    });
    const raw = serializeExportPackage(buildExportPackage(source, defaultExportFilters()));

    const result = useAppStore.getState().importProjectPackage(raw, "new");

    expect(result.errors).toEqual([]);
    const active = useAppStore.getState().projects.find((project) => project.id === useAppStore.getState().activeProjectId)!;
    expect(active.validationResults.some((finding) => ["PMA-121", "PMA-122", "PMA-123"].includes(finding.ruleId))).toBe(false);
  });

  it("drops live schema-13 assumptions while preserving immutable legacy run evidence", () => {
    const legacy = createCoffeeMachineSampleProject("project-legacy-evidence");
    legacy.schemaVersion = 13;
    legacy.assumptions = [{
      id: "assumption-legacy",
      title: "Legacy planning assumption",
      description: "Retained only in the source schema-13 payload.",
      confidence: "medium",
      status: "open",
      relatedElementIds: []
    }];
    const historicalRun = legacy.simulationRuns[0];
    historicalRun.assumptions = ["Historical evidence condition — do not rewrite."];

    const migrated = migrateProject(legacy);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated).not.toHaveProperty("assumptions");
    expect(migrated.simulationRuns.find((run) => run.id === historicalRun.id)?.assumptions)
      .toEqual(["Historical evidence condition — do not rewrite."]);
    expect(migrateProject(structuredClone(migrated))).toEqual(migrated);
  });

  it("repairs the malformed empty-project state already saved by the affected version", () => {
    const affected = createCoffeeMachineSampleProject("project-affected-empty");
    Object.assign(affected, {
      name: "Affected empty project",
      objectives: [],
      assumptions: [],
      openDecisions: [],
      architectures: [],
      elements: [],
      relationships: [],
      functionSequences: [],
      selectedUseCaseIds: [],
      features: [],
      featureGroups: [],
      variabilityAxes: [],
      variationPoints: [],
      configurations: [],
      kpis: [],
      simulationRuns: [],
      comparisonStudies: [],
      comparisonRisks: [],
      decisions: [],
      validationResults: []
    });
    expect(affected.featureConstraints.length).toBeGreaterThan(0);
    const raw = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activeProjectId: affected.id,
      projects: [affected],
      snapshots: [],
      uiPreferences: useAppStore.getState().uiPreferences
    });

    const loaded = loadPersistedState({ getItem: () => raw });

    expect(loaded.error).toBeUndefined();
    expect(loaded.state?.projects[0].featureConstraints).toEqual([]);
    expect(loaded.state?.projects[0].baselineArchitectureId).toBeUndefined();
    expect(() => buildExportPackage(loaded.state!.projects[0], defaultExportFilters())).not.toThrow();
  });

  it("Reset all removes every project and snapshot and creates one empty active project", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    const resetDialog = screen.getByRole("dialog", { name: "Confirm" });
    fireEvent.click(within(resetDialog).getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(useAppStore.getState().projects).toHaveLength(1));

    const state = useAppStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.activeProjectId).toBe(state.projects[0].id);
    expect(state.snapshots).toEqual([]);
    expect(state.projects[0].elements).toEqual([]);
    expect(state.projects[0].relationships).toEqual([]);
    expect(state.projects[0].features).toEqual([]);
    expect(state.projects[0].configurations).toEqual([]);
    expect(state.projects[0].simulationRuns).toEqual([]);
    expect(state.uiPreferences.activeWorkspace).toBe("dashboard");
    expect(screen.getByText("New project", { selector: "h1" })).toBeInTheDocument();
  });
});
