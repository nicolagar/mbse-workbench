import { SemanticParallelPanel } from "./SemanticWorkspace";
import { baselineRequirementIds } from "../domain/ontology";
import {
  CheckCircle2,
  Copy,
  GitCompare,
  Play,
  Plus,
  Ruler,
  Save,
  Trash2,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { leadingAlternativeIds } from "../domain/comparison";
import { formulaReferences, parseKpiFormula } from "../domain/kpiFormulas";
import { calculateSemanticScope } from "../domain/semanticScope";
import { simulationStatus } from "../domain/simulation";
import type { ComparisonResult, ComparisonStudy, Decision, Feature, KPI, StandardAlgorithmKey } from "../domain/types";
import { validateConfiguration } from "../domain/variability";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { KpiFormulaBuilder } from "./KpiFormulaBuilder";
import { UnitCatalogueDialog } from "./UnitCatalogueDialog";
import { useDialogs } from "./dialogs/DialogProvider";

type TradeTab = "setup" | "compare" | "decision";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const format = (value: number | null | undefined, unit = "") => finite(value) ? `${value.toFixed(2)}${unit ? ` ${unit}` : ""}` : "Missing";
const uniqueToggle = (values: string[], id: string, selected: boolean) =>
  selected ? [...new Set([...values, id])] : values.filter((value) => value !== id);
const algorithms: StandardAlgorithmKey[] = [
  "totalMass", "directElementCost", "processCost", "estimatedTotalCost", "totalPower",
  "manufacturingLeadTime", "resourceDemand", "basicUtilization", "throughputProxy"
];

function tracedRequirementIds(project: ReturnType<typeof selectActiveProject>, needIds: string[], objectiveIds: string[]) {
  if (!project) return [];
  const sources = new Set([...needIds, ...objectiveIds]);
  return [...new Set(project.relationships
    .filter((relationship) => relationship.relationshipType === "derives" && sources.has(relationship.sourceId))
    .map((relationship) => relationship.targetId))];
}

function globalSettings(kpis: KPI[], ids: string[]) {
  return Object.fromEntries(ids.map((id) => {
    const kpi = kpis.find((item) => item.id === id)!;
    return [id, { weight: kpi.weight, optimizationDirection: kpi.optimizationDirection }];
  }));
}

function compatibleCurrentRun(project: NonNullable<ReturnType<typeof selectActiveProject>>, configurationId: string, selectedKpiIds: string[]) {
  const configuration = project.configurations.find((item) => item.id === configurationId);
  if (!configuration || configuration.validationStatus !== "valid" || configuration.archivedAt) return undefined;
  if (validateConfiguration(project, configuration).some((finding) => finding.severity === "error")) return undefined;
  const derivation = configuration.derivation;
  if (derivation?.sourceModelRevision !== project.modelRevision) return undefined;
  return [...project.simulationRuns]
    .filter((run) =>
      run.configurationId === configuration.id
      && run.architectureId === configuration.architectureId
      && run.derivationId === derivation.id
      && simulationStatus(project, run) === "Current"
      && selectedKpiIds.every((kpiId) => run.results.some((result) => result.kpiId === kpiId && finite(result.value)))
    )
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
}

export function SimplifiedTradeStudyWorkspace() {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addStudy = useAppStore((state) => state.addComparisonStudy);
  const updateStudy = useAppStore((state) => state.updateComparisonStudy);
  const duplicateStudy = useAppStore((state) => state.duplicateComparisonStudy);
  const deleteStudy = useAppStore((state) => state.deleteComparisonStudy);
  const executeComparison = useAppStore((state) => state.executeComparison);
  const view = useAppStore((state) => state.uiPreferences.tradeStudyView);
  const setView = useAppStore((state) => state.setTradeStudyView);
  const setActiveComparisonStudy = useAppStore((state) => state.setActiveComparisonStudy);
  const requestedTab = useAppStore((state) => state.uiPreferences.activeTradeStudyTab);
  const [tab, setTab] = useState<TradeTab>(requestedTab === "Decision Rationale" ? "decision" : requestedTab === "Manager Summary" || requestedTab === "Expert Evidence" ? "compare" : "setup");
  const [studyId, setStudyId] = useState(project.activeComparisonStudyId ?? project.comparisonStudies[0]?.id ?? "");
  const [resultId, setResultId] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const study = project.comparisonStudies.find((item) => item.id === studyId) ?? project.comparisonStudies[0];
  const result = study?.results.find((item) => item.id === resultId) ?? study?.results.at(-1);
  const resultIsCurrent = Boolean(result && result.settingsUpdatedAt === study?.settingsUpdatedAt);

  useEffect(() => {
    setTab(requestedTab === "Decision Rationale" ? "decision" : requestedTab === "Manager Summary" || requestedTab === "Expert Evidence" ? "compare" : "setup");
  }, [requestedTab]);
  useEffect(() => {
    if (!studyId && project.comparisonStudies[0]) setStudyId(project.comparisonStudies[0].id);
  }, [project.comparisonStudies, studyId]);
  useEffect(() => {
    if (project.activeComparisonStudyId && project.activeComparisonStudyId !== studyId) setStudyId(project.activeComparisonStudyId);
  }, [project.activeComparisonStudyId, studyId]);
  useEffect(() => setResultId(study?.results.at(-1)?.id ?? ""), [study?.id, study?.results.length]);

  const create = () => {
    const now = new Date().toISOString();
    const next: ComparisonStudy = {
      id: `comparison-${crypto.randomUUID()}`,
      name: "New Trade Study",
      description: "",
      question: "",
      intendedOutcome: "",
      lifecycleScope: "",
      systemScope: "",
      status: "framing",
      needIds: [],
      objectiveIds: [],
      useCaseIds: [],
      rootFeatureId: project.features.filter((feature) => feature.featureType === "root").length === 1
        ? project.features.find((feature) => feature.featureType === "root")!.id
        : undefined,
      selectedVariabilityAxisIds: [],
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
      results: []
    };
    addStudy(next);
    setActiveComparisonStudy(next.id);
    setStudyId(next.id);
    setTab("setup");
  };
  const run = () => {
    if (!study) return;
    const outcome = executeComparison(study.id);
    setMessages([...outcome.errors, ...outcome.warnings]);
    if (!outcome.errors.length) setTab("compare");
  };

  return <div className="mx-auto max-w-7xl space-y-4">
    <header className="flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-700">Traceable decision workflow</div><h1 className="mt-1 text-3xl font-bold">Architecture Trade Study</h1><p className="mt-2 text-slate-600">Requirement feasibility first; weighted KPI comparison second; explicit user decision last.</p></div>
      <div className="flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Trade Study audience view">{(["manager", "expert"] as const).map((item) => <button key={item} className={`rounded-md px-3 py-2 text-sm font-semibold ${view === item ? "bg-blue-600 text-white" : "text-slate-600"}`} onClick={() => setView(item)}>{item === "manager" ? "Manager view" : "Expert view"}</button>)}</div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Preliminary engineering estimate — not a verified detailed-design result.</div>
    </header>

    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
      <aside className="card h-fit p-4">
        <div className="flex items-center justify-between"><h2 className="font-bold">Trade Studies</h2><button className="btn" onClick={create}><Plus size={14} /> New</button></div>
        <label className="mt-3 block"><span className="label">Active Trade Study</span><select className="field" value={study?.id ?? ""} onChange={(event) => { setStudyId(event.target.value); setActiveComparisonStudy(event.target.value || undefined); }}>{project.comparisonStudies.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <div className="mt-3 space-y-2">{project.comparisonStudies.map((item) => <button key={item.id} onClick={() => { setStudyId(item.id); setActiveComparisonStudy(item.id); }} className={`w-full rounded-lg border p-3 text-left ${study?.id === item.id ? "border-purple-300 bg-purple-50" : "border-slate-200"}`}><strong className="block text-sm">{item.name}</strong><span className="text-xs text-slate-500">{item.alternativeRefs.length} alternatives · {item.results.length} results</span></button>)}</div>
        {study && <div className="mt-4 flex flex-wrap gap-2"><button className="btn" onClick={() => duplicateStudy(study.id)}><Copy size={14} /> Duplicate</button><button className="btn btn-danger" onClick={async () => {
          if (!(await confirm(`Delete "${study.name}"?`, { confirmLabel: "Delete", tone: "danger" }))) return;
          const error = deleteStudy(study.id);
          if (error) setMessages([error]);
          else setStudyId(project.comparisonStudies.find((item) => item.id !== study.id)?.id ?? "");
        }}><Trash2 size={14} /></button></div>}
      </aside>

      <main className="min-w-0 space-y-4">
        {study ? <>
          <section className="card p-4">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Trade Study steps">
              <StepTab active={tab === "setup"} label="1. Define study" onClick={() => setTab("setup")} />
              <StepTab active={tab === "compare"} label={`2. ${view === "manager" ? "Compare" : "Inspect evidence"}`} onClick={() => setTab("compare")} />
              <StepTab active={tab === "decision"} label="3. Decide" onClick={() => setTab("decision")} />
              <button className="btn btn-primary ml-auto" onClick={run}><Play size={14} /> Run comparison</button>
            </div>
            {study.results.length > 0 && <label className="mt-3 block max-w-xl"><span className="label">Saved immutable result</span><select className="field" value={result?.id ?? ""} onChange={(event) => setResultId(event.target.value)}>{[...study.results].reverse().map((item) => <option key={item.id} value={item.id}>{new Date(item.timestamp).toLocaleString()} · {item.methodology ?? "legacy"}</option>)}</select></label>}
          </section>
          {messages.length > 0 && <section aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ul className="list-disc pl-5">{messages.map((message) => <li key={message}>{message}</li>)}</ul></section>}
          {result && !resultIsCurrent && <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This immutable result is retained for history but is stale because the scope, variability axes or KPI definitions changed. Refresh derivations and simulations as needed, then run a new comparison.</section>}
          {study && <SemanticParallelPanel flag="useSemanticTradeStudyView" label="Open semantic Trade Study preview" studyId={study.id} />}
          {tab === "setup" && <StudySetup study={study} update={updateStudy} />}
          {tab === "compare" && <div className="space-y-4"><AlternativeSelection study={study} update={updateStudy} />{view === "manager" ? <ManagerComparison study={study} result={result} /> : <ExpertComparison study={study} result={result} />}</div>}
          {tab === "decision" && <DecisionPanel study={study} result={resultIsCurrent ? result : undefined} />}
        </> : <section className="card grid min-h-[420px] place-items-center p-8 text-center"><div><GitCompare className="mx-auto text-slate-400" size={44} /><h2 className="mt-3 text-xl font-bold">No Trade Study</h2><p className="mt-2 text-slate-500">Create a study and enter the decision question directly.</p><button className="btn btn-primary mt-4" onClick={create}><Plus size={14} /> Create Trade Study</button></div></section>}
      </main>
    </div>
  </div>;
}

function StepTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button role="tab" aria-selected={active} className={`tab ${active ? "tab-active" : ""}`} onClick={onClick}>{label}</button>;
}

function StudySetup({ study, update }: { study: ComparisonStudy; update: (id: string, patch: Partial<ComparisonStudy>, calculationAffecting?: boolean) => void }) {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addFeature = useAppStore((state) => state.addFeature);
  const updateFeature = useAppStore((state) => state.updateFeature);
  const createVariabilityAxis = useAppStore((state) => state.createVariabilityAxis);
  const updateVariabilityAxis = useAppStore((state) => state.updateVariabilityAxis);
  const deleteVariabilityAxis = useAppStore((state) => state.deleteVariabilityAxis);
  const addKpi = useAppStore((state) => state.addKpi);
  const updateKpi = useAppStore((state) => state.updateKpi);
  const [rootName, setRootName] = useState(project.name);
  const [axisName, setAxisName] = useState("");
  const [axisDescription, setAxisDescription] = useState("");
  const [kpiName, setKpiName] = useState("");
  const [kpiFormula, setKpiFormula] = useState("1");
  const [kpiMode, setKpiMode] = useState<KPI["calculationMode"]>("formula");
  const [kpiAlgorithm, setKpiAlgorithm] = useState<StandardAlgorithmKey>("totalMass");
  const [kpiUnit, setKpiUnit] = useState("");
  const [kpiDirection, setKpiDirection] = useState<KPI["optimizationDirection"]>("minimize");
  const [kpiWeight, setKpiWeight] = useState(1);
  const [kpiObjectiveId, setKpiObjectiveId] = useState("");
  const [message, setMessage] = useState("");
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const needIds = study.needIds ?? [];
  const useCaseIds = study.useCaseIds ?? [];
  const projectScope = calculateSemanticScope(project);
  const studyScope = calculateSemanticScope(project, useCaseIds);
  const activeUseCases = projectScope.workingUseCases;
  const needs = studyScope.needs;
  const objectives = studyScope.objectives;
  const scopedObjectives = objectives.filter((objective) => study.objectiveIds.includes(objective.id));
  const selectedAlternativeConfigurationIds = study.alternativeRefs.map((alternative) => alternative.configurationId).filter((id): id is string => Boolean(id));
  const rootFeatures = project.features.filter((feature) => feature.featureType === "root");
  const root = rootFeatures.length === 1 ? rootFeatures[0] : undefined;
  const selectedAxisIds = study.selectedVariabilityAxisIds ?? [];
  const adoptableGroups = project.featureGroups.filter((group) => !project.variabilityAxes.some((axis) => axis.featureGroupId === group.id));
  const patchScope = (needIds: string[], objectiveIds: string[], useCaseIds: string[]) => {
    const activeIds = new Set(activeUseCases.map((useCase) => useCase.id));
    const validUseCaseIds = [...new Set(useCaseIds)].filter((id) => activeIds.has(id));
    const nextScope = calculateSemanticScope(project, validUseCaseIds);
    const eligibleNeedIds = new Set(nextScope.needs.map((need) => need.id));
    const eligibleObjectiveIds = new Set(nextScope.objectives.map((objective) => objective.id));
    const validNeedIds = [...new Set(needIds)].filter((id) => eligibleNeedIds.has(id));
    const validObjectiveIds = [...new Set(objectiveIds)].filter((id) => eligibleObjectiveIds.has(id));
    const removedIds = [...needIds.filter((id) => !validNeedIds.includes(id)), ...objectiveIds.filter((id) => !validObjectiveIds.includes(id))];
    const mandatoryRequirementIds = tracedRequirementIds(project, validNeedIds, validObjectiveIds);
    update(study.id, { needIds: validNeedIds, objectiveIds: validObjectiveIds, useCaseIds: validUseCaseIds, mandatoryRequirementIds }, true);
    if (removedIds.length) {
      const names = removedIds.map((id) => project.elements.find((element) => element.id === id)?.name ?? id);
      setMessage(`Removed out-of-scope selections after the use-case change: ${names.join(", ")}.`);
    }
  };
  const toggleKpi = (kpiId: string, selected: boolean) => {
    const kpi = project.kpis.find((item) => item.id === kpiId);
    if (selected && kpi && !kpi.objectiveIds.some((objectiveId) => study.objectiveIds.includes(objectiveId))) {
      setMessage(`${kpi.name} is not linked to an objective selected in this Trade Study.`);
      return;
    }
    const selectedKpiIds = uniqueToggle(study.selectedKpiIds, kpiId, selected);
    const criteria = selectedKpiIds.map((id) => {
      const kpi = project.kpis.find((item) => item.id === id)!;
      const existing = study.criteria.find((item) => item.kpiId === id);
      return {
        id: existing?.id ?? `criterion-${crypto.randomUUID()}`,
        name: kpi.name,
        description: "",
        type: "optimization" as const,
        sourceObjectiveIds: kpi.objectiveIds,
        sourceRequirementIds: study.mandatoryRequirementIds,
        kpiId: id,
        weight: kpi.weight,
        valueFunction: kpi.optimizationDirection
      };
    });
    update(study.id, { selectedKpiIds, kpiSettings: globalSettings(project.kpis, selectedKpiIds), criteria }, true);
  };
  const createRoot = () => {
    if (!rootName.trim() || rootFeatures.length) return;
    const feature: Feature = { id: `feature-${crypto.randomUUID()}`, name: rootName.trim(), description: "Shared Root Feature for the project feature model.", featureType: "root", sortOrder: 0, valueType: "boolean", allowedValues: [], defaultValue: false, variabilityScope: "external" };
    addFeature(feature);
    update(study.id, { rootFeatureId: feature.id }, true);
  };
  const createAxis = (existingGroupId?: string) => {
    const existing = project.featureGroups.find((group) => group.id === existingGroupId);
    const id = createVariabilityAxis(existing?.name ?? axisName, existing?.description ?? axisDescription, existingGroupId);
    if (!id) return setMessage("Create or link exactly one Root Feature before adding an axis.");
    update(study.id, { rootFeatureId: root?.id ?? study.rootFeatureId, selectedVariabilityAxisIds: [...new Set([...selectedAxisIds, id])] }, true);
    setAxisName(""); setAxisDescription(""); setMessage("Variability axis and canonical FeatureGroup saved.");
  };
  const createKpi = () => {
    if (!kpiName.trim() || !kpiUnit.trim() || !kpiObjectiveId || !Number.isFinite(kpiWeight) || kpiWeight < 0) return setMessage("Complete the KPI name, unit, scoped objective and non-negative weight.");
    if (!scopedObjectives.some((objective) => objective.id === kpiObjectiveId)) return setMessage("Select an objective in the active Trade Study scope.");
    let references = { parameterIds: [] as string[], kpiIds: [] as string[] };
    try { if (kpiMode === "formula") references = formulaReferences(parseKpiFormula(kpiFormula)); }
    catch (error) { return setMessage(error instanceof Error ? error.message : "Invalid KPI formula."); }
    const now = new Date().toISOString();
    const kpi: KPI = { id: `kpi-${crypto.randomUUID()}`, name: kpiName.trim(), description: "", objectiveIds: [kpiObjectiveId], calculationMode: kpiMode, formula: kpiMode === "formula" ? kpiFormula : undefined, standardAlgorithmKey: kpiMode === "standardAlgorithm" ? kpiAlgorithm : undefined, outputUnit: kpiUnit.trim(), optimizationDirection: kpiDirection, weight: kpiWeight, inputParameterIds: references.parameterIds, dependsOnKpiIds: references.kpiIds, calculationWarnings: [], createdAt: now, updatedAt: now };
    addKpi(kpi);
    const selectedKpiIds = [...new Set([...study.selectedKpiIds, kpi.id])];
    update(study.id, { selectedKpiIds, kpiSettings: { ...globalSettings(project.kpis, study.selectedKpiIds), [kpi.id]: { weight: kpi.weight, optimizationDirection: kpi.optimizationDirection } }, criteria: [...study.criteria, { id: `criterion-${crypto.randomUUID()}`, name: kpi.name, description: "", type: "optimization", sourceObjectiveIds: kpi.objectiveIds, sourceRequirementIds: study.mandatoryRequirementIds, kpiId: kpi.id, weight: kpi.weight, valueFunction: kpi.optimizationDirection }] }, true);
    setKpiName(""); setMessage("KPI created, selected and linked to the active Trade Study.");
  };
  const totalSelectedWeight = project.kpis
    .filter((kpi) => study.selectedKpiIds.includes(kpi.id))
    .reduce((sum, kpi) => sum + Math.max(0, kpi.weight), 0);
  useEffect(() => {
    const validUseCaseIds = useCaseIds.filter((id) => activeUseCases.some((useCase) => useCase.id === id));
    const currentScope = calculateSemanticScope(project, validUseCaseIds);
    const validNeedIds = needIds.filter((id) => currentScope.needs.some((need) => need.id === id));
    const validObjectiveIds = study.objectiveIds.filter((id) => currentScope.objectives.some((objective) => objective.id === id));
    const mandatoryRequirementIds = tracedRequirementIds(project, validNeedIds, validObjectiveIds);
    const changed = JSON.stringify(validUseCaseIds) !== JSON.stringify(useCaseIds)
      || JSON.stringify(validNeedIds) !== JSON.stringify(needIds)
      || JSON.stringify(validObjectiveIds) !== JSON.stringify(study.objectiveIds)
      || JSON.stringify(mandatoryRequirementIds) !== JSON.stringify(study.mandatoryRequirementIds);
    if (changed) {
      update(study.id, { useCaseIds: validUseCaseIds, needIds: validNeedIds, objectiveIds: validObjectiveIds, mandatoryRequirementIds }, true);
      setMessage("Trade Study scope was recalculated after the model traceability changed; ineligible selections were removed.");
    }
  }, [project.modelRevision, study.id]);
  return <div className="space-y-4">
    <section className="card p-5"><h2 className="text-xl font-bold">Decision question</h2><div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1"><label><span className="label">Trade Study name</span><input className="field" value={study.name} onChange={(event) => update(study.id, { name: event.target.value }, false)} /></label><label><span className="label">Decision question</span><input className="field" value={study.question} onChange={(event) => update(study.id, { question: event.target.value }, false)} placeholder="Which valid architecture should be selected?" /></label></div></section>
    <section className="card p-5"><h2 className="text-xl font-bold">Problem-space scope</h2><p className="mt-1 text-sm text-slate-600">Select one or more project working-scope use cases. Eligible stakeholders, needs and objectives are derived from canonical traceability; focus requirements are collected through derives relationships. All baseline obligations remain in the assessment.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 max-md:grid-cols-1"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="label">Inherited system of interest</div><strong>{projectScope.systemOfInterest?.name ?? "Exactly one system of interest must be designated"}</strong></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="label">Project working scope</div><strong>{activeUseCases.length} eligible use case{activeUseCases.length === 1 ? "" : "s"}</strong></div></div>
      <ScopeChoices title="Select the use cases included in this Trade Study" items={activeUseCases} selected={useCaseIds} onChange={(id, checked) => patchScope(needIds, study.objectiveIds, uniqueToggle(useCaseIds, id, checked))} empty="Select the project working scope in the model first." />
      <ScopeChoices title="Eligible needs" items={needs} selected={needIds} onChange={(id, checked) => patchScope(uniqueToggle(needIds, id, checked), study.objectiveIds, useCaseIds)} empty="Select a Trade Study use case with stakeholder-linked needs." />
      <ScopeChoices title="Eligible objectives" items={objectives} selected={study.objectiveIds} onChange={(id, checked) => patchScope(needIds, uniqueToggle(study.objectiveIds, id, checked), useCaseIds)} empty="Select a Trade Study use case with stakeholder-linked objectives." />
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 p-3"><div className="label">Requirements highlighted by study focus</div></div>{study.mandatoryRequirementIds.length
        ? <ul aria-label="Requirements highlighted by study focus" className="divide-y divide-slate-200">{study.mandatoryRequirementIds.map((id) => <li className="px-3 py-2 text-sm text-slate-700" key={id}>{project.elements.find((item) => item.id === id)?.name ?? id}</li>)}</ul>
        : <p className="p-3 text-sm text-slate-500">No requirement is traced from the selected needs and objectives.</p>}</div>
      {(projectScope.invalidUseCaseIds.length > 0 || project.elements.filter((element) => ["need", "objective"].includes(element.elementType)).length > needs.length + objectives.length) && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Scope filtering excludes unrelated project content. {projectScope.invalidUseCaseIds.length > 0 ? `${projectScope.invalidUseCaseIds.length} project-selected use case(s) do not involve the system of interest. ` : ""}{project.elements.filter((element) => ["need", "objective"].includes(element.elementType)).length - needs.length - objectives.length} need/objective item(s) are outside the selected use-case stakeholder context.</div>}
    </section>
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><h2 className="font-bold">Reference baseline and retained requirements</h2><p className="mt-2">The reference baseline is the accepted design from which proposed changes are compared. Every alternative is checked against all {baselineRequirementIds(project, study).length} established requirements; the selected study focus only highlights the {study.mandatoryRequirementIds.length} requirements most relevant to this decision.</p><p className="mt-2 text-xs text-blue-800">Changing the reference changes the design and evidence used as the comparison starting point. It does not remove requirements or select the preferred successor.</p><label className="mt-3 block"><span className="label text-blue-900">Design used as reference</span><select className="field mt-1" value={study.referenceArchitectureId ?? ""} onChange={(event) => update(study.id, { referenceArchitectureId: event.target.value || undefined }, true)}><option value="">Select reference…</option>{project.architectures.filter((item) => !item.archivedAt).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>
    <section className="card p-5"><h2 className="text-xl font-bold">Variability axes and feature-model foundation</h2><p className="mt-1 text-sm text-slate-600">The project has one shared Root Feature. Each reusable axis owns one synchronized major FeatureGroup.</p>
      {rootFeatures.length === 0 ? <div className="mt-4 flex max-w-2xl gap-2"><input className="field" value={rootName} onChange={(event) => setRootName(event.target.value)} placeholder="Root Feature name" /><button className="btn btn-primary" onClick={createRoot}>Create Root Feature</button></div> : rootFeatures.length > 1 ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Resolve the feature model to exactly one Root Feature.</p> : <div className="mt-4 grid max-w-2xl grid-cols-[1fr_auto] gap-2"><input className="field" value={root!.name} onChange={(event) => updateFeature(root!.id, { name: event.target.value })} /><button className="btn" onClick={() => update(study.id, { rootFeatureId: root!.id }, true)}>{study.rootFeatureId === root!.id ? "Root linked" : "Link shared Root"}</button></div>}
      <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-2 max-md:grid-cols-1"><input className="field" value={axisName} onChange={(event) => setAxisName(event.target.value)} placeholder="Variation axis name" /><input className="field" value={axisDescription} onChange={(event) => setAxisDescription(event.target.value)} placeholder="What design choice varies?" /><button className="btn btn-primary" disabled={!root || !axisName.trim()} onClick={() => createAxis()}>Add axis</button></div>
      {adoptableGroups.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="text-sm font-semibold text-amber-900">Existing FeatureGroups available for adoption</div><div className="mt-2 flex flex-wrap gap-2">{adoptableGroups.map((group) => <button className="btn bg-white" key={group.id} onClick={() => createAxis(group.id)}>Adopt {group.name}</button>)}</div></div>}
      <div className="mt-4 space-y-2">{project.variabilityAxes.map((axis) => <article className={`rounded-lg border p-3 ${selectedAxisIds.includes(axis.id) ? "border-purple-300 bg-purple-50" : "border-slate-200"}`} key={axis.id}><div className="flex flex-wrap items-center gap-2"><input type="checkbox" checked={selectedAxisIds.includes(axis.id)} onChange={(event) => update(study.id, { rootFeatureId: root?.id, selectedVariabilityAxisIds: uniqueToggle(selectedAxisIds, axis.id, event.target.checked) }, true)} /><input className="field min-w-52 flex-1" defaultValue={axis.name} onBlur={(event) => setMessage(updateVariabilityAxis(axis.id, { name: event.target.value }) ?? "Axis and FeatureGroup synchronized.")} /><input className="field min-w-72 flex-[2]" defaultValue={axis.description} onBlur={(event) => setMessage(updateVariabilityAxis(axis.id, { description: event.target.value }) ?? "Axis description saved.")} /><button className="btn btn-danger" onClick={async () => { if (await confirm(`Delete axis "${axis.name}"?`, { confirmLabel: "Delete", tone: "danger" })) setMessage(deleteVariabilityAxis(axis.id) ?? "Axis and empty FeatureGroup deleted."); }}><Trash2 size={14} /></button></div><div className="mt-1 text-xs text-slate-500">Linked FeatureGroup: {project.featureGroups.find((group) => group.id === axis.featureGroupId)?.name ?? "Missing"}</div></article>)}</div>
    </section>
    <section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Evaluation KPIs</h2><p className="mt-1 text-sm text-slate-600">Create reusable KPI definitions and select only KPIs that measure an objective in the active Trade Study scope.</p></div><button className="btn" onClick={() => setUnitDialogOpen(true)}><Ruler size={16} /> Project units</button></div>
      <div className="mt-4 rounded-xl border border-slate-200 p-4"><h3 className="font-bold">Create and select KPI</h3>
        <div className="mt-3 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          <label><span className="label">KPI name</span><input className="field" value={kpiName} onChange={(event) => setKpiName(event.target.value)} /></label>
          <label><span className="label">Calculation method</span><select className="field" value={kpiMode} onChange={(event) => setKpiMode(event.target.value as KPI["calculationMode"])}><option value="formula">Formula</option><option value="standardAlgorithm">Standard algorithm</option></select></label>
          {kpiMode === "standardAlgorithm" && <label><span className="label">Standard algorithm</span><select className="field" value={kpiAlgorithm} onChange={(event) => setKpiAlgorithm(event.target.value as StandardAlgorithmKey)}>{algorithms.map((key) => <option key={key}>{key}</option>)}</select></label>}
          <label><span className="label">Output unit</span><input className="field" value={kpiUnit} onChange={(event) => setKpiUnit(event.target.value)} placeholder="kg, EUR, h…" /></label>
          <label><span className="label">Optimization direction</span><select className="field" value={kpiDirection} onChange={(event) => setKpiDirection(event.target.value as KPI["optimizationDirection"])}><option value="minimize">Minimize</option><option value="maximize">Maximize</option></select></label>
          <label><span className="label">Global weight</span><input className="field" type="number" min="0" value={kpiWeight} onChange={(event) => setKpiWeight(Number(event.target.value))} /><span className="mt-1 block text-[11px] text-slate-500">Relative contribution after normalization.</span></label>
          <label><span className="label">Objective measured</span><select className="field" value={kpiObjectiveId} onChange={(event) => setKpiObjectiveId(event.target.value)}><option value="">Select a scoped objective…</option>{scopedObjectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.name}</option>)}</select></label>
        </div>
        {kpiMode === "formula" && <div className="mt-4"><KpiFormulaBuilder project={project} value={kpiFormula} onDraftChange={setKpiFormula} onSave={(formula) => { setKpiFormula(formula); setMessage("New KPI formula validated."); }} alternativeConfigurationIds={selectedAlternativeConfigurationIds} /></div>}
        <button className="btn btn-primary mt-4" onClick={createKpi}>Create and select KPI</button>
        {!scopedObjectives.length && <p className="mt-2 text-sm text-amber-700">Select at least one eligible objective in the Problem-space scope before creating a KPI.</p>}
      </div>
      <div className="mt-4 space-y-3">{project.kpis.map((kpi) => {
        const linkedScopedObjectives = scopedObjectives.filter((objective) => kpi.objectiveIds.includes(objective.id));
        const eligible = linkedScopedObjectives.length > 0;
        const selected = study.selectedKpiIds.includes(kpi.id);
        const normalizedWeight = selected && totalSelectedWeight > 0 ? 100 * Math.max(0, kpi.weight) / totalSelectedWeight : 0;
        return <article key={kpi.id} className={`rounded-xl border p-4 ${selected ? "border-blue-300 bg-blue-50" : eligible ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}>
          <div className="flex items-start gap-3"><input className="mt-7" aria-label={`Select ${kpi.name}`} type="checkbox" checked={selected} disabled={!eligible && !selected} onChange={(event) => toggleKpi(kpi.id, event.target.checked)} /><div className="min-w-0 flex-1">
            <div className="grid grid-cols-5 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
              <label><span className="label">KPI name</span><input className="field" value={kpi.name} onChange={(event) => updateKpi(kpi.id, { name: event.target.value })} /></label>
              <label><span className="label">Calculation method</span><select className="field" value={kpi.calculationMode} onChange={(event) => updateKpi(kpi.id, event.target.value === "formula" ? { calculationMode: "formula", formula: kpi.formula || "1", standardAlgorithmKey: undefined } : { calculationMode: "standardAlgorithm", formula: undefined, standardAlgorithmKey: kpi.standardAlgorithmKey || "totalMass" })}><option value="formula">Formula</option><option value="standardAlgorithm">Standard algorithm</option></select></label>
              <label><span className="label">Output unit</span><input className="field" value={kpi.outputUnit} onChange={(event) => updateKpi(kpi.id, { outputUnit: event.target.value })} /></label>
              <label><span className="label">Optimization direction</span><select className="field" value={kpi.optimizationDirection} onChange={(event) => updateKpi(kpi.id, { optimizationDirection: event.target.value as KPI["optimizationDirection"] })}><option value="minimize">Minimize</option><option value="maximize">Maximize</option></select></label>
              <label><span className="label">Global weight</span><input className="field" type="number" min="0" value={kpi.weight} onChange={(event) => updateKpi(kpi.id, { weight: Number(event.target.value) })} /><span className="mt-1 block text-[11px] text-slate-500">{selected ? `${normalizedWeight.toFixed(1)}% of selected KPI weight` : "Select this KPI to include its weight"}</span></label>
            </div>
            {kpi.calculationMode === "formula" ? <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-purple-800">Edit guided formula · <code>{kpi.formula}</code></summary><div className="mt-3"><KpiFormulaBuilder project={project} value={kpi.formula ?? ""} excludeKpiId={kpi.id} alternativeConfigurationIds={selectedAlternativeConfigurationIds} onSave={(formula, refs) => { updateKpi(kpi.id, { formula, inputParameterIds: refs.parameterIds, dependsOnKpiIds: refs.kpiIds, standardAlgorithmKey: undefined }); setMessage("KPI formula validated and saved."); }} saveLabel="Validate and save formula" /></div></details> : <label className="mt-3 block max-w-md"><span className="label">Standard algorithm</span><select className="field" value={kpi.standardAlgorithmKey} onChange={(event) => updateKpi(kpi.id, { standardAlgorithmKey: event.target.value as StandardAlgorithmKey })}>{algorithms.map((key) => <option key={key}>{key}</option>)}</select></label>}
            <fieldset className="mt-3"><legend className="label">Objective measured</legend><div className="flex flex-wrap gap-2">{scopedObjectives.map((objective) => <label className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" key={objective.id}><input className="mr-1" type="checkbox" checked={kpi.objectiveIds.includes(objective.id)} onChange={(event) => updateKpi(kpi.id, { objectiveIds: uniqueToggle(kpi.objectiveIds, objective.id, event.target.checked) })} />{objective.name}</label>)}{!scopedObjectives.length && <span className="text-sm text-amber-700">No scoped objective is available.</span>}</div></fieldset>
            {!eligible && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-100 p-2 text-sm text-amber-900">This KPI is not linked to an objective selected in the active Trade Study and cannot qualify for execution.</p>}
          </div></div>
        </article>;
      })}</div>
      {study.selectedKpiIds.length > 0 && totalSelectedWeight <= 0 && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">At least one selected KPI must have a positive global weight.</p>}
    </section>
    {message && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" aria-live="polite">{message}</p>}
    {unitDialogOpen && <UnitCatalogueDialog onClose={() => setUnitDialogOpen(false)} />}
  </div>;
}

function AlternativeSelection({ study, update }: { study: ComparisonStudy; update: (id: string, patch: Partial<ComparisonStudy>, calculationAffecting?: boolean) => void }) {
  const project = useAppStore(selectActiveProject)!;
  const setConfiguration = (configurationId: string, selected: boolean) => {
    const configuration = project.configurations.find((item) => item.id === configurationId)!;
    if (!selected) {
      update(study.id, { candidateRefs: study.candidateRefs.filter((item) => item.configurationId !== configurationId), alternativeRefs: study.alternativeRefs.filter((item) => item.configurationId !== configurationId) }, true);
      return;
    }
    const run = compatibleCurrentRun(project, configurationId, study.selectedKpiIds);
    if (!run) return;
    const candidate = study.candidateRefs.find((item) => item.configurationId === configurationId);
    const alternative = study.alternativeRefs.find((item) => item.configurationId === configurationId);
    update(study.id, {
      candidateRefs: [...study.candidateRefs.filter((item) => item.configurationId !== configurationId), { id: candidate?.id ?? `candidate-${crypto.randomUUID()}`, label: configuration.name, configurationId, architectureId: configuration.architectureId }],
      alternativeRefs: [...study.alternativeRefs.filter((item) => item.configurationId !== configurationId), { id: alternative?.id ?? `alternative-${crypto.randomUUID()}`, label: configuration.name, configurationId, architectureId: configuration.architectureId, simulationRunId: run.id }]
    }, true);
  };
  return <section className="card p-5"><h2 className="text-xl font-bold">Select configuration-derived alternatives</h2><p className="mt-1 text-sm text-slate-600">Step 7 begins here. Only valid configurations with current saved 100% derivations and complete simulations for every selected KPI are eligible.</p><div className="mt-4 space-y-2">{project.configurations.filter((item) => !item.archivedAt).map((configuration) => {
    const run = compatibleCurrentRun(project, configuration.id, study.selectedKpiIds);
    const selected = study.alternativeRefs.some((item) => item.configurationId === configuration.id);
    return <label key={configuration.id} className={`flex items-start gap-3 rounded-lg border p-3 ${selected ? "border-green-300 bg-green-50" : "border-slate-200"}`}><input className="mt-1" type="checkbox" checked={selected} disabled={!run && !selected} onChange={(event) => setConfiguration(configuration.id, event.target.checked)} /><div className="min-w-0 flex-1"><strong>{configuration.name}</strong><div className={`mt-1 text-xs ${run ? "text-green-700" : "text-red-700"}`}>{run ? `Ready · current simulation ${run.name}` : "Blocked · validate, derive and simulate all selected KPIs first"}</div></div>{selected && run && study.alternativeRefs.find((item) => item.configurationId === configuration.id)?.simulationRunId !== run.id && <button type="button" className="btn" onClick={() => setConfiguration(configuration.id, true)}>Use latest current run</button>}</label>;
  })}</div><p className="mt-3 text-sm font-semibold">{study.alternativeRefs.length}/2 minimum alternatives selected</p></section>;
}

function ScopeChoices({ title, items, selected, onChange, empty = "No model item exists." }: { title: string; items: Array<{ id: string; name: string }>; selected: string[]; onChange: (id: string, checked: boolean) => void; empty?: string }) {
  return <fieldset className="mt-4"><legend className="label">{title}</legend><div className="flex flex-wrap gap-2">{items.map((item) => <label key={item.id} className={`rounded-lg border px-3 py-2 text-sm ${selected.includes(item.id) ? "border-purple-300 bg-purple-50" : "border-slate-200"}`}><input className="mr-2" type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange(item.id, event.target.checked)} />{item.name}</label>)}{!items.length && <span className="text-sm text-amber-700">{empty}</span>}</div></fieldset>;
}

function resultLeaders(result: ComparisonResult) {
  return result.recommendedAlternativeIds ?? leadingAlternativeIds(result.weightedScores);
}

function ManagerComparison({ study, result }: { study: ComparisonStudy; result?: ComparisonResult }) {
  const project = useAppStore(selectActiveProject)!;
  if (!result) return <EmptyResult />;
  const leaders = resultLeaders(result);
  const feasible = study.alternativeRefs.filter((item) => result.feasibility?.[item.id]?.status === "feasible");
  const ranked = [...feasible].sort((left, right) => (result.weightedScores[right.id] ?? -Infinity) - (result.weightedScores[left.id] ?? -Infinity));
  return <div className="space-y-4"><section className="card overflow-hidden"><div className="bg-slate-950 p-6 text-white"><div className="text-xs font-semibold uppercase tracking-widest text-blue-300">Decision at a glance</div><h2 className="mt-2 text-2xl font-bold">{study.question}</h2><p className="mt-2 text-sm text-slate-300">Requirement feasibility is evaluated before KPI scoring. Infeasible alternatives remain visible but cannot be preferred.</p></div><div className="grid grid-cols-3 gap-px bg-slate-200 max-md:grid-cols-1"><Summary label="Alternatives" value={String(study.alternativeRefs.length)} /><Summary label="Feasible" value={String(feasible.length)} /><Summary label="Highest feasible score" value={leaders.map((id) => study.alternativeRefs.find((item) => item.id === id)?.label ?? id).join(", ") || "None"} /></div></section>
    <section className="card p-5"><h2 className="text-lg font-bold">Feasibility and ranking</h2><div className="mt-4 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Rank</th><th>Alternative</th><th>Requirement feasibility</th><th>Weighted score</th><th>Decision eligibility</th></tr></thead><tbody>{study.alternativeRefs.map((alternative) => {
      const status = result.feasibility?.[alternative.id]?.status ?? "unknown";
      const rank = ranked.findIndex((item) => item.id === alternative.id) + 1;
      return <tr key={alternative.id}><td>{rank || "—"}</td><th>{alternative.label}</th><td>{status}<div className="text-xs text-slate-500">{result.feasibility?.[alternative.id]?.requirementEvidence.length ?? 0} obligations assessed</div></td><td>{format(result.weightedScores[alternative.id])} / 100</td><td>{status === "feasible" ? result.feasibility?.[alternative.id]?.requirementEvidence.some((item) => item.basis === "assumption") ? "Eligible with reviewed demonstration evidence" : "Eligible" : "Not eligible"}</td></tr>;
    })}</tbody></table></div></section>
    <section className="card p-5"><h2 className="text-lg font-bold">KPI comparison</h2><div className="mt-4 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Alternative</th>{study.selectedKpiIds.map((id) => <th key={id}>{project.kpis.find((kpi) => kpi.id === id)?.name ?? id}</th>)}<th>Score</th></tr></thead><tbody>{study.alternativeRefs.map((alternative) => <tr key={alternative.id}><th>{alternative.label}</th>{study.selectedKpiIds.map((id) => { const kpi = project.kpis.find((item) => item.id === id); return <td key={id}>{format(result.rawValues[alternative.id]?.[id], kpi?.outputUnit)}</td>; })}<td>{format(result.weightedScores[alternative.id])}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function ExpertComparison({ study, result }: { study: ComparisonStudy; result?: ComparisonResult }) {
  const project = useAppStore(selectActiveProject)!;
  if (!result) return <EmptyResult />;
  return <div className="space-y-4"><section className="card p-5"><h2 className="text-xl font-bold">Expert evidence ledger</h2><p className="mt-1 text-sm text-slate-600">Immutable result {result.id} · revision {result.inputProjectModelRevision} · {result.timestamp}</p><div className="mt-4 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Alternative</th><th>KPI</th><th>Raw evidence</th><th>Normalized</th><th>Global weight</th><th>Contribution</th><th>Formula and provenance</th></tr></thead><tbody>{study.alternativeRefs.flatMap((alternative) => study.selectedKpiIds.map((kpiId) => {
    const kpi = project.kpis.find((item) => item.id === kpiId);
    const run = project.simulationRuns.find((item) => item.id === alternative.simulationRunId);
    return <tr key={`${alternative.id}-${kpiId}`}><th>{alternative.label}</th><td>{kpi?.name ?? kpiId}</td><td>{format(result.rawValues[alternative.id]?.[kpiId], kpi?.outputUnit)}</td><td>{format(result.normalizedScores[alternative.id]?.[kpiId])}</td><td>{kpi?.weight ?? "Missing"}</td><td>{format(result.weightedContributions?.[alternative.id]?.[kpiId])}</td><td className="min-w-80 text-xs">{result.calculationExplanations?.[alternative.id]?.[kpiId]} Run {run?.id ?? "missing"}; derivation {run?.derivationId ?? "missing"}; KPI formula {kpi?.formula || kpi?.standardAlgorithmKey || "not defined"}.</td></tr>;
  }))}</tbody></table></div></section>
    <section className="card p-5"><h2 className="text-lg font-bold">Requirement evidence</h2><div className="mt-4 grid grid-cols-2 gap-3 max-lg:grid-cols-1">{study.alternativeRefs.map((alternative) => <article key={alternative.id} className="rounded-lg border p-3"><div className="flex items-center gap-2"><strong>{alternative.label}</strong>{result.feasibility?.[alternative.id]?.status === "feasible" ? <CheckCircle2 size={16} className="text-green-700" /> : <XCircle size={16} className="text-red-700" />}</div>{result.feasibility?.[alternative.id]?.requirementEvidence.map((item) => <div className="mt-2 text-sm" key={item.requirementId}><div className="font-semibold">{item.requirementName} · {item.status}</div><div className="text-xs text-slate-600">{item.expression ?? "No formula"} · {item.evidence}</div></div>)}</article>)}</div></section>
  </div>;
}

function DecisionPanel({ study, result }: { study: ComparisonStudy; result?: ComparisonResult }) {
  const project = useAppStore(selectActiveProject)!;
  const createDecision = useAppStore((state) => state.createDecisionFromComparison);
  const updateDecision = useAppStore((state) => state.updateDecision);
  const confirmSelection = useAppStore((state) => state.confirmDecisionSelection);
  const [message, setMessage] = useState("");
  const decision = project.decisions.find((item) => item.supportingComparisonStudyIds.includes(study.id));
  const eligible = useMemo(() => study.alternativeRefs.filter((alternative) => result?.feasibility?.[alternative.id]?.status === "feasible"), [result, study.alternativeRefs]);
  if (!result) return <EmptyResult />;
  if (!decision) return <section className="card p-8 text-center"><h2 className="text-xl font-bold">Record the explicit decision</h2><p className="mt-2 text-slate-600">Create a draft linked to the immutable comparison result. The user must confirm a feasible selection and provide the rationale.</p><button className="btn btn-primary mt-4" onClick={() => { const id = createDecision(study.id); setMessage(id ? "Draft decision created." : "Decision could not be created."); }}><Plus size={14} /> Create decision from comparison</button>{message && <p className="mt-3 text-sm">{message}</p>}</section>;
  const save = (patch: Partial<Decision>) => setMessage(updateDecision(decision.id, patch) ?? "Saved.");
  return <section className="card p-5"><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Decision and rationale</h2><p className="mt-1 text-sm text-slate-600">Only requirement-feasible alternatives are eligible. One feasible alternative is sufficient, with an explicit no-competitive-ranking notice.</p></div><span className="badge bg-blue-50 text-blue-800">{decision.status}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1"><label><span className="label">Selected feasible alternative</span><select className="field" value={decision.selectedAlternative ?? ""} onChange={(event) => save({ selectedAlternative: event.target.value || undefined, status: "draft" })}><option value="">Select explicitly</option>{eligible.map((alternative) => <option key={alternative.id}>{alternative.label}</option>)}</select></label><label><span className="label">Owner</span><input className="field" value={decision.owner ?? ""} onChange={(event) => save({ owner: event.target.value })} /></label><label className="col-span-2 max-md:col-span-1"><span className="label">Rationale</span><textarea className="field min-h-28" value={decision.rationale ?? ""} onChange={(event) => save({ rationale: event.target.value })} /></label><label className="col-span-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm max-md:col-span-1"><input type="checkbox" checked={decision.baselineApprovalConfirmed ?? false} onChange={(event) => save({ baselineApprovalConfirmed: event.target.checked })} />Confirm that approval establishes the selected architecture baseline.</label></div>
    {eligible.length === 1 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Only one alternative is feasible; no competitive feasible ranking exists.</p>}
    <div className="mt-4 flex flex-wrap gap-2">{decision.selectedAlternative && decision.status === "draft" && <button className="btn" onClick={() => setMessage(confirmSelection(decision.id, decision.selectedAlternative!) ?? "Selection confirmed as proposed.")}><Save size={14} /> Confirm selection</button>}<button className="btn btn-primary" disabled={!decision.selectedAlternative || !decision.rationale?.trim() || !decision.baselineApprovalConfirmed} onClick={() => save({ status: "approved", decisionDate: new Date().toISOString() })}><CheckCircle2 size={14} /> Approve decision</button></div>
    {message && <p className={`mt-3 text-sm ${message === "Saved." ? "text-green-700" : "text-amber-800"}`} aria-live="polite">{message}</p>}
  </section>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 font-bold">{value}</div></div>;
}

function EmptyResult() {
  return <section className="card p-8 text-center text-slate-500">Run the comparison after every selected configuration has a current 100% derivation and complete simulation results.</section>;
}
