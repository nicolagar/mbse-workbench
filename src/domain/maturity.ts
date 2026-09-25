import { calculateTraceabilityMetrics } from "./metrics";
import type { Project } from "./types";

export interface MaturityComponent {
  label: string; numerator: number; denominator: number; value: number | null; weight: number; explanation: string;
}
export interface MaturityResult { completeness: MaturityComponent; traceability: MaturityComponent; approval: MaturityComponent; overall: number | null; formula: string; }

export function calculateMaturity(project: Project): MaturityResult {
  let required = 0;
  let complete = 0;
  const add = (ok: boolean) => { required += 1; if (ok) complete += 1; };
  for (const element of project.elements) {
    add(Boolean(element.name.trim()));
    add(Boolean(element.description.trim()));
    add(Boolean(element.status));
    for (const parameter of element.parameters) {
      if (parameter.dataType === "number" && parameter.value !== null) add(Boolean(parameter.unit?.trim()));
    }
    if (element.elementType === "processFunction") {
      add(Boolean(element.metadata.duration && element.metadata.duration > 0));
      add(Boolean(element.metadata.durationUnit));
    }
    for (const definition of project.customAttributeDefinitions.filter((item) => item.elementType === element.elementType && item.required)) {
      const value = element.customAttributeValues[definition.id];
      add(value !== null && value !== undefined && value !== "");
    }
    if (element.architectureScope === "specific") add(Boolean(element.architectureId && project.architectures.some((a) => a.id === element.architectureId)));
  }
  const usedResources = new Set(project.relationships.filter((r) => r.relationshipType === "requiresResource").map((r) => r.targetId));
  for (const resourceId of usedResources) {
    const rate = project.elements.find((e) => e.id === resourceId)?.metadata.hourlyRate;
    add(Number.isFinite(rate) && (rate ?? -1) >= 0);
  }
  const approved = project.elements.filter((e) => e.status === "approved").length;
  const endToEnd = calculateTraceabilityMetrics(project).find((m) => m.id === "end-to-end")!;
  const completenessValue = required ? Math.round((complete / required) * 100) : null;
  const approvalValue = project.elements.length ? Math.round((approved / project.elements.length) * 100) : null;
  const components = [
    { value: completenessValue, weight: 0.4 },
    { value: endToEnd.value, weight: 0.4 },
    { value: approvalValue, weight: 0.2 }
  ].filter((component): component is { value: number; weight: number } => component.value !== null);
  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  const overall = weightTotal ? Math.round(components.reduce((sum, component) => sum + component.value * component.weight, 0) / weightTotal) : null;
  return {
    completeness: { label: "Model completeness", numerator: complete, denominator: required, value: completenessValue, weight: 0.4, explanation: "Completed applicable required fields / all applicable required fields" },
    traceability: { label: "Validated traceability", numerator: endToEnd.numerator, denominator: endToEnd.denominator, value: endToEnd.value, weight: 0.4, explanation: "Satisfied needs and objectives / total needs and objectives" },
    approval: { label: "Approval maturity", numerator: approved, denominator: project.elements.length, value: approvalValue, weight: 0.2, explanation: "Approved elements / total elements" },
    overall,
    formula: "40% completeness + 40% end-to-end traceability + 20% approval maturity; unavailable components are excluded and weights renormalized."
  };
}
