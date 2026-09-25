import { describe, expect, it } from "vitest";
import { createSampleProject } from "../data/sample";
import { recalculateCalculatedParameters } from "../domain/calculatedParameters";
import { evaluateFormula, evaluateRequirement } from "../domain/formulas";
import { calculateLayeredLayout, containmentNodeLayers, hierarchyNodePositions, semanticElementLayers } from "../domain/graphLayouts";
import { calculateTraceabilityMetrics } from "../domain/metrics";
import { calculateMaturity } from "../domain/maturity";
import { isViewAvailable, modelSections, sectionProjectionElements } from "../domain/modelViews";
import { processFunctionFlowStatus, processHandoffStatus } from "../domain/processFlows";
import { compatibleRelationshipDirections, compatibleRelationshipTypes, validateRelationship } from "../domain/relationships";
import { analyzeSequence } from "../domain/sequences";
import { calculateWorkflowProgress, missionSatisfaction, needOrObjectiveSatisfaction, requirementSatisfaction, satisfactionEvidence, workingScopeElementIds } from "../domain/traceability";
import type { ModelElement, Parameter, PersistedAppState, Project, Relationship } from "../domain/types";
import { parseUnit } from "../domain/units";
import { architectureApplies, deleteElementCascade, findProcessCycle, validateProject } from "../domain/validation";
import { loadPersistedState, migratePersistedState, serializeState, STORAGE_KEY } from "../store/persistence";

const now = "2026-07-23T10:00:00.000Z";
const sample = () => createSampleProject();
const find = (project: Project, name: string) => project.elements.find((element) => element.name === name)!;
const relation = (project: Project, patch: Partial<Relationship> = {}): Relationship => ({
  id: "candidate",
  relationshipType: "derives",
  sourceId: find(project, "Increased production throughput").id,
  targetId: find(project, "The system shall achieve target throughput").id,
  createdAt: now,
  updatedAt: now,
  ...patch
});

describe("expanded relationship grammar", () => {
  it("uses the clarified canonical directions", () => {
    expect(compatibleRelationshipTypes("systemRequirement", "productFunction")).toContain("satisfiedBy");
    expect(compatibleRelationshipTypes("productFunction", "productComponent")).toContain("realizedBy");
    expect(compatibleRelationshipTypes("stakeholder", "useCase")).toContain("involvedIn");
    expect(compatibleRelationshipTypes("useCase", "need")).toContain("addresses");
    expect(compatibleRelationshipTypes("useCase", "objective")).toContain("addresses");
    expect(compatibleRelationshipTypes("useCase", "productFunction")).toContain("hasFunction");
    expect(compatibleRelationshipTypes("productFunction", "productFunction")).toEqual(expect.arrayContaining(["refines", "precedes"]));
  });

  it("supports product-component item flows from process functions", () => {
    expect(compatibleRelationshipTypes("processFunction", "productComponent")).toEqual(expect.arrayContaining(["consumes", "produces"]));
  });

  it("lets a requirement-facing matrix create reverse canonical verification links", () => {
    expect(compatibleRelationshipDirections("systemRequirement", "verificationMethod")).toContainEqual({
      direction: "reverse",
      relationshipType: "verifies"
    });
  });

  it("rejects forbidden combinations, duplicates and self references", () => {
    const project = sample();
    expect(validateRelationship(relation(project, { relationshipType: "connects" }), project.elements, [])).toMatch(/cannot/);
    const existing = project.relationships.find((edge) => edge.relationshipType === "derives")!;
    expect(validateRelationship({ ...existing, id: "duplicate" }, project.elements, project.relationships)).toMatch(/already exists/);
    const process = project.elements.find((element) => element.elementType === "processFunction")!;
    expect(validateRelationship(relation(project, { relationshipType: "precedes", sourceId: process.id, targetId: process.id }), project.elements, [])).toMatch(/itself/);
  });

  it("requires a positive quantity and unit for every item flow", () => {
    const project = sample();
    const source = find(project, "Load components");
    const target = find(project, "Input component");
    expect(validateRelationship(relation(project, {
      relationshipType: "consumes",
      sourceId: source.id,
      targetId: target.id
    }), project.elements, [])).toMatch(/quantity/);
    expect(validateRelationship(relation(project, {
      relationshipType: "consumes",
      sourceId: source.id,
      targetId: target.id,
      quantity: 2
    }), project.elements, [])).toMatch(/unit/);
    expect(validateRelationship(relation(project, {
      relationshipType: "consumes",
      sourceId: source.id,
      targetId: target.id,
      quantity: Number.NaN,
      unit: "part"
    }), project.elements, [])).toMatch(/greater than zero/);
  });
});

