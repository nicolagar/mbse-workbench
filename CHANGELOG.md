## V04 semantic ontology — 2026-09-16

- Add a typed, deterministic semantic graph over existing records and frozen evidence, with provenance, role filtering, conservative reference resolution and export.
- Retain the semantic projection engine for downstream integrations without exposing Project Digital Thread or registry schema on Scope Ontology.
- Add a deterministic Mission → baseline view over canonical, supporting and evidence roles while retaining authoritative edge direction.
- Separate semantic role from provenance in the stored schema graph and connection register.
- Make Scope Ontology a project-independent generic workflow map with Architecture, Architecture + Simulation and Trade Study filters; use one Semantic relationship style and collision-free orthogonal routing.
- Connect System Requirement to its five direct engineering targets, Architecture to its seven direct engineering-content targets, and Trade Study to Variability Axis; omit Feature Model and non-workflow diagnostic concepts from the guidance graph.
- Remove Project Digital Thread, Ontology Schema, Stored schema graph/register and Semantic view controls from the Scope Ontology page.
- Add parallel Trade Study and Architect views, a read-only matrix, and a Modeler trace inspector inside Element details.
- Preserve schema 14 and every existing domain/store/sample module; keep every stored/legacy view reachable.
- Add source-isolation, determinism, history, parity, failure, UI and performance checks. Details: `ACCEPTANCE_RESULTS_SEMANTIC_GRAPH.md`.

# Changelog

## Unreleased

- Added canonical `Mission --hasSOI--> System` relationships, migrated legacy system mission references, and advanced live projects to schema 13.
- Updated Architect/Modeler creation, editing, validation, workflow, graph, matrix, recap, samples and regression coverage to use `hasSOI` as the sole live mission-to-system representation.
- Advanced current projects to schema 14: live project assumptions and new-run assumption fields are removed while imported immutable legacy run evidence remains unchanged.
- Started Architect with the exact project-aim question, added external-system name/role capture through canonical `participatesInMission`, simplified Architecture + Simulation KPI/run questions, and renamed both simulation recaps to **Simulation Results**.
- Reworked the Architect progress graph into semantic left-to-right layers, renamed the end-to-end Modeler view **Model Digital Thread**, and replaced sequence summary cards with the actual `precedes` graphs.
- Moved Project Recap directly below Project Workflow, exposed Load example in the header, removed the global architecture selector and duplicated project name, and aligned requested recap, constraint, use-case, and Trade Study wording.
- Integrated organizational feature groups into the Feature Model hierarchy table and retained study-specific risk, uncertainty, preference, and decision evidence without creating new ontology relationships.

## 1.8.0 — 2026-09-11

### Workflow navigation and model usability

- Reworked the Model navigation into eight expandable sections and separated Interfaces from end-to-end Traceability while preserving canonical relationship storage.
- Added filtered sticky traceability matrices and Modelling Overview columns, compact editable tables with optional detail columns, and a consistent right-side element editor.
- Added rule-derived section recaps, an all-sequences overview and one Project Recap from mission through architecture, evidence and decision.
- Simplified variability targeting, made feature-group cardinality and configuration hierarchy explicit, and consolidated configuration-readiness findings.
- Improved automatic graph spacing, routing and horizontal layout; Architect now shows the accumulated model after each question in modelling-section bands while hiding parameter and evidence detail.
- Unified Architect and Modeler project headers and moved secondary project operations into one responsive Project actions menu.
- Added scope-specific Portable Emergency Lighting and Reusable Cold-Chain Transport Box examples alongside the existing coffee-machine and OHSC Trade Studies.
- Advanced live projects to schema 12 and migrated the former combined Interfaces/Traceability tab to the separate Traceability section.

## 1.7.0 — 2026-09-10

### Modelling overview and explicit configuration eligibility

