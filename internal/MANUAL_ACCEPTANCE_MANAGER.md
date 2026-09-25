# Dashboard and Trade Study Manager Acceptance

Candidate: v1.5.3 / schema 9 (`03_Architect_view_v01`)

Status: PENDING BROWSER REVIEW

- Start from an empty project and confirm the perspective chooser explains that Architect and Modeler use the same project.
- In Architect view, confirm the header exposes project lifecycle, Save/Load, sample/reset and the Modeler switch; the progress panel shows scope, confirmed questions, section status and readiness.
- For each selected scope, confirm the central question, answer guidance and example make the expected answer understandable without opening Modeler view.
- Switch to Modeler view and confirm the same Architect-created elements and relationships appear in the Dashboard and canonical editors without duplication.
- Edit a model dependency in Modeler view, return to Architect view and confirm only affected answers/recaps require review.
- Complete or load the sample workflow and confirm the completion page distinguishes ready, review-required and blocked evidence and links to stakeholder traceability and validation.

- In the project frame, create a named project, switch projects, duplicate it and delete the disposable copy.
- Select each overall scope and confirm only its required Problem Space and Solution Space activities appear.
- Confirm every outcome card shows icon and text for Not started, In progress, Complete or Blocked, and the earliest incomplete/blocked activity is recommended.
- Open a later blocked activity, confirm the missing prerequisites are explicit, navigate to an exact editor action, then return to the same Dashboard card and scroll context.
- Under Trade study, confirm the seven Solution Space labels exactly match the documented sequence and use “Simulate architectures”.
- In Problem Space Step 3, create or select the active Trade Study, enter its question and select existing needs, objectives and active use cases. Confirm requirements are derived automatically.
- Confirm the guided setup links one shared Root Feature and creates multiple reusable variability axes with synchronized major FeatureGroups.
- Create or edit a KPI formula/algorithm, unit, direction, weight and objective link in the compact canonical editor.
- Confirm configuration alternatives are absent from Step 3 and appear only in Step 7.
- Confirm only valid configurations with current saved derivations and matching current complete simulations can become alternatives in Step 7.
- Switch the active Trade Study from the Dashboard and guided setup and confirm both selectors remain synchronized.
- Change selected scope, an axis or a KPI and confirm immutable results remain available but become stale until refreshed.
- Run comparison and confirm all alternatives remain visible, requirement-failing alternatives cannot be preferred and missing evidence blocks the result.
- In Manager view, confirm feasibility, ranking, KPI evidence, recommendation and limitations are concise and readable.
- Confirm approval is blocked without a feasible selection, rationale and baseline confirmation; approve a feasible alternative and confirm its architecture becomes baseline.
- Refresh and confirm project scope, Dashboard context, study, result, decision and baseline persist.
- Check desktop, collapsed icon rail and mobile layout for reachable primary controls and unclipped content.
- Open each Model graph and confirm Automatic hierarchy is the default, same-type cards align in labelled top-down bands, and primary connectors do not pass through cards.
- Switch between Primary structure, All relationships and Selected element; confirm secondary links are available without overwhelming the default graph.
- Confirm function sequences remain left to right and the Feature Model runs from the Root Feature down through containment levels.

Report `Manager browser acceptance: PASS` or record the browser, viewport and exact failed item.
