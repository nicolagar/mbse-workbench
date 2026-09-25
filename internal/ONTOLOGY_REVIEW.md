# Senior systems-engineering review — connected demonstrator model

## Review position

The workbench now provides a coherent, inspectable digital thread for its intended purpose: demonstrating MBSE and MBPLE benefits to non-specialists in a browser. It is a deliberately small ontology, not a SysML interchange model, a certification record, or a proposed official MUSE framework. The acceptance criterion is therefore consistent meaning, visible relationships, repeatable calculations and honest evidence status—not coverage of every construct in a formal modeling language.

The review used the lifecycle logic in the NASA Systems Engineering Handbook and the separation of requirements, behavior, structure and verification embodied by OMG SysML as reference points. The implementation remains a pragmatic, SysML-inspired subset.

## Six corrections and their implementation

| Correction | Engineering problem removed | Implemented model rule | Where it is visible |
| --- | --- | --- | --- |
| 1. System boundary and operational context | A system of interest represented as a stakeholder has no defensible boundary or context | `system` and `externalSystem` are distinct from stakeholders. The mission identifies the system through canonical `hasSOI`; the system records its physical root, and use cases record their subject. External systems have canonical `participatesInMission` relationships and connect through boundary interfaces. | Mission and Context graph/matrix, element details, connected-elements panel and Modelling Overview |
| 2 + 3. One traceability and assessment thread | A recap embedded in every matrix obscures both model navigation and the line from intent to evidence | Modelling Overview follows the complete mission-to-validation thread. Requirements & Validation Overview presents the focused intent → requirement → product → industrial support → result chain. Numerical results are calculated. Qualitative results use the one existing review answer, including an explicit demonstrator-assumption state. | Modelling Overview in every Model section; focused overview only in Requirements and Validation; no new phase or workspace |
| 4. Baseline obligations versus study focus | Filtering a trade study can accidentally appear to remove obligations | Study focus only controls attention. Baseline requirements remain applicable to every compared architecture. Reference architecture, preferred alternative and approved baseline are separate records. | Study setup, requirement results, comparison eligibility and decision footer |
| 5. Physical structure and engineering quantities | An unbounded or double-counted mass total is not credible engineering evidence | The product root defines the accounting boundary. Components record containment, contribution and quantity basis. Compatible units are converted and missing, duplicate or out-of-bound contributions are reported. Formula KPIs retain the evaluated physical unit. | Component/parameter details, KPI results, validation and recap result basis |
| 6. Configuration, derivation, evidence and decision states | A valid feature selection can be confused with an acceptable engineering solution | Feature validity, 100% derivation currency, model consistency, requirement results, trade-study eligibility and approval are evaluated independently. Eligibility includes a plain-language reason and appears consistently in Configurator and Simulation. Conflicting variation assignments block derivation and fallback behavior is explicit. | Emphasized Configuration Recap, derivations, Simulation, comparison and decision |

Mission-to-system assignment and external-system participation are canonical `Project.relationships` records: `hasSOI` and `participatesInMission`. They use the same editing, export, graph and matrix mechanisms as every other stored link. Use-case subject-system and architecture-root references remain projections of typed metadata and appear as dashed teal links in graphs and teal read-only cells in matrices. External-system interface connections are also included in the default Primary structure view because they define the operational boundary.

## Sample review

### Coffee-machine example

The example now begins with the operational use case **Prepare a coffee beverage** and an explicit coffee-machine system boundary. The consumer remains an actor, while household electrical supply, refill water and the receiving vessel are external systems. Power and water cross named product interfaces; internal product functions and components connect to the corresponding interfaces. Manufacturing use cases remain separate from product behavior.

All three configurations have current 100% derivations, simulations and requirement evidence:

| Configuration | Empty mass | Estimated cost | Beverage throughput | Decision state |
| --- | ---: | ---: | ---: | --- |
| Essential Capsule | 6 kg | €130.25 | 10 beverage/h | Selected feasible baseline |
| Balanced Home | 8 kg | €240.33 | 12 beverage/h | Feasible alternative |
| Automated Barista | 11 kg | €426.46 | 14 beverage/h | Feasible alternative |

The sample's three numerical requirements are linked to design parameters or calculated KPIs and their verification methods. Purchased, integrated and verified product states are explicitly outside the product mass boundary, preventing them from being counted as extra physical assemblies.

### OHSC aircraft example

The **Configurable OHSC Installation Segment** is an explicit system, linked to its mission, operational use cases and **Configurable OHSC Installation Segment assembly** root. Aircraft structure, cabin trim, passenger-service/lighting installation, environmental-control ducting and the passenger oxygen system are external systems connected through named boundary interfaces. Product and industrial interfaces also connect to the internal components or functions that use them.

All 30 baseline requirements remain present: 18 have numerical formula checks and 12 have clearly labeled qualitative demonstrator assumptions. The four configurations retain current derivations, simulations and decisions:

| Configuration | Modeled mass | 32 kg limit | Qualitative basis | Eligibility |
| --- | ---: | --- | --- | --- |
| Standard A | 31.5 kg | Met | 12 declared assumptions | Eligible under demo assumptions |
| Capacity Upgrade | 34 kg | Not met | 12 declared assumptions | Ineligible |
| Balanced Modular | 29 kg | Met | 12 declared assumptions | Eligible under demo assumptions |
| Lightweight Rapid-Install | 24.5 kg | Met | 12 declared assumptions | Eligible under demo assumptions |

Standard A remains the accepted reference architecture. Balanced Modular remains the recorded preferred successor. Keeping those facts separate avoids rewriting the baseline merely because a study recommends a change.

## Traceability acceptance

| Check | Coffee | OHSC |
| --- | ---: | ---: |
| Elements | 49 | 152 |
| Stored relationships | 97 | 557 |
| Typed context references | 6 | 10 |
| External systems | 3 | 5 |
| Unconnected elements after stored + typed references | 0 | 0 |
| Dangling relationship endpoints | 0 | 0 |
| Stakeholder/need/requirement/product/industrial/verification metrics | 100% | 100% |

“Full traceability” here means that every sample element participates in the demonstrator's connected model; every stored relationship resolves to existing endpoints; contextual typed references resolve; every requirement can be followed from rationale through applicable design and evidence; and configuration decisions point to immutable derivation/run evidence. It does not mean that an assumed qualitative result has become verified evidence. The interface presents that distinction explicitly.

## Appropriate remaining simplifications

The following can stay because removing them would make the demonstrator harder to understand without materially improving its teaching objective:

- the compact element and relationship vocabulary rather than full SysML metaclasses and interchange;
- metadata-backed typed references for system assignment, use-case subject and architecture representation, while external-system mission participation remains a canonical stored relationship;
- qualitative OHSC results declared as demonstration assumptions instead of invented test artifacts;
- early-phase deterministic calculations rather than certified discipline models, uncertainty propagation or detailed exchange-item/port semantics;
- one recap table and one existing qualitative question rather than dedicated requirement, verification and compliance workflows.

Saved projects created with an older sample are not silently overwritten. Loading either bundled example creates the reviewed current sample, while persistence migration preserves user-authored data and historical evidence.

## Reference basis

- [NASA Systems Engineering Handbook](https://www.nasa.gov/reference/systems-engineering-handbook/)
- [OMG Systems Modeling Language 1.6](https://www.omg.org/spec/SysML/1.6/About-SysML/)
