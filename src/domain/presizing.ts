import {
  evaluateKpiFormula,
  formulaReferences,
  KpiFormulaError,
  kpiDependencyCycle,
  parseKpiFormula,
  type FormulaValue
} from "./kpiFormulas";
import { convertValue } from "./units";
import { physicalHierarchyErrors } from "./ontology";
import type {
  KPI,
  ModelElement,
  Parameter,
  Project,
  Relationship,
  SimulationResult,
  StandardAlgorithmKey
} from "./types";

export interface ActiveModel {
  elements: ModelElement[];
  relationships: Relationship[];
  configurationId?: string;
  rollupRootId?: string;
  unitDefinitions?: Project["unitDefinitions"];
}

export interface CalculationOutcome {
  results: SimulationResult[];
  errors: string[];
  warnings: string[];
}

const activeParameters = (model: ActiveModel) => model.elements.flatMap((element) =>
  element.parameters
    .filter((parameter) =>
      parameter.applicableConfigurationIds.length === 0
      || (!!model.configurationId && parameter.applicableConfigurationIds.includes(model.configurationId))
    )
    .map((parameter) => ({ parameter, element }))
);

const source = (parameter: Parameter, element: ModelElement) => ({
  id: parameter.id,
  name: `${element.name} / ${parameter.name}`,
  value: typeof parameter.value === "number" && Number.isFinite(parameter.value) ? parameter.value : null,
  unit: parameter.unit,
  source: parameter.source,
  origin: parameter.valueOrigin
});

export function durationHours(element: ModelElement): number | null {
  const duration = element.metadata.duration;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) return null;
  if (element.metadata.durationUnit === "minute") return duration / 60;
  if (element.metadata.durationUnit === "day") return duration * 8;
  if (element.metadata.durationUnit === "hour") return duration;
  return null;
}

export interface CriticalPathResult {
  value: number | null;
  chain: string[];
  error?: string;
}

export function calculateCriticalPath(model: ActiveModel): CriticalPathResult {
  const processes = model.elements.filter((element) => element.elementType === "processFunction");
  const processIds = new Set(processes.map((process) => process.id));
  if (!processes.length) return { value: null, chain: [], error: "No active process functions are available." };
  const durations = new Map<string, number>();
  for (const process of processes) {
    const duration = durationHours(process);
    if (duration === null) {
      return { value: null, chain: [], error: `Process “${process.name}” requires a positive duration and duration unit.` };
    }
    durations.set(process.id, duration);
  }
  const successors = new Map<string, string[]>();
  const indegree = new Map(processes.map((process) => [process.id, 0]));
  model.relationships
    .filter((relationship) =>
      relationship.relationshipType === "precedes"
      && processIds.has(relationship.sourceId)
      && processIds.has(relationship.targetId)
    )
    .forEach((relationship) => {
      successors.set(relationship.sourceId, [...(successors.get(relationship.sourceId) ?? []), relationship.targetId]);
      indegree.set(relationship.targetId, (indegree.get(relationship.targetId) ?? 0) + 1);
    });
  const queue = processes.map((process) => process.id).filter((id) => indegree.get(id) === 0);
  const finish = new Map<string, number>();
  const predecessor = new Map<string, string>();
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    const start = Math.max(0, ...model.relationships
      .filter((relationship) => relationship.relationshipType === "precedes" && relationship.targetId === id && processIds.has(relationship.sourceId))
      .map((relationship) => finish.get(relationship.sourceId) ?? 0));
    const candidates = model.relationships
      .filter((relationship) => relationship.relationshipType === "precedes" && relationship.targetId === id && processIds.has(relationship.sourceId))
      .map((relationship) => ({ id: relationship.sourceId, finish: finish.get(relationship.sourceId) ?? 0 }))
      .sort((left, right) => right.finish - left.finish);
    if (candidates[0]) predecessor.set(id, candidates[0].id);
    finish.set(id, start + (durations.get(id) ?? 0));
    for (const next of successors.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== processes.length) return { value: null, chain: [], error: "A process precedence cycle prevents lead-time calculation." };
  const ending = [...finish.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!ending) return { value: null, chain: [], error: "No active process durations are available." };
  const chain: string[] = [];
  let current: string | undefined = ending[0];
  while (current) {
    chain.unshift(current);
    current = predecessor.get(current);
  }
  return { value: ending[1], chain };
}

