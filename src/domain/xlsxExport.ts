import writeExcelFile, {
  type Sheet,
  type SheetData
} from "write-excel-file/browser";
import type { ProjectExportPackage } from "./exportImport";
import { objectiveProjection } from "./objectives";
import { tradeStudyReadiness } from "./tradeStudy";
import { residualExposure, summarizeRisks } from "./tradeStudyMethodology";

type Row = Record<string, string | number | boolean | null | undefined>;
type BrowserSheet = Sheet<Blob>;

export interface XlsxWorkbook {
  SheetNames: string[];
  sheets: BrowserSheet[];
}

function sheetData(rows: Row[]): SheetData {
  const headings: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((heading) => {
      if (!headings.includes(heading)) headings.push(heading);
    });
  });
  return [
    headings,
    ...rows.map((row) => headings.map((heading) => row[heading] ?? null))
  ];
}

function addSheet(sheets: BrowserSheet[], name: string, rows: Row[], required = false) {
  if (!rows.length && !required) return;
  sheets.push({
    data: sheetData(rows.length ? rows : [{ Status: "No applicable data" }]),
    sheet: name.slice(0, 31)
  });
}

export function buildXlsxWorkbook(payload: ProjectExportPackage): XlsxWorkbook {
  const project = payload.project;
  const sheets: BrowserSheet[] = [];
  addSheet(sheets, "Project", [{
    ID: project.id,
    Name: project.name,
    Description: project.description,
    SchemaVersion: project.schemaVersion,
    ModelRevision: project.modelRevision,
    Objectives: objectiveProjection(project).join(" | "),
    CreatedAt: project.createdAt,
    UpdatedAt: project.updatedAt
  }], true);
  addSheet(sheets, "Architectures", project.architectures.map((item) => ({
    ID: item.id, Name: item.name, Description: item.description, Status: item.status,
    ConfigurationID: item.configurationId, ArchivedAt: item.archivedAt
  })));
  addSheet(sheets, "Elements", project.elements.map((item) => ({
    ID: item.id, Type: item.elementType, Name: item.name, Description: item.description,
    ArchitectureScope: item.architectureScope, ArchitectureID: item.architectureId,
    Tags: item.tags.join(" | "), Status: item.status, UpdatedAt: item.updatedAt
  })));
  addSheet(sheets, "Relationships", project.relationships.map((item) => ({
    ID: item.id, Type: item.relationshipType, SourceID: item.sourceId, TargetID: item.targetId,
    ArchitectureID: item.architectureId, SequenceID: item.sequenceId,
    RequiredQuantity: item.requiredQuantity ?? item.quantity, Unit: item.unit
  })));
  addSheet(sheets, "Parameters", project.elements.flatMap((element) => element.parameters.map((parameter) => ({
    ID: parameter.id, OwnerElementID: element.id, OwnerElementName: element.name,
    Name: parameter.name, SemanticKey: parameter.semanticKey, Value: typeof parameter.value === "object"
      ? JSON.stringify(parameter.value)
      : parameter.value,
    Unit: parameter.unit, Source: parameter.source, Origin: parameter.valueOrigin,
    ApplicableConfigurationIDs: parameter.applicableConfigurationIds.join(" | ")
  }))));
  addSheet(sheets, "Features", project.features.map((item) => ({
    ID: item.id, ParentID: item.parentId, ParentGroupID: item.parentGroupId, Name: item.name,
    Type: item.featureType, ValueType: item.valueType, DefaultValue: String(item.defaultValue ?? ""),
    AllowedValues: item.allowedValues?.join(" | "), VariabilityScope: item.variabilityScope
  })));
  addSheet(sheets, "Feature Constraints", project.featureConstraints.map((item) => ({
    ID: item.id, Type: item.type, SourceFeatureID: item.sourceFeatureId,
    TargetFeatureID: item.targetFeatureId
  })));
  addSheet(sheets, "Configurations", project.configurations.map((item) => ({
    ID: item.id, Name: item.name, ArchitectureID: item.architectureId,
    ManualFeatureIDs: item.manuallySelectedFeatureIds.join(" | "),
    AutomaticFeatureIDs: item.automaticConstraintFeatureIds.join(" | "),
    EffectiveFeatureIDs: item.effectiveSelectedFeatureIds.join(" | "),
    FeatureValues: JSON.stringify(item.featureValues), ValidationStatus: item.validationStatus,
    DerivationID: item.derivation?.id, ArchivedAt: item.archivedAt
  })));
  addSheet(sheets, "KPI Definitions", project.kpis.map((item) => ({
    ID: item.id, Name: item.name, Mode: item.calculationMode, Formula: item.formula,
    ObjectiveIDs: item.objectiveIds.join(" | "),
    StandardAlgorithm: item.standardAlgorithmKey, OutputUnit: item.outputUnit,
    Direction: item.optimizationDirection, DefaultWeight: item.weight,
    MinimumThreshold: item.minimumThreshold, MaximumThreshold: item.maximumThreshold,
    UpdatedAt: item.updatedAt
  })));
  addSheet(sheets, "Simulation Results", project.simulationRuns.flatMap((run) => run.results.map((result) => ({
    RunID: run.id, RunName: run.name, Timestamp: run.timestamp, ArchitectureID: run.architectureId,
    ConfigurationID: run.configurationId, ProjectRevision: run.projectModelRevisionAtRun,
    ResultID: result.id, KPIID: result.kpiId, Algorithm: result.algorithmKey,
    Name: result.name, Value: result.value, Unit: result.unit,
    Warnings: result.warnings.join(" | ")
  }))));
  addSheet(sheets, "Validation Results", project.validationResults.map((item) => ({
    ID: item.id, RuleID: item.ruleId, Severity: item.severity, Category: item.category,
    Title: item.title, Message: item.message, Resolved: item.resolved,
    ElementIDs: item.affectedElementIds.join(" | "), RelationshipIDs: item.affectedRelationshipIds.join(" | ")
  })));
  addSheet(sheets, "Comparison Studies", project.comparisonStudies.map((item) => ({
    ID: item.id, Name: item.name, Description: item.description,
    Question: item.question, IntendedOutcome: item.intendedOutcome,
    LifecycleScope: item.lifecycleScope, SystemScope: item.systemScope, Status: item.status,
    OriginatingOpenDecisionID: item.originatingOpenDecisionId,
    ObjectiveIDs: item.objectiveIds.join(" | "),
    MandatoryRequirementIDs: item.mandatoryRequirementIds.join(" | "),
    ExploredFeatureIDs: item.exploredFeatureIds.join(" | "),
    CandidateIDs: item.candidateRefs.map((candidate) => candidate.id).join(" | "),
    AlternativeRunIDs: item.alternativeRefs.map((alternative) => alternative.simulationRunId).join(" | "),
    KPIIDs: item.selectedKpiIds.join(" | "), Settings: JSON.stringify(item.kpiSettings),
    ResultCount: item.results.length, SettingsUpdatedAt: item.settingsUpdatedAt
  })));
  addSheet(sheets, "Study Criteria", project.comparisonStudies.flatMap((study) =>
    study.criteria.map((criterion) => ({
      StudyID: study.id, CriterionID: criterion.id, Name: criterion.name,
      Description: criterion.description, Type: criterion.type,
      SourceObjectiveIDs: criterion.sourceObjectiveIds.join(" | "),
      SourceRequirementIDs: criterion.sourceRequirementIds.join(" | "),
      KPIID: criterion.kpiId, RequiredFeatureID: criterion.requiredFeatureId,
      Weight: criterion.weight,
      LegacyValueFunction: criterion.valueFunction,
      FixedStakeholderValueFunction: JSON.stringify(criterion.stakeholderValueFunction ?? null)
    }))
  ));
  addSheet(sheets, "Candidate Readiness", project.comparisonStudies.flatMap((study) =>
    tradeStudyReadiness(project, study).map((readiness) => ({
      StudyID: study.id, CandidateID: readiness.candidateId, Candidate: readiness.label,
      ConfigurationID: readiness.configurationId, ArchitectureID: readiness.architectureId,
      ConfigurationPresent: readiness.configurationPresent,
      ValidationReady: readiness.validationReady, DerivationReady: readiness.derivationReady,
      ModelRevisionReady: readiness.modelRevisionReady, SimulationReady: readiness.simulationReady,
      RequiredKPIIDs: readiness.requiredKpiIds.join(" | "),
      CoveredKPIIDs: readiness.coveredKpiIds.join(" | "),
      KPICoveragePercent: readiness.kpiCoveragePercent,
      SimulationRunID: readiness.simulationRunId, State: readiness.state,
      Missing: readiness.missing.map((item) => item.label).join(" | ")
    }))
  ));
  addSheet(sheets, "Comparison Results", project.comparisonStudies.flatMap((study) =>
    study.results.flatMap((result) => study.alternativeRefs.map((alternative) => ({
      StudyID: study.id, ResultID: result.id, Timestamp: result.timestamp,
      AlternativeID: alternative.id, Alternative: alternative.label,
      RawValues: JSON.stringify(result.rawValues[alternative.id] ?? {}),
      NormalizedScores: JSON.stringify(result.normalizedScores[alternative.id] ?? {}),
      WeightedScore: result.weightedScores[alternative.id],
      Methodology: result.methodology ?? "legacy-relative",
      StakeholderValues: JSON.stringify(result.stakeholderValues?.[alternative.id] ?? {}),
      WeightedContributions: JSON.stringify(result.weightedContributions?.[alternative.id] ?? {}),
      StakeholderValueScore: result.stakeholderValueScores?.[alternative.id],
      DataCoveragePercent: result.dataCoveragePercent[alternative.id],
      ThresholdViolations: result.thresholdViolations.filter((item) => item.alternativeId === alternative.id)
        .map((item) => item.message).join(" | "),
      Warnings: result.warnings.join(" | ")
    })))
  ));
  addSheet(sheets, "Feasibility and Pareto", project.comparisonStudies.flatMap((study) =>
    study.results.flatMap((result) => study.alternativeRefs.map((alternative) => ({
      StudyID: study.id,
      ResultID: result.id,
      AlternativeID: alternative.id,
      Alternative: alternative.label,
      Feasibility: result.feasibility?.[alternative.id]?.status,
      FailedRequirementIDs: result.feasibility?.[alternative.id]?.failedRequirementIds.join(" | "),
      MissingRequirementIDs: result.feasibility?.[alternative.id]?.missingRequirementIds.join(" | "),
      RequirementEvidence: JSON.stringify(result.feasibility?.[alternative.id]?.requirementEvidence ?? []),
      ExceptionRationale: result.feasibility?.[alternative.id]?.exceptionRationale,
      ParetoStatus: result.pareto?.[alternative.id]?.status,
      DominatedByAlternativeIDs: result.pareto?.[alternative.id]?.dominatedByAlternativeIds.join(" | "),
      DominatesAlternativeIDs: result.pareto?.[alternative.id]?.dominatesAlternativeIds.join(" | "),
      ParetoExplanation: result.pareto?.[alternative.id]?.explanation,
      Recommended: result.recommendedAlternativeIds?.includes(alternative.id) ?? false
    })))
  ));
  addSheet(sheets, "Manager Summary", project.comparisonStudies.flatMap((study) => {
    const result = study.results.at(-1);
    const risk = summarizeRisks(project, study);
    return study.alternativeRefs.map((alternative) => ({
      StudyID: study.id,
      DecisionQuestion: study.question,
      IntendedOutcome: study.intendedOutcome,
      Alternative: alternative.label,
      MandatoryFeasibility: result?.feasibility?.[alternative.id]?.status,
      ParetoStatus: result?.pareto?.[alternative.id]?.status,
      StakeholderValue: result?.stakeholderValueScores?.[alternative.id],
      DataCoveragePercent: result?.dataCoveragePercent[alternative.id],
      HighestFeasibleValue: result?.recommendedAlternativeIds?.includes(alternative.id) ?? false,
      TotalResidualExposure: risk[alternative.id]?.totalResidualExposure ?? 0,
      MaximumResidualExposure: risk[alternative.id]?.maximumResidualExposure ?? 0,
      UnresolvedHighCriticalRisks: risk[alternative.id]?.unresolvedHighCriticalCount ?? 0
    }));
  }));
  addSheet(sheets, "Risks", project.comparisonRisks.map((item) => ({
    ID: item.id, StudyID: item.comparisonStudyId, AlternativeID: item.alternativeId,
    Title: item.title, Description: item.description,
    InherentLikelihood: item.inherentLikelihood, InherentImpact: item.inherentImpact,
    InherentExposure: item.inherentLikelihood * item.inherentImpact,
    ResidualLikelihood: item.residualLikelihood, ResidualImpact: item.residualImpact,
    ResidualExposure: residualExposure(item), Mitigation: item.mitigation,
    Owner: item.owner, Status: item.status, ReviewRequired: item.reviewRequired,
    ArchitectureIDs: item.applicableArchitectureIds.join(" | "),
    ConfigurationIDs: item.applicableConfigurationIds.join(" | "),
    RequirementIDs: item.applicableRequirementIds.join(" | "),
    ParameterIDs: item.applicableParameterIds.join(" | "),
    KPIIDs: item.applicableKpiIds.join(" | ")
  })));
  addSheet(sheets, "Risk Scenarios", project.comparisonStudies.flatMap((study) =>
    (study.scenarios ?? []).map((scenario) => ({
      StudyID: study.id,
      ScenarioID: scenario.id,
      Name: scenario.name,
      Description: scenario.description,
      CreatedAt: scenario.createdAt,
      Effects: JSON.stringify(scenario.effects)
    }))
  ));
  addSheet(sheets, "Bounded Robustness", project.comparisonStudies.flatMap((study) =>
    (study.robustnessResults ?? []).flatMap((result) => result.cases.map((item) => ({
      StudyID: study.id,
      RobustnessResultID: result.id,
      BaselineComparisonResultID: result.baselineComparisonResultId,
      Timestamp: result.timestamp,
      Label: result.label,
      CaseID: item.id,
      CaseName: item.name,
      CaseKind: item.kind,
      ScenarioID: item.scenarioId,
      ChangedFeasibilityAlternativeIDs: item.changedFeasibilityAlternativeIds.join(" | "),
      ChangedParetoAlternativeIDs: item.changedParetoAlternativeIds.join(" | "),
      LeadingAlternativeIDs: item.leadingAlternativeIds.join(" | "),
      RecommendationChanged: item.recommendationChanged,
      Notes: item.notes.join(" | ")
    })))
  ));
  addSheet(sheets, "Decisions", project.decisions.map((item) => ({
    ID: item.id, Question: item.question, Alternatives: item.alternatives.join(" | "),
    Criteria: item.criteria.join(" | "), SelectedAlternative: item.selectedAlternative,
    Rationale: item.rationale, Status: item.status, Owner: item.owner,
    SupportingStudyIDs: item.supportingComparisonStudyIds.join(" | "),
    SupportingRunIDs: item.supportingSimulationRunIds.join(" | "),
    Risks: item.risks.join(" | "),
    OpenActions: item.openActions.join(" | "),
    CriticalRiskJustification: item.criticalRiskJustification,
    BaselineApprovalConfirmed: item.baselineApprovalConfirmed,
    DecisionEvidenceSnapshot: JSON.stringify(item.evidenceSnapshot ? { ...item.evidenceSnapshot, assumptions: undefined } : null)
  })));
  addSheet(sheets, "Open Decisions", project.openDecisions.map((item) => ({
    ID: item.id, Question: item.question, Description: item.description, Status: item.status,
    RelatedElementIDs: item.relatedElementIds.join(" | "),
    LinkedFormalDecisionID: item.linkedFormalDecisionId
  })));
  addSheet(sheets, "Export Manifest", [
    { Field: "ExportedAt", Value: payload.exportedAt },
    { Field: "Filters", Value: JSON.stringify(payload.manifest.filters) },
    { Field: "Counts", Value: JSON.stringify(payload.manifest.counts) },
    { Field: "OmittedRelationshipIDs", Value: payload.manifest.omittedRelationshipIds.join(" | ") },
    { Field: "Warnings", Value: payload.manifest.warnings.join(" | ") }
  ], true);
  return {
    SheetNames: sheets.map((sheet) => sheet.sheet ?? ""),
    sheets
  };
}

export async function xlsxBlob(payload: ProjectExportPackage): Promise<Blob> {
  return writeExcelFile(buildXlsxWorkbook(payload).sheets).toBlob();
}

export async function xlsxArrayBuffer(payload: ProjectExportPackage): Promise<ArrayBuffer> {
  const blob = await xlsxBlob(payload);
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("XLSX blob could not be read."));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("XLSX blob did not produce an ArrayBuffer."));
    };
    reader.readAsArrayBuffer(blob);
  });
}
