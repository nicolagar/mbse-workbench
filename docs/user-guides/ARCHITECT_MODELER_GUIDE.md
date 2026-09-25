# Architect and Modeler views - user guide

Applies to application version 1.8.0, schema 14, on branch `04_updated_ontology_v02`.

## Introduction - purpose and page structure

The MBSE / MBPLE Workbench helps a small engineering team turn a mission into a traceable early design. It connects stakeholder needs and objectives to requirements, product and industrial-system architectures, engineering parameters, simulations, configurable alternatives and a recorded decision. It is a programme-preparation demonstrator: use it to structure and compare preliminary concepts, not to certify a detailed design.

The same project can be opened through two perspectives:

- **Architect view** is a guided interview. It shows one question at a time, explains what the answer means, gives an example and writes the confirmed answer into the project model.
- **Modeler view** exposes the complete dashboard and direct editors. Use it to inspect or refine tables, graphs, sequences, matrices, formulas, variability, simulations, comparisons, decisions and exports.

The perspectives are not separate applications. They read and update the same canonical project. A component created in Architect view is immediately visible in Modeler view; a relevant Modeler edit marks only the dependent Architect answers for review. Switching perspectives does not duplicate or discard model content.

On first launch the application contains one empty project. Choose a perspective, create or rename the project, or select the visible **Load example** action. **Save Project** downloads a portable project file. **Load Project** imports or replaces a project after validation. **Reset all** removes the browser's local projects and should be used only when that is intended.

### The three scopes

| Scope | Choose it when | Where the guided path ends |
|---|---|---|
| Architecture definition | You need a traceable product and industrial-system architecture. | Architecture readiness and validation recap. |
| Architecture and simulation | You also need KPI results for the current canonical architecture. | One immutable simulation and its evidence recap. |
| Trade-off | You need configurable alternatives, 100% derivations, comparable simulations and a baseline decision. | Comparison, decision and final recap. |

### How the pages are organised

In **Architect view**, the header contains project controls, Save/Load, sample/reset actions and the switch to Modeler view. The left progress panel shows the selected scope, confirmed-question count, section status and current readiness. The centre shows the question, answer control, guidance, example, validation message, Back, Skip and Continue. Required questions may be skipped temporarily, but the project cannot become Ready until their evidence is complete. Changing an answer that already created model content opens an impact review before the change is applied.

In **Modeler view**, the left navigation opens Project Workflow, Project Recap, the eight expandable Model sections, Variability, Parameters and KPIs, Simulation, Architecture Trade Study, Delivery and Model Quality. The shared header controls the active project and perspective; architecture context is selected only inside workspaces that need it. Project Workflow is the recommended route: it separates Problem Space from Solution Space, shows Not started/In progress/Complete/Blocked status and links each activity to its exact editor. Single-click selects a workflow step and displays its details in place; double-click also moves the selected detail into view.

The workbench follows this plain-language chain:

`Mission -> System of Interest and participants -> Stakeholder intent -> Use Case -> Requirement -> Function -> Component -> Parameter or verification evidence -> Simulation/KPI -> Alternative comparison -> Decision`

## How to answer Architect questions

The number of visible questions changes with the chosen scope and with the items you create. Questions marked "per item" repeat for each stakeholder, use case, requirement, function, component, KPI, feature axis or alternative.

### Study setup and intent (AV-A01 to AV-B07)

| Question | What to enter or select | What it changes |
|---|---|---|
| AV-A01 - project aim | Describe the intended project outcome and why the work is being undertaken. | Stores the authoritative project description before scope selection. |
| AV-A02 - study scope | Choose Architecture definition, Architecture and simulation, or Trade-off according to the decision you need to support. | Sets how far the guided workflow continues. Existing project data is preserved when scope changes. |
| AV-A03 - study name | A short unique project name, such as `Office coffee-machine concept`. | Renames the active project. |
| AV-A04 - mission | One clear sentence describing the system's purpose and the problem it solves. Avoid listing a preferred solution. | Creates or updates the Mission element. |
| AV-B01 - stakeholders | Semicolon-separated people or organisations whose concerns matter. Do not enter the system being designed as a stakeholder. | Creates Stakeholder elements and canonical mission-participation links. |
| AV-A05 - system of interest | Enter the name of the system being designed or analysed. | Creates or updates the dedicated System element and its canonical `hasSOI` link from the Mission; use cases refer to the System as their subject. |
| AV-B06/B07 - external systems and roles | Enter external-system names, then describe each system's role or boundary interaction. | Creates External System elements and canonical Mission `participatesInMission` links; those systems can later receive `involvedIn` links to use cases. |
| AV-B02 - stakeholder role | Describe why each stakeholder matters. | Updates documentation only; it creates no relationship and changes no calculation. |
| AV-B03 - stakeholder needs | Desired outcomes or problems from that stakeholder's viewpoint, separated by semicolons. | Creates Need elements linked to the stakeholder. |
| AV-B04 - stakeholder objectives | Measurable improvements or targets, separated by semicolons. | Creates Objective elements linked to the stakeholder. |
| AV-B05 - intent recap | Confirm only after mission, stakeholders, needs and objectives describe the study correctly. | Records review; it does not override validation findings. |

