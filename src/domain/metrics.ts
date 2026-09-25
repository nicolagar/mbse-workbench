import { satisfactionEvidence } from "./traceability";
import type { ElementType, Project, RelationshipType } from "./types";

export interface TraceabilityMetric {
  id: string;
  label: string;
  numerator: number;
  denominator: number;
  value: number | null;
  formula: string;
  explanation?: string;
}

const linked = (project: Project, sourceId: string, relationship: RelationshipType, otherType: ElementType) =>
  project.relationships.some((edge) =>
    edge.relationshipType === relationship
    && edge.sourceId === sourceId
    && project.elements.find((element) => element.id === edge.targetId)?.elementType === otherType
  );

const processHasResourceThroughIndustrialComponent = (project: Project, processId: string) => {
  const realizingComponentIds = project.relationships
    .filter((relationship) => relationship.relationshipType === "realizedBy" && relationship.sourceId === processId)
    .map((relationship) => relationship.targetId)
    .filter((componentId) => project.elements.some((element) => element.id === componentId && element.elementType === "industrialSystemComponent"));
  return realizingComponentIds.some((componentId) => linked(project, componentId, "requiresResource", "resource"));
};

const metric = (id: string, label: string, numerator: number, denominator: number, formula: string): TraceabilityMetric => ({
  id,
  label,
  numerator,
  denominator,
  value: denominator ? Math.round((numerator / denominator) * 100) : null,
  formula,
  explanation: denominator ? undefined : "Not available because no applicable source elements exist."
});

export function hasEndToEndPath(project: Project, needId: string): boolean {
  const element = project.elements.find((candidate) => candidate.id === needId);
  if (!element || !["need", "objective"].includes(element.elementType)) return false;
  const requirements = project.relationships.filter((edge) => edge.sourceId === needId && edge.relationshipType === "derives").map((edge) => project.elements.find((item) => item.id === edge.targetId)).filter((item) => item?.elementType === "systemRequirement");
  return requirements.length > 0 && requirements.every((requirement) => project.relationships.some((edge) => edge.sourceId === requirement!.id && edge.relationshipType === "satisfiedBy"));
}

export function calculateTraceabilityMetrics(project: Project): TraceabilityMetric[] {
  const ofType = (type: ElementType) => project.elements.filter((element) => element.elementType === type);
  const needsObjectives = [...ofType("need"), ...ofType("objective")];
  const requirements = ofType("systemRequirement");
  const productFunctions = ofType("productFunction");
  const processFunctions = ofType("processFunction");
  const allFunctions = [...productFunctions, ...processFunctions];
  const components = [...ofType("productComponent"), ...ofType("industrialSystemComponent")];
  return [
    metric("needs", "Need/objective coverage", needsObjectives.filter((element) => linked(project, element.id, "derives", "systemRequirement")).length, needsObjectives.length, "needs and objectives linked to requirements / total needs and objectives × 100"),
    metric("requirements", "Requirement allocation coverage", requirements.filter((element) => project.relationships.some((edge) => edge.sourceId === element.id && edge.relationshipType === "satisfiedBy")).length, requirements.length, "requirements with an explicit design allocation / total requirements × 100"),
    metric("functions", "Function realization coverage", allFunctions.filter((element) => element.elementType === "productFunction" ? linked(project, element.id, "realizedBy", "productComponent") : linked(project, element.id, "realizedBy", "industrialSystemComponent")).length, allFunctions.length, "realized product and process functions / total functions × 100"),
    metric("architecture", "Requirement realization trace", requirements.filter((element) => ["productComponent", "industrialSystemComponent"].some((type) => satisfactionEvidence(project, element, type as ElementType).length > 0)).length, requirements.length, "requirements connected to a product or industrial component / total requirements × 100"),
    metric("processes", "Process-to-resource coverage", processFunctions.filter((element) => processHasResourceThroughIndustrialComponent(project, element.id)).length, processFunctions.length, "process functions realized by resource-supported industrial-system components / total process functions × 100"),
    metric("end-to-end", "Intent-to-design traceability", needsObjectives.filter((element) => hasEndToEndPath(project, element.id)).length, needsObjectives.length, "needs and objectives whose derived requirements have design allocations / total needs and objectives × 100")
  ];
}

