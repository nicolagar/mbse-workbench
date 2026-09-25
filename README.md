# MBSE / MBPLE Workbench

A browser-based, single-user programme-preparation demonstrator for mission-driven MBSE and MBPLE workflows. Stage A provides modeling and traceability; Stage B adds variability, 150%-to-100% derivation, engineering parameters, KPI pre-sizing and immutable simulation runs; Stage C adds traceable comparison, decisions, snapshots and delivery.

## What the workbench is and how it is organised

The workbench turns a mission into a connected early engineering model: stakeholders define needs and objectives; these lead to requirements; functions and components provide the solution; parameters, verification and simulations provide evidence; configurable alternatives can then be compared and approved. It supports preliminary programme and architecture work, not certified detailed-design analysis.

Every project can be opened in two synchronized perspectives. **Architect view** asks one plain-language question at a time, explains what to enter and writes confirmed answers into the canonical project. **Modeler view** exposes the same project through the Project Workflow and direct table, graph, sequence, matrix, variability, formula, simulation, comparison, decision and delivery workspaces. Switching views never creates a second model. Relevant Modeler edits mark only dependent Architect answers for review.

Choose **Architecture definition** for a traceable product and industrial-system architecture, **Architecture and simulation** to add KPI evidence for the current architecture, or **Trade-off** to configure, derive, simulate and compare alternatives. The Project Workflow separates Problem Space from Solution Space and recommends the earliest incomplete activity. For a field-by-field explanation of both perspectives and every guided question group, see the [Architect and Modeler views user guide](docs/user-guides/ARCHITECT_MODELER_GUIDE.md), the [worked-example guide](docs/user-guides/EXAMPLES_GUIDE.md) and the [static PDF guides](docs/guides/README.md).

Version 1.8.0 / schema 14 refines the guided workflow without changing its canonical ontology. Architect starts with the project aim, captures external systems and roles through existing canonical relationships, and shows the growing model as a semantic left-to-right thread. Architecture-and-simulation work uses the current architecture automatically and asks for KPI calculation, inputs, units, targets and limits without trade-study direction or weight questions. Live project assumptions and acknowledgement prompts are removed; imported legacy simulation-run evidence remains immutable and readable. Modeler exposes real precedence graphs for every function sequence, integrates organizational feature groups into the feature table, and uses the name Model Digital Thread for the end-to-end model view. See [the ontology update](ONTOLOGY_UPDATE.md) for the schema behavior and the [senior engineering review](ONTOLOGY_REVIEW.md) for sample acceptance and demonstrator limits. The application is intended for small, bounded early-phase engineering studies. It is not a certified engineering-analysis tool, professional SysML/PLM platform, regulatory-compliance system, probabilistic uncertainty engine, or substitute for verified detailed-design substantiation.

## Architecture Trade Study methodology

- A direct decision question; an Open Decision is optional context, not a prerequisite
- Existing needs, objective elements and active use cases define scope; requirements are collected automatically through canonical `derives` relationships
- Guided Problem Space Step 3 defines the active Trade Study, shared Root Feature, selected reusable variability axes and canonical evaluation KPIs
- Each project-level variability axis owns one synchronized major FeatureGroup and can be reused across Trade Studies
- KPI formula or algorithm, unit, direction, weight and objective links are editable in the guided setup; global definitions remain authoritative
- At least two valid configurations, current saved 100% derivations and current complete simulations tied to those exact derivations
- Every selected KPI must have finite current evidence for every alternative; missing or stale evidence blocks comparison
- Linked requirement formulas determine feasibility before scoring
- KPI normalization uses feasible alternatives only; the same scale provides diagnostic scores for infeasible alternatives, which remain visible but cannot be preferred
- Manager and Expert views share one calculation, with the Expert view adding formula, run, derivation, normalization and contribution lineage
- A sole feasible alternative can be selected with a clear “no competitive feasible ranking” limitation
- Approval requires an explicit feasible selection, rationale and baseline confirmation, and captures its evidence links
- Schema-8 Pareto, SMART/MAVT, sensitivity, risk, scenario and robustness history remains readable and exportable for backward compatibility

