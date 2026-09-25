import { SemanticParallelPanel } from "./SemanticWorkspace";
import { ConfigurationReadiness } from "./ConfigurationReadiness";
import { StakeholderTraceabilityRecap } from "./StakeholderTraceabilityRecap";
import { baselineRequirementIds } from "../domain/ontology";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Menu, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  architectAnswerComplete,
  architectQuestionValueError,
  architectReadiness,
  buildArchitectQuestions,
  projectedArchitectValue,
  type ArchitectQuestion
} from "../domain/architectView";
import type { ArchitectAnswer, Project } from "../domain/types";
import { simulationStatus } from "../domain/simulation";
import { requirementSatisfaction } from "../domain/traceability";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { ProjectHeader } from "./ProjectHeader";
import { ModelGraph } from "./ModelGraph";
import { contextConnections } from "../domain/contextConnections";
import { ProjectRecapWorkspace } from "./ProjectRecapWorkspace";

const sectionOrder = [
  "setup", "intent", "scope", "requirements", "tradeFraming", "evaluation", "productBehavior", "productStructure",
  "industrialBehavior", "industrialStructure", "traceability", "analysisInputs", "analysis", "variability", "configurations",
  "tradeSimulation", "comparison", "final"
];

const architectLayerByType = {
  mission: { layer: 0, label: "Mission" },
  system: { layer: 1, label: "System & Context" }, externalSystem: { layer: 1, label: "System & Context" }, stakeholder: { layer: 1, label: "System & Context" },
  need: { layer: 2, label: "Intent & Use Cases" }, objective: { layer: 2, label: "Intent & Use Cases" }, useCase: { layer: 2, label: "Intent & Use Cases" },
  systemRequirement: { layer: 3, label: "Requirements & Validation" }, verificationMethod: { layer: 3, label: "Requirements & Validation" },
  productFunction: { layer: 4, label: "Product & Process Functions" }, processFunction: { layer: 4, label: "Product & Process Functions" },
  productComponent: { layer: 5, label: "Technical Realization" }, industrialSystemComponent: { layer: 5, label: "Technical Realization" }, resource: { layer: 5, label: "Technical Realization" },
  productInterface: { layer: 6, label: "Interfaces" }, processInterface: { layer: 6, label: "Interfaces" }
} as const;

const architectRevealSectionByType = {
  mission: "intent", system: "intent", stakeholder: "intent", need: "intent", objective: "intent",
  externalSystem: "intent", useCase: "scope",
  systemRequirement: "requirements", verificationMethod: "requirements",
  productFunction: "productBehavior", productInterface: "productStructure", productComponent: "productStructure",
  processFunction: "industrialBehavior", processInterface: "industrialStructure", industrialSystemComponent: "industrialStructure", resource: "industrialStructure"
} as const;

