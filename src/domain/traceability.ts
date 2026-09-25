import { assessRequirement } from "./requirementAssessment";
import { processFunctionFlowStatus, processFunctionSequenceComplete } from "./processFlows";
import { calculateSemanticScope, semanticScopeElementIds } from "./semanticScope";
import type { ElementType, ModelElement, Project } from "./types";

export interface SatisfactionState {
  elementId: string;
  status: "satisfied" | "failed" | "pending";
  reasons: string[];
}

const targets = (project: Project, sourceId: string, relationshipType: string, type?: ElementType) =>
  project.relationships
    .filter((relationship) => relationship.sourceId === sourceId && relationship.relationshipType === relationshipType)
    .map((relationship) => project.elements.find((element) => element.id === relationship.targetId))
    .filter((element): element is ModelElement => element !== undefined)
    .filter((element) => !type || element.elementType === type);

export function satisfactionEvidence(project: Project, requirement: ModelElement, type: ElementType): ModelElement[] {
  const direct = targets(project, requirement.id, "satisfiedBy", type);
  const unique = (items: ModelElement[]) => [...new Map(items.map((item) => [item.id, item])).values()];
  if (type === "productComponent") {
    return unique([
      ...direct,
      ...targets(project, requirement.id, "satisfiedBy", "productFunction")
        .flatMap((item) => targets(project, item.id, "realizedBy", "productComponent"))
    ]);
  }
  if (type === "productFunction") {
    const components = targets(project, requirement.id, "satisfiedBy", "productComponent");
    const inferred = project.relationships
      .filter((relationship) => relationship.relationshipType === "realizedBy" && components.some((item) => item.id === relationship.targetId))
      .map((relationship) => project.elements.find((element) => element.id === relationship.sourceId))
      .filter((element): element is ModelElement => element?.elementType === "productFunction");
    return unique([...direct, ...inferred]);
  }
  if (type === "industrialSystemComponent") {
    return unique([
      ...direct,
      ...targets(project, requirement.id, "satisfiedBy", "processFunction")
        .flatMap((item) => targets(project, item.id, "realizedBy", "industrialSystemComponent"))
    ]);
  }
  if (type === "processFunction") {
    const components = targets(project, requirement.id, "satisfiedBy", "industrialSystemComponent");
    const inferred = project.relationships
      .filter((relationship) => relationship.relationshipType === "realizedBy" && components.some((item) => item.id === relationship.targetId))
      .map((relationship) => project.elements.find((element) => element.id === relationship.sourceId))
      .filter((element): element is ModelElement => element?.elementType === "processFunction");
    return unique([...direct, ...inferred]);
  }
  return direct;
}

export function workingScopeElementIds(project: Project): Set<string> {
  if (!project.selectedUseCaseIds.length) return new Set(project.elements.map((element) => element.id));
  const result = semanticScopeElementIds(calculateSemanticScope(project));
  let changed = true;
  while (changed) {
    changed = false;
    project.relationships.forEach((relationship) => {
      if (
        ["hasFunction", "satisfiedBy", "verifies", "realizedBy", "connects", "refines", "allocatedTo", "requiresResource", "consumes", "produces"].includes(relationship.relationshipType)
        && (result.has(relationship.sourceId) || result.has(relationship.targetId))
      ) {
        if (!result.has(relationship.sourceId)) { result.add(relationship.sourceId); changed = true; }
        if (!result.has(relationship.targetId)) { result.add(relationship.targetId); changed = true; }
      }
    });
  }
  return result;
}

export function requirementSatisfaction(project: Project, requirement: ModelElement): SatisfactionState {
  const reasons: string[] = [];
  const satisfactionTypes: ElementType[] = [
    "productFunction",
    "productComponent",
    "processFunction",
    "industrialSystemComponent"
  ];
  const hasElementEvidence = satisfactionTypes.some((type) => satisfactionEvidence(project, requirement, type).length > 0);
  const hasParameterEvidence = requirement.requirementFormula?.bindings.some((binding) =>
    binding.kind === "parameter"
    && project.elements.some((owner) => owner.parameters.some((parameter) => parameter.id === binding.targetId))
  ) ?? false;
  if (!hasElementEvidence && !hasParameterEvidence) reasons.push("No satisfying function, technical component or owned parameter is linked.");
  const evaluation = assessRequirement(project, requirement);
  if (["notChecked", "needsUpdate"].includes(evaluation.status)) return { elementId: requirement.id, status: "pending", reasons: [...reasons, evaluation.label] };
  if (evaluation.status === "notMet") reasons.push(evaluation.detail);
  return { elementId: requirement.id, status: reasons.length ? "failed" : "satisfied", reasons: evaluation.status === "assumed" ? [...reasons, evaluation.label] : reasons };
}

