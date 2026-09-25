import type { Project, ProjectSnapshot } from "./types";

export const SNAPSHOT_LIMIT = 20;

function serializableProject(project: Project): Project {
  const copy = structuredClone(project) as Project & { snapshots?: unknown };
  delete copy.snapshots;
  return copy;
}

export function createProjectSnapshot(
  project: Project,
  name: string,
  note = "",
  now = new Date()
): ProjectSnapshot {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Snapshot name is required.");
  const copy = serializableProject(project);
  const projectData = JSON.stringify(copy);
  JSON.parse(projectData);
  return {
    id: `snapshot-${crypto.randomUUID()}`,
    sourceProjectId: project.id,
    name: trimmed,
    note: note.trim() || undefined,
    projectName: project.name,
    createdAt: now.toISOString(),
    schemaVersion: project.schemaVersion,
    projectData
  };
}

export function parseSnapshotProject(
  snapshot: ProjectSnapshot,
  migrate: (value: unknown) => Project
): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot.projectData);
  } catch {
    throw new Error("PMC-011: Snapshot project data is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("PMC-011: Snapshot project data is incomplete.");
  if ("snapshots" in parsed) throw new Error("PMC-011: Snapshot recursively contains application snapshots.");
  try {
    return migrate(parsed);
  } catch (error) {
    throw new Error(`PMC-011: ${error instanceof Error ? error.message : "Snapshot validation failed."}`);
  }
}

export function duplicateSnapshotProject(
  snapshot: ProjectSnapshot,
  existingNames: string[],
  migrate: (value: unknown) => Project,
  now = new Date()
): Project {
  const project = parseSnapshotProject(snapshot, migrate);
  const base = `${project.name} — Snapshot Copy`;
  let name = base;
  let suffix = 2;
  while (existingNames.includes(name)) name = `${base} ${suffix++}`;
  return {
    ...structuredClone(project),
    id: `project-${crypto.randomUUID()}`,
    name,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export function sourceProjectSnapshots(snapshots: ProjectSnapshot[], projectId: string): ProjectSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.sourceProjectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

