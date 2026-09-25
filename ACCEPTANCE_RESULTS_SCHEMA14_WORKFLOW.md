# Schema 14 workflow acceptance results

Date: 2026-09-14  
Branch: `04_updated_ontology_v02`

## Automated gates

| Gate | Result |
|---|---|
| TypeScript typecheck | PASS |
| Full Vitest regression suite | PASS — 249 tests across 20 files |
| Production Vite build | PASS |
| Diff whitespace validation | PASS |

## Change acceptance

| Area | Result |
|---|---|
| Existing canonical ontology retained, including `Mission --hasSOI--> System` | PASS |
| Architect starts with “What is the Aim of this Project?” and stores the project description | PASS |
| External-system names and roles use existing `participatesInMission` and `involvedIn` semantics | PASS |
| Architecture + Simulation omits direction, weight, context-selection and assumption-acknowledgement questions | PASS |
| Current architecture is selected automatically and both result recaps are titled “Simulation Results” | PASS |
| New projects/runs omit live assumption fields | PASS |
| Schema-13 project assumptions are removed while historical run assumptions remain unchanged | PASS |
| Model Digital Thread, semantic Architect graph and real per-sequence graphs are present | PASS |
| Feature groups are integrated into the Feature Model hierarchy table | PASS |
| Requested navigation, Project Recap, wording and evidence-count changes are present | PASS |

The pushed commit is recorded when the branch is published.
