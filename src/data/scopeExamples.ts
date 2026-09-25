import { deriveConfiguration } from "../domain/derivation";
import { runSimulation } from "../domain/simulation";
import { validateProject } from "../domain/validation";
import { applySelectionToConfiguration } from "../domain/variability";
import type { ElementType, FunctionSequence, KPI, ModelElement, Parameter, Project, Relationship } from "../domain/types";
import { prepareOntologySample } from "./ontologySample";

const stamp = "2026-09-11T10:00:00.000Z";
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type ExampleContent = {
  projectId: string;
  name: string;
  description: string;
  scope: "architectureBuilding" | "architectureAndSimulation";
  mission: string;
  system: string;
  boundary: string;
  stakeholder: string;
  externalSystem: string;
  need: string;
  objective: string;
  useCase: string;
  requirementName: string;
  requirementLimit: number;
  requirementUnit: string;
  productFunctions: string[];
  productComponents: Array<{ name: string; mass: number }>;
  productInterface: string;
  processFunctions: Array<{ name: string; duration: number }>;
  industrialComponents: string[];
  processInterface: string;
  resource: string;
};

function parameter(ownerElementId: string, name: string, semanticKey: string, value: number, unit: string): Parameter {
  return { id: `PAR-${slug(ownerElementId)}-${slug(name)}`, ownerElementId, name, semanticKey, description: `${name} preliminary example input.`, dataType: "number", value, unit, valueOrigin: "assumed", source: "Worked example assumption", applicableConfigurationIds: [], contributionBasis: semanticKey === "mass" ? "local" : undefined, quantityBasis: semanticKey === "mass" ? "One modeled product" : undefined };
}

