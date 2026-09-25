# Worked examples guide

Application version 1.8.0 · schema 14

The four **Load example** choices are deliberately matched to the three workflow scopes. They are complete, editable teaching models: values and evidence are illustrative preliminary engineering content, not certified design substantiation.

## Common walkthrough

For any example:

1. Select the visible **Load example** action and choose the example.
2. Start in **Project Workflow**. Single-click a step to inspect its activities and dynamic section recap; double-click to bring the details into view.
3. Expand **Model** in the left navigation. Follow Mission and Context, Requirements and Validation, Product Functional, Product Technical, Process Functional, Process Technical, Interfaces and Traceability.
4. In a section, compare **Table**, **Graph**, **Matrix** and **Section recap**. Use **More columns** only when status, scope, attributes, tags or connection counts are needed.
5. Open **Model Digital Thread** for the end-to-end rows, then **Project Recap** for the complete project outcome.
6. Switch to **Architect view**. Move through the questions and observe **Model created so far**: it accumulates confirmed content in a semantic left-to-right layout and omits parameter/evidence detail.

The recaps derive expectations from the actual model. A function creates an expectation for realization; a requirement creates expectations for allocation and a credible check. The application does not require arbitrary fixed counts.

## Architecture: Portable Emergency Lighting Unit

Purpose: demonstrate a compact traceable architecture without simulation or a trade study.

Key thread:

| Stage | Worked content |
|---|---|
| Mission | Provide dependable temporary evacuation lighting |
| Context | Portable Emergency Lighting Unit interacting with the building mains supply |
| Stakeholder intent | Facility safety manager needs visible evacuation routes during a power loss |
| Requirement | Installed unit mass shall not exceed 2.5 kg |
| Product behavior | Detect power loss, store emergency energy, illuminate the route |
| Product structure | Protective enclosure, rechargeable battery module and LED lighting module |
| Industrial behavior | Assemble enclosure, install battery and verify emergency illumination |
| Industrial structure | Assembly bench, electrical safety tester and assembly technician |

Expected result: the three local mass contributions total 2.2 kg, so the 2.5 kg requirement is met by calculation. The project has one current baseline configuration/architecture, no KPIs, no simulation run and no comparison decision.

Use this example to inspect function realization, the product interface to the mains supply, work-in-progress handoffs and the way Project Recap stops honestly at architecture evaluation.

## Architecture + Simulation: Reusable Cold-Chain Transport Box

Purpose: demonstrate one current architecture with calculated KPI evidence, without product-line alternatives.

Key thread:

| Stage | Worked content |
|---|---|
| Mission | Protect temperature-sensitive medicines throughout reusable distribution |
| Context | Reusable Cold-Chain Transport Box interacting with a refrigerated delivery vehicle |
| Stakeholder intent | Pharmaceutical logistics operator needs protected medicine during distribution |
| Requirement | Prepared transport box mass shall not exceed 8 kg |
| Product behavior | Insulate, condition and record payload temperature |
| Product structure | Outer shell, insulation liner, coolant set and temperature logger |
| Industrial behavior | Prepare liner, install coolant and activate/verify logger |
| Industrial structure | Pack-out station, logger commissioning station and cold-chain operator |

Open **Parameters and KPIs** to inspect the four shared calculations: total product mass, assembly lead time, packing throughput and resource demand. Then open **Simulation** and select the saved current run. The component mass contributions total 6.5 kg, so the 8 kg requirement is met. The immutable run retains the exact model revision, inputs, assumptions and warnings.

## Trade Study: Coffee-machine product line

Purpose: introduce variability, 150%-to-100% derivation, comparable simulation and a recorded baseline decision.