describe("REV_02 section projections and layouts", () => {
  it("keeps newly created current-section elements visible before traceability exists", () => {
    const project = sample();
    const unlinked = structuredClone(find(project, "Handle product"));
    unlinked.id = "unlinked-product-function";
    unlinked.name = "Unlinked review function";
    project.elements.push(unlinked);
    expect(workingScopeElementIds(project).has(unlinked.id)).toBe(false);
    expect(sectionProjectionElements(project, "product-functional").map((element) => element.id)).toContain(unlinked.id);
  });

  it("includes verification methods and every element type in the relevant matrices", () => {
    const project = sample();
    const requirementProjection = sectionProjectionElements(project, "requirements-validation");
    expect(requirementProjection.some((element) => element.elementType === "verificationMethod")).toBe(true);
    expect(modelSections.traceability.matrixTypes).toHaveLength(16);
    expect(sectionProjectionElements(project, "traceability")).toHaveLength(project.elements.length);
  });

  it("offers function sequences only in functional sections", () => {
    expect(isViewAvailable("product-functional", "diagram")).toBe(true);
    expect(isViewAvailable("process-functional", "diagram")).toBe(true);
    expect(isViewAvailable("product-technical", "diagram")).toBe(false);
    expect(isViewAvailable("requirements-validation", "diagram")).toBe(false);
  });

  it("keeps the same element type in one semantic band", () => {
    const project = sample();
    const parent = find(project, "Handle product");
    const child = find(project, "Join product");
    project.relationships.push(relation(project, {
      id: "layout-refines",
      relationshipType: "refines",
      sourceId: child.id,
      targetId: parent.id
    }));
    const positions = hierarchyNodePositions([parent, child], project.relationships);
    expect(positions[parent.id].y).toBe(positions[child.id].y);
    expect(positions[parent.id].x).not.toBe(positions[child.id].x);
  });

  it("orders distinct model types from the root down", () => {
    const project = sample();
    const mission = project.elements.find((element) => element.elementType === "mission")!;
    const stakeholder = project.elements.find((element) => element.elementType === "stakeholder")!;
    const need = project.elements.find((element) => element.elementType === "need")!;
    const layers = semanticElementLayers([need, mission, stakeholder]);
    expect(layers[mission.id].layer).toBeLessThan(layers[stakeholder.id].layer);
    expect(layers[stakeholder.id].layer).toBeLessThan(layers[need.id].layer);
  });

  it("creates non-overlapping semantic regions and routes long links around intermediate cards", async () => {
    const layout = await calculateLayeredLayout({
      direction: "DOWN",
      nodes: [
        { id: "root", width: 220, height: 90, layer: 0, layerLabel: "Mission" },
        { id: "middle", width: 220, height: 120, layer: 1, layerLabel: "Need" },
        { id: "leaf", width: 220, height: 90, layer: 2, layerLabel: "Requirement" }
      ],
      edges: [
        { id: "primary", source: "root", target: "middle", primary: true },
        { id: "cross", source: "root", target: "leaf", primary: false }
      ]
    });
    expect(layout.positions.root.y + 90).toBeLessThan(layout.positions.middle.y);
    expect(layout.positions.middle.y + 120).toBeLessThan(layout.positions.leaf.y);
    const middle = layout.positions.middle;
    const intersectsMiddle = layout.routes.cross.slice(1).some((point, index) => {
      const previous = layout.routes.cross[index];
      if (previous.x === point.x) {
        return point.x > middle.x && point.x < middle.x + 220
          && Math.min(previous.y, point.y) < middle.y + 120
          && Math.max(previous.y, point.y) > middle.y;
      }
      return point.y > middle.y && point.y < middle.y + 120
        && Math.min(previous.x, point.x) < middle.x + 220
        && Math.max(previous.x, point.x) > middle.x;
    });
    expect(intersectsMiddle).toBe(false);
  });

  it("derives feature depth from containment while remaining cycle safe", () => {
    const layers = containmentNodeLayers([
      { id: "root" },
      { id: "group", parentId: "root" },
      { id: "feature", parentId: "group" },
      { id: "cycle-a", parentId: "cycle-b" },
      { id: "cycle-b", parentId: "cycle-a" }
    ]);
    expect(layers.root.layer).toBe(0);
    expect(layers.group.layer).toBe(1);
    expect(layers.feature.layer).toBe(2);
    expect(Number.isFinite(layers["cycle-a"].layer)).toBe(true);
  });
});

