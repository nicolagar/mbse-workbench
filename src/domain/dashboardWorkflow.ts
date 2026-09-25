import { simulationStatus } from "./simulation";
import { calculateSemanticScope } from "./semanticScope";
import type {
  ElementType,
  ModelTabId,
  OverallScope,
  Project,
  UiPreferences,
  VariabilityTab,
  WorkspaceId
} from "./types";
import { validateConfiguration } from "./variability";

export type DashboardStepStatus = "notStarted" | "inProgress" | "complete" | "blocked";

export interface DashboardActivity {
  label: string;
  workspace: WorkspaceId;
  modelTab?: ModelTabId;
  modelView?: UiPreferences["activeModelView"];
  elementType?: ElementType;
  elementTypes?: ElementType[];
  variabilityTab?: VariabilityTab;
  tradeStudyTab?: UiPreferences["activeTradeStudyTab"];
}

export interface DashboardWorkflowStep {
  id: string;
  label: string;
  description: string;
  status: DashboardStepStatus;
  message: string;
  activities: DashboardActivity[];
}

export interface DashboardWorkflow {
  scope: OverallScope;
  problemSpace: DashboardWorkflowStep[];
  solutionSpace: DashboardWorkflowStep[];
  recommendedStepId?: string;
}

export const scopeLabels: Record<OverallScope, string> = {
  architectureBuilding: "Architecture building",
  architectureAndSimulation: "Architecture building + simulation",
  tradeStudy: "Trade Study"
};

export function inferOverallScope(project: Project): OverallScope {
  if (project.overallScope) return project.overallScope;
  if (project.comparisonStudies.length) return "tradeStudy";
  if (project.simulationRuns.length) return "architectureAndSimulation";
  return "architectureBuilding";
}

function step(
  id: string,
  label: string,
  description: string,
  complete: boolean,
  hasProgress: boolean,
  blocked: boolean,
  message: string,
  activities: DashboardActivity[]
): DashboardWorkflowStep {
  return {
    id,
    label,
    description,
    status: blocked ? "blocked" : complete ? "complete" : hasProgress ? "inProgress" : "notStarted",
    message: blocked ? message : complete ? "Required model evidence is complete." : message,
    activities
  };
}

const activity = (
  label: string,
  workspace: WorkspaceId,
  extra: Omit<DashboardActivity, "label" | "workspace"> = {}
): DashboardActivity => ({ label, workspace, ...extra });

function activeStudy(project: Project) {
  return project.comparisonStudies.find((study) => study.id === project.activeComparisonStudyId)
    ?? project.comparisonStudies[0];
}