1. In **Variability → Feature Model**, inspect the common family and the coffee-input/heating choices. Groups state their XOR/OR cardinality directly.
2. In **Variation Points**, search for a target and inspect how feature choices control existence or a property value.
3. In **Configurator**, compare the hierarchical choices for Essential Capsule, Balanced Bean-to-Cup and Premium Dual Boiler. Each valid configuration has a current 100% derivation.
4. In **Simulation**, compare the saved runs produced from those exact derivations.
5. In **Architecture Trade Study**, inspect feasibility first, then score and rationale. The approved decision retains the comparison, runs and derivations used at decision time.

The example is intended to show why a feature-valid configuration, a current derived architecture, passing requirements and a preferred decision are distinct states.

## Trade Study: Aircraft OHSC product family

Purpose: demonstrate configuration-managed change against a controlled baseline with explicit external systems and a complete obligation set.

1. In **Mission and Context**, inspect the OHSC system, aircraft-side external systems and canonical mission participation.
2. In **Interfaces**, follow structural attachment, cabin envelope, passenger-service/lighting, ECS duct and passenger-oxygen boundaries.
3. In **Requirements and Validation**, confirm that all 30 Standard A obligations remain in scope. Eighteen have formula checks; twelve qualitative results remain explicitly labelled demonstrator assumptions.
4. In **Configurator**, compare Standard A, Capacity Upgrade, Balanced Modular and Lightweight Rapid-Install.
5. In **Simulation**, verify Standard A's 31.5 kg installed-segment mass and Capacity Upgrade's 34 kg result against the unchanged 32 kg bound.
6. In **Architecture Trade Study**, observe that Capacity Upgrade can have valid feature choices and a consistent 100% derivation while remaining infeasible because it fails the mass requirement.
7. In **Project Recap**, follow the retained baseline obligations, current evidence and the approved preliminary selection of Change Solution 2 — Balanced Modular.

The external aircraft systems stay outside the OHSC product boundary and therefore outside the OHSC mass total. The decision is an internal preliminary baseline decision, not regulatory approval.

## Recreate an Architecture-scope model from blank

Use the emergency-lighting story as the compact recipe.

1. Choose **Project actions → New project**, enter `Portable Emergency Lighting Unit`, switch to **Architect view**, and select **Architecture definition**.
2. Enter the mission `Provide dependable temporary evacuation lighting`; stakeholder `Facility safety manager`; and system of interest `Portable Emergency Lighting Unit`.
3. Give the stakeholder the need `Maintain visible evacuation routes during a power loss` and objective `Provide a lightweight deployable lighting unit`.
4. Create use case `Illuminate an evacuation route`; select the safety manager as participant; select the need/objective it addresses; and include it in the analysis scope.
5. Derive requirement `Installed unit mass shall not exceed 2.5 kg`. Mark it quantitative with property/semantic key `mass`, operator `<=`, target `2.5`, unit `kg`, and verification `Mass-budget analysis`.
6. Enter product functions in order: `Detect loss of mains power; Store emergency energy; Illuminate the evacuation route`.
7. Realize them with `Protective enclosure; Rechargeable battery module; LED lighting module`. Use the enclosure as the root assembly and enter local mass contributions `0.7 kg`, `1.1 kg`, and `0.4 kg` with an engineering source and value origin.
8. Add external system `Building mains supply` in Modeler Mission and Context if it was not entered as a use-case participant. Create `Mains charging interface` and connect the mains supply and relevant product component to it.
9. Enter process functions in order: `Assemble enclosure; Install battery module; Verify emergency illumination`. Realize them with `Assembly bench` and `Electrical safety tester`; allocate `Assembly technician`; enter durations `3 min`, `2 min`, and `2 min`; and use the unit work-in-progress as the produced/consumed handoff.
10. Confirm each section recap, then open **Project Recap**. Expected calculation: `2.2 kg <= 2.5 kg`; no simulation or decision stage is required.

## Recreate an Architecture + Simulation model from blank

Use the cold-chain story and repeat the same intent-to-architecture pattern.

