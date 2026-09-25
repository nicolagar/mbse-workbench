import { describe, expect, it } from "vitest";
import { createSampleProject } from "../data/sample";
import { architectureCompatibleModel, derivationStatus, deriveConfiguration } from "../domain/derivation";
import { evaluateFeatureExpression, FeatureExpressionError } from "../domain/featureExpressions";
import {
  evaluateKpiFormula,
  formulaReferences,
  KpiFormulaError,
  kpiDependencyCycle,
  parseKpiFormula
} from "../domain/kpiFormulas";
import { calculateCriticalPath, calculateSelectedKpis, runStandardAlgorithm } from "../domain/presizing";
import { runSimulation, simulationStatus } from "../domain/simulation";
import type { Configuration, Feature, Parameter, PersistedAppState } from "../domain/types";
import {
  applySelectionToConfiguration,
  calculateConfigurationSelection,
  featureGroupCycle,
  featureHierarchyCycle,
  validateConfiguration
} from "../domain/variability";
import { applyVariationPoints } from "../domain/variationPoints";
import { migratePersistedState } from "../store/persistence";
import { useAppStore } from "../store/useAppStore";

const state = (project = createSampleProject()): PersistedAppState => ({
  schemaVersion: 1,
  activeProjectId: project.id,
  projects: [{ ...project, schemaVersion: 1 }],
  snapshots: [],
  uiPreferences: {
    activeWorkspace: "dashboard", activeModelTab: "mission-context", activeModelView: "table",
    tableSortModeByType: {}, graphLayoutModeByTab: {}, detailsPanelOpen: true,
    validationSeverity: "all", validationCategory: "all", validationDomain: "all",
    variationPointView: "graph", variationGraphSections: [], variationGraphElementTypes: [],
    activeVariabilityTab: "Feature Model",
    activeTradeStudyTab: "Guided Workflow",
    tradeStudyView: "manager"
  }
});

