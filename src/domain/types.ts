export type ArchitectureStatus =
  | "draft"
  | "invalid"
  | "configured"
  | "realized"
  | "candidate"
  | "baseline"
  | "stale"
  | "archived";
export type ElementStatus = "draft" | "reviewed" | "approved";
export type ElementType =
  | "mission"
  | "system"
  | "externalSystem"
  | "stakeholder"
  | "need"
  | "objective"
  | "useCase"
  | "systemRequirement"
  | "productFunction"
  | "productComponent"
  | "productInterface"
  | "processFunction"
  | "industrialSystemComponent"
  | "processInterface"
  | "resource"
  | "verificationMethod";
export type RelationshipType =
  | "hasSOI"
  | "hasStakeholder"
  | "participatesInMission"
  | "hasNeed"
  | "hasObjective"
  | "involvedIn"
  | "addresses"
  | "hasFunction"
  | "derives"
  | "satisfiedBy"
  | "realizedBy"
  | "refines"
  | "verifies"
  | "connects"
  | "precedes"
  | "allocatedTo"
  | "requiresResource"
  | "consumes"
  | "produces";
export type ProcessType = "engineering" | "manufacturing" | "assembly" | "integration" | "verification" | "test";
export type ResourceType = "person" | "role" | "skill" | "tool" | "machine" | "software" | "facility";
export type TimeUnit = "minute" | "hour" | "day";
export type ValueOrigin = "entered" | "assumed" | "calculated" | "simulated";
export type ContentOrigin = "architect" | "modeler" | "import" | "sample" | "migration";
export type AppPerspective = "architect" | "modeler";
export type ArchitectureScope = "common" | "specific";
export type AttributeDataType = "number" | "string" | "boolean";
export type ScalarValue = number | string | boolean | null;
export type GraphLayoutMode = "manual" | "hierarchy" | "horizontal" | "sequence";
export type FeatureValue = string | number | boolean;
export type VariationPointKind = "existence" | "primitiveProperty" | "primitiveTag" | "elementProperty";
export type VariationScope = "requirements" | "structure" | "behavior" | "process" | "resources" | "verification";

