# Architect / Modeler parity and consolidation audit

## Baseline

- Repository: `nicolagar/mbse-mbple-workbench`
- Branch: `03_Architect_view_v01`
- Audited source commit: `a6661f4b604ec8333d41d10a91f682d6601eb27f`
- Remote tree: 134/134 blobs reconstructed and verified by Git blob SHA before edits
- Baseline verification: `npm ci` PASS; 194/194 tests PASS when run without competing build load; typecheck PASS; build PASS

## Categorized findings

| ID | Category | Finding | Resolution |
|---|---|---|---|
| PC-001 | Defect | A browser with no persisted state instantiated the coffee-machine sample even though the established startup rule requires one empty active project. | Fixed. Clean initial state now contains one empty project and no snapshots. |
| PC-002 | Inconsistency | Modeler exposed project duplication but Architect did not. | Fixed. Architect now uses the same canonical `duplicateProject` store action. |
| PC-003 | Defect | Architect progress used a fixed 69 px sticky offset although its header is allowed to wrap. | Fixed. A `ResizeObserver`-measured header height drives the desktop sticky offset; a resize fallback is retained. |
| PC-004 | Inconsistency | Visible scope and workflow labels mixed `Trade study` and `Trade Study`. | Fixed. User-visible labels and Architect guidance now use `Trade Study`. |
| PC-005 | Deliberate perspective difference | Architect Save/Load opens Modeler's complete delivery workspace. | Retained. Both actions preserve the active project and canonical data while avoiding a duplicate import/export implementation. |
| PC-006 | Deliberate perspective difference | Architect presents guided questions; Modeler exposes detailed editors, matrices, formulas and analysis workspaces. | Retained. Both operate on the same project and Zustand store. |

An apparent duplicate Dashboard status badge seen in aggregated command output was rejected after direct line-level source inspection; no unnecessary code change was made.

## Parity evidence

| Area | Result | Evidence |
|---|---|---|
| Empty project and project lifecycle | PASS | Clean first-launch state, create, switch, duplicate, delete, Load sample model and Reset all use canonical store actions. |
| Architecture definition scope | PASS | Architect Phase-1 tests cover question ordering, canonical mission/stakeholder links, requirements, functions, components, processes, resources and verification. |
| Architecture + simulation scope | PASS | Phase-2 tests cover scope branching, KPI creation, formula references, inputs, immutable runs and staleness. |
| Trade Study scope | PASS | Phase-3/4 and methodology tests cover framing, variability, configurations, 100% derivation, comparable runs, decision approval, recap and evidence review. |
| Use-case semantic scope | PASS | `Use case —addresses→ Need/Objective` is canonical, editable through Modeler relationship tools, and narrows needs/objectives/requirements with legacy participant fallback. |
| Requirement analysis | PASS | Canonical formulas, immutable bindings and `satisfiedBy` owner links cover functions, technical components and owned parameters. |
| Persistence and perspective switching | PASS | Schema 9 persistence retains perspective and Architect session; Modeler changes mark affected guided evidence for review. |
| Complete Save/Load package | PASS | Regression test round-trips Architect answers, `addresses` relationships and requirement formulas through JSON migration/validation. |
| Variability, simulation, comparison and delivery | PASS | Existing Stage A/B/C, rework, Trade Study and workflow regressions remain authoritative and passing. |
| Responsive cloud visual inspection | CONSTRAINED | The configured cloud browser cannot reach the local Vite URL (`ERR_BLOCKED_BY_CLIENT`). Responsive behavior was inspected statically and protected through layout-class/component regression; no feature-branch deployment was made. |

## Consolidation boundaries retained

- One canonical `Project` model and one canonical Zustand store.
- Immutable derivations, simulation runs, comparison results and snapshots remain historical evidence.
- No silent recalculation or overwrite of historical records.
- No merge or deployment was performed.
- AI-assisted behavior remains outside this consolidation increment.

## Final verification

- `npm test -- --run`: PASS — 15 files, 196/196 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS — 2,133 modules transformed and production output generated.
- `git diff --check`: PASS.
- No mandatory `TODO`, `FIXME`, or `not implemented` marker was introduced.