describe("Stage-B migration", () => {
  it("is pure and idempotent", () => {
    const raw = state();
    const before = structuredClone(raw);
    const first = migratePersistedState(raw);
    const second = migratePersistedState(structuredClone(first));
    expect(raw).toEqual(before);
    expect(second).toEqual(first);
    expect(first.schemaVersion).toBe(14);
  });

  it("migrates legacy element expressions to first-class existence variation points", () => {
    const raw = state();
    const project = raw.projects[0];
    project.variationPoints = [];
    project.elements[0].featureExpression = "feature-manual-loading";
    const migrated = migratePersistedState(raw).projects[0];
    const variationPoint = migrated.variationPoints.find((item) => item.constrainedElementIds.includes(project.elements[0].id));
    expect(variationPoint?.kind).toBe("existence");
    expect(variationPoint?.featureExpression).toBe("feature-manual-loading");
    expect(migrated.elements[0].featureExpression).toBeUndefined();
  });

  it("converts legacy selectedFeatureIds to manual selections", () => {
    const raw = state() as unknown as { schemaVersion: number; projects: Array<{ configurations: Array<Record<string, unknown>> }> };
    const configuration = raw.projects[0].configurations[0];
    delete configuration.manuallySelectedFeatureIds;
    configuration.selectedFeatureIds = ["feature-manual-loading", "feature-vision"];
    const migrated = migratePersistedState(raw);
    expect(migrated.projects[0].configurations[0].manuallySelectedFeatureIds).toEqual(expect.arrayContaining(["feature-manual-loading", "feature-vision"]));
    expect(migrated.projects[0].configurations[0].effectiveSelectedFeatureIds).toContain("feature-machine");
  });

  it("retargets legacy process-resource assignments to the realizing industrial component", () => {
    const raw = state();
    const project = raw.projects[0];
    const assignment = project.relationships.find((relationship) => relationship.relationshipType === "requiresResource")!;
    const realizingLink = project.relationships.find((relationship) =>
      relationship.relationshipType === "realizedBy" && relationship.targetId === assignment.sourceId
    )!;
    assignment.sourceId = realizingLink.sourceId;
    const migrated = migratePersistedState(raw).projects[0];
    expect(migrated.relationships.find((relationship) => relationship.id === assignment.id)?.sourceId).toBe(realizingLink.targetId);
    expect(migrated.relationships.some((relationship) =>
      relationship.relationshipType === "requiresResource"
      && migrated.elements.find((element) => element.id === relationship.sourceId)?.elementType === "processFunction"
    )).toBe(false);
  });

  it("moves an unambiguous legacy resource quantity to its assignment", () => {
    const raw = state();
    const project = raw.projects[0];
    const resource = project.elements.find((element) => element.name === "Assembly operator")!;
    (resource.metadata as Record<string, unknown>).requiredQuantity = 2;
    const assignments = project.relationships.filter((relationship) => relationship.relationshipType === "requiresResource" && relationship.targetId === resource.id);
    project.relationships = project.relationships.filter((relationship) => relationship.id !== assignments[1].id);
    delete assignments[0].requiredQuantity;
    delete assignments[0].quantity;
    const migrated = migratePersistedState(raw).projects[0];
    expect(migrated.relationships.find((relationship) => relationship.id === assignments[0].id)?.requiredQuantity).toBe(2);
    expect((migrated.elements.find((element) => element.id === resource.id)!.metadata as Record<string, unknown>).requiredQuantity).toBeUndefined();
  });

  it("preserves ambiguous legacy quantity with PMB-114", () => {
    const raw = state();
    const project = raw.projects[0];
    const resource = project.elements.find((element) => element.name === "Assembly operator")!;
    (resource.metadata as Record<string, unknown>).requiredQuantity = 2;
    project.relationships.filter((relationship) => relationship.relationshipType === "requiresResource" && relationship.targetId === resource.id)
      .forEach((relationship) => { delete relationship.requiredQuantity; delete relationship.quantity; });
    const migrated = migratePersistedState(raw).projects[0];
    expect((migrated.elements.find((element) => element.id === resource.id)!.metadata as Record<string, unknown>).requiredQuantity).toBe(2);
    expect(migrated.validationResults.some((finding) => finding.ruleId === "PMB-114")).toBe(true);
  });

  it("migrates schema-3 architecture applicability into the canonical 150% model", () => {
    const raw = state();
    raw.schemaVersion = 3;
    raw.projects[0].schemaVersion = 3;
    const element = raw.projects[0].elements[0];
    element.architectureScope = "specific";
    element.architectureId = "arch-manual";
    raw.projects[0].architectures.push({
      id: "arch-orphan",
      name: "Legacy orphan",
      description: "No configuration referenced this schema-3 architecture.",
      status: "draft",
      createdAt: raw.projects[0].createdAt,
      updatedAt: raw.projects[0].updatedAt
    });
    const migrated = migratePersistedState(raw).projects[0];
    const migratedElement = migrated.elements.find((candidate) => candidate.id === element.id)!;
    expect(migratedElement).toMatchObject({
      id: element.id,
      architectureScope: "common"
    });
    expect(migratedElement).not.toHaveProperty("architectureId");
    expect(migrated.featureGroups.map((group) => group.name)).toContain("Migrated architecture applicability");
    expect(migrated.variationPoints.some((variationPoint) => variationPoint.constrainedElementIds.includes(element.id))).toBe(true);
    expect(new Set(migrated.configurations.map((configuration) => configuration.architectureId)).size).toBe(migrated.configurations.length);
    expect(migrated.architectures.some((architecture) => architecture.id === "arch-orphan")).toBe(true);
    expect(migrated.configurations.some((configuration) => configuration.architectureId === "arch-orphan")).toBe(true);
  });
});

