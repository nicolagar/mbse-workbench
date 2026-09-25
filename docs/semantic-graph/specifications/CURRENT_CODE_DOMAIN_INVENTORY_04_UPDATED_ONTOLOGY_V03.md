# Current-Code Domain Inventory

## Baseline

- Repository: `nicolagar/mbse-mbple-workbench`
- Branch: `04_updated_ontology_v03`
- Audited commit: `37c6270416a88186d1d9b22f4d09d5afe211e5d3`
- Commit date: 2026-09-15 21:33:20 UTC
- Commit message: `feat(modeler): add scope ontology explorer`
- Application version: `1.8.0`
- Persisted schema: `14`
- Runtime: React 18.3.1, Zustand 5.0.2, TypeScript 5.7.2, Vite 6.4.3, Vitest 3.2.6, React Flow 12.8.2, ELK 0.12.0

This inventory is normative for the semantic-graph restructuring. If the branch head changes, repeat the audit and update the commit before implementation.

## Current application topology

`App.tsx` selects one workspace from the canonical Zustand store. Modeler workspaces are Dashboard, Model, Scope Ontology, Variability, Parameters/KPIs, Simulation, Architecture Trade Study, Project Recap, and Export. Architect perspective replaces the Modeler shell with `ArchitectView`.

There is one canonical `Project` inside one `PersistedAppState`; application snapshots are stored beside projects. The active project is accessed through `selectActiveProject`. Domain mutations are store actions. UI preferences are separate from the Project but persisted in the root state.

## Persistence contract

`src/store/persistence.ts` owns schema validation, migrations, normalization and recovery.

- `CURRENT_SCHEMA_VERSION = 14`.
- Schemas 1–14 are accepted.
- `normalizeOntology()` upgrades live project ontology and never rewrites historical run/decision snapshots.
- Legacy element and relationship vocabularies are converted to the schema-14 vocabulary.
- Invalid stored data is handled through the existing recovery path.
- The semantic-graph first release must not change `Project`, `PersistedAppState`, or schema version.

## Canonical Project aggregates

| Aggregate | Storage | Mutability |
|---|---|---|
| Architectures | `Project.architectures` | Mutable definitions/status |
| Model elements | `Project.elements` | Mutable |
| Relationships | `Project.relationships` | Mutable, validated triples |
| Function sequences | `Project.functionSequences` | Mutable |
| Units/custom attributes | Project arrays | Mutable |
| Features/groups/axes/constraints | Project arrays | Mutable |
| Variation Points | `Project.variationPoints` | Mutable transformation definitions |
| Configurations | `Project.configurations` | Mutable definition; latest derivation embedded |
| KPIs | `Project.kpis` | Mutable definitions |
| Simulation Runs | `Project.simulationRuns` | Immutable evidence records |
| Comparison Studies | `Project.comparisonStudies` | Mutable setup; results immutable records |
| Comparison Risks | `Project.comparisonRisks` | Mutable governance records |
| Decisions | `Project.decisions` | Mutable until approved; may contain frozen evidence |
| Validation Results | `Project.validationResults` | Derived project diagnostics |
| Application snapshots | `PersistedAppState.snapshots` | Immutable project copies, outside Project |

## ModelElement vocabulary

The exact schema-14 `ElementType` set is:

1. `mission`
2. `system`
3. `externalSystem`
4. `stakeholder`
5. `need`
6. `objective`
7. `useCase`
8. `systemRequirement`
9. `productFunction`
10. `productComponent`
11. `productInterface`
12. `processFunction`
13. `industrialSystemComponent`
14. `processInterface`
15. `resource`
16. `verificationMethod`

Every ModelElement owns status, architecture scope/reference, optional feature expression, embedded Parameters, optional requirement formula, custom attributes, tags, metadata, and timestamps.

## Architecture model

`Architecture` is a standalone Project record with statuses `draft`, `invalid`, `configured`, `realized`, `candidate`, `baseline`, `stale`, or `archived`. It may reference `configurationId`.

Model elements and relationships independently carry optional `architectureId`. Common content has no architecture ID. `Project.activeArchitectureId` is UI/domain context; `Project.baselineArchitectureId` identifies the baseline.

Architecture and Derivation are not the same object. `DerivationResult` is the frozen 100% realization embedded in a Configuration.

## Embedded and heterogeneous records

### Parameter

Embedded in `ModelElement.parameters`; has its own stable ID and `ownerElementId`. It can be referenced by formulas, KPIs, Variation Points, risks and simulation evidence. It must be a Semantic Node although persistence remains embedded.

### Requirement evidence

Requirements use `requirementFormula`, formula bindings, and `metadata.requirementReviews`. `requirementAssessment.ts` evaluates formulas/reviews and computes dependency signatures by traversing established relationships. The semantic graph must not enter this execution path.

### Feature model

- `Feature` supports hierarchy, group membership, Boolean/enumeration values and variability scope.
- `FeatureGroup` supports nested grouping.
- `VariabilityAxis` references one Feature Group.
- `FeatureConstraint` stores `requires` or `excludes` between Features.
- There is no persisted FeatureModel entity.

### Variation Point

Variation Points contain activation expression/conditions, element and relationship target IDs, value rules, property paths, scope and enabled state. `AppliedVariation` records exact target/effect in a Derivation or Simulation snapshot.

### Configuration and Realization

Configuration references one Architecture, stores manual/automatic/effective selections and feature values, and may embed its latest immutable `DerivationResult`. A Derivation stores source and realized element/relationship snapshots, applied variations, validations and calculated KPI values.

