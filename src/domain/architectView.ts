import { baselineRequirementIds } from "./ontology";
import { recordRequirementReview } from "./requirementAssessment";
import type {
  ArchitectAnswer, ArchitectAnswerStatus, ArchitectParameterIntent, ArchitectSectionState,
  ArchitectSession, ComparisonResult, ComparisonStudy, Configuration, Decision, ElementType,
  Feature, FeatureConstraint, KPI, ModelElement, OverallScope, Parameter, Project,
  Relationship, RelationshipType, ResourceType, StandardAlgorithmKey, TimeUnit, ValueOrigin,
  VariationPoint, VariationScope
} from "./types";
import { formulaReferences, parseKpiFormula } from "./kpiFormulas";
import { runSimulation, simulationStatus, type SimulationRequest } from "./simulation";
import { applySelectionToConfiguration, configurationWithValidation, validateConfiguration } from "./variability";
import { derivationStatus, deriveConfiguration } from "./derivation";
import { evaluateMandatoryFeasibility } from "./tradeStudyMethodology";
import { leadingAlternativeIds, runComparison } from "./comparison";

export type ArchitectInputKind = "scope" | "text" | "textarea" | "semicolon" | "single" | "multi" | "flow" | "recap" | "existingAndNew" | "quantitative" | "propertySource" | "engineeringValue" | "analysisInput" | "verification" | "sequence" | "duration" | "resourceDetail" | "interaction" | "kpiReview" | "kpiFormula" | "kpiDefinition" | "number" | "simulationRun" | "simulationRecap" | "namedItems" | "rootFeature" | "axisDefinition" | "constraintList" | "elementApplicability" | "propertyVariation" | "configuration" | "derivation" | "configurationRecap" | "comparisonSetting" | "comparisonRun" | "comparisonRecap" | "decisionDetails" | "finalRecap";
export interface ArchitectQuestionOption { id: string; label: string; detail?: string }
export interface ArchitectQuestion { key: string; id: string; instanceKey?: string; sectionId: string; sectionLabel: string; prompt: string; explanation: string; example?: string; inputKind: ArchitectInputKind; required: boolean; options?: ArchitectQuestionOption[] }
export interface ArchitectMutationResult { project: Project; answer: ArchitectAnswer }
export interface ArchitectReadinessFinding { id: string; severity: "blocking" | "warning"; message: string; questionKey?: string }
export interface ArchitectReadiness { status: "draft" | "blocked" | "ready" | "outOfDate"; findings: ArchitectReadinessFinding[]; blockingCount: number; warningCount: number }

type QuantitativeValue = { propertyName?: string; semanticKey?: string; operator?: ArchitectParameterIntent["operator"]; target?: number; unit?: string };
type PropertySourceValue = { sourceKind?: ArchitectParameterIntent["sourceKind"]; ownerElementId?: string };
type EngineeringValue = { value?: number | null; unit?: string; source?: string; valueOrigin?: ValueOrigin; uncertaintyPercent?: number; minimum?: number; maximum?: number };
type VerificationValue = { category?: "analysis" | "inspection" | "demonstration" | "test"; name?: string; description?: string; allocatedProcessFunctionId?: string };
type DurationValue = { duration?: number; durationUnit?: TimeUnit; source?: string; valueOrigin?: ValueOrigin; uncertaintyPercent?: number };
type ResourceDetailValue = { quantity?: number; unit?: string; resourceType?: ResourceType; hourlyRate?: number; costUnit?: string; capacityHours?: number; availabilityPercent?: number };
type InteractionValue = { counterpartId?: string; interfaceName?: string; exchangedItem?: string };
type KpiDefinitionValue = { outputUnit?: string; optimizationDirection?: "minimize" | "maximize"; targetValue?: number; minimumThreshold?: number; maximumThreshold?: number };
type SimulationRunValue = { name?: string; execute?: boolean; errors?: string[] };
type AnalysisOwnerValue = EngineeringValue & { ownerElementId?: string };
type AnalysisInputValue = EngineeringValue & {
  ownerElementId?: string;
  owners?: AnalysisOwnerValue[];
  propertyName?: string;
  semanticKey?: string;
};
type NamedItem = { id?: string; name?: string; description?: string };
type RootFeatureValue = { name?: string; description?: string };
type AxisDefinitionValue = { choices?: string; mode?: "xor" | "or" | "optional" | "typed" };
type ConstraintValue = { type?: FeatureConstraint["type"]; sourceFeatureId?: string; targetFeatureId?: string };
type ElementApplicabilityValue = Array<{ elementId?: string; featureId?: string }>;
type PropertyVariationValue = Array<{ elementId?: string; parameterId?: string; featureId?: string; value?: string | number | boolean; scope?: VariationScope }>;
type ConfigurationValue = { name?: string; selectedFeatureIds?: string[]; automaticConstraintFeatureIds?: string[]; featureValues?: Record<string, string | number | boolean> };
type ComparisonSettingValue = { weight?: number; optimizationDirection?: "minimize" | "maximize"; minimum?: number; maximum?: number; thresholdMode?: "warning" | "hard" };
type DecisionDetailsValue = { rationale?: string; owner?: string; status?: "proposed" | "approved"; decisionDate?: string; baselineApprovalConfirmed?: boolean };

const labels: Record<string, string> = { setup: "Study setup", intent: "Stakeholders and intent", scope: "Use cases", requirements: "Requirements", tradeFraming: "Trade-off framing", evaluation: "Evaluation KPIs", productBehavior: "Product behavior", productStructure: "Product architecture", industrialBehavior: "Industrial behavior", industrialStructure: "Industrial architecture", traceability: "Traceability review", analysisInputs: "Parameters and KPI inputs", analysis: "Parameters, KPIs and simulation", variability: "Feature model and variability", configurations: "Configurations and 100% architectures", tradeSimulation: "Simulate architectures", comparison: "Compare and decide", final: "Analysis overview" };
const recapIds: Record<string, string> = { intent: "AV-B05", scope: "AV-C05", requirements: "AV-D10", tradeFraming: "AV-T06", productBehavior: "AV-E04", productStructure: "AV-F06", industrialStructure: "AV-G12", traceability: "AV-H04", analysis: "AV-I12", variability: "AV-J09", tradeSimulation: "AV-S04", comparison: "AV-L08", final: "AV-M03" };
const eligibleOwners: ElementType[] = ["productFunction", "productComponent", "processFunction", "industrialSystemComponent"];
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const standardKpiCatalog: Array<{ key: StandardAlgorithmKey; name: string; unit: string; direction: "minimize" | "maximize"; detail: string }> = [
  { key: "totalMass", name: "Total mass", unit: "kg", direction: "minimize", detail: "Sums active parameters with semantic key mass." },
  { key: "directElementCost", name: "Direct element cost", unit: "EUR", direction: "minimize", detail: "Sums active parameters with semantic key cost." },
  { key: "processCost", name: "Process cost", unit: "EUR", direction: "minimize", detail: "Uses process durations, resource rates and required quantities." },
  { key: "estimatedTotalCost", name: "Estimated total cost", unit: "EUR", direction: "minimize", detail: "Adds direct element cost and process cost." },
  { key: "totalPower", name: "Total power", unit: "kW", direction: "minimize", detail: "Sums active parameters with semantic key power." },
  { key: "manufacturingLeadTime", name: "Manufacturing lead time", unit: "h", direction: "minimize", detail: "Uses the process sequence and authoritative durations." },
  { key: "resourceDemand", name: "Resource demand", unit: "resource-h", direction: "minimize", detail: "Uses process durations and resource quantities." },
  { key: "basicUtilization", name: "Basic utilization", unit: "%", direction: "minimize", detail: "Uses resource demand, capacity and availability." },
  { key: "throughputProxy", name: "Throughput proxy", unit: "1/h", direction: "maximize", detail: "Uses the reciprocal of manufacturing lead time as a comparison proxy." }
];
const architectKpiId = (key: StandardAlgorithmKey) => `architect-kpi-${key}`;
const allParameters = (project: Project) => project.elements.flatMap((owner) => owner.parameters.map((parameter) => ({ owner, parameter })));
const selectedKpiIds = (project: Project) => {
  const stored = sessionOf(project)?.answers[architectAnswerKey("AV-I01")];
  const selected = stored
    ? splitArchitectList(stored.value)
    : activeStudy(project)?.selectedKpiIds?.length
      ? activeStudy(project)!.selectedKpiIds
      : project.overallScope === "architectureAndSimulation"
        ? project.kpis.map((kpi) => kpi.id)
        : [];
  return selected.filter((kpiId) => project.kpis.some((kpi) => kpi.id === kpiId));
};
const selectedKpis = (project: Project) => selectedKpiIds(project).map((kpiId) => project.kpis.find((kpi) => kpi.id === kpiId)).filter((kpi): kpi is KPI => Boolean(kpi));

function exactInputsForKpi(project: Project, kpi: KPI): ArchitectQuestionOption[] {
  if (kpi.calculationMode === "formula" && kpi.formula) {
    try {
      const refs = formulaReferences(parseKpiFormula(kpi.formula));
      return [
        ...refs.parameterIds.map((parameterId) => {
          const entry = allParameters(project).find(({ parameter }) => parameter.id === parameterId);
          return { id: parameterId, label: entry ? `${entry.owner.name} / ${entry.parameter.name}` : parameterId, detail: entry?.parameter.unit || "No unit" };
        }),
        ...refs.kpiIds.map((kpiId) => ({ id: kpiId, label: project.kpis.find((item) => item.id === kpiId)?.name ?? kpiId, detail: "Dependent KPI" }))
      ];
    } catch { return [{ id: "invalid-formula", label: "Formula must be corrected before the input set can be confirmed." }]; }
  }
  const details = standardKpiCatalog.find((entry) => entry.key === kpi.standardAlgorithmKey);
  return details ? [{ id: details.key, label: details.detail, detail: `Output: ${details.unit}` }] : [];
}

const activeStudy = (project: Project) => project.comparisonStudies.find((study) => study.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0];
const tradeCommonIntents = (project: Project) => {
  const stored = sessionOf(project)?.answers[architectAnswerKey("AV-T03")];
  if (stored) return splitArchitectList(stored.value);
  return project.features.filter((feature) => feature.featureType === "mandatory").map((feature) => feature.name);
};
const tradeAxisIntents = (project: Project) => {
  const stored = sessionOf(project)?.answers[architectAnswerKey("AV-T04")];
  if (stored) return splitArchitectList(stored.value);
  return project.variabilityAxes.map((axis) => axis.name);
};
const tradeAlternativeIntents = (project: Project) => {
  const stored = sessionOf(project)?.answers[architectAnswerKey("AV-T05")];
  if (stored) return (stored.value as NamedItem[] ?? []).filter((item) => String(item.name ?? "").trim());
  return (activeStudy(project)?.candidateRefs ?? []).map((candidate) => ({
    id: candidate.configurationId,
    name: candidate.label,
    description: project.architectures.find((architecture) => architecture.id === candidate.architectureId)?.description ?? ""
  }));
};
const safeSlug = (value: string) => norm(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
const rootFeature = (project: Project) => project.features.find((feature) => feature.featureType === "root");
const activeConfigurations = (project: Project) => project.configurations.filter((configuration) => !configuration.archivedAt);
const configurationForIntent = (project: Project, intentId: string) => project.configurations.find((configuration) => configuration.id === intentId)
  ?? project.configurations.find((configuration) => configuration.id === `architect-configuration-${intentId}`);
const selectedComparisonKpiIds = (project: Project) => {
  const stored = sessionOf(project)?.answers[architectAnswerKey("AV-L03")];
  return (stored ? splitArchitectList(stored.value) : (activeStudy(project)?.selectedKpiIds ?? []))
    .filter((kpiId) => project.kpis.some((kpi) => kpi.id === kpiId));
};
const latestConfiguredRun = (project: Project, configurationId: string) => [...project.simulationRuns].reverse().find((run) => run.configurationId === configurationId && simulationStatus(project, run) === "Current");

function createArchitectStudy(project: Project, name: string, now: string): ComparisonStudy {
  const studyId = id("comparison"), openDecisionId = id("open-decision");
  project.openDecisions.push({ id: openDecisionId, question: "Decision question pending", description: "Created by Architect view.", status: "open", relatedElementIds: [] });
  const study: ComparisonStudy = {
    id: studyId, name, description: "Trade Study created by Architect view.", question: "", intendedOutcome: "Select a requirement-feasible baseline architecture.", lifecycleScope: "Early programme preparation", systemScope: project.name,
    status: "framing", originatingOpenDecisionId: openDecisionId, needIds: ofType(project, "need").map((item) => item.id), objectiveIds: ofType(project, "objective").map((item) => item.id), useCaseIds: [...project.selectedUseCaseIds], mandatoryRequirementIds: [], baselineRequirementIds: ofType(project, "systemRequirement").map((item) => item.id), referenceArchitectureId: project.activeArchitectureId, exploredFeatureIds: [], criteria: [], candidateRefs: [], alternativeRefs: [], selectedKpiIds: [], kpiSettings: {}, createdAt: now, updatedAt: now, settingsUpdatedAt: now, results: []
  };
  project.comparisonStudies.push(study); project.activeComparisonStudyId = study.id; return study;
}

function architectComparisonAttempt(project: Project, study: ComparisonStudy, now: string) {
  const base = runComparison(project, study, new Date(now), Number.POSITIVE_INFINITY);
  if (!base.result) return base;
  const feasibility = Object.fromEntries(study.alternativeRefs.map((alternative) => [alternative.id, evaluateMandatoryFeasibility(project, study, alternative.id)]));
  const eligibleScores = Object.fromEntries(study.alternativeRefs.map((alternative) => [alternative.id, feasibility[alternative.id].status === "feasible" ? base.result!.weightedScores[alternative.id] : null]));
  const recommendedAlternativeIds = leadingAlternativeIds(eligibleScores);
  const warnings = [...base.warnings];
  study.alternativeRefs.forEach((alternative) => {
    const state = feasibility[alternative.id].status;
    if (state === "infeasible") warnings.push(`PMC-401: ${alternative.label} is infeasible and excluded from the baseline recommendation.`);
    if (state === "unknown") warnings.push(`PMC-402: ${alternative.label} has incomplete mandatory-requirement evidence.`);
  });
  if (recommendedAlternativeIds.length > 1) warnings.push("PMC-404: Feasible leaders are tied; explicit user selection is required.");
  const result: ComparisonResult = { ...base.result, id: id("architect-comparison-result"), methodology: "traceable-feasible-weighted", feasibility, recommendedAlternativeIds, recommendationLabel: "Highest weighted score among alternatives satisfying every mandatory requirement.", warnings: [...new Set(warnings)] };
  return { result, errors: [], warnings: result.warnings };
}

export function splitArchitectList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  return value.split(";").map((item) => item.trim().replace(/\s+/g, " ")).filter((item) => {
    const key = norm(item); if (!key || seen.has(key)) return false; seen.add(key); return true;
  });
}
export const architectAnswerKey = (questionId: string, instanceKey?: string) => instanceKey ? `${questionId}:${instanceKey}` : questionId;
export function createArchitectSession(project: Project, now = new Date().toISOString()): ArchitectSession {
  return { id: id("architect-session"), projectId: project.id, status: "draft", answers: {}, sectionStates: {}, reviewedSectionIds: [], parameterIntents: {}, createdAt: now, updatedAt: now };
}
const sessionOf = (project: Project) => project.architectSession ? { ...project.architectSession, parameterIntents: project.architectSession.parameterIntents ?? {} } : undefined;
function q(idValue: string, sectionId: string, prompt: string, explanation: string, inputKind: ArchitectInputKind, required = true, patch: Partial<ArchitectQuestion> = {}): ArchitectQuestion {
  return { key: architectAnswerKey(idValue, patch.instanceKey), id: idValue, sectionId, sectionLabel: labels[sectionId], prompt, explanation, inputKind, required, ...patch };
}
const ofType = (project: Project, type: ElementType) => project.elements.filter((element) => element.elementType === type);
function targets(project: Project, sourceId: string, relation: RelationshipType, type?: ElementType) {
  const ids = new Set(project.relationships.filter((item) => item.sourceId === sourceId && item.relationshipType === relation).map((item) => item.targetId));
  return project.elements.filter((item) => ids.has(item.id) && (!type || item.elementType === type));
}
function sources(project: Project, targetId: string, relation: RelationshipType, type?: ElementType) {
  const ids = new Set(project.relationships.filter((item) => item.targetId === targetId && item.relationshipType === relation).map((item) => item.sourceId));
  return project.elements.filter((item) => ids.has(item.id) && (!type || item.elementType === type));
}
const av = <T,>(project: Project, questionId: string, instanceKey?: string) => sessionOf(project)?.answers[architectAnswerKey(questionId, instanceKey)]?.value as T | undefined;
const ownerOptions = (project: Project, types: ElementType[]) => project.elements.filter((item) => types.includes(item.elementType)).map((item) => ({ id: item.id, label: item.name, detail: item.elementType }));

function suggestedProductOwnerIds(project: Project, requirementId: string): Set<string> {
  return new Set(project.relationships
    .filter((relationship) => relationship.sourceId === requirementId && relationship.relationshipType === "satisfiedBy")
    .map((relationship) => project.elements.find((element) => element.id === relationship.targetId))
    .filter((element): element is ModelElement => Boolean(element && ["productFunction", "productComponent"].includes(element.elementType)))
    .map((element) => element.id));
}

function productOwnerOptions(project: Project, requirementId: string): ArchitectQuestionOption[] {
  const suggestedIds = suggestedProductOwnerIds(project, requirementId);
  return ownerOptions(project, ["productFunction", "productComponent"])
    .map((option) => ({
      ...option,
      detail: suggestedIds.has(option.id)
        ? `${option.detail} · Suggested because it already satisfies this requirement`
        : option.detail
    }))
    .sort((left, right) => {
      const score = (option: ArchitectQuestionOption) => Number(suggestedIds.has(option.id)) * 10 + Number(option.detail?.startsWith("productComponent"));
      return score(right) - score(left);
    });
}

export function requirementHasSatisfaction(project: Project, requirementId: string) {
  const direct = project.relationships.some((rel) => rel.sourceId === requirementId && rel.relationshipType === "satisfiedBy" && project.elements.some((item) => item.id === rel.targetId && eligibleOwners.includes(item.elementType)));
  const requirement = project.elements.find((item) => item.id === requirementId);
  const parameter = requirement?.requirementFormula?.bindings.some((binding) => binding.kind === "parameter" && project.elements.some((owner) => eligibleOwners.includes(owner.elementType) && owner.parameters.some((item) => item.id === binding.targetId)));
  return direct || Boolean(parameter);
}