describe("feature model and configuration", () => {
  it("detects hierarchy cycles and enforces one root", () => {
    const features: Feature[] = [
      { id: "a", parentId: "b", name: "A", featureType: "optional", sortOrder: 0, description: "" },
      { id: "b", parentId: "a", name: "B", featureType: "optional", sortOrder: 1, description: "" }
    ];
    expect(featureHierarchyCycle(features)).not.toBeNull();
    const project = createSampleProject();
    project.features = features;
    const configuration = { ...project.configurations[0], effectiveSelectedFeatureIds: [] };
    expect(validateConfiguration(project, configuration).some((finding) => finding.ruleId === "PMB-023")).toBe(true);
  });

  it("keeps recursive organizational groups nonselectable and detects their cycles", () => {
    const project = createSampleProject();
    project.featureGroups = [
      { id: "g1", name: "Group 1", description: "", parentGroupId: "g2", sortOrder: 0 },
      { id: "g2", name: "Group 2", description: "", parentGroupId: "g1", sortOrder: 1 }
    ];
    expect(featureGroupCycle(project.featureGroups)).toEqual(["g1", "g2", "g1"]);
    expect(validateConfiguration(project, project.configurations[0]).map((finding) => finding.ruleId)).toContain("PMB-028");
  });

  it("adds root and mandatory features automatically", () => {
    const project = createSampleProject();
    const selected = calculateConfigurationSelection(project.features, project.featureConstraints, ["feature-manual-loading", "feature-manual-fastening", "feature-vision"]);
    expect(selected.effective).toEqual(expect.arrayContaining(["feature-machine", "feature-core-control", "feature-safety", "feature-operating-voltage"]));
    expect(selected.automatic).toEqual(expect.arrayContaining(["feature-machine", "feature-core-control", "feature-safety", "feature-operating-voltage"]));
  });

  it("records and validates enumerated feature values", () => {
    const project = createSampleProject();
    const configuration = applySelectionToConfiguration({
      ...project.configurations[0],
      featureValues: { "feature-operating-voltage": "invalid" }
    }, project.features, project.featureConstraints);
    expect(configuration.featureValues?.["feature-operating-voltage"]).toBe("");
    const invalid = { ...configuration, featureValues: { ...configuration.featureValues, "feature-operating-voltage": "invalid" } };
    expect(validateConfiguration(project, invalid).map((finding) => finding.ruleId)).toContain("PMB-027");
    const manual = deriveConfiguration(project, project.configurations[0]).result!;
    const automated = deriveConfiguration(project, project.configurations[1]).result!;
    const description = (result: typeof manual) => result.realizedElements.find((element) => element.name === "Control-data connection")?.description;
    expect(description(manual)).toContain("230 V");
    expect(description(automated)).toContain("400 V");
  });

  it("validates active XOR and OR groups but ignores inactive child groups", () => {
    const project = createSampleProject();
    const empty: Configuration = {
      ...project.configurations[0],
      manuallySelectedFeatureIds: [],
      automaticConstraintFeatureIds: [],
      effectiveSelectedFeatureIds: [],
      autoSelectedFeatureIds: []
    };
    const selected = applySelectionToConfiguration(empty, project.features, project.featureConstraints);
    const rules = validateConfiguration(project, selected).map((finding) => finding.ruleId);
    expect(rules).toContain("PMB-006");
    expect(rules).toContain("PMB-007");
    project.features.push({ id: "inactive-parent", parentId: "feature-manual-loading", name: "Inactive", featureType: "optional", sortOrder: 20, description: "" });
    project.features.push({ id: "inactive-x", parentId: "inactive-parent", name: "X", featureType: "xor", groupId: "inactive", sortOrder: 21, description: "" });
    expect(validateConfiguration(project, selected).filter((finding) => finding.message.includes("inactive"))).toHaveLength(0);
  });

  it("reports requires and excludes violations", () => {
    const project = createSampleProject();
    const invalid = project.configurations.find((configuration) => configuration.id === "configuration-invalid")!;
    expect(validateConfiguration(project, invalid).map((finding) => finding.ruleId)).toEqual(expect.arrayContaining(["PMB-008"]));
    const excludes = applySelectionToConfiguration({
      ...invalid,
      manuallySelectedFeatureIds: ["feature-manual-loading", "feature-automated-feeding", "feature-manual-fastening", "feature-vision"]
    }, project.features, project.featureConstraints);
    expect(validateConfiguration(project, excludes).map((finding) => finding.ruleId)).toContain("PMB-009");
  });

  it("uses exact tokens and Boolean precedence", () => {
    const project = createSampleProject();
    expect(evaluateFeatureExpression("feature-manual-loading OR feature-automated-feeding AND NOT feature-probe", ["feature-manual-loading"], project.features)).toBe(true);
    expect(evaluateFeatureExpression("(feature-manual-loading OR feature-automated-feeding) AND NOT feature-probe", ["feature-manual-loading", "feature-probe"], project.features)).toBe(false);
    expect(() => evaluateFeatureExpression("feature-does-not-exist", [], project.features)).toThrow(FeatureExpressionError);
  });
});

