import {
  elementTypes,
  type ElementType,
  type FunctionSequenceDomain,
  type GraphLayoutMode,
  type ModelTabId,
  type Project,
  type UiPreferences
} from "./types";
import { architectureApplies } from "./validation";
import { contextConnections } from "./contextConnections";

export interface ModelSectionConfig {
  label: string;
  tableTypes: ElementType[];
  projectionTypes: ElementType[];
  matrixTypes: ElementType[];
  graphLabel: string;
  graphDescription: string;
  graphLayoutModes: GraphLayoutMode[];
  sequenceDomain?: FunctionSequenceDomain;
  availableViews: UiPreferences["activeModelView"][];
}

export const modelSectionOrder: ModelTabId[] = [
  "mission-context",
  "requirements-validation",
  "product-functional",
  "product-technical",
  "process-functional",
  "process-technical",
  "interfaces",
  "traceability"
];

export const modelSections: Record<ModelTabId, ModelSectionConfig> = {
  "mission-context": {
    label: "Mission and Context",
    tableTypes: ["mission", "system", "externalSystem", "stakeholder", "need", "objective", "useCase"],
    projectionTypes: ["mission", "system", "externalSystem", "stakeholder", "need", "objective", "useCase"],
    matrixTypes: ["mission", "system", "externalSystem", "stakeholder", "need", "objective", "useCase", "productComponent", "productInterface"],
    graphLabel: "Mission and stakeholder context",
    graphDescription: "Structural context from missions through stakeholders, needs, objectives and use cases.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    availableViews: ["table", "graph", "sectionRecap", "quality", "overview", "matrix"]
  },
  "requirements-validation": {
    label: "Requirements and Validation",
    tableTypes: ["systemRequirement", "verificationMethod"],
    projectionTypes: ["need", "objective", "systemRequirement", "verificationMethod"],
    matrixTypes: ["need", "objective", "systemRequirement", "verificationMethod"],
    graphLabel: "Requirement and validation trace diagram",
    graphDescription: "Needs and objectives derive requirements; verification methods verify requirements in the canonical stored direction.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    availableViews: ["table", "graph", "requirementsOverview", "sectionRecap", "quality", "overview", "matrix"]
  },
  "product-functional": {
    label: "Product Functional",
    tableTypes: ["productFunction", "productInterface"],
    projectionTypes: ["useCase", "systemRequirement", "productFunction", "productInterface"],
    matrixTypes: ["useCase", "systemRequirement", "productFunction", "productInterface"],
    graphLabel: "Product-function architecture and hierarchy",
    graphDescription: "Create use-case, satisfaction, interface and child → refines → parent relationships.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    sequenceDomain: "product",
    availableViews: ["table", "graph", "diagram", "sectionRecap", "quality", "overview", "matrix"]
  },
  "product-technical": {
    label: "Product Technical",
    tableTypes: ["productComponent", "productInterface"],
    projectionTypes: ["systemRequirement", "productFunction", "productComponent", "productInterface"],
    matrixTypes: ["systemRequirement", "productFunction", "productComponent", "productInterface"],
    graphLabel: "Product-component architecture and hierarchy",
    graphDescription: "Components refine components; product functions remain visible for realizedBy allocation.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    availableViews: ["table", "graph", "sectionRecap", "quality", "overview", "matrix"]
  },
  "process-functional": {
    label: "Process Functional",
    tableTypes: ["processFunction", "processInterface"],
    projectionTypes: ["useCase", "systemRequirement", "processFunction", "processInterface", "productComponent"],
    matrixTypes: ["useCase", "systemRequirement", "processFunction", "processInterface", "productComponent"],
    graphLabel: "Process-function architecture and hierarchy",
    graphDescription: "Create use-case, satisfaction, interface, item-flow and child → refines → parent relationships.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    sequenceDomain: "process",
    availableViews: ["table", "graph", "diagram", "sectionRecap", "quality", "overview", "matrix"]
  },
  "process-technical": {
    label: "Process Technical",
    tableTypes: ["industrialSystemComponent", "processInterface", "resource"],
    projectionTypes: ["systemRequirement", "processFunction", "industrialSystemComponent", "processInterface", "resource"],
    matrixTypes: ["systemRequirement", "processFunction", "industrialSystemComponent", "processInterface", "resource"],
    graphLabel: "Industrial-component architecture and hierarchy",
    graphDescription: "Industrial components refine components; process functions remain visible for realization, and resources are allocated to the realizing industrial components.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    availableViews: ["table", "graph", "sectionRecap", "quality", "overview", "matrix"]
  },
  "interfaces": {
    label: "Interfaces",
    tableTypes: ["productInterface", "processInterface"],
    projectionTypes: ["externalSystem", "productFunction", "productComponent", "productInterface", "processFunction", "industrialSystemComponent", "processInterface"],
    matrixTypes: ["externalSystem", "productFunction", "productComponent", "productInterface", "processFunction", "industrialSystemComponent", "processInterface"],
    graphLabel: "Product and process interfaces",
    graphDescription: "Interfaces remain visible with the functions, components and external systems connected to their boundaries.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    availableViews: ["table", "graph", "sectionRecap", "quality", "overview", "matrix"]
  },
  "traceability": {
    label: "Traceability",
    tableTypes: [...elementTypes],
    projectionTypes: [...elementTypes],
    matrixTypes: [...elementTypes],
    graphLabel: "Cross-domain model overview",
    graphDescription: "Every element type is visible. Working use-case scope is highlighted without hiding unlinked content.",
    graphLayoutModes: ["manual", "hierarchy", "horizontal"],
    availableViews: ["table", "graph", "sectionRecap", "quality", "overview", "matrix"]
  }
};

