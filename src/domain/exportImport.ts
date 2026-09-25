import { comparisonStatus } from "./comparison";
import type { ElementType, Project, RelationshipType } from "./types";

export const EXPORT_PACKAGE_VERSION = 1;

export interface ExportFilters {
  scope: "complete" | "selection";
  architectureId?: string;
  configurationId?: string;
  modelDomain?: "all" | "product" | "process" | "requirements" | "resources";
  elementTypes: ElementType[];
  elementIds: string[];
  featureIds: string[];
  relationshipTypes: RelationshipType[];
  tags: string[];
  includeValidationResults: boolean;
  includeKpiDefinitions: boolean;
  includeSimulationResults: boolean;
  includeComparisons: boolean;
  includeDecisions: boolean;
  relationshipClosure: "includeEndpoints" | "omitIncomplete";
}

export interface ExportManifest {
  filters: ExportFilters;
  counts: Record<string, number>;
  omittedRelationshipIds: string[];
  warnings: string[];
}

export interface ProjectExportPackage {
  exportPackageVersion: number;
  schemaVersion: number;
  exportedAt: string;
  project: Project;
  manifest: ExportManifest;
}

const domainTypes: Record<NonNullable<ExportFilters["modelDomain"]>, ElementType[]> = {
  all: [],
  product: ["productFunction", "productComponent", "productInterface"],
  process: ["processFunction", "industrialSystemComponent", "processInterface"],
  requirements: ["mission", "system", "externalSystem", "stakeholder", "need", "objective", "useCase", "systemRequirement", "verificationMethod"],
  resources: ["resource"]
};

export const defaultExportFilters = (): ExportFilters => ({
  scope: "complete",
  modelDomain: "all",
  elementTypes: [],
  elementIds: [],
  featureIds: [],
  relationshipTypes: [],
  tags: [],
  includeValidationResults: true,
  includeKpiDefinitions: true,
  includeSimulationResults: true,
  includeComparisons: true,
  includeDecisions: true,
  relationshipClosure: "includeEndpoints"
});

function initialElementIds(project: Project, filters: ExportFilters): Set<string> {
  if (filters.scope === "complete") return new Set(project.elements.map((element) => element.id));
  const domain = filters.modelDomain ?? "all";
  const domainFilter = domainTypes[domain];
  return new Set(project.elements.filter((element) => {
    if (filters.elementIds.length && !filters.elementIds.includes(element.id)) return false;
    if (filters.elementTypes.length && !filters.elementTypes.includes(element.elementType)) return false;
    if (domainFilter.length && !domainFilter.includes(element.elementType)) return false;
    if (filters.tags.length && !filters.tags.some((tag) => element.tags.includes(tag))) return false;
    if (filters.architectureId
      && element.architectureScope === "specific"
      && element.architectureId !== filters.architectureId) return false;
    return true;
  }).map((element) => element.id));
}

