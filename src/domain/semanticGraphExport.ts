import { ONTOLOGY_VERSION, SOURCE_COMMIT } from "./ontologyRegistry";
import { canonicalJson } from "./semanticGraphIdentity";
import { buildSemanticGraph } from "./semanticGraph";
import type { DeepReadonly, SemanticContext } from "./semanticGraphTypes";
import type { Project } from "./types";
export function semanticGraphExport(project: DeepReadonly<Project>, context: SemanticContext = { type: "live" }): string {
  const result = buildSemanticGraph(project, { context });
  return canonicalJson({ format: "mbse-semantic-model", schemaVersion: 1, ontologyVersion: ONTOLOGY_VERSION, sourceCommit: SOURCE_COMMIT, nativeProjectSchemaVersion: project.schemaVersion, projectId: project.id, liveProjectRevisionAtExport: project.modelRevision, contexts: [context], ...result });
}
