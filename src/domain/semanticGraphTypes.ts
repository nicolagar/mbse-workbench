import type { SemanticDomain, SemanticNodeKind, SemanticPredicate, SemanticRole } from "./ontologyRegistry";
export type { SemanticDomain, SemanticNodeKind, SemanticPredicate, SemanticRole } from "./ontologyRegistry";
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type SemanticContext = { type: "live" } | { type: "derivation"; configurationId: string; derivationId: string } | { type: "simulation"; simulationRunId: string } | { type: "decision"; decisionId: string };
export type SemanticProvenance =
  | { type: "storedRelationship"; relationshipId: string; orientation: "direct" }
  | { type: "typedReference"; ownerId: string; field: string }
  | { type: "embeddedRecord"; ownerId: string; field: string; recordId: string }
  | { type: "parsedExpression"; ownerId: string; field: string; referencedIds: readonly string[] }
  | { type: "derivedProjection"; ruleId: string; inputIds: readonly string[] }
  | { type: "historicalSnapshot"; ownerId: string; field: string; recordId?: string };
export interface SemanticSource { readonly projectId: string; readonly context: SemanticContext; readonly locator: string }
export interface SemanticNode {
  readonly id: string; readonly recordId: string; readonly ownerId?: string; readonly kind: SemanticNodeKind;
  readonly label: string; readonly domain: SemanticDomain; readonly description: string;
  readonly context: SemanticContext; readonly resolution: "live" | "frozen" | "currentDisplayFallback" | "unresolved";
  readonly lifecycleState?: string; readonly source: SemanticSource;
  readonly attributes: Readonly<Record<string, unknown>>;
}
export interface SemanticEdge {
  readonly id: string; readonly source: string; readonly target: string; readonly predicate: SemanticPredicate;
  readonly role: SemanticRole; readonly context: SemanticContext; readonly direction: "sourceToTarget";
  readonly provenance: SemanticProvenance; readonly authoritativeSource: SemanticSource;
  readonly attributes: Readonly<Record<string, unknown>>;
}
export interface SemanticDiagnostic { readonly code: string; readonly message: string; readonly locator: string; readonly severity: "warning" | "information" }
export interface SemanticGraph { readonly nodes: readonly SemanticNode[]; readonly edges: readonly SemanticEdge[]; readonly context: SemanticContext }
export interface SemanticGraphBuildResult { readonly graph: SemanticGraph; readonly diagnostics: readonly SemanticDiagnostic[]; readonly completeness: "complete" | "partial"; readonly sourceFingerprint: string }
