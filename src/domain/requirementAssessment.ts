import { recalculateCalculatedParameters } from "./calculatedParameters";
import { evaluateRequirement } from "./formulas";
import { calculateSelectedKpis } from "./presizing";
import { applyVariationPoints } from "./variationPoints";
import { validateConfiguration } from "./variability";
import type { ModelElement, Project, RequirementReview, SimulationResult } from "./types";

export interface RequirementAssessment {
  status: "met" | "notMet" | "assumed" | "notChecked" | "needsUpdate";
  label: string;
  detail: string;
  basis: "calculation" | "review" | "assumption" | "none";
}

/** Selects a model context without mutating live inputs or historical evidence. */
export function assessmentModel(project: Project, configurationId?: string): { project: Project; errors: string[]; results: SimulationResult[] } {
  const configuration = project.configurations.find((item) => item.id === configurationId);
  if (configurationId && !configuration) return { project: { ...project, elements: [], relationships: [] }, errors: ["Configuration is missing."], results: [] };
  const variation = configuration ? applyVariationPoints(project, configuration, project) : undefined;
  const selectedElements = structuredClone(variation?.elements ?? project.elements).map((element) => ({
    ...element,
    parameters: element.parameters.filter((parameter) =>
      parameter.applicableConfigurationIds.length === 0
      || (!!configurationId && parameter.applicableConfigurationIds.includes(configurationId))
    )
  }));
  let effective = recalculateCalculatedParameters({ ...project, elements: selectedElements, relationships: structuredClone(variation?.relationships ?? project.relationships), kpis: structuredClone(project.kpis) });
  const calculated = calculateSelectedKpis(effective, { elements: effective.elements, relationships: effective.relationships, configurationId }, effective.kpis.map((item) => item.id));
  effective = { ...effective, kpis: effective.kpis.map((kpi) => ({ ...kpi, lastCalculatedValue: calculated.results.find((item) => item.kpiId === kpi.id)?.value ?? null })) };
  return { project: effective, errors: [...(variation?.errors ?? []), ...(configuration ? validateConfiguration(project, configuration).filter((item) => item.severity === "error").map((item) => item.message) : [])], results: calculated.results };
}