- Added a shared nine-column Modelling Overview across every Model section and retained the focused five-column Requirements & Validation Overview only where it is needed.
- Removed the requirement recap from editable traceability matrices so each view has one clear purpose.
- Added the canonical stored `Mission → participatesInMission → External System` relationship, populated it in both examples, and included it in editing, validation, graphs, matrices and delivery formats.
- Corrected Dashboard context navigation to show systems of interest, stakeholders and external entities together, and removed the redundant active-study selector from Dashboard Step 3.
- Reworked the reference-baseline explanation and displayed focused Trade Study requirements on separate rows.
- Moved and emphasized Configuration Recap, replaced ambiguous decision-readiness wording with explicit Trade Study eligibility and reasons, and reused the same interpretation in Simulation.
- Exposed resolved primitive-property variation effects and selected values in the Configurator Feature table area.
- Simplified simulation architecture-basis wording while retaining exact immutable provenance.
- Advanced live projects to schema 11 without guessing missing mission-participation relationships in user projects.

## 1.6.1 — 2026-09-10

### Connected sample context and verified digital thread

- Reviewed and corrected both bundled examples from system-boundary, operational-context, physical-architecture, industrial-flow, evidence and configuration-management perspectives.
- Added explicit external systems and interface connections to both examples; system-to-mission, use-case-subject and system-to-root references are visible as read-only typed relationships without adding a persisted relationship type.
- Showed typed context references in graphs, matrices and element details, and included external boundary connections in the default Primary structure graph view.
- Completed the coffee example with one operational product use case, coherent interface ownership, realistic variant inputs, current derivations/runs and an evidence-backed feasible baseline decision.
- Completed the OHSC external aircraft context and internal product/process interface links while preserving all 30 baseline requirements and the required mass/eligibility outcomes.
- Hardened configuration-aware requirement evaluation, formula-result units, containment migration and validation of system/external-system context.
- Added automated connected-model and rendered relationship regression checks plus a senior-review acceptance record in `ONTOLOGY_REVIEW.md`.

## 1.6.0 — 2026-09-10

### Simplified ontology and engineering traceability

- Give the system of interest its own type and link use cases to their subject while preserving legacy IDs.
- Merge traceability and requirement assessment into the existing five-column recap in both perspectives. Numerical checks are automatic; qualitative requirements use one existing answer with explicit review or demonstration-assumption status.
- Keep all baseline obligations independent of study focus and preserve the reference architecture.
- Record physical containment, product mass boundary, contribution and quantity basis. Convert compatible units, preserve authored requirement units, and flag missing or double-counted contributions.
- Separate feature validity, derivation, model consistency, requirement results and decision eligibility. Block conflicting variability assignments and expose explicit fallback behavior.
- Update both bundled samples, retain all 30 OHSC requirements and correct industrial handoffs to follow the assembly even when optional assist hardware is excluded.
- Migrate live models to schema 10 without rewriting historical simulation or decision snapshots; mark older derivations stale.


## Unreleased — Architect / Modeler parity consolidation