describe("derivation", () => {
  it("uses the complete canonical 150% source without mutating the project", () => {
    const project = createSampleProject();
    project.elements.push({ ...structuredClone(project.elements[0]), id: "other-architecture", name: "Other", architectureScope: "specific", architectureId: "arch-auto" });
    const compatible = architectureCompatibleModel(project, "arch-manual");
    expect(compatible.elements.some((element) => element.id === "other-architecture")).toBe(true);
    const before = structuredClone(project);
    const result = deriveConfiguration(project, project.configurations[0]);
    expect(result.errors).toEqual([]);
    expect(project).toEqual(before);
    expect(result.result?.removedRelationshipIds.length).toBeGreaterThan(0);
  });

  it("marks a derivation stale after a later model revision", () => {
    const project = createSampleProject();
    const attempt = deriveConfiguration(project, project.configurations[0]);
    const configuration = attempt.configuration;
    expect(derivationStatus(project, configuration)).toBe("Current");
    expect(derivationStatus({ ...project, modelRevision: project.modelRevision + 1 }, configuration)).toBe("Stale");
  });

  it("realizes modification variation points and records an audit without mutating the 150% source", () => {
    const project = createSampleProject();
    const source = structuredClone(project);
    const manual = deriveConfiguration(project, project.configurations[0]);
    const automated = deriveConfiguration(project, project.configurations[1]);
    const loadId = project.elements.find((element) => element.name === "Load components")!.id;
    expect(manual.errors).toEqual([]);
    expect(automated.errors).toEqual([]);
    expect(manual.result?.realizedElements.find((element) => element.id === loadId)?.metadata.duration).toBe(4);
    expect(automated.result?.realizedElements.find((element) => element.id === loadId)?.metadata.duration).toBe(1.5);
    expect(automated.result?.modifiedElementIds).toContain(loadId);
    expect(automated.result?.appliedVariations.some((variation) => variation.variationPointId === "variation-load-duration")).toBe(true);
    expect(project).toEqual(source);
  });

  it("supports safe element-property retargeting and primitive-tag changes", () => {
    const project = createSampleProject();
    const source = architectureCompatibleModel(project, "arch-manual");
    const relationship = source.relationships.find((item) => item.relationshipType === "connects")!;
    const replacementTarget = source.elements.find((element) => element.id !== relationship.targetId)!.id;
    const taggedElement = source.elements[0];
    const now = new Date().toISOString();
    project.variationPoints.push(
      {
        id: "variation-retarget-test", name: "Retarget", description: "", kind: "elementProperty",
        constrainedElementIds: [], constrainedRelationshipIds: [relationship.id],
        featureExpression: "feature-manual-loading", featureValueConditions: [], propertyPath: "targetId",
        valueRules: [{ id: "retarget-rule", featureExpression: "", featureValueConditions: [], value: replacementTarget }],
        enabled: true, createdAt: now, updatedAt: now
      },
      {
        id: "variation-tag-test", name: "Tags", description: "", kind: "primitiveTag",
        constrainedElementIds: [taggedElement.id], constrainedRelationshipIds: [],
        featureExpression: "feature-manual-loading", featureValueConditions: [], propertyPath: "tags",
        valueRules: [{ id: "tag-rule", featureExpression: "", featureValueConditions: [], value: ["manual-variant"] }],
        enabled: true, createdAt: now, updatedAt: now
      }
    );
    const preview = applyVariationPoints(project, project.configurations[0], source);
    expect(preview.relationships.find((item) => item.id === relationship.id)?.targetId).toBe(replacementTarget);
    expect(preview.elements.find((item) => item.id === taggedElement.id)?.tags).toEqual(["manual-variant"]);
    expect(source.relationships.find((item) => item.id === relationship.id)?.targetId).toBe(relationship.targetId);
    expect(source.elements.find((item) => item.id === taggedElement.id)?.tags).not.toEqual(["manual-variant"]);
  });

  it("defaults to the entire model but honors an explicit realization scope", () => {
    const project = createSampleProject();
    const automated = { ...project.configurations[1], realizationScopes: ["resources" as const] };
    const result = deriveConfiguration(project, automated);
    const load = result.result?.realizedElements.find((element) => element.name === "Load components");
    expect(result.errors).toEqual([]);
    expect(load?.metadata.duration).toBe(4);
    expect(result.result?.realizationScopes).toEqual(["resources"]);
    expect(result.warnings.some((warning) => warning.includes("Scoped realization") || warning.includes("these variation domains"))).toBe(true);
  });
});

