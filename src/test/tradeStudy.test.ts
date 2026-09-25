import { beforeEach, describe, expect, it } from "vitest";
import { createCoffeeMachineSampleProject, createSampleProject } from "../data/sample";
import {
  buildExportPackage,
  defaultExportFilters,
  validateProjectReferences
} from "../domain/exportImport";
import { objectiveProjection } from "../domain/objectives";
import {
  managerReadyAlternatives,
  mixedEvidenceWarning,
  tradeStudyReadiness,
  tradeStudyWorkflow
} from "../domain/tradeStudy";
import { deriveTradeStudyOntology } from "../domain/tradeStudyOntology";
import { buildXlsxWorkbook } from "../domain/xlsxExport";
import { CURRENT_SCHEMA_VERSION, migrateProject } from "../store/persistence";
import { useAppStore } from "../store/useAppStore";

describe("schema-6 objective authority and migration", () => {
  it("migrates unmatched legacy strings into stable first-class objectives purely and idempotently", () => {
    const source = createSampleProject();
    source.schemaVersion = 5;
    source.objectives = [...source.objectives, "  Reduce commissioning risk  "];
    const untouched = structuredClone(source);

    const first = migrateProject(source);
    const second = migrateProject(structuredClone(first));
    const migrated = first.elements.find((element) => element.name === "Reduce commissioning risk");

    expect(source).toEqual(untouched);
    expect(first.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated).toMatchObject({
      elementType: "objective",
      description: "Migrated from the legacy project objective compatibility field."
    });
    expect(migrated?.id).toMatch(/^objective-migrated-/);
    expect(objectiveProjection(first)).toEqual(first.objectives);
    expect(second).toEqual(first);
  });
});

describe("Architecture Trade Study methodology", () => {
  it("derives complete readiness and the ten-step guided workflow from canonical records", () => {
    const project = createCoffeeMachineSampleProject();
    const study = project.comparisonStudies[0];
    const readiness = tradeStudyReadiness(project, study);
    const steps = tradeStudyWorkflow(project, study);

    expect(readiness).toHaveLength(3);
    expect(readiness.every((candidate) =>
      candidate.state === "Ready"
      && candidate.kpiCoveragePercent === 100
      && candidate.simulationRunId
    )).toBe(true);
    expect(managerReadyAlternatives(project, study)).toHaveLength(3);
    expect(steps).toHaveLength(10);
    expect(steps.slice(0, 9).every((step) => step.complete)).toBe(true);
    expect(steps[9].complete).toBe(true);
  });

  it("warns when 150% architecture-only evidence is mixed with configured 100% evidence", () => {
    const project = createSampleProject();
    const study = project.comparisonStudies[0];
    study.alternativeRefs[0].configurationId = undefined;
    project.simulationRuns.find((run) => run.id === study.alternativeRefs[0].simulationRunId)!.configurationId = undefined;

    expect(mixedEvidenceWarning(project, study)).toMatch(/not directly comparable/);
    expect(managerReadyAlternatives(project, study).map((item) => item.id))
      .toEqual([study.alternativeRefs[1].id]);
  });

  it("derives the read-only ontology from typed references without creating model relationships", () => {
    const project = createSampleProject();
    const relationshipCount = project.relationships.length;
    const ontology = deriveTradeStudyOntology(project, project.comparisonStudies[0]);
    const relationshipKinds = ontology.edges.map((edge) => edge.relationship);

    expect(relationshipKinds).toEqual(expect.arrayContaining([
      "initiates", "addresses", "drives", "constrains", "uses", "measures",
      "explores", "selects", "realizes", "evaluates", "analyzes",
      "produces evidence", "resolves"
    ]));
    expect(new Set(ontology.nodes.map((node) => node.domain))).toEqual(
      new Set(["engineering", "variability", "evidence", "decision"])
    );
    expect(project.relationships).toHaveLength(relationshipCount);
  });

  it("preserves all Trade Study typed references in JSON and XLSX exports", () => {
    const project = createSampleProject();
    const payload = buildExportPackage(project, defaultExportFilters(), new Date("2026-07-30T12:00:00.000Z"));
    const workbook = buildXlsxWorkbook(payload);

    expect(validateProjectReferences(payload.project)).toEqual([]);
    expect(workbook.SheetNames).toEqual(expect.arrayContaining([
      "Comparison Studies", "Study Criteria", "Candidate Readiness", "Open Decisions"
    ]));
    expect(payload.project.comparisonStudies[0]).toMatchObject({
      question: project.comparisonStudies[0].question,
      originatingOpenDecisionId: "open-decision-mode"
    });
  });
});

describe("Trade Study candidate and decision lifecycle", () => {
  beforeEach(() => {
    const project = createSampleProject();
    useAppStore.setState({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      projects: [project],
      activeProjectId: project.id,
      snapshots: []
    });
  });

  it("creates first, duplicated and different candidates with owned configuration/architecture pairs", () => {
    const studyId = useAppStore.getState().projects[0].comparisonStudies[0].id;
    useAppStore.getState().updateComparisonStudy(studyId, { candidateRefs: [] }, false);

    const firstId = useAppStore.getState().createTradeStudyCandidate(studyId, "first").candidateId!;
    const firstProject = useAppStore.getState().projects[0];
    const first = firstProject.comparisonStudies[0].candidateRefs.find((item) => item.id === firstId)!;
    const duplicateId = useAppStore.getState()
      .createTradeStudyCandidate(studyId, "duplicate", first.configurationId).candidateId!;
    const differentId = useAppStore.getState()
      .createTradeStudyCandidate(studyId, "different").candidateId!;
    const project = useAppStore.getState().projects[0];
    const candidates = project.comparisonStudies[0].candidateRefs;

    expect(candidates.map((item) => item.id)).toEqual([firstId, duplicateId, differentId]);
    candidates.forEach((candidate) => {
      expect(project.configurations.find((item) => item.id === candidate.configurationId)?.architectureId)
        .toBe(candidate.architectureId);
      expect(project.architectures.find((item) => item.id === candidate.architectureId))
        .toMatchObject({ configurationId: candidate.configurationId, status: "candidate" });
    });
  });

  it("approval resolves the Trade Study and open question while establishing the selected baseline", () => {
    const project = useAppStore.getState().projects[0];
    const study = project.comparisonStudies[0];
    const decision = project.decisions[0];
    const selected = study.alternativeRefs[0];

    expect(useAppStore.getState().updateDecision(decision.id, {
      selectedAlternative: selected.label,
      status: "approved",
      rationale: "The reviewed evidence supports this baseline.",
      baselineApprovalConfirmed: true
    })).toBeNull();

    const updated = useAppStore.getState().projects[0];
    expect(updated.baselineArchitectureId).toBe(selected.architectureId);
    expect(updated.architectures.find((item) => item.id === selected.architectureId)?.status).toBe("baseline");
    expect(updated.comparisonStudies[0].status).toBe("decided");
    expect(updated.openDecisions.find((item) => item.id === study.originatingOpenDecisionId)?.status).toBe("closed");
  });
});