function emptyResult(key: StandardAlgorithmKey, name: string, unit: string): SimulationResult {
  return {
    id: `result-${crypto.randomUUID()}`,
    algorithmKey: key,
    name,
    value: null,
    unit,
    sourceParameterIds: [],
    formulaOrAlgorithm: key,
    inputSources: [],
    assumptions: [],
    missingInformation: [],
    warnings: []
  };
}

function semanticSum(model: ActiveModel, key: string, algorithm: StandardAlgorithmKey, name: string, unit: string): SimulationResult {
  const result = emptyResult(algorithm, name, unit);
  const insideBoundary = (element: ModelElement): boolean => {
    if (key !== "mass") return true;
    if (element.elementType !== "productComponent" || element.metadata.massAccounting === "outsideBoundary") return false;
    if (!model.rollupRootId) return true;
    const seen = new Set<string>(); let current: ModelElement | undefined = element;
    while (current && !seen.has(current.id)) { if (current.id === model.rollupRootId) return true; seen.add(current.id); current = model.elements.find((item) => item.id === current?.metadata.parentAssemblyId); }
    return false;
  };
  const matches = activeParameters(model).filter(({ parameter, element }) => parameter.semanticKey === key && insideBoundary(element) && (key !== "mass" || element.metadata.massAccounting !== "includedElsewhere"));
  result.sourceParameterIds = matches.map(({ parameter }) => parameter.id);
  result.inputSources = matches.map(({ parameter, element }) => source(parameter, element));
  if (!matches.length) {
    result.missingInformation.push(`No active numeric ${key} parameters are available.`);
    return result;
  }
  if (key === "mass") {
    result.missingInformation.push(...physicalHierarchyErrors(model.elements));
    if (model.rollupRootId && !model.elements.some((item) => item.id === model.rollupRootId && item.elementType === "productComponent")) result.missingInformation.push("The product assembly defining the mass boundary is missing.");
    for (const element of model.elements.filter(insideBoundary)) {
      if (!matches.some((entry) => entry.element.id === element.id) && !["includedElsewhere", "outsideBoundary"].includes(element.metadata.massAccounting ?? "")) result.missingInformation.push(`${element.name}: mass contribution or accounting explanation is missing.`);
      if (element.metadata.massAccounting === "includedElsewhere" && !element.metadata.massAccountingNote?.trim()) result.missingInformation.push(`${element.name}: state where its mass is included.`);
    }
    for (const { element, parameter } of matches.filter(({ parameter }) => parameter.contributionBasis === "aggregate")) {
      for (const child of matches) {
        if (child.parameter.id === parameter.id) continue;
        const seen = new Set<string>(); let current: ModelElement | undefined = child.element;
        while (current?.metadata.parentAssemblyId && !seen.has(current.id)) {
          seen.add(current.id);
          if (current.metadata.parentAssemblyId === element.id) { result.missingInformation.push(`${element.name}: aggregate mass and child contribution ${child.element.name} would be counted twice.`); break; }
          current = model.elements.find((item) => item.id === current?.metadata.parentAssemblyId);
        }
      }
    }
  }
  let total = 0;
  for (const { parameter, element } of matches) {
    if (typeof parameter.value !== "number" || !Number.isFinite(parameter.value)) { result.missingInformation.push(`${element.name} / ${parameter.name}: value is missing.`); continue; }
    try { total += convertValue(parameter.value, parameter.unit ?? "", unit, model.unitDefinitions); }
    catch { result.missingInformation.push(`${parameter.name}: incompatible or missing unit ${parameter.unit ?? ""}; expected ${unit}.`); }
  }
  if (!result.missingInformation.length) result.value = total;
  if (key === "mass") result.assumptions.push("Sum of declared product contributions within the modeled boundary; repeated items already represented by each value are not multiplied again.");
  return result;
}

function processesRealizedByIndustrialComponent(
  model: ActiveModel,
  componentId: string,
  byId: Map<string, ModelElement>
): ModelElement[] {
  return model.relationships
    .filter((relationship) => relationship.relationshipType === "realizedBy" && relationship.targetId === componentId)
    .map((relationship) => byId.get(relationship.sourceId))
    .filter((element): element is ModelElement => element?.elementType === "processFunction");
}