export function buildExportPackage(
  source: Project,
  filters: ExportFilters,
  now = new Date()
): ProjectExportPackage {
  const project = structuredClone(source);
  const includedElementIds = initialElementIds(project, filters);
  if (filters.includeKpiDefinitions) {
    project.kpis.forEach((kpi) => kpi.objectiveIds.forEach((id) => includedElementIds.add(id)));
  }
  if (filters.includeComparisons) {
    project.comparisonStudies.forEach((study) => {
      [
        ...study.objectiveIds,
        ...study.mandatoryRequirementIds,
        ...(study.baselineRequirementIds ?? []),
        ...study.criteria.flatMap((criterion) => [
          ...criterion.sourceObjectiveIds,
          ...criterion.sourceRequirementIds
        ])
      ].forEach((id) => includedElementIds.add(id));
    });
  }
  project.openDecisions.forEach((decision) =>
    decision.relatedElementIds.forEach((id) => includedElementIds.add(id))
  );
  let relationships = project.relationships.filter((relationship) =>
    (!filters.relationshipTypes.length || filters.relationshipTypes.includes(relationship.relationshipType))
    && (!filters.architectureId || !relationship.architectureId || relationship.architectureId === filters.architectureId)
  );
  const omittedRelationshipIds: string[] = [];
  if (filters.relationshipClosure === "includeEndpoints") {
    let changed = true;
    while (changed) {
      changed = false;
      project.elements.filter((element) => includedElementIds.has(element.id)).forEach((element) => {
        [element.metadata.subjectSystemId, element.metadata.architectureRootId, element.metadata.missionId, element.metadata.parentAssemblyId].forEach((id) => {
          if (id && !includedElementIds.has(id) && project.elements.some((item) => item.id === id)) { includedElementIds.add(id); changed = true; }
        });
      });
      relationships.forEach((relationship) => {
        if (includedElementIds.has(relationship.sourceId) || includedElementIds.has(relationship.targetId)) {
          if (!includedElementIds.has(relationship.sourceId)) {
            includedElementIds.add(relationship.sourceId);
            changed = true;
          }
          if (!includedElementIds.has(relationship.targetId)) {
            includedElementIds.add(relationship.targetId);
            changed = true;
          }
        }
      });
    }
    relationships = relationships.filter((relationship) =>
      includedElementIds.has(relationship.sourceId) && includedElementIds.has(relationship.targetId)
    );
  } else {
    relationships = relationships.filter((relationship) => {
      const complete = includedElementIds.has(relationship.sourceId) && includedElementIds.has(relationship.targetId);
      if (!complete && (includedElementIds.has(relationship.sourceId) || includedElementIds.has(relationship.targetId))) {
        omittedRelationshipIds.push(relationship.id);
      }
      return complete;
    });
  }
  project.elements = project.elements.filter((element) => includedElementIds.has(element.id));
  if (filters.relationshipClosure === "omitIncomplete") project.elements.forEach((element) => {
    for (const key of ["subjectSystemId", "architectureRootId", "missionId", "parentAssemblyId"] as const) if (element.metadata[key] && !includedElementIds.has(element.metadata[key]!)) delete element.metadata[key];
  });
  project.relationships = relationships;
  project.functionSequences = project.functionSequences
    .map((sequence) => ({
      ...sequence,
      functionIds: sequence.functionIds.filter((id) => includedElementIds.has(id)),
      relationshipIds: sequence.relationshipIds.filter((id) => relationships.some((relationship) => relationship.id === id)),
      useCaseIds: sequence.useCaseIds.filter((id) => includedElementIds.has(id))
    }))
    .filter((sequence) => sequence.functionIds.length > 0 || sequence.relationshipIds.length > 0);
  project.selectedUseCaseIds = project.selectedUseCaseIds.filter((id) => includedElementIds.has(id));
  project.rowOrderByType = Object.fromEntries(Object.entries(project.rowOrderByType).map(([type, ids]) => [
    type,
    ids?.filter((id) => includedElementIds.has(id)) ?? []
  ]));

  if (filters.featureIds.length) {
    const featureIds = new Set(filters.featureIds);
    if (filters.includeComparisons) {
      project.comparisonStudies.forEach((study) => {
        if (study.rootFeatureId) featureIds.add(study.rootFeatureId);
        study.exploredFeatureIds.forEach((id) => featureIds.add(id));
        study.criteria.forEach((criterion) => {
          if (criterion.requiredFeatureId) featureIds.add(criterion.requiredFeatureId);
        });
        study.candidateRefs.forEach((candidate) => {
          const configuration = project.configurations.find((item) => item.id === candidate.configurationId);
          configuration?.effectiveSelectedFeatureIds.forEach((id) => featureIds.add(id));
        });
      });
    }
    let changed = true;
    while (changed) {
      changed = false;
      project.features.forEach((feature) => {
        if (featureIds.has(feature.id) && feature.parentId && !featureIds.has(feature.parentId)) {
          featureIds.add(feature.parentId);
          changed = true;
        }
      });
    }
    project.features = project.features.filter((feature) => featureIds.has(feature.id));
    project.featureConstraints = project.featureConstraints.filter((constraint) =>
      featureIds.has(constraint.sourceFeatureId) && featureIds.has(constraint.targetFeatureId)
    );
    project.configurations = project.configurations.map((configuration) => ({
      ...configuration,
      manuallySelectedFeatureIds: configuration.manuallySelectedFeatureIds.filter((id) => featureIds.has(id)),
      automaticConstraintFeatureIds: configuration.automaticConstraintFeatureIds.filter((id) => featureIds.has(id)),
      effectiveSelectedFeatureIds: configuration.effectiveSelectedFeatureIds.filter((id) => featureIds.has(id)),
      autoSelectedFeatureIds: configuration.autoSelectedFeatureIds.filter((id) => featureIds.has(id)),
      featureValues: Object.fromEntries(Object.entries(configuration.featureValues ?? {}).filter(([id]) => featureIds.has(id)))
    }));
  }
  if (filters.configurationId) {
    project.configurations = project.configurations.filter((configuration) => configuration.id === filters.configurationId);
  } else if (filters.scope === "selection" && filters.architectureId) {
    project.configurations = project.configurations.filter((configuration) => configuration.architectureId === filters.architectureId);
  }
  const retainedConfigurationIds = new Set(project.configurations.map((configuration) => configuration.id));
  const retainedArchitectureIds = new Set([
    ...project.configurations.map((configuration) => configuration.architectureId),
    ...(filters.architectureId ? [filters.architectureId] : [])
  ]);
  if (filters.scope === "selection" && (filters.architectureId || filters.configurationId)) {
    project.architectures = project.architectures.filter((architecture) => retainedArchitectureIds.has(architecture.id));
  }
  if (project.baselineArchitectureId
    && !project.architectures.some((architecture) => architecture.id === project.baselineArchitectureId)) {
    project.baselineArchitectureId = undefined;
  }
  if (!filters.includeKpiDefinitions) project.kpis = [];
  if (!filters.includeSimulationResults) project.simulationRuns = [];
  else if (filters.configurationId) {
    project.simulationRuns = project.simulationRuns.filter((run) => run.configurationId === filters.configurationId);
  } else if (filters.scope === "selection" && filters.architectureId) {
    project.simulationRuns = project.simulationRuns.filter((run) => run.architectureId === filters.architectureId);
  }
  if (!filters.includeComparisons) {
    project.comparisonStudies = [];
    project.comparisonRisks = [];
    project.activeComparisonStudyId = undefined;
  } else {
    const runIds = new Set(project.simulationRuns.map((run) => run.id));
    project.comparisonStudies = project.comparisonStudies.filter((study) =>
      (!study.referenceArchitectureId || project.architectures.some((architecture) => architecture.id === study.referenceArchitectureId)) && study.candidateRefs.every((candidate) =>
        retainedConfigurationIds.has(candidate.configurationId)
        && project.architectures.some((architecture) => architecture.id === candidate.architectureId)
      )
      && study.alternativeRefs.every((alternative) =>
        runIds.has(alternative.simulationRunId)
        && project.architectures.some((architecture) => architecture.id === alternative.architectureId)
        && (!alternative.configurationId || retainedConfigurationIds.has(alternative.configurationId))
      )
    );
    const studyIds = new Set(project.comparisonStudies.map((study) => study.id));
    if (project.activeComparisonStudyId && !studyIds.has(project.activeComparisonStudyId)) {
      project.activeComparisonStudyId = project.comparisonStudies[0]?.id;
    }
    project.comparisonRisks = project.comparisonRisks
      .filter((risk) => studyIds.has(risk.comparisonStudyId))
      .map((risk) => ({
        ...risk,
        applicableArchitectureIds: risk.applicableArchitectureIds.filter((id) =>
          project.architectures.some((architecture) => architecture.id === id)
        ),
        applicableConfigurationIds: risk.applicableConfigurationIds.filter((id) =>
          project.configurations.some((configuration) => configuration.id === id)
        ),
        applicableRequirementIds: risk.applicableRequirementIds.filter((id) => includedElementIds.has(id)),
        applicableParameterIds: risk.applicableParameterIds.filter((id) =>
          project.elements.some((element) => element.parameters.some((parameter) => parameter.id === id))
        ),
        applicableKpiIds: risk.applicableKpiIds.filter((id) =>
          project.kpis.some((kpi) => kpi.id === id)
        )
      }));
  }
  if (!filters.includeDecisions) project.decisions = [];
  else {
    const studyIds = new Set(project.comparisonStudies.map((study) => study.id));
    const runIds = new Set(project.simulationRuns.map((run) => run.id));
    project.decisions = project.decisions.map((decision) => ({
      ...decision,
      supportingComparisonStudyIds: decision.supportingComparisonStudyIds.filter((id) => studyIds.has(id)),
      supportingSimulationRunIds: decision.supportingSimulationRunIds.filter((id) => runIds.has(id))
    }));
  }
  const retainedDecisionIds = new Set(project.decisions.map((decision) => decision.id));
  project.openDecisions = project.openDecisions.map((decision) => ({
    ...decision,
    linkedFormalDecisionId: decision.linkedFormalDecisionId && retainedDecisionIds.has(decision.linkedFormalDecisionId)
      ? decision.linkedFormalDecisionId
      : undefined
  }));
  if (!filters.includeValidationResults) project.validationResults = [];
  const staleRuns = project.simulationRuns.filter((run) => run.projectModelRevisionAtRun < project.modelRevision);
  const staleComparisons = project.comparisonStudies.flatMap((study) =>
    study.results.filter((result) => comparisonStatus(project, study, result) === "Stale")
  );
  const warnings = [
    ...(omittedRelationshipIds.length
      ? [`PMC-107: ${omittedRelationshipIds.length} relationship(s) were omitted because an endpoint was excluded.`]
      : []),
    ...(staleRuns.length ? [`PMC-105: ${staleRuns.length} stale simulation run(s) are included.`] : []),
    ...(staleComparisons.length ? [`PMC-110: ${staleComparisons.length} stale Trade Study result(s) are included.`] : [])
  ];
  const manifest: ExportManifest = {
    filters: structuredClone(filters),
    counts: {
      architectures: project.architectures.length,
      elements: project.elements.length,
      relationships: project.relationships.length,
      parameters: project.elements.reduce((sum, element) => sum + element.parameters.length, 0),
      features: project.features.length,
      configurations: project.configurations.length,
      kpis: project.kpis.length,
      simulationRuns: project.simulationRuns.length,
      comparisonStudies: project.comparisonStudies.length,
      risks: project.comparisonRisks.length,
      decisions: project.decisions.length
    },
    omittedRelationshipIds,
    warnings
  };
  const issues = validateProjectReferences(project);
  if (issues.length) throw new Error(`PMC-012: Export cannot preserve integrity: ${issues.join(" ")}`);
  return {
    exportPackageVersion: EXPORT_PACKAGE_VERSION,
    schemaVersion: project.schemaVersion,
    exportedAt: now.toISOString(),
    project,
    manifest
  };
}

