import { architectureCompatibleModel, deriveConfiguration, derivationStatus } from "./derivation";
import { calculateSelectedKpis, type ActiveModel } from "./presizing";
import type { Configuration, Project, SimulationRun, StandardAlgorithmKey } from "./types";
import { validateConfiguration } from "./variability";

export interface SimulationRequest {
  name: string;
  mode?: "configured" | "architectureOnly";
  configurationId?: string;
  architectureId?: string;
  selectedKpiIds: string[];
  selectedAlgorithmKeys: StandardAlgorithmKey[];
}

export interface SimulationAttempt {
  run?: SimulationRun;
  errors: string[];
  warnings: string[];
  needsRederivation: boolean;
}

function derivedModel(configuration: Configuration): ActiveModel | null {
  const derivation = configuration.derivation;
  if (!derivation) return null;
  if (derivation.realizedElements && derivation.realizedRelationships) {
    return {
      elements: structuredClone(derivation.realizedElements),
      relationships: structuredClone(derivation.realizedRelationships),
      configurationId: configuration.id
    };
  }
  const included = new Set(derivation.includedElementIds);
  const preserved = new Set(derivation.preservedRelationshipIds);
  return {
    elements: structuredClone(derivation.sourceElements.filter((element) => included.has(element.id))),
    relationships: structuredClone(derivation.sourceRelationships.filter((relationship) => preserved.has(relationship.id))),
    configurationId: configuration.id
  };
}

export function defaultSimulationName(project: Project, configurationId: string, now = new Date()): string {
  const configuration = project.configurations.find((item) => item.id === configurationId);
  const architecture = project.architectures.find((item) => item.id === configuration?.architectureId);
  const date = now.toISOString().replace("T", " ").slice(0, 16);
  return `${configuration?.name ?? architecture?.name ?? "Configuration"} — ${date}`;
}

