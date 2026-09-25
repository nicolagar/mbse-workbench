import { normalizeOntology } from "../domain/ontology";
import { elementTypes } from "../domain/types";
import type {
  ArchitectAnswer,
  ArchitectAnswerStatus,
  ArchitectParameterIntent,
  ArchitectSectionState,
  ArchitectSession,
  ArchitectStatus,
  ComparisonStudy,
  ComparisonRisk,
  Configuration,
  ElementType,
  Feature,
  FeatureConstraint,
  FeatureGroup,
  FunctionSequence,
  KPI,
  ModelElement,
  ModelTabId,
  PersistedAppState,
  Project,
  ProjectSnapshot,
  Relationship,
  RelationshipType,
  ValidationResult,
  VariabilityAxis,
  VariationPoint,
  VariationScope
} from "../domain/types";
import { migrateObjectiveElements, objectiveProjection } from "../domain/objectives";
import { applySelectionToConfiguration } from "../domain/variability";

export const STORAGE_KEY = "mbse-mbple-workbench";
export const CURRENT_SCHEMA_VERSION = 14;
const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, CURRENT_SCHEMA_VERSION];

const architectAnswerStatuses: ArchitectAnswerStatus[] = ["answered", "skipped", "needsReview", "invalid"];
const architectStatuses: ArchitectStatus[] = ["draft", "blocked", "ready", "outOfDate"];
const architectSectionStates: ArchitectSectionState[] = ["notStarted", "inProgress", "reviewNeeded", "complete", "blocked"];
const architectOperators: ArchitectParameterIntent["operator"][] = ["<", "<=", ">", ">=", "=", "==", "!="];
const architectSourceKinds: NonNullable<ArchitectParameterIntent["sourceKind"]>[] = ["existing", "later", "kpi", "verification"];
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function normalizeArchitectSession(
  value: unknown,
  projectId: string,
  modelRevision: number,
  projectCreatedAt: string,
  projectUpdatedAt: string
): ArchitectSession | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = structuredClone(value) as Partial<ArchitectSession> & Record<string, unknown>;
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : projectCreatedAt;
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : projectUpdatedAt;
  const answers: Record<string, ArchitectAnswer> = {};
  if (raw.answers && typeof raw.answers === "object") {
    Object.entries(raw.answers as Record<string, unknown>).forEach(([entryKey, answerValue]) => {
      if (!answerValue || typeof answerValue !== "object") return;
      const answer = answerValue as Partial<ArchitectAnswer>;
      const key = typeof answer.key === "string" && answer.key ? answer.key : entryKey;
      const questionId = typeof answer.questionId === "string" && answer.questionId
        ? answer.questionId
        : key.split(":")[0];
      answers[key] = {
        key,
        questionId,
        instanceKey: typeof answer.instanceKey === "string" ? answer.instanceKey : key.includes(":") ? key.slice(key.indexOf(":") + 1) : undefined,
        status: architectAnswerStatuses.includes(answer.status as ArchitectAnswerStatus) ? answer.status as ArchitectAnswerStatus : "needsReview",
        value: answer.value,
        generatedElementIds: stringArray(answer.generatedElementIds),
        generatedRelationshipIds: stringArray(answer.generatedRelationshipIds),
        generatedParameterIds: stringArray(answer.generatedParameterIds),
        generatedFeatureIds: stringArray(answer.generatedFeatureIds),
        generatedVariationPointIds: stringArray(answer.generatedVariationPointIds),
        generatedConfigurationIds: stringArray(answer.generatedConfigurationIds),
        generatedStudyIds: stringArray(answer.generatedStudyIds),
        generatedDecisionIds: stringArray(answer.generatedDecisionIds),
        sourceModelRevision: Number.isFinite(answer.sourceModelRevision) ? Number(answer.sourceModelRevision) : modelRevision,
        createdAt: typeof answer.createdAt === "string" ? answer.createdAt : createdAt,
        updatedAt: typeof answer.updatedAt === "string" ? answer.updatedAt : updatedAt
      };
    });
  }
  const parameterIntents: Record<string, ArchitectParameterIntent> = {};
  if (raw.parameterIntents && typeof raw.parameterIntents === "object") {
    Object.entries(raw.parameterIntents as Record<string, unknown>).forEach(([entryKey, intentValue]) => {
      if (!intentValue || typeof intentValue !== "object") return;
      const intent = intentValue as Partial<ArchitectParameterIntent>;
      const requirementId = typeof intent.requirementId === "string" && intent.requirementId ? intent.requirementId : entryKey;
      const target = Number(intent.target);
      parameterIntents[entryKey] = {
        id: typeof intent.id === "string" && intent.id ? intent.id : `parameter-intent-migrated-${entryKey}`,
        requirementId,
        propertyName: typeof intent.propertyName === "string" ? intent.propertyName : "",
        semanticKey: typeof intent.semanticKey === "string" ? intent.semanticKey : "",
        operator: architectOperators.includes(intent.operator as ArchitectParameterIntent["operator"]) ? intent.operator as ArchitectParameterIntent["operator"] : "<=",
        target: Number.isFinite(target) ? target : 0,
        unit: typeof intent.unit === "string" ? intent.unit : "",
        sourceKind: architectSourceKinds.includes(intent.sourceKind as NonNullable<ArchitectParameterIntent["sourceKind"]>) ? intent.sourceKind : undefined,
        ownerElementId: typeof intent.ownerElementId === "string" ? intent.ownerElementId : undefined,
        parameterId: typeof intent.parameterId === "string" ? intent.parameterId : undefined,
        preliminaryValue: intent.preliminaryValue === null || Number.isFinite(intent.preliminaryValue) ? intent.preliminaryValue : undefined,
        valueOrigin: intent.valueOrigin,
        source: typeof intent.source === "string" ? intent.source : undefined,
        uncertaintyPercent: Number.isFinite(intent.uncertaintyPercent) ? Number(intent.uncertaintyPercent) : undefined,
        createdAt: typeof intent.createdAt === "string" ? intent.createdAt : createdAt,
        updatedAt: typeof intent.updatedAt === "string" ? intent.updatedAt : updatedAt
      };
    });
  }
  const sectionStates: Record<string, ArchitectSectionState> = {};
  if (raw.sectionStates && typeof raw.sectionStates === "object") Object.entries(raw.sectionStates as Record<string, unknown>).forEach(([sectionId, state]) => {
    if (architectSectionStates.includes(state as ArchitectSectionState)) sectionStates[sectionId] = state as ArchitectSectionState;
  });
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `architect-session-migrated-${projectId}`,
    projectId,
    currentQuestionKey: typeof raw.currentQuestionKey === "string" ? raw.currentQuestionKey : undefined,
    status: architectStatuses.includes(raw.status as ArchitectStatus) ? raw.status as ArchitectStatus : "draft",
    answers,
    sectionStates,
    reviewedSectionIds: stringArray(raw.reviewedSectionIds),
    parameterIntents,
    createdAt,
    updatedAt,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : undefined
  };
}

