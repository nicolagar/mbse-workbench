import type { ModelElement, Project } from "./types";

export type ContextConnectionKind = "useCaseSubject" | "architectureRepresentation";

export interface ContextConnection {
  id: string;
  sourceId: string;
  targetId: string;
  ownerId: string;
  kind: ContextConnectionKind;
  label: string;
}

/**
 * Projects typed context references as read-only connections for every model view.
 * These are not persisted Relationship records: their semantics remain owned by
 * the corresponding typed metadata field.
 */
export function contextConnections(project: Pick<Project, "elements">): ContextConnection[] {
  const ids = new Set(project.elements.map((element) => element.id));
  return project.elements.flatMap((element): ContextConnection[] => {
    const result: ContextConnection[] = [];
    if (element.elementType === "useCase" && element.metadata.subjectSystemId && ids.has(element.metadata.subjectSystemId)) {
      result.push({
        id: `context:subject:${element.id}`,
        sourceId: element.metadata.subjectSystemId,
        targetId: element.id,
        ownerId: element.id,
        kind: "useCaseSubject",
        label: "subject of use case"
      });
    }
    if (element.elementType === "system" && element.metadata.architectureRootId && ids.has(element.metadata.architectureRootId)) {
      result.push({
        id: `context:representation:${element.id}`,
        sourceId: element.id,
        targetId: element.metadata.architectureRootId,
        ownerId: element.id,
        kind: "architectureRepresentation",
        label: "represented by"
      });
    }
    return result;
  });
}

export function contextConnectionsForElement(project: Pick<Project, "elements">, element: ModelElement) {
  return contextConnections(project).filter((connection) => connection.sourceId === element.id || connection.targetId === element.id);
}
