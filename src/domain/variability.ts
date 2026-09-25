import { FeatureExpressionError, parseFeatureExpression } from "./featureExpressions";
import type { Configuration, Feature, FeatureConstraint, FeatureGroup, Project, ValidationResult, ValidationSeverity } from "./types";
import { referencedFeatureIds, validateVariationPoints } from "./variationPoints";

export interface ConfigurationSelection {
  manual: string[];
  automaticConstraint: string[];
  automatic: string[];
  effective: string[];
}

const finding = (
  ruleId: string,
  severity: ValidationSeverity,
  title: string,
  message: string,
  affectedElementIds: string[] = []
): ValidationResult => ({
  id: `${ruleId}-${affectedElementIds.join("-") || message.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "project"}`,
  ruleId,
  severity,
  title,
  message,
  category: "feature",
  affectedElementIds,
  affectedRelationshipIds: [],
  resolved: false
});

export function featureHierarchyCycle(features: Feature[]): string[] | null {
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  for (const feature of features) {
    const path: string[] = [];
    const seen = new Set<string>();
    let current: Feature | undefined = feature;
    while (current?.parentId) {
      if (seen.has(current.id)) return [...path.slice(path.indexOf(current.id)), current.id];
      seen.add(current.id);
      path.push(current.id);
      current = byId.get(current.parentId);
    }
  }
  return null;
}

export function descendantsOf(features: Feature[], featureId: string): string[] {
  const descendants: string[] = [];
  const visit = (id: string) => {
    features.filter((feature) => feature.parentId === id).forEach((child) => {
      descendants.push(child.id);
      visit(child.id);
    });
  };
  visit(featureId);
  return descendants;
}

export function featureGroupCycle(groups: FeatureGroup[]): string[] | null {
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const group of groups) {
    const path: string[] = [];
    const seen = new Set<string>();
    let current: FeatureGroup | undefined = group;
    while (current?.parentGroupId) {
      if (seen.has(current.id)) return [...path.slice(path.indexOf(current.id)), current.id];
      seen.add(current.id);
      path.push(current.id);
      current = byId.get(current.parentGroupId);
    }
  }
  return null;
}

function activeRequiredTargets(
  constraints: FeatureConstraint[],
  effective: Set<string>,
  acceptedAutomatic: Set<string>
) {
  return constraints
    .filter((constraint) =>
      constraint.type === "requires"
      && effective.has(constraint.sourceFeatureId)
      && acceptedAutomatic.has(constraint.targetFeatureId)
    )
    .map((constraint) => constraint.targetFeatureId);
}

export function calculateConfigurationSelection(
  features: Feature[],
  constraints: FeatureConstraint[],
  manuallySelectedFeatureIds: string[],
  automaticConstraintFeatureIds: string[] = []
): ConfigurationSelection {
  const ids = new Set(features.map((feature) => feature.id));
  const roots = features.filter((feature) => feature.featureType === "root");
  const manual = new Set(manuallySelectedFeatureIds.filter((id) => ids.has(id)));
  const acceptedAutomatic = new Set(automaticConstraintFeatureIds.filter((id) => ids.has(id)));
  const effective = new Set<string>(roots.map((feature) => feature.id));
  manual.forEach((id) => effective.add(id));
  let changed = true;
  while (changed) {
    changed = false;
    features.forEach((feature) => {
      if (
        feature.featureType === "mandatory"
        && feature.parentId
        && effective.has(feature.parentId)
        && !effective.has(feature.id)
      ) {
        effective.add(feature.id);
        changed = true;
      }
    });
    activeRequiredTargets(constraints, effective, acceptedAutomatic).forEach((id) => {
      if (!effective.has(id)) {
        effective.add(id);
        changed = true;
      }
    });
  }
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const parentActive = (feature: Feature) => {
    let current = feature;
    while (current.parentId) {
      if (!effective.has(current.parentId)) return false;
      const parent = byId.get(current.parentId);
      if (!parent) return false;
      current = parent;
    }
    return true;
  };
  [...effective].forEach((id) => {
    const feature = byId.get(id);
    if (feature && feature.featureType !== "root" && !parentActive(feature)) {
      effective.delete(id);
      manual.delete(id);
      acceptedAutomatic.delete(id);
      descendantsOf(features, id).forEach((descendantId) => {
        effective.delete(descendantId);
        manual.delete(descendantId);
        acceptedAutomatic.delete(descendantId);
      });
    }
  });
  const automaticConstraint = [...acceptedAutomatic].filter((id) =>
    constraints.some((constraint) =>
      constraint.type === "requires"
      && constraint.targetFeatureId === id
      && effective.has(constraint.sourceFeatureId)
    )
  );
  return {
    manual: [...manual],
    automaticConstraint,
    effective: [...effective],
    automatic: [...effective].filter((id) => !manual.has(id))
  };
}

