# MBSE/MBPLE Workbench — Architect View Implementation Specification

Status: review-ready functional specification  
Application baseline: workflow v1.5.3  
Applies to: Architecture definition, Architecture + simulation, and Trade-off scopes

## 1. Purpose

The Architect view is a question-led perspective over the same canonical project used by the existing Modeler view. It lets a subject-matter expert create a valid MBSE/MBPLE model by answering one understandable question at a time. Every accepted answer creates or updates reversible draft model content immediately.

The Architect view does not replace the Modeler view, introduce a second model, or invent missing engineering evidence. It guides the user, creates canonical elements and relationships, identifies missing information, and exposes technical details only when requested.

## 2. Confirmed product rules

1. The application opens with a choice between Architect view and Modeler view.
2. Both perspectives edit one canonical project.
3. One question is shown at a time.
4. The question flow is deterministic and branches from the selected scope and answers.
5. No cloud or browser-local language model is required in the first release.
6. Lists entered as text use semicolons as separators.
7. Every accepted answer is autosaved and immediately creates reversible draft model content.
8. Skip never has a timer or an automatic selection.
9. A skipped required question remains unresolved and prevents Ready status.
10. The side panel shows sections, progress, recorded answers, skipped questions and section status.
11. Earlier answers are editable from the side panel.
12. A change that affects dependent content shows an impact preview before it is applied.
13. Modeler-created content cannot be removed from Architect view without explicit confirmation.
14. Each section ends with a plain-language recap and an optional technical view.
15. Existing project content prefills the applicable answers.
16. Scope-specific validation determines Draft, Blocked, Ready and Out-of-date status.
17. Recap pages remain accessible before completion.
18. Technical constructs are generated automatically when the interpretation is unambiguous.
19. Ambiguous interpretations require confirmation.
20. Requirements and engineering inputs belong to the common architecture foundation for all scopes.
21. Trade-off framing follows requirement definition and precedes construction of the 150% solution architecture.

## 3. Scope routes

### 3.1 Shared foundation — all scopes

1. Select scope.
2. Name the study and define its mission.
3. Define all stakeholders, then select the system of interest from that complete list.
4. Define stakeholder needs and objectives.
5. Define use cases and working scope.
6. Define qualitative and quantitative requirements.
7. Confirm requirement properties, operators, targets and units.
8. Define the engineering properties needed to evaluate the requirements.
9. Review intent-to-requirement traceability.
10. Define product functions and sequences per use case.
11. Define realizing product components and interfaces.
12. Define industrial-system functions and sequences.
13. Define realizing industrial components, product flows and resources.
14. Bind requirement evaluation properties to their authoritative model owners.
15. Define verification methods.
16. Review requirement satisfaction, architecture traceability and validation.

### 3.2 Architecture + simulation extension

1. Suggest and select objective-linked KPIs.
2. Confirm calculation mode, direction, unit, inputs and target.
3. Complete missing engineering input values or document assumptions.
4. Review simulation readiness.
5. Run a current simulation.
6. Review requirements, KPI results, provenance and warnings.

### 3.3 Trade-off insertion and extension

Immediately after requirement review:

1. State the decision question.
2. Describe what is common to all alternatives.
3. Describe the characteristics that may differ.

After the 150% architecture is built:

4. Confirm the root feature, reusable variability axes, feature groups and constraints.
5. Map variability to requirements, structure, behavior, process, resources and verification.
6. Create configurations and correct invalid drafts.
7. Derive current 100% architectures.
8. Select comparison KPIs and guided priorities.
9. Simulate alternatives using comparable evidence.
10. Compare feasibility first, then stakeholder value and trade-offs.
11. Review the leading feasible alternative.
12. Explicitly confirm the baseline and rationale.

## 4. Canonical digital thread

The Architect view creates only canonical `ModelElement`, `Relationship`, `Parameter` and formula-binding records. Element-to-element traceability must use the relationship rules already implemented in `src/domain/relationships.ts`; parameter satisfaction must use exact requirement-formula bindings and parameter ownership.

| Source | Relationship | Target | Created from |
|---|---|---|---|
| Mission | `hasStakeholder` | Stakeholder | Mission context confirmation |
| Stakeholder | `hasNeed` | Need | Stakeholder need question |
| Stakeholder | `hasObjective` | Objective | Stakeholder objective question |
| Stakeholder | `involvedIn` | Use case | Use-case participant confirmation |
| Need | `derives` | System requirement | Requirement origin confirmation |
| Objective | `derives` | System requirement | Requirement origin confirmation |
| Use case | `hasFunction` | Product function | Product-function question |
| Use case | `hasFunction` | Process function | Industrial-process question |
| System requirement | `satisfiedBy` | Product/process function or product/industrial component | Satisfaction question |
| System requirement formula | exact binding | Parameter owned by a product/process function or product/industrial component | Quantitative satisfaction question |
| Product function | `realizedBy` | Product component | Product realization question |
| Process function | `realizedBy` | Industrial-system component | Industrial realization question |
| Product/process function | `precedes` | Same-domain function | Sequence confirmation |
| Product/process function | `connects` | Corresponding interface | Interface question |
| Industrial-system component | `requiresResource` | Resource | Resource question |
| Process function | `consumes` / `produces` | Product component | Product-flow question |
| Verification method | `verifies` | System requirement | Verification question |
| Verification method | `allocatedTo` | Process function | Verification allocation question |

The principal user-facing trace is:

> Stakeholder → Need and Objective → Requirement → Function, component or owned parameter → Verification evidence

The model may contain multiple paths. A requirement may derive from several needs or objectives and may be satisfied by one or more functions, technical components, or parameters owned by those functions or components. Parameter satisfaction is represented canonically by the requirement formula's exact parameter binding and the parameter's `ownerElementId`; it must not be duplicated as a relationship whose endpoint incorrectly points to a parameter ID.

## 5. Architect session and provenance model

### 5.1 New session records

```ts
type ArchitectStatus = "draft" | "blocked" | "ready" | "outOfDate";
type ArchitectAnswerStatus = "answered" | "skipped" | "needsReview" | "invalid";
type ContentOrigin = "architect" | "modeler" | "import" | "sample" | "migration";

interface ArchitectSession {
  id: string;
  projectId: string;
  scope: OverallScope;
  currentQuestionId: string;
  currentInstanceKey?: string;
  status: ArchitectStatus;
  sectionStates: Record<string, "notStarted" | "inProgress" | "reviewNeeded" | "complete" | "blocked">;
  reviewedSectionIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface ArchitectAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  instanceKey?: string;
  status: ArchitectAnswerStatus;
  value: unknown;
  generatedElementIds: string[];
  generatedRelationshipIds: string[];
  generatedParameterIds: string[];
  generatedFeatureIds: string[];
  generatedVariationPointIds: string[];
  sourceModelRevision: number;
  createdAt: string;
  updatedAt: string;
}

interface ArchitectParameterIntent {
  id: string;
  requirementId: string;
  name: string;
  semanticKey: string;
  dataType: AttributeDataType;
  operator?: "<" | "<=" | "=" | ">=" | ">";
  targetValue?: number;
  unit?: string;
  ownerElementId?: string;
  parameterId?: string;
  status: "defined" | "ownerMissing" | "valueMissing" | "bound";
}
```

