import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Copy, GitCompare, Plus, Play, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  comparisonStatus,
  leadingAlternativeIds,
  normalizedWeightPercentages,
  validateComparisonStudy
} from "../domain/comparison";
import { calculateMaturity } from "../domain/maturity";
import { calculateTraceabilityMetrics } from "../domain/metrics";
import { simulationStatus } from "../domain/simulation";
import {
  managerReadyAlternatives,
  tradeStudyReadiness
} from "../domain/tradeStudy";
import type {
  ComparisonRisk, ComparisonStudy, ComparisonThreshold, Decision, SimulationRun, UiPreferences
} from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import {
  GuidedTradeStudyWorkflow,
  TradeStudyCandidates,
  TradeStudyFraming
} from "./TradeStudyPanels";
import { TradeStudyOntologyView } from "./TradeStudyOntologyView";
import { useDialogs } from "./dialogs/DialogProvider";
import {
  ExpertTradeStudyEvidence,
  ManagerTradeStudySummary,
  RiskMatrix,
  RobustnessPanel
} from "./TradeStudyMethodologyViews";

const tabs = [
  "Manager Summary", "Guided Workflow", "Framing and Criteria", "Candidates and Readiness",
  "Side-by-Side", "KPI Table", "Charts", "Uncertainty and Risks",
  "Sensitivity", "Robustness", "Expert Evidence", "Decision Rationale", "Digital Thread"
] as const;

const palette = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];
const format = (value: number | null | undefined, unit = "") =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${unit ? ` ${unit}` : ""}` : "Missing";

export function ComparisonWorkspace() {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addStudy = useAppStore((state) => state.addComparisonStudy);
  const duplicateStudy = useAppStore((state) => state.duplicateComparisonStudy);
  const deleteStudy = useAppStore((state) => state.deleteComparisonStudy);
  const executeComparison = useAppStore((state) => state.executeComparison);
  const [studyId, setStudyId] = useState(project.comparisonStudies[0]?.id ?? "");
  const tab = useAppStore((state) => state.uiPreferences.activeTradeStudyTab);
  const setTab = useAppStore((state) => state.setTradeStudyTab);
  const view = useAppStore((state) => state.uiPreferences.tradeStudyView);
  const setView = useAppStore((state) => state.setTradeStudyView);
  const [resultId, setResultId] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const study = project.comparisonStudies.find((candidate) => candidate.id === studyId) ?? project.comparisonStudies[0];
  const result = study?.results.find((candidate) => candidate.id === resultId) ?? study?.results.at(-1);

  useEffect(() => {
    if (!studyId && project.comparisonStudies[0]) setStudyId(project.comparisonStudies[0].id);
  }, [project.comparisonStudies, studyId]);
  useEffect(() => setResultId(study?.results.at(-1)?.id ?? ""), [study?.id, study?.results.length]);

  const create = () => {
    const now = new Date().toISOString();
    const originatingOpenDecision = project.openDecisions.find((decision) => decision.status !== "closed");
    const next: ComparisonStudy = {
      id: `comparison-${crypto.randomUUID()}`,
      name: "New Trade Study",
      description: "",
      question: originatingOpenDecision?.question ?? "",
      intendedOutcome: "Select a justified architecture and establish its baseline.",
      lifecycleScope: "",
      systemScope: "",
      status: "framing",
      originatingOpenDecisionId: originatingOpenDecision?.id,
      objectiveIds: [],
      mandatoryRequirementIds: [],
      exploredFeatureIds: [],
      criteria: [],
      candidateRefs: [],
      alternativeRefs: [],
      selectedKpiIds: [],
      kpiSettings: {},
      createdAt: now,
      updatedAt: now,
      settingsUpdatedAt: now,
      results: [],
      scenarios: [],
      robustnessResults: [],
      feasibilityExceptions: {}
    };
    addStudy(next);
    setStudyId(next.id);
    setTab("Framing and Criteria");
  };
  const run = () => {
    if (!study) return;
    if (view === "manager") {
      const ready = managerReadyAlternatives(project, study);
      if (ready.length < 2 || ready.length !== study.alternativeRefs.length) {
        setMessages(["Manager workflow requires at least two Ready configured 100% alternatives and excludes architecture-only or blocked evidence. Resolve readiness or switch to Expert view for diagnostic analysis."]);
        setTab("Candidates and Readiness");
        return;
      }
    }
    const outcome = executeComparison(study.id);
    setMessages([...outcome.errors, ...outcome.warnings]);
    if (!outcome.errors.length) setTab("Side-by-Side");
  };

  return <div className="space-y-4">
    <header className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3"><h1 className="text-3xl font-bold">Architecture Trade Study</h1><span className="badge bg-purple-50 text-purple-700">Methodology</span></div>
        <p className="mt-1 text-slate-600">Frame an unresolved decision, create traceable 100% architecture candidates, compare evidence, and establish a baseline explicitly.</p>
      </div>
      <div className="flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Trade Study audience view">{(["manager", "expert"] as const).map((item) => <button key={item} className={`rounded-md px-3 py-2 text-sm font-semibold ${view === item ? "bg-blue-600 text-white" : "text-slate-600"}`} onClick={() => setView(item)}>{item === "manager" ? "Manager view" : "Expert view"}</button>)}</div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Preliminary engineering estimate — not a verified detailed-design result.
      </div>
    </header>
    <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
      <aside className="card h-fit p-4">
        <div className="flex items-center justify-between"><h2 className="font-bold">Trade Studies</h2><button className="btn" onClick={create}><Plus size={14} /> New</button></div>
        <div className="mt-3 space-y-2">{project.comparisonStudies.map((candidate) => {
          const latest = candidate.results.at(-1);
          return <button key={candidate.id} onClick={() => setStudyId(candidate.id)} className={`w-full rounded-lg border p-3 text-left ${study?.id === candidate.id ? "border-purple-300 bg-purple-50" : "border-slate-200"}`}>
            <strong className="block text-sm">{candidate.name}</strong>
            <span className="text-xs text-slate-500">{candidate.candidateRefs.length} candidates · {candidate.results.length} saved analysis result(s)</span>
            {latest && <span className={`badge mt-2 ${comparisonStatus(project, candidate, latest) === "Stale" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>{comparisonStatus(project, candidate, latest)}</span>}
          </button>;
        })}</div>
        {!project.comparisonStudies.length && <p className="mt-4 text-sm text-slate-500">Create a Trade Study to begin.</p>}
        {study && <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn" onClick={() => duplicateStudy(study.id)}><Copy size={14} /> Duplicate</button>
          <button className="btn btn-danger" onClick={async () => {
            if (!(await confirm(`Delete "${study.name}" and its risks?`, { confirmLabel: "Delete", tone: "danger" }))) return;
            const error = deleteStudy(study.id);
            if (error) setMessages([error]);
            else setStudyId(project.comparisonStudies.find((candidate) => candidate.id !== study.id)?.id ?? "");
          }}><Trash2 size={14} /> Delete</button>
        </div>}
      </aside>
      <main className="min-w-0 space-y-4">
        {study ? <>
          <section className="card p-4">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Architecture Trade Study sections">
              {tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>{item}</button>)}
              <button className="btn btn-primary ml-auto" onClick={run}><Play size={14} /> Analyze Trade Study</button>
            </div>
            {study.results.length > 0 && <label className="mt-3 block max-w-xl"><span className="label">Saved immutable result</span><select className="field" value={result?.id ?? ""} onChange={(event) => setResultId(event.target.value)}>
              {[...study.results].reverse().map((candidate) => <option key={candidate.id} value={candidate.id}>{new Date(candidate.timestamp).toLocaleString()} · {comparisonStatus(project, study, candidate)}</option>)}
            </select></label>}
          </section>
          {messages.length > 0 && <section aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ul className="list-disc pl-5">{messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul></section>}
          {tab === "Manager Summary" && <ManagerTradeStudySummary study={study} />}
          {tab === "Guided Workflow" && <GuidedTradeStudyWorkflow study={study} />}
          {tab === "Framing and Criteria" && <TradeStudyFraming study={study} />}
          {tab === "Candidates and Readiness" && <><TradeStudyCandidates study={study} /><StudySetup study={study} view={view} /></>}
          {tab === "Side-by-Side" && <SideBySide study={study} resultId={result?.id} />}
          {tab === "KPI Table" && <KpiTable study={study} resultId={result?.id} />}
          {tab === "Charts" && <ComparisonCharts study={study} resultId={result?.id} />}
          {tab === "Uncertainty and Risks" && <AssumptionsRisks study={study} />}
          {tab === "Sensitivity" && <Sensitivity study={study} />}
          {tab === "Robustness" && <RobustnessPanel study={study} />}
          {tab === "Expert Evidence" && (view === "expert"
            ? <ExpertTradeStudyEvidence study={study} />
            : <section className="card p-8 text-center"><h2 className="text-xl font-bold">Expert evidence is available in Expert view</h2><p className="mt-2 text-slate-600">Switch views to inspect formulas, immutable IDs, requirement evidence, value functions, Pareto dominance and risk lineage.</p><button className="btn btn-primary mt-4" onClick={() => setView("expert")}>Open Expert view</button></section>)}
          {tab === "Decision Rationale" && <DecisionLog study={study} />}
          {tab === "Digital Thread" && (view === "expert" ? <TradeStudyOntologyView study={study} /> : <section className="card p-8 text-center"><h2 className="text-xl font-bold">Digital thread is available in Expert view</h2><p className="mt-2 text-slate-600">Switch to Expert view to inspect the read-only ontology and exact relationship table.</p><button className="btn btn-primary mt-4" onClick={() => setView("expert")}>Open Expert view</button></section>)}
        </> : <section className="card grid min-h-[420px] place-items-center p-8 text-center"><div><GitCompare className="mx-auto text-slate-400" size={44} /><h2 className="mt-3 text-xl font-bold">No Trade Study</h2><p className="mt-2 text-slate-500">Create a Trade Study from the unresolved decision before defining candidates.</p><button className="btn btn-primary mt-4" onClick={create}><Plus size={14} /> Create Trade Study</button></div></section>}
      </main>
    </div>
  </div>;
}