- Added **Load example** with a shared accessible chooser in Architect and Modeler views; loading either example replaces only the active project, preserves its ID, and leaves other projects and application snapshots unchanged.
- Added an independent aircraft-OHSC configuration-management demonstrator: a complete feasible Standard A baseline is compared with three coherent multi-axis product/process/resource change solutions derived from one controlled 150% family.
- Added explicit mission-to-stakeholder, need/objective-to-requirement, requirement-to-satisfaction/verification, feature-to-variation-point, configuration-to-100%-realization, KPI-to-run, comparison-to-decision and baseline evidence across the OHSC digital thread.
- Added 30 unchanged OHSC requirements with exactly 18 formula-verifiable checks (60%), aggregate KPI bindings without duplicate editable total parameters, four current derivations and simulations, five comparable KPIs, bounded sensitivity scenarios, risks, prior Standard A evidence and an approved preliminary successor baseline.
- Extended generic Architect projection and validation for KPI-bound requirement formulas, qualitative evidence answers, legitimate process-only lifecycle use cases, single-feature optional axes and mixed product/process functional use cases.
- Corrected trade-study requirement evaluation to consume immutable per-run KPI evidence and reused fixed run evidence during weight sensitivity, substantially reducing repeated sample-validation work without changing results.
- Added comprehensive OHSC reference-integrity, feasibility, configuration, derivation, simulation, comparison, decision, persistence and example-chooser regression coverage.
- Synchronized the First Use, Expert and Full PDF guides with the completed `03_Architect_view_v01` behavior, including a one-page plain-language introduction, accurate Architect/Modeler structure and field-level guidance for every scope-dependent Architect question group.
- Added a maintained Markdown Architect/Modeler answer reference and repository index for the static guides.
- Corrected clean first launch to create one empty active project with no implicit sample or snapshot; **Load example** remains the explicit demonstration entry point.
- Added project duplication to the Architect header so both perspectives expose the same create, switch, duplicate and delete lifecycle controls.
- Replaced the Architect progress panel's fixed 69 px header assumption with a measured CSS offset that follows wrapped responsive headers.
- Standardized visible **Trade Study** capitalization across scope, workflow and Architect guidance.
- Added regression coverage for empty first-launch state, Architect duplication, responsive offset wiring, and complete-package preservation of Architect answers, canonical `addresses` links and requirement formulas.
- Simplified the affected Architect questions and made their guidance state exactly which model element, relationship, parameter, or documentation field each answer changes.
- Added industrial-system examples based on workstations, equipment, plant elements, workers, skills and tools instead of product-function examples.
- Suggested an already-satisfying product component as the owner of a quantitative parameter and reused an existing matching parameter instead of creating a duplicate.
- Corrected requirement satisfaction so one linked function, component, or owned parameter is sufficient; removed obsolete PMA-121/122/123 per-domain errors and recalculated validation immediately when loading a project.
- Added an explicit guided-modelling completion screen with direct access to the stakeholder traceability recap and validation results.
- Locked Architecture building + simulation runs to the current architecture, with no configuration required, while preserving configured/150% analysis choices for Trade Study work.
- Reworded the quantitative-requirement question and guidance so they accurately ask the user to define the formal check instead of implying that the application already extracted one.
- Aligned the Architect Trade Study sequence with Modeler: define KPIs before the 150% architecture, complete exact inputs after architecture construction, create and derive every configuration before simulation, then run one atomic comparable-evidence batch across the current 100% architectures. The premature architecture-context selector and architecture-only Trade Study run were removed.
- Replaced blanket Architect answer invalidation after Modeler edits with dependency-based review: only answers, instances and recaps that reference changed canonical content are marked `needsReview`; unrelated documentation edits remain confirmed.
- Made the guided-modelling completion panel reflect current evidence automatically: green for valid and reviewed, amber for pending/warning/incomplete/review items, and red for failed requirements or blocking model findings. No manual refresh state is used.
- Made **Load sample model** open the coffee-machine example as a fully verified, zero-input Architect workflow: canonical model content is projected into every applicable answer, all review recaps are confirmed, and the completion page opens at 100% without replaying model mutations.
- Reconciled Architect Trade Study alternatives with the canonical Modeler configurations, current 100% derivations and simulation runs, so the worked example exposes all three alternatives in **Simulate architectures** and **Compare and decide** instead of reporting that no compatible content exists.
- Completed the sample's traceability evidence and renamed its variability axes with coffee-machine terminology, including **Brewing technology**, while preserving the existing feature choices, derivations, simulations, comparison result and approved decision.

## 1.5.3 — 2026-08-15

### Domain-separated architecture workflow and industrial resource allocation

- Split Architecture building and Architecture building + simulation into product functional/technical construction followed by industrial-system functional/technical construction, with exact domain-specific activity links.
- Expanded Trade Study Solution Space Step 1 to expose product functions, product architecture, industrial system functions, and industrial system architecture.
- Moved canonical `requiresResource` allocation from process functions to the industrial-system components that realize them.
- Updated process-cost, resource-demand, utilization, validation, traceability metrics, editors, sample evidence, and legacy normalization to follow `processFunction —realizedBy→ industrialSystemComponent —requiresResource→ resource`.
- Added regression coverage for all scope-specific activity details, canonical resource endpoints, legacy assignment retargeting, and preserved engineering calculations.

## 1.5.2 — 2026-08-15

### Workflow, project portability, sample semantics, and responsive rework