function buildScopeExample(content: ExampleContent): Project {
  const id = (type: string, name: string) => `${type.toUpperCase()}-${slug(name)}`;
  const element = (elementType: ElementType, name: string, extra: Partial<ModelElement> = {}): ModelElement => ({
    id: extra.id ?? id(elementType, name), elementType, name, description: extra.description ?? `${name} in the ${content.name} worked example.`, status: "reviewed", architectureScope: "common", parameters: extra.parameters ?? [], requirementFormula: extra.requirementFormula, customAttributeValues: {}, tags: ["worked-example", elementType], metadata: { source: "Examples guide", owner: "Systems Engineering", ...extra.metadata }, createdAt: stamp, updatedAt: stamp
  });
  const mission = element("mission", content.mission);
  const stakeholder = element("stakeholder", content.stakeholder);
  const external = element("externalSystem", content.externalSystem);
  const need = element("need", content.need);
  const objective = element("objective", content.objective);
  const useCase = element("useCase", content.useCase);
  const root = element("productComponent", `${content.system} assembly`, { id: "PC-ROOT", metadata: { massAccounting: "includedElsewhere", massAccountingNote: "Mass is represented by the child contributions." } });
  const system = element("system", content.system, { metadata: { isSystemOfInterest: true, architectureRootId: root.id, systemBoundary: content.boundary } });
  useCase.metadata.subjectSystemId = system.id;
  const productFunctions = content.productFunctions.map((name) => element("productFunction", name));
  const productComponents = content.productComponents.map(({ name, mass }) => {
    const component = element("productComponent", name, { metadata: { parentAssemblyId: root.id, massAccounting: "contributes" } });
    component.parameters = [parameter(component.id, "Mass", "mass", mass, content.requirementUnit)];
    return component;
  });
  const productInterface = element("productInterface", content.productInterface);
  const processFunctions = content.processFunctions.map(({ name, duration }) => element("processFunction", name, { metadata: { duration, durationUnit: "minute", processType: "assembly" } }));
  const industrialComponents = content.industrialComponents.map((name) => element("industrialSystemComponent", name));
  const processInterface = element("processInterface", content.processInterface);
  const resource = element("resource", content.resource, { metadata: { resourceType: "person", capacity: 1, capacityHours: 8, availabilityPercent: 90, hourlyRate: 55, costUnit: "EUR/h" } });
  const verification = element("verificationMethod", `Calculate ${content.requirementName.toLowerCase()}`);
  const massBindings = productComponents.map((component, index) => ({ id: `BIND-${index + 1}`, symbol: `m${index + 1}`, kind: "parameter" as const, targetId: component.parameters[0].id }));
  const requirement = element("systemRequirement", content.requirementName, { requirementFormula: { expression: `${massBindings.map((binding) => `@${binding.symbol}`).join(" + ")} <= ${content.requirementLimit}`, bindings: massBindings, bindingUnits: Object.fromEntries(massBindings.map((binding) => [binding.symbol, content.requirementUnit])), comparisonUnit: content.requirementUnit } });
  const elements = [mission, system, stakeholder, external, need, objective, useCase, requirement, verification, root, ...productFunctions, ...productComponents, productInterface, ...processFunctions, ...industrialComponents, processInterface, resource];
  const relationships: Relationship[] = [];
  const relate = (sourceId: string, relationshipType: Relationship["relationshipType"], targetId: string, extra: Partial<Relationship> = {}) => relationships.push({ id: `REL-${relationships.length + 1}`, sourceId, targetId, relationshipType, createdAt: stamp, updatedAt: stamp, ...extra });
  relate(mission.id, "hasSOI", system.id);
  relate(mission.id, "hasStakeholder", stakeholder.id);
  relate(mission.id, "participatesInMission", external.id);
  relate(stakeholder.id, "hasNeed", need.id);
  relate(stakeholder.id, "hasObjective", objective.id);
  relate(stakeholder.id, "involvedIn", useCase.id);
  relate(external.id, "involvedIn", useCase.id);
  relate(useCase.id, "addresses", need.id);
  relate(useCase.id, "addresses", objective.id);
  relate(need.id, "derives", requirement.id);
  relate(objective.id, "derives", requirement.id);
  relate(requirement.id, "satisfiedBy", productComponents[0].id);
  relate(verification.id, "verifies", requirement.id);
  productFunctions.forEach((fn, index) => { relate(useCase.id, "hasFunction", fn.id); relate(fn.id, "realizedBy", productComponents[index % productComponents.length].id); });
  relate(productFunctions[0].id, "connects", productInterface.id);
  relate(productComponents[0].id, "connects", productInterface.id);
  relate(external.id, "connects", productInterface.id);
  productComponents.forEach((component) => relate(component.id, "refines", root.id, { containment: true }));
  processFunctions.forEach((fn, index) => { relate(useCase.id, "hasFunction", fn.id); relate(fn.id, "realizedBy", industrialComponents[index % industrialComponents.length].id); relate(fn.id, "allocatedTo", productComponents[index % productComponents.length].id); });
  relate(processFunctions[0].id, "connects", processInterface.id);
  relate(industrialComponents[0].id, "connects", processInterface.id);
  industrialComponents.forEach((component) => relate(component.id, "requiresResource", resource.id, { requiredQuantity: 1, quantity: 1, unit: "person" }));
  const productSequenceRelationships: string[] = [];
  productFunctions.slice(0, -1).forEach((fn, index) => { relate(fn.id, "precedes", productFunctions[index + 1].id, { sequenceId: "SEQ-PRODUCT" }); productSequenceRelationships.push(relationships.at(-1)!.id); });
  const processSequenceRelationships: string[] = [];
  processFunctions.slice(0, -1).forEach((fn, index) => { relate(fn.id, "precedes", processFunctions[index + 1].id, { sequenceId: "SEQ-PROCESS" }); processSequenceRelationships.push(relationships.at(-1)!.id); });
  processFunctions.forEach((fn) => { relate(fn.id, "consumes", root.id, { quantity: 1, unit: "assembly", itemFlowName: `${content.system} work in progress` }); relate(fn.id, "produces", root.id, { quantity: 1, unit: "assembly", itemFlowName: `${content.system} work in progress` }); });
  const functionSequences: FunctionSequence[] = [
    { id: "SEQ-PRODUCT", name: `${content.useCase} behavior`, description: "Ordered product behavior for the worked example.", domain: "product", useCaseIds: [useCase.id], functionIds: productFunctions.map((fn) => fn.id), relationshipIds: productSequenceRelationships, createdAt: stamp, updatedAt: stamp },
    { id: "SEQ-PROCESS", name: `${content.system} assembly`, description: "Ordered assembly flow for the worked example.", domain: "process", useCaseIds: [useCase.id], functionIds: processFunctions.map((fn) => fn.id), relationshipIds: processSequenceRelationships, createdAt: stamp, updatedAt: stamp }
  ];
  const rootFeatureId = "FEAT-ROOT";
  const architectureId = "ARCH-BASELINE";
  const configurationId = "CFG-BASELINE";
  const features = [{ id: rootFeatureId, name: `${content.system} family`, featureType: "root" as const, sortOrder: 0, description: "Root feature for the example architecture.", valueType: "boolean" as const, allowedValues: [], defaultValue: true, variabilityScope: "external" as const }];
  const configurations = [applySelectionToConfiguration({ id: configurationId, name: `${content.system} baseline`, architectureId, manuallySelectedFeatureIds: [], automaticConstraintFeatureIds: [], effectiveSelectedFeatureIds: [], autoSelectedFeatureIds: [], featureValues: {}, realizationScopes: [], validationStatus: "notValidated" as const, validationMessages: [], derivedElementIds: [], excludedElementIds: [], createdAt: stamp, updatedAt: stamp }, features, [])];
  const kpis: KPI[] = content.scope === "architectureAndSimulation" ? [
    ["KPI-MASS", "Total product mass", content.requirementUnit, "totalMass", "minimize"],
    ["KPI-LEAD", "Assembly lead time", "h", "manufacturingLeadTime", "minimize"],
    ["KPI-THROUGHPUT", "Packing throughput", "1/h", "throughputProxy", "maximize"],
    ["KPI-RESOURCE", "Resource demand", "resource-h", "resourceDemand", "minimize"]
  ].map(([kpiId, name, outputUnit, standardAlgorithmKey, optimizationDirection]) => ({ id: kpiId, name, description: `${name} for the worked simulation example.`, objectiveIds: [objective.id], calculationMode: "standardAlgorithm", standardAlgorithmKey: standardAlgorithmKey as KPI["standardAlgorithmKey"], outputUnit, optimizationDirection: optimizationDirection as KPI["optimizationDirection"], weight: 1, inputParameterIds: [], dependsOnKpiIds: [], calculationWarnings: [], createdAt: stamp, updatedAt: stamp })) : [];
  const project: Project = { id: content.projectId, schemaVersion: 14, modelRevision: 1, name: content.name, description: content.description, overallScope: content.scope, objectives: [], openDecisions: [], baselineArchitectureId: architectureId, activeArchitectureId: architectureId, createdAt: stamp, updatedAt: stamp, architectures: [{ id: architectureId, name: `${content.system} baseline`, description: "Worked-example baseline architecture.", status: "baseline", configurationId, createdAt: stamp, updatedAt: stamp }], elements, relationships, functionSequences, selectedUseCaseIds: [useCase.id], rowOrderByType: {}, unitDefinitions: [], customAttributeDefinitions: [], features, featureGroups: [], variabilityAxes: [], featureConstraints: [], variationPoints: [], configurations, kpis, simulationRuns: [], comparisonStudies: [], comparisonRisks: [], decisions: [], validationResults: [] };
  prepareOntologySample(project);
  const derived = deriveConfiguration(project, project.configurations[0]);
  project.configurations[0] = derived.configuration;
  if (content.scope === "architectureAndSimulation") {
    const attempt = runSimulation(project, { name: `${content.system} baseline simulation`, configurationId, selectedKpiIds: kpis.map((kpi) => kpi.id), selectedAlgorithmKeys: [] });
    if (attempt.run) project.simulationRuns.push(attempt.run);
  }
  project.validationResults = validateProject(project);
  return project;
}