export function needOrObjectiveSatisfaction(project: Project, element: ModelElement): SatisfactionState {
  const requirements = targets(project, element.id, "derives", "systemRequirement");
  if (!requirements.length) return { elementId: element.id, status: "failed", reasons: ["No derived requirements."] };
  const results = requirements.map((requirement) => requirementSatisfaction(project, requirement));
  const pending = results.some((result) => result.status === "pending");
  const failed = results.some((result) => result.status !== "satisfied");
  return {
    elementId: element.id,
    status: pending ? "pending" : failed ? "failed" : "satisfied",
    reasons: results.flatMap((result) => result.status === "satisfied" ? [] : result.reasons)
  };
}

export function missionSatisfaction(project: Project, mission: ModelElement): SatisfactionState {
  const stakeholders = targets(project, mission.id, "hasStakeholder", "stakeholder");
  const scope = stakeholders.flatMap((stakeholder) => [
    ...targets(project, stakeholder.id, "hasNeed", "need"),
    ...targets(project, stakeholder.id, "hasObjective", "objective")
  ]);
  if (!stakeholders.length || !scope.length) {
    return { elementId: mission.id, status: "failed", reasons: ["The mission has no complete stakeholder need/objective scope."] };
  }
  const results = scope.map((element) => needOrObjectiveSatisfaction(project, element));
  const pending = results.some((result) => result.status === "pending");
  const failed = results.some((result) => result.status !== "satisfied");
  return {
    elementId: mission.id,
    status: pending ? "pending" : failed ? "failed" : "satisfied",
    reasons: results.flatMap((result) => result.status === "satisfied" ? [] : result.reasons)
  };
}

export interface WorkflowStep {
  id: string;
  label: string;
  complete: number;
  total: number;
  detail: string;
}