- Added expandable Problem Space and Solution Space navigation with progress counts and direct links into each activity's established workspace/view.
- Added first-class **Save Project** and **Load Project** actions backed by the existing versioned export/import package, validation, collision resolution, safety snapshots, and rollback behavior.
- Corrected the coffee-machine sample so product functions are realized by coffee-machine technical components, manufacturing process functions are realized by industrial equipment, and process handoffs consume/produce product components explicitly.
- Removed the desktop-only minimum width and made dense Model, Variability, Parameters, Simulation, relationship, and sequence layouts collapse at appropriate laptop, tablet, and phone breakpoints.
- Added focused regression coverage for sample semantics, handoff validation, Save/Load entry points, and expandable direct workflow navigation.
- Reconciled persistence documentation with schema 9 and recorded the available automated/browser verification evidence in `ACCEPTANCE_RESULTS_POST_FIX_V01.md`.

## 1.5.1 — 2026-08-12

### Measured graph nodes and explicit ports

- Added a shared `ResizeObserver`-based measurement path that reports rendered card dimensions back into the semantic ELK layout request.
- Replaced default React Flow cards with dedicated Model, Feature and Trade Study ontology node components.
- Added explicit incoming and outgoing top, bottom, left and right handles and bound routed edges to the appropriate directional ports.
- Added direct Feature Model and Trade Study ontology component acceptance tests plus a DOM-measurement contract test.
- Preserved canonical relationships, persisted manual coordinates and project schema 9.

## 1.5.0 — 2026-08-12

### Structured React Flow diagrams

- Added a shared ELK-backed semantic layout engine with deterministic type/containment bands, node-size-aware spacing and crossing-minimized ordering.
- Made automatic top-down hierarchy the default for non-sequence Model graphs while retaining persistent Manual positions.
- Kept function sequences left-to-right and aligned their nodes to explicit stage bands.
- Added orthogonal routed edges, arrow direction, opaque edge labels and dedicated outer lanes for long or secondary cross-links so connectors do not run through cards.
- Added compact and detailed Model-card modes plus Primary structure, All relationships and Selected element views.
- Rebuilt the Feature Model as a root-to-leaf containment hierarchy with optional requires/excludes overlays and automatic/manual layout controls.
- Replaced the Trade Study ontology quadrants with a top-down evidence chain, domain-colored cards, semantic bands and optional secondary cross-links.
- Added deterministic layout, containment-depth, route-clearance and graph-control regression coverage without changing persisted project schema 9.
- Refreshed PostCSS and safe transitive DOMPurify/NanoID patches; production and complete dependency audits report zero vulnerabilities.

## 1.4.0 — 2026-08-12

### Dashboard Steps alignment and guided Trade Study framing

- Advanced application and project persistence to schema 9 with non-destructive schema-8 migration.
- Added one persisted active Trade Study per project and made it authoritative for dashboard Step 3 and Step 7 status.
- Added a reusable project-level variability-axis catalogue; each axis creates and synchronizes one canonical major FeatureGroup under the single shared Root Feature.
- Added explicit adoption of existing FeatureGroups without automatically guessing that every legacy group is a variation axis.
- Replaced the KPI-only Problem Space card with the documented combined Trade Study, variability-axis and evaluation-KPI step.
- Added a guided setup with direct study framing, traceable scope selection, Root Feature management, axis management, and compact canonical KPI creation/editing.
- Moved configuration-derived alternative selection from setup to Solution Space Step 7, Compare and decide.
- Made cross-feature constraints optional when the feature model has selectable features and no unresolved errors.
- Retained immutable results after scope, axis or KPI changes while marking them stale and blocking decision approval until refreshed.

## 1.3.0 — 2026-08-12

### Scope-driven dashboard and minimal Trade Study

