import { jsPDF } from "jspdf";
import { leadingAlternativeIds } from "./comparison";
import { objectiveProjection } from "./objectives";
import { mixedEvidenceWarning, tradeStudyReadiness } from "./tradeStudy";
import { residualExposure, summarizeRisks } from "./tradeStudyMethodology";
import type { Project } from "./types";

export interface PdfReportOptions {
  title?: string;
  architectureId?: string;
  configurationId?: string;
  comparisonStudyId?: string;
  comparisonResultId?: string;
  decisionId?: string;
  includeValidation: boolean;
  includeSimulationDetails: boolean;
  includeRisks: boolean;
  scopeSummary: string;
}

const disclaimer = "Preliminary engineering estimate — not a verified detailed-design result.";

export function buildPdfReport(project: Project, options: PdfReportOptions, now = new Date()): jsPDF {
  const document = new jsPDF({ unit: "mm", format: "a4" });
  const width = document.internal.pageSize.getWidth();
  const height = document.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = width - margin * 2;
  let y = 20;

  const header = () => {
    document.setFontSize(8);
    document.setTextColor(80);
    document.text(project.name, margin, 8);
    document.text("MBSE / MBPLE Architecture Trade Study report", width - margin, 8, { align: "right" });
    document.setDrawColor(210);
    document.line(margin, 10, width - margin, 10);
  };
  const footer = () => {
    document.setFontSize(8);
    document.setTextColor(90);
    document.line(margin, height - 12, width - margin, height - 12);
    document.text(disclaimer, margin, height - 7);
    document.text(String(document.getNumberOfPages()), width - margin, height - 7, { align: "right" });
  };
  const page = () => {
    footer();
    document.addPage();
    header();
    y = 18;
  };
  const ensure = (needed: number) => {
    if (y + needed > height - 17) page();
  };
  const heading = (text: string, level = 1) => {
    ensure(level === 1 ? 14 : 10);
    document.setFont("helvetica", "bold");
    document.setTextColor(20);
    document.setFontSize(level === 1 ? 15 : 11);
    document.text(text, margin, y);
    y += level === 1 ? 8 : 6;
    document.setFont("helvetica", "normal");
  };
  const paragraph = (text: string, color = 55) => {
    document.setFontSize(9);
    document.setTextColor(color);
    const lines = document.splitTextToSize(text || "Not available.", contentWidth) as string[];
    ensure(lines.length * 4.2 + 2);
    document.text(lines, margin, y);
    y += lines.length * 4.2 + 3;
  };
  const rows = (items: Array<[string, string]>) => {
    items.forEach(([label, value]) => {
      const left = document.splitTextToSize(label, 42) as string[];
      const right = document.splitTextToSize(value || "Not available", contentWidth - 46) as string[];
      const lineCount = Math.max(left.length, right.length);
      ensure(lineCount * 4 + 2);
      document.setFontSize(8.5);
      document.setFont("helvetica", "bold");
      document.text(left, margin, y);
      document.setFont("helvetica", "normal");
      document.text(right, margin + 46, y);
      y += lineCount * 4 + 2;
    });
    y += 2;
  };

  header();
  document.setFont("helvetica", "bold");
  document.setFontSize(21);
  document.setTextColor(15);
  document.text(options.title?.trim() || `${project.name} — Architecture Trade Study report`, margin, y);
  y += 10;
  document.setFont("helvetica", "normal");
  paragraph(`Generated ${now.toISOString()} · schema ${project.schemaVersion} · model revision ${project.modelRevision}`);
  document.setFillColor(255, 248, 225);
  document.setDrawColor(230, 180, 70);
  document.roundedRect(margin, y, contentWidth, 13, 2, 2, "FD");
  document.setTextColor(115, 75, 10);
  document.setFontSize(9);
  document.text(disclaimer, margin + 4, y + 8);
  y += 19;

  heading("Purpose and scope");
  paragraph(project.description || "No project description.");
  rows([
    ["Export scope", options.scopeSummary],
    ["Objectives", objectiveProjection(project).join("; ") || "No objectives recorded."],
    ["Baseline architecture", project.architectures.find((item) => item.id === project.baselineArchitectureId)?.name ?? "Not established"],
    ["Selected architecture", project.architectures.find((item) => item.id === options.architectureId)?.name ?? "Not selected"],
    ["Selected configuration", project.configurations.find((item) => item.id === options.configurationId)?.name ?? "Not selected"]
  ]);

  heading("Model scope and quality");
  const errors = project.validationResults.filter((item) => item.severity === "error").length;
  const warnings = project.validationResults.filter((item) => item.severity === "warning").length;
  rows([
    ["Model content", `${project.elements.length} elements; ${project.relationships.length} relationships; ${project.configurations.length} configurations`],
    ["Traceability", `${project.relationships.length} canonical relationships retained`],
    ["Quality", `${errors} validation errors; ${warnings} warnings`]
  ]);
  if (options.includeValidation) {
    heading("Validation findings", 2);
    project.validationResults.slice(0, 30).forEach((item) =>
      paragraph(`${item.ruleId} [${item.severity.toUpperCase()}] ${item.message}`)
    );
  }

  heading("KPI definitions and simulation evidence");
  project.kpis.forEach((kpi) => rows([[
    `${kpi.name} (${kpi.id})`,
    `${kpi.calculationMode}; ${kpi.optimizationDirection}; unit ${kpi.outputUnit || "dimensionless"}; ${kpi.formula ?? kpi.standardAlgorithmKey ?? "No calculation"}`
  ]]));
  if (options.includeSimulationDetails) {
    project.simulationRuns.forEach((run) => {
      heading(run.name, 2);
      rows([
        ["Source", `${run.architectureId}; ${run.configurationId ?? "architecture-only"}; revision ${run.projectModelRevisionAtRun}; ${run.timestamp}`],
        ["Algorithms", run.results.map((result) => `${result.name}: ${result.value ?? "Not available"} ${result.unit}`).join("; ")],
        ["Warnings", run.warnings.join("; ") || "None"]
      ]);
    });
  }

  const study = project.comparisonStudies.find((item) => item.id === options.comparisonStudyId);
  const result = study?.results.find((item) => item.id === options.comparisonResultId) ?? study?.results.at(-1);
  heading("Architecture Trade Study framing");
  if (!study) {
    paragraph("No Trade Study selected.");
  } else {
    const openDecision = project.openDecisions.find((item) => item.id === study.originatingOpenDecisionId);
    rows([
      ["Trade Study", `${study.name} (${study.status})`],
      ["Decision question", study.question],
      ["Intended outcome", study.intendedOutcome],
      ["Originating open decision", openDecision?.question ?? "Not linked"],
      ["Lifecycle / system scope", `${study.lifecycleScope || "Not set"} / ${study.systemScope || "Not set"}`],
      ["Objectives", study.objectiveIds.map((id) => project.elements.find((item) => item.id === id)?.name ?? id).join("; ")],
      ["Mandatory requirements", study.mandatoryRequirementIds.map((id) => project.elements.find((item) => item.id === id)?.name ?? id).join("; ")],
      ["Explored features", study.exploredFeatureIds.map((id) => project.features.find((item) => item.id === id)?.name ?? id).join("; ")]
    ]);
    heading("Criteria and candidate readiness", 2);
    study.criteria.forEach((criterion) => rows([[
      `${criterion.name} (${criterion.type})`,
      `${criterion.description || "No description"}; KPI ${criterion.kpiId ?? "none"}; weight ${criterion.weight ?? "not set"}; fixed value function ${JSON.stringify(criterion.stakeholderValueFunction ?? "not set")}`
    ]]));
    tradeStudyReadiness(project, study).forEach((candidate) => rows([[
      candidate.label,
      `${candidate.state}; configuration ${candidate.configurationPresent ? "present" : "missing"}; validation ${candidate.validationReady ? "ready" : "blocked"}; derivation ${candidate.derivationReady ? "current" : "missing/stale"}; simulation ${candidate.simulationReady ? "current" : "missing/stale"}; KPI coverage ${candidate.kpiCoveragePercent}%`
    ]]));
    const warning = mixedEvidenceWarning(project, study);
    if (warning) paragraph(`Warning: ${warning}`, 130);
  }

  heading("Manager summary and Trade Study evidence");
  if (!study || !result) {
    paragraph("No Trade Study result selected or available.");
  } else {
    paragraph(result.methodology === "fixed-smart-mavt"
      ? "Mandatory requirements screen feasibility first. Feasible alternatives are then assessed for Pareto status and transformed through fixed 0–100 stakeholder value functions. Risk remains separate from the weighted value."
      : "Legacy relative score — depends on the alternatives included in this study.");
    const leaders = result.methodology === "fixed-smart-mavt"
      ? result.recommendedAlternativeIds ?? []
      : leadingAlternativeIds(result.weightedScores);
    const availableBars = study.alternativeRefs
      .map((alternative) => ({
        label: alternative.label,
        score: result.stakeholderValueScores?.[alternative.id] ?? result.weightedScores[alternative.id],
        coverage: result.dataCoveragePercent[alternative.id]
      }))
      .filter((item): item is { label: string; score: number; coverage: number } => typeof item.score === "number");
    availableBars.forEach((item) => {
      ensure(10);
      document.setFontSize(8);
      document.setTextColor(35);
      document.text(item.label, margin, y + 4);
      document.setFillColor(225, 232, 240);
      document.rect(margin + 48, y, contentWidth - 75, 5, "F");
      document.setFillColor(45, 110, 210);
      document.rect(margin + 48, y, (contentWidth - 75) * Math.min(100, Math.max(0, item.score)) / 100, 5, "F");
      document.text(`${item.score.toFixed(2)} · coverage ${item.coverage}%`, width - margin, y + 4, { align: "right" });
      y += 8;
    });
    paragraph(`${result.recommendationLabel ?? "Legacy relative score — depends on the alternatives included in this study."} ${leaders.map((id) => study.alternativeRefs.find((item) => item.id === id)?.label ?? id).join(", ") || "Not available"}.`);
    rows(study.alternativeRefs.map((alternative) => [
      alternative.label,
      `Feasibility ${result.feasibility?.[alternative.id]?.status ?? "legacy"}; Pareto ${result.pareto?.[alternative.id]?.status ?? "not available"}; raw ${JSON.stringify(result.rawValues[alternative.id] ?? {})}; fixed stakeholder values ${JSON.stringify(result.stakeholderValues?.[alternative.id] ?? {})}; weighted contributions ${JSON.stringify(result.weightedContributions?.[alternative.id] ?? {})}; stakeholder value ${result.stakeholderValueScores?.[alternative.id] ?? "Not available"}; coverage ${result.dataCoveragePercent[alternative.id] ?? 0}%`
    ]));
    heading("Mandatory compliance and Pareto evidence", 2);
    study.alternativeRefs.forEach((alternative) => {
      const feasibility = result.feasibility?.[alternative.id];
      const pareto = result.pareto?.[alternative.id];
      rows([[
        alternative.label,
        `${feasibility?.requirementEvidence.map((item) => `${item.requirementName}: ${item.status} (${item.evidence})`).join("; ") || "No fixed-method evidence."} Pareto: ${pareto?.explanation ?? "Not available."}`
      ]]);
    });
    rows([
      ["Thresholds", result.thresholdViolations.map((item) => `${item.severity}: ${item.message}`).join("; ") || "No violations."],
      ["Warnings", result.warnings.join("; ") || "None"]
    ]);
  }

  const decision = project.decisions.find((item) => item.id === options.decisionId);
  heading("Decision and rationale");
  if (!decision) paragraph("No formal decision selected.");
  else rows([
    ["Question", decision.question],
    ["Status", decision.status],
    ["Selected alternative", decision.selectedAlternative ?? "Not confirmed"],
    ["Criteria", decision.criteria.join("; ")],
    ["Rationale", decision.rationale ?? "Not available"],
    ["Open actions", decision.openActions.join("; ") || "None"],
    ["Baseline approval", decision.baselineApprovalConfirmed ? "Explicitly confirmed" : "Not confirmed"],
    ["Critical-risk justification", decision.criticalRiskJustification ?? "Not required or not recorded"],
    ["Evidence snapshot", decision.evidenceSnapshot
      ? `${decision.evidenceSnapshot.capturedAt}; model revision ${decision.evidenceSnapshot.projectModelRevision}; runs ${decision.evidenceSnapshot.simulationRunIds.join(", ")}`
      : "Not captured"]
  ]);

  heading("Risks and open actions");
  if (!options.includeRisks) paragraph("Risk detail excluded by report scope.");
  else {
    const risks = study
      ? project.comparisonRisks.filter((item) => item.comparisonStudyId === study.id)
      : project.comparisonRisks;
    if (!risks.length) paragraph("No Trade Study risks recorded.");
    const summaries = study ? summarizeRisks(project, study) : {};
    risks.forEach((risk) => rows([[
      risk.title,
      `Inherent ${risk.inherentLikelihood} x ${risk.inherentImpact} = ${risk.inherentLikelihood * risk.inherentImpact}; residual ${risk.residualLikelihood} x ${risk.residualImpact} = ${residualExposure(risk)}; ${risk.status}; owner ${risk.owner ?? "unassigned"}. ${risk.description} Mitigation: ${risk.mitigation ?? "Not recorded"}`
    ]]));
    if (study) rows(study.alternativeRefs.map((alternative) => [
      `${alternative.label} risk summary`,
      `Total residual ${summaries[alternative.id]?.totalResidualExposure ?? 0}; maximum residual ${summaries[alternative.id]?.maximumResidualExposure ?? 0}; unresolved high/critical ${summaries[alternative.id]?.unresolvedHighCriticalCount ?? 0}`
    ]));
  }
  if (study) {
    heading("Bounded robustness analysis");
    const robustness = study.robustnessResults?.at(-1);
    if (!robustness) paragraph("No bounded robustness result available.");
    else {
      paragraph(`${robustness.label}. Deterministic bounds only; this is not Monte Carlo and no probabilities are reported.`);
      rows(robustness.cases.map((item) => [
        item.name,
        `Leader(s): ${item.leadingAlternativeIds.join(", ") || "none"}; recommendation ${item.recommendationChanged ? "changed" : "stable"}; feasibility changes ${item.changedFeasibilityAlternativeIds.join(", ") || "none"}; Pareto changes ${item.changedParetoAlternativeIds.join(", ") || "none"}. ${item.notes.join(" ")}`
      ]));
    }
  }
  footer();
  return document;
}

export function pdfArrayBuffer(project: Project, options: PdfReportOptions): ArrayBuffer {
  return buildPdfReport(project, options).output("arraybuffer");
}