The detailed method and ontology are recorded in [`TRADE_STUDY_METHODOLOGY.md`](TRADE_STUDY_METHODOLOGY.md).

## Stage C capabilities

### Trade Study analysis and decisions

- Three focused tabs: guided Problem Space setup, Compare/Inspect evidence and Decide
- Configuration-derived alternatives are selected only in Step 7 after derivation and simulation evidence exists
- Configuration-derived alternatives only, with exact immutable derivation and simulation lineage
- Formula-based requirement feasibility, feasible-only normalization, global KPI weighting, explicit ties and immutable result history
- Infeasible alternatives remain visible with diagnostic scores and failed requirement evidence but are not selectable for approval
- Decision approval requires rationale, a feasible alternative and explicit baseline confirmation
- Historical evidence protection blocks deletion of referenced KPIs and runs and archives referenced configurations

### Snapshots and delivery

- First-class **Save Project** and **Load Project** actions in the application frame and Delivery workspace; saved `.mbse-project.json` packages contain the complete active engineering project while excluding application snapshots and UI preferences
- Validated Load-as-new and Replace-active paths reuse the versioned JSON importer, including syntax/schema/reference checks, top-level ID collision handling, replacement safety snapshots, and no-state-change rollback on failure
- Application-level named local snapshots with notes, newest-first listing, a 20-per-project limit, oldest-replacement confirmation, raw download, restore safety snapshot, deletion, and duplication into an isolated new project
- Snapshot project data excludes snapshots and UI preferences; corrupt or recursive snapshots are rejected without changing the active project
- Shared JSON/XLSX selective scope by architecture, configuration, model domain, element type, individual element, feature, relationship type, and tag
- Referential-integrity choice to include relationship endpoints automatically or omit incomplete relationships with an explicit manifest
- Versioned JSON packages with IDs, metadata, scope, counts, omitted relationships, and warnings; import validates syntax, versions, duplicate IDs, and references before any state change
- Import as a new project resolves top-level ID collisions while preserving nested IDs; replacement preserves the active project ID and creates a safety snapshot
- `write-excel-file` browser workbooks with applicable headed engineering-data sheets and a manifest
- jsPDF project/comparison reports with vector score summaries, detailed tables, repeated headers/footers, scope, quality, simulations, decisions, risks, and the preliminary-estimate disclaimer
- A complete project report remains available when no comparison or decision is selected and marks unavailable sections honestly

### Completion and usability

- A clean first launch and **Reset all** create one empty active project; **Load example** offers architecture-only emergency lighting, architecture-plus-simulation cold-chain transport, the coffee-machine introduction and the aircraft-OHSC configuration-management demonstrator
- Compact project frame with create, switch, duplicate and delete controls in both Architect and Modeler perspectives
- Expandable Problem Space and Solution Space navigation with progress counts and direct links to the exact workspace/view used by each workflow activity
- Architecture-building scopes separate **Build the product functional & technical architecture** from **Build the industrial system functional & technical architecture**; Trade Study Step 1 exposes product functions, product architecture, industrial system functions, and industrial system architecture
- Independent overall scopes for Architecture building, Architecture building + simulation and Trade Study
- Stacked Problem Space and Solution Space outcome cards with automatic Not started, In progress, Complete and Blocked states
- Exact editor actions, blocker explanations, earliest-next-step recommendation and return to the same Project Workflow context
- Explicit architecture-only simulation of the canonical unconfigured 150% model in a selected architecture context
- Architecture building + simulation calculates KPIs directly from the current architecture without requiring a variability configuration; configured 100% and unconfigured 150% choices remain available for Trade Study work
- Architect guidance states the model result of affected answers, and the final question opens a completion screen with direct stakeholder-recap and validation actions
- **Load example** supplies scope-matched worked models: emergency lighting for Architecture, a reusable cold-chain box for Architecture + Simulation, the three-alternative coffee-machine study and the four-configuration OHSC study
- The OHSC example contains a solution-independent mission, explicit need/objective-to-requirement traceability, 30 unchanged baseline requirements with exactly 18 formula-verifiable checks, a controlled 150% family, four current 100% derivations and simulations, five calculated KPIs, and an immutable preliminary successor-baseline decision
- Full desktop sidebar, tablet icon rail, mobile drawer, visible keyboard focus, semantic labels and responsive card/table/workspace layouts down to a 320 px minimum viewport
- Complete three-alternative coffee-machine workflow with product functions allocated to coffee-machine technical components and manufacturing process functions allocated to industrial equipment, plus explicit product-component input/output handoffs, current derivations, matching simulations, formula-based feasibility and a baseline decision
- Automatic top-down semantic bands for every non-sequence Model and realization graph, with the highest available root concept centered at the top
- Automatic root-to-leaf containment bands for Feature Models and left-to-right stage bands for function sequences
- Crossing-minimized ordering through ELK, orthogonal routed connectors, dedicated outer lanes for long and secondary links, and node-size-aware spacing
- Compact/detailed graph cards, primary/all/selected relationship views, selection focus, labelled bands and manual-position fallback