export function applySelectionToConfiguration(
  configuration: Configuration,
  features: Feature[],
  constraints: FeatureConstraint[]
): Configuration {
  const selection = calculateConfigurationSelection(
    features,
    constraints,
    configuration.manuallySelectedFeatureIds,
    configuration.automaticConstraintFeatureIds
  );
  const selected = new Set(selection.effective);
  const featureValues = Object.fromEntries(features.map((feature) => {
    if ((feature.valueType ?? "boolean") === "boolean") return [feature.id, selected.has(feature.id)];
    const current = configuration.featureValues?.[feature.id];
    const allowed = feature.allowedValues ?? [];
    const value = current !== undefined && allowed.includes(String(current)) ? current : "";
    return [feature.id, value];
  }));
  return {
    ...configuration,
    manuallySelectedFeatureIds: selection.manual,
    automaticConstraintFeatureIds: selection.automaticConstraint,
    effectiveSelectedFeatureIds: selection.effective,
    autoSelectedFeatureIds: selection.automatic,
    featureValues
  };
}

export function validateConfiguration(project: Project, configuration: Configuration): ValidationResult[] {
  const findings: ValidationResult[] = [];
  const features = project.features;
  const featureIds = new Set(features.map((feature) => feature.id));
  const effective = new Set(configuration.effectiveSelectedFeatureIds);
  const missingIds = configuration.effectiveSelectedFeatureIds.filter((id) => !featureIds.has(id));
  if (missingIds.length) findings.push(finding("PMB-020", "error", "Unknown selected feature", `Selected feature IDs do not exist: ${missingIds.join(", ")}.`));

  const roots = features.filter((feature) => feature.featureType === "root");
  if (roots.length !== 1) findings.push(finding("PMB-023", "error", "Invalid feature root", `Exactly one root is required; found ${roots.length}.`));
  if (roots.length === 1 && !effective.has(roots[0].id)) {
    findings.push(finding("PMB-005", "error", "Root feature not selected", `Root feature “${roots[0].name}” must be effectively selected.`));
  }
  const groupCycle = featureGroupCycle(project.featureGroups);
  if (groupCycle) {
    findings.push(finding("PMB-028", "error", "Feature-group cycle", `Organizational feature groups form a cycle: ${groupCycle.join(" → ")}.`));
  }
  const groupIds = new Set(project.featureGroups.map((group) => group.id));
  project.featureGroups.forEach((group) => {
    if (group.parentGroupId && !groupIds.has(group.parentGroupId)) {
      findings.push(finding("PMB-029", "error", "Missing parent feature group", `Feature group “${group.name}” references a missing parent group.`));
    }
    if (group.parentFeatureId && !featureIds.has(group.parentFeatureId)) {
      findings.push(finding("PMB-030", "error", "Missing feature-group context", `Feature group “${group.name}” references a missing parent feature.`));
    }
  });
  features.filter((feature) => feature.parentGroupId && !groupIds.has(feature.parentGroupId)).forEach((feature) => {
    findings.push(finding("PMB-031", "error", "Missing organizational group", `Feature “${feature.name}” references a missing organizational group.`));
  });
  features.filter((feature) => effective.has(feature.id) && feature.featureType !== "root").forEach((feature) => {
    if (!feature.parentId || !effective.has(feature.parentId)) {
      findings.push(finding("PMB-002", "error", "Selected feature has inactive parent", `“${feature.name}” requires its parent to be selected.`));
    }
  });
  features.filter((feature) =>
    feature.featureType === "mandatory" && feature.parentId && effective.has(feature.parentId) && !effective.has(feature.id)
  ).forEach((feature) => findings.push(finding("PMB-005", "error", "Mandatory feature missing", `Mandatory feature “${feature.name}” must be selected.`)));

  const groups = new Map<string, Feature[]>();
  features.filter((feature) => feature.groupId && feature.parentId).forEach((feature) => {
    const key = `${feature.parentId}:${feature.groupId}`;
    groups.set(key, [...(groups.get(key) ?? []), feature]);
  });
  groups.forEach((members) => {
    if (!effective.has(members[0].parentId!)) return;
    const types = new Set(members.map((feature) => feature.featureType));
    if (types.size > 1) {
      findings.push(finding("PMB-022", "error", "Mixed feature group", `Group “${members[0].groupId}” mixes XOR and OR members.`));
      return;
    }
    const selected = members.filter((feature) => effective.has(feature.id));
    if (members[0].featureType === "xor" && selected.length !== 1) {
      findings.push(finding("PMB-006", "error", "Invalid XOR selection", `Group “${members[0].groupId}” requires exactly one selected member; found ${selected.length}.`));
    }
    if (members[0].featureType === "or" && selected.length < 1) {
      findings.push(finding("PMB-007", "error", "Invalid OR selection", `Group “${members[0].groupId}” requires at least one selected member.`));
    }
  });

  project.featureConstraints.forEach((constraint) => {
    if (!featureIds.has(constraint.sourceFeatureId) || !featureIds.has(constraint.targetFeatureId)) {
      findings.push(finding("PMB-010", "error", "Broken feature constraint", "A feature constraint references a missing feature."));
    } else if (
      constraint.type === "requires"
      && effective.has(constraint.sourceFeatureId)
      && !effective.has(constraint.targetFeatureId)
    ) {
      findings.push(finding("PMB-008", "error", "Required feature missing", `${constraint.sourceFeatureId} requires ${constraint.targetFeatureId}.`));
    } else if (
      constraint.type === "excludes"
      && effective.has(constraint.sourceFeatureId)
      && effective.has(constraint.targetFeatureId)
    ) {
      findings.push(finding("PMB-009", "error", "Excluded features selected together", `${constraint.sourceFeatureId} excludes ${constraint.targetFeatureId}.`));
    }
  });

  features.filter((feature) =>
    effective.has(feature.id) && (feature.valueType ?? "boolean") === "enumeration"
  ).forEach((feature) => {
    const allowed = feature.allowedValues ?? [];
    const selectedValue = configuration.featureValues?.[feature.id];
    if (!allowed.length) {
      findings.push(finding("PMB-026", "error", "Enumeration has no allowed values", `“${feature.name}” must define at least one allowed value.`));
    } else if (!allowed.includes(String(selectedValue ?? ""))) {
      findings.push(finding("PMB-027", "error", "Invalid feature value", `“${feature.name}” must have one of: ${allowed.join(", ")}.`));
    }
  });

  findings.push(...validateVariationPoints(project));

  // Legacy expressions remain readable until persistence migrates them to first-class variation points.
  project.elements.filter((element) => element.featureExpression?.trim()).forEach((element) => {
    try {
      parseFeatureExpression(element.featureExpression!, features);
    } catch (error) {
      const expressionError = error as FeatureExpressionError;
      findings.push(finding(
        expressionError.kind === "unknownFeature" ? "PMB-004" : "PMB-003",
        "error",
        expressionError.kind === "unknownFeature" ? "Unknown mapped feature" : "Invalid feature expression",
        `${element.name}: ${expressionError.message}`,
        [element.id]
      ));
    }
  });

  const mappedFeatureIds = new Set<string>();
  project.variationPoints.forEach((variationPoint) => {
    referencedFeatureIds(variationPoint, features).forEach((id) => mappedFeatureIds.add(id));
  });
  project.elements.forEach((element) => {
    try {
      parseFeatureExpression(element.featureExpression ?? "", features).featureIds.forEach((id) => mappedFeatureIds.add(id));
    } catch {
      // The ordered syntax/unknown-feature findings above are authoritative.
    }
  });
  features.filter((feature) => effective.has(feature.id) && !mappedFeatureIds.has(feature.id)).forEach((feature) => {
    findings.push(finding("PMB-101", "warning", "Selected feature has no mapped element", `“${feature.name}” affects no model element.`));
  });
  features.filter((feature) => !effective.has(feature.id) && !mappedFeatureIds.has(feature.id)).forEach((feature) => {
    findings.push(finding("PMB-203", "information", "Feature has no direct mapping", `“${feature.name}” is unselected and has no direct model mapping.`));
  });
  const selectedRealizationScopes = new Set(configuration.realizationScopes ?? []);
  const omittedUsedScope = project.variationPoints.some((variationPoint) =>
    variationPoint.enabled
    && [...(variationPoint.realizationScopes ?? []), ...(variationPoint.scope ? [variationPoint.scope] : [])]
      .some((scope) => !selectedRealizationScopes.has(scope))
  );
  if (selectedRealizationScopes.size && omittedUsedScope) {
    findings.push(finding(
      "PMB-125",
      "warning",
      "Scoped realization",
      `Only these variation domains will be applied: ${[...selectedRealizationScopes].join(", ")}. Out-of-scope source content remains unchanged.`
    ));
  }
  return findings;
}

export function configurationWithValidation(project: Project, configuration: Configuration): Configuration {
  const next = applySelectionToConfiguration(configuration, project.features, project.featureConstraints);
  const findings = validateConfiguration(project, next);
  const errors = findings.filter((item) => item.severity === "error");
  return {
    ...next,
    validationStatus: errors.length ? "invalid" : "valid",
    validationMessages: findings.map((item) => `${item.ruleId}: ${item.message}`)
  };
}