describe("safe requirement formula engine", () => {
  it("evaluates the sample comparison through immutable parameter bindings", () => {
    const project = sample();
    const requirement = find(project, "The system shall achieve target throughput");
    expect(evaluateRequirement(project, requirement).status).toBe("satisfied");
    expect(requirement.requirementFormula?.bindings[0].targetId).toMatch(/^par-/);
  });

  it("evaluates arithmetic with compatible compound units", () => {
    const project = sample();
    const owner = find(project, "Joining module");
    const values: Array<[string, number, string]> = [["Cost", 100, "EUR"], ["Rate", 50, "EUR/h"], ["Hours", 2, "h"]];
    const parameters = values.map(([name, value, unit], index): Parameter => ({
      id: `formula-par-${index}`,
      ownerElementId: owner.id,
      name,
      semanticKey: name.toLowerCase(),
      description: "",
      dataType: "number",
      value,
      unit,
      valueOrigin: "entered",
      applicableConfigurationIds: []
    }));
    owner.parameters.push(...parameters);
    const evaluation = evaluateFormula(project, {
      expression: "@cost = @rate * @hours",
      bindings: parameters.map((parameter) => ({ id: `binding-${parameter.id}`, symbol: parameter.semanticKey, kind: "parameter", targetId: parameter.id }))
    });
    expect(evaluation.status).toBe("satisfied");
  });

  it("converts compatible units", () => {
    const project = sample();
    const owner = find(project, "Joining module");
    const kg = owner.parameters[0];
    const grams: Parameter = { ...kg, id: "grams", name: "Mass limit", semanticKey: "limit", value: 420000, unit: "g" };
    owner.parameters.push(grams);
    expect(evaluateFormula(project, {
      expression: "@mass = @limit",
      bindings: [
        { id: "binding-kg", symbol: "mass", kind: "parameter", targetId: kg.id },
        { id: "binding-g", symbol: "limit", kind: "parameter", targetId: grams.id }
      ]
    }).status).toBe("satisfied");
  });

  it("rejects incompatible units and unsafe tokens", () => {
    const project = sample();
    const owner = find(project, "Joining module");
    const mass = owner.parameters[0];
    const time: Parameter = { ...mass, id: "time", semanticKey: "time", value: 2, unit: "h" };
    owner.parameters.push(time);
    expect(evaluateFormula(project, {
      expression: "@mass < @time",
      bindings: [
        { id: "mass", symbol: "mass", kind: "parameter", targetId: mass.id },
        { id: "time", symbol: "time", kind: "parameter", targetId: time.id }
      ]
    }).status).toBe("error");
    expect(evaluateFormula(project, { expression: "globalThis.alert(1) = 1", bindings: [] }).status).toBe("error");
  });

  it("marks missing future KPI results pending", () => {
    const project = sample();
    const evaluation = evaluateFormula(project, {
      expression: "@lead_time <= 20",
      bindings: [{ id: "kpi-binding", symbol: "lead_time", kind: "kpi", targetId: "kpi-lead-time" }]
    });
    expect(evaluation.status).toBe("pending");
    expect(evaluation.message).toMatch(/Stage-B KPI/);
  });

  it("keeps manually entered unassigned variables pending with an assignment reminder", () => {
    const evaluation = evaluateFormula(sample(), { expression: "@unassigned <= 20", bindings: [] });
    expect(evaluation.status).toBe("pending");
    expect(evaluation.message).toMatch(/Assign @unassigned/);
  });
});