export function requirementDependencySignature(project: Project, requirement: ModelElement): string {
  const ids = new Set([requirement.id]);
  for (const binding of requirement.requirementFormula?.bindings ?? []) {
    project.elements.filter((item) => item.parameters.some((parameter) => parameter.id === binding.targetId)).forEach((item) => ids.add(item.id));
  }
  let changed = true;
  const follows = ["satisfiedBy", "realizedBy", "refines", "connects", "consumes", "produces", "requiresResource", "allocatedTo", "verifies"];
  while (changed) {
    changed = false;
    for (const edge of project.relationships.filter((edge) => follows.includes(edge.relationshipType))) {
      // Never traverse through a different requirement and claim its evidence.
      if (edge.relationshipType === "satisfiedBy" && edge.sourceId !== requirement.id) continue;
      if (edge.relationshipType === "verifies" && edge.targetId !== requirement.id) continue;
      if (!ids.has(edge.sourceId) && !ids.has(edge.targetId)) continue;
      for (const id of [edge.sourceId, edge.targetId]) if (!ids.has(id)) { ids.add(id); changed = true; }
    }
  }
  const content = JSON.stringify({
    definition: [requirement.name, requirement.description, requirement.requirementFormula],
    elements: project.elements.filter((item) => ids.has(item.id)).sort((a, b) => a.id.localeCompare(b.id)).map((item) => [item.id, item.elementType, item.description, item.metadata.parentAssemblyId, item.parameters.map((p) => [p.id, p.value, p.unit, p.contributionBasis, p.quantityBasis]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]),
    links: project.relationships.filter((edge) => ids.has(edge.sourceId) && ids.has(edge.targetId)).map((edge) => [edge.relationshipType, edge.sourceId, edge.targetId, edge.quantity, edge.requiredQuantity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  });
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

export function assessRequirement(project: Project, requirement: ModelElement, configurationId?: string): RequirementAssessment {
  if (requirement.requirementFormula?.expression.trim()) {
    const result = evaluateRequirement(project, requirement);
    const values = requirement.requirementFormula.bindings.map((binding) => {
      const parameter = project.elements.flatMap((item) => item.parameters).find((item) => item.id === binding.targetId);
      const kpi = project.kpis.find((item) => item.id === binding.targetId);
      return `${parameter?.name ?? kpi?.name ?? binding.symbol}: ${parameter?.value ?? kpi?.lastCalculatedValue ?? "missing"} ${parameter?.unit ?? kpi?.outputUnit ?? ""}`;
    }).join("; ");
    const status = result.status === "satisfied" ? "met" : result.status === "failed" ? "notMet" : "notChecked";
    return { status, label: status === "met" ? "Met — calculated" : status === "notMet" ? "Not met — calculated" : "Not checked — missing or invalid inputs", detail: `${values}. ${result.expression ?? ""}${requirement.requirementFormula.comparisonUnit ? ` (limit in ${requirement.requirementFormula.comparisonUnit})` : ""}. ${status === "notChecked" ? result.message : "Preliminary engineering estimate."}`, basis: "calculation" };
  }
  const reviews = requirement.metadata.requirementReviews;
  const review = reviews?.[configurationId ?? "model"] ?? reviews?.model;
  if (!review || review.result === "notChecked") return { status: "notChecked", label: "Not checked", detail: "A model link or a planned check method is not a completed check.", basis: "none" };
  if (review.dependencySignature !== requirementDependencySignature(project, requirement)) return { status: "needsUpdate", label: "Needs update", detail: "The requirement or its connected design changed since this review.", basis: review.result === "assumed" ? "assumption" : "review" };
  return {
    status: review.result,
    label: review.result === "assumed" ? "Assumed met — demonstrator baseline" : review.result === "met" ? "Met — design review" : "Not met — design review",
    detail: review.note ?? requirement.metadata.evidenceReviewNote ?? "Recorded model review.",
    basis: review.result === "assumed" ? "assumption" : "review"
  };
}

export function recordRequirementReview(project: Project, requirementId: string, result: RequirementReview["result"], configurationId?: string): void {
  const requirement = project.elements.find((item) => item.id === requirementId);
  if (!requirement) return;
  const context = configurationId ? assessmentModel(project, configurationId).project : project;
  const effective = context.elements.find((item) => item.id === requirementId);
  if (!effective) return;
  requirement.metadata.requirementReviews = { ...requirement.metadata.requirementReviews, [configurationId ?? "model"]: { result, dependencySignature: requirementDependencySignature(context, effective), note: requirement.metadata.evidenceReviewNote ?? requirement.metadata.source } };
  requirement.metadata.evidenceReviewStatus = result === "notChecked" ? "pending" : "confirmed";
}

/** Declared illustrative assumptions, created only by the bundled sample builders. */
export function seedSampleReviews(project: Project): void {
  for (const requirement of project.elements.filter((item) => item.elementType === "systemRequirement" && !item.requirementFormula?.expression.trim())) {
    requirement.metadata.evidenceReviewNote = "Assumed acceptable for this educational sample; no physical verification or certification credit.";
    recordRequirementReview(project, requirement.id, "assumed");
  }
  for (const configuration of project.configurations) {
    const context = assessmentModel(project, configuration.id).project;
    for (const requirement of context.elements.filter((item) => item.elementType === "systemRequirement" && !item.requirementFormula?.expression.trim())) {
      const original = project.elements.find((item) => item.id === requirement.id)!;
      original.metadata.requirementReviews = { ...original.metadata.requirementReviews, [configuration.id]: { result: "assumed", dependencySignature: requirementDependencySignature(context, requirement), note: original.metadata.evidenceReviewNote } };
    }
  }
}