`ArchitectParameterIntent` allows a quantitative requirement to be defined before its satisfying component exists. Once an authoritative owner is selected, the engine creates the canonical `Parameter`, retains the intent ID, and builds the requirement formula with the exact parameter binding.

### 5.2 Provenance additions

Add optional provenance to elements, relationships, parameters and Architect-managed domain objects:

```ts
interface CreationProvenance {
  origin: ContentOrigin;
  architectAnswerId?: string;
  createdByQuestionId?: string;
}
```

Existing records migrate to `sample`, `import`, `migration`, or `modeler` as deterministically as possible. Absence of Architect provenance must never be interpreted as permission to delete a record.

### 5.3 Reconciliation rules

1. Match existing content by stable ID first.
2. If no linked answer exists, match by element type plus normalized name and request confirmation.
3. Never merge two existing model elements silently.
4. Prefilled answers are `needsReview` if their canonical relationships are incomplete.
5. A Modeler edit updates the projected Architect answer and marks only dependent answers and reviewed sections `needsReview` / `reviewNeeded`; project naming and unrelated documentation changes do not invalidate guided evidence.
6. A Modeler deletion creates an unresolved question if the deleted record was required for scope readiness.
7. An Architect answer change updates Architect-origin records in place when their semantic identity is unchanged.
8. Removing Modeler/import/sample content requires an impact dialog and explicit item-level confirmation.

## 6. Question engine contract

Each question definition must contain:

```ts
interface ArchitectQuestionDefinition {
  id: string;
  sectionId: string;
  scope: "all" | OverallScope[];
  prompt: string | ((context: QuestionContext) => string);
  explanation: string | ((context: QuestionContext) => string);
  example?: string;
  input: ArchitectInputDefinition;
  required: boolean | ((context: QuestionContext) => boolean);
  instances?: (context: QuestionContext) => QuestionInstance[];
  visibleWhen?: (context: QuestionContext) => boolean;
  validate: (answer: unknown, context: QuestionContext) => QuestionValidation;
  previewImpact: (answer: unknown, context: QuestionContext) => ArchitectImpact;
  apply: (answer: unknown, context: QuestionContext) => ArchitectMutation;
  summarize: (answer: unknown, context: QuestionContext) => string;
  next: (context: QuestionContext) => QuestionPointer;
}
```

The engine must not run arbitrary script text from data. Question definitions are compiled application code, and formula parsing continues to use the existing safe parsers.

## 7. Deterministic input interpretation

### 7.1 Semicolon lists

- Split on semicolons.
- Trim leading and trailing whitespace.
- Collapse repeated internal whitespace.
- Ignore blank items.
- Compare duplicates case-insensitively and show a merge warning.
- Never split on commas because names and descriptions may contain commas.
- Preserve the user-entered display spelling.

### 7.2 Quantitative requirement extraction

Recognize explicit operators and phrases:

| User wording | Operator |
|---|---|
| less than, below | `<` |
| no more than, at most, shall not exceed | `<=` |
| exactly, equal to | `=` |
| at least, no less than | `>=` |
| greater than, above | `>` |

Extract one finite number and an adjacent unit when present. Map known property words to semantic keys, for example mass→`mass`, cost/investment→`cost`, power/energy rate→`power`, duration/lead time→`durationHours`, capacity/throughput→`throughput`. The user must confirm property, operator, target and unit.

If a sentence contains several limits, the engine proposes separate requirements and asks for confirmation. If no safe extraction exists, the user completes structured fields. Free text is never silently converted into a formal formula.

### 7.3 Formula construction

- The readable builder selects parameters and KPIs by name and owner.
- Stored expressions use immutable IDs/bindings.
- Requirement formulas use the existing `RequirementFormula` binding structure.
- A valid requirement-to-parameter binding is a first-class satisfaction path when the parameter is owned by a `productFunction`, `processFunction`, `productComponent`, or `industrialSystemComponent`.
- KPI formulas use only finite literals, `param()`, `kpi()`, arithmetic, parentheses, `min`, `max`, `sum`, and `average`.
- Preview must detect missing references, incompatible units, division by zero and dependency cycles.
- No use of `eval`, `Function`, dynamic script injection or JavaScript expression execution.

## 8. Complete question catalogue

Notation: **Required** controls Ready status. “Loop” means the same question definition is instantiated once for each current model item. Every question has **Back**, **Skip** and **Continue**; Skip has no countdown.

### Section A — Perspective and study setup

#### AV-A01 — Perspective

- Prompt: **How would you like to work?**
- Explanation: Architect view builds the model through guided questions; Modeler view opens the complete engineering workspaces.
- Input: two selectable options.
- Required: yes, application navigation only.
- Effect: stores the UI preference; does not change model content.

#### AV-A02 — Analysis scope

- Prompt: **What should this study include?**
- Explanation: The scope determines how far the guided workflow continues.
- Options: Architecture definition; Architecture and simulation; Trade-off.
- Required: yes.
- Effect: sets `Project.overallScope` and `ArchitectSession.scope`.
- Coffee example: Trade-off.

#### AV-A03 — Project name

- Prompt: **What should this study be called?**
- Explanation: Use a short name that distinguishes this project from other saved projects.
- Input: single-line text, 1–120 characters.
- Required: yes.
- Effect: updates `Project.name`.
- Coffee example: Coffee Machine Product-Line Study.

#### AV-A04 — Mission

- Prompt: **What is the mission of this study?**
- Explanation: The mission identifies the main purpose. It focuses on what the system must achieve to solve a specific problem.
- Input: multiline text.
- Required: yes.
- Effect: creates or updates one common `mission` element.
- Coffee example: The core mission is to provide high-quality, personalized caffeinated beverages to office employees to boost workplace productivity and satisfaction, while minimizing maintenance overhead for office managers.

### Section B — Stakeholders, needs and objectives

#### AV-B01 — Stakeholder list

- Prompt: **Which stakeholders are involved?**
- Explanation: Separate several stakeholders with semicolons.
- Input: semicolon list.
- Required: at least one stakeholder.
- Effect: creates common `stakeholder` elements and Mission `hasStakeholder` relationships.
- Coffee example: Coffee Machine Product Line; Office Employee; Office Manager; Product Manager; Manufacturing Engineer; Service Technician; Quality Manager.

#### AV-A05 — System of interest

- Position: immediately after AV-B01, when the complete stakeholder list is available.
- Prompt: **Which stakeholder is the system being designed or analysed?**
- Explanation: Select the system of interest from the stakeholders already defined. This selection determines which use cases may enter the working scope.
- Input: single-select from the AV-B01 stakeholder list; no free-text creation in this question.
- Required: exactly one.
- Effect: sets `metadata.isSystemOfInterest=true` on the selected stakeholder and clears the flag from any other stakeholder after confirmation.
- Coffee example: Coffee Machine Product Line.

#### AV-B02 — Stakeholder description (loop)

- Prompt: **What is {stakeholderName} responsible for in this study?**
- Explanation: A short role description improves the interpretation of needs and objectives.
- Input: multiline text.
- Required: no.
- Effect: updates stakeholder description and owner metadata.

#### AV-B03 — Stakeholder needs (loop)

- Prompt: **What does {stakeholderName} need from the system or programme?**
- Explanation: Enter outcomes or concerns, not proposed solutions; separate several needs with semicolons.
- Input: semicolon list.
- Required: at least one need across the project; every non-system stakeholder may be skipped with a visible gap.
- Effect: creates `need` elements and Stakeholder `hasNeed` relationships.
- Coffee example for Customer: Fast beverage preparation; Consistent beverage quality; Safe and intuitive operation.