function StudySetup({ study, view }: { study: ComparisonStudy; view: UiPreferences["tradeStudyView"] }) {
  const project = useAppStore(selectActiveProject)!;
  const update = useAppStore((state) => state.updateComparisonStudy);
  const [candidateRunId, setCandidateRunId] = useState("");
  const findings = validateComparisonStudy(project, study);
  const weights = normalizedWeightPercentages(study);
  const usedRunIds = new Set(study.alternativeRefs.map((alternative) => alternative.simulationRunId));
  const readyConfigurationIds = new Set(
    tradeStudyReadiness(project, study)
      .filter((item) => item.state === "Ready")
      .map((item) => item.configurationId)
  );
  const candidateConfigurationIds = new Set(study.candidateRefs.map((candidate) => candidate.configurationId));
  const unusedRuns = project.simulationRuns.filter((run) =>
    !usedRunIds.has(run.id)
    && (view === "expert"
      || Boolean(
        run.configurationId
        && candidateConfigurationIds.has(run.configurationId)
        && readyConfigurationIds.has(run.configurationId)
      ))
  );
  const patchStudy = (patch: Partial<ComparisonStudy>, calculationAffecting = true) => update(study.id, patch, calculationAffecting);
  const addAlternative = () => {
    const run = project.simulationRuns.find((candidate) => candidate.id === candidateRunId);
    if (!run || study.alternativeRefs.length >= 6) return;
    const configuration = project.configurations.find((candidate) => candidate.id === run.configurationId);
    const architecture = project.architectures.find((candidate) => candidate.id === run.architectureId);
    patchStudy({
      alternativeRefs: [...study.alternativeRefs, {
        id: `alternative-${crypto.randomUUID()}`,
        label: configuration?.name ?? architecture?.name ?? run.name,
        architectureId: run.architectureId,
        configurationId: run.configurationId,
        simulationRunId: run.id
      }]
    });
    setCandidateRunId("");
  };
  const toggleKpi = (kpiId: string, selected: boolean) => {
    const kpi = project.kpis.find((candidate) => candidate.id === kpiId)!;
    const selectedKpiIds = selected ? [...study.selectedKpiIds, kpiId] : study.selectedKpiIds.filter((id) => id !== kpiId);
    const kpiSettings = structuredClone(study.kpiSettings);
    if (selected) {
      const threshold: ComparisonThreshold | undefined = kpi.minimumThreshold !== undefined || kpi.maximumThreshold !== undefined
        ? { minimum: kpi.minimumThreshold, maximum: kpi.maximumThreshold, mode: "warning" }
        : undefined;
      kpiSettings[kpiId] = { weight: kpi.weight, optimizationDirection: kpi.optimizationDirection, threshold };
    } else delete kpiSettings[kpiId];
    patchStudy({ selectedKpiIds, kpiSettings });
  };
  return <div className="space-y-4">
    <section className="card p-5">
      <h2 className="text-lg font-bold">Evaluation setup</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <label><span className="label">Name</span><input className="field" value={study.name} onChange={(event) => patchStudy({ name: event.target.value }, false)} /></label>
        <label><span className="label">Description</span><input className="field" value={study.description} onChange={(event) => patchStudy({ description: event.target.value }, false)} /></label>
      </div>
    </section>
    <section className="card p-5">
      <h2 className="text-lg font-bold">Evaluation alternatives and exact runs</h2>
      <p className="mt-1 text-sm text-slate-500">A run is added only after you explicitly select it. Saved results never switch to a newer run.</p>
      {view === "manager" && <p className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">Manager view lists only Ready configured 100% candidate runs. Expert view may inspect architecture-only evidence, with explicit comparability warnings.</p>}
      <div className="mt-3 space-y-2">{study.alternativeRefs.map((alternative) => {
        const run = project.simulationRuns.find((candidate) => candidate.id === alternative.simulationRunId);
        return <div className="grid grid-cols-[1fr_1.3fr_auto] items-end gap-3 rounded-lg border p-3 max-md:grid-cols-1" key={alternative.id}>
          <label><span className="label">Alternative label</span><input className="field" value={alternative.label} onChange={(event) => patchStudy({ alternativeRefs: study.alternativeRefs.map((candidate) => candidate.id === alternative.id ? { ...candidate, label: event.target.value } : candidate) }, false)} /></label>
          <div><span className="label">Immutable simulation</span><div className="rounded-lg bg-slate-50 p-2 text-sm">{run?.name ?? "Missing run"} · {run ? new Date(run.timestamp).toLocaleString() : ""} · {run ? simulationStatus(project, run) : "Missing"}</div></div>
          <button className="btn btn-danger" aria-label={`Remove ${alternative.label}`} onClick={() => patchStudy({ alternativeRefs: study.alternativeRefs.filter((candidate) => candidate.id !== alternative.id) })}><Trash2 size={14} /></button>
        </div>;
      })}</div>
      <div className="mt-3 flex gap-2">
        <label className="min-w-0 flex-1"><span className="label">Saved run to confirm and add</span><select className="field" value={candidateRunId} onChange={(event) => setCandidateRunId(event.target.value)}><option value="">Select an exact run</option>{unusedRuns.map((run) => <option key={run.id} value={run.id}>{run.name} · {run.configurationId ? "configured" : "architecture-only"} · {new Date(run.timestamp).toLocaleString()}</option>)}</select></label>
        <button className="btn self-end" disabled={!candidateRunId || study.alternativeRefs.length >= 6} onClick={addAlternative}><Plus size={14} /> Add selected run</button>
      </div>
    </section>
    <section className="card p-5">
      <h2 className="text-lg font-bold">Study-specific KPI settings</h2>
      <p className="mt-1 text-sm text-slate-500">Raw weights are normalized for display. Editing these settings never changes the global KPI definition.</p>
      <div className="mt-3 space-y-3">{project.kpis.map((kpi) => {
        const selected = study.selectedKpiIds.includes(kpi.id);
        const setting = study.kpiSettings[kpi.id];
        return <article key={kpi.id} className={`rounded-lg border p-3 ${selected ? "border-blue-200 bg-blue-50/30" : ""}`}>
          <label className="font-semibold"><input className="mr-2" type="checkbox" checked={selected} onChange={(event) => toggleKpi(kpi.id, event.target.checked)} />{kpi.name} <span className="text-xs font-normal text-slate-500">{kpi.outputUnit} · {kpi.id}</span></label>
          {selected && setting && <div className="mt-3 grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-md:grid-cols-2">
            <label><span className="label">Raw weight</span><input className="field" type="number" min="0" step="0.1" value={setting.weight} onChange={(event) => patchStudy({ kpiSettings: { ...study.kpiSettings, [kpi.id]: { ...setting, weight: Number(event.target.value) } } })} /></label>
            <div><span className="label">Normalized</span><div className="field bg-slate-50">{weights[kpi.id]}%</div></div>
            <label><span className="label">Direction</span><select className="field" value={setting.optimizationDirection} onChange={(event) => patchStudy({ kpiSettings: { ...study.kpiSettings, [kpi.id]: { ...setting, optimizationDirection: event.target.value as "minimize" | "maximize" } } })}><option value="minimize">Minimize</option><option value="maximize">Maximize</option></select></label>
            <label><span className="label">Minimum</span><input className="field" type="number" value={setting.threshold?.minimum ?? ""} onChange={(event) => patchStudy({ kpiSettings: { ...study.kpiSettings, [kpi.id]: { ...setting, threshold: { ...setting.threshold, mode: setting.threshold?.mode ?? "warning", minimum: event.target.value === "" ? undefined : Number(event.target.value) } } } })} /></label>
            <label><span className="label">Maximum</span><input className="field" type="number" value={setting.threshold?.maximum ?? ""} onChange={(event) => patchStudy({ kpiSettings: { ...study.kpiSettings, [kpi.id]: { ...setting, threshold: { ...setting.threshold, mode: setting.threshold?.mode ?? "warning", maximum: event.target.value === "" ? undefined : Number(event.target.value) } } } })} /></label>
            <label><span className="label">Threshold mode</span><select className="field" value={setting.threshold?.mode ?? "warning"} onChange={(event) => patchStudy({ kpiSettings: { ...study.kpiSettings, [kpi.id]: { ...setting, threshold: { ...setting.threshold, mode: event.target.value as "warning" | "hard" } } } })}><option value="warning">Warning</option><option value="hard">Hard</option></select></label>
          </div>}
        </article>;
      })}</div>
    </section>
    <section className="card p-5"><h2 className="font-bold">Validation</h2>{findings.length ? <ul className="mt-2 space-y-1 text-sm">{findings.map((item) => <li key={item.id} className={item.severity === "error" ? "text-red-700" : "text-amber-700"}>{item.ruleId}: {item.message}</li>)}</ul> : <p className="mt-2 text-sm text-green-700">Study setup is structurally valid.</p>}</section>
  </div>;
}

function selected(project: ReturnType<typeof useAppStore.getState>["projects"][number], study: ComparisonStudy, resultId?: string) {
  return study.results.find((candidate) => candidate.id === resultId) ?? study.results.at(-1);
}

function SideBySide({ study, resultId }: { study: ComparisonStudy; resultId?: string }) {
  const project = useAppStore(selectActiveProject)!;
  const result = selected(project, study, resultId);
  const traceability = calculateTraceabilityMetrics(project);
  const maturity = calculateMaturity(project);
  if (!result) return <EmptyResult />;
  const leaders = result.methodology === "fixed-smart-mavt"
    ? result.recommendedAlternativeIds ?? []
    : leadingAlternativeIds(result.weightedScores);
  const leaderWarnings = leaders.flatMap((id) => {
    const alternative = study.alternativeRefs.find((item) => item.id === id);
    const coverage = result.dataCoveragePercent[id] ?? 0;
    const hardViolations = result.thresholdViolations.filter((item) => item.alternativeId === id && item.severity === "error");
    return [
      ...(coverage < 100 ? [`${alternative?.label ?? id} leads with only ${coverage}% data coverage.`] : []),
      ...(hardViolations.length ? [`${alternative?.label ?? id} leads despite ${hardViolations.length} hard-threshold violation(s).`] : [])
    ];
  });
  return <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
    {leaderWarnings.length > 0 && <div className="col-span-full rounded-lg border-2 border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900" role="alert"><div>Leading-score caveat — proposal requires explicit review</div><ul className="mt-2 list-disc pl-5">{leaderWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    {study.alternativeRefs.map((alternative) => {
      const run = project.simulationRuns.find((candidate) => candidate.id === alternative.simulationRunId)!;
      const architecture = project.architectures.find((candidate) => candidate.id === alternative.architectureId);
      const configuration = project.configurations.find((candidate) => candidate.id === alternative.configurationId);
      const violations = result.thresholdViolations.filter((item) => item.alternativeId === alternative.id);
      const selectedFeatures = project.features.filter((feature) => configuration?.effectiveSelectedFeatureIds.includes(feature.id));
      return <article className={`card p-5 ${violations.some((item) => item.severity === "error") ? "border-red-300" : leaders.includes(alternative.id) ? "border-blue-300" : ""}`} key={alternative.id}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{alternative.label}</h2><p className="text-sm text-slate-500">{architecture?.name ?? alternative.architectureId} · {configuration?.name ?? "Architecture-only"}</p></div>{leaders.includes(alternative.id) && <span className="badge bg-blue-100 text-blue-800">Highest feasible stakeholder value</span>}</div>
        <dl className="mt-4 grid grid-cols-[150px_1fr] gap-2 text-sm">
          <dt className="font-semibold">Simulation</dt><dd>{run.name} · {new Date(run.timestamp).toLocaleString()} · {simulationStatus(project, run)}</dd>
          <dt className="font-semibold">Source revision</dt><dd>{run.projectModelRevisionAtRun}</dd>
          <dt className="font-semibold">Features</dt><dd>{selectedFeatures.map((feature) => feature.name).join(", ") || "Unconfigured 150% model"}</dd>
          <dt className="font-semibold">Model content</dt><dd>{run.inputSnapshot.realizedElements.length} included elements · {configuration?.excludedElementIds.length ?? 0} excluded</dd>
          <dt className="font-semibold">Raw KPIs</dt><dd>{study.selectedKpiIds.map((id) => `${project.kpis.find((kpi) => kpi.id === id)?.name}: ${format(result.rawValues[alternative.id][id], project.kpis.find((kpi) => kpi.id === id)?.outputUnit)}`).join("; ")}</dd>
          <dt className="font-semibold">Fixed stakeholder value</dt><dd>{study.selectedKpiIds.map((id) => `${id}: ${format(result.stakeholderValues?.[alternative.id]?.[id])}`).join("; ")}</dd>
          <dt className="font-semibold">Value / coverage</dt><dd><strong>{format(result.stakeholderValueScores?.[alternative.id] ?? result.weightedScores[alternative.id])}</strong> · {result.dataCoveragePercent[alternative.id]}%</dd>
          <dt className="font-semibold">Feasibility / Pareto</dt><dd>{result.feasibility?.[alternative.id]?.status ?? "Legacy result"} · {result.pareto?.[alternative.id]?.status ?? "Not available"}</dd>
          <dt className="font-semibold">Legacy relative score</dt><dd>{format(result.weightedScores[alternative.id])} — depends on the alternatives included in this study.</dd>
          <dt className="font-semibold">Quality</dt><dd>{run.validationSummary.errors} errors · {run.validationSummary.warnings} warnings · maturity {maturity.overall ?? "Not available"}%</dd>
          <dt className="font-semibold">Traceability</dt><dd>{traceability.map((item) => `${item.label}: ${item.value ?? "N/A"}%`).join("; ")}</dd>
          <dt className="font-semibold">Warnings</dt><dd>{[...run.warnings, ...violations.map((item) => item.message)].join(" ") || "None"}</dd>
        </dl>
      </article>;
    })}
    <p className="col-span-full text-sm text-slate-600">{result.recommendationLabel ?? "Legacy relative score — depends on the alternatives included in this study."}</p>
  </section>;
}

function KpiTable({ study, resultId }: { study: ComparisonStudy; resultId?: string }) {
  const project = useAppStore(selectActiveProject)!;
  const result = selected(project, study, resultId);
  if (!result) return <EmptyResult />;
  return <section className="card overflow-auto p-5"><h2 className="text-lg font-bold">Raw evidence, fixed stakeholder value and contributions</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Alternative</th>{study.selectedKpiIds.map((id) => <th key={id}>{project.kpis.find((kpi) => kpi.id === id)?.name}<div className="text-xs font-normal text-slate-500">{project.kpis.find((kpi) => kpi.id === id)?.outputUnit} · {study.kpiSettings[id].optimizationDirection}</div></th>)}<th>Stakeholder value</th><th>Coverage</th></tr></thead><tbody>{study.alternativeRefs.map((alternative) => <tr key={alternative.id}><th>{alternative.label}<div className="text-xs font-normal text-slate-500">{result.feasibility?.[alternative.id]?.status ?? "legacy"}</div></th>{study.selectedKpiIds.map((id) => <td key={id}><div>{format(result.rawValues[alternative.id][id], project.kpis.find((kpi) => kpi.id === id)?.outputUnit)}</div><div className="text-xs text-slate-500">Fixed value {format(result.stakeholderValues?.[alternative.id]?.[id])} · contribution {format(result.weightedContributions?.[alternative.id]?.[id])}</div></td>)}<td>{format(result.stakeholderValueScores?.[alternative.id] ?? result.weightedScores[alternative.id])}</td><td>{result.dataCoveragePercent[alternative.id]}%</td></tr>)}</tbody></table>
    <p className="mt-3 text-xs text-slate-500">Historical compatibility: Legacy relative score — depends on the alternatives included in this study. It is not the default recommendation method for new analyses.</p>
    {result.warnings.length > 0 && <ul className="mt-4 list-disc pl-5 text-sm text-amber-800">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</section>;
}

function ComparisonCharts({ study, resultId }: { study: ComparisonStudy; resultId?: string }) {
  const project = useAppStore(selectActiveProject)!;
  const result = selected(project, study, resultId);
  const [rawKpiId, setRawKpiId] = useState(study.selectedKpiIds[0] ?? "");
  if (!result) return <EmptyResult />;
  const rawKpi = project.kpis.find((kpi) => kpi.id === rawKpiId);
  const rawData = study.alternativeRefs.map((alternative) => ({ name: alternative.label, value: result.rawValues[alternative.id][rawKpiId] }));
  const radarData = study.selectedKpiIds.map((kpiId) => ({
    kpi: project.kpis.find((kpi) => kpi.id === kpiId)?.name ?? kpiId,
    ...Object.fromEntries(study.alternativeRefs.map((alternative) => [alternative.id, result.stakeholderValues?.[alternative.id]?.[kpiId] ?? result.normalizedScores[alternative.id][kpiId]]))
  }));
  const scoreData = study.alternativeRefs.map((alternative) => ({ name: alternative.label, score: result.stakeholderValueScores?.[alternative.id] ?? result.weightedScores[alternative.id], coverage: result.dataCoveragePercent[alternative.id] }));
  return <div className="space-y-4">
    <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Raw KPI values</h2><p className="text-sm text-slate-500">One KPI and one explicit unit per chart.</p></div><select aria-label="Raw KPI chart" className="field max-w-xs" value={rawKpiId} onChange={(event) => setRawKpiId(event.target.value)}>{study.selectedKpiIds.map((id) => <option key={id} value={id}>{project.kpis.find((kpi) => kpi.id === id)?.name}</option>)}</select></div>
      <div className="mt-4 h-72" role="img" aria-label={`Raw ${rawKpi?.name} grouped bar chart`}><ResponsiveContainer><BarChart data={rawData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis label={{ value: rawKpi?.outputUnit, angle: -90, position: "insideLeft" }} /><Tooltip /><Legend /><Bar dataKey="value" name={`${rawKpi?.name} (${rawKpi?.outputUnit})`} fill="#2563eb" /></BarChart></ResponsiveContainer></div>
      <p className="text-sm text-slate-600">Text summary: {rawData.map((item) => `${item.name}: ${format(item.value, rawKpi?.outputUnit)}`).join("; ")}.</p>
    </section>
    <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
      <div className="card p-5"><h2 className="text-lg font-bold">Fixed stakeholder-value profile (0–100)</h2><div className="h-80" role="img" aria-label="Fixed stakeholder value radar chart"><ResponsiveContainer><RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="kpi" /><PolarRadiusAxis domain={[0, 100]} />{study.alternativeRefs.map((alternative, index) => <Radar key={alternative.id} name={alternative.label} dataKey={alternative.id} stroke={palette[index]} fill={palette[index]} fillOpacity={0.08} />)}<Legend /><Tooltip /></RadarChart></ResponsiveContainer></div><p className="text-sm text-slate-600">Fixed value functions do not change when alternatives are added or removed; missing values remain missing.</p></div>
      <div className="card p-5"><h2 className="text-lg font-bold">Stakeholder value and coverage</h2><div className="h-80" role="img" aria-label="Stakeholder value bar chart"><ResponsiveContainer><BarChart data={scoreData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Legend /><Bar dataKey="score" name="Stakeholder value" fill="#7c3aed" /><Bar dataKey="coverage" name="Data coverage %" fill="#94a3b8" /></BarChart></ResponsiveContainer></div><p className="text-sm text-slate-600">{result.recommendationLabel ?? "Legacy relative score — depends on the alternatives included in this study."}</p></div>
    </section>
  </div>;
}

function AssumptionsRisks({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const add = useAppStore((state) => state.addComparisonRisk);
  const update = useAppStore((state) => state.updateComparisonRisk);
  const duplicate = useAppStore((state) => state.duplicateComparisonRisk);
  const remove = useAppStore((state) => state.deleteComparisonRisk);
  const [alternativeFilter, setAlternativeFilter] = useState("all");
  const risks = project.comparisonRisks.filter((risk) => risk.comparisonStudyId === study.id && (alternativeFilter === "all" || risk.alternativeId === alternativeFilter));
  const create = () => {
    const alternative = study.alternativeRefs[0];
    if (!alternative) return;
    add({
      id: `risk-${crypto.randomUUID()}`,
      comparisonStudyId: study.id,
      alternativeId: alternative.id,
      title: "New comparison risk",
      description: "",
      inherentLikelihood: 3,
      inherentImpact: 3,
      residualLikelihood: 3,
      residualImpact: 3,
      status: "open",
      applicableArchitectureIds: [alternative.architectureId],
      applicableConfigurationIds: alternative.configurationId ? [alternative.configurationId] : [],
      applicableRequirementIds: [],
      applicableParameterIds: [],
      applicableKpiIds: [],
      reviewRequired: false
    });
  };
  return <div className="space-y-4">
    <section className="card p-5"><h2 className="text-lg font-bold">Uncertainty and run warnings</h2><div className="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">{project.simulationRuns.filter((run) => study.alternativeRefs.some((alternative) => alternative.simulationRunId === run.id)).map((run) => <article key={run.id} className="rounded-lg border p-3"><strong>{run.name}</strong><p className="text-sm text-slate-600">{run.warnings.join(" ") || "No run warnings."}</p><p className="mt-2 text-xs text-slate-500">Parameter uncertainty: {run.inputSnapshot.realizedElements.flatMap((element) => element.parameters).filter((parameter) => parameter.uncertaintyPercent !== undefined).map((parameter) => `${parameter.name} ±${parameter.uncertaintyPercent}%`).join("; ") || "Not quantified"}</p></article>)}</div></section>
    <section className="card p-5"><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">Comparison risks</h2><select aria-label="Filter risks by alternative" className="field ml-auto max-w-xs" value={alternativeFilter} onChange={(event) => setAlternativeFilter(event.target.value)}><option value="all">All alternatives</option>{study.alternativeRefs.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.label}</option>)}</select><button className="btn" onClick={create}><Plus size={14} /> Risk</button></div>
      <div className="mt-3 space-y-3">{risks.map((risk) => <RiskEditor key={risk.id} risk={risk} alternatives={study.alternativeRefs} onUpdate={update} onDuplicate={duplicate} onDelete={remove} />)}</div>{!risks.length && <p className="mt-4 text-sm text-slate-500">No risks match the filter.</p>}</section>
    <RiskMatrix study={study} />
  </div>;
}

function RiskEditor({ risk, alternatives, onUpdate, onDuplicate, onDelete }: { risk: ComparisonRisk; alternatives: ComparisonStudy["alternativeRefs"]; onUpdate: (id: string, patch: Partial<ComparisonRisk>) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  return <article className="rounded-lg border p-3"><div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
    <label><span className="label">Title</span><input className="field" value={risk.title} onChange={(event) => onUpdate(risk.id, { title: event.target.value })} /></label>
    <label><span className="label">Alternative</span><select className="field" value={risk.alternativeId} onChange={(event) => onUpdate(risk.id, { alternativeId: event.target.value })}>{alternatives.map((alternative) => <option value={alternative.id} key={alternative.id}>{alternative.label}</option>)}</select></label>
    <label><span className="label">Inherent likelihood (1–5)</span><input className="field" type="number" min="1" max="5" value={risk.inherentLikelihood} onChange={(event) => onUpdate(risk.id, { inherentLikelihood: Number(event.target.value) as ComparisonRisk["inherentLikelihood"] })} /></label>
    <label><span className="label">Inherent impact (1–5)</span><input className="field" type="number" min="1" max="5" value={risk.inherentImpact} onChange={(event) => onUpdate(risk.id, { inherentImpact: Number(event.target.value) as ComparisonRisk["inherentImpact"] })} /></label>
    <label><span className="label">Residual likelihood (1–5)</span><input className="field" type="number" min="1" max="5" value={risk.residualLikelihood} onChange={(event) => onUpdate(risk.id, { residualLikelihood: Number(event.target.value) as ComparisonRisk["residualLikelihood"] })} /></label>
    <label><span className="label">Residual impact (1–5)</span><input className="field" type="number" min="1" max="5" value={risk.residualImpact} onChange={(event) => onUpdate(risk.id, { residualImpact: Number(event.target.value) as ComparisonRisk["residualImpact"] })} /></label>
    <label><span className="label">Owner</span><input className="field" value={risk.owner ?? ""} onChange={(event) => onUpdate(risk.id, { owner: event.target.value })} /></label>
    <label><span className="label">Status</span><select className="field" value={risk.status} onChange={(event) => onUpdate(risk.id, { status: event.target.value as ComparisonRisk["status"] })}><option value="open">Open</option><option value="mitigating">Mitigating</option><option value="accepted">Accepted</option><option value="closed">Closed</option></select></label>
    <label className="col-span-2"><span className="label">Description</span><textarea className="field" value={risk.description} onChange={(event) => onUpdate(risk.id, { description: event.target.value })} /></label>
    <label className="col-span-2"><span className="label">Mitigation</span><textarea className="field" value={risk.mitigation ?? ""} onChange={(event) => onUpdate(risk.id, { mitigation: event.target.value })} /></label>
    <label className="col-span-2"><span className="label">Applicable requirement IDs</span><input className="field" value={risk.applicableRequirementIds.join(", ")} onChange={(event) => onUpdate(risk.id, { applicableRequirementIds: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
    <label className="col-span-2"><span className="label">Applicable parameter / KPI IDs</span><input className="field" value={[...risk.applicableParameterIds, ...risk.applicableKpiIds].join(", ")} onChange={(event) => {
      const ids = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
      onUpdate(risk.id, { applicableParameterIds: ids.filter((id) => id.startsWith("par-")), applicableKpiIds: ids.filter((id) => id.startsWith("kpi-")) });
    }} /></label>
  </div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={risk.reviewRequired} onChange={(event) => onUpdate(risk.id, { reviewRequired: event.target.checked })} />Review required before decision approval</label><div className="mt-2 flex gap-2"><button className="btn" onClick={() => onDuplicate(risk.id)}><Copy size={14} /> Duplicate</button><button className="btn btn-danger" onClick={() => onDelete(risk.id)}><Trash2 size={14} /> Delete</button></div></article>;
}

function Sensitivity({ study }: { study: ComparisonStudy }) {
  const { alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const execute = useAppStore((state) => state.executeSensitivity);
  const [activeKpiId, setActiveKpiId] = useState(study.selectedKpiIds[0] ?? "");
  const result = study.sensitivityResult;
  const series = result?.series.find((candidate) => candidate.kpiId === activeKpiId) ?? result?.series[0];
  const data = series?.points.map((point) => ({
    multiplier: point.multiplierPercent,
    ...point.alternativeScores
  })) ?? [];
  return <section className="card p-5"><div className="flex flex-wrap items-center gap-3"><div><h2 className="text-lg font-bold">Fixed-value weight sensitivity</h2><p className="text-sm text-slate-500">One-factor-at-a-time study-weight variation from 0% to 200% in 25% increments; fixed stakeholder value functions remain unchanged.</p></div><button className="btn btn-primary ml-auto" onClick={() => {
    const errors = execute(study.id);
    if (errors.length) void alertUser(errors.join("\n"));
  }}><Play size={14} /> Run sensitivity</button></div>
    {result ? <><label className="mt-4 block max-w-xs"><span className="label">Varied KPI</span><select className="field" value={series?.kpiId ?? ""} onChange={(event) => setActiveKpiId(event.target.value)}>{result.series.map((candidate) => <option key={candidate.kpiId} value={candidate.kpiId}>{project.kpis.find((kpi) => kpi.id === candidate.kpiId)?.name ?? candidate.kpiId}</option>)}</select></label>
      <div className="mt-4 h-80" role="img" aria-label="Weight sensitivity score line chart"><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="multiplier" label={{ value: "Raw weight multiplier (%)", position: "insideBottom", offset: -2 }} /><YAxis domain={[0, 100]} /><Tooltip /><Legend />{study.alternativeRefs.map((alternative, index) => <Line type="monotone" key={alternative.id} dataKey={alternative.id} name={alternative.label} stroke={palette[index]} connectNulls={false} />)}</LineChart></ResponsiveContainer></div>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Multiplier</th>{study.alternativeRefs.map((alternative) => <th key={alternative.id}>{alternative.label}</th>)}<th>Leader(s)</th></tr></thead><tbody>{series?.points.map((point) => <tr key={point.multiplierPercent}><th>{point.multiplierPercent}%</th>{study.alternativeRefs.map((alternative) => <td key={alternative.id}>{format(point.alternativeScores[alternative.id])}</td>)}<td>{point.leadingAlternativeIds.map((id) => study.alternativeRefs.find((alternative) => alternative.id === id)?.label ?? id).join(", ")}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm text-slate-600">Generated {new Date(result.timestamp).toLocaleString()} · leader {series?.leaderChanged ? "changes" : "remains stable"}.</p>{series?.warnings.map((warning) => <p key={warning} className="text-sm text-amber-800">{warning}</p>)}</> : <p className="mt-4 text-sm text-slate-500">Run sensitivity after a valid comparison setup exists.</p>}
  </section>;
}

function DecisionLog({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const createFromComparison = useAppStore((state) => state.createDecisionFromComparison);
  const addDecision = useAppStore((state) => state.addDecision);
  const update = useAppStore((state) => state.updateDecision);
  const duplicate = useAppStore((state) => state.duplicateDecision);
  const remove = useAppStore((state) => state.deleteDecision);
  const confirm = useAppStore((state) => state.confirmDecisionSelection);
  const [decisionId, setDecisionId] = useState(project.decisions.find((decision) => decision.supportingComparisonStudyIds.includes(study.id))?.id ?? project.decisions[0]?.id ?? "");
  const [filter, setFilter] = useState<Decision["status"] | "all">("all");
  const decisions = project.decisions.filter((decision) => filter === "all" || decision.status === filter);
  const decision = project.decisions.find((candidate) => candidate.id === decisionId) ?? decisions[0];
  const createBlank = () => {
    const now = new Date().toISOString();
    const item: Decision = { id: `decision-${crypto.randomUUID()}`, question: "New decision question", alternatives: [], criteria: [], supportingSimulationRunIds: [], supportingComparisonStudyIds: [], assumptions: [], risks: [], openActions: [], status: "draft", createdAt: now, updatedAt: now };
    addDecision(item);
    setDecisionId(item.id);
  };
  return <div className="grid grid-cols-[280px_1fr] gap-4 max-lg:grid-cols-1">
    <aside className="card p-4"><div className="flex items-center gap-2"><select aria-label="Filter decisions" className="field" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="proposed">Proposed</option><option value="approved">Approved</option><option value="revisit">Revisit</option></select><button className="btn" onClick={createBlank}><Plus size={14} /></button></div>
      <button className="btn btn-primary mt-2 w-full" disabled={!study.results.length} onClick={() => {
        const id = createFromComparison(study.id);
        if (id) setDecisionId(id);
      }}>Create decision from Trade Study</button>
      <div className="mt-3 space-y-2">{decisions.map((item) => <button key={item.id} onClick={() => setDecisionId(item.id)} className={`w-full rounded-lg border p-3 text-left ${decision?.id === item.id ? "border-blue-300 bg-blue-50" : ""}`}><strong className="block text-sm">{item.question}</strong><span className="badge mt-2 bg-slate-100 text-slate-700">{item.status}</span></button>)}</div>
      <div className="mt-4 border-t pt-3"><h3 className="font-semibold">Originating planning questions</h3>{project.openDecisions.map((item) => <div className="mt-2 rounded-lg border p-2 text-sm" key={item.id}><div>{item.question}</div><p className="mt-1 text-xs text-slate-500">{item.id === study.originatingOpenDecisionId ? "Initiates this Trade Study" : "Not linked to this Trade Study"} · {item.linkedFormalDecisionId ? "formal outcome linked" : "formal outcome pending"}</p></div>)}</div>
    </aside>
    {decision ? <DecisionEditor decision={decision} onUpdate={update} onConfirm={confirm} onDuplicate={duplicate} onDelete={(id) => { remove(id); setDecisionId(""); }} /> : <section className="card p-8 text-center text-slate-500">Create or select a formal decision.</section>}
  </div>;
}

function DecisionEditor({ decision, onUpdate, onConfirm, onDuplicate, onDelete }: { decision: Decision; onUpdate: (id: string, patch: Partial<Decision>) => string | null; onConfirm: (id: string, alternative: string) => string | null; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  const { confirm } = useDialogs();
  const [message, setMessage] = useState("");
  const save = (patch: Partial<Decision>) => {
    const error = onUpdate(decision.id, patch);
    setMessage(error ?? "");
  };
  return <section className="card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Formal decision record</h2><p className="text-sm text-slate-500">Automated scoring provides a proposal only. Stakeholder approval is never inferred.</p></div><span className="badge bg-blue-100 text-blue-800">{decision.status}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
      <label className="col-span-2"><span className="label">Question</span><input className="field" value={decision.question} onChange={(event) => save({ question: event.target.value })} /></label>
      <label><span className="label">Proposed / selected alternative</span><select className="field" value={decision.selectedAlternative ?? ""} onChange={(event) => save({ selectedAlternative: event.target.value || undefined })}><option value="">No selection — tied or unresolved</option>{decision.alternatives.map((alternative) => <option key={alternative}>{alternative}</option>)}</select></label>
      <label><span className="label">Owner</span><input className="field" value={decision.owner ?? ""} onChange={(event) => save({ owner: event.target.value })} /></label>
      <label className="col-span-2"><span className="label">Rationale</span><textarea className="field min-h-28" value={decision.rationale ?? ""} onChange={(event) => save({ rationale: event.target.value })} /></label>
      <label><span className="label">Status</span><select className="field" value={decision.status} onChange={(event) => save({ status: event.target.value as Decision["status"], decisionDate: event.target.value === "approved" ? new Date().toISOString() : decision.decisionDate })}><option value="draft">Draft</option><option value="proposed">Proposed</option><option value="approved">Approved</option><option value="revisit">Revisit</option></select></label>
      <div><span className="label">Criteria</span><div className="field bg-slate-50">{decision.criteria.join(", ") || "Not recorded"}</div></div>
      <label className="col-span-2"><span className="label">Critical residual-risk approval justification</span><textarea className="field" value={decision.criticalRiskJustification ?? ""} onChange={(event) => save({ criticalRiskJustification: event.target.value })} placeholder="Required only when unresolved residual exposure is high or critical." /></label>
      <label className="col-span-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><input type="checkbox" checked={decision.baselineApprovalConfirmed ?? false} onChange={(event) => save({ baselineApprovalConfirmed: event.target.checked })} />Explicitly confirm that an approved decision may establish the selected architecture baseline. This never simulates stakeholder approval.</label>
    </div>
    <dl className="mt-4 grid grid-cols-[170px_1fr] gap-2 text-sm"><dt className="font-semibold">Supporting studies</dt><dd>{decision.supportingComparisonStudyIds.join(", ") || "None"}</dd><dt className="font-semibold">Supporting runs</dt><dd>{decision.supportingSimulationRunIds.join(", ") || "None"}</dd><dt className="font-semibold">Risks</dt><dd>{decision.risks.join(", ") || "None"}</dd><dt className="font-semibold">Open actions</dt><dd>{decision.openActions.join(" ") || "None"}</dd><dt className="font-semibold">Decision snapshot</dt><dd>{decision.evidenceSnapshot ? `${decision.evidenceSnapshot.capturedAt} · revision ${decision.evidenceSnapshot.projectModelRevision} · ${decision.evidenceSnapshot.simulationRunIds.length} immutable runs` : "Captured when created from a Trade Study and refreshed only by explicit approval."}</dd></dl>
    {message && <p className="mt-3 text-sm text-red-700" role="alert">{message}</p>}
    <div className="mt-4 flex flex-wrap gap-2">{decision.selectedAlternative && decision.status === "draft" && <button className="btn btn-primary" onClick={() => setMessage(onConfirm(decision.id, decision.selectedAlternative!) ?? "")}><Save size={14} /> Confirm selection as proposed</button>}<button className="btn" onClick={() => onDuplicate(decision.id)}><Copy size={14} /> Duplicate</button><button className="btn btn-danger" onClick={async () => (await confirm("Delete this formal decision?", { confirmLabel: "Delete", tone: "danger" })) && onDelete(decision.id)}><Trash2 size={14} /> Delete</button></div>
  </section>;
}

function EmptyResult() {
  return <section className="card p-8 text-center text-slate-500"><ShieldAlert className="mx-auto mb-3" />Analyze a valid Trade Study to create an immutable result.</section>;
}