export function buildArchitectQuestions(project: Project): ArchitectQuestion[] {
  const out: ArchitectQuestion[] = [
    q("AV-A01", "setup", "What is the Aim of this Project?", "Describe the project outcome and why the work is being undertaken. This is stored as the project description.", "textarea", true),
    q("AV-A02", "setup", "What should this study include?", "The scope determines how far the guided workflow continues.", "scope", true, { options: [
      { id: "architectureBuilding", label: "Architecture definition", detail: "Define requirements and build product and industrial architectures." },
      { id: "architectureAndSimulation", label: "Architecture and simulation", detail: "Build the architecture, complete inputs and calculate KPI evidence." },
      { id: "tradeStudy", label: "Trade-off", detail: "Build configurable alternatives, simulate, compare and decide." }
    ] }),
    q("AV-A03", "setup", "What should this study be called?", "Use a short name that distinguishes this project from other saved projects.", "text"),
    q("AV-A04", "setup", "What is the mission of this study?", "The mission identifies the main purpose. It focuses on what the system must achieve to solve a specific problem.", "textarea", true, { example: "The core mission is to provide high-quality, personalized caffeinated beverages to office employees to boost workplace productivity and satisfaction, while minimizing maintenance overhead for office managers." }),
    q("AV-B01", "intent", "Which stakeholders are involved?", "Enter every person or organisation whose concerns matter. Removing a name also removes that stakeholder from this guided model.", "semicolon", true, { example: "Office employee; Office manager" })
  ];
  const stakeholders = ofType(project, "stakeholder");
  const systemOfInterest = ofType(project, "system")[0];
  const participants = [...stakeholders, ...ofType(project, "externalSystem")];
  out.push(q("AV-A05", "intent", "What system are you designing?", "Name the system of interest. Its boundary and architecture reference are available in the existing element details.", "text", true));
  out.push(q("AV-B06", "intent", "Which external systems interact with this project?", "Enter external-system names separated by semicolons. Each is connected to the mission with participatesInMission and can later be selected as a use-case participant.", "semicolon", false, { example: "Corporate identity service; Facility power network" }));
  ofType(project, "externalSystem").forEach((item) => out.push(q("AV-B07", "intent", `What is ${item.name}'s role in this project?`, "Describe the external system's role or boundary interaction. This updates its description without inventing a new relationship.", "textarea", true, { instanceKey: item.id })));
  stakeholders.forEach((item) => out.push(
    q("AV-B02", "intent", `What is ${item.name}'s role in this study?`, "Documentation only: this updates the stakeholder description. It creates no new model element or relationship and does not affect calculations.", "textarea", false, { instanceKey: item.id, example: item.metadata.isSystemOfInterest ? "System being designed and evaluated in this study." : "Operates the system and reports operational needs." }),
    q("AV-B03", "intent", `What does ${item.name} need?`, "Each entry creates a Need and links it to this stakeholder with hasNeed.", "semicolon", false, { instanceKey: item.id, example: item.metadata.isSystemOfInterest ? "Operate safely; Report failures" : "Complete the task quickly; Use the system without specialist training" }),
    q("AV-B04", "intent", `What objectives does ${item.name} want to achieve?`, "Each entry creates an Objective and links it to this stakeholder with hasObjective. Requirements and KPIs can later measure it.", "semicolon", false, { instanceKey: item.id, example: "Reduce operation time; Increase availability" })
  ));
  out.push(q("AV-B05", "intent", "Does this correctly represent the study intent?", "Review the mission, stakeholders, needs and objectives.", "recap"));

  out.push(q("AV-C01", "scope", `Which use cases should be created for ${systemOfInterest?.name ?? "the system of interest"}?`, "Each entry creates a Use Case. The next questions link its participating stakeholders and the needs or objectives it addresses.", "semicolon", true, { example: "Start a production cycle; Perform maintenance; Diagnose a fault" }));
  const useCases = ofType(project, "useCase"), needs = ofType(project, "need"), objectives = ofType(project, "objective");
  useCases.forEach((item) => {
    const involvedStakeholderIds = [...project.relationships.filter((rel) => rel.targetId === item.id && rel.relationshipType === "involvedIn").map((rel) => rel.sourceId), ...(item.metadata.subjectSystemId ? [item.metadata.subjectSystemId] : [])];
    const eligibleIntent = [...needs, ...objectives].filter((intent) => project.relationships.some((rel) => involvedStakeholderIds.includes(rel.sourceId) && rel.targetId === intent.id && rel.relationshipType === (intent.elementType === "need" ? "hasNeed" : "hasObjective")));
    out.push(
      q("AV-C02", "scope", `Who is involved in “${item.name}”?`, "Select participating people, organisations or external systems. The use-case subject is assigned automatically.", "multi", true, { instanceKey: item.id, options: participants.map((s) => ({ id: s.id, label: s.name })) }),
      q("AV-C03", "scope", `Which stakeholder needs or objectives does “${item.name}” address?`, "This creates an addresses relationship in the model. Only needs and objectives owned by stakeholders involved in this use case are shown.", "multi", true, { instanceKey: item.id, options: eligibleIntent.map((intent) => ({ id: intent.id, label: intent.name, detail: intent.elementType === "need" ? "Stakeholder need" : "Stakeholder objective" })) })
    );
  });
  const soi = systemOfInterest?.id;
  const eligibleCases = useCases.filter((uc) => !soi || uc.metadata.subjectSystemId === soi);
  out.push(q("AV-C04", "scope", "Which use cases should this analysis cover?", "Only use cases involving the system of interest are available.", "multi", true, { options: eligibleCases.map((item) => ({ id: item.id, label: item.name })) }));
  out.push(q("AV-C05", "scope", "Is this the correct working scope?", "Review participants, needs and selected use cases.", "recap"));

  needs.forEach((item) => out.push(q("AV-D01", "requirements", `What must the system do or achieve to satisfy “${item.name}”?`, "Enter testable requirements separated by semicolons. Each entry becomes a System requirement derived from this need; it is later linked to satisfying functions, components or parameters and used for validation. Quantitative mandatory requirements can determine whether a trade-study alternative is feasible.", "semicolon", true, { instanceKey: item.id })));
  const requirements = ofType(project, "systemRequirement");
  objectives.forEach((item) => out.push(q("AV-D02", "requirements", `Which requirements make “${item.name}” measurable or achievable?`, "Select existing requirements and/or enter new ones.", "existingAndNew", true, { instanceKey: item.id, options: requirements.map((r) => ({ id: r.id, label: r.name })) })));
  const selectedCases = useCases.filter((item) => project.selectedUseCaseIds.includes(item.id));
  requirements.forEach((req) => {
    out.push(q("AV-D03", "requirements", `Which selected use cases make “${req.name}” relevant?`, "This association is stored in the guided answer.", "multi", true, { instanceKey: req.id, options: selectedCases.map((item) => ({ id: item.id, label: item.name })) }));
    out.push(q("AV-D04", "requirements", `Is “${req.name}” evaluated with a number?`, "Quantitative requirements receive a formal comparison; qualitative ones require verification.", "single", true, { instanceKey: req.id, options: [{ id: "quantitative", label: "Yes, quantitative" }, { id: "qualitative", label: "No, qualitative" }, { id: "unsure", label: "Not sure" }] }));
    const kind = av<string>(project, "AV-D04", req.id) ?? (req.requirementFormula?.expression.trim() ? "quantitative" : undefined);
    if (kind === "quantitative") {
      const intent = sessionOf(project)?.parameterIntents[req.id];
      out.push(q("AV-D05", "requirements", `How should “${req.name}” be checked quantitatively?`, "Define the measured property, comparison, target and unit. This creates the formal formula used to evaluate the requirement. The semantic key identifies the property for formulas and KPI calculations.", "quantitative", true, { instanceKey: req.id }));
      out.push(q("AV-D06", "requirements", `Where will the actual value of “${intent?.propertyName ?? "this property"}” come from?`, "Select an existing owner or defer ownership.", "propertySource", true, { instanceKey: req.id, options: ownerOptions(project, eligibleOwners) }));
      out.push(q("AV-D07", "requirements", `Do you already know a preliminary value for “${intent?.propertyName ?? "this property"}”?`, "Enter evidence or leave the value pending.", "engineeringValue", false, { instanceKey: req.id }));
    } else if (kind === "qualitative") out.push(q("AV-D08", "requirements", `How could “${req.name}” be verified?`, "Describe an analysis, inspection, demonstration or test.", "verification", true, { instanceKey: req.id }));
    out.push(q("AV-D09", "requirements", `How important is “${req.name}”?`, "Mandatory requirements control feasibility.", "single", true, { instanceKey: req.id, options: [{ id: "mandatory", label: "Mandatory" }, { id: "important", label: "Important" }, { id: "desirable", label: "Desirable" }] }));
  });
  out.push(q("AV-D10", "requirements", "Do the requirements correctly express the selected needs and objectives?", "Review origins, interpretations, owners and verification.", "recap"));
  if (project.overallScope === "tradeStudy") {
    out.push(q("AV-T01", "tradeFraming", "What should this Trade Study be called?", "Use a short name describing the alternatives or decision.", "text"));
    out.push(q("AV-T02", "tradeFraming", "What decision must this Trade Study answer?", "Phrase one explicit question that can be answered by comparing feasible alternatives.", "textarea"));
    out.push(q("AV-T03", "tradeFraming", "Which capabilities or solution elements must be common to every alternative?", "List the mandatory content that will become the common branch of the feature model. Do not include characteristics that may vary between alternatives.", "semicolon", true, { example: "Prepare beverage; User interface; Water supply; Safety monitoring" }));
    out.push(q("AV-T04", "tradeFraming", "What may differ between the alternatives?", "Describe independent choice areas rather than complete alternatives; separate several with semicolons.", "semicolon", false, { example: "Brewing technology; Milk preparation system; User-interface type" }));
    out.push(q("AV-T05", "tradeFraming", "Which solution concepts do you already want to compare?", "Enter at least two concept names and short descriptions; these become configuration intents later.", "namedItems"));
    out.push(q("AV-T06", "tradeFraming", "Does this correctly describe the decision and variation to explore?", "Review the decision question, common content, variability axes and initial alternatives.", "recap"));

    out.push(q("AV-I01", "evaluation", "Which results will help answer the study objectives?", "Select at least one decision-relevant KPI. This defines what every alternative must calculate later; it does not run a simulation yet.", "multi", true, { options: [
      ...standardKpiCatalog.map((entry) => {
        const existing = project.kpis.find((kpi) => kpi.standardAlgorithmKey === entry.key);
        return { id: existing?.id ?? architectKpiId(entry.key), label: entry.name, detail: entry.detail };
      }),
      ...project.kpis.filter((kpi) => !kpi.standardAlgorithmKey).map((kpi) => ({ id: kpi.id, label: kpi.name, detail: "Existing guided-formula KPI." }))
    ] }));
    selectedKpis(project).forEach((kpi) => {
      out.push(q("AV-I02", "evaluation", `Which needs or objectives does “${kpi.name}” help measure?`, "Link the KPI to at least one stakeholder need or objective so the result remains connected to study intent.", "multi", true, { instanceKey: kpi.id, options: [...needs.map((need) => ({ id: need.id, label: need.name, detail: "Stakeholder need" })), ...objectives.map((objective) => ({ id: objective.id, label: objective.name, detail: "Objective" }))] }));
      out.push(q("AV-I03", "evaluation", `How should “${kpi.name}” be calculated?`, "Choose the standard method when it matches the intended meaning. Guided formulas and exact inputs are completed after the 150% architecture exists.", "single", true, { instanceKey: kpi.id, options: [
        ...(kpi.standardAlgorithmKey ? [{ id: "standardAlgorithm", label: "Standard workbench algorithm" }] : []),
        { id: "formula", label: "Guided formula" }
      ] }));
      out.push(q("AV-I06", "evaluation", `How should “${kpi.name}” be interpreted?`, "Define its output unit, preferred direction, target and optional acceptable limits.", "kpiDefinition", true, { instanceKey: kpi.id }));
      out.push(q("AV-I07", "evaluation", `How important is “${kpi.name}” in a comparison?`, "Enter a non-negative global weight. At least one selected KPI must have a positive weight.", "number", true, { instanceKey: kpi.id }));
    });
  }
  selectedCases.forEach((uc) => out.push(q("AV-E01", "productBehavior", `What must the product do during “${uc.name}”?`, "Enter functions in normal order, separated by semicolons. Leave this empty for a process-only lifecycle use case.", "semicolon", !targets(project, uc.id, "hasFunction", "processFunction").length, { instanceKey: uc.id })));
  const productFunctions = ofType(project, "productFunction"), reqOptions = requirements.map((r) => ({ id: r.id, label: r.name }));
  selectedCases.forEach((uc) => {
    const functions = targets(project, uc.id, "hasFunction", "productFunction");
    if (functions.length > 1) out.push(q("AV-E02", "productBehavior", `Is this the correct order for “${uc.name}”?`, "Reorder the functions; the saved order creates cycle-free precedence.", "sequence", true, { instanceKey: uc.id, options: functions.map((f) => ({ id: f.id, label: f.name })) }));
  });
  productFunctions.forEach((f) => out.push(q("AV-E03", "productBehavior", `Which requirements, if any, does “${f.name}” help satisfy?`, "A function may have no requirement link; completeness is checked from each requirement outward.", "multi", false, { instanceKey: f.id, options: reqOptions })));
  out.push(q("AV-E04", "productBehavior", "Does the product behavior cover the selected use cases and requirements?", "Review coverage, sequence and requirement links.", "recap"));

  productFunctions.forEach((f) => out.push(q("AV-F01", "productStructure", `Which product component performs “${f.name}”?`, "Enter one or more components separated by semicolons.", "semicolon", true, { instanceKey: f.id })));
  const productComponents = ofType(project, "productComponent"), intents = Object.values(sessionOf(project)?.parameterIntents ?? {});
  productComponents.forEach((c) => out.push(q("AV-F02", "productStructure", `Which requirements, if any, are satisfied by “${c.name}”?`, "A component is valid without a direct requirement link.", "multi", false, { instanceKey: c.id, options: reqOptions })));
  intents.filter((intent) => !intent.ownerElementId).forEach((intent) => out.push(q("AV-F03", "productStructure", `Which product function or component owns the parameter “${intent.propertyName}”?`, "Selecting an owner creates or reuses that parameter on the chosen element and binds it to the quantitative requirement. An element already selected as satisfying the requirement is suggested first.", "single", false, { instanceKey: intent.requirementId, options: [{ id: "pending", label: "Leave pending for industrial architecture" }, ...productOwnerOptions(project, intent.requirementId)] })));
  intents.filter((intent) => intent.ownerElementId && ["productFunction", "productComponent"].includes(project.elements.find((item) => item.id === intent.ownerElementId)?.elementType ?? "")).forEach((intent) => {
    const owner = project.elements.find((item) => item.id === intent.ownerElementId);
    out.push(q("AV-F04", "productStructure", `What is the current value of “${intent.propertyName}” for “${owner?.name ?? "its owner"}”?`, "Enter value, unit, source and origin.", "engineeringValue", false, { instanceKey: intent.requirementId }));
  });
  productComponents.forEach((c) => out.push(q("AV-F05", "productStructure", `Does “${c.name}” exchange material, energy or information with another product component?`, "Add an interface only when useful.", "interaction", false, { instanceKey: c.id, options: productComponents.filter((x) => x.id !== c.id).map((x) => ({ id: x.id, label: x.name })) })));
  out.push(q("AV-F06", "productStructure", "Does the product architecture realize its functions and satisfy its requirements?", "Review components, interfaces, parameters and satisfaction.", "recap"));

  selectedCases.forEach((uc) => out.push(q("AV-G01", "industrialBehavior", `Which industrial-system process functions are involved in use case “${uc.name}”?`, "Each entry creates a Process Function and links it to this Use Case with hasFunction. Enter them in execution order; leave this empty for a product-only use case.", "semicolon", false, { instanceKey: uc.id, example: "Position component; Fasten component; Inspect assembly" })));
  const processFunctions = ofType(project, "processFunction");
  selectedCases.forEach((uc) => {
    const functions = targets(project, uc.id, "hasFunction", "processFunction");
    if (functions.length > 1) out.push(q("AV-G02", "industrialBehavior", `Is this the correct industrial sequence for “${uc.name}”?`, "Reorder the functions; the saved order creates cycle-free precedence.", "sequence", true, { instanceKey: uc.id, options: functions.map((f) => ({ id: f.id, label: f.name })) }));
  });
  processFunctions.forEach((f) => out.push(q("AV-G03", "industrialBehavior", `Which requirements, if any, does “${f.name}” help satisfy?`, "A process function may have no direct requirement link.", "multi", false, { instanceKey: f.id, options: reqOptions })));
  processFunctions.forEach((f) => out.push(q("AV-G04", "industrialStructure", `Which workstation, equipment or plant element performs process function “${f.name}”?`, "Each entry creates an Industrial System Component and links the process function to it with realizedBy.", "semicolon", true, { instanceKey: f.id, example: "Manual assembly station; Robotic fastening cell; End-of-line test bench" })));
  const industrialComponents = ofType(project, "industrialSystemComponent");
  industrialComponents.forEach((c) => out.push(q("AV-G05", "industrialStructure", `Which requirements, if any, are satisfied by “${c.name}”?`, "An industrial component may have no direct requirement link.", "multi", false, { instanceKey: c.id, options: reqOptions })));
  intents.filter((intent) => !intent.ownerElementId).forEach((intent) => out.push(q("AV-G05A", "industrialStructure", `Which industrial function or component owns “${intent.propertyName}”?`, "Bind the property to its authoritative owner or leave it visibly pending.", "single", true, { instanceKey: intent.requirementId, options: [{ id: "pending", label: "Leave pending" }, ...ownerOptions(project, ["processFunction", "industrialSystemComponent"])] })));
  intents.filter((intent) => intent.ownerElementId && ["processFunction", "industrialSystemComponent"].includes(project.elements.find((item) => item.id === intent.ownerElementId)?.elementType ?? "")).forEach((intent) => {
    const owner = project.elements.find((item) => item.id === intent.ownerElementId);
    out.push(q("AV-G05B", "industrialStructure", `What is the current value of “${intent.propertyName}” for “${owner?.name ?? "its owner"}”?`, "Enter value, unit, source and origin.", "engineeringValue", false, { instanceKey: intent.requirementId }));
  });
  processFunctions.forEach((f) => {
    out.push(q("AV-G06", "industrialBehavior", `How long does “${f.name}” take?`, "Enter the authoritative duration and source.", "duration", project.overallScope !== "architectureBuilding", { instanceKey: f.id }));
    out.push(q("AV-G07", "industrialBehavior", `What product item does “${f.name}” consume?`, "Select only product components defined in AV-F01; enter quantity and unit.", "flow", false, { instanceKey: f.id, options: productComponents.map((c) => ({ id: c.id, label: c.name })) }));
    out.push(q("AV-G08", "industrialBehavior", `What product item does “${f.name}” produce?`, "Select only product components defined in AV-F01; enter quantity and unit.", "flow", true, { instanceKey: f.id, options: productComponents.map((c) => ({ id: c.id, label: c.name })) }));
  });
  industrialComponents.forEach((c) => out.push(q("AV-G09", "industrialStructure", `Which resources are required by “${c.name}”?`, "Each entry creates a Resource and links it to this industrial component with requiresResource. Resources may be people, roles, skills, tools, machines, software or facilities.", "semicolon", project.overallScope !== "architectureBuilding", { instanceKey: c.id, example: "Assembly operator; Torque wrench; Electrical-safety skill; Lifting fixture; MES software" })));
  industrialComponents.forEach((c) => targets(project, c.id, "requiresResource", "resource").forEach((r) => out.push(q("AV-G10", "industrialStructure", `How much of “${r.name}” is required by “${c.name}”?`, "Quantity drives demand; rates and capacity support later calculations.", "resourceDetail", true, { instanceKey: `${c.id}|${r.id}` }))));
  industrialComponents.forEach((c) => out.push(q("AV-G11", "industrialStructure", `Does “${c.name}” exchange material, energy or information with another industrial component?`, "Add an interface only when needed.", "interaction", false, { instanceKey: c.id, options: industrialComponents.filter((x) => x.id !== c.id).map((x) => ({ id: x.id, label: x.name })) })));
  out.push(q("AV-G12", "industrialStructure", "Does the industrial architecture realize its functions, product flows and resource needs?", "Review sequence, equipment, flows, durations and resources.", "recap"));

  requirements.forEach((req) => out.push(q("AV-H01", "traceability", `How will “${req.name}” be verified?`, "Describe an analysis, inspection, demonstration or test.", "verification", req.metadata.requirementClass === "mandatory" || !req.metadata.requirementClass, { instanceKey: req.id, options: processFunctions.map((f) => ({ id: f.id, label: f.name })) })));
  const satisfactionOptions = project.elements.filter((item) => eligibleOwners.includes(item.elementType)).flatMap((owner) => [
    { id: owner.id, label: `${owner.name} · ${owner.elementType}` },
    ...owner.parameters.map((p) => ({ id: p.id, label: `${p.name} · parameter`, detail: `Owned by ${owner.name}` }))
  ]);
  requirements.forEach((req) => out.push(q("AV-H02", "traceability", `Which existing model element addresses requirement “${req.name}”?`, "Select at least one existing function, technical component or owned parameter. This question does not create a parameter; quantitative parameters are created earlier when their owner is selected. Selecting a parameter records its owner as the satisfying element and binds the parameter to the requirement formula.", "multi", !requirementHasSatisfaction(project, req.id), { instanceKey: req.id, options: satisfactionOptions, example: "Select Housing for a mass requirement, or select the existing Mass parameter owned by Housing." })));
  requirements.filter((req) => !req.requirementFormula?.expression.trim()).forEach((req) => out.push(q("AV-H03", "traceability", `What is the current result for “${req.name}”?`, "Use a design review or declare a demonstrator assumption. A link alone does not complete a check.", "single", true, { instanceKey: req.id, options: [{ id: "met", label: "Met by review" }, { id: "notMet", label: "Not met by review" }, { id: "assumed", label: "Assumed for demonstration" }, { id: "notChecked", label: "Not checked" }] })));
  out.push(q("AV-H04", "traceability", "Is the architecture ready for its selected scope?", "Review intent, behavior, realization, satisfaction, flows, resources and verification.", "recap"));

  if (project.overallScope === "architectureAndSimulation") {
    const catalogOptions = standardKpiCatalog.map((entry) => {
      const existing = project.kpis.find((kpi) => kpi.standardAlgorithmKey === entry.key);
      return { id: existing?.id ?? architectKpiId(entry.key), label: entry.name, detail: entry.detail };
    });
    const customOptions = project.kpis.filter((kpi) => !kpi.standardAlgorithmKey).map((kpi) => ({ id: kpi.id, label: kpi.name, detail: "Existing guided-formula KPI." }));
    out.push(q("AV-I01", "analysis", "Which results will help answer the study objectives?", "Select at least one decision-relevant KPI. The suggested KPIs use the workbench's standard, traceable calculations.", "multi", true, { options: [...catalogOptions, ...customOptions] }));
    const analysisKpis = selectedKpis(project);
    analysisKpis.forEach((kpi) => {
      out.push(q("AV-I02", "analysis", `Which needs or objectives does “${kpi.name}” help measure?`, "Link the KPI to at least one stakeholder need or objective so the result remains connected to study intent.", "multi", true, { instanceKey: kpi.id, options: [...needs.map((need) => ({ id: need.id, label: need.name, detail: "Stakeholder need" })), ...objectives.map((objective) => ({ id: objective.id, label: objective.name, detail: "Objective" }))] }));
      out.push(q("AV-I03", "analysis", `How should “${kpi.name}” be calculated?`, "Use the standard method when it matches the intended meaning; otherwise build a formula from exact model references.", "single", true, { instanceKey: kpi.id, options: [
        ...(kpi.standardAlgorithmKey ? [{ id: "standardAlgorithm", label: "Standard workbench algorithm" }] : []),
        { id: "formula", label: "Guided formula" }
      ] }));
      const mode = av<string>(project, "AV-I03", kpi.id) ?? kpi.calculationMode;
      if (mode === "standardAlgorithm") out.push(q("AV-I04", "analysis", `Confirm the exact input set for “${kpi.name}”.`, "Review what the standard algorithm reads from the model. Missing values are collected in the next questions.", "kpiReview", true, { instanceKey: kpi.id, options: exactInputsForKpi(project, kpi) }));
      if (mode === "formula") out.push(q("AV-I05", "analysis", `Build the formula for “${kpi.name}”.`, "Insert parameters and dependent KPIs by name; the stored expression keeps their exact immutable IDs.", "kpiFormula", true, { instanceKey: kpi.id }));
      out.push(q("AV-I06", "analysis", `What unit, target and limits apply to “${kpi.name}”?`, "Define its output unit, target and optional acceptable limits. Comparison direction and weight are not requested for this scope.", "kpiDefinition", true, { instanceKey: kpi.id }));
    });

    const semanticNeeds = new Map<StandardAlgorithmKey, { semanticKey: string; name: string; unit: string }>([
      ["totalMass", { semanticKey: "mass", name: "Mass", unit: "kg" }],
      ["directElementCost", { semanticKey: "cost", name: "Direct cost", unit: "EUR" }],
      ["estimatedTotalCost", { semanticKey: "cost", name: "Direct cost", unit: "EUR" }],
      ["totalPower", { semanticKey: "power", name: "Power", unit: "kW" }]
    ]);
    analysisKpis.forEach((kpi) => {
      const need = kpi.standardAlgorithmKey ? semanticNeeds.get(kpi.standardAlgorithmKey) : undefined;
      const matching = need ? allParameters(project).filter(({ parameter }) => parameter.semanticKey === need.semanticKey) : [];
      if (need && !matching.some(({ parameter }) => typeof parameter.value === "number" && Number.isFinite(parameter.value))) {
        out.push(q("AV-I08", "analysis", `Which model elements provide the missing ${need.name.toLowerCase()} inputs for “${kpi.name}”?`, "Select every authoritative function or technical component that contributes. Enter a separate value and engineering source for each owner; aggregate KPI algorithms will use all selected values.", "analysisInput", true, { instanceKey: `${kpi.id}|semantic:${need.semanticKey}`, options: ownerOptions(project, eligibleOwners), example: `For Total mass, select each contributing component and enter its mass in ${need.unit}; cite CAD mass properties, a supplier datasheet or an engineering estimate as the source.` }));
      }
      if (kpi.calculationMode === "formula" && kpi.formula) {
        try {
          formulaReferences(parseKpiFormula(kpi.formula)).parameterIds.forEach((parameterId) => {
            const entry = allParameters(project).find(({ parameter }) => parameter.id === parameterId);
            if (entry && (typeof entry.parameter.value !== "number" || !Number.isFinite(entry.parameter.value))) out.push(q("AV-I08", "analysis", `What is the missing value for “${entry.owner.name} / ${entry.parameter.name}”?`, "Enter the engineering value and its provenance before running the analysis.", "engineeringValue", true, { instanceKey: `${kpi.id}|parameter:${parameterId}` }));
          });
        } catch { /* AV-I05 reports the formula error. */ }
      }
    });

    out.push(q("AV-I11", "analysis", "Name and run this analysis.", "The workbench checks the current canonical architecture, KPI definitions and explicit inputs before storing an immutable simulation run.", "simulationRun", true));
    out.push(q("AV-I12", "analysis", "Simulation Results", "Review KPI results, requirement status, warnings and sources before completing this phase.", "simulationRecap", true));
  }
  if (project.overallScope === "tradeStudy") {
    const analysisKpis = selectedKpis(project);
    analysisKpis.forEach((kpi) => {
      const mode = av<string>(project, "AV-I03", kpi.id) ?? kpi.calculationMode;
      if (mode === "standardAlgorithm") out.push(q("AV-I04", "analysisInputs", `Confirm the exact input set for “${kpi.name}”.`, "Review what the standard algorithm reads from the completed 150% architecture. Missing values are collected in the next questions.", "kpiReview", true, { instanceKey: kpi.id, options: exactInputsForKpi(project, kpi) }));
      if (mode === "formula") out.push(q("AV-I05", "analysisInputs", `Build the formula for “${kpi.name}”.`, "Insert parameters and dependent KPIs from the completed 150% architecture; the stored expression keeps their exact immutable IDs.", "kpiFormula", true, { instanceKey: kpi.id }));
    });
    const semanticNeeds = new Map<StandardAlgorithmKey, { semanticKey: string; name: string; unit: string }>([
      ["totalMass", { semanticKey: "mass", name: "Mass", unit: "kg" }],
      ["directElementCost", { semanticKey: "cost", name: "Direct cost", unit: "EUR" }],
      ["estimatedTotalCost", { semanticKey: "cost", name: "Direct cost", unit: "EUR" }],
      ["totalPower", { semanticKey: "power", name: "Power", unit: "kW" }]
    ]);
    analysisKpis.forEach((kpi) => {
      const need = kpi.standardAlgorithmKey ? semanticNeeds.get(kpi.standardAlgorithmKey) : undefined;
      const matching = need ? allParameters(project).filter(({ parameter }) => parameter.semanticKey === need.semanticKey) : [];
      if (need && !matching.some(({ parameter }) => typeof parameter.value === "number" && Number.isFinite(parameter.value))) {
        out.push(q("AV-I08", "analysisInputs", `Which model elements provide the missing ${need.name.toLowerCase()} inputs for “${kpi.name}”?`, "Select every authoritative function or technical component that contributes. Enter a separate value and engineering source for each owner; aggregate KPI algorithms will use all selected values.", "analysisInput", true, { instanceKey: `${kpi.id}|semantic:${need.semanticKey}`, options: ownerOptions(project, eligibleOwners), example: `For Total mass, select each contributing component and enter its mass in ${need.unit}; cite CAD mass properties, a supplier datasheet or an engineering estimate as the source.` }));
      }
      if (kpi.calculationMode === "formula" && kpi.formula) {
        try {
          formulaReferences(parseKpiFormula(kpi.formula)).parameterIds.forEach((parameterId) => {
            const entry = allParameters(project).find(({ parameter }) => parameter.id === parameterId);
            if (entry && (typeof entry.parameter.value !== "number" || !Number.isFinite(entry.parameter.value))) out.push(q("AV-I08", "analysisInputs", `What is the missing value for “${entry.owner.name} / ${entry.parameter.name}”?`, "Enter the engineering value and its provenance before deriving and simulating the alternatives.", "engineeringValue", true, { instanceKey: `${kpi.id}|parameter:${parameterId}` }));
          });
        } catch { /* AV-I05 reports the formula error. */ }
      }
    });
  }
  if (project.overallScope === "tradeStudy") {
    const study = activeStudy(project);
    out.push(q("AV-J01", "variability", "What represents the complete configurable family?", "One root feature contains the common and variable product-line choices.", "rootFeature"));
    out.push(q("AV-J02", "variability", "Which capabilities are mandatory in every alternative?", "Confirm or edit the common-content proposals from trade framing; separate them with semicolons.", "semicolon", false));
    tradeAxisIntents(project).forEach((axisName) => {
      out.push(q("AV-J03", "variability", `What choices are available for “${axisName}”?`, "Enter choices and select whether exactly one, one or more, independent optional choices, or one typed value is allowed.", "axisDefinition", true, { instanceKey: safeSlug(axisName) }));
      if (av<AxisDefinitionValue>(project, "AV-J03", safeSlug(axisName))?.mode === "typed") out.push(q("AV-J04", "variability", `Which values are allowed for “${axisName}”?`, "Enter distinct enumeration values separated by semicolons.", "semicolon", true, { instanceKey: safeSlug(axisName) }));
    });
    out.push(q("AV-J05", "variability", "Do any choices require or exclude other choices?", "Add only rules needed to prevent invalid alternatives.", "constraintList", false, { options: project.features.filter((feature) => feature.featureType !== "root").map((feature) => ({ id: feature.id, label: feature.name })) }));
    out.push(q("AV-J06", "variability", "Which model elements are present only for a specific feature choice?", "Map only genuinely variable requirements, functions, components, processes, resources or verification methods; unlisted elements remain common.", "elementApplicability", false, { options: project.elements.filter((element) => !["mission", "stakeholder", "need", "objective", "useCase"].includes(element.elementType)).map((element) => ({ id: element.id, label: element.name, detail: element.elementType })) }));
    out.push(q("AV-J07", "variability", "Which parameter values change between feature choices?", "Optionally map a feature choice to a new value for an existing model parameter.", "propertyVariation", false));
    project.variationPoints.forEach((variationPoint) => out.push(q("AV-J08", "variability", `Which model domains does “${variationPoint.name}” affect?`, "Select requirements, structure, behavior, process, resources or verification; an empty selection means all applicable domains.", "multi", false, { instanceKey: variationPoint.id, options: ["requirements", "structure", "behavior", "process", "resources", "verification"].map((scope) => ({ id: scope, label: scope })) })));
    out.push(q("AV-J09", "variability", "Does the 150% model contain the complete family and valid variability rules?", "Review the feature hierarchy, constraints, variable elements and property changes.", "recap"));

    const configurationEntries = tradeAlternativeIntents(project).map((concept, index) => {
      const conceptId = concept.id ?? `concept-${index + 1}-${safeSlug(String(concept.name))}`;
      out.push(q("AV-K01", "configurations", `Which choices define “${concept.name}”?`, "Select one value for each required feature group and any optional features.", "configuration", true, { instanceKey: conceptId }));
      const configuration = configurationForIntent(project, conceptId);
      const configurationId = configuration?.id ?? `architect-configuration-${conceptId}`;
      if (configuration) {
        const errors = validateConfiguration(project, configuration).filter((finding) => finding.severity === "error");
        if (errors.length) {
          out.push(q("AV-K02", "configurations", `How should the invalid choices for “${configuration.name}” be resolved?`, "Apply required-feature corrections automatically or return to the previous question and correct them manually.", "single", true, { instanceKey: configuration.id, options: [{ id: "automatic", label: "Apply required-feature corrections" }, { id: "manual", label: "Correct manually" }] }));
          out.push(q("AV-K03", "configurations", `Is “${configuration.name}” now a valid configuration?`, "Invalid drafts remain saved, but derivation and simulation are blocked until every constraint and required group is resolved.", "configurationRecap", true, { instanceKey: configuration.id, options: errors.map((finding) => ({ id: finding.id, label: finding.message })) }));
        }
      }
      return { concept, conceptId, configurationId, configuration };
    });

    configurationEntries.forEach(({ configuration }) => {
      if (!configuration || validateConfiguration(project, configuration).some((finding) => finding.severity === "error")) return;
      out.push(q("AV-K04", "configurations", `Create the 100% architecture for “${configuration.name}”?`, "Review included, excluded and modified content before deterministic derivation.", "derivation", true, { instanceKey: configuration.id }));
      if (configuration.derivation) out.push(q("AV-K05", "configurations", `Does the realized architecture match “${configuration.name}”?`, "Review selected features, included and excluded elements, property changes, warnings and validation.", "configurationRecap", true, { instanceKey: configuration.id }));
    });

    const readyConfigurations = configurationEntries.flatMap(({ configuration }) => configuration && configuration.validationStatus === "valid" && !validateConfiguration(project, configuration).some((finding) => finding.severity === "error") && derivationStatus(project, configuration) === "Current" ? [configuration] : []);
    const everyAlternativeReady = configurationEntries.length >= 2 && readyConfigurations.length === configurationEntries.length;
    out.push(q("AV-S01", "tradeSimulation", "Are all alternatives ready for simulation?", everyAlternativeReady ? "Every alternative has a valid configuration and a current 100% derivation. Confirm the contexts before producing comparable evidence." : `Simulation is locked: ${readyConfigurations.length} of ${configurationEntries.length} alternatives have a valid configuration and current 100% derivation. Complete configuration and derivation first.`, "kpiReview", true, { options: configurationEntries.map(({ concept, configuration }) => ({ id: configuration?.id ?? `missing-${String(concept.id ?? concept.name)}`, label: String(concept.name), detail: !configuration ? "Configuration not created" : validateConfiguration(project, configuration).some((finding) => finding.severity === "error") ? "Configuration invalid" : derivationStatus(project, configuration) !== "Current" ? "100% derivation missing or stale" : "Ready · current 100% derivation" })) }));
    if (everyAlternativeReady) {
      out.push(q("AV-S03", "tradeSimulation", "Run the selected KPIs for all derived alternatives?", "This creates one immutable configured simulation run for each current 100% architecture. Every run uses the same selected KPI set.", "simulationRun", true));
      out.push(q("AV-S04", "tradeSimulation", "Simulation Results", "Review KPI coverage, values, units, warnings and provenance across all current 100% architectures.", "simulationRecap", true));
    }

    const eligibleRuns = activeConfigurations(project).flatMap((configuration) => {
      const run = derivationStatus(project, configuration) === "Current" ? latestConfiguredRun(project, configuration.id) : undefined;
      return run ? [{ configuration, run }] : [];
    });
    out.push(q("AV-L01", "comparison", "Which realized alternatives should be compared?", "Only current 100% architectures with current simulation evidence are available; select at least two.", "multi", true, { options: eligibleRuns.map(({ configuration, run }) => ({ id: run.id, label: configuration.name, detail: `${run.results.length} KPI results` })) }));
    out.push(q("AV-L02", "comparison", "Which baseline obligations are retained?", "All established requirements remain in the assessment. Study focus only highlights a subset.", "recap", true));
    const selectedRunIds = splitArchitectList(av<unknown>(project, "AV-L01")), selectedRuns = project.simulationRuns.filter((run) => selectedRunIds.includes(run.id));
    const eligibleKpis = selectedRuns.length < 2 ? [] : project.kpis.filter((kpi) => selectedRuns.every((run) => run.results.some((result) => result.kpiId === kpi.id && typeof result.value === "number" && Number.isFinite(result.value))));
    out.push(q("AV-L03", "comparison", "Which KPIs should distinguish the alternatives?", "Select only KPIs with current numeric evidence for every selected alternative.", "multi", true, { options: eligibleKpis.map((kpi) => ({ id: kpi.id, label: kpi.name, detail: kpi.outputUnit })) }));
    selectedComparisonKpiIds(project).forEach((kpiId) => {
      const kpi = project.kpis.find((candidate) => candidate.id === kpiId)!;
      out.push(q("AV-L04", "comparison", `How important is “${kpi.name}” to this decision?`, "Enter a study-specific non-negative weight; at least one selected KPI must have a positive weight.", "number", true, { instanceKey: kpi.id }));
      out.push(q("AV-L05", "comparison", `What result is preferred and which limit applies for “${kpi.name}”?`, "Confirm direction and optionally define a warning or hard minimum/maximum threshold for this study.", "comparisonSetting", true, { instanceKey: kpi.id }));
    });
    out.push(q("AV-L06", "comparison", "Are the alternatives ready for a fair comparison?", "Review derivation currency, run revisions, KPI coverage, units and warnings.", "kpiReview", true, { options: eligibleRuns.map(({ configuration, run }) => ({ id: run.id, label: configuration.name, detail: `Derivation ${run.derivationId ?? "missing"}; revision ${run.projectModelRevisionAtRun}` })) }));
    out.push(q("AV-L07", "comparison", "Calculate the trade-off results?", "Feasibility is evaluated first; weighted scores use only the visible study settings and immutable run evidence.", "comparisonRun", true));
    const result = study?.results.at(-1);
    if (result) {
      out.push(q("AV-L08", "comparison", "Does this result reflect the decision priorities?", "Review feasibility, decisive KPI trade-offs, ties and warnings before proposing a baseline.", "comparisonRecap", true));
      const feasible = study.alternativeRefs.filter((alternative) => ["feasible", "exceptionApproved"].includes(result.feasibility?.[alternative.id]?.status ?? ""));
      out.push(q("AV-L09", "comparison", "Which feasible alternative should be proposed as the baseline?", "The calculated leader is proposed when unique; ties require an explicit choice.", "single", true, { options: feasible.map((alternative) => ({ id: alternative.id, label: alternative.label, detail: result.recommendedAlternativeIds?.includes(alternative.id) ? "Calculated leader" : "Feasible alternative" })) }));
      if (av<string>(project, "AV-L09")) out.push(q("AV-L10", "comparison", "Why is this alternative the appropriate baseline?", "Record the rationale, decision owner and date; approving the decision requires explicit baseline confirmation.", "decisionDetails", true));
    }
  }
  out.push(q("AV-M02", "final", "Does the stakeholder traceability recap show why the result matters?", "Review the most decision-relevant need or objective through requirement, satisfying model content and evidence.", "finalRecap", true));
  out.push(q("AV-M03", "final", "Does the architecture recap accurately describe what was modeled?", "Review selected use cases, product and industrial behavior, technical components, product flows and resources.", "finalRecap", true));
  out.push(q("AV-M04", "final", "Does the requirements recap accurately show satisfaction and missing evidence?", "Review satisfied, failed, pending and error states with readable actual-versus-target evidence.", "finalRecap", true));
  if (project.overallScope !== "architectureBuilding") out.push(q("AV-M05", "final", "Does the simulation recap show the current decisive evidence?", "Review the current run, decisive KPIs, warnings and provenance.", "finalRecap", true));
  if (project.overallScope === "tradeStudy") out.push(q("AV-M06", "final", "Does the trade-off recap accurately explain the comparison and baseline?", "Review alternatives, feasibility, decisive trade-offs, the proposed or approved baseline and its rationale.", "finalRecap", true));
  return out;
}