export function ArchitectView() {
  const project = useAppStore(selectActiveProject)!;
  const setPerspective = useAppStore((state) => state.setPerspective);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setModelTab = useAppStore((state) => state.setModelTab);
  const setModelView = useAppStore((state) => state.setModelView);
  const answerQuestion = useAppStore((state) => state.answerArchitectQuestion);
  const setCurrentQuestion = useAppStore((state) => state.setArchitectCurrentQuestion);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState<{ question: ArchitectQuestion; value: unknown } | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const impactApplyRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(69);
  const questions = useMemo(() => buildArchitectQuestions(project), [project]);
  const answers = project.architectSession?.answers ?? {};
  const requestedKey = project.architectSession?.currentQuestionKey;
  const fallback = questions.find((item) => !architectAnswerComplete(item, answers[item.key])) ?? questions[0];
  const current = questions.find((item) => item.key === requestedKey) ?? fallback;
  const currentIndex = Math.max(0, questions.findIndex((item) => item.key === current?.key));
  const visibleQuestionKeys = new Set(questions.slice(0, currentIndex + 1).map((question) => question.key));
  const currentSectionIndex = current ? sectionOrder.indexOf(current.sectionId) : -1;
  const visibleElementIds = new Set([
    ...Object.entries(answers).flatMap(([key, answer]) => visibleQuestionKeys.has(key) && answer.status !== "skipped" ? answer.generatedElementIds : []),
    ...project.elements.filter((element) => sectionOrder.indexOf(architectRevealSectionByType[element.elementType]) <= currentSectionIndex).map((element) => element.id)
  ]);
  const architectGraphElements = project.elements.filter((element) => visibleElementIds.has(element.id));
  const architectGraphRelationships = project.relationships.filter((relationship) => visibleElementIds.has(relationship.sourceId) && visibleElementIds.has(relationship.targetId));
  const architectContextRelationships = contextConnections(project).filter((relationship) => visibleElementIds.has(relationship.sourceId) && visibleElementIds.has(relationship.targetId));
  const architectGraphLayers = Object.fromEntries(architectGraphElements.map((element) => [element.id, architectLayerByType[element.elementType]]));
  const [inputValue, setInputValue] = useState<unknown>(() => current ? projectedArchitectValue(project, current) : "");

  useEffect(() => {
    if (project.architectSession?.completedAt && questions.length > 0 && questions.every((question) => architectAnswerComplete(question, answers[question.key]))) {
      setShowCompletion(true);
    }
  }, [project.id, project.architectSession?.completedAt]);

  useEffect(() => {
    if (!current) return;
    const sessionIsComplete = Boolean(project.architectSession?.completedAt)
      && questions.every((question) => architectAnswerComplete(question, answers[question.key]));
    if (!sessionIsComplete) setShowCompletion(false);
    setInputValue(projectedArchitectValue(project, current));
    setValidationMessage("");
    window.requestAnimationFrame(() => questionHeadingRef.current?.focus());
  }, [current?.key, project.id]);

  useEffect(() => {
    if (pendingSubmission) window.requestAnimationFrame(() => impactApplyRef.current?.focus());
  }, [pendingSubmission]);

  useEffect(() => {
    const closeTransientUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pendingSubmission) {
        setPendingSubmission(null);
        window.requestAnimationFrame(() => continueButtonRef.current?.focus());
      } else if (drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, [drawerOpen, pendingSubmission]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => {
      const measured = Math.ceil(header.getBoundingClientRect().height);
      if (measured > 0) setHeaderHeight(measured);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  if (!current) return null;
  const completed = questions.filter((item) => architectAnswerComplete(item, answers[item.key])).length;
  const readiness = architectReadiness(project);
  const progress = questions.length ? Math.round((completed / questions.length) * 100) : 0;
  const currentExample = current.example ?? architectInputExample(current);

  const navigate = (question: ArchitectQuestion | undefined) => {
    if (!question) return;
    setShowCompletion(false);
    setCurrentQuestion(question.key);
    setDrawerOpen(false);
  };
  const advanceFrom = (questionKey: string) => {
    const nextState = useAppStore.getState();
    const nextProject = selectActiveProject(nextState);
    if (!nextProject) return;
    const nextQuestions = buildArchitectQuestions(nextProject);
    const index = nextQuestions.findIndex((item) => item.key === questionKey);
    const next = nextQuestions[index + 1];
    if (next) navigate(next);
    else {
      setShowCompletion(true);
      setDrawerOpen(false);
    }
  };
  const applySubmission = (question: ArchitectQuestion, value: unknown) => {
    answerQuestion(question, value, "answered");
    setPendingSubmission(null);
    const saved = selectActiveProject(useAppStore.getState())?.architectSession?.answers[question.key];
    if (saved?.status === "invalid") {
      setInputValue(saved.value);
      setValidationMessage("The analysis could not be stored. Resolve the reported issue and run it again.");
      return;
    }
    advanceFrom(question.key);
  };
  const submit = () => {
    const error = architectQuestionValueError(current, inputValue);
    if (error) {
      setValidationMessage(`${error} Enter an answer or use Skip to continue with a visible gap.`);
      return;
    }
    const previous = answers[current.key];
    const changed = previous && JSON.stringify(previous.value) !== JSON.stringify(inputValue);
    if (previous?.status === "answered" && !changed) {
      advanceFrom(current.key);
      return;
    }
    const affected = (previous?.generatedElementIds.length ?? 0) + (previous?.generatedRelationshipIds.length ?? 0) + (previous?.generatedParameterIds.length ?? 0)
      + (previous?.generatedFeatureIds?.length ?? 0) + (previous?.generatedVariationPointIds?.length ?? 0) + (previous?.generatedConfigurationIds?.length ?? 0)
      + (previous?.generatedStudyIds?.length ?? 0) + (previous?.generatedDecisionIds?.length ?? 0);
    if (changed && affected > 0) {
      setPendingSubmission({ question: current, value: inputValue });
      return;
    }
    applySubmission(current, inputValue);
  };
  const skip = () => {
    answerQuestion(current, inputValue, "skipped");
    advanceFrom(current.key);
  };
  const sections = sectionOrder.map((sectionId) => {
    const items = questions.filter((item) => item.sectionId === sectionId);
    return { sectionId, label: items[0]?.sectionLabel ?? sectionId, items };
  }).filter((section) => section.items.length);
  const openModelReview = (view: "overview" | "quality") => {
    setModelTab("traceability");
    setModelView(view);
    setWorkspace("model");
    setPerspective("modeler");
  };

  return <div className="min-h-screen bg-slate-100 text-slate-900" style={{ "--architect-header-height": `${headerHeight}px` } as CSSProperties}>
    {drawerOpen && <button className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" aria-label="Close progress" onClick={() => setDrawerOpen(false)} />}
    <header ref={headerRef} className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-5"><div className="mx-auto max-w-[1500px]"><ProjectHeader perspective="architect" onOpenNavigation={() => setDrawerOpen(true)} navigationLabel="Open progress" navigationControls="architect-progress" navigationExpanded={drawerOpen} /></div></header>

    <div className="mx-auto grid max-w-[1500px] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside id="architect-progress" className={`fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r border-slate-200 bg-white p-4 transition-transform md:sticky md:top-[var(--architect-header-height)] md:z-0 md:h-[calc(100vh-var(--architect-header-height))] md:w-auto md:visible md:translate-x-0 ${drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`} aria-label="Architect progress">
        <div className="flex items-start justify-between gap-3">
          <div><div className="font-bold">{scopeName(project.overallScope)}</div><div className="mt-1 text-xs text-slate-500">{completed} of {questions.length} questions confirmed</div></div>
          <button className="md:hidden" aria-label="Close progress" onClick={() => setDrawerOpen(false)}><X size={18} /></button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Architect progress"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div>
        <nav className="mt-5 space-y-2">
          {sections.map((section) => {
            const sectionComplete = section.items.filter((item) => architectAnswerComplete(item, answers[item.key])).length;
            const active = section.sectionId === current.sectionId;
            const firstPending = section.items.find((item) => !architectAnswerComplete(item, answers[item.key])) ?? section.items[0];
            const skipped = section.items.filter((item) => answers[item.key]?.status === "skipped").length;
            return <button key={section.sectionId} aria-current={active ? "step" : undefined} onClick={() => navigate(firstPending)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"}`}>
              <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${sectionComplete === section.items.length ? "bg-green-500" : active ? "bg-blue-500" : skipped ? "bg-amber-500" : "border-2 border-slate-300"}`} /><span className="font-semibold">{section.label}</span><span className="ml-auto text-xs text-slate-500">{sectionComplete}/{section.items.length}</span></span>
              {skipped > 0 && <span className="ml-[18px] mt-1 block text-xs text-amber-700">{skipped} skipped</span>}
            </button>;
          })}
        </nav>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">Current status</div>
          <div className="mt-1">{readiness.status === "ready" ? "Ready" : readiness.status === "outOfDate" ? "Out of date · review affected answers" : readiness.blockingCount ? `Blocked · ${readiness.blockingCount} items` : "Draft"}</div>
          {readiness.warningCount > 0 && <div className="mt-1 text-amber-700">{readiness.warningCount} non-blocking warnings</div>}
        </div>
      </aside>

      <main id="architect-main" className="min-w-0 p-4 sm:p-7 lg:p-10">
        {showCompletion ? <ArchitectCompletion
          project={project}
          readiness={readiness}
          onBack={() => setShowCompletion(false)}
          onOpenRecap={() => openModelReview("overview")}
          onOpenValidation={() => openModelReview("quality")}
        /> : <section className="mx-auto max-w-4xl" aria-live="polite">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{current.sectionLabel} · Question {currentIndex + 1} of {questions.length}</div>
          <h1 ref={questionHeadingRef} tabIndex={-1} className="mt-2 text-2xl font-bold outline-none sm:text-3xl">{current.prompt}</h1>
          <div className="card mt-6 p-5 sm:p-6">
            <ArchitectInput question={current} value={inputValue} onChange={setInputValue} project={project} />
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><strong className="block text-slate-800">Answer guidance</strong><p className="mt-1">{current.explanation}</p><p className="mt-2"><strong>Example:</strong> {currentExample}</p></div>
            {validationMessage && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{validationMessage}</div>}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button className="btn" disabled={currentIndex === 0} onClick={() => navigate(questions[currentIndex - 1])}><ArrowLeft size={15} />Back</button>
            <div className="flex items-center gap-2"><button className="btn border-transparent bg-transparent text-slate-500 hover:bg-slate-50" onClick={skip}>Skip</button><button ref={continueButtonRef} className="btn btn-primary" onClick={submit}>{current.inputKind === "recap" ? "Confirm section" : "Continue"}<ChevronRight size={15} /></button></div>
          </div>
          <SemanticParallelPanel flag="showArchitectSemanticGraph" label="Open progressive semantic preview" visibleElementIds={new Set(architectGraphElements.map(e => e.id))}><section className="card mt-6 overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold">Model created so far</h2><p className="mt-1 text-xs text-slate-500">The accumulated model grows as questions are confirmed and is arranged as a semantic left-to-right digital thread. Parameters and evidence details are intentionally hidden here.</p></div><ModelGraph elements={architectGraphElements} relationships={architectGraphRelationships} contextRelationships={architectContextRelationships} layoutMode="horizontal" layoutKey="architect-progress" readOnly allowDetailed={false} heightClass="h-[460px]" layerOverrides={architectGraphLayers} /></section></SemanticParallelPanel>
        </section>}
      </main>
    </div>

    {pendingSubmission && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="presentation">
      <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="impact-title" aria-describedby="impact-description">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" /><div><h2 id="impact-title" className="text-xl font-bold">Review the impact of this change</h2><p id="impact-description" className="mt-2 text-sm text-slate-600">This answer previously created or linked model content. Applying the change preserves Modeler-created content and marks dependent Architect answers for review.</p></div></div>
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Affected references: {architectGeneratedCount(answers[pendingSubmission.question.key])}. Existing simulation or comparison evidence may become out of date.</div>
        <div className="mt-5 flex justify-end gap-2"><button className="btn" onClick={() => { setPendingSubmission(null); window.requestAnimationFrame(() => continueButtonRef.current?.focus()); }}>Cancel</button><button ref={impactApplyRef} className="btn btn-primary" onClick={() => applySubmission(pendingSubmission.question, pendingSubmission.value)}>Apply change</button></div>
      </section>
    </div>}
  </div>;
}

export function ArchitectCompletion({ project, readiness, onBack, onOpenRecap, onOpenValidation }: {
  project: Project;
  readiness: ReturnType<typeof architectReadiness>;
  onBack: () => void;
  onOpenRecap: () => void;
  onOpenValidation: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const requirementStates = project.elements
    .filter((element) => element.elementType === "systemRequirement")
    .map((requirement) => requirementSatisfaction(project, requirement));
  const satisfied = requirementStates.filter((state) => state.status === "satisfied").length;
  const pending = requirementStates.filter((state) => state.status === "pending").length;
  const failed = requirementStates.filter((state) => state.status === "failed").length;
  const answers = Object.values(project.architectSession?.answers ?? {});
  const needsReview = answers.filter((answer) => answer.status === "needsReview").length;
  const incompleteAnswers = readiness.findings.filter((finding) => finding.severity === "blocking" && finding.id.startsWith("AVR-answer-")).length;
  const hardBlocking = readiness.findings.filter((finding) => finding.severity === "blocking" && !finding.id.startsWith("AVR-answer-")).length;
  const state = failed > 0 || hardBlocking > 0 ? "blocked" : needsReview > 0 || pending > 0 || readiness.warningCount > 0 || incompleteAnswers > 0 ? "review" : "ready";
  const presentation = state === "blocked"
    ? {
        border: "border-red-200", background: "bg-red-50", badge: "bg-red-600", eyebrow: "text-red-700", body: "text-red-900",
        eyebrowText: "Blocking issues", heading: "Guided modelling finished with blocking issues",
        message: [
          failed ? `${failed} requirement${failed === 1 ? " is" : "s are"} failed.` : "",
          hardBlocking ? `${hardBlocking} blocking model item${hardBlocking === 1 ? "" : "s"} need attention.` : ""
        ].filter(Boolean).join(" ")
      }
    : state === "review"
      ? {
          border: "border-amber-200", background: "bg-amber-50", badge: "bg-amber-500", eyebrow: "text-amber-700", body: "text-amber-900",
          eyebrowText: "Review required", heading: "Guided modelling finished with items to review",
          message: needsReview
            ? `${needsReview} previously confirmed answer${needsReview === 1 ? " needs" : "s need"} review after a related model change. This overview already reflects the current model.`
            : `The model overview is current, but ${pending + readiness.warningCount + incompleteAnswers} pending, warning or incomplete item${pending + readiness.warningCount + incompleteAnswers === 1 ? "" : "s"} still need review.`
        }
      : {
          border: "border-green-200", background: "bg-green-50", badge: "bg-green-600", eyebrow: "text-green-700", body: "text-green-900",
          eyebrowText: "Architect workflow finished", heading: "Guided modelling complete", message: "The model is valid and all guided answers are reviewed."
        };
  const StatusIcon = state === "ready" ? Check : AlertTriangle;
  return <section className="mx-auto max-w-5xl" aria-live="polite">
    <div className={`rounded-xl border p-6 sm:p-8 ${presentation.border} ${presentation.background}`}>
      <div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${presentation.badge}`}><StatusIcon size={24} /></span><div><div className={`text-xs font-bold uppercase tracking-[0.16em] ${presentation.eyebrow}`}>{presentation.eyebrowText}</div><h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold outline-none sm:text-3xl">{presentation.heading}</h1><p className={`mt-2 text-sm ${presentation.body}`}>{presentation.message}</p></div></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4"><SummaryMetric label="Model elements" value={String(project.elements.length)} /><SummaryMetric label="Relationships" value={String(project.relationships.length)} /><SummaryMetric label="Requirements met / assumed" value={`${satisfied}/${requirementStates.length}`} /><SummaryMetric label="Pending / failed" value={`${pending} / ${failed}`} /></div>
    <div className="mt-5"><ProjectRecapWorkspace project={project} compact /></div>
    <section className="card mt-5 p-5"><h2 className="font-bold">Review the completed model</h2><p className="mt-1 text-sm text-slate-600">Use the Model Digital Thread to follow the mission and context through requirements, product and industrial design, and reviewed results. Use validation results to resolve any remaining blocking findings.</p><div className="mt-4 flex flex-wrap gap-3"><button className="btn btn-primary" onClick={onOpenRecap}>Open Model Digital Thread</button><button className="btn" onClick={onOpenValidation}>Open validation results</button><button className="btn" onClick={onBack}><ArrowLeft size={15} />Back to final question</button></div></section>
  </section>;
}

function ArchitectInput({ question, value, onChange, project }: {
  question: ArchitectQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  project: Project;
}) {
  if (question.inputKind === "scope") return <div className="grid gap-3 lg:grid-cols-3">{question.options?.map((option) => <label key={option.id} className={`cursor-pointer rounded-xl border p-4 ${value === option.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200"}`}><span className="flex items-start gap-3"><input className="mt-1" type="radio" name="architect-scope" checked={value === option.id} onChange={() => onChange(option.id)} /><span><strong className="block">{option.label}</strong><span className="mt-1 block text-sm leading-5 text-slate-600">{option.detail}</span></span></span></label>)}</div>;
  if (question.inputKind === "text") return <label><span className="label">Answer</span><input className="field" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></label>;
  if (question.inputKind === "textarea" || question.inputKind === "semicolon") return <label><span className="label">Answer{question.inputKind === "semicolon" ? " · separate entries with semicolons" : ""}</span><textarea className="field min-h-32" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></label>;
  if (question.inputKind === "existingAndNew") {
    const data = value && typeof value === "object" ? value as { selectedIds?: string[]; newItems?: string } : {};
    const selected = data.selectedIds ?? [];
    return <div><fieldset><legend className="label">Reuse existing requirements</legend><div className="grid gap-2 sm:grid-cols-2">{question.options?.map((option) => <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3" key={option.id}><input className="mt-1" type="checkbox" checked={selected.includes(option.id)} onChange={(event) => onChange({ ...data, selectedIds: event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id) })} /><span className="text-sm font-medium">{option.label}</span></label>)}</div></fieldset><label className="mt-4 block"><span className="label">Add new requirements · separate with semicolons</span><textarea className="field min-h-24" value={data.newItems ?? ""} onChange={(event) => onChange({ ...data, newItems: event.target.value })} /></label></div>;
  }
  if (question.inputKind === "quantitative") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="lg:col-span-2"><span className="label">Measured property</span><input className="field" value={String(data.propertyName ?? "")} onChange={(event) => update("propertyName", event.target.value)} /></label><label><span className="label">Semantic key</span><input className="field font-mono" value={String(data.semanticKey ?? "")} onChange={(event) => update("semanticKey", event.target.value)} /></label><label><span className="label">Operator</span><select className="field" value={String(data.operator ?? "<=")} onChange={(event) => update("operator", event.target.value)}>{["<", "<=", ">", ">=", "=", "==", "!="].map((operator) => <option key={operator}>{operator}</option>)}</select></label><label><span className="label">Target</span><input className="field" type="number" step="any" value={String(data.target ?? "")} onChange={(event) => update("target", event.target.value === "" ? "" : Number(event.target.value))} /></label><label className="lg:col-start-4 lg:col-span-2"><span className="label">Unit</span><input className="field" value={String(data.unit ?? "")} onChange={(event) => update("unit", event.target.value)} /></label></div>;
  }
  if (question.inputKind === "propertySource") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return <div className="space-y-4"><label><span className="label">Value source</span><select className="field" value={String(data.sourceKind ?? "later")} onChange={(event) => onChange({ ...data, sourceKind: event.target.value, ownerElementId: event.target.value === "existing" ? data.ownerElementId ?? "" : "" })}><option value="existing">Existing function or component</option><option value="later">Architecture element to be defined later</option><option value="kpi">KPI result</option><option value="verification">Verification result</option></select></label>{data.sourceKind === "existing" && <label><span className="label">Property owner</span><select className="field" value={String(data.ownerElementId ?? "")} onChange={(event) => onChange({ ...data, ownerElementId: event.target.value })}><option value="">Select…</option>{question.options?.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.detail}</option>)}</select></label>}</div>;
  }
  if (question.inputKind === "engineeringValue") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label><span className="label">Preliminary value · optional</span><input className="field" type="number" step="any" value={data.value === null || data.value === undefined ? "" : String(data.value)} onChange={(event) => update("value", event.target.value === "" ? null : Number(event.target.value))} /></label><label><span className="label">Unit</span><input className="field" value={String(data.unit ?? "")} onChange={(event) => update("unit", event.target.value)} /></label><label><span className="label">Origin</span><select className="field" value={String(data.valueOrigin ?? "entered")} onChange={(event) => update("valueOrigin", event.target.value)}>{["entered", "assumed", "calculated", "simulated"].map((origin) => <option key={origin}>{origin}</option>)}</select></label><label className="sm:col-span-2"><span className="label">Source</span><input className="field" value={String(data.source ?? "")} onChange={(event) => update("source", event.target.value)} /></label><label><span className="label">Uncertainty % · optional</span><input className="field" type="number" min="0" max="100" step="any" value={data.uncertaintyPercent === undefined ? "" : String(data.uncertaintyPercent)} onChange={(event) => update("uncertaintyPercent", event.target.value === "" ? undefined : Number(event.target.value))} /></label></div>;
  }
  if (question.inputKind === "analysisInput") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, legacyOwner = data.ownerElementId ? [{ ownerElementId: String(data.ownerElementId), value: data.value, unit: data.unit, source: data.source, valueOrigin: data.valueOrigin, uncertaintyPercent: data.uncertaintyPercent }] : [], owners = Array.isArray(data.owners) ? data.owners as Array<Record<string, unknown>> : legacyOwner;
    const updateOwner = (ownerId: string, key: string, next: unknown) => onChange({ ...data, owners: owners.map((row) => row.ownerElementId === ownerId ? { ...row, [key]: next } : row), ownerElementId: undefined });
    const toggleOwner = (ownerId: string, checked: boolean) => onChange({ ...data, owners: checked ? [...owners, { ownerElementId: ownerId, value: null, unit: "", source: "", valueOrigin: "entered" }] : owners.filter((row) => row.ownerElementId !== ownerId), ownerElementId: undefined });
    return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Parameter name</span><input className="field" value={String(data.propertyName ?? "")} onChange={(event) => onChange({ ...data, propertyName: event.target.value })} /></label><label><span className="label">Semantic key</span><input className="field font-mono" value={String(data.semanticKey ?? "")} readOnly /></label></div><fieldset><legend className="label">Authoritative model elements · select all contributors</legend><div className="grid gap-2 sm:grid-cols-2">{question.options?.map((option) => <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3" key={option.id}><input className="mt-1" type="checkbox" checked={owners.some((row) => row.ownerElementId === option.id)} onChange={(event) => toggleOwner(option.id, event.target.checked)} /><span><strong className="block text-sm">{option.label}</strong><span className="text-xs text-slate-500">{option.detail}</span></span></label>)}</div></fieldset><div className="space-y-3">{owners.map((row) => { const ownerId = String(row.ownerElementId), label = question.options?.find((option) => option.id === ownerId)?.label ?? ownerId; return <section className="rounded-lg border border-slate-200 p-4" key={ownerId}><h3 className="font-semibold">{label}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label><span className="label">Value</span><input className="field" type="number" step="any" value={row.value === null || row.value === undefined ? "" : String(row.value)} onChange={(event) => updateOwner(ownerId, "value", event.target.value === "" ? null : Number(event.target.value))} /></label><label><span className="label">Unit</span><input className="field" value={String(row.unit ?? "")} onChange={(event) => updateOwner(ownerId, "unit", event.target.value)} /></label><label><span className="label">Origin</span><select className="field" value={String(row.valueOrigin ?? "entered")} onChange={(event) => updateOwner(ownerId, "valueOrigin", event.target.value)}>{["entered", "assumed", "calculated", "simulated"].map((origin) => <option key={origin}>{origin}</option>)}</select></label><label><span className="label">Uncertainty % · optional</span><input className="field" type="number" min="0" max="100" step="any" value={row.uncertaintyPercent === undefined ? "" : String(row.uncertaintyPercent)} onChange={(event) => updateOwner(ownerId, "uncertaintyPercent", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label className="sm:col-span-2 lg:col-span-1"><span className="label">Engineering source</span><input className="field" value={String(row.source ?? "")} onChange={(event) => updateOwner(ownerId, "source", event.target.value)} /><span className="mt-1 block text-xs text-slate-500">Where this value came from, such as CAD mass properties, a supplier datasheet, a test, a time study or an engineering estimate.</span></label></div></section>; })}</div></div>;
  }
  if (question.inputKind === "single") return <label><span className="label">Select one</span><select className="field" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{question.options?.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select>{!question.options?.length && <span className="mt-2 block text-sm text-amber-700">Define the required items in the preceding question first.</span>}</label>;
  if (question.inputKind === "multi") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <fieldset><legend className="label">Select all that apply</legend><div className="grid gap-2 sm:grid-cols-2">{question.options?.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><input className="mt-1" type="checkbox" checked={selected.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))} /><span><span className="block text-sm font-medium">{option.label}</span>{option.detail && <span className="mt-1 block text-xs text-slate-500">{option.detail}</span>}</span></label>)}</div>{!question.options?.length && <p className="text-sm text-amber-700">No compatible model content is available yet. Return to the relevant architecture question.</p>}</fieldset>;
  }
  if (question.inputKind === "flow") {
    const flows = Array.isArray(value) ? value as Array<{ componentId: string; quantity: number; unit: string; itemFlowName?: string }> : [];
    const updateFlow = (componentId: string, patch: Partial<{ quantity: number; unit: string; itemFlowName: string }>) => onChange(flows.map((flow) => flow.componentId === componentId ? { ...flow, ...patch } : flow));
    return <fieldset><legend className="label">Select product components defined in Product architecture</legend><div className="space-y-2">{question.options?.map((option) => {
      const flow = flows.find((item) => item.componentId === option.id);
      return <div className="rounded-lg border border-slate-200 p-3" key={option.id}><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={Boolean(flow)} onChange={(event) => onChange(event.target.checked ? [...flows, { componentId: option.id, quantity: 1, unit: "item", itemFlowName: option.label }] : flows.filter((item) => item.componentId !== option.id))} /><span className="font-semibold">{option.label}</span></label>{flow && <div className="mt-3 grid gap-3 sm:grid-cols-3"><label><span className="label">Flow name</span><input className="field" value={flow.itemFlowName ?? ""} onChange={(event) => updateFlow(option.id, { itemFlowName: event.target.value })} /></label><label><span className="label">Quantity</span><input className="field" type="number" min="0.000001" step="any" value={flow.quantity} onChange={(event) => updateFlow(option.id, { quantity: Number(event.target.value) })} /></label><label><span className="label">Unit</span><input className="field" value={flow.unit} onChange={(event) => updateFlow(option.id, { unit: event.target.value })} /></label></div>}</div>;
    })}</div>{!question.options?.length && <p className="text-sm text-amber-700">No product components are available. Return to Product architecture and define them first.</p>}</fieldset>;
  }
  if (question.inputKind === "verification") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Category</span><select className="field" value={String(data.category ?? "analysis")} onChange={(event) => update("category", event.target.value)}>{["analysis", "inspection", "demonstration", "test"].map((category) => <option key={category}>{category}</option>)}</select></label><label><span className="label">Method name</span><input className="field" value={String(data.name ?? "")} onChange={(event) => update("name", event.target.value)} /></label><label className="sm:col-span-2"><span className="label">Description</span><textarea className="field min-h-24" value={String(data.description ?? "")} onChange={(event) => update("description", event.target.value)} /></label>{question.options?.length ? <label className="sm:col-span-2"><span className="label">Allocate to industrial function · optional</span><select className="field" value={String(data.allocatedProcessFunctionId ?? "")} onChange={(event) => update("allocatedProcessFunctionId", event.target.value)}><option value="">Not allocated</option>{question.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : null}</div>;
  }
  if (question.inputKind === "sequence") {
    const order = Array.isArray(value) ? value.map(String) : question.options?.map((option) => option.id) ?? [];
    const label = (id: string) => question.options?.find((option) => option.id === id)?.label ?? id;
    const move = (index: number, delta: number) => { const next = [...order], target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next); };
    return <ol className="space-y-2">{order.map((id, index) => <li className="flex items-center gap-3 rounded-lg border border-slate-200 p-3" key={id}><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-sm font-bold">{index + 1}</span><span className="flex-1 font-medium">{label(id)}</span><button className="btn px-2" disabled={index === 0} aria-label={`Move ${label(id)} up`} onClick={() => move(index, -1)}>↑</button><button className="btn px-2" disabled={index === order.length - 1} aria-label={`Move ${label(id)} down`} onClick={() => move(index, 1)}>↓</button></li>)}</ol>;
  }
  if (question.inputKind === "duration") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">Duration</span><input className="field" type="number" min="0.000001" step="any" value={String(data.duration ?? "")} onChange={(event) => update("duration", event.target.value === "" ? "" : Number(event.target.value))} /></label><label><span className="label">Unit</span><select className="field" value={String(data.durationUnit ?? "minute")} onChange={(event) => update("durationUnit", event.target.value)}>{["minute", "hour", "day"].map((unit) => <option key={unit}>{unit}</option>)}</select></label><label><span className="label">Origin</span><select className="field" value={String(data.valueOrigin ?? "entered")} onChange={(event) => update("valueOrigin", event.target.value)}>{["entered", "assumed", "calculated", "simulated"].map((origin) => <option key={origin}>{origin}</option>)}</select></label><label><span className="label">Source</span><input className="field" value={String(data.source ?? "")} onChange={(event) => update("source", event.target.value)} /></label></div>;
  }
  if (question.inputKind === "resourceDetail") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">Required quantity</span><input className="field" type="number" min="0.000001" step="any" value={String(data.quantity ?? 1)} onChange={(event) => update("quantity", Number(event.target.value))} /></label><label><span className="label">Quantity unit</span><input className="field" value={String(data.unit ?? "item")} onChange={(event) => update("unit", event.target.value)} /></label><label><span className="label">Resource type</span><select className="field" value={String(data.resourceType ?? "tool")} onChange={(event) => update("resourceType", event.target.value)}>{["person", "role", "skill", "tool", "machine", "software", "facility"].map((type) => <option key={type}>{type}</option>)}</select></label><label><span className="label">Hourly rate · optional</span><input className="field" type="number" min="0" step="any" value={data.hourlyRate === undefined ? "" : String(data.hourlyRate)} onChange={(event) => update("hourlyRate", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label><span className="label">Cost unit</span><input className="field" value={String(data.costUnit ?? "EUR/h")} onChange={(event) => update("costUnit", event.target.value)} /></label><label><span className="label">Capacity hours · optional</span><input className="field" type="number" min="0" step="any" value={data.capacityHours === undefined ? "" : String(data.capacityHours)} onChange={(event) => update("capacityHours", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label><span className="label">Availability % · optional</span><input className="field" type="number" min="0" max="100" step="any" value={data.availabilityPercent === undefined ? "" : String(data.availabilityPercent)} onChange={(event) => update("availabilityPercent", event.target.value === "" ? undefined : Number(event.target.value))} /></label></div>;
  }
  if (question.inputKind === "interaction") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-3"><label><span className="label">Counterpart · optional</span><select className="field" value={String(data.counterpartId ?? "")} onChange={(event) => update("counterpartId", event.target.value)}><option value="">No interaction</option>{question.options?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label><span className="label">Interface name</span><input className="field" value={String(data.interfaceName ?? "")} onChange={(event) => update("interfaceName", event.target.value)} /></label><label><span className="label">Exchanged material, energy or information</span><input className="field" value={String(data.exchangedItem ?? "")} onChange={(event) => update("exchangedItem", event.target.value)} /></label></div>;
  }
  if (question.inputKind === "kpiReview") return <div>{question.options?.length ? <ul className="space-y-2">{question.options.map((option) => <li key={option.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="block text-sm font-semibold">{option.label}</span>{option.detail && <span className="mt-1 block text-xs text-slate-500">{option.detail}</span>}</li>)}</ul> : <p className="text-sm text-slate-600">Confirm that you reviewed the calculation method and any reported warnings.</p>}<label className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /><span className="text-sm font-semibold">I reviewed and confirm this calculation evidence</span></label></div>;
  if (question.inputKind === "kpiFormula") {
    const formula = String(value ?? ""), parameters = project.elements.flatMap((owner) => owner.parameters.map((parameter) => ({ owner, parameter }))), dependencies = project.kpis.filter((kpi) => kpi.id !== question.instanceKey);
    const insert = (token: string) => onChange(`${formula}${formula.trim() ? " " : ""}${token}`);
    return <div><label><span className="label">Formula</span><textarea className="field min-h-28 font-mono" value={formula} onChange={(event) => onChange(event.target.value)} placeholder={'param("exact-parameter-id") + kpi("exact-kpi-id")'} /></label><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><div className="label">Insert model parameter</div><div className="max-h-48 space-y-2 overflow-y-auto">{parameters.map(({ owner, parameter }) => <button className="btn w-full justify-start text-left" key={parameter.id} onClick={() => insert(`param("${parameter.id}")`)}>{owner.name} / {parameter.name}</button>)}</div></div><div><div className="label">Insert dependent KPI</div><div className="max-h-48 space-y-2 overflow-y-auto">{dependencies.map((kpi) => <button className="btn w-full justify-start text-left" key={kpi.id} onClick={() => insert(`kpi("${kpi.id}")`)}>{kpi.name}</button>)}</div></div></div><p className="mt-3 text-xs text-slate-500">Supported operators: +, −, ×, ÷. Supported functions: min, max, sum and average.</p></div>;
  }
  if (question.inputKind === "kpiDefinition") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    const showComparisonPreference = project.overallScope === "tradeStudy";
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label><span className="label">Output unit</span><input className="field" value={String(data.outputUnit ?? "")} onChange={(event) => update("outputUnit", event.target.value)} /></label>{showComparisonPreference && <label><span className="label">Preferred direction</span><select className="field" value={String(data.optimizationDirection ?? "minimize")} onChange={(event) => update("optimizationDirection", event.target.value)}><option value="minimize">Lower is better</option><option value="maximize">Higher is better</option></select></label>}<label><span className="label">Target · optional</span><input className="field" type="number" step="any" value={data.targetValue === undefined ? "" : String(data.targetValue)} onChange={(event) => update("targetValue", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label><span className="label">Minimum acceptable · optional</span><input className="field" type="number" step="any" value={data.minimumThreshold === undefined ? "" : String(data.minimumThreshold)} onChange={(event) => update("minimumThreshold", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label><span className="label">Maximum acceptable · optional</span><input className="field" type="number" step="any" value={data.maximumThreshold === undefined ? "" : String(data.maximumThreshold)} onChange={(event) => update("maximumThreshold", event.target.value === "" ? undefined : Number(event.target.value))} /></label></div>;
  }
  if (question.inputKind === "number") return <label><span className="label">Global KPI weight</span><input className="field max-w-xs" type="number" min="0" step="any" value={String(value ?? "")} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} /></label>;
  if (question.inputKind === "namedItems") {
    const items = Array.isArray(value) ? value as Array<{ id?: string; name?: string; description?: string }> : [];
    const update = (index: number, key: "name" | "description", next: string) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: next } : item));
    return <div><div className="space-y-3">{items.map((item, index) => <div className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_1.5fr_auto]" key={item.id ?? index}><label><span className="label">Alternative name</span><input className="field" value={item.name ?? ""} onChange={(event) => update(index, "name", event.target.value)} /></label><label><span className="label">What makes it distinct?</span><input className="field" value={item.description ?? ""} onChange={(event) => update(index, "description", event.target.value)} /></label><button className="btn self-end" aria-label={`Remove alternative ${index + 1}`} disabled={items.length <= 2} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div><button className="btn mt-3" onClick={() => onChange([...items, { id: crypto.randomUUID(), name: "", description: "" }])}>Add alternative</button></div>;
  }
  if (question.inputKind === "rootFeature") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Configurable family name</span><input className="field" value={String(data.name ?? "")} onChange={(event) => update("name", event.target.value)} /></label><label><span className="label">Short description</span><input className="field" value={String(data.description ?? "")} onChange={(event) => update("description", event.target.value)} /></label></div>;
  }
  if (question.inputKind === "axisDefinition") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Choice rule</span><select className="field" value={String(data.mode ?? "xor")} onChange={(event) => update("mode", event.target.value)}><option value="xor">Exactly one choice</option><option value="or">One or more choices</option><option value="optional">Independent optional choices</option><option value="typed">One value from a list</option></select></label><label><span className="label">Choices · separate with semicolons</span><textarea className="field min-h-24" value={String(data.choices ?? "")} onChange={(event) => update("choices", event.target.value)} /></label></div>;
  }
  if (question.inputKind === "constraintList") {
    const rows = Array.isArray(value) ? value as Array<{ id?: string; type?: string; sourceFeatureId?: string; targetFeatureId?: string }> : [], options = question.options ?? [];
    const update = (index: number, patch: Record<string, unknown>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    return <div><div className="space-y-3">{rows.map((row, index) => <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_150px_1fr_auto]" key={row.id ?? index}><select className="field" aria-label="Source choice" value={row.sourceFeatureId ?? ""} onChange={(event) => update(index, { sourceFeatureId: event.target.value })}><option value="">Source choice…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><select className="field" aria-label="Constraint type" value={row.type ?? "requires"} onChange={(event) => update(index, { type: event.target.value })}><option value="requires">requires</option><option value="excludes">excludes</option></select><select className="field" aria-label="Target choice" value={row.targetFeatureId ?? ""} onChange={(event) => update(index, { targetFeatureId: event.target.value })}><option value="">Target choice…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><button className="btn" aria-label={`Remove constraint ${index + 1}`} onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>)}</div><button className="btn mt-3" onClick={() => onChange([...rows, { id: crypto.randomUUID(), type: "requires", sourceFeatureId: "", targetFeatureId: "" }])}>Add rule</button>{!rows.length && <p className="mt-3 text-sm text-slate-500">No cross-feature constraint is currently defined.</p>}</div>;
  }
  if (question.inputKind === "elementApplicability") {
    const rows = Array.isArray(value) ? value as Array<{ elementId?: string; featureId?: string }> : [], features = project.features.filter((feature) => feature.featureType !== "root"), elements = question.options ?? [];
    const update = (index: number, patch: Record<string, string>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    return <div><div className="space-y-3">{rows.map((row, index) => <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]" key={index}><select className="field" value={row.elementId ?? ""} onChange={(event) => update(index, { elementId: event.target.value })}><option value="">Model element…</option>{elements.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.detail}</option>)}</select><select className="field" value={row.featureId ?? ""} onChange={(event) => update(index, { featureId: event.target.value })}><option value="">Present when…</option>{features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select><button className="btn" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>)}</div><button className="btn mt-3" onClick={() => onChange([...rows, { elementId: "", featureId: "" }])}>Map variable element</button>{!rows.length && <p className="mt-3 text-sm text-slate-500">All model elements currently remain common to every alternative.</p>}</div>;
  }
  if (question.inputKind === "propertyVariation") {
    const rows = Array.isArray(value) ? value as Array<{ elementId?: string; parameterId?: string; featureId?: string; value?: unknown; scope?: string }> : [], owners = project.elements.filter((element) => element.parameters.length), features = project.features.filter((feature) => feature.featureType !== "root");
    const update = (index: number, patch: Record<string, unknown>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    return <div><div className="space-y-3">{rows.map((row, index) => { const owner = owners.find((element) => element.id === row.elementId); return <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_120px_140px_auto]" key={index}><select className="field" value={row.elementId ?? ""} onChange={(event) => update(index, { elementId: event.target.value, parameterId: "" })}><option value="">Element…</option>{owners.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}</select><select className="field" value={row.parameterId ?? ""} onChange={(event) => update(index, { parameterId: event.target.value })}><option value="">Parameter…</option>{owner?.parameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.name} ({parameter.unit})</option>)}</select><select className="field" value={row.featureId ?? ""} onChange={(event) => update(index, { featureId: event.target.value })}><option value="">When feature…</option>{features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select><input className="field" aria-label="Variant value" placeholder="Value" value={String(row.value ?? "")} onChange={(event) => update(index, { value: event.target.value })} /><select className="field" value={row.scope ?? "structure"} onChange={(event) => update(index, { scope: event.target.value })}>{["requirements", "structure", "behavior", "process", "resources", "verification"].map((scope) => <option key={scope}>{scope}</option>)}</select><button className="btn" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>; })}</div><button className="btn mt-3" onClick={() => onChange([...rows, { elementId: "", parameterId: "", featureId: "", value: "", scope: "structure" }])}>Map parameter value</button>{!rows.length && <p className="mt-3 text-sm text-slate-500">No feature-dependent parameter values are currently defined.</p>}</div>;
  }
  if (question.inputKind === "configuration") {
    const data = value && typeof value === "object" ? value as { name?: string; selectedFeatureIds?: string[]; automaticConstraintFeatureIds?: string[]; featureValues?: Record<string, string | number | boolean> } : {};
    const selected = data.selectedFeatureIds ?? [], automatic = data.automaticConstraintFeatureIds ?? [], values = data.featureValues ?? {}, selectable = project.features.filter((feature) => feature.featureType !== "root" && feature.featureType !== "mandatory");
    const setSelected = (feature: Project["features"][number], checked: boolean) => {
      const withoutPeer = checked && feature.featureType === "xor" && feature.groupId
        ? selected.filter((id) => project.features.find((candidate) => candidate.id === id)?.groupId !== feature.groupId)
        : selected;
      onChange({ ...data, selectedFeatureIds: checked ? [...new Set([...withoutPeer, feature.id])] : selected.filter((id) => id !== feature.id) });
    };
    return <div><label><span className="label">Alternative name</span><input className="field max-w-xl" value={data.name ?? ""} onChange={(event) => onChange({ ...data, name: event.target.value })} /></label><div className="mt-5 space-y-2"><div className="label">Feature choices</div>{project.features.filter((feature) => feature.featureType === "mandatory").map((feature) => <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3" key={feature.id}><input type="checkbox" checked disabled /><span className="font-medium">{feature.name}</span><span className="ml-auto text-xs text-slate-500">Common</span></div>)}{selectable.map((feature) => { const checked = selected.includes(feature.id) || automatic.includes(feature.id); return <div className="rounded-lg border border-slate-200 p-3" key={feature.id}><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={checked} disabled={automatic.includes(feature.id)} onChange={(event) => setSelected(feature, event.target.checked)} /><span className="font-medium">{feature.name}</span><span className="ml-auto text-xs text-slate-500">{automatic.includes(feature.id) ? "Required automatically" : feature.featureType === "xor" ? "Choose one in this group" : feature.featureType}</span></label>{checked && feature.valueType === "enumeration" && <label className="mt-3 block"><span className="label">Selected value</span><select className="field max-w-sm" value={String(values[feature.id] ?? feature.defaultValue ?? "")} onChange={(event) => onChange({ ...data, featureValues: { ...values, [feature.id]: event.target.value } })}>{feature.allowedValues?.map((allowed) => <option key={allowed}>{allowed}</option>)}</select></label>}</div>; })}</div></div>;
  }
  if (question.inputKind === "derivation") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, configuration = project.configurations.find((candidate) => candidate.id === question.instanceKey), errors = Array.isArray(data.errors) ? data.errors.map(String) : [];
    return <div><div className="grid gap-3 sm:grid-cols-3"><SummaryMetric label="Configuration" value={configuration?.name ?? "Missing"} /><SummaryMetric label="Validation" value={configuration?.validationStatus ?? "Unknown"} /><SummaryMetric label="Selected features" value={String(configuration?.effectiveSelectedFeatureIds.length ?? 0)} /></div><label className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={data.execute === true} onChange={(event) => onChange({ execute: event.target.checked, errors: undefined })} /><span><strong className="block">Create the 100% architecture</strong><span className="mt-1 block text-sm text-slate-600">The derivation applies the selected feature choices and records included, excluded and modified model content.</span></span></label>{errors.length > 0 && <ErrorList title="Derivation could not be completed" errors={errors} />}</div>;
  }
  if (question.inputKind === "configurationRecap") {
    const configuration = project.configurations.find((candidate) => candidate.id === question.instanceKey), derivation = configuration?.derivation, valid = configuration?.validationStatus === "valid", canConfirm = valid && (question.id === "AV-K03" || Boolean(derivation));
    return <div><div className="grid gap-3 sm:grid-cols-4"><SummaryMetric label="Validation" value={configuration?.validationStatus ?? "Missing"} /><SummaryMetric label="Selected" value={String(configuration?.effectiveSelectedFeatureIds.length ?? 0)} /><SummaryMetric label="Included elements" value={String(derivation?.includedElementIds.length ?? configuration?.derivedElementIds.length ?? 0)} /><SummaryMetric label="Excluded elements" value={String(derivation?.excludedElementIds.length ?? configuration?.excludedElementIds.length ?? 0)} /></div>{configuration && <ConfigurationReadiness project={project} configuration={configuration} />}{configuration?.validationMessages.length ? <ErrorList title="Configuration findings" errors={configuration.validationMessages} /> : null}<ConfirmEvidence checked={value === true} disabled={!canConfirm} label={question.id === "AV-K03" ? "I confirm that this configuration is valid" : "I reviewed this realized 100% architecture"} onChange={onChange} /></div>;
  }
  if (question.inputKind === "comparisonSetting") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">Preferred result</span><select className="field" value={String(data.optimizationDirection ?? "minimize")} onChange={(event) => update("optimizationDirection", event.target.value)}><option value="minimize">Lower is better</option><option value="maximize">Higher is better</option></select></label><label><span className="label">Minimum · optional</span><input className="field" type="number" step="any" value={data.minimum === undefined ? "" : String(data.minimum)} onChange={(event) => update("minimum", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label><span className="label">Maximum · optional</span><input className="field" type="number" step="any" value={data.maximum === undefined ? "" : String(data.maximum)} onChange={(event) => update("maximum", event.target.value === "" ? undefined : Number(event.target.value))} /></label><label><span className="label">Limit behavior</span><select className="field" value={String(data.thresholdMode ?? "warning")} onChange={(event) => update("thresholdMode", event.target.value)}><option value="warning">Warn only</option><option value="hard">Exclude alternative</option></select></label></div>;
  }
  if (question.inputKind === "comparisonRun") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, errors = Array.isArray(data.errors) ? data.errors.map(String) : [], study = project.comparisonStudies.find((candidate) => candidate.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0];
    return <div><div className="grid gap-3 sm:grid-cols-3"><SummaryMetric label="Alternatives" value={String(study?.alternativeRefs.length ?? 0)} /><SummaryMetric label="Mandatory requirements" value={String(study?.mandatoryRequirementIds.length ?? 0)} /><SummaryMetric label="Decision KPIs" value={String(study?.selectedKpiIds.length ?? 0)} /></div><label className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={data.execute === true} onChange={(event) => onChange({ execute: event.target.checked, errors: undefined })} /><span><strong className="block">Calculate the comparison</strong><span className="mt-1 block text-sm text-slate-600">Feasibility is checked before the weighted KPI score. The stored result keeps the exact run and setting references.</span></span></label>{errors.length > 0 && <ErrorList title="Comparison could not be completed" errors={errors} />}</div>;
  }
  if (question.inputKind === "comparisonRecap") {
    const study = project.comparisonStudies.find((candidate) => candidate.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0], result = study?.results.at(-1);
    return <div>{result && study ? <div className="overflow-x-auto"><table><thead><tr><th>Alternative</th><th>Feasibility</th><th>Weighted score</th><th>Result</th></tr></thead><tbody>{study.alternativeRefs.map((alternative) => { const score = result.weightedScores[alternative.id]; return <tr key={alternative.id}><td>{alternative.label}</td><td>{result.feasibility?.[alternative.id]?.status ?? "unknown"}</td><td>{score === null || score === undefined ? "—" : score.toFixed(3)}</td><td>{result.recommendedAlternativeIds?.includes(alternative.id) ? "Calculated leader" : "—"}</td></tr>; })}</tbody></table>{result.warnings.length > 0 && <ErrorList title="Comparison notes" errors={result.warnings} />}</div> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No current comparison result is available.</p>}<ConfirmEvidence checked={value === true} disabled={!result} label="I reviewed the feasibility and trade-off results" onChange={onChange} /></div>;
  }
  if (question.inputKind === "decisionDetails") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, update = (key: string, next: unknown) => onChange({ ...data, [key]: next });
    return <div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="label">Engineering rationale</span><textarea className="field min-h-28" value={String(data.rationale ?? "")} onChange={(event) => update("rationale", event.target.value)} /></label><label><span className="label">Decision owner</span><input className="field" value={String(data.owner ?? "")} onChange={(event) => update("owner", event.target.value)} /></label><label><span className="label">Decision date</span><input className="field" type="date" value={String(data.decisionDate ?? "")} onChange={(event) => update("decisionDate", event.target.value)} /></label><label><span className="label">Status</span><select className="field" value={String(data.status ?? "proposed")} onChange={(event) => update("status", event.target.value)}><option value="proposed">Proposed for review</option><option value="approved">Approved baseline</option></select></label><label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4"><input className="mt-1" type="checkbox" checked={data.baselineApprovalConfirmed === true} onChange={(event) => update("baselineApprovalConfirmed", event.target.checked)} /><span><strong className="block">Confirm baseline approval</strong><span className="mt-1 block text-sm text-slate-600">Required only when status is Approved baseline.</span></span></label></div>;
  }
  if (question.inputKind === "finalRecap") {
    const requirements = project.elements.filter((element) => element.elementType === "systemRequirement");
    const requirementStatus = requirements.reduce<Record<string, number>>((counts, requirement) => {
      const status = requirementSatisfaction(project, requirement).status;
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, { satisfied: 0, failed: 0, pending: 0 });
    const study = project.comparisonStudies.find((candidate) => candidate.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0];
    const result = study?.results.at(-1);
    const decision = project.decisions.find((candidate) => candidate.supportingComparisonStudyIds.includes(study?.id ?? ""));
    const run = [...project.simulationRuns].reverse().find((candidate) => candidate.projectModelRevisionAtRun >= project.modelRevision) ?? project.simulationRuns.at(-1);
    const stakeholderCount = project.elements.filter((element) => element.elementType === "stakeholder").length;
    const needCount = project.elements.filter((element) => ["need", "objective"].includes(element.elementType)).length;
    const functionCount = project.elements.filter((element) => ["productFunction", "processFunction"].includes(element.elementType)).length;
    const componentCount = project.elements.filter((element) => ["productComponent", "industrialSystemComponent"].includes(element.elementType)).length;
    let content: React.ReactNode;
    if (question.id === "AV-M02") content = <><strong>{stakeholderCount} stakeholders and {needCount} needs or objectives are represented.</strong><span>{requirements.length} quantitative requirements connect stakeholder intent to functions, components or their parameters.</span></>;
    else if (question.id === "AV-M03") content = <><strong>{functionCount} functions and {componentCount} technical components describe the solution.</strong><span>Product behavior, industrial behavior, product flows and required resources remain available in the detailed model.</span></>;
    else if (question.id === "AV-M04") content = <><strong>{requirementStatus.satisfied} satisfied · {requirementStatus.failed} failed</strong><span>{requirementStatus.pending} pending. Failed or pending requirements identify missing satisfaction links, values or verification evidence.</span></>;
    else if (question.id === "AV-M05") content = run ? <><strong>{run.name} contains {run.results.length} KPI results.</strong><span>{run.warnings.length} warnings are retained with the run evidence.</span></> : <><strong>No current simulation evidence is available.</strong><span>Complete the engineering inputs and simulation questions before relying on a calculated result.</span></>;
    else content = <><strong>{decision?.selectedAlternative ? `${decision.selectedAlternative} is ${decision.status}.` : "No baseline decision has been recorded."}</strong><span>{study?.alternativeRefs.length ?? 0} alternatives, {study?.selectedKpiIds.length ?? 0} KPIs and {result?.warnings.length ?? 0} comparison notes are recorded.</span></>;
    return <div><div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">{content}</div><SectionEntityDetails project={project} sectionId={question.sectionId} /><ConfirmEvidence checked={value === true} label="I confirm that this concise overview is accurate" onChange={onChange} /></div>;
  }
  if (question.inputKind === "simulationRun") {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {}, errors = Array.isArray(data.errors) ? data.errors.map(String) : [], batch = question.id === "AV-S03";
    return <div><label><span className="label">{batch ? "Run series name" : "Run name"}</span><input className="field" value={String(data.name ?? "")} onChange={(event) => onChange({ ...data, name: event.target.value, execute: true, errors: undefined })} /></label><label className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={data.execute === true} onChange={(event) => onChange({ ...data, execute: event.target.checked, errors: undefined })} /><span><strong className="block">{batch ? "Run every derived alternative when I continue" : "Run the analysis when I continue"}</strong><span className="mt-1 block text-sm text-slate-600">{batch ? "One immutable configured run will be stored for each current 100% architecture using the same KPI set." : "A successful run stores an immutable snapshot of inputs, formulas, results and sources."}</span></span></label>{errors.length > 0 && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Analysis could not be stored.</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}</div>;
  }
  if (question.inputKind === "simulationRecap") {
    if (question.sectionId === "tradeSimulation") {
      const study = project.comparisonStudies.find((candidate) => candidate.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0];
      const selectedKpiIds = Array.isArray(project.architectSession?.answers["AV-I01"]?.value) ? project.architectSession.answers["AV-I01"].value.map(String) : [];
      const entries = (study?.candidateRefs ?? []).map((candidate) => {
        const configuration = project.configurations.find((item) => item.id === candidate.configurationId);
        const run = [...project.simulationRuns].reverse().find((item) => item.configurationId === configuration?.id && item.derivationId === configuration?.derivation?.id && simulationStatus(project, item) === "Current");
        return { candidate, configuration, run };
      });
      const complete = entries.length >= 2 && selectedKpiIds.length > 0 && entries.every(({ run }) => run && selectedKpiIds.every((kpiId) => run.results.some((result) => result.kpiId === kpiId && typeof result.value === "number" && Number.isFinite(result.value))));
      const warningCount = entries.reduce((count, { run }) => count + (run?.warnings.length ?? 0), 0);
      return <div><div className="grid gap-3 sm:grid-cols-3"><SummaryMetric label="Alternatives with evidence" value={`${entries.filter(({ run }) => run).length}/${entries.length}`} /><SummaryMetric label="Common KPI set" value={String(selectedKpiIds.length)} /><SummaryMetric label="Warnings" value={String(warningCount)} /></div><div className="mt-4 overflow-x-auto"><table><thead><tr><th>Alternative</th><th>KPI</th><th>Value</th><th>Sources</th><th>Status</th></tr></thead><tbody>{entries.flatMap(({ candidate, run }) => selectedKpiIds.length ? selectedKpiIds.map((kpiId) => { const result = run?.results.find((item) => item.kpiId === kpiId), kpi = project.kpis.find((item) => item.id === kpiId); return <tr key={`${candidate.id}-${kpiId}`}><td>{candidate.label}</td><td>{kpi?.name ?? kpiId}</td><td>{result && typeof result.value === "number" ? `${result.value} ${result.unit}` : "Not available"}</td><td>{result?.inputSources.length ?? 0}</td><td>{run && result && typeof result.value === "number" ? "Current" : "Missing evidence"}</td></tr>; }) : [<tr key={candidate.id}><td>{candidate.label}</td><td colSpan={4}>No KPI set selected</td></tr>])}</tbody></table></div>{!complete && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Comparable evidence is incomplete. Return to configuration derivation or the batch simulation question and resolve the missing KPI results.</p>}<ConfirmEvidence checked={value === true} disabled={!complete} label="I reviewed comparable evidence for every alternative" onChange={onChange} /></div>;
    }
    const run = [...project.simulationRuns].reverse().find((candidate) => candidate.projectModelRevisionAtRun >= project.modelRevision);
    return <div>{run ? <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">Run</div><div className="mt-1 font-bold">{run.name}</div></div><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">KPI results</div><div className="mt-1 font-bold">{run.results.length}</div></div><div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">Warnings</div><div className="mt-1 font-bold">{run.warnings.length}</div></div></div><div className="mt-4 overflow-x-auto"><table><thead><tr><th>Result</th><th>Value</th><th>Sources</th></tr></thead><tbody>{run.results.map((result) => <tr key={result.id}><td>{result.name}</td><td>{result.value === null ? "Not available" : `${result.value} ${result.unit}`}</td><td>{result.inputSources.length}</td></tr>)}</tbody></table></div></> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No successful current simulation is available. Return to the previous question and resolve the reported inputs.</p>}<label className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={value === true} disabled={!run} onChange={(event) => onChange(event.target.checked)} /><span className="text-sm font-semibold">I reviewed this current simulation evidence</span></label></div>;
  }
  if (question.id === "AV-L02") {
    const study = project.comparisonStudies.find((item) => item.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0];
    return <div><p className="mb-3 text-sm">Reference baseline: {project.architectures.find((item) => item.id === study?.referenceArchitectureId)?.name ?? "Not selected"}. {study ? baselineRequirementIds(project, study).length : 0} established requirements remain obligations, independent of study focus.</p><StakeholderTraceabilityRecap embedded /><ConfirmEvidence checked={value === true} label="I reviewed the retained baseline obligations" onChange={onChange} /></div>;
  }
  if (question.id === "AV-H04") return <div><StakeholderTraceabilityRecap embedded /><ConfirmEvidence checked={value === true} label="I reviewed this architecture recap" onChange={onChange} /></div>;
  if (question.inputKind === "recap" && question.sectionId === "tradeFraming") {
    const study = project.comparisonStudies.find((candidate) => candidate.id === project.activeComparisonStudyId) ?? project.comparisonStudies[0], alternatives = Array.isArray(project.architectSession?.answers["AV-T05"]?.value) ? project.architectSession?.answers["AV-T05"]?.value as Array<{ name?: string }> : [];
    return <div><div className="space-y-3"><div><span className="label">Decision question</span><p className="font-semibold">{study?.question || "Not defined"}</p></div><div className="grid gap-3 sm:grid-cols-3"><SummaryMetric label="Common characteristics" value={String(String(project.architectSession?.answers["AV-T03"]?.value ?? "").split(";").filter(Boolean).length)} /><SummaryMetric label="Variation axes" value={String(String(project.architectSession?.answers["AV-T04"]?.value ?? "").split(";").filter(Boolean).length)} /><SummaryMetric label="Alternative concepts" value={String(alternatives.filter((alternative) => alternative.name?.trim()).length)} /></div></div><SectionEntityDetails project={project} sectionId={question.sectionId} /><ConfirmEvidence checked={value === true} label="I reviewed this trade-off framing" onChange={onChange} /></div>;
  }
  if (question.inputKind === "recap" && question.sectionId === "variability") {
    return <div><div className="grid gap-3 sm:grid-cols-4"><SummaryMetric label="Features" value={String(project.features.length)} /><SummaryMetric label="Variation axes" value={String(project.variabilityAxes.length)} /><SummaryMetric label="Constraints" value={String(project.featureConstraints.length)} /><SummaryMetric label="Variation points" value={String(project.variationPoints.length)} /></div><SectionEntityDetails project={project} sectionId={question.sectionId} /><ConfirmEvidence checked={value === true} label="I reviewed the complete 150% family model" onChange={onChange} /></div>;
  }
  const counts = {
    stakeholders: project.elements.filter((element) => element.elementType === "stakeholder").length,
    requirements: project.elements.filter((element) => element.elementType === "systemRequirement").length,
    functions: project.elements.filter((element) => ["productFunction", "processFunction"].includes(element.elementType)).length,
    components: project.elements.filter((element) => ["productComponent", "industrialSystemComponent"].includes(element.elementType)).length,
    traces: project.relationships.length
  };
  return <div><div className="grid gap-3 sm:grid-cols-5">{Object.entries(counts).map(([label, count]) => <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={label}><div className="text-xs font-semibold capitalize text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{count}</div></div>)}</div><SectionEntityDetails project={project} sectionId={question.sectionId} /><label className="mt-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /><span><strong className="block">I reviewed this architecture recap</strong><span className="mt-1 block text-sm text-slate-600">Blocking validation findings still prevent Ready status.</span></span></label></div>;
}

function SectionEntityDetails({ project, sectionId }: { project: Project; sectionId: string }) {
  const typesBySection: Record<string, string[]> = {
    intent: ["mission", "stakeholder", "need", "objective"], scope: ["useCase", "need"], requirements: ["systemRequirement"],
    productBehavior: ["useCase", "productFunction"], productStructure: ["productFunction", "productComponent", "productInterface"],
    industrialBehavior: ["useCase", "processFunction"], industrialStructure: ["processFunction", "industrialSystemComponent", "resource", "processInterface", "productComponent"],
    traceability: ["systemRequirement", "verificationMethod", "productFunction", "productComponent", "processFunction", "industrialSystemComponent"],
    analysis: ["productFunction", "productComponent", "processFunction", "industrialSystemComponent"], final: project.elements.map((element) => element.elementType)
  };
  if (sectionId === "tradeFraming") {
    const common = String(project.architectSession?.answers["AV-T03"]?.value ?? "").split(";").map((item) => item.trim()).filter(Boolean), axes = String(project.architectSession?.answers["AV-T04"]?.value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
    return <details className="mt-4 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Show the actual entries</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><EntityList title="Common content" names={common} /><EntityList title="Variation axes" names={axes} /></div></details>;
  }
  if (sectionId === "variability") return <details className="mt-4 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Show the actual feature-model entries</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><EntityList title="Features" names={project.features.map((item) => item.name)} /><EntityList title="Variation axes" names={project.variabilityAxes.map((item) => item.name)} /></div></details>;
  const allowed = new Set(typesBySection[sectionId] ?? []), groups = [...new Set(project.elements.filter((element) => allowed.has(element.elementType)).map((element) => element.elementType))];
  if (!groups.length) return null;
  return <details className="mt-4 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Show the actual entities in this section</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{groups.map((type) => <EntityList key={type} title={type.replace(/([A-Z])/g, " $1")} names={project.elements.filter((element) => element.elementType === type).map((element) => element.name)} />)}</div></details>;
}

function EntityList({ title, names }: { title: string; names: string[] }) {
  return <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>{names.length ? <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{names.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul> : <p className="mt-1 text-sm text-slate-500">None</p>}</div>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-1 font-bold">{value}</div></div>;
}

function ErrorList({ title, errors }: { title: string; errors: string[] }) {
  return <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{title}</strong><ul className="mt-2 list-disc pl-5">{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>;
}

function ConfirmEvidence({ checked, disabled = false, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (value: unknown) => void }) {
  return <label className="mt-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4"><input className="mt-1" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="text-sm font-semibold">{label}</span></label>;
}

function scopeName(scope?: string) {
  if (scope === "architectureAndSimulation") return "Architecture and simulation";
  if (scope === "tradeStudy") return "Trade-off study";
  return "Architecture definition";
}

function architectInputExample(question: ArchitectQuestion) {
  const examples: Partial<Record<ArchitectQuestion["inputKind"], string>> = {
    scope: "Choose Trade-off when you need to compare several feasible architectures and select a baseline.",
    text: "Coffee Machine Product-Line Study",
    textarea: "Provide personalized beverages safely while reducing maintenance effort.",
    semicolon: "First entry; Second entry; Third entry",
    single: "Select the one option that best represents the current model decision.",
    multi: "Select every applicable item; leave unrelated items unchecked.",
    flow: "Select Water tank, quantity 1, unit item, flow name Filled water tank.",
    recap: "Expand the entity list, check the actual entries, then confirm the section.",
    existingAndNew: "Reuse Beverage preparation requirement and add Cleaning shall finish within 5 min.",
    quantitative: "Measured property Mass; key mass; operator <=; target 20; unit kg.",
    propertySource: "Choose Product component, then select Housing as the authoritative owner.",
    engineeringValue: "Value 12; unit kg; origin calculated; source CAD mass properties; uncertainty 3%.",
    analysisInput: "Select Housing and Brewing module, then enter each mass and its engineering source.",
    verification: "Category test; method Beverage preparation time test; describe the measured acceptance procedure.",
    sequence: "Move Heat water before Brew coffee when that is the required execution order.",
    duration: "Duration 2.5; unit minute; origin entered; source production time study.",
    resourceDetail: "Quantity 2 people; rate 55 EUR/h; availability 85%.",
    interaction: "Counterpart Controller; interface Control commands; exchanged item status and commands.",
    kpiReview: "Review the listed inputs and warnings, then check the confirmation box.",
    kpiFormula: "sum(param(\"housing-mass-id\"), param(\"brewing-module-mass-id\"))",
    kpiDefinition: "Output kg; lower is better; target 20; maximum acceptable 25.",
    number: "Use 2 for a KPI that should count twice as much as a KPI weighted 1.",
    simulationRun: "Coffee-machine baseline evidence run",
    simulationRecap: "Check the result values, sources and warnings before confirming the evidence.",
    namedItems: "Manual-assisted concept — simpler equipment; Automatic concept — automated preparation.",
    rootFeature: "Coffee-machine product family — complete configurable 150% family.",
    axisDefinition: "Brewing approach; exactly one choice; Manual brew; Automatic brew.",
    constraintList: "Automatic brew requires Electronic controller.",
    elementApplicability: "Milk module is present when Milk capability is selected.",
    propertyVariation: "Boiler power is 1.8 kW when Fast heating is selected.",
    configuration: "Office compact variant with Compact housing and Automatic brew selected.",
    derivation: "Confirm creation of the current 100% Office compact architecture.",
    configurationRecap: "Review selected features and included or excluded model elements.",
    comparisonSetting: "Lower is better; maximum 25 kg; hard limit.",
    comparisonRun: "Confirm calculation after every alternative has current comparable evidence.",
    comparisonRecap: "Check feasibility first, then weighted score and warnings.",
    decisionDetails: "Approve Automatic concept because it meets all mandatory requirements with the best current evidence.",
    finalRecap: "Expand the entity list and confirm that the concise statement matches the detailed model."
  };
  return examples[question.inputKind] ?? "Enter the requested information using the current project terminology.";
}

function architectGeneratedCount(answer?: ArchitectAnswer) {
  return (answer?.generatedElementIds.length ?? 0) + (answer?.generatedRelationshipIds.length ?? 0) + (answer?.generatedParameterIds.length ?? 0)
    + (answer?.generatedFeatureIds?.length ?? 0) + (answer?.generatedVariationPointIds?.length ?? 0) + (answer?.generatedConfigurationIds?.length ?? 0)
    + (answer?.generatedStudyIds?.length ?? 0) + (answer?.generatedDecisionIds?.length ?? 0);
}
