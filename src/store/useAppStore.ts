import { convertValue } from "../domain/units";
import { normalizeOntology, setParentAssembly } from "../domain/ontology";
import { create } from "zustand";
import { createExampleProject, type ExampleProjectId } from "../data/examples";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { applyArchitectAnswer, withCanonicalArchitectAnswers, type ArchitectQuestion } from "../domain/architectView";
import { recalculateCalculatedParameters } from "../domain/calculatedParameters";
import { leadingAlternativeIds } from "../domain/comparison";
import { deriveConfiguration } from "../domain/derivation";
import { parseFeatureExpression } from "../domain/featureExpressions";
import { parseExportPackage } from "../domain/exportImport";
import { replaceObjectiveElements, withObjectiveProjection } from "../domain/objectives";
import { validateRelationship } from "../domain/relationships";
import { calculateSemanticScope } from "../domain/semanticScope";
import { analyzeSequence, sequenceWouldCycle } from "../domain/sequences";
import { runSimulation, type SimulationRequest } from "../domain/simulation";
import {
  runBoundedRobustness,
  runFixedWeightSensitivity,
  runTraceableTradeStudy,
  summarizeRisks
} from "../domain/tradeStudyMethodology";
import { createProjectSnapshot, duplicateSnapshotProject, parseSnapshotProject, SNAPSHOT_LIMIT, sourceProjectSnapshots } from "../domain/snapshots";
import type {
  AppPerspective, ArchitectAnswerStatus, Architecture, ArchitectureStatus, ComparisonResult, ComparisonRisk, ComparisonStudy, Configuration, CustomAttributeDefinition, Decision, ElementType, Feature, FeatureConstraint, FeatureGroup, FunctionSequence, GraphLayoutMode,
  KPI, ModelElement, ModelTabId, Parameter, PersistedAppState, Project, ProjectSnapshot, Relationship, SimulationRun, UiPreferences, UnitDefinition,
  ValidationCategory, ValidationSeverity, VariabilityAxis, VariabilityTab, VariationPoint, WorkspaceId
} from "../domain/types";
import { deleteElementCascade, findProcessCycle, validateProject } from "../domain/validation";
import { applySelectionToConfiguration, configurationWithValidation, descendantsOf, validateConfiguration } from "../domain/variability";
import { referencedFeatureIds } from "../domain/variationPoints";
import { CURRENT_SCHEMA_VERSION, loadPersistedState, migrateProject, serializeState, STORAGE_KEY } from "./persistence";

type SaveStatus = "Saved" | "Saving" | "Save error";

interface AppStore extends PersistedAppState {
  selectedElementId: string | null;
  selectedRelationshipId: string | null;
  selectedFeatureId: string | null;
  selectedVariationPointId: string | null;
  selectedConfigurationId: string | null;
  saveStatus: SaveStatus;
  corruptRaw?: string;
  recoveryError?: string;
  setPerspective: (perspective?: AppPerspective) => void;
  answerArchitectQuestion: (question: ArchitectQuestion, value: unknown, status?: ArchitectAnswerStatus) => void;
  setArchitectCurrentQuestion: (key: string) => void;
  setWorkspace: (workspace: WorkspaceId) => void;
  setModelTab: (tab: ModelTabId) => void;
  setModelView: (view: UiPreferences["activeModelView"]) => void;
  setElementTypeFilter: (type?: ElementType) => void;
  setElementTypeGroup: (types?: ElementType[]) => void;
  setTableSortMode: (type: ElementType, mode: "manual" | "az" | "za") => void;
  setGraphLayoutMode: (tab: ModelTabId, mode: GraphLayoutMode) => void;
  setWorkflowFocus: (focus?: string) => void;
  setDashboardContext: (stepId?: string, scrollY?: number) => void;
  setValidationFilters: (filters: Partial<{
    severity: ValidationSeverity | "all";
    category: ValidationCategory | "all";
    domain: UiPreferences["validationDomain"];
  }>) => void;
  setVariationPointView: (view: UiPreferences["variationPointView"]) => void;
  setVariationGraphFilters: (sections: ModelTabId[], elementTypes: ElementType[]) => void;
  setVariabilityTab: (tab: VariabilityTab) => void;
  setTradeStudyTab: (tab: UiPreferences["activeTradeStudyTab"]) => void;
  setTradeStudyView: (view: UiPreferences["tradeStudyView"]) => void;
  selectElement: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;
  selectFeature: (id: string | null) => void;
  selectVariationPoint: (id: string | null) => void;
  selectConfiguration: (id: string | null) => void;
  switchProject: (id: string) => void;
  createProject: (name: string) => void;
  updateProject: (patch: Partial<Pick<Project, "name" | "description" | "objectives" | "overallScope">>) => void;
  setActiveComparisonStudy: (id?: string) => void;
  duplicateProject: () => void;
  deleteProject: (id: string) => void;
  loadExampleProject: (exampleId: ExampleProjectId) => void;
  resetActiveProject: () => void;
  resetEntireApplication: (mode?: "sample" | "empty") => void;
  recoverFromCorruptStorage: () => void;
  addArchitecture: (architecture: Architecture) => void;
  updateArchitecture: (id: string, patch: Partial<Architecture>) => void;
  deleteArchitecture: (id: string) => void;
  setActiveArchitecture: (id?: string) => void;
  setBaselineArchitecture: (id?: string) => void;
  addElement: (element: ModelElement) => void;
  updateElement: (id: string, patch: Partial<ModelElement>) => void;
  duplicateElement: (id: string) => void;
  deleteElement: (id: string) => void;
  addParameter: (elementId: string, parameter: Parameter) => void;
  updateParameter: (elementId: string, parameterId: string, patch: Partial<Parameter>) => void;
  deleteParameter: (elementId: string, parameterId: string) => void;
  bindRequirementParameter: (requirementId: string, parameterId: string) => string | null;
  setSelectedUseCases: (ids: string[]) => void;
  moveElement: (type: ElementType, elementId: string, beforeId?: string) => void;
  addFunctionSequence: (sequence: FunctionSequence) => void;
  updateFunctionSequence: (id: string, patch: Partial<FunctionSequence>) => void;
  deleteFunctionSequence: (id: string) => void;
  addUnitDefinition: (definition: UnitDefinition) => void;
  updateUnitDefinition: (id: string, patch: Partial<UnitDefinition>) => void;
  deleteUnitDefinition: (id: string) => void;
  addCustomAttributeDefinition: (definition: CustomAttributeDefinition) => void;
  updateCustomAttributeDefinition: (id: string, patch: Partial<CustomAttributeDefinition>) => void;
  deleteCustomAttributeDefinition: (id: string) => void;
  addRelationship: (relationship: Relationship) => string | null;
  updateRelationship: (id: string, patch: Partial<Relationship>) => string | null;
  deleteRelationship: (id: string) => void;
  addFeature: (feature: Feature) => void;
  updateFeature: (id: string, patch: Partial<Feature>) => void;
  duplicateFeature: (id: string) => void;
  deleteFeatureReferences: (id: string) => void;
  addFeatureGroup: (group: FeatureGroup) => void;
  updateFeatureGroup: (id: string, patch: Partial<FeatureGroup>) => void;
  deleteFeatureGroup: (id: string) => void;
  createVariabilityAxis: (name: string, description?: string, existingFeatureGroupId?: string) => string | null;
  updateVariabilityAxis: (id: string, patch: Partial<Pick<VariabilityAxis, "name" | "description">>) => string | null;
  deleteVariabilityAxis: (id: string) => string | null;
  addFeatureConstraint: (constraint: FeatureConstraint) => string | null;
  updateFeatureConstraint: (id: string, constraint: FeatureConstraint) => string | null;
  deleteFeatureConstraint: (id: string) => void;
  addVariationPoint: (variationPoint: VariationPoint) => void;
  updateVariationPoint: (id: string, patch: Partial<VariationPoint>) => void;
  deleteVariationPoint: (id: string) => void;
  addConfiguration: (configuration: Configuration) => void;
  updateConfiguration: (id: string, patch: Partial<Configuration>) => void;
  deleteConfiguration: (id: string) => void;
  validateConfigurationById: (id: string) => void;
  deriveConfigurationById: (id: string) => string[];
  addKpi: (kpi: KPI) => void;
  updateKpi: (id: string, patch: Partial<KPI>) => void;
  deleteKpi: (id: string) => string | null;
  executeSimulation: (request: SimulationRequest, warningsAcknowledged?: boolean) => { run?: SimulationRun; errors: string[]; warnings: string[]; needsRederivation: boolean };
  addComparisonStudy: (study: ComparisonStudy) => void;
  updateComparisonStudy: (id: string, patch: Partial<ComparisonStudy>, calculationAffecting?: boolean) => void;
  duplicateComparisonStudy: (id: string) => void;
  deleteComparisonStudy: (id: string) => string | null;
  executeComparison: (id: string) => { errors: string[]; warnings: string[] };
  executeSensitivity: (id: string) => string[];
  executeRobustness: (id: string) => string[];
  createTradeStudyCandidate: (
    studyId: string,
    mode: "first" | "duplicate" | "different",
    sourceConfigurationId?: string
  ) => { candidateId?: string; error?: string };
  addComparisonRisk: (risk: ComparisonRisk) => void;
  updateComparisonRisk: (id: string, patch: Partial<ComparisonRisk>) => void;
  duplicateComparisonRisk: (id: string) => void;
  deleteComparisonRisk: (id: string) => void;
  addDecision: (decision: Decision) => void;
  updateDecision: (id: string, patch: Partial<Decision>) => string | null;
  duplicateDecision: (id: string) => void;
  deleteDecision: (id: string) => void;
  createDecisionFromComparison: (studyId: string) => string | null;
  confirmDecisionSelection: (decisionId: string, alternative: string) => string | null;
  promoteOpenDecision: (openDecisionId: string) => string | null;
  createSnapshot: (name: string, note?: string, replaceOldest?: boolean) => string | null;
  deleteSnapshot: (id: string) => void;
  restoreSnapshot: (id: string, replaceOldest?: boolean) => string | null;
  duplicateSnapshot: (id: string) => string | null;
  importProjectPackage: (raw: string, mode: "new" | "replace", replaceOldestSnapshot?: boolean) => { errors: string[]; warnings: string[] };
  runValidation: () => void;
}

const defaultPreferences: UiPreferences = {
  activePerspective: undefined,
  activeWorkspace: "dashboard",
  activeModelTab: "mission-context",
  activeModelView: "table",
  tableSortModeByType: {},
  graphLayoutModeByTab: {},
  dashboardScrollY: 0,
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
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const createEmptyProject = (name = "New project", id = newId("project")): Project => {
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    modelRevision: 1,
    name: name.trim() || "Untitled project",
    description: "",
    overallScope: "architectureBuilding",
    objectives: [],
    openDecisions: [],
    createdAt: now,
    updatedAt: now,
    architectures: [],
    elements: [],
    relationships: [],
    functionSequences: [],
    selectedUseCaseIds: [],
    rowOrderByType: {},
    unitDefinitions: [],
    customAttributeDefinitions: [],
    features: [],
    featureGroups: [],
    variabilityAxes: [],
    featureConstraints: [],
    variationPoints: [],
    configurations: [],
    kpis: [],
    simulationRuns: [],
    comparisonStudies: [],
    comparisonRisks: [],
    decisions: [],
    validationResults: []
  };
};

export const createInitialEmptyState = (): PersistedAppState => {
  const project = createEmptyProject();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeProjectId: project.id,
    projects: [project],
    snapshots: [],
    uiPreferences: structuredClone(defaultPreferences)
  };
};

const loaded = typeof localStorage === "undefined" ? {} : loadPersistedState();
const initialPersisted: PersistedAppState = loaded.state ?? createInitialEmptyState();
const validateWithPersistentFindings = (project: Project) => [
  ...validateProject(project),
  ...project.validationResults.filter((finding) => ["PMB-114", "PMB-115"].includes(finding.ruleId))
];
initialPersisted.projects = initialPersisted.projects.map((project) => {
  const calculated = recalculateCalculatedParameters(project);
  return { ...calculated, validationResults: validateWithPersistentFindings(calculated) };
});

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persistentSlice(state: AppStore): PersistedAppState {
  return {
    schemaVersion: state.schemaVersion,
    activeProjectId: state.activeProjectId,
    projects: state.projects,
    snapshots: state.snapshots,
    uiPreferences: state.uiPreferences
  };
}

