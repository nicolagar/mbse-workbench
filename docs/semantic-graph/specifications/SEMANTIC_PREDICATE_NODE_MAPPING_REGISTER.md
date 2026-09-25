# Semantic Predicate and Node Mapping Register

## Authority

This register is tied to commit `37c6270416a88186d1d9b22f4d09d5afe211e5d3`. It is the implementation authority for graph projection. `allowedRelationships` remains the authority for editable stored relationships.

## Semantic roles

- **canonical** — provenance/workflow continuity.
- **supporting** — structure, behaviour, containment or allocation.
- **constraint** — validity/applicability rule.
- **evidence** — calculation, verification, analysis or decision evidence.

## Node register

| Semantic kind | Authoritative record | Persistence form | Contexts |
|---|---|---|---|
| All 16 ModelElement kinds | `Project.elements[]` | Top-level record | live, derivation, simulation |
| `parameter` | `ModelElement.parameters[]` | Embedded record | live, derivation, simulation |
| `architecture` | `Project.architectures[]` | Top-level record | live, evidence reference |
| `featureModel` | Project-scoped virtual node | Derived | live |
| `feature` | `Project.features[]` | Top-level record | live, derivation |
| `featureGroup` | `Project.featureGroups[]` | Top-level record | live |
| `variabilityAxis` | `Project.variabilityAxes[]` | Top-level record | live |
| `featureConstraint` | `Project.featureConstraints[]` | Reified only in inspector/register | live |
| `variationPoint` | `Project.variationPoints[]` | Top-level record | live, derivation, simulation |
| `configuration` | `Project.configurations[]` | Top-level record | live |
| `realization` | `Configuration.derivation` | Embedded immutable evidence | derivation, simulation |
| `kpi` | Project KPI or frozen snapshot KPI | Top-level/frozen embedded | live, simulation, decision |
| `simulationRun` | `Project.simulationRuns[]` | Immutable top-level evidence | simulation, decision |
| `simulationResult` | `SimulationRun.results[]` | Embedded immutable evidence | simulation, decision |
| `tradeStudy` | `Project.comparisonStudies[]` | Top-level record | live, decision |
| `studyCriterion` | `ComparisonStudy.criteria[]` | Embedded study record | live, decision |
| `candidate` | `ComparisonStudy.candidateRefs[]` | Embedded study record | live |
| `alternative` | `ComparisonStudy.alternativeRefs[]` | Embedded study record | live, decision |
| `comparisonResult` | `ComparisonStudy.results[]` | Embedded immutable evidence | live, decision |
| `risk` | `Project.comparisonRisks[]` | Top-level record | live, decision |
| `openDecision` | `Project.openDecisions[]` | Top-level workflow record | live |
| `decision` | `Project.decisions[]` | Top-level record | live, decision |
| `validationFinding` | `Project.validationResults[]` | Derived Project record | live only; evidence view |
| `unresolvedReference` | Diagnostic virtual node | Never persisted | any partial context |

Baseline is not a node. It is `architecture.lifecycleState = baseline`, derived from `Project.baselineArchitectureId` plus Architecture status consistency.

## Stored ModelElement relationship mapping

Every stored edge keeps the same source and target in the Semantic Graph. `storedDirection = direct`. No inverse duplicate is generated in the base graph; traversal may request inverse navigation and the UI may show an inverse phrase.

