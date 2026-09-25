# Post-fix V01 acceptance results

Date: 2026-08-15

Release: 1.5.3

Persistence schema: 9

## Requested scope

| Area | Result | Evidence |
| --- | --- | --- |
| Domain-separated architecture workflow | Pass | Architecture scopes expose product functions/product architecture as Solution Space step 1 and industrial-system functions/architecture as step 2; Trade Study exposes all four details in its first Solution Space step. |
| Industrial resource allocation | Pass | Canonical resource assignments originate at industrial-system components; cost, demand, utilization, validation, and coverage follow the inverse process-function realization chain. Legacy process-function assignments normalize to their realizing components on load. |
| Coffee-machine sample semantics | Pass | Product functions are realized by product technical components; manufacturing process functions are realized by industrial equipment; explicit product-component consumes/produces handoffs validate without errors. |
| Save Project / Load Project | Pass | First-class frame actions open the Delivery Save/Load panel; complete versioned project packages reuse the validated importer, collision handling, replacement safety snapshot, and rollback paths. |
| Expandable workflow navigation | Pass | Problem Space and Solution Space expose progress counts, expand/collapse controls, and direct exact-activity links. |
| Responsive implementation | Pass at source and automated-regression level | Desktop-only minimum width removed; dense workspace grids collapse at laptop/tablet/phone breakpoints; targeted application tests pass. |
| Documentation consistency | Pass | README, changelog, post-fix list, version metadata, schema-9 persistence description, and this acceptance record agree. |

## Responsive and browser matrix

| Representative target | Viewport | Implemented behavior | Verification available here |
| --- | ---: | --- | --- |
| Desktop Chrome | 1440 × 900 | Full 288 px workflow sidebar; multi-column workspaces | Responsive classes and production CSS compilation verified |
| ChromeOS/laptop representative | 1280 × 800 | Full workflow sidebar; dense grids collapse before overflow | Responsive classes and production CSS compilation verified |
| Tablet | 768 × 1024 | 64 px icon rail; dense grids collapse to one/two columns | Responsive classes and application navigation regressions verified |
| Phone | 390 × 844 | Drawer navigation; single-column workspace layout | 320 px global minimum and responsive classes verified |

The managed test workspace rejected Vite's local port binding before launch. The selected cloud Chrome browser also rejected local-file navigation under its URL security policy. Consequently, no live-pixel or real-device browser pass is claimed in this record. Run the manual matrix above from GitHub Codespaces or a local checkout before a production release requiring certified browser coverage.

## Automated verification

| Command | Result |
| --- | --- |
| `npm ci --cache /tmp/mbse-npm-cache --prefer-offline` | Pass; 332 packages installed from the exact lockfile |
| `npm audit --cache /tmp/mbse-npm-cache` | Pass; 0 vulnerabilities |
| `npm run typecheck` | Pass; strict TypeScript build check |
| `vitest run src/test/workflowSimplification.test.ts src/test/reworkFix.test.tsx src/test/stageB.test.ts --reporter=dot` | Pass; 50 focused tests |
| `vitest run --reporter=dot` | Pass; 158 tests in 9 files |
| `npm run build` | Pass; Vite 6.4.3 transformed 2,130 modules and emitted the production bundle without an advisory |

## Preserved architecture and deferred items

- Project schema remains 9; no new entity type, relationship type, or persisted-ID rewrite was introduced.
- Existing semantic ELK graph layout, measured nodes, directional ports, routing, and progressive-disclosure controls are preserved.
- The established measured Vite manual-chunk architecture is preserved; no route or bundle-boundary rewrite was introduced.
