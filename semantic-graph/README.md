# Semantic ontology V04

This implementation adds a read-only semantic projection over the schema-14 Project. It does not replace or modify requirement assessment, configuration validation, Variation Point application, derivation, simulation, comparison, governance, persistence or native exports.

## Open the new views

In Modeler, open **Scope ontology** for the project-independent generic workflow map. The page shows generic stereotypes and Semantic relationships, with filters for Architecture building, Architecture building + simulation and Trade Study. It does not show Project Digital Thread, Ontology Schema or Stored schema graph/register controls.

- **Project digital thread** remains an internal projection capability but is not exposed on Scope Ontology.
- **Registry schema** remains available to internal adapters and tests but is not exposed on Scope Ontology.
- **Read-only matrix** adds the semantic matrix in the new explorer and beside the existing editable matrix.
- **Trade Study preview** adds a control in the current Trade Study workspace.
- **Architect preview** adds a toggle beside the existing progressive graph, using exactly its revealed element IDs.
- **Modeler trace inspector** adds a read-only saved-model inspector inside Element details.
- **Semantic JSON export** enables a separate export in Selective Export and for the selected context in Scope ontology.
- **Background diagnostics** exposes the headless result without replacing the existing graph.

The Scope Ontology page intentionally provides no source-view selector or Semantic view controls. Other optional semantic consumers can still be configured with a comma-separated `VITE_SEMANTIC_GRAPH_FLAGS` value using the exact keys in `src/features/semanticGraphFlags.ts`.

## Architecture

The registry references the existing allowed relationship triples. Pure adapters project domain records, typed references and frozen evidence. Builder output contains deterministic nodes/edges, authoritative locators, semantic roles, diagnostics and a fingerprint. Traversal and export consume that projection. New UI consumers have local failure boundaries.

A Run's historical context uses its frozen input snapshot. A Decision's context uses its captured evidence. An Architecture is a design identity; a Realization is a derived state. Baseline remains Architecture state, checked against the Project baseline ID. No projected edge is written to `project.relationships`.

## Verification

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run test:semantic-performance
node scripts/audit-semantic-graph.mjs
```

The audit produces `IMPLEMENTED_REGISTER.md` and `COFFEE_OHSC_PARITY.json`. The source-isolation test compares every pre-existing domain, store and sample module against the Git blob hashes of V03. The semantic tests cover identity collisions, source-array permutation, frozen input, provenance, partial failure, snapshot priority, navigation and serialization. Existing regression tests are unchanged.

Browser acceptance used Chromium 153 with Playwright at 1440, 768 and 390 px. The reproducible browser harness is `verification/browser-semantic.mjs`; it needs Playwright and a compatible Chromium binary supplied by the environment. No browser dependency is bundled with the application.

See the root `ACCEPTANCE_RESULTS_SEMANTIC_GRAPH.md` for measured results and rollout decisions; see `INTENTIONAL_CORRECTIONS.md` for clarifications relative to the six preserved specifications.