- Advanced persisted application and project data to schema 8 with pure migration of overall scope, selected needs/use cases and dashboard return context.
- Added a compact Template A project frame for named project creation, switching, duplication and deletion.
- Replaced dashboard rollups with three independent overall scopes and stacked Problem Space/Solution Space outcome cards using automatic Not started, In progress, Complete and Blocked states.
- Added exact editor destinations, prerequisite explanations, earliest-next-step recommendation and persistent return to the same dashboard context.
- Reduced Trade Study to a direct question, existing need/objective/active-use-case scope, automatically traced requirements, existing global KPIs and configured alternatives only.
- Enforced valid configurations, current saved 100% derivations, simulations tied to those derivations and complete current numeric KPI evidence.
- Added requirement-feasible-only normalization and preference while retaining diagnostic scores for infeasible alternatives; removed the exception route from new approvals.
- Simplified Manager and Expert views to the same evidence with different levels of detail, while preserving schema-7 comparison, sensitivity, risk, scenario and robustness history.
- Updated the industrial and coffee-machine samples with explicit current derivations and matching immutable simulation evidence.

## 1.2.0 — 2026-07-31

### Final Trade Study methodology and delivery

- Advanced persisted application and project data to schema 7 with pure, idempotent schema-6 migration.
- Added exact mandatory requirement and feature feasibility screening; infeasible and unknown alternatives remain visible but are excluded from normal feasible recommendations.
- Added feasible-only Pareto analysis and fixed SMART/MAVT stakeholder value with maximize, minimize, target, acceptable-range, and piecewise-linear functions.
- Retained historical min–max evidence as explicitly labeled legacy-relative results and added fixed-value one-factor weight sensitivity.
- Upgraded risks to 1–5 inherent/residual likelihood and impact, exposure bands, owner, status, applicability and review state; legacy qualitative risks migrate conservatively and require review.
- Added immutable named scenarios and bounded nominal, one-at-a-time, combined pessimistic/optimistic, and scenario cases without probability claims.
- Added decision-focused Manager and detailed Expert evidence views, including feasibility, Pareto, contribution, scatter, risk-matrix and robustness surfaces.
- Hardened decision approval with selected-alternative, feasibility/exception, explicit baseline, rationale, and unresolved high/critical-risk justification gates; approval captures a complete evidence snapshot.
- Replaced the default demonstration with a traceable three-alternative coffee-machine Trade Study while retaining the industrial fixture for inherited regression tests.
- Extended JSON, XLSX and PDF delivery with the final methodology evidence and added deterministic production chunk splitting.

## 1.1.0 — 2026-07-30

### Architecture Trade Study framing and ontology

- Advanced persisted application and project data to schema 6 with a pure, idempotent schema-5 migration.
- Made first-class objective elements authoritative while retaining `Project.objectives` as a compatibility projection and deterministically migrating unmatched legacy objective strings.
- Extended `Project.comparisonStudies` as the canonical Trade Study record with framing, scope, lifecycle, originating open decision, objective, mandatory requirement, explored feature, criterion, and candidate references.
- Added the separate ten-step Architecture Trade Study workflow, first/duplicate/different candidate creation, and manager/expert views.
- Added candidate evidence-readiness checks for configuration presence, validation, current 100% derivation, model revision, configured simulation, and common KPI coverage.
- Added an explicit 150%/100% evidence warning and manager-mode exclusion of non-ready alternatives.
- Added a read-only React Flow ontology and exact relationship table derived from typed immutable-ID references without adding cross-domain `ModelElement` relationships.
- Linked KPI definitions to authoritative objectives and made formal decision approval resolve the Trade Study/open question and establish the selected architecture baseline.
- Extended JSON, XLSX, and PDF delivery with Trade Study framing, criteria, candidate readiness, typed references, and baseline state.
- Preserved the existing scoring, sensitivity, risk, decision, snapshot, import/export, responsive navigation, and Stage-A/B/C behavior.

## 1.0.1 — 2026-07-30

### Stage C — Baseline security and Node.js standardization

- Replaced vulnerable `xlsx@0.18.5` with the browser entry point of `write-excel-file@4.1.1`.
- Reimplemented the existing multi-sheet XLSX export while preserving sheet names, headings, stable IDs, units, serialized arrays, export filters, stale/coverage information, optional-sheet behavior, filename, MIME type, and JSON-only import.
- Added focused archive-level XLSX regression tests using ZIP/XML inspection without an XLSX parser.
- Standardized development on Node.js 24 LTS with `.nvmrc`, package engine constraints, exact dependencies, and Codespaces instructions.
- Verified zero production and development dependency advisories, strict typecheck, 110 Stage-A/B/C tests, and the production build.
- Preserved schema 5, all Stage-A/B/C behavior, IDs, persisted projects, immutable evidence, and the established trade-study methodology.