export interface LoadResult {
  state?: PersistedAppState;
  corruptRaw?: string;
  error?: string;
}

const legacyElementTypes: Record<string, ElementType> = {
  stakeholder: "stakeholder",
  need: "need",
  requirement: "systemRequirement",
  useCase: "useCase",
  function: "productFunction",
  logicalElement: "productComponent",
  technicalElement: "productComponent",
  interface: "productInterface",
  process: "processFunction",
  resource: "resource",
  verificationMethod: "verificationMethod"
};

function normalizeElement(value: unknown): ModelElement {
  const element = structuredClone(value) as ModelElement & { elementType: string };
  element.elementType = legacyElementTypes[element.elementType] ?? element.elementType as ElementType;
  element.parameters = Array.isArray(element.parameters) ? element.parameters : [];
  element.tags = Array.isArray(element.tags) ? element.tags : [];
  element.metadata = element.metadata && typeof element.metadata === "object" ? element.metadata : {};
  element.customAttributeValues = element.customAttributeValues && typeof element.customAttributeValues === "object"
    ? element.customAttributeValues
    : {};
  return element;
}

function variationScopeFor(element: ModelElement): VariationScope {
  if (["need", "objective", "systemRequirement"].includes(element.elementType)) return "requirements";
  if (["productComponent", "productInterface", "industrialSystemComponent", "processInterface"].includes(element.elementType)) return "structure";
  if (["productFunction", "useCase"].includes(element.elementType)) return "behavior";
  if (element.elementType === "processFunction") return "process";
  if (element.elementType === "resource") return "resources";
  return "verification";
}

const stableToken = (value: string) =>
  Array.from(value).map((character) => character.codePointAt(0)!.toString(16)).join("-");

function migrationWarning(resourceId: string): ValidationResult {
  return {
    id: `PMB-114-${resourceId}`,
    ruleId: "PMB-114",
    severity: "warning",
    title: "Legacy resource quantity not migrated",
    message: "A legacy resource-level required quantity could not be assigned to one component-resource relationship unambiguously. It remains as ignored legacy metadata.",
    affectedElementIds: [resourceId],
    affectedRelationshipIds: [],
    category: "persistence",
    resolved: false
  };
}

function normalizeRelationship(value: unknown, oldTypeById: Map<string, string>, newTypeById: Map<string, ElementType>): Relationship {
  const relationship = structuredClone(value) as Relationship & { relationshipType: string };
  const legacyRelationshipType = String(relationship.relationshipType);
  const oldSourceType = oldTypeById.get(relationship.sourceId);
  const oldTargetType = oldTypeById.get(relationship.targetId);
  let sourceId = relationship.sourceId;
  let targetId = relationship.targetId;
  let relationshipType = relationship.relationshipType as RelationshipType;

  if (legacyRelationshipType === "ownedBy" && oldSourceType === "stakeholder" && oldTargetType === "need") {
    relationshipType = "hasNeed";
  } else if (legacyRelationshipType === "realizes" && oldSourceType === "function" && oldTargetType === "requirement") {
    [sourceId, targetId] = [targetId, sourceId];
    relationshipType = "satisfiedBy";
  } else if (legacyRelationshipType === "performs" && ["logicalElement", "technicalElement"].includes(oldSourceType ?? "") && oldTargetType === "function") {
    [sourceId, targetId] = [targetId, sourceId];
    relationshipType = "realizedBy";
  } else if (legacyRelationshipType === "realizes" && oldSourceType === "technicalElement" && oldTargetType === "logicalElement") {
    relationshipType = "refines";
  } else if (legacyRelationshipType === "realizes" && oldSourceType === "process" && ["technicalElement", "logicalElement"].includes(oldTargetType ?? "")) {
    relationshipType = "allocatedTo";
  } else if (legacyRelationshipType === "dependsOn" && oldSourceType === "process" && oldTargetType === "process") {
    [sourceId, targetId] = [targetId, sourceId];
    relationshipType = "precedes";
  } else if (legacyRelationshipType === "realizes" && oldSourceType === "useCase" && oldTargetType === "need") {
    relationshipType = "addresses";
  } else if (legacyRelationshipType === "realizes" && oldSourceType === "process" && oldTargetType === "requirement") {
    [sourceId, targetId] = [targetId, sourceId];
    relationshipType = "satisfiedBy";
  }

  if (relationshipType === "connects") {
    const sourceType = newTypeById.get(sourceId);
    const targetType = newTypeById.get(targetId);
    if (sourceType === "productComponent" && targetType === "productInterface") relationshipType = "connects";
  }
  return {
    ...relationship,
    sourceId,
    targetId,
    relationshipType,
    quantity: relationship.quantity ?? relationship.requiredQuantity
  };
}