function processCost(model: ActiveModel): SimulationResult {
  const result = emptyResult("processCost", "Process Cost", "EUR");
  const byId = new Map(model.elements.map((element) => [element.id, element]));
  let total = 0;
  let assignments = 0;
  for (const relationship of model.relationships.filter((item) => item.relationshipType === "requiresResource")) {
    const component = byId.get(relationship.sourceId);
    const resource = byId.get(relationship.targetId);
    if (component?.elementType !== "industrialSystemComponent" || resource?.elementType !== "resource") continue;
    const processes = processesRealizedByIndustrialComponent(model, component.id, byId);
    const processHours = processes.map((process) => ({ process, hours: durationHours(process) }));
    const hours = processHours.every((entry) => entry.hours !== null)
      ? processHours.reduce((sum, entry) => sum + entry.hours!, 0)
      : null;
    const rate = resource.metadata.hourlyRate;
    if (!processes.length || hours === null || typeof rate !== "number" || !Number.isFinite(rate)) {
      result.missingInformation.push(`Realized process duration or hourly rate is missing for ${component.name} → ${resource.name}.`);
      continue;
    }
    const quantity = relationship.requiredQuantity ?? 1;
    if (relationship.requiredQuantity === undefined) result.warnings.push(`PMB-107: ${relationship.id} defaults required quantity to one.`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      result.missingInformation.push(`PMB-019: ${relationship.id} has an invalid required quantity.`);
      continue;
    }
    total += hours * rate * quantity;
    assignments += 1;
    result.inputSources.push({
      id: relationship.id,
      name: `${component.name} → ${resource.name}`,
      value: hours * rate * quantity,
      unit: resource.metadata.costUnit ?? "EUR",
      source: `realized process duration ${hours} h (${processes.map((process) => process.name).join(", ")}) × rate ${rate} × quantity ${quantity}`
    });
  }
  if (assignments) result.value = total;
  else result.missingInformation.push("No complete active industrial-component resource cost assignments are available.");
  result.assumptions.push("One engineering day is assumed to equal eight hours.");
  return result;
}

function resourceDemand(model: ActiveModel): SimulationResult {
  const result = emptyResult("resourceDemand", "Resource Demand", "resource-h");
  const byId = new Map(model.elements.map((element) => [element.id, element]));
  const breakdown: Record<string, number | null> = {};
  let assignments = 0;
  for (const relationship of model.relationships.filter((item) => item.relationshipType === "requiresResource")) {
    const component = byId.get(relationship.sourceId);
    const resource = byId.get(relationship.targetId);
    if (component?.elementType !== "industrialSystemComponent" || resource?.elementType !== "resource") continue;
    const processes = processesRealizedByIndustrialComponent(model, component.id, byId);
    const processHours = processes.map((process) => ({ process, hours: durationHours(process) }));
    const hours = processHours.every((entry) => entry.hours !== null)
      ? processHours.reduce((sum, entry) => sum + entry.hours!, 0)
      : null;
    const quantity = relationship.requiredQuantity ?? 1;
    if (relationship.requiredQuantity === undefined) result.warnings.push(`PMB-107: ${relationship.id} defaults required quantity to one.`);
    if (!processes.length || hours === null || !Number.isFinite(quantity) || quantity <= 0) {
      result.missingInformation.push(`Realized process duration or required quantity is invalid for ${component.name} → ${resource.name}.`);
      continue;
    }
    const demand = hours * quantity;
    breakdown[resource.id] = (breakdown[resource.id] ?? 0) + demand;
    assignments += 1;
    result.inputSources.push({
      id: relationship.id,
      name: `${component.name} → ${resource.name}`,
      value: demand,
      unit: "resource-h",
      source: `realized process duration ${hours} h (${processes.map((process) => process.name).join(", ")}) × quantity ${quantity}`
    });
  }
  result.breakdown = breakdown;
  result.value = assignments ? Object.values(breakdown).reduce<number>((total, value) => total + (value ?? 0), 0) : null;
  if (!assignments) result.missingInformation.push("No complete active industrial-component resource assignments are available.");
  result.assumptions.push("One engineering day is assumed to equal eight hours.");
  return result;
}

