import { beforeEach, describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { createSampleProject } from "../data/sample";
import {
  comparisonStatus,
  leadingAlternativeIds,
  runComparison,
  runWeightSensitivity
} from "../domain/comparison";
import {
  buildExportPackage,
  defaultExportFilters,
  parseExportPackage,
  serializeExportPackage
} from "../domain/exportImport";
import { pdfArrayBuffer } from "../domain/pdfReport";
import { runSimulation } from "../domain/simulation";
import {
  createProjectSnapshot,
  parseSnapshotProject
} from "../domain/snapshots";
import type {
  ComparisonStudy,
  PersistedAppState,
  Project,
  SimulationResult,
  UiPreferences
} from "../domain/types";
import { buildXlsxWorkbook, xlsxArrayBuffer } from "../domain/xlsxExport";
import {
  CURRENT_SCHEMA_VERSION,
  migratePersistedState,
  migrateProject
} from "../store/persistence";
import { useAppStore } from "../store/useAppStore";

const time = "2026-07-29T12:00:00.000Z";
const decode = (value: Uint8Array) => new TextDecoder().decode(value);

function xlsxArchive(bytes: ArrayBuffer) {
  const archive = unzipSync(new Uint8Array(bytes));
  const workbookDocument = new DOMParser().parseFromString(
    decode(archive["xl/workbook.xml"]),
    "application/xml"
  );
  return {
    archive,
    sheetNames: [...workbookDocument.getElementsByTagName("sheet")]
      .map((sheet) => sheet.getAttribute("name")),
    xml: Object.entries(archive)
      .filter(([name]) => name.endsWith(".xml"))
      .map(([, value]) => decode(value))
      .join("\n")
  };
}

const preferences: UiPreferences = {
  activeWorkspace: "dashboard",
  activeModelTab: "mission-context",
  activeModelView: "table",
  tableSortModeByType: {},
  graphLayoutModeByTab: {},
  detailsPanelOpen: true,
  validationSeverity: "all",
  validationCategory: "all",
  validationDomain: "all",
  variationPointView: "graph",
  variationGraphSections: [],
  variationGraphElementTypes: [],
  activeVariabilityTab: "Feature Model",
  activeTradeStudyTab: "Guided Workflow",
  tradeStudyView: "manager"
};

function result(kpiId: string, value: number | null, unit = "u"): SimulationResult {
  return {
    id: `result-${kpiId}-${String(value)}`,
    kpiId,
    name: kpiId,
    value,
    unit,
    sourceParameterIds: [],
    formulaOrAlgorithm: "test evidence",
    inputSources: [],
    assumptions: [],
    missingInformation: value === null ? ["Missing test value."] : [],
    warnings: []
  };
}

function comparisonFixture(kpiCount = 1) {
  const project = createSampleProject();
  const runs = project.simulationRuns.slice(0, 2);
  const kpis = project.kpis.slice(0, kpiCount);
  runs[0].results = kpis.map((kpi, index) => result(kpi.id, 10 + index * 10, kpi.outputUnit));
  runs[1].results = kpis.map((kpi, index) => result(kpi.id, 20 + index * 10, kpi.outputUnit));
  runs.forEach((run) => { run.projectModelRevisionAtRun = project.modelRevision; });
  kpis.forEach((kpi) => { kpi.updatedAt = "2026-07-01T00:00:00.000Z"; });
  const study: ComparisonStudy = {
    id: "study-test",
    name: "Controlled comparison",
    description: "",
    question: "Which controlled architecture should be selected?",
    intendedOutcome: "Select one controlled architecture.",
    lifecycleScope: "Test lifecycle",
    systemScope: "Test system",
    status: "collectingEvidence",
    objectiveIds: [],
    mandatoryRequirementIds: [],
    exploredFeatureIds: [],
    criteria: [],
    candidateRefs: runs.map((run, index) => ({
      id: `candidate-${index + 1}`,
      label: `Alternative ${index + 1}`,
      architectureId: run.architectureId,
      configurationId: run.configurationId!
    })),
    alternativeRefs: runs.map((run, index) => ({
      id: `alternative-${index + 1}`,
      label: `Alternative ${index + 1}`,
      architectureId: run.architectureId,
      configurationId: run.configurationId,
      simulationRunId: run.id
    })),
    selectedKpiIds: kpis.map((kpi) => kpi.id),
    kpiSettings: Object.fromEntries(kpis.map((kpi) => [kpi.id, {
      weight: 1,
      optimizationDirection: "maximize" as const
    }])),
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    settingsUpdatedAt: "2026-07-01T00:00:00.000Z",
    results: []
  };
  return { project, study, runs, kpis };
}

function persisted(project: Project): PersistedAppState {
  return {
    schemaVersion: 4,
    activeProjectId: project.id,
    projects: [project],
    snapshots: [],
    uiPreferences: preferences
  };
}

describe("Stage-B to Stage-C migration", () => {
  it("migrates schema 4 records purely and idempotently", () => {
    const project = createSampleProject();
    project.schemaVersion = 4;
    const legacy = project as unknown as {
      comparisonStudies?: unknown;
      comparisonRisks?: unknown;
      decisions?: unknown;
    };
    delete legacy.comparisonStudies;
    delete legacy.comparisonRisks;
    delete legacy.decisions;
    const raw = persisted(project as Project);
    const untouched = structuredClone(raw);
    const first = migratePersistedState(raw);
    const second = migratePersistedState(structuredClone(first));
    expect(raw).toEqual(untouched);
    expect(first.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(first.projects[0]).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      comparisonStudies: [],
      comparisonRisks: [],
      decisions: []
    });
    expect(second).toEqual(first);
  });

  it("moves nested snapshots to application state without recursive project data", () => {
    const project = createSampleProject() as Project & { snapshots?: unknown[] };
    project.schemaVersion = 4;
    project.snapshots = [{
      id: "legacy-snapshot",
      name: "Legacy",
      projectData: JSON.stringify({ ...project, snapshots: [{ id: "recursive" }] })
    }];
    const migrated = migratePersistedState(persisted(project));
    expect(migrated.snapshots.map((snapshot) => snapshot.id)).toContain("legacy-snapshot");
    expect(JSON.parse(migrated.snapshots[0].projectData)).not.toHaveProperty("snapshots");
    expect(migrated.projects[0]).not.toHaveProperty("snapshots");
  });
});