function normalizeProject(value: unknown): Project {
  const raw = structuredClone(value) as Project & {
    elements?: Array<ModelElement & { elementType: string }>;
    features?: Feature[];
    featureGroups?: FeatureGroup[];
    variabilityAxes?: VariabilityAxis[];
    featureConstraints?: FeatureConstraint[];
    variationPoints?: VariationPoint[];
    configurations?: Array<Partial<Configuration> & { selectedFeatureIds?: string[] }>;
    kpis?: KPI[];
    comparisonStudies?: Array<Partial<ComparisonStudy> & { results?: unknown }>;
  };
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.elements) || !Array.isArray(raw.relationships)) {
    throw new Error("A stored project is incomplete.");
  }
  const now = raw.updatedAt ?? new Date().toISOString();
  delete (raw as unknown as { snapshots?: unknown }).snapshots;
  const oldTypeById = new Map(raw.elements.map((element) => [element.id, String(element.elementType)]));
  const elements = migrateObjectiveElements(raw.elements.map(normalizeElement), raw.objectives, now);
  const newTypeById = new Map(elements.map((element) => [element.id, element.elementType]));
  const normalizedRelationships = raw.relationships.map((relationship) => normalizeRelationship(relationship, oldTypeById, newTypeById));
  const canonicalResourceAssignments = new Set(normalizedRelationships
    .filter((relationship) =>
      relationship.relationshipType === "requiresResource"
      && newTypeById.get(relationship.sourceId) === "industrialSystemComponent"
    )
    .map((relationship) => `${relationship.sourceId}::${relationship.targetId}::${relationship.architectureId ?? ""}`));
  const relationships = normalizedRelationships.flatMap((relationship) => {
    if (
      relationship.relationshipType !== "requiresResource"
      || newTypeById.get(relationship.sourceId) !== "processFunction"
    ) return [relationship];
    const realizingComponentIds = normalizedRelationships
      .filter((candidate) =>
        candidate.relationshipType === "realizedBy"
        && candidate.sourceId === relationship.sourceId
        && newTypeById.get(candidate.targetId) === "industrialSystemComponent"
      )
      .map((candidate) => candidate.targetId)
      .sort();
    if (!realizingComponentIds.length) return [relationship];
    return realizingComponentIds.flatMap((componentId, index) => {
      const key = `${componentId}::${relationship.targetId}::${relationship.architectureId ?? ""}`;
      if (canonicalResourceAssignments.has(key)) return [];
      canonicalResourceAssignments.add(key);
      return [{
        ...relationship,
        id: index === 0 ? relationship.id : `${relationship.id}-industrial-${stableToken(componentId)}`,
        sourceId: componentId
      }];
    });
  });
  const migrationWarnings: ValidationResult[] = [];
  elements.forEach((element) => {
    if (element.elementType !== "resource") return;
    const legacyQuantity = (element.metadata as Record<string, unknown>).requiredQuantity;
    if (typeof legacyQuantity !== "number" || !Number.isFinite(legacyQuantity) || legacyQuantity <= 0) return;
    const assignments = relationships.filter((relationship) =>
      relationship.relationshipType === "requiresResource"
      && relationship.targetId === element.id
      && relationship.requiredQuantity === undefined
      && relationship.quantity === undefined
    );
    if (assignments.length === 1) {
      assignments[0].requiredQuantity = legacyQuantity;
      assignments[0].quantity = legacyQuantity;
      delete (element.metadata as Record<string, unknown>).requiredQuantity;
    } else {
      migrationWarnings.push(migrationWarning(element.id));
    }
  });
  const functionSequences: FunctionSequence[] = Array.isArray(raw.functionSequences)
    ? structuredClone(raw.functionSequences)
    : [];
  (["product", "process"] as const).forEach((domain) => {
    const type = domain === "product" ? "productFunction" : "processFunction";
    const unscoped = relationships.filter((relationship) =>
      relationship.relationshipType === "precedes"
      && !relationship.sequenceId
      && newTypeById.get(relationship.sourceId) === type
      && newTypeById.get(relationship.targetId) === type
    );
    if (!unscoped.length) return;
    const sequenceId = `sequence-migrated-${domain}`;
    unscoped.forEach((relationship) => { relationship.sequenceId = sequenceId; });
    functionSequences.push({
      id: sequenceId,
      name: `Migrated ${domain} sequence`,
      description: "Created automatically from existing precedence relationships.",
      domain,
      architectureId: unscoped.find((relationship) => relationship.architectureId)?.architectureId,
      useCaseIds: [],
      functionIds: [...new Set(unscoped.flatMap((relationship) => [relationship.sourceId, relationship.targetId]))],
      relationshipIds: unscoped.map((relationship) => relationship.id),
      createdAt: now,
      updatedAt: now
    });
  });
  const features = (Array.isArray(raw.features) ? structuredClone(raw.features) : []).map((feature) => ({
    ...feature,
    valueType: feature.valueType ?? "boolean",
    allowedValues: Array.isArray(feature.allowedValues) ? feature.allowedValues : [],
    defaultValue: feature.defaultValue ?? ((feature.valueType ?? "boolean") === "boolean" ? false : feature.allowedValues?.[0] ?? ""),
    variabilityScope: feature.variabilityScope ?? "external"
  }));
  const featureGroups: FeatureGroup[] = Array.isArray(raw.featureGroups)
    ? structuredClone(raw.featureGroups)
    : [];
  const variabilityAxes: VariabilityAxis[] = (Array.isArray(raw.variabilityAxes)
    ? structuredClone(raw.variabilityAxes)
    : []).filter((axis) => featureGroups.some((group) => group.id === axis.featureGroupId));
  const featureConstraints = Array.isArray(raw.featureConstraints) ? structuredClone(raw.featureConstraints) : [];
  const variationPoints: VariationPoint[] = (Array.isArray(raw.variationPoints) ? raw.variationPoints : []).map((variationPoint) => ({
    ...structuredClone(variationPoint),
    description: variationPoint.description ?? "",
    constrainedElementIds: Array.isArray(variationPoint.constrainedElementIds) ? variationPoint.constrainedElementIds : [],
    constrainedRelationshipIds: Array.isArray(variationPoint.constrainedRelationshipIds) ? variationPoint.constrainedRelationshipIds : [],
    featureExpression: variationPoint.featureExpression ?? "",
    featureValueConditions: Array.isArray(variationPoint.featureValueConditions) ? variationPoint.featureValueConditions : [],
    valueRules: Array.isArray(variationPoint.valueRules)
      ? variationPoint.valueRules.map((rule) => ({
        ...rule,
        featureExpression: rule.featureExpression ?? "",
        featureValueConditions: Array.isArray(rule.featureValueConditions) ? rule.featureValueConditions : []
      }))
      : [],
    realizationScopes: Array.isArray(variationPoint.realizationScopes) ? structuredClone(variationPoint.realizationScopes) : variationPoint.scope ? [variationPoint.scope] : [],
    enabled: variationPoint.enabled ?? true,
    createdAt: variationPoint.createdAt ?? now,
    updatedAt: variationPoint.updatedAt ?? now
  }));
  elements.forEach((element) => {
    const expression = element.featureExpression?.trim();
    if (!expression) return;
    const id = `variation-migrated-${element.id}`;
    if (!variationPoints.some((variationPoint) => variationPoint.id === id)) {
      variationPoints.push({
        id,
        name: `${element.name} existence`,
        description: "Migrated from the legacy element feature expression.",
        kind: "existence",
        constrainedElementIds: [element.id],
        constrainedRelationshipIds: [],
        featureExpression: expression,
        featureValueConditions: [],
        valueRules: [],
        scope: variationScopeFor(element),
        enabled: true,
        createdAt: now,
        updatedAt: now
      });
    }
    delete element.featureExpression;
  });
  let configurations = (Array.isArray(raw.configurations) ? raw.configurations : []).map((configuration) => {
    const legacy = configuration as Partial<Configuration> & { selectedFeatureIds?: unknown };
    const now = raw.updatedAt ?? new Date().toISOString();
    const manual = Array.isArray(configuration.manuallySelectedFeatureIds)
      ? configuration.manuallySelectedFeatureIds
      : Array.isArray(legacy.selectedFeatureIds)
        ? legacy.selectedFeatureIds.filter((id): id is string => typeof id === "string")
        : [];
    const normalized: Configuration = {
      id: String(configuration.id ?? ""),
      name: String(configuration.name ?? "Untitled configuration"),
      architectureId: String(configuration.architectureId ?? ""),
      manuallySelectedFeatureIds: [...new Set(manual)],
      automaticConstraintFeatureIds: Array.isArray(configuration.automaticConstraintFeatureIds)
        ? [...new Set(configuration.automaticConstraintFeatureIds)]
        : [],
      effectiveSelectedFeatureIds: [],
      autoSelectedFeatureIds: [],
      featureValues: configuration.featureValues && typeof configuration.featureValues === "object"
        ? structuredClone(configuration.featureValues)
        : {},
      realizationScopes: Array.isArray(configuration.realizationScopes) ? structuredClone(configuration.realizationScopes) : [],
      validationStatus: configuration.validationStatus ?? "notValidated",
      validationMessages: Array.isArray(configuration.validationMessages) ? configuration.validationMessages : [],
      derivedElementIds: Array.isArray(configuration.derivedElementIds) ? configuration.derivedElementIds : [],
      excludedElementIds: Array.isArray(configuration.excludedElementIds) ? configuration.excludedElementIds : [],
      createdAt: configuration.createdAt ?? now,
      updatedAt: configuration.updatedAt ?? now,
      archivedAt: configuration.archivedAt,
      derivation: configuration.derivation
        ? {
          ...structuredClone(configuration.derivation),
          modifiedElementIds: configuration.derivation.modifiedElementIds ?? [],
          modifiedRelationshipIds: configuration.derivation.modifiedRelationshipIds ?? [],
          appliedVariations: configuration.derivation.appliedVariations ?? [],
          featureValues: configuration.derivation.featureValues ?? structuredClone(configuration.featureValues ?? {}),
          realizationScopes: configuration.derivation.realizationScopes ?? [],
          realizedElements: configuration.derivation.realizedElements
            ?? configuration.derivation.sourceElements.filter((element) => configuration.derivation!.includedElementIds.includes(element.id)),
          realizedRelationships: configuration.derivation.realizedRelationships
            ?? configuration.derivation.sourceRelationships.filter((relationship) => configuration.derivation!.preservedRelationshipIds.includes(relationship.id))
        }
        : undefined
    };
    return applySelectionToConfiguration(normalized, features, featureConstraints);
  });
  let architectures = Array.isArray(raw.architectures) ? structuredClone(raw.architectures) : [];
  if ((raw.schemaVersion ?? 1) < 4) {
    const root = features.find((feature) => feature.featureType === "root");
    const migrationGroupId = "feature-group-migrated-architecture-applicability";
    const applicabilityArchitectureIds = new Set([
      ...elements
        .filter((element) => element.architectureScope === "specific")
        .map((element) => element.architectureId)
        .filter((id): id is string => Boolean(id)),
      ...relationships
        .map((relationship) => relationship.architectureId)
        .filter((id): id is string => Boolean(id))
    ]);
    if (root && applicabilityArchitectureIds.size && !featureGroups.some((group) => group.id === migrationGroupId)) {
      featureGroups.push({
        id: migrationGroupId,
        name: "Migrated architecture applicability",
        description: "Internal compatibility features created from legacy architecture-specific model content.",
        parentFeatureId: root.id,
        sortOrder: featureGroups.length
      });
    }
    const migrationFeatureByArchitecture = new Map<string, string>();
    applicabilityArchitectureIds.forEach((architectureId) => {
      const encodedArchitectureId = stableToken(architectureId);
      const featureId = `feature-migrated-architecture-${encodedArchitectureId}`;
      migrationFeatureByArchitecture.set(architectureId, featureId);
      if (!features.some((feature) => feature.id === featureId)) {
        const architectureName = architectures.find((architecture) => architecture.id === architectureId)?.name ?? architectureId;
        features.push({
          id: featureId,
          parentId: root?.id,
          parentGroupId: root ? migrationGroupId : undefined,
          name: `Legacy applicability: ${architectureName}`,
          featureType: "optional",
          sortOrder: features.length,
          description: "Internal migration feature preserving legacy architecture applicability.",
          valueType: "boolean",
          allowedValues: [],
          defaultValue: false,
          variabilityScope: "internal"
        });
      }
      const constrainedElementIds = elements
        .filter((element) => element.architectureScope === "specific" && element.architectureId === architectureId)
        .map((element) => element.id);
      const constrainedRelationshipIds = relationships
        .filter((relationship) => relationship.architectureId === architectureId)
        .map((relationship) => relationship.id);
      if ((constrainedElementIds.length || constrainedRelationshipIds.length)
        && !variationPoints.some((variationPoint) => variationPoint.id === `variation-migrated-architecture-${encodedArchitectureId}`)) {
        variationPoints.push({
          id: `variation-migrated-architecture-${encodedArchitectureId}`,
          name: `Legacy ${architectureId} applicability`,
          description: "Migrated from schema-3 architecture-specific applicability.",
          kind: "existence",
          constrainedElementIds,
          constrainedRelationshipIds,
          featureExpression: featureId,
          featureValueConditions: [],
          valueRules: [],
          enabled: true,
          createdAt: now,
          updatedAt: now
        });
      }
    });
    elements.forEach((element) => {
      element.architectureScope = "common";
      delete element.architectureId;
    });
    relationships.forEach((relationship) => { delete relationship.architectureId; });
    functionSequences.forEach((sequence) => { delete sequence.architectureId; });
    const configuredLegacyArchitectureIds = new Set(configurations.map((configuration) => configuration.architectureId));
    architectures.filter((architecture) => !configuredLegacyArchitectureIds.has(architecture.id)).forEach((architecture) => {
      configurations.push(applySelectionToConfiguration({
        id: `configuration-migrated-${architecture.id}`,
        name: architecture.name,
        architectureId: architecture.id,
        manuallySelectedFeatureIds: [],
        automaticConstraintFeatureIds: [],
        effectiveSelectedFeatureIds: [],
        autoSelectedFeatureIds: [],
        featureValues: {},
        validationStatus: "notValidated",
        validationMessages: ["Created automatically to preserve an unowned legacy architecture."],
        derivedElementIds: [],
        excludedElementIds: [],
        createdAt: architecture.createdAt ?? now,
        updatedAt: architecture.updatedAt ?? now
      }, features, featureConstraints));
    });
    const oldArchitectureById = new Map(architectures.map((architecture) => [architecture.id, architecture]));
    const oldArchitectureIdByConfigurationId = new Map(configurations.map((configuration) => [configuration.id, configuration.architectureId]));
    const usedArchitectureIds = new Set<string>();
    configurations = configurations.map((configuration) => {
      const oldArchitectureId = configuration.architectureId;
      const preservedId = oldArchitectureId && !usedArchitectureIds.has(oldArchitectureId)
        ? oldArchitectureId
        : `architecture-${configuration.id}`;
      usedArchitectureIds.add(preservedId);
      const migrationFeatureId = migrationFeatureByArchitecture.get(oldArchitectureId);
      const withMigrationSelection = migrationFeatureId
        ? {
            ...configuration,
            architectureId: preservedId,
            manuallySelectedFeatureIds: [...new Set([...configuration.manuallySelectedFeatureIds, migrationFeatureId])]
          }
        : { ...configuration, architectureId: preservedId };
      const next = applySelectionToConfiguration(withMigrationSelection, features, featureConstraints);
      if (next.derivation) {
        next.derivation = {
          ...next.derivation,
          sourceArchitectureId: preservedId,
          sourceModelRevision: 0
        };
      }
      return next;
    });
    architectures = configurations.map((configuration) => {
      const previous = oldArchitectureById.get(oldArchitectureIdByConfigurationId.get(configuration.id) ?? "");
      const hasUserIntent = configuration.manuallySelectedFeatureIds.length > 0
        || configuration.automaticConstraintFeatureIds.length > 0
        || features.some((feature) =>
          feature.valueType === "enumeration" && (configuration.featureValues?.[feature.id] ?? "") !== ""
        );
      return {
        id: configuration.architectureId,
        name: configuration.name,
        description: previous?.description ?? "Generated and owned by its configuration.",
        configurationId: configuration.id,
        status: configuration.archivedAt
          ? "archived"
          : configuration.derivation
            ? "stale"
            : configuration.validationStatus === "invalid"
              ? "invalid"
              : hasUserIntent || configuration.validationStatus === "valid"
                ? "configured"
                : "draft",
        archivedAt: configuration.archivedAt,
        createdAt: previous?.createdAt ?? configuration.createdAt,
        updatedAt: configuration.updatedAt
      };
    });
  } else {
    architectures = architectures.map((architecture) => ({
      ...architecture,
      status: architecture.status ?? "draft"
    }));
  }
  const simulationRuns = (Array.isArray(raw.simulationRuns) ? structuredClone(raw.simulationRuns) : []).map((run) => {
    const configuration = configurations.find((candidate) => candidate.id === run.configurationId);
    const derivation = configuration?.derivation;
    return {
      ...run,
      inputSnapshot: {
        ...run.inputSnapshot,
        backgroundRealization: run.inputSnapshot.backgroundRealization ?? false,
        realizedElements: run.inputSnapshot.realizedElements
          ?? structuredClone(derivation?.realizedElements ?? []),
        realizedRelationships: run.inputSnapshot.realizedRelationships
          ?? structuredClone(derivation?.realizedRelationships ?? []),
        appliedVariations: run.inputSnapshot.appliedVariations
          ?? structuredClone(derivation?.appliedVariations ?? [])
      }
    };
  });
  const kpis = (Array.isArray(raw.kpis) ? structuredClone(raw.kpis) : []).map((kpi) => ({
    ...kpi,
    objectiveIds: Array.isArray(kpi.objectiveIds)
      ? [...new Set(kpi.objectiveIds)].filter((id) =>
          elements.some((element) => element.id === id && element.elementType === "objective")
        )
      : []
  }));
  const rootFeatures = features.filter((feature) => feature.featureType === "root");
  const soleRootFeatureId = rootFeatures.length === 1 ? rootFeatures[0].id : undefined;
  const comparisonStudies: ComparisonStudy[] = (Array.isArray(raw.comparisonStudies) ? raw.comparisonStudies : []).map((study) => {
    const updatedAt = study.updatedAt ?? raw.updatedAt ?? new Date().toISOString();
    const legacyResult = study.results;
    const results = Array.isArray(legacyResult)
      ? structuredClone(legacyResult)
      : legacyResult && typeof legacyResult === "object"
        ? [structuredClone(legacyResult)]
        : [];
    const selectedKpiIds = Array.isArray(study.selectedKpiIds) ? [...new Set(study.selectedKpiIds)] : [];
    const legacySettings = study.kpiSettings && typeof study.kpiSettings === "object" ? study.kpiSettings : {};
    const alternativeRefs = Array.isArray(study.alternativeRefs) ? structuredClone(study.alternativeRefs) : [];
    const existingCandidateRefs = Array.isArray(study.candidateRefs) ? structuredClone(study.candidateRefs) : [];
    const candidateRefs = existingCandidateRefs.length
      ? existingCandidateRefs
      : alternativeRefs
          .filter((alternative) => Boolean(alternative.configurationId))
          .map((alternative) => ({
            id: `candidate-${stableToken(String(study.id ?? "study"))}-${stableToken(alternative.configurationId!)}`,
            label: alternative.label,
            configurationId: alternative.configurationId!,
            architectureId: alternative.architectureId
          }))
          .filter((candidate, index, candidates) =>
            candidates.findIndex((item) => item.configurationId === candidate.configurationId) === index
          );
    const originatingOpenDecisionId = typeof study.originatingOpenDecisionId === "string"
      ? study.originatingOpenDecisionId
      : raw.openDecisions?.length === 1
        ? raw.openDecisions[0].id
        : undefined;
    const objectiveIds = Array.isArray(study.objectiveIds)
      ? [...new Set(study.objectiveIds)]
      : [...new Set(selectedKpiIds.flatMap((kpiId) =>
          kpis.find((kpi) => kpi.id === kpiId)?.objectiveIds ?? []
        ))];
    const mandatoryRequirementIds = Array.isArray(study.mandatoryRequirementIds)
      ? [...new Set(study.mandatoryRequirementIds)]
      : [];
    const needIds = Array.isArray(study.needIds)
      ? [...new Set(study.needIds)]
      : [...new Set(relationships
          .filter((relationship) =>
            relationship.relationshipType === "derives"
            && mandatoryRequirementIds.includes(relationship.targetId)
            && newTypeById.get(relationship.sourceId) === "need"
          )
          .map((relationship) => relationship.sourceId))];
    const useCaseIds = Array.isArray(study.useCaseIds)
      ? [...new Set(study.useCaseIds)]
      : [...new Set(raw.selectedUseCaseIds ?? [])];
    const exploredFeatureIds = Array.isArray(study.exploredFeatureIds)
      ? [...new Set(study.exploredFeatureIds)]
      : [...new Set(candidateRefs.flatMap((candidate) =>
          configurations.find((configuration) => configuration.id === candidate.configurationId)?.effectiveSelectedFeatureIds ?? []
        ))];
    const criteria = Array.isArray(study.criteria)
      ? structuredClone(study.criteria).map((criterion) => ({
          ...criterion,
          sourceObjectiveIds: Array.isArray(criterion.sourceObjectiveIds) ? [...new Set(criterion.sourceObjectiveIds)] : [],
          sourceRequirementIds: Array.isArray(criterion.sourceRequirementIds) ? [...new Set(criterion.sourceRequirementIds)] : [],
          stakeholderValueFunction: criterion.stakeholderValueFunction
            ? structuredClone(criterion.stakeholderValueFunction)
            : undefined
        }))
      : selectedKpiIds.map((kpiId) => {
          const kpi = kpis.find((candidate) => candidate.id === kpiId);
          return {
            id: `criterion-migrated-${stableToken(String(study.id ?? "study"))}-${stableToken(kpiId)}`,
            name: kpi?.name ?? kpiId,
            description: "Migrated from the legacy comparison KPI selection.",
            type: "optimization" as const,
            sourceObjectiveIds: kpi?.objectiveIds ?? [],
            sourceRequirementIds: [],
            kpiId,
            weight: legacySettings[kpiId]?.weight ?? kpi?.weight ?? 1,
            valueFunction: legacySettings[kpiId]?.optimizationDirection ?? kpi?.optimizationDirection
          };
        });
    return {
      id: String(study.id ?? `comparison-migrated-${crypto.randomUUID()}`),
      name: String(study.name ?? "Migrated comparison"),
      description: String(study.description ?? ""),
      question: String(study.question
        ?? raw.openDecisions?.find((decision) => decision.id === originatingOpenDecisionId)?.question
        ?? `Which architecture should be selected from ${String(study.name ?? "this study")}?`),
      intendedOutcome: String(study.intendedOutcome ?? "Select an architecture and establish its justified baseline."),
      lifecycleScope: String(study.lifecycleScope ?? "Early architecture definition"),
      systemScope: String(study.systemScope ?? raw.name ?? "System under study"),
      status: study.status
        ?? (results.length
          ? "analyzed"
          : candidateRefs.length >= 2
            ? "collectingEvidence"
            : candidateRefs.length
              ? "definingCandidates"
              : "framing"),
      originatingOpenDecisionId,
      needIds,
      objectiveIds,
      useCaseIds,
      rootFeatureId: features.some((feature) => feature.id === study.rootFeatureId && feature.featureType === "root")
        ? study.rootFeatureId
        : soleRootFeatureId,
      selectedVariabilityAxisIds: Array.isArray(study.selectedVariabilityAxisIds)
        ? [...new Set(study.selectedVariabilityAxisIds)].filter((id) => variabilityAxes.some((axis) => axis.id === id))
        : [],
      mandatoryRequirementIds,
      exploredFeatureIds,
      criteria,
      candidateRefs,
      alternativeRefs,
      selectedKpiIds,
      kpiSettings: Object.fromEntries(selectedKpiIds.map((kpiId) => {
        const kpi = kpis.find((candidate) => candidate.id === kpiId);
        const setting = legacySettings[kpiId];
        return [kpiId, {
          weight: Number.isFinite(setting?.weight) ? setting!.weight : kpi?.weight ?? 1,
          optimizationDirection: setting?.optimizationDirection ?? kpi?.optimizationDirection ?? "minimize",
          threshold: setting?.threshold ? structuredClone(setting.threshold) : undefined
        }];
      })),
      createdAt: study.createdAt ?? updatedAt,
      updatedAt,
      settingsUpdatedAt: study.settingsUpdatedAt ?? updatedAt,
      results: results.map((result) => ({
        ...result,
        id: result.id ?? `comparison-result-migrated-${crypto.randomUUID()}`,
        studyId: result.studyId ?? study.id ?? "",
        settingsUpdatedAt: result.settingsUpdatedAt ?? study.settingsUpdatedAt ?? updatedAt,
        methodology: result.methodology ?? "legacy-relative"
      })),
      sensitivityResult: study.sensitivityResult ? structuredClone(study.sensitivityResult) : undefined,
      scenarios: Array.isArray(study.scenarios) ? structuredClone(study.scenarios) : [],
      robustnessResults: Array.isArray(study.robustnessResults) ? structuredClone(study.robustnessResults) : [],
      feasibilityExceptions: study.feasibilityExceptions && typeof study.feasibilityExceptions === "object"
        ? structuredClone(study.feasibilityExceptions)
        : {}
    };
  });
  const comparisonRisks: ComparisonRisk[] = (Array.isArray(raw.comparisonRisks)
    ? raw.comparisonRisks
    : []).map((risk) => {
      const legacy = risk as Partial<ComparisonRisk> & {
        likelihood?: "low" | "medium" | "high";
        impact?: "low" | "medium" | "high";
      };
      const legacyValue = (value: "low" | "medium" | "high" | undefined): 1 | 3 | 5 =>
        value === "high" ? 5 : value === "medium" ? 3 : 1;
      const hasNumericRisk = Number.isInteger(legacy.inherentLikelihood)
        && Number.isInteger(legacy.inherentImpact)
        && Number.isInteger(legacy.residualLikelihood)
        && Number.isInteger(legacy.residualImpact);
      const inherentLikelihood = hasNumericRisk
        ? legacy.inherentLikelihood as ComparisonRisk["inherentLikelihood"]
        : legacyValue(legacy.likelihood);
      const inherentImpact = hasNumericRisk
        ? legacy.inherentImpact as ComparisonRisk["inherentImpact"]
        : legacyValue(legacy.impact);
      return {
        id: String(legacy.id ?? `risk-migrated-${crypto.randomUUID()}`),
        comparisonStudyId: String(legacy.comparisonStudyId ?? ""),
        alternativeId: String(legacy.alternativeId ?? ""),
        title: String(legacy.title ?? "Migrated risk"),
        description: String(legacy.description ?? ""),
        inherentLikelihood,
        inherentImpact,
        residualLikelihood: hasNumericRisk
          ? legacy.residualLikelihood as ComparisonRisk["residualLikelihood"]
          : inherentLikelihood,
        residualImpact: hasNumericRisk
          ? legacy.residualImpact as ComparisonRisk["residualImpact"]
          : inherentImpact,
        mitigation: legacy.mitigation,
        owner: legacy.owner,
        status: legacy.status ?? "open",
        applicableArchitectureIds: Array.isArray(legacy.applicableArchitectureIds) ? [...legacy.applicableArchitectureIds] : [],
        applicableConfigurationIds: Array.isArray(legacy.applicableConfigurationIds) ? [...legacy.applicableConfigurationIds] : [],
        applicableRequirementIds: Array.isArray(legacy.applicableRequirementIds) ? [...legacy.applicableRequirementIds] : [],
        applicableParameterIds: Array.isArray(legacy.applicableParameterIds) ? [...legacy.applicableParameterIds] : [],
        applicableKpiIds: Array.isArray(legacy.applicableKpiIds) ? [...legacy.applicableKpiIds] : [],
        reviewRequired: hasNumericRisk ? Boolean(legacy.reviewRequired) : true
      };
    });
  const architectSession = normalizeArchitectSession(
    raw.architectSession,
    raw.id,
    Number.isFinite(raw.modelRevision) && raw.modelRevision >= 1 ? raw.modelRevision : 1,
    raw.createdAt ?? new Date().toISOString(),
    raw.updatedAt ?? raw.createdAt ?? new Date().toISOString()
  );
  const { assumptions: _legacyProjectAssumptions, ...projectWithoutLegacyAssumptions } = raw;
  return normalizeOntology({
    ...projectWithoutLegacyAssumptions,
    schemaVersion: raw.schemaVersion ?? 1,
    overallScope: ["architectureBuilding", "architectureAndSimulation", "tradeStudy"].includes(raw.overallScope ?? "")
      ? raw.overallScope
      : comparisonStudies.length
        ? "tradeStudy"
        : simulationRuns.length
          ? "architectureAndSimulation"
          : "architectureBuilding",
    architectSession,
    activeComparisonStudyId: comparisonStudies.some((study) => study.id === raw.activeComparisonStudyId)
      ? raw.activeComparisonStudyId
      : comparisonStudies[0]?.id,
    objectives: objectiveProjection({ elements }),
    elements,
    relationships,
    functionSequences,
    selectedUseCaseIds: Array.isArray(raw.selectedUseCaseIds) ? raw.selectedUseCaseIds : [],
    rowOrderByType: raw.rowOrderByType && typeof raw.rowOrderByType === "object" ? raw.rowOrderByType : {},
    unitDefinitions: Array.isArray(raw.unitDefinitions) ? raw.unitDefinitions : [],
    customAttributeDefinitions: Array.isArray(raw.customAttributeDefinitions) ? raw.customAttributeDefinitions : [],
    architectures,
    features,
    featureGroups,
    variabilityAxes,
    featureConstraints,
    variationPoints,
    configurations,
    kpis,
    comparisonStudies,
    comparisonRisks,
    decisions: Array.isArray(raw.decisions) ? raw.decisions.map((decision) => ({
      ...structuredClone(decision),
      alternatives: Array.isArray(decision.alternatives) ? decision.alternatives : [],
      criteria: Array.isArray(decision.criteria) ? decision.criteria : [],
      supportingSimulationRunIds: Array.isArray(decision.supportingSimulationRunIds) ? decision.supportingSimulationRunIds : [],
      supportingComparisonStudyIds: Array.isArray(decision.supportingComparisonStudyIds) ? decision.supportingComparisonStudyIds : [],
      assumptions: Array.isArray(decision.assumptions) ? decision.assumptions : [],
      risks: Array.isArray(decision.risks) ? decision.risks : [],
      openActions: Array.isArray(decision.openActions) ? decision.openActions : [],
      status: decision.status ?? "draft",
      createdAt: decision.createdAt ?? raw.createdAt ?? new Date().toISOString(),
      updatedAt: decision.updatedAt ?? raw.updatedAt ?? new Date().toISOString()
    })) : [],
    simulationRuns,
    validationResults: [
      ...(Array.isArray(raw.validationResults)
        ? raw.validationResults.filter((finding) => finding.ruleId !== "PMB-114")
        : []),
      ...migrationWarnings
    ],
    modelRevision: Number.isFinite(raw.modelRevision) && raw.modelRevision >= 1 ? raw.modelRevision : 1
  });
}

