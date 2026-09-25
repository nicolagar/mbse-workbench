# Stage A Acceptance Results

Date: 2026-07-27  
Version: 0.4.0 review branch with REV01 product-flow correction
Schema: 1  
Authority: `prompts/00_SEQUENCE_EXECUTION.txt`, `prompts/01_PROMPT_A_MODELING_FOUNDATION.txt`, the two reviewed Prompt-A scope-update documents, and the completed clarification rounds  
Result: **PASS — 0 mandatory failures**

## Command verification

| Command | Result | Evidence |
|---|:---:|---|
| `npm install` | PASS | Exact lockfile installed; packages were already current |
| `npm audit --audit-level=moderate` | PASS | `found 0 vulnerabilities` |
| `npm run typecheck` | PASS | Strict TypeScript project references completed with zero errors |
| `npm run test` | PASS | 2 test files; 46 tests passed |
| `npm run build` | PASS | Vite 6.4.3 production build; 1,769 modules transformed |
| `npm run dev` smoke check | PASS | Vite served the application at `127.0.0.1:5173`; the HTML entry point returned successfully |

The production build emits a non-failing advisory because the main minified JavaScript chunk is approximately 540 kB before gzip and 158 kB after gzip. Code splitting is an optimization opportunity, not a Stage-A acceptance failure.

## Reviewed-scope acceptance