function problemSteps(project: Project, scope: OverallScope): DashboardWorkflowStep[] {
  const missions = project.elements.filter((item) => item.elementType === "mission");
  const missionStakeholderIds = new Set(project.relationships
    .filter((relationship) => relationship.relationshipType === "hasStakeholder" && missions.some((mission) => mission.id === relationship.sourceId))
    .map((relationship) => relationship.targetId));
  const missionSoiIds = new Set(project.relationships
    .filter((relationship) => relationship.relationshipType === "hasSOI" && missions.some((mission) => mission.id === relationship.sourceId))
    .map((relationship) => relationship.targetId));
  const externalSystems = project.elements.filter((item) => item.elementType === "externalSystem");
  const missionExternalSystemIds = new Set(project.relationships
    .filter((relationship) => relationship.relationshipType === "participatesInMission" && missions.some((mission) => mission.id === relationship.sourceId))
    .map((relationship) => relationship.targetId));
  const soi = project.elements.filter((item) => item.elementType === "system");
  const needs = project.elements.filter((item) => item.elementType === "need");
  const objectives = project.elements.filter((item) => item.elementType === "objective");
  const externalContextComplete = externalSystems.every((item) => missionExternalSystemIds.has(item.id));
  const intentComplete = missions.length > 0 && missionStakeholderIds.size > 0 && soi.length === 1 && missionSoiIds.has(soi[0].id) && externalContextComplete && needs.length > 0 && objectives.length > 0;
  const intentProgress = missions.length + missionStakeholderIds.size + soi.length + externalSystems.length + needs.length + objectives.length > 0;
  const semanticScope = calculateSemanticScope(project);
  const activeUseCases = semanticScope.workingUseCases.map((item) => item.id);
  const requirements = semanticScope.requirements.map((item) => item.id);
  const scopeComplete = activeUseCases.length > 0 && requirements.length > 0 && semanticScope.invalidUseCaseIds.length === 0;
  const scopeProgress = project.selectedUseCaseIds.length + requirements.length > 0;
  const kpisComplete = project.kpis.length > 0 && project.kpis.every((kpi) =>
    Number.isFinite(kpi.weight) && kpi.weight >= 0 && kpi.objectiveIds.length > 0
  );
  const result = [
    step(
      "define-intent",
      "Define mission, system and intent",
      "Define the mission, its stakeholder context, the system of interest, needs and objectives used by the project.",
      intentComplete,
      intentProgress,
      false,
      !missions.length
        ? "Define at least one mission."
        : !missionStakeholderIds.size
          ? "Connect at least one stakeholder to a mission."
          : soi.length !== 1
            ? "Designate exactly one system of interest."
            : !missionSoiIds.has(soi[0].id)
              ? "Connect the mission to the system of interest with hasSOI."
            : !externalContextComplete
              ? "Connect every external system to the mission it participates in."
            : !needs.length
              ? "Define at least one need."
              : "Define at least one objective.",
      [
        activity("Mission", "model", { modelTab: "mission-context", modelView: "table", elementType: "mission" }),
        activity("System of interest / stakeholders / external entities", "model", { modelTab: "mission-context", modelView: "table", elementTypes: ["system", "stakeholder", "externalSystem"] }),
        activity("Needs", "model", { modelTab: "mission-context", modelView: "table", elementType: "need" }),
        activity("Objectives", "model", { modelTab: "mission-context", modelView: "table", elementType: "objective" })
      ]
    ),
    step(
      "define-scope",
      "Define use-case and requirement scope",
      "Select active use cases and derive requirements from the scoped needs and objectives.",
      scopeComplete,
      scopeProgress,
      !intentComplete,
      !intentComplete
        ? "Complete mission, system and intent first."
        : semanticScope.invalidUseCaseIds.length
          ? "Remove use cases that do not involve the system of interest."
          : !activeUseCases.length
            ? "Select at least one use case involving the system of interest."
            : "Derive at least one requirement from the scoped needs or objectives.",
      [
        activity("Use cases and working scope", "model", { modelTab: "mission-context", modelView: "table", elementType: "useCase" }),
        activity("Requirements", "model", { modelTab: "requirements-validation", modelView: "table", elementType: "systemRequirement" })
      ]
    )
  ];
  if (scope === "architectureAndSimulation") result.push(step(
    "define-kpis",
    "Define evaluation KPIs",
    "Define the KPI formulas, units, global direction and global weight used by simulation and comparison.",
    kpisComplete,
    project.kpis.length > 0,
    !scopeComplete,
    !scopeComplete ? "Complete the use-case and requirement scope first." : "Define at least one objective-linked KPI with a valid global direction and weight.",
    [activity("Parameters and KPIs", "parameters")]
  ));
  if (scope === "tradeStudy") {
    const study = activeStudy(project);
    const needIds = study?.needIds ?? [];
    const objectiveIds = study?.objectiveIds ?? [];
    const useCaseIds = study?.useCaseIds ?? [];
    const activeUseCaseSet = new Set(activeUseCases);
    const selectedAxes = project.variabilityAxes.filter((axis) => study?.selectedVariabilityAxisIds?.includes(axis.id));
    const axesComplete = selectedAxes.length > 0 && selectedAxes.every((axis) =>
      project.featureGroups.some((group) => group.id === axis.featureGroupId && group.parentFeatureId === study?.rootFeatureId)
    );
    const roots = project.features.filter((feature) => feature.featureType === "root");
    const rootComplete = roots.length === 1 && study?.rootFeatureId === roots[0].id;
    const selectedKpis = project.kpis.filter((kpi) => study?.selectedKpiIds.includes(kpi.id));
    const studyKpisComplete = selectedKpis.length > 0
      && selectedKpis.length === (study?.selectedKpiIds.length ?? 0)
      && selectedKpis.every((kpi) =>
        kpi.objectiveIds.some((objectiveId) => objectiveIds.includes(objectiveId))
        && Boolean(kpi.formula?.trim() || kpi.standardAlgorithmKey)
        && Boolean(kpi.outputUnit.trim())
        && Number.isFinite(kpi.weight)
        && kpi.weight >= 0
      )
      && selectedKpis.some((kpi) => kpi.weight > 0);
    const tradeScopeComplete = Boolean(
      study?.name.trim()
      && study.question.trim()
      && needIds.length
      && objectiveIds.length
      && useCaseIds.length
      && useCaseIds.every((id) => activeUseCaseSet.has(id))
      && study.mandatoryRequirementIds.length
      && rootComplete
      && axesComplete
      && studyKpisComplete
    );
    const tradeProgress = Boolean(study || project.variabilityAxes.length || project.kpis.length);
    result.push(step(
      "define-trade-study",
      "Define Trade Study, variability axes and evaluation KPIs",
      "Frame the active Trade Study, select its problem scope, establish the shared Root Feature and reusable variability axes, and define only the KPIs needed for comparison.",
      tradeScopeComplete,
      tradeProgress,
      !scopeComplete,
      !scopeComplete
        ? "Complete the use-case and requirement scope first."
        : !study
          ? "Create and activate a Trade Study."
          : !study.name.trim() || !study.question.trim()
            ? "Enter the Trade Study name and decision question."
            : !needIds.length || !objectiveIds.length || !useCaseIds.length || !study.mandatoryRequirementIds.length
              ? "Select needs, objectives and active use cases with derived requirements."
              : !rootComplete
                ? "Create or link the single project Root Feature."
                : !axesComplete
                  ? "Select at least one valid variability axis and linked FeatureGroup."
                  : "Define and select valid objective-linked KPIs with at least one positive weight.",
      [activity("Guided Trade Study setup", "comparison", { tradeStudyTab: "Framing and Criteria" })]
    ));
  }
  return result;
}

