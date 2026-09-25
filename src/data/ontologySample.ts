import { normalizeOntology, systemOfInterest, setParentAssembly } from "../domain/ontology";
import { seedSampleReviews } from "../domain/requirementAssessment";
import { applySelectionToConfiguration } from "../domain/variability";
import type { Project } from "../domain/types";

export function prepareOntologySample(project: Project): void {
  normalizeOntology(project);
  const system = systemOfInterest(project);
  if (system) {
    const rootId = system.metadata.architectureRootId ?? `${system.id}-assembly`;
    system.metadata.architectureRootId = rootId;
    let root = project.elements.find((item) => item.id === rootId);
    if (!root) {
      root = { id: rootId, elementType: "productComponent", name: `${system.name} assembly`, description: "Complete modeled product assembly; its child contributions define its mass.", status: "reviewed", architectureScope: "common", parameters: [], customAttributeValues: {}, tags: ["sample-assembly"], metadata: { creationOrigin: "sample", massAccounting: "includedElsewhere", massAccountingNote: "Mass is represented by the declared child contributions." }, createdAt: project.createdAt, updatedAt: project.updatedAt };
      project.elements.push(root);
    }
    root.name = `${system.name} assembly`;
    for (const component of project.elements.filter((item) => item.elementType === "productComponent" && item.id !== rootId)) {
      const representsLifecycleState = component.tags.includes("lifecycle-state");
      if (!component.metadata.parentAssemblyId && component.metadata.massAccounting !== "outsideBoundary" && !representsLifecycleState) setParentAssembly(project, component.id, rootId);
      const masses = component.parameters.filter((parameter) => parameter.semanticKey === "mass");
      component.metadata.massAccounting ??= masses.length ? "contributes" : "includedElsewhere";
      if (!masses.length) component.metadata.massAccountingNote ??= "Included in the declared assembly contributions in this simplified sample; no separate mass value is modeled.";
      for (const mass of masses) { mass.contributionBasis ??= "local"; mass.quantityBasis ??= project.name.includes("OHSC") ? "All represented items in one modeled OHSC segment; do not multiply by four positions." : "All represented items in this modeled product; value already includes the represented quantity."; }
    }
  }
  project.configurations = project.configurations.map((configuration) => applySelectionToConfiguration(configuration, project.features, project.featureConstraints));
  seedSampleReviews(project);
}
