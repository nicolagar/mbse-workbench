# Feature-Flagged Parallel Rollout

## Objective

Introduce the Semantic Graph without removing, redirecting or mutating any current page until parity is demonstrated.

## Flag design

Use compile-time/runtime UI flags outside Project persistence:

```ts
interface SemanticGraphFlags {
  buildInShadow: boolean;
  showProjectDigitalThreadTab: boolean;
  useRegistryForSchemaView: boolean;
  useSemanticTradeStudyView: boolean;
  showSemanticMatrix: boolean;
  showArchitectSemanticGraph: boolean;
  showModelerSemanticInspector: boolean;
  enableSemanticExport: boolean;
}
```

Default all flags false in the first code integration except test environments. Do not add them to schema-14 Project. A developer-only environment/config module is sufficient; UI opt-in may use non-domain local preferences only after the shadow build is stable.

## Preserved legacy surfaces

The following remain mounted and reachable until their individual parity gate passes:

- current `ScopeOntologyWorkspace` schema graph and register;
- current Model Graph and editable Traceability Matrix;
- current Architect View graph;
- current Trade Study Digital Thread and `deriveTradeStudyOntology()`;
- all native exports;
- every operational workspace and recovery page.

## Rollout stages

### R0 — baseline lock

At the pinned commit, run install, typecheck, all Vitest tests and build. Capture Coffee/OHSC serialized Projects and results. Record failures before any semantic change.

### R1 — headless graph

Add registry, graph types, adapters, traversal and diagnostics only. No route, component or store action changes. Test pure graph output.

### R2 — shadow comparison

With `buildInShadow`, build the graph in tests/development but do not render it. Compare:

- schema register coverage against `scopeOntologyConnections`;
- Trade Study subgraph records against `deriveTradeStudyOntology()`;
- ModelElement relationship counts against the Project;
- Coffee/OHSC canonical reachability.

Differences must be classified as intended correction, legacy defect or new defect.

### R3 — additive Project Digital Thread

Add a new tab inside Scope Ontology while leaving existing Graph/Register unchanged. On error, fall back to the legacy Schema tab. Default remains the legacy tab until acceptance passes.

### R4 — registry-driven schema

Generate a parallel Ontology Schema beta view from the registry. Do not delete `scopeOntology.ts`. Prove node/predicate coverage and preserve routing, ports, label toggles, zoom, search, focus and responsive behaviour.

### R5 — Trade Study parity

Add a semantic-beta toggle within the existing Trade Study Digital Thread. Compare nodes, evidence links and selection behaviour. Switch the default only after automated and manual parity. Keep legacy implementation for one release/branch milestone.

### R6 — read-only matrix and inspectors

Add a read-only Digital Thread matrix beside the existing editable Engineering matrix. Add the Modeler inspector. No derived edge is editable.

### R7 — Architect View

Add a semantic graph panel alongside the existing progressive ModelGraph. Preserve all question/reveal/authoring logic. Only after equivalent reveal and navigation acceptance may the new panel become default.

### R8 — semantic export

Add a separate export action. Do not alter native JSON/XLSX/PDF output or import.

### R9 — consolidation

Remove legacy projection code only after all flags have been enabled and accepted, all saved-project regressions pass, and a rollback checkpoint exists. Static schema data may remain as a compatibility fixture until the next deliberate cleanup.

## Parity gates

Each consumer requires:

- no lost nodes or authoritative connections;
- documented differences for intentional ontology corrections;
- no Project mutation on view;
- no change to store actions;
- identical requirement/configuration/derivation/simulation/comparison/Decision outputs;
- preserved keyboard and narrow-screen behaviour;
- recoverable partial graph on malformed references;
- existing legacy view reachable with one action.

## Rollback

Rollback is flag-only. No persisted data must require downgrade. If any beta view fails, disable its flag and retain the new headless modules/tests for correction. Because schema 14 is unchanged, old and new builds read the same projects.

## Acceptance evidence

Create `internal/ACCEPTANCE_RESULTS_SEMANTIC_GRAPH.md` with baseline commit, flag matrix, automated results, Coffee/OHSC parity, intentional differences, browser checks, persistence byte checks and final go/no-go decision.