const canonicalReviewQuestionIds = new Set([
  "AV-A01", "AV-A03", "AV-A04", "AV-B01", "AV-A05", "AV-B02", "AV-B03", "AV-B04", "AV-B06", "AV-B07",
  "AV-C01", "AV-C02", "AV-C03", "AV-C04", "AV-D01", "AV-D02", "AV-D04", "AV-D05", "AV-D09",
  "AV-E01", "AV-E02", "AV-E03", "AV-F01", "AV-F02", "AV-F03", "AV-G01", "AV-G02", "AV-G03", "AV-G04", "AV-G05",
  "AV-G06", "AV-G07", "AV-G08", "AV-G09", "AV-G10", "AV-H02", "AV-H03",
  "AV-I02", "AV-I03", "AV-I05", "AV-I06", "AV-I07", "AV-I08",
  "AV-J01", "AV-J02", "AV-J03", "AV-J04", "AV-J05", "AV-J06", "AV-J07", "AV-J08", "AV-K01",
  "AV-L01", "AV-L02", "AV-L03", "AV-L04", "AV-L05", "AV-L09", "AV-L10",
  "AV-B05", "AV-C05", "AV-D10", "AV-T06", "AV-E04", "AV-F06", "AV-G12", "AV-H04", "AV-J09",
  "AV-M02", "AV-M03", "AV-M04", "AV-M05", "AV-M06"
]);