function utilization(model: ActiveModel): SimulationResult {
  const demand = resourceDemand(model);
  const result = emptyResult("basicUtilization", "Basic Utilization", "%");
  result.inputSources = demand.inputSources;
  result.warnings = [...demand.warnings];
  result.assumptions = [...demand.assumptions];
  const resources = new Map(model.elements.filter((element) => element.elementType === "resource").map((resource) => [resource.id, resource]));
  const breakdown: Record<string, number | null> = {};
  Object.entries(demand.breakdown ?? {}).forEach(([resourceId, hours]) => {
    const resource = resources.get(resourceId);
    const capacity = resource?.metadata.capacityHours;
    const availability = resource?.metadata.availabilityPercent;
    if (typeof capacity !== "number" || typeof availability !== "number") {
      breakdown[resourceId] = null;
      result.missingInformation.push(`${resource?.name ?? resourceId} needs capacity hours and availability.`);
      return;
    }
    const available = capacity * availability / 100;
    if (!Number.isFinite(available) || available <= 0) {
      breakdown[resourceId] = null;
      result.missingInformation.push(`PMB-025: ${resource?.name ?? resourceId} has invalid or zero available hours.`);
      return;
    }
    const value = (hours ?? 0) / available * 100;
    breakdown[resourceId] = value;
    if (value > 100) result.warnings.push(`PMB-108: ${resource?.name ?? resourceId} utilization exceeds 100%.`);
  });
  result.breakdown = breakdown;
  const availableValues = Object.values(breakdown).filter((value): value is number => value !== null);
  result.value = availableValues.length ? Math.max(...availableValues) : null;
  return result;
}

export function runStandardAlgorithm(key: StandardAlgorithmKey, model: ActiveModel): SimulationResult {
  if (key === "totalMass") return semanticSum(model, "mass", key, "Total Mass", "kg");
  if (key === "directElementCost") return semanticSum(model, "cost", key, "Direct Element Cost", "EUR");
  if (key === "totalPower") return semanticSum(model, "power", key, "Total Power", "kW");
  if (key === "processCost") return processCost(model);
  if (key === "resourceDemand") return resourceDemand(model);
  if (key === "basicUtilization") return utilization(model);
  if (key === "manufacturingLeadTime" || key === "throughputProxy") {
    const path = calculateCriticalPath(model);
    const result = emptyResult(
      key,
      key === "manufacturingLeadTime" ? "Manufacturing Lead Time" : "Throughput Proxy",
      key === "manufacturingLeadTime" ? "h" : "1/h"
    );
    result.assumptions.push("One engineering day is assumed to equal eight hours.");
    if (path.error || path.value === null) {
      result.missingInformation.push(path.error ?? "Lead time is not available.");
      return result;
    }
    result.value = key === "manufacturingLeadTime" ? path.value : 1 / path.value;
    result.criticalChainElementIds = path.chain;
    if (key === "throughputProxy") {
      result.assumptions.push("This is a simplified comparative proxy, not actual production throughput.");
    }
    return result;
  }
  const direct = semanticSum(model, "cost", "directElementCost", "Direct Element Cost", "EUR");
  const process = processCost(model);
  const result = emptyResult("estimatedTotalCost", "Estimated Total Cost", "EUR");
  result.inputSources = [...direct.inputSources, ...process.inputSources];
  result.sourceParameterIds = [...direct.sourceParameterIds];
  result.warnings = [...direct.warnings, ...process.warnings];
  result.assumptions = [...process.assumptions];
  result.missingInformation = [...direct.missingInformation, ...process.missingInformation];
  if (direct.value !== null && process.value !== null) result.value = direct.value + process.value;
  return result;
}

