# MBSE–MBPLE Workbench: Semantic-Projection Implementation Plan

## Execution baseline

Implement against `04_updated_ontology_v03` commit `37c6270416a88186d1d9b22f4d09d5afe211e5d3`. If HEAD differs, stop and refresh the inventory. Do not merge, rebase, change branch or push unless separately authorised.

Mandatory inputs are the updated architecture plus the current-code inventory, mapping register, deterministic/history/failure specification and feature-flag rollout. The commit-tied contracts take precedence over older generic wording.

## Non-negotiable constraints

1. Keep one Project model and one Zustand store.
2. Do not change schema 14 or persisted shapes in release 1.
3. Do not make operational engines consume the Semantic Graph.
4. Do not change native import/export or snapshots.
5. Do not persist projected edges.
6. Do not create a Baseline node.
7. Represent `DerivationResult` as Realization; do not conflate it with Architecture.
8. Keep current pages and legacy ontology implementations reachable until parity.
9. All rollout flags default off outside test/development opt-in.
10. Viewing the graph must not autosave or change modelRevision/timestamps.
11. Semantic diagnostics are non-blocking and separate from Project validation.
12. Fix failures within the gate; never weaken existing tests.

## Gate 0 — reproduce and freeze baseline

1. Check out the pinned commit.
2. Run `npm install`, typecheck, all tests and build.
3. Record pre-existing failures separately.
4. Serialize Coffee and OHSC Projects as golden fixtures.
5. Capture requirement assessments, configuration validation, derivations, KPIs, runs, studies, Decisions, baseline, snapshots and native exports.
6. Capture current Scope Ontology and Trade Study ontology node/edge sets.
7. Start `internal/ACCEPTANCE_RESULTS_SEMANTIC_GRAPH.md`.

Gate: clean or explicitly documented baseline before implementation.

## Gate 1 — semantic contract in code

Create `ontologyRegistry.ts`, `semanticGraphTypes.ts` and `semanticGraphIdentity.ts`. Implement closed unions and deterministic IDs. Register every stored/projected predicate. Add compile-time exhaustiveness checks against `relationshipTypes` and `allowedRelationships`.

Tests: full predicate/triple coverage, endpoint validity, ID escaping/collision and deterministic sorting.

## Gate 2 — headless live adapters

Create model, Parameter, architecture and variability adapters. Project stored relationships with their IDs/attributes; Parameters/formula bindings; architecture membership; virtual Feature Model; Feature hierarchy, Groups, Axes and constraints; VP activators/targets.

Use the existing safe feature parser. Do not alter Relationship validation. VP relationship targets reference semantic-edge IDs through metadata rather than becoming normal nodes.

Tests: every relationship once, parallel edges preserved, common/specific filtering, stable Parameter IDs, constraint roles, compound VP expressions, partial diagnostics and zero input mutation.

## Gate 3 — Realization and historical evidence

Create Realization, evidence and history adapters. Project Configuration selections and embedded Derivation as Realization. Build Simulation contexts from frozen snapshots and embedded Results.

Do not change derivation, VP, simulation, pre-sizing or requirement-assessment engines.

Tests: stale/current Derivations distinct; snapshot truth preferred; live rename/delete cannot rewrite history; legacy fallback deterministic; simulation/KPI fixtures identical.

## Gate 4 — Study, Decision and baseline

Create Trade Study and Decision adapters. Project Studies, real embedded Criteria, Candidates, Alternatives, Results, Risks and Decision evidence. Implement scoped alternative resolution. Mark baseline only when Project/status invariant agrees.

Tests: duplicate labels remain ambiguous; ID precedes label; Decision snapshot beats current result; no Baseline node; selection edges only with coherent evidence; comparison/Decision fixtures identical.

## Gate 5 — builder, traversal and diagnostics

Create `semanticGraph.ts`, `semanticGraphTraversal.ts` and `semanticGraphValidation.ts`. Builder returns graph, diagnostics, completeness and fingerprint. Add lookup, neighbours, upstream/downstream, canonical paths, evidence and provenance explanation.

Canonical continuity uses registered path templates and permits valid alternatives such as Requirement→Component and formula→Parameter evidence; it is not inferred from visual lane order.