describe("comparison scoring and evidence matching", () => {
  it("normalizes maximize and minimize directions correctly", () => {
    const { project, study, kpis } = comparisonFixture();
    const maximize = runComparison(project, study, new Date(time)).result!;
    expect(maximize.normalizedScores["alternative-1"][kpis[0].id]).toBe(0);
    expect(maximize.normalizedScores["alternative-2"][kpis[0].id]).toBe(100);
    study.kpiSettings[kpis[0].id].optimizationDirection = "minimize";
    const minimize = runComparison(project, study, new Date(time)).result!;
    expect(minimize.normalizedScores["alternative-1"][kpis[0].id]).toBe(100);
    expect(minimize.normalizedScores["alternative-2"][kpis[0].id]).toBe(0);
  });

  it("scores equal values at 100 and retains tied leaders", () => {
    const { project, study, runs, kpis } = comparisonFixture();
    runs[1].results = [result(kpis[0].id, 10)];
    const attempt = runComparison(project, study, new Date(time));
    expect(attempt.result?.normalizedScores["alternative-1"][kpis[0].id]).toBe(100);
    expect(attempt.result?.normalizedScores["alternative-2"][kpis[0].id]).toBe(100);
    expect(leadingAlternativeIds(attempt.result!.weightedScores)).toEqual(["alternative-1", "alternative-2"]);
    expect(attempt.warnings.join(" ")).toMatch(/does not differentiate|tied/);
  });

  it("keeps missing values missing and transparently renormalizes available weights", () => {
    const { project, study, runs, kpis } = comparisonFixture(2);
    runs[1].results = [result(kpis[0].id, 20), result(kpis[1].id, null)];
    const attempt = runComparison(project, study, new Date(time));
    expect(attempt.result?.rawValues["alternative-2"][kpis[1].id]).toBeNull();
    expect(attempt.result?.normalizedScores["alternative-2"][kpis[1].id]).toBeNull();
    expect(attempt.result?.dataCoveragePercent).toEqual({
      "alternative-1": 100,
      "alternative-2": 50
    });
    expect(attempt.result?.weightedScores["alternative-2"]).toBe(100);
    expect(attempt.warnings.join(" ")).toMatch(/renormalized per alternative/);
  });

  it("reports warning and hard threshold violations without suppressing scores", () => {
    const { project, study, kpis } = comparisonFixture();
    study.kpiSettings[kpis[0].id].threshold = { maximum: 15, mode: "warning" };
    const warning = runComparison(project, study, new Date(time)).result!;
    expect(warning.thresholdViolations).toContainEqual(expect.objectContaining({
      alternativeId: "alternative-2",
      severity: "warning"
    }));
    study.kpiSettings[kpis[0].id].threshold = { maximum: 15, mode: "hard" };
    const hard = runComparison(project, study, new Date(time)).result!;
    expect(hard.thresholdViolations).toContainEqual(expect.objectContaining({
      alternativeId: "alternative-2",
      severity: "error"
    }));
    expect(hard.weightedScores["alternative-2"]).toBe(100);
  });

  it("uses exact KPI IDs and rejects mismatched run context", () => {
    const { project, study, runs, kpis } = comparisonFixture();
    runs[1].results = [{ ...result("different-kpi-id", 20), name: kpis[0].name }];
    const exact = runComparison(project, study, new Date(time));
    expect(exact.result).toBeUndefined();
    expect(exact.errors.join(" ")).toMatch(/PMC-014/);
    study.alternativeRefs[1].architectureId = study.alternativeRefs[0].architectureId;
    const mismatch = runComparison(project, study, new Date(time));
    expect(mismatch.errors.join(" ")).toMatch(/PMC-013/);
  });

  it("calculates 0–200 percent sensitivity and handles a zero baseline weight honestly", () => {
    const { project, study, kpis } = comparisonFixture(2);
    const regular = runWeightSensitivity(project, study, new Date(time)).result!;
    expect(regular.series[0].points.map((point) => point.multiplierPercent)).toEqual([0, 25, 50, 75, 100, 125, 150, 175, 200]);
    study.kpiSettings[kpis[1].id].weight = 0;
    const zero = runWeightSensitivity(project, study, new Date(time)).result!;
    expect(zero.series.find((series) => series.kpiId === kpis[1].id)?.points).toHaveLength(1);
    expect(zero.series.find((series) => series.kpiId === kpis[1].id)?.warnings.join(" ")).toMatch(/zero baseline weight/);
  });

  it("marks saved comparisons stale without recalculating them", () => {
    const { project, study } = comparisonFixture();
    const saved = runComparison(project, study, new Date(time)).result!;
    study.results.push(saved);
    expect(comparisonStatus(project, study, saved)).toBe("Current");
    project.modelRevision += 1;
    expect(comparisonStatus(project, study, saved)).toBe("Stale");
    expect(study.results[0]).toEqual(saved);
  });
});