### Simulation evidence

Simulation Run references Architecture, optional Configuration and Derivation, contains embedded Results and a frozen `SimulationInputSnapshot`. That snapshot includes realized elements, realized relationships, applied variations, parameter values and KPI definitions. Historical graph reconstruction must prefer this frozen material.

### Trade Study

`ComparisonStudy` includes scope references, `StudyCriterion[]`, candidate references, alternative references, KPI settings, immutable results, scenarios, robustness results and feasibility exceptions.

`StudyCriterion` is a real embedded record, not a virtual concept. It can reference Objectives, Requirements, KPI and required Feature.

`ComparisonAlternativeRef` references Architecture, optional Configuration and exact Simulation Run. `TradeStudyCandidateRef` references Configuration and Architecture before evidence is attached.

### Decision

Decision stores `selectedAlternative` as a string, supporting Study and Simulation IDs, approval state, baseline confirmation and optional `DecisionEvidenceSnapshot`. The snapshot freezes criteria, alternatives, evidence, feasibility, Pareto results, risks, scenarios, derivation IDs and run IDs.

The string-based selected alternative is the weakest current link. Semantic resolution must be conservative and must not match globally by label.

## Canonical stored relationship vocabulary

`src/domain/relationships.ts` is authoritative for manually editable model relationships. The exact predicates are:

`hasSOI`, `hasStakeholder`, `participatesInMission`, `hasNeed`, `hasObjective`, `involvedIn`, `addresses`, `hasFunction`, `derives`, `satisfiedBy`, `realizedBy`, `refines`, `verifies`, `connects`, `precedes`, `allocatedTo`, `requiresResource`, `consumes`, `produces`.

Endpoint validation, architecture compatibility, duplicate prevention, hasSOI cardinality and quantity/unit rules are enforced there. Semantic projection must not replace this validator.

## Existing semantic/ontology implementations

### `ontology.ts`

Owns live ontology normalization, SOI lookup, Mission lookup, physical containment synchronization, baseline requirement scope and physical hierarchy checks. It mutates only during migration/normalization or explicit parent-assembly commands. It is not a generic graph engine.

### `semanticScope.ts`

Calculates the working use-case scope from one SOI, `subjectSystemId`, stakeholder involvement, addressed Needs/Objectives, derived Requirements and refined Functions. This remains a domain query and can provide a filter to the Semantic Graph.

### `scopeOntology.ts`

Defines a static schema-level graph with type nodes and canonical/typed/embedded connections. It does not inspect project instances. Several entries are intentionally illustrative and are not yet a complete executable mapping.

### `tradeStudyOntology.ts`

Builds a study-specific graph from Project data. It already demonstrates projection rather than persistence, but currently:

- uses untyped string predicates;
- conflates candidate Architecture with “100% architecture”;
- does not represent Derivation as Realization;
- creates a separate Baseline node;
- uses string-based Decision selection weakly;
- provides no provenance, context, role or diagnostics;
- deduplicates edges only by source/predicate/target.

It should be replaced internally only after parity with the new graph is proven.

## Current graph and page consumers

| Consumer | Current source | Required preservation |
|---|---|---|
| `ScopeOntologyWorkspace` | Static `scopeOntology.ts` | All scope buttons, stage focus, zoom/pan, register, inspector, orthogonal routes, multiple ports, collapsed labels |
| `ModelGraph` | ModelElement + stored Relationship + typed ContextConnection | Editing, selection, layouts, status overlays, parameter display, VP markers |
| `TraceabilityMatrix` | ModelElement relationships/context refs | Existing relationship and requirement-parameter editing |
| `ArchitectView` | Progressive ModelGraph subset | Question workflow, reveal logic and all authoring actions |
| `TradeStudyOntologyView` | `deriveTradeStudyOntology()` | Current Digital Thread tab remains available during rollout |
| `ModelWorkspace` | Model views and traceability | All table/graph/diagram/matrix/quality modes |
| Export workspace | Native Project export | Exact existing JSON/XLSX/PDF behaviour |

## Operational engines that must remain graph-independent

- `validateRelationship`
- `calculateSemanticScope`
- requirement formula/review assessment and dependency signatures
- calculated parameter engine
- feature-expression parser and configuration validator
- Variation Point engine
- `deriveConfiguration`
- KPI/pre-sizing calculations
- `runSimulation`
- comparison and methodology engines
- Decision approval/baseline store actions
- persistence, migration, snapshots, imports and native exports

## Baseline risks discovered

1. `scopeOntology.ts` is schema guidance, not a project-instance graph.
2. Its three connection kinds do not distinguish supporting, constraint and evidence semantics.
3. `VariationPoint.featureExpression` may reference multiple Features and is not a simple typed ID.
4. Variation Points can affect any supported element type and relationships, not only Product Components.
5. `Decision.selectedAlternative` is a string and requires scoped resolution.
6. `modelRevision` alone cannot cache evidence graph changes safely.
7. `tradeStudyOntology.ts` has the Architecture/Realization and Baseline-node ambiguities targeted by this restructuring.
8. Current commit has no reported combined CI status; implementation must establish its own clean baseline before edits.

## Inventory conclusion

The code already has the right operational separation for a read-only semantic projection. The safe change is to add a typed graph over schema-14 records, keep all engines and persisted structures unchanged, and migrate UI consumers only after parallel parity tests.