function architectureEvidence(project: Project) {
  const productFunctions = project.elements.filter((item) => item.elementType === "productFunction");
  const processFunctions = project.elements.filter((item) => item.elementType === "processFunction");
  const productComponents = project.elements.filter((item) => item.elementType === "productComponent");
  const industrialComponents = project.elements.filter((item) => item.elementType === "industrialSystemComponent");
  const functions = [...productFunctions, ...processFunctions];
  const technical = [...productComponents, ...industrialComponents];
  const selectedUseCases = new Set(project.selectedUseCaseIds);
  const scopedUseCases = project.elements.filter((item) => item.elementType === "useCase" && selectedUseCases.has(item.id));
  const useCasesHaveFunctionType = (functionType: "productFunction" | "processFunction") => scopedUseCases.some((useCase) =>
    project.relationships.some((relationship) =>
      relationship.sourceId === useCase.id
      && relationship.relationshipType === "hasFunction"
      && project.elements.some((element) => element.id === relationship.targetId && element.elementType === functionType)
    )
  );
  const functionsAreRealized = (domainFunctions: typeof functions, componentType: "productComponent" | "industrialSystemComponent") =>
    domainFunctions.length > 0 && domainFunctions.every((fn) =>
    project.relationships.some((relationship) =>
      relationship.sourceId === fn.id
      && relationship.relationshipType === "realizedBy"
      && project.elements.some((element) => element.id === relationship.targetId && element.elementType === componentType)
    )
  );
  const productFunctionComplete = productFunctions.length > 0 && useCasesHaveFunctionType("productFunction");
  const processFunctionComplete = processFunctions.length > 0 && useCasesHaveFunctionType("processFunction");
  const productTechnicalComplete = productComponents.length > 0 && functionsAreRealized(productFunctions, "productComponent");
  const industrialTechnicalComplete = industrialComponents.length > 0 && functionsAreRealized(processFunctions, "industrialSystemComponent");
  const productArchitectureComplete = productFunctionComplete && productTechnicalComplete;
  const industrialArchitectureComplete = processFunctionComplete && industrialTechnicalComplete;
  const functionComplete = productFunctionComplete && processFunctionComplete && scopedUseCases.every((useCase) => project.relationships.some((edge) => edge.sourceId === useCase.id && edge.relationshipType === "hasFunction" && functions.some((fn) => fn.id === edge.targetId)));
  const technicalComplete = productTechnicalComplete && industrialTechnicalComplete;
  const parameters = project.elements.flatMap((item) => item.parameters);
  const parameterComplete = parameters.length > 0 && parameters.every((parameter) =>
    parameter.dataType !== "number" || parameter.value !== null
  );
  return {
    functions,
    technical,
    productFunctions,
    processFunctions,
    productComponents,
    industrialComponents,
    productArchitectureComplete,
    industrialArchitectureComplete,
    functionComplete,
    technicalComplete,
    parameters,
    parameterComplete
  };
}