#### AV-B04 — Stakeholder objectives (loop)

- Prompt: **What measurable or directional objectives does {stakeholderName} want to achieve?**
- Explanation: Objectives express the desired improvement or target that will guide requirements and KPIs.
- Input: semicolon list.
- Required: at least one objective across the project.
- Effect: creates `objective` elements and Stakeholder `hasObjective` relationships.
- Coffee example: Serve peak household demand; Keep the appliance compact and efficient; Control product-line investment.

#### AV-B05 — Intent recap

- Prompt: **Does this correctly represent the study intent?**
- Explanation: Review the mission, stakeholders, needs and objectives before defining behavior.
- Input: confirm or edit links.
- Required: yes.
- Effect: marks Section B reviewed; no duplicate records.

### Section C — Use cases and working scope

#### AV-C01 — Use-case list

- Prompt: **In which situations will people or external systems use the system of interest?**
- Explanation: Write short verb-led use cases and separate several with semicolons.
- Input: semicolon list.
- Required: at least one.
- Effect: creates common `useCase` elements.
- Coffee example: Configure coffee-machine variant; Prepare beverage; Clean machine; Diagnose fault; Manufacture coffee machine; Verify manufactured coffee machine.

#### AV-C02 — Use-case participants (loop)

- Prompt: **Who is involved in “{useCaseName}”?**
- Explanation: Select every relevant stakeholder, including the system of interest when it participates.
- Input: multi-select existing stakeholders.
- Required: system of interest plus at least one participant where applicable.
- Effect: creates Stakeholder `involvedIn` Use case relationships.

#### AV-C03 — Need coverage (loop)

- Prompt: **Which stakeholder needs does “{useCaseName}” address?**
- Explanation: This connection explains why the use case belongs in the study.
- Input: multi-select existing needs.
- Required: at least one need for every selected use case.
- Effect: no new unsupported relation is created; the trace is presented through the involved stakeholder and its `hasNeed` links. A future direct relation must not be invented without extending the canonical ontology.

#### AV-C04 — Working use-case scope

- Prompt: **Which use cases should this analysis cover?**
- Explanation: Only use cases involving the system of interest are available for selection.
- Input: multi-select compatible use cases.
- Required: at least one.
- Effect: updates `Project.selectedUseCaseIds`.

#### AV-C05 — Use-case recap

- Prompt: **Is this the correct working scope?**
- Explanation: Review participants, covered needs and selected use cases before requirements are defined.
- Input: confirm or edit.
- Required: yes.
- Effect: marks Section C reviewed.

### Section D — Requirements and engineering properties

#### AV-D01 — Requirements from need (loop)

- Prompt: **What must the system do or achieve to satisfy “{needName}”?**
- Explanation: Enter testable requirement statements; separate several statements with semicolons.
- Input: semicolon list.
- Required: every need in the working scope must derive at least one requirement.
- Effect: creates `systemRequirement` elements and Need `derives` Requirement relationships.

#### AV-D02 — Requirements from objective (loop)

- Prompt: **Which requirements make “{objectiveName}” measurable or achievable?**
- Explanation: Select an existing requirement or add a new one; several objectives may derive the same requirement.
- Input: existing requirement multi-select plus semicolon list for new requirements.
- Required: every objective in scope must derive at least one requirement.
- Effect: creates or reuses requirements and creates Objective `derives` Requirement relationships.

#### AV-D03 — Requirement applicability (loop)

- Prompt: **Which selected use cases make “{requirementName}” relevant?**
- Explanation: This working-scope association controls which requirement is considered without creating a non-canonical relationship.
- Input: multi-select selected use cases.
- Required: at least one.
- Effect: stores the association in the Architect answer projection; canonical trace continues through scoped needs/objectives and use-case participants.

#### AV-D04 — Requirement kind (loop)

- Prompt: **Is “{requirementName}” evaluated with a number?**
- Explanation: Quantitative requirements receive a formal comparison; qualitative requirements require verification evidence.
- Options: Yes, quantitative; No, qualitative; Not sure.
- Required: yes.
- Effect: selects the next branch.

#### AV-D05 — Quantitative meaning (conditional loop)

- Prompt: **How should “{requirementName}” be checked quantitatively?**
- Explanation: Define the measured property, comparison, target and unit. This creates the formal formula used to evaluate the requirement. The semantic key identifies the property for formulas and KPI calculations.
- Input: property name, semantic key, operator, target number, unit.
- Required: for quantitative requirements.
- Validation: finite target; known or user-defined unit; non-empty property; supported operator.
- Effect: creates or updates `ArchitectParameterIntent`; formula remains pending until a canonical parameter owner exists.
- Coffee example: Beverage throughput; `throughput`; `>=`; `10`; `beverages/h`.

#### AV-D06 — Engineering property source (conditional loop)

- Prompt: **Where will the actual value of “{propertyName}” come from?**
- Explanation: Select an existing model element if available, or defer the owner until the architecture is created.
- Options: existing element; architecture element to be defined later; KPI result; verification result.
- Required: yes, but “later” is a valid draft answer.
- Effect: binds immediately when possible or leaves the parameter intent `ownerMissing`.

#### AV-D07 — Known engineering value (conditional loop)

- Prompt: **Do you already know a preliminary value for “{propertyName}”?**
- Explanation: Enter the value, source and origin, or leave it pending until the responsible architecture element is defined.
- Input: optional value, unit, source, origin (`entered`, `assumed`, `calculated`, `simulated`), uncertainty.
- Required: not for architecture structure readiness; required before calculation when the formula uses the value.
- Effect: creates/updates canonical parameter if an owner exists; otherwise stores the value in the parameter intent for later binding.

#### AV-D08 — Qualitative verification intent (conditional loop)

- Prompt: **How could “{requirementName}” be verified?**
- Explanation: Describe the expected inspection, analysis, demonstration or test; the detailed method can be completed later.
- Input: short text plus method category.
- Required: qualitative requirements require at least a proposed method before Ready.
- Effect: creates a draft `verificationMethod` and Verification method `verifies` Requirement relationship.

#### AV-D09 — Requirement priority (loop)

- Prompt: **How important is “{requirementName}”?**
- Explanation: Mandatory requirements control feasibility; preferences guide later trade-offs.
- Options: Mandatory; Important; Desirable.
- Required: yes.
- Effect: maps to requirement priority metadata and, for trade scope, default mandatory requirement selection.

#### AV-D10 — Requirements recap

- Prompt: **Do the requirements correctly express the selected needs and objectives?**
- Explanation: Review origins, quantitative interpretations, pending property owners and proposed verification.
- Input: confirm or edit.
- Required: yes.
- Effect: marks Section D reviewed. Unresolved satisfaction links are expected until architecture creation and are shown as pending, not as lost information.

### Section T — Early trade-off framing (Trade-off scope only)

#### AV-T01 — Trade-study name

- Prompt: **What should this trade study be called?**
- Explanation: Use a short name describing the alternatives or decision.
- Input: single-line text.
- Required: yes.
- Effect: creates or updates the active `ComparisonStudy`.
- Coffee example: Coffee-machine product-line architecture selection.

#### AV-T02 — Decision question

