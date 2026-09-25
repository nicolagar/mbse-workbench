import { evaluateFeatureExpression, FeatureExpressionError, parseFeatureExpression } from "./featureExpressions";
import type {
  AppliedVariation,
  Configuration,
  Feature,
  FeatureValue,
  FeatureValueCondition,
  ModelElement,
  Project,
  Relationship,
  ScalarValue,
  ValidationResult,
  VariationPoint,
  VariationPointKind,
  VariationValueRule
} from "./types";

export type PreviewStatus = "common" | "included" | "excluded" | "modified";

export interface VariationApplication {
  elements: ModelElement[];
  relationships: Relationship[];
  excludedElementIds: string[];
  removedRelationshipIds: string[];
  modifiedElementIds: string[];
  modifiedRelationshipIds: string[];
  appliedVariations: AppliedVariation[];
  elementStatus: Record<string, PreviewStatus>;
  relationshipStatus: Record<string, PreviewStatus>;
  errors: string[];
  warnings: string[];
}

const scalarEquals = (left: FeatureValue | undefined, right: FeatureValue) =>
  left === right;

export function effectiveFeatureValue(
  feature: Feature,
  configuration: Configuration
): FeatureValue {
  if ((feature.valueType ?? "boolean") === "boolean") {
    return configuration.effectiveSelectedFeatureIds.includes(feature.id);
  }
  return configuration.featureValues?.[feature.id] ?? feature.defaultValue ?? "";
}

export function featureValueConditionsMatch(
  conditions: FeatureValueCondition[],
  configuration: Configuration,
  features: Feature[]
): boolean {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  return conditions.every((condition) => {
    const feature = byId.get(condition.featureId);
    if (!feature) return false;
    const equal = scalarEquals(effectiveFeatureValue(feature, configuration), condition.value);
    return condition.operator === "equals" ? equal : !equal;
  });
}

export function variationConditionMatches(
  featureExpression: string,
  featureValueConditions: FeatureValueCondition[],
  configuration: Configuration,
  features: Feature[]
): boolean {
  const selected = new Set(configuration.effectiveSelectedFeatureIds);
  return evaluateFeatureExpression(featureExpression, selected, features)
    && featureValueConditionsMatch(featureValueConditions, configuration, features);
}

const elementPropertyAllowed = (kind: VariationPointKind, path?: string) => {
  if (!path) return false;
  if (kind === "primitiveProperty") {
    return ["name", "description", "status"].includes(path)
      || /^metadata:(duration|capacity|capacityHours|availabilityPercent|hourlyRate)$/.test(path)
      || /^parameter:[^:]+:value$/.test(path);
  }
  if (kind === "primitiveTag") return /^customAttribute:[^:]+$/.test(path) || path === "tags";
  return kind === "elementProperty" && path === "architectureId";
};

const relationshipPropertyAllowed = (kind: VariationPointKind, path?: string) => {
  if (!path) return false;
  if (kind === "primitiveProperty") {
    return ["name", "description", "requiredQuantity", "quantity", "unit", "itemFlowName"].includes(path);
  }
  return kind === "elementProperty" && ["sourceId", "targetId", "architectureId"].includes(path);
};

const readElementValue = (element: ModelElement, path: string): ScalarValue | string[] | undefined => {
  if (path.startsWith("metadata:")) {
    return element.metadata[path.slice("metadata:".length) as keyof typeof element.metadata] as ScalarValue | undefined;
  }
  if (path.startsWith("parameter:")) {
    const parameterId = path.split(":")[1];
    return element.parameters.find((parameter) => parameter.id === parameterId)?.value;
  }
  if (path.startsWith("customAttribute:")) return element.customAttributeValues[path.slice("customAttribute:".length)];
  if (path === "tags") return [...element.tags];
  return (element as unknown as Record<string, ScalarValue | undefined>)[path];
};

const writeElementValue = (element: ModelElement, path: string, value: ScalarValue | string[]): boolean => {
  if (path.startsWith("metadata:")) {
    const key = path.slice("metadata:".length);
    (element.metadata as Record<string, unknown>)[key] = value;
    return true;
  }
  if (path.startsWith("parameter:")) {
    const parameterId = path.split(":")[1];
    const parameter = element.parameters.find((candidate) => candidate.id === parameterId);
    if (!parameter || Array.isArray(value)) return false;
    parameter.value = value;
    return true;
  }
  if (path.startsWith("customAttribute:")) {
    if (Array.isArray(value)) return false;
    element.customAttributeValues[path.slice("customAttribute:".length)] = value;
    return true;
  }
  if (path === "tags") {
    if (!Array.isArray(value)) return false;
    element.tags = [...value];
    return true;
  }
  (element as unknown as Record<string, unknown>)[path] = value;
  return true;
};