## 1.0.0 — 2026-07-29

### Stage C — Comparison and delivery completion

- Advanced persisted application and project data to schema 5 with pure schema-4 migration, singular-to-history comparison conversion, and non-recursive lifting of legacy project-nested snapshots.
- Added exact saved-run comparison studies with study-specific KPI weights, directions and thresholds, minimize/maximize normalization, equal-value and tie handling, transparent missing-data weight renormalization, coverage, threshold violations, immutable result history, and staleness.
- Added raw, normalized, radar, weighted-score, and accessible 0–200% one-factor weight-sensitivity views.
- Added comparison risks, formal decisions, comparison-to-draft proposals, explicit selection confirmation, rationale-gated approval, and promotion of Stage-A planning questions into linked formal drafts.
- Added explicit architecture-only simulation of the canonical unconfigured 150% model in a selected architecture context.
- Added live Stage-C Dashboard rollups, deterministic recommended actions, and a quick snapshot action.
- Added application-level named snapshots with a 20-per-source limit, oldest replacement, safety restore, corrupt/recursive rejection, raw download, and isolated project duplication.
- Added scoped JSON/XLSX export with relationship closure and manifests, validated JSON import/new-project collision handling/replacement safety, SheetJS workbooks, and jsPDF reports with vector summaries and detailed tables.
- Completed the industrial assembly sample with current manual and automated runs, a saved comparison, a threshold violation, sensitivity, risks, a linked draft decision, and a named snapshot.
- Refined the shell into a full sidebar, narrow-screen icon rail, and mobile drawer, with visible focus and responsive content layouts.
- Added Stage-C automated coverage; 109 Stage-A/B/C tests, strict typecheck, and production build pass.

## 0.8.0 — 2026-07-29

### Stage B REV04 — Integrated validation and explicit engineering editors

- Consolidated project-wide findings into Model Quality with persistent severity, category, and workspace/domain filters plus navigation to affected model and variability objects.
- Made dashboard validation counters and the Variability validation action open the same authoritative filtered results.
- Replaced Variability browser prompts with responsive right-side editors using local drafts and explicit Save/Cancel actions for features, groups, constraints, variation points, configurations, 150% elements, and graph relationships.
- Added structured variation-point condition rows, safe `AND`/`OR`/`NOT` expression helpers, feature autocomplete, and existing-variation-point direct-open/chooser behavior.
- Added remembered multi-select graph filters by modeling section and element type; relationships render only when both endpoints are visible.
- Added inline authoritative process duration and parameter range/uncertainty editing, complete parameter provenance/applicability fields, and clarified engineering-input terminology.
- Added read-only explanations for every standard KPI algorithm while keeping the algorithm locked after creation.
- Standardized product and process sequence wording and oriented consumes/produces connectors consistently.
- Added explicit 150% → 100% transformation controls, current/stale guards, acknowledgement handling, and automatic navigation to the realized model after success.
- Renamed simulation history to Read-only run history while preserving immutable snapshots.

## 0.7.0 — 2026-07-28

### Stage B REV03 — Graph-based canonical MBPLE workflow

- Advanced persistence and project schemas to version 4 with pure schema-1/2/3 migration into one canonical 150% Product-Line Model.
- Migrated legacy architecture-specific applicability to visible internal features and Existence variation points while preserving model-element and relationship IDs.
- Made each active configuration own exactly one generated, name-synchronized architecture with Draft, Invalid, Configured, Realized, Stale, and Archived lifecycle states.
- Added first-class recursive organizational feature groups, a draggable feature graph, integrated requires/excludes edges, and graph checkboxes in Configurator.
- Removed the separate Constraints tab and independent architecture input from Configurator and Simulation.
- Added cross-domain graph creation of multiple variation points from element bodies, attributes, and relationship connectors.
- Made the 150% preview open without a configuration, remain fully editable, show variation markers, and optionally overlay included/modified/excluded states.
- Replaced list-only realization display with a read-only 100% graph, inspector, and optional red removed-content audit overlay.
- Added configuration-only simulation with in-memory realization for missing/stale explicit realizations and exact immutable realized element, relationship, and applied-variation snapshots.
- Added archive-on-delete behavior when historical runs exist, permanent paired configuration/architecture deletion otherwise, and an archived-history section.