| Area | Result | Verification evidence |
|---|:---:|---|
| Existing Stage-A regression | PASS | Original project/model CRUD, persistence, relationship grammar, formulas, metrics and render tests remain passing. |
| Schema compatibility | PASS | Root schema stays at 1; existing schema-1 projects receive additive defaults without reset or ID replacement. |
| Twenty-three-step workflow | PASS | Product input/output definition and process sequence/handoff verification are separate live, non-blocking progress steps. |
| Workflow navigation | PASS | Cards open the relevant Model tab/view/type and retain task context; automated UI test passes. |
| Working use-case scope | PASS | Eligible use cases are derived from the unique system of interest; selections persist and scope downstream diagrams, matrices, workflow and quality display. |
| Global fulfillment | PASS | Mission status remains global and uses AND semantics across every linked need/objective and all derived requirements. |
| Canonical directions | PASS | Requirement→`satisfiedBy`→function/component, function→`realizedBy`→component, stakeholder→`involvedIn`→use case and use case→`hasFunction`→function are enforced. |
| Propagated evidence | PASS | Direct evidence on either side of a valid realized pair shows and counts its connected counterpart; automated product/process evidence test passes. |
| Mission-first recap | PASS | Mission is the first column; rows expose stakeholder, need/objective, requirements, all four architecture domains, parameters and status. |
| Property navigation | PASS | Clicking an element in the recap or editable matrix opens its full property editor; automated UI test passes. |
| Requirements architecture graph | PASS | Needs and objectives are included with system requirements and verification/architecture evidence. |
| Section/view relevance | PASS | All seven sections use centralized type projections; function-sequence view is offered only in product/process functional sections. |
| Unlinked-element visibility | PASS | Newly created current-section elements remain in graphs and matrices before any relationship exists; automated domain and UI tests pass. |
| Scope presentation | PASS | Selected use-case scope highlights rather than removes out-of-scope current-section elements. |
| Graph layouts | PASS | Manual positions persist per view; hierarchy places parents above children; function sequence lays stages left to right. |
| Hierarchy direction | PASS | Canonical storage is child→`refines`→parent for functions and same-domain components. |
| Sequence-parent synchronization | PASS | Selecting or changing a parent automatically reconciles member refinement links; automated store test passes. |
| Requirement-to-function diagrams | PASS | Product and process functional views include selected use cases, requirements, functions, interfaces and visible canonical relationships. |
| Requirement-to-component diagrams | PASS | Separate product and process technical diagrams include requirements, bridging functions, components and interfaces. |
| Editable functional matrix | PASS | System requirements appear in functional/technical matrix contexts and create canonical requirement-to-function/component links. |
| Direction-aware matrices | PASS | Links may be initiated from either displayed endpoint while canonical source/type/target direction is retained; reverse verification compatibility is tested. |
| Verification-method traceability | PASS | Verification methods appear in requirements tables, graph and matrix, with canonical verification-method→`verifies`→requirement links. |
| Nested parameter traceability | PASS | Function/component parameters are selectable under their owners; binding stores immutable parameter IDs and reuses canonical owner satisfaction. |
| Global traceability | PASS | Interfaces and Traceability exposes every element and all fourteen element-type matrix columns. |
| Persistent table ordering | PASS | Drag handles store an independent manual order for each element type. |
| Alphabetical sorting | PASS | A–Z and Z–A are temporary per-type views; manual order is preserved and restored. |
| Requirement formulas | PASS | Arithmetic/comparison, stable parameter/KPI IDs, compatible conversion and unsafe-token rejection remain tested. |
| Unassigned formula variables | PASS | Formulas may be saved pending, display assignment reminders and count as failed until bound. |
| Calculated parameter scope | PASS | Product and industrial-component calculations may reference the owner and all direct/transitive refiners only. |
| Calculated parameter engine | PASS | Automatic recalculation supports `+`, `-`, `*`, `/`, parentheses, `sqrt`, powers and unit-dimensional propagation. |
| Calculated dependency integrity | PASS | Missing variables are pending; invalid references and dependency cycles are errors. |
| Output units | PASS | Result dimensions are inferred; compatible requested units convert values; incompatible units are rejected. |
| Unit catalogue | PASS | Practical built-ins follow ISO 80000 quantity/SI conventions and retain explicit ISO-part metadata where applicable. |
| Custom units | PASS | Projects can define symbols, aliases, quantity names, base-dimension exponents and factors to SI; parsing/conversion is tested. |
| Standards claim | PASS | UI/documentation explicitly avoid claiming complete ISO 80000 reproduction or certification. |
| Named sequences | PASS | Product/process sequences are named and scoped by architecture plus one or more use cases; functions retain immutable IDs and may be reused. |
| Sequence DAG | PASS | Immediate contextual `precedes` links support linear and parallel acyclic networks; cycles are rejected and tested. |
| AND split/join | PASS | Multiple successors execute as parallel AND branches; a join waits for all predecessors. |
| Multiple boundaries | PASS | One or more start/end functions are derived through implicit virtual boundaries. |
| Stage labels | PASS | Stable derived labels such as `1`, `2A`, `2B`, `3` are tested. |
| Sequence hierarchy | PASS | Links stay within one refinement level; internal sequences can explicitly refine a parent function and are directly navigable. |
| Sequence editing | PASS | Diagram connection/deletion and predecessor/successor table creation/deletion/description editing share canonical records. |
| Sequence visualization | PASS | Sequence mode uses left-to-right stage placement, emphasized contextual arrows and subdued architecture relationships. |
| Process flow editor | PASS | The process-functional context directly creates and edits consumed/produced product components, positive quantities, required units and optional item-flow names. |
| Process flow roles | PASS | Start functions require production; intermediate and isolated functions require consumption plus production; end functions require consumption. Optional start consumption and end production remain permitted. |
| Process handoffs | PASS | Every process precedence link requires at least one predecessor-produced component consumed by the successor. |
| Handoff values | PASS | Unit mismatch is an error; quantity mismatch is a warning so split, merge and transformation flows remain permitted. |
| Process flow visualization | PASS | Process diagrams emphasize precedence, consumed inputs and produced outputs and display item-flow name, quantity and unit data. |
| Validation | PASS | Sequence, process-role flow, handoff, scope, custom-unit, formula, calculated-parameter, relationship and traceability findings update after canonical edits. |
| Sample project | PASS | Sample includes working-use-case scope, `hasFunction`, product/process sequences, formulas, item flows and fulfilled global mission with no mandatory errors. |
| Production build | PASS | Optimized assets emitted successfully to `dist`. |

## Automated test inventory

- 5 relationship-grammar, canonical-direction and item-flow tests
- 4 REV_02 section-projection and hierarchy-layout tests
- 6 requirement-formula, arithmetic, unit, unsafe-token, KPI and pending-variable tests
- 5 evidence, AND-roll-up and 23-step workflow tests
- 9 validation, process-flow, handoff, architecture, custom-attribute, cascade and sequence-cycle tests
- 2 metrics and maturity tests
- 4 calculated-parameter, custom-unit and contextual-sequence tests
- 4 schema-1 persistence and future-structure tests
- 7 application render, workflow-editor, navigation, visibility, sequence-parent and nested-parameter tests

## Deliberate Stage-A boundaries

- KPI definitions may be referenced, but KPI calculation remains Stage B.
- Feature selection, derivation, simulation and pre-sizing remain Stage B.
- Comparison, decisions, snapshots, import and export remain Stage C.
- The built-in catalogue is a practical ISO 80000-aligned subset; complete conformity requires an explicitly selected ISO 80000 edition/part set and a separate standards-conformance review.
- The reviewed update is published to the existing `agent/stage-a-v0.3.0-review` branch after local verification; the branch name is retained to preserve the established review workflow.
