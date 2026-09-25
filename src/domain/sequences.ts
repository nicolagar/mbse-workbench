import type { FunctionSequence, ModelElement, Project, Relationship } from "./types";
import { calculateSemanticScope } from "./semanticScope";

const functionType = (sequence: FunctionSequence) =>
  sequence.domain === "product" ? "productFunction" : "processFunction";

export interface SequenceAnalysis {
  stageLabels: Record<string, string>;
  stages: string[][];
  startFunctionIds: string[];
  endFunctionIds: string[];
  errors: string[];
}

export interface SequenceFunctionRow {
  element: ModelElement;
  depth: number;
  parentId?: string;
  selectable: boolean;
}

export function sequenceRelationships(project: Project, sequence: FunctionSequence): Relationship[] {
  return project.relationships.filter((relationship) =>
    relationship.sequenceId === sequence.id
    && relationship.relationshipType === "precedes"
  );
}

export function sequenceFunctionHierarchy(project: Project, sequence: Pick<FunctionSequence, "domain" | "useCaseIds">): SequenceFunctionRow[] {
  if (sequence.useCaseIds.length !== 1) return [];
  const scope = calculateSemanticScope(project, sequence.useCaseIds);
  const functions = sequence.domain === "product" ? scope.productFunctions : scope.processFunctions;
  const ids = new Set(functions.map((element) => element.id));
  const parentByChild = new Map(project.relationships
    .filter((relationship) => relationship.relationshipType === "refines" && ids.has(relationship.sourceId) && ids.has(relationship.targetId))
    .map((relationship) => [relationship.sourceId, relationship.targetId]));
  const childrenByParent = new Map<string, string[]>();
  parentByChild.forEach((parentId, childId) => childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), childId]));
  const order = project.rowOrderByType[sequence.domain === "product" ? "productFunction" : "processFunction"] ?? [];
  const sortIds = (functionIds: string[]) => [...functionIds].sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    return (project.elements.find((element) => element.id === left)?.name ?? left)
      .localeCompare(project.elements.find((element) => element.id === right)?.name ?? right);
  });
  const roots = sortIds(functions.filter((element) => !parentByChild.has(element.id)).map((element) => element.id));
  const rows: SequenceFunctionRow[] = [];
  const visited = new Set<string>();
  const visit = (id: string, depth: number, parentId?: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const element = functions.find((candidate) => candidate.id === id);
    if (!element) return;
    const children = sortIds(childrenByParent.get(id) ?? []);
    rows.push({ element, depth, parentId, selectable: children.length === 0 });
    children.forEach((childId) => visit(childId, depth + 1, id));
  };
  roots.forEach((id) => visit(id, 0));
  sortIds(functions.filter((element) => !visited.has(element.id)).map((element) => element.id))
    .forEach((id) => visit(id, 0));
  return rows;
}

