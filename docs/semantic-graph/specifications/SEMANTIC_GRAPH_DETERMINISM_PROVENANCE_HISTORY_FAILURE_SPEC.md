# Semantic Graph Determinism, Provenance, History and Failure Specification

## Scope

This specification defines the non-negotiable runtime contract for the read-only Semantic Graph at commit `37c6270416a88186d1d9b22f4d09d5afe211e5d3`.

## Typed model

Use closed unions for node kind, predicate, role, provenance and context. Do not expose unrestricted strings in internal graph types.

```ts
type SemanticRole = "canonical" | "supporting" | "constraint" | "evidence";

type SemanticContext =
  | { type: "live" }
  | { type: "derivation"; configurationId: string; derivationId: string }
  | { type: "simulation"; simulationRunId: string }
  | { type: "decision"; decisionId: string };

type SemanticProvenance =
  | { type: "storedRelationship"; relationshipId: string; orientation: "direct" }
  | { type: "typedReference"; ownerKind: SemanticNodeKind; ownerId: string; field: string }
  | { type: "embeddedRecord"; ownerKind: SemanticNodeKind; ownerId: string; field: string; recordId: string }
  | { type: "parsedExpression"; ownerId: string; field: string; referencedIds: string[] }
  | { type: "derivedProjection"; ruleId: string; inputIds: string[] }
  | { type: "historicalSnapshot"; ownerId: string; field: string; recordId?: string };
```

Every edge must contain role, predicate, context, provenance and authoritative-source locator.

## Identity

### Encoding

Encode every segment with `encodeURIComponent`. Never concatenate unescaped domain IDs.

### Node IDs

```text
sgn:<contextKey>:<kind>:<recordKey>
```

Examples:

```text
sgn:live:productComponent:pc-01
sgn:live:parameter:pc-01%2Fp-mass
sgn:derivation%3Ader-01:realization:der-01
sgn:simulation%3Arun-01:simulationResult:run-01%2Fresult-03
sgn:live:studyCriterion:study-01%2Fcriterion-02
```

Context keys are `live`, `derivation:<id>`, `simulation:<id>`, or `decision:<id>` before encoding.

### Edge IDs

```text
sge:<contextKey>:<predicate>:<sourceNodeId>:<targetNodeId>:<authorityKey>
```

`authorityKey` is the stored relationship ID, owner/field/index key, expression-reference key or deterministic projection rule key. Two independent authoritative facts between the same nodes remain two edges.

### Deterministic ordering

Return nodes sorted by context rank, domain rank, kind, record ID and semantic ID. Return edges sorted by context rank, role rank, predicate, source, target and authority key. Never depend on input-array order for graph output.

No graph ID may use random UUID, timestamp, array index alone or React render order.

## Immutability

`buildSemanticGraph()` must accept readonly input, use no store actions and produce no writes. Tests deep-freeze Project and assert byte-identical serialization before/after build, traversal and rendering.

Opening, filtering, zooming, selecting or expanding the graph must not change `Project.modelRevision`, Project timestamps, autosave state, derivation staleness or simulation staleness.

## Context construction

### Live

Use current Project records. Do not mix historical snapshots into live nodes.

### Derivation

Use `DerivationResult.realizedElements`, `realizedRelationships`, applied variations and its own source IDs. If legacy derivation lacks realized arrays, reconstruct only from its frozen source arrays plus included/preserved IDs. Never use current Project content to change historical topology.

### Simulation

Use `SimulationRun.inputSnapshot.realizedElements`, `realizedRelationships`, KPI definitions, applied variations and parameter values. Use the run's embedded Results. Current live records may supply a display label only when frozen data lacks it, marked `currentDisplayFallback`.

### Decision

Prefer `Decision.evidenceSnapshot`. Project only the studies/runs/derivations identified in that snapshot or Decision support arrays. Do not substitute newer comparison results or runs.

### Historical resolution status

Each historical node declares `resolution: frozen | currentDisplayFallback | unresolved`. Fallback labels must be visually marked. An unresolved ID becomes an `unresolvedReference` node only in diagnostics/full view, never a fabricated domain node.

## Relationship-record targeting

Do not reify every stored Relationship as a normal graph node. Semantic edges projected from stored relationships include `relationshipId`. Variation Points and Realizations refer to affected semantic edge IDs through metadata. A relationship detail inspector may render a transient Relationship Record view without adding it to normal traversal.

## Duplicate and collision rules

- Duplicate semantic IDs are errors and retain the first deterministically.
- Exact duplicate authoritative projections are reduced to one edge with all duplicate authority locators recorded.
- Parallel facts with different relationship IDs remain parallel edges.
- Cross-context edges are prohibited except explicit `historicalEvidenceFor` links created by decision-context adapters.
- Missing endpoints never create dangling edges.

## Build result and failure containment

```ts
interface SemanticGraphBuildResult {
  graph: SemanticGraph;
  diagnostics: SemanticDiagnostic[];
  completeness: "complete" | "partial";
  sourceFingerprint: string;
}
```

Recoverable data defects return a partial graph. The builder throws only for programming-contract violations such as an unregistered predicate emitted by an adapter.

Diagnostic families:

- `SG-REF-*` missing/ambiguous references;
- `SG-ID-*` identity collisions;
- `SG-PRED-*` invalid endpoints or unregistered predicate;
- `SG-CTX-*` context mixing or unavailable frozen data;
- `SG-CONT-*` canonical continuity gap;
- `SG-BASE-*` baseline/Decision inconsistency;
- `SG-BUILD-*` adapter failure;
- `SG-PARITY-*` legacy/new-view mismatch.

Diagnostics are non-blocking in release 1 and never enter `Project.validationResults` automatically.

## Adapter isolation

Each adapter catches record-level errors and reports them with the record locator. One adapter failure must not suppress successful output from other adapters. The top-level builder invokes adapters in a fixed order and merges deterministic results.

## Fingerprinting and caching

Do not persist a semantic cache and do not bump schema 14.

Release 1 should use per-render memoization from immutable selector inputs. If a reusable cache is necessary, its fingerprint must include Project ID, modelRevision, baseline/active architecture IDs, configuration derivation IDs, Simulation Run IDs/timestamps, Study result IDs/timestamps/settingsUpdatedAt, Decision IDs/updatedAt/evidence capture times, and ontology version. `modelRevision` alone is insufficient.

## UI failure behaviour

- Wrap every new Semantic Graph consumer in `SemanticGraphErrorBoundary`.
- On failure show a concise diagnostic and a button to open the preserved legacy view.
- Never replace the entire App or recovery route with a graph error.
- Preserve navigation and all operational workspaces.
- Never autosave diagnostic or layout state into Project.

## Determinism tests

Mandatory tests cover repeated deep equality, input non-mutation, stable IDs after reload, source-array permutation, embedded-ID collisions, parallel stored edges, expression parsing order, live/historical separation, unresolved references, partial adapter failure, and serialization byte equality.

## Performance contract

Measure in CI and browser acceptance. Initial targets: canonical projection under 75 ms for 500 nodes/1,500 edges; full projection under 250 ms for 2,000 nodes/6,000 edges; no synchronous infinite layout; historical contexts loaded on demand. Label expansion must never recalculate node positions or connector routes.