export function projectedArchitectValue(project: Project, item: ArchitectQuestion): unknown {
  const stored = sessionOf(project)?.answers[item.key];
  if (stored && item.id !== "AV-C03" && !(stored.status === "needsReview" && canonicalReviewQuestionIds.has(item.id))) return stored.value;
  const intent = item.instanceKey ? sessionOf(project)?.parameterIntents[item.instanceKey] : undefined;
  switch (item.id) {
    case "AV-A01": return project.description;
    case "AV-A02": return project.overallScope ?? "architectureBuilding";
    case "AV-A03": return project.name;
    case "AV-A04": return ofType(project, "mission")[0]?.name ?? "";
    case "AV-B01": return ofType(project, "stakeholder").map((x) => x.name).join("; ");
    case "AV-A05": return ofType(project, "system")[0]?.name ?? "";
    case "AV-B06": return ofType(project, "externalSystem").map((x) => x.name).join("; ");
    case "AV-B07": return project.elements.find((x) => x.id === item.instanceKey)?.description ?? "";
    case "AV-B02": return project.elements.find((x) => x.id === item.instanceKey)?.description ?? "";
    case "AV-B03": return item.instanceKey ? targets(project, item.instanceKey, "hasNeed", "need").map((x) => x.name).join("; ") : "";
    case "AV-B04": return item.instanceKey ? targets(project, item.instanceKey, "hasObjective", "objective").map((x) => x.name).join("; ") : "";
    case "AV-C01": return ofType(project, "useCase").map((x) => x.name).join("; ");
    case "AV-C02": return item.instanceKey ? project.relationships.filter((x) => x.targetId === item.instanceKey && x.relationshipType === "involvedIn").map((x) => x.sourceId) : [];
    case "AV-C03": return item.instanceKey ? targets(project, item.instanceKey, "addresses").map((x) => x.id) : [];
    case "AV-D03": {
      if (!item.instanceKey) return [];
      const originIds = new Set(project.relationships.filter((relationship) => relationship.targetId === item.instanceKey && relationship.relationshipType === "derives").map((relationship) => relationship.sourceId));
      return project.selectedUseCaseIds.filter((useCaseId) => project.relationships.some((relationship) => relationship.sourceId === useCaseId && relationship.relationshipType === "addresses" && originIds.has(relationship.targetId)));
    }
    case "AV-C04": return project.selectedUseCaseIds;
    case "AV-D01": return item.instanceKey ? targets(project, item.instanceKey, "derives", "systemRequirement").map((x) => x.name).join("; ") : "";
    case "AV-D02": return item.instanceKey ? { selectedIds: targets(project, item.instanceKey, "derives", "systemRequirement").map((x) => x.id), newItems: "" } : { selectedIds: [], newItems: "" };
    case "AV-D04": return project.elements.find((x) => x.id === item.instanceKey)?.requirementFormula?.expression.trim() ? "quantitative" : "qualitative";
    case "AV-D05": {
      if (intent) return { propertyName: intent.propertyName, semanticKey: intent.semanticKey, operator: intent.operator, target: intent.target, unit: intent.unit };
      const requirement = project.elements.find((x) => x.id === item.instanceKey);
      const match = requirement?.requirementFormula?.expression.trim().match(/^@([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|==|!=|<|>|=)\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/);
      const semanticKey = match?.[1] ?? "";
      const binding = requirement?.requirementFormula?.bindings.find((candidate) => candidate.symbol === semanticKey);
      const parameter = binding?.kind === "parameter" ? project.elements.flatMap((element) => element.parameters).find((candidate) => candidate.id === binding.targetId) : undefined;
      const kpi = binding?.kind === "kpi" ? project.kpis.find((candidate) => candidate.id === binding.targetId) : undefined;
      return {
        propertyName: parameter?.name ?? kpi?.name ?? semanticKey.replace(/_/g, " "),
        semanticKey,
        operator: (match?.[2] ?? "<=") as ArchitectParameterIntent["operator"],
        target: match ? Number(match[3]) : "",
        unit: parameter?.unit ?? kpi?.outputUnit ?? ""
      };
    }
    case "AV-D06": return intent ? { sourceKind: intent.sourceKind ?? "later", ownerElementId: intent.ownerElementId ?? "" } : { sourceKind: "later", ownerElementId: "" };
    case "AV-D07": case "AV-F04": case "AV-G05B": return intent ? { value: intent.preliminaryValue, unit: intent.unit, source: intent.source ?? "", valueOrigin: intent.valueOrigin ?? "entered", uncertaintyPercent: intent.uncertaintyPercent } : { value: null, unit: "", source: "", valueOrigin: "entered" };
    case "AV-D08": case "AV-H01": {
      const verificationRelationship = project.relationships.find((relationship) => relationship.targetId === item.instanceKey && relationship.relationshipType === "verifies");
      const method = project.elements.find((element) => element.id === verificationRelationship?.sourceId && element.elementType === "verificationMethod");
      const allocation = project.relationships.find((relationship) => relationship.sourceId === method?.id && relationship.relationshipType === "allocatedTo");
      return { category: method?.metadata.verificationCategory ?? "analysis", name: method?.name ?? "", description: method?.description ?? "", allocatedProcessFunctionId: allocation?.targetId ?? "" };
    }
    case "AV-D09": return project.elements.find((x) => x.id === item.instanceKey)?.metadata.requirementClass ?? "mandatory";
    case "AV-E01": return item.instanceKey ? targets(project, item.instanceKey, "hasFunction", "productFunction").map((x) => x.name).join("; ") : "";
    case "AV-E02": case "AV-G02": {
      const domain = item.id === "AV-E02" ? "product" : "process";
      return project.functionSequences.find((x) => x.domain === domain && item.instanceKey && x.useCaseIds.includes(item.instanceKey))?.functionIds ?? item.options?.map((x) => x.id) ?? [];
    }
    case "AV-E03": case "AV-F02": case "AV-G03": case "AV-G05": return item.instanceKey ? sources(project, item.instanceKey, "satisfiedBy", "systemRequirement").map((x) => x.id) : [];
    case "AV-F01": return item.instanceKey ? targets(project, item.instanceKey, "realizedBy", "productComponent").map((x) => x.name).join("; ") : "";
    case "AV-F03": return intent?.ownerElementId ?? productOwnerOptions(project, item.instanceKey ?? "").find((option) => option.detail?.includes("Suggested because"))?.id ?? "pending";
    case "AV-G05A": return intent?.ownerElementId ?? "pending";
    case "AV-F05": case "AV-G11": return { counterpartId: "", interfaceName: "", exchangedItem: "" };
    case "AV-G01": return item.instanceKey ? targets(project, item.instanceKey, "hasFunction", "processFunction").map((x) => x.name).join("; ") : "";
    case "AV-G04": return item.instanceKey ? targets(project, item.instanceKey, "realizedBy", "industrialSystemComponent").map((x) => x.name).join("; ") : "";
    case "AV-G06": { const owner = project.elements.find((x) => x.id === item.instanceKey); return { duration: owner?.metadata.duration, durationUnit: owner?.metadata.durationUnit ?? "minute", source: owner?.metadata.source ?? "", valueOrigin: owner?.parameters.find((p) => p.semanticKey === "duration")?.valueOrigin ?? "entered" }; }
    case "AV-G07": case "AV-G08": return item.instanceKey ? project.relationships.filter((x) => x.sourceId === item.instanceKey && x.relationshipType === (item.id === "AV-G07" ? "consumes" : "produces")).map((x) => ({ componentId: x.targetId, quantity: x.quantity ?? 1, unit: x.unit ?? "", itemFlowName: x.itemFlowName ?? "" })) : [];
    case "AV-G09": return item.instanceKey ? targets(project, item.instanceKey, "requiresResource", "resource").map((x) => x.name).join("; ") : "";
    case "AV-G10": { const [componentId, resourceId] = item.instanceKey?.split("|") ?? []; const resource = project.elements.find((x) => x.id === resourceId); const rel = project.relationships.find((x) => x.sourceId === componentId && x.targetId === resourceId && x.relationshipType === "requiresResource"); return { quantity: rel?.requiredQuantity ?? 1, unit: rel?.unit ?? "item", resourceType: resource?.metadata.resourceType ?? "tool", hourlyRate: resource?.metadata.hourlyRate, costUnit: resource?.metadata.costUnit ?? "EUR/h", capacityHours: resource?.metadata.capacityHours, availabilityPercent: resource?.metadata.availabilityPercent }; }
    case "AV-H02": return item.instanceKey ? [...targets(project, item.instanceKey, "satisfiedBy").map((x) => x.id), ...(project.elements.find((x) => x.id === item.instanceKey)?.requirementFormula?.bindings.filter((b) => b.kind === "parameter").map((b) => b.targetId) ?? [])] : [];
    case "AV-H03": {
      const requirement = project.elements.find((x) => x.id === item.instanceKey);
      return requirement?.metadata.requirementReviews?.model?.result ?? "notChecked";
    }
    case "AV-I01": return selectedKpiIds(project);
    case "AV-I02": { const kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey); return [...(kpi?.needIds ?? []), ...(kpi?.objectiveIds ?? [])]; }
    case "AV-I03": return project.kpis.find((kpi) => kpi.id === item.instanceKey)?.calculationMode ?? "";
    case "AV-I04": return false;
    case "AV-S01": return Boolean(item.options?.length && item.options.every((option) => option.detail?.startsWith("Ready")));
    case "AV-I05": return project.kpis.find((kpi) => kpi.id === item.instanceKey)?.formula ?? "";
    case "AV-I06": { const kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey); return { outputUnit: kpi?.outputUnit ?? "", optimizationDirection: kpi?.optimizationDirection ?? "minimize", targetValue: kpi?.targetValue, minimumThreshold: kpi?.minimumThreshold, maximumThreshold: kpi?.maximumThreshold }; }
    case "AV-I07": return project.kpis.find((kpi) => kpi.id === item.instanceKey)?.weight ?? 1;
    case "AV-I08": {
      const [, input] = item.instanceKey?.split("|") ?? [];
      if (input?.startsWith("parameter:")) {
        const parameterId = input.slice("parameter:".length), parameter = allParameters(project).find((entry) => entry.parameter.id === parameterId)?.parameter;
        return { value: parameter?.value ?? null, unit: parameter?.unit ?? "", source: parameter?.source ?? "", valueOrigin: parameter?.valueOrigin ?? "entered", uncertaintyPercent: parameter?.uncertaintyPercent };
      }
      const semanticKey = input?.replace("semantic:", "") ?? "property", catalog = standardKpiCatalog.find((entry) => entry.key === project.kpis.find((kpi) => kpi.id === item.instanceKey?.split("|")[0])?.standardAlgorithmKey);
      const owners = allParameters(project).filter(({ parameter }) => parameter.semanticKey === semanticKey).map(({ owner, parameter }) => ({ ownerElementId: owner.id, value: parameter.value, unit: parameter.unit ?? catalog?.unit ?? "", source: parameter.source ?? "", valueOrigin: parameter.valueOrigin ?? "entered", uncertaintyPercent: parameter.uncertaintyPercent, minimum: parameter.minimum, maximum: parameter.maximum }));
      return { owners, propertyName: catalog?.name ?? semanticKey, semanticKey };
    }
    case "AV-I11": return { name: `${project.name} analysis`, execute: true };
    case "AV-I12": return false;
    case "AV-T01": return activeStudy(project)?.name ?? `${project.name} Trade Study`;
    case "AV-T02": return activeStudy(project)?.question ?? "";
    case "AV-T03": return tradeCommonIntents(project).join("; ");
    case "AV-T04": return tradeAxisIntents(project).join("; ");
    case "AV-T05": {
      const concepts = tradeAlternativeIntents(project);
      return concepts.length ? concepts : [{ id: id("concept"), name: "", description: "" }, { id: id("concept"), name: "", description: "" }];
    }
    case "AV-J01": return { name: rootFeature(project)?.name ?? `${project.name} product line`, description: rootFeature(project)?.description ?? "Complete configurable family." };
    case "AV-J02": return tradeCommonIntents(project).join("; ");
    case "AV-J03": { const axis = project.variabilityAxes.find((candidate) => safeSlug(candidate.name) === item.instanceKey), group = project.featureGroups.find((candidate) => candidate.id === axis?.featureGroupId), children = project.features.filter((feature) => feature.parentGroupId === group?.id || feature.groupId === group?.id); const typed = children.find((feature) => feature.valueType === "enumeration"); return { choices: typed?.allowedValues?.join("; ") ?? children.map((feature) => feature.name).join("; "), mode: typed ? "typed" : children[0]?.featureType ?? "xor" }; }
    case "AV-J04": { const axis = project.variabilityAxes.find((candidate) => safeSlug(candidate.name) === item.instanceKey), feature = project.features.find((candidate) => candidate.parentGroupId === axis?.featureGroupId && candidate.valueType === "enumeration"); return feature?.allowedValues?.join("; ") ?? ""; }
    case "AV-J05": return project.featureConstraints;
    case "AV-J06": return project.variationPoints.filter((vp) => vp.kind === "existence").flatMap((vp) => vp.constrainedElementIds.map((elementId) => ({ elementId, featureId: vp.featureExpression })));
    case "AV-J07": return project.variationPoints.filter((vp) => vp.kind === "primitiveProperty" && vp.propertyPath?.startsWith("parameter:")).flatMap((vp) => vp.constrainedElementIds.map((elementId) => ({ elementId, parameterId: vp.propertyPath?.split(":")[1], featureId: vp.valueRules[0]?.featureExpression, value: vp.valueRules[0]?.value, scope: vp.scope })));
    case "AV-J08": { const variationPoint = project.variationPoints.find((vp) => vp.id === item.instanceKey); return variationPoint?.realizationScopes ?? (variationPoint?.scope ? [variationPoint.scope] : []); }
    case "AV-K01": { const concept = tradeAlternativeIntents(project).find((candidate, index) => (candidate.id ?? `concept-${index + 1}-${safeSlug(String(candidate.name))}`) === item.instanceKey), configuration = configurationForIntent(project, item.instanceKey ?? ""); return { name: configuration?.name ?? concept?.name ?? "Alternative", selectedFeatureIds: configuration?.manuallySelectedFeatureIds ?? [], automaticConstraintFeatureIds: configuration?.automaticConstraintFeatureIds ?? [], featureValues: configuration?.featureValues ?? {} }; }
    case "AV-K02": return "automatic";
    case "AV-K03": {
      const configuration = project.configurations.find((candidate) => candidate.id === item.instanceKey);
      return Boolean(configuration && !validateConfiguration(project, configuration).some((finding) => finding.severity === "error"));
    }
    case "AV-K05": { const configuration = project.configurations.find((candidate) => candidate.id === item.instanceKey); return Boolean(configuration && derivationStatus(project, configuration) === "Current"); }
    case "AV-K04": return { execute: true };
    case "AV-K06": { const configuration = project.configurations.find((candidate) => candidate.id === item.instanceKey); return { name: `${configuration?.name ?? "Configuration"} evidence`, execute: true }; }
    case "AV-S03": return { name: `${project.name} comparable evidence`, execute: true };
    case "AV-S04": return activeConfigurations(project).filter((configuration) => derivationStatus(project, configuration) === "Current" && latestConfiguredRun(project, configuration.id)).length >= 2;
    case "AV-L01": return activeStudy(project)?.alternativeRefs.map((alternative) => alternative.simulationRunId) ?? [];
    case "AV-L02": return Boolean(activeStudy(project)?.baselineRequirementIds?.length);
    case "AV-L03": return activeStudy(project)?.selectedKpiIds ?? selectedKpiIds(project);
    case "AV-L04": return activeStudy(project)?.kpiSettings[item.instanceKey ?? ""]?.weight ?? project.kpis.find((kpi) => kpi.id === item.instanceKey)?.weight ?? 1;
    case "AV-L05": { const setting = activeStudy(project)?.kpiSettings[item.instanceKey ?? ""], kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey); return { weight: setting?.weight ?? kpi?.weight ?? 1, optimizationDirection: setting?.optimizationDirection ?? kpi?.optimizationDirection ?? "minimize", minimum: setting?.threshold?.minimum, maximum: setting?.threshold?.maximum, thresholdMode: setting?.threshold?.mode ?? "warning" }; }
    case "AV-L06": return activeConfigurations(project).filter((configuration) => derivationStatus(project, configuration) === "Current" && latestConfiguredRun(project, configuration.id)).length >= 2;
    case "AV-L07": return { execute: true, resultId: activeStudy(project)?.results.at(-1)?.id };
    case "AV-L08": return Boolean(activeStudy(project)?.results.length);
    case "AV-L09": { const study = activeStudy(project), decision = project.decisions.find((candidate) => candidate.supportingComparisonStudyIds.includes(study?.id ?? "")), selected = study?.alternativeRefs.find((alternative) => alternative.label === decision?.selectedAlternative), result = study?.results.at(-1); return selected?.id ?? (result?.recommendedAlternativeIds?.length === 1 ? result.recommendedAlternativeIds[0] : ""); }
    case "AV-L10": { const decision = project.decisions.find((candidate) => candidate.supportingComparisonStudyIds.includes(activeStudy(project)?.id ?? "")); return { rationale: decision?.rationale ?? "", owner: decision?.owner ?? "", status: decision?.status === "approved" ? "approved" : "proposed", decisionDate: decision?.decisionDate ?? new Date().toISOString().slice(0, 10), baselineApprovalConfirmed: decision?.baselineApprovalConfirmed ?? false }; }
    case "AV-M02": case "AV-M03": case "AV-M04": case "AV-M05": case "AV-M06": return false;
    case "AV-B05": case "AV-C05": case "AV-D10": case "AV-T06": case "AV-E04": case "AV-F06": case "AV-G12": case "AV-H04": case "AV-J09": return sessionOf(project)?.reviewedSectionIds.includes(item.sectionId) ?? false;
    default: return "";
  }
}