function architectureSolution(project: Project, problemComplete: boolean, withSimulation: boolean): DashboardWorkflowStep[] {
  const evidence = architectureEvidence(project);
  const result = [
    step(
      "build-functional-architecture",
      "Build the product functional & technical architecture",
      "Define product functions and allocate them to the product architecture.",
      evidence.productArchitectureComplete,
      evidence.productFunctions.length + evidence.productComponents.length > 0,
      !problemComplete,
      !problemComplete ? "Complete the Problem Space first." : "Connect each selected use case to product functions and allocate every product function to a product component.",
      [
        activity("Product functions", "model", { modelTab: "product-functional", modelView: "graph", elementType: "productFunction" }),
        activity("Product architecture", "model", { modelTab: "product-technical", modelView: "graph", elementType: "productComponent" })
      ]
    ),
    step(
      "build-technical-architecture",
      "Build the industrial system functional & technical architecture",
      "Define industrial system functions and allocate them to the industrial system architecture.",
      evidence.industrialArchitectureComplete,
      evidence.processFunctions.length + evidence.industrialComponents.length > 0,
      !evidence.productArchitectureComplete,
      !evidence.productArchitectureComplete ? "Complete the product functional and technical architecture first." : "Connect each selected use case to industrial system functions and allocate every function to an industrial-system component.",
      [
        activity("Industrial system functions", "model", { modelTab: "process-functional", modelView: "graph", elementType: "processFunction" }),
        activity("Industrial system architecture", "model", { modelTab: "process-technical", modelView: "graph", elementType: "industrialSystemComponent" })
      ]
    )
  ];
  if (withSimulation) {
    result.push(step(
      "complete-parameters",
      "Complete architecture parameters",
      "Provide the architecture values required by the selected KPI formulas.",
      evidence.parameterComplete,
      evidence.parameters.length > 0,
      !evidence.technicalComplete,
      !evidence.technicalComplete ? "Complete the technical architecture first." : "Provide every required numeric parameter value.",
      [activity("Architecture parameters", "parameters")]
    ));
    const currentRuns = project.simulationRuns.filter((run) => simulationStatus(project, run) === "Current");
    result.push(step(
      "simulate-architecture",
      "Simulate architecture",
      "Run the selected KPIs against current architecture data and retain the immutable result.",
      currentRuns.length > 0,
      project.simulationRuns.length > 0,
      !evidence.parameterComplete,
      !evidence.parameterComplete ? "Complete architecture parameters first." : "Run a current architecture simulation.",
      [activity("Simulate architecture", "simulation")]
    ));
  }
  return result;
}