export function migrateProject(value: unknown): Project {
  const schemaVersion = value && typeof value === "object"
    ? (value as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (typeof schemaVersion !== "number" || !SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    throw new Error(`Unsupported project schema version: ${String(schemaVersion)}`);
  }
  return normalizeProject(value);
}

function normalizeModelTab(value: unknown): ModelTabId {
  const map: Record<string, ModelTabId> = {
    "needs-requirements": "mission-context",
    "functions-architecture": "product-functional",
    "processes-resources": "process-functional",
    "interfaces-traceability": "traceability"
  };
  return map[String(value)] ?? value as ModelTabId;
}

export function migratePersistedState(value: unknown): PersistedAppState {
  if (!value || typeof value !== "object") throw new Error("Stored application state is not an object.");
  const candidate = value as Partial<PersistedAppState>;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(candidate.schemaVersion ?? -1)) {
    throw new Error(`Unsupported schema version: ${String(candidate.schemaVersion)}`);
  }
  if (!Array.isArray(candidate.projects) || !candidate.uiPreferences) {
    throw new Error("Stored application state is incomplete.");
  }
  const projects = candidate.projects.map((projectValue) => {
    const project = normalizeProject(projectValue);
    const isEmptyProjectCreatedByAffectedVersion = project.elements.length === 0
      && project.relationships.length === 0
      && project.architectures.length === 0
      && project.features.length === 0
      && project.featureGroups.length === 0
      && project.variabilityAxes.length === 0
      && project.variationPoints.length === 0
      && project.configurations.length === 0
      && project.kpis.length === 0
      && project.simulationRuns.length === 0
      && project.comparisonStudies.length === 0
      && project.comparisonRisks.length === 0
      && project.decisions.length === 0
      && project.featureConstraints.length > 0;
    if (!isEmptyProjectCreatedByAffectedVersion) return project;
    return {
      ...project,
      activeArchitectureId: undefined,
      baselineArchitectureId: undefined,
      featureConstraints: []
    };
  });
  const applicationSnapshots: ProjectSnapshot[] = Array.isArray(candidate.snapshots)
    ? structuredClone(candidate.snapshots)
    : [];
  candidate.projects.forEach((projectValue) => {
    const legacySnapshots = (projectValue as unknown as { snapshots?: unknown }).snapshots;
    if (!Array.isArray(legacySnapshots)) return;
    legacySnapshots.forEach((snapshotValue) => {
      if (!snapshotValue || typeof snapshotValue !== "object") return;
      const legacy = structuredClone(snapshotValue) as Partial<ProjectSnapshot> & { projectData?: unknown };
      let projectData = legacy.projectData;
      if (typeof projectData !== "string") projectData = JSON.stringify(projectData ?? projectValue);
      try {
        const parsed = JSON.parse(projectData) as Record<string, unknown>;
        delete parsed.snapshots;
        projectData = JSON.stringify(parsed);
      } catch {
        return;
      }
      const snapshot: ProjectSnapshot = {
        id: legacy.id ?? `snapshot-migrated-${crypto.randomUUID()}`,
        sourceProjectId: legacy.sourceProjectId ?? String((projectValue as Project).id),
        name: legacy.name ?? "Migrated snapshot",
        note: legacy.note,
        projectName: legacy.projectName ?? String((projectValue as Project).name ?? "Project"),
        createdAt: legacy.createdAt ?? new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        projectData
      };
      if (!applicationSnapshots.some((candidateSnapshot) => candidateSnapshot.id === snapshot.id)) {
        applicationSnapshots.push(snapshot);
      }
    });
  });
  if (candidate.activeProjectId !== null && !projects.some((project) => project.id === candidate.activeProjectId)) {
    throw new Error("Active project reference is invalid.");
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeProjectId: candidate.activeProjectId ?? null,
    projects,
    snapshots: applicationSnapshots.map((snapshot) => {
      let projectData = snapshot.projectData;
      try {
        const parsed = JSON.parse(projectData) as Record<string, unknown>;
        delete parsed.snapshots;
        projectData = JSON.stringify(parsed);
      } catch {
        // Keep corrupt snapshot bytes available for recovery and download.
      }
      return { ...snapshot, schemaVersion: snapshot.schemaVersion ?? CURRENT_SCHEMA_VERSION, projectData };
    }),
    uiPreferences: {
      activePerspective: ["architect", "modeler"].includes(candidate.uiPreferences.activePerspective ?? "")
        ? candidate.uiPreferences.activePerspective
        : undefined,
      activeWorkspace: candidate.uiPreferences.activeWorkspace ?? "dashboard",
      activeModelTab: normalizeModelTab(candidate.uiPreferences.activeModelTab),
      activeModelView: candidate.uiPreferences.activeModelView ?? "table",
      activeElementType: candidate.uiPreferences.activeElementType,
      activeElementTypes: Array.isArray(candidate.uiPreferences.activeElementTypes)
        ? candidate.uiPreferences.activeElementTypes.filter((item): item is ElementType => typeof item === "string" && elementTypes.includes(item as ElementType))
        : undefined,
      tableSortModeByType: candidate.uiPreferences.tableSortModeByType ?? {},
      graphLayoutModeByTab: candidate.uiPreferences.graphLayoutModeByTab ?? {},
      workflowFocus: candidate.uiPreferences.workflowFocus,
      dashboardFocusedStepId: candidate.uiPreferences.dashboardFocusedStepId,
      dashboardScrollY: Number.isFinite(candidate.uiPreferences.dashboardScrollY)
        ? candidate.uiPreferences.dashboardScrollY
        : 0,
      detailsPanelOpen: candidate.uiPreferences.detailsPanelOpen ?? true,
      validationSeverity: candidate.uiPreferences.validationSeverity ?? "all",
      validationCategory: candidate.uiPreferences.validationCategory ?? "all",
      validationDomain: candidate.uiPreferences.validationDomain ?? "all",
      variationPointView: candidate.uiPreferences.variationPointView ?? "graph",
      variationGraphSections: candidate.uiPreferences.variationGraphSections ?? [],
      variationGraphElementTypes: candidate.uiPreferences.variationGraphElementTypes ?? [],
      activeVariabilityTab: candidate.uiPreferences.activeVariabilityTab ?? "Feature Model",
      activeTradeStudyTab: String(candidate.uiPreferences.activeTradeStudyTab) === "Assumptions and Risks"
        ? "Uncertainty and Risks"
        : candidate.uiPreferences.activeTradeStudyTab ?? "Guided Workflow",
      tradeStudyView: candidate.uiPreferences.tradeStudyView ?? "manager"
    }
  };
}

export function loadPersistedState(storage: Pick<Storage, "getItem"> = localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return {};
  try {
    return { state: migratePersistedState(JSON.parse(raw) as unknown) };
  } catch (error) {
    return {
      corruptRaw: raw,
      error: error instanceof Error ? error.message : "Stored state could not be read."
    };
  }
}

export function serializeState(state: PersistedAppState): string {
  return JSON.stringify(state);
}