## Stage B capabilities

### Variability and derivation

- Canonical graph/table feature model with one root, mandatory/optional features, XOR/OR groups, Boolean or enumerated values, external/internal scope, ordering, duplication, and reference-aware cascade deletion
- Responsive right-side editors with local drafts and explicit Save/Cancel behavior for feature-model, variation-point, configuration, 150% element, and graph-relationship changes
- Recursive, purely organizational feature groups plus neutral containment, green directional `requires`, and red `excludes` graph edges
- `requires` and `excludes` constraints integrated into the Feature Model graph/table with self/duplicate rejection
- Safe feature-expression tokenizer, parser, AST, evaluator, token preview, readable summary, operator buttons, and feature autocomplete for exact IDs with `AND`, `OR`, `NOT`, and parentheses
- Configuration intent split into manual, approved automatic, derived automatic, and effective selections
- Realization scope defaults to the entire compatible model and can be narrowed explicitly to requirements, structure, behavior, process, resources, or verification with a visible warning
- XOR behaves as a normal single-choice control; approving a `requires` target asks whether that approval is manual or automatic each time
- Invalid configurations remain saveable and visible but cannot be derived or simulated
- First-class reusable variation points that constrain multiple elements or relationships through safe feature expressions and typed value conditions
- Structured `Impacted feature value(s)` rows for typed enumeration conditions and direct editing or selection when a graph target has existing variation points
- Supported effects: Existence, Primitive Property, Primitive Tag, and Element Property; arbitrary executable scripts and unsupported stereotype element-reference tags remain out of scope
- Remembered multi-select variation graph filters by modeling section and element type; connectors are shown only when both endpoints remain visible
- Configuration-owned generated architectures with synchronized names, lifecycle state, paired deletion, and archive preservation when historical runs exist
- Editable cross-domain 150% Product-Line Model available without a configuration; optional overlays show common as neutral, included as green, excluded as red, and modified as yellow
- Deterministic read-only 100% realization graph with inspector, removed-content audit overlay, cascade cleanup, full applied-effect audit, immutable snapshots, source revision, and staleness

### Parameters, KPIs, and pre-sizing

- One engineering-input table with inline authoritative process duration, parameter value, minimum, maximum, uncertainty, unit, applicability, value-origin, and source/provenance controls
- Consolidated parameter editing with typed values, semantic keys, units, source, value origin, ranges, uncertainty, and exact configuration applicability; blank applicability means every configuration
- Authoritative process duration in `metadata.duration` and `metadata.durationUnit`; one engineering day is explicitly treated as eight hours
- Authoritative industrial-component resource quantity on each `industrialSystemComponent —requiresResource→ resource` relationship; process cost and demand follow inverse `processFunction —realizedBy→ industrialSystemComponent` links to the authoritative process durations
- Safe KPI formula language with exact `param("id")` and `kpi("id")` references, arithmetic, unary minus, `min`, `max`, `sum`, and `average`
- Dependency extraction, cycle detection, topological evaluation, division-by-zero handling, and conservative symbolic units
- Standard total mass, direct/process/estimated cost, total power, critical-path lead time, resource demand, basic utilization, and throughput-proxy algorithms
- Read-only logic, required-input, output-unit, and assumption explanations for every standard algorithm; the selected algorithm is locked after creation
- Resource demand exposes one total and a per-resource breakdown; critical-path results expose the critical chain