- Prompt: **What decision must this trade study answer?**
- Explanation: Phrase one explicit question that can be answered by comparing feasible alternatives.
- Input: multiline text.
- Required: yes.
- Effect: sets study question and creates/updates the linked open decision.
- Coffee example: Which coffee-machine architecture should become the product-line baseline?

#### AV-T03 — Common solution content

- Prompt: **What must every alternative contain or support?**
- Explanation: Describe shared capabilities, requirements or architecture content; separate several items with semicolons.
- Input: semicolon list.
- Required: at least one.
- Effect: creates draft common-feature intents and highlights candidate common requirements/elements; canonical features are confirmed after architecture creation.
- Coffee example: Common brew control; Food and electrical safety; Beverage preparation; End-of-line verification.

#### AV-T04 — Alternative characteristics

- Prompt: **What may differ between the alternatives?**
- Explanation: Describe independent choice areas rather than naming complete alternatives; separate several with semicolons.
- Input: semicolon list.
- Required: at least one.
- Effect: creates draft variability-axis intents.
- Coffee example: Brewing technology; Milk preparation system; User-interface type.

#### AV-T05 — Initial alternative concepts

- Prompt: **Which solution concepts do you already want to compare?**
- Explanation: Enter concept names and short descriptions; more configurations can be created later.
- Input: repeatable name and description.
- Required: at least two for Trade-off Ready.
- Effect: creates draft architectures/configuration intents, not yet valid configurations.
- Coffee example: Essential Capsule; Balanced Bean-to-Cup; Premium Dual Boiler.

#### AV-T06 — Trade framing recap

- Prompt: **Does this correctly describe the decision and variation to explore?**
- Explanation: Confirm the decision question, common content, variability axes and initial alternatives before building the 150% architecture.
- Input: confirm or edit.
- Required: yes.

### Section E — Product functional architecture

The following questions loop through one selected use case at a time. Only the active use case remains in focus.

#### AV-E01 — Product functions per use case (loop)

- Prompt: **What must the product do during “{useCaseName}”?**
- Explanation: Enter functions in their normal order and separate them with semicolons.
- Input: ordered semicolon list.
- Required: at least one product function for every selected use case.
- Effect: creates/reuses `productFunction` elements and Use case `hasFunction` relationships.
- Coffee example for Prepare beverage: Meter coffee ingredients; Heat and pressurize brew water; Monitor beverage quality.

#### AV-E02 — Product sequence confirmation (loop)

- Prompt: **Is this the correct order for “{useCaseName}”?**
- Explanation: Reorder the functions or mark functions that can occur in parallel.
- Input: reorder list with optional parallel grouping.
- Required: yes when a use case has two or more functions.
- Effect: creates/updates a product `FunctionSequence` and `precedes` relationships with its sequence ID; cycles are blocked.

#### AV-E03 — Function-to-requirement satisfaction (loop per function)

- Prompt: **Which requirements, if any, does “{functionName}” help satisfy?**
- Explanation: Select only requirements directly supported by this function. A function is valid even when it does not itself satisfy a requirement.
- Input: multi-select requirements in scope.
- Required: no; an empty selection is valid.
- Effect: creates Requirement `satisfiedBy` Product function relationships.
- Completeness direction: validation starts from each requirement and checks whether that requirement has at least one valid satisfaction path; it must never require every function to satisfy a requirement.

#### AV-E04 — Product function recap

- Prompt: **Does the product behavior cover the selected use cases and requirements?**
- Explanation: Review use-case coverage, sequence and requirement links.
- Input: confirm or edit.
- Required: yes.

### Section F — Product technical architecture

#### AV-F01 — Realizing product component (loop per product function)

- Prompt: **Which product component performs “{functionName}”?**
- Explanation: Enter one or more components; separate several with semicolons.
- Input: existing selection plus semicolon list. The section also provides **Add product component** for purchased, intermediate, assembled or verified product items needed by the industrial product flow even when they do not directly realize a product function.
- Required: at least one component for each product function.
- Effect: creates/reuses `productComponent` elements and Product function `realizedBy` Product component relationships.
- Coffee examples: Ingredient-handling module; Brewing and heating module; Beverage sensing module.

#### AV-F02 — Component requirement satisfaction (loop per component)

- Prompt: **Which requirements, if any, are satisfied by “{componentName}”?**
- Explanation: The interface may propose requirements linked to its functions, but a component is valid without a direct satisfaction link.
- Input: multi-select with proposed selections.
- Required: no; an empty selection is valid.
- Effect: creates Requirement `satisfiedBy` Product component relationships.

#### AV-F03 — Pending product-property owner resolution (conditional loop)

- Prompt: **Which product function or component owns the actual value for “{propertyName}”?**
- Explanation: Bind the previously defined evaluation property to the function or technical component that owns the engineering value.
- Input: single-select compatible product functions and product components, plus Leave pending.
- Required: required for architecture Ready when a quantitative requirement depends on the property.
- Effect: creates or rehomes the canonical `Parameter`, preserves its ID, sets its owner to a product function or product component, and creates the exact requirement-formula binding. This binding is a valid requirement-satisfaction path.

#### AV-F04 — Product engineering value (conditional loop)

- Prompt: **What is the current value of “{propertyName}” for “{ownerName}”?**
- Explanation: Enter the value, unit, source and origin; assumptions remain explicitly labelled.
- Input: value, unit, source, origin, optional range and uncertainty.
- Required: a value is needed for evaluated Ready status, but an architecture may remain structurally Ready with a visible pending evaluation.
- Effect: updates canonical parameter and requirement evaluation.

#### AV-F05 — Component interaction (loop)

- Prompt: **Does “{componentName}” exchange material, energy or information with another product component?**
- Explanation: Add only interfaces needed to describe the architecture under study.
- Input: counterpart, interface name, exchanged item and direction.
- Required: conditional when an interaction is declared.
- Effect: creates `productInterface` and compatible `connects` relationships.

#### AV-F06 — Product technical recap

- Prompt: **Does the product architecture realize its functions and satisfy its requirements?**
- Explanation: Review functions, components, interfaces, parameters and satisfaction links.
- Input: confirm or edit.
- Required: yes.

### Section G — Industrial-system functional and technical architecture

#### AV-G01 — Industrial functions per use case (loop)

- Prompt: **What must the industrial system do to support “{useCaseName}”?**
- Explanation: Describe the manufacturing, integration, handling or verification work in order; separate functions with semicolons.
- Input: ordered semicolon list.
- Required: at least one process function for each selected manufacturing-relevant use case; an explicit “not applicable” justification is allowed for product-only operational use cases.
- Effect: creates/reuses `processFunction` elements and Use case `hasFunction` relationships.
- Coffee example for Manufacture coffee machine: Manufacture coffee-machine modules; Integrate coffee-machine modules; Test completed coffee machine.

#### AV-G02 — Industrial sequence confirmation (loop)

- Prompt: **Is this the correct industrial sequence for “{useCaseName}”?**
- Explanation: Reorder the functions or identify permitted parallel steps.
- Input: reorder list with optional parallel grouping.
- Required: yes when two or more process functions apply.
- Effect: creates/updates process `FunctionSequence` and cycle-free `precedes` relationships.

#### AV-G03 — Industrial function requirement satisfaction (loop)

