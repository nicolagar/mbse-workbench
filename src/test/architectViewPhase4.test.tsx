import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ArchitectView } from "../components/ArchitectView";
import { DialogProvider } from "../components/dialogs/DialogProvider";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { applyArchitectAnswer, buildArchitectQuestions, projectedArchitectValue } from "../domain/architectView";
import type { ModelElement, PersistedAppState } from "../domain/types";
import { CURRENT_SCHEMA_VERSION, migratePersistedState } from "../store/persistence";
import { useAppStore } from "../store/useAppStore";

function persisted(project = createCoffeeMachineSampleProject()): PersistedAppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeProjectId: project.id,
    projects: [project],
    snapshots: [],
    uiPreferences: { ...useAppStore.getState().uiPreferences, activePerspective: "architect" }
  };
}

describe("Architect view Phase 4 delivery hardening", () => {
  beforeEach(() => useAppStore.getState().resetEntireApplication("empty"));

  it("migrates v1.5.3 projects without an Architect session without changing model content", () => {
    const project = createCoffeeMachineSampleProject();
    project.architectSession = undefined;
    const migrated = migratePersistedState(persisted(project)).projects[0];
    expect(migrated.elements.map((element) => element.id)).toEqual(project.elements.map((element) => element.id));
    expect(migrated.relationships.map((relationship) => relationship.id)).toEqual(project.relationships.map((relationship) => relationship.id));
    expect(migrated.architectSession).toBeUndefined();
    expect(buildArchitectQuestions(migrated)[0].id).toBe("AV-A01");
  });

  it("repairs incomplete Architect sessions and resumes from the first incomplete question", () => {
    const project = createCoffeeMachineSampleProject();
    project.architectSession = {
      id: "legacy-session",
      projectId: project.id,
      currentQuestionKey: "AV-REMOVED",
      status: "draft",
      answers: {
        "AV-A02": {
          key: "AV-A02",
          questionId: "AV-A02",
          status: "answered",
          value: "architectureBuilding",
          generatedElementIds: undefined as unknown as string[],
          generatedRelationshipIds: undefined as unknown as string[],
          generatedParameterIds: undefined as unknown as string[],
          sourceModelRevision: project.modelRevision,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        }
      },
      sectionStates: {},
      reviewedSectionIds: [],
      parameterIntents: {},
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
    const migrated = migratePersistedState(persisted(project)).projects[0];
    expect(migrated.architectSession?.answers["AV-A02"].generatedElementIds).toEqual([]);
    useAppStore.setState({ projects: [migrated], activeProjectId: migrated.id });
    render(<DialogProvider><ArchitectView /></DialogProvider>);
    expect(screen.getByRole("heading", { name: "What is the Aim of this Project?" })).toBeInTheDocument();
  });

  it("provides only the recap pages relevant to each selected scope", () => {
    const project = createCoffeeMachineSampleProject();
    project.overallScope = "architectureBuilding";
    expect(buildArchitectQuestions(project).filter((question) => question.id.startsWith("AV-M")).map((question) => question.id)).toEqual(["AV-M02", "AV-M03", "AV-M04"]);
    project.overallScope = "architectureAndSimulation";
    expect(buildArchitectQuestions(project).filter((question) => question.id.startsWith("AV-M")).map((question) => question.id)).toEqual(["AV-M02", "AV-M03", "AV-M04", "AV-M05"]);
    project.overallScope = "tradeStudy";
    expect(buildArchitectQuestions(project).filter((question) => question.id.startsWith("AV-M")).map((question) => question.id)).toEqual(["AV-M02", "AV-M03", "AV-M04", "AV-M05", "AV-M06"]);
  });

  it("marks only Architect answers affected by a Modeler-side model edit", () => {
    let project = createCoffeeMachineSampleProject();
    project.architectSession = undefined;
    const missionQuestion = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-A04")!;
    project = applyArchitectAnswer(project, missionQuestion, "Provide personalized beverages with low maintenance overhead").project;
    const stakeholderQuestion = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-B01")!;
    project = applyArchitectAnswer(project, stakeholderQuestion, projectedArchitectValue(project, stakeholderQuestion)).project;
    useAppStore.setState({ projects: [project], activeProjectId: project.id });
    const now = new Date().toISOString();
    const element: ModelElement = {
      id: "modeler-added-stakeholder",
      name: "Service operator",
      description: "Added in Modeler view",
      elementType: "stakeholder",
      status: "reviewed",
      architectureScope: "common",
      tags: [],
      parameters: [],
      metadata: {},
      customAttributeValues: {},
      createdAt: now,
      updatedAt: now
    };
    useAppStore.getState().addElement(element);
    const updated = useAppStore.getState().projects[0];
    expect(updated.architectSession?.status).toBe("outOfDate");
    expect(updated.architectSession?.answers["AV-A04"].status).toBe("answered");
    expect(updated.architectSession?.answers["AV-B01"].status).toBe("needsReview");
    const currentQuestion = buildArchitectQuestions(updated).find((candidate) => candidate.id === "AV-B01")!;
    expect(String(projectedArchitectValue(updated, currentQuestion))).toContain("Service operator");
  });

  it("does not request Architect review for an unrelated documentation edit", () => {
    let project = createCoffeeMachineSampleProject();
    project.architectSession = undefined;
    const question = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-A04")!;
    project = applyArchitectAnswer(project, question, "Provide personalized beverages with low maintenance overhead").project;
    useAppStore.setState({ projects: [project], activeProjectId: project.id });

    useAppStore.getState().updateProject({ description: "Editorial note added in Modeler." });
    const updated = useAppStore.getState().projects[0];
    expect(updated.architectSession?.answers["AV-A04"].status).toBe("answered");
    expect(updated.architectSession?.status).not.toBe("outOfDate");
  });

  it("reviews the affected use-case scope answer when an addresses link is removed", () => {
    let project = createCoffeeMachineSampleProject();
    project.architectSession = undefined;
    const address = project.relationships.find((relationship) => relationship.relationshipType === "addresses")!;
    const missionQuestion = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-A04")!;
    project = applyArchitectAnswer(project, missionQuestion, projectedArchitectValue(project, missionQuestion)).project;
    const scopeQuestion = buildArchitectQuestions(project).find((candidate) => candidate.id === "AV-C03" && candidate.instanceKey === address.sourceId)!;
    project = applyArchitectAnswer(project, scopeQuestion, projectedArchitectValue(project, scopeQuestion)).project;
    useAppStore.setState({ projects: [project], activeProjectId: project.id });

    useAppStore.getState().deleteRelationship(address.id);
    const updated = useAppStore.getState().projects[0];
    expect(updated.architectSession?.answers[missionQuestion.key].status).toBe("answered");
    expect(updated.architectSession?.answers[scopeQuestion.key].status).toBe("needsReview");
    const currentQuestion = buildArchitectQuestions(updated).find((candidate) => candidate.key === scopeQuestion.key)!;
    expect(projectedArchitectValue(updated, currentQuestion)).not.toContain(address.targetId);
  });

  it("keeps Skip untimed and exposes keyboard-operable progress controls", async () => {
    const project = createCoffeeMachineSampleProject();
    project.architectSession = undefined;
    useAppStore.setState({ projects: [project], activeProjectId: project.id });
    render(<DialogProvider><ArchitectView /></DialogProvider>);
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip).toHaveTextContent(/^Skip$/);
    expect(screen.queryByText(/second|timer|countdown/i)).not.toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Open progress" });
    expect(menu).toHaveAttribute("aria-controls", "architect-progress");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(skip);
    await waitFor(() => expect(screen.getByRole("heading", { name: "What should this study include?" })).toHaveFocus());
  });
});
