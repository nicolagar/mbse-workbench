import { allowedRelationships } from "./relationships";
import { elementTypes, elementTypeLabels, type ElementType, type RelationshipType } from "./types";

export const ONTOLOGY_VERSION = "1.0.0";
export const SOURCE_COMMIT = "37c6270416a88186d1d9b22f4d09d5afe211e5d3";
export type SemanticRole = "canonical" | "supporting" | "constraint" | "evidence";
export type SemanticNodeKind = ElementType | "parameter" | "architecture" | "featureModel" | "feature" | "featureGroup" | "variabilityAxis" | "variationPoint" | "configuration" | "realization" | "kpi" | "simulationRun" | "simulationResult" | "tradeStudy" | "studyCriterion" | "candidate" | "alternative" | "comparisonResult" | "risk" | "openDecision" | "decision" | "validationFinding" | "unresolvedReference";
export type SemanticDomain = "context" | "problem" | "solution" | "variability" | "evidence" | "decision";
export const semanticNodeKinds: readonly SemanticNodeKind[] = [...elementTypes, "parameter", "architecture", "featureModel", "feature", "featureGroup", "variabilityAxis", "variationPoint", "configuration", "realization", "kpi", "simulationRun", "simulationResult", "tradeStudy", "studyCriterion", "candidate", "alternative", "comparisonResult", "risk", "openDecision", "decision", "validationFinding", "unresolvedReference"];
export function nodeLabel(kind: SemanticNodeKind): string {
  return elementTypeLabels[kind as ElementType] ?? (({ realization: "100% realization", featureModel: "Feature model" } as Record<string, string>)[kind] ?? kind.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()));
}
export function nodeDomain(kind: SemanticNodeKind): SemanticDomain {
  if (["mission", "system", "stakeholder", "externalSystem"].includes(kind)) return "context";
  if (["need", "objective", "useCase", "systemRequirement"].includes(kind)) return "problem";
  if (["featureModel", "feature", "featureGroup", "variabilityAxis", "variationPoint", "configuration", "realization"].includes(kind)) return "variability";
  if (["kpi", "simulationRun", "simulationResult", "comparisonResult", "validationFinding", "verificationMethod", "unresolvedReference"].includes(kind)) return "evidence";
  if (["tradeStudy", "studyCriterion", "candidate", "alternative", "risk", "openDecision", "decision"].includes(kind)) return "decision";
  return "solution";
}
export const storedPredicateMap = {
  hasSOI: { predicate: "hasSystemOfInterest", role: "canonical" },
  hasStakeholder: { predicate: "hasStakeholder", role: "canonical" },
  participatesInMission: { predicate: "hasMissionParticipant", role: "canonical" },
  hasNeed: { predicate: "hasNeed", role: "canonical" },
  hasObjective: { predicate: "hasObjective", role: "canonical" },
  involvedIn: { predicate: "involvedInUseCase", role: "canonical" },
  addresses: { predicate: "addresses", role: "canonical" },
  hasFunction: { predicate: "requiresFunction", role: "canonical" },
  derives: { predicate: "derivesRequirement", role: "canonical" },
  satisfiedBy: { predicate: "satisfiedBy", role: "canonical" },
  realizedBy: { predicate: "realizedBy", role: "canonical" },
  refines: { predicate: "refines", role: "supporting" },
  verifies: { predicate: "verifies", role: "evidence" },
  connects: { predicate: "connects", role: "supporting" },
  precedes: { predicate: "precedes", role: "supporting" },
  allocatedTo: { predicate: "allocatedTo", role: "supporting" },
  requiresResource: { predicate: "requiresResource", role: "supporting" },
  consumes: { predicate: "consumes", role: "supporting" },
  produces: { predicate: "produces", role: "supporting" },
} as const satisfies Record<RelationshipType, { predicate: string; role: SemanticRole }>;
const ELEMENTS: readonly SemanticNodeKind[] = elementTypes;
const definition = (role: SemanticRole, sourceKinds: readonly SemanticNodeKind[], targetKinds: readonly SemanticNodeKind[], authority: string) => ({ role, sourceKinds, targetKinds, authority });
export const projectedPredicates = {
  hasSubjectSystem: definition("canonical", ["useCase"], ["system"], "metadata.subjectSystemId"),
  belongsToArchitecture: definition("supporting", ELEMENTS, ["architecture"], "architectureId"),
  ownsParameter: definition("supporting", ELEMENTS, ["parameter"], "parameters / ownerElementId"),
  evaluatedAgainst: definition("evidence", ["systemRequirement"], ["parameter"], "requirementFormula.bindings"),
  evaluatedAgainstKpi: definition("evidence", ["systemRequirement"], ["kpi"], "requirementFormula.bindings"),
  containsFeature: definition("supporting", ["featureModel", "feature", "featureGroup"], ["feature"], "parentId / parentGroupId"),
  containsFeatureGroup: definition("supporting", ["featureModel", "feature", "featureGroup"], ["featureGroup"], "parentFeatureId / parentGroupId"),
  organizesFeatureGroup: definition("supporting", ["variabilityAxis"], ["featureGroup"], "featureGroupId"),
  requiresFeature: definition("constraint", ["feature", "studyCriterion"], ["feature"], "featureConstraints / requiredFeatureId"),
  excludesFeature: definition("constraint", ["feature"], ["feature"], "featureConstraints"),
  conditionsVariationPoint: definition("constraint", ["feature"], ["variationPoint"], "featureExpression / featureValueConditions / valueRules"),
  affectsElement: definition("supporting", ["variationPoint"], ELEMENTS, "constrainedElementIds"),
  configuresArchitecture: definition("canonical", ["configuration"], ["architecture"], "architectureId"),
  selectsFeature: definition("canonical", ["configuration"], ["feature"], "effectiveSelectedFeatureIds"),
  derivesRealization: definition("canonical", ["configuration"], ["realization"], "derivation.id"),
  derivedFromArchitecture: definition("canonical", ["realization"], ["architecture"], "sourceArchitectureId"),
  contributesToRealization: definition("canonical", ["variationPoint"], ["realization"], "appliedVariations"),
  containsRealizedElement: definition("supporting", ["realization"], ELEMENTS, "realizedElements"),
  measuresObjective: definition("evidence", ["kpi"], ["objective"], "objectiveIds"),
  measuresNeed: definition("evidence", ["kpi"], ["need"], "needIds"),
  providesInputTo: definition("evidence", ["parameter"], ["kpi"], "inputParameterIds"),
  providesInputToParameter: definition("evidence", ["parameter", "kpi"], ["parameter"], "calculation.bindings"),
  providesInputToKpi: definition("evidence", ["kpi"], ["kpi"], "dependsOnKpiIds"),
  evaluatedBy: definition("evidence", ["realization", "architecture", "configuration"], ["simulationRun"], "architectureId / configurationId / derivationId"),
  producesResult: definition("evidence", ["simulationRun"], ["simulationResult"], "results"),
  reportsKpi: definition("evidence", ["simulationResult"], ["kpi"], "kpiId"),
  providesEvidenceInput: definition("evidence", ["parameter"], ["simulationResult"], "sourceParameterIds"),
  initiatesStudy: definition("canonical", ["openDecision"], ["tradeStudy"], "originatingOpenDecisionId"),
  scopes: definition("canonical", ["tradeStudy"], ["need", "objective", "useCase", "systemRequirement"], "scope IDs"),
  usesFeatureModelRoot: definition("canonical", ["tradeStudy"], ["feature"], "rootFeatureId"),
  exploresFeature: definition("canonical", ["tradeStudy"], ["feature"], "exploredFeatureIds"),
  evaluatesKpi: definition("evidence", ["tradeStudy"], ["kpi"], "selectedKpiIds"),
  exploresAxis: definition("canonical", ["tradeStudy"], ["variabilityAxis"], "selectedVariabilityAxisIds"),
  definesCriterion: definition("canonical", ["tradeStudy", "decision"], ["studyCriterion"], "criteria"),
  drivesCriterion: definition("canonical", ["objective"], ["studyCriterion"], "sourceObjectiveIds"),
  constrainsCriterion: definition("canonical", ["systemRequirement"], ["studyCriterion"], "sourceRequirementIds"),
  evaluatedByKpi: definition("evidence", ["studyCriterion"], ["kpi"], "kpiId"),
  definesCandidate: definition("canonical", ["tradeStudy"], ["candidate"], "candidateRefs"),
  referencesConfiguration: definition("canonical", ["candidate", "alternative"], ["configuration"], "configurationId"),
  referencesArchitecture: definition("canonical", ["candidate", "alternative", "tradeStudy"], ["architecture"], "architectureId / referenceArchitectureId"),
  referencesSimulationRun: definition("evidence", ["alternative"], ["simulationRun"], "simulationRunId"),
  evaluatesAlternative: definition("canonical", ["tradeStudy", "decision"], ["alternative"], "alternativeRefs / candidateAlternatives"),
  producesComparisonResult: definition("evidence", ["tradeStudy"], ["comparisonResult"], "results"),
  appliesTo: definition("evidence", ["risk"], ["architecture", "configuration", "systemRequirement", "parameter", "kpi", "tradeStudy", "alternative"], "applicability IDs"),
  informsDecision: definition("evidence", ["tradeStudy", "simulationRun"], ["decision"], "supporting IDs"),
  selectsAlternative: definition("canonical", ["decision"], ["alternative"], "selectedAlternative scoped resolution"),
  selectsArchitecture: definition("canonical", ["decision"], ["architecture"], "unambiguous selected alternative"),
  reportsFinding: definition("evidence", ["validationFinding"], ELEMENTS, "affectedElementIds"),
} as const;
export type SemanticPredicate = typeof storedPredicateMap[RelationshipType]["predicate"] | keyof typeof projectedPredicates;
export interface PredicateDefinition {
  id: SemanticPredicate; role: SemanticRole; sourceKinds: readonly SemanticNodeKind[]; targetKinds: readonly SemanticNodeKind[];
  pairs?: readonly (readonly [SemanticNodeKind, SemanticNodeKind])[];
  storedPredicate?: RelationshipType; storedDirection: "direct" | "fieldDependent"; authority: string;
}
export const ontologyRegistry: readonly PredicateDefinition[] = [
  ...Object.entries(storedPredicateMap).map(([stored, mapping]) => {
    const triples = allowedRelationships.filter(([, p]) => p === stored);
    return { id: mapping.predicate, role: mapping.role, storedPredicate: stored as RelationshipType, storedDirection: "direct" as const,
      sourceKinds: [...new Set(triples.map(([s]) => s))], targetKinds: [...new Set(triples.map(([, , t]) => t))],
      pairs: triples.map(([s, , t]) => [s, t] as const), authority: "Project.relationships" };
  }),
  ...Object.entries(projectedPredicates).map(([id, def]) => ({ id: id as SemanticPredicate, ...def, storedDirection: "fieldDependent" as const }))
];
export const predicateById = new Map(ontologyRegistry.map(p => [p.id, p]));
export function acceptsEndpoints(predicate: SemanticPredicate, source: SemanticNodeKind, target: SemanticNodeKind): boolean {
  const def = predicateById.get(predicate);
  return !!def && (def.pairs ? def.pairs.some(([s, t]) => s === source && t === target) : def.sourceKinds.includes(source) && def.targetKinds.includes(target));
}
