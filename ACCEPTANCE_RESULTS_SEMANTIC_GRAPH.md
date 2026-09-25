# Semantic ontology V04 acceptance

## Source and scope

- Repository: `nicolagar/mbse-mbple-workbench`.
- Source branch: `04_updated_ontology_v03`.
- Source commit: `37c6270416a88186d1d9b22f4d09d5afe211e5d3`, verified before implementation and again before saving V04.
- Implementation branch: `04_updated_ontology_V04`.
- Application: 1.8.0; native Project schema: 14, unchanged.
- Verification runtime: Node 24.19.0, npm 11.9.0, Chromium 153.0.8010.0.

The six implementation inputs are retained in `docs/semantic-graph/specifications/`. Clarifications discovered during implementation are documented in `docs/semantic-graph/INTENTIONAL_CORRECTIONS.md`.

## Automated results

| Gate | Result |
|---|---|
| V03 dependency install | Passed with the existing lockfile |
| V03 regression baseline | 254 tests passed in 21 files |
| V03 production build | Passed |
| V04 regression suite | 288 tests passed in 25 files |
| V04 typecheck | Passed |
| V04 production build | Passed |
| Projection performance: 500 nodes / 1,500 edges | Passed; median 51 ms against 75 ms budget |
| Projection performance: 2,000 nodes / 6,000 edges | Passed; median 203 ms against 250 ms budget |
| Existing operational source isolation | All 45 pre-existing domain, store and sample modules match their V03 Git blob hashes |
| Existing operational tests | Retained; ontology-view assertions updated for the new default |
| Source whitespace check | Passed |

Performance numbers are local measurements, not a guarantee for every device. Run `npm run test:semantic-performance` separately from the regression suite. The timing thresholds have not been relaxed. `@types/node` is the only added development dependency; application runtime dependencies are unchanged.

## Coffee and OHSC parity

The reproducible audit captures Project and operational-output SHA-256 hashes before and after all available semantic contexts are built. Operational outputs include requirement assessments, configuration validation, complete derivation/run/study/Decision records, baseline identity, and native export with the same explicit export time.

| Example | Contexts verified | Live nodes | Live edges | Projection diagnostics | Project/output equality |
|---|---:|---:|---:|---:|---|
| Coffee | 8: live, 3 derivations, 3 simulations, 1 Decision | 126 | 333 | 0 across all contexts | Exact |
| OHSC | 11: live, 4 derivations, 4 simulations, 2 Decisions | 334 | 1,447 | 0 across all contexts | Exact |

Full hashes and per-context counts are in `docs/semantic-graph/COFFEE_OHSC_PARITY.json`. Frozen derivation KPI nodes expose captured values without claiming that KPI definitions or units were captured. Every legacy Trade Study record remains represented; the duplicate legacy Baseline node maps to the existing Architecture identity in the semantic view.

Mission-to-baseline navigability is tested with canonical, supporting and evidence links and inverse navigation. Stored directions are tested independently for every Project relationship. This does not claim a strictly forward canonical-only path, or use graph reachability to approve a baseline.

## Browser and interaction results

Passed in local Chromium at desktop 1440 px, tablet 768 px and narrow 390 px:

- Scope Ontology opens on a project-independent generic stereotype map; it never substitutes current project record names.
- Architecture building, Architecture building + simulation and Trade Study filters progressively expose 18, 21 and 34 stereotypes.
- System Requirement exposes exactly five direct engineering targets. Architecture exposes exactly seven direct engineering-content targets.
- Trade Study connects to Variability Axis through `exploresAxis`; Feature Model, Risk, Validation Finding and Unresolved Reference are absent from this guidance graph.
- Every visible edge uses the same Semantic relationship style. Orthogonal routes do not enter unrelated nodes or share connector segments.
- Project Digital Thread, Ontology Schema and Stored schema graph/register controls are absent from the Scope Ontology page.
- Connector expansion preserves node transforms and connector paths.
- Connector controls are placed separately; labels use predetermined non-overlapping callouts.
- Layout ordering starts with Mission and follows semantic levels instead of label alphabetization.
- Narrow layouts wrap toolbars and workflow controls, with scrolling contained in the graph/table.
- Historical semantic JSON downloads with the selected simulation context.
- The current simplified Trade Study workspace opens and closes its semantic preview.
- Architect preview opens and returns to the existing progressive graph.
- Modeler trace inspection is accessible inside the existing Element details panel.
- No browser page errors were observed. Serialized Project data remained identical across the checked interactions.

`docs/semantic-graph/BROWSER_RESULTS.json` records the run. Screenshots are in `docs/semantic-graph/screenshots/`. `verification/browser-semantic.mjs` is the reproducible harness; set `SEMANTIC_PLAYWRIGHT_MODULE`, `SEMANTIC_CHROMIUM_EXECUTABLE_PATH` and optionally `SEMANTIC_BROWSER_OUTPUT` when the browser runtime is provided outside the repository. No authenticated browser session is required.

## Rollout matrix

| Flag | Code and automated checks | Production default |
|---|---|---|
| `buildInShadow` | Implemented | Off |
| `showProjectDigitalThreadTab` | Projection retained internally; not exposed on Scope Ontology | Not applicable |
| `useRegistryForSchemaView` | Registry retained internally; not exposed on Scope Ontology | Not applicable |
| `useSemanticTradeStudyView` | Implemented on current and legacy consumers; current route browser checked | Off |
| `showSemanticMatrix` | Implemented; browser checked | Off |
| `showArchitectSemanticGraph` | Implemented; reveal filtering tested and browser checked | Off |
| `showModelerSemanticInspector` | Implemented inside Element details; browser checked | Off |
| `enableSemanticExport` | Implemented; historical download browser checked | Off |

Scope Ontology exposes only the generic workflow map and its three scope filters. Semantic projections used by the remaining optional consumers stay outside Project persistence. Recovery, authoring, validation, derivation, simulation, comparison, approval, native save/load and native exports continue through their existing implementations.

## Release decision

**Go for the V04 implementation.** Scope Ontology now exposes only the project-independent generic ontology. Project Digital Thread, Ontology Schema and Stored schema graph/register are no longer available on that page. Other semantic consumers remain opt-in. No data migration or schema change is required.