- Prompt: **Which requirements, if any, does “{processFunctionName}” help satisfy?**
- Explanation: Select requirements directly supported by the industrial activity. A process function is valid even when it does not itself satisfy a requirement.
- Input: multi-select.
- Required: no; an empty selection is valid.
- Effect: creates Requirement `satisfiedBy` Process function relationships.
- Completeness direction: validation checks every requirement for a satisfaction path; it must never require every industrial function to satisfy a requirement.

#### AV-G04 — Realizing industrial component (loop)

- Prompt: **Which equipment or workplace performs “{processFunctionName}”?**
- Explanation: Enter one or more industrial-system components; separate several with semicolons.
- Input: existing selection plus semicolon list.
- Required: at least one per process function.
- Effect: creates/reuses `industrialSystemComponent` elements and Process function `realizedBy` Industrial component relationships.
- Coffee examples: Module assembly workstation; Coffee-machine integration cell; End-of-line test station.

#### AV-G05 — Industrial component requirement satisfaction (loop)

- Prompt: **Which requirements, if any, are satisfied by “{industrialComponentName}”?**
- Explanation: Confirm only direct satisfaction evidence; an industrial component is valid without a requirement link.
- Input: multi-select.
- Required: no; an empty selection is valid.
- Effect: creates Requirement `satisfiedBy` Industrial component relationships.

#### AV-G05A — Pending industrial-property owner resolution (conditional loop)

- Prompt: **Which industrial function or component owns the actual value for “{propertyName}”?**
- Explanation: Bind the requirement's evaluation property to the process function or industrial-system component that provides the authoritative engineering value.
- Input: single-select compatible process functions and industrial-system components, plus Leave pending.
- Required: required for architecture Ready when a quantitative requirement depends on an industrial property.
- Effect: creates or rehomes the canonical `Parameter`, preserves its ID, sets its owner to a process function or industrial-system component, and creates the exact requirement-formula binding. This binding is a valid requirement-satisfaction path.

#### AV-G05B — Industrial engineering value (conditional loop)

- Prompt: **What is the current value of “{propertyName}” for “{ownerName}”?**
- Explanation: Enter the value, unit, source and origin; assumptions remain explicitly labelled.
- Input: value, unit, source, origin, optional range and uncertainty.
- Required: a value is needed for evaluated Ready status, but an architecture may remain structurally Ready with a visible pending evaluation.
- Effect: updates the canonical parameter and requirement evaluation.

#### AV-G06 — Authoritative process duration (loop)

- Prompt: **How long does “{processFunctionName}” take?**
- Explanation: Enter the authoritative duration and its source; lead-time and resource calculations use this value.
- Input: positive number, minute/hour/day, source, origin, optional uncertainty.
- Required: for simulation and trade scopes; optional but recommended for architecture definition.
- Effect: updates process-function duration metadata and generated duration parameter if the application exposes it.

#### AV-G07 — Product flow consumed (loop)

- Prompt: **What product item does “{processFunctionName}” consume?**
- Explanation: Select from product components previously defined in AV-F01 and specify quantity and unit.
- Input: zero or more AV-F01 product components with item-flow name, positive quantity and unit. If an item is missing, **Add product component** returns to AV-F01; it is not created silently inside the flow question.
- Required: every non-initial process function should have an input unless explicitly justified.
- Effect: creates Process function `consumes` Product component relationships.

#### AV-G08 — Product flow produced (loop)

- Prompt: **What product item does “{processFunctionName}” produce?**
- Explanation: Select the resulting item from product components previously defined in AV-F01 and specify quantity and unit.
- Input: one or more AV-F01 product components with item-flow name, positive quantity and unit. If an intermediate, assembled or verified product item is missing, **Add product component** returns to AV-F01 before the flow is created.
- Required: every manufacturing process function must produce an output.
- Effect: creates Process function `produces` Product component relationships.

#### AV-G09 — Required resources (loop per industrial component)

- Prompt: **Which resources does “{industrialComponentName}” require?**
- Explanation: Include people, roles, skills, tools, machines, software or facilities; separate names with semicolons.
- Input: semicolon list followed by resource detail rows.
- Required: at least one resource for industrial components within the simulation/trade scope; optional with warning for architecture definition.
- Effect: creates/reuses `resource` elements and Industrial component `requiresResource` Resource relationships.

#### AV-G10 — Resource quantity and capacity (loop)

- Prompt: **How much of “{resourceName}” is required by “{industrialComponentName}”?**
- Explanation: Quantity drives resource demand; rates and capacity enable cost and utilization calculations.
- Input: quantity, unit, resource type, optional hourly rate/currency, capacity hours and availability.
- Required: positive quantity; rates/capacity required only when selected KPIs need them.
- Effect: updates relationship quantity and resource metadata.

#### AV-G11 — Industrial interface (loop)

- Prompt: **Does “{industrialComponentName}” exchange material, energy or information with another industrial component?**
- Explanation: Add only interfaces needed to understand the industrial architecture.
- Input: counterpart, interface name and exchanged content.
- Required: conditional.
- Effect: creates `processInterface` and compatible `connects` relationships.

#### AV-G12 — Industrial architecture recap

- Prompt: **Does the industrial architecture realize its functions, product flows and resource needs?**
- Explanation: Review sequence, equipment, consumed and produced product items, durations and resources.
- Input: confirm or edit.
- Required: yes.

### Section H — Verification, traceability and architecture readiness

#### AV-H01 — Verification method (loop per requirement)

- Prompt: **How will “{requirementName}” be verified?**
- Explanation: Select an existing method or describe an analysis, inspection, demonstration or test.
- Input: method category, name, description and optional allocated process function.
- Required: at least one verification method per mandatory requirement for full Ready; architecture definition may distinguish planned from completed evidence.
- Effect: creates/reuses `verificationMethod`, `verifies` and optional `allocatedTo` relationships.

#### AV-H02 — Satisfaction gap resolution (conditional loop)

- Prompt: **Which function, technical component or owned parameter satisfies “{requirementName}”?**
- Explanation: Select the capability-providing function or component, or bind the requirement to the authoritative parameter owned by one of those elements.
- Input: compatible product/process functions, product/industrial components, and their parameters. Parameters without a compatible owner are not selectable.
- Required: every mandatory requirement requires at least one valid satisfaction path.
- Effect: functions and components create canonical `satisfiedBy` relationships. Parameters create or update the exact requirement-formula binding; the parameter's `ownerElementId` completes the trace to its function or technical component.

#### AV-H03 — Requirement evaluation review (loop)

- Prompt: **Is the current evidence for “{requirementName}” complete and credible?**
- Explanation: Review actual value, target, source, origin, unit and verification status.
- Input: confirm; edit input; mark pending with reason.
- Required: structural architecture Ready permits pending calculated evidence; analysis Ready requires evaluable mandatory requirements.
- Effect: marks evidence reviewed and records an explicit pending reason where needed.

#### AV-H04 — Architecture recap

- Prompt: **Is the architecture ready for its selected scope?**
- Explanation: Review intent coverage, behavior, realization, requirement satisfaction, industrial flow, resources and verification.
- Input: confirm or follow recommended fix links.
- Required: yes.
- Effect: calculates scope status from validation; it never overrides blocking findings.

### Section I — Evaluation KPIs and model inputs (Architecture + simulation and Trade-off)