## 0.6.0 — 2026-07-28

### Stage B REV02 — Essential MBPLE cycle

- Advanced persistence and project schemas to version 3 with pure schema-1/2 migration of legacy element feature expressions into first-class existence variation points.
- Added Boolean and enumerated feature values, external/internal variability classification, and complete configuration value records.
- Added reusable variation points that can constrain multiple elements or relationships with safe feature expressions and typed value conditions.
- Added explicit realization scope with an entire-model default and optional requirements, structure, behavior, process, resources, or verification domains.
- Implemented Existence, Primitive Property, Primitive Tag, and Element Property realization effects using whitelisted property paths and ordered value rules.
- Added a non-mutating, configuration-aware 150% preview with common, included, excluded, and modified states.
- Added immutable 100% realized element/relationship snapshots, cascade-cleanup warnings, modified-content tracking, and an applied-variation audit.
- Changed KPI pre-sizing and simulation to consume the realized 100% snapshot and require a compatible current configuration realization.
- Added an automation-dependent process-duration sample effect so variant-specific lead-time analysis reflects realized property changes.
- Expanded automated coverage from 67 to 73 tests, including migration, typed feature values, modification effects, retargeting, tags, scope, and the realized-analysis guard.

## 0.5.0 — 2026-07-27

### Stage B — Variability and pre-sizing

- Advanced persisted and project schemas to version 2 with pure, non-mutating, idempotent schema-1 migration and recovery behavior.
- Added deterministic feature hierarchy, XOR/OR groups, constraints, safe feature expressions, configuration validation, manual/automatic/effective selection states, and reference-aware feature deletion.
- Added architecture-compatible non-mutating 150%-to-100% derivation, immutable source snapshots, relationship removal tracking, validation snapshots, KPI values, and staleness.
- Added consolidated parameter editing, authoritative process durations, per-assignment resource quantities, configuration applicability, ranges, uncertainty, source, and value-origin presentation.
- Added a safe KPI formula AST, exact parameter/KPI references, dependency cycles, conservative symbolic units, and preview.
- Added mass, cost, power, critical-path lead time, resource demand, utilization, and throughput-proxy algorithms.
- Added immutable simulation runs with editable automatic names, rederivation flow, warning acknowledgement, exact KPI IDs, complete input snapshots, source disclosure, and stale history.
- Extended the industrial assembly sample with the specified feature model, constraints, three configuration presets, realistic parameter/resource inputs, Total Power, and differentiated variants.
- Added Stage-B validation rules and expanded automated coverage from 46 to 67 passing tests.

## Unreleased — Stage A REV01 product-flow correction

- Split product input/output definition from process sequence/handoff work in the guided workflow, increasing it to twenty-three steps.
- Added a dedicated process-context editor for creating and updating consumed/produced product components, positive quantities, units and optional item-flow names.
- Enforced process-role semantics: start functions produce; intermediate and isolated functions consume and produce; end functions consume.
- Required every process precedence link to hand off at least one matching product component from predecessor output to successor input.
- Added handoff unit-mismatch errors and quantity-mismatch warnings so split, merge and transformation cases remain permissible.
- Emphasized consumed and produced flows in process diagrams with direction-specific colors, item-flow names, quantities and units.
- Expanded automated coverage to 46 passing tests.

## 0.4.0 — 2026-07-27

### Stage A — REV_02 review corrections