function scheduleSave(get: () => AppStore, set: (patch: Partial<AppStore>) => void) {
  if (get().corruptRaw !== undefined) return;
  set({ saveStatus: "Saving" });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeState(persistentSlice(get())));
      set({ saveStatus: "Saved" });
    } catch {
      set({ saveStatus: "Save error" });
    }
  }, 350);
}

const active = (state: AppStore) => state.projects.find((project) => project.id === state.activeProjectId);
const decisionEvidenceSnapshot = (
  project: Project,
  study: ComparisonStudy,
  result: ComparisonResult,
  decision: Pick<Decision, "selectedAlternative" | "rationale" | "owner" | "decisionDate" | "openActions">
): NonNullable<Decision["evidenceSnapshot"]> => {
  const supportingRuns = study.alternativeRefs
    .map((alternative) => project.simulationRuns.find((run) => run.id === alternative.simulationRunId))
    .filter((run): run is SimulationRun => Boolean(run));
  return {
    capturedAt: new Date().toISOString(),
    projectModelRevision: project.modelRevision,
    question: study.question,
    intendedOutcome: study.intendedOutcome,
    objectiveIds: [...study.objectiveIds],
    criteria: structuredClone(study.criteria),
    candidateAlternatives: structuredClone(study.alternativeRefs),
    selectedAlternative: decision.selectedAlternative,
    rejectedAlternatives: study.alternativeRefs
      .map((alternative) => alternative.label)
      .filter((label) => label !== decision.selectedAlternative),
    mandatoryCompliance: structuredClone(result.feasibility ?? {}),
    valueFunctionsAndWeights: study.criteria.map((criterion) => ({
      criterionId: criterion.id,
      kpiId: criterion.kpiId,
      weight: criterion.weight ?? 0,
      valueFunction: structuredClone(criterion.stakeholderValueFunction)
    })),
    rawEvidence: structuredClone(result.rawValues),
    transformedEvidence: structuredClone(result.stakeholderValues ?? result.normalizedScores),
    paretoResults: structuredClone(result.pareto ?? {}),
    sensitivity: structuredClone(study.sensitivityResult),
    risks: structuredClone(project.comparisonRisks.filter((risk) => risk.comparisonStudyId === study.id)),
    scenarios: structuredClone(study.scenarios ?? []),
    robustnessResults: structuredClone(study.robustnessResults ?? []),
    assumptions: [],
    limitations: [
      "Preliminary engineering estimate — not a verified detailed-design result.",
      ...result.warnings
    ],
    derivationIds: supportingRuns
      .map((run) => run.derivationId)
      .filter((id): id is string => Boolean(id)),
    simulationRunIds: supportingRuns.map((run) => run.id),
    rationale: decision.rationale,
    owner: decision.owner,
    decisionDate: decision.decisionDate,
    openActions: [...decision.openActions]
  };
};
const configurationArchitectureStatus = (project: Project, configuration: Configuration): ArchitectureStatus => {
  if (configuration.archivedAt) return "archived";
  const hasUserIntent = configuration.manuallySelectedFeatureIds.length > 0
    || configuration.automaticConstraintFeatureIds.length > 0
    || project.features.some((feature) =>
      feature.valueType === "enumeration" && (configuration.featureValues?.[feature.id] ?? "") !== ""
    );
  if (!hasUserIntent && configuration.validationStatus === "notValidated") return "draft";
  if (configuration.validationStatus === "invalid"
    || validateConfiguration(project, configuration).some((finding) => finding.severity === "error")) return "invalid";
  if (configuration.derivation?.sourceModelRevision === project.modelRevision) return "realized";
  if (configuration.derivation) return "stale";
  if (configuration.effectiveSelectedFeatureIds.length || configuration.validationStatus === "valid") return "configured";
  return "draft";
};
const synchronizeGeneratedArchitectures = (project: Project): Project => ({
  ...project,
  architectures: project.architectures.map((architecture) => {
    const configuration = project.configurations.find((candidate) => candidate.id === architecture.configurationId);
    if (!configuration) return architecture;
    const calculatedStatus = configurationArchitectureStatus(project, configuration);
    const isCandidate = project.comparisonStudies.some((study) =>
      study.candidateRefs.some((candidate) => candidate.architectureId === architecture.id)
    );
    const status = project.baselineArchitectureId === architecture.id
      ? "baseline"
      : isCandidate && !["invalid", "archived", "stale"].includes(calculatedStatus)
        ? "candidate"
        : calculatedStatus;
    return {
      ...architecture,
      name: configuration.name,
      status,
      archivedAt: configuration.archivedAt,
      updatedAt: configuration.updatedAt
    };
  })
});

type ArchitectReviewImpact = {
  changedIds: Set<string>;
  questionIds: Set<string>;
  questionInstances: Map<string, Set<string>>;
  sections: Set<string>;
};

const reviewRecapBySection: Record<string, string[]> = {
  intent: ["AV-B05"], scope: ["AV-C05"], requirements: ["AV-D10"], tradeFraming: ["AV-T06"],
  productBehavior: ["AV-E04"], productStructure: ["AV-F06"], industrialStructure: ["AV-G12"],
  traceability: ["AV-H04"], analysis: ["AV-I12"], variability: ["AV-J09"],
  tradeSimulation: ["AV-S04"], comparison: ["AV-L08"]
};

const semanticJson = (value: unknown) => JSON.stringify(value, (key, candidate) =>
  ["createdAt", "updatedAt", "completedAt"].includes(key) ? undefined : candidate
);

function changedRecordIds<T extends { id: string }>(before: T[], after: T[], project: (record: T) => unknown = (record) => record) {
  const previous = new Map(before.map((record) => [record.id, semanticJson(project(record))]));
  const current = new Map(after.map((record) => [record.id, semanticJson(project(record))]));
  return new Set([...new Set([...previous.keys(), ...current.keys()])].filter((id) => previous.get(id) !== current.get(id)));
}

function valueReferences(value: unknown, ids: Set<string>): boolean {
  if (typeof value === "string") return ids.has(value);
  if (Array.isArray(value)) return value.some((candidate) => valueReferences(candidate, ids));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((candidate) => valueReferences(candidate, ids));
  return false;
}

