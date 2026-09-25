import { describe, expect, it } from "vitest";
import { createColdChainSimulationExample, createEmergencyLightingExample } from "../data/scopeExamples";
import { derivationStatus } from "../domain/derivation";
import { requirementSatisfaction } from "../domain/traceability";
import { migratePersistedState } from "../store/persistence";

describe("scope-specific worked examples", () => {
  it("ships a complete architecture-only emergency-lighting model", () => {
    const project = createEmergencyLightingExample();
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    expect(project.schemaVersion).toBe(14);
    expect(project.overallScope).toBe("architectureBuilding");
    expect(project.kpis).toHaveLength(0);
    expect(project.simulationRuns).toHaveLength(0);
    expect(project.configurations).toHaveLength(1);
    expect(derivationStatus(project, project.configurations[0])).toBe("Current");
    expect(requirementSatisfaction(project, requirement).status).toBe("satisfied");
    expect(project.validationResults.filter((finding) => finding.severity === "error").map((finding) => `${finding.ruleId}: ${finding.message}`)).toEqual([]);
  });

  it("ships a complete cold-chain architecture with current simulation evidence", () => {
    const project = createColdChainSimulationExample();
    const requirement = project.elements.find((element) => element.elementType === "systemRequirement")!;
    expect(project.schemaVersion).toBe(14);
    expect(project.overallScope).toBe("architectureAndSimulation");
    expect(project.kpis).toHaveLength(4);
    expect(project.simulationRuns).toHaveLength(1);
    expect(project.simulationRuns[0].results).toHaveLength(4);
    expect(project.simulationRuns[0].validationSummary.errors).toBe(0);
    expect(requirementSatisfaction(project, requirement).status).toBe("satisfied");
    expect(project.validationResults.filter((finding) => finding.severity === "error").map((finding) => `${finding.ruleId}: ${finding.message}`)).toEqual([]);
  });

  it("migrates the former combined relationship tab to Traceability", () => {
    const project = createEmergencyLightingExample();
    const migrated = migratePersistedState({
      schemaVersion: 11,
      projects: [project],
      activeProjectId: project.id,
      uiPreferences: { perspective: "modeler", activeWorkspace: "model", activeModelTab: "interfaces-traceability", activeModelView: "matrix" }
    });
    expect(migrated.schemaVersion).toBe(14);
    expect(migrated.uiPreferences.activeModelTab).toBe("traceability");
  });
});