describe("satisfaction and guided workflow", () => {
  it("propagates satisfying evidence through realized function-component pairs", () => {
    const project = sample();
    const requirement = find(project, "The system shall achieve target throughput");
    expect(requirementSatisfaction(project, requirement).status).toBe("satisfied");
    project.relationships = project.relationships.filter((relationship) =>
      !(relationship.sourceId === requirement.id && find(project, "Loading station").id === relationship.targetId)
    );
    expect(satisfactionEvidence(project, requirement, "industrialSystemComponent").map((element) => element.name)).toContain("Loading station");
    expect(requirementSatisfaction(project, requirement).status).toBe("satisfied");
    project.relationships = project.relationships.filter((relationship) =>
      !(relationship.sourceId === find(project, "Load components").id && find(project, "Loading station").id === relationship.targetId)
    );
    expect(requirementSatisfaction(project, requirement).status).toBe("satisfied");
    project.relationships = project.relationships.filter((relationship) =>
      !(relationship.sourceId === requirement.id && relationship.relationshipType === "satisfiedBy")
    );
    requirement.requirementFormula = undefined;
    expect(requirementSatisfaction(project, requirement).status).toBe("pending");
  });

  it("uses AND semantics for all requirements of a need", () => {
    const project = sample();
    const need = find(project, "Increased production throughput");
    const failing = structuredClone(find(project, "The system shall achieve target throughput"));
    failing.id = "requirement-failing";
    failing.name = "Additional failing requirement";
    failing.requirementFormula = { expression: "1 = 2", bindings: [] };
    project.elements.push(failing);
    project.relationships.push(relation(project, { id: "derive-failing", targetId: failing.id }));
    project.relationships
      .filter((relationship) => relationship.sourceId === find(project, "The system shall achieve target throughput").id && relationship.relationshipType === "satisfiedBy")
      .forEach((relationship, index) => project.relationships.push({ ...relationship, id: `failing-evidence-${index}`, sourceId: failing.id }));
    expect(needOrObjectiveSatisfaction(project, need).status).toBe("failed");
  });

  it("treats pending formulas as mission-not-fulfilled", () => {
    const project = sample();
    const requirement = find(project, "The system shall achieve target throughput");
    requirement.requirementFormula = {
      expression: "@future <= 20",
      bindings: [{ id: "future", symbol: "future", kind: "kpi", targetId: "kpi-lead-time" }]
    };
    const mission = project.elements.find((element) => element.elementType === "mission")!;
    expect(requirementSatisfaction(project, requirement).status).toBe("pending");
    expect(missionSatisfaction(project, mission).status).toBe("pending");
  });

  it("reports all 23 clickable non-blocking workflow steps", () => {
    const steps = calculateWorkflowProgress(sample());
    expect(steps).toHaveLength(23);
    expect(steps.map((step) => step.id)).toEqual(expect.arrayContaining(["missions", "soi", "working-scope", "process-item-flows", "process-sequence", "validation"]));
    expect(steps.every((step) => typeof step.complete === "number" && typeof step.total === "number")).toBe(true);
  });

  it("keeps process-flow and handoff completion separate", () => {
    const project = sample();
    const join = find(project, "Join components");
    const input = find(project, "Input component");
    project.relationships = project.relationships.filter((relationship) =>
      !(relationship.sourceId === join.id && relationship.targetId === input.id && relationship.relationshipType === "consumes")
    );
    const steps = calculateWorkflowProgress(project);
    expect(steps.find((step) => step.id === "process-item-flows")?.complete).toBeLessThan(
      steps.find((step) => step.id === "process-item-flows")!.total
    );
    expect(steps.find((step) => step.id === "process-sequence")?.complete).toBeLessThan(
      steps.find((step) => step.id === "process-sequence")!.total
    );
  });
});