| Stored predicate | Allowed source→target kinds | Role | Semantic predicate |
|---|---|---|---|
| `hasSOI` | mission→system | canonical | `hasSystemOfInterest` |
| `hasStakeholder` | mission→stakeholder | canonical | `hasStakeholder` |
| `participatesInMission` | mission→externalSystem | canonical | `hasMissionParticipant` |
| `hasNeed` | stakeholder/system→need | canonical | `hasNeed` |
| `hasObjective` | stakeholder/system→objective | canonical | `hasObjective` |
| `involvedIn` | stakeholder/externalSystem→useCase | canonical | `involvedInUseCase` |
| `addresses` | useCase→need/objective | canonical | `addresses` |
| `hasFunction` | useCase→productFunction/processFunction | canonical | `requiresFunction` |
| `derives` | need/objective→systemRequirement | canonical | `derivesRequirement` |
| `satisfiedBy` | systemRequirement→productFunction/productComponent/processFunction/industrialSystemComponent | canonical | `satisfiedBy` |
| `realizedBy` | productFunction→productComponent; processFunction→industrialSystemComponent | canonical | `realizedBy` |
| `refines` | requirement→requirement; function→same function type; component→same component type | supporting | `refines`; component containment uses `partOf` display semantics when `containment=true` |
| `verifies` | verificationMethod→systemRequirement | evidence | `verifies` |
| `connects` | externalSystem/component/function/interface combinations allowed by code | supporting | `connects` |
| `precedes` | productFunction→productFunction; processFunction→processFunction | supporting | `precedes` |
| `allocatedTo` | processFunction→productComponent; resource→industrialSystemComponent; verificationMethod→processFunction | supporting | `allocatedTo` |
| `requiresResource` | industrialSystemComponent→resource | supporting | `requiresResource` |
| `consumes` | processFunction→productComponent | supporting | `consumes` |
| `produces` | processFunction→productComponent | supporting | `produces` |

Quantity, unit, flow name, sequence ID, architecture ID and containment remain edge attributes.

## Typed and embedded projection mapping