export function analyzeSequence(project: Project, sequence: FunctionSequence): SequenceAnalysis {
  const errors: string[] = [];
  const expectedType = functionType(sequence);
  const functions = sequence.functionIds
    .map((id) => project.elements.find((element) => element.id === id))
    .filter((element): element is ModelElement => Boolean(element));
  const functionIds = new Set(functions.map((element) => element.id));
  const relationships = sequenceRelationships(project, sequence);

  if (!sequence.name.trim()) errors.push("The sequence requires a name.");
  if (sequence.useCaseIds.length !== 1) errors.push("Select exactly one use case for the sequence.");
  const projectScope = calculateSemanticScope(project);
  if (sequence.useCaseIds.length === 1 && !projectScope.workingUseCases.some((useCase) => useCase.id === sequence.useCaseIds[0])) {
    errors.push("The sequence use case must be in the project working scope and involve the system of interest.");
  }
  const hierarchy = sequenceFunctionHierarchy(project, sequence);
  const selectableIds = new Set(hierarchy.filter((row) => row.selectable).map((row) => row.element.id));
  if (!functions.length) errors.push("Add at least one function to the sequence.");
  if (functions.length !== sequence.functionIds.length) errors.push("The sequence references a missing function.");
  if (functions.some((element) => element.elementType !== expectedType)) {
    errors.push(`A ${sequence.domain} sequence may contain ${expectedType} elements only.`);
  }
  if (sequence.architectureId && !project.architectures.some((architecture) => architecture.id === sequence.architectureId)) {
    errors.push("The sequence architecture no longer exists.");
  }
  if (sequence.architectureId && functions.some((element) => element.architectureScope === "specific" && element.architectureId !== sequence.architectureId)) {
    errors.push("Every architecture-specific function must match the sequence architecture.");
  }
  if (sequence.useCaseIds.some((id) => !project.elements.some((element) => element.id === id && element.elementType === "useCase"))) {
    errors.push("The sequence references a missing use case.");
  }
  if (functions.some((element) => !selectableIds.has(element.id))) errors.push("Only related leaf functions without children may be sequence steps.");
  relationships.forEach((relationship) => {
    if (!functionIds.has(relationship.sourceId) || !functionIds.has(relationship.targetId)) {
      errors.push("A precedence relationship has an endpoint outside the sequence.");
    }
  });
  if (
    sequence.relationshipIds.some((id) => !relationships.some((relationship) => relationship.id === id))
    || relationships.some((relationship) => !sequence.relationshipIds.includes(relationship.id))
  ) {
    errors.push("The sequence relationship index is inconsistent with its contextual precedence links.");
  }

  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  sequence.functionIds.forEach((id) => {
    successors.set(id, []);
    predecessors.set(id, []);
  });
  relationships.forEach((relationship) => {
    successors.get(relationship.sourceId)?.push(relationship.targetId);
    predecessors.get(relationship.targetId)?.push(relationship.sourceId);
  });

  const indegree = new Map(sequence.functionIds.map((id) => [id, predecessors.get(id)?.length ?? 0]));
  const queue = sequence.functionIds.filter((id) => (indegree.get(id) ?? 0) === 0);
  const topological: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    topological.push(id);
    (successors.get(id) ?? []).forEach((targetId) => {
      indegree.set(targetId, (indegree.get(targetId) ?? 1) - 1);
      if (indegree.get(targetId) === 0) queue.push(targetId);
    });
  }
  if (topological.length !== sequence.functionIds.length) errors.push("The sequence contains a cycle.");

  if (sequence.functionIds.length > 1) {
    const visited = new Set<string>();
    const pending = [sequence.functionIds[0]];
    while (pending.length) {
      const id = pending.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      [...(successors.get(id) ?? []), ...(predecessors.get(id) ?? [])]
        .filter((candidate) => !visited.has(candidate))
        .forEach((candidate) => pending.push(candidate));
    }
    if (visited.size !== sequence.functionIds.length) errors.push("The sequence contains disconnected functions or subgraphs.");
  }

  const stageById = new Map<string, number>();
  topological.forEach((id) => {
    const predecessorStages = (predecessors.get(id) ?? []).map((predecessorId) => stageById.get(predecessorId) ?? 0);
    stageById.set(id, predecessorStages.length ? Math.max(...predecessorStages) + 1 : 1);
  });
  const maxStage = Math.max(0, ...stageById.values());
  const stages = Array.from({ length: maxStage }, (_, index) =>
    sequence.functionIds.filter((id) => stageById.get(id) === index + 1)
  );
  const stageLabels: Record<string, string> = {};
  stages.forEach((ids, index) => ids.forEach((id, branchIndex) => {
    stageLabels[id] = ids.length === 1 ? String(index + 1) : `${index + 1}${String.fromCharCode(65 + branchIndex)}`;
  }));
  const startFunctionIds = sequence.functionIds.filter((id) => !(predecessors.get(id)?.length));
  const endFunctionIds = sequence.functionIds.filter((id) => !(successors.get(id)?.length));
  return { stageLabels, stages, startFunctionIds, endFunctionIds, errors: [...new Set(errors)] };
}

export function sequenceNodePositions(project: Project, sequence: FunctionSequence) {
  const analysis = analyzeSequence(project, sequence);
  return Object.fromEntries(analysis.stages.flatMap((ids, stageIndex) =>
    ids.map((id, branchIndex) => [id, { x: stageIndex * 285, y: branchIndex * 155 }])
  ));
}

export function sequenceWouldCycle(project: Project, candidate: Relationship): boolean {
  if (candidate.relationshipType !== "precedes" || !candidate.sequenceId) return false;
  const sequence = project.functionSequences.find((item) => item.id === candidate.sequenceId);
  if (!sequence) return false;
  const relationships = project.relationships.some((relationship) => relationship.id === candidate.id)
    ? project.relationships.map((relationship) => relationship.id === candidate.id ? candidate : relationship)
    : [...project.relationships, candidate];
  return analyzeSequence({ ...project, relationships }, sequence).errors.includes("The sequence contains a cycle.");
}