export function validateProjectReferences(project: Project): string[] {
  const issues: string[] = [];
  const elementIds = new Set(project.elements.map((element) => element.id));
  const architectureIds = new Set(project.architectures.map((architecture) => architecture.id));
  const configurationIds = new Set(project.configurations.map((configuration) => configuration.id));
  const featureIds = new Set(project.features.map((feature) => feature.id));
  const featureGroupIds = new Set(project.featureGroups.map((group) => group.id));
  const variabilityAxisIds = new Set(project.variabilityAxes.map((axis) => axis.id));
  const kpiIds = new Set(project.kpis.map((kpi) => kpi.id));
  const runIds = new Set(project.simulationRuns.map((run) => run.id));
  const parameterIds = new Set(project.elements.flatMap((element) => element.parameters.map((parameter) => parameter.id)));
  const studyIds = new Set(project.comparisonStudies.map((study) => study.id));
  const objectiveIds = new Set(project.elements.filter((element) => element.elementType === "objective").map((element) => element.id));
  const requirementIds = new Set(project.elements.filter((element) => element.elementType === "systemRequirement").map((element) => element.id));
  const openDecisionIds = new Set(project.openDecisions.map((decision) => decision.id));
  const decisionIds = new Set(project.decisions.map((decision) => decision.id));
  if (project.activeComparisonStudyId && !studyIds.has(project.activeComparisonStudyId)) {
    issues.push(`Active Trade Study ${project.activeComparisonStudyId} is missing.`);
  }
  if (project.baselineArchitectureId && !architectureIds.has(project.baselineArchitectureId)) {
    issues.push(`Baseline references missing architecture ${project.baselineArchitectureId}.`);
  }
  project.relationships.forEach((relationship) => {
    if (!elementIds.has(relationship.sourceId) || !elementIds.has(relationship.targetId)) {
      issues.push(`Relationship ${relationship.id} has a missing endpoint.`);
    }
  });
  project.elements.forEach((element) => element.parameters.forEach((parameter) => {
    if (parameter.ownerElementId !== element.id) issues.push(`Parameter ${parameter.id} has an invalid owner.`);
  }));
  project.elements.forEach((element) => {
    for (const key of ["subjectSystemId", "architectureRootId", "missionId", "parentAssemblyId"] as const) if (element.metadata[key] && !elementIds.has(element.metadata[key]!)) issues.push(`Element ${element.id} has a missing ${key} reference.`);
  });
  project.features.forEach((feature) => {
    if (feature.parentId && !featureIds.has(feature.parentId)) issues.push(`Feature ${feature.id} has a missing parent.`);
    if (feature.parentGroupId && !featureGroupIds.has(feature.parentGroupId)) issues.push(`Feature ${feature.id} has a missing organizational group.`);
  });
  project.variabilityAxes.forEach((axis) => {
    if (!featureGroupIds.has(axis.featureGroupId)) issues.push(`Variability axis ${axis.id} has a missing FeatureGroup.`);
  });
  project.featureConstraints.forEach((constraint) => {
    if (!featureIds.has(constraint.sourceFeatureId) || !featureIds.has(constraint.targetFeatureId)) {
      issues.push(`Feature constraint ${constraint.id} has a missing feature.`);
    }
  });
  project.configurations.forEach((configuration) => {
    if (!architectureIds.has(configuration.architectureId)) issues.push(`Configuration ${configuration.id} has a missing architecture.`);
    [...configuration.manuallySelectedFeatureIds, ...configuration.automaticConstraintFeatureIds].forEach((id) => {
      if (!featureIds.has(id)) issues.push(`Configuration ${configuration.id} references missing feature ${id}.`);
    });
  });
  project.kpis.forEach((kpi) => kpi.objectiveIds.forEach((id) => {
    if (!objectiveIds.has(id)) issues.push(`KPI ${kpi.id} references missing objective ${id}.`);
  }));
  project.openDecisions.forEach((decision) => {
    decision.relatedElementIds.forEach((id) => {
      if (!elementIds.has(id)) issues.push(`Open decision ${decision.id} references missing element ${id}.`);
    });
    if (decision.linkedFormalDecisionId && !decisionIds.has(decision.linkedFormalDecisionId)) {
      issues.push(`Open decision ${decision.id} references missing formal decision ${decision.linkedFormalDecisionId}.`);
    }
  });
  project.simulationRuns.forEach((run) => {
    if (!architectureIds.has(run.architectureId)) issues.push(`Simulation ${run.id} has a missing architecture.`);
    if (run.configurationId && !configurationIds.has(run.configurationId)) issues.push(`Simulation ${run.id} has a missing configuration.`);
  });
  project.comparisonStudies.forEach((study) => {
    if (study.rootFeatureId && !featureIds.has(study.rootFeatureId)) {
      issues.push(`Trade Study ${study.id} references missing Root Feature ${study.rootFeatureId}.`);
    }
    (study.selectedVariabilityAxisIds ?? []).forEach((id) => {
      if (!variabilityAxisIds.has(id)) issues.push(`Trade Study ${study.id} references missing variability axis ${id}.`);
    });
    if (study.originatingOpenDecisionId && !openDecisionIds.has(study.originatingOpenDecisionId)) {
      issues.push(`Trade Study ${study.id} references missing open decision ${study.originatingOpenDecisionId}.`);
    }
    study.objectiveIds.forEach((id) => {
      if (!objectiveIds.has(id)) issues.push(`Trade Study ${study.id} references missing objective ${id}.`);
    });
    study.mandatoryRequirementIds.forEach((id) => {
      if (!requirementIds.has(id)) issues.push(`Trade Study ${study.id} references missing requirement ${id}.`);
    });
    (study.baselineRequirementIds ?? []).forEach((id) => {
      if (!requirementIds.has(id)) issues.push(`Trade Study ${study.id} is missing baseline obligation ${id}.`);
    });
    if (study.referenceArchitectureId && !architectureIds.has(study.referenceArchitectureId)) issues.push(`Trade Study ${study.id} has a missing reference architecture.`);
    study.exploredFeatureIds.forEach((id) => {
      if (!featureIds.has(id)) issues.push(`Trade Study ${study.id} references missing feature ${id}.`);
    });
    study.criteria.forEach((criterion) => {
      criterion.sourceObjectiveIds.forEach((id) => {
        if (!objectiveIds.has(id)) issues.push(`Criterion ${criterion.id} references missing objective ${id}.`);
      });
      criterion.sourceRequirementIds.forEach((id) => {
        if (!requirementIds.has(id)) issues.push(`Criterion ${criterion.id} references missing requirement ${id}.`);
      });
      if (criterion.kpiId && !kpiIds.has(criterion.kpiId)) {
        issues.push(`Criterion ${criterion.id} references missing KPI ${criterion.kpiId}.`);
      }
      if (criterion.requiredFeatureId && !featureIds.has(criterion.requiredFeatureId)) {
        issues.push(`Criterion ${criterion.id} references missing feature ${criterion.requiredFeatureId}.`);
      }
    });
    study.candidateRefs.forEach((candidate) => {
      const configuration = project.configurations.find((item) => item.id === candidate.configurationId);
      if (!configurationIds.has(candidate.configurationId)) {
        issues.push(`Candidate ${candidate.id} references missing configuration ${candidate.configurationId}.`);
      }
      if (!architectureIds.has(candidate.architectureId)) {
        issues.push(`Candidate ${candidate.id} references missing architecture ${candidate.architectureId}.`);
      }
      if (configuration && configuration.architectureId !== candidate.architectureId) {
        issues.push(`Candidate ${candidate.id} has inconsistent configuration and architecture references.`);
      }
    });
    study.selectedKpiIds.forEach((id) => {
      if (!kpiIds.has(id)) issues.push(`Trade Study ${study.id} references missing KPI ${id}.`);
    });
    study.alternativeRefs.forEach((alternative) => {
      if (!architectureIds.has(alternative.architectureId)) {
        issues.push(`Trade Study ${study.id} references missing architecture ${alternative.architectureId}.`);
      }
      if (alternative.configurationId && !configurationIds.has(alternative.configurationId)) {
        issues.push(`Trade Study ${study.id} references missing configuration ${alternative.configurationId}.`);
      }
      if (!runIds.has(alternative.simulationRunId)) issues.push(`Trade Study ${study.id} references missing simulation ${alternative.simulationRunId}.`);
    });
    (study.scenarios ?? []).forEach((scenario) => scenario.effects.forEach((effect) => {
      if (effect.type.startsWith("parameter") && !parameterIds.has(effect.targetId)) {
        issues.push(`Scenario ${scenario.id} references missing parameter ${effect.targetId}.`);
      }
      if (effect.type.startsWith("kpi") && !kpiIds.has(effect.targetId)) {
        issues.push(`Scenario ${scenario.id} references missing KPI ${effect.targetId}.`);
      }
    }));
  });
  project.comparisonRisks.forEach((risk) => {
    if (!studyIds.has(risk.comparisonStudyId)) issues.push(`Risk ${risk.id} has a missing comparison study.`);
    risk.applicableArchitectureIds.forEach((id) => {
      if (!architectureIds.has(id)) issues.push(`Risk ${risk.id} references missing architecture ${id}.`);
    });
    risk.applicableConfigurationIds.forEach((id) => {
      if (!configurationIds.has(id)) issues.push(`Risk ${risk.id} references missing configuration ${id}.`);
    });
    risk.applicableRequirementIds.forEach((id) => {
      if (!requirementIds.has(id)) issues.push(`Risk ${risk.id} references missing requirement ${id}.`);
    });
    risk.applicableParameterIds.forEach((id) => {
      if (!parameterIds.has(id)) issues.push(`Risk ${risk.id} references missing parameter ${id}.`);
    });
    risk.applicableKpiIds.forEach((id) => {
      if (!kpiIds.has(id)) issues.push(`Risk ${risk.id} references missing KPI ${id}.`);
    });
  });
  project.decisions.forEach((decision) => {
    decision.supportingComparisonStudyIds.forEach((id) => {
      if (!studyIds.has(id)) issues.push(`Decision ${decision.id} references missing study ${id}.`);
    });
    decision.supportingSimulationRunIds.forEach((id) => {
      if (!runIds.has(id)) issues.push(`Decision ${decision.id} references missing simulation ${id}.`);
    });
  });
  return [...new Set(issues)];
}