describe("validation, architecture and cascade integrity", () => {
  it("has no mandatory errors in the scope-update sample", () => {
    expect(validateProject(sample()).filter((finding) => finding.severity === "error")).toEqual([]);
  });

  it("applies start, intermediate, end and isolated process-flow roles", () => {
    const project = sample();
    const start = find(project, "Load components");
    const intermediate = find(project, "Join components");
    const end = find(project, "Inspect assembly");
    project.relationships = project.relationships.filter((relationship) =>
      !(relationship.sourceId === start.id && relationship.relationshipType === "consumes")
    );
    expect(processFunctionFlowStatus(project, start.id)).toMatchObject({ role: "start", complete: true });
    expect(processFunctionFlowStatus(project, intermediate.id)).toMatchObject({ role: "intermediate", complete: true });
    expect(processFunctionFlowStatus(project, end.id)).toMatchObject({ role: "end", complete: true });
    project.relationships = project.relationships.filter((relationship) => relationship.relationshipType !== "precedes");
    expect(processFunctionFlowStatus(project, end.id)).toMatchObject({
      role: "isolated",
      complete: false,
      missingProduces: true
    });
  });

  it("requires a matching product handoff for every process precedence link", () => {
    const project = sample();
    const join = find(project, "Join components");
    const input = find(project, "Input component");
    const precedence = project.relationships.find((relationship) =>
      relationship.relationshipType === "precedes"
      && relationship.targetId === join.id
    )!;
    expect(processHandoffStatus(project, precedence).complete).toBe(true);
    project.relationships = project.relationships.filter((relationship) =>
      !(relationship.sourceId === join.id && relationship.targetId === input.id && relationship.relationshipType === "consumes")
    );
    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      ruleId: "PMA-154",
      severity: "error",
      affectedRelationshipIds: [precedence.id]
    }));
  });

  it("reports handoff unit mismatches as errors and quantity mismatches as warnings", () => {
    const unitProject = sample();
    const unitFlow = unitProject.relationships.find((relationship) =>
      relationship.sourceId === find(unitProject, "Join components").id
      && relationship.targetId === find(unitProject, "Input component").id
      && relationship.relationshipType === "consumes"
    )!;
    unitFlow.unit = "kg";
    expect(validateProject(unitProject)).toContainEqual(expect.objectContaining({
      ruleId: "PMA-155",
      severity: "error"
    }));

    const quantityProject = sample();
    const quantityFlow = quantityProject.relationships.find((relationship) =>
      relationship.sourceId === find(quantityProject, "Join components").id
      && relationship.targetId === find(quantityProject, "Input component").id
      && relationship.relationshipType === "consumes"
    )!;
    quantityFlow.quantity = 2;
    const findings = validateProject(quantityProject);
    expect(findings).toContainEqual(expect.objectContaining({
      ruleId: "PMA-156",
      severity: "warning"
    }));
    expect(findings.some((finding) => finding.ruleId === "PMA-155")).toBe(false);
  });

  it("enforces exactly one system of interest", () => {
    const project = sample();
    project.elements = project.elements.filter((element) => element.elementType !== "system");
    expect(validateProject(project).some((finding) => finding.ruleId === "PMA-012")).toBe(true);
  });

  it("requires the canonical mission-to-system hasSOI link", () => {
    const project = sample();
    project.relationships = project.relationships.filter((relationship) => relationship.relationshipType !== "hasSOI");
    expect(validateProject(project)).toContainEqual(expect.objectContaining({
      ruleId: "PMA-CTX-001",
      severity: "warning"
    }));
  });

  it("validates required reusable custom attributes", () => {
    const project = sample();
    project.customAttributeDefinitions.push({
      id: "attribute-criticality",
      elementType: "systemRequirement",
      name: "Criticality",
      dataType: "string",
      required: true,
      defaultValue: null,
      description: ""
    });
    expect(validateProject(project).some((finding) => finding.ruleId === "PMA-018")).toBe(true);
  });

  it("preserves common elements under architecture filtering", () => {
    const project = sample();
    const need = project.elements.find((element) => element.elementType === "need")!;
    const specific: ModelElement = { ...need, id: "specific", architectureScope: "specific", architectureId: "arch-manual" };
    expect(architectureApplies(need, "arch-auto")).toBe(true);
    expect(architectureApplies(specific, "arch-auto")).toBe(false);
  });

  it("detects inconsistent scope and process cycles", () => {
    const project = sample();
    project.elements[0] = { ...project.elements[0], architectureScope: "specific", architectureId: undefined };
    const first = find(project, "Load components");
    const last = find(project, "Inspect assembly");
    project.relationships.push(relation(project, { id: "cycle", relationshipType: "precedes", sourceId: last.id, targetId: first.id, sequenceId: "sequence-process-assembly" }));
    expect(findProcessCycle(project)).not.toBeNull();
    const findings = validateProject(project);
    expect(findings.some((finding) => finding.ruleId === "PMA-008")).toBe(true);
    expect(findings.some((finding) => finding.ruleId === "PMA-006")).toBe(true);
  });

  it("cascades relationships and formula bindings when an element is deleted", () => {
    const project = sample();
    const component = find(project, "Material handling module");
    const parameterId = component.parameters[0].id;
    const next = deleteElementCascade(project, component.id);
    expect(next.elements.some((element) => element.id === component.id)).toBe(false);
    expect(next.relationships.some((edge) => edge.sourceId === component.id || edge.targetId === component.id)).toBe(false);
    expect(next.elements.flatMap((element) => element.requirementFormula?.bindings ?? []).some((binding) => binding.targetId === parameterId)).toBe(false);
  });
});