### Use cases and working scope (AV-C01 to AV-C05)

| Question | What to enter or select | What it changes |
|---|---|---|
| AV-C01 - use cases | Short action-oriented scenarios, separated by semicolons, such as `Prepare beverage; Perform maintenance`. | Creates Use Case elements. |
| AV-C02 - participants | For each use case, select all involved stakeholders, including the system of interest where applicable. | Creates use-case participation links. |
| AV-C03 - addressed intent | Select only the needs/objectives actually addressed by that use case. | Creates canonical `addresses` relationships. |
| AV-C04 - analysis scope | Select the use cases this study will analyse. Only eligible cases involving the system of interest are offered. | Sets the persistent working use-case scope. |
| AV-C05 - scope recap | Check participants, addressed intent and active cases. | Records review and exposes missing scope evidence. |

### Requirements (AV-D01 to AV-D10)

| Question | What to enter or select | What it changes |
|---|---|---|
| AV-D01/D02 - requirements from needs/objectives | Testable statements. Reuse an existing requirement when it expresses the same obligation; otherwise add a new one. | Creates System Requirement elements and canonical `derives` links. |
| AV-D03 - relevant use cases | Select the active use cases in which each requirement applies. | Stores guided applicability context. |
| AV-D04 - quantitative or qualitative | Select quantitative when a number and comparison can test the requirement; qualitative when inspection, demonstration or another non-numeric judgement is appropriate. | Chooses the formula or verification path. |
| AV-D05 - quantitative check | Enter measured property, semantic key, operator, target and unit. Example: `mass`, semantic key `mass`, `<=`, `12`, `kg`. | Creates a formal requirement formula intent. It does not invent an actual value. |
| AV-D06 - actual-value source | Select the function/component that owns the measured property, or leave ownership for later architecture work. | Binds the formula intent to an authoritative model owner when one exists. |
| AV-D07 - preliminary value | Enter a value only when supported; include unit, source, origin and optional uncertainty/range. Otherwise leave it pending. | Creates or updates the owner's parameter and evidence fields. |
| AV-D08 - qualitative verification | Name an analysis, inspection, demonstration or test and describe what will be checked. | Creates or updates a Verification Method. |
| AV-D09 - importance | Mandatory means failure makes an alternative infeasible; Important and Desirable express lower decision priority. | Sets the requirement class. |
| AV-D10 - requirement recap | Confirm origins, wording, formula/verification path and ownership. | Records review without forcing a passing result. |

### Trade framing and early KPI intent (Trade-off only: AV-T01 to AV-T06, then AV-I01 to AV-I07)

| Question group | What to enter or select | What it changes |
|---|---|---|
| AV-T01/T02 - study and decision | A short Trade Study name and one explicit decision question comparing feasible concepts. | Creates/updates the active Trade Study and its open decision context. |
| AV-T03 - common content | Capabilities or solution elements required in every alternative; exclude things that vary. | Proposes mandatory common features. |
| AV-T04 - variation areas | Independent choice areas such as brewing technology or interface type, not whole alternatives. | Proposes reusable variability axes. |
| AV-T05 - concepts | At least two alternative names with short descriptions. | Creates configuration intents used later. |
| AV-T06 - framing recap | Verify decision, common content, variation axes and concepts. | Records review. |
| AV-I01 - evaluation results | Select only KPIs needed to judge the objectives. | Creates/selects canonical KPI definitions; it does not run analysis. |
| AV-I02 - KPI purpose | Link each KPI to the needs/objectives it measures. | Updates KPI objective links. |
| AV-I03 - calculation method | Use a standard algorithm when its meaning and inputs fit; otherwise choose a guided formula. | Sets the KPI calculation mode. |
| AV-I06 - interpretation | Enter output unit, minimize/maximize direction, target and optional acceptable bounds. | Defines how the KPI is read. |
| AV-I07 - global weight | Enter a finite non-negative weight. At least one selected KPI must be greater than zero. | Sets the reusable KPI default weight. |

### Product behavior and product architecture (AV-E01 to AV-F06)