/**
 * Builds review evidence for an already-complete canonical model without replaying
 * Architect mutations. Only values that pass the question's own validation are
 * recorded, so loading a worked example cannot create duplicate model content or
 * make derivations and simulation evidence stale.
 */
export function withCanonicalArchitectAnswers(source: Project, now = source.updatedAt): Project {
  const project = structuredClone(source);
  const session = createArchitectSession(project, now);
  session.id = `canonical-architect-session-${project.id}`;
  session.reviewedSectionIds = Object.keys(labels);
  project.architectSession = session;

  project.elements.filter((element) => element.elementType === "systemRequirement" && element.requirementFormula?.expression.trim()).forEach((requirement) => {
    const match = requirement.requirementFormula?.expression.trim().match(/^@([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|==|!=|<|>|=)\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/);
    if (!match) return;
    const binding = requirement.requirementFormula?.bindings.find((candidate) => candidate.symbol === match[1]);
    const entry = binding?.kind === "parameter" ? allParameters(project).find(({ parameter }) => parameter.id === binding.targetId) : undefined;
    const kpi = binding?.kind === "kpi" ? project.kpis.find((candidate) => candidate.id === binding.targetId) : undefined;
    session.parameterIntents[requirement.id] = {
      id: `canonical-intent-${requirement.id}`,
      requirementId: requirement.id,
      propertyName: entry?.parameter.name ?? kpi?.name ?? match[1].replace(/_/g, " "),
      semanticKey: match[1],
      operator: match[2] as ArchitectParameterIntent["operator"],
      target: Number(match[3]),
      unit: entry?.parameter.unit ?? kpi?.outputUnit ?? "",
      sourceKind: entry ? "existing" : kpi ? "kpi" : "later",
      ownerElementId: entry?.owner.id,
      parameterId: entry?.parameter.id,
      preliminaryValue: typeof entry?.parameter.value === "number" ? entry.parameter.value : kpi?.lastCalculatedValue ?? null,
      valueOrigin: entry?.parameter.valueOrigin,
      source: entry?.parameter.source ?? (kpi ? `Calculated by KPI ${kpi.id}.` : undefined),
      uncertaintyPercent: entry?.parameter.uncertaintyPercent,
      createdAt: now,
      updatedAt: now
    };
  });

  let previousQuestionCount = -1;
  for (let pass = 0; pass < 8; pass += 1) {
    const questions = buildArchitectQuestions(project);
    questions.forEach((question) => {
      if (session.answers[question.key]) return;
      const automaticallyConfirmedKinds = new Set([
        "recap", "kpiReview", "simulationRecap", "configurationRecap", "comparisonRecap", "finalRecap"
      ]);
      const value = automaticallyConfirmedKinds.has(question.inputKind)
        ? true
        : projectedArchitectValue(project, question);
      if (architectQuestionValueError(question, value) !== null) return;
      session.answers[question.key] = {
        key: question.key,
        questionId: question.id,
        instanceKey: question.instanceKey,
        status: "answered",
        value: structuredClone(value),
        generatedElementIds: [],
        generatedRelationshipIds: [],
        generatedParameterIds: [],
        generatedFeatureIds: [],
        generatedVariationPointIds: [],
        generatedConfigurationIds: [],
        generatedStudyIds: [],
        generatedDecisionIds: [],
        sourceModelRevision: project.modelRevision,
        createdAt: now,
        updatedAt: now
      };
    });
    if (questions.length === previousQuestionCount) break;
    previousQuestionCount = questions.length;
  }

  const applicableQuestions = buildArchitectQuestions(project);
  const applicableKeys = new Set(applicableQuestions.map((question) => question.key));
  session.answers = Object.fromEntries(Object.entries(session.answers).filter(([key]) => applicableKeys.has(key)));
  session.currentQuestionKey = applicableQuestions.at(-1)?.key;
  session.updatedAt = now;
  session.sectionStates = sectionStates(project);
  const readiness = architectReadiness(project);
  session.status = readiness.status;
  if (readiness.status === "ready") session.completedAt = now;
  return project;
}

function makeElement(type: ElementType, name: string, answerKey: string, now: string): ModelElement {
  return { id: id(type), elementType: type, name, description: "", status: "draft", architectureScope: "common", parameters: [], customAttributeValues: {}, tags: [type], metadata: { creationOrigin: "architect", architectAnswerKey: answerKey, source: "Architect view" }, createdAt: now, updatedAt: now };
}
function ensureElement(project: Project, type: ElementType, name: string, answerKey: string, now: string, generated: string[]) {
  const existing = project.elements.find((x) => x.elementType === type && norm(x.name) === norm(name));
  if (existing) return existing; const created = makeElement(type, name, answerKey, now); project.elements.push(created); generated.push(created.id); return created;
}
function ensureRelationship(project: Project, sourceId: string, relationshipType: RelationshipType, targetId: string, answerKey: string, now: string, generated: string[], sequenceId?: string, patch: Partial<Relationship> = {}) {
  const existing = project.relationships.find((x) => x.sourceId === sourceId && x.targetId === targetId && x.relationshipType === relationshipType);
  if (existing) { Object.assign(existing, patch, { updatedAt: now }); return existing; }
  const created: Relationship = { id: id("relationship"), sourceId, targetId, relationshipType, sequenceId, creationOrigin: "architect", architectAnswerKey: answerKey, createdAt: now, updatedAt: now, ...patch };
  project.relationships.push(created); generated.push(created.id); return created;
}
function removeElementMutable(project: Project, elementId: string) {
  const removedParameterIds = new Set(project.elements.find((element) => element.id === elementId)?.parameters.map((parameter) => parameter.id) ?? []);
  project.elements = project.elements.filter((element) => element.id !== elementId).map((element) => ({
    ...element,
    requirementFormula: element.requirementFormula ? { ...element.requirementFormula, bindings: element.requirementFormula.bindings.filter((binding) => !removedParameterIds.has(binding.targetId)) } : undefined,
    parameters: element.parameters.map((parameter) => parameter.calculation ? { ...parameter, calculation: { ...parameter.calculation, bindings: parameter.calculation.bindings.filter((binding) => !removedParameterIds.has(binding.targetId)) } } : parameter)
  }));
  project.relationships = project.relationships.filter((relationship) => relationship.sourceId !== elementId && relationship.targetId !== elementId);
  project.selectedUseCaseIds = project.selectedUseCaseIds.filter((idValue) => idValue !== elementId);
  project.kpis = project.kpis.map((kpi) => ({ ...kpi, objectiveIds: kpi.objectiveIds.filter((idValue) => idValue !== elementId), needIds: (kpi.needIds ?? []).filter((idValue) => idValue !== elementId) }));
  project.comparisonStudies = project.comparisonStudies.map((study) => ({ ...study, needIds: (study.needIds ?? []).filter((idValue) => idValue !== elementId), objectiveIds: study.objectiveIds.filter((idValue) => idValue !== elementId), useCaseIds: (study.useCaseIds ?? []).filter((idValue) => idValue !== elementId), mandatoryRequirementIds: study.mandatoryRequirementIds.filter((idValue) => idValue !== elementId) }));
}
function removeAnswersForInstances(session: ArchitectSession, removedIds: Set<string>) {
  Object.entries(session.answers).forEach(([key, answer]) => {
    const instanceKey = answer.instanceKey;
    if (instanceKey && [...removedIds].some((removedId) => instanceKey === removedId || instanceKey.startsWith(`${removedId}|`) || instanceKey.endsWith(`|${removedId}`))) delete session.answers[key];
  });
}
function removeExclusiveIntentAndRequirements(project: Project, session: ArchitectSession, stakeholderId: string) {
  const intentIds = project.relationships.filter((relationship) => relationship.sourceId === stakeholderId && ["hasNeed", "hasObjective"].includes(relationship.relationshipType)).map((relationship) => relationship.targetId);
  removeElementMutable(project, stakeholderId);
  const removed = new Set([stakeholderId]);
  intentIds.forEach((intentId) => {
    const stillOwned = project.relationships.some((relationship) => relationship.targetId === intentId && ["hasNeed", "hasObjective"].includes(relationship.relationshipType));
    if (stillOwned) return;
    const requirementIds = project.relationships.filter((relationship) => relationship.sourceId === intentId && relationship.relationshipType === "derives").map((relationship) => relationship.targetId);
    removeElementMutable(project, intentId); removed.add(intentId);
    requirementIds.forEach((requirementId) => {
      const stillDerived = project.relationships.some((relationship) => relationship.targetId === requirementId && relationship.relationshipType === "derives");
      if (!stillDerived) { removeElementMutable(project, requirementId); removed.add(requirementId); delete session.parameterIntents[requirementId]; }
    });
  });
  removeAnswersForInstances(session, removed);
}
function setSequence(project: Project, domain: "product" | "process", useCaseId: string, functionIds: string[], answerKey: string, now: string, generated: string[]) {
  let sequence = project.functionSequences.find((x) => x.domain === domain && x.useCaseIds.includes(useCaseId));
  if (!sequence) { sequence = { id: id("sequence"), name: `${project.elements.find((x) => x.id === useCaseId)?.name ?? "Use case"} ${domain} sequence`, description: "Created by Architect view.", domain, useCaseIds: [useCaseId], functionIds: [], relationshipIds: [], createdAt: now, updatedAt: now }; project.functionSequences.push(sequence); }
  project.relationships = project.relationships.filter((x) => x.sequenceId !== sequence!.id); sequence.functionIds = [...new Set(functionIds)]; sequence.relationshipIds = []; sequence.updatedAt = now;
  for (let i = 0; i < sequence.functionIds.length - 1; i += 1) sequence.relationshipIds.push(ensureRelationship(project, sequence.functionIds[i], "precedes", sequence.functionIds[i + 1], answerKey, now, generated, sequence.id).id);
}
function addFunctions(project: Project, names: string[], type: "productFunction" | "processFunction", useCaseId: string, answerKey: string, now: string, ge: string[], gr: string[]) {
  const items = names.map((name) => ensureElement(project, type, name, answerKey, now, ge)); items.forEach((x) => ensureRelationship(project, useCaseId, "hasFunction", x.id, answerKey, now, gr)); setSequence(project, type === "productFunction" ? "product" : "process", useCaseId, items.map((x) => x.id), answerKey, now, gr);
}

function bindParameter(project: Project, requirementId: string, parameterId: string, answerKey: string, now: string, generated: string[]) {
  const req = project.elements.find((x) => x.id === requirementId && x.elementType === "systemRequirement");
  const owner = project.elements.find((x) => x.parameters.some((p) => p.id === parameterId)); const parameter = owner?.parameters.find((p) => p.id === parameterId);
  if (!req || !owner || !parameter || !eligibleOwners.includes(owner.elementType)) return;
  const formula = req.requirementFormula ?? { expression: "", bindings: [] };
  if (!formula.bindings.some((b) => b.kind === "parameter" && b.targetId === parameterId)) {
    const base = parameter.semanticKey || parameter.name.toLowerCase().replace(/\W+/g, "_") || "parameter"; let symbol = base, n = 2;
    while (formula.bindings.some((b) => b.symbol === symbol)) symbol = `${base}_${n++}`;
    req.requirementFormula = { ...formula, bindings: [...formula.bindings, { id: id("binding"), symbol, kind: "parameter", targetId: parameterId }] };
  }
  ensureRelationship(project, req.id, "satisfiedBy", owner.id, answerKey, now, generated);
}
function ensureIntentParameter(project: Project, session: ArchitectSession, requirementId: string, ownerId: string, answerKey: string, now: string, gp: string[], gr: string[]) {
  const intent = session.parameterIntents[requirementId], owner = project.elements.find((x) => x.id === ownerId && eligibleOwners.includes(x.elementType)); if (!intent || !owner) return;
  let parameter: Parameter | undefined;
  if (intent.parameterId) {
    const oldOwner = project.elements.find((x) => x.parameters.some((p) => p.id === intent.parameterId)); parameter = oldOwner?.parameters.find((p) => p.id === intent.parameterId);
    if (oldOwner && oldOwner.id !== owner.id && parameter) { oldOwner.parameters = oldOwner.parameters.filter((p) => p.id !== parameter!.id); parameter.ownerElementId = owner.id; owner.parameters.push(parameter); }
  }
  if (!parameter) parameter = owner.parameters.find((candidate) =>
    candidate.dataType === "number"
    && candidate.semanticKey === intent.semanticKey
    && norm(candidate.name) === norm(intent.propertyName)
  );
  if (!parameter) { parameter = { id: id("parameter"), ownerElementId: owner.id, name: intent.propertyName, semanticKey: intent.semanticKey, description: "Architect requirement property.", dataType: "number", value: intent.preliminaryValue ?? null, unit: intent.unit, source: intent.source, valueOrigin: intent.valueOrigin ?? "entered", uncertaintyPercent: intent.uncertaintyPercent, applicableConfigurationIds: [], creationOrigin: "architect", architectAnswerKey: answerKey }; owner.parameters.push(parameter); gp.push(parameter.id); }
  intent.ownerElementId = owner.id; intent.parameterId = parameter.id; intent.updatedAt = now;
  const req = project.elements.find((x) => x.id === requirementId); if (req) req.requirementFormula = { expression: `@${intent.semanticKey} ${intent.operator} ${intent.target}`, bindings: req.requirementFormula?.bindings.filter((b) => b.kind !== "parameter" || b.targetId === parameter!.id) ?? [] };
  bindParameter(project, requirementId, parameter.id, answerKey, now, gr);
}
function updateIntentValue(project: Project, session: ArchitectSession, requirementId: string, value: EngineeringValue, now: string) {
  const intent = session.parameterIntents[requirementId]; if (!intent) return;
  intent.preliminaryValue = value.value === null || value.value === undefined ? null : Number(value.value); intent.unit = String(value.unit ?? intent.unit).trim(); intent.source = String(value.source ?? "").trim() || undefined; intent.valueOrigin = value.valueOrigin ?? "entered"; intent.uncertaintyPercent = value.uncertaintyPercent === undefined ? undefined : Number(value.uncertaintyPercent); intent.updatedAt = now;
  const owner = project.elements.find((x) => x.id === intent.ownerElementId), parameter = owner?.parameters.find((p) => p.id === intent.parameterId);
  if (parameter) Object.assign(parameter, { value: intent.preliminaryValue, unit: intent.unit, source: intent.source, valueOrigin: intent.valueOrigin, uncertaintyPercent: intent.uncertaintyPercent, minimum: value.minimum, maximum: value.maximum });
}
function applyVerification(project: Project, requirementId: string, value: VerificationValue, key: string, now: string, ge: string[], gr: string[]) {
  const reqName = project.elements.find((x) => x.id === requirementId)?.name ?? "requirement"; const name = String(value.name ?? "").trim() || `${value.category ?? "analysis"} for ${reqName}`;
  const method = ensureElement(project, "verificationMethod", name, key, now, ge); method.description = String(value.description ?? "").trim(); method.metadata = { ...method.metadata, verificationCategory: value.category ?? "analysis" };
  ensureRelationship(project, method.id, "verifies", requirementId, key, now, gr); if (value.allocatedProcessFunctionId) ensureRelationship(project, method.id, "allocatedTo", value.allocatedProcessFunctionId, key, now, gr);
}
function applyInteraction(project: Project, ownerId: string, value: InteractionValue, type: "productInterface" | "processInterface", key: string, now: string, ge: string[], gr: string[]) {
  if (!value.counterpartId || !String(value.interfaceName ?? "").trim()) return; const iface = ensureElement(project, type, String(value.interfaceName).trim(), key, now, ge); iface.description = String(value.exchangedItem ?? "").trim(); ensureRelationship(project, ownerId, "connects", iface.id, key, now, gr); ensureRelationship(project, value.counterpartId, "connects", iface.id, key, now, gr);
}
function sectionStates(project: Project): Record<string, ArchitectSectionState> {
  const states: Record<string, ArchitectSectionState> = {}, questions = buildArchitectQuestions(project), answers = sessionOf(project)?.answers ?? {};
  Object.keys(labels).forEach((sectionId) => { const items = questions.filter((x) => x.sectionId === sectionId); if (!items.length) return; const answered = items.filter((x) => answers[x.key]?.status === "answered").length; const review = items.some((x) => answers[x.key]?.status === "needsReview"); const missing = items.some((x) => x.required && !architectAnswerComplete(x, answers[x.key])); const recap = recapIds[sectionId]; const reviewed = !recap || project.architectSession?.reviewedSectionIds.includes(sectionId); states[sectionId] = review ? "reviewNeeded" : !answered ? "notStarted" : missing ? "inProgress" : reviewed ? "complete" : "inProgress"; }); return states;
}

export function applyArchitectAnswer(source: Project, item: ArchitectQuestion, value: unknown, status: ArchitectAnswerStatus = "answered", now = new Date().toISOString()): ArchitectMutationResult {
  const project = structuredClone(source); const session = project.architectSession ? { ...project.architectSession, parameterIntents: project.architectSession.parameterIntents ?? {} } : createArchitectSession(project, now); project.architectSession = session;
  const previous = session.answers[item.key], changed = previous && JSON.stringify(previous.value) !== JSON.stringify(value); const ge: string[] = [], gr: string[] = [], gp: string[] = [], gf: string[] = [], gvp: string[] = [], gc: string[] = [], gs: string[] = [], gd: string[] = []; let storedValue = value, storedStatus = status;
  if (changed) { Object.values(session.answers).forEach((answer) => { if (answer.key !== item.key && answer.status === "answered") answer.status = "needsReview"; }); session.status = "outOfDate"; session.reviewedSectionIds = session.reviewedSectionIds.filter((x) => x === item.sectionId); }
  if (status === "answered") {
    if (item.id === "AV-A01") project.description = String(value).trim();
    if (item.id === "AV-A02") project.overallScope = value as OverallScope;
    if (item.id === "AV-A03" && String(value).trim()) project.name = String(value).trim();
    if (item.id === "AV-A04") { const text = String(value).trim(), current = ofType(project, "mission")[0]; if (current) Object.assign(current, { name: text, description: text, updatedAt: now }); else if (text) ensureElement(project, "mission", text, item.key, now, ge).description = text; }
    if (item.id === "AV-B01") {
      const mission = ofType(project, "mission")[0], names = splitArchitectList(value), wanted = new Set(names.map(norm));
      ofType(project, "stakeholder").filter((stakeholder) => !wanted.has(norm(stakeholder.name))).forEach((stakeholder) => removeExclusiveIntentAndRequirements(project, session, stakeholder.id));
      names.forEach((name) => { const stakeholder = ensureElement(project, "stakeholder", name, item.key, now, ge); if (mission) ensureRelationship(project, mission.id, "hasStakeholder", stakeholder.id, item.key, now, gr); });
      if (!ofType(project, "system").length) {
        const systemAnswer = session.answers[architectAnswerKey("AV-A05")]; if (systemAnswer) systemAnswer.status = "needsReview";
      }
    }
    if (item.id === "AV-A05") { const existing = ofType(project, "system")[0]; const system = existing ?? ensureElement(project, "system", String(value).trim(), item.key, now, ge); system.name = String(value).trim(); system.metadata.isSystemOfInterest = true; const mission = ofType(project, "mission")[0]; if (mission) ensureRelationship(project, mission.id, "hasSOI", system.id, item.key, now, gr); project.elements.filter((x) => x.elementType === "useCase").forEach((x) => { x.metadata.subjectSystemId ??= system.id; }); }
    if (item.id === "AV-B06") {
      const mission = ofType(project, "mission")[0], names = splitArchitectList(value), wanted = new Set(names.map(norm));
      ofType(project, "externalSystem").filter((external) => external.metadata.creationOrigin === "architect" && !wanted.has(norm(external.name))).forEach((external) => { removeElementMutable(project, external.id); removeAnswersForInstances(session, new Set([external.id])); });
      names.forEach((name) => { const external = ensureElement(project, "externalSystem", name, item.key, now, ge); if (mission) ensureRelationship(project, mission.id, "participatesInMission", external.id, item.key, now, gr); });
    }
    if (item.id === "AV-B07" && item.instanceKey) { const external = project.elements.find((x) => x.id === item.instanceKey && x.elementType === "externalSystem"); if (external) Object.assign(external, { description: String(value).trim(), updatedAt: now }); }
    if (item.id === "AV-B02" && item.instanceKey) { const stakeholder = project.elements.find((x) => x.id === item.instanceKey); if (stakeholder) Object.assign(stakeholder, { description: String(value).trim(), updatedAt: now }); }
    if ((item.id === "AV-B03" || item.id === "AV-B04") && item.instanceKey) {
      const type = item.id === "AV-B03" ? "need" : "objective", relation = item.id === "AV-B03" ? "hasNeed" : "hasObjective", names = splitArchitectList(value), wanted = new Set(names.map(norm));
      const existingTargets = targets(project, item.instanceKey, relation, type);
      project.relationships = project.relationships.filter((relationship) => !(relationship.sourceId === item.instanceKey && relationship.relationshipType === relation && existingTargets.some((target) => target.id === relationship.targetId) && !wanted.has(norm(project.elements.find((element) => element.id === relationship.targetId)?.name ?? ""))));
      existingTargets.filter((target) => !wanted.has(norm(target.name)) && !project.relationships.some((relationship) => relationship.targetId === target.id && ["hasNeed", "hasObjective"].includes(relationship.relationshipType))).forEach((target) => removeElementMutable(project, target.id));
      names.forEach((name) => { const target = ensureElement(project, type, name, item.key, now, ge); ensureRelationship(project, item.instanceKey!, relation, target.id, item.key, now, gr); });
    }
    if (item.id === "AV-C01") splitArchitectList(value).forEach((name) => { const uc = ensureElement(project, "useCase", name, item.key, now, ge); uc.metadata.subjectSystemId = ofType(project, "system")[0]?.id; });
    if (item.id === "AV-C02" && item.instanceKey) {
      const stakeholderIds = new Set(splitArchitectList(value));
      project.relationships = project.relationships.filter((relationship) => !(relationship.targetId === item.instanceKey && relationship.relationshipType === "involvedIn" && !stakeholderIds.has(relationship.sourceId)));
      stakeholderIds.forEach((sid) => ensureRelationship(project, sid, "involvedIn", item.instanceKey!, item.key, now, gr));
      const systemId = ofType(project, "system")[0]?.id;
      if (systemId) { const uc = project.elements.find((x) => x.id === item.instanceKey); if (uc) uc.metadata.subjectSystemId = systemId; }
    }
    if (item.id === "AV-C03" && item.instanceKey) {
      const addressedIds = new Set(splitArchitectList(value));
      project.relationships = project.relationships.filter((relationship) => !(relationship.sourceId === item.instanceKey && relationship.relationshipType === "addresses" && !addressedIds.has(relationship.targetId)));
      addressedIds.forEach((targetId) => {
        if (project.elements.some((element) => element.id === targetId && ["need", "objective"].includes(element.elementType))) ensureRelationship(project, item.instanceKey!, "addresses", targetId, item.key, now, gr);
      });
    }
    if (item.id === "AV-C04") project.selectedUseCaseIds = splitArchitectList(value);
    if (item.id === "AV-D01" && item.instanceKey) splitArchitectList(value).forEach((name) => { const req = ensureElement(project, "systemRequirement", name, item.key, now, ge); ensureRelationship(project, item.instanceKey!, "derives", req.id, item.key, now, gr); });
    if (item.id === "AV-D02" && item.instanceKey) { const data = value as { selectedIds?: unknown; newItems?: unknown }; splitArchitectList(data.selectedIds).forEach((rid) => ensureRelationship(project, item.instanceKey!, "derives", rid, item.key, now, gr)); splitArchitectList(data.newItems).forEach((name) => { const req = ensureElement(project, "systemRequirement", name, item.key, now, ge); ensureRelationship(project, item.instanceKey!, "derives", req.id, item.key, now, gr); }); }
    if (item.id === "AV-D05" && item.instanceKey) {
      const data = value as QuantitativeValue, semanticKey = String(data.semanticKey ?? data.propertyName ?? "property").trim().replace(/\W+/g, "_").replace(/^([^A-Za-z_])/, "_$1").toLowerCase(), old = session.parameterIntents[item.instanceKey];
      session.parameterIntents[item.instanceKey] = { id: old?.id ?? id("parameter-intent"), requirementId: item.instanceKey, propertyName: String(data.propertyName ?? "").trim(), semanticKey, operator: data.operator ?? "<=", target: Number(data.target), unit: String(data.unit ?? "").trim(), sourceKind: old?.sourceKind, ownerElementId: old?.ownerElementId, parameterId: old?.parameterId, preliminaryValue: old?.preliminaryValue, valueOrigin: old?.valueOrigin, source: old?.source, uncertaintyPercent: old?.uncertaintyPercent, createdAt: old?.createdAt ?? now, updatedAt: now };
      const req = project.elements.find((x) => x.id === item.instanceKey); if (req) req.requirementFormula = { expression: `@${semanticKey} ${data.operator ?? "<="} ${Number(data.target)}`, bindings: req.requirementFormula?.bindings ?? [] };
    }
    if (item.id === "AV-D06" && item.instanceKey) { const data = value as PropertySourceValue, intent = session.parameterIntents[item.instanceKey]; if (intent) { intent.sourceKind = data.sourceKind ?? "later"; intent.updatedAt = now; if (data.sourceKind === "existing" && data.ownerElementId) ensureIntentParameter(project, session, item.instanceKey, data.ownerElementId, item.key, now, gp, gr); } }
    if (["AV-D07", "AV-F04", "AV-G05B"].includes(item.id) && item.instanceKey) updateIntentValue(project, session, item.instanceKey, value as EngineeringValue, now);
    if ((item.id === "AV-D08" || item.id === "AV-H01") && item.instanceKey) applyVerification(project, item.instanceKey, value as VerificationValue, item.key, now, ge, gr);
    if (item.id === "AV-D09" && item.instanceKey) { const req = project.elements.find((x) => x.id === item.instanceKey); if (req) req.metadata = { ...req.metadata, requirementClass: value as "mandatory" | "important" | "desirable", priority: value === "mandatory" ? "critical" : value === "important" ? "high" : "low" }; }
    if (item.id === "AV-E01" && item.instanceKey) addFunctions(project, splitArchitectList(value), "productFunction", item.instanceKey, item.key, now, ge, gr);
    if (item.id === "AV-G01" && item.instanceKey) addFunctions(project, splitArchitectList(value), "processFunction", item.instanceKey, item.key, now, ge, gr);
    if ((item.id === "AV-E02" || item.id === "AV-G02") && item.instanceKey) setSequence(project, item.id === "AV-E02" ? "product" : "process", item.instanceKey, splitArchitectList(value), item.key, now, gr);
    if (["AV-E03", "AV-F02", "AV-G03", "AV-G05"].includes(item.id) && item.instanceKey) splitArchitectList(value).forEach((rid) => ensureRelationship(project, rid, "satisfiedBy", item.instanceKey!, item.key, now, gr));
    if (item.id === "AV-F01" && item.instanceKey) splitArchitectList(value).forEach((name) => { const c = ensureElement(project, "productComponent", name, item.key, now, ge); ensureRelationship(project, item.instanceKey!, "realizedBy", c.id, item.key, now, gr); });
    if (item.id === "AV-G04" && item.instanceKey) splitArchitectList(value).forEach((name) => { const c = ensureElement(project, "industrialSystemComponent", name, item.key, now, ge); ensureRelationship(project, item.instanceKey!, "realizedBy", c.id, item.key, now, gr); });
    if ((item.id === "AV-F03" || item.id === "AV-G05A") && item.instanceKey && value !== "pending") ensureIntentParameter(project, session, item.instanceKey, String(value), item.key, now, gp, gr);
    if (item.id === "AV-F05" && item.instanceKey) applyInteraction(project, item.instanceKey, value as InteractionValue, "productInterface", item.key, now, ge, gr);
    if (item.id === "AV-G11" && item.instanceKey) applyInteraction(project, item.instanceKey, value as InteractionValue, "processInterface", item.key, now, ge, gr);
    if (item.id === "AV-G06" && item.instanceKey) {
      const data = value as DurationValue, owner = project.elements.find((x) => x.id === item.instanceKey); if (owner) { owner.metadata = { ...owner.metadata, duration: Number(data.duration), durationUnit: data.durationUnit ?? "minute", source: String(data.source ?? "").trim() || owner.metadata.source }; let p = owner.parameters.find((x) => x.semanticKey === "duration"); if (!p) { p = { id: id("parameter"), ownerElementId: owner.id, name: "Authoritative process duration", semanticKey: "duration", description: "Used by lead-time calculations.", dataType: "number", value: Number(data.duration), unit: data.durationUnit ?? "minute", source: String(data.source ?? "").trim() || undefined, valueOrigin: data.valueOrigin ?? "entered", uncertaintyPercent: data.uncertaintyPercent, applicableConfigurationIds: [], creationOrigin: "architect", architectAnswerKey: item.key }; owner.parameters.push(p); gp.push(p.id); } else Object.assign(p, { value: Number(data.duration), unit: data.durationUnit ?? "minute", source: String(data.source ?? "").trim() || undefined, valueOrigin: data.valueOrigin ?? "entered", uncertaintyPercent: data.uncertaintyPercent }); }
    }
    if ((item.id === "AV-G07" || item.id === "AV-G08") && item.instanceKey && Array.isArray(value)) value.forEach((raw) => { const flow = raw as { componentId?: unknown; quantity?: unknown; unit?: unknown; itemFlowName?: unknown }, quantity = Number(flow.quantity), unit = String(flow.unit ?? "").trim(); if (flow.componentId && Number.isFinite(quantity) && quantity > 0 && unit) ensureRelationship(project, item.instanceKey!, item.id === "AV-G07" ? "consumes" : "produces", String(flow.componentId), item.key, now, gr, undefined, { quantity, unit, itemFlowName: String(flow.itemFlowName ?? "").trim() || undefined }); });
    if (item.id === "AV-G09" && item.instanceKey) splitArchitectList(value).forEach((name) => { const r = ensureElement(project, "resource", name, item.key, now, ge); ensureRelationship(project, item.instanceKey!, "requiresResource", r.id, item.key, now, gr, undefined, { requiredQuantity: 1, unit: "item" }); });
    if (item.id === "AV-G10" && item.instanceKey) { const [cid, rid] = item.instanceKey.split("|"), data = value as ResourceDetailValue, resource = project.elements.find((x) => x.id === rid); if (resource) resource.metadata = { ...resource.metadata, resourceType: data.resourceType ?? "tool", hourlyRate: data.hourlyRate === undefined ? undefined : Number(data.hourlyRate), costUnit: String(data.costUnit ?? "").trim() || undefined, capacityHours: data.capacityHours === undefined ? undefined : Number(data.capacityHours), availabilityPercent: data.availabilityPercent === undefined ? undefined : Number(data.availabilityPercent) }; ensureRelationship(project, cid, "requiresResource", rid, item.key, now, gr, undefined, { requiredQuantity: Number(data.quantity), unit: String(data.unit ?? "").trim() }); }
    if (item.id === "AV-H02" && item.instanceKey) splitArchitectList(value).forEach((targetId) => { if (project.elements.some((x) => x.id === targetId && eligibleOwners.includes(x.elementType))) ensureRelationship(project, item.instanceKey!, "satisfiedBy", targetId, item.key, now, gr); else bindParameter(project, item.instanceKey!, targetId, item.key, now, gr); });
    if (item.id === "AV-H03" && item.instanceKey) recordRequirementReview(project, item.instanceKey, value as "met" | "notMet" | "assumed" | "notChecked");
    if (item.id === "AV-T01") { let study = activeStudy(project); if (!study) { study = createArchitectStudy(project, String(value).trim(), now); gs.push(study.id); } else Object.assign(study, { name: String(value).trim(), updatedAt: now, settingsUpdatedAt: now }); }
    if (item.id === "AV-T02") { const study = activeStudy(project) ?? createArchitectStudy(project, `${project.name} Trade Study`, now); study.question = String(value).trim(); study.updatedAt = now; const open = project.openDecisions.find((decision) => decision.id === study.originatingOpenDecisionId); if (open) Object.assign(open, { question: study.question, description: study.intendedOutcome, status: "open" }); }
    if (item.id === "AV-T05") storedValue = (Array.isArray(value) ? value : []).map((raw, index) => { const candidate = raw as NamedItem; return { id: candidate.id || `concept-${index + 1}-${safeSlug(String(candidate.name ?? "alternative"))}`, name: String(candidate.name ?? "").trim(), description: String(candidate.description ?? "").trim() }; }).filter((candidate) => candidate.name);
    if (item.id === "AV-J01") {
      const data = value as RootFeatureValue; let root = rootFeature(project); if (!root) { root = { id: id("feature-root"), name: String(data.name ?? "").trim(), description: String(data.description ?? "").trim(), featureType: "root", sortOrder: 0, valueType: "boolean", allowedValues: [], defaultValue: false, variabilityScope: "external" }; project.features.push(root); gf.push(root.id); } else Object.assign(root, { name: String(data.name ?? "").trim(), description: String(data.description ?? "").trim(), featureType: "root", parentId: undefined, groupId: undefined }); const study = activeStudy(project); if (study) { study.rootFeatureId = root.id; study.exploredFeatureIds = [...new Set([...study.exploredFeatureIds, root.id])]; study.updatedAt = now; }
    }
    if (item.id === "AV-J02") { const root = rootFeature(project); if (root) splitArchitectList(value).forEach((name, index) => { const featureId = `architect-feature-common-${safeSlug(name)}`, existing = project.features.find((feature) => feature.id === featureId); if (existing) Object.assign(existing, { name, description: "Common content confirmed by Architect view.", parentId: root.id, featureType: "mandatory", sortOrder: index + 1 }); else { project.features.push({ id: featureId, name, description: "Common content confirmed by Architect view.", parentId: root.id, featureType: "mandatory", sortOrder: index + 1, valueType: "boolean", allowedValues: [], defaultValue: true, variabilityScope: "external" }); gf.push(featureId); } }); }
    if (item.id === "AV-J03" && item.instanceKey) {
      const data = value as AxisDefinitionValue, root = rootFeature(project), axisName = tradeAxisIntents(project).find((name) => safeSlug(name) === item.instanceKey) ?? item.instanceKey;
      if (root) { const groupId = `architect-feature-group-${item.instanceKey}`, axisId = `architect-axis-${item.instanceKey}`; let group = project.featureGroups.find((candidate) => candidate.id === groupId); if (!group) project.featureGroups.push(group = { id: groupId, name: axisName, description: "Architect variability axis.", parentFeatureId: root.id, sortOrder: project.featureGroups.length }); else Object.assign(group, { name: axisName, parentFeatureId: root.id }); let axis = project.variabilityAxes.find((candidate) => candidate.id === axisId); if (!axis) project.variabilityAxes.push(axis = { id: axisId, name: axisName, description: "Created from trade framing.", featureGroupId: group.id, createdAt: now, updatedAt: now }); else Object.assign(axis, { name: axisName, featureGroupId: group.id, updatedAt: now });
        const choices = splitArchitectList(data.choices), desired = new Set<string>();
        if (data.mode === "typed") { const featureId = `architect-feature-${item.instanceKey}-value`; desired.add(featureId); const existing = project.features.find((feature) => feature.id === featureId), allowedValues = choices; if (existing) Object.assign(existing, { name: axisName, parentId: root.id, parentGroupId: group.id, featureType: "optional", valueType: "enumeration", allowedValues, defaultValue: allowedValues[0] ?? "" }); else { project.features.push({ id: featureId, name: axisName, description: `Typed value for ${axisName}.`, parentId: root.id, parentGroupId: group.id, featureType: "optional", sortOrder: 0, valueType: "enumeration", allowedValues, defaultValue: allowedValues[0] ?? "", variabilityScope: "external" }); gf.push(featureId); } }
        else choices.forEach((choice, index) => { const featureId = `architect-feature-${item.instanceKey}-${safeSlug(choice)}`; desired.add(featureId); const featureType: Feature["featureType"] = data.mode === "or" ? "or" : data.mode === "optional" ? "optional" : "xor", existing = project.features.find((feature) => feature.id === featureId), patch = { name: choice, parentId: root.id, parentGroupId: group.id, featureType, groupId: featureType === "xor" || featureType === "or" ? group.id : undefined, sortOrder: index, valueType: "boolean" as const, allowedValues: [], defaultValue: false, variabilityScope: "external" as const }; if (existing) Object.assign(existing, patch); else { project.features.push({ id: featureId, description: `${axisName} choice.`, ...patch }); gf.push(featureId); } });
        project.features = project.features.filter((feature) => feature.parentGroupId !== group.id || desired.has(feature.id)); const study = activeStudy(project); if (study) { study.selectedVariabilityAxisIds = [...new Set([...(study.selectedVariabilityAxisIds ?? []), axis.id])]; study.exploredFeatureIds = [...new Set([...study.exploredFeatureIds, ...desired])]; study.updatedAt = now; }
      }
    }
    if (item.id === "AV-J04" && item.instanceKey) { const axis = project.variabilityAxes.find((candidate) => safeSlug(candidate.name) === item.instanceKey), feature = project.features.find((candidate) => candidate.parentGroupId === axis?.featureGroupId && candidate.valueType === "enumeration"), values = splitArchitectList(value); if (feature) Object.assign(feature, { allowedValues: values, defaultValue: values[0] ?? "" }); }
    if (item.id === "AV-J05" && Array.isArray(value)) (value as ConstraintValue[]).forEach((constraint) => { if (!constraint.sourceFeatureId || !constraint.targetFeatureId || constraint.sourceFeatureId === constraint.targetFeatureId || !constraint.type) return; if (!project.featureConstraints.some((candidate) => candidate.type === constraint.type && candidate.sourceFeatureId === constraint.sourceFeatureId && candidate.targetFeatureId === constraint.targetFeatureId)) project.featureConstraints.push({ id: id("constraint"), type: constraint.type, sourceFeatureId: constraint.sourceFeatureId, targetFeatureId: constraint.targetFeatureId }); });
    if (item.id === "AV-J06" && Array.isArray(value)) (value as ElementApplicabilityValue).forEach((mapping) => { if (!mapping.elementId || !mapping.featureId) return; const vpId = `architect-vp-existence-${mapping.elementId}`, element = project.elements.find((candidate) => candidate.id === mapping.elementId), existing = project.variationPoints.find((candidate) => candidate.id === vpId), patch = { name: `${element?.name ?? mapping.elementId} applicability`, description: "Element existence mapped by Architect view.", kind: "existence" as const, constrainedElementIds: [mapping.elementId], constrainedRelationshipIds: [], featureExpression: mapping.featureId, featureValueConditions: [], valueRules: [], enabled: true, updatedAt: now }; if (existing) Object.assign(existing, patch); else { project.variationPoints.push({ id: vpId, createdAt: now, ...patch }); gvp.push(vpId); } });
    if (item.id === "AV-J07" && Array.isArray(value)) (value as PropertyVariationValue).forEach((mapping) => { if (!mapping.elementId || !mapping.parameterId || !mapping.featureId || mapping.value === undefined) return; const vpId = `architect-vp-parameter-${mapping.parameterId}`, element = project.elements.find((candidate) => candidate.id === mapping.elementId), existing = project.variationPoints.find((candidate) => candidate.id === vpId), patch = { name: `${element?.name ?? mapping.elementId} parameter variation`, description: "Parameter value mapped by Architect view.", kind: "primitiveProperty" as const, constrainedElementIds: [mapping.elementId], constrainedRelationshipIds: [], featureExpression: "", featureValueConditions: [], propertyPath: `parameter:${mapping.parameterId}:value`, valueRules: [{ id: `${vpId}-rule`, featureExpression: mapping.featureId, featureValueConditions: [], value: mapping.value }], scope: mapping.scope, enabled: true, updatedAt: now }; if (existing) Object.assign(existing, patch); else { project.variationPoints.push({ id: vpId, createdAt: now, ...patch }); gvp.push(vpId); } });
    if (item.id === "AV-J08" && item.instanceKey) { const variationPoint = project.variationPoints.find((candidate) => candidate.id === item.instanceKey), scopes = splitArchitectList(value) as VariationScope[]; if (variationPoint) { variationPoint.realizationScopes = scopes; variationPoint.scope = scopes.length === 1 ? scopes[0] : undefined; variationPoint.updatedAt = now; } }
    if (item.id === "AV-K01" && item.instanceKey) {
      const data = value as ConfigurationValue;
      let configuration = configurationForIntent(project, item.instanceKey);
      const configurationId = configuration?.id ?? `architect-configuration-${item.instanceKey}`;
      const architectureId = configuration?.architectureId ?? `architect-architecture-${item.instanceKey}`;
      const draft: Configuration = applySelectionToConfiguration({ id: configurationId, name: String(data.name ?? "Alternative").trim(), architectureId, manuallySelectedFeatureIds: splitArchitectList(data.selectedFeatureIds), automaticConstraintFeatureIds: splitArchitectList(data.automaticConstraintFeatureIds), effectiveSelectedFeatureIds: [], autoSelectedFeatureIds: [], featureValues: structuredClone(data.featureValues ?? {}), realizationScopes: [], validationStatus: "notValidated", validationMessages: [], derivedElementIds: [], excludedElementIds: [], createdAt: configuration?.createdAt ?? now, updatedAt: now }, project.features, project.featureConstraints);
      const checked = configurationWithValidation(project, draft); if (configuration) Object.assign(configuration, checked); else { project.configurations.push(checked); gc.push(checked.id); }
      let architecture = project.architectures.find((candidate) => candidate.id === architectureId); if (!architecture) project.architectures.push(architecture = { id: architectureId, name: checked.name, description: "Configuration-owned 100% architecture.", status: checked.validationStatus === "valid" ? "candidate" : "invalid", configurationId: checked.id, createdAt: now, updatedAt: now }); else Object.assign(architecture, { name: checked.name, status: checked.validationStatus === "valid" ? "candidate" : "invalid", configurationId: checked.id, updatedAt: now });
      const study = activeStudy(project); if (study) { const candidateId = `architect-candidate-${item.instanceKey}`, reference = { id: candidateId, label: checked.name, configurationId: checked.id, architectureId: architecture.id }; study.candidateRefs = [...study.candidateRefs.filter((candidate) => candidate.id !== candidateId), reference]; study.status = "definingCandidates"; study.updatedAt = now; }
    }
    if (item.id === "AV-K02" && item.instanceKey && value === "automatic") {
      const configuration = project.configurations.find((candidate) => candidate.id === item.instanceKey); if (configuration) { const selected = new Set(configuration.effectiveSelectedFeatureIds), required = project.featureConstraints.filter((constraint) => constraint.type === "requires" && selected.has(constraint.sourceFeatureId)).map((constraint) => constraint.targetFeatureId); const corrected = configurationWithValidation(project, applySelectionToConfiguration({ ...configuration, automaticConstraintFeatureIds: [...new Set([...configuration.automaticConstraintFeatureIds, ...required])], updatedAt: now }, project.features, project.featureConstraints)); Object.assign(configuration, corrected); const architecture = project.architectures.find((candidate) => candidate.id === configuration.architectureId); if (architecture) architecture.status = corrected.validationStatus === "valid" ? "candidate" : "invalid"; }
    }
    if (item.id === "AV-K04" && item.instanceKey) { const configuration = project.configurations.find((candidate) => candidate.id === item.instanceKey), attempt = configuration ? deriveConfiguration(project, configuration) : undefined; if (attempt?.result) { project.configurations = project.configurations.map((candidate) => candidate.id === item.instanceKey ? attempt.configuration : candidate); const architecture = project.architectures.find((candidate) => candidate.id === attempt.configuration.architectureId); if (architecture) Object.assign(architecture, { status: "realized", updatedAt: now }); } else { storedStatus = "invalid"; storedValue = { execute: true, errors: attempt?.errors ?? ["Configuration not found."] }; } }
    if (item.id === "AV-K06" && item.instanceKey) {
      const configuration = project.configurations.find((candidate) => candidate.id === item.instanceKey), data = value as SimulationRunValue;
      const attempt = configuration ? runSimulation(project, { name: String(data.name ?? "").trim(), mode: "configured", configurationId: configuration.id, selectedKpiIds: selectedKpiIds(project), selectedAlgorithmKeys: [] }) : undefined;
      if (attempt?.run) project.simulationRuns.push(attempt.run); else { storedStatus = "invalid"; storedValue = { ...data, execute: true, errors: attempt?.errors?.length ? attempt.errors : ["Resolve the reported inputs before running this configuration."] }; }
    }
    if (item.id === "AV-S03") {
      const data = value as SimulationRunValue, study = activeStudy(project), candidateConfigurationIds = new Set(study?.candidateRefs.map((candidate) => candidate.configurationId) ?? []);
      const configurations = activeConfigurations(project).filter((configuration) => candidateConfigurationIds.has(configuration.id) && configuration.validationStatus === "valid" && !validateConfiguration(project, configuration).some((finding) => finding.severity === "error") && derivationStatus(project, configuration) === "Current");
      const baseName = String(data.name ?? "").trim(), attempts = configurations.map((configuration) => ({ configuration, attempt: runSimulation(project, { name: `${baseName} — ${configuration.name}`, mode: "configured", configurationId: configuration.id, selectedKpiIds: selectedKpiIds(project), selectedAlgorithmKeys: [] }) }));
      const errors = attempts.flatMap(({ configuration, attempt }) => attempt.errors.map((error) => `${configuration.name}: ${error}`));
      if ((study?.candidateRefs.length ?? 0) >= 2 && configurations.length === study?.candidateRefs.length && attempts.every(({ attempt }) => Boolean(attempt.run))) project.simulationRuns.push(...attempts.flatMap(({ attempt }) => attempt.run ? [attempt.run] : []));
      else { storedStatus = "invalid"; storedValue = { ...data, execute: true, errors: errors.length ? errors : ["Derive at least two valid current 100% architectures before running the comparison simulations."] }; }
    }
    if (item.id === "AV-L01") { const study = activeStudy(project), runIds = splitArchitectList(value); if (study) { study.alternativeRefs = runIds.flatMap((runId) => { const run = project.simulationRuns.find((candidate) => candidate.id === runId), configuration = project.configurations.find((candidate) => candidate.id === run?.configurationId); return run && configuration ? [{ id: `alternative-${configuration.id}`, label: configuration.name, architectureId: configuration.architectureId, configurationId: configuration.id, simulationRunId: run.id }] : []; }); study.status = "collectingEvidence"; study.updatedAt = now; study.settingsUpdatedAt = now; } }
    if (item.id === "AV-L02") { const study = activeStudy(project); if (study) { study.baselineRequirementIds = baselineRequirementIds(project, study); study.updatedAt = now; } }
    if (item.id === "AV-L03") { const study = activeStudy(project), kpiIds = splitArchitectList(value); if (study) { study.selectedKpiIds = kpiIds; study.kpiSettings = Object.fromEntries(kpiIds.map((kpiId) => { const existing = study.kpiSettings[kpiId], kpi = project.kpis.find((candidate) => candidate.id === kpiId); return [kpiId, existing ?? { weight: kpi?.weight ?? 1, optimizationDirection: kpi?.optimizationDirection ?? "minimize" }]; })); study.criteria = kpiIds.map((kpiId) => { const kpi = project.kpis.find((candidate) => candidate.id === kpiId)!; return { id: `criterion-${kpiId}`, name: kpi.name, description: kpi.description, type: "optimization" as const, sourceObjectiveIds: [...kpi.objectiveIds], sourceRequirementIds: [], kpiId, weight: study.kpiSettings[kpiId].weight, valueFunction: study.kpiSettings[kpiId].optimizationDirection }; }); study.updatedAt = now; study.settingsUpdatedAt = now; } }
    if (item.id === "AV-L04" && item.instanceKey) { const study = activeStudy(project), setting = study?.kpiSettings[item.instanceKey]; if (study && setting) { setting.weight = Number(value); const criterion = study.criteria.find((candidate) => candidate.kpiId === item.instanceKey); if (criterion) criterion.weight = Number(value); study.updatedAt = now; study.settingsUpdatedAt = now; } }
    if (item.id === "AV-L05" && item.instanceKey) { const data = value as ComparisonSettingValue, study = activeStudy(project), setting = study?.kpiSettings[item.instanceKey]; if (study && setting) { setting.optimizationDirection = data.optimizationDirection ?? "minimize"; setting.threshold = data.minimum === undefined && data.maximum === undefined ? undefined : { minimum: data.minimum === undefined ? undefined : Number(data.minimum), maximum: data.maximum === undefined ? undefined : Number(data.maximum), mode: data.thresholdMode ?? "warning" }; const criterion = study.criteria.find((candidate) => candidate.kpiId === item.instanceKey); if (criterion) criterion.valueFunction = setting.optimizationDirection; study.updatedAt = now; study.settingsUpdatedAt = now; } }
    if (item.id === "AV-L07") { const study = activeStudy(project), attempt = study ? architectComparisonAttempt(project, study, now) : undefined; if (study && attempt?.result) { study.results.push(attempt.result); study.status = "analyzed"; study.updatedAt = now; storedValue = { execute: true, resultId: attempt.result.id }; } else { storedStatus = "invalid"; storedValue = { execute: true, errors: attempt?.errors ?? ["Trade Study not found."] }; } }
    if (item.id === "AV-L09") {
      const study = activeStudy(project), result = study?.results.at(-1), alternative = study?.alternativeRefs.find((candidate) => candidate.id === value);
      if (study && result && alternative) { let decision = project.decisions.find((candidate) => candidate.supportingComparisonStudyIds.includes(study.id)); if (!decision) { decision = { id: id("decision"), question: study.question, alternatives: study.alternativeRefs.map((candidate) => candidate.label), criteria: study.selectedKpiIds.map((kpiId) => project.kpis.find((kpi) => kpi.id === kpiId)?.name ?? kpiId), selectedAlternative: alternative.label, supportingSimulationRunIds: study.alternativeRefs.map((candidate) => candidate.simulationRunId), supportingComparisonStudyIds: [study.id], assumptions: [], risks: [], openActions: result.thresholdViolations.map((violation) => violation.message), status: "proposed", createdAt: now, updatedAt: now }; project.decisions.push(decision); gd.push(decision.id); } else Object.assign(decision, { selectedAlternative: alternative.label, status: "proposed", updatedAt: now }); const open = project.openDecisions.find((candidate) => candidate.id === study.originatingOpenDecisionId); if (open) Object.assign(open, { linkedFormalDecisionId: decision.id, status: "inReview" }); }
    }
    if (item.id === "AV-L10") {
      const data = value as DecisionDetailsValue, study = activeStudy(project), decision = project.decisions.find((candidate) => candidate.supportingComparisonStudyIds.includes(study?.id ?? "")); if (study && decision) { Object.assign(decision, { rationale: String(data.rationale ?? "").trim(), owner: String(data.owner ?? "").trim(), decisionDate: data.decisionDate, baselineApprovalConfirmed: data.baselineApprovalConfirmed === true, status: data.status ?? "proposed", updatedAt: now }); if (decision.status === "approved" && decision.baselineApprovalConfirmed) { const alternative = study.alternativeRefs.find((candidate) => candidate.label === decision.selectedAlternative); if (alternative) { project.baselineArchitectureId = alternative.architectureId; project.architectures.forEach((architecture) => { if (architecture.id === alternative.architectureId) architecture.status = "baseline"; else if (architecture.status === "baseline") architecture.status = "candidate"; }); study.status = "decided"; const open = project.openDecisions.find((candidate) => candidate.id === study.originatingOpenDecisionId); if (open) open.status = "closed"; } } }
    }
    if (item.id === "AV-I01") splitArchitectList(value).forEach((kpiId) => {
      if (project.kpis.some((kpi) => kpi.id === kpiId)) return;
      const definition = standardKpiCatalog.find((entry) => architectKpiId(entry.key) === kpiId); if (!definition) return;
      project.kpis.push({ id: kpiId, name: definition.name, description: definition.detail, objectiveIds: [], calculationMode: "standardAlgorithm", standardAlgorithmKey: definition.key, outputUnit: definition.unit, optimizationDirection: definition.direction, weight: 1, inputParameterIds: [], dependsOnKpiIds: [], calculationWarnings: [], createdAt: now, updatedAt: now });
    });
    if (item.id === "AV-I02" && item.instanceKey) {
      const selected = splitArchitectList(value), needIds = new Set(ofType(project, "need").map((need) => need.id)), objectiveIds = new Set(ofType(project, "objective").map((objective) => objective.id)), kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey);
      if (kpi) Object.assign(kpi, { needIds: selected.filter((idValue) => needIds.has(idValue)), objectiveIds: selected.filter((idValue) => objectiveIds.has(idValue)), updatedAt: now });
    }
    if (item.id === "AV-I03" && item.instanceKey) { const kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey); if (kpi) { kpi.calculationMode = value as "formula" | "standardAlgorithm"; if (value === "formula") { kpi.standardAlgorithmKey = undefined; kpi.formula ??= ""; } kpi.updatedAt = now; } }
    if (item.id === "AV-I05" && item.instanceKey) {
      const formula = String(value).trim(), kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey);
      if (kpi) { const refs = formulaReferences(parseKpiFormula(formula)); Object.assign(kpi, { calculationMode: "formula", formula, standardAlgorithmKey: undefined, inputParameterIds: refs.parameterIds, dependsOnKpiIds: refs.kpiIds, updatedAt: now }); }
    }
    if (item.id === "AV-I06" && item.instanceKey) { const data = value as KpiDefinitionValue, kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey); if (kpi) Object.assign(kpi, { outputUnit: String(data.outputUnit ?? "").trim(), optimizationDirection: data.optimizationDirection ?? kpi.optimizationDirection, targetValue: data.targetValue === undefined ? undefined : Number(data.targetValue), minimumThreshold: data.minimumThreshold === undefined ? undefined : Number(data.minimumThreshold), maximumThreshold: data.maximumThreshold === undefined ? undefined : Number(data.maximumThreshold), updatedAt: now }); }
    if (item.id === "AV-I07" && item.instanceKey) { const kpi = project.kpis.find((candidate) => candidate.id === item.instanceKey); if (kpi) Object.assign(kpi, { weight: Number(value), updatedAt: now }); }
    if (item.id === "AV-I08" && item.instanceKey) {
      const [, input] = item.instanceKey.split("|"); const data = value as AnalysisInputValue;
      if (input.startsWith("parameter:")) {
        const parameterId = input.slice("parameter:".length), parameter = allParameters(project).find((entry) => entry.parameter.id === parameterId)?.parameter;
        if (parameter) Object.assign(parameter, { value: data.value === null || data.value === undefined ? null : Number(data.value), unit: String(data.unit ?? parameter.unit ?? "").trim(), source: String(data.source ?? "").trim() || undefined, valueOrigin: data.valueOrigin ?? "entered", uncertaintyPercent: data.uncertaintyPercent === undefined ? undefined : Number(data.uncertaintyPercent), minimum: data.minimum, maximum: data.maximum });
      } else if (input.startsWith("semantic:")) {
        const semanticKey = String(data.semanticKey ?? input.slice("semantic:".length)).trim(), rows = data.owners?.length ? data.owners : data.ownerElementId ? [data] : [], selectedOwnerIds = new Set(rows.map((row) => row.ownerElementId).filter(Boolean));
        project.elements.forEach((owner) => { owner.parameters = owner.parameters.filter((parameter) => !(parameter.semanticKey === semanticKey && parameter.architectAnswerKey === item.key && !selectedOwnerIds.has(owner.id))); });
        rows.forEach((row) => {
          const owner = project.elements.find((element) => element.id === row.ownerElementId); if (!owner) return;
          let parameter = owner.parameters.find((candidate) => candidate.semanticKey === semanticKey);
          if (!parameter) { parameter = { id: id("parameter"), ownerElementId: owner.id, name: String(data.propertyName ?? semanticKey).trim(), semanticKey, description: "Engineering input created by the Architect analysis path.", dataType: "number", value: null, unit: String(row.unit ?? "").trim(), valueOrigin: row.valueOrigin ?? "entered", applicableConfigurationIds: [], creationOrigin: "architect", architectAnswerKey: item.key }; owner.parameters.push(parameter); gp.push(parameter.id); }
          Object.assign(parameter, { value: row.value === null || row.value === undefined ? null : Number(row.value), unit: String(row.unit ?? parameter.unit ?? "").trim(), source: String(row.source ?? "").trim() || undefined, valueOrigin: row.valueOrigin ?? "entered", uncertaintyPercent: row.uncertaintyPercent === undefined ? undefined : Number(row.uncertaintyPercent), minimum: row.minimum, maximum: row.maximum });
        });
      }
    }
    if (item.id === "AV-I11") {
      const data = value as SimulationRunValue;
      let architectureId = project.activeArchitectureId ?? project.baselineArchitectureId ?? project.architectures.find((architecture) => !architecture.archivedAt)?.id;
      if (!architectureId) { architectureId = `architect-architecture-${project.id}`; project.architectures.push({ id: architectureId, name: `${project.name} architecture`, description: "Canonical architecture created by Architect view.", status: "draft", createdAt: now, updatedAt: now }); }
      project.activeArchitectureId = architectureId;
      const request: SimulationRequest = { name: String(data.name ?? "").trim(), mode: "architectureOnly", architectureId, selectedKpiIds: selectedKpiIds(project), selectedAlgorithmKeys: [] };
      const attempt = runSimulation({ ...project, modelRevision: source.modelRevision }, request);
      if (attempt.run) project.simulationRuns.push(attempt.run);
      else { storedStatus = "invalid"; storedValue = { ...data, execute: true, errors: attempt.errors.length ? attempt.errors : attempt.warnings }; }
    }
    if (["recap", "simulationRecap", "configurationRecap", "comparisonRecap", "finalRecap"].includes(item.inputKind) && value === true && !session.reviewedSectionIds.includes(item.sectionId)) session.reviewedSectionIds.push(item.sectionId);
  }
  const answer: ArchitectAnswer = { key: item.key, questionId: item.id, instanceKey: item.instanceKey, status: storedStatus, value: storedValue, generatedElementIds: [...new Set([...(previous?.generatedElementIds ?? []), ...ge])], generatedRelationshipIds: [...new Set([...(previous?.generatedRelationshipIds ?? []), ...gr])], generatedParameterIds: [...new Set([...(previous?.generatedParameterIds ?? []), ...gp])], generatedFeatureIds: [...new Set([...(previous?.generatedFeatureIds ?? []), ...gf])], generatedVariationPointIds: [...new Set([...(previous?.generatedVariationPointIds ?? []), ...gvp])], generatedConfigurationIds: [...new Set([...(previous?.generatedConfigurationIds ?? []), ...gc])], generatedStudyIds: [...new Set([...(previous?.generatedStudyIds ?? []), ...gs])], generatedDecisionIds: [...new Set([...(previous?.generatedDecisionIds ?? []), ...gd])], sourceModelRevision: source.modelRevision, createdAt: previous?.createdAt ?? now, updatedAt: now };
  session.answers[item.key] = answer; session.currentQuestionKey = item.key; session.updatedAt = now; project.updatedAt = now; session.sectionStates = sectionStates(project); const readiness = architectReadiness(project); session.status = changed ? "outOfDate" : readiness.status; if (session.status === "ready") session.completedAt = now; return { project, answer };
}

