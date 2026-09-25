import type { ComparisonStudy, Project } from "./types";

export type OntologyDomain = "engineering" | "variability" | "evidence" | "decision";

export interface OntologyNode {
  id: string;
  recordId: string;
  label: string;
  kind: string;
  domain: OntologyDomain;
  detail: string;
}

export interface OntologyEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface TradeStudyOntology {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

const nodeId = (kind: string, id: string) => `${kind}:${id}`;

export function deriveTradeStudyOntology(project: Project, study: ComparisonStudy): TradeStudyOntology {
  const nodes = new Map<string, OntologyNode>();
  const edges = new Map<string, OntologyEdge>();
  const addNode = (node: OntologyNode) => nodes.set(node.id, node);
  const addEdge = (source: string, target: string, relationship: string) => {
    if (!nodes.has(source) || !nodes.has(target)) return;
    const id = `${source}|${relationship}|${target}`;
    edges.set(id, { id, source, target, relationship });
  };

  const studyNode = nodeId("tradeStudy", study.id);
  addNode({
    id: studyNode,
    recordId: study.id,
    label: study.name,
    kind: "Trade Study",
    domain: "decision",
    detail: study.question
  });

  const openDecision = project.openDecisions.find((item) => item.id === study.originatingOpenDecisionId);
  if (openDecision) {
    const id = nodeId("openDecision", openDecision.id);
    addNode({ id, recordId: openDecision.id, label: openDecision.question, kind: "Open decision", domain: "decision", detail: openDecision.description ?? "" });
    addEdge(id, studyNode, "initiates");
  }

  const objectiveIds = new Set([
    ...study.objectiveIds,
    ...study.criteria.flatMap((criterion) => criterion.sourceObjectiveIds),
    ...project.kpis.flatMap((kpi) => kpi.objectiveIds)
  ]);
  project.elements.filter((element) => element.elementType === "objective" && objectiveIds.has(element.id)).forEach((objective) => {
    const id = nodeId("objective", objective.id);
    addNode({ id, recordId: objective.id, label: objective.name, kind: "Objective", domain: "engineering", detail: objective.description });
    if (study.objectiveIds.includes(objective.id)) addEdge(studyNode, id, "addresses");
  });

  const requirementIds = new Set([
    ...study.mandatoryRequirementIds,
    ...study.criteria.flatMap((criterion) => criterion.sourceRequirementIds)
  ]);
  project.elements.filter((element) => element.elementType === "systemRequirement" && requirementIds.has(element.id)).forEach((requirement) => {
    addNode({
      id: nodeId("requirement", requirement.id),
      recordId: requirement.id,
      label: requirement.name,
      kind: "Requirement",
      domain: "engineering",
      detail: requirement.description
    });
  });

  study.criteria.forEach((criterion) => {
    const id = nodeId("criterion", criterion.id);
    addNode({ id, recordId: criterion.id, label: criterion.name, kind: `Study criterion · ${criterion.type}`, domain: "decision", detail: criterion.description });
    criterion.sourceObjectiveIds.forEach((objectiveId) => addEdge(nodeId("objective", objectiveId), id, "drives"));
    criterion.sourceRequirementIds.forEach((requirementId) => addEdge(nodeId("requirement", requirementId), id, "constrains"));
  });

  const usedKpiIds = new Set([
    ...study.selectedKpiIds,
    ...study.criteria.map((criterion) => criterion.kpiId).filter((id): id is string => Boolean(id))
  ]);
  project.kpis.filter((kpi) => usedKpiIds.has(kpi.id)).forEach((kpi) => {
    const id = nodeId("kpi", kpi.id);
    addNode({ id, recordId: kpi.id, label: kpi.name, kind: "KPI", domain: "evidence", detail: `${kpi.optimizationDirection} · ${kpi.outputUnit}` });
    kpi.objectiveIds.forEach((objectiveId) => addEdge(id, nodeId("objective", objectiveId), "measures"));
  });
  study.criteria.forEach((criterion) => {
    if (criterion.kpiId) addEdge(nodeId("criterion", criterion.id), nodeId("kpi", criterion.kpiId), "uses");
  });

  const featureIds = new Set([
    ...study.exploredFeatureIds,
    ...study.criteria.map((criterion) => criterion.requiredFeatureId).filter((id): id is string => Boolean(id)),
    ...study.candidateRefs.flatMap((candidate) =>
      project.configurations.find((configuration) => configuration.id === candidate.configurationId)?.effectiveSelectedFeatureIds ?? []
    )
  ]);
  project.features.filter((feature) => featureIds.has(feature.id)).forEach((feature) => {
    const id = nodeId("feature", feature.id);
    addNode({ id, recordId: feature.id, label: feature.name, kind: "Feature", domain: "variability", detail: feature.description });
    if (study.exploredFeatureIds.includes(feature.id)) addEdge(studyNode, id, "explores");
  });
  study.criteria.forEach((criterion) => {
    if (criterion.type === "mandatory" && criterion.requiredFeatureId) {
      addEdge(nodeId("criterion", criterion.id), nodeId("feature", criterion.requiredFeatureId), "requires");
    }
  });

  study.candidateRefs.forEach((candidate) => {
    const configuration = project.configurations.find((item) => item.id === candidate.configurationId);
    const architecture = project.architectures.find((item) => item.id === candidate.architectureId);
    if (configuration) {
      const id = nodeId("configuration", configuration.id);
      addNode({ id, recordId: configuration.id, label: configuration.name, kind: "Configuration", domain: "variability", detail: configuration.validationStatus });
      configuration.effectiveSelectedFeatureIds.forEach((featureId) => addEdge(id, nodeId("feature", featureId), "selects"));
    }
    if (architecture) {
      const id = nodeId("architecture", architecture.id);
      addNode({ id, recordId: architecture.id, label: architecture.name, kind: "100% architecture", domain: "engineering", detail: architecture.status });
      addEdge(nodeId("configuration", candidate.configurationId), id, "realizes");
      addEdge(studyNode, id, "evaluates");
    }
  });

  const candidateArchitectureIds = new Set(study.candidateRefs.map((candidate) => candidate.architectureId));
  project.simulationRuns.filter((run) => candidateArchitectureIds.has(run.architectureId)).forEach((run) => {
    const id = nodeId("simulation", run.id);
    addNode({ id, recordId: run.id, label: run.name, kind: "Simulation run", domain: "evidence", detail: `${run.timestamp} · revision ${run.projectModelRevisionAtRun}` });
    addEdge(id, nodeId("architecture", run.architectureId), "analyzes");
    run.results.forEach((result) => {
      if (result.kpiId) addEdge(id, nodeId("kpi", result.kpiId), "produces evidence");
    });
  });

  project.decisions.filter((decision) => decision.supportingComparisonStudyIds.includes(study.id)).forEach((decision) => {
    const id = nodeId("decision", decision.id);
    addNode({ id, recordId: decision.id, label: decision.question, kind: "Decision", domain: "decision", detail: decision.status });
    addEdge(id, studyNode, "resolves");
  });

  const baseline = project.architectures.find((architecture) => architecture.id === project.baselineArchitectureId);
  if (baseline) {
    const id = nodeId("baseline", baseline.id);
    addNode({ id, recordId: baseline.id, label: `${baseline.name} baseline`, kind: "Baseline", domain: "decision", detail: "Established from the selected architecture." });
    addEdge(nodeId("architecture", baseline.id), id, "establishes");
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()]
  };
}
