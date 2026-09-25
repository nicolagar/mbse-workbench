import { physicalHierarchyErrors } from "./ontology";
import { evaluateRequirement } from "./formulas";
import { comparisonStatus, validateComparisonStudy } from "./comparison";
import { FeatureExpressionError, parseFeatureExpression } from "./featureExpressions";
import { formulaReferences, kpiDependencyCycle, parseKpiFormula } from "./kpiFormulas";
import {
  processFunctionFlowStatus,
  processHandoffStatus,
  processPrecedenceRelationships
} from "./processFlows";
import { allowedRelationships } from "./relationships";
import { analyzeSequence } from "./sequences";
import { satisfactionEvidence } from "./traceability";
import { validateTradeStudyReferences } from "./tradeStudy";
import type {
  ElementType,
  ModelElement,
  Project,
  Relationship,
  ValidationCategory,
  ValidationResult,
  ValidationSeverity
} from "./types";
import { parseUnit, validateUnitDefinition } from "./units";
import { featureHierarchyCycle, validateConfiguration } from "./variability";
import { validateVariationPoints } from "./variationPoints";

const result = (
  ruleId: string,
  severity: ValidationSeverity,
  title: string,
  message: string,
  category: ValidationCategory,
  affectedElementIds: string[] = [],
  affectedRelationshipIds: string[] = []
): ValidationResult => ({
  id: `${ruleId}-${affectedElementIds.join("-") || affectedRelationshipIds.join("-") || "project"}`,
  ruleId,
  severity,
  title,
  message,
  category,
  affectedElementIds,
  affectedRelationshipIds,
  resolved: false
});

const ofType = (project: Project, type: ElementType) =>
  project.elements.filter((element) => element.elementType === type);

const outgoing = (project: Project, elementId: string, relationshipType: Relationship["relationshipType"], targetType?: ElementType) =>
  project.relationships.filter((relationship) => {
    if (relationship.sourceId !== elementId || relationship.relationshipType !== relationshipType) return false;
    return !targetType || project.elements.find((element) => element.id === relationship.targetId)?.elementType === targetType;
  });