export interface Architecture {
  id: string;
  name: string;
  description: string;
  status: ArchitectureStatus;
  configurationId?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElementMetadata {
  source?: string;
  owner?: string;
  priority?: "low" | "medium" | "high" | "critical";
  lifecycleState?: string;
  verificationMethod?: string;
  notes?: string;
  resourceType?: ResourceType;
  processType?: ProcessType;
  duration?: number;
  durationUnit?: TimeUnit;
  capacity?: number;
  capacityHours?: number;
  availabilityPercent?: number;
  hourlyRate?: number;
  costUnit?: string;
  isSystemOfInterest?: boolean;
  systemBoundary?: string;
  architectureRootId?: string;
  subjectSystemId?: string;
  /** @deprecated Schema <=12 import compatibility. Live projects use Mission --hasSOI--> System. */
  missionId?: string;
  /** Physical containment, separate from functional/requirement refinement. */
  parentAssemblyId?: string;
  massAccounting?: "contributes" | "includedElsewhere" | "outsideBoundary";
  massAccountingNote?: string;
  requirementReviews?: Record<string, RequirementReview>;
  graphPosition?: { x: number; y: number };
  graphPositions?: Record<string, { x: number; y: number }>;
  creationOrigin?: ContentOrigin;
  architectAnswerKey?: string;
  requirementClass?: "mandatory" | "important" | "desirable";
  verificationCategory?: "analysis" | "inspection" | "demonstration" | "test";
  evidenceReviewStatus?: "confirmed" | "pending";
  evidenceReviewNote?: string;
}

export interface Parameter {
  id: string;
  ownerElementId: string;
  name: string;
  semanticKey: string;
  description: string;
  dataType: AttributeDataType;
  value: ScalarValue;
  unit?: string;
  source?: string;
  valueOrigin: ValueOrigin;
  minimum?: number;
  maximum?: number;
  uncertaintyPercent?: number;
  applicableConfigurationIds: string[];
  calculation?: ParameterFormula;
  calculationStatus?: "calculated" | "pending" | "error";
  calculationMessage?: string;
  inferredUnit?: string;
  creationOrigin?: ContentOrigin;
  architectAnswerKey?: string;
  contributionBasis?: "local" | "aggregate";
  quantityBasis?: string;
}

export interface RequirementReview {
  result: "met" | "notMet" | "assumed" | "notChecked";
  dependencySignature: string;
  note?: string;
}

export interface FormulaBinding {
  id: string;
  symbol: string;
  kind: "parameter" | "kpi";
  targetId: string;
}

export interface RequirementFormula {
  expression: string;
  bindings: FormulaBinding[];
  /** Unit in which numeric comparison literals were authored; never inferred again after an input-unit edit. */
  comparisonUnit?: string;
  bindingUnits?: Record<string, string>;
}

export interface ParameterFormula {
  expression: string;
  bindings: FormulaBinding[];
  requestedUnit?: string;
}

export interface UnitDefinition {
  id: string;
  symbol: string;
  name: string;
  quantityName: string;
  dimension: Record<string, number>;
  factorToSI: number;
  aliases: string[];
  isoReference?: string;
}

export interface CustomAttributeDefinition {
  id: string;
  elementType: ElementType;
  name: string;
  dataType: AttributeDataType;
  unit?: string;
  required: boolean;
  defaultValue: ScalarValue;
  description: string;
}

export interface ModelElement {
  id: string;
  elementType: ElementType;
  name: string;
  description: string;
  status: ElementStatus;
  architectureScope: ArchitectureScope;
  architectureId?: string;
  featureExpression?: string;
  parameters: Parameter[];
  requirementFormula?: RequirementFormula;
  customAttributeValues: Record<string, ScalarValue>;
  tags: string[];
  metadata: ElementMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  /** A component refines edge used explicitly as child-to-parent physical containment. */
  containment?: boolean;
  id: string;
  relationshipType: RelationshipType;
  sourceId: string;
  targetId: string;
  name?: string;
  description?: string;
  architectureId?: string;
  requiredQuantity?: number;
  quantity?: number;
  unit?: string;
  itemFlowName?: string;
  sequenceId?: string;
  creationOrigin?: ContentOrigin;
  architectAnswerKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type FunctionSequenceDomain = "product" | "process";
export interface FunctionSequence {
  id: string;
  name: string;
  description: string;
  domain: FunctionSequenceDomain;
  architectureId?: string;
  useCaseIds: string[];
  functionIds: string[];
  relationshipIds: string[];
  parentFunctionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assumption {
  /** @deprecated Schema-13 and earlier project-level compatibility record. */
  id: string;
  title: string;
  description: string;
  source?: string;
  confidence: "low" | "medium" | "high";
  status: "open" | "confirmed" | "invalidated";
  relatedElementIds: string[];
}

export interface OpenDecision {
  id: string;
  question: string;
  description?: string;
  status: "open" | "inReview" | "closed";
  relatedElementIds: string[];
  linkedFormalDecisionId?: string;
}

export interface Feature {
  id: string;
  parentId?: string;
  parentGroupId?: string;
  name: string;
  featureType: "root" | "mandatory" | "optional" | "xor" | "or";
  groupId?: string;
  sortOrder: number;
  description: string;
  valueType?: "boolean" | "enumeration";
  allowedValues?: string[];
  defaultValue?: FeatureValue;
  variabilityScope?: "external" | "internal";
  graphPosition?: { x: number; y: number };
}
export interface FeatureGroup {
  id: string;
  name: string;
  description: string;
  parentFeatureId?: string;
  parentGroupId?: string;
  sortOrder: number;
  graphPosition?: { x: number; y: number };
}
export interface VariabilityAxis {
  id: string;
  name: string;
  description: string;
  featureGroupId: string;
  createdAt: string;
  updatedAt: string;
}
export interface FeatureConstraint {
  id: string;
  type: "requires" | "excludes";
  sourceFeatureId: string;
  targetFeatureId: string;
}
export interface Configuration {
  id: string;
  name: string;
  architectureId: string;
  manuallySelectedFeatureIds: string[];
  automaticConstraintFeatureIds: string[];
  effectiveSelectedFeatureIds: string[];
  autoSelectedFeatureIds: string[];
  featureValues?: Record<string, FeatureValue>;
  realizationScopes?: VariationScope[];
  validationStatus: "notValidated" | "valid" | "invalid";
  validationMessages: string[];
  derivedElementIds: string[];
  excludedElementIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  derivation?: DerivationResult;
}
export interface FeatureValueCondition {
  featureId: string;
  operator: "equals" | "notEquals";
  value: FeatureValue;
}
export interface VariationValueRule {
  isDefault?: boolean;
  id: string;
  featureExpression: string;
  featureValueConditions: FeatureValueCondition[];
  value: ScalarValue | string[];
}
export interface VariationPoint {
  unmatchedBehavior?: "retainBase" | "error";
  id: string;
  name: string;
  description: string;
  kind: VariationPointKind;
  constrainedElementIds: string[];
  constrainedRelationshipIds: string[];
  featureExpression: string;
  featureValueConditions: FeatureValueCondition[];
  propertyPath?: string;
  valueRules: VariationValueRule[];
  scope?: VariationScope;
  realizationScopes?: VariationScope[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface AppliedVariation {
  variationPointId: string;
  targetKind: "element" | "relationship";
  targetId: string;
  effect: "removed" | "modified";
  propertyPath?: string;
  previousValue?: ScalarValue | string[];
  nextValue?: ScalarValue | string[];
}
export interface DerivationResult {
  id: string;
  configurationId: string;
  sourceProjectId: string;
  sourceArchitectureId: string;
  sourceModelRevision: number;
  timestamp: string;
  manuallySelectedFeatureIds: string[];
  effectiveSelectedFeatureIds: string[];
  autoSelectedFeatureIds: string[];
  featureValues: Record<string, FeatureValue>;
  realizationScopes: VariationScope[];
  includedElementIds: string[];
  excludedElementIds: string[];
  preservedRelationshipIds: string[];
  removedRelationshipIds: string[];
  modifiedElementIds: string[];
  modifiedRelationshipIds: string[];
  appliedVariations: AppliedVariation[];
  sourceElements: ModelElement[];
  sourceRelationships: Relationship[];
  realizedElements: ModelElement[];
  realizedRelationships: Relationship[];
  warnings: string[];
  validationSnapshot: ValidationResult[];
  calculatedKpiValues: Record<string, number | null>;
}
export type StandardAlgorithmKey =
  | "totalMass"
  | "directElementCost"
  | "processCost"
  | "estimatedTotalCost"
  | "totalPower"
  | "manufacturingLeadTime"
  | "resourceDemand"
  | "basicUtilization"
  | "throughputProxy";
export interface KPI {
  id: string;
  name: string;
  description: string;
  objectiveIds: string[];
  /** Stakeholder needs measured directly by this KPI. Older projects may omit this field. */
  needIds?: string[];
  calculationMode: "formula" | "standardAlgorithm";
  formula?: string;
  standardAlgorithmKey?: StandardAlgorithmKey;
  outputUnit: string;
  optimizationDirection: "minimize" | "maximize";
  weight: number;
  targetValue?: number;
  minimumThreshold?: number;
  maximumThreshold?: number;
  inputParameterIds: string[];
  dependsOnKpiIds: string[];
  lastCalculatedValue?: number | null;
  calculationWarnings: string[];
  createdAt: string;
  updatedAt: string;
}
export interface SimulationInputSnapshot {
  projectId: string;
  projectModelRevision: number;
  architectureId: string;
  configurationId?: string;
  derivationId?: string;
  appliedVariationPointIds?: string[];
  featureValues?: Record<string, FeatureValue>;
  realizationScopes?: VariationScope[];
  backgroundRealization: boolean;
  realizedElements: ModelElement[];
  realizedRelationships: Relationship[];
  appliedVariations: AppliedVariation[];
  activeElementIds: string[];
  activeRelationshipIds: string[];
  parameterValues: Record<string, ScalarValue>;
  kpiDefinitions: KPI[];
}
export interface SimulationResult {
  id: string;
  kpiId?: string;
  algorithmKey?: StandardAlgorithmKey;
  name: string;
  value: number | null;
  unit: string;
  sourceParameterIds: string[];
  formulaOrAlgorithm: string;
  inputSources: Array<{ id: string; name: string; value: number | null; unit?: string; source?: string; origin?: ValueOrigin }>;
  assumptions: string[];
  missingInformation: string[];
  breakdown?: Record<string, number | null>;
  criticalChainElementIds?: string[];
  warnings: string[];
}
export interface SimulationRun {
  id: string;
  name: string;
  architectureId: string;
  configurationId?: string;
  derivationId?: string;
  timestamp: string;
  projectModelRevisionAtRun: number;
  inputSnapshot: SimulationInputSnapshot;
  selectedKpiIds: string[];
  selectedAlgorithmKeys: StandardAlgorithmKey[];
  results: SimulationResult[];
  sourceParameterIds: string[];
  /** @deprecated Preserved only when loading legacy immutable run evidence. New runs omit this field. */
  assumptions?: string[];
  warnings: string[];
  validationSummary: { errors: number; warnings: number; information: number };
}
export interface Decision {
  id: string;
  question: string;
  alternatives: string[];
  criteria: string[];
  selectedAlternative?: string;
  rationale?: string;
  supportingSimulationRunIds: string[];
  supportingComparisonStudyIds: string[];
  assumptions: string[];
  risks: string[];
  openActions: string[];
  status: "draft" | "proposed" | "approved" | "revisit";
  owner?: string;
  decisionDate?: string;
  criticalRiskJustification?: string;
  baselineApprovalConfirmed?: boolean;
  evidenceSnapshot?: DecisionEvidenceSnapshot;
  createdAt: string;
  updatedAt: string;
}
export interface ComparisonThreshold {
  minimum?: number;
  maximum?: number;
  mode: "warning" | "hard";
}
export interface ComparisonKpiSetting {
  weight: number;
  optimizationDirection: "minimize" | "maximize";
  threshold?: ComparisonThreshold;
}
export interface ComparisonAlternativeRef {
  id: string;
  label: string;
  architectureId: string;
  configurationId?: string;
  simulationRunId: string;
}
export type TradeStudyStatus =
  | "framing"
  | "definingCandidates"
  | "collectingEvidence"
  | "ready"
  | "analyzed"
  | "decided";
export interface StudyCriterion {
  id: string;
  name: string;
  description: string;
  type: "mandatory" | "optimization" | "context";
  sourceObjectiveIds: string[];
  sourceRequirementIds: string[];
  kpiId?: string;
  requiredFeatureId?: string;
  weight?: number;
  stakeholderValueFunction?: StakeholderValueFunction;
  /** @deprecated Schema-6 compatibility label. New studies use stakeholderValueFunction. */
  valueFunction?: string;
}
export type StakeholderValueFunctionType =
  | "maximize"
  | "minimize"
  | "target"
  | "acceptableRange"
  | "piecewiseLinear";
export interface StakeholderValuePoint {
  input: number;
  value: number;
}
export interface StakeholderValueFunction {
  type: StakeholderValueFunctionType;
  worst?: number;
  best?: number;
  target?: number;
  acceptableMinimum?: number;
  acceptableMaximum?: number;
  points?: StakeholderValuePoint[];
}
export interface TradeStudyCandidateRef {
  id: string;
  label: string;
  configurationId: string;
  architectureId: string;
}
export interface ThresholdViolation {
  alternativeId: string;
  kpiId: string;
  value: number;
  message: string;
  severity: "warning" | "error";
}
export interface ComparisonResult {
  id: string;
  studyId: string;
  timestamp: string;
  settingsUpdatedAt: string;
  inputProjectModelRevision: number;
  rawValues: Record<string, Record<string, number | null>>;
  normalizedScores: Record<string, Record<string, number | null>>;
  weightedScores: Record<string, number | null>;
  dataCoveragePercent: Record<string, number>;
  thresholdViolations: ThresholdViolation[];
  warnings: string[];
  methodology?: "legacy-relative" | "fixed-smart-mavt" | "traceable-feasible-weighted";
  feasibility?: Record<string, AlternativeFeasibility>;
  stakeholderValues?: Record<string, Record<string, number | null>>;
  weightedContributions?: Record<string, Record<string, number | null>>;
  stakeholderValueScores?: Record<string, number | null>;
  calculationExplanations?: Record<string, Record<string, string>>;
  pareto?: Record<string, ParetoAlternativeResult>;
  recommendedAlternativeIds?: string[];
  recommendationLabel?: string;
}
export interface RequirementComplianceEvidence {
  basis?: "calculation" | "review" | "assumption" | "none";
  requirementId: string;
  requirementName: string;
  status: "satisfied" | "failed" | "missing";
  expression?: string;
  evidence: string;
  simulationRunId: string;
}
export interface AlternativeFeasibility {
  status: "feasible" | "infeasible" | "unknown" | "exceptionApproved";
  requirementEvidence: RequirementComplianceEvidence[];
  failedRequirementIds: string[];
  missingRequirementIds: string[];
  exceptionRationale?: string;
  exceptionApproved?: boolean;
}
export interface ParetoAlternativeResult {
  status: "nonDominated" | "dominated" | "unknown" | "infeasible";
  dominatedByAlternativeIds: string[];
  dominatesAlternativeIds: string[];
  explanation: string;
}
export interface WeightSensitivitySeries {
  kpiId: string;
  points: Array<{
    multiplierPercent: number;
    alternativeScores: Record<string, number | null>;
    leadingAlternativeIds: string[];
  }>;
  leaderChanged: boolean;
  warnings: string[];
}
export interface WeightSensitivityResult {
  studyId: string;
  timestamp: string;
  series: WeightSensitivitySeries[];
}
export interface ComparisonStudy {
  id: string;
  name: string;
  description: string;
  question: string;
  intendedOutcome: string;
  lifecycleScope: string;
  systemScope: string;
  status: TradeStudyStatus;
  originatingOpenDecisionId?: string;
  needIds?: string[];
  objectiveIds: string[];
  useCaseIds?: string[];
  rootFeatureId?: string;
  selectedVariabilityAxisIds?: string[];
  mandatoryRequirementIds: string[];
  baselineRequirementIds?: string[];
  referenceArchitectureId?: string;
  exploredFeatureIds: string[];
  criteria: StudyCriterion[];
  candidateRefs: TradeStudyCandidateRef[];
  alternativeRefs: ComparisonAlternativeRef[];
  selectedKpiIds: string[];
  kpiSettings: Record<string, ComparisonKpiSetting>;
  createdAt: string;
  updatedAt: string;
  settingsUpdatedAt: string;
  results: ComparisonResult[];
  sensitivityResult?: WeightSensitivityResult;
  scenarios?: ComparisonScenario[];
  robustnessResults?: BoundedRobustnessResult[];
  feasibilityExceptions?: Record<string, {
    rationale: string;
    approvalState: "requested" | "approved" | "rejected";
    approvedBy?: string;
    approvedAt?: string;
  }>;
}
export interface ComparisonRisk {
  id: string;
  comparisonStudyId: string;
  alternativeId: string;
  title: string;
  description: string;
  /** @deprecated Schema-6 compatibility field. */
  likelihood?: "low" | "medium" | "high";
  /** @deprecated Schema-6 compatibility field. */
  impact?: "low" | "medium" | "high";
  inherentLikelihood: 1 | 2 | 3 | 4 | 5;
  inherentImpact: 1 | 2 | 3 | 4 | 5;
  residualLikelihood: 1 | 2 | 3 | 4 | 5;
  residualImpact: 1 | 2 | 3 | 4 | 5;
  mitigation?: string;
  owner?: string;
  status: "open" | "mitigating" | "accepted" | "closed";
  applicableArchitectureIds: string[];
  applicableConfigurationIds: string[];
  applicableRequirementIds: string[];
  applicableParameterIds: string[];
  applicableKpiIds: string[];
  reviewRequired: boolean;
}
export type ComparisonScenarioEffect =
  | { id: string; type: "parameterPercent"; targetId: string; percent: number }
  | { id: string; type: "parameterRange"; targetId: string; minimum: number; maximum: number }
  | { id: string; type: "kpiPercent"; targetId: string; percent: number }
  | { id: string; type: "kpiAdditive"; targetId: string; amount: number };
export interface ComparisonScenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  effects: ComparisonScenarioEffect[];
}
export interface RobustnessCaseResult {
  id: string;
  name: string;
  kind: "nominal" | "oneAtATimeLower" | "oneAtATimeUpper" | "combinedPessimistic" | "combinedOptimistic" | "scenario";
  scenarioId?: string;
  changedFeasibilityAlternativeIds: string[];
  changedParetoAlternativeIds: string[];
  leadingAlternativeIds: string[];
  recommendationChanged: boolean;
  notes: string[];
}
export interface BoundedRobustnessResult {
  id: string;
  studyId: string;
  timestamp: string;
  baselineComparisonResultId: string;
  label: "Bounded robustness analysis";
  cases: RobustnessCaseResult[];
}
export interface DecisionEvidenceSnapshot {
  capturedAt: string;
  projectModelRevision: number;
  question: string;
  intendedOutcome: string;
  objectiveIds: string[];
  criteria: StudyCriterion[];
  candidateAlternatives: ComparisonAlternativeRef[];
  selectedAlternative?: string;
  rejectedAlternatives: string[];
  mandatoryCompliance: Record<string, AlternativeFeasibility>;
  valueFunctionsAndWeights: Array<{
    criterionId: string;
    kpiId?: string;
    weight: number;
    valueFunction?: StakeholderValueFunction;
  }>;
  rawEvidence: Record<string, Record<string, number | null>>;
  transformedEvidence: Record<string, Record<string, number | null>>;
  paretoResults: Record<string, ParetoAlternativeResult>;
  sensitivity?: WeightSensitivityResult;
  risks: ComparisonRisk[];
  scenarios: ComparisonScenario[];
  robustnessResults: BoundedRobustnessResult[];
  assumptions: string[];
  limitations: string[];
  derivationIds: string[];
  simulationRunIds: string[];
  rationale?: string;
  owner?: string;
  decisionDate?: string;
  openActions: string[];
}
export interface ProjectSnapshot {
  id: string;
  sourceProjectId: string;
  name: string;
  note?: string;
  projectName: string;
  createdAt: string;
  schemaVersion: number;
  projectData: string;
}
export type ValidationSeverity = "error" | "warning" | "information";
export type ValidationCategory =
  | "identity"
  | "relationship"
  | "traceability"
  | "completeness"
  | "process"
  | "parameter"
  | "feature"
  | "formula"
  | "comparison"
  | "export"
  | "persistence";
export interface ValidationResult {
  id: string;
  ruleId: string;
  severity: ValidationSeverity;
  title: string;
  message: string;
  affectedElementIds: string[];
  affectedRelationshipIds: string[];
  category: ValidationCategory;
  resolved: boolean;
}
export type OverallScope = "architectureBuilding" | "architectureAndSimulation" | "tradeStudy";
export type ArchitectStatus = "draft" | "blocked" | "ready" | "outOfDate";
export type ArchitectAnswerStatus = "answered" | "skipped" | "needsReview" | "invalid";
export type ArchitectSectionState = "notStarted" | "inProgress" | "reviewNeeded" | "complete" | "blocked";

export interface ArchitectParameterIntent {
  id: string;
  requirementId: string;
  propertyName: string;
  semanticKey: string;
  operator: "<" | "<=" | ">" | ">=" | "=" | "==" | "!=";
  target: number;
  unit: string;
  sourceKind?: "existing" | "later" | "kpi" | "verification";
  ownerElementId?: string;
  parameterId?: string;
  preliminaryValue?: number | null;
  valueOrigin?: ValueOrigin;
  source?: string;
  uncertaintyPercent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectAnswer {
  key: string;
  questionId: string;
  instanceKey?: string;
  status: ArchitectAnswerStatus;
  value: unknown;
  generatedElementIds: string[];
  generatedRelationshipIds: string[];
  generatedParameterIds: string[];
  generatedFeatureIds?: string[];
  generatedVariationPointIds?: string[];
  generatedConfigurationIds?: string[];
  generatedStudyIds?: string[];
  generatedDecisionIds?: string[];
  sourceModelRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectSession {
  id: string;
  projectId: string;
  currentQuestionKey?: string;
  status: ArchitectStatus;
  answers: Record<string, ArchitectAnswer>;
  sectionStates: Record<string, ArchitectSectionState>;
  reviewedSectionIds: string[];
  parameterIntents: Record<string, ArchitectParameterIntent>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  schemaVersion: number;
  modelRevision: number;
  name: string;
  description: string;
  overallScope?: OverallScope;
  architectSession?: ArchitectSession;
  activeComparisonStudyId?: string;
  objectives: string[];
  /** @deprecated Schema-13 and earlier import-only field. Schema-14 projects do not persist live assumptions. */
  assumptions?: Assumption[];
  openDecisions: OpenDecision[];
  baselineArchitectureId?: string;
  activeArchitectureId?: string;
  createdAt: string;
  updatedAt: string;
  architectures: Architecture[];
  elements: ModelElement[];
  relationships: Relationship[];
  functionSequences: FunctionSequence[];
  selectedUseCaseIds: string[];
  rowOrderByType: Partial<Record<ElementType, string[]>>;
  unitDefinitions: UnitDefinition[];
  customAttributeDefinitions: CustomAttributeDefinition[];
  features: Feature[];
  featureGroups: FeatureGroup[];
  variabilityAxes: VariabilityAxis[];
  featureConstraints: FeatureConstraint[];
  variationPoints: VariationPoint[];
  configurations: Configuration[];
  kpis: KPI[];
  simulationRuns: SimulationRun[];
  comparisonStudies: ComparisonStudy[];
  comparisonRisks: ComparisonRisk[];
  decisions: Decision[];
  validationResults: ValidationResult[];
}

export type WorkspaceId = "dashboard" | "model" | "ontology" | "variability" | "parameters" | "simulation" | "comparison" | "recap" | "export";
export type VariabilityTab =
  | "Feature Model"
  | "Variation Points"
  | "Configurator"
  | "150% Preview"
  | "100% Realization"
  | "Derivation Summary";
export type ModelTabId =
  | "mission-context"
  | "requirements-validation"
  | "product-functional"
  | "product-technical"
  | "process-functional"
  | "process-technical"
  | "interfaces"
  | "traceability";
export interface UiPreferences {
  activePerspective?: AppPerspective;
  activeWorkspace: WorkspaceId;
  activeModelTab: ModelTabId;
  activeModelView: "table" | "graph" | "diagram" | "matrix" | "quality" | "overview" | "sectionRecap" | "requirementsOverview";
  activeElementType?: ElementType;
  activeElementTypes?: ElementType[];
  tableSortModeByType: Partial<Record<ElementType, "manual" | "az" | "za">>;
  graphLayoutModeByTab: Partial<Record<ModelTabId, GraphLayoutMode>>;
  workflowFocus?: string;
  dashboardFocusedStepId?: string;
  dashboardScrollY?: number;
  detailsPanelOpen: boolean;
  validationSeverity: ValidationSeverity | "all";
  validationCategory: ValidationCategory | "all";
  validationDomain: "all" | "model" | "variability" | "parameters" | "simulation";
  variationPointView: "graph" | "list";
  variationGraphSections: ModelTabId[];
  variationGraphElementTypes: ElementType[];
  activeVariabilityTab: VariabilityTab;
  activeTradeStudyTab:
    | "Guided Workflow"
    | "Framing and Criteria"
    | "Candidates and Readiness"
    | "Side-by-Side"
    | "KPI Table"
    | "Charts"
    | "Uncertainty and Risks"
    | "Sensitivity"
    | "Robustness"
    | "Manager Summary"
    | "Expert Evidence"
    | "Decision Rationale"
    | "Digital Thread";
  tradeStudyView: "manager" | "expert";
}
export interface PersistedAppState {
  schemaVersion: number;
  activeProjectId: string | null;
  projects: Project[];
  snapshots: ProjectSnapshot[];
  uiPreferences: UiPreferences;
}

export const elementTypes: ElementType[] = [
  "mission",
  "system",
  "externalSystem",
  "stakeholder",
  "need",
  "objective",
  "useCase",
  "systemRequirement",
  "productFunction",
  "productComponent",
  "productInterface",
  "processFunction",
  "industrialSystemComponent",
  "processInterface",
  "resource",
  "verificationMethod"
];

export const relationshipTypes: RelationshipType[] = [
  "hasSOI",
  "hasStakeholder",
  "participatesInMission",
  "hasNeed",
  "hasObjective",
  "involvedIn",
  "addresses",
  "hasFunction",
  "derives",
  "satisfiedBy",
  "realizedBy",
  "refines",
  "verifies",
  "connects",
  "precedes",
  "allocatedTo",
  "requiresResource",
  "consumes",
  "produces"
];

export const elementTypeLabels: Record<ElementType, string> = {
  mission: "Mission",
  system: "System of interest",
  externalSystem: "External system",
  stakeholder: "Stakeholder",
  need: "Need",
  objective: "Objective",
  useCase: "Use case",
  systemRequirement: "System requirement",
  productFunction: "Product function",
  productComponent: "Product component",
  productInterface: "Product interface",
  processFunction: "Process function",
  industrialSystemComponent: "Industrial-system component",
  processInterface: "Process interface",
  resource: "Resource",
  verificationMethod: "Verification method"
};

export const elementTypeColors: Record<ElementType, string> = {
  mission: "#7c3aed",
  system: "#6d28d9",
  externalSystem: "#64748b",
  stakeholder: "#9333ea",
  need: "#c026d3",
  objective: "#db2777",
  useCase: "#e11d48",
  systemRequirement: "#dc2626",
  productFunction: "#ea580c",
  productComponent: "#d97706",
  productInterface: "#ca8a04",
  processFunction: "#059669",
  industrialSystemComponent: "#0d9488",
  processInterface: "#0891b2",
  resource: "#0284c7",
  verificationMethod: "#4f46e5"
};