const readRelationshipValue = (relationship: Relationship, path: string): ScalarValue | undefined =>
  (relationship as unknown as Record<string, ScalarValue | undefined>)[path];

const writeRelationshipValue = (relationship: Relationship, path: string, value: ScalarValue | string[]): boolean => {
  if (Array.isArray(value)) return false;
  (relationship as unknown as Record<string, unknown>)[path] = value;
  return true;
};

const matchingValueRule = (
  variationPoint: VariationPoint,
  configuration: Configuration,
  features: Feature[]
): VariationValueRule | undefined => {
  const defaults = variationPoint.valueRules.filter((rule) => rule.isDefault);
  if (defaults.length > 1) throw new Error("Only one default value rule is allowed.");
  const matches = variationPoint.valueRules.filter((rule) => !rule.isDefault && variationConditionMatches(rule.featureExpression, rule.featureValueConditions, configuration, features));
  if (new Set(matches.map((rule) => JSON.stringify(rule.value))).size > 1) throw new Error("Conflicting matching rules assign different values to the same target. Resolve the conflict before derivation.");
  if (matches.length) return matches[0];
  if (defaults[0]) return defaults[0];
  if (variationPoint.unmatchedBehavior === "error") throw new Error("No value rule matches. Define a default or explicitly retain the base value.");
  return undefined;
};