export function architectQuestionValueError(question: ArchitectQuestion, value: unknown): string | null {
  if (question.inputKind === "flow" && Array.isArray(value) && value.some((raw) => { const x = raw as { componentId?: unknown; quantity?: unknown; unit?: unknown }; return !x.componentId || !Number.isFinite(Number(x.quantity)) || Number(x.quantity) <= 0 || !String(x.unit ?? "").trim(); })) return "Every selected product flow needs a positive quantity and a unit.";
  if (question.inputKind === "quantitative") { const x = value as QuantitativeValue; if (!String(x.propertyName ?? "").trim()) return "Enter the measured property."; if (!String(x.semanticKey ?? "").trim()) return "Enter a semantic key."; if (!["<", "<=", ">", ">=", "=", "==", "!="].includes(String(x.operator))) return "Select a supported operator."; if (!Number.isFinite(Number(x.target))) return "Enter a finite target."; if (!String(x.unit ?? "").trim()) return "Enter the target unit."; }
  if (question.inputKind === "propertySource") { const x = value as PropertySourceValue; if (!x.sourceKind) return "Select the property source."; if (x.sourceKind === "existing" && !x.ownerElementId) return "Select the existing owner."; }
  if (question.inputKind === "engineeringValue") { const x = value as EngineeringValue; if (x.value !== null && x.value !== undefined && !Number.isFinite(Number(x.value))) return "The engineering value must be finite or blank."; if (x.value !== null && x.value !== undefined && !String(x.unit ?? "").trim()) return "A numeric value needs a unit."; if (x.uncertaintyPercent !== undefined && (Number(x.uncertaintyPercent) < 0 || Number(x.uncertaintyPercent) > 100)) return "Uncertainty must be 0–100%."; }
  if (question.inputKind === "duration") { const x = value as DurationValue; if (!Number.isFinite(Number(x.duration)) || Number(x.duration) <= 0) return "Enter a positive duration."; if (!x.durationUnit) return "Select a duration unit."; }
  if (question.inputKind === "resourceDetail") { const x = value as ResourceDetailValue; if (!Number.isFinite(Number(x.quantity)) || Number(x.quantity) <= 0) return "Enter a positive resource quantity."; if (!String(x.unit ?? "").trim()) return "Enter the quantity unit."; if (x.availabilityPercent !== undefined && (Number(x.availabilityPercent) < 0 || Number(x.availabilityPercent) > 100)) return "Availability must be 0–100%."; }
  if (question.inputKind === "verification") { const x = value as VerificationValue; if (!x.category || !String(x.name ?? "").trim()) return "Select a category and enter a verification method name."; }
  if (question.inputKind === "interaction") { const x = value as InteractionValue, started = Boolean(x.counterpartId || String(x.interfaceName ?? "").trim() || String(x.exchangedItem ?? "").trim()); if (started && (!x.counterpartId || !String(x.interfaceName ?? "").trim())) return "Select a counterpart and name the interface, or leave all fields blank."; }
  if (question.inputKind === "analysisInput") { const x = value as AnalysisInputValue, rows = x.owners?.length ? x.owners : x.ownerElementId ? [x] : []; if (!rows.length) return "Select at least one authoritative function or technical component."; for (const row of rows) { if (!row.ownerElementId) return "Every input needs an authoritative owner."; if (!Number.isFinite(Number(row.value))) return "Enter a finite engineering value for every owner."; if (!String(row.unit ?? "").trim()) return "Enter the unit for every owner."; if (!String(row.source ?? "").trim()) return "Enter the engineering source for every owner."; if (!row.valueOrigin) return "Select the value origin for every owner."; if (row.uncertaintyPercent !== undefined && (Number(row.uncertaintyPercent) < 0 || Number(row.uncertaintyPercent) > 100)) return "Uncertainty must be 0–100%."; } }
  if (question.inputKind === "kpiReview") return value === true ? null : "Review and confirm this calculation evidence.";
  if (question.inputKind === "kpiFormula") { try { parseKpiFormula(String(value ?? "")); } catch (error) { return error instanceof Error ? error.message : "Enter a valid KPI formula."; } }
  if (question.inputKind === "kpiDefinition") { const x = value as KpiDefinitionValue; if (!String(x.outputUnit ?? "").trim()) return "Enter the KPI output unit."; if (question.sectionId !== "analysis" && !x.optimizationDirection) return "Select minimize or maximize."; for (const numeric of [x.targetValue, x.minimumThreshold, x.maximumThreshold]) if (numeric !== undefined && !Number.isFinite(Number(numeric))) return "Targets and thresholds must be finite numbers."; if (x.minimumThreshold !== undefined && x.maximumThreshold !== undefined && Number(x.minimumThreshold) > Number(x.maximumThreshold)) return "The minimum threshold cannot exceed the maximum threshold."; }
  if (question.inputKind === "number" && (!Number.isFinite(Number(value)) || Number(value) < 0)) return "Enter a non-negative number.";
  if (question.inputKind === "simulationRun") { const x = value as SimulationRunValue; if (!String(x.name ?? "").trim()) return "Enter a run name."; if (x.execute !== true) return "Confirm that the analysis should run."; }
  if (question.inputKind === "simulationRecap") return value === true ? null : "Review and confirm the current simulation evidence.";
  if (question.inputKind === "namedItems") { const items = Array.isArray(value) ? value as NamedItem[] : []; if (items.filter((item) => String(item.name ?? "").trim()).length < 2) return "Enter at least two named alternative concepts."; }
  if (question.inputKind === "rootFeature") { const x = value as RootFeatureValue; if (!String(x.name ?? "").trim()) return "Enter the configurable-family name."; }
  if (question.inputKind === "axisDefinition") { const x = value as AxisDefinitionValue; if (!x.mode) return "Select the choice rule."; const minimumChoices = x.mode === "typed" || x.mode === "optional" ? 1 : 2; if (splitArchitectList(x.choices).length < minimumChoices) return minimumChoices === 1 ? "Enter at least one choice." : "Enter at least two choices."; }
  if (question.inputKind === "constraintList" && Array.isArray(value) && value.some((raw) => { const x = raw as ConstraintValue; return !x.type || !x.sourceFeatureId || !x.targetFeatureId || x.sourceFeatureId === x.targetFeatureId; })) return "Every constraint needs a type and two different feature choices.";
  if (question.inputKind === "elementApplicability" && Array.isArray(value) && value.some((raw) => { const x = raw as { elementId?: string; featureId?: string }; return !x.elementId || !x.featureId; })) return "Every applicability mapping needs one model element and one feature choice.";
  if (question.inputKind === "propertyVariation" && Array.isArray(value) && value.some((raw) => { const x = raw as PropertyVariationValue[number]; return !x.elementId || !x.parameterId || !x.featureId || x.value === undefined || x.value === ""; })) return "Every property variation needs an element, parameter, feature choice and value.";
  if (question.inputKind === "configuration") { const x = value as ConfigurationValue; if (!String(x.name ?? "").trim()) return "Enter the alternative name."; }
  if (question.inputKind === "derivation") { const x = value as { execute?: boolean }; if (x.execute !== true) return "Confirm that the 100% architecture should be derived."; }
  if (question.inputKind === "configurationRecap" || question.inputKind === "comparisonRecap" || question.inputKind === "finalRecap") return value === true ? null : "Review and confirm this evidence.";
  if (question.inputKind === "comparisonSetting") { const x = value as ComparisonSettingValue; if (!x.optimizationDirection) return "Select minimize or maximize."; for (const numeric of [x.minimum, x.maximum]) if (numeric !== undefined && !Number.isFinite(Number(numeric))) return "Threshold values must be finite."; if (x.minimum !== undefined && x.maximum !== undefined && Number(x.minimum) > Number(x.maximum)) return "Minimum threshold cannot exceed maximum threshold."; }
  if (question.inputKind === "comparisonRun") { const x = value as { execute?: boolean }; if (x.execute !== true) return "Confirm that the comparison should run."; }
  if (question.inputKind === "decisionDetails") { const x = value as DecisionDetailsValue; if (!String(x.rationale ?? "").trim()) return "Enter the engineering rationale."; if (!String(x.owner ?? "").trim()) return "Enter the decision owner."; if (!x.status) return "Select proposed or approved."; if (x.status === "approved" && x.baselineApprovalConfirmed !== true) return "Explicitly confirm baseline approval before approving the decision."; }
  if (!question.required) return null; if (Array.isArray(value)) return value.length ? null : "This answer is required for Ready status."; if (question.inputKind === "recap") return value === true ? null : "Review and confirm this section.";
  if (question.inputKind === "existingAndNew") { const x = value as { selectedIds?: unknown; newItems?: unknown }; return splitArchitectList(x.selectedIds).length || splitArchitectList(x.newItems).length ? null : "Select or enter at least one requirement."; }
  return String(value ?? "").trim() ? null : "This answer is required for Ready status.";
}
export function architectAnswerComplete(question: ArchitectQuestion, answer?: ArchitectAnswer) { return Boolean(answer && answer.status === "answered" && (!question.required || architectQuestionValueError(question, answer.value) === null)); }

