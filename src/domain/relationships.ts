import type { ElementType, ModelElement, Relationship, RelationshipType } from "./types";

export type AllowedTriple = readonly [ElementType, RelationshipType, ElementType];
export type RelationshipDirection = "forward" | "reverse";

export interface CompatibleRelationshipDirection {
  direction: RelationshipDirection;
  relationshipType: RelationshipType;
}

export const allowedRelationships: AllowedTriple[] = [
  ["mission", "hasSOI", "system"],
  ["mission", "hasStakeholder", "stakeholder"],
  ["mission", "participatesInMission", "externalSystem"],
  ["stakeholder", "hasNeed", "need"],
  ["stakeholder", "hasObjective", "objective"],
  ["stakeholder", "involvedIn", "useCase"],
  ["externalSystem", "involvedIn", "useCase"],
  ["externalSystem", "connects", "productInterface"],
  ["externalSystem", "connects", "processInterface"],
  ["system", "hasNeed", "need"],
  ["system", "hasObjective", "objective"],
  ["useCase", "addresses", "need"],
  ["useCase", "addresses", "objective"],
  ["useCase", "hasFunction", "productFunction"],
  ["useCase", "hasFunction", "processFunction"],
  ["need", "derives", "systemRequirement"],
  ["objective", "derives", "systemRequirement"],
  ["systemRequirement", "refines", "systemRequirement"],
  ["systemRequirement", "satisfiedBy", "productFunction"],
  ["systemRequirement", "satisfiedBy", "productComponent"],
  ["systemRequirement", "satisfiedBy", "processFunction"],
  ["systemRequirement", "satisfiedBy", "industrialSystemComponent"],
  ["verificationMethod", "verifies", "systemRequirement"],
  ["productFunction", "refines", "productFunction"],
  ["productFunction", "precedes", "productFunction"],
  ["productFunction", "realizedBy", "productComponent"],
  ["productFunction", "connects", "productInterface"],
  ["productComponent", "refines", "productComponent"],
  ["productComponent", "connects", "productInterface"],
  ["productInterface", "connects", "productInterface"],
  ["processFunction", "refines", "processFunction"],
  ["processFunction", "realizedBy", "industrialSystemComponent"],
  ["processFunction", "connects", "processInterface"],
  ["processFunction", "precedes", "processFunction"],
  ["processFunction", "allocatedTo", "productComponent"],
  ["processFunction", "consumes", "productComponent"],
  ["processFunction", "produces", "productComponent"],
  ["industrialSystemComponent", "refines", "industrialSystemComponent"],
  ["industrialSystemComponent", "connects", "processInterface"],
  ["industrialSystemComponent", "requiresResource", "resource"],
  ["processInterface", "connects", "processInterface"],
  ["resource", "allocatedTo", "industrialSystemComponent"],
  ["verificationMethod", "allocatedTo", "processFunction"]
];

export function compatibleRelationshipTypes(source: ElementType, target: ElementType): RelationshipType[] {
  return allowedRelationships
    .filter(([sourceType, , targetType]) => sourceType === source && targetType === target)
    .map(([, relationshipType]) => relationshipType);
}

export function compatibleRelationshipDirections(
  displayedSource: ElementType,
  displayedCounterpart: ElementType
): CompatibleRelationshipDirection[] {
  return [
    ...compatibleRelationshipTypes(displayedSource, displayedCounterpart).map((relationshipType) => ({
      direction: "forward" as const,
      relationshipType
    })),
    ...compatibleRelationshipTypes(displayedCounterpart, displayedSource).map((relationshipType) => ({
      direction: "reverse" as const,
      relationshipType
    }))
  ];
}

export function compatibleTargets(source: ElementType, relationshipType: RelationshipType): ElementType[] {
  return allowedRelationships
    .filter(([sourceType, relation]) => sourceType === source && relation === relationshipType)
    .map(([, , targetType]) => targetType);
}

export function defaultRelationshipType(source: ElementType, target: ElementType): RelationshipType | null {
  return compatibleRelationshipTypes(source, target)[0] ?? null;
}

function relationshipQuantityError(candidate: Relationship): string | null {
  const quantityRelationship = ["requiresResource", "consumes", "produces"].includes(candidate.relationshipType);
  const itemFlow = ["consumes", "produces"].includes(candidate.relationshipType);
  const quantity = candidate.quantity ?? candidate.requiredQuantity;
  if (!quantityRelationship && quantity !== undefined) return "Quantity is only valid for resource or item-flow relationships.";
  if (itemFlow && quantity === undefined) return "An item flow requires a quantity.";
  if (quantityRelationship && quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) {
    return "Quantity must be a finite number greater than zero.";
  }
  if (itemFlow && !candidate.unit?.trim()) {
    return "An item flow requires a unit.";
  }
  return null;
}

export function validateRelationship(
  candidate: Relationship,
  elements: ModelElement[],
  relationships: Relationship[]
): string | null {
  const source = elements.find((element) => element.id === candidate.sourceId);
  const target = elements.find((element) => element.id === candidate.targetId);
  if (!source || !target) return "Source and target must both exist.";
  if (source.id === target.id) return "An element cannot be related to itself.";
  if (
    source.architectureScope === "specific"
    && target.architectureScope === "specific"
    && source.architectureId !== target.architectureId
  ) {
    return "Architecture-specific endpoints must belong to the same architecture.";
  }
  const endpointArchitecture = source.architectureScope === "specific"
    ? source.architectureId
    : target.architectureScope === "specific"
      ? target.architectureId
      : undefined;
  if (endpointArchitecture && candidate.architectureId !== endpointArchitecture) {
    return "The relationship architecture must match its architecture-specific endpoint.";
  }
  if (!endpointArchitecture && candidate.architectureId) {
    return "A common relationship must not declare an architecture.";
  }
  const allowed = allowedRelationships.some(
    ([sourceType, relationshipType, targetType]) =>
      sourceType === source.elementType
      && relationshipType === candidate.relationshipType
      && targetType === target.elementType
  );
  if (!allowed) return `${source.elementType} cannot ${candidate.relationshipType} ${target.elementType}.`;
  const duplicate = relationships.some(
    (relationship) =>
      relationship.id !== candidate.id
      && relationship.sourceId === candidate.sourceId
      && relationship.targetId === candidate.targetId
      && relationship.relationshipType === candidate.relationshipType
  );
  if (duplicate) return "This exact relationship already exists.";
  if (candidate.relationshipType === "hasSOI" && relationships.some((relationship) =>
    relationship.id !== candidate.id
    && relationship.relationshipType === "hasSOI"
    && (relationship.sourceId === candidate.sourceId || relationship.targetId === candidate.targetId)
  )) {
    return "A mission and system of interest may each participate in only one hasSOI relationship.";
  }
  return relationshipQuantityError(candidate);
}
