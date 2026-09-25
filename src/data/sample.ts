import { prepareOntologySample } from "./ontologySample";
import type {
  Architecture,
  ComparisonStudy,
  ElementType,
  Feature,
  FeatureConstraint,
  FunctionSequence,
  KPI,
  ModelElement,
  Parameter,
  Project,
  Relationship,
  SimulationRun,
  VariationPoint
} from "../domain/types";
import { leadingAlternativeIds, runComparison, runWeightSensitivity } from "../domain/comparison";
import {
  runBoundedRobustness,
  runFixedWeightSensitivity,
  runTradeStudyMethodology
} from "../domain/tradeStudyMethodology";
import { deriveConfiguration } from "../domain/derivation";
import { runSimulation } from "../domain/simulation";
import { applySelectionToConfiguration, validateConfiguration } from "../domain/variability";

const stamp = "2026-07-23T08:00:00.000Z";
const id = (kind: string, name: string) =>
  `${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

const architectures: Architecture[] = [
  {
    id: "arch-manual",
    name: "Manual Customer Variant",
    description: "Operator-led assembly supported by powered tooling.",
    status: "configured",
    configurationId: "configuration-manual",
    createdAt: stamp,
    updatedAt: stamp
  },
  {
    id: "arch-auto",
    name: "Automated Customer Variant",
    description: "Robot-led assembly with inline automated inspection.",
    status: "configured",
    configurationId: "configuration-automated",
    createdAt: stamp,
    updatedAt: stamp
  },
  {
    id: "arch-invalid",
    name: "Invalid Demonstration",
    description: "Generated architecture retained for an invalid saved configuration.",
    status: "invalid",
    configurationId: "configuration-invalid",
    createdAt: stamp,
    updatedAt: stamp
  }
];

function parameter(ownerElementId: string, name: string, value: number, unit: string): Parameter {
  return {
    id: id("par", `${ownerElementId}-${name}`),
    ownerElementId,
    name,
    semanticKey: name.toLowerCase().replace(/\s+/g, "_"),
    description: `${name} preliminary input`,
    dataType: "number",
    value,
    unit,
    valueOrigin: "assumed",
    source: "Programme preparation assumption",
    applicableConfigurationIds: []
  };
}

function element(elementType: ElementType, name: string, options: Partial<ModelElement> = {}): ModelElement {
  const elementId = options.id ?? id(elementType, name);
  return {
    id: elementId,
    elementType,
    name,
    description: options.description ?? `${name} in the industrial assembly model.`,
    status: options.status ?? "reviewed",
    architectureScope: options.architectureScope ?? "common",
    architectureId: options.architectureId,
    featureExpression: options.featureExpression,
    parameters: options.parameters ?? [],
    requirementFormula: options.requirementFormula,
    customAttributeValues: options.customAttributeValues ?? {},
    tags: options.tags ?? [elementType],
    metadata: options.metadata ?? { source: "Stage A scope-update sample", owner: "Systems Engineering" },
    createdAt: stamp,
    updatedAt: stamp
  };
}

const elements: ModelElement[] = [
  element("mission", "Deliver configurable assembly capability"),
  element("stakeholder", "Assembly Machine System", {
    metadata: { source: "Programme charter", owner: "Chief Engineering", isSystemOfInterest: true }
  }),
  element("stakeholder", "Production Manager"),
  element("stakeholder", "Machine Operator"),
  element("stakeholder", "Quality Manager"),
  element("need", "Increased production throughput"),
  element("need", "Consistent assembly quality"),
  element("need", "Safe operator interaction"),
  element("objective", "Reach ten assemblies per hour"),
  element("objective", "Keep process equipment mass below target"),
  element("useCase", "Configure production order"),
  element("useCase", "Assemble product"),
  element("useCase", "Inspect assembled product"),
  element("systemRequirement", "The system shall achieve target throughput"),
  element("systemRequirement", "The system shall verify assembly quality"),
  element("systemRequirement", "The system shall remain below the equipment mass target"),
  element("productFunction", "Handle product"),
  element("productFunction", "Join product"),
  element("productFunction", "Inspect product"),
  (() => {
    const component = element("productComponent", "Material handling module");
    return { ...component, parameters: [parameter(component.id, "Throughput", 12, "parts/h")] };
  })(),
  (() => {
    const component = element("productComponent", "Joining module");
    return { ...component, parameters: [parameter(component.id, "Mass", 420, "kg")] };
  })(),
  (() => {
    const component = element("productComponent", "Inspection module");
    return { ...component, parameters: [parameter(component.id, "Quality confidence", 99, "%")] };
  })(),
  element("productComponent", "Input component"),
  element("productComponent", "Assembled product"),
  element("productInterface", "Product transfer interface"),
  element("productInterface", "Joining interface"),
  element("processFunction", "Load components", {
    metadata: { source: "Manufacturing concept", owner: "Manufacturing Engineering", processType: "assembly", duration: 4, durationUnit: "minute" }
  }),
  element("processFunction", "Join components", {
    metadata: { source: "Manufacturing concept", owner: "Manufacturing Engineering", processType: "assembly", duration: 5, durationUnit: "minute" }
  }),
  element("processFunction", "Inspect assembly", {
    metadata: { source: "Manufacturing concept", owner: "Manufacturing Engineering", processType: "verification", duration: 2, durationUnit: "minute" }
  }),
  element("industrialSystemComponent", "Loading station"),
  element("industrialSystemComponent", "Assembly fixture"),
  element("industrialSystemComponent", "Vision inspection station"),
  element("processInterface", "Material transfer connection"),
  element("processInterface", "Control-data connection"),
  element("resource", "Assembly operator", {
    featureExpression: "feature-manual-loading OR feature-manual-fastening",
    metadata: { source: "Resource concept", owner: "Industrial Planning", resourceType: "person", hourlyRate: 55, costUnit: "EUR/h", capacityHours: 160, availabilityPercent: 85 }
  }),
  element("resource", "Quality technician", {
    featureExpression: "feature-vision OR feature-probe",
    metadata: { source: "Resource concept", owner: "Industrial Planning", resourceType: "person", hourlyRate: 60, costUnit: "EUR/h", capacityHours: 160, availabilityPercent: 80 }
  }),
  element("resource", "Robotic fastening cell", {
    featureExpression: "feature-robotic-fastening",
    metadata: { source: "Supplier budgetary quote", owner: "Industrial Planning", resourceType: "machine", hourlyRate: 145, costUnit: "EUR/h", capacityHours: 176, availabilityPercent: 92 }
  }),
  element("resource", "Automated feeder", {
    featureExpression: "feature-automated-feeding",
    metadata: { source: "Supplier budgetary quote", owner: "Industrial Planning", resourceType: "machine", hourlyRate: 95, costUnit: "EUR/h", capacityHours: 176, availabilityPercent: 90 }
  }),
  element("verificationMethod", "Cycle-time analysis"),
  element("verificationMethod", "Dimensional inspection")
];

const elementId = (type: ElementType, name: string) => id(type, name);
let relationshipIndex = 0;
function relationship(
  sourceType: ElementType,
  sourceName: string,
  relationshipType: Relationship["relationshipType"],
  targetType: ElementType,
  targetName: string,
  patch: Partial<Relationship> = {}
): Relationship {
  relationshipIndex += 1;
  return {
    id: `rel-${String(relationshipIndex).padStart(3, "0")}`,
    relationshipType,
    sourceId: elementId(sourceType, sourceName),
    targetId: elementId(targetType, targetName),
    createdAt: stamp,
    updatedAt: stamp,
    ...patch
  };
}

const mission = "Deliver configurable assembly capability";
const requirements = [
  "The system shall achieve target throughput",
  "The system shall verify assembly quality",
  "The system shall remain below the equipment mass target"
];
const functions = ["Handle product", "Inspect product", "Join product"];
const productComponents = ["Material handling module", "Inspection module", "Joining module"];
const processFunctions = ["Load components", "Inspect assembly", "Join components"];
const industrialComponents = ["Loading station", "Vision inspection station", "Assembly fixture"];
const productSequenceId = "sequence-product-assembly";
const processSequenceId = "sequence-process-assembly";

const relationships: Relationship[] = [
  ...["Assembly Machine System", "Production Manager", "Machine Operator", "Quality Manager"].map((stakeholder) =>
    relationship("mission", mission, "hasStakeholder", "stakeholder", stakeholder)
  ),
  relationship("stakeholder", "Production Manager", "hasNeed", "need", "Increased production throughput"),
  relationship("stakeholder", "Quality Manager", "hasNeed", "need", "Consistent assembly quality"),
  relationship("stakeholder", "Machine Operator", "hasNeed", "need", "Safe operator interaction"),
  relationship("stakeholder", "Assembly Machine System", "hasObjective", "objective", "Reach ten assemblies per hour"),
  relationship("stakeholder", "Assembly Machine System", "hasObjective", "objective", "Keep process equipment mass below target"),
  relationship("stakeholder", "Assembly Machine System", "involvedIn", "useCase", "Configure production order"),
  relationship("stakeholder", "Assembly Machine System", "involvedIn", "useCase", "Assemble product"),
  relationship("stakeholder", "Assembly Machine System", "involvedIn", "useCase", "Inspect assembled product"),
  relationship("stakeholder", "Production Manager", "involvedIn", "useCase", "Configure production order"),
  relationship("stakeholder", "Production Manager", "involvedIn", "useCase", "Assemble product"),
  relationship("stakeholder", "Machine Operator", "involvedIn", "useCase", "Assemble product"),
  relationship("stakeholder", "Quality Manager", "involvedIn", "useCase", "Inspect assembled product"),
  relationship("useCase", "Configure production order", "addresses", "need", "Increased production throughput"),
  relationship("useCase", "Configure production order", "addresses", "objective", "Reach ten assemblies per hour"),
  relationship("useCase", "Assemble product", "addresses", "need", "Increased production throughput"),
  relationship("useCase", "Assemble product", "addresses", "need", "Safe operator interaction"),
  relationship("useCase", "Assemble product", "addresses", "objective", "Reach ten assemblies per hour"),
  relationship("useCase", "Assemble product", "addresses", "objective", "Keep process equipment mass below target"),
  relationship("useCase", "Inspect assembled product", "addresses", "need", "Consistent assembly quality"),
  relationship("need", "Increased production throughput", "derives", "systemRequirement", requirements[0]),
  relationship("objective", "Reach ten assemblies per hour", "derives", "systemRequirement", requirements[0]),
  relationship("need", "Consistent assembly quality", "derives", "systemRequirement", requirements[1]),
  relationship("need", "Safe operator interaction", "derives", "systemRequirement", requirements[2]),
  relationship("objective", "Keep process equipment mass below target", "derives", "systemRequirement", requirements[2]),
  relationship("useCase", "Configure production order", "hasFunction", "productFunction", "Handle product"),
  relationship("useCase", "Assemble product", "hasFunction", "productFunction", "Handle product"),
  relationship("useCase", "Assemble product", "hasFunction", "productFunction", "Join product"),
  relationship("useCase", "Assemble product", "hasFunction", "productFunction", "Inspect product"),
  relationship("useCase", "Inspect assembled product", "hasFunction", "productFunction", "Inspect product"),
  relationship("useCase", "Assemble product", "hasFunction", "processFunction", "Load components"),
  relationship("useCase", "Assemble product", "hasFunction", "processFunction", "Join components"),
  relationship("useCase", "Assemble product", "hasFunction", "processFunction", "Inspect assembly"),
  relationship("useCase", "Inspect assembled product", "hasFunction", "processFunction", "Inspect assembly"),
  ...requirements.flatMap((requirementName, index) => [
    relationship("systemRequirement", requirementName, "satisfiedBy", "productFunction", functions[index]),
    relationship("systemRequirement", requirementName, "satisfiedBy", "productComponent", productComponents[index]),
    relationship("systemRequirement", requirementName, "satisfiedBy", "processFunction", processFunctions[index]),
    relationship("systemRequirement", requirementName, "satisfiedBy", "industrialSystemComponent", industrialComponents[index])
  ]),
  relationship("productFunction", "Handle product", "realizedBy", "productComponent", "Material handling module"),
  relationship("productFunction", "Join product", "realizedBy", "productComponent", "Joining module"),
  relationship("productFunction", "Inspect product", "realizedBy", "productComponent", "Inspection module"),
  relationship("productFunction", "Handle product", "precedes", "productFunction", "Join product", { sequenceId: productSequenceId }),
  relationship("productFunction", "Join product", "precedes", "productFunction", "Inspect product", { sequenceId: productSequenceId }),
  relationship("productFunction", "Handle product", "connects", "productInterface", "Product transfer interface"),
  relationship("productFunction", "Join product", "connects", "productInterface", "Joining interface"),
  relationship("processFunction", "Load components", "realizedBy", "industrialSystemComponent", "Loading station"),
  relationship("processFunction", "Join components", "realizedBy", "industrialSystemComponent", "Assembly fixture"),
  relationship("processFunction", "Inspect assembly", "realizedBy", "industrialSystemComponent", "Vision inspection station"),
  relationship("processFunction", "Load components", "precedes", "processFunction", "Join components", { sequenceId: processSequenceId }),
  relationship("processFunction", "Join components", "precedes", "processFunction", "Inspect assembly", { sequenceId: processSequenceId }),
  relationship("industrialSystemComponent", "Loading station", "requiresResource", "resource", "Assembly operator", { requiredQuantity: 1, quantity: 1, unit: "person" }),
  relationship("industrialSystemComponent", "Assembly fixture", "requiresResource", "resource", "Assembly operator", { requiredQuantity: 1, quantity: 1, unit: "person" }),
  relationship("industrialSystemComponent", "Vision inspection station", "requiresResource", "resource", "Quality technician", { requiredQuantity: 1, quantity: 1, unit: "person" }),
  relationship("industrialSystemComponent", "Assembly fixture", "requiresResource", "resource", "Robotic fastening cell", { requiredQuantity: 1, quantity: 1, unit: "machine" }),
  relationship("industrialSystemComponent", "Loading station", "requiresResource", "resource", "Automated feeder", { requiredQuantity: 1, quantity: 1, unit: "machine" }),
  relationship("processFunction", "Load components", "consumes", "productComponent", "Input component", { itemFlowName: "Parts in", quantity: 1, unit: "part" }),
  relationship("processFunction", "Load components", "produces", "productComponent", "Input component", { itemFlowName: "Positioned parts", quantity: 1, unit: "part" }),
  relationship("processFunction", "Join components", "consumes", "productComponent", "Input component", { itemFlowName: "Positioned parts", quantity: 1, unit: "part" }),
  relationship("processFunction", "Join components", "produces", "productComponent", "Assembled product", { itemFlowName: "Assembly", quantity: 1, unit: "part" }),
  relationship("processFunction", "Inspect assembly", "consumes", "productComponent", "Assembled product", { itemFlowName: "Assembly for inspection", quantity: 1, unit: "part" }),
  relationship("processFunction", "Load components", "connects", "processInterface", "Material transfer connection"),
  relationship("industrialSystemComponent", "Vision inspection station", "connects", "processInterface", "Control-data connection"),
  relationship("verificationMethod", "Cycle-time analysis", "verifies", "systemRequirement", requirements[0]),
  relationship("verificationMethod", "Dimensional inspection", "verifies", "systemRequirement", requirements[1]),
  relationship("verificationMethod", "Cycle-time analysis", "allocatedTo", "processFunction", "Load components")
];

const functionSequences: FunctionSequence[] = [
  {
    id: productSequenceId,
    name: "Product assembly behavior",
    description: "Product-function sequence for assembly and inspection use cases.",
    domain: "product",
    useCaseIds: [elementId("useCase", "Assemble product")],
    functionIds: functions.map((name) => elementId("productFunction", name)),
    relationshipIds: relationships.filter((relationship) => relationship.sequenceId === productSequenceId).map((relationship) => relationship.id),
    createdAt: stamp,
    updatedAt: stamp
  },
  {
    id: processSequenceId,
    name: "Industrial assembly process",
    description: "Process-function sequence with item-flow context.",
    domain: "process",
    useCaseIds: [elementId("useCase", "Assemble product")],
    functionIds: processFunctions.map((name) => elementId("processFunction", name)),
    relationshipIds: relationships.filter((relationship) => relationship.sequenceId === processSequenceId).map((relationship) => relationship.id),
    createdAt: stamp,
    updatedAt: stamp
  }
];

const throughputRequirement = elements.find((element) => element.name === requirements[0])!;
const qualityRequirement = elements.find((element) => element.name === requirements[1])!;
const massRequirement = elements.find((element) => element.name === requirements[2])!;
const throughputParameter = elements.find((element) => element.name === "Material handling module")!.parameters[0];
const qualityParameter = elements.find((element) => element.name === "Inspection module")!.parameters[0];
const massParameter = elements.find((element) => element.name === "Joining module")!.parameters[0];
throughputRequirement.requirementFormula = {
  expression: "@throughput >= 10",
  bindings: [{ id: "binding-throughput", symbol: "throughput", kind: "parameter", targetId: throughputParameter.id }]
};
qualityRequirement.requirementFormula = {
  expression: "@quality_confidence >= 95",
  bindings: [{ id: "binding-quality-confidence", symbol: "quality_confidence", kind: "parameter", targetId: qualityParameter.id }]
};
massRequirement.requirementFormula = {
  expression: "@equipment_mass <= 1000",
  bindings: [{ id: "binding-mass", symbol: "equipment_mass", kind: "parameter", targetId: massParameter.id }]
};

const joiningModule = elements.find((element) => element.name === "Joining module")!;
joiningModule.parameters[0].applicableConfigurationIds = ["configuration-manual"];
joiningModule.parameters[0].minimum = 300;
joiningModule.parameters[0].maximum = 700;
joiningModule.parameters.push(
  {
    ...parameter(joiningModule.id, "Automated mass", 650, "kg"),
    id: "par-automated-mass",
    semanticKey: "mass",
    applicableConfigurationIds: ["configuration-automated"],
    minimum: 500,
    maximum: 800,
    valueOrigin: "entered",
    source: "Robot-cell supplier budgetary data"
  },
  {
    ...parameter(joiningModule.id, "Manual direct cost", 35000, "EUR"),
    id: "par-manual-cost",
    semanticKey: "cost",
    applicableConfigurationIds: ["configuration-manual"],
    minimum: 25000,
    maximum: 50000
  },
  {
    ...parameter(joiningModule.id, "Automated direct cost", 90000, "EUR"),
    id: "par-automated-cost",
    semanticKey: "cost",
    applicableConfigurationIds: ["configuration-automated"],
    minimum: 70000,
    maximum: 120000,
    valueOrigin: "entered",
    source: "Robot-cell supplier budgetary data"
  },
  {
    ...parameter(joiningModule.id, "Manual power", 12, "kW"),
    id: "par-manual-power",
    semanticKey: "power",
    applicableConfigurationIds: ["configuration-manual"]
  },
  {
    ...parameter(joiningModule.id, "Automated power", 38, "kW"),
    id: "par-automated-power",
    semanticKey: "power",
    applicableConfigurationIds: ["configuration-automated"],
    valueOrigin: "entered",
    source: "Robot-cell supplier budgetary data"
  }
);

elements.find((element) => element.name === "Loading station")!.featureExpression =
  "feature-manual-loading OR feature-automated-feeding";
elements.find((element) => element.name === "Assembly fixture")!.featureExpression =
  "feature-manual-fastening OR feature-robotic-fastening";
elements.find((element) => element.name === "Vision inspection station")!.featureExpression = "feature-vision";
elements.find((element) => element.name === "Control-data connection")!.featureExpression =
  "feature-data-recording OR feature-advanced-analytics";

const features: Feature[] = [
  { id: "feature-machine", name: "Industrial Assembly Machine", featureType: "root", sortOrder: 0, description: "Root product-line feature." },
  { id: "feature-core-control", parentId: "feature-machine", name: "Core Control", featureType: "mandatory", sortOrder: 1, description: "Common industrial control." },
  { id: "feature-safety", parentId: "feature-machine", name: "Safety Package", featureType: "mandatory", sortOrder: 2, description: "Mandatory machine safety content." },
  { id: "feature-manual-loading", parentId: "feature-machine", parentGroupId: "feature-group-loading", name: "Manual Loading", featureType: "xor", groupId: "loading-method", sortOrder: 3, description: "Operator loads components." },
  { id: "feature-automated-feeding", parentId: "feature-machine", parentGroupId: "feature-group-loading", name: "Automated Feeding", featureType: "xor", groupId: "loading-method", sortOrder: 4, description: "Automatic component feed." },
  { id: "feature-manual-fastening", parentId: "feature-machine", parentGroupId: "feature-group-assembly", name: "Manual Fastening", featureType: "xor", groupId: "assembly-method", sortOrder: 5, description: "Operator performs fastening." },
  { id: "feature-robotic-fastening", parentId: "feature-machine", parentGroupId: "feature-group-assembly", name: "Robotic Fastening", featureType: "xor", groupId: "assembly-method", sortOrder: 6, description: "Robot performs fastening." },
  { id: "feature-vision", parentId: "feature-machine", parentGroupId: "feature-group-inspection", name: "Vision Inspection", featureType: "or", groupId: "inspection-options", sortOrder: 7, description: "Vision inspection capability." },
  { id: "feature-probe", parentId: "feature-machine", parentGroupId: "feature-group-inspection", name: "Dimensional Probe", featureType: "or", groupId: "inspection-options", sortOrder: 8, description: "Contact dimensional inspection." },
  { id: "feature-data-recording", parentId: "feature-machine", name: "Production Data Recording", featureType: "optional", sortOrder: 9, description: "Production result records." },
  { id: "feature-advanced-analytics", parentId: "feature-machine", name: "Advanced Analytics", featureType: "optional", sortOrder: 10, description: "Advanced production analytics." },
  {
    id: "feature-operating-voltage",
    parentId: "feature-machine",
    name: "Operating Voltage",
    featureType: "mandatory",
    sortOrder: 11,
    description: "Enumerated electrical supply selection.",
    valueType: "enumeration",
    allowedValues: ["230V", "400V"],
    defaultValue: "230V",
    variabilityScope: "external"
  }
];

features.forEach((feature) => {
  feature.valueType ??= "boolean";
  feature.allowedValues ??= [];
  feature.defaultValue ??= false;
  feature.variabilityScope ??= ["feature-core-control", "feature-safety"].includes(feature.id) ? "internal" : "external";
});

const variationPoints: VariationPoint[] = elements
  .filter((candidate) => candidate.featureExpression?.trim())
  .map((candidate) => ({
    id: `variation-${candidate.id}`,
    name: `${candidate.name} existence`,
    description: "Controls whether this 150% model element exists in the realized variant.",
    kind: "existence",
    constrainedElementIds: [candidate.id],
    constrainedRelationshipIds: [],
    featureExpression: candidate.featureExpression!,
    featureValueConditions: [],
    valueRules: [],
    scope: candidate.elementType === "resource" ? "resources" : "structure",
    enabled: true,
    createdAt: stamp,
    updatedAt: stamp
  }));
variationPoints.push({
  id: "variation-load-duration",
  name: "Loading duration by automation",
  description: "Changes the process duration without changing the reusable 150% source model.",
  kind: "primitiveProperty",
  constrainedElementIds: [elementId("processFunction", "Load components")],
  constrainedRelationshipIds: [],
  featureExpression: "",
  featureValueConditions: [],
  propertyPath: "metadata:duration",
  valueRules: [
    {
      id: "variation-load-duration-manual",
      featureExpression: "feature-manual-loading",
      featureValueConditions: [],
      value: 4
    },
    {
      id: "variation-load-duration-automated",
      featureExpression: "feature-automated-feeding",
      featureValueConditions: [],
      value: 1.5
    }
  ],
  scope: "process",
  enabled: true,
  createdAt: stamp,
  updatedAt: stamp
});
variationPoints.push({
  id: "variation-control-voltage",
  name: "Control interface operating voltage",
  description: "Demonstrates a typed enumeration value changing a realized primitive property.",
  kind: "primitiveProperty",
  constrainedElementIds: [elementId("processInterface", "Control-data connection")],
  constrainedRelationshipIds: [],
  featureExpression: "feature-data-recording",
  featureValueConditions: [],
  propertyPath: "description",
  valueRules: [
    {
      id: "variation-control-voltage-230",
      featureExpression: "",
      featureValueConditions: [{ featureId: "feature-operating-voltage", operator: "equals", value: "230V" }],
      value: "Control-data connection for a 230 V supply variant."
    },
    {
      id: "variation-control-voltage-400",
      featureExpression: "",
      featureValueConditions: [{ featureId: "feature-operating-voltage", operator: "equals", value: "400V" }],
      value: "Control-data connection for a 400 V supply variant."
    }
  ],
  scope: "structure",
  enabled: true,
  createdAt: stamp,
  updatedAt: stamp
});
elements.forEach((candidate) => { delete candidate.featureExpression; });

const featureConstraints: FeatureConstraint[] = [
  { id: "constraint-feed-robot", type: "requires", sourceFeatureId: "feature-automated-feeding", targetFeatureId: "feature-robotic-fastening" },
  { id: "constraint-robot-safety", type: "requires", sourceFeatureId: "feature-robotic-fastening", targetFeatureId: "feature-safety" },
  { id: "constraint-analytics-data", type: "requires", sourceFeatureId: "feature-advanced-analytics", targetFeatureId: "feature-data-recording" },
  { id: "constraint-loading-excludes", type: "excludes", sourceFeatureId: "feature-manual-loading", targetFeatureId: "feature-automated-feeding" },
  { id: "constraint-fastening-excludes", type: "excludes", sourceFeatureId: "feature-manual-fastening", targetFeatureId: "feature-robotic-fastening" }
];

const kpis: KPI[] = [
  ["kpi-mass", "Total Mass", "kg", "minimize", "totalMass"],
  ["kpi-cost", "Estimated total cost", "EUR", "minimize", "estimatedTotalCost"],
  ["kpi-lead-time", "Manufacturing Lead Time", "h", "minimize", "manufacturingLeadTime"],
  ["kpi-resource", "Resource Demand", "resource-h", "minimize", "resourceDemand"],
  ["kpi-throughput", "Throughput Proxy", "1/h", "maximize", "throughputProxy"],
  ["kpi-power", "Total Power", "kW", "minimize", "totalPower"],
  ["kpi-utilization", "Basic Utilization", "%", "minimize", "basicUtilization"]
].map(([kpiId, name, unit, direction, algorithm]) => ({
  id: kpiId,
  name,
  description: `${name} definition for Stage B`,
  objectiveIds: [
    kpiId === "kpi-mass" || kpiId === "kpi-power"
      ? elementId("objective", "Keep process equipment mass below target")
      : elementId("objective", "Reach ten assemblies per hour")
  ],
  calculationMode: "standardAlgorithm",
  standardAlgorithmKey: algorithm as KPI["standardAlgorithmKey"],
  outputUnit: unit,
  optimizationDirection: direction as KPI["optimizationDirection"],
  weight: 1,
  inputParameterIds: [],
  dependsOnKpiIds: [],
  calculationWarnings: [],
  createdAt: stamp,
  updatedAt: stamp
}));
kpis.push({
  id: "kpi-handling-rate",
  name: "Handling Rate Formula",
  description: "Editable formula example using an exact parameter reference.",
  objectiveIds: [elementId("objective", "Reach ten assemblies per hour")],
  calculationMode: "formula",
  formula: `param("${throughputParameter.id}")`,
  outputUnit: "parts/h",
  optimizationDirection: "maximize",
  weight: 1,
  inputParameterIds: [throughputParameter.id],
  dependsOnKpiIds: [],
  calculationWarnings: [],
  createdAt: stamp,
  updatedAt: stamp
});

export function createIndustrialAssemblySampleProject(projectId = "project-industrial-assembly"): Project {
  const project: Project = {
    id: projectId,
    schemaVersion: 14,
    modelRevision: 1,
    name: "Configurable Industrial Assembly Machine",
    description: "Mission-driven definition of alternative manual-assisted and automated assembly architectures.",
    overallScope: "tradeStudy",
    objectives: ["Reach ten assemblies per hour", "Keep process equipment mass below target"],
    openDecisions: [{
      id: "open-decision-mode",
      question: "Which automation level should become the programme baseline?",
      description: "Compare manual-assisted and automated candidates in Stage C.",
      status: "open",
      relatedElementIds: []
    }],
    createdAt: stamp,
    updatedAt: stamp,
    architectures: structuredClone(architectures),
    elements: structuredClone(elements),
    relationships: structuredClone(relationships),
    functionSequences: structuredClone(functionSequences),
    selectedUseCaseIds: [
      elementId("useCase", "Assemble product"),
      elementId("useCase", "Inspect assembled product")
    ],
    rowOrderByType: {},
    unitDefinitions: [],
    customAttributeDefinitions: [],
    features: structuredClone(features),
    featureGroups: [
      { id: "feature-group-loading", name: "Loading method", description: "How components enter the assembly process.", parentFeatureId: "feature-machine", sortOrder: 0 },
      { id: "feature-group-assembly", name: "Assembly method", description: "How fastening is performed.", parentFeatureId: "feature-machine", sortOrder: 1 },
      { id: "feature-group-inspection", name: "Inspection method", description: "How product conformity is checked.", parentFeatureId: "feature-machine", sortOrder: 2 }
    ],
    variabilityAxes: [
      { id: "axis-loading", name: "Loading method", description: "Manual or automated component loading.", featureGroupId: "feature-group-loading", createdAt: stamp, updatedAt: stamp },
      { id: "axis-assembly", name: "Assembly method", description: "Manual or robotic fastening.", featureGroupId: "feature-group-assembly", createdAt: stamp, updatedAt: stamp },
      { id: "axis-inspection", name: "Inspection method", description: "Selectable inspection technologies.", featureGroupId: "feature-group-inspection", createdAt: stamp, updatedAt: stamp }
    ],
    featureConstraints: structuredClone(featureConstraints),
    variationPoints: structuredClone(variationPoints),
    configurations: [
      {
        id: "configuration-manual",
        name: "Manual Customer Variant",
        architectureId: "arch-manual",
        manuallySelectedFeatureIds: ["feature-manual-loading", "feature-manual-fastening", "feature-vision", "feature-data-recording"],
        automaticConstraintFeatureIds: [],
        effectiveSelectedFeatureIds: [],
        autoSelectedFeatureIds: [],
        featureValues: { "feature-operating-voltage": "230V" },
        validationStatus: "notValidated",
        validationMessages: [],
        derivedElementIds: [],
        excludedElementIds: [],
        createdAt: stamp,
        updatedAt: stamp
      },
      {
        id: "configuration-automated",
        name: "Automated Customer Variant",
        architectureId: "arch-auto",
        manuallySelectedFeatureIds: [
          "feature-automated-feeding", "feature-robotic-fastening", "feature-vision", "feature-probe",
          "feature-data-recording", "feature-advanced-analytics"
        ],
        automaticConstraintFeatureIds: [],
        effectiveSelectedFeatureIds: [],
        autoSelectedFeatureIds: [],
        featureValues: { "feature-operating-voltage": "400V" },
        validationStatus: "notValidated",
        validationMessages: [],
        derivedElementIds: [],
        excludedElementIds: [],
        createdAt: stamp,
        updatedAt: stamp
      },
      {
        id: "configuration-invalid",
        name: "Invalid Demonstration",
        architectureId: "arch-invalid",
        manuallySelectedFeatureIds: ["feature-automated-feeding", "feature-manual-fastening", "feature-vision"],
        automaticConstraintFeatureIds: [],
        effectiveSelectedFeatureIds: [],
        autoSelectedFeatureIds: [],
        featureValues: { "feature-operating-voltage": "400V" },
        validationStatus: "invalid",
        validationMessages: ["Automated Feeding requires Robotic Fastening."],
        derivedElementIds: [],
        excludedElementIds: [],
        createdAt: stamp,
        updatedAt: stamp
      }
    ],
    kpis: structuredClone(kpis),
    simulationRuns: [],
    comparisonStudies: [],
    comparisonRisks: [],
    decisions: [],
    validationResults: []
  };
  prepareOntologySample(project);
  project.configurations = project.configurations.map((configuration) => {
    const selected = applySelectionToConfiguration(configuration, project.features, project.featureConstraints);
    const messages = validateConfiguration(project, selected);
    return {
      ...selected,
      validationStatus: messages.some((message) => message.severity === "error") ? "invalid" : "valid",
      validationMessages: messages.map((message) => message.message)
    };
  });
  prepareOntologySample(project);
  project.configurations = project.configurations.map((configuration) => {
    if (configuration.validationStatus !== "valid") return configuration;
    const attempt = deriveConfiguration(project, configuration);
    return attempt.result ? attempt.configuration : configuration;
  });
  const selectedKpiIds = ["kpi-mass", "kpi-cost", "kpi-lead-time", "kpi-throughput"];
  const manualRun = runSimulation(project, {
    name: "Manual Customer Variant — Current Stage C run",
    configurationId: "configuration-manual",
    selectedKpiIds,
    selectedAlgorithmKeys: []
  }).run;
  const automatedRun = runSimulation(project, {
    name: "Automated Customer Variant — Current Stage C run",
    configurationId: "configuration-automated",
    selectedKpiIds,
    selectedAlgorithmKeys: []
  }).run;
  if (manualRun && automatedRun) {
    project.simulationRuns = [manualRun, automatedRun];
    const massValues = [manualRun, automatedRun]
      .map((run) => run.results.find((result) => result.kpiId === "kpi-mass")?.value)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const now = new Date().toISOString();
    const study: ComparisonStudy = {
      id: "comparison-manual-vs-automated",
      name: "Manual versus automated customer variant",
      description: "Stage-C demonstration of exact saved-run comparison.",
      question: "Which automation level should become the programme baseline?",
      intendedOutcome: "Select the preferred valid 100% architecture and establish a justified programme baseline.",
      lifecycleScope: "Early industrial-system architecture definition",
      systemScope: "Configurable industrial assembly machine",
      status: "analyzed",
      originatingOpenDecisionId: "open-decision-mode",
      needIds: [
        elementId("need", "Increased production throughput"),
        elementId("need", "Consistent assembly quality")
      ],
      objectiveIds: [
        elementId("objective", "Reach ten assemblies per hour"),
        elementId("objective", "Keep process equipment mass below target")
      ],
      useCaseIds: [...project.selectedUseCaseIds],
      rootFeatureId: "feature-machine",
      selectedVariabilityAxisIds: ["axis-loading", "axis-assembly", "axis-inspection"],
      mandatoryRequirementIds: [
        elementId("systemRequirement", "The system shall achieve target throughput"),
        elementId("systemRequirement", "The system shall verify assembly quality"),
        elementId("systemRequirement", "The system shall remain below the equipment mass target")
      ],
      exploredFeatureIds: [
        "feature-manual-loading",
        "feature-automated-feeding",
        "feature-manual-fastening",
        "feature-robotic-fastening"
      ],
      criteria: [
        {
          id: "criterion-throughput",
          name: "Production throughput",
          description: "Prefer the architecture that best supports the throughput objective.",
          type: "optimization",
          sourceObjectiveIds: [elementId("objective", "Reach ten assemblies per hour")],
          sourceRequirementIds: [elementId("systemRequirement", "The system shall achieve target throughput")],
          kpiId: "kpi-throughput",
          weight: 1,
          valueFunction: "maximize"
        },
        {
          id: "criterion-mass",
          name: "Equipment mass feasibility",
          description: "The equipment mass requirement is mandatory and lower mass is preferred.",
          type: "mandatory",
          sourceObjectiveIds: [elementId("objective", "Keep process equipment mass below target")],
          sourceRequirementIds: [elementId("systemRequirement", "The system shall remain below the equipment mass target")],
          kpiId: "kpi-mass",
          weight: 1,
          valueFunction: "minimize"
        },
        {
          id: "criterion-cost",
          name: "Estimated total cost",
          description: "Use cost as an optimization criterion after feasibility is satisfied.",
          type: "optimization",
          sourceObjectiveIds: [elementId("objective", "Reach ten assemblies per hour")],
          sourceRequirementIds: [],
          kpiId: "kpi-cost",
          weight: 2,
          valueFunction: "minimize"
        },
        {
          id: "criterion-lead-time",
          name: "Manufacturing lead time",
          description: "Prefer shorter lead time while preserving mandatory feasibility.",
          type: "optimization",
          sourceObjectiveIds: [elementId("objective", "Reach ten assemblies per hour")],
          sourceRequirementIds: [],
          kpiId: "kpi-lead-time",
          weight: 2,
          valueFunction: "minimize"
        }
      ],
      candidateRefs: [
        {
          id: "candidate-manual",
          label: "Manual Customer Variant",
          architectureId: "arch-manual",
          configurationId: "configuration-manual"
        },
        {
          id: "candidate-automated",
          label: "Automated Customer Variant",
          architectureId: "arch-auto",
          configurationId: "configuration-automated"
        }
      ],
      alternativeRefs: [
        {
          id: "alternative-manual",
          label: "Manual Customer Variant",
          architectureId: "arch-manual",
          configurationId: "configuration-manual",
          simulationRunId: manualRun.id
        },
        {
          id: "alternative-automated",
          label: "Automated Customer Variant",
          architectureId: "arch-auto",
          configurationId: "configuration-automated",
          simulationRunId: automatedRun.id
        }
      ],
      selectedKpiIds,
      kpiSettings: {
        "kpi-mass": {
          weight: 1,
          optimizationDirection: "minimize" as const,
          threshold: {
            maximum: massValues.length ? Math.min(...massValues) - 0.1 : 0,
            mode: "warning" as const
          }
        },
        "kpi-cost": { weight: 2, optimizationDirection: "minimize" as const },
        "kpi-lead-time": { weight: 2, optimizationDirection: "minimize" as const },
        "kpi-throughput": { weight: 1, optimizationDirection: "maximize" as const }
      },
      createdAt: now,
      updatedAt: now,
      settingsUpdatedAt: now,
      results: []
    };
    const comparison = runComparison(project, study);
    if (comparison.result) study.results.push(comparison.result);
    const sensitivity = runWeightSensitivity(project, study);
    project.comparisonStudies = [{
      ...study,
      sensitivityResult: sensitivity.result
    }];
    project.activeComparisonStudyId = study.id;
    project.comparisonRisks = [
      {
        id: "risk-manual-capacity",
        comparisonStudyId: study.id,
        alternativeId: "alternative-manual",
        title: "Manual capacity variability",
        description: "Operator availability may reduce realized throughput.",
        likelihood: "medium",
        impact: "medium",
        mitigation: "Validate staffing and learning-curve planning inputs."
        ,
        inherentLikelihood: 3,
        inherentImpact: 3,
        residualLikelihood: 3,
        residualImpact: 3,
        owner: "Industrial Planning",
        status: "mitigating",
        applicableArchitectureIds: ["arch-manual"],
        applicableConfigurationIds: ["configuration-manual"],
        applicableRequirementIds: [],
        applicableParameterIds: [],
        applicableKpiIds: ["kpi-throughput"],
        reviewRequired: false
      },
      {
        id: "risk-automation-ramp",
        comparisonStudyId: study.id,
        alternativeId: "alternative-automated",
        title: "Automation ramp-up",
        description: "Integration maturity may delay stable automated production.",
        likelihood: "medium",
        impact: "high",
        mitigation: "Plan staged commissioning and fallback operating modes.",
        inherentLikelihood: 3,
        inherentImpact: 5,
        residualLikelihood: 2,
        residualImpact: 4,
        owner: "Automation Lead",
        status: "mitigating",
        applicableArchitectureIds: ["arch-auto"],
        applicableConfigurationIds: ["configuration-automated"],
        applicableRequirementIds: [],
        applicableParameterIds: [],
        applicableKpiIds: ["kpi-lead-time"],
        reviewRequired: false
      }
    ];
    if (comparison.result) {
      const leaders = leadingAlternativeIds(comparison.result.weightedScores);
      project.decisions = [{
        id: "decision-automation-baseline",
        question: "Which automation level should become the programme baseline?",
        alternatives: study.alternativeRefs.map((alternative) => alternative.label),
        criteria: selectedKpiIds.map((kpiId) => project.kpis.find((kpi) => kpi.id === kpiId)?.name ?? kpiId),
        selectedAlternative: leaders.length === 1
          ? study.alternativeRefs.find((alternative) => alternative.id === leaders[0])?.label
          : undefined,
        supportingSimulationRunIds: [manualRun.id, automatedRun.id],
        supportingComparisonStudyIds: [study.id],
        assumptions: [],
        risks: project.comparisonRisks.map((risk) => risk.title),
        openActions: comparison.result.thresholdViolations.map((violation) => violation.message),
        status: "draft",
        createdAt: now,
        updatedAt: now
      }];
      project.openDecisions = project.openDecisions.map((openDecision) =>
        openDecision.id === "open-decision-mode"
          ? { ...openDecision, status: "inReview", linkedFormalDecisionId: "decision-automation-baseline" }
          : openDecision
      );
    }
  }
  return project;
}

export function createCoffeeMachineSampleProject(projectId = "project-sample"): Project {
  const project = createIndustrialAssemblySampleProject(projectId);
  project.name = "Configurable Coffee Machine Product Line";
  project.description = "A simple MBSE/MBPLE demonstrator connecting coffee-machine product functions and technical components to the industrial process functions and production equipment used to manufacture them, then comparing three 100% architectures from one common 150% model.";

  const renameElements: Record<string, string> = {
    "Deliver configurable assembly capability": "Deliver a configurable coffee experience",
    "Assembly Machine System": "Coffee Machine System",
    "Production Manager": "Product Manager",
    "Machine Operator": "Coffee Consumer",
    "Quality Manager": "Service and Quality Manager",
    "Increased production throughput": "Fast beverage preparation",
    "Consistent assembly quality": "Consistent beverage quality",
    "Safe operator interaction": "Safe and intuitive operation",
    "Reach ten assemblies per hour": "Serve peak household demand",
    "Keep process equipment mass below target": "Keep the appliance compact and efficient",
    "Configure production order": "Configure coffee-machine variant",
    "Assemble product": "Manufacture coffee machine",
    "Inspect assembled product": "Verify manufactured coffee machine",
    "The system shall achieve target throughput": "The machine shall meet the required beverage throughput",
    "The system shall verify assembly quality": "The machine shall verify beverage quality",
    "The system shall remain below the equipment mass target": "The machine shall remain below the mass limit",
    "Handle product": "Meter coffee ingredients",
    "Join product": "Heat and pressurize brew water",
    "Inspect product": "Monitor beverage quality",
    "Material handling module": "Ingredient-handling module",
    "Joining module": "Brewing and heating module",
    "Inspection module": "Beverage sensing module",
    "Input component": "Purchased component kit",
    "Assembled product": "Integrated coffee machine",
    "Product transfer interface": "Ingredient and water interface",
    "Joining interface": "Thermal and hydraulic interface",
    "Load components": "Manufacture coffee-machine modules",
    "Join components": "Integrate coffee-machine modules",
    "Inspect assembly": "Test completed coffee machine",
    "Loading station": "Module assembly workstation",
    "Assembly fixture": "Coffee-machine integration cell",
    "Vision inspection station": "End-of-line test station",
    "Material transfer connection": "Component logistics interface",
    "Control-data connection": "Test-data interface",
    "Assembly operator": "Manufacturing technician",
    "Quality technician": "End-of-line test technician",
    "Robotic fastening cell": "Automated module assembly cell",
    "Automated feeder": "Automated component feeder",
    "Cycle-time analysis": "Manufacturing cycle-time analysis",
    "Dimensional inspection": "End-of-line functional test"
  };
  const coffeeDescriptions: Record<string, string> = {
    "Meter coffee ingredients": "Product function that meters the configured coffee and water quantities during beverage preparation.",
    "Heat and pressurize brew water": "Product function that heats and pressurizes water through the selected brewing architecture.",
    "Monitor beverage quality": "Product function that monitors brew conditions and beverage quality evidence.",
    "Ingredient-handling module": "Product technical component that stores and meters coffee ingredients in the delivered coffee machine.",
    "Brewing and heating module": "Product technical component that heats, pressurizes and routes brew water in the delivered coffee machine.",
    "Beverage sensing module": "Product technical component that senses temperature, flow and beverage-quality indicators.",
    "Purchased component kit": "Incoming purchased parts and subcomponents supplied to the industrial manufacturing process.",
    "Integrated coffee machine": "Product assembly produced after the coffee-machine technical modules have been integrated.",
    "Manufacture coffee-machine modules": "Industrial process function that manufactures the ingredient-handling, brewing/heating and beverage-sensing product modules.",
    "Integrate coffee-machine modules": "Industrial process function that combines the manufactured product modules into one coffee-machine assembly.",
    "Test completed coffee machine": "Industrial process function that performs end-of-line functional verification on the integrated coffee machine.",
    "Module assembly workstation": "Industrial-system component that realizes manufacture of the coffee-machine product modules.",
    "Coffee-machine integration cell": "Industrial-system component that realizes mechanical, electrical and fluidic integration of the product modules.",
    "End-of-line test station": "Industrial-system component that realizes functional testing of the manufactured coffee machine."
  };
  project.elements = project.elements.map((element) => ({
    ...element,
    name: renameElements[element.name] ?? element.name,
    description: coffeeDescriptions[renameElements[element.name] ?? element.name]
      ?? `${renameElements[element.name] ?? element.name} in the coffee-machine product-line model.`,
    metadata: { ...element.metadata, source: "Coffee-machine demonstrator", owner: element.metadata.owner ?? "Systems Engineering" }
  }));
  const system = project.elements.find((candidate) => candidate.elementType === "system")!;
  const missionId = elementId("mission", "Deliver configurable assembly capability");
  system.metadata.systemBoundary = "Inside: the delivered household coffee machine, its ingredient handling, brewing/heating, sensing, enclosure and connection provisions. Outside: the user, electrical supply, refill water source, receiving vessel and manufacturing system.";
  system.description = "The delivered household coffee machine is the system of interest; manufacturing equipment and the operating environment remain outside its boundary.";

  const compactNeed = project.elements.find((candidate) => candidate.id === elementId("need", "Safe operator interaction"))!;
  compactNeed.name = "Compact household installation";
  compactNeed.description = "The Coffee Consumer needs an appliance that fits and can be handled within the declared household installation context.";
  const throughputObjectiveId = elementId("objective", "Reach ten assemblies per hour");
  const compactObjectiveId = elementId("objective", "Keep process equipment mass below target");
  project.relationships = project.relationships.filter((relationship) =>
    !(relationship.sourceId === system.id && relationship.relationshipType === "hasObjective")
  );
  project.relationships.push(
    { id: "rel-coffee-product-manager-throughput-objective", sourceId: elementId("stakeholder", "Production Manager"), targetId: throughputObjectiveId, relationshipType: "hasObjective", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-product-manager-compact-objective", sourceId: elementId("stakeholder", "Production Manager"), targetId: compactObjectiveId, relationshipType: "hasObjective", createdAt: stamp, updatedAt: stamp }
  );

  const prepareUseCase = element("useCase", "Prepare a coffee beverage", {
    description: "The Coffee Consumer requests and receives one beverage from the configured coffee machine.",
    metadata: { source: "Coffee-machine demonstrator", owner: "Product Engineering", subjectSystemId: system.id }
  });
  project.elements.push(prepareUseCase);
  const productFunctionIds = [
    elementId("productFunction", "Handle product"),
    elementId("productFunction", "Join product"),
    elementId("productFunction", "Inspect product")
  ];
  project.relationships = project.relationships.filter((relationship) =>
    !(relationship.relationshipType === "hasFunction" && productFunctionIds.includes(relationship.targetId))
  );
  project.relationships.push(
    { id: "rel-coffee-consumer-prepares", sourceId: elementId("stakeholder", "Machine Operator"), targetId: prepareUseCase.id, relationshipType: "involvedIn", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-prepare-fast", sourceId: prepareUseCase.id, targetId: elementId("need", "Increased production throughput"), relationshipType: "addresses", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-prepare-quality", sourceId: prepareUseCase.id, targetId: elementId("need", "Consistent assembly quality"), relationshipType: "addresses", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-prepare-compact", sourceId: prepareUseCase.id, targetId: compactNeed.id, relationshipType: "addresses", createdAt: stamp, updatedAt: stamp },
    ...productFunctionIds.map((targetId, index): Relationship => ({ id: `rel-coffee-prepare-function-${index + 1}`, sourceId: prepareUseCase.id, targetId, relationshipType: "hasFunction", createdAt: stamp, updatedAt: stamp }))
  );
  prepareUseCase.metadata.subjectSystemId = system.id;
  project.selectedUseCaseIds = [prepareUseCase.id, ...project.selectedUseCaseIds.filter((id) => id !== prepareUseCase.id)];
  const productSequence = project.functionSequences.find((sequence) => sequence.domain === "product");
  if (productSequence) productSequence.useCaseIds = [prepareUseCase.id];

  const externalElements = [
    element("externalSystem", "Household electrical supply", { id: "external-coffee-electrical-supply", description: "Declared household electrical source outside the coffee-machine boundary." }),
    element("externalSystem", "User-provided refill water source", { id: "external-coffee-water-source", description: "Manual refill-water source outside the coffee-machine boundary; no plumbed connection is assumed." }),
    element("externalSystem", "Beverage receiving vessel", { id: "external-coffee-vessel", description: "Cup or vessel receiving the beverage outside the coffee-machine boundary." })
  ];
  const powerInterface = element("productInterface", "Household power interface", { id: "productInterface-coffee-power", description: "Electrical power and protective-earth boundary of the delivered appliance." });
  const beverageInterface = element("productInterface", "Beverage outlet interface", { id: "productInterface-coffee-outlet", description: "Controlled beverage outlet and receiving-vessel envelope." });
  project.elements.push(...externalElements, powerInterface, beverageInterface);
  const ingredientInterfaceId = elementId("productInterface", "Product transfer interface");
  const thermalInterfaceId = elementId("productInterface", "Joining interface");
  project.relationships.push(
    ...externalElements.map((external, index): Relationship => ({ id: `rel-coffee-mission-external-${index + 1}`, sourceId: missionId, targetId: external.id, relationshipType: "participatesInMission", createdAt: stamp, updatedAt: stamp })),
    { id: "rel-coffee-external-power", sourceId: externalElements[0].id, targetId: powerInterface.id, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-external-water", sourceId: externalElements[1].id, targetId: ingredientInterfaceId, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-external-vessel", sourceId: externalElements[2].id, targetId: beverageInterface.id, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-brewing-power", sourceId: elementId("productComponent", "Joining module"), targetId: powerInterface.id, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-ingredient-water", sourceId: elementId("productComponent", "Material handling module"), targetId: ingredientInterfaceId, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-brewing-thermal", sourceId: elementId("productComponent", "Joining module"), targetId: thermalInterfaceId, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-brewing-outlet", sourceId: elementId("productComponent", "Joining module"), targetId: beverageInterface.id, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    { id: "rel-coffee-monitor-outlet", sourceId: elementId("productFunction", "Inspect product"), targetId: beverageInterface.id, relationshipType: "connects", createdAt: stamp, updatedAt: stamp },
    ...externalElements.map((external, index): Relationship => ({ id: `rel-coffee-external-participation-${index + 1}`, sourceId: external.id, targetId: prepareUseCase.id, relationshipType: "involvedIn", createdAt: stamp, updatedAt: stamp }))
  );
  const massVerification = element("verificationMethod", "Appliance mass-budget analysis", {
    description: "Checks the realized coffee-machine mass against the mandatory appliance mass limit using current parameter evidence.",
    metadata: { source: "Coffee-machine mass budget", owner: "Product Engineering", verificationCategory: "analysis" }
  });
  project.elements.push(massVerification);
  project.relationships.push({
    id: "rel-coffee-mass-verification",
    sourceId: massVerification.id,
    targetId: elementId("systemRequirement", "The system shall remain below the equipment mass target"),
    relationshipType: "verifies",
    createdAt: stamp,
    updatedAt: stamp
  });
  const verifiedMachine = element("productComponent", "Verified coffee machine", {
    description: "Manufactured coffee machine released from the industrial process after end-of-line verification.",
    tags: ["productComponent", "lifecycle-state"],
    metadata: { source: "Manufacturing concept", owner: "Manufacturing Engineering", massAccounting: "includedElsewhere", massAccountingNote: "Lifecycle-state representation of the delivered coffee-machine assembly; not a second physical mass contribution." }
  });
  project.elements.push(verifiedMachine);

  const manufactureId = elementId("processFunction", "Load components");
  const integrateId = elementId("processFunction", "Join components");
  const testId = elementId("processFunction", "Inspect assembly");
  const purchasedKitId = elementId("productComponent", "Input component");
  const ingredientModuleId = elementId("productComponent", "Material handling module");
  const brewingModuleId = elementId("productComponent", "Joining module");
  const sensingModuleId = elementId("productComponent", "Inspection module");
  const integratedMachineId = elementId("productComponent", "Assembled product");
  const manufacturingFunctionIds = new Set([manufactureId, integrateId, testId]);
  project.relationships = project.relationships.filter((candidate) =>
    !manufacturingFunctionIds.has(candidate.sourceId)
    || !["consumes", "produces"].includes(candidate.relationshipType)
  );
  const manufacturingFlow = (
    id: string,
    sourceId: string,
    relationshipType: "consumes" | "produces",
    targetId: string,
    itemFlowName: string,
    unit: string
  ): Relationship => ({
    id,
    sourceId,
    targetId,
    relationshipType,
    itemFlowName,
    quantity: 1,
    unit,
    createdAt: stamp,
    updatedAt: stamp
  });
  project.relationships.push(
    manufacturingFlow("rel-coffee-kit-in", manufactureId, "consumes", purchasedKitId, "Purchased parts released to production", "kit"),
    manufacturingFlow("rel-coffee-ingredient-module-out", manufactureId, "produces", ingredientModuleId, "Manufactured ingredient-handling module", "module"),
    manufacturingFlow("rel-coffee-brewing-module-out", manufactureId, "produces", brewingModuleId, "Manufactured brewing and heating module", "module"),
    manufacturingFlow("rel-coffee-sensing-module-out", manufactureId, "produces", sensingModuleId, "Manufactured beverage sensing module", "module"),
    manufacturingFlow("rel-coffee-ingredient-module-in", integrateId, "consumes", ingredientModuleId, "Ingredient-handling module for integration", "module"),
    manufacturingFlow("rel-coffee-brewing-module-in", integrateId, "consumes", brewingModuleId, "Brewing and heating module for integration", "module"),
    manufacturingFlow("rel-coffee-sensing-module-in", integrateId, "consumes", sensingModuleId, "Beverage sensing module for integration", "module"),
    manufacturingFlow("rel-coffee-integrated-machine-out", integrateId, "produces", integratedMachineId, "Integrated coffee machine", "machine"),
    manufacturingFlow("rel-coffee-integrated-machine-in", testId, "consumes", integratedMachineId, "Integrated coffee machine for end-of-line test", "machine"),
    manufacturingFlow("rel-coffee-verified-machine-out", testId, "produces", verifiedMachine.id, "Verified coffee machine", "machine")
  );
  project.functionSequences = project.functionSequences.map((sequence) => sequence.domain === "process"
    ? {
        ...sequence,
        name: "Coffee-machine manufacturing process",
        description: "Manufacture product modules, integrate them into the coffee machine, then perform end-of-line verification."
      }
    : {
        ...sequence,
        name: "Coffee-machine product behavior",
        description: "Product-function sequence for ingredient metering, brewing and beverage monitoring."
      });
  project.objectives = project.elements
    .filter((element) => element.elementType === "objective")
    .map((element) => element.name);
  project.architectures = project.architectures
    .filter((architecture) => architecture.id !== "arch-invalid")
    .map((architecture) => architecture.id === "arch-manual"
      ? { ...architecture, name: "Essential Capsule", description: "Compact capsule-based machine for simple operation." }
      : { ...architecture, name: "Premium Dual Boiler", description: "Bean-to-cup machine with dual-boiler performance." });
  project.configurations = project.configurations
    .filter((configuration) => configuration.id !== "configuration-invalid")
    .map((configuration) => configuration.id === "configuration-manual"
      ? { ...configuration, name: "Essential Capsule" }
      : { ...configuration, name: "Premium Dual Boiler" });
  const essential = project.configurations.find((configuration) => configuration.id === "configuration-manual")!;
  const balancedConfiguration = {
    ...structuredClone(essential),
    id: "configuration-balanced",
    name: "Balanced Bean-to-Cup",
    architectureId: "arch-balanced",
    manuallySelectedFeatureIds: [
      "feature-automated-feeding",
      "feature-manual-fastening",
      "feature-vision",
      "feature-data-recording"
    ],
    createdAt: stamp,
    updatedAt: stamp,
    derivation: undefined,
    derivedElementIds: [],
    excludedElementIds: []
  };
  project.architectures.push({
    id: "arch-balanced",
    name: "Balanced Bean-to-Cup",
    description: "Single-heater bean-to-cup architecture balancing convenience, cost and performance.",
    status: "configured",
    configurationId: balancedConfiguration.id,
    createdAt: stamp,
    updatedAt: stamp
  });
  project.configurations.push(
    applySelectionToConfiguration(balancedConfiguration, project.features, project.featureConstraints)
  );
  project.elements.forEach((element) => {
    element.parameters.forEach((parameter) => {
      if (parameter.applicableConfigurationIds.includes("configuration-manual")) {
        parameter.applicableConfigurationIds = [
          ...new Set([...parameter.applicableConfigurationIds, "configuration-balanced"])
        ];
      }
    });
  });
  const featureNames: Record<string, string> = {
    "Industrial Assembly Machine": "Coffee Machine Product Line",
    "Core Control": "Common Brew Control",
    "Safety Package": "Food and Electrical Safety",
    "Manual Loading": "Capsule Input",
    "Automated Feeding": "Automatic Bean Grinder",
    "Manual Fastening": "Single Thermoblock",
    "Robotic Fastening": "Dual Boiler",
    "Vision Inspection": "Beverage Sensing",
    "Probe Inspection": "Milk Temperature Probe",
    "Data Recording": "Brew History",
    "Advanced Analytics": "Adaptive Brew Profile",
    "Operating Voltage": "Regional Voltage"
  };
  project.features = project.features.map((feature) => ({
    ...feature,
    name: featureNames[feature.name] ?? feature.name,
    description: `${featureNames[feature.name] ?? feature.name} option in the coffee-machine 150% model.`
  }));
  const variabilityNames: Record<string, { name: string; description: string }> = {
    "feature-group-loading": { name: "Coffee input system", description: "Capsule input or automatic bean grinding." },
    "feature-group-assembly": { name: "Brewing technology", description: "Single-thermoblock or dual-boiler brewing architecture." },
    "feature-group-inspection": { name: "Beverage sensing options", description: "Selectable beverage and milk-temperature sensing." },
    "axis-loading": { name: "Coffee input system", description: "Capsule input or automatic bean grinding." },
    "axis-assembly": { name: "Brewing technology", description: "Single-thermoblock or dual-boiler brewing architecture." },
    "axis-inspection": { name: "Beverage sensing options", description: "Selectable beverage and milk-temperature sensing." }
  };
  project.featureGroups = project.featureGroups.map((group) => ({ ...group, ...variabilityNames[group.id] }));
  project.variabilityAxes = project.variabilityAxes.map((axis) => ({ ...axis, ...variabilityNames[axis.id] }));
  project.featureConstraints = project.featureConstraints.filter((constraint) => constraint.id !== "constraint-feed-robot");
  const voltageFeature = project.features.find((feature) => feature.id === "feature-operating-voltage")!;
  voltageFeature.allowedValues = ["110V", "230V"];
  voltageFeature.defaultValue = "230V";
  essential.featureValues = { "feature-operating-voltage": "110V" };
  balancedConfiguration.featureValues = { "feature-operating-voltage": "230V" };
  project.configurations.find((configuration) => configuration.id === "configuration-balanced")!.featureValues = { "feature-operating-voltage": "230V" };
  project.configurations.find((configuration) => configuration.id === "configuration-automated")!.featureValues = { "feature-operating-voltage": "230V" };

  const throughputParameter = project.elements.find((candidate) => candidate.id === ingredientModuleId)!.parameters.find((parameter) => parameter.semanticKey === "throughput")!;
  throughputParameter.name = "Declared beverage throughput";
  throughputParameter.value = 10;
  throughputParameter.unit = "beverage/h";
  throughputParameter.minimum = 8;
  throughputParameter.maximum = 16;
  throughputParameter.applicableConfigurationIds = [];
  throughputParameter.source = "Preliminary heater-recovery and preparation duty-cycle estimate";
  const ingredient = project.elements.find((candidate) => candidate.id === ingredientModuleId)!;
  ingredient.metadata.massAccounting = "contributes";
  ingredient.parameters.push({ ...parameter(ingredient.id, "Module mass", 2, "kg"), id: "par-coffee-ingredient-mass", semanticKey: "mass", contributionBasis: "local", quantityBasis: "One complete ingredient-handling module" });
  const brewing = project.elements.find((candidate) => candidate.id === brewingModuleId)!;
  const brewingMass = brewing.parameters.find((parameter) => parameter.semanticKey === "mass")!;
  Object.assign(brewingMass, { name: "Brewing-module mass", value: 3, unit: "kg", minimum: 2, maximum: 9, applicableConfigurationIds: [], contributionBasis: "local", quantityBasis: "One complete brewing and heating module", source: "Preliminary module mass budget" });
  brewing.parameters = brewing.parameters.filter((parameter) => !["par-automated-mass", "par-automated-cost", "par-automated-power"].includes(parameter.id));
  const directCost = brewing.parameters.find((parameter) => parameter.id === "par-manual-cost")!;
  Object.assign(directCost, { name: "Preliminary appliance direct cost", semanticKey: "cost", value: 120, unit: "EUR", minimum: 100, maximum: 500, applicableConfigurationIds: [], source: "Illustrative early product-cost assumption" });
  const power = brewing.parameters.find((parameter) => parameter.id === "par-manual-power")!;
  Object.assign(power, { name: "Rated appliance power", semanticKey: "power", value: 1.2, unit: "kW", minimum: 1, maximum: 2, applicableConfigurationIds: [], source: "Illustrative household-appliance power budget" });
  const sensing = project.elements.find((candidate) => candidate.id === sensingModuleId)!;
  sensing.metadata.massAccounting = "contributes";
  const qualityParameter = sensing.parameters.find((parameter) => parameter.semanticKey === "quality_confidence")!;
  Object.assign(qualityParameter, { name: "Maximum beverage-volume deviation", semanticKey: "beverage_volume_deviation", value: 3, unit: "%", minimum: 0, maximum: 5, applicableConfigurationIds: [], source: "Preliminary metering-error budget" });
  sensing.parameters.push({ ...parameter(sensing.id, "Module mass", 1, "kg"), id: "par-coffee-sensing-mass", semanticKey: "mass", contributionBasis: "local", quantityBasis: "One complete beverage-sensing module" });

  const throughputRequirement = project.elements.find((candidate) => candidate.id === elementId("systemRequirement", "The system shall achieve target throughput"))!;
  throughputRequirement.name = "The coffee machine shall prepare at least 10 beverages per hour under the declared duty cycle.";
  throughputRequirement.description = "Quantitative early performance requirement checked against the configured beverage-throughput parameter.";
  throughputRequirement.requirementFormula = { expression: "@throughput >= 10", bindings: [{ id: "binding-throughput", symbol: "throughput", kind: "parameter", targetId: throughputParameter.id }] };
  const qualityRequirement = project.elements.find((candidate) => candidate.id === elementId("systemRequirement", "The system shall verify assembly quality"))!;
  qualityRequirement.name = "The coffee machine shall keep maximum delivered beverage-volume deviation at or below 5%.";
  qualityRequirement.description = "A measurable proxy for delivered-volume consistency; it does not claim to cover taste or all beverage-quality attributes.";
  qualityRequirement.requirementFormula = { expression: "@volume_error <= 5", bindings: [{ id: "binding-quality-confidence", symbol: "volume_error", kind: "parameter", targetId: qualityParameter.id }] };
  const massRequirement = project.elements.find((candidate) => candidate.id === elementId("systemRequirement", "The system shall remain below the equipment mass target"))!;
  massRequirement.name = "The coffee machine empty mass shall not exceed 15 kg.";
  massRequirement.description = "Quantitative product-boundary requirement checked against the configured component mass roll-up.";
  massRequirement.requirementFormula = { expression: "@empty_mass <= 15", bindings: [{ id: "binding-mass", symbol: "empty_mass", kind: "kpi", targetId: "kpi-mass" }] };
  const qualityMethod = project.elements.find((candidate) => candidate.id === elementId("verificationMethod", "Dimensional inspection"))!;
  qualityMethod.name = "Delivered-volume repeatability test";
  qualityMethod.description = "Measures delivered volume over the declared beverage cycle and sample count.";
  const throughputMethod = project.elements.find((candidate) => candidate.id === elementId("verificationMethod", "Cycle-time analysis"))!;
  throughputMethod.name = "Beverage duty-cycle test and analysis";
  throughputMethod.description = "Checks configured beverage throughput under the stated recovery and preparation duty cycle.";

  const lifecycleIds = new Set([purchasedKitId, integratedMachineId, verifiedMachine.id]);
  project.elements.filter((candidate) => lifecycleIds.has(candidate.id)).forEach((candidate) => {
    candidate.tags = [...new Set([...candidate.tags, "lifecycle-state"])];
    candidate.metadata.massAccounting = candidate.id === purchasedKitId ? "outsideBoundary" : "includedElsewhere";
    candidate.metadata.massAccountingNote = candidate.id === purchasedKitId
      ? "Incoming manufacturing material representation; outside the delivered-product roll-up to avoid duplicating module masses."
      : "Lifecycle-state representation of the same delivered assembly; not an additional physical mass contribution.";
    delete candidate.metadata.parentAssemblyId;
  });
  project.relationships = project.relationships.filter((relationship) => !(relationship.containment && lifecycleIds.has(relationship.sourceId)));

  const coffeeRules = (pointId: string, values: Array<[string, number]>) => values.map(([featureExpression, value], index) => ({ id: `${pointId}-${index + 1}`, featureExpression, featureValueConditions: [], value }));
  const coffeeParameterVariation = (pointId: string, name: string, ownerId: string, parameterId: string, values: Array<[string, number]>, scope: VariationPoint["scope"]): VariationPoint => ({
    id: pointId, name, description: "Maps selected product features to one stable 150 percent model parameter.", kind: "primitiveProperty", constrainedElementIds: [ownerId], constrainedRelationshipIds: [], featureExpression: "", featureValueConditions: [], propertyPath: `parameter:${parameterId}:value`, valueRules: coffeeRules(pointId, values), unmatchedBehavior: "error", scope, enabled: true, createdAt: stamp, updatedAt: stamp
  });
  const configurationCases: Array<[string, number]> = [
    ["feature-manual-loading and feature-manual-fastening", 10],
    ["feature-automated-feeding and feature-manual-fastening", 12],
    ["feature-automated-feeding and feature-robotic-fastening", 14]
  ];
  project.variationPoints.push(
    coffeeParameterVariation("variation-coffee-throughput", "Beverage throughput by coffee architecture", ingredient.id, throughputParameter.id, configurationCases, "behavior"),
    coffeeParameterVariation("variation-coffee-brewing-mass", "Brewing mass by coffee architecture", brewing.id, brewingMass.id, configurationCases.map(([expression], index) => [expression, [3, 5, 8][index]]), "structure"),
    coffeeParameterVariation("variation-coffee-direct-cost", "Direct cost by coffee architecture", brewing.id, directCost.id, configurationCases.map(([expression], index) => [expression, [120, 230, 410][index]]), "structure"),
    coffeeParameterVariation("variation-coffee-power", "Rated power by coffee architecture", brewing.id, power.id, configurationCases.map(([expression], index) => [expression, [1.2, 1.5, 1.8][index]]), "structure"),
    coffeeParameterVariation("variation-coffee-volume-error", "Volume deviation by coffee architecture", sensing.id, qualityParameter.id, configurationCases.map(([expression], index) => [expression, [3, 2, 1.5][index]]), "verification")
  );
  project.variationPoints.forEach((point) => { if (point.valueRules.length) point.unmatchedBehavior = "error"; });
  const voltagePoint = project.variationPoints.find((point) => point.id === "variation-control-voltage");
  if (voltagePoint) {
    voltagePoint.name = "Household supply voltage";
    voltagePoint.description = "Maps the typed regional-voltage choice to the product power-interface description.";
    voltagePoint.constrainedElementIds = [powerInterface.id];
    voltagePoint.featureExpression = "";
    voltagePoint.valueRules = [
      { id: "variation-control-voltage-110", featureExpression: "", featureValueConditions: [{ featureId: "feature-operating-voltage", operator: "equals", value: "110V" }], value: "Household power interface configured for a 110 V regional supply." },
      { id: "variation-control-voltage-230", featureExpression: "", featureValueConditions: [{ featureId: "feature-operating-voltage", operator: "equals", value: "230V" }], value: "Household power interface configured for a 230 V regional supply." }
    ];
  }
  project.unitDefinitions.push({ id: "unit-beverage", symbol: "beverage", name: "beverage", quantityName: "item count", dimension: { count: 1 }, factorToSI: 1, aliases: ["beverages", "cup", "cups"] });
  const manufacturingThroughput = project.kpis.find((kpi) => kpi.id === "kpi-throughput")!;
  manufacturingThroughput.name = "Manufacturing throughput proxy";
  manufacturingThroughput.description = "Simplified inverse manufacturing critical-path duration; distinct from beverage throughput.";
  manufacturingThroughput.outputUnit = "1/h";
  const beverageThroughput = project.kpis.find((kpi) => kpi.id === "kpi-handling-rate")!;
  beverageThroughput.name = "Beverage throughput KPI";
  beverageThroughput.description = "Configured beverage throughput from the owned product parameter.";
  beverageThroughput.outputUnit = "beverage/h";
  project.kpis.find((kpi) => kpi.id === "kpi-mass")!.maximumThreshold = 15;
  project.openDecisions = [{
    id: "open-decision-mode",
    question: "Which coffee-machine architecture should become the product-line baseline?",
    description: "Compare three configured 100% alternatives using mandatory requirements, Pareto trade-offs and fixed stakeholder value.",
    status: "inReview",
    relatedElementIds: []
  }];
  project.kpis = project.kpis.map((kpi) => ({
    ...kpi,
    description: `${kpi.name} preliminary evidence for the coffee-machine alternatives.`
  }));
  prepareOntologySample(project);
  project.configurations = project.configurations.map((configuration) => {
    const attempt = deriveConfiguration(project, configuration);
    return attempt.result ? attempt.configuration : configuration;
  });
  const selectedKpiIds = ["kpi-mass", "kpi-cost", "kpi-lead-time", "kpi-handling-rate"];
  const comparableRuns = [
    ["configuration-manual", "Essential Capsule — comparable simulation"],
    ["configuration-balanced", "Balanced Bean-to-Cup — comparable simulation"],
    ["configuration-automated", "Premium Dual Boiler — comparable simulation"]
  ].map(([configurationId, name]) => runSimulation(project, {
    name,
    configurationId,
    selectedKpiIds,
    selectedAlgorithmKeys: []
  }).run).filter((run): run is SimulationRun => Boolean(run));
  const balancedRun = comparableRuns.find((run) => run.configurationId === balancedConfiguration.id);
  const study = project.comparisonStudies[0];
  if (!study || !balancedRun) return project;
  project.simulationRuns = comparableRuns;
  study.name = "Coffee-machine architecture selection";
  study.description = "Three-candidate coffee-machine product-line trade study.";
  study.question = project.openDecisions[0].question;
  study.intendedOutcome = "Select a feasible coffee-machine architecture with robust stakeholder value and establish an approved baseline.";
  study.lifecycleScope = "Early product-line architecture definition";
  study.systemScope = "Household coffee-machine product line";
  study.status = "decided";
  study.selectedKpiIds = [...selectedKpiIds];
  study.kpiSettings = Object.fromEntries(selectedKpiIds.map((kpiId) => {
    const kpi = project.kpis.find((candidate) => candidate.id === kpiId)!;
    return [kpiId, { weight: kpi.weight, optimizationDirection: kpi.optimizationDirection }];
  }));
  study.candidateRefs = [
    {
      id: "candidate-essential",
      label: "Essential Capsule",
      architectureId: "arch-manual",
      configurationId: "configuration-manual"
    },
    {
      id: "candidate-balanced",
      label: "Balanced Bean-to-Cup",
      architectureId: "arch-balanced",
      configurationId: "configuration-balanced"
    },
    {
      id: "candidate-premium",
      label: "Premium Dual Boiler",
      architectureId: "arch-auto",
      configurationId: "configuration-automated"
    }
  ];
  const runByConfiguration = new Map(project.simulationRuns.map((run) => [run.configurationId, run]));
  study.alternativeRefs = study.candidateRefs.map((candidate) => ({
    id: `alternative-${candidate.id.replace("candidate-", "")}`,
    label: candidate.label,
    architectureId: candidate.architectureId,
    configurationId: candidate.configurationId,
    simulationRunId: runByConfiguration.get(candidate.configurationId)!.id
  }));
  study.criteria = [
    {
      id: "criterion-throughput",
      name: "Beverage throughput",
      description: "Stakeholder value increases from 0 at 4 beverages/hour to 100 at 14 beverages/hour.",
      type: "optimization",
      sourceObjectiveIds: [elementId("objective", "Reach ten assemblies per hour")],
      sourceRequirementIds: [elementId("systemRequirement", "The system shall achieve target throughput")],
      kpiId: "kpi-handling-rate",
      weight: 3,
      valueFunction: "maximize",
      stakeholderValueFunction: { type: "maximize", worst: 4, best: 14 }
    },
    {
      id: "criterion-mass",
      name: "Appliance mass",
      description: "Lower mass creates higher value within fixed stakeholder bounds.",
      type: "optimization",
      sourceObjectiveIds: [elementId("objective", "Keep process equipment mass below target")],
      sourceRequirementIds: [elementId("systemRequirement", "The system shall remain below the equipment mass target")],
      kpiId: "kpi-mass",
      weight: 2,
      valueFunction: "minimize",
      stakeholderValueFunction: { type: "minimize", worst: 15, best: 5 }
    },
    {
      id: "criterion-cost",
      name: "Estimated unit and manufacturing cost",
      description: "Fixed stakeholder value decreases between 500 EUR and 100 EUR for this preliminary demonstrator estimate.",
      type: "optimization",
      sourceObjectiveIds: study.objectiveIds,
      sourceRequirementIds: [],
      kpiId: "kpi-cost",
      weight: 3,
      valueFunction: "minimize",
      stakeholderValueFunction: { type: "minimize", worst: 500, best: 100 }
    },
    {
      id: "criterion-lead-time",
      name: "Manufacturing lead time",
      description: "Fixed stakeholder value decreases between 0.30 hour and 0.10 hour for the modeled manufacturing sequence.",
      type: "optimization",
      sourceObjectiveIds: study.objectiveIds,
      sourceRequirementIds: [],
      kpiId: "kpi-lead-time",
      weight: 2,
      valueFunction: "minimize",
      stakeholderValueFunction: { type: "minimize", worst: 0.30, best: 0.10 }
    }
  ];
  study.scenarios = [
    {
      id: "scenario-energy-price",
      name: "Energy consequence",
      description: "Screening case adding a bounded power-related cost consequence.",
      createdAt: stamp,
      effects: [{ id: "effect-cost-plus", type: "kpiPercent", targetId: "kpi-cost", percent: 8 }]
    },
    {
      id: "scenario-supplier-delay",
      name: "Supplier lead-time delay",
      description: "Screening case adding two hours to manufacturing lead time.",
      createdAt: stamp,
      effects: [{ id: "effect-lead-add", type: "kpiAdditive", targetId: "kpi-lead-time", amount: 2 }]
    }
  ];
  study.feasibilityExceptions = {};
  study.results = [];
  const methodology = runTradeStudyMethodology(project, study, new Date(stamp));
  if (methodology.result) {
    study.results.push(methodology.result);
    study.sensitivityResult = runFixedWeightSensitivity(project, study, new Date(stamp)).result;
    study.robustnessResults = [runBoundedRobustness(project, study, methodology.result, new Date(stamp))];
  }
  project.comparisonRisks = [
    {
      id: "risk-essential-capacity",
      comparisonStudyId: study.id,
      alternativeId: "alternative-essential",
      title: "Capsule throughput margin",
      description: "Peak sequential beverage demand may exceed the compact heater recovery rate.",
      inherentLikelihood: 3,
      inherentImpact: 3,
      residualLikelihood: 2,
      residualImpact: 3,
      mitigation: "Validate heater recovery time with a representative duty cycle.",
      owner: "Thermal Lead",
      status: "mitigating",
      applicableArchitectureIds: ["arch-manual"],
      applicableConfigurationIds: ["configuration-manual"],
      applicableRequirementIds: [elementId("systemRequirement", "The system shall achieve target throughput")],
      applicableParameterIds: [],
      applicableKpiIds: ["kpi-handling-rate"],
      reviewRequired: false
    },
    {
      id: "risk-premium-complexity",
      comparisonStudyId: study.id,
      alternativeId: "alternative-premium",
      title: "Dual-boiler integration complexity",
      description: "Integration complexity may increase introduction lead time.",
      inherentLikelihood: 4,
      inherentImpact: 4,
      residualLikelihood: 3,
      residualImpact: 3,
      mitigation: "Use staged integration and a supplier design-maturity review.",
      owner: "Product Architect",
      status: "mitigating",
      applicableArchitectureIds: ["arch-auto"],
      applicableConfigurationIds: ["configuration-automated"],
      applicableRequirementIds: [],
      applicableParameterIds: [],
      applicableKpiIds: ["kpi-lead-time"],
      reviewRequired: false
    }
  ];
  const latest = study.results.at(-1);
  const selectedId = latest?.recommendedAlternativeIds?.[0] ?? "alternative-balanced";
  const selected = study.alternativeRefs.find((alternative) => alternative.id === selectedId)
    ?? study.alternativeRefs[1];
  const decisionDate = "2026-07-31T09:00:00.000Z";
  const supportingRuns = study.alternativeRefs
    .map((alternative) => project.simulationRuns.find((run) => run.id === alternative.simulationRunId))
    .filter((run): run is NonNullable<typeof run> => Boolean(run));
  const decisionSnapshot = latest ? {
    capturedAt: decisionDate,
    projectModelRevision: project.modelRevision,
    question: study.question,
    intendedOutcome: study.intendedOutcome,
    objectiveIds: [...study.objectiveIds],
    criteria: structuredClone(study.criteria),
    candidateAlternatives: structuredClone(study.alternativeRefs),
    selectedAlternative: selected.label,
    rejectedAlternatives: study.alternativeRefs
      .map((alternative) => alternative.label)
      .filter((label) => label !== selected.label),
    mandatoryCompliance: structuredClone(latest.feasibility ?? {}),
    valueFunctionsAndWeights: study.criteria.map((criterion) => ({
      criterionId: criterion.id,
      kpiId: criterion.kpiId,
      weight: criterion.weight ?? 0,
      valueFunction: structuredClone(criterion.stakeholderValueFunction)
    })),
    rawEvidence: structuredClone(latest.rawValues),
    transformedEvidence: structuredClone(latest.stakeholderValues ?? latest.normalizedScores),
    paretoResults: structuredClone(latest.pareto ?? {}),
    sensitivity: structuredClone(study.sensitivityResult),
    risks: structuredClone(project.comparisonRisks),
    scenarios: structuredClone(study.scenarios ?? []),
    robustnessResults: structuredClone(study.robustnessResults ?? []),
    assumptions: [],
    limitations: [
      "Preliminary engineering estimate — not a verified detailed-design result.",
      ...latest.warnings
    ],
    derivationIds: supportingRuns.map((run) => run.derivationId).filter((value): value is string => Boolean(value)),
    simulationRunIds: supportingRuns.map((run) => run.id),
    rationale: "Sample governance decision: mandatory feasibility, Pareto position, fixed stakeholder value, sensitivity and bounded robustness were reviewed together.",
    owner: "Sample Product Governance Board",
    decisionDate,
    openActions: ["Confirm supplier evidence before detailed design."]
  } : undefined;
  project.decisions = [{
    id: "decision-coffee-baseline",
    question: study.question,
    alternatives: study.alternativeRefs.map((alternative) => alternative.label),
    criteria: study.criteria.map((criterion) => criterion.name),
    selectedAlternative: selected.label,
    rationale: "Sample governance decision: mandatory feasibility, Pareto position, fixed stakeholder value, sensitivity and bounded robustness were reviewed together.",
    supportingSimulationRunIds: study.alternativeRefs.map((alternative) => alternative.simulationRunId),
    supportingComparisonStudyIds: [study.id],
    assumptions: [],
    risks: project.comparisonRisks.map((risk) => risk.title),
    openActions: ["Confirm supplier evidence before detailed design."],
    status: "approved",
    owner: "Sample Product Governance Board",
    decisionDate,
    baselineApprovalConfirmed: true,
    evidenceSnapshot: decisionSnapshot,
    createdAt: decisionDate,
    updatedAt: decisionDate
  }];
  project.baselineArchitectureId = selected.architectureId;
  project.architectures = project.architectures.map((architecture) => ({
    ...architecture,
    status: architecture.id === selected.architectureId ? "baseline" : "candidate"
  }));
  project.openDecisions[0] = {
    ...project.openDecisions[0],
    status: "closed",
    linkedFormalDecisionId: "decision-coffee-baseline"
  };
  const baselineRun = project.simulationRuns.find((run) => run.configurationId === selected.configurationId);
  if (baselineRun) project.kpis = project.kpis.map((kpi) => ({ ...kpi, lastCalculatedValue: baselineRun.results.find((result) => result.kpiId === kpi.id)?.value ?? kpi.lastCalculatedValue }));
  return project;
}

/** Backward-compatible industrial fixture retained for Stage-A/B/C regression tests and JSON examples. */
export function createSampleProject(projectId = "project-sample"): Project {
  return createIndustrialAssemblySampleProject(projectId);
}