For Trade-off scope, AV-I01–I03 and AV-I06–I07 appear immediately after Trade-off framing so the evaluation intent is defined before the 150% architecture. AV-I04, AV-I05 and AV-I08 appear after architecture construction, when exact model inputs exist. Architecture + simulation uses AV-I01–I06, AV-I08 and AV-I11–I12; it selects the current canonical architecture automatically and does not ask trade-study direction or weight questions. Trade-off simulation is performed later in Section S against derived 100% architectures.

#### AV-I01 — KPI suggestions

- Prompt: **Which results should be calculated to evaluate the objectives?**
- Explanation: The page suggests KPIs from requirements, semantic parameter keys and process data; select only decision-relevant measures.
- Input: checklist with description and required inputs.
- Required: at least one objective-linked KPI.
- Suggested standard algorithms: total mass, direct element cost, process cost, estimated total cost, total power, manufacturing lead time, resource demand, basic utilization and throughput proxy.

#### AV-I02 — KPI purpose and objective (loop)

- Prompt: **Which objective does “{kpiName}” evaluate?**
- Explanation: This connection keeps every calculated result tied to stakeholder intent.
- Input: multi-select objectives.
- Required: at least one objective.
- Effect: updates `KPI.objectiveIds`.

#### AV-I03 — KPI calculation method (loop)

- Prompt: **How should “{kpiName}” be calculated?**
- Explanation: Use a verified standard algorithm where applicable or build a formula from model parameters and existing KPIs.
- Input: Standard algorithm; Guided formula.
- Required: yes.
- Effect: sets mutually exclusive calculation mode and algorithm/formula fields.

#### AV-I04 — Standard KPI confirmation (conditional loop)

- Prompt: **Does the model contain every input required for “{kpiName}”?**
- Explanation: Review the exact elements, semantic keys, durations, resource quantities and units used by the algorithm.
- Input: input checklist and targeted fix links.
- Required: all blocking inputs resolved before run.
- Effect: no duplicate data; records reviewed input set.

#### AV-I05 — Guided KPI formula (conditional loop)

- Prompt: **Build the calculation for “{kpiName}”.**
- Explanation: Insert parameters and existing KPIs by readable name; the application stores exact references.
- Input: formula builder with operators and functions.
- Required: valid formula preview.
- Effect: saves formula, input parameter IDs and dependent KPI IDs.

#### AV-I06 — KPI interpretation (loop)

- Prompt in Architecture + simulation: **What unit, target and limits apply to “{kpiName}”?**
- Explanation: Confirm output unit, target and optional minimum/maximum limits. Trade-off scope also captures preferred direction.
- Input: unit, target and optional limits; minimize/maximize only in Trade-off scope.
- Required: unit; direction remains a Trade-off concern.

#### AV-I07 — KPI global weight (Trade-off loop)

- Prompt: **How important is “{kpiName}” outside a specific trade study?**
- Explanation: This global default is copied into a trade study but can be changed there without modifying the KPI definition.
- Input: non-negative numeric weight or guided Low/Medium/High mapping.
- Required only in Trade-off scope: finite non-negative value; at least one selected KPI weight greater than zero for comparison.

#### AV-I08 — Missing simulation input (dynamic loop)

- Prompt: **What value should be used for “{parameterName}” on “{ownerName}”?**
- Explanation: This value is required by {kpiName}; enter evidence or record an explicit assumption.
- Input: value, unit, source, origin and uncertainty.
- Required: yes for selected calculation.
- Effect: updates canonical parameter; does not create hidden defaults.

#### AV-I11 — Run name and execute

Architecture + simulation only. Trade-off scope uses the batch run at AV-S03.

- Prompt: **Name and run this analysis.**
- Explanation: The workbench validates and uses the current canonical architecture automatically; the run name can be edited before execution.
- Input: run name and Run action.
- Required: current valid input set.
- Effect: creates immutable `SimulationRun` evidence.

#### AV-I12 — Simulation recap

Architecture + simulation only. Trade-off scope uses the multi-alternative recap at AV-S04.

- Prompt: **Simulation Results**

- Prompt: **What does the current simulation show?**
- Explanation: Review requirement status, key KPI values, assumptions, warnings and source inputs.
- Input: no data entry; links to fix or rerun.
- Required: a current successful run for Simulation Ready.

### Section J — Feature model and variability mapping (Trade-off only)

#### AV-J01 — Root feature

- Prompt: **What represents the complete configurable family?**
- Explanation: One root feature contains the common and variable product-line choices.
- Input: proposed name and description.
- Required: exactly one root.
- Effect: creates/updates one root `Feature` and links it to the active trade study.
- Coffee example: Coffee Machine Product Line.

#### AV-J02 — Common features

- Prompt: **Which previously described capabilities are mandatory in every alternative?**
- Explanation: Confirm the common-content proposals created during trade framing.
- Input: editable list.
- Required: at least one is recommended; structural completeness may allow none with justification.
- Effect: creates mandatory child features.

#### AV-J03 — Variability axes (loop from axis intents)

- Prompt: **What choices are available for “{axisName}”?**
- Explanation: Enter the alternatives and choose whether exactly one, one or more, or an optional choice is allowed.
- Input: choice list plus XOR/OR/optional/typed value mode.
- Required: at least one valid axis and feature group.
- Effect: creates `VariabilityAxis`, `FeatureGroup` and child features.
- Coffee example: Heating architecture → Single Thermoblock XOR Dual Boiler.

#### AV-J04 — Typed feature values (conditional loop)

- Prompt: **Which values are allowed for “{featureName}”?**
- Explanation: Use typed values for configuration properties such as regional voltage.
- Input: boolean, finite number with optional bounds, or distinct enumeration list.
- Required: for typed features.
- Effect: updates feature value type, allowed values and bounds.

#### AV-J05 — Feature constraint proposals

- Prompt: **Do any choices require or exclude other choices?**
- Explanation: Add only rules needed to prevent invalid alternatives.
- Input: If feature A is selected, require/exclude feature B.
- Required: conditional.
- Effect: creates safe `FeatureConstraint` expressions.

#### AV-J06 — Element applicability (loop over variable model elements)

- Prompt: **When should “{elementName}” be present?**
- Explanation: Select the feature choices that activate this requirement, function, component, process, resource or verification method.
- Input: guided feature expression builder.
- Required: every variable element requires a valid expression; blank means always active.
- Effect: creates existence variation point or uses the canonical feature-expression mechanism without duplicating it.

#### AV-J07 — Property variability (conditional loop)

- Prompt: **Does a property of “{elementName}” change between choices?**
- Explanation: Map feature values to an existing parameter, metadata field, tag or supported element property.
- Input: variation kind, target property, condition and values.
- Required: conditional.
- Effect: creates `VariationPoint` with exact target and realization scopes.

#### AV-J08 — Realization domain (loop)

- Prompt: **Which parts of the model does this variation affect?**
- Explanation: Select requirements, structure, behavior, process, resources or verification; blank means all applicable domains.
- Input: multi-select.
- Required: no; blank is explicit all-domains behavior.
- Effect: updates variation-point realization scopes.

#### AV-J09 — Variability recap

- Prompt: **Does the 150% model contain the complete family and valid variability rules?**
- Explanation: Review feature hierarchy, constraints, variable elements and property changes.
- Input: confirm or edit.
- Required: yes.

### Section K — Configurations and 100% realization (Trade-off only)