Tests: repeated equality, source permutation, no dangling edges, context isolation, partial adapter failure, registered predicates, Coffee/OHSC reachability and performance budget.

## Gate 6 — flags and shadow parity

Create `semanticGraphFlags.ts` outside domain persistence. Default all production flags false. In shadow tests compare new output with `scopeOntology.ts`, `deriveTradeStudyOntology()`, Project relationships, context references and Coffee/OHSC threads.

Classify every difference. Expected corrections include explicit Realization and removal of the Baseline node. No unexplained difference passes.

## Gate 7 — additive Project Digital Thread beta

Add `SemanticGraphErrorBoundary`, graph view, node, routed edge, toolbar and trace inspector. Add a flagged Project Digital Thread beta tab to `ScopeOntologyWorkspace`; do not replace existing Graph/Register.

Default to canonical live view. Supporting/constraint/evidence and historical contexts are optional. Preserve orthogonal routing, distinct ports, fixed geometry on label expansion, zoom, pan, search, focus, inspector and responsive behaviour.

Tests: feature-off DOM/navigation parity; beta additive only; failure returns to legacy view; accessibility; Chromebook/narrow layout; Project bytes unchanged.

## Gate 8 — registry-driven Schema beta

Add a flagged Schema beta generated from the registry. Preserve `scopeOntology.ts` and current tests. Compare all connections and document corrections for incomplete VP targets, semantic roles and Decision resolution.

## Gate 9 — Trade Study parallel adoption

Add a semantic-beta toggle inside `TradeStudyOntologyView`. Preserve `deriveTradeStudyOntology()` and the legacy view. Compare scope, Criteria, Features, Configurations, Architectures, Realizations, Runs, KPI evidence, Decisions and baseline state. Switch default only after parity.

## Gate 10 — read-only matrix and inspectors

Add a separate read-only Digital Thread matrix and Modeler semantic inspector. Do not change the editable Traceability Matrix, Relationship Manager or ModelGraph editing. Derived/typed edges have no create/delete controls.

## Gate 11 — Architect View parallel graph

Behind a separate flag, render the Semantic Graph alongside the current progressive ModelGraph. Reuse the existing question visibility set only as a filter. The graph does not author content or control progression.

Prove identical question order, answers, generated IDs, skip behaviour, completion and navigation before any default change.

## Gate 12 — semantic export

Create `semanticGraphExport.ts` and a separate Semantic Model/Digital Thread JSON action. Include ontology version, source commit, schema, Project ID/revision, contexts, nodes, edges, provenance and diagnostics.

Do not modify native JSON, XLSX/PDF or import. Semantic export is initially export-only.

## Gate 13 — regression and activation

Run all existing tests, typecheck/build, migrations 1–14, persistence/recovery/import/export, requirements, configuration/VP/derivation, KPI/simulation, Trade Study/Decision/baseline, all semantic tests, Coffee/OHSC end-to-end, target browser/narrow-screen and keyboard/accessibility checks.

Operational outputs must equal Gate-0 fixtures. Opening all new views must leave serialized Project bytes unchanged.

## Gate 14 — controlled consolidation

Enable flags individually only after their gate passes. Keep one-action access to legacy views. Remove legacy projection/static duplication only after all affected views pass parity and an explicit cleanup decision is made. Cleanup is not required for release-1 acceptance.

## Required deliverables

- typed registry, graph, adapters, traversal, diagnostics and tests;
- feature flags and fallbacks;
- additive beta views;
- semantic export;
- README/CHANGELOG updates;
- `internal/ACCEPTANCE_RESULTS_SEMANTIC_GRAPH.md`;
- register-conformance report;
- Coffee/OHSC before/after comparison;
- intentional-corrections list;
- no mandatory TODO/FIXME/placeholder.

## Stop conditions

Stop rather than guess if HEAD differs, current code contradicts the mapping register, baseline tests fail unexpectedly, a reference cannot be resolved safely, schema changes appear necessary, a graph dependency enters an operational engine, or a current page would need removal before parity.

## Final acceptance

The implementation succeeds only when the Semantic Graph explains the same Project and immutable evidence more coherently while the Workbench continues to calculate, derive, simulate, compare, decide, persist, recover and export exactly as before.