export function isViewAvailable(tab: ModelTabId, view: UiPreferences["activeModelView"]) {
  return modelSections[tab].availableViews.includes(view);
}

export function sectionProjectionElements(project: Project, tab: ModelTabId, architectureId?: string) {
  const config = modelSections[tab];
  const base = project.elements.filter((element) =>
    config.projectionTypes.includes(element.elementType)
    && architectureApplies(element, architectureId)
  );
  if (tab !== "mission-context") return base;

  const included = new Set(base.map((element) => element.id));
  const systemRoots = project.elements
    .filter((element) => element.elementType === "system")
    .flatMap((element) => element.metadata.architectureRootId ? [element.metadata.architectureRootId] : []);
  systemRoots.forEach((id) => included.add(id));

  // Context boundaries are expressed through explicit external-system ↔ interface
  // connections. Include only the touched interfaces and components, not the full
  // product architecture, so the context view stays readable.
  const externalIds = new Set(base.filter((element) => element.elementType === "externalSystem").map((element) => element.id));
  project.relationships.filter((edge) => edge.relationshipType === "connects" && (externalIds.has(edge.sourceId) || externalIds.has(edge.targetId)))
    .forEach((edge) => { included.add(edge.sourceId); included.add(edge.targetId); });
  let expanded = true;
  while (expanded) {
    expanded = false;
    project.relationships.filter((edge) => edge.relationshipType === "connects").forEach((edge) => {
      const source = project.elements.find((element) => element.id === edge.sourceId);
      const target = project.elements.find((element) => element.id === edge.targetId);
      const touchesIncludedInterface = (included.has(edge.sourceId) && source?.elementType.includes("Interface"))
        || (included.has(edge.targetId) && target?.elementType.includes("Interface"));
      if (touchesIncludedInterface) {
        for (const id of [edge.sourceId, edge.targetId]) if (!included.has(id)) { included.add(id); expanded = true; }
      }
    });
  }
  contextConnections(project).forEach((edge) => {
    if (included.has(edge.sourceId) || included.has(edge.targetId)) {
      included.add(edge.sourceId);
      included.add(edge.targetId);
    }
  });
  return project.elements.filter((element) => included.has(element.id) && architectureApplies(element, architectureId));
}