### Simulation and history

- Editable configuration-and-timestamp run names
- Configured 100% run preparation with automatic linked-architecture resolution, plus explicit architecture-only canonical 150% analysis
- Missing or stale explicit realizations are created in memory for the run without updating the configuration
- Blocking errors and an acknowledgement summary for non-blocking warnings
- Not-available KPI inputs block the affected run
- Immutable input snapshots including exact realized elements, relationships, applied variations, KPI IDs, source parameters, assumptions, warnings, validation summary, and current/stale status
- Variant-specific KPI analysis consumes the realized element/relationship values, including property modifications, rather than reconstructing the legacy existence-only subset
- Differentiated manual and automated sample variants plus a reproducible invalid configuration

## Stage A capabilities

### Model Definition and Validation

- Twenty-three clickable workflow steps from mission definition through global mission fulfillment
- Guided but non-blocking progress: users may model out of order while missing prerequisites remain visible
- Persistent selection of one or more system-of-interest use cases as the downstream working scope
- Clicking a workflow step opens the relevant workspace, view and element type with task context and current violations
- First-class mission, stakeholder, need, objective, use-case, system-requirement, product/process function, product/process technical component, interface, resource, and verification-method types
- One explicit system of interest is connected from its mission by canonical `hasSOI` and records its physical architecture root and boundary; people and organizations remain stakeholders
- Mission fulfillment derived from stakeholder needs/objectives and AND-semantics across all linked requirements
- Pending formulas remain visibly pending but count as unsatisfied in roll-ups

### Canonical modeling and editing

- Project create, edit, duplicate, switch, delete, and reset controls; configuration-owned architectures are managed through Configurator
- CRUD for all fourteen explicit element types
- Canonical 150% content with configuration effects expressed through first-class variation points
- Parameter CRUD with units, provenance, value origin and calculated-parameter definitions
- Parent-component calculations from the owner and all direct/transitive `refines` descendants
- Automatic recalculation, immutable parameter bindings, dependency-cycle detection and pending-variable reminders
- ISO 80000-aligned built-in quantity/unit catalogue plus project-defined units, dimensions, aliases and SI conversion factors
- Reusable typed custom-attribute columns per element type, with units, required flags and defaults
- Inline table editing, visible parameters, selectable element type on row creation and consistent type colors
- Persistent drag ordering independently for every element type, with temporary A–Z and Z–A display sorting
- Editable tags with suggestions from the existing model vocabulary
- Canonical relationship CRUD with compatible source/type/target filtering
- Editable relationship endpoints, names, descriptions, quantities, units and item-flow names
- Direct process-context editing of `consumes` and `produces` flows from process functions to product components, with required positive quantity and unit plus an optional item-flow name
- Canonical `hasFunction` relationships from use cases to product or process functions

### Synchronized views

All tables, matrices and diagrams are projections of the same `Project.elements` and `Project.relationships` arrays:

- Eight explicit modelling sections expose only their relevant table, graph, sequence, matrix, section-recap and quality views; Interfaces and end-to-end Traceability are independent sections
- Every current-section element appears immediately in graphs and matrices, including new unlinked elements
- Working use-case scope highlights in-scope content without hiding out-of-scope architecture content
- Editable element and relationship tables
- Contextual architecture graphs include needs, objectives and verification methods in the requirements view, plus visible typed mission/system/use-case/root references and external-system boundary connections
- Manual graph layouts persist independently per section/sequence; hierarchy layouts place parents above children and sequence layouts flow left to right
- Temporary edge highlighting on click and persistent editable details on double-click
- Direction-aware editable traceability matrices with canonical relationship creation and deletion from either endpoint
- Requirements can select nested function/component parameters from matrix cells; the model stores an immutable formula binding plus canonical satisfaction to the owning element
- Requirement-to-product-function and requirement-to-process-function diagrams
- Requirement-to-product-component and requirement-to-industrial-component diagrams
- Product-component and industrial-component refinement is component-to-component; functions connect to components only through `realizedBy`
- The Interfaces and Traceability section provides a global graph and fourteen-type matrix
- Mission-first stakeholder traceability and validation recap; every element link opens its full properties
- A requirement needs at least one satisfying product/process function, technical component, or owned parameter; it is not required to have evidence in all four domains
- Direct requirement evidence is propagated across valid function→`realizedBy`→component pairs in both product and process domains
- Automatic validation and metric refresh after canonical model edits

