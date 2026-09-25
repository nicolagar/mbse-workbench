# Traceable Feasible-Weighted Trade Study

## Purpose and limits

The workbench answers a direct architecture decision question using evidence already present in the canonical project. It is a deterministic early-phase decision aid, not a certified analysis, optimizer, probabilistic uncertainty engine, or substitute for engineering judgement.

## Workflow

The Trade Study scope uses three Problem Space steps and seven Solution Space steps:

1. Define the system of interest and objectives.
2. Select needs, active use cases and the requirements traced from them.
3. Define the active Trade Study, its traceable problem scope, reusable variability axes and evaluation KPIs.
4. Build the 150% architecture.
5. Define the feature model and constraints.
6. Map variability to the architecture.
7. Create at least two valid configurations.
8. Derive current saved 100% architectures.
9. Simulate those architectures with the same selected KPI set.
10. Compare and decide.

Steps remain open out of order, but missing prerequisites are shown as blockers. The dashboard recommends the earliest incomplete or blocked step.

## Study definition

A study records a direct decision question and selects existing needs, objectives and active use cases. Requirements are collected automatically from canonical `derives` relationships. An Open Decision is not a prerequisite.

Problem Space Step 3 is a guided setup. It links the active Trade Study to the single project-wide Root Feature, selects one or more reusable project variability axes, and creates or edits only the canonical KPIs needed for comparison. Each axis owns one synchronized major FeatureGroup. Renaming an axis renames its group; deletion is blocked while the group contains features or nested groups.

The active Trade Study is persisted per project and drives dashboard completion. Alternative selection is deliberately excluded from setup and begins only in Solution Space Step 7, after current configurations, derivations and simulations exist.

Alternatives are eligible only when they reference:

- an active, valid configuration;
- its current saved 100% derivation;
- a current complete simulation tied to that exact derivation; and
- a finite numeric value for every selected KPI.

Missing or stale derivation, simulation, requirement, or KPI evidence blocks comparison.

## Feasibility and scoring

Every linked requirement formula is evaluated against the immutable realized model in the alternative's simulation snapshot.

- **Feasible** means every linked requirement has current evidence and passes.
- **Infeasible** means at least one linked requirement fails.
- **Unknown** means required evidence is absent; this blocks comparison.

There are no Trade Study-specific feasibility thresholds and no exception path for selecting a failed alternative. Infeasible alternatives remain visible with diagnostic scores but cannot be preferred.

The method uses each KPI's global optimization direction and global weight. Study-specific overrides are ignored. For each KPI, minimum and maximum anchors come from feasible alternatives only. The same scale is then applied to infeasible alternatives for diagnosis. Weighted scores are the sum of normalized values times global weights divided by the total selected weight.

When only one alternative is feasible, it may be selected, but the result states that no competitive feasible ranking exists. Tied feasible leaders require an explicit selection.

## Manager and Expert evidence

Manager view shows the question, feasibility, ranking, KPI results, recommendation and limitations. Expert view uses the same calculation and adds raw values, normalized values, global directions and weights, contributions, requirement formulas, immutable run IDs and derivation evidence. The two views never calculate different answers.

## Decision and baseline

Approval requires an explicit feasible alternative, rationale and confirmation that the chosen architecture becomes the baseline. Approval captures the exact study, result, requirement evidence, KPI evidence, configuration, derivation and simulation references used for the decision.

## Compatibility and delivery

Schema 9 adds the reusable variability-axis catalogue, synchronized FeatureGroup references, active Trade Study persistence, Root Feature and selected-axis links, and the guided Step 3 workflow. Schema-8 projects migrate without mutation of historical evidence: the first existing study becomes active, a sole existing Root Feature is linked, and existing FeatureGroups are offered for explicit axis adoption without semantic guessing.

Changing study scope, axes or KPI definitions retains immutable results for history but marks them stale. Comparison and decision approval remain blocked until the affected derivations, simulations and comparison are refreshed.

JSON, XLSX and PDF delivery continue to preserve canonical project data and immutable historical evidence. Every decision-relevant estimate remains labeled:

> Preliminary engineering estimate — not a verified detailed-design result.
