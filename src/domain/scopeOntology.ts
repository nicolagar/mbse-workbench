import type { OverallScope } from "./types";

export type OntologyScopeLevel = 0 | 1 | 2;
export type OntologyConnectionKind = "canonical" | "typed" | "embedded";
export type OntologyEnvironmentId = "model" | "trade" | "eval" | "decision";
export type OntologyDensity = "thread" | "all";

export interface ScopeOntologyNode {
  id: string;
  label: string;
  environment: OntologyEnvironmentId;
  stage: string;
  level: OntologyScopeLevel;
  type: string;
  note: string;
  optional?: boolean;
}

export interface ScopeOntologyConnection {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: OntologyConnectionKind;
  level: OntologyScopeLevel;
  thread: boolean;
  note: string;
}

export const scopeLabels: Record<OntologyScopeLevel, string> = {
  0: "Architecture",
  1: "Architecture + simulation",
  2: "Trade Study"
};

export const scopeLevelByProjectScope: Record<OverallScope, OntologyScopeLevel> = {
  architectureBuilding: 0,
  architectureAndSimulation: 1,
  tradeStudy: 2
};

export const ontologyStages = [
  ["context", "Mission and context"],
  ["scope", "Needs, objectives and requirements"],
  ["framing", "Study and KPI framing"],
  ["architecture", "Build architecture"],
  ["features", "Feature model"],
  ["mapping", "Map variability"],
  ["configuration", "Create configurations"],
  ["derivation", "Derive 100%"],
  ["simulation", "Simulate"],
  ["decision", "Compare and decide"],
  ["baseline", "Architecture / baseline"]
] as const;

export const scopeOntologyNodes: ScopeOntologyNode[] = [
  { id: "mission", label: "Mission", environment: "model", stage: "context", level: 0, type: "Model element", note: "Purpose anchoring every scope." },
  { id: "system", label: "System of interest", environment: "model", stage: "context", level: 0, type: "Model element", note: "Exactly one SOI is linked by hasSOI." },
  { id: "stakeholder", label: "Stakeholder", environment: "model", stage: "context", level: 0, type: "Model element", note: "Person or organisation whose intent is modeled." },
  { id: "external", label: "External system", environment: "model", stage: "context", level: 0, type: "Conditional model element", optional: true, note: "Used when an outside system participates in the mission or a use case." },
  { id: "need", label: "Need", environment: "model", stage: "scope", level: 0, type: "Model element", note: "Stakeholder need entering project scope." },
  { id: "objective", label: "Objective", environment: "model", stage: "scope", level: 0, type: "Model element", note: "Measurable intent reused by KPI and Trade Study records." },
  { id: "useCase", label: "Use case", environment: "model", stage: "scope", level: 0, type: "Model element", note: "Selected scenario involving the SOI, stakeholders, and relevant external systems." },
  { id: "requirement", label: "System requirement", environment: "model", stage: "scope", level: 0, type: "Model element", note: "Derived obligation entering architecture work." },
  { id: "study", label: "Trade Study", environment: "trade", stage: "framing", level: 2, type: "Domain record", note: "Defines the question, scoped objectives, axes, and evaluation evidence." },
  { id: "kpi", label: "KPI", environment: "eval", stage: "framing", level: 1, type: "Domain record", note: "Objective-linked evaluation definition." },
  { id: "productFunction", label: "Product function", environment: "model", stage: "architecture", level: 0, type: "Model element", note: "Product behavior required by the selected use case." },
  { id: "productComponent", label: "Product component", environment: "model", stage: "architecture", level: 0, type: "Model element", note: "Logical or physical realization of product behavior." },
  { id: "productInterface", label: "Product interface", environment: "model", stage: "architecture", level: 0, type: "Conditional model element", optional: true, note: "Added when a product boundary exchange is modeled." },
  { id: "processFunction", label: "Process function", environment: "model", stage: "architecture", level: 0, type: "Model element", note: "Industrial behavior producing or supporting the product." },
  { id: "industrialComponent", label: "Industrial component", environment: "model", stage: "architecture", level: 0, type: "Model element", note: "Equipment or station realizing industrial behavior." },
  { id: "processInterface", label: "Process interface", environment: "model", stage: "architecture", level: 0, type: "Conditional model element", optional: true, note: "Added when a process boundary exchange is modeled." },
  { id: "resource", label: "Resource", environment: "model", stage: "architecture", level: 0, type: "Conditional model element", optional: true, note: "Person, tool, machine, software, or facility required by the industrial architecture." },
  { id: "parameter", label: "Parameter", environment: "model", stage: "architecture", level: 1, type: "Embedded model record", note: "Value owned by a model element and used by KPI calculations." },
  { id: "feature", label: "Feature / Root Feature", environment: "trade", stage: "features", level: 2, type: "Domain record", note: "The Feature type represents the single root and selectable non-root choices." },
  { id: "featureGroup", label: "Feature Group", environment: "trade", stage: "features", level: 2, type: "Domain record", note: "Organizes selectable features beneath the root." },
  { id: "axis", label: "Variability axis", environment: "trade", stage: "features", level: 2, type: "Domain record", note: "Study-selected reusable axis linked to a Feature Group." },
  { id: "variationPoint", label: "Variation Point", environment: "trade", stage: "mapping", level: 2, type: "Domain record", note: "Maps a feature expression to existing architecture content." },
  { id: "configuration", label: "Configuration", environment: "trade", stage: "configuration", level: 2, type: "Domain record", note: "Validated effective feature selection; at least two are needed for a comparison." },
  { id: "derivation", label: "100% derivation", environment: "trade", stage: "derivation", level: 2, type: "Embedded evidence", note: "Realized snapshot embedded in its Configuration." },
  { id: "run", label: "Simulation run", environment: "eval", stage: "simulation", level: 1, type: "Immutable evidence", note: "Execution record referencing exact architecture, configuration, and derivation evidence." },
  { id: "simulationResult", label: "Simulation result", environment: "eval", stage: "simulation", level: 1, type: "Embedded evidence", note: "KPI result embedded in the Simulation Run." },
  { id: "alternative", label: "Evaluated alternative", environment: "decision", stage: "decision", level: 2, type: "Embedded study record", note: "Exact configuration, architecture, and simulation-run reference." },
  { id: "comparisonResult", label: "Comparison result", environment: "decision", stage: "decision", level: 2, type: "Embedded evidence", note: "Current feasibility and KPI comparison evidence." },
  { id: "decision", label: "Decision", environment: "decision", stage: "decision", level: 2, type: "Domain record", note: "Approved selection and rationale supported by study and run evidence." },
  { id: "architecture", label: "Architecture", environment: "model", stage: "baseline", level: 0, type: "Architecture record", note: "Architecture identity reused throughout the digital thread." }
];