describe("formal decisions and snapshots", () => {
  beforeEach(() => {
    const project = createSampleProject();
    useAppStore.setState({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      projects: [project],
      activeProjectId: project.id,
      snapshots: []
    });
  });

  it("requires rationale before approval and closes a linked planning question only after approval", () => {
    const project = useAppStore.getState().projects[0];
    const planningId = project.openDecisions[0].id;
    const decisionId = useAppStore.getState().promoteOpenDecision(planningId)!;
    expect(useAppStore.getState().updateDecision(decisionId, { status: "approved" })).toMatch(/PMC-015/);
    expect(useAppStore.getState().projects[0].openDecisions.find((item) => item.id === planningId)?.status).toBe("inReview");
    expect(useAppStore.getState().updateDecision(decisionId, {
      status: "approved",
      rationale: "Evidence reviewed."
    })).toMatch(/selected alternative/i);
    const selectedAlternative = project.comparisonStudies[0].alternativeRefs[0].label;
    expect(useAppStore.getState().updateDecision(decisionId, {
      status: "approved",
      rationale: "Evidence reviewed.",
      selectedAlternative,
      baselineApprovalConfirmed: true
    })).toBeNull();
    expect(useAppStore.getState().projects[0].openDecisions.find((item) => item.id === planningId)?.status).toBe("closed");
  });

  it("keeps tied comparison leaders unselected until explicit confirmation", () => {
    const { project, study, runs, kpis } = comparisonFixture();
    runs[1].results = [result(kpis[0].id, 10)];
    study.results = [runComparison(project, study, new Date(time)).result!];
    project.comparisonStudies = [study];
    project.comparisonRisks = [];
    project.decisions = [];
    useAppStore.setState({ projects: [project], activeProjectId: project.id });
    const decisionId = useAppStore.getState().createDecisionFromComparison(study.id)!;
    const draft = useAppStore.getState().projects[0].decisions.find((item) => item.id === decisionId)!;
    expect(draft.status).toBe("draft");
    expect(draft.selectedAlternative).toBeUndefined();
    expect(draft.assumptions).toEqual([]);
    expect(useAppStore.getState().confirmDecisionSelection(decisionId, "Alternative 2")).toBeNull();
    expect(useAppStore.getState().projects[0].decisions.find((item) => item.id === decisionId)).toMatchObject({
      status: "proposed",
      selectedAlternative: "Alternative 2"
    });
  });

  it("duplicates study setup only and protects decision-linked study deletion", () => {
    const source = useAppStore.getState().projects[0].comparisonStudies[0];
    const riskCount = useAppStore.getState().projects[0].comparisonRisks.length;
    useAppStore.getState().duplicateComparisonStudy(source.id);
    const duplicate = useAppStore.getState().projects[0].comparisonStudies.at(-1)!;
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.alternativeRefs).toEqual(source.alternativeRefs);
    expect(duplicate.results).toEqual([]);
    expect(duplicate.sensitivityResult).toBeUndefined();
    expect(useAppStore.getState().projects[0].comparisonRisks).toHaveLength(riskCount);
    expect(useAppStore.getState().deleteComparisonStudy(source.id)).toMatch(/formal decisions/);
    const linkedDecision = useAppStore.getState().projects[0].decisions.find((item) => item.supportingComparisonStudyIds.includes(source.id))!;
    useAppStore.getState().deleteDecision(linkedDecision.id);
    expect(useAppStore.getState().deleteComparisonStudy(source.id)).toBeNull();
    expect(useAppStore.getState().projects[0].comparisonRisks.some((risk) => risk.comparisonStudyId === source.id)).toBe(false);
  });

  it("creates deep-copy snapshots and a safety snapshot before restore", () => {
    const originalName = useAppStore.getState().projects[0].name;
    expect(useAppStore.getState().createSnapshot("Before edit")).toBeNull();
    const snapshot = useAppStore.getState().snapshots[0];
    const parsedBefore = JSON.parse(snapshot.projectData) as Project;
    useAppStore.getState().updateProject({ name: "Changed name" });
    expect(JSON.parse(snapshot.projectData).name).toBe(originalName);
    expect(parsedBefore).not.toHaveProperty("snapshots");
    expect(useAppStore.getState().restoreSnapshot(snapshot.id)).toBeNull();
    expect(useAppStore.getState().projects[0].name).toBe(originalName);
    expect(useAppStore.getState().snapshots).toHaveLength(2);
    expect(useAppStore.getState().snapshots.some((item) => item.name.startsWith("Safety snapshot"))).toBe(true);
  });

  it("requires oldest-replacement confirmation before a safety snapshot can exceed the limit", () => {
    const project = useAppStore.getState().projects[0];
    const snapshots = Array.from({ length: 20 }, (_, index) => ({
      ...createProjectSnapshot(project, `Snapshot ${index + 1}`, "", new Date(`2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`)),
      id: `snapshot-limit-${index + 1}`
    }));
    useAppStore.setState({ snapshots });
    expect(useAppStore.getState().restoreSnapshot(snapshots[19].id)).toMatch(/PMC-112/);
    expect(useAppStore.getState().snapshots).toHaveLength(20);
    expect(useAppStore.getState().restoreSnapshot(snapshots[19].id, true)).toBeNull();
    expect(useAppStore.getState().snapshots).toHaveLength(20);
    expect(useAppStore.getState().snapshots.some((item) => item.name.startsWith("Safety snapshot"))).toBe(true);
    expect(useAppStore.getState().snapshots.some((item) => item.id === "snapshot-limit-1")).toBe(false);
  });

  it("rejects corrupt or recursive snapshots before they can overwrite a project", () => {
    const project = useAppStore.getState().projects[0];
    const corrupt = createProjectSnapshot(project, "Corrupt");
    corrupt.projectData = "{broken";
    expect(() => parseSnapshotProject(corrupt, migrateProject)).toThrow(/PMC-011/);
    corrupt.projectData = JSON.stringify({ ...project, snapshots: [] });
    expect(() => parseSnapshotProject(corrupt, migrateProject)).toThrow(/recursively/);
  });
});