export function architectReadiness(project: Project): ArchitectReadiness {
  const findings: ArchitectReadinessFinding[] = [], block = (idValue: string, message: string, questionKey?: string) => findings.push({ id: idValue, severity: "blocking" as const, message, questionKey }), warn = (idValue: string, message: string, questionKey?: string) => findings.push({ id: idValue, severity: "warning" as const, message, questionKey });
  const session = sessionOf(project), questions = buildArchitectQuestions(project); if (!session) block("AVR-001", "Start the Architect questionnaire.", "AV-A02");
  questions.forEach((item) => { if (item.required && !architectAnswerComplete(item, session?.answers[item.key])) block(`AVR-answer-${item.key}`, `Required answer is incomplete: ${item.prompt}`, item.key); });
  if (ofType(project, "mission").length !== 1) block("AVR-002", "Define exactly one mission.", "AV-A04"); if (!ofType(project, "system").length) block("AVR-003", "Select the system of interest.", "AV-A05"); else if (!project.relationships.some((relationship) => relationship.relationshipType === "hasSOI" && ofType(project, "mission").some((mission) => mission.id === relationship.sourceId) && ofType(project, "system").some((system) => system.id === relationship.targetId))) block("AVR-003A", "Connect the mission to the system of interest with hasSOI.", "AV-A05"); if (!ofType(project, "need").length) block("AVR-004", "Define at least one need."); if (!ofType(project, "objective").length) block("AVR-005", "Define at least one objective.");
  [...ofType(project, "need"), ...ofType(project, "objective")].forEach((x) => { if (!targets(project, x.id, "derives", "systemRequirement").length) block(`AVR-origin-${x.id}`, `“${x.name}” does not derive a requirement.`); });
  if (!project.selectedUseCaseIds.length) block("AVR-006", "Select at least one use case.", "AV-C04");
  const systemId = ofType(project, "system")[0]?.id;
  project.selectedUseCaseIds.forEach((ucid) => { if (systemId && !project.elements.some((uc) => uc.id === ucid && uc.metadata.subjectSystemId === systemId)) block(`AVR-involvement-${ucid}`, "Every selected use case must name the system of interest as its subject.", architectAnswerKey("AV-C02", ucid)); if (![...targets(project, ucid, "hasFunction", "productFunction"), ...targets(project, ucid, "hasFunction", "processFunction")].length) block(`AVR-function-${ucid}`, "Every selected use case needs a product or process function.", architectAnswerKey("AV-E01", ucid)); });
  ofType(project, "productFunction").forEach((x) => { if (!targets(project, x.id, "realizedBy", "productComponent").length) block(`AVR-product-realization-${x.id}`, `Product function “${x.name}” needs a component.`, architectAnswerKey("AV-F01", x.id)); });
  if (!ofType(project, "processFunction").length) block("AVR-007", "Define industrial-system behavior for at least one selected use case.");
  ofType(project, "processFunction").forEach((x, index) => { if (!targets(project, x.id, "realizedBy", "industrialSystemComponent").length) block(`AVR-process-realization-${x.id}`, `Industrial function “${x.name}” needs equipment or a workplace.`, architectAnswerKey("AV-G04", x.id)); if (!targets(project, x.id, "produces", "productComponent").length) block(`AVR-output-${x.id}`, `Industrial function “${x.name}” needs a produced product item.`, architectAnswerKey("AV-G08", x.id)); if (index > 0 && !targets(project, x.id, "consumes", "productComponent").length) warn(`AVR-input-${x.id}`, `Industrial function “${x.name}” has no consumed item.`, architectAnswerKey("AV-G07", x.id)); if (project.overallScope !== "architectureBuilding" && (!x.metadata.duration || !x.metadata.durationUnit)) block(`AVR-duration-${x.id}`, `Industrial function “${x.name}” needs a duration.`, architectAnswerKey("AV-G06", x.id)); });
  ofType(project, "industrialSystemComponent").forEach((x) => { if (!targets(project, x.id, "requiresResource", "resource").length) (project.overallScope === "architectureBuilding" ? warn : block)(`AVR-resource-${x.id}`, `Industrial component “${x.name}” has no required resource.`, architectAnswerKey("AV-G09", x.id)); });
  ofType(project, "systemRequirement").forEach((req) => { if (av<string>(project, "AV-D04", req.id) === "unsure") block(`AVR-kind-${req.id}`, `Decide whether “${req.name}” is quantitative or qualitative.`, architectAnswerKey("AV-D04", req.id)); if (!requirementHasSatisfaction(project, req.id)) block(`AVR-satisfaction-${req.id}`, `Requirement “${req.name}” has no function, component or owned-parameter satisfaction path.`, architectAnswerKey("AV-H02", req.id)); const mandatory = req.metadata.requirementClass === "mandatory" || !req.metadata.requirementClass; if (mandatory && !sources(project, req.id, "verifies", "verificationMethod").length) block(`AVR-verification-${req.id}`, `Mandatory requirement “${req.name}” has no verification method.`, architectAnswerKey("AV-H01", req.id)); const intent = session?.parameterIntents[req.id]; if (intent && intent.sourceKind !== "kpi" && (!intent.ownerElementId || !intent.parameterId)) block(`AVR-parameter-${req.id}`, `Property “${intent.propertyName}” needs an owner.`, architectAnswerKey("AV-G05A", req.id)); if (req.metadata.evidenceReviewStatus === "pending") warn(`AVR-evidence-${req.id}`, `Evidence for “${req.name}” is pending.`, architectAnswerKey("AV-H03", req.id)); });
  if (project.overallScope !== "architectureBuilding") {
    const kpis = selectedKpis(project);
    if (!kpis.length) block("AVR-008", "Select at least one KPI for the analysis.", "AV-I01");
    kpis.forEach((kpi) => {
      if (!kpi.objectiveIds.length && !(kpi.needIds ?? []).length) block(`AVR-kpi-objective-${kpi.id}`, `KPI “${kpi.name}” is not linked to a need or objective.`, architectAnswerKey("AV-I02", kpi.id));
      if (kpi.calculationMode === "formula") { try { parseKpiFormula(kpi.formula ?? ""); } catch { block(`AVR-kpi-formula-${kpi.id}`, `KPI “${kpi.name}” has an invalid formula.`, architectAnswerKey("AV-I05", kpi.id)); } }
      if (project.overallScope === "tradeStudy" && (kpi.weight < 0 || !Number.isFinite(kpi.weight))) block(`AVR-kpi-weight-${kpi.id}`, `KPI “${kpi.name}” has an invalid weight.`, architectAnswerKey("AV-I07", kpi.id));
    });
    if (project.overallScope === "tradeStudy" && kpis.length && !kpis.some((kpi) => kpi.weight > 0)) block("AVR-009", "At least one selected KPI needs a positive comparison weight.", kpis[0] ? architectAnswerKey("AV-I07", kpis[0].id) : "AV-I01");
    if (project.overallScope === "architectureAndSimulation") { const selected = new Set(kpis.map((kpi) => kpi.id)), run = [...project.simulationRuns].reverse().find((candidate) => simulationStatus(project, candidate) === "Current" && candidate.selectedKpiIds.length === selected.size && candidate.selectedKpiIds.every((kpiId) => selected.has(kpiId))); if (!run) block("AVR-010", "Run a successful current simulation for the selected KPI set.", "AV-I11"); }
  }
  if (project.overallScope === "tradeStudy") {
    const study = activeStudy(project);
    if (!study?.question.trim()) block("AVR-011", "State the trade-study decision question.", "AV-T02");
    if (tradeAlternativeIntents(project).length < 2) block("AVR-012", "Define at least two alternative concepts.", "AV-T05");
    if (project.features.filter((feature) => feature.featureType === "root").length !== 1) block("AVR-013", "Define exactly one Root Feature.", "AV-J01");
    if (!project.variabilityAxes.length) block("AVR-014", "Define at least one variability axis.", "AV-J03");
    if (!project.variationPoints.length) warn("AVR-015", "No model content is mapped to variability; derived alternatives may be identical.", "AV-J06");
    const configurations = activeConfigurations(project);
    if (configurations.length < 2) block("AVR-016", "Create at least two alternative configurations.", "AV-K01");
    configurations.forEach((configuration) => {
      if (validateConfiguration(project, configuration).some((finding) => finding.severity === "error")) block(`AVR-config-${configuration.id}`, `Configuration “${configuration.name}” is invalid.`, architectAnswerKey("AV-K01", configuration.id.replace("architect-configuration-", "")));
      if (derivationStatus(project, configuration) !== "Current") block(`AVR-derivation-${configuration.id}`, `Configuration “${configuration.name}” needs a current 100% derivation.`, architectAnswerKey("AV-K04", configuration.id));
      const requiredKpiIds = selectedKpiIds(project), run = latestConfiguredRun(project, configuration.id); if (!run || run.derivationId !== configuration.derivation?.id || !requiredKpiIds.every((kpiId) => run.results.some((result) => result.kpiId === kpiId && typeof result.value === "number" && Number.isFinite(result.value)))) block(`AVR-run-${configuration.id}`, `Configuration “${configuration.name}” needs current simulation evidence for the complete selected KPI set.`, "AV-S03");
    });
    if (!study || study.alternativeRefs.length < 2) block("AVR-017", "Select at least two comparable realized alternatives.", "AV-L01");
    if (study && !ofType(project, "systemRequirement").length) block("AVR-018", "Define baseline requirements.", "AV-L02");
    if (study && !study.selectedKpiIds.length) block("AVR-019", "Select comparison KPIs.", "AV-L03");
    const result = study?.results.at(-1); if (!result || result.inputProjectModelRevision < project.modelRevision || result.settingsUpdatedAt !== study?.settingsUpdatedAt) block("AVR-020", "Run a current comparison using the confirmed settings.", "AV-L07");
    const decision = project.decisions.find((candidate) => candidate.supportingComparisonStudyIds.includes(study?.id ?? "")); if (!decision || decision.status !== "approved" || !decision.baselineApprovalConfirmed || !project.baselineArchitectureId) block("AVR-021", "Approve an explicit baseline decision with rationale and owner.", "AV-L10");
  }
  const needsReview = Object.values(session?.answers ?? {}).some((x) => x.status === "needsReview") || session?.status === "outOfDate", blockingCount = findings.filter((x) => x.severity === "blocking").length, status = needsReview ? "outOfDate" : blockingCount ? "blocked" : "ready"; return { status, findings, blockingCount, warningCount: findings.length - blockingCount };
}