type ConnectionTuple = readonly [string, string, string, OntologyConnectionKind, OntologyScopeLevel, boolean, string];

const connectionTuples: ConnectionTuple[] = [
  ["mission", "system", "hasSOI", "canonical", 0, true, "Mission identifies the single SOI."],
  ["mission", "stakeholder", "hasStakeholder", "canonical", 0, true, "Mission stakeholder context."],
  ["mission", "external", "participatesInMission", "canonical", 0, false, "Conditional external context."],
  ["stakeholder", "need", "hasNeed", "canonical", 0, true, "Captures stakeholder need."],
  ["stakeholder", "objective", "hasObjective", "canonical", 0, true, "Captures measurable intent."],
  ["stakeholder", "useCase", "involvedIn", "canonical", 0, true, "Stakeholder participates in a use case."],
  ["external", "useCase", "involvedIn", "canonical", 0, true, "External system participates in a use case."],
  ["useCase", "system", "UseCase.metadata.subjectSystemId", "typed", 0, true, "Working-scope use case identifies the SOI."],
  ["useCase", "need", "addresses", "canonical", 0, true, "Use case addresses scoped need."],
  ["useCase", "objective", "addresses", "canonical", 0, false, "Use case addresses scoped objective."],
  ["need", "requirement", "derives", "canonical", 0, true, "Need derives a requirement."],
  ["objective", "requirement", "derives", "canonical", 0, true, "Objective derives a requirement."],
  ["useCase", "productFunction", "hasFunction", "canonical", 0, true, "Selected use case requires product behavior."],
  ["requirement", "productFunction", "satisfiedBy", "canonical", 0, true, "Requirement is satisfied by product behavior."],
  ["productFunction", "productComponent", "realizedBy", "canonical", 0, true, "Product function is realized by a component."],
  ["useCase", "processFunction", "hasFunction", "canonical", 0, true, "Selected use case requires industrial behavior."],
  ["requirement", "processFunction", "satisfiedBy", "canonical", 0, false, "Requirement may be satisfied by process behavior."],
  ["processFunction", "industrialComponent", "realizedBy", "canonical", 0, true, "Process function is realized by equipment or station."],
  ["productFunction", "productInterface", "connects", "canonical", 0, false, "Conditional product boundary."],
  ["processFunction", "processInterface", "connects", "canonical", 0, false, "Conditional process boundary."],
  ["industrialComponent", "resource", "requiresResource", "canonical", 0, false, "Conditional supporting resource."],
  ["productComponent", "architecture", "ModelElement.architectureId", "typed", 0, false, "Used when the element is architecture-specific."],
  ["industrialComponent", "architecture", "ModelElement.architectureId", "typed", 0, false, "Used when the element is architecture-specific."],
  ["parameter", "productComponent", "Parameter.ownerElementId", "typed", 1, true, "Parameter ownership."],
  ["kpi", "objective", "KPI.objectiveIds", "typed", 1, true, "KPI measures an objective."],
  ["kpi", "parameter", "KPI.inputParameterIds", "typed", 1, true, "KPI consumes exact model parameters."],
  ["run", "architecture", "SimulationRun.architectureId", "typed", 1, true, "Run records its architecture."],
  ["run", "kpi", "SimulationRun.selectedKpiIds", "typed", 1, false, "Run records selected KPI definitions."],
  ["run", "simulationResult", "SimulationRun.results[]", "embedded", 1, true, "Run owns immutable results."],
  ["simulationResult", "kpi", "SimulationResult.kpiId", "typed", 1, true, "Result identifies its KPI."],
  ["study", "need", "ComparisonStudy.needIds", "typed", 2, false, "Required study-scope reference."],
  ["study", "objective", "ComparisonStudy.objectiveIds", "typed", 2, true, "Required cross-environment objective reference."],
  ["study", "useCase", "ComparisonStudy.useCaseIds", "typed", 2, false, "Required active-use-case reference."],
  ["study", "requirement", "ComparisonStudy.mandatoryRequirementIds", "typed", 2, false, "Required feasibility scope."],
  ["study", "feature", "ComparisonStudy.rootFeatureId", "typed", 2, false, "Study selects the project Root Feature."],
  ["study", "axis", "ComparisonStudy.selectedVariabilityAxisIds", "typed", 2, true, "Study selects reusable axes."],
  ["study", "kpi", "ComparisonStudy.selectedKpiIds", "typed", 2, false, "Study selects evaluation KPIs."],
  ["axis", "featureGroup", "VariabilityAxis.featureGroupId", "typed", 2, true, "Axis identifies its Feature Group."],
  ["featureGroup", "feature", "FeatureGroup.parentFeatureId", "typed", 2, true, "Group belongs beneath the Root Feature."],
  ["variationPoint", "feature", "VariationPoint.featureExpression", "typed", 2, true, "Expression selects applicable features."],
  ["variationPoint", "productComponent", "VariationPoint.constrainedElementIds", "typed", 2, true, "Maps variability to existing architecture content."],
  ["configuration", "feature", "Configuration.effectiveSelectedFeatureIds", "typed", 2, true, "Stores the effective feature selection."],
  ["configuration", "architecture", "Configuration.architectureId", "typed", 2, true, "Identifies its Architecture record."],
  ["configuration", "derivation", "Configuration.derivation", "embedded", 2, true, "Configuration embeds the 100% derivation."],
  ["derivation", "variationPoint", "DerivationResult.appliedVariations[].variationPointId", "typed", 2, true, "Records the applied mapping."],
  ["derivation", "architecture", "DerivationResult.sourceArchitectureId", "typed", 2, false, "Records the 150% source architecture."],
  ["run", "configuration", "SimulationRun.configurationId", "typed", 2, true, "Connects the configured solution to simulation."],
  ["run", "derivation", "SimulationRun.derivationId", "typed", 2, true, "Connects the exact 100% evidence to the run."],
  ["study", "alternative", "ComparisonStudy.alternativeRefs[]", "embedded", 2, true, "Study owns compared alternatives."],
  ["alternative", "configuration", "ComparisonAlternativeRef.configurationId", "typed", 2, false, "Alternative identifies its configuration."],
  ["alternative", "run", "ComparisonAlternativeRef.simulationRunId", "typed", 2, true, "Direct simulation-to-comparison evidence bridge."],
  ["alternative", "architecture", "ComparisonAlternativeRef.architectureId", "typed", 2, true, "Alternative identifies its architecture."],
  ["study", "comparisonResult", "ComparisonStudy.results[]", "embedded", 2, true, "Study owns comparison results."],
  ["decision", "study", "Decision.supportingComparisonStudyIds", "typed", 2, false, "Decision identifies supporting study evidence."],
  ["decision", "alternative", "Decision.selectedAlternative", "typed", 2, true, "Existing label lookup to the selected alternative."]
];

export const scopeOntologyConnections: ScopeOntologyConnection[] = connectionTuples.map((connection, index) => ({
  id: `scope-ontology-connection-${index}`,
  source: connection[0],
  target: connection[1],
  label: connection[2],
  kind: connection[3],
  level: connection[4],
  thread: connection[5],
  note: connection[6]
}));

export const ontologyEnvironmentOrder = (scope: OntologyScopeLevel): OntologyEnvironmentId[] =>
  scope === 0 ? ["model"] : scope === 1 ? ["model", "eval"] : ["model", "trade", "eval", "decision"];

export function visibleScopeOntology(scope: OntologyScopeLevel, density: OntologyDensity) {
  const nodes = scopeOntologyNodes.filter((node) => node.level <= scope);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const connections = scopeOntologyConnections.filter((connection) =>
    connection.level <= scope
    && nodeIds.has(connection.source)
    && nodeIds.has(connection.target)
    && (density === "all" || connection.thread || connection.kind === "canonical")
  );
  return { nodes, connections };
}

export function ontologyNodeName(id: string) {
  return scopeOntologyNodes.find((node) => node.id === id)?.label ?? id;
}
