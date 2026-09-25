import type { SemanticRole } from "./ontologyRegistry";
import { scopeOntologyConnections, visibleScopeOntology, type OntologyDensity, type OntologyScopeLevel, type ScopeOntologyConnection } from "./scopeOntology";

export type ScopeOntologyProvenance = "stored" | "typed" | "embedded";
export interface SemanticScopeOntologyConnection extends ScopeOntologyConnection {
  role: SemanticRole;
  provenance: ScopeOntologyProvenance;
}

const roleByAuthority: Readonly<Record<string, SemanticRole>> = {
  hasSOI: "canonical", hasStakeholder: "canonical", participatesInMission: "canonical", hasNeed: "canonical", hasObjective: "canonical",
  involvedIn: "canonical", "UseCase.metadata.subjectSystemId": "canonical", addresses: "canonical", derives: "canonical", hasFunction: "canonical",
  satisfiedBy: "canonical", realizedBy: "canonical", connects: "supporting", requiresResource: "supporting", "ModelElement.architectureId": "supporting",
  "Parameter.ownerElementId": "supporting", "KPI.objectiveIds": "evidence", "KPI.inputParameterIds": "evidence", "SimulationRun.architectureId": "evidence",
  "SimulationRun.selectedKpiIds": "evidence", "SimulationRun.results[]": "evidence", "SimulationResult.kpiId": "evidence", "ComparisonStudy.needIds": "canonical",
  "ComparisonStudy.objectiveIds": "canonical", "ComparisonStudy.useCaseIds": "canonical", "ComparisonStudy.mandatoryRequirementIds": "canonical",
  "ComparisonStudy.rootFeatureId": "canonical", "ComparisonStudy.selectedVariabilityAxisIds": "canonical", "ComparisonStudy.selectedKpiIds": "evidence",
  "VariabilityAxis.featureGroupId": "supporting", "FeatureGroup.parentFeatureId": "supporting", "VariationPoint.featureExpression": "constraint",
  "VariationPoint.constrainedElementIds": "supporting", "Configuration.effectiveSelectedFeatureIds": "canonical", "Configuration.architectureId": "canonical",
  "Configuration.derivation": "canonical", "DerivationResult.appliedVariations[].variationPointId": "canonical", "DerivationResult.sourceArchitectureId": "canonical",
  "SimulationRun.configurationId": "evidence", "SimulationRun.derivationId": "evidence", "ComparisonStudy.alternativeRefs[]": "canonical",
  "ComparisonAlternativeRef.configurationId": "canonical", "ComparisonAlternativeRef.simulationRunId": "evidence", "ComparisonAlternativeRef.architectureId": "canonical",
  "ComparisonStudy.results[]": "evidence", "Decision.supportingComparisonStudyIds": "evidence", "Decision.selectedAlternative": "canonical"
};

const provenance = (kind: ScopeOntologyConnection["kind"]): ScopeOntologyProvenance => kind === "canonical" ? "stored" : kind;

function enrich(connection: ScopeOntologyConnection): SemanticScopeOntologyConnection {
  const role = roleByAuthority[connection.label];
  if (!role) throw new Error(`Scope ontology authority has no semantic role: ${connection.label}`);
  return { ...connection, role, provenance: provenance(connection.kind) };
}

export const semanticScopeOntologyConnections: readonly SemanticScopeOntologyConnection[] = scopeOntologyConnections.map(enrich);
const byId = new Map(semanticScopeOntologyConnections.map(connection => [connection.id, connection]));

export function visibleSemanticScopeOntology(scope: OntologyScopeLevel, density: OntologyDensity) {
  const view = visibleScopeOntology(scope, "all");
  const connections = view.connections.map(connection => byId.get(connection.id)!)
    .filter(connection => density === "all" || connection.thread || connection.role === "canonical");
  return { ...view, connections };
}

export function semanticScopeConnection(id: string) {
  return byId.get(id);
}