| Authoritative field | Stored owner→reference | Semantic source→target | Predicate | Role | Context |
|---|---|---|---|---|---|
| `useCase.metadata.subjectSystemId` | useCase→system | useCase→system | `hasSubjectSystem` | canonical | live/snapshot |
| `element.architectureId` | element→architecture | element→architecture | `belongsToArchitecture` | supporting | live |
| `parameter.ownerElementId` | parameter→element | element→parameter | `ownsParameter` | supporting | all |
| requirement formula parameter binding | requirement→parameter | requirement→parameter | `evaluatedAgainst` | evidence | live/snapshot |
| requirement formula KPI binding | requirement→KPI | requirement→KPI | `evaluatedAgainstKpi` | evidence | live/snapshot |
| `feature.parentId` | feature→parent feature | parent→feature | `containsFeature` | supporting | live |
| `feature.parentGroupId/groupId` | feature→group | group→feature | `containsFeature` | supporting | live |
| `featureGroup.parentFeatureId` | group→feature | feature→group | `containsFeatureGroup` | supporting | live |
| `featureGroup.parentGroupId` | child group→parent group | parent→child | `containsFeatureGroup` | supporting | live |
| `axis.featureGroupId` | axis→group | axis→group | `organizesFeatureGroup` | supporting | live |
| FeatureConstraint source/target | feature→feature | feature→feature | `requiresFeature`/`excludesFeature` | constraint | live |
| VP parsed expression/conditions | VP→features | feature→VP | `activatesVariationPoint` | constraint | live |
| VP `constrainedElementIds` | VP→element | VP→element | `affectsElement` | supporting | live |
| VP `constrainedRelationshipIds` | VP→relationship record | VP metadata→semantic edge ID | `affectsRelationship` | supporting | live |
| Configuration `architectureId` | configuration→architecture | configuration→architecture | `configuresArchitecture` | canonical | live |
| Configuration effective selections | configuration→features | configuration→feature | `selectsFeature` | canonical | live |
| Configuration `derivation` | configuration→derivation | configuration→realization | `derivesRealization` | canonical | derivation |
| Derivation `sourceArchitectureId` | realization→architecture | realization→architecture | `derivedFromArchitecture` | canonical | derivation |
| Derivation applied variations | realization→VP | VP→realization | `contributesToRealization` | canonical | derivation |
| Derivation included element IDs | realization→elements | realization→element | `containsRealizedElement` | supporting | derivation |
| Derivation preserved relationships | realization→relationship | realization metadata→semantic edge IDs | `containsRealizedRelationship` | supporting | derivation |
| KPI `objectiveIds` | KPI→objectives | KPI→objective | `measuresObjective` | evidence | live/snapshot |
| KPI `needIds` | KPI→needs | KPI→need | `measuresNeed` | evidence | live/snapshot |
| KPI input parameters | KPI→parameters | parameter→KPI | `providesInputTo` | evidence | live/snapshot |
| KPI dependencies | KPI→KPI | dependency KPI→dependent KPI | `providesInputToKpi` | evidence | live/snapshot |
| Run `architectureId` | run→architecture | realization/architecture→run | `evaluatedBy` | evidence | simulation |
| Run `configurationId` | run→configuration | configuration→run | `evaluatedBy` | evidence | simulation |
| Run `derivationId` | run→realization | realization→run | `evaluatedBy` | evidence | simulation |
| Run `results[]` | run→result | run→result | `producesResult` | evidence | simulation |
| Result `kpiId` | result→KPI | result→KPI | `reportsKpi` | evidence | simulation |
| Result source parameters | result→parameters | parameter→result | `providesEvidenceInput` | evidence | simulation |
| Study originating open decision | study→open decision | openDecision→study | `initiatesStudy` | canonical | live |
| Study scope IDs | study→need/objective/useCase/requirement | study→scoped item | `scopes` | canonical | live |
| Study root feature | study→feature | study→feature | `usesFeatureModelRoot` | canonical | live |
| Study selected axes | study→axes | study→axis | `exploresAxis` | canonical | live |
| Study criteria | study→criterion | study→criterion | `definesCriterion` | canonical | live/decision |
| Criterion objective IDs | criterion→objective | objective→criterion | `drivesCriterion` | canonical | live/decision |
| Criterion requirement IDs | criterion→requirement | requirement→criterion | `constrainsCriterion` | canonical | live/decision |
| Criterion KPI ID | criterion→KPI | criterion→KPI | `evaluatedByKpi` | evidence | live/decision |
| Criterion required Feature | criterion→feature | criterion→feature | `requiresFeature` | constraint | live/decision |
| Study candidate refs | study→candidate | study→candidate | `definesCandidate` | canonical | live |
| Candidate IDs | candidate→config/architecture | candidate→config/architecture | `referencesConfiguration`/`referencesArchitecture` | canonical | live |
| Study alternative refs | study→alternative | study→alternative | `evaluatesAlternative` | canonical | live/decision |
| Alternative refs | alternative→config/architecture/run | alternative→targets | precise reference predicates | canonical/evidence | live/decision |
| Study results | study→comparison result | study→result | `producesComparisonResult` | evidence | live/decision |
| Risk applicability arrays | risk→referenced records | risk→targets | `appliesTo` | evidence | live/decision |
| Decision supporting study IDs | decision→study | study→decision | `informsDecision` | evidence | live/decision |
| Decision supporting run IDs | decision→run | run→decision | `informsDecision` | evidence | live/decision |
| Decision selected alternative | string scoped to supporting study | decision→alternative | `selectsAlternative` | canonical | live/decision |
| Baseline project/status fields | project/architecture | decision→architecture only when unambiguous evidence agrees | `selectsArchitecture` | canonical | decision |

## Virtual Feature Model

Create exactly one live virtual node per Project: `featureModel`. It contains root Feature(s) and exists only when Features exist. Multiple/missing roots produce diagnostics; they do not prevent partial graph creation.

## Decision resolution algorithm

1. Collect studies in `supportingComparisonStudyIds`.
2. Within those studies, match `selectedAlternative` against alternative ID first, then exact label.
3. Require exactly one match.
4. Resolve its Architecture and optional Configuration/Run.
5. If Decision is approved and `baselineApprovalConfirmed=true`, compare with `Project.baselineArchitectureId` and Architecture status.
6. Project `selectsAlternative` and `selectsArchitecture` only when unambiguous.
7. Otherwise emit `SG-REF-DECISION-SELECTION` and do not invent an edge.

## Baseline projection

An Architecture is marked baseline only when `Project.baselineArchitectureId === architecture.id` and exactly one Architecture has status `baseline`. Disagreement yields a diagnostic. No Baseline node or `establishes` edge is created.

## Non-projected data

UI layout state, navigation state, filter state, raw text assumptions, export events and application snapshots are not Project Semantic Graph nodes in release 1. Decision evidence assumptions remain attributes on the Decision context. Application snapshots remain a separate application-history concern.