describe("safe KPI formulas", () => {
  const parameter: Parameter = {
    id: "p", ownerElementId: "owner", name: "P", semanticKey: "p", description: "", dataType: "number",
    value: 4, unit: "kg", valueOrigin: "entered", applicableConfigurationIds: []
  };
  it("tokenizes references and applies arithmetic precedence and unary minus", () => {
    const ast = parseKpiFormula('-param("p") + param("p") * 2');
    expect(formulaReferences(ast).parameterIds).toEqual(["p"]);
    expect(evaluateKpiFormula(ast, new Map([["p", parameter]]), new Map())).toEqual({ value: 4, unit: "kg" });
  });
  it("rejects missing references, division by zero, and incompatible units", () => {
    expect(() => evaluateKpiFormula(parseKpiFormula('param("missing")'), new Map(), new Map())).toThrow(KpiFormulaError);
    expect(() => evaluateKpiFormula(parseKpiFormula("1 / 0"), new Map(), new Map())).toThrow(/Division by zero/);
    const other = { ...parameter, id: "q", value: 2, unit: "h" };
    expect(() => evaluateKpiFormula(parseKpiFormula('param("p") + param("q")'), new Map([["p", parameter], ["q", other]]), new Map())).toThrow(/equal units/);
  });
  it("detects KPI dependency cycles", () => {
    const project = createSampleProject();
    const a = { ...project.kpis[0], id: "a", dependsOnKpiIds: ["b"] };
    const b = { ...project.kpis[0], id: "b", dependsOnKpiIds: ["a"] };
    expect(kpiDependencyCycle([a, b])).toEqual(["a", "b", "a"]);
  });
});

describe("standard pre-sizing and immutable simulation", () => {
  it("requires an active configuration for variant-specific analysis", () => {
    const project = createSampleProject();
    const attempt = runSimulation(project, {
      name: "Source-only run",
      configurationId: "missing",
      selectedKpiIds: ["kpi-mass"],
      selectedAlgorithmKeys: []
    });
    expect(attempt.errors).toContain("PMB-020: Select an active saved configuration.");
  });

  it("calculates critical path across parallel branches and rejects cycles", () => {
    const project = createSampleProject();
    const processes = project.elements.filter((element) => element.elementType === "processFunction");
    const model = { elements: processes, relationships: [
      { ...project.relationships[0], id: "p1", relationshipType: "precedes" as const, sourceId: processes[0].id, targetId: processes[2].id },
      { ...project.relationships[0], id: "p2", relationshipType: "precedes" as const, sourceId: processes[1].id, targetId: processes[2].id }
    ] };
    expect(calculateCriticalPath(model).value).toBeCloseTo(7 / 60);
    model.relationships.push({ ...model.relationships[0], id: "p3", sourceId: processes[2].id, targetId: processes[0].id });
    expect(calculateCriticalPath(model).error).toMatch(/cycle/i);
  });

  it("uses requiredQuantity on each resource relationship", () => {
    const project = createSampleProject();
    const model = architectureCompatibleModel(project, "arch-manual");
    const relationship = model.relationships.find((item) => item.relationshipType === "requiresResource")!;
    relationship.requiredQuantity = 3;
    const demand = runStandardAlgorithm("resourceDemand", model);
    const realizedProcesses = model.relationships
      .filter((item) => item.relationshipType === "realizedBy" && item.targetId === relationship.sourceId)
      .map((item) => model.elements.find((element) => element.id === item.sourceId)!)
      .filter((element) => element.elementType === "processFunction");
    const expected = realizedProcesses.reduce((sum, process) => sum + process.metadata.duration! / 60, 0) * 3;
    expect(demand.inputSources.find((input) => input.id === relationship.id)?.value).toBeCloseTo(expected);
  });

  it("produces differentiated manual and automated sample values", () => {
    const project = createSampleProject();
    const values = project.configurations.slice(0, 2).map((configuration) => {
      const derived = deriveConfiguration(project, configuration).configuration;
      const model = {
        elements: derived.derivation!.realizedElements,
        relationships: derived.derivation!.realizedRelationships,
        configurationId: configuration.id
      };
      return calculateSelectedKpis(project, model, ["kpi-mass", "kpi-cost", "kpi-power"]).results.map((result) => result.value);
    });
    expect(values[0]).not.toEqual(values[1]);
  });

  it("stores exact KPI IDs and immutable inputs, and later becomes stale", () => {
    const project = createSampleProject();
    const configuration = deriveConfiguration(project, project.configurations[0]).configuration;
    const ready = { ...project, configurations: project.configurations.map((item) => item.id === configuration.id ? configuration : item) };
    const attempt = runSimulation(ready, {
      name: "Manual run", configurationId: configuration.id,
      selectedKpiIds: ["kpi-mass", "kpi-power"], selectedAlgorithmKeys: []
    });
    expect(attempt.errors).toEqual([]);
    expect(attempt.run?.results.map((result) => result.kpiId)).toEqual(["kpi-mass", "kpi-power"]);
    const snapshot = structuredClone(attempt.run!.inputSnapshot);
    ready.elements[0].name = "Changed later";
    expect(attempt.run!.inputSnapshot).toEqual(snapshot);
    expect(simulationStatus({ ...ready, modelRevision: ready.modelRevision + 1 }, attempt.run!)).toBe("Stale");
  });

  it("captures a missing realization in memory without updating the configuration", () => {
    const project = createSampleProject();
    const configuration = project.configurations[0];
    configuration.derivation = undefined;
    configuration.derivedElementIds = [];
    configuration.excludedElementIds = [];
    expect(configuration.derivation).toBeUndefined();
    const attempt = runSimulation(project, {
      name: "Background realization",
      configurationId: configuration.id,
      selectedKpiIds: ["kpi-mass"],
      selectedAlgorithmKeys: []
    });
    expect(attempt.errors).toEqual([]);
    expect(project.configurations[0].derivation).toBeUndefined();
    expect(attempt.run?.inputSnapshot.backgroundRealization).toBe(true);
    expect(attempt.run?.inputSnapshot.realizedElements.length).toBeGreaterThan(0);
    expect(attempt.run?.inputSnapshot.appliedVariations.length).toBeGreaterThan(0);
  });
});

