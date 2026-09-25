import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createOhscSampleProject } from "../data/ohscSample";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { assessmentModel, assessRequirement, recordRequirementReview } from "../domain/requirementAssessment";
import { baselineRequirementIds, normalizeOntology, setParentAssembly } from "../domain/ontology";
import { calculateTraceabilityMetrics } from "../domain/metrics";
import { evaluateMandatoryFeasibility } from "../domain/tradeStudyMethodology";
import { runStandardAlgorithm } from "../domain/presizing";
import { deriveConfiguration } from "../domain/derivation";
import { buildArchitectQuestions } from "../domain/architectView";
import { configurationReadiness } from "../domain/configurationReadiness";
import { migrateProject } from "../store/persistence";
import { useAppStore } from "../store/useAppStore";
import { StakeholderTraceabilityRecap } from "../components/StakeholderTraceabilityRecap";
import { TraceabilityMatrix } from "../components/TraceabilityMatrix";
import { contextConnections } from "../domain/contextConnections";
import { modelSections, sectionProjectionElements } from "../domain/modelViews";
import { runSimulation } from "../domain/simulation";
import { buildExportPackage, defaultExportFilters, validateProjectReferences } from "../domain/exportImport";

describe("Simplified ontology and end-to-end recap", () => {
  it("gives the system its own identity and use-case subject without changing legacy IDs", () => {
    const project = createOhscSampleProject();
    expect(project.elements.find((item) => item.id === "STK-00")?.elementType).toBe("system");
    expect(project.elements.filter((item) => item.elementType === "stakeholder").some((item) => item.metadata.isSystemOfInterest)).toBe(false);
    expect(project.elements.filter((item) => item.elementType === "useCase").every((item) => item.metadata.subjectSystemId === "STK-00")).toBe(true);
    expect(project.relationships.some((edge) => edge.sourceId === "STK-00" && edge.relationshipType === "involvedIn")).toBe(false);
  });

  it("creates and visibly projects the complete OHSC system context", () => {
    const project = createOhscSampleProject();
    const externalSystems = project.elements.filter((item) => item.elementType === "externalSystem");
    expect(externalSystems.map((item) => item.name)).toEqual([
      "Aircraft supporting structure",
      "Cabin ceiling and sidewall assembly",
      "Passenger-service and lighting installation",
      "Environmental-control ducting",
      "Passenger oxygen system"
    ]);
    expect(externalSystems.every((item) => project.relationships.some((edge) => edge.sourceId === item.id && edge.relationshipType === "connects"))).toBe(true);
    expect(project.elements.filter((item) => ["productInterface", "processInterface"].includes(item.elementType)).every((item) => project.relationships.some((edge) => edge.sourceId === item.id || edge.targetId === item.id))).toBe(true);
    const references = contextConnections(project);
    expect(project.relationships.filter((item) => item.relationshipType === "hasSOI")).toHaveLength(1);
    expect(references.filter((item) => item.kind === "useCaseSubject")).toHaveLength(8);
    expect(references.filter((item) => item.kind === "architectureRepresentation")).toHaveLength(1);
    const elementIds = new Set(project.elements.map((item) => item.id));
    expect(project.relationships.filter((edge) => !elementIds.has(edge.sourceId) || !elementIds.has(edge.targetId))).toEqual([]);
    expect(references.filter((edge) => !elementIds.has(edge.sourceId) || !elementIds.has(edge.targetId))).toEqual([]);
    const connectedIds = new Set([...project.relationships.flatMap((edge) => [edge.sourceId, edge.targetId]), ...references.flatMap((edge) => [edge.sourceId, edge.targetId])]);
    expect(project.elements.filter((item) => !connectedIds.has(item.id))).toEqual([]);
    expect(calculateTraceabilityMetrics(project).every((metric) => metric.value === 100)).toBe(true);

    const projected = sectionProjectionElements(project, "mission-context");
    const projectedIds = new Set(projected.map((item) => item.id));
    expect(projectedIds.has("STK-00-assembly")).toBe(true);
    expect(projectedIds.has("PI-01")).toBe(true);
    expect(projectedIds.has("PC-05")).toBe(true);
    useAppStore.setState({ projects: [project], activeProjectId: project.id, selectedElementId: null });
    render(<TraceabilityMatrix elements={projected} relationships={project.relationships.filter((edge) => projectedIds.has(edge.sourceId) && projectedIds.has(edge.targetId))} contextRelationships={references.filter((edge) => projectedIds.has(edge.sourceId) && projectedIds.has(edge.targetId))} columnTypes={modelSections["mission-context"].matrixTypes} />);
    expect(screen.getAllByText(/hasSOI/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/represented by/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/subject of use case/i).length).toBeGreaterThan(0);
  });

  it("ships a connected, configuration-correct coffee example", () => {
    const project = createCoffeeMachineSampleProject();
    const externals = project.elements.filter((item) => item.elementType === "externalSystem");
    expect(externals).toHaveLength(3);
    expect(externals.every((item) => project.relationships.some((edge) => edge.sourceId === item.id && ["connects", "involvedIn"].includes(edge.relationshipType)))).toBe(true);
    expect(project.configurations.find((item) => item.id === "configuration-balanced")?.effectiveSelectedFeatureIds).toContain("feature-manual-fastening");
    expect(project.configurations.find((item) => item.id === "configuration-balanced")?.effectiveSelectedFeatureIds).not.toContain("feature-robotic-fastening");
    expect(project.simulationRuns.map((run) => run.results.find((result) => result.kpiId === "kpi-mass")?.value)).toEqual([6, 8, 11]);
    expect(project.simulationRuns.map((run) => run.results.find((result) => result.kpiId === "kpi-handling-rate")?.value)).toEqual([10, 12, 14]);
    const references = contextConnections(project);
    const elementIds = new Set(project.elements.map((item) => item.id));
    expect(project.relationships.filter((edge) => !elementIds.has(edge.sourceId) || !elementIds.has(edge.targetId))).toEqual([]);
    expect(references.filter((edge) => !elementIds.has(edge.sourceId) || !elementIds.has(edge.targetId))).toEqual([]);
    const connectedIds = new Set([...project.relationships.flatMap((edge) => [edge.sourceId, edge.targetId]), ...references.flatMap((edge) => [edge.sourceId, edge.targetId])]);
    expect(project.elements.filter((item) => !connectedIds.has(item.id))).toEqual([]);
    expect(calculateTraceabilityMetrics(project).every((metric) => metric.value === 100)).toBe(true);
  });

  it("retains every OHSC obligation when the study focuses on only one requirement", () => {
    const project = createOhscSampleProject(), study = project.comparisonStudies[0];
    study.mandatoryRequirementIds = ["OHSC-REQ-001"];
    expect(baselineRequirementIds(project, study)).toHaveLength(30);
    const a = evaluateMandatoryFeasibility(project, study, "ALT-CFG-A"), b = evaluateMandatoryFeasibility(project, study, "ALT-CFG-B");
    expect(a.requirementEvidence).toHaveLength(30);
    expect(a.requirementEvidence.filter((item) => item.basis === "assumption")).toHaveLength(12);
    expect(a.status).toBe("feasible");
    expect(b.status).toBe("infeasible");
    expect(b.failedRequirementIds).toContain("OHSC-REQ-010");
    expect(study.referenceArchitectureId).toBe("ARCH-OHSC-STANDARD-A");
  });

  it("does not replace an absent realized requirement with the live model requirement", () => {
    const project = createOhscSampleProject(), study = project.comparisonStudies[0];
    const run = project.simulationRuns.find((item) => item.configurationId === "CFG-A")!;
    run.inputSnapshot.realizedElements = run.inputSnapshot.realizedElements.filter((item) => item.id !== "OHSC-REQ-010");
    expect(evaluateMandatoryFeasibility(project, study, "ALT-CFG-A").missingRequirementIds).toContain("OHSC-REQ-010");
  });

  it("does not turn links or a method confirmation into a qualitative pass", () => {
    const project = createOhscSampleProject(), requirement = project.elements.find((item) => item.id === "OHSC-REQ-022")!;
    delete requirement.metadata.requirementReviews;
    expect(assessRequirement(project, requirement).status).toBe("notChecked");
    expect(calculateTraceabilityMetrics(project).find((item) => item.id === "requirements")?.value).toBe(100);
  });

  it("marks review assumptions stale after a connected component changes", () => {
    const project = createOhscSampleProject();
    let context = assessmentModel(project, "CFG-A").project;
    expect(assessRequirement(context, context.elements.find((item) => item.id === "OHSC-REQ-022")!, "CFG-A").status).toBe("assumed");
    project.elements.find((item) => item.id === "PC-05")!.description += " Changed attachment interface.";
    context = assessmentModel(project, "CFG-A").project;
    expect(assessRequirement(context, context.elements.find((item) => item.id === "OHSC-REQ-022")!, "CFG-A").status).toBe("needsUpdate");
    recordRequirementReview(project, "OHSC-REQ-022", "notMet", "CFG-A");
    context = assessmentModel(project, "CFG-A").project;
    expect(assessRequirement(context, context.elements.find((item) => item.id === "OHSC-REQ-022")!, "CFG-A").status).toBe("notMet");
  });

  it("keeps a passing mass result and its physical limit unchanged after kg-to-g conversion", () => {
    const project = createOhscSampleProject();
    const kpi = project.kpis.find((item) => item.id === "KPI-02")!;
    kpi.outputUnit = "g";
    const context = assessmentModel(project, "CFG-A").project;
    expect(context.kpis.find((item) => item.id === "KPI-02")?.lastCalculatedValue).toBe(31500);
    expect(assessRequirement(context, context.elements.find((item) => item.id === "OHSC-REQ-010")!, "CFG-A").status).toBe("met");
    expect(context.elements.find((item) => item.id === "OHSC-REQ-010")?.requirementFormula?.comparisonUnit).toBe("kg");
  });

  it("converts compatible mass units and reports an incomplete total when an included value is missing", () => {
    const project = assessmentModel(createOhscSampleProject(), "CFG-A").project;
    const latch = project.elements.find((item) => item.id === "PC-03")!.parameters.find((item) => item.semanticKey === "mass")!;
    latch.value = 1500; latch.unit = "g";
    expect(runStandardAlgorithm("totalMass", { ...project, configurationId: "CFG-A" }).value).toBeCloseTo(31.5);
    latch.value = null;
    expect(runStandardAlgorithm("totalMass", { ...project, configurationId: "CFG-A" }).value).toBeNull();
  });

  it("rejects parent aggregate plus child mass double counting", () => {
    const project = assessmentModel(createOhscSampleProject(), "CFG-A").project;
    const root = project.elements.find((item) => item.tags.includes("sample-assembly"))!;
    root.metadata.massAccounting = "contributes";
    root.parameters = [{ ...project.elements.find((item) => item.id === "PC-01")!.parameters.find((item) => item.semanticKey === "mass")!, id: "aggregate-mass", ownerElementId: root.id, contributionBasis: "aggregate", value: 31.5 }];
    expect(runStandardAlgorithm("totalMass", { ...project, configurationId: "CFG-A" }).value).toBeNull();
    expect(runStandardAlgorithm("totalMass", { ...project, configurationId: "CFG-A" }).missingInformation.join(" ")).toContain("counted twice");
  });

  it("keeps excluded parts distinct from missing mass and excludes industrial resources from product mass", () => {
    const project = assessmentModel(createOhscSampleProject(), "CFG-A").project;
    expect(project.elements.some((item) => item.id === "PC-04")).toBe(false);
    const resource = project.elements.find((item) => item.elementType === "resource")!;
    resource.parameters.push({ ...project.elements.find((item) => item.id === "PC-01")!.parameters.find((item) => item.semanticKey === "mass")!, id: "tool-mass", ownerElementId: resource.id, value: 200 });
    expect(runStandardAlgorithm("totalMass", { ...project, configurationId: "CFG-A" }).value).toBeCloseTo(31.5);
  });

  it("blocks conflicting matching rules instead of selecting the first", () => {
    const project = createOhscSampleProject();
    const point = project.variationPoints.find((item) => item.propertyPath === "parameter:PAR-PC01-BUCKET-MASS:value")!;
    point.valueRules = [{ id: "one", featureExpression: "", featureValueConditions: [], value: 12 }, { id: "two", featureExpression: "", featureValueConditions: [], value: 13 }];
    const attempt = deriveConfiguration(project, project.configurations[0]);
    expect(attempt.result).toBeUndefined();
    expect(attempt.errors.join(" ")).toContain("Conflicting matching rules");
  });

  it("uses an explicit default only when no conditional rule matches", () => {
    const project = createOhscSampleProject();
    const point = project.variationPoints.find((item) => item.propertyPath === "parameter:PAR-PC01-BUCKET-MASS:value")!;
    point.valueRules = [{ id: "default", featureExpression: "", featureValueConditions: [], value: 99, isDefault: true }, { id: "match", featureExpression: "", featureValueConditions: [], value: 12 }];
    expect(deriveConfiguration(project, project.configurations[0]).result?.calculatedKpiValues["KPI-02"]).toBeCloseTo(31.5);
  });

  it("shows feature-valid Capacity as ineligible because engineering requirements fail", () => {
    const project = createOhscSampleProject();
    const state = configurationReadiness(project, project.configurations.find((item) => item.id === "CFG-B")!);
    expect(state.featureChoices).toBe("Valid");
    expect(state.derivation).toBe("Current");
    expect(state.engineeringEligible).toBe(false);
    expect(state.requirements).toContain("1 not met");
    expect(state.consistency).toBe("Checked");
    expect(configurationReadiness(project, project.configurations[0]).engineeringEligible).toBe(true);
  });

  it("converts editable values and variation effects together without moving requirement limits", () => {
    const project = createOhscSampleProject();
    useAppStore.setState({ projects: [project], activeProjectId: project.id });
    useAppStore.getState().updateParameter("PC-01", "PAR-PC01-BUCKET-MASS", { unit: "g" });
    const saved = useAppStore.getState().projects[0];
    const context = assessmentModel(saved, "CFG-A");
    expect(context.project.elements.find((item) => item.id === "PC-01")!.parameters.find((item) => item.id === "PAR-PC01-BUCKET-MASS")!.value).toBe(12000);
    expect(context.results.find((item) => item.kpiId === "KPI-02")!.value).toBeCloseTo(31.5);
    expect(assessRequirement(context.project, context.project.elements.find((item) => item.id === "OHSC-REQ-010")!, "CFG-A").status).toBe("met");
  });

  it("runs direct mass analysis and honors the selected assembly boundary", () => {
    const project = createOhscSampleProject();
    const request = { name: "Direct mass", configurationId: "CFG-A", selectedKpiIds: [], selectedAlgorithmKeys: ["totalMass" as const] };
    expect(runSimulation(project, request).run?.results[0].value).toBeCloseTo(31.5);
    project.elements.find((item) => item.elementType === "system")!.metadata.architectureRootId = "PC-03";
    expect(assessmentModel(project, "CFG-A").results.find((item) => item.kpiId === "KPI-02")?.value).toBeCloseTo(1.5);
  });

  it("preserves context references and full obligations in a portable project", () => {
    const project = createOhscSampleProject();
    const exported = buildExportPackage(project, defaultExportFilters()).project;
    expect(validateProjectReferences(exported)).toEqual([]);
    expect(exported.comparisonStudies[0].baselineRequirementIds).toHaveLength(30);
    expect(exported.elements.find((item) => item.elementType === "system")?.metadata.architectureRootId).toBe("STK-00-assembly");
  });

  it("adds no evidence question to numerical requirements and retains one answer for qualitative requirements", () => {
    const project = createOhscSampleProject(), questions = buildArchitectQuestions(project);
    expect(questions.filter((item) => item.id === "AV-H03")).toHaveLength(12);
    expect(questions.some((item) => item.id === "AV-H03" && item.instanceKey === "OHSC-REQ-010")).toBe(false);
    expect(buildArchitectQuestions(createCoffeeMachineSampleProject()).filter((item) => item.id === "AV-H03")).toHaveLength(0);
  });

  it("preserves historical runs and decisions across a legacy identity migration", () => {
    const project = createOhscSampleProject();
    const system = project.elements.find((element) => element.elementType === "system")!;
    const legacyLink = project.relationships.find((relationship) => relationship.relationshipType === "hasSOI" && relationship.targetId === system.id)!;
    project.relationships = project.relationships.filter((relationship) => relationship.id !== legacyLink.id);
    system.metadata.missionId = legacyLink.sourceId;
    project.schemaVersion = 12;
    const history = JSON.stringify([project.simulationRuns, project.decisions]);
    const oldRevision = project.modelRevision;
    const migrated = migrateProject(project);
    expect(JSON.stringify([migrated.simulationRuns, migrated.decisions])).toBe(history);
    expect(migrated.modelRevision).toBe(oldRevision + 1);
    expect(migrated.elements.find((element) => element.id === system.id)?.metadata.missionId).toBeUndefined();
    expect(migrated.relationships).toContainEqual(expect.objectContaining({
      relationshipType: "hasSOI",
      sourceId: legacyLink.sourceId,
      targetId: system.id
    }));
    expect(migrateProject(migrated)).toEqual(migrated);
  });

  it("stores parent selection as a typed existing relationship and detects a cycle", () => {
    const project = createOhscSampleProject();
    setParentAssembly(project, "PC-03", "PC-05");
    normalizeOntology(project);
    expect(project.relationships).toContainEqual(expect.objectContaining({ sourceId: "PC-03", targetId: "PC-05", relationshipType: "refines", containment: true }));
    setParentAssembly(project, "PC-05", "PC-03");
    expect(runStandardAlgorithm("totalMass", { ...project, configurationId: "CFG-A" }).missingInformation.join(" ")).toContain("cycle");
  });

  it("renders one five-column recap with all requirements, assumptions and study outcome", () => {
    const project = createOhscSampleProject();
    useAppStore.setState({ projects: [project], activeProjectId: project.id, selectedElementId: null });
    render(<StakeholderTraceabilityRecap />);
    const table = screen.getByRole("table", { name: "End-to-end engineering recap" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
    expect(within(table).getAllByRole("row")).toHaveLength(32);
    expect(within(table).getAllByText("Assumed met — demonstrator baseline")).toHaveLength(12);
    expect(within(table).getByText("Study outcome:")).toBeInTheDocument();
  });
});