| Question group | What to enter or select | What it changes |
|---|---|---|
| AV-E01/E02 - product functions and order | For each use case, enter product functions in normal execution order; then correct the proposed sequence if needed. | Creates Product Function elements, use-case `hasFunction` links, a contextual sequence and cycle-free `precedes` links. |
| AV-E03 - function satisfaction | Select requirements directly helped by each function; leaving a function unlinked is allowed when justified. | Creates requirement `satisfiedBy` links. |
| AV-E04 - product-behavior recap | Check use-case coverage, sequence and requirement links. | Records review. |
| AV-F01 - realizing components | Name one or more physical/logical product components that perform each function. | Creates Product Component elements and `realizedBy` links. |
| AV-F02 - component satisfaction | Select requirements directly satisfied by each component. | Creates requirement `satisfiedBy` links. |
| AV-F03/F04 - parameter owner/value | Select the authoritative product function/component for a pending measured property; then enter value, unit, source and origin if known. | Creates or reuses one canonical parameter and binds the requirement formula. |
| AV-F05 - product interaction | When useful, select another product component, name the interface and describe exchanged material, energy or information. | Creates Interface content and canonical links. |
| AV-F06 - product-architecture recap | Check function realization, interfaces, parameters and satisfaction. | Records review and exposes gaps. |

### Industrial behavior and industrial architecture (AV-G01 to AV-G12)

| Question group | What to enter or select | What it changes |
|---|---|---|
| AV-G01/G02 - process functions and order | For each use case, enter industrial-system process functions such as positioning, fastening or inspection, then verify their order. Leave blank for a genuinely product-only case. | Creates Process Function elements, `hasFunction`, sequences and `precedes` links. |
| AV-G03 - process satisfaction | Select requirements each process function helps satisfy. | Creates requirement `satisfiedBy` links. |
| AV-G04 - realizing equipment | Name the workstation, equipment or plant element that performs each process function. | Creates Industrial System Components and `realizedBy` links. |
| AV-G05/G05A/G05B - industrial evidence | Select satisfied requirements; resolve any property owned by an industrial function/component and enter evidence if known. | Creates satisfaction links and canonical parameters. |
| AV-G06 - duration | Enter the authoritative process duration, time unit, source, origin and optional uncertainty. | Updates process metadata used by lead-time, cost and resource calculations. |
| AV-G07/G08 - consumed/produced product | Select product components and enter positive quantity and unit. | Creates canonical `consumes` and `produces` flows. |
| AV-G09/G10 - resources | Name required people, roles, skills, tools, machines, software or facilities; then enter quantity, unit, optional rate, capacity and availability. | Creates Resource elements and industrial-component `requiresResource` links with quantitative metadata. |
| AV-G11 - industrial interaction | Add only meaningful material, energy or information exchanges between industrial components. | Creates interface content and links. |
| AV-G12 - industrial recap | Check realization, sequence, handoffs, duration and resources. | Records review and exposes model-quality gaps. |

### Traceability and readiness (AV-H01 to AV-H04)

| Question | What to enter or select | What it changes |
|---|---|---|
| AV-H01 - verification | For every requirement, identify a credible analysis, inspection, demonstration or test; optionally allocate a process function. | Creates/updates Verification Methods and `verifies`/allocation links. |
| AV-H02 - satisfying evidence | Select at least one compatible function, technical component or existing owned parameter. Do not create a second parameter here. | Creates satisfaction links or binds the selected parameter and its owner to the requirement formula. |
| AV-H03 - evidence credibility | Confirm only when value, target, unit, source, origin and verification are credible; otherwise mark pending. | Records an explicit evidence-review state. |
| AV-H04 - architecture readiness | Review intent, behavior, realization, satisfaction, flows, resources and verification. | Calculates readiness from the model; confirmation cannot hide blockers. |

### Simulation questions (Architecture and simulation: AV-I01 to AV-I12)

After choosing KPIs and their purpose/calculation/interpretation as described above:

| Question group | What to enter or select | What it changes |
|---|---|---|
| AV-I04/I05 - exact calculation | Confirm the inputs used by a standard algorithm, or build a formula by inserting named parameters/KPIs. | Stores no duplicate values; formulas keep immutable IDs. |
| AV-I08 - missing inputs | Select every authoritative contributing owner and enter separate value, unit, source, origin and optional uncertainty. | Creates/updates canonical parameters used by the KPI. |
| AV-I11 - run | Enter a meaningful run name and execute. | Validates inputs and creates one immutable Simulation Run. |
| AV-I12 - Simulation Results | Confirm only after KPI results, requirement status, warnings and sources match the intended analysis. | Records review of current evidence. The current architecture is selected automatically. |

### Variability and 100% configurations (Trade-off only: AV-J01 to AV-K05)

