import type { ModelElement, Project } from "./types";

const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const stableToken = (value: string) =>
  Array.from(value).map((character) => character.codePointAt(0)!.toString(16)).join("-");

export function objectiveElements(project: Pick<Project, "elements">): ModelElement[] {
  return project.elements.filter((element) => element.elementType === "objective");
}

export function objectiveProjection(project: Pick<Project, "elements">): string[] {
  return objectiveElements(project).map((element) => element.name);
}

export function migrateObjectiveElements(
  elements: ModelElement[],
  legacyObjectives: unknown,
  timestamp: string
): ModelElement[] {
  const migrated = structuredClone(elements);
  const authoritativeNames = new Set(
    objectiveElements({ elements: migrated }).map((element) => normalizedName(element.name))
  );
  const usedIds = new Set(migrated.map((element) => element.id));
  const strings = Array.isArray(legacyObjectives)
    ? legacyObjectives.filter((value): value is string => typeof value === "string")
    : [];

  strings.forEach((value) => {
    const name = value.trim().replace(/\s+/g, " ");
    const normalized = normalizedName(name);
    if (!name || authoritativeNames.has(normalized)) return;
    const baseId = `objective-migrated-${stableToken(normalized)}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    authoritativeNames.add(normalized);
    migrated.push({
      id,
      elementType: "objective",
      name,
      description: "Migrated from the legacy project objective compatibility field.",
      status: "reviewed",
      architectureScope: "common",
      parameters: [],
      customAttributeValues: {},
      tags: ["objective", "migration"],
      metadata: {
        source: "Schema-6 objective migration",
        owner: "Systems Engineering"
      },
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });
  return migrated;
}

export function withObjectiveProjection(project: Project): Project {
  return {
    ...project,
    objectives: objectiveProjection(project)
  };
}

export function replaceObjectiveElements(
  project: Project,
  names: string[],
  timestamp: string
): Project {
  const existing = objectiveElements(project);
  const requested = names
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name, index, values) =>
      Boolean(name) && values.findIndex((candidate) => normalizedName(candidate) === normalizedName(name)) === index
    );
  const retained = project.elements.filter((element) => element.elementType !== "objective");
  const usedIds = new Set(retained.map((element) => element.id));
  const nextObjectives = requested.map((name) => {
    const match = existing.find((element) => normalizedName(element.name) === normalizedName(name));
    if (match) {
      usedIds.add(match.id);
      return { ...match, name, updatedAt: match.name === name ? match.updatedAt : timestamp };
    }
    const baseId = `objective-${stableToken(normalizedName(name))}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    return {
      id,
      elementType: "objective" as const,
      name,
      description: "",
      status: "draft" as const,
      architectureScope: "common" as const,
      parameters: [],
      customAttributeValues: {},
      tags: ["objective"],
      metadata: { source: "Dashboard", owner: "Systems Engineering" },
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });
  return withObjectiveProjection({
    ...project,
    elements: [...retained, ...nextObjectives]
  });
}