function normalizeKpi(kpi: KPI): { ast?: ReturnType<typeof parseKpiFormula>; error?: string } {
  if (kpi.calculationMode === "formula") {
    if (!kpi.formula || kpi.standardAlgorithmKey) return { error: `PMB-021: KPI “${kpi.name}” has inconsistent formula mode.` };
    try {
      return { ast: parseKpiFormula(kpi.formula) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid KPI formula." };
    }
  }
  if (!kpi.standardAlgorithmKey || kpi.formula) return { error: `PMB-021: KPI “${kpi.name}” has inconsistent standard-algorithm mode.` };
  return {};
}

export function calculateSelectedKpis(project: Project, model: ActiveModel, selectedKpiIds: string[]): CalculationOutcome {
  const selected = project.kpis.filter((kpi) => selectedKpiIds.includes(kpi.id));
  const errors: string[] = [];
  const warnings: string[] = [];
  const results: SimulationResult[] = [];
  const selectedSet = new Set(selectedKpiIds);
  const astById = new Map<string, ReturnType<typeof parseKpiFormula>>();
  selected.forEach((kpi) => {
    const normalized = normalizeKpi(kpi);
    if (normalized.error) errors.push(normalized.error);
    if (normalized.ast) {
      astById.set(kpi.id, normalized.ast);
      const references = formulaReferences(normalized.ast);
      for (const dependency of references.kpiIds) {
        if (!selectedSet.has(dependency)) errors.push(`PMB-013: Select dependency KPI “${dependency}” before calculating “${kpi.name}”.`);
      }
    }
  });
  const dependencyKpis = selected.map((kpi) => ({
    ...kpi,
    dependsOnKpiIds: astById.has(kpi.id) ? formulaReferences(astById.get(kpi.id)!).kpiIds : kpi.dependsOnKpiIds
  }));
  const cycle = kpiDependencyCycle(dependencyKpis);
  if (cycle) errors.push(`PMB-014: Circular KPI dependency: ${cycle.join(" → ")}.`);
  if (errors.length) return { results, errors, warnings };

  const parameterEntries = activeParameters(model);
  const parameters = new Map(parameterEntries.map(({ parameter }) => [parameter.id, parameter]));
  const values = new Map<string, FormulaValue>();
  const pending = new Map(selected.map((kpi) => [kpi.id, kpi]));
  while (pending.size) {
    let progressed = false;
    for (const [id, kpi] of [...pending]) {
      const ast = astById.get(id);
      const dependencies = ast ? formulaReferences(ast).kpiIds : [];
      if (dependencies.some((dependency) => !values.has(dependency))) continue;
      if (kpi.calculationMode === "standardAlgorithm") {
        const result = runStandardAlgorithm(kpi.standardAlgorithmKey!, { ...model, unitDefinitions: project.unitDefinitions, rollupRootId: model.rollupRootId ?? model.elements.find((item) => item.elementType === "system")?.metadata.architectureRootId });
        result.kpiId = kpi.id;
        result.algorithmKey = kpi.standardAlgorithmKey;
        result.name = kpi.name;
        if (result.value !== null && kpi.outputUnit.trim() && result.unit !== kpi.outputUnit) {
          try { result.value = convertValue(result.value, result.unit, kpi.outputUnit, project.unitDefinitions); result.unit = kpi.outputUnit; }
          catch { result.missingInformation.push(`PMB-105: Evaluated unit ${result.unit} is incompatible with output ${kpi.outputUnit}.`); result.value = null; }
        }
        if (result.value !== null) values.set(kpi.id, { value: result.value, unit: result.unit });
        results.push(result);
      } else {
        const references = formulaReferences(ast!);
        const result = emptyResult("totalMass", kpi.name, kpi.outputUnit);
        delete result.algorithmKey;
        result.kpiId = kpi.id;
        result.formulaOrAlgorithm = kpi.formula!;
        result.sourceParameterIds = references.parameterIds;
        result.inputSources = references.parameterIds.map((parameterId) => {
          const entry = parameterEntries.find(({ parameter }) => parameter.id === parameterId);
          return entry
            ? source(entry.parameter, entry.element)
            : { id: parameterId, name: parameterId, value: null };
        });
        try {
          const value = evaluateKpiFormula(ast!, parameters, values);
          result.value = value.value;
          result.unit = value.unit;
          if (kpi.outputUnit.trim() && value.unit !== kpi.outputUnit) {
            try { result.value = convertValue(value.value, value.unit, kpi.outputUnit, project.unitDefinitions); result.unit = kpi.outputUnit; }
            catch { result.missingInformation.push(`PMB-105: Evaluated unit ${value.unit || "dimensionless"} is incompatible with output ${kpi.outputUnit}.`); result.value = null; }
          }
          if (value.unit.includes("*") || value.unit.includes("/")) result.warnings.push("PMB-106: Composite unit is displayed symbolically and was not simplified.");
          if (result.value !== null) values.set(kpi.id, { value: result.value, unit: result.unit });
        } catch (error) {
          const message = error instanceof KpiFormulaError ? `${error.code}: ${error.message}` : "Formula calculation failed.";
          result.missingInformation.push(message);
          errors.push(message);
        }
        results.push(result);
      }
      pending.delete(id);
      progressed = true;
    }
    if (!progressed) break;
  }
  for (const kpi of pending.values()) {
    const result = emptyResult("totalMass", kpi.name, kpi.outputUnit);
    delete result.algorithmKey;
    result.kpiId = kpi.id;
    result.formulaOrAlgorithm = kpi.formula ?? kpi.standardAlgorithmKey ?? "unresolved";
    result.missingInformation.push(`PMB-013: A selected dependency for “${kpi.name}” did not produce a usable value.`);
    results.push(result);
  }
  results.forEach((result) => warnings.push(...result.warnings));
  return { results, errors, warnings };
}