describe("Stage-C revision and architecture-only analysis", () => {
  it("evaluates the canonical unconfigured 150% model in an architecture context", () => {
    const project = createSampleProject();
    const attempt = runSimulation(project, {
      name: "Architecture-only evidence",
      mode: "architectureOnly",
      architectureId: project.architectures[0].id,
      selectedKpiIds: [project.kpis.find((kpi) => kpi.id === "kpi-mass")!.id],
      selectedAlgorithmKeys: []
    });
    expect(attempt.errors).toEqual([]);
    expect(attempt.run).toMatchObject({
      architectureId: project.architectures[0].id,
      configurationId: undefined,
      derivationId: undefined
    });
    expect(attempt.run?.inputSnapshot.realizedElements).toHaveLength(project.elements.length);
    expect(attempt.run?.inputSnapshot.appliedVariations).toEqual([]);
    expect(attempt.warnings.join(" ")).toMatch(/canonical 150% model/);
  });

  it("increments model revision only for engineering intent, not delivery metadata", () => {
    const project = createSampleProject();
    useAppStore.setState({ projects: [project], activeProjectId: project.id, snapshots: [] });
    const initialRevision = project.modelRevision;
    useAppStore.getState().updateProject({ name: "Renamed delivery record" });
    expect(useAppStore.getState().projects[0].modelRevision).toBe(initialRevision);
    useAppStore.getState().createSnapshot("Metadata checkpoint");
    expect(useAppStore.getState().projects[0].modelRevision).toBe(initialRevision);
    useAppStore.getState().updateProject({ objectives: [...project.objectives, "New engineering objective"] });
    expect(useAppStore.getState().projects[0].modelRevision).toBe(initialRevision + 1);
  });
});

