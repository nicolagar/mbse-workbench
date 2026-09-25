import type { Project, Relationship } from "./types";

export type ProcessFlowRole = "start" | "intermediate" | "end" | "isolated";

export interface ProcessFunctionFlowStatus {
  functionId: string;
  role: ProcessFlowRole;
  roles: ProcessFlowRole[];
  consumes: Relationship[];
  produces: Relationship[];
  complete: boolean;
  missingConsumes: boolean;
  missingProduces: boolean;
}

export interface ProcessHandoffStatus {
  precedence: Relationship;
  produced: Relationship[];
  consumed: Relationship[];
  matchedComponentIds: string[];
  unitMismatchComponentIds: string[];
  quantityMismatchComponentIds: string[];
  complete: boolean;
}

const isFlow = (relationship: Relationship) =>
  relationship.relationshipType === "consumes" || relationship.relationshipType === "produces";

const quantity = (relationship: Relationship) =>
  relationship.quantity ?? relationship.requiredQuantity;

function architectureMatches(project: Project, relationship: Relationship): boolean {
  const source = project.elements.find((element) => element.id === relationship.sourceId);
  const target = project.elements.find((element) => element.id === relationship.targetId);
  if (!source || !target) return false;
  if (
    source.architectureScope === "specific"
    && target.architectureScope === "specific"
    && source.architectureId !== target.architectureId
  ) return false;
  const endpointArchitecture = source.architectureScope === "specific"
    ? source.architectureId
    : target.architectureScope === "specific"
      ? target.architectureId
      : undefined;
  return endpointArchitecture
    ? relationship.architectureId === endpointArchitecture
    : !relationship.architectureId;
}

export function isValidProcessItemFlow(project: Project, relationship: Relationship): boolean {
  if (!isFlow(relationship)) return false;
  const source = project.elements.find((element) => element.id === relationship.sourceId);
  const target = project.elements.find((element) => element.id === relationship.targetId);
  const value = quantity(relationship);
  return source?.elementType === "processFunction"
    && target?.elementType === "productComponent"
    && Number.isFinite(value)
    && (value ?? 0) > 0
    && Boolean(relationship.unit?.trim())
    && architectureMatches(project, relationship);
}

export function processPrecedenceRelationships(project: Project): Relationship[] {
  const processIds = new Set(
    project.elements
      .filter((element) => element.elementType === "processFunction")
      .map((element) => element.id)
  );
  return project.relationships.filter((relationship) =>
    relationship.relationshipType === "precedes"
    && processIds.has(relationship.sourceId)
    && processIds.has(relationship.targetId)
  );
}

export function processFunctionFlowStatus(
  project: Project,
  functionId: string
): ProcessFunctionFlowStatus {
  const precedence = processPrecedenceRelationships(project);
  const sequences = project.functionSequences.filter((sequence) =>
    sequence.domain === "process" && sequence.functionIds.includes(functionId)
  );
  const roleFor = (relationships: Relationship[]): ProcessFlowRole => {
    const hasPredecessor = relationships.some((relationship) => relationship.targetId === functionId);
    const hasSuccessor = relationships.some((relationship) => relationship.sourceId === functionId);
    return hasPredecessor
      ? hasSuccessor ? "intermediate" : "end"
      : hasSuccessor ? "start" : "isolated";
  };
  const roles = [...new Set(
    sequences.length
      ? sequences.map((sequence) => roleFor(precedence.filter((relationship) => relationship.sequenceId === sequence.id)))
      : [roleFor(precedence)]
  )];
  const role: ProcessFlowRole = roles.length === 1
    ? roles[0]
    : roles.every((item) => item === "start")
      ? "start"
      : roles.every((item) => item === "end")
        ? "end"
        : "intermediate";
  const flows = project.relationships.filter((relationship) =>
    relationship.sourceId === functionId && isValidProcessItemFlow(project, relationship)
  );
  const consumes = flows.filter((relationship) => relationship.relationshipType === "consumes");
  const produces = flows.filter((relationship) => relationship.relationshipType === "produces");
  const missingConsumes = roles.some((item) => item !== "start") && !consumes.length;
  const missingProduces = roles.some((item) => item !== "end") && !produces.length;
  return {
    functionId,
    role,
    roles,
    consumes,
    produces,
    complete: !missingConsumes && !missingProduces,
    missingConsumes,
    missingProduces
  };
}

export function processHandoffStatus(
  project: Project,
  precedence: Relationship
): ProcessHandoffStatus {
  const produced = project.relationships.filter((relationship) =>
    relationship.sourceId === precedence.sourceId
    && relationship.relationshipType === "produces"
    && isValidProcessItemFlow(project, relationship)
  );
  const consumed = project.relationships.filter((relationship) =>
    relationship.sourceId === precedence.targetId
    && relationship.relationshipType === "consumes"
    && isValidProcessItemFlow(project, relationship)
  );
  const matchedComponentIds = [...new Set(
    produced
      .filter((output) => consumed.some((input) => input.targetId === output.targetId))
      .map((output) => output.targetId)
  )];
  const unitMismatchComponentIds = matchedComponentIds.filter((componentId) => {
    const output = produced.find((relationship) => relationship.targetId === componentId);
    const input = consumed.find((relationship) => relationship.targetId === componentId);
    return output?.unit?.trim() !== input?.unit?.trim();
  });
  const quantityMismatchComponentIds = matchedComponentIds.filter((componentId) => {
    const output = produced.find((relationship) => relationship.targetId === componentId);
    const input = consumed.find((relationship) => relationship.targetId === componentId);
    return quantity(output!) !== quantity(input!);
  });
  return {
    precedence,
    produced,
    consumed,
    matchedComponentIds,
    unitMismatchComponentIds,
    quantityMismatchComponentIds,
    complete: matchedComponentIds.length > 0 && unitMismatchComponentIds.length === 0
  };
}

export function processFunctionSequenceComplete(project: Project, functionId: string): boolean {
  const sequenced = project.functionSequences.some((sequence) =>
    sequence.domain === "process" && sequence.functionIds.includes(functionId)
  );
  if (!sequenced) return false;
  return processPrecedenceRelationships(project)
    .filter((relationship) => relationship.sourceId === functionId || relationship.targetId === functionId)
    .every((relationship) => processHandoffStatus(project, relationship).complete);
}