All alternative configurations are created and validated first. Only after the complete configuration set exists does the guided sequence present the 100% derivation questions for each valid configuration.

#### AV-K01 — Configuration selection (loop per alternative concept)

- Prompt: **Which choices define “{alternativeName}”?**
- Explanation: Select one value for every required choice group and any optional features.
- Input: feature configurator.
- Required: every required group resolved.
- Effect: creates/updates `Configuration` selections.

#### AV-K02 — Constraint assistance (conditional)

- Prompt: **This selection requires another choice. How should it be resolved?**
- Explanation: Review the rule and choose whether to make the correction manually or apply the proposed selection.
- Input: Manual; Apply proposed correction.
- Required: invalid drafts may be saved, but must be resolved before derivation.

#### AV-K03 — Invalid configuration recap (conditional loop)

- Prompt: **How should the invalid configuration “{configurationName}” be corrected?**
- Explanation: The configuration remains saved as a draft, but derivation and analysis are blocked.
- Input: open conflicting choices.
- Required: valid status before next stage.

#### AV-K04 — Derivation confirmation (loop)

- Prompt: **Create the 100% architecture for “{configurationName}”?**
- Explanation: Review included, excluded and modified content before deterministic derivation.
- Input: Derive action.
- Required: valid configuration and current 150% source.
- Effect: stores current derivation evidence without mutating the 150% source.

#### AV-K05 — Derivation recap (loop)

- Prompt: **Does the realized architecture match “{configurationName}”?**
- Explanation: Review features, included and excluded elements, property changes, warnings and validation.
- Input: confirm or return to mapping/configuration.
- Required: current successful derivation.

### Section S — Simulate architectures (Trade-off only)

This section remains locked until at least two study-owned alternatives have valid configurations and current 100% derivations. The architecture context is never selected manually: each simulation is bound automatically to its corresponding configuration and saved derivation.

#### AV-S01 — Alternative simulation readiness

- Prompt: **Are all alternatives ready for simulation?**
- Explanation: Review configuration validity and 100% derivation currency for every intended alternative.
- Input: readiness list and confirmation.
- Required: yes.
- Effect: creates no run; identifies configuration or derivation work that must be completed first.

#### AV-S03 — Batch configured simulation

- Prompt: **Run the selected KPIs for all derived alternatives?**
- Explanation: Execute the same selected KPI set against every current 100% architecture.
- Input: editable run-series name and confirmation.
- Required: at least two valid, current 100% derivations.
- Effect: atomically creates one immutable configured `SimulationRun` per derived alternative; if any alternative cannot run, no partial batch is stored.

#### AV-S04 — Comparable simulation recap

- Prompt: **Simulation Results**
- Explanation: Review KPI coverage, values, units, sources and warnings side by side.
- Input: no data entry; confirm only when every alternative has current numeric evidence for the complete KPI set.
- Required: yes.

### Section L — Trade comparison and decision (Trade-off only)

#### AV-L01 — Comparable alternatives

- Prompt: **Which realized alternatives should be compared?**
- Explanation: Only current derived architectures with eligible simulation evidence are available.
- Input: multi-select; at least two.
- Required: yes.
- Effect: updates active study alternative references.

#### AV-L02 — Mandatory requirements

- Prompt: **Which requirements must every feasible alternative satisfy?**
- Explanation: Mandatory requirements are evaluated before weighted scoring.
- Input: proposed selection from requirement priorities.
- Required: at least one.
- Effect: updates study mandatory requirement IDs.

#### AV-L03 — Comparison KPIs

- Prompt: **Which KPIs should distinguish the alternatives?**
- Explanation: Select only KPIs with comparable, current evidence for the alternatives.
- Input: multi-select eligible KPIs.
- Required: at least one.

#### AV-L04 — Guided KPI importance (loop)

- Prompt: **How important is “{kpiName}” to this decision?**
- Explanation: Low, Medium and High propose visible numerical weights that remain editable.
- Input: Low=1, Medium=2, High=3, or custom non-negative number.
- Required: finite non-negative; at least one positive.
- Effect: updates study-specific setting without changing global KPI definition.

#### AV-L05 — Study direction and threshold (loop)

- Prompt: **What result is preferred and which limit applies for “{kpiName}”?**
- Explanation: Confirm minimize/maximize and copy any requirement limit as an editable warning or hard threshold.
- Input: direction, optional minimum/maximum, warning/hard mode.
- Required: valid finite bounds when present.

#### AV-L06 — Evidence comparability review

- Prompt: **Are the alternatives ready for a fair comparison?**
- Explanation: Review model revisions, derivations, simulation currency, KPI coverage, units and assumptions.
- Input: acknowledge non-blocking differences or follow fix links.
- Required: no blocking gaps.

#### AV-L07 — Run comparison

- Prompt: **Calculate the trade-off results?**
- Explanation: Feasibility is evaluated first; scores use only the visible KPI settings and available comparable evidence.
- Input: Run comparison action.
- Required: valid setup.
- Effect: stores comparison results, coverage, threshold violations and sensitivity evidence.

#### AV-L08 — Result interpretation

- Prompt: **Does this result reflect the decision priorities?**
- Explanation: Review feasibility, decisive KPI trade-offs, ties, warnings and bounded weight sensitivity.
- Input: confirm or edit settings and rerun.
- Required: current comparison.

#### AV-L09 — Baseline proposal

- Prompt: **Should “{leadingAlternativeName}” be proposed as the baseline?**
- Explanation: The proposal shows why it leads, which requirements pass, decisive KPI evidence and remaining warnings; ties require an explicit user choice.
- Input: Propose; choose another feasible alternative; return to comparison.
- Required: explicit choice.
- Effect: creates/updates a draft decision; it does not silently change the baseline.

#### AV-L10 — Decision rationale

- Prompt: **Why is this alternative the appropriate baseline?**
- Explanation: Record the engineering rationale, accepted trade-offs, decision owner and date.
- Input: rationale, owner, status and confirmation.
- Required: rationale and owner before approval.
- Effect: confirms decision and updates baseline only after explicit approval.

### Section M — Final recap

#### AV-M02 — Requirements and validation recap

- Default content: the focused requirement overview, presented as Why needed → Requirement → Product realization → Industrial support → Evidence/status.
- Link: Open Model Digital Thread for the full mission-to-validation thread.

#### AV-M03 — Architecture recap

- Default content: selected use cases, product behavior and components, industrial behavior/equipment, product flow and resources.

#### AV-M04 — Requirements recap

- Default content: satisfied, failed, pending and error status with readable actual-versus-target evidence.

#### AV-M05 — Simulation recap (conditional)

- Default content: current run, decisive KPIs, assumptions and warnings.

#### AV-M06 — Trade-off recap (conditional)

- Default content: alternatives considered, feasibility, decisive trade-offs, leading/proposed/approved baseline and rationale.

#### Guided-modelling completion state

- The final overview is calculated from the current canonical project whenever it is opened; it has no manual refresh or stale-overview state.
- Green check: no failed requirement, no blocking or warning finding, no pending evidence, no incomplete required answer and no answer awaiting review.
- Amber warning: one or more dependent answers need review, evidence is pending, warnings remain, or a required answer was skipped/incomplete, provided there is no failed requirement or other blocking model finding.
- Red alert: at least one requirement has failed or a blocking model finding remains.
- If a Modeler edit changes a dependency of a confirmed answer, the current canonical selection is shown when the question is reopened and the user confirms that updated interpretation.

