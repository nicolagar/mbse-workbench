import type { ModelElement, Project } from "./types";

export const systemOfInterest = (project: Project) => project.elements.find((item) => item.elementType === "system");
export const missionForSystem = (project: Project, systemId: string) => {
  const missionId = project.relationships.find((relationship) =>
    relationship.relationshipType === "hasSOI" && relationship.targetId === systemId
  )?.sourceId;
  return project.elements.find((item) => item.id === missionId && item.elementType === "mission");
};
export const isSystemUseCase = (project: Project, useCase: ModelElement) => useCase.metadata.subjectSystemId === systemOfInterest(project)?.id;

/** Retains IDs and changes live model semantics only. Historical run/decision snapshots are never rewritten. */
export function normalizeOntology(project: Project): Project {
  const legacyOntology = project.schemaVersion < 10;
  let ontologyChanged = project.schemaVersion < 13;
  const systems = project.elements.filter((item) => item.elementType === "system" || (item.elementType === "stakeholder" && item.metadata.isSystemOfInterest));
  for (const system of systems) {
    system.elementType = "system";
    system.metadata.isSystemOfInterest = true;
    system.metadata.systemBoundary ??= system.description;
    const existingHasSoi = project.relationships.find((edge) => edge.targetId === system.id && edge.relationshipType === "hasSOI");
    const legacyStakeholderEdge = project.relationships.find((edge) => edge.targetId === system.id && edge.relationshipType === "hasStakeholder");
    const missionId = existingHasSoi?.sourceId ?? system.metadata.missionId ?? legacyStakeholderEdge?.sourceId;
    const missionExists = project.elements.some((item) => item.id === missionId && item.elementType === "mission");
    if (!existingHasSoi && missionId && missionExists) {
      if (legacyStakeholderEdge) {
        legacyStakeholderEdge.relationshipType = "hasSOI";
        legacyStakeholderEdge.name ??= "Has system of interest";
        legacyStakeholderEdge.description ??= "Identifies the system of interest governed by this mission.";
        legacyStakeholderEdge.creationOrigin ??= "migration";
        legacyStakeholderEdge.updatedAt = project.updatedAt;
      } else {
        project.relationships.push({
          id: `relationship-has-soi-${system.id}`,
          relationshipType: "hasSOI",
          sourceId: missionId,
          targetId: system.id,
          name: "Has system of interest",
          description: "Identifies the system of interest governed by this mission.",
          creationOrigin: "migration",
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        });
      }
      ontologyChanged = true;
    }
    if (system.metadata.missionId !== undefined) {
      delete system.metadata.missionId;
      ontologyChanged = true;
    }
    for (const edge of project.relationships.filter((edge) => edge.sourceId === system.id && edge.relationshipType === "involvedIn")) {
      const useCase = project.elements.find((item) => item.id === edge.targetId && item.elementType === "useCase");
      if (useCase) useCase.metadata.subjectSystemId = system.id;
    }
  }
  const systemIds = new Set(systems.map((item) => item.id));
  project.relationships = project.relationships.filter((edge) => !(edge.relationshipType === "hasStakeholder" && systemIds.has(edge.targetId)) && !(edge.relationshipType === "involvedIn" && systemIds.has(edge.sourceId)));
  for (const edge of project.relationships.filter((item) => legacyOntology && item.relationshipType === "refines")) {
    const source = project.elements.find((item) => item.id === edge.sourceId), target = project.elements.find((item) => item.id === edge.targetId);
    if (source && target && source.elementType === target.elementType && ["productComponent", "industrialSystemComponent"].includes(source.elementType)) edge.containment ??= true;
  }
  for (const component of project.elements.filter((item) => ["productComponent", "industrialSystemComponent"].includes(item.elementType))) {
    component.metadata.parentAssemblyId = project.relationships.find((edge) => edge.containment && edge.sourceId === component.id)?.targetId;
  }
  for (const requirement of project.elements.filter((item) => item.elementType === "systemRequirement")) {
    const formula = requirement.requirementFormula;
    if (formula) {
      formula.bindingUnits ??= {};
      for (const binding of formula.bindings) {
        const unit = binding.kind === "parameter"
          ? project.elements.flatMap((item) => item.parameters).find((item) => item.id === binding.targetId)?.unit
          : project.kpis.find((item) => item.id === binding.targetId)?.outputUnit;
        // An unfinished binding must not freeze a missing unit as dimensionless.
        if (unit !== undefined) formula.bindingUnits[binding.symbol] ??= unit;
      }
    }
    if (formula?.expression.trim() && formula.comparisonUnit === undefined) {
      const binding = formula.bindings[0];
      formula.comparisonUnit = binding ? formula.bindingUnits?.[binding.symbol] : undefined;
    }
  }
  for (const study of project.comparisonStudies) {
    study.baselineRequirementIds ??= project.elements.filter((item) => item.elementType === "systemRequirement").map((item) => item.id);
    study.referenceArchitectureId ??= project.architectures.find((item) => item.status === "baseline")?.id ?? project.activeArchitectureId;
  }
  project.schemaVersion = 14;
  if (ontologyChanged) project.modelRevision += 1;
  return project;
}

export function setParentAssembly(project: Project, childId: string, parentId?: string): void {
  const child = project.elements.find((item) => item.id === childId);
  if (!child) return;
  const existing = project.relationships.find((edge) => edge.sourceId === childId && edge.containment);
  project.relationships = project.relationships.filter((edge) => !(edge.sourceId === childId && edge.containment));
  child.metadata.parentAssemblyId = parentId;
  if (parentId) project.relationships.push({ id: existing?.id ?? `containment-${childId}`, relationshipType: "refines", containment: true, sourceId: childId, targetId: parentId, name: "Part of", description: "Physical containment: child part to parent assembly.", createdAt: existing?.createdAt ?? project.createdAt, updatedAt: project.updatedAt });
}

export function baselineRequirementIds(project: Project, study: Project["comparisonStudies"][number]): string[] {
  // A focus selector must never remove obligations, including a missing previously baselined requirement.
  return [...new Set([...(study.baselineRequirementIds ?? []), ...study.mandatoryRequirementIds, ...project.elements.filter((item) => item.elementType === "systemRequirement").map((item) => item.id)])];
}

export function physicalHierarchyErrors(elements: ModelElement[]): string[] {
  const errors: string[] = [];
  for (const element of elements.filter((item) => item.metadata.parentAssemblyId)) {
    const seen = new Set([element.id]);
    let current: ModelElement | undefined = element;
    while (current?.metadata.parentAssemblyId) {
      const parentId: string = current.metadata.parentAssemblyId;
      if (seen.has(parentId)) { errors.push(`${element.name}: physical containment contains a cycle.`); break; }
      seen.add(parentId);
      const parent: ModelElement | undefined = elements.find((item) => item.id === parentId);
      if (!parent || parent.elementType !== element.elementType || !["productComponent", "industrialSystemComponent"].includes(parent.elementType)) {
        errors.push(`${element.name}: parent assembly is missing or has an incompatible type.`); break;
      }
      current = parent;
    }
  }
  return [...new Set(errors)];
}