export function findProcessCycle(project: Project): string[] | null {
  const processes = new Set(ofType(project, "processFunction").map((element) => element.id));
  const grouped = new Map<string, Relationship[]>();
  project.relationships
    .filter((relationship) =>
      relationship.relationshipType === "precedes"
      && processes.has(relationship.sourceId)
      && processes.has(relationship.targetId)
    )
    .forEach((relationship) => {
      const key = relationship.sequenceId ?? "unscoped";
      grouped.set(key, [...(grouped.get(key) ?? []), relationship]);
    });
  for (const relationships of grouped.values()) {
    const graph = new Map<string, string[]>();
    relationships.forEach((relationship) =>
      graph.set(relationship.sourceId, [...(graph.get(relationship.sourceId) ?? []), relationship.targetId])
    );
    const visited = new Set<string>();
    const stack = new Set<string>();
    const trail: string[] = [];
    const visit = (node: string): string[] | null => {
      if (stack.has(node)) return [...trail.slice(trail.indexOf(node)), node];
      if (visited.has(node)) return null;
      visited.add(node);
      stack.add(node);
      trail.push(node);
      for (const next of graph.get(node) ?? []) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
      trail.pop();
      stack.delete(node);
      return null;
    };
    for (const node of processes) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

function relationshipErrors(project: Project, relationship: Relationship): ValidationResult[] {
  const findings: ValidationResult[] = [];
  const source = project.elements.find((element) => element.id === relationship.sourceId);
  const target = project.elements.find((element) => element.id === relationship.targetId);
  if (!source || !target) {
    findings.push(result(
      "PMA-002",
      "error",
      "Broken relationship",
      "The relationship references a missing source or target.",
      "relationship",
      [],
      [relationship.id]
    ));
    return findings;
  }
  if (!allowedRelationships.some(([sourceType, relationshipType, targetType]) =>
    sourceType === source.elementType
    && relationshipType === relationship.relationshipType
    && targetType === target.elementType
  )) {
    findings.push(result(
      "PMA-003",
      "error",
      "Invalid relationship combination",
      `${source.elementType} cannot ${relationship.relationshipType} ${target.elementType}.`,
      "relationship",
      [source.id, target.id],
      [relationship.id]
    ));
  }
  const quantity = relationship.quantity ?? relationship.requiredQuantity;
  const itemFlow = ["consumes", "produces"].includes(relationship.relationshipType);
  if (
    (itemFlow && quantity === undefined)
    || (["requiresResource", "consumes", "produces"].includes(relationship.relationshipType)
      && quantity !== undefined
      && (!Number.isFinite(quantity) || quantity <= 0))
  ) {
    findings.push(result(
      "PMA-005",
      "error",
      "Invalid relationship quantity",
      "Every item flow requires a finite quantity greater than zero; supplied resource quantities must also be positive.",
      "relationship",
      [source.id, target.id],
      [relationship.id]
    ));
  }
  if (itemFlow && !relationship.unit?.trim()) {
    findings.push(result(
      "PMA-016",
      "error",
      "Item-flow unit missing",
      "A consumes or produces quantity must declare its unit.",
      "relationship",
      [source.id, target.id],
      [relationship.id]
    ));
  }
  if (relationship.relationshipType === "precedes" && (!relationship.sequenceId || !project.functionSequences.some((sequence) => sequence.id === relationship.sequenceId))) {
    findings.push(result(
      "PMA-151",
      "error",
      "Unscoped precedence relationship",
      "Every function precedence relationship must belong to a named contextual sequence.",
      "process",
      [source.id, target.id],
      [relationship.id]
    ));
  }
  return findings;
}

/** Failed or pending engineering checks are assessed separately from model consistency. */
export const modelConsistencyErrors = (findings: ValidationResult[]) => findings.filter((finding) => finding.severity === "error" && !["PMA-130", "PMA-131"].includes(finding.ruleId));

export function validateProject(project: Project): ValidationResult[] {
  const findings: ValidationResult[] = physicalHierarchyErrors(project.elements).map((message, index) => result(`PMA-HIERARCHY-${index}`, "error", "Physical containment", message, "relationship", []));
  for (const element of project.elements) {
    const references = [["subjectSystemId", "system"], ["architectureRootId", "productComponent"]] as const;
    for (const [key, type] of references) if (element.metadata[key] && !project.elements.some((item) => item.id === element.metadata[key] && item.elementType === type)) findings.push(result("PMA-CONTEXT", "error", "Missing context reference", `${element.name}: ${key} must reference an existing ${type}.`, "relationship", [element.id]));
    if (project.relationships.filter((edge) => edge.containment && edge.sourceId === element.id).length > 1) findings.push(result("PMA-PARENTS", "error", "Multiple physical parents", `${element.name} has more than one physical parent assembly.`, "relationship", [element.id]));
  }
  const allIds = [
    ...project.architectures.map((architecture) => architecture.id),
    ...project.elements.map((element) => element.id),
    ...project.relationships.map((relationship) => relationship.id),
    ...project.functionSequences.map((sequence) => sequence.id),
    ...project.unitDefinitions.map((definition) => definition.id),
    ...project.elements.flatMap((element) => element.parameters.map((parameter) => parameter.id)),
    ...project.customAttributeDefinitions.map((definition) => definition.id)
    , ...project.features.map((feature) => feature.id)
    , ...project.featureConstraints.map((constraint) => constraint.id)
    , ...project.configurations.map((configuration) => configuration.id)
    , ...project.kpis.map((kpi) => kpi.id)
    , ...project.simulationRuns.map((run) => run.id)
    , ...project.comparisonStudies.map((study) => study.id)
    , ...project.comparisonStudies.flatMap((study) => study.results.map((comparison) => comparison.id))
    , ...project.comparisonRisks.map((risk) => risk.id)
    , ...project.decisions.map((decision) => decision.id)
  ];
  const duplicateIds = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];
  if (duplicateIds.length) {
    findings.push(result("PMA-001", "error", "Duplicate IDs", `Duplicate IDs: ${duplicateIds.join(", ")}`, "identity"));
  }
  project.relationships.forEach((relationship) => findings.push(...relationshipErrors(project, relationship)));
  project.functionSequences.forEach((sequence) => {
    analyzeSequence(project, sequence).errors.forEach((message, index) => {
      findings.push(result(`PMA-14${index}`, "error", "Function-sequence validation", message, "process", sequence.functionIds, sequence.relationshipIds));
    });
  });
  project.unitDefinitions.forEach((definition) => {
    const error = validateUnitDefinition(definition, project.unitDefinitions);
    if (error) findings.push(result("PMA-145", "error", "Custom unit definition", error, "parameter"));
  });
  if (findProcessCycle(project)) {
    findings.push(result("PMA-006", "error", "Process sequence cycle", "Process-function precedence must remain acyclic.", "process"));
  }
  ofType(project, "processFunction").forEach((processFunction) => {
    const status = processFunctionFlowStatus(project, processFunction.id);
    if (status.missingConsumes) {
      const roles = status.roles.join("/");
      findings.push(result(
        "PMA-152",
        "error",
        "Required process input missing",
        `${roles[0].toUpperCase()}${roles.slice(1)} process function “${processFunction.name}” must consume at least one valid product flow.`,
        "process",
        [processFunction.id]
      ));
    }
    if (status.missingProduces) {
      const roles = status.roles.join("/");
      findings.push(result(
        "PMA-153",
        "error",
        "Required process output missing",
        `${roles[0].toUpperCase()}${roles.slice(1)} process function “${processFunction.name}” must produce at least one valid product flow.`,
        "process",
        [processFunction.id]
      ));
    }
  });
  processPrecedenceRelationships(project).forEach((precedence) => {
    const status = processHandoffStatus(project, precedence);
    const predecessor = project.elements.find((element) => element.id === precedence.sourceId);
    const successor = project.elements.find((element) => element.id === precedence.targetId);
    if (!status.matchedComponentIds.length) {
      findings.push(result(
        "PMA-154",
        "error",
        "Process handoff missing",
        `“${predecessor?.name ?? precedence.sourceId}” must produce at least one product component consumed by “${successor?.name ?? precedence.targetId}”.`,
        "process",
        [precedence.sourceId, precedence.targetId],
        [precedence.id]
      ));
    }
    if (status.unitMismatchComponentIds.length) {
      const componentNames = status.unitMismatchComponentIds.map((id) =>
        project.elements.find((element) => element.id === id)?.name ?? id
      );
      findings.push(result(
        "PMA-155",
        "error",
        "Process handoff unit mismatch",
        `The predecessor output and successor input units must match for: ${componentNames.join(", ")}.`,
        "process",
        [precedence.sourceId, precedence.targetId, ...status.unitMismatchComponentIds],
        [
          precedence.id,
          ...status.produced.filter((flow) => status.unitMismatchComponentIds.includes(flow.targetId)).map((flow) => flow.id),
          ...status.consumed.filter((flow) => status.unitMismatchComponentIds.includes(flow.targetId)).map((flow) => flow.id)
        ]
      ));
    }
    if (status.quantityMismatchComponentIds.length) {
      const componentNames = status.quantityMismatchComponentIds.map((id) =>
        project.elements.find((element) => element.id === id)?.name ?? id
      );
      findings.push(result(
        "PMA-156",
        "warning",
        "Process handoff quantity mismatch",
        `Review the predecessor output and successor input quantities for: ${componentNames.join(", ")}. Split, merge and transformation flows are permitted.`,
        "process",
        [precedence.sourceId, precedence.targetId, ...status.quantityMismatchComponentIds],
        [
          precedence.id,
          ...status.produced.filter((flow) => status.quantityMismatchComponentIds.includes(flow.targetId)).map((flow) => flow.id),
          ...status.consumed.filter((flow) => status.quantityMismatchComponentIds.includes(flow.targetId)).map((flow) => flow.id)
        ]
      ));
    }
  });

  const systemsOfInterest = ofType(project, "system");
  if (systemsOfInterest.length !== 1) {
    findings.push(result(
      "PMA-012",
      "error",
      "System of interest designation",
      "Define exactly one system of interest, separately from its stakeholders.",
      "completeness",
      systemsOfInterest.map((element) => element.id)
    ));
  }
  const systemOfInterest = systemsOfInterest[0];
  if (systemOfInterest) {
    const missionLinks = project.relationships.filter((relationship) => relationship.relationshipType === "hasSOI" && relationship.targetId === systemOfInterest.id);
    if (!missionLinks.length) findings.push(result("PMA-CTX-001", "warning", "System mission missing", "Connect the mission to the system of interest with hasSOI.", "traceability", [systemOfInterest.id]));
    if (missionLinks.length > 1) findings.push(result("PMA-CTX-006", "error", "Multiple system missions", "The system of interest must have exactly one incoming hasSOI relationship.", "traceability", [systemOfInterest.id, ...missionLinks.map((relationship) => relationship.sourceId)]));
    if (!systemOfInterest.metadata.architectureRootId) findings.push(result("PMA-CTX-002", "warning", "System representation missing", "Identify the product assembly that represents the system of interest.", "traceability", [systemOfInterest.id]));
    if (!systemOfInterest.metadata.systemBoundary?.trim()) findings.push(result("PMA-CTX-003", "warning", "System boundary missing", "State what is inside and outside the system-of-interest boundary.", "completeness", [systemOfInterest.id]));
    const involved = new Set(ofType(project, "useCase").filter((item) => item.metadata.subjectSystemId === systemOfInterest.id).map((item) => item.id));
    project.selectedUseCaseIds.filter((id) => !involved.has(id)).forEach((id) => {
      findings.push(result("PMA-146", "error", "Working use case outside system-of-interest scope", "Every selected working use case must identify the system of interest as its subject.", "traceability", [systemOfInterest.id, id]));
    });
  }
  ofType(project, "externalSystem").forEach((external) => {
    if (!project.relationships.some((relationship) => relationship.relationshipType === "participatesInMission" && relationship.targetId === external.id)) {
      findings.push(result("PMA-CTX-005", "warning", "External system without mission", `${external.name}: connect the mission to this external system using participatesInMission.`, "traceability", [external.id]));
    }
    if (!project.relationships.some((relationship) => (relationship.sourceId === external.id || relationship.targetId === external.id) && ["connects", "involvedIn"].includes(relationship.relationshipType))) {
      findings.push(result("PMA-CTX-004", "warning", "External system without interaction", `${external.name}: connect it to an interface or participating use case.`, "traceability", [external.id]));
    }
  });

  ofType(project, "mission").forEach((mission) => {
    if (!outgoing(project, mission.id, "hasStakeholder", "stakeholder").length) {
      findings.push(result("PMA-013", "error", "Mission without stakeholder", "Every mission requires at least one stakeholder.", "traceability", [mission.id]));
    }
  });
  ofType(project, "stakeholder").forEach((stakeholder) => {
    if (!project.relationships.some((relationship) =>
      relationship.relationshipType === "hasStakeholder" && relationship.targetId === stakeholder.id
    )) {
      findings.push(result("PMA-014", "error", "Stakeholder without mission", "Every stakeholder must be traced to at least one mission.", "traceability", [stakeholder.id]));
    }
    if (!outgoing(project, stakeholder.id, "involvedIn", "useCase").length) {
      findings.push(result("PMA-015", "error", "Stakeholder without use case", "Every stakeholder must be involved in at least one use case.", "traceability", [stakeholder.id]));
    }
  });
  ofType(project, "useCase").forEach((useCase) => {
    if (!project.relationships.some((relationship) =>
      relationship.relationshipType === "involvedIn" && relationship.targetId === useCase.id
    )) {
      findings.push(result("PMA-017", "error", "Use case without stakeholder", "Every use case requires at least one involved stakeholder.", "traceability", [useCase.id]));
    }
    if (project.selectedUseCaseIds.includes(useCase.id)) {
      const productFunctions = outgoing(project, useCase.id, "hasFunction", "productFunction");
      const processFunctions = outgoing(project, useCase.id, "hasFunction", "processFunction");
      if (!productFunctions.length && !processFunctions.length) {
        findings.push(result("PMA-147", "error", "Selected use case without function", "Connect the selected use case to at least one product or process function using hasFunction.", "traceability", [useCase.id]));
      }
    }
  });

  project.elements.forEach((element) => {
    const validArchitecture = project.architectures.some((architecture) => architecture.id === element.architectureId);
    if (
      (element.architectureScope === "common" && element.architectureId)
      || (element.architectureScope === "specific" && !validArchitecture)
    ) {
      findings.push(result(
        "PMA-008",
        "error",
        "Inconsistent architecture scope",
        "Common elements have no architecture ID; specific elements require a valid one.",
        "completeness",
        [element.id]
      ));
    }
    if (!element.name.trim()) findings.push(result("PMA-009", "error", "Missing name", "Every model element requires a name.", "completeness", [element.id]));
    if (!element.description.trim()) findings.push(result("PMA-101", "warning", "Missing description", "Add an engineering description.", "completeness", [element.id]));
    element.parameters.forEach((parameter) => {
      if (parameter.dataType === "number" && parameter.value !== null && !parameter.unit?.trim()) {
        findings.push(result("PMA-107", "warning", "Numeric parameter without unit", "Add a unit to the numeric value.", "parameter", [element.id]));
      }
      if (parameter.unit?.trim()) {
        try {
          parseUnit(parameter.unit, project.unitDefinitions);
        } catch (error) {
          findings.push(result("PMA-108", "error", "Invalid parameter unit", error instanceof Error ? error.message : "The unit is invalid.", "parameter", [element.id]));
        }
      }
      if (parameter.calculationStatus === "pending") {
        findings.push(result("PMA-149", "error", "Calculated parameter pending", `${parameter.name}: ${parameter.calculationMessage ?? "Assign all formula variables."}`, "formula", [element.id]));
      } else if (parameter.calculationStatus === "error") {
        findings.push(result("PMA-150", "error", "Calculated parameter invalid", `${parameter.name}: ${parameter.calculationMessage ?? "Correct the formula."}`, "formula", [element.id]));
      }
    });
    const parameterNames = element.parameters.map((parameter) => parameter.name.trim().toLowerCase());
    if (parameterNames.some((name, index) => parameterNames.indexOf(name) !== index)) {
      findings.push(result("PMA-111", "warning", "Duplicate parameter name", "Parameter names must be unique on an owner.", "parameter", [element.id]));
    }
    project.customAttributeDefinitions
      .filter((definition) => definition.elementType === element.elementType && definition.required)
      .forEach((definition) => {
        const value = element.customAttributeValues[definition.id];
        if (value === null || value === undefined || value === "") {
          findings.push(result(
            "PMA-018",
            "error",
            "Required custom attribute missing",
            `${definition.name} is required for ${element.elementType}.`,
            "completeness",
            [element.id]
          ));
        }
      });
    if (element.status === "draft") findings.push(result("PMA-201", "information", "Draft element", "This element remains in draft.", "completeness", [element.id]));
    if (!element.metadata.source && !element.metadata.owner && !element.tags.length) {
      findings.push(result("PMA-203", "information", "Provenance not recorded", "Add a source, owner, or tag.", "completeness", [element.id]));
    }
  });

  for (const type of ["need", "objective"] as const) {
    ofType(project, type).forEach((element) => {
      if (!outgoing(project, element.id, "derives", "systemRequirement").length) {
        findings.push(result(
          type === "need" ? "PMA-102" : "PMA-019",
          "error",
          `${type === "need" ? "Need" : "Objective"} without requirement`,
          `Every ${type} must derive at least one system requirement.`,
          "traceability",
          [element.id]
        ));
      }
    });
  }

  const satisfactionTypes: ElementType[] = [
    "productFunction",
    "productComponent",
    "processFunction",
    "industrialSystemComponent"
  ];
  ofType(project, "systemRequirement").forEach((requirement) => {
    const hasElementEvidence = satisfactionTypes.some((type) => satisfactionEvidence(project, requirement, type).length > 0);
    const hasParameterEvidence = requirement.requirementFormula?.bindings.some((binding) =>
      binding.kind === "parameter"
      && project.elements.some((owner) => owner.parameters.some((parameter) => parameter.id === binding.targetId))
    ) ?? false;
    if (!hasElementEvidence && !hasParameterEvidence) findings.push(result(
      "PMA-120",
      "error",
      "Requirement has no satisfaction evidence",
      "Link at least one product or process function, technical component, or owned parameter to the requirement using satisfiedBy.",
      "traceability",
      [requirement.id]
    ));
    const evaluation = evaluateRequirement(project, requirement);
    if (evaluation.status === "failed") {
      findings.push(result("PMA-130", "error", "Requirement formula failed", evaluation.message, "formula", [requirement.id]));
    } else if (evaluation.status === "pending") {
      findings.push(result("PMA-131", "error", "Requirement formula pending", `${evaluation.message} Pending counts as unsatisfied.`, "formula", [requirement.id]));
    } else if (evaluation.status === "error") {
      findings.push(result("PMA-132", "error", "Requirement formula invalid", evaluation.message, "formula", [requirement.id]));
    }
  });

  ofType(project, "productFunction").forEach((productFunction) => {
    if (!outgoing(project, productFunction.id, "realizedBy", "productComponent").length) {
      findings.push(result("PMA-103", "error", "Product function without component", "Every product function must be realized by a product component.", "traceability", [productFunction.id]));
    }
  });
  ofType(project, "processFunction").forEach((processFunction) => {
    if (!outgoing(project, processFunction.id, "realizedBy", "industrialSystemComponent").length) {
      findings.push(result("PMA-104", "error", "Process function without component", "Every process function must be realized by an industrial-system component.", "traceability", [processFunction.id]));
    }
    if (!elementPositiveDuration(processFunction)) {
      findings.push(result("PMA-106", "warning", "Process duration missing", "Add a positive process duration.", "process", [processFunction.id]));
    }
  });
  const realizingIndustrialComponentIds = new Set(project.relationships
    .filter((relationship) =>
      relationship.relationshipType === "realizedBy"
      && project.elements.some((element) => element.id === relationship.sourceId && element.elementType === "processFunction")
      && project.elements.some((element) => element.id === relationship.targetId && element.elementType === "industrialSystemComponent")
    )
    .map((relationship) => relationship.targetId));
  ofType(project, "industrialSystemComponent")
    .filter((component) => realizingIndustrialComponentIds.has(component.id))
    .forEach((component) => {
      if (!outgoing(project, component.id, "requiresResource", "resource").length) {
        findings.push(result("PMA-105", "warning", "Industrial component without resource", "Assign at least one required resource to each industrial-system component that realizes a process function.", "process", [component.id]));
      }
    });

  project.architectures.forEach((architecture) => {
    if (!project.elements.some((element) => element.architectureScope === "specific" && element.architectureId === architecture.id)) {
      findings.push(result("PMA-202", "information", "Architecture has no specific elements", "Assign architecture-specific elements to this concept.", "completeness", [architecture.id]));
    }
  });
  findings.push(...validateStageB(project));
  return findings;
}

function validateStageB(project: Project): ValidationResult[] {
  const findings: ValidationResult[] = [];
  const featureIds = new Set(project.features.map((feature) => feature.id));
  const roots = project.features.filter((feature) => feature.featureType === "root");
  const cycle = featureHierarchyCycle(project.features);
  if (cycle) {
    findings.push(result("PMB-001", "error", "Feature hierarchy cycle", `Feature hierarchy cycle: ${cycle.join(" → ")}.`, "feature"));
  }
  project.features.forEach((feature) => {
    if (feature.featureType !== "root" && (!feature.parentId || !featureIds.has(feature.parentId))) {
      findings.push(result("PMB-002", "error", "Missing feature parent", `Feature “${feature.name}” requires an existing parent.`, "feature"));
    }
    if (
      !Number.isFinite(feature.sortOrder)
      || /\s/.test(feature.id)
      || (["xor", "or"].includes(feature.featureType) ? !feature.groupId : !!feature.groupId)
    ) {
      findings.push(result("PMB-006", "error", "Invalid feature definition", `Feature “${feature.name}” has invalid ID, order, or group membership.`, "feature"));
    }
    if (
      (feature.valueType ?? "boolean") === "enumeration"
      && (!(feature.allowedValues?.length) || new Set(feature.allowedValues).size !== feature.allowedValues.length)
    ) {
      findings.push(result("PMB-026", "error", "Invalid enumeration feature", `Feature “${feature.name}” requires distinct allowed values.`, "feature"));
    }
  });
  if (project.features.length && roots.length !== 1) {
    findings.push(result("PMB-023", "error", "Feature root count", `Exactly one root feature is required; found ${roots.length}.`, "feature"));
  }
  const groups = new Map<string, Set<string>>();
  project.features.filter((feature) => feature.groupId).forEach((feature) => {
    const key = `${feature.parentId ?? ""}::${feature.groupId}`;
    groups.set(key, new Set([...(groups.get(key) ?? []), feature.featureType]));
  });
  for (const [key, types] of groups) {
    if (types.size > 1) findings.push(result("PMB-022", "error", "Mixed feature group", `Group ${key} mixes XOR and OR members.`, "feature"));
  }
  project.featureConstraints.forEach((constraint) => {
    if (
      !featureIds.has(constraint.sourceFeatureId)
      || !featureIds.has(constraint.targetFeatureId)
      || constraint.sourceFeatureId === constraint.targetFeatureId
    ) {
      findings.push(result("PMB-010", "error", "Invalid feature constraint", `Constraint “${constraint.id}” references a missing or identical feature.`, "feature"));
    }
  });
  const knownFeatures = project.features.map((feature) => ({ id: feature.id }));
  const existenceTargets = new Set(project.variationPoints
    .filter((variationPoint) => variationPoint.kind === "existence" && variationPoint.enabled)
    .flatMap((variationPoint) => variationPoint.constrainedElementIds));
  findings.push(...validateVariationPoints(project));
  project.elements.forEach((element) => {
    if (element.featureExpression?.trim()) {
      try {
        parseFeatureExpression(element.featureExpression, knownFeatures);
      } catch (error) {
        const ruleId = error instanceof FeatureExpressionError && error.kind === "unknownFeature" ? "PMB-004" : "PMB-003";
        findings.push(result(ruleId, "error", "Invalid feature expression", error instanceof Error ? error.message : "Invalid feature expression.", "feature", [element.id]));
      }
    } else if (!existenceTargets.has(element.id)) {
      findings.push(result("PMB-201", "information", "Common element", "Element is included in every compatible configuration.", "feature", [element.id]));
    }
    const names = element.parameters.map((parameter) => parameter.name.trim().toLowerCase());
    if (names.some((name, index) => names.indexOf(name) !== index)) {
      findings.push(result("PMB-111", "warning", "Duplicate parameter name on owner", `Parameter names on “${element.name}” should be unique.`, "parameter", [element.id]));
    }
    element.parameters.forEach((parameter) => {
      if (parameter.dataType === "number") {
        if (parameter.value !== null && (typeof parameter.value !== "number" || !Number.isFinite(parameter.value))) {
          findings.push(result("PMB-017", "error", "Invalid numeric parameter", `${parameter.name} must be finite or null.`, "parameter", [element.id]));
        }
        if (!parameter.unit?.trim()) findings.push(result("PMB-104", "warning", "Numeric parameter missing unit", `${parameter.name} has no unit.`, "parameter", [element.id]));
        if (
          typeof parameter.value === "number"
          && ((parameter.minimum !== undefined && parameter.value < parameter.minimum)
            || (parameter.maximum !== undefined && parameter.value > parameter.maximum))
        ) {
          findings.push(result("PMB-103", "warning", "Parameter outside recommended range", `${parameter.name} is outside its recommended range.`, "parameter", [element.id]));
        }
      }
      if (
        parameter.minimum !== undefined && parameter.maximum !== undefined && parameter.minimum > parameter.maximum
        || parameter.uncertaintyPercent !== undefined
          && (!Number.isFinite(parameter.uncertaintyPercent) || parameter.uncertaintyPercent < 0 || parameter.uncertaintyPercent > 100)
      ) {
        findings.push(result("PMB-017", "error", "Invalid parameter limits", `${parameter.name} has invalid range or uncertainty.`, "parameter", [element.id]));
      }
      const unknownConfigurations = parameter.applicableConfigurationIds.filter((id) =>
        !project.configurations.some((configuration) => configuration.id === id)
      );
      if (unknownConfigurations.length) {
        findings.push(result("PMB-020", "error", "Invalid configuration reference", `${parameter.name} references unknown configurations: ${unknownConfigurations.join(", ")}.`, "parameter", [element.id]));
      }
    });
    if (
      element.elementType === "processFunction"
      && (typeof element.metadata.duration !== "number"
        || !Number.isFinite(element.metadata.duration)
        || element.metadata.duration <= 0
        || !element.metadata.durationUnit)
    ) {
      findings.push(result("PMB-024", "error", "Invalid process duration", `Process “${element.name}” requires a positive authoritative duration and unit.`, "process", [element.id]));
    }
  });
  project.relationships.filter((relationship) => relationship.relationshipType === "requiresResource").forEach((relationship) => {
    if (
      relationship.requiredQuantity !== undefined
      && (!Number.isFinite(relationship.requiredQuantity) || relationship.requiredQuantity <= 0)
    ) {
      findings.push(result("PMB-019", "error", "Invalid resource-assignment quantity", "Required quantity must be finite and greater than zero.", "process", [], [relationship.id]));
    }
    if (relationship.requiredQuantity === undefined) {
      findings.push(result("PMB-107", "warning", "Resource quantity defaults to one", "This resource assignment defaults required quantity to one.", "process", [], [relationship.id]));
    }
  });
  project.configurations
    .filter((configuration) => configuration.validationStatus !== "invalid")
    .forEach((configuration) => findings.push(...validateConfiguration(project, configuration)
      .map((finding) => ({ ...finding, id: `${finding.id}-${configuration.id}` }))));

  project.kpis.forEach((kpi) => {
    kpi.objectiveIds.filter((objectiveId) =>
      !project.elements.some((element) => element.id === objectiveId && element.elementType === "objective")
    ).forEach((objectiveId) => findings.push(result(
      "PMC-311",
      "error",
      "KPI objective reference is missing",
      `KPI “${kpi.name}” references missing objective “${objectiveId}”.`,
      "comparison"
    )));
    if (
      (kpi.calculationMode === "formula" && (!kpi.formula || !!kpi.standardAlgorithmKey))
      || (kpi.calculationMode === "standardAlgorithm" && (!kpi.standardAlgorithmKey || !!kpi.formula))
    ) {
      findings.push(result("PMB-021", "error", "Inconsistent KPI mode", `KPI “${kpi.name}” has inconsistent calculation fields.`, "formula"));
      return;
    }
    if (kpi.calculationMode === "formula") {
      try {
        const references = formulaReferences(parseKpiFormula(kpi.formula!));
        references.parameterIds.filter((id) =>
          !project.elements.some((element) => element.parameters.some((parameter) => parameter.id === id))
        ).forEach((id) => findings.push(result("PMB-012", "error", "Missing parameter reference", `KPI “${kpi.name}” references missing parameter “${id}”.`, "formula")));
        references.kpiIds.filter((id) => !project.kpis.some((candidate) => candidate.id === id))
          .forEach((id) => findings.push(result("PMB-013", "error", "Missing KPI reference", `KPI “${kpi.name}” references missing KPI “${id}”.`, "formula")));
      } catch (error) {
        findings.push(result("PMB-011", "error", "KPI formula syntax error", error instanceof Error ? error.message : "Invalid formula.", "formula"));
      }
    }
  });
  const cycleKpis = project.kpis.map((kpi) => {
    if (kpi.calculationMode !== "formula" || !kpi.formula) return kpi;
    try {
      return { ...kpi, dependsOnKpiIds: formulaReferences(parseKpiFormula(kpi.formula)).kpiIds };
    } catch {
      return kpi;
    }
  });
  const kpiCycle = kpiDependencyCycle(cycleKpis);
  if (kpiCycle) findings.push(result("PMB-014", "error", "Circular KPI dependency", `Circular KPI dependency: ${kpiCycle.join(" → ")}.`, "formula"));
  project.configurations.filter((configuration) =>
    configuration.derivation && configuration.derivation.sourceModelRevision < project.modelRevision
  ).forEach((configuration) => findings.push(result("PMB-112", "warning", "Derivation is stale", `Derivation for “${configuration.name}” predates the current model revision.`, "feature")));
  project.simulationRuns.filter((run) => run.projectModelRevisionAtRun < project.modelRevision)
    .forEach((run) => findings.push(result("PMB-113", "warning", "Simulation run is stale", `Simulation “${run.name}” predates the current model revision.`, "formula")));
  project.comparisonStudies.forEach((study) => {
    findings.push(...validateComparisonStudy(project, study));
    findings.push(...validateTradeStudyReferences(project, study));
    study.results.filter((comparison) => comparisonStatus(project, study, comparison) === "Stale")
      .forEach((comparison) => findings.push(result(
        "PMC-110",
        "warning",
        "Comparison result is stale",
        `Comparison result from ${comparison.timestamp} must be explicitly rerun.`,
        "comparison"
      )));
  });
  project.decisions.forEach((decision) => {
    if (decision.status === "approved" && !decision.rationale?.trim()) {
      findings.push(result("PMC-015", "error", "Approved decision lacks rationale", `Decision “${decision.question}” requires rationale.`, "comparison"));
    } else if (!decision.rationale?.trim()) {
      findings.push(result("PMC-106", "warning", "Decision has no rationale", `Decision “${decision.question}” has no rationale.`, "comparison"));
    }
  });
  return findings;
}

const elementPositiveDuration = (element: ModelElement) =>
  typeof element.metadata.duration === "number" && Number.isFinite(element.metadata.duration) && element.metadata.duration > 0;

export function deleteElementCascade(project: Project, elementId: string): Project {
  const removedParameterIds = new Set(
    project.elements.find((element) => element.id === elementId)?.parameters.map((parameter) => parameter.id) ?? []
  );
  return {
    ...project,
    elements: project.elements
      .filter((element) => element.id !== elementId)
      .map((element) => ({
        ...element,
        metadata: Object.fromEntries(Object.entries(element.metadata).filter(([key, value]) => !["subjectSystemId", "architectureRootId", "missionId", "parentAssemblyId"].includes(key) || value !== elementId)),
        requirementFormula: element.requirementFormula
          ? {
              ...element.requirementFormula,
              bindings: element.requirementFormula.bindings.filter((binding) => !removedParameterIds.has(binding.targetId))
            }
          : undefined,
        parameters: element.parameters.map((parameter) => parameter.calculation
          ? {
              ...parameter,
              calculation: {
                ...parameter.calculation,
                bindings: parameter.calculation.bindings.filter((binding) => !removedParameterIds.has(binding.targetId))
              }
            }
          : parameter)
      })),
    relationships: project.relationships.filter((relationship) =>
      relationship.sourceId !== elementId && relationship.targetId !== elementId
    )
  };
}

export function architectureApplies(element: ModelElement, architectureId?: string): boolean {
  return element.architectureScope === "common" || !architectureId || element.architectureId === architectureId;
}
