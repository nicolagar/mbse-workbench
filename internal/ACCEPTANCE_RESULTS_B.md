# Stage B Acceptance Results

Verified on 2026-07-29 against Stage B REV04 on branch `agent/stage-b-variability-presizing`.

## Automated verification

| Check | Result | Evidence |
|---|---:|---|
| TypeScript strict typecheck | PASS | `npm run typecheck` |
| Stage-A regression and Stage-B domain/render tests | PASS | `npm test -- --run` — 83/83 tests |
| Production build | PASS | `npm run build` |
| Runtime architecture | PASS | Browser-only React/Zustand application; no backend or runtime API introduced |

Vite reports a non-blocking main-chunk size advisory. It is not a functional, correctness, security, or acceptance failure.

## Acceptance checklist

| # | Acceptance statement | Result | Evidence |
|---:|---|---:|---|
| 1 | All Stage-A behavior remains functional | PASS | All 46 prior tests remain and pass |
| 2 | Existing Stage-A projects migrate without data loss | PASS | Migration tests preserve project/element IDs and source data |
| 3 | Migration is idempotent | PASS | Schema migration test |
| 4 | Feature tree and table show the same data | PASS | One canonical `Project.features` projection |
| 5 | Create, edit, duplicate, move, reorder, delete features | PASS | Feature Model controls and store transactions |
| 6 | Hierarchy cycles prevented or detected | PASS | PMB-001 and cycle test |
| 7 | Exactly one root enforced | PASS | PMB-023 and test |
| 8 | Create requires/excludes constraints | PASS | Constraint editor |
| 9 | Self and duplicate constraints rejected | PASS | Store action validation |
| 10 | Feature deletion handles descendants and references safely | PASS | Impact summary, explicit confirmation, complete variation-point removal, PMB-115 |
| 11 | Map multiple elements/relationships with safe variation conditions | PASS | First-class variation-point editor and custom AST |
| 12 | Syntax and unknown IDs detected before save | PASS | PMB-003/004 and parser tests |
| 13 | Empty expression shown as common | PASS | Variation-point and 150% preview views |
| 14 | Manual, automatic, effective, invalid states distinguished | PASS | Configurator text and state badges |
| 15 | Root and mandatory behavior enforced | PASS | Selection engine test |
| 16 | Active XOR groups require exactly one member | PASS | PMB-006 and tests |
| 17 | Active OR groups require at least one member | PASS | PMB-007 and tests |
| 18 | Requires/excludes produce actionable messages | PASS | PMB-008/009 and tests |
| 19 | Invalid configurations cannot derive | PASS | Disabled derive control and domain guard |
| 20 | Valid configurations save and duplicate | PASS | Configurator actions |
| 21 | Derivation uses the complete canonical 150% source | PASS | Canonical-source test |
| 22 | Derivation leaves 150% source unchanged | PASS | Deep non-mutation test |
| 23 | Realized view exposes included/excluded/modified content and relationship changes | PASS | Read-only 100% realization workspace |
| 24 | Derivation retains IDs, revision, timestamp | PASS | `DerivationResult` snapshot |
| 25 | Stale derivations identified without silent recalculation | PASS | Status helper and test |
| 26 | Parameters editable in consolidated and element views | PASS | Consolidated workspace plus Stage-A element editor |
| 27 | Process duration has one authoritative source | PASS | Metadata-only duration controls |
| 28 | Resource quantity is per assignment | PASS | Relationship editor and quantity test |
| 29 | Value origin visibly distinct | PASS | Origin badges |
| 30 | Invalid range/uncertainty rejected or warned | PASS | Editor guards and PMB-103/017 |
| 31 | Formula and standard KPI CRUD | PASS | KPI workspace |
| 32 | Formula editor inserts/stores exact tokens | PASS | Exact ID formula input and stored parsed references |
| 33 | Formula preview calculates valid expressions | PASS | Preview action and formula tests |
| 34 | Missing refs, syntax, divide-by-zero, cycles detected | PASS | PMB-011–015 and tests |
| 35 | Unit incompatibility blocks calculation | PASS | PMB-016 and test |
| 36 | Standard algorithms follow specified rules | PASS | Presizing engine and tests |
| 37 | Lead time uses critical path | PASS | Parallel-branch test |
| 38 | Critical chain displayed | PASS | Simulation result detail |
| 39 | Process cycles block lead time | PASS | Cycle test and PMB-018 behavior |
| 40 | Variant simulation stores immutable realized inputs and exact KPI IDs | PASS | Snapshot/exact-ID test |
| 41 | Stale runs remain viewable and marked | PASS | History status and test |
| 42 | Results disclose inputs, method, assumptions, warnings, time, revision, disclaimer | PASS | Run detail |
| 43 | Manual and automated variants differ | PASS | Stored-input calculation test |
| 44 | Refresh retains Stage-B data | PASS | Schema-4 Zustand persistence |
| 45 | No mandatory control is a placeholder | PASS | Stage-B routes use functional workspaces |
| 46 | No mandatory TODO/FIXME remains | PASS | Repository scan |
| 47 | Install, typecheck, tests, build succeed | PASS | Lockfile retained; commands above pass |
| 48 | Legacy element expressions migrate to first-class existence variation points | PASS | Pure/idempotent migration test |
| 49 | Features support Boolean/enumerated values and external/internal scope | PASS | Schema, Feature Model, Configurator, PMB-026/027 |
| 50 | One variation point can constrain multiple elements or relationships | PASS | Canonical target arrays and editor |
| 51 | Existence, Primitive Property, Primitive Tag, and Element Property effects are supported | PASS | Realization engine and effect tests |
| 52 | Arbitrary executable variation scripts are impossible | PASS | Custom parser plus whitelisted property paths; no `eval`/`Function` |
| 53 | 150% preview is non-mutating and distinguishes common/included/excluded/modified | PASS | Preview engine and color/text legend |
| 54 | 100% realization stores immutable modified element/relationship snapshots | PASS | Deep non-mutation and modification tests |
| 55 | Realization records every applied effect and cascade cleanup warning | PASS | Applied variation audit and PMB-109/121 |
| 56 | Analysis uses realized modifications | PASS | Simulation model reads realized snapshots; automation-specific duration sample |
| 57 | Simulation creates an immutable in-memory realization when the explicit realization is missing/stale | PASS | PMB-112 behavior and snapshot test |
| 58 | Realization defaults to the entire model and supports explicit domain scope | PASS | Configurator scope controls, PMB-125, and scope test |
| 59 | Schema-3 architecture applicability migrates into canonical 150% variation points | PASS | Pure migration and ID-preservation test |
| 60 | Every configuration owns one generated, name-synchronized architecture | PASS | Schema/store ownership and lifecycle logic |
| 61 | Generated architectures expose Draft/Invalid/Configured/Realized/Stale/Archived lifecycle | PASS | Lifecycle synchronizer and UI badges |
| 62 | Recursive organizational feature groups remain nonselectable | PASS | FeatureGroup schema, graph, PMB-028–031 and cycle test |
| 63 | Constraints are integrated into Feature Model graph/table | PASS | Neutral/green/red typed graph connections |
| 64 | 150% model opens without configuration and remains editable | PASS | Graph workspace and render test |
| 65 | Multiple variation points can be added from cross-domain graph targets | PASS | Element/attribute/relationship graph actions and side list |
| 66 | 100% realization is read-only with optional removed-content audit | PASS | Read-only graph, inspector, and red overlay |
| 67 | Simulation preparation selects only a configuration | PASS | Configuration-only request/UI |
| 68 | Simulation snapshots contain exact realized objects and applied variations | PASS | Background-realization immutable-input test |
| 69 | Dashboard and Variability open one authoritative validation result set | PASS | Persistent validation filters and render test |
| 70 | Findings navigate to affected canonical objects | PASS | Element/relationship/feature/variation/configuration navigation and chooser |
| 71 | Variability changes use right-side local drafts with explicit Save/Cancel | PASS | Side editors and render test |
| 72 | Feature expressions provide safe operators and feature autocomplete | PASS | Structured variation-point editor |
| 73 | Typed feature-value impacts are edited as structured rows | PASS | Enumeration-only condition editor |
| 74 | Variation graph filters remember multiple sections and element types | PASS | Store-backed preferences and render test |
| 75 | Hidden graph endpoints also hide their relationships | PASS | Both-endpoints visibility projection |
| 76 | Process duration and parameter ranges are editable in context | PASS | Model table and element editor |
| 77 | Standard KPI algorithms are explained and locked after creation | PASS | KPI definition cards |
| 78 | Successful transformation opens the read-only 100% realization | PASS | Configurator and 150% transformation controls |

## Settled interaction decisions

- Selecting another active XOR member replaces the earlier choice.
- A `requires` target is never silently selected. The user approves it, then classifies it as manual or automatic each time.
- Invalid configurations can be saved but cannot be derived or simulated.
- Empty parameter applicability means every configuration.
- A selected KPI with no applicable numeric inputs is Not available and blocks the run.
- A configuration automatically owns one generated architecture; the architecture is not an independent Configurator or Simulation input.
- Run names default to configuration plus timestamp and remain editable before execution.
- Critical path reuses canonical process-function `precedes` links.
- Formula KPI dependencies must all be explicitly selected.
- Resource Demand provides a total and per-resource breakdown.
- Starting simulation with a missing or stale explicit realization creates an in-memory realization and preserves the configuration's explicit realization unchanged.
- Non-blocking findings require acknowledgement before derivation or simulation.
- The sample includes Total Power.