describe("configuration-owned architecture lifecycle", () => {
  it("creates, renames, and permanently deletes the generated architecture with its configuration", () => {
    useAppStore.getState().resetActiveProject();
    const now = new Date().toISOString();
    const configuration: Configuration = {
      id: "configuration-owned-test",
      name: "Owned Test",
      architectureId: "",
      manuallySelectedFeatureIds: [],
      automaticConstraintFeatureIds: [],
      effectiveSelectedFeatureIds: [],
      autoSelectedFeatureIds: [],
      featureValues: {},
      validationStatus: "notValidated",
      validationMessages: [],
      derivedElementIds: [],
      excludedElementIds: [],
      createdAt: now,
      updatedAt: now
    };
    useAppStore.getState().addConfiguration(configuration);
    let project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    const saved = project.configurations.find((candidate) => candidate.id === configuration.id)!;
    const architectureId = saved.architectureId;
    expect(project.architectures.find((architecture) => architecture.id === architectureId)).toMatchObject({
      name: configuration.name,
      configurationId: configuration.id,
      status: "draft"
    });
    useAppStore.getState().updateConfiguration(configuration.id, { name: "Renamed Test" });
    project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    expect(project.architectures.find((architecture) => architecture.id === architectureId)?.name).toBe("Renamed Test");
    useAppStore.getState().deleteConfiguration(configuration.id);
    project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    expect(project.configurations.some((candidate) => candidate.id === configuration.id)).toBe(false);
    expect(project.architectures.some((architecture) => architecture.id === architectureId)).toBe(false);
  });

  it("archives the configuration and architecture when immutable run history exists", () => {
    useAppStore.getState().resetActiveProject();
    const configurationId = "configuration-manual";
    const attempt = useAppStore.getState().executeSimulation({
      name: "Historical ownership test",
      configurationId,
      selectedKpiIds: ["kpi-mass"],
      selectedAlgorithmKeys: []
    }, true);
    expect(attempt.run).toBeDefined();
    useAppStore.getState().deleteConfiguration(configurationId);
    const project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    const configuration = project.configurations.find((candidate) => candidate.id === configurationId)!;
    const architecture = project.architectures.find((candidate) => candidate.id === configuration.architectureId)!;
    expect(configuration.archivedAt).toBeTruthy();
    expect(architecture.status).toBe("archived");
    expect(project.simulationRuns.some((run) => run.configurationId === configurationId)).toBe(true);
  });

  it("moves the generated architecture from realized to stale after a model change", () => {
    useAppStore.getState().resetActiveProject();
    expect(useAppStore.getState().deriveConfigurationById("configuration-balanced")).toEqual([]);
    let project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    expect(project.architectures.find((architecture) => architecture.configurationId === "configuration-balanced")?.status).toBe("candidate");
    useAppStore.getState().updateFeature("feature-vision", { description: "Changed after realization" });
    project = useAppStore.getState().projects.find((candidate) => candidate.id === useAppStore.getState().activeProjectId)!;
    expect(project.architectures.find((architecture) => architecture.configurationId === "configuration-balanced")?.status).toBe("stale");
  });
});