- Centralized the seven modeling-section projections so tables, graphs and matrices use one explicit type/view configuration.
- Kept every current-section element visible before it has traceability, while retaining the selected use-case scope as a visual highlight.
- Separated architecture/hierarchy graphs from functional sequence diagrams and limited sequence views to product/process functional sections.
- Added persistent per-view manual node positions, top-down hierarchy layout and left-to-right sequence layout.
- Enforced child→`refines`→parent hierarchy semantics and automatically reconciled member refinement links when a sequence parent changes.
- Clarified product and industrial technical hierarchy as component-to-component refinement; function allocation remains `realizedBy`.
- Made matrices direction-aware so either endpoint can initiate a link while the canonical direction is stored.
- Added verification methods to the requirements projection and a global fourteen-type Interfaces and Traceability matrix/graph.
- Added nested parameter rows and requirement-to-parameter selection in matrices, storing immutable formula IDs and canonical satisfaction to the parameter owner.
- Added visible nested parameters and working-scope status to graphs and matrices.
- Expanded automated coverage to 41 passing tests.

## 0.3.0 — 2026-07-27

### Stage A — Reviewed workflow, formulas, diagrams and function sequences

- Replaced the ten-card workflow with twenty-two clickable mission-to-validation steps and persistent system-of-interest use-case scope.
- Added workflow navigation into contextual model tabs, views, element filters and validation guidance.
- Added `hasFunction` from use cases to product/process functions.
- Added mission as the first traceability-recap column and property opening from recap/matrix elements.
- Added direct/indirect four-domain evidence propagation through canonical function→`realizedBy`→component pairs.
- Added requirement-to-function diagrams for product and process views and requirement-to-component diagrams for both technical views.
- Added needs and objectives to the requirements architecture graph.
- Added per-element-type persistent drag ordering with temporary A–Z/Z–A sorting.
- Added calculated parameters for product and industrial components, limited to owner/transitive-refiner parameter IDs.
- Added safe arithmetic with `sqrt`, powers, dimensional inference, compatible output conversion, pending variables and dependency-cycle detection.
- Added an ISO 80000-aligned practical unit catalogue and project-defined custom dimensions/conversion factors.
- Added named, architecture/use-case-contextual product and process sequences with same-level hierarchy rules.
- Added DAG sequencing, parallel AND split/join semantics, multiple boundaries, derived stage labels and synchronized graph/table editing.
- Preserved schema 1 and added non-destructive normalization defaults for existing Stage-A localStorage.
- Expanded automated coverage to 33 passing tests.

## 0.2.0 — 2026-07-23

### Stage A — Mission-to-validation scope amendment

- Added fourteen explicit modeling types and the clarified canonical relationship directions.
- Added the ten-step guided, non-blocking mission-to-validation workflow.
- Added unique system-of-interest designation and deterministic mission fulfillment.
- Added four-domain requirement evidence and stakeholder traceability recap.
- Added safe requirement formulas with stable parameter/KPI bindings, arithmetic, comparisons and unit compatibility.
- Added pending/failure propagation with AND-semantics across all linked requirements.
- Added item-flow names, quantities and units to process-function consumes/produces relationships.
- Added typed reusable custom-attribute columns and visible table parameters.
- Added inline table editing, type selection on row creation, tag suggestions and consistent type colors.
- Added relationship endpoint editing, graph edge creation, graph details editing, editable matrix cells and use-case interaction diagram.
- Added additive schema-1 normalization for existing Stage-A data while preserving the Stage-B migration contract.
- Expanded automated coverage from 17 to 26 tests.
- Updated Vite, Vitest and PostCSS to audited exact versions; npm audit now reports zero vulnerabilities.

## 0.1.0 — 2026-07-23

### Stage A — Modeling foundation

- Created the React, TypeScript, Vite, and Tailwind application shell.
- Added all seven workspaces and the four Model tabs.
- Added canonical schema-1 project state and forward-compatible Stage B/C types.
- Added versioned local persistence, pure migration validation, debounced autosave, and corrupt-storage recovery.
- Added project, architecture, element, parameter, and relationship management.
- Added architecture scope and baseline invariants.
- Added filtered relationship grammar, quantity validation, cascade deletion, and process-cycle rejection.
- Added editable model tables, React Flow graph, traceability matrix, connected-item navigation, search, and filters.
- Added the Prompt-A validation engine, six traceability metrics, model completeness, approval maturity, and overall maturity.
- Added the editable configurable industrial assembly machine sample.
- Added 17 automated domain and render tests.
- Added the Stage A acceptance record and Codespaces setup instructions.