function tradeStudySolution(project: Project, problemComplete: boolean): DashboardWorkflowStep[] {
  const evidence = architectureEvidence(project);
  const rootFeatures = project.features.filter((feature) => feature.featureType === "root");
  const nonRootFeatures = project.features.filter((feature) => feature.featureType !== "root");
  const featureComplete = rootFeatures.length === 1 && nonRootFeatures.length > 0;
  const mappingComplete = project.variationPoints.length > 0;
  const validConfigurations = project.configurations.filter((configuration) =>
    !configuration.archivedAt
    && configuration.validationStatus === "valid"
    && !validateConfiguration(project, configuration).some((finding) => finding.severity === "error")
  );
  const currentDerivations = validConfigurations.filter((configuration) =>
    configuration.derivation?.sourceModelRevision === project.modelRevision
  );
  const study = activeStudy(project);
  const requiredKpiIds = study?.selectedKpiIds ?? [];
  const eligibleRuns = currentDerivations.flatMap((configuration) =>
    [...project.simulationRuns]
      .filter((candidate) =>
        candidate.configurationId === configuration.id
        && candidate.derivationId === configuration.derivation!.id
        && simulationStatus(project, candidate) === "Current"
        && candidate.results.length > 0
        && candidate.results.every((result) => typeof result.value === "number" && Number.isFinite(result.value))
      )
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
  );
  const comparableRuns = requiredKpiIds.length
    ? eligibleRuns.filter((candidate) => requiredKpiIds.every((kpiId) =>
      candidate.results.some((result) => result.kpiId === kpiId)
    ))
    : (() => {
      const groups = new Map<string, typeof eligibleRuns>();
      eligibleRuns.forEach((run) => {
        const key = [...run.results.map((result) => result.kpiId ?? `algorithm:${result.algorithmKey}`)].sort().join("|");
        groups.set(key, [...(groups.get(key) ?? []), run]);
      });
      return [...groups.values()].sort((left, right) => right.length - left.length)[0] ?? [];
    })();
  const currentRuns = [...new Map(comparableRuns.map((run) => [run.configurationId, run])).values()];
  const latestResult = study?.results.at(-1);
  const result = latestResult?.settingsUpdatedAt === study?.settingsUpdatedAt ? latestResult : undefined;
  const decision = study && project.decisions.find((item) =>
    item.status === "approved" && item.supportingComparisonStudyIds.includes(study.id)
  );
  const definitions: Array<Parameters<typeof step>> = [
    ["build-150-architecture", "Build the 150% architecture", "Build the reusable product and industrial-system functional and technical architectures containing the intended solution range.", evidence.functionComplete && evidence.technicalComplete, evidence.functions.length + evidence.technical.length > 0, !problemComplete, !problemComplete ? "Complete the Problem Space first." : "Complete product and industrial-system functional and technical realization links.", [
      activity("Product functions", "model", { modelTab: "product-functional", modelView: "graph", elementType: "productFunction" }),
      activity("Product architecture", "model", { modelTab: "product-technical", modelView: "graph", elementType: "productComponent" }),
      activity("Industrial system functions", "model", { modelTab: "process-functional", modelView: "graph", elementType: "processFunction" }),
      activity("Industrial system architecture", "model", { modelTab: "process-technical", modelView: "graph", elementType: "industrialSystemComponent" })
    ]],
    ["define-feature-model", "Define the feature model and constraints", "Starting from the Root Feature and major FeatureGroups, define selectable features and any constraints needed to make configurations valid.", featureComplete, project.features.length > 0, !(evidence.functionComplete && evidence.technicalComplete), "Create selectable features and resolve every feature-model or constraint error.", [activity("Feature model and constraints", "variability", { variabilityTab: "Feature Model" })]],
    ["map-variability", "Map variability to architecture", "Create variation points that map feature expressions to existing architecture content.", mappingComplete, project.variationPoints.length > 0, !featureComplete, "Create at least one valid variation point after the feature model is complete.", [activity("Variation points", "variability", { variabilityTab: "Variation Points" })]],
    ["create-configurations", "Create valid configurations", "Create and validate at least two feature configurations to serve as alternatives.", validConfigurations.length >= 2, project.configurations.length > 0, !mappingComplete, `Create and validate at least two configurations (${validConfigurations.length}/2 valid).`, [activity("Configurator", "variability", { variabilityTab: "Configurator" })]],
    ["derive-architectures", "Derive 100% architectures", "Derive a current 100% architecture for each valid alternative.", currentDerivations.length >= 2, validConfigurations.some((item) => item.derivation), validConfigurations.length < 2, `Derive at least two current 100% architectures (${currentDerivations.length}/2 current).`, [activity("100% realization", "variability", { variabilityTab: "100% Realization" })]],
    ["simulate-architectures", "Simulate architectures", "Run the same selected KPIs for every derived architecture.", currentRuns.length >= 2, project.simulationRuns.length > 0, currentDerivations.length < 2, `Create current complete simulation runs for at least two architectures (${currentRuns.length}/2 current).`, [activity("Simulate architectures", "simulation")]],
    ["compare-decide", "Compare and decide", "Select configuration-derived alternatives, apply requirement feasibility first, compare KPI scores, then select one feasible alternative and record the rationale.", Boolean(result && decision), Boolean(study?.alternativeRefs.length || result || decision), currentRuns.length < 2, !study ? "Complete Problem Space Step 3 first." : study.alternativeRefs.length < 2 ? "Select at least two configuration-derived alternatives." : !result ? "Run the comparison." : "Select a feasible alternative, enter the rationale and approve the decision.", [
      activity("Select alternatives and compare", "comparison", { tradeStudyTab: "Manager Summary" }),
      activity("Manager comparison", "comparison", { tradeStudyTab: "Manager Summary" }),
      activity("Decision rationale", "comparison", { tradeStudyTab: "Decision Rationale" })
    ]]
  ];
  return definitions.map((definition) => step(...definition));
}

export function dashboardWorkflow(project: Project): DashboardWorkflow {
  const scope = inferOverallScope(project);
  const problemSpace = problemSteps(project, scope);
  const problemComplete = problemSpace.every((item) => item.status === "complete");
  const solutionSpace = scope === "tradeStudy"
    ? tradeStudySolution(project, problemComplete)
    : architectureSolution(project, problemComplete, scope === "architectureAndSimulation");
  const ordered = [...problemSpace, ...solutionSpace];
  return {
    scope,
    problemSpace,
    solutionSpace,
    recommendedStepId: ordered.find((item) => item.status !== "complete")?.id
  };
}
