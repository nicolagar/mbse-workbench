# Ontology and usability update — 1.8.0 / schema 14

Implemented through `04_updated_ontology_v02`. Schema 13 introduced canonical `hasSOI`; schema 14 retains that ontology and refines the workflow and evidence presentation.

The workbench remains an educational MBSE/MBPLE demonstrator. This update improves the meaning of its records and checks; it does not introduce a formal SysML implementation or claim an official MUSE framework.

The connected-context implementation and both sample acceptance results are recorded in the [senior systems-engineering review](ONTOLOGY_REVIEW.md).

Version 1.8 retains the existing ontology semantics and simplifies how users navigate and inspect them. Interfaces and Traceability are separate Model sections; table and matrix filters remain projection-only UI state. Every Model section has a recap whose expectations are derived from canonical rules and upstream content rather than fixed counts. Architect presents the accumulated model through the current question in semantic left-to-right layers and intentionally omits parameter and evidence details. A separate Project Recap presents the current mission-to-decision outcome without creating another stored model.

Schema 14 removes live project-level assumption records and stops writing assumption fields into new simulation runs. This is a forward workflow change, not a historical rewrite: schema-13 imports discard the former live project assumption list while preserving every assumption string already stored in an immutable legacy `SimulationRun`. Qualitative requirement reviews marked “assumed for demonstration,” parameter provenance, risks, uncertainties, warnings, decisions and historical evidence snapshots retain their established meaning.

## Page changes

| Correction | Existing page location | Result |
| --- | --- | --- |
| 1. System boundary and context | Mission and Context; existing system/use-case editor; Architect setup | The system has its own type, boundary and root assembly. People and organizations remain stakeholders; external systems have a separate type. Use cases name their subject system. Every sample external system has a stored `Mission → participatesInMission → External System` relationship. |
| 2 + 3. Traceability and assessment together | Modelling Overview; Requirements & Validation Overview; existing requirement editor | The complete nine-column recap follows the model from mission and context to validation. The focused five-column requirement recap is available only in Requirements and Validation. Numerical checks run automatically. A qualitative requirement uses one answer: not checked, met by review, not met by review, or assumed for demonstration. |
| 4. Baseline obligations and study focus | Existing study setup, feasibility results and Architect review | Focus highlights relevant requirements one per row; every baseline requirement remains an obligation. The reference architecture is recorded separately from the preferred alternative and the panel explains what the reference does and does not change. |
| 5. Physical structure and engineering quantities | Existing component/parameter editor and mass KPI card | Parts have an explicit parent assembly. Mass contributions carry accounting and quantity explanations. The calculator uses the product boundary, converts compatible units and reports missing or double-counted inputs. |
| 6. Configuration validity and engineering eligibility | Existing configuration, derivation, simulation and comparison areas | The emphasized Configuration Recap separates feature choices, 100% architecture currency, model consistency, requirement results and explicit Trade-off Study eligibility. Simulation repeats the same eligibility result. Conflicting value rules block derivation; fallback behavior is explicit. |

No new navigation workspace or guided phase was added. The existing **Requirements and Validation** label is retained. **Model Digital Thread** is available in every Model section and **Requirements & Validation Overview** only in its relevant section. The old recap embedded in traceability matrices was removed. The numerical review question is removed; the qualitative result replaces the existing confirmation rather than adding a question.

## Overview behavior

The **Model Digital Thread** is a single end-to-end table with these columns:

1. Mission.
2. System of interest, stakeholder or external system.
3. Need or objective.
4. Requirement.
5. Product function.
6. Product component, parameter or interface.
7. Process function.
8. Industrial component, interface, parameter or resource.
9. Validation result.

The **Requirements & Validation Overview** retains the focused requirement-oriented five fields:

1. Why is it needed? Stakeholders, linked needs/objectives and use cases.
2. What must be achieved? The requirement and its stable ID.
3. What addresses it in the product? Explicitly allocated functions, their realizing components and the parameter inputs behind the calculation.
4. What supports it industrially? Connected processes, workplaces/equipment and resources.
5. What is the result? The calculated or reviewed result, its basis and the planned check method.