### Function sequences

- Named product- or process-function sequences scoped by architecture and one or more use cases
- The same immutable function can participate in multiple contextual sequences without duplication
- Immediate `precedes` links form an acyclic directed network with sequential paths, parallel AND splits and AND joins
- Multiple start/end functions are supported through implicit virtual boundaries
- Derived stable stage labels such as `1`, `2A`, `2B`, `3`
- Precedence links remain within one refinement level; internal sequences can explicitly refine a parent function
- Assigning or changing a sequence parent automatically reconciles canonical child→`refines`→parent relationships for every member
- Synchronized diagram connections and predecessor/successor table editing
- Separate architecture/hierarchy and function-sequence views, each with its own persisted layout context
- Selectable sequence overlay with manual, top-down hierarchy or left-to-right sequence layout, emphasized sequence arrows and subdued contextual relationships
- Process overlays retain interfaces and consumed/produced product-component flows, including quantity and unit metadata
- Product-input/output work is a separate workflow task from process sequencing: start functions produce, intermediate functions consume and produce, end functions consume, and isolated functions consume and produce
- Every process precedence link requires a predecessor-produced component consumed by its successor; units must match, while quantity differences remain review warnings for split, merge and transformation cases

### Requirement formulas

Requirement formulas support:

- comparisons: `@mass <= 1000`
- arithmetic: `@cost = @rate * @hours`
- parentheses and unary signs
- cross-element parameter bindings
- future Stage-B KPI bindings
- compatible-unit conversion
- incompatible or unknown unit detection

The formula UI displays readable model names while bindings store immutable parameter or KPI IDs. The parser is purpose-built and does not execute JavaScript or use `eval`.

Calculated component parameters additionally support `+`, `-`, `*`, `/`, parentheses, `sqrt`, `^`, `**`, superscript `²`/`³`, fractional and negative powers. Output dimensions are inferred; users may request a compatible display unit. Examples include `100 cm + 1 m = 2 m`, `1 m * 1 m = 1 m²`, and `sqrt(4 m²) = 2 m`.

The practical built-in catalogue follows ISO 80000 quantity and SI conventions for common Stage-A engineering quantities. It is not represented as a complete reproduction or certification of every ISO 80000 part. Compound units such as `EUR/h`, `parts/h`, `m/s`, `m²` and `m³` are supported. Projects can add custom units by specifying their base-dimension exponents and factor to SI.

### Quality and persistence

- One authoritative project-wide Model Quality result set with persistent severity, category, and domain filters; dashboard cards and variability checks reuse it
- Addressable findings navigate to the affected model element, relationship, feature, variation point, or configuration, with a chooser when several objects are implicated
- Mission, stakeholder, use-case and system-of-interest completeness rules
- Requirement satisfaction accepts any one direct or realized-pair product function/component, process function/industrial component, or owned parameter as evidence
- Formula failure, pending-value and syntax/unit findings
- Contextual product/process sequence validation, refinement-level checks, cycle detection, process-role flow completeness, product handoff matching, unit errors and quantity-mismatch warnings
- Six traceability metrics, completeness, approval maturity and renormalized overall maturity
- Versioned schema-9 local persistence with debounced autosave and corrupt-storage recovery
- Pure, non-mutating, idempotent schema-1/2/3/4/5/6/7/8→9 migration preserving model IDs and Stage-A/B/C content; schema-8 FeatureGroups remain available for explicit axis adoption without automatic semantic inference
- Canonical Stage-C comparison, risk, decision, and application-level snapshot storage

## Technology

React 18, strict TypeScript, Vite, Tailwind CSS, React Flow, Zustand, Lucide React, Recharts, `write-excel-file`, jsPDF, Vitest, and React Testing Library. Dependency versions are pinned exactly in `package.json` and `package-lock.json`.

Verified with:

- Node.js `v24.19.0`
- npm `11.9.0`
- Vite `6.4.3`
- Vitest `3.2.6`
- PostCSS `8.5.26`
- write-excel-file `4.1.1`
- jsPDF `4.2.1`

## Run in GitHub Codespaces

1. Open `nicolagar/mbse-mbple-workbench` on GitHub.
2. Select **Code → Codespaces → Create codespace on the desired branch**.
3. Confirm and activate Node.js 24 LTS, then install and verify the exact lockfile:

```bash
nvm use
node --version
npm --version
npm ci
npm audit
npm run typecheck
npm run test
npm run build
npm run dev
```

4. When Codespaces reports port `5173`, select **Open in Browser**.

The application needs no backend, authentication, external API, runtime CDN, or runtime network call. After npm dependencies are installed, it can run without a runtime internet connection.

### Dependency-audit note

Stage-C baseline security version `1.0.1` replaces `xlsx@0.18.5` with the browser entry point of `write-excel-file@4.1.1`. Both `npm audit --omit=dev` and the full `npm audit` report zero vulnerabilities in the verified lockfile. Focused tests inspect the generated XLSX ZIP/XML workbook structure without adding an XLSX reader. JSON remains the only supported import format.

## Persistence and compatibility

The application uses one localStorage root key:

```text
mbse-mbple-workbench
```

The persisted root and every live project use schema version `13`. On load, schema-1 through schema-12 records are migrated without resetting localStorage or changing existing project, element, parameter, relationship, feature, configuration, KPI, simulation, comparison, decision, or evidence IDs. Schema-13 migration converts legacy System `missionId` references and former mission-to-SOI `hasStakeholder` edges into canonical `hasSOI` relationships while historical evidence snapshots remain unchanged. Legacy `selectedFeatureIds` becomes explicit manual selection; legacy element expressions become first-class Existence variation points; architecture-specific applicability becomes visible internal migration features plus Existence variation points in the canonical 150% model; and schema-8 FeatureGroups remain available for explicit variability-axis adoption without inferred semantics. Each configuration receives one generated architecture. Legacy resource-level quantities move to a single matching assignment when unambiguous, otherwise remain ignored legacy metadata with PMB-114. Any legacy project-nested snapshots are moved to `PersistedAppState.snapshots`, and recursive snapshot content is removed.

Only engineering-model and KPI-definition changes increment `modelRevision`. Comparison, risk, decision, snapshot, export, and project name/description edits do not make engineering evidence stale. Objective edits are engineering intent and do increment the revision.

Malformed or structurally invalid JSON opens the recovery screen. The original raw value can be downloaded before an explicit reset; it is never silently overwritten.

## Scope boundaries

Stage C completes the A → B → C demonstrator: it models and traces programme intent, manages MBPLE variability, derives deterministic 100% realizations, performs preliminary KPI calculations, compares saved evidence, records decisions, creates basic local recovery snapshots, and exports selected evidence. It remains a local, single-user early-phase workbench—not enterprise version control, a collaborative PLM repository, an optimization solver, or a certified detailed-design analysis tool.

See [ACCEPTANCE_RESULTS_A.md](./ACCEPTANCE_RESULTS_A.md) for the verified Stage-A record.
See [ACCEPTANCE_RESULTS_B.md](./ACCEPTANCE_RESULTS_B.md) for the verified Stage-B record.
See [ACCEPTANCE_RESULTS_C.md](./ACCEPTANCE_RESULTS_C.md) for the verified Stage-C record.
See [ACCEPTANCE_RESULTS_POST_FIX_V01.md](./ACCEPTANCE_RESULTS_POST_FIX_V01.md) for the 1.5.2 post-fix verification record and browser-environment limitation.

## Semantic ontology V04 preview

A project-independent generic stereotype map is available in **Scope ontology**, with filters for Architecture building, Architecture building + simulation and Trade Study. It uses one Semantic relationship style and a reduced workflow mapping. Project Digital Thread, Ontology Schema and Stored schema graph/register are not exposed on this page. Schema 14, domain engines and native exports are preserved. See [the V04 guide](docs/semantic-graph/README.md) and [acceptance results](ACCEPTANCE_RESULTS_SEMANTIC_GRAPH.md).