describe("selective delivery and import safety", () => {
  it("round-trips a complete JSON project without project-data loss", () => {
    const project = createSampleProject();
    const payload = buildExportPackage(project, defaultExportFilters(), new Date(time));
    const parsed = parseExportPackage(serializeExportPackage(payload), migrateProject);
    expect(parsed.errors).toEqual([]);
    expect(parsed.package?.project).toEqual(migrateProject(payload.project));
  });

  it("leaves application state unchanged after invalid import and resolves project-ID collisions", () => {
    const project = createSampleProject();
    useAppStore.setState({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      projects: [project],
      activeProjectId: project.id,
      snapshots: []
    });
    const before = structuredClone(useAppStore.getState().projects);
    expect(useAppStore.getState().importProjectPackage("{broken", "new").errors).not.toHaveLength(0);
    expect(useAppStore.getState().projects).toEqual(before);
    const payload = buildExportPackage(project, defaultExportFilters(), new Date(time));
    const imported = useAppStore.getState().importProjectPackage(serializeExportPackage(payload), "new");
    expect(imported.errors).toEqual([]);
    expect(imported.warnings.join(" ")).toMatch(/PMC-111/);
    expect(useAppStore.getState().projects.at(-1)?.id).not.toBe(project.id);
    expect(useAppStore.getState().projects.at(-1)?.elements.map((element) => element.id)).toEqual(project.elements.map((element) => element.id));
  });

  it("rejects unsupported project schemas before migration", () => {
    const project = createSampleProject();
    const payload = buildExportPackage(project, defaultExportFilters(), new Date(time));
    const unsupported = structuredClone(payload) as typeof payload & { schemaVersion: number };
    unsupported.schemaVersion = 999;
    unsupported.project.schemaVersion = 999;
    expect(parseExportPackage(JSON.stringify(unsupported), migrateProject).errors.join(" ")).toMatch(/PMC-009/);
  });

  it("includes relationship endpoints by default or records omitted incomplete relationships", () => {
    const project = createSampleProject();
    const relationship = project.relationships[0];
    const closure = defaultExportFilters();
    closure.scope = "selection";
    closure.elementIds = [relationship.sourceId];
    closure.relationshipTypes = [relationship.relationshipType];
    const closed = buildExportPackage(project, closure, new Date(time));
    expect(closed.project.elements.map((element) => element.id)).toEqual(expect.arrayContaining([relationship.sourceId, relationship.targetId]));
    expect(closed.project.relationships.some((item) => item.id === relationship.id)).toBe(true);

    const omit = structuredClone(closure);
    omit.relationshipClosure = "omitIncomplete";
    const omitted = buildExportPackage(project, omit, new Date(time));
    expect(omitted.project.relationships.some((item) => item.id === relationship.id)).toBe(false);
    expect(omitted.manifest.omittedRelationshipIds).toContain(relationship.id);
    expect(omitted.manifest.warnings.join(" ")).toMatch(/PMC-107/);
  });

  it("narrows architecture-scoped configurations and runs and previews stale evidence", () => {
    const project = createSampleProject();
    project.modelRevision += 1;
    const filters = defaultExportFilters();
    filters.scope = "selection";
    filters.architectureId = project.architectures[0].id;
    const payload = buildExportPackage(project, filters, new Date(time));
    expect(payload.project.architectures).toHaveLength(1);
    expect(payload.project.configurations.every((item) => item.architectureId === filters.architectureId)).toBe(true);
    expect(payload.project.simulationRuns.every((item) => item.architectureId === filters.architectureId)).toBe(true);
    expect(payload.manifest.warnings.join(" ")).toMatch(/PMC-105/);
  });

  it("creates a valid multi-sheet XLSX archive when optional collections are empty", async () => {
    const project = createSampleProject();
    project.simulationRuns = [];
    project.comparisonStudies = [];
    project.comparisonRisks = [];
    project.decisions = [];
    project.assumptions = [];
    project.validationResults = [];
    const payload = buildExportPackage(project, defaultExportFilters(), new Date(time));
    const workbook = buildXlsxWorkbook(payload);
    expect(workbook.SheetNames).toEqual(expect.arrayContaining(["Project", "Export Manifest"]));
    expect(workbook.SheetNames).not.toEqual(expect.arrayContaining([
      "Simulation Results",
      "Comparison Studies",
      "Comparison Results",
      "Risks",
      "Decisions",
      "Assumptions"
    ]));
    const bytes = await xlsxArrayBuffer(payload);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const archive = xlsxArchive(bytes);
    expect(Object.keys(archive.archive)).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml"
    ]));
    expect(archive.sheetNames).toEqual(workbook.SheetNames);
    expect(archive.xml).toContain(project.id);
    expect(archive.xml).toContain("SchemaVersion");
    expect(archive.xml).toContain("Export Manifest");
  });

  it("preserves XLSX headings, IDs, units, serialized arrays, filters, staleness, and coverage", async () => {
    const project = createSampleProject();
    project.modelRevision += 1;
    const payload = buildExportPackage(project, defaultExportFilters(), new Date(time));
    const workbook = buildXlsxWorkbook(payload);
    const archive = xlsxArchive(await xlsxArrayBuffer(payload));
    expect(archive.sheetNames).toEqual(workbook.SheetNames);
    expect(archive.sheetNames).toEqual(expect.arrayContaining([
      "Project",
      "Elements",
      "Relationships",
      "Parameters",
      "Configurations",
      "Simulation Results",
      "Comparison Results",
      "Export Manifest"
    ]));
    [
      project.id,
      project.elements[0].id,
      project.simulationRuns[0].id,
      "ApplicableConfigurationIDs",
      "EffectiveFeatureIDs",
      "FeatureValues",
      "Unit",
      "DataCoveragePercent",
      "includeValidationResults",
      "PMC-105"
    ].forEach((expected) => expect(archive.xml).toContain(expected));
  });

  it("generates a PDF project report even without a comparison or decision selection", () => {
    const project = createSampleProject();
    const bytes = pdfArrayBuffer(project, {
      includeValidation: true,
      includeSimulationDetails: true,
      includeRisks: true,
      scopeSummary: "Full test project"
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