export function runSimulation(project: Project, request: SimulationRequest): SimulationAttempt {
  const errors: string[] = [];
  const warnings: string[] = [];
  const architectureOnly = request.mode === "architectureOnly";
  const configuration = architectureOnly
    ? undefined
    : project.configurations.find((item) => item.id === request.configurationId);
  const architecture = project.architectures.find((item) =>
    item.id === (architectureOnly ? request.architectureId : configuration?.architectureId)
  );
  if (architectureOnly && !architecture) errors.push("PMC-006: Select a saved architecture.");
  if (!architectureOnly && (!configuration || configuration.archivedAt)) errors.push("PMB-020: Select an active saved configuration.");
  if (configuration && !project.architectures.some((architecture) => architecture.id === configuration.architectureId)) {
    errors.push("PMB-020: The configuration's generated architecture is missing.");
  }
  if (configuration) {
    errors.push(...validateConfiguration(project, configuration)
      .filter((finding) => finding.severity === "error")
      .map((finding) => finding.message));
  }
  const needsRederivation = !architectureOnly && !!configuration && derivationStatus(project, configuration) !== "Current";
  if (!request.selectedKpiIds.length && !request.selectedAlgorithmKeys.length) errors.push("Select at least one KPI or standard algorithm.");
  if (errors.length) return { errors, warnings, needsRederivation };

  let realization = configuration?.derivation;
  if (configuration && needsRederivation) {
    const background = deriveConfiguration(project, configuration);
    if (!background.result) return { errors: background.errors, warnings: background.warnings, needsRederivation: true };
    realization = background.result;
    warnings.push("PMB-112: The run used an in-memory 100% realization. The configuration's explicit realization was not changed.");
  }
  const model = architectureOnly && architecture
    ? architectureCompatibleModel(project, architecture.id)
    : realization
    ? {
        elements: structuredClone(realization.realizedElements),
        relationships: structuredClone(realization.realizedRelationships),
        configurationId: configuration!.id
      }
    : configuration
      ? derivedModel(configuration)
      : null;
  if (!model || (!architectureOnly && (!configuration || !realization))) {
    return { errors: ["PMB-112: A compatible analysis model could not be created."], warnings, needsRederivation: !architectureOnly };
  }
  if (architectureOnly) {
    warnings.push(project.overallScope === "architectureAndSimulation"
      ? "Current-architecture analysis: the run evaluates the canonical model directly; no feature configuration or 100% derivation is required for this project scope."
      : "Architecture-only analysis: the run evaluates the canonical 150% model without feature selection or 100% derivation; the selected architecture context resolves parameter applicability only.");
  }
  const calculated = calculateSelectedKpis(project, model, request.selectedKpiIds);
  errors.push(...calculated.errors);
  warnings.push(...calculated.warnings);
  const selectedKpiAlgorithms = new Set(calculated.results.map((result) => result.algorithmKey).filter(Boolean));
  const directAlgorithms = request.selectedAlgorithmKeys
    .filter((key) => !selectedKpiAlgorithms.has(key))
    .map((key) => {
      const temporaryProject = {
        ...project,
        kpis: [{
          id: `direct-${key}`,
          name: key,
          description: "",
          objectiveIds: [],
          calculationMode: "standardAlgorithm" as const,
          standardAlgorithmKey: key,
          outputUnit: "",
          optimizationDirection: "minimize" as const,
          weight: 1,
          inputParameterIds: [],
          dependsOnKpiIds: [],
          calculationWarnings: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      };
      return calculateSelectedKpis(temporaryProject, model, [`direct-${key}`]).results[0];
    })
    .filter(Boolean);
  const results = [...calculated.results, ...directAlgorithms];
  warnings.push(...directAlgorithms.flatMap((result) => result.warnings));
  const unavailable = results.filter((result) => result.value === null);
  unavailable.forEach((result) => errors.push(`PMB-017: ${result.name} is Not available: ${result.missingInformation.join(" ")}`));
  if (errors.length) return { errors, warnings, needsRederivation: false };

  const parameters = model.elements.flatMap((element) => element.parameters);
  const now = new Date().toISOString();
  const run: SimulationRun = {
    id: `simulation-${crypto.randomUUID()}`,
    name: request.name.trim() || (architectureOnly
      ? `${architecture?.name ?? "Architecture"} — ${project.overallScope === "architectureAndSimulation" ? "current model" : "150%"} — ${now.replace("T", " ").slice(0, 16)}`
      : defaultSimulationName(project, configuration!.id)),
    architectureId: architecture?.id ?? configuration!.architectureId,
    configurationId: configuration?.id,
    derivationId: realization?.id,
    timestamp: now,
    projectModelRevisionAtRun: project.modelRevision,
    inputSnapshot: {
      projectId: project.id,
      projectModelRevision: project.modelRevision,
      architectureId: architecture?.id ?? configuration!.architectureId,
      configurationId: configuration?.id,
      derivationId: realization?.id,
      appliedVariationPointIds: realization ? [...new Set(realization.appliedVariations.map((variation) => variation.variationPointId))] : [],
      featureValues: realization ? structuredClone(realization.featureValues) : {},
      realizationScopes: realization ? [...realization.realizationScopes] : [],
      backgroundRealization: needsRederivation,
      realizedElements: structuredClone(model.elements),
      realizedRelationships: structuredClone(model.relationships),
      appliedVariations: structuredClone(realization?.appliedVariations ?? []),
      activeElementIds: model.elements.map((element) => element.id),
      activeRelationshipIds: model.relationships.map((relationship) => relationship.id),
      parameterValues: Object.fromEntries(parameters.map((parameter) => [parameter.id, structuredClone(parameter.value)])),
      kpiDefinitions: structuredClone(project.kpis.filter((kpi) => request.selectedKpiIds.includes(kpi.id)))
    },
    selectedKpiIds: [...request.selectedKpiIds],
    selectedAlgorithmKeys: [...request.selectedAlgorithmKeys],
    results: structuredClone(results),
    sourceParameterIds: [...new Set(results.flatMap((result) => result.sourceParameterIds))],
    warnings: [...new Set(warnings)],
    validationSummary: {
      errors: 0,
      warnings: warnings.length,
      information: project.validationResults.filter((finding) => finding.severity === "information").length
    }
  };
  return { run: structuredClone(run), errors, warnings: run.warnings, needsRederivation: false };
}

export const simulationStatus = (project: Project, run: SimulationRun): "Current" | "Stale" =>
  run.projectModelRevisionAtRun < project.modelRevision ? "Stale" : "Current";