export function serializeExportPackage(value: ProjectExportPackage): string {
  return JSON.stringify(value, null, 2);
}

export function parseExportPackage(
  raw: string,
  migrateProject: (value: unknown) => Project
): { package?: ProjectExportPackage; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { errors: ["PMC-008: JSON syntax is invalid."] };
  }
  if (!parsed || typeof parsed !== "object") return { errors: ["PMC-008: Import package is not an object."] };
  const candidate = parsed as Partial<ProjectExportPackage>;
  if (candidate.exportPackageVersion !== EXPORT_PACKAGE_VERSION) {
    return { errors: ["PMC-009: Export package version is unsupported."] };
  }
  if (!candidate.project) return { errors: ["PMC-008: Imported project is missing."] };
  const projectSchema = typeof candidate.project === "object"
    ? (candidate.project as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (typeof candidate.schemaVersion !== "number"
    || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(candidate.schemaVersion)
    || typeof projectSchema !== "number"
    || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(projectSchema)) {
    return { errors: ["PMC-009: Project schema version is unsupported."] };
  }
  let project: Project;
  try {
    project = migrateProject(candidate.project);
  } catch (error) {
    return { errors: [`PMC-008: ${error instanceof Error ? error.message : "Project migration failed."}`] };
  }
  const allIds = [
    ...project.architectures.map((item) => item.id),
    ...project.elements.map((item) => item.id),
    ...project.elements.flatMap((item) => item.parameters.map((parameter) => parameter.id)),
    ...project.relationships.map((item) => item.id),
    ...project.features.map((item) => item.id),
    ...project.featureGroups.map((item) => item.id),
    ...project.variabilityAxes.map((item) => item.id),
    ...project.featureConstraints.map((item) => item.id),
    ...project.configurations.map((item) => item.id),
    ...project.kpis.map((item) => item.id),
    ...project.simulationRuns.map((item) => item.id),
    ...project.openDecisions.map((item) => item.id),
    ...project.comparisonStudies.map((item) => item.id),
    ...project.comparisonStudies.flatMap((item) => item.criteria.map((criterion) => criterion.id)),
    ...project.comparisonStudies.flatMap((item) => item.candidateRefs.map((candidate) => candidate.id)),
    ...project.comparisonStudies.flatMap((item) => item.alternativeRefs.map((alternative) => alternative.id)),
    ...project.comparisonStudies.flatMap((item) => item.results.map((result) => result.id)),
    ...project.comparisonStudies.flatMap((item) => (item.scenarios ?? []).map((scenario) => scenario.id)),
    ...project.comparisonStudies.flatMap((item) => (item.scenarios ?? []).flatMap((scenario) => scenario.effects.map((effect) => effect.id))),
    ...project.comparisonStudies.flatMap((item) => (item.robustnessResults ?? []).map((result) => result.id)),
    ...project.comparisonStudies.flatMap((item) => (item.robustnessResults ?? []).flatMap((result) => result.cases.map((caseResult) => caseResult.id))),
    ...project.comparisonRisks.map((item) => item.id),
    ...project.decisions.map((item) => item.id)
  ];
  if (new Set(allIds).size !== allIds.length) return { errors: ["PMC-010: Imported project contains duplicate IDs."] };
  const referenceErrors = validateProjectReferences(project);
  if (referenceErrors.length) return { errors: referenceErrors.map((error) => `PMC-010: ${error}`) };
  return {
    package: {
      exportPackageVersion: EXPORT_PACKAGE_VERSION,
      schemaVersion: project.schemaVersion,
      exportedAt: candidate.exportedAt ?? new Date().toISOString(),
      project,
      manifest: candidate.manifest ?? {
        filters: defaultExportFilters(),
        counts: {},
        omittedRelationshipIds: [],
        warnings: []
      }
    },
    errors: []
  };
}