function architectReviewImpact(before: Project, after: Project): ArchitectReviewImpact {
  const impact: ArchitectReviewImpact = { changedIds: new Set(), questionIds: new Set(), questionInstances: new Map(), sections: new Set() };
  const addSection = (...sectionIds: string[]) => sectionIds.forEach((sectionId) => impact.sections.add(sectionId));
  const addQuestion = (...questionIds: string[]) => questionIds.forEach((questionId) => impact.questionIds.add(questionId));
  const addInstance = (questionId: string, ...instanceIds: string[]) => {
    const instances = impact.questionInstances.get(questionId) ?? new Set<string>();
    instanceIds.forEach((instanceId) => instances.add(instanceId));
    impact.questionInstances.set(questionId, instances);
  };
  const addChanged = (ids: Iterable<string>) => { for (const id of ids) impact.changedIds.add(id); };

  const changedElements = changedRecordIds(before.elements, after.elements, (element) => {
    const { parameters: _parameters, ...semanticElement } = element;
    return semanticElement;
  });
  addChanged(changedElements);
  changedElements.forEach((elementId) => {
    const element = after.elements.find((candidate) => candidate.id === elementId) ?? before.elements.find((candidate) => candidate.id === elementId);
    if (!element) return;
    switch (element.elementType) {
      case "mission": addSection("intent"); addQuestion("AV-A04", "AV-M02"); break;
      case "stakeholder":
        addSection("intent", "scope"); addQuestion("AV-B01", "AV-A05", "AV-M02");
        ["AV-B02", "AV-B03", "AV-B04"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "need": addSection("intent", "scope", "requirements", "evaluation"); addQuestion("AV-M02", "AV-M04"); addInstance("AV-D01", elementId); break;
      case "objective": addSection("intent", "scope", "requirements", "evaluation"); addQuestion("AV-M02", "AV-M04"); addInstance("AV-D02", elementId); break;
      case "useCase":
        addSection("scope", "productBehavior", "industrialBehavior"); addQuestion("AV-C01", "AV-C04", "AV-M03");
        ["AV-C02", "AV-C03", "AV-E01", "AV-E02", "AV-G01", "AV-G02"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "systemRequirement":
        addSection("requirements", "traceability", "analysisInputs"); addQuestion("AV-M04");
        ["AV-D03", "AV-D04", "AV-D05", "AV-D06", "AV-D07", "AV-D08", "AV-D09", "AV-H01", "AV-H02", "AV-H03"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "productFunction":
        addSection("productBehavior", "productStructure", "traceability", "analysisInputs"); addQuestion("AV-M03");
        ["AV-E03", "AV-F01", "AV-F03", "AV-F04", "AV-F05"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "productComponent":
        addSection("productStructure", "industrialStructure", "traceability", "analysisInputs"); addQuestion("AV-M03");
        ["AV-F02", "AV-F05"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "processFunction":
        addSection("industrialBehavior", "industrialStructure", "traceability", "analysisInputs"); addQuestion("AV-M03");
        ["AV-G03", "AV-G04", "AV-G06", "AV-G07", "AV-G08"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "industrialSystemComponent":
        addSection("industrialStructure", "traceability", "analysisInputs"); addQuestion("AV-M03");
        ["AV-G05", "AV-G09", "AV-G11"].forEach((questionId) => addInstance(questionId, elementId));
        break;
      case "resource": addSection("industrialStructure", "analysisInputs"); addQuestion("AV-M03"); break;
      case "productInterface": addSection("productStructure"); addQuestion("AV-M03"); break;
      case "processInterface": addSection("industrialStructure"); addQuestion("AV-M03"); break;
      case "verificationMethod": addSection("traceability"); addQuestion("AV-M04"); break;
    }
  });

  const changedRelationships = changedRecordIds(before.relationships, after.relationships);
  addChanged(changedRelationships);
  changedRelationships.forEach((relationshipId) => {
    const relationship = after.relationships.find((candidate) => candidate.id === relationshipId) ?? before.relationships.find((candidate) => candidate.id === relationshipId);
    if (!relationship) return;
    addChanged([relationship.sourceId, relationship.targetId]);
    switch (relationship.relationshipType) {
      case "hasSOI": addSection("intent", "scope"); addQuestion("AV-A05", "AV-M02", "AV-M03"); break;
      case "hasStakeholder": addSection("intent"); addQuestion("AV-B01", "AV-M02"); break;
      case "participatesInMission": addSection("intent"); addQuestion("AV-M02"); break;
      case "hasNeed": addSection("intent", "scope"); addInstance("AV-B03", relationship.sourceId); addQuestion("AV-M02"); break;
      case "hasObjective": addSection("intent", "scope"); addInstance("AV-B04", relationship.sourceId); addQuestion("AV-M02"); break;
      case "involvedIn": addSection("scope"); addInstance("AV-C02", relationship.targetId); addInstance("AV-C03", relationship.targetId); addQuestion("AV-C04", "AV-M02"); break;
      case "addresses": addSection("scope"); addInstance("AV-C03", relationship.sourceId); addQuestion("AV-M02"); break;
      case "derives":
        addSection("requirements");
        if ((after.elements.find((element) => element.id === relationship.sourceId) ?? before.elements.find((element) => element.id === relationship.sourceId))?.elementType === "objective") addInstance("AV-D02", relationship.sourceId);
        else addInstance("AV-D01", relationship.sourceId);
        addQuestion("AV-M04"); break;
      case "hasFunction":
        addSection("productBehavior", "industrialBehavior"); addInstance("AV-E01", relationship.sourceId); addInstance("AV-G01", relationship.sourceId); addQuestion("AV-M03"); break;
      case "realizedBy": addSection("productStructure", "industrialStructure", "traceability"); addInstance("AV-F01", relationship.sourceId); addInstance("AV-G04", relationship.sourceId); addQuestion("AV-M03"); break;
      case "satisfiedBy": addSection("productBehavior", "productStructure", "industrialStructure", "traceability"); addInstance("AV-H02", relationship.sourceId); addQuestion("AV-M04"); break;
      case "consumes": addSection("industrialStructure"); addInstance("AV-G07", relationship.sourceId); addQuestion("AV-M03"); break;
      case "produces": addSection("industrialStructure"); addInstance("AV-G08", relationship.sourceId); addQuestion("AV-M03"); break;
      case "requiresResource": addSection("industrialStructure", "analysisInputs"); addInstance("AV-G09", relationship.sourceId); addQuestion("AV-M03"); break;
      case "connects": addSection("productStructure", "industrialStructure"); addQuestion("AV-M03"); break;
      case "verifies": addSection("traceability"); addInstance("AV-H01", relationship.targetId); addQuestion("AV-M04"); break;
      case "allocatedTo": addSection("traceability"); addQuestion("AV-M04"); break;
      default: addSection("productBehavior", "industrialBehavior", "traceability");
    }
  });

  const previousParameters = before.elements.flatMap((element) => element.parameters);
  const currentParameters = after.elements.flatMap((element) => element.parameters);
  const changedParameters = changedRecordIds(previousParameters, currentParameters);
  addChanged(changedParameters);
  if (changedParameters.size) {
    addSection("requirements", "traceability", "analysisInputs"); addQuestion("AV-M04");
    [...changedParameters].forEach((parameterId) => {
      const owner = after.elements.find((element) => element.parameters.some((parameter) => parameter.id === parameterId)) ?? before.elements.find((element) => element.parameters.some((parameter) => parameter.id === parameterId));
      if (owner) addChanged([owner.id]);
      [...after.elements, ...before.elements].filter((element) => element.requirementFormula?.bindings.some((binding) => binding.targetId === parameterId)).forEach((requirement) => {
        ["AV-D05", "AV-D06", "AV-D07", "AV-H02", "AV-H03"].forEach((questionId) => addInstance(questionId, requirement.id));
      });
      [...after.kpis, ...before.kpis].filter((kpi) => kpi.inputParameterIds.includes(parameterId) || kpi.formula?.includes(parameterId)).forEach((kpi) => {
        ["AV-I04", "AV-I05", "AV-I08"].forEach((questionId) => addInstance(questionId, kpi.id));
      });
    });
  }

  const changedSequences = changedRecordIds(before.functionSequences, after.functionSequences); addChanged(changedSequences);
  changedSequences.forEach((sequenceId) => {
    const sequence = after.functionSequences.find((candidate) => candidate.id === sequenceId) ?? before.functionSequences.find((candidate) => candidate.id === sequenceId);
    if (!sequence) return;
    addSection(sequence.domain === "product" ? "productBehavior" : "industrialBehavior");
    sequence.useCaseIds.forEach((useCaseId) => addInstance(sequence.domain === "product" ? "AV-E02" : "AV-G02", useCaseId));
    addQuestion("AV-M03");
  });
  if (semanticJson(before.selectedUseCaseIds) !== semanticJson(after.selectedUseCaseIds)) { addChanged([...before.selectedUseCaseIds, ...after.selectedUseCaseIds]); addSection("scope"); addQuestion("AV-C04", "AV-M03"); }

  const collectionImpact = (beforeRecords: Array<{ id: string }>, afterRecords: Array<{ id: string }>, sections: string[], questions: string[] = []) => {
    const changed = changedRecordIds(beforeRecords, afterRecords); addChanged(changed); if (changed.size) { addSection(...sections); addQuestion(...questions); } return changed.size > 0;
  };
  const featuresChanged = collectionImpact(before.features, after.features, ["variability", "configurations", "tradeSimulation", "comparison"], ["AV-J01", "AV-J03", "AV-J04", "AV-J05", "AV-J06", "AV-J07", "AV-S01", "AV-S03", "AV-M05", "AV-M06"]);
  const featureGroupsChanged = collectionImpact(before.featureGroups, after.featureGroups, ["variability", "configurations", "tradeSimulation", "comparison"], ["AV-J03", "AV-S01", "AV-S03", "AV-M05", "AV-M06"]);
  const featureConstraintsChanged = collectionImpact(before.featureConstraints, after.featureConstraints, ["variability", "configurations", "tradeSimulation", "comparison"], ["AV-J05", "AV-S01", "AV-S03", "AV-M05", "AV-M06"]);
  const variabilityAxesChanged = collectionImpact(before.variabilityAxes, after.variabilityAxes, ["variability", "configurations", "tradeSimulation", "comparison"], ["AV-J03", "AV-S01", "AV-S03", "AV-M05", "AV-M06"]);
  const featureChanged = featuresChanged || featureGroupsChanged || featureConstraintsChanged || variabilityAxesChanged;
  const variationChanged = collectionImpact(before.variationPoints, after.variationPoints, ["variability", "configurations", "tradeSimulation", "comparison"], ["AV-J06", "AV-J07", "AV-J08", "AV-S01", "AV-S03", "AV-M05", "AV-M06"]);
  const configurationChanged = collectionImpact(before.configurations, after.configurations, ["configurations", "tradeSimulation", "comparison"], ["AV-K01", "AV-K04", "AV-K05", "AV-S01", "AV-S03", "AV-M05", "AV-M06"]);
  const architectureChanged = collectionImpact(before.architectures, after.architectures, ["configurations", "tradeSimulation", "comparison"], ["AV-K05", "AV-S01", "AV-S03", "AV-M03", "AV-M05", "AV-M06"]);
  const kpiChanged = collectionImpact(before.kpis, after.kpis, ["evaluation", "analysisInputs", "analysis", "tradeSimulation", "comparison"], ["AV-I01", "AV-I04", "AV-I05", "AV-I06", "AV-I07", "AV-S03", "AV-M05", "AV-M06"]);
  const unitChanged = collectionImpact(before.unitDefinitions, after.unitDefinitions, ["requirements", "analysisInputs", "analysis", "tradeSimulation"], ["AV-D05", "AV-I04", "AV-S03", "AV-M04", "AV-M05"]);
  collectionImpact(before.comparisonStudies, after.comparisonStudies, ["comparison"], ["AV-L01", "AV-L02", "AV-L03", "AV-L04", "AV-L05", "AV-L06", "AV-L08", "AV-L09", "AV-L10", "AV-M06"]);
  collectionImpact(before.decisions, after.decisions, ["comparison"], ["AV-L09", "AV-L10", "AV-M06"]);
  collectionImpact(before.comparisonRisks, after.comparisonRisks, ["comparison"], ["AV-L08", "AV-L10", "AV-M06"]);

  const calculationAffectingRelationship = [...changedRelationships].some((relationshipId) => {
    const type = (after.relationships.find((relationship) => relationship.id === relationshipId) ?? before.relationships.find((relationship) => relationship.id === relationshipId))?.relationshipType;
    return type ? !["hasSOI", "hasStakeholder", "participatesInMission", "hasNeed", "hasObjective", "involvedIn", "addresses"].includes(type) : false;
  });
  const calculationAffectingElement = [...changedElements].some((elementId) => {
    const type = (after.elements.find((element) => element.id === elementId) ?? before.elements.find((element) => element.id === elementId))?.elementType;
    return Boolean(type && !["mission", "system", "externalSystem", "stakeholder", "need", "objective", "useCase"].includes(type));
  });
  if (calculationAffectingRelationship || calculationAffectingElement || changedParameters.size || changedSequences.size || featureChanged || variationChanged || configurationChanged || architectureChanged || kpiChanged || unitChanged) {
    addSection("analysis", "tradeSimulation", "comparison");
    addQuestion("AV-I11", "AV-I12", "AV-S01", "AV-S03", "AV-S04", "AV-L01", "AV-L06", "AV-L08", "AV-M05", "AV-M06");
  }
  return impact;
}

function markAffectedArchitectAnswers(before: Project, after: Project): Project {
  if (!after.architectSession) return after;
  const impact = architectReviewImpact(before, after);
  const recapQuestionIds = new Set([...impact.sections].flatMap((sectionId) => reviewRecapBySection[sectionId] ?? []));
  const generatedIdKeys = ["generatedElementIds", "generatedRelationshipIds", "generatedParameterIds", "generatedFeatureIds", "generatedVariationPointIds", "generatedConfigurationIds", "generatedStudyIds", "generatedDecisionIds"] as const;
  const now = after.updatedAt;
  let reviewNeeded = false;
  const answers = Object.fromEntries(Object.entries(after.architectSession.answers).map(([key, answer]) => {
    if (answer.status !== "answered") return [key, answer];
    const instanceIds = impact.questionInstances.get(answer.questionId);
    const instanceAffected = Boolean(answer.instanceKey && instanceIds && [...instanceIds].some((id) => answer.instanceKey === id || answer.instanceKey?.split("|").includes(id)));
    const generatedAffected = generatedIdKeys.some((generatedKey) => (answer[generatedKey] ?? []).some((id) => impact.changedIds.has(id)));
    const affected = impact.questionIds.has(answer.questionId) || recapQuestionIds.has(answer.questionId) || instanceAffected || generatedAffected || valueReferences(answer.value, impact.changedIds);
    if (!affected) return [key, answer];
    reviewNeeded = true;
    return [key, { ...answer, status: "needsReview" as const, updatedAt: now }];
  }));
  if (!reviewNeeded) return after;
  return {
    ...after,
    architectSession: {
      ...after.architectSession,
      answers,
      reviewedSectionIds: after.architectSession.reviewedSectionIds.filter((sectionId) => !impact.sections.has(sectionId)),
      status: "outOfDate",
      updatedAt: now
    }
  };
}

export const useAppStore = create<AppStore>((set, get) => {
  const storeActiveWithoutRevision = (next: Project) => {
    next = synchronizeGeneratedArchitectures(withObjectiveProjection(next));
    next.validationResults = validateWithPersistentFindings(next);
    set({ projects: get().projects.map((project) => project.id === next.id ? next : project) });
    scheduleSave(get, set);
  };
  const updateActive = (updater: (project: Project) => Project, source: "modeler" | "architect" = "modeler") => {
    const current = active(get());
    if (!current) return;
    const domain = withObjectiveProjection(recalculateCalculatedParameters(normalizeOntology(updater(structuredClone(current)))));
    let next: Project = {
      ...domain,
      modelRevision: current.modelRevision + 1,
      updatedAt: new Date().toISOString()
    };
    if (source === "modeler" && next.architectSession) next = markAffectedArchitectAnswers(current, next);
    next = synchronizeGeneratedArchitectures(next);
    next.validationResults = validateWithPersistentFindings(next);
    set({ projects: get().projects.map((project) => project.id === next.id ? next : project) });
    scheduleSave(get, set);
  };
  const updateUi = (preferences: Partial<UiPreferences>) => {
    set({ uiPreferences: { ...get().uiPreferences, ...preferences } });
    scheduleSave(get, set);
  };
  return {
    ...initialPersisted,
    selectedElementId: null,
    selectedRelationshipId: null,
    selectedFeatureId: null,
    selectedVariationPointId: null,
    selectedConfigurationId: null,
    saveStatus: "Saved",
    corruptRaw: loaded.corruptRaw,
    recoveryError: loaded.error,
    setPerspective: (activePerspective) => updateUi({ activePerspective }),
    answerArchitectQuestion: (question, value, status = "answered") => {
      const project = active(get());
      if (!project) return;
      const evidenceNeutral = status !== "answered"
        || ["recap", "kpiReview", "simulationRecap", "simulationRun", "derivation", "configurationRecap", "comparisonRun", "comparisonRecap", "decisionDetails", "finalRecap"].includes(question.inputKind)
        || question.id.startsWith("AV-T")
        || question.id.startsWith("AV-L")
        || question.id.startsWith("AV-M");
      const next = applyArchitectAnswer(project, question, value, status).project;
      if (evidenceNeutral) storeActiveWithoutRevision(next);
      else updateActive(() => next, "architect");
    },
    setArchitectCurrentQuestion: (key) => {
      const project = active(get());
      if (!project) return;
      const now = new Date().toISOString();
      storeActiveWithoutRevision({
        ...project,
        architectSession: {
          ...(project.architectSession ?? {
            id: newId("architect-session"),
            projectId: project.id,
            status: "draft" as const,
            answers: {},
            sectionStates: {},
            reviewedSectionIds: [],
            parameterIntents: {},
            createdAt: now,
            updatedAt: now
          }),
          currentQuestionKey: key,
          updatedAt: now
        }
      });
    },
    setWorkspace: (activeWorkspace) => updateUi({ activeWorkspace }),
    setModelTab: (activeModelTab) => updateUi({ activeModelTab }),
    setModelView: (activeModelView) => updateUi({ activeModelView }),
    setElementTypeFilter: (activeElementType) => updateUi({ activeElementType, activeElementTypes: undefined }),
    setElementTypeGroup: (activeElementTypes) => updateUi({ activeElementType: undefined, activeElementTypes }),
    setTableSortMode: (type, mode) => updateUi({
      tableSortModeByType: { ...get().uiPreferences.tableSortModeByType, [type]: mode }
    }),
    setGraphLayoutMode: (tab, mode) => updateUi({
      graphLayoutModeByTab: { ...get().uiPreferences.graphLayoutModeByTab, [tab]: mode }
    }),
    setWorkflowFocus: (workflowFocus) => updateUi({ workflowFocus }),
    setDashboardContext: (dashboardFocusedStepId, dashboardScrollY = 0) => updateUi({
      dashboardFocusedStepId,
      dashboardScrollY
    }),
    setValidationFilters: (filters) => updateUi({
      validationSeverity: filters.severity ?? get().uiPreferences.validationSeverity,
      validationCategory: filters.category ?? get().uiPreferences.validationCategory,
      validationDomain: filters.domain ?? get().uiPreferences.validationDomain
    }),
    setVariationPointView: (variationPointView) => updateUi({ variationPointView }),
    setVariationGraphFilters: (variationGraphSections, variationGraphElementTypes) => updateUi({
      variationGraphSections,
      variationGraphElementTypes
    }),
    setVariabilityTab: (activeVariabilityTab) => updateUi({ activeVariabilityTab }),
    setTradeStudyTab: (activeTradeStudyTab) => updateUi({ activeTradeStudyTab }),
    setTradeStudyView: (tradeStudyView) => updateUi({ tradeStudyView }),
    selectElement: (selectedElementId) => set({ selectedElementId, selectedRelationshipId: null }),
    selectRelationship: (selectedRelationshipId) => set({ selectedRelationshipId }),
    selectFeature: (selectedFeatureId) => set({ selectedFeatureId }),
    selectVariationPoint: (selectedVariationPointId) => set({ selectedVariationPointId }),
    selectConfiguration: (selectedConfigurationId) => set({ selectedConfigurationId }),
    switchProject: (activeProjectId) => {
      if (!get().projects.some((project) => project.id === activeProjectId)) return;
      set({
        activeProjectId,
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    createProject: (name) => {
      const project = createEmptyProject(name);
      set({
        projects: [...get().projects, project],
        activeProjectId: project.id,
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    updateProject: (patch) => {
      const project = active(get());
      if (!project) return;
      const objectivesChanged = patch.objectives !== undefined
        && JSON.stringify(patch.objectives) !== JSON.stringify(project.objectives);
      if (objectivesChanged) {
        updateActive((candidate) => replaceObjectiveElements(
          { ...candidate, name: patch.name ?? candidate.name, description: patch.description ?? candidate.description },
          patch.objectives ?? [],
          new Date().toISOString()
        ));
        return;
      }
      storeActiveWithoutRevision({
        ...project,
        ...patch,
        updatedAt: new Date().toISOString()
      });
    },
    setActiveComparisonStudy: (id) => {
      const project = active(get());
      if (!project || (id && !project.comparisonStudies.some((study) => study.id === id))) return;
      storeActiveWithoutRevision({ ...project, activeComparisonStudyId: id, updatedAt: new Date().toISOString() });
    },
    duplicateProject: () => {
      const current = active(get());
      if (!current) return;
      const now = new Date().toISOString();
      const copy = structuredClone(current);
      copy.id = newId("project");
      copy.name = `${current.name} — Copy`;
      copy.createdAt = now;
      copy.updatedAt = now;
      copy.modelRevision = 1;
      copy.validationResults = validateWithPersistentFindings(copy);
      set({
        projects: [...get().projects, copy],
        activeProjectId: copy.id,
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    deleteProject: (id) => {
      let projects = get().projects.filter((project) => project.id !== id);
      if (!projects.length) projects = [createEmptyProject()];
      set({
        projects,
        activeProjectId: get().activeProjectId === id ? projects[0].id : get().activeProjectId,
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    loadExampleProject: (exampleId) => {
      const current = active(get());
      if (!current) return;
      const sample = withCanonicalArchitectAnswers(createExampleProject(exampleId, current.id));
      sample.validationResults = validateWithPersistentFindings(sample);
      set({
        projects: get().projects.map((project) => project.id === current.id ? sample : project),
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    resetActiveProject: () => get().loadExampleProject("coffee-machine"),
    resetEntireApplication: (mode = "sample") => {
      const project = mode === "empty" ? createEmptyProject() : withCanonicalArchitectAnswers(createCoffeeMachineSampleProject());
      if (mode === "sample") project.validationResults = validateWithPersistentFindings(project);
      clearTimeout(saveTimer);
      localStorage.removeItem(STORAGE_KEY);
      set({
        projects: [project],
        activeProjectId: project.id,
        snapshots: mode === "empty" ? [] : [createProjectSnapshot(
          project,
          "Stage C complete workflow baseline",
          "Named local snapshot supplied with the demonstration sample."
        )],
        uiPreferences: defaultPreferences,
        corruptRaw: undefined,
        recoveryError: undefined,
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    recoverFromCorruptStorage: () => {
      localStorage.removeItem(STORAGE_KEY);
      const sample = withCanonicalArchitectAnswers(createCoffeeMachineSampleProject());
      sample.validationResults = validateWithPersistentFindings(sample);
      set({
        projects: [sample],
        activeProjectId: sample.id,
        snapshots: [createProjectSnapshot(
          sample,
          "Stage C complete workflow baseline",
          "Named local snapshot supplied with the demonstration sample."
        )],
        uiPreferences: defaultPreferences,
        corruptRaw: undefined,
        recoveryError: undefined,
        selectedElementId: null,
        selectedRelationshipId: null,
        selectedFeatureId: null,
        selectedVariationPointId: null,
        selectedConfigurationId: null
      });
      scheduleSave(get, set);
    },
    addArchitecture: (architecture) => updateActive((project) => ({ ...project, architectures: [...project.architectures, architecture] })),
    updateArchitecture: (id, patch) => updateActive((project) => ({
      ...project,
      architectures: project.architectures.map((architecture) => architecture.id === id ? { ...architecture, ...patch, id } : architecture)
    })),
    deleteArchitecture: (id) => updateActive((project) => {
      if (project.architectures.find((architecture) => architecture.id === id)?.configurationId) return project;
      const removedElements = new Set(project.elements.filter((element) => element.architectureId === id).map((element) => element.id));
      const removedRelationships = new Set(project.relationships.filter((relationship) =>
        relationship.architectureId === id || removedElements.has(relationship.sourceId) || removedElements.has(relationship.targetId)
      ).map((relationship) => relationship.id));
      return {
        ...project,
        activeArchitectureId: project.activeArchitectureId === id ? undefined : project.activeArchitectureId,
        baselineArchitectureId: project.baselineArchitectureId === id ? undefined : project.baselineArchitectureId,
        architectures: project.architectures.filter((architecture) => architecture.id !== id),
        elements: project.elements.filter((element) => !removedElements.has(element.id)),
        relationships: project.relationships.filter((relationship) =>
          relationship.architectureId !== id && !removedElements.has(relationship.sourceId) && !removedElements.has(relationship.targetId)
        ),
        functionSequences: project.functionSequences.filter((sequence) => sequence.architectureId !== id),
        variationPoints: project.variationPoints
          .map((variationPoint) => ({
            ...variationPoint,
            constrainedElementIds: variationPoint.constrainedElementIds.filter((elementId) => !removedElements.has(elementId)),
            constrainedRelationshipIds: variationPoint.constrainedRelationshipIds.filter((relationshipId) => !removedRelationships.has(relationshipId))
          }))
          .filter((variationPoint) => variationPoint.constrainedElementIds.length || variationPoint.constrainedRelationshipIds.length)
      };
    }),
    setActiveArchitecture: (activeArchitectureId) => {
      const current = active(get());
      if (!current || (activeArchitectureId && !current.architectures.some((architecture) => architecture.id === activeArchitectureId))) return;
      set({ projects: get().projects.map((project) => project.id === current.id ? { ...project, activeArchitectureId } : project) });
      scheduleSave(get, set);
    },
    setBaselineArchitecture: (id) => updateActive((project) => ({
      ...project,
      baselineArchitectureId: id
    })),
    addElement: (element) => updateActive((project) => ({ ...project, elements: [...project.elements, element] })),
    updateElement: (id, patch) => updateActive((project) => {
      if (patch.metadata && Object.prototype.hasOwnProperty.call(patch.metadata, "parentAssemblyId")) setParentAssembly(project, id, patch.metadata.parentAssemblyId);
      const makingSystemOfInterest = patch.metadata?.isSystemOfInterest === true;
      return {
        ...project,
        elements: project.elements.map((element) => {
          if (element.id === id) {
            return {
              ...element,
              ...patch,
              id,
              metadata: { ...element.metadata, ...(patch.metadata ?? {}) },
              updatedAt: new Date().toISOString()
            };
          }
          if (makingSystemOfInterest && element.elementType === "stakeholder" && element.metadata.isSystemOfInterest) {
            return { ...element, metadata: { ...element.metadata, isSystemOfInterest: false } };
          }
          return element;
        })
      };
    }),
    duplicateElement: (id) => updateActive((project) => {
      const original = project.elements.find((element) => element.id === id);
      if (!original) return project;
      const duplicate = structuredClone(original);
      duplicate.id = newId(original.elementType);
      duplicate.name = `${original.name} — Copy`;
      duplicate.parameters = duplicate.parameters.map((parameter) => ({ ...parameter, id: newId("parameter"), ownerElementId: duplicate.id }));
      duplicate.createdAt = new Date().toISOString();
      duplicate.updatedAt = duplicate.createdAt;
      return { ...project, elements: [...project.elements, duplicate] };
    }),
    deleteElement: (id) => updateActive((project) => {
      const next = deleteElementCascade(project, id);
      return {
        ...next,
        kpis: next.kpis.map((kpi) => ({
          ...kpi,
          objectiveIds: kpi.objectiveIds.filter((objectiveId) => objectiveId !== id)
        })),
        comparisonStudies: next.comparisonStudies.map((study) => ({
          ...study,
          objectiveIds: study.objectiveIds.filter((objectiveId) => objectiveId !== id),
          mandatoryRequirementIds: study.mandatoryRequirementIds.filter((requirementId) => requirementId !== id),
          criteria: study.criteria.map((criterion) => ({
            ...criterion,
            sourceObjectiveIds: criterion.sourceObjectiveIds.filter((objectiveId) => objectiveId !== id),
            sourceRequirementIds: criterion.sourceRequirementIds.filter((requirementId) => requirementId !== id)
          }))
        })),
        selectedUseCaseIds: next.selectedUseCaseIds.filter((useCaseId) => useCaseId !== id),
        functionSequences: next.functionSequences
          .filter((sequence) => sequence.parentFunctionId !== id)
          .map((sequence) => ({
            ...sequence,
            useCaseIds: sequence.useCaseIds.filter((useCaseId) => useCaseId !== id),
            functionIds: sequence.functionIds.filter((functionId) => functionId !== id),
            relationshipIds: sequence.relationshipIds.filter((relationshipId) =>
              next.relationships.some((relationship) => relationship.id === relationshipId)
            )
          })),
        rowOrderByType: Object.fromEntries(Object.entries(next.rowOrderByType).map(([type, ids]) => [
          type,
          ids?.filter((elementId) => elementId !== id) ?? []
        ])),
        variationPoints: next.variationPoints
          .map((variationPoint) => ({
            ...variationPoint,
            constrainedElementIds: variationPoint.constrainedElementIds.filter((elementId) => elementId !== id)
          }))
          .filter((variationPoint) => variationPoint.constrainedElementIds.length || variationPoint.constrainedRelationshipIds.length)
      };
    }),
    addParameter: (elementId, parameter) => updateActive((project) => ({
      ...project, elements: project.elements.map((element) => element.id === elementId ? { ...element, parameters: [...element.parameters, parameter] } : element)
    })),
    updateParameter: (elementId, parameterId, patch) => updateActive((project) => ({
      ...project,
      variationPoints: project.variationPoints.map((point) => {
        const parameter = project.elements.find((element) => element.id === elementId)?.parameters.find((item) => item.id === parameterId);
        if (!parameter || patch.unit === undefined || patch.unit === parameter.unit || point.propertyPath !== `parameter:${parameterId}:value` || !point.constrainedElementIds.includes(elementId)) return point;
        try { return { ...point, valueRules: point.valueRules.map((rule) => ({ ...rule, value: typeof rule.value === "number" ? convertValue(rule.value, parameter.unit ?? "", patch.unit!, project.unitDefinitions) : rule.value })) }; }
        catch { return point; }
      }),
      elements: project.elements.map((element) => element.id === elementId ? {
        ...element, parameters: element.parameters.map((parameter) => parameter.id === parameterId ? (() => {
          const converted = { ...parameter, ...patch, id: parameterId, ownerElementId: elementId };
          if (patch.unit !== undefined && patch.unit !== parameter.unit && patch.value === undefined && typeof parameter.value === "number") {
            try { converted.value = convertValue(parameter.value, parameter.unit ?? "", patch.unit, project.unitDefinitions); if (parameter.minimum !== undefined && patch.minimum === undefined) converted.minimum = convertValue(parameter.minimum, parameter.unit ?? "", patch.unit, project.unitDefinitions); if (parameter.maximum !== undefined && patch.maximum === undefined) converted.maximum = convertValue(parameter.maximum, parameter.unit ?? "", patch.unit, project.unitDefinitions); }
            catch { /* Keep the entered value visible; dimensional validation reports incompatible edits. */ }
          }
          return converted;
        })() : parameter)
      } : element)
    })),
    deleteParameter: (elementId, parameterId) => updateActive((project) => ({
      ...project,
      elements: project.elements.map((element) => {
        const next = element.id === elementId
          ? { ...element, parameters: element.parameters.filter((parameter) => parameter.id !== parameterId) }
          : element;
        const requirementFormula = next.requirementFormula
          ? { ...next.requirementFormula, bindings: next.requirementFormula.bindings.filter((binding) => binding.targetId !== parameterId) }
          : undefined;
        return {
          ...next,
          requirementFormula,
          parameters: next.parameters.map((parameter) => parameter.calculation
            ? { ...parameter, calculation: { ...parameter.calculation, bindings: parameter.calculation.bindings.filter((binding) => binding.targetId !== parameterId) } }
            : parameter)
        };
      })
    })),
    bindRequirementParameter: (requirementId, parameterId) => {
      const project = active(get());
      if (!project) return "No active project.";
      const requirement = project.elements.find((element) => element.id === requirementId);
      const owner = project.elements.find((element) => element.parameters.some((parameter) => parameter.id === parameterId));
      const parameter = owner?.parameters.find((item) => item.id === parameterId);
      if (!requirement || requirement.elementType !== "systemRequirement") return "A system requirement must be selected.";
      if (!owner || !parameter || !["productFunction", "productComponent", "processFunction", "industrialSystemComponent"].includes(owner.elementType)) {
        return "The selected parameter must belong to a function or component.";
      }
      const existingFormula = requirement.requirementFormula ?? { expression: "", bindings: [] };
      if (existingFormula.bindings.some((binding) => binding.kind === "parameter" && binding.targetId === parameterId)) {
        return "This parameter is already bound to the requirement formula.";
      }
      const baseSymbol = parameter.semanticKey || parameter.name.toLowerCase().replace(/\W+/g, "_") || "parameter";
      let symbol = baseSymbol;
      let suffix = 2;
      while (existingFormula.bindings.some((binding) => binding.symbol === symbol)) symbol = `${baseSymbol}_${suffix++}`;
      const relationshipExists = project.relationships.some((relationship) =>
        relationship.sourceId === requirement.id
        && relationship.targetId === owner.id
        && relationship.relationshipType === "satisfiedBy"
      );
      const architectureId = requirement.architectureScope === "specific"
        ? requirement.architectureId
        : owner.architectureScope === "specific"
          ? owner.architectureId
          : undefined;
      const now = new Date().toISOString();
      const relationship: Relationship = {
        id: newId("relationship"),
        sourceId: requirement.id,
        targetId: owner.id,
        relationshipType: "satisfiedBy",
        architectureId,
        createdAt: now,
        updatedAt: now
      };
      if (!relationshipExists) {
        const error = validateRelationship(relationship, project.elements, project.relationships);
        if (error) return error;
      }
      updateActive((candidate) => ({
        ...candidate,
        elements: candidate.elements.map((element) => element.id === requirement.id
          ? {
              ...element,
              requirementFormula: {
                ...existingFormula,
                bindings: [...existingFormula.bindings, {
                  id: newId("binding"),
                  symbol,
                  kind: "parameter" as const,
                  targetId: parameterId
                }]
              }
            }
          : element),
        relationships: relationshipExists ? candidate.relationships : [...candidate.relationships, relationship]
      }));
      return null;
    },
    setSelectedUseCases: (selectedUseCaseIds) => updateActive((project) => {
      const eligibleIds = new Set(calculateSemanticScope(project, []).eligibleUseCases.map((element) => element.id));
      return {
        ...project,
        selectedUseCaseIds: [...new Set(selectedUseCaseIds)].filter((id) => eligibleIds.has(id))
      };
    }),
    moveElement: (type, elementId, beforeId) => updateActive((project) => {
      const existing = project.rowOrderByType[type] ?? project.elements.filter((element) => element.elementType === type).map((element) => element.id);
      const order = existing.filter((id) => id !== elementId && project.elements.some((element) => element.id === id && element.elementType === type));
      const index = beforeId ? order.indexOf(beforeId) : -1;
      if (index >= 0) order.splice(index, 0, elementId);
      else order.push(elementId);
      return { ...project, rowOrderByType: { ...project.rowOrderByType, [type]: order } };
    }),
    addFunctionSequence: (sequence) => updateActive((project) => ({ ...project, functionSequences: [...project.functionSequences, sequence] })),
    updateFunctionSequence: (id, patch) => updateActive((project) => {
      const current = project.functionSequences.find((sequence) => sequence.id === id);
      if (!current) return project;
      const functionsWerePatched = Object.prototype.hasOwnProperty.call(patch, "functionIds");
      const requestedFunctionIds = functionsWerePatched ? patch.functionIds ?? [] : current.functionIds;
      const nextFunctionIds = [...new Set(requestedFunctionIds)].filter((functionId) =>
        project.elements.some((element) =>
          element.id === functionId
          && element.elementType === (current.domain === "product" ? "productFunction" : "processFunction")
        )
      );
      const relationships = functionsWerePatched
        ? project.relationships.filter((relationship) =>
          relationship.sequenceId !== id
          || (nextFunctionIds.includes(relationship.sourceId) && nextFunctionIds.includes(relationship.targetId))
        )
        : project.relationships;
      const retainedRelationshipIds = new Set(relationships
        .filter((relationship) => relationship.sequenceId === id && relationship.relationshipType === "precedes")
        .map((relationship) => relationship.id));
      return {
        ...project,
        relationships,
        functionSequences: project.functionSequences.map((sequence) => sequence.id === id
          ? {
              ...sequence,
              ...patch,
              parentFunctionId: undefined,
              functionIds: nextFunctionIds,
              relationshipIds: sequence.relationshipIds.filter((relationshipId) => retainedRelationshipIds.has(relationshipId)),
              id,
              updatedAt: new Date().toISOString()
            }
          : sequence)
      };
    }),
    deleteFunctionSequence: (id) => updateActive((project) => ({
      ...project,
      functionSequences: project.functionSequences.filter((sequence) => sequence.id !== id),
      relationships: project.relationships.filter((relationship) => relationship.sequenceId !== id)
    })),
    addUnitDefinition: (definition) => updateActive((project) => ({ ...project, unitDefinitions: [...project.unitDefinitions, definition] })),
    updateUnitDefinition: (id, patch) => updateActive((project) => ({
      ...project,
      unitDefinitions: project.unitDefinitions.map((definition) => definition.id === id ? { ...definition, ...patch, id } : definition)
    })),
    deleteUnitDefinition: (id) => updateActive((project) => ({ ...project, unitDefinitions: project.unitDefinitions.filter((definition) => definition.id !== id) })),
    addCustomAttributeDefinition: (definition) => updateActive((project) => ({
      ...project,
      customAttributeDefinitions: [...project.customAttributeDefinitions, definition],
      elements: project.elements.map((element) => element.elementType === definition.elementType
        ? {
            ...element,
            customAttributeValues: {
              ...element.customAttributeValues,
              [definition.id]: definition.defaultValue
            }
          }
        : element)
    })),
    updateCustomAttributeDefinition: (id, patch) => updateActive((project) => ({
      ...project,
      customAttributeDefinitions: project.customAttributeDefinitions.map((definition) =>
        definition.id === id ? { ...definition, ...patch, id } : definition
      )
    })),
    deleteCustomAttributeDefinition: (id) => updateActive((project) => ({
      ...project,
      customAttributeDefinitions: project.customAttributeDefinitions.filter((definition) => definition.id !== id),
      elements: project.elements.map((element) => {
        const customAttributeValues = { ...element.customAttributeValues };
        delete customAttributeValues[id];
        return { ...element, customAttributeValues };
      })
    })),
    addRelationship: (relationship) => {
      const project = active(get());
      if (!project) return "No active project.";
      const error = validateRelationship(relationship, project.elements, project.relationships);
      if (error) return error;
      const candidate = {
        ...project,
        relationships: [...project.relationships, relationship],
        functionSequences: relationship.sequenceId
          ? project.functionSequences.map((sequence) => sequence.id === relationship.sequenceId
            ? {
                ...sequence,
                functionIds: [...new Set([...sequence.functionIds, relationship.sourceId, relationship.targetId])],
                relationshipIds: [...new Set([...sequence.relationshipIds, relationship.id])]
              }
            : sequence)
          : project.functionSequences
      };
      if (findProcessCycle(candidate)) return "This dependency would create a process cycle.";
      if (sequenceWouldCycle(project, relationship)) return "This precedence relationship would create a sequence cycle.";
      if (relationship.sequenceId) {
        const sequence = candidate.functionSequences.find((item) => item.id === relationship.sequenceId);
        const hierarchyError = sequence && analyzeSequence(candidate, sequence).errors.find((message) =>
          message.includes("refinement level") || message.includes("directly refine")
        );
        if (hierarchyError) return hierarchyError;
      }
      updateActive(() => candidate);
      return null;
    },
    updateRelationship: (id, patch) => {
      const project = active(get());
      if (!project) return "No active project.";
      const current = project.relationships.find((relationship) => relationship.id === id);
      if (!current) return "Relationship not found.";
      const candidateRelationship = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
      const error = validateRelationship(candidateRelationship, project.elements, project.relationships);
      if (error) return error;
      const candidate = { ...project, relationships: project.relationships.map((relationship) => relationship.id === id ? candidateRelationship : relationship) };
      if (findProcessCycle(candidate)) return "This dependency would create a process cycle.";
      if (sequenceWouldCycle(project, candidateRelationship)) return "This precedence relationship would create a sequence cycle.";
      if (candidateRelationship.sequenceId) {
        const sequence = candidate.functionSequences.find((item) => item.id === candidateRelationship.sequenceId);
        const hierarchyError = sequence && analyzeSequence(candidate, sequence).errors.find((message) =>
          message.includes("refinement level") || message.includes("directly refine")
        );
        if (hierarchyError) return hierarchyError;
      }
      updateActive(() => candidate);
      return null;
    },
    deleteRelationship: (id) => updateActive((project) => ({
      ...project,
      relationships: project.relationships.filter((relationship) => relationship.id !== id),
      functionSequences: project.functionSequences.map((sequence) => ({
        ...sequence,
        relationshipIds: sequence.relationshipIds.filter((relationshipId) => relationshipId !== id)
      })),
      variationPoints: project.variationPoints
        .map((variationPoint) => ({
          ...variationPoint,
          constrainedRelationshipIds: variationPoint.constrainedRelationshipIds.filter((relationshipId) => relationshipId !== id)
        }))
        .filter((variationPoint) => variationPoint.constrainedElementIds.length || variationPoint.constrainedRelationshipIds.length)
    })),
    addFeature: (feature) => updateActive((project) => ({ ...project, features: [...project.features, feature] })),
    updateFeature: (id, patch) => updateActive((project) => ({
      ...project,
      features: project.features.map((feature) => feature.id === id ? { ...feature, ...patch, id } : feature),
      configurations: project.configurations.map((configuration) =>
        applySelectionToConfiguration(configuration, project.features.map((feature) => feature.id === id ? { ...feature, ...patch, id } : feature), project.featureConstraints)
      )
    })),
    duplicateFeature: (id) => updateActive((project) => {
      const source = project.features.find((feature) => feature.id === id);
      if (!source || source.featureType === "root") return project;
      const duplicate: Feature = {
        ...source,
        id: newId("feature"),
        name: `${source.name} — Copy`,
        sortOrder: Math.max(source.sortOrder + 1, ...project.features.filter((feature) => feature.parentId === source.parentId).map((feature) => feature.sortOrder + 1))
      };
      return { ...project, features: [...project.features, duplicate] };
    }),
    addFeatureGroup: (group) => updateActive((project) => ({
      ...project,
      featureGroups: [...project.featureGroups, group]
    })),
    updateFeatureGroup: (id, patch) => updateActive((project) => {
      const now = new Date().toISOString();
      const axis = project.variabilityAxes.find((candidate) => candidate.featureGroupId === id);
      const root = project.features.find((feature) => feature.featureType === "root");
      const synchronizedPatch = axis ? { ...patch, parentFeatureId: root?.id, parentGroupId: undefined } : patch;
      return {
        ...project,
        featureGroups: project.featureGroups.map((group) => group.id === id ? { ...group, ...synchronizedPatch, id } : group),
        variabilityAxes: project.variabilityAxes.map((candidate) => candidate.featureGroupId === id
          ? { ...candidate, name: patch.name ?? candidate.name, description: patch.description ?? candidate.description, updatedAt: now }
          : candidate),
        comparisonStudies: axis ? project.comparisonStudies.map((study) => study.selectedVariabilityAxisIds?.includes(axis.id)
          ? { ...study, settingsUpdatedAt: now, updatedAt: now }
          : study) : project.comparisonStudies
      };
    }),
    deleteFeatureGroup: (id) => updateActive((project) => {
      if (project.variabilityAxes.some((axis) => axis.featureGroupId === id)) return project;
      const removed = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        project.featureGroups.forEach((group) => {
          if (group.parentGroupId && removed.has(group.parentGroupId) && !removed.has(group.id)) {
            removed.add(group.id);
            changed = true;
          }
        });
      }
      return {
        ...project,
        featureGroups: project.featureGroups.filter((group) => !removed.has(group.id)),
        features: project.features.map((feature) => feature.parentGroupId && removed.has(feature.parentGroupId)
          ? { ...feature, parentGroupId: undefined }
          : feature)
      };
    }),
    createVariabilityAxis: (name, description = "", existingFeatureGroupId) => {
      const project = active(get());
      const cleanName = name.trim();
      if (!project || !cleanName) return null;
      const roots = project.features.filter((feature) => feature.featureType === "root");
      if (roots.length !== 1) return null;
      const now = new Date().toISOString();
      const existingGroup = existingFeatureGroupId
        ? project.featureGroups.find((group) => group.id === existingFeatureGroupId)
        : undefined;
      if (existingFeatureGroupId && !existingGroup) return null;
      if (existingGroup && project.variabilityAxes.some((axis) => axis.featureGroupId === existingGroup.id)) return null;
      const featureGroup: FeatureGroup = existingGroup ?? {
        id: newId("feature-group"),
        name: cleanName,
        description,
        parentFeatureId: roots[0].id,
        sortOrder: project.featureGroups.length
      };
      const axis: VariabilityAxis = {
        id: newId("variability-axis"),
        name: cleanName,
        description,
        featureGroupId: featureGroup.id,
        createdAt: now,
        updatedAt: now
      };
      storeActiveWithoutRevision({
        ...project,
        featureGroups: existingGroup
          ? project.featureGroups.map((group) => group.id === existingGroup.id
              ? { ...group, parentFeatureId: roots[0].id, parentGroupId: undefined }
              : group)
          : [...project.featureGroups, featureGroup],
        variabilityAxes: [...project.variabilityAxes, axis],
        updatedAt: now
      });
      return axis.id;
    },
    updateVariabilityAxis: (id, patch) => {
      const project = active(get());
      const axis = project?.variabilityAxes.find((candidate) => candidate.id === id);
      if (!project || !axis) return "Variability axis not found.";
      const name = patch.name?.trim() ?? axis.name;
      if (!name) return "Axis name is required.";
      const now = new Date().toISOString();
      storeActiveWithoutRevision({
        ...project,
        variabilityAxes: project.variabilityAxes.map((candidate) => candidate.id === id
          ? { ...candidate, ...patch, name, id, updatedAt: now }
          : candidate),
        featureGroups: project.featureGroups.map((group) => group.id === axis.featureGroupId
          ? { ...group, name, description: patch.description ?? group.description }
          : group),
        comparisonStudies: project.comparisonStudies.map((study) => study.selectedVariabilityAxisIds?.includes(id)
          ? { ...study, settingsUpdatedAt: now, updatedAt: now }
          : study),
        updatedAt: now
      });
      return null;
    },
    deleteVariabilityAxis: (id) => {
      const project = active(get());
      const axis = project?.variabilityAxes.find((candidate) => candidate.id === id);
      if (!project || !axis) return "Variability axis not found.";
      const populated = project.features.some((feature) => feature.parentGroupId === axis.featureGroupId)
        || project.featureGroups.some((group) => group.parentGroupId === axis.featureGroupId);
      if (populated) return "Remove the features and nested groups before deleting this variability axis.";
      const now = new Date().toISOString();
      storeActiveWithoutRevision({
        ...project,
        variabilityAxes: project.variabilityAxes.filter((candidate) => candidate.id !== id),
        featureGroups: project.featureGroups.filter((group) => group.id !== axis.featureGroupId),
        comparisonStudies: project.comparisonStudies.map((study) => study.selectedVariabilityAxisIds?.includes(id)
          ? {
              ...study,
              selectedVariabilityAxisIds: study.selectedVariabilityAxisIds.filter((axisId) => axisId !== id),
              settingsUpdatedAt: now,
              updatedAt: now
            }
          : study),
        updatedAt: now
      });
      return null;
    },
    deleteFeatureReferences: (id) => updateActive((project) => {
      const removedIds = new Set([id, ...descendantsOf(project.features, id)]);
      const affectedElementIds: string[] = [];
      const elements = project.elements.map((element) => {
        if (!element.featureExpression?.trim()) return element;
        try {
          const parsed = parseFeatureExpression(element.featureExpression, project.features);
          if (!parsed.featureIds.some((featureId) => removedIds.has(featureId))) return element;
          affectedElementIds.push(element.id);
          return { ...element, featureExpression: "" };
        } catch {
          return element;
        }
      });
      const features = project.features.filter((feature) => !removedIds.has(feature.id));
      const featureConstraints = project.featureConstraints.filter((constraint) =>
        !removedIds.has(constraint.sourceFeatureId) && !removedIds.has(constraint.targetFeatureId)
      );
      const removedVariationPoints = project.variationPoints.filter((variationPoint) =>
        referencedFeatureIds(variationPoint, project.features).some((featureId) => removedIds.has(featureId))
      );
      const variationPoints = project.variationPoints.filter((variationPoint) =>
        !removedVariationPoints.some((removed) => removed.id === variationPoint.id)
      );
      const configurations = project.configurations.map((configuration) =>
        applySelectionToConfiguration({
          ...configuration,
          manuallySelectedFeatureIds: configuration.manuallySelectedFeatureIds.filter((featureId) => !removedIds.has(featureId)),
          automaticConstraintFeatureIds: configuration.automaticConstraintFeatureIds.filter((featureId) => !removedIds.has(featureId))
        }, features, featureConstraints)
      );
      return {
        ...project,
        elements,
        features,
        featureConstraints,
        variationPoints,
        configurations,
        comparisonStudies: project.comparisonStudies.map((study) => ({
          ...study,
          exploredFeatureIds: study.exploredFeatureIds.filter((featureId) => !removedIds.has(featureId)),
          criteria: study.criteria.map((criterion) => criterion.requiredFeatureId && removedIds.has(criterion.requiredFeatureId)
            ? { ...criterion, requiredFeatureId: undefined }
            : criterion)
        })),
        validationResults: [
          ...project.validationResults,
          ...affectedElementIds.map((elementId) => ({
            id: `PMB-115-${elementId}-${Date.now()}`,
            ruleId: "PMB-115",
            severity: "warning" as const,
            title: "Feature applicability cleared",
            message: "Feature deletion cleared this element's complete applicability expression.",
            affectedElementIds: [elementId],
            affectedRelationshipIds: [],
            category: "feature" as const,
            resolved: false
          })),
          ...removedVariationPoints.map((variationPoint) => ({
            id: `PMB-115-${variationPoint.id}-${Date.now()}`,
            ruleId: "PMB-115",
            severity: "warning" as const,
            title: "Variation point removed",
            message: `Feature deletion removed variation point “${variationPoint.name}” because its condition referenced the deleted feature.`,
            affectedElementIds: variationPoint.constrainedElementIds,
            affectedRelationshipIds: variationPoint.constrainedRelationshipIds,
            category: "feature" as const,
            resolved: false
          }))
        ]
      };
    }),
    addFeatureConstraint: (constraint) => {
      const project = active(get());
      if (!project) return "No active project.";
      if (constraint.sourceFeatureId === constraint.targetFeatureId) return "A feature cannot constrain itself.";
      if (!project.features.some((feature) => feature.id === constraint.sourceFeatureId)
        || !project.features.some((feature) => feature.id === constraint.targetFeatureId)) return "Both constraint features must exist.";
      if (project.featureConstraints.some((candidate) =>
        candidate.type === constraint.type
        && candidate.sourceFeatureId === constraint.sourceFeatureId
        && candidate.targetFeatureId === constraint.targetFeatureId
      )) return "That exact constraint already exists.";
      updateActive((candidate) => ({ ...candidate, featureConstraints: [...candidate.featureConstraints, constraint] }));
      return null;
    },
    updateFeatureConstraint: (id, constraint) => {
      const project = active(get());
      if (!project) return "No active project.";
      if (constraint.sourceFeatureId === constraint.targetFeatureId) return "A feature cannot constrain itself.";
      if (!project.features.some((feature) => feature.id === constraint.sourceFeatureId)
        || !project.features.some((feature) => feature.id === constraint.targetFeatureId)) return "Both constraint features must exist.";
      if (project.featureConstraints.some((candidate) =>
        candidate.id !== id
        && candidate.type === constraint.type
        && candidate.sourceFeatureId === constraint.sourceFeatureId
        && candidate.targetFeatureId === constraint.targetFeatureId
      )) return "That exact constraint already exists.";
      updateActive((candidate) => ({
        ...candidate,
        featureConstraints: candidate.featureConstraints.map((item) => item.id === id ? { ...constraint, id } : item)
      }));
      return null;
    },
    deleteFeatureConstraint: (id) => updateActive((project) => ({
      ...project,
      featureConstraints: project.featureConstraints.filter((constraint) => constraint.id !== id)
    })),
    addVariationPoint: (variationPoint) => updateActive((project) => ({
      ...project,
      variationPoints: [...project.variationPoints, variationPoint]
    })),
    updateVariationPoint: (id, patch) => updateActive((project) => ({
      ...project,
      variationPoints: project.variationPoints.map((variationPoint) =>
        variationPoint.id === id
          ? { ...variationPoint, ...patch, id, updatedAt: new Date().toISOString() }
          : variationPoint
      )
    })),
    deleteVariationPoint: (id) => updateActive((project) => ({
      ...project,
      variationPoints: project.variationPoints.filter((variationPoint) => variationPoint.id !== id)
    })),
    addConfiguration: (configuration) => updateActive((project) => {
      const now = new Date().toISOString();
      const architectureId = configuration.architectureId
        && !project.architectures.some((architecture) => architecture.id === configuration.architectureId)
        ? configuration.architectureId
        : newId("architecture");
      const normalized = applySelectionToConfiguration(
        { ...configuration, architectureId },
        project.features,
        project.featureConstraints
      );
      return {
        ...project,
        configurations: [...project.configurations, normalized],
        architectures: [...project.architectures, {
          id: architectureId,
          name: normalized.name,
          description: "Generated and owned by its configuration.",
          status: configurationArchitectureStatus(project, normalized),
          configurationId: normalized.id,
          createdAt: normalized.createdAt || now,
          updatedAt: normalized.updatedAt || now
        }]
      };
    }),
    updateConfiguration: (id, patch) => updateActive((project) => ({
      ...project,
      configurations: project.configurations.map((configuration) => configuration.id === id
        ? applySelectionToConfiguration(
            { ...configuration, ...patch, id, architectureId: configuration.architectureId },
            project.features,
            project.featureConstraints
          )
        : configuration)
    })),
    deleteConfiguration: (id) => updateActive((project) => {
      const configuration = project.configurations.find((candidate) => candidate.id === id);
      if (!configuration) return project;
      const hasHistory = project.simulationRuns.some((run) => run.configurationId === id)
        || project.comparisonStudies.some((study) =>
          study.alternativeRefs.some((alternative) => alternative.configurationId === id)
          || study.candidateRefs.some((candidate) => candidate.configurationId === id)
        );
      if (hasHistory) {
        const archivedAt = new Date().toISOString();
        return {
          ...project,
          activeArchitectureId: project.activeArchitectureId === configuration.architectureId ? undefined : project.activeArchitectureId,
          baselineArchitectureId: project.baselineArchitectureId === configuration.architectureId ? undefined : project.baselineArchitectureId,
          configurations: project.configurations.map((candidate) => candidate.id === id ? { ...candidate, archivedAt, updatedAt: archivedAt } : candidate),
          architectures: project.architectures.map((architecture) => architecture.id === configuration.architectureId
            ? { ...architecture, status: "archived", archivedAt, updatedAt: archivedAt }
            : architecture)
        };
      }
      return {
        ...project,
        configurations: project.configurations.filter((candidate) => candidate.id !== id),
        architectures: project.architectures.filter((architecture) => architecture.id !== configuration.architectureId),
        activeArchitectureId: project.activeArchitectureId === configuration.architectureId ? undefined : project.activeArchitectureId,
        baselineArchitectureId: project.baselineArchitectureId === configuration.architectureId ? undefined : project.baselineArchitectureId,
        elements: project.elements.map((element) => ({
          ...element,
          parameters: element.parameters.map((parameter) => ({
            ...parameter,
            applicableConfigurationIds: parameter.applicableConfigurationIds.filter((configurationId) => configurationId !== id)
          }))
        }))
      };
    }),
    validateConfigurationById: (id) => updateActive((project) => ({
      ...project,
      configurations: project.configurations.map((configuration) =>
        configuration.id === id ? configurationWithValidation(project, configuration) : configuration
      )
    })),
    deriveConfigurationById: (id) => {
      const project = active(get());
      const configuration = project?.configurations.find((item) => item.id === id);
      if (!project || !configuration) return ["Configuration not found."];
      const attempt = deriveConfiguration(project, configuration);
      if (!attempt.result) return attempt.errors;
      const next = {
        ...project,
        configurations: project.configurations.map((item) => item.id === id ? attempt.configuration : item)
      };
      storeActiveWithoutRevision(next);
      return [];
    },
    addKpi: (kpi) => updateActive((project) => ({ ...project, kpis: [...project.kpis, kpi] })),
    updateKpi: (id, patch) => updateActive((project) => {
      const now = new Date().toISOString();
      const kpis = project.kpis.map((kpi) => kpi.id === id ? { ...kpi, ...patch, id, updatedAt: now } : kpi);
      const changed = kpis.find((kpi) => kpi.id === id);
      return {
        ...project,
        kpis,
        comparisonStudies: project.comparisonStudies.map((study) => study.selectedKpiIds.includes(id) && changed
          ? {
              ...study,
              kpiSettings: {
                ...study.kpiSettings,
                [id]: { weight: changed.weight, optimizationDirection: changed.optimizationDirection }
              },
              criteria: study.criteria.map((criterion) => criterion.kpiId === id
                ? { ...criterion, name: changed.name, sourceObjectiveIds: changed.objectiveIds, weight: changed.weight, valueFunction: changed.optimizationDirection }
                : criterion),
              settingsUpdatedAt: now,
              updatedAt: now
            }
          : study)
      };
    }),
    deleteKpi: (id) => {
      const project = active(get());
      if (!project) return "No active project.";
      if (project.comparisonStudies.some((study) => study.selectedKpiIds.includes(id))
        || project.comparisonStudies.some((study) => study.criteria.some((criterion) => criterion.kpiId === id))
        || project.simulationRuns.some((run) => run.results.some((result) => result.kpiId === id))) {
        return "This KPI is retained because historical simulation or comparison evidence references it.";
      }
      updateActive((candidate) => ({ ...candidate, kpis: candidate.kpis.filter((kpi) => kpi.id !== id) }));
      return null;
    },
    executeSimulation: (request, warningsAcknowledged = false) => {
      const project = active(get());
      if (!project) return { errors: ["No active project."], warnings: [], needsRederivation: false };
      const attempt = runSimulation(project, request);
      if (attempt.run && (!attempt.warnings.length || warningsAcknowledged)) {
        storeActiveWithoutRevision({ ...project, simulationRuns: [...project.simulationRuns, attempt.run] });
      }
      return attempt;
    },
    addComparisonStudy: (study) => storeActiveWithoutRevision({
      ...active(get())!,
      activeComparisonStudyId: study.id,
      comparisonStudies: [...active(get())!.comparisonStudies, structuredClone(study)]
    }),
    updateComparisonStudy: (id, patch, calculationAffecting = true) => {
      const project = active(get());
      if (!project) return;
      const now = new Date().toISOString();
      storeActiveWithoutRevision({
        ...project,
        updatedAt: now,
        comparisonStudies: project.comparisonStudies.map((study) => study.id === id
          ? {
              ...study,
              ...structuredClone(patch),
              id,
              updatedAt: now,
              settingsUpdatedAt: calculationAffecting ? now : study.settingsUpdatedAt,
              results: patch.results ? structuredClone(patch.results) : study.results
            }
          : study)
      });
    },
    duplicateComparisonStudy: (id) => {
      const project = active(get());
      const source = project?.comparisonStudies.find((study) => study.id === id);
      if (!project || !source) return;
      const now = new Date().toISOString();
      const duplicate: ComparisonStudy = {
        ...structuredClone(source),
        id: newId("comparison"),
        name: `${source.name} — Copy`,
        createdAt: now,
        updatedAt: now,
        settingsUpdatedAt: now,
        results: [],
        sensitivityResult: undefined,
        robustnessResults: []
      };
      storeActiveWithoutRevision({ ...project, activeComparisonStudyId: duplicate.id, comparisonStudies: [...project.comparisonStudies, duplicate] });
    },
    deleteComparisonStudy: (id) => {
      const project = active(get());
      if (!project) return "No active project.";
      if (project.decisions.some((decision) => decision.supportingComparisonStudyIds.includes(id))) {
        return "Remove this study from supporting formal decisions before deleting it.";
      }
      storeActiveWithoutRevision({
        ...project,
        activeComparisonStudyId: project.activeComparisonStudyId === id
          ? project.comparisonStudies.find((study) => study.id !== id)?.id
          : project.activeComparisonStudyId,
        comparisonStudies: project.comparisonStudies.filter((study) => study.id !== id),
        comparisonRisks: project.comparisonRisks.filter((risk) => risk.comparisonStudyId !== id)
      });
      return null;
    },
    executeComparison: (id) => {
      const project = active(get());
      const study = project?.comparisonStudies.find((candidate) => candidate.id === id);
      if (!project || !study) return { errors: ["Trade Study not found."], warnings: [] };
      const attempt = runTraceableTradeStudy(project, study);
      if (attempt.result) {
        storeActiveWithoutRevision({
          ...project,
          comparisonStudies: project.comparisonStudies.map((candidate) => candidate.id === id
            ? { ...candidate, results: [...candidate.results, structuredClone(attempt.result!)] }
            : candidate)
        });
      }
      return { errors: attempt.errors, warnings: attempt.warnings };
    },
    executeSensitivity: (id) => {
      const project = active(get());
      const study = project?.comparisonStudies.find((candidate) => candidate.id === id);
      if (!project || !study) return ["Trade Study not found."];
      const attempt = runFixedWeightSensitivity(project, study);
      if (!attempt.result) return attempt.errors;
      storeActiveWithoutRevision({
        ...project,
        comparisonStudies: project.comparisonStudies.map((candidate) => candidate.id === id
          ? { ...candidate, sensitivityResult: structuredClone(attempt.result) }
          : candidate)
      });
      return [];
    },
    executeRobustness: (id) => {
      const project = active(get());
      const study = project?.comparisonStudies.find((candidate) => candidate.id === id);
      const baseline = study?.results.at(-1);
      if (!project || !study || !baseline) return ["Run a fixed-value Trade Study analysis first."];
      if (baseline.methodology !== "fixed-smart-mavt") {
        return ["Bounded robustness requires a fixed SMART/MAVT analysis result."];
      }
      const result = runBoundedRobustness(project, study, baseline);
      storeActiveWithoutRevision({
        ...project,
        comparisonStudies: project.comparisonStudies.map((candidate) => candidate.id === id
          ? { ...candidate, robustnessResults: [...(candidate.robustnessResults ?? []), structuredClone(result)] }
          : candidate)
      });
      return [];
    },
    createTradeStudyCandidate: (studyId, mode, sourceConfigurationId) => {
      const project = active(get());
      const study = project?.comparisonStudies.find((candidate) => candidate.id === studyId);
      if (!project || !study) return { error: "Trade Study not found." };
      if (study.candidateRefs.length >= 6) return { error: "A Trade Study supports at most six candidates." };
      const source = sourceConfigurationId
        ? project.configurations.find((configuration) => configuration.id === sourceConfigurationId && !configuration.archivedAt)
        : undefined;
      if (mode === "duplicate" && !source) return { error: "Select a candidate configuration to duplicate." };
      const now = new Date().toISOString();
      const configurationId = newId("configuration");
      const architectureId = newId("architecture");
      const sequence = study.candidateRefs.length + 1;
      const name = mode === "duplicate"
        ? `${source!.name} — Candidate ${sequence}`
        : mode === "first"
          ? "Trade Study Candidate 1"
          : `Different Candidate ${sequence}`;
      const configuration = applySelectionToConfiguration({
        id: configurationId,
        name,
        architectureId,
        manuallySelectedFeatureIds: source ? [...source.manuallySelectedFeatureIds] : [],
        automaticConstraintFeatureIds: source ? [...source.automaticConstraintFeatureIds] : [],
        effectiveSelectedFeatureIds: [],
        autoSelectedFeatureIds: [],
        featureValues: source ? structuredClone(source.featureValues ?? {}) : {},
        realizationScopes: source ? structuredClone(source.realizationScopes ?? []) : [],
        validationStatus: "notValidated",
        validationMessages: [],
        derivedElementIds: [],
        excludedElementIds: [],
        createdAt: now,
        updatedAt: now
      }, project.features, project.featureConstraints);
      const candidateId = newId("candidate");
      updateActive((candidateProject) => ({
        ...candidateProject,
        configurations: [...candidateProject.configurations, configuration],
        architectures: [...candidateProject.architectures, {
          id: architectureId,
          name,
          description: "Generated and owned by a Trade Study candidate configuration.",
          status: "candidate",
          configurationId,
          createdAt: now,
          updatedAt: now
        }],
        comparisonStudies: candidateProject.comparisonStudies.map((candidateStudy) =>
          candidateStudy.id === studyId
            ? {
                ...candidateStudy,
                status: candidateStudy.candidateRefs.length ? "collectingEvidence" : "definingCandidates",
                candidateRefs: [...candidateStudy.candidateRefs, {
                  id: candidateId,
                  label: name,
                  configurationId,
                  architectureId
                }]
              }
            : candidateStudy
        )
      }));
      return { candidateId };
    },
    addComparisonRisk: (risk) => {
      const project = active(get());
      if (!project) return;
      storeActiveWithoutRevision({ ...project, comparisonRisks: [...project.comparisonRisks, structuredClone(risk)] });
    },
    updateComparisonRisk: (id, patch) => {
      const project = active(get());
      if (!project) return;
      storeActiveWithoutRevision({
        ...project,
        comparisonRisks: project.comparisonRisks.map((risk) => risk.id === id ? { ...risk, ...structuredClone(patch), id } : risk)
      });
    },
    duplicateComparisonRisk: (id) => {
      const project = active(get());
      const source = project?.comparisonRisks.find((risk) => risk.id === id);
      if (!project || !source) return;
      storeActiveWithoutRevision({
        ...project,
        comparisonRisks: [...project.comparisonRisks, { ...structuredClone(source), id: newId("risk"), title: `${source.title} — Copy` }]
      });
    },
    deleteComparisonRisk: (id) => {
      const project = active(get());
      if (!project) return;
      storeActiveWithoutRevision({ ...project, comparisonRisks: project.comparisonRisks.filter((risk) => risk.id !== id) });
    },
    addDecision: (decision) => {
      const project = active(get());
      if (!project) return;
      storeActiveWithoutRevision({ ...project, decisions: [...project.decisions, structuredClone(decision)] });
    },
    updateDecision: (id, patch) => {
      const project = active(get());
      const decision = project?.decisions.find((candidate) => candidate.id === id);
      if (!project || !decision) return "Decision not found.";
      let next = { ...decision, ...structuredClone(patch), id, updatedAt: new Date().toISOString() };
      if (next.status === "approved" && !next.rationale?.trim()) return "PMC-015: Approved decisions require rationale.";
      const resolvedStudy = next.status === "approved"
        ? project.comparisonStudies.find((study) => next.supportingComparisonStudyIds.includes(study.id))
        : undefined;
      const selectedAlternative = resolvedStudy?.alternativeRefs.find((alternative) =>
        alternative.label === next.selectedAlternative
      );
      if (next.status === "approved" && !selectedAlternative) {
        return "Approved decisions require one documented selected alternative.";
      }
      if (next.status === "approved" && !next.baselineApprovalConfirmed) {
        return "Explicitly confirm that the approved decision may establish the architecture baseline.";
      }
      const latestResult = resolvedStudy?.results.at(-1);
      const selectedFeasibility = selectedAlternative && latestResult?.feasibility?.[selectedAlternative.id];
      if (next.status === "approved"
        && latestResult?.methodology === "traceable-feasible-weighted"
        && selectedFeasibility?.status !== "feasible") {
        return "The selected alternative must satisfy every linked requirement before approval.";
      }
      if (next.status === "approved"
        && latestResult?.methodology !== "traceable-feasible-weighted"
        && selectedFeasibility
        && !["feasible", "exceptionApproved"].includes(selectedFeasibility.status)) {
        return "The selected alternative is not feasible. Approve a documented feasibility exception before decision approval.";
      }
      const criticalCount = resolvedStudy
        ? Object.values(summarizeRisks(project, resolvedStudy))
            .reduce((sum, item) => sum + item.unresolvedHighCriticalCount, 0)
        : 0;
      if (next.status === "approved"
        && latestResult?.methodology !== "traceable-feasible-weighted"
        && criticalCount > 0
        && !next.criticalRiskJustification?.trim()) {
        return "Approval with unresolved high or critical residual risks requires an explicit justification.";
      }
      if (next.status === "approved" && resolvedStudy && latestResult) {
        next = {
          ...next,
          decisionDate: next.decisionDate ?? new Date().toISOString(),
          evidenceSnapshot: decisionEvidenceSnapshot(project, resolvedStudy, latestResult, next)
        };
      }
      const openDecisions = next.status === "approved"
        ? project.openDecisions.map((item) =>
            item.linkedFormalDecisionId === id || item.id === resolvedStudy?.originatingOpenDecisionId
              ? { ...item, linkedFormalDecisionId: id, status: "closed" as const }
              : item)
        : project.openDecisions;
      storeActiveWithoutRevision({
        ...project,
        baselineArchitectureId: selectedAlternative?.architectureId ?? project.baselineArchitectureId,
        architectures: project.architectures.map((architecture) => {
          if (architecture.id === selectedAlternative?.architectureId) {
            return { ...architecture, status: "baseline" as const, updatedAt: new Date().toISOString() };
          }
          if (resolvedStudy?.candidateRefs.some((candidate) => candidate.architectureId === architecture.id)) {
            return { ...architecture, status: "candidate" as const };
          }
          return architecture;
        }),
        openDecisions,
        decisions: project.decisions.map((candidate) => candidate.id === id ? next : candidate),
        comparisonStudies: project.comparisonStudies.map((study) =>
          study.id === resolvedStudy?.id ? { ...study, status: "decided" } : study
        )
      });
      return null;
    },
    duplicateDecision: (id) => {
      const project = active(get());
      const source = project?.decisions.find((decision) => decision.id === id);
      if (!project || !source) return;
      const now = new Date().toISOString();
      const copy: Decision = {
        ...structuredClone(source),
        id: newId("decision"),
        question: `${source.question} — Copy`,
        selectedAlternative: undefined,
        rationale: undefined,
        status: "draft",
        decisionDate: undefined,
        createdAt: now,
        updatedAt: now
      };
      storeActiveWithoutRevision({ ...project, decisions: [...project.decisions, copy] });
    },
    deleteDecision: (id) => {
      const project = active(get());
      if (!project) return;
      storeActiveWithoutRevision({
        ...project,
        decisions: project.decisions.filter((decision) => decision.id !== id),
        openDecisions: project.openDecisions.map((item) =>
          item.linkedFormalDecisionId === id ? { ...item, linkedFormalDecisionId: undefined, status: "open" as const } : item
        )
      });
    },
    createDecisionFromComparison: (studyId) => {
      const project = active(get());
      const study = project?.comparisonStudies.find((candidate) => candidate.id === studyId);
      const result = study?.results.at(-1);
      if (!project || !study || !result) return null;
      const leaders = result.methodology === "fixed-smart-mavt" || result.methodology === "traceable-feasible-weighted"
        ? result.recommendedAlternativeIds ?? []
        : leadingAlternativeIds(result.weightedScores);
      const now = new Date().toISOString();
      const leader = leaders.length === 1 ? study.alternativeRefs.find((alternative) => alternative.id === leaders[0]) : undefined;
      const decision: Decision = {
        id: newId("decision"),
        question: study.question || `Which alternative should be selected from ${study.name}?`,
        alternatives: study.alternativeRefs.map((alternative) => alternative.label),
        criteria: study.selectedKpiIds.map((kpiId) => project.kpis.find((kpi) => kpi.id === kpiId)?.name ?? kpiId),
        selectedAlternative: leader?.label,
        supportingSimulationRunIds: study.alternativeRefs.map((alternative) => alternative.simulationRunId),
        supportingComparisonStudyIds: [study.id],
        assumptions: [],
        risks: project.comparisonRisks.filter((risk) => risk.comparisonStudyId === study.id).map((risk) => risk.title),
        openActions: result.thresholdViolations.map((violation) => violation.message),
        status: "draft",
        createdAt: now,
        updatedAt: now
      };
      decision.evidenceSnapshot = decisionEvidenceSnapshot(project, study, result, decision);
      storeActiveWithoutRevision({
        ...project,
        decisions: [...project.decisions, decision],
        openDecisions: study.originatingOpenDecisionId
          ? project.openDecisions.map((openDecision) =>
              openDecision.id === study.originatingOpenDecisionId
                ? { ...openDecision, linkedFormalDecisionId: decision.id, status: "inReview" }
                : openDecision)
          : project.openDecisions
      });
      return decision.id;
    },
    confirmDecisionSelection: (decisionId, alternative) => {
      const project = active(get());
      const decision = project?.decisions.find((candidate) => candidate.id === decisionId);
      if (!project || !decision) return "Decision not found.";
      if (!decision.alternatives.includes(alternative)) return "Select one documented alternative.";
      storeActiveWithoutRevision({
        ...project,
        decisions: project.decisions.map((candidate) => candidate.id === decisionId
          ? { ...candidate, selectedAlternative: alternative, status: "proposed", updatedAt: new Date().toISOString() }
          : candidate)
      });
      return null;
    },
    promoteOpenDecision: (openDecisionId) => {
      const project = active(get());
      const planning = project?.openDecisions.find((candidate) => candidate.id === openDecisionId);
      if (!project || !planning) return null;
      if (planning.linkedFormalDecisionId) return planning.linkedFormalDecisionId;
      const now = new Date().toISOString();
      const decision: Decision = {
        id: newId("decision"),
        question: planning.question,
        alternatives: [],
        criteria: [],
        supportingSimulationRunIds: [],
        supportingComparisonStudyIds: [],
        rationale: planning.description,
        assumptions: [],
        risks: [],
        openActions: [],
        status: "draft",
        createdAt: now,
        updatedAt: now
      };
      storeActiveWithoutRevision({
        ...project,
        decisions: [...project.decisions, decision],
        openDecisions: project.openDecisions.map((candidate) => candidate.id === openDecisionId
          ? { ...candidate, linkedFormalDecisionId: decision.id, status: "inReview" }
          : candidate)
      });
      return decision.id;
    },
    createSnapshot: (name, note = "", replaceOldest = false) => {
      const project = active(get());
      if (!project) return "No active project.";
      const sourceSnapshots = sourceProjectSnapshots(get().snapshots, project.id);
      if (sourceSnapshots.length >= SNAPSHOT_LIMIT && !replaceOldest) {
        return "PMC-112: Snapshot limit reached. Confirm replacement of the oldest snapshot.";
      }
      let snapshots = get().snapshots;
      if (sourceSnapshots.length >= SNAPSHOT_LIMIT && replaceOldest) {
        const oldest = sourceSnapshots.at(-1)!;
        snapshots = snapshots.filter((snapshot) => snapshot.id !== oldest.id);
      }
      try {
        const snapshot = createProjectSnapshot(project, name, note);
        set({ snapshots: [...snapshots, snapshot] });
        scheduleSave(get, set);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Snapshot could not be created.";
      }
    },
    deleteSnapshot: (id) => {
      set({ snapshots: get().snapshots.filter((snapshot) => snapshot.id !== id) });
      scheduleSave(get, set);
    },
    restoreSnapshot: (id, replaceOldest = false) => {
      const current = active(get());
      const snapshot = get().snapshots.find((candidate) => candidate.id === id);
      if (!current || !snapshot) return "Snapshot not found.";
      let restored: Project;
      try {
        restored = parseSnapshotProject(snapshot, migrateProject);
      } catch (error) {
        return error instanceof Error ? error.message : "PMC-011: Snapshot is corrupt.";
      }
      const sourceSnapshots = sourceProjectSnapshots(get().snapshots, current.id);
      if (sourceSnapshots.length >= SNAPSHOT_LIMIT && !replaceOldest) {
        return "PMC-112: Snapshot limit reached. Confirm replacement of the oldest snapshot before creating the safety snapshot.";
      }
      const retainedSnapshots = sourceSnapshots.length >= SNAPSHOT_LIMIT
        ? get().snapshots.filter((candidate) => candidate.id !== sourceSnapshots.at(-1)!.id)
        : get().snapshots;
      const safety = createProjectSnapshot(current, `Safety snapshot before restoring ${snapshot.name}`);
      restored = { ...restored, id: current.id, updatedAt: new Date().toISOString() };
      set({
        projects: get().projects.map((project) => project.id === current.id ? restored : project),
        activeProjectId: current.id,
        snapshots: [...retainedSnapshots, safety]
      });
      scheduleSave(get, set);
      return null;
    },
    duplicateSnapshot: (id) => {
      const snapshot = get().snapshots.find((candidate) => candidate.id === id);
      if (!snapshot) return "Snapshot not found.";
      try {
        const project = duplicateSnapshotProject(snapshot, get().projects.map((item) => item.name), migrateProject);
        set({ projects: [...get().projects, project], activeProjectId: project.id });
        scheduleSave(get, set);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "Snapshot could not be duplicated.";
      }
    },
    importProjectPackage: (raw, mode, replaceOldestSnapshot = false) => {
      const parsed = parseExportPackage(raw, migrateProject);
      if (!parsed.package) return { errors: parsed.errors, warnings: [] };
      const calculated = recalculateCalculatedParameters(structuredClone(parsed.package.project));
      const incoming = { ...calculated, validationResults: validateWithPersistentFindings(calculated) };
      const warnings: string[] = [];
      if (mode === "new") {
        if (get().projects.some((project) => project.id === incoming.id)) {
          incoming.id = newId("project");
          warnings.push("PMC-111: Imported project ID was changed to avoid collision.");
        }
        set({ projects: [...get().projects, incoming], activeProjectId: incoming.id });
      } else {
        const current = active(get());
        if (!current) return { errors: ["No active project."], warnings };
        const sourceSnapshots = sourceProjectSnapshots(get().snapshots, current.id);
        if (sourceSnapshots.length >= SNAPSHOT_LIMIT && !replaceOldestSnapshot) {
          return {
            errors: ["PMC-112: Snapshot limit reached. Confirm replacement of the oldest snapshot before creating the import safety snapshot."],
            warnings
          };
        }
        const retainedSnapshots = sourceSnapshots.length >= SNAPSHOT_LIMIT
          ? get().snapshots.filter((candidate) => candidate.id !== sourceSnapshots.at(-1)!.id)
          : get().snapshots;
        const safety = createProjectSnapshot(current, `Safety snapshot before importing ${incoming.name}`);
        incoming.id = current.id;
        incoming.updatedAt = new Date().toISOString();
        set({
          projects: get().projects.map((project) => project.id === current.id ? incoming : project),
          activeProjectId: current.id,
          snapshots: [...retainedSnapshots, safety]
        });
        warnings.push("PMC-203: Safety snapshot created.");
      }
      scheduleSave(get, set);
      return { errors: [], warnings };
    },
    runValidation: () => {
      const current = active(get());
      if (!current) return;
      const validated = { ...current, validationResults: validateWithPersistentFindings(current) };
      set({ projects: get().projects.map((project) => project.id === current.id ? validated : project) });
      scheduleSave(get, set);
    }
  };
});

export const selectActiveProject = (state: AppStore) => active(state);