A link or a verification-method definition cannot establish a pass. A changed requirement or connected design makes an existing qualitative review require an update. Clicking an element opens the existing editor. The requirement-focused footer shows the recorded study decision and flags historical evidence when the model revision changes. Small screens keep both tables within their cards without creating page-level horizontal overflow.

## Sample behavior

The coffee-machine example retains three populated configurations. The OHSC example retains four configurations and all 30 requirements: 18 numerical checks and 12 explicit demonstration assumptions.

| OHSC configuration | Modeled mass | 32 kg limit | Qualitative basis | Eligibility |
| --- | ---: | --- | --- | --- |
| Standard A | 31.5 kg | Met | 12 declared assumptions | Eligible under demo assumptions |
| Capacity Upgrade | 34 kg | Not met | 12 declared assumptions | Ineligible |
| Balanced Modular | 29 kg | Met | 12 declared assumptions | Eligible under demo assumptions |
| Lightweight Rapid-Install | 24.5 kg | Met | 12 declared assumptions | Eligible under demo assumptions |

Standard A remains the study's accepted reference. Balanced Modular remains the recorded preferred alternative. These records have different purposes.

Sample assembly roots make the physical boundary explicit. OHSC industrial handoffs follow successive work states of the assembly, so excluding optional assist hardware does not break the production flow. The existing allocation links still identify the parts worked on at each process.

## Data and migration

- Schema 13 replaced the live System `missionId` reference with the canonical `Mission --hasSOI--> System` relationship. Schema 14 retains that relationship and the schema-12 physical-containment metadata, use-case subject and architecture-root references, requirement review records, authored formula units, baseline requirement IDs, reference architecture and variability fallback fields.
- Physical containment reuses `refines` with an explicit `containment` marker. The graph labels these edges “part of”. `participatesInMission` is a normal stored relationship and can be created, inspected, exported and deleted through the same relationship mechanisms as the other canonical links.
- Existing system-proxy IDs are retained. Their type becomes `system`; their former participation links become use-case subject references.
- Schema migrations preserve older projects through schema 14. Legacy System `missionId` references and former mission-to-SOI `hasStakeholder` links are converted to `hasSOI` without rewriting historical simulation or decision snapshots. Former live project assumptions are not carried into schema 14, but assumption evidence already stored on historical simulation runs is preserved byte-for-byte. The former `interfaces-traceability` view state opens as `traceability`. Existing simulation and decision snapshots remain unchanged, and older derivations become stale only under the established model-revision rules.
- A legacy “confirmed” check method does not become a completed qualitative review. Only the bundled example builders seed the clearly labeled demonstration assumptions.
- Unit-only parameter edits convert both the entered value and targeted numeric variation effects. Requirement formulas retain the units used when their bindings were authored, preserving physical limits when display units change.
- Complete project save/load retains the new fields. Selective exports include context references with endpoint closure, or omit incomplete context references when that export policy is chosen.

Qualitative judgments remain human assessments. Numerical results remain preliminary calculations over the modeled scope. Assumed acceptance is a declared demonstrator policy, and the UI shows it as such.

## Verification

- Production TypeScript/Vite build passed.
- Automated suite: 249 tests across 20 files. It includes canonical mission-participation assertions, connected-model and endpoint assertions, schema-13-to-14 legacy-evidence migration, both scope examples, 100% traceability-metric checks and rendered relationship/recap controls.
- Rendered DOM tests cover the sticky/filterable matrix and overview controls, shared header actions, collapsible navigation, fixed editor surface, configuration hierarchy and the scope-aware Architect completion path.
- The cloud browser used for final review could not access the container-local preview, so version-1.8 browser screenshots were not claimed as acceptance evidence. Production rendering remains gated by the successful build and component-level responsive contracts until the branch is deployed.
- Historical run/decision preservation, schema migration idempotence, complete-project references, unit conversion, direct mass analysis, assembly boundaries, missing mass, double counting and conflicting variation rules are covered by automated checks.