describe("metrics and maturity", () => {
  it("calculates all six updated traceability metrics", () => {
    const metrics = calculateTraceabilityMetrics(sample());
    expect(metrics).toHaveLength(6);
    expect(metrics.find((metric) => metric.id === "end-to-end")?.value).toBe(100);
    metrics.forEach((metric) => expect(metric.formula.length).toBeGreaterThan(5));
  });

  it("handles zero denominators and renormalizes maturity", () => {
    const project = sample();
    project.elements = [];
    project.relationships = [];
    calculateTraceabilityMetrics(project).forEach((metric) => {
      expect(metric.value).toBeNull();
      expect(metric.explanation).toMatch(/Not available/);
    });
    const maturity = calculateMaturity(project);
    expect(maturity.overall).toBeNull();
    expect(maturity.formula).toMatch(/renormalized/);
  });
});

describe("calculated parameters and contextual sequences", () => {
  it("supports project-defined unit dimensions and SI conversion factors", () => {
    const project = sample();
    project.unitDefinitions.push({
      id: "unit-ft", symbol: "ft", name: "foot", quantityName: "length",
      dimension: { length: 1 }, factorToSI: 0.3048, aliases: ["foot"]
    });
    expect(parseUnit("ft", project.unitDefinitions)).toEqual({ dimension: { length: 1 }, factor: 0.3048 });
    expect(parseUnit("ft/s", project.unitDefinitions).dimension).toEqual({ length: 1, time: -1 });
  });

  it("calculates a parent parameter from transitive refiners with dimensional conversion", () => {
    const project = sample();
    const parent = find(project, "Material handling module");
    const childA = structuredClone(find(project, "Input component"));
    const childB = structuredClone(find(project, "Assembled product"));
    childA.id = "component-child-a";
    childB.id = "component-child-b";
    const childParameter = (ownerId: string, id: string, value: number, unit: string): Parameter => ({
      id, ownerElementId: ownerId, name: "Length", semanticKey: "length", description: "", dataType: "number",
      value, unit, valueOrigin: "entered", applicableConfigurationIds: []
    });
    childA.parameters = [childParameter(childA.id, "length-a", 100, "cm")];
    childB.parameters = [childParameter(childB.id, "length-b", 1, "m")];
    project.elements.push(childA, childB);
    project.relationships.push(
      relation(project, { id: "refine-a", relationshipType: "refines", sourceId: childA.id, targetId: parent.id }),
      relation(project, { id: "refine-b", relationshipType: "refines", sourceId: childB.id, targetId: parent.id })
    );
    parent.parameters.push({
      id: "total-length", ownerElementId: parent.id, name: "Total length", semanticKey: "total_length",
      description: "", dataType: "number", value: null, unit: "m", valueOrigin: "calculated", applicableConfigurationIds: [],
      calculation: {
        expression: "@a + @b",
        requestedUnit: "m",
        bindings: [
          { id: "binding-a", symbol: "a", kind: "parameter", targetId: "length-a" },
          { id: "binding-b", symbol: "b", kind: "parameter", targetId: "length-b" }
        ]
      }
    });
    const calculated = recalculateCalculatedParameters(project);
    const result = find(calculated, "Material handling module").parameters.find((parameter) => parameter.id === "total-length")!;
    expect(result).toMatchObject({ value: 2, unit: "m", calculationStatus: "calculated" });
  });

  it("supports powers, sqrt, pending variables and dependency-cycle detection", () => {
    const project = sample();
    const owner = find(project, "Joining module");
    const length = owner.parameters[0];
    length.name = "Length";
    length.semanticKey = "length";
    length.value = 2;
    length.unit = "m";
    owner.parameters.push({
      ...length, id: "area", name: "Area", semanticKey: "area", value: null, valueOrigin: "calculated",
      calculation: { expression: "@length ^ 2", bindings: [{ id: "length-binding", symbol: "length", kind: "parameter", targetId: length.id }] }
    });
    owner.parameters.push({
      ...length, id: "root", name: "Root", semanticKey: "root", value: null, valueOrigin: "calculated",
      calculation: { expression: "sqrt(@area)", bindings: [{ id: "area-binding", symbol: "area", kind: "parameter", targetId: "area" }] }
    });
    owner.parameters.push({
      ...length, id: "pending", name: "Pending", semanticKey: "pending", value: null, valueOrigin: "calculated",
      calculation: { expression: "@missing + 1", bindings: [] }
    });
    owner.parameters.push({
      ...length, id: "cycle-a", name: "Cycle A", semanticKey: "cycle_a", value: null, valueOrigin: "calculated",
      calculation: { expression: "@b + 1", bindings: [{ id: "bind-cycle-b", symbol: "b", kind: "parameter", targetId: "cycle-b" }] }
    });
    owner.parameters.push({
      ...length, id: "cycle-b", name: "Cycle B", semanticKey: "cycle_b", value: null, valueOrigin: "calculated",
      calculation: { expression: "@a + 1", bindings: [{ id: "bind-cycle-a", symbol: "a", kind: "parameter", targetId: "cycle-a" }] }
    });
    const calculated = recalculateCalculatedParameters(project);
    expect(owner.id && find(calculated, "Joining module").parameters.find((parameter) => parameter.id === "area")).toMatchObject({ value: 4, unit: "m²", calculationStatus: "calculated" });
    expect(find(calculated, "Joining module").parameters.find((parameter) => parameter.id === "root")).toMatchObject({ value: 2, unit: "m", calculationStatus: "calculated" });
    expect(find(calculated, "Joining module").parameters.find((parameter) => parameter.id === "pending")?.calculationStatus).toBe("pending");
    expect(find(calculated, "Joining module").parameters.find((parameter) => parameter.id === "cycle-a")?.calculationStatus).toBe("error");
  });

  it("derives stable stages for parallel AND branches and rejects cycles", () => {
    const project = sample();
    const sequence = project.functionSequences.find((item) => item.domain === "product")!;
    const handle = find(project, "Handle product");
    const join = find(project, "Join product");
    const inspect = find(project, "Inspect product");
    project.relationships = project.relationships.filter((relationship) => relationship.sequenceId !== sequence.id);
    project.relationships.push(
      relation(project, { id: "parallel-a", relationshipType: "precedes", sourceId: handle.id, targetId: join.id, sequenceId: sequence.id }),
      relation(project, { id: "parallel-b", relationshipType: "precedes", sourceId: handle.id, targetId: inspect.id, sequenceId: sequence.id })
    );
    sequence.relationshipIds = ["parallel-a", "parallel-b"];
    const analysis = analyzeSequence(project, sequence);
    expect([analysis.stageLabels[join.id], analysis.stageLabels[inspect.id]].sort()).toEqual(["2A", "2B"]);
    project.relationships.push(relation(project, { id: "sequence-cycle", relationshipType: "precedes", sourceId: join.id, targetId: handle.id, sequenceId: sequence.id }));
    expect(analyzeSequence(project, sequence).errors).toContain("The sequence contains a cycle.");
  });
});