| Question group | What to enter or select | What it changes |
|---|---|---|
| AV-J01/J02 - family and common features | Name the complete product line and confirm mandatory capabilities shared by all alternatives. | Creates one Root Feature and mandatory child features. |
| AV-J03/J04 - axes and choices | For each variation area, list choices and select XOR, OR, optional or typed mode; list allowed values for typed axes. | Creates synchronized Variability Axes, FeatureGroups and Features. |
| AV-J05 - constraints | Add only necessary `requires` or `excludes` rules. | Prevents invalid feature selections. |
| AV-J06 - element applicability | Map only genuinely variable requirements/functions/components/processes/resources/verification methods to a feature; unlisted elements remain common. | Creates existence applicability using the existing variation mechanism. |
| AV-J07/J08 - property variation and domain | Map a feature to a changed existing parameter value and select affected model domains when needed. | Creates typed Variation Points with exact target and realization scope. |
| AV-J09 - 150% recap | Check family completeness, hierarchy, constraints, applicability and property changes. | Records review. |
| AV-K01 - configuration | For each concept, choose one value for every required group and any optional features. | Creates/updates a Configuration. |
| AV-K02/K03 - invalid selection | Apply a proposed required-feature correction or return to the choices. | Keeps invalid drafts visible but blocks derivation/simulation until valid. |
| AV-K04 - derive | Review included, excluded and modified content, then derive. | Creates immutable 100% realization evidence without changing the 150% source. |
| AV-K05 - realization recap | Compare selected features with included/excluded elements and applied property changes. | Confirms the current derivation. |

### Simulate, compare and decide (Trade-off only: AV-S01 to AV-L10)

| Question group | What to enter or select | What it changes |
|---|---|---|
| AV-S01 - readiness | Verify every intended alternative has a valid configuration and current 100% derivation. | Identifies blockers; it creates no run. |
| AV-S03/S04 - comparable simulation | Run the same KPI set for every alternative, then review coverage, units, warnings and sources side by side. | Atomically creates one immutable configured Simulation Run per alternative; no partial batch is stored. |
| AV-L01/L02/L03 - comparison set | Select at least two eligible alternatives, mandatory feasibility requirements and comparable KPIs. | Sets the active study's evidence basis. |
| AV-L04/L05 - priorities and limits | Set study-specific KPI weights, preferred direction and optional warning/hard thresholds. | Updates study settings without changing global KPI definitions. |
| AV-L06/L07/L08 - compare | Resolve blocking comparability gaps, run the calculation and review feasibility, weighted scores, ties and sensitivity. | Stores an immutable Comparison Result. Infeasible alternatives remain visible but cannot be preferred. |
| AV-L09/L10 - decision | Explicitly select a feasible baseline, record rationale, owner, status/date and confirm approval. | Creates/updates the Decision and changes the baseline only after explicit approval. |

### Final overview (AV-M02 to AV-M06)

The final pages are reviews, not new data-entry steps. They summarise the study question, model content, stakeholder traceability, requirements, architecture, current simulation and - for Trade-off - alternatives and decision. The completion banner is green only when required answers and evidence are complete and reviewed; amber means pending evidence, warnings, skipped/incomplete answers or answers needing review; red means a failed requirement or another blocking model finding.

## Using Modeler view safely

Use Project Workflow to find the next activity. Each Model section edits canonical elements and relationships through Table, Graph, Sequence, Matrix, Section Recap, Model Digital Thread and Model Quality views as applicable. Sequence overview displays the actual `precedes` network, including parallel branches and joins. The table keeps core fields visible and reveals status, tags, custom attributes and connections through **More columns**. Element editing always opens in the right-side drawer. Interfaces and Traceability are separate sections. Variability edits the feature model, variation points, configurations and 150%/100% realizations; organizational feature groups appear in the same hierarchy table as features. Parameters and KPIs edits authoritative engineering inputs and formulas. Simulation creates immutable runs. Architecture Trade Study frames, compares and decides. Project Recap follows the complete model from mission through architecture, evidence and decision. Delivery saves projects, snapshots and exports. Model Quality collects project-wide findings and links back to affected content.

Section recaps do not prescribe arbitrary element counts. They derive their expectations from current model rules and upstream content—for example, every defined function needs a realizing component and every selected use case needs behavior. Guided examples may state expected counts as walkthrough aids, but those counts are not project validation rules.

When an Architect question is unclear, switch to Modeler view to inspect the relevant table, matrix or graph, then return. If a Modeler edit changes content used by a confirmed answer, the affected question and recap are marked for review; unrelated documentation edits stay confirmed. Never duplicate an existing parameter merely to satisfy a question: identify its authoritative owner and reuse the canonical value.

## Quick answer-quality checklist

- Use stakeholder language for needs and measurable language for objectives.
- Write requirements so a verification method or formula can decide them.
- Give every numeric value a unit, source and value origin.
- Keep product functions distinct from the product components that realize them.
- Keep industrial process functions distinct from workstations/equipment that realize them.
- Allocate resources to the industrial component that requires them.
- Treat optional content and changed values as variability; keep common content unconditioned.
- Compare only current 100% derivations with current, complete and comparable simulation evidence.
- Record a decision rationale; do not treat the highest score as automatic approval.

