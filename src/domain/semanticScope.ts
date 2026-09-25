import type { ElementType, ModelElement, Project } from "./types";

export interface SemanticWorkingScope {
  systemsOfInterest: ModelElement[];
  systemOfInterest?: ModelElement;
  eligibleUseCases: ModelElement[];
  workingUseCases: ModelElement[];
  invalidUseCaseIds: string[];
  stakeholders: ModelElement[];
  missions: ModelElement[];
  needs: ModelElement[];
  objectives: ModelElement[];
  requirements: ModelElement[];
  productFunctions: ModelElement[];
  processFunctions: ModelElement[];
}

const uniqueElements = (elements: ModelElement[]) =>
  [...new Map(elements.map((element) => [element.id, element])).values()];

const elementsOfType = (project: Project, type: ElementType) =>
  project.elements.filter((element) => element.elementType === type);

function targetElements(
  project: Project,
  sourceIds: Set<string>,
  relationshipType: string,
  targetType: ElementType
) {
  return uniqueElements(project.relationships
    .filter((relationship) => sourceIds.has(relationship.sourceId) && relationship.relationshipType === relationshipType)
    .map((relationship) => project.elements.find((element) =>
      element.id === relationship.targetId && element.elementType === targetType
    ))
    .filter((element): element is ModelElement => Boolean(element)));
}

function sourceElements(
  project: Project,
  targetIds: Set<string>,
  relationshipType: string,
  sourceType: ElementType
) {
  return uniqueElements(project.relationships
    .filter((relationship) => targetIds.has(relationship.targetId) && relationship.relationshipType === relationshipType)
    .map((relationship) => project.elements.find((element) =>
      element.id === relationship.sourceId && element.elementType === sourceType
    ))
    .filter((element): element is ModelElement => Boolean(element)));
}

function relatedFunctions(project: Project, useCaseIds: Set<string>, type: Extract<ElementType, "productFunction" | "processFunction">) {
  const direct = targetElements(project, useCaseIds, "hasFunction", type);
  const relatedIds = new Set(direct.map((element) => element.id));
  let changed = true;
  while (changed) {
    changed = false;
    project.relationships.forEach((relationship) => {
      if (relationship.relationshipType !== "refines" || !relatedIds.has(relationship.targetId)) return;
      const child = project.elements.find((element) => element.id === relationship.sourceId && element.elementType === type);
      if (child && !relatedIds.has(child.id)) {
        relatedIds.add(child.id);
        changed = true;
      }
    });
  }
  return elementsOfType(project, type).filter((element) => relatedIds.has(element.id));
}

/**
 * Canonical semantic scope used by workflow, Trade Study, sequence and validation views.
 * A valid working use case must involve the single designated system of interest.
 */
export function calculateSemanticScope(
  project: Project,
  requestedUseCaseIds: string[] = project.selectedUseCaseIds
): SemanticWorkingScope {
  const systemsOfInterest = elementsOfType(project, "system");
  const systemOfInterest = systemsOfInterest.length === 1 ? systemsOfInterest[0] : undefined;
  const eligibleUseCaseIds = new Set(systemOfInterest
    ? project.elements.filter((element) => element.elementType === "useCase" && element.metadata.subjectSystemId === systemOfInterest.id).map((element) => element.id)
    : []);
  const eligibleUseCases = elementsOfType(project, "useCase")
    .filter((element) => eligibleUseCaseIds.has(element.id));
  const requestedIds = [...new Set(requestedUseCaseIds)];
  const workingUseCases = eligibleUseCases.filter((element) => requestedIds.includes(element.id));
  const workingUseCaseIds = new Set(workingUseCases.map((element) => element.id));
  const invalidUseCaseIds = requestedIds.filter((id) => !workingUseCaseIds.has(id));
  const stakeholders = sourceElements(project, workingUseCaseIds, "involvedIn", "stakeholder");
  const stakeholderIds = new Set(stakeholders.map((element) => element.id));
  const missions = uniqueElements([
    ...sourceElements(project, stakeholderIds, "hasStakeholder", "mission"),
    ...sourceElements(project, new Set(systemsOfInterest.map((element) => element.id)), "hasSOI", "mission")
  ]);
  const participantNeeds = targetElements(project, stakeholderIds, "hasNeed", "need");
  const participantObjectives = targetElements(project, stakeholderIds, "hasObjective", "objective");
  const addressedNeeds = targetElements(project, workingUseCaseIds, "addresses", "need");
  const addressedObjectives = targetElements(project, workingUseCaseIds, "addresses", "objective");
  const hasExplicitIntentScope = addressedNeeds.length + addressedObjectives.length > 0;
  const needs = hasExplicitIntentScope ? addressedNeeds : participantNeeds;
  const objectives = hasExplicitIntentScope ? addressedObjectives : participantObjectives;
  const needObjectiveIds = new Set([...needs, ...objectives].map((element) => element.id));
  const requirements = targetElements(project, needObjectiveIds, "derives", "systemRequirement");
  return {
    systemsOfInterest,
    systemOfInterest,
    eligibleUseCases,
    workingUseCases,
    invalidUseCaseIds,
    stakeholders,
    missions,
    needs,
    objectives,
    requirements,
    productFunctions: relatedFunctions(project, workingUseCaseIds, "productFunction"),
    processFunctions: relatedFunctions(project, workingUseCaseIds, "processFunction")
  };
}

export function semanticScopeElementIds(scope: SemanticWorkingScope) {
  return new Set([
    ...scope.systemsOfInterest,
    ...scope.workingUseCases,
    ...scope.stakeholders,
    ...scope.missions,
    ...scope.needs,
    ...scope.objectives,
    ...scope.requirements,
    ...scope.productFunctions,
    ...scope.processFunctions
  ].map((element) => element.id));
}