## 9. Section readiness rules

### 9.1 Architecture definition Ready

- One mission and exactly one system of interest.
- At least one stakeholder, need, objective and selected use case.
- Selected use cases involve the system of interest.
- Every scoped need and objective derives at least one requirement.
- Every mandatory requirement has at least one valid satisfaction path: a `satisfiedBy` function/component relationship or an exact formula binding to a parameter owned by a product/process function or product/industrial component.
- Product and industrial functions are not required to satisfy a requirement individually; completeness is assessed from each requirement outward.
- Every selected use case has product functions and an applicable industrial-system treatment.
- Every product function has a realizing product component.
- Every applicable process function has a realizing industrial component.
- Sequences contain no cycles.
- Declared product flows have positive quantity and unit.
- Mandatory requirements have planned verification.
- No blocking validation errors.
- Quantitative evidence may remain Pending if the purpose is architecture definition, but the missing owner/value and consequence must be explicit.

### 9.2 Architecture + simulation Ready

All architecture conditions, plus:

- At least one objective-linked KPI.
- Every selected KPI has a valid calculation, output unit and direction.
- Required numeric parameters have values, units, sources and origins.
- Selected architecture/configuration is valid.
- Configured simulation uses a current valid derivation.
- Latest run matches current model revision and exact KPI IDs.
- Mandatory quantitative requirements are evaluable.

### 9.3 Trade-off Ready

All simulation conditions for each compared alternative, plus:

- One active study with name and explicit decision question.
- Problem scope includes needs, objectives, selected use cases and mandatory requirements.
- Exactly one linked root feature and at least one valid variability axis.
- At least two valid configurations with current 100% derivations.
- At least two alternatives have comparable current simulation evidence.
- At least one selected comparison KPI has a positive weight.
- Thresholds are valid and all hard-threshold effects are visible.
- Ties require explicit selection; no automatic baseline.
- Approved baseline requires decision rationale and owner.

## 10. Impact preview behavior

Before changing an accepted answer, show:

1. The answer being changed.
2. Architect-origin elements that will be renamed, updated or removed.
3. Relationships that will change.
4. Parameters, formulas, feature mappings, configurations, derivations, simulations or comparisons that become stale.
5. Modeler/import/sample records that cannot be removed without explicit confirmation.
6. The resulting section statuses.

Safe default actions:

- Rename in place when identity remains the same.
- Preserve stable IDs whenever references remain semantically valid.
- Remove only content exclusively generated by the changed answer and unused elsewhere.
- Mark derived/simulation/comparison evidence stale rather than silently recalculating.
- Require explicit confirmation before destructive removal.

## 11. Coffee-machine end-to-end acceptance journey

The implementation must include an automated fixture or scripted acceptance journey that enters at least the following answers through Architect view:

| Stage | Coffee-machine answer | Expected model result |
|---|---|---|
| Scope | Trade-off | Trade scope selected |
| Mission | Define a configurable coffee-machine family and its manufacturing system | Mission element |
| System of interest | Coffee Machine Product Line | One flagged system of interest |
| Stakeholders | Customer; Product Manager; Manufacturing Engineer; Quality Manager | Stakeholders and mission links |
| Needs | Fast preparation; Consistent quality; Safe operation; Controlled investment | Needs and stakeholder links |
| Objectives | Serve peak demand; Keep appliance compact; Control investment | Objectives and stakeholder links |
| Use cases | Configure variant; Prepare beverage; Manufacture machine; Verify machine | Use cases and involvement links |
| Requirements | Throughput ≥10 beverages/h; appliance mass ≤1000 kg; verify beverage quality ≥95% | Requirements, origins and evaluation intents |
| Decision question | Which coffee-machine architecture should become the product-line baseline? | Active trade study and open decision |
| Alternative characteristics | Coffee input; heating architecture; sensing; voltage | Axis intents |
| Product functions | Meter ingredients; Heat and pressurize water; Monitor beverage quality | Product behavior and sequence |
| Product components | Ingredient-handling; Brewing/heating; Beverage sensing | Realizations and satisfaction links |
| Industrial functions | Manufacture modules; Integrate modules; Test completed machine | Process behavior and sequence |
| Industrial components | Module workstation; Integration cell; End-of-line station | Industrial realizations |
| Product flow | Purchased kit → modules → integrated machine → verified machine | Consumes/produces relations with quantity/unit |
| Resources | Manufacturing technician; End-of-line technician; automated equipment | Resource relations and quantities |
| Features | Common control/safety; capsule vs grinder; thermoblock vs dual boiler; sensing options | Valid feature model |
| Alternatives | Essential Capsule; Balanced Bean-to-Cup; Premium Dual Boiler | Valid configurations |
| KPIs | Throughput, mass, investment, manufacturing lead time | Objective-linked calculation definitions |
| Result | Current comparable simulations and feasibility-first comparison | Stored run/comparison evidence |
| Decision | Explicit user confirmation only | Approved baseline only after rationale |

The acceptance test must verify canonical element/relationship counts, formula bindings, no orphan IDs, session resume after refresh, backward/forward perspective synchronization and correct staleness after an upstream answer change.

## 12. Interface states required for design review

1. Perspective selection.
2. Standard one-question state with side progress.
3. Semicolon-list entry.
4. Requirement interpretation confirmation.
5. Impact warning for editing an earlier answer.
6. Plain-language section recap with technical-details expansion.
7. Final overview with the requirements-and-validation recap and a link to the complete Model Digital Thread.
8. Narrow responsive layout with the side panel collapsed into a progress drawer.

## 13. Implementation phases

### Phase 1 — Shared engine and architecture foundation

- Session/answer/provenance schema and migration.
- Perspective landing and switching.
- Question engine, autosave, side panel and impact preview.
- Sections A–H and architecture recaps.
- Existing-model projection into answers.
- Architecture scope readiness and tests.

### Phase 2 — Simulation extension

- KPI suggestion catalogue.
- Guided formula bridge to existing builder.
- Missing-input question generation.
- Simulation readiness, execution and recap.
- Staleness propagation and tests.

### Phase 3 — Trade-off extension

- Early trade framing.
- Feature/axis/constraint questions.
- Variation-point mapping.
- Configuration, derivation, comparison and decision questions.
- Feasibility-first recap and tests.

### Phase 4 — Hardening and delivery

- Migration from existing v1.5.3 saved projects.
- Recovery from incomplete Architect sessions.
- ChromeOS/Chrome and Windows 11/Edge responsive testing.
- Keyboard and screen-reader checks.
- Complete regression suite and production build.
- Update all three user guides and Full Guide indexes.

## 14. Explicit non-goals for the first release

- No generative AI or arbitrary natural-language model generation.
- No second Architect-only model store.
- No automatic invention of parameter values or assumptions.
- No automatic approval of a baseline.
- No automatic correction of invalid configurations without confirmation.
- No silent deletion of Modeler-created content.
- No timer on Skip or any answer action.
- No requirement to expose SysML terminology in the default question view.

## 15. Review gate before code changes

Implementation may begin after confirming:

1. Question wording and section order.
2. Treatment of pending parameter ownership before components exist.
3. Architecture Ready versus evidence Ready distinction.
4. Coffee-machine acceptance answers.
5. The eight required interface states.