describe("schema-1 to current persistence migration", () => {
  const state = (): PersistedAppState => ({
    schemaVersion: 1,
    activeProjectId: "project-sample",
    projects: [{ ...sample(), schemaVersion: 1 }],
    snapshots: [],
    uiPreferences: {
      activeWorkspace: "dashboard",
      activeModelTab: "mission-context",
      activeModelView: "table",
      tableSortModeByType: {},
      graphLayoutModeByTab: {},
      detailsPanelOpen: true,
      validationSeverity: "all",
      validationCategory: "all",
      validationDomain: "all",
      variationPointView: "graph",
      variationGraphSections: [],
      variationGraphElementTypes: [],
      activeVariabilityTab: "Feature Model",
      activeTradeStudyTab: "Guided Workflow",
      tradeStudyView: "manager"
    }
  });

  it("migrates the amended schema-1 model without losing project or element IDs", () => {
    const original = state();
    const migrated = migratePersistedState(JSON.parse(serializeState(original)) as unknown);
    expect(migrated.schemaVersion).toBe(14);
    expect(migrated.projects[0].schemaVersion).toBe(14);
    expect(migrated.projects[0].id).toBe(original.projects[0].id);
    expect(migrated.projects[0].elements.map((element) => element.id)).toEqual(original.projects[0].elements.map((element) => element.id));
  });

  it("normalizes legacy element names, directions and tabs while advancing the root version", () => {
    const legacy = state() as unknown as {
      schemaVersion: number;
      activeProjectId: string;
      projects: Array<Project & { elements: Array<ModelElement & { elementType: string }> }>;
      snapshots: [];
      uiPreferences: { activeWorkspace: "dashboard"; activeModelTab: string; detailsPanelOpen: true };
    };
    const project = legacy.projects[0];
    const requirement = find(project, "The system shall achieve target throughput");
    const productFunction = find(project, "Handle product");
    (requirement as unknown as { elementType: string }).elementType = "requirement";
    (productFunction as unknown as { elementType: string }).elementType = "function";
    const relationship = project.relationships.find((item) => item.sourceId === requirement.id && item.targetId === productFunction.id)!;
    relationship.sourceId = productFunction.id;
    relationship.targetId = requirement.id;
    (relationship as unknown as { relationshipType: string }).relationshipType = "realizes";
    legacy.uiPreferences.activeModelTab = "needs-requirements";
    const migrated = migratePersistedState(legacy);
    expect(migrated.schemaVersion).toBe(14);
    expect(migrated.uiPreferences.activeModelTab).toBe("mission-context");
    expect(find(migrated.projects[0], requirement.name).elementType).toBe("systemRequirement");
    const normalized = migrated.projects[0].relationships.find((item) => item.id === relationship.id)!;
    expect(normalized).toMatchObject({ sourceId: requirement.id, targetId: productFunction.id, relationshipType: "satisfiedBy" });
  });

  it("keeps corrupt storage available for recovery", () => {
    const storage = { getItem: (key: string) => key === STORAGE_KEY ? "{broken" : null };
    const loaded = loadPersistedState(storage);
    expect(loaded.state).toBeUndefined();
    expect(loaded.corruptRaw).toBe("{broken");
  });

  it("preserves Stage-B/C structures", () => {
    const project = sample();
    expect(project.schemaVersion).toBe(14);
    expect(project.configurations).toHaveLength(3);
    expect(project.features.length).toBeGreaterThanOrEqual(10);
    expect(project.kpis.length).toBeGreaterThanOrEqual(7);
  });
});