export function calculateWorkflowProgress(project: Project): WorkflowStep[] {
  const ofType = (type: ElementType) => project.elements.filter((element) => element.elementType === type);
  const completeBy = (items: ModelElement[], predicate: (element: ModelElement) => boolean) =>
    items.filter(predicate).length;
  const hasOutgoing = (element: ModelElement, relationshipType: string, targetType?: ElementType) =>
    targets(project, element.id, relationshipType, targetType).length > 0;
  const missions = ofType("mission");
  const stakeholders = ofType("stakeholder");
  const useCases = ofType("useCase");
  const needsObjectives = [...ofType("need"), ...ofType("objective")];
  const scopeIds = workingScopeElementIds(project);
  const requirements = ofType("systemRequirement").filter((element) => scopeIds.has(element.id));
  const productFunctions = ofType("productFunction").filter((element) => scopeIds.has(element.id));
  const processFunctions = ofType("processFunction").filter((element) => scopeIds.has(element.id));
  const productComponents = ofType("productComponent");
  const industrialComponents = ofType("industrialSystemComponent");
  const selectedUseCases = useCases.filter((element) => project.selectedUseCaseIds.includes(element.id));
  return [
    { id: "missions", label: "1. Missions", complete: missions.length, total: Math.max(1, missions.length), detail: "Identify one or more missions." },
    { id: "context", label: "2. Stakeholders, needs and objectives", complete: stakeholders.length + needsObjectives.length, total: Math.max(1, stakeholders.length + needsObjectives.length), detail: "Define the stakeholder context." },
    { id: "mission-stakeholders", label: "3. Mission trace", complete: completeBy(stakeholders, (element) => project.relationships.some((relationship) => relationship.relationshipType === "hasStakeholder" && relationship.targetId === element.id)), total: stakeholders.length, detail: "Trace every stakeholder to at least one mission." },
    { id: "use-cases", label: "4. Use-case involvement", complete: completeBy(useCases, (element) => project.relationships.some((relationship) => relationship.relationshipType === "involvedIn" && relationship.targetId === element.id)), total: useCases.length, detail: "Connect stakeholders and use cases." },
    { id: "soi", label: "5. Mission to system of interest", complete: ofType("system").length === 1 && project.relationships.some((relationship) => relationship.relationshipType === "hasSOI" && relationship.targetId === ofType("system")[0].id && missions.some((mission) => mission.id === relationship.sourceId)) ? 1 : 0, total: 1, detail: "Define exactly one system of interest and connect it from the mission with hasSOI." },
    { id: "working-scope", label: "6. Working use cases", complete: selectedUseCases.length, total: Math.max(1, selectedUseCases.length), detail: "Select one or more use cases involving the system of interest." },
    { id: "requirements", label: "7. System requirements", complete: completeBy(needsObjectives.filter((element) => scopeIds.has(element.id)), (element) => hasOutgoing(element, "derives", "systemRequirement")), total: needsObjectives.filter((element) => scopeIds.has(element.id)).length, detail: "Derive requirements from scoped needs and objectives." },
    { id: "product-functions", label: "8. Product functional architecture", complete: productFunctions.length, total: Math.max(1, productFunctions.length), detail: "Define product functions, hierarchy, interfaces and sequences." },
    { id: "product-has-function", label: "9. Use case → product function", complete: completeBy(selectedUseCases, (element) => hasOutgoing(element, "hasFunction", "productFunction")), total: selectedUseCases.length, detail: "Connect selected use cases using hasFunction." },
    { id: "requirement-product-function", label: "10. Requirement → product function", complete: completeBy(requirements, (element) => satisfactionEvidence(project, element, "productFunction").length > 0), total: requirements.length, detail: "Add satisfaction evidence for product functions." },
    { id: "product-components", label: "11. Product technical architecture", complete: productComponents.length, total: Math.max(1, productComponents.length), detail: "Define product components, hierarchy, parameters and interfaces." },
    { id: "product-realization", label: "12. Product realization", complete: completeBy(productFunctions, (element) => hasOutgoing(element, "realizedBy", "productComponent")), total: productFunctions.length, detail: "Realize product functions with components." },
    { id: "requirement-product-component", label: "13. Requirement → product component", complete: completeBy(requirements, (element) => satisfactionEvidence(project, element, "productComponent").length > 0), total: requirements.length, detail: "Confirm direct or propagated product-component evidence." },
    { id: "process-functions", label: "14. Process functional architecture", complete: processFunctions.length, total: Math.max(1, processFunctions.length), detail: "Define process functions, hierarchy, interfaces and sequences." },
    { id: "process-has-function", label: "15. Use case → process function", complete: completeBy(selectedUseCases, (element) => hasOutgoing(element, "hasFunction", "processFunction")), total: selectedUseCases.length, detail: "Connect selected use cases using hasFunction." },
    { id: "process-item-flows", label: "16. Product inputs and outputs", complete: completeBy(processFunctions, (element) => processFunctionFlowStatus(project, element.id).complete), total: processFunctions.length, detail: "Define valid consumed and produced product flows for each process role." },
    { id: "process-sequence", label: "17. Process sequence and handoffs", complete: completeBy(processFunctions, (element) => processFunctionSequenceComplete(project, element.id)), total: processFunctions.length, detail: "Sequence process functions and match every predecessor output to a successor input." },
    { id: "requirement-process-function", label: "18. Requirement → process function", complete: completeBy(requirements, (element) => satisfactionEvidence(project, element, "processFunction").length > 0), total: requirements.length, detail: "Add satisfaction evidence for process functions." },
    { id: "industrial-components", label: "19. Process technical architecture", complete: industrialComponents.length, total: Math.max(1, industrialComponents.length), detail: "Define industrial components, hierarchy, parameters and interfaces." },
    { id: "process-realization", label: "20. Process realization", complete: completeBy(processFunctions, (element) => hasOutgoing(element, "realizedBy", "industrialSystemComponent")), total: processFunctions.length, detail: "Realize process functions with industrial components." },
    { id: "requirement-industrial-component", label: "21. Requirement → industrial component", complete: completeBy(requirements, (element) => satisfactionEvidence(project, element, "industrialSystemComponent").length > 0), total: requirements.length, detail: "Confirm direct or propagated industrial-component evidence." },
    { id: "validation", label: "22. System validation", complete: needsObjectives.filter((element) => needOrObjectiveSatisfaction(project, element).status === "satisfied").length, total: needsObjectives.length, detail: "Validate traceability and formula results." },
    { id: "mission-fulfillment", label: "23. Mission fulfillment", complete: missions.filter((mission) => missionSatisfaction(project, mission).status === "satisfied").length, total: missions.length, detail: "All linked needs and objectives must be fulfilled." }
  ];
}

