import { calculateSelectedKpis, type ActiveModel } from "./presizing";
import type { Configuration, DerivationResult, Project, ValidationResult } from "./types";
import { validateProject } from "./validation";
import { applySelectionToConfiguration, validateConfiguration } from "./variability";
import { applyVariationPoints } from "./variationPoints";

export interface DerivationAttempt {
  configuration: Configuration;
  result?: DerivationResult;
  errors: string[];
  warnings: string[];
}

export function architectureCompatibleModel(project: Project, architectureId: string): ActiveModel {
  const elements = project.elements;
  const ids = new Set(elements.map((element) => element.id));
  const relationships = project.relationships.filter((relationship) =>
    ids.has(relationship.sourceId)
    && ids.has(relationship.targetId)
  );
  const configurationId = project.architectures.find((architecture) => architecture.id === architectureId)?.configurationId;
  return { elements, relationships, configurationId };
}

export function deriveConfiguration(project: Project, source: Configuration): DerivationAttempt {
  const configuration = applySelectionToConfiguration(source, project.features, project.featureConstraints);
  const findings = validateConfiguration(project, configuration);
  const errors = findings.filter((finding) => finding.severity === "error").map((finding) => finding.message);
  const warnings = findings.filter((finding) => finding.severity === "warning").map((finding) => finding.message);
  if (!project.architectures.some((architecture) => architecture.id === configuration.architectureId)) {
    errors.unshift("PMB-020: The configuration's generated architecture is missing.");
  }
  if (errors.length) return { configuration, errors, warnings };

  const sourceModel = architectureCompatibleModel(project, configuration.architectureId);
  const variation = applyVariationPoints(project, configuration, sourceModel);
  errors.push(...variation.errors);
  warnings.push(...variation.warnings);
  if (errors.length) return { configuration, errors, warnings };
  const included = variation.elements;
  const excluded = sourceModel.elements.filter((element) => variation.excludedElementIds.includes(element.id));
  const preserved = variation.relationships;
  const removed = sourceModel.relationships.filter((relationship) => variation.removedRelationshipIds.includes(relationship.id));

  const derivedProject: Project = {
    ...structuredClone(project),
    elements: structuredClone(included),
    relationships: structuredClone(preserved),
    variationPoints: [],
    // Retain the declarations needed to resolve parameter applicability and feature references.
    // Trade-study and decision completeness are checked in their own context.
    comparisonStudies: [],
    comparisonRisks: [],
    decisions: [],
    openDecisions: [],
    activeComparisonStudyId: undefined
  };
  const validationSnapshot: ValidationResult[] = validateProject(derivedProject);
  if (validationSnapshot.some((finding) => finding.severity === "error")) {
    warnings.push("PMB-110: The derived model contains broken or incomplete traceability coverage.");
  }
  const activeModel: ActiveModel = {
    elements: included,
    relationships: preserved,
    configurationId: configuration.id
  };
  const calculated = calculateSelectedKpis(project, activeModel, project.kpis.map((kpi) => kpi.id));
  const calculatedKpiValues = Object.fromEntries(calculated.results.map((item) => [item.kpiId!, item.value]));
  warnings.push(...calculated.warnings);

  const result: DerivationResult = {
    id: `derivation-${crypto.randomUUID()}`,
    configurationId: configuration.id,
    sourceProjectId: project.id,
    sourceArchitectureId: configuration.architectureId,
    sourceModelRevision: project.modelRevision,
    timestamp: new Date().toISOString(),
    manuallySelectedFeatureIds: [...configuration.manuallySelectedFeatureIds],
    effectiveSelectedFeatureIds: [...configuration.effectiveSelectedFeatureIds],
    autoSelectedFeatureIds: [...configuration.autoSelectedFeatureIds],
    featureValues: structuredClone(configuration.featureValues ?? {}),
    realizationScopes: [...(configuration.realizationScopes ?? [])],
    includedElementIds: included.map((element) => element.id),
    excludedElementIds: excluded.map((element) => element.id),
    preservedRelationshipIds: preserved.map((relationship) => relationship.id),
    removedRelationshipIds: removed.map((relationship) => relationship.id),
    modifiedElementIds: [...variation.modifiedElementIds],
    modifiedRelationshipIds: [...variation.modifiedRelationshipIds],
    appliedVariations: structuredClone(variation.appliedVariations),
    sourceElements: structuredClone(sourceModel.elements),
    sourceRelationships: structuredClone(sourceModel.relationships),
    realizedElements: structuredClone(included),
    realizedRelationships: structuredClone(preserved),
    warnings: [...new Set(warnings)],
    validationSnapshot: structuredClone(validationSnapshot),
    calculatedKpiValues
  };
  const nextConfiguration: Configuration = {
    ...configuration,
    validationStatus: "valid",
    validationMessages: findings.map((finding) => finding.message),
    derivedElementIds: [...result.includedElementIds],
    excludedElementIds: [...result.excludedElementIds],
    derivation: result,
    updatedAt: result.timestamp
  };
  return { configuration: nextConfiguration, result, errors, warnings: result.warnings };
}

export const derivationStatus = (project: Project, configuration?: Configuration): "Missing" | "Current" | "Stale" => {
  if (!configuration?.derivation) return "Missing";
  return configuration.derivation.sourceModelRevision < project.modelRevision ? "Stale" : "Current";
};