export function applyVariationPoints(
  project: Project,
  configuration: Configuration,
  source: { elements: ModelElement[]; relationships: Relationship[] }
): VariationApplication {
  const elements = structuredClone(source.elements);
  const relationships = structuredClone(source.relationships);
  const elementIds = new Set(elements.map((element) => element.id));
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const excludedElementIds = new Set<string>();
  const removedRelationshipIds = new Set<string>();
  const modifiedElementIds = new Set<string>();
  const modifiedRelationshipIds = new Set<string>();
  const constrainedElements = new Set<string>();
  const constrainedRelationships = new Set<string>();
  const appliedVariations: AppliedVariation[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const assignments = new Map<string, string>();
  const selectedScopes = new Set(configuration.realizationScopes ?? []);
  const enabled = project.variationPoints.filter((variationPoint) =>
    variationPoint.enabled
    && (!selectedScopes.size
      || (!(variationPoint.realizationScopes?.length) && !variationPoint.scope)
      || (variationPoint.realizationScopes?.some((scope) => selectedScopes.has(scope)) ?? false)
      || (!!variationPoint.scope && selectedScopes.has(variationPoint.scope)))
  );

  enabled.filter((variationPoint) => variationPoint.kind === "existence").forEach((variationPoint) => {
    variationPoint.constrainedElementIds.forEach((id) => constrainedElements.add(id));
    variationPoint.constrainedRelationshipIds.forEach((id) => constrainedRelationships.add(id));
    let included = false;
    try {
      included = variationConditionMatches(
        variationPoint.featureExpression,
        variationPoint.featureValueConditions,
        configuration,
        project.features
      );
    } catch (error) {
      errors.push(`${variationPoint.name}: ${error instanceof Error ? error.message : "Invalid variation condition."}`);
      return;
    }
    if (included) return;
    variationPoint.constrainedElementIds.filter((id) => elementIds.has(id)).forEach((id) => {
      excludedElementIds.add(id);
      appliedVariations.push({ variationPointId: variationPoint.id, targetKind: "element", targetId: id, effect: "removed" });
    });
    variationPoint.constrainedRelationshipIds.filter((id) => relationshipIds.has(id)).forEach((id) => {
      removedRelationshipIds.add(id);
      appliedVariations.push({ variationPointId: variationPoint.id, targetKind: "relationship", targetId: id, effect: "removed" });
    });
  });

  let cascadeRemovedCount = 0;
  relationships.forEach((relationship) => {
    if (excludedElementIds.has(relationship.sourceId) || excludedElementIds.has(relationship.targetId)) {
      if (!removedRelationshipIds.has(relationship.id)) cascadeRemovedCount += 1;
      removedRelationshipIds.add(relationship.id);
    }
  });

  enabled.filter((variationPoint) => variationPoint.kind !== "existence").forEach((variationPoint) => {
    let active = false;
    try {
      active = variationConditionMatches(
        variationPoint.featureExpression,
        variationPoint.featureValueConditions,
        configuration,
        project.features
      );
    } catch (error) {
      errors.push(`${variationPoint.name}: ${error instanceof Error ? error.message : "Invalid variation condition."}`);
      return;
    }
    if (!active) return;
    let rule: VariationValueRule | undefined;
    try {
      rule = matchingValueRule(variationPoint, configuration, project.features);
    } catch (error) {
      errors.push(`${variationPoint.name}: ${error instanceof Error ? error.message : "Invalid value rule."}`);
      return;
    }
    if (!rule || !variationPoint.propertyPath) {
      if (!rule) warnings.push(`${variationPoint.name}: no rule matched; retained the base value under its default policy.`);
      return;
    }
    const targetKeys = [...variationPoint.constrainedElementIds.filter((id) => !excludedElementIds.has(id)).map((id) => `element:${id}:${variationPoint.propertyPath}`), ...variationPoint.constrainedRelationshipIds.filter((id) => !removedRelationshipIds.has(id)).map((id) => `relationship:${id}:${variationPoint.propertyPath}`)];
    const valueKey = JSON.stringify(rule.value);
    if (targetKeys.some((key) => assignments.has(key) && assignments.get(key) !== valueKey)) { errors.push(`${variationPoint.name}: competing variation points assign different values to the same property.`); return; }
    targetKeys.forEach((key) => assignments.set(key, valueKey));
    if (variationPoint.kind === "elementProperty" && typeof rule.value !== "string") {
      errors.push(`${variationPoint.name}: element-property values must be existing model IDs.`);
      return;
    }
    if (
      variationPoint.kind === "elementProperty"
      && ["sourceId", "targetId"].includes(variationPoint.propertyPath)
      && !elementIds.has(String(rule.value))
    ) {
      errors.push(`${variationPoint.name}: ${String(rule.value)} is not an architecture-compatible target element.`);
      return;
    }
    variationPoint.constrainedElementIds.forEach((id) => {
      if (excludedElementIds.has(id)) return;
      const element = elements.find((candidate) => candidate.id === id);
      if (!element) return;
      const previousValue = readElementValue(element, variationPoint.propertyPath!);
      if (!writeElementValue(element, variationPoint.propertyPath!, rule!.value)) {
        errors.push(`${variationPoint.name}: value is incompatible with ${variationPoint.propertyPath}.`);
        return;
      }
      modifiedElementIds.add(id);
      appliedVariations.push({
        variationPointId: variationPoint.id,
        targetKind: "element",
        targetId: id,
        effect: "modified",
        propertyPath: variationPoint.propertyPath,
        previousValue,
        nextValue: rule.value
      });
    });
    variationPoint.constrainedRelationshipIds.forEach((id) => {
      if (removedRelationshipIds.has(id)) return;
      const relationship = relationships.find((candidate) => candidate.id === id);
      if (!relationship) return;
      const previousValue = readRelationshipValue(relationship, variationPoint.propertyPath!);
      if (!writeRelationshipValue(relationship, variationPoint.propertyPath!, rule!.value)) {
        errors.push(`${variationPoint.name}: value is incompatible with ${variationPoint.propertyPath}.`);
        return;
      }
      modifiedRelationshipIds.add(id);
      appliedVariations.push({
        variationPointId: variationPoint.id,
        targetKind: "relationship",
        targetId: id,
        effect: "modified",
        propertyPath: variationPoint.propertyPath,
        previousValue,
        nextValue: rule.value
      });
    });
  });

  const realizedElements = elements.filter((element) => !excludedElementIds.has(element.id));
  const realizedElementIds = new Set(realizedElements.map((element) => element.id));
  relationships.forEach((relationship) => {
    if (!realizedElementIds.has(relationship.sourceId) || !realizedElementIds.has(relationship.targetId)) {
      removedRelationshipIds.add(relationship.id);
    }
  });
  const realizedRelationships = relationships.filter((relationship) => !removedRelationshipIds.has(relationship.id));
  if (removedRelationshipIds.size) {
    warnings.push(`PMB-109: Realization removed ${removedRelationshipIds.size} relationship(s), including cascade cleanup.`);
  }
  if (cascadeRemovedCount) {
    warnings.push(`PMB-121: ${cascadeRemovedCount} relationship(s) were removed because an endpoint does not exist in this variant; review the remaining traceability for completeness.`);
  }

  const elementStatus: Record<string, PreviewStatus> = {};
  elements.forEach((element) => {
    elementStatus[element.id] = excludedElementIds.has(element.id)
      ? "excluded"
      : modifiedElementIds.has(element.id)
        ? "modified"
        : constrainedElements.has(element.id)
          ? "included"
          : "common";
  });
  const relationshipStatus: Record<string, PreviewStatus> = {};
  relationships.forEach((relationship) => {
    relationshipStatus[relationship.id] = removedRelationshipIds.has(relationship.id)
      ? "excluded"
      : modifiedRelationshipIds.has(relationship.id)
        ? "modified"
        : constrainedRelationships.has(relationship.id)
          ? "included"
          : "common";
  });
  return {
    elements: realizedElements,
    relationships: realizedRelationships,
    excludedElementIds: [...excludedElementIds],
    removedRelationshipIds: [...removedRelationshipIds],
    modifiedElementIds: [...modifiedElementIds],
    modifiedRelationshipIds: [...modifiedRelationshipIds],
    appliedVariations,
    elementStatus,
    relationshipStatus,
    errors,
    warnings
  };
}

const variationFinding = (
  ruleId: string,
  severity: "error" | "warning" | "information",
  title: string,
  message: string,
  elementIds: string[] = [],
  relationshipIds: string[] = []
): ValidationResult => ({
  id: `${ruleId}-${[...elementIds, ...relationshipIds].join("-") || title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  ruleId,
  severity,
  title,
  message,
  affectedElementIds: elementIds,
  affectedRelationshipIds: relationshipIds,
  category: "feature",
  resolved: false
});

export function validateVariationPoints(project: Project): ValidationResult[] {
  const findings: ValidationResult[] = [];
  const elementIds = new Set(project.elements.map((element) => element.id));
  const relationshipIds = new Set(project.relationships.map((relationship) => relationship.id));
  const featureIds = new Set(project.features.map((feature) => feature.id));
  const featuresById = new Map(project.features.map((feature) => [feature.id, feature]));
  const propertyClaims = new Map<string, string>();

  project.variationPoints.forEach((variationPoint) => {
    if (variationPoint.valueRules.filter((rule) => rule.isDefault).length > 1) findings.push(variationFinding("PMB-DEFAULT", "error", "Competing default values", `“${variationPoint.name}” has more than one default value rule.`));
    const missingElements = variationPoint.constrainedElementIds.filter((id) => !elementIds.has(id));
    const missingRelationships = variationPoint.constrainedRelationshipIds.filter((id) => !relationshipIds.has(id));
    if (missingElements.length || missingRelationships.length) {
      findings.push(variationFinding(
        "PMB-116",
        "error",
        "Broken variation target",
        `“${variationPoint.name}” references a target that no longer exists.`,
        missingElements,
        missingRelationships
      ));
    }
    if (!variationPoint.constrainedElementIds.length && !variationPoint.constrainedRelationshipIds.length) {
      findings.push(variationFinding("PMB-117", "error", "Empty variation point", `“${variationPoint.name}” has no constrained model element.`));
    }
    try {
      parseFeatureExpression(variationPoint.featureExpression, project.features);
      variationPoint.valueRules.forEach((rule) => parseFeatureExpression(rule.featureExpression, project.features));
    } catch (error) {
      const expressionError = error as FeatureExpressionError;
      findings.push(variationFinding(
        expressionError.kind === "unknownFeature" ? "PMB-004" : "PMB-003",
        "error",
        "Invalid variation condition",
        `“${variationPoint.name}”: ${expressionError.message}`,
        variationPoint.constrainedElementIds,
        variationPoint.constrainedRelationshipIds
      ));
    }
    const conditions = [
      ...variationPoint.featureValueConditions,
      ...variationPoint.valueRules.flatMap((rule) => rule.featureValueConditions)
    ];
    if (conditions.some((condition) => !featureIds.has(condition.featureId))) {
      findings.push(variationFinding("PMB-004", "error", "Unknown feature value condition", `“${variationPoint.name}” references a missing feature.`));
    }
    if (conditions.some((condition) => {
      const feature = featuresById.get(condition.featureId);
      if (!feature) return false;
      return (feature.valueType ?? "boolean") === "boolean"
        ? typeof condition.value !== "boolean"
        : !(feature.allowedValues ?? []).includes(String(condition.value));
    })) {
      findings.push(variationFinding("PMB-126", "error", "Invalid typed feature condition", `“${variationPoint.name}” uses a value outside the feature's declared type or allowed values.`));
    }
    if (variationPoint.kind !== "existence") {
      const invalidElementPath = variationPoint.constrainedElementIds.length
        && !elementPropertyAllowed(variationPoint.kind, variationPoint.propertyPath);
      const invalidRelationshipPath = variationPoint.constrainedRelationshipIds.length
        && !relationshipPropertyAllowed(variationPoint.kind, variationPoint.propertyPath);
      if (invalidElementPath || invalidRelationshipPath) {
        findings.push(variationFinding(
          "PMB-118",
          "error",
          "Unsupported variation property",
          `“${variationPoint.name}” uses a property path that is not allowed for ${variationPoint.kind}.`
        ));
      }
      if (!variationPoint.valueRules.length) {
        findings.push(variationFinding("PMB-119", "error", "Missing variation value", `“${variationPoint.name}” has no value rule.`));
      }
      if (
        variationPoint.kind === "elementProperty"
        && variationPoint.valueRules.some((rule) =>
          typeof rule.value !== "string"
          || ["sourceId", "targetId"].includes(variationPoint.propertyPath ?? "") && !elementIds.has(rule.value)
          || variationPoint.propertyPath === "architectureId" && !project.architectures.some((architecture) => architecture.id === rule.value)
        )
      ) {
        findings.push(variationFinding("PMB-122", "error", "Invalid element reference effect", `“${variationPoint.name}” must assign an existing compatible model ID.`));
      }
      if (
        variationPoint.kind === "primitiveTag"
        && variationPoint.propertyPath?.startsWith("customAttribute:")
        && !project.customAttributeDefinitions.some((definition) => definition.id === variationPoint.propertyPath!.slice("customAttribute:".length))
      ) {
        findings.push(variationFinding("PMB-123", "error", "Unknown custom attribute", `“${variationPoint.name}” references a missing custom-attribute definition.`));
      }
      if (
        variationPoint.kind === "primitiveProperty"
        && variationPoint.propertyPath?.startsWith("parameter:")
        && variationPoint.constrainedElementIds.some((id) => {
          const parameterId = variationPoint.propertyPath!.split(":")[1];
          return !project.elements.find((element) => element.id === id)?.parameters.some((parameter) => parameter.id === parameterId);
        })
      ) {
        findings.push(variationFinding("PMB-124", "error", "Unknown target parameter", `“${variationPoint.name}” references a parameter that is not owned by every constrained element.`));
      }
      [...variationPoint.constrainedElementIds.map((id) => `element:${id}`), ...variationPoint.constrainedRelationshipIds.map((id) => `relationship:${id}`)]
        .forEach((target) => {
          const key = `${target}:${variationPoint.propertyPath}`;
          const previous = propertyClaims.get(key);
          if (previous && variationPoint.enabled) {
            findings.push(variationFinding("PMB-120", "error", "Conflicting variation effects", `“${variationPoint.name}” and “${previous}” can modify the same property.`));
          } else if (variationPoint.enabled) propertyClaims.set(key, variationPoint.name);
        });
    }
  });
  return findings;
}

export function referencedFeatureIds(variationPoint: VariationPoint, features: Feature[]): string[] {
  const ids = new Set<string>();
  try {
    parseFeatureExpression(variationPoint.featureExpression, features).featureIds.forEach((id) => ids.add(id));
  } catch {
    // Validation reports malformed expressions.
  }
  variationPoint.featureValueConditions.forEach((condition) => ids.add(condition.featureId));
  variationPoint.valueRules.forEach((rule) => {
    try {
      parseFeatureExpression(rule.featureExpression, features).featureIds.forEach((id) => ids.add(id));
    } catch {
      // Validation reports malformed expressions.
    }
    rule.featureValueConditions.forEach((condition) => ids.add(condition.featureId));
  });
  return [...ids];
}