1. Create `Reusable Cold-Chain Transport Box` and select **Architecture and simulation**.
2. Enter mission `Protect temperature-sensitive medicines throughout reusable distribution`; stakeholder `Pharmaceutical logistics operator`; system `Reusable Cold-Chain Transport Box`; and external system `Refrigerated delivery vehicle`.
3. Enter need `Keep medicine protected during distribution`, objective `Reduce packing time while retaining a portable box`, and use case `Prepare a temperature-controlled shipment`.
4. Create quantitative requirement `Prepared transport box mass shall not exceed 8 kg`, checked as `mass <= 8 kg` by a mass-budget analysis.
5. Enter product functions `Insulate the payload; Condition the payload space; Record payload temperature` and components `Reusable outer shell; Insulation liner; Coolant set; Temperature logger` with local masses `2.4`, `1.6`, `2.2`, and `0.3 kg`.
6. Create `Vehicle cargo interface` between the transport box and refrigerated vehicle.
7. Enter process functions `Prepare insulation liner; Install conditioned coolant; Activate and verify logger`, durations `2`, `3`, and `1 min`, industrial components `Pack-out station; Logger commissioning station`, and resource `Cold-chain operator`. Connect each successive process through the same box work-in-progress handoff.
8. In the guided KPI questions, select standard algorithms **Total mass**, **Manufacturing lead time**, **Throughput proxy**, and **Resource demand**. Use output units `kg`, `h`, `1/h`, and `resource-h`; minimize all except throughput.
9. Select the current baseline architecture as the run context, review assumptions, and create `Reusable Cold-Chain Transport Box baseline simulation`.
10. Open Project Recap. Expected mass is `6.5 kg`, all four KPI results are present, and the simulation retains the exact model revision and source inputs.

## Recreate a Trade Study model from blank

Use the coffee-machine story; the OHSC example is intentionally too detailed for a short manual-entry exercise.

1. Create a project, select **Trade-off**, and model one mission, dedicated coffee-machine system, human stakeholders, external power/water/vessel systems, needs, objectives, operational use case and mandatory requirements before introducing alternatives.
2. Build common product behavior/components and manufacturing behavior/equipment first. Give every selected use case behavior, every function a realizing component, every relevant process a duration and every industrial component its required resource.
3. Frame the decision as choosing a feasible coffee-machine baseline. Create common feature `Brew control` and two major axes: coffee input system and heating technology.
4. Define the input group and heating group as XOR: exactly one choice from each group is required. Add constraints only when one selection truly requires or excludes another.
5. Map feature choices to existing-element existence or existing parameter values; do not create separate copied architectures. Use local product mass and beverage-throughput values so the realized alternatives produce distinct results.
6. Create configurations `Essential Capsule`, `Balanced Bean-to-Cup`, and `Premium Dual Boiler`. Validate each selection, resolve every XOR group, and derive a current 100% architecture for each.
7. Select one comparable KPI set and run it for all three current derivations. Confirm matching units, assumptions, source parameters and model revisions before comparison.
8. In Architecture Trade Study, retain all baseline requirements, assign explicit KPI weights/directions, calculate the comparison, inspect feasibility before weighted score, and record a rationale for the selected feasible baseline.
9. Open Project Recap and verify the final thread states **Trade study completed · new baseline defined** only after the decision is approved and baseline confirmation is recorded.

For the advanced OHSC recreation, use the supplied example as a controlled reference: recreating it means preserving all 30 requirements, modelling the five aircraft-side external systems and interfaces, defining eight feature axes, deriving four architectures, running the same five KPIs, retaining the 32 kg mass bound, and recording both the Standard A reference evidence and the successor decision.

## Safe editing checks

- Editing a canonical element updates every projection; it does not create a copy.
- Changing an input used by evidence makes dependent results stale or in need of review.
- Interface and Traceability filters affect the view only; they never delete relationships.
- A section recap reports obligations implied by the current model, so adding a function or requirement can add a new expectation immediately.
- Saved simulation, comparison and decision records retain historical inputs even after the live model changes.