export function createEmergencyLightingExample(projectId = "project-emergency-lighting") {
  return buildScopeExample({ projectId, name: "Portable Emergency Lighting Unit", description: "Architecture-only example tracing emergency-lighting intent into product and assembly architecture.", scope: "architectureBuilding", mission: "Provide dependable temporary evacuation lighting", system: "Portable Emergency Lighting Unit", boundary: "Portable enclosure, energy storage, lighting module and their declared electrical interfaces.", stakeholder: "Facility safety manager", externalSystem: "Building mains supply", need: "Maintain visible evacuation routes during a power loss", objective: "Provide a lightweight deployable lighting unit", useCase: "Illuminate an evacuation route", requirementName: "Installed unit mass shall not exceed 2.5 kg", requirementLimit: 2.5, requirementUnit: "kg", productFunctions: ["Detect loss of mains power", "Store emergency energy", "Illuminate the evacuation route"], productComponents: [{ name: "Protective enclosure", mass: 0.7 }, { name: "Rechargeable battery module", mass: 1.1 }, { name: "LED lighting module", mass: 0.4 }], productInterface: "Mains charging interface", processFunctions: [{ name: "Assemble enclosure", duration: 3 }, { name: "Install battery module", duration: 2 }, { name: "Verify emergency illumination", duration: 2 }], industrialComponents: ["Assembly bench", "Electrical safety tester"], processInterface: "Electrical test connection", resource: "Assembly technician" });
}

export function createColdChainSimulationExample(projectId = "project-cold-chain") {
  return buildScopeExample({ projectId, name: "Reusable Cold-Chain Transport Box", description: "Architecture and simulation example linking a transport-box design to packing flow, resources, lead time and throughput.", scope: "architectureAndSimulation", mission: "Protect temperature-sensitive medicines throughout reusable distribution", system: "Reusable Cold-Chain Transport Box", boundary: "Reusable box, insulation, coolant and monitoring elements used for one medicine shipment.", stakeholder: "Pharmaceutical logistics operator", externalSystem: "Refrigerated delivery vehicle", need: "Keep medicine protected during distribution", objective: "Reduce packing time while retaining a portable box", useCase: "Prepare a temperature-controlled shipment", requirementName: "Prepared transport box mass shall not exceed 8 kg", requirementLimit: 8, requirementUnit: "kg", productFunctions: ["Insulate the payload", "Condition the payload space", "Record payload temperature"], productComponents: [{ name: "Reusable outer shell", mass: 2.4 }, { name: "Insulation liner", mass: 1.6 }, { name: "Coolant set", mass: 2.2 }, { name: "Temperature logger", mass: 0.3 }], productInterface: "Vehicle cargo interface", processFunctions: [{ name: "Prepare insulation liner", duration: 2 }, { name: "Install conditioned coolant", duration: 3 }, { name: "Activate and verify logger", duration: 1 }], industrialComponents: ["Pack-out station", "Logger commissioning station"], processInterface: "Pack-out data connection", resource: "Cold-chain operator" });
}
