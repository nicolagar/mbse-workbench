import { CheckCircle2, Copy, ExternalLink, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import type {
  ComparisonStudy,
  StakeholderValueFunction,
  StudyCriterion,
  UiPreferences,
  WorkspaceId
} from "../domain/types";
import {
  mixedEvidenceWarning,
  tradeStudyReadiness,
  tradeStudyWorkflow
} from "../domain/tradeStudy";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

const uniqueToggle = (values: string[], id: string, selected: boolean) =>
  selected ? [...new Set([...values, id])] : values.filter((value) => value !== id);

export function GuidedTradeStudyWorkflow({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setTradeStudyTab = useAppStore((state) => state.setTradeStudyTab);
  const steps = tradeStudyWorkflow(project, study);
  return <section className="card p-5">
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold">Architecture Trade Study</h2>
        <p className="mt-1 text-sm text-slate-600">Guided but flexible: frame the decision before creating alternatives, then establish feasibility, comparable evidence and an explicit baseline decision.</p>
      </div>
      <span className="badge bg-purple-50 text-purple-700">{steps.filter((step) => step.complete).length}/{steps.length} complete</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
      {steps.map((step) => <button key={step.id} className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow ${step.complete ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`} onClick={() => {
        setWorkspace(step.workspace);
        if (step.workspace === "comparison") setTradeStudyTab(step.tab as UiPreferences["activeTradeStudyTab"]);
      }}>
        <div className="flex items-start gap-3">
          {step.complete ? <CheckCircle2 className="mt-0.5 shrink-0 text-green-700" size={18} /> : <XCircle className="mt-0.5 shrink-0 text-amber-700" size={18} />}
          <div><h3 className="font-bold">{step.label}</h3><p className="mt-1 text-sm text-slate-600">{step.detail}</p></div>
        </div>
      </button>)}
    </div>
  </section>;
}

export function TradeStudyFraming({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const update = useAppStore((state) => state.updateComparisonStudy);
  const patch = (value: Partial<ComparisonStudy>, calculationAffecting = false) =>
    update(study.id, value, calculationAffecting);
  const objectives = project.elements.filter((element) => element.elementType === "objective");
  const requirements = project.elements.filter((element) => element.elementType === "systemRequirement");
  const selectedNeeds = project.elements.filter((element) =>
    element.elementType === "need"
    && (
      project.relationships.some((relationship) =>
        relationship.sourceId === element.id
        && study.objectiveIds.includes(relationship.targetId)
      )
      || project.relationships.some((needTrace) =>
        needTrace.sourceId === element.id
        && project.relationships.some((objectiveTrace) =>
          study.objectiveIds.includes(objectiveTrace.sourceId)
          && objectiveTrace.targetId === needTrace.targetId
        )
      )
    )
  );
  const createCriterion = () => {
    const criterion: StudyCriterion = {
      id: `criterion-${crypto.randomUUID()}`,
      name: "New decision criterion",
      description: "",
      type: "optimization",
      sourceObjectiveIds: study.objectiveIds.slice(0, 1),
      sourceRequirementIds: [],
      weight: 1,
      valueFunction: "maximize",
      stakeholderValueFunction: { type: "maximize", worst: 0, best: 100 }
    };
    patch({ criteria: [...study.criteria, criterion] }, true);
  };
  const updateCriterion = (id: string, criterionPatch: Partial<StudyCriterion>, calculationAffecting = true) =>
    patch({
      criteria: study.criteria.map((criterion) =>
        criterion.id === id ? { ...criterion, ...criterionPatch, id } : criterion
      )
    }, calculationAffecting);

  return <div className="space-y-4">
    <section className="card p-5">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Frame the unresolved decision</h2><p className="mt-1 text-sm text-slate-600">The Open Decision initiates the Trade Study. A formal Decision is created only after evidence has been analyzed.</p></div><span className="badge bg-blue-50 text-blue-700">{study.status}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <label><span className="label">Trade Study name</span><input className="field" value={study.name} onChange={(event) => patch({ name: event.target.value })} /></label>
        <label><span className="label">Originating Open Decision</span><select className="field" value={study.originatingOpenDecisionId ?? ""} onChange={(event) => {
          const openDecision = project.openDecisions.find((decision) => decision.id === event.target.value);
          patch({
            originatingOpenDecisionId: event.target.value || undefined,
            question: openDecision?.question ?? study.question
          });
        }}><option value="">Select an unresolved planning question</option>{project.openDecisions.map((decision) => <option key={decision.id} value={decision.id}>{decision.question} · {decision.status}</option>)}</select></label>
        <label className="col-span-2 max-md:col-span-1"><span className="label">Decision question</span><input className="field" value={study.question} onChange={(event) => patch({ question: event.target.value })} /></label>
        <label className="col-span-2 max-md:col-span-1"><span className="label">Intended outcome</span><textarea className="field min-h-20" value={study.intendedOutcome} onChange={(event) => patch({ intendedOutcome: event.target.value })} /></label>
        <label><span className="label">Lifecycle scope</span><input className="field" value={study.lifecycleScope} onChange={(event) => patch({ lifecycleScope: event.target.value })} /></label>
        <label><span className="label">System scope</span><input className="field" value={study.systemScope} onChange={(event) => patch({ systemScope: event.target.value })} /></label>
        <label><span className="label">Lifecycle status</span><select className="field" value={study.status} onChange={(event) => patch({ status: event.target.value as ComparisonStudy["status"] })}><option value="framing">Framing</option><option value="definingCandidates">Defining candidates</option><option value="collectingEvidence">Collecting evidence</option><option value="ready">Ready</option><option value="analyzed">Analyzed</option><option value="decided">Decided</option></select></label>
        <label><span className="label">Description</span><input className="field" value={study.description} onChange={(event) => patch({ description: event.target.value })} /></label>
      </div>
    </section>

    <section className="card p-5">
      <h2 className="text-lg font-bold">Needs and authoritative objectives</h2>
      <p className="mt-1 text-sm text-slate-600">Objectives are first-class model elements. Related needs are shown from canonical model relationships; the legacy project string list is only a read-only compatibility projection.</p>
      <fieldset className="mt-4"><legend className="label">Objectives addressed by this Trade Study</legend><div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">{objectives.map((objective) => <label key={objective.id} className={`rounded-lg border p-3 text-sm ${study.objectiveIds.includes(objective.id) ? "border-purple-300 bg-purple-50" : "border-slate-200"}`}><input className="mr-2" type="checkbox" checked={study.objectiveIds.includes(objective.id)} onChange={(event) => patch({ objectiveIds: uniqueToggle(study.objectiveIds, objective.id, event.target.checked) })} /><strong>{objective.name}</strong><span className="ml-2 text-xs text-slate-500">{objective.id}</span></label>)}</div></fieldset>
      <div className="mt-4 rounded-lg bg-slate-50 p-3"><div className="label">Related needs derived from model traceability</div><p className="text-sm text-slate-700">{selectedNeeds.map((need) => need.name).join(" · ") || "No need-to-selected-objective trace is currently available."}</p></div>
    </section>

    <section className="card p-5">
      <h2 className="text-lg font-bold">Mandatory feasibility requirements</h2>
      <p className="mt-1 text-sm text-slate-600">Requirements define whether a candidate is feasible; they are not folded into the preference chain.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 max-md:grid-cols-1">{requirements.map((requirement) => <label key={requirement.id} className={`rounded-lg border p-3 text-sm ${study.mandatoryRequirementIds.includes(requirement.id) ? "border-red-300 bg-red-50" : "border-slate-200"}`}><input className="mr-2" type="checkbox" checked={study.mandatoryRequirementIds.includes(requirement.id)} onChange={(event) => patch({ mandatoryRequirementIds: uniqueToggle(study.mandatoryRequirementIds, requirement.id, event.target.checked) })} />{requirement.name}</label>)}</div>
    </section>

    <section className="card p-5">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-lg font-bold">Study criteria</h2><p className="mt-1 text-sm text-slate-600">Mandatory requirements screen feasibility. Optimization criteria use fixed 0–100 stakeholder value functions and study-specific weights; they never alter global KPI definitions.</p></div><button className="btn btn-primary" onClick={createCriterion}><Plus size={15} /> Criterion</button></div>
      <div className="mt-4 space-y-3">{study.criteria.map((criterion) => <article className="rounded-xl border p-4" key={criterion.id}>
        <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          <label><span className="label">Name</span><input className="field" value={criterion.name} onChange={(event) => updateCriterion(criterion.id, { name: event.target.value }, false)} /></label>
          <label><span className="label">Type</span><select className="field" value={criterion.type} onChange={(event) => {
            const type = event.target.value as StudyCriterion["type"];
            updateCriterion(criterion.id, {
              type,
              stakeholderValueFunction: type === "optimization"
                ? criterion.stakeholderValueFunction ?? { type: "maximize", worst: 0, best: 100 }
                : criterion.stakeholderValueFunction
            });
          }}><option value="mandatory">Mandatory</option><option value="optimization">Optimization</option><option value="context">Context</option></select></label>
          <label><span className="label">KPI used</span><select className="field" value={criterion.kpiId ?? ""} onChange={(event) => updateCriterion(criterion.id, { kpiId: event.target.value || undefined })}><option value="">No KPI</option>{project.kpis.map((kpi) => <option key={kpi.id} value={kpi.id}>{kpi.name}</option>)}</select></label>
          <label><span className="label">Required feature</span><select className="field" value={criterion.requiredFeatureId ?? ""} onChange={(event) => updateCriterion(criterion.id, { requiredFeatureId: event.target.value || undefined })}><option value="">No required feature</option>{project.features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select></label>
          <label className="col-span-2 max-md:col-span-1"><span className="label">Description</span><input className="field" value={criterion.description} onChange={(event) => updateCriterion(criterion.id, { description: event.target.value }, false)} /></label>
          <label><span className="label">Study weight</span><input className="field" type="number" min="0" step="0.1" value={criterion.weight ?? ""} onChange={(event) => updateCriterion(criterion.id, { weight: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
          {criterion.type === "optimization" && <ValueFunctionEditor criterion={criterion} onChange={(stakeholderValueFunction) =>
            updateCriterion(criterion.id, {
              stakeholderValueFunction,
              valueFunction: stakeholderValueFunction.type
            })
          } />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          <fieldset><legend className="label">Source objectives</legend><div className="flex flex-wrap gap-2">{objectives.map((objective) => <label className="rounded-lg border px-2 py-1 text-xs" key={objective.id}><input className="mr-1" type="checkbox" checked={criterion.sourceObjectiveIds.includes(objective.id)} onChange={(event) => updateCriterion(criterion.id, { sourceObjectiveIds: uniqueToggle(criterion.sourceObjectiveIds, objective.id, event.target.checked) })} />{objective.name}</label>)}</div></fieldset>
          <fieldset><legend className="label">Source requirements</legend><div className="flex flex-wrap gap-2">{requirements.map((requirement) => <label className="rounded-lg border px-2 py-1 text-xs" key={requirement.id}><input className="mr-1" type="checkbox" checked={criterion.sourceRequirementIds.includes(requirement.id)} onChange={(event) => updateCriterion(criterion.id, { sourceRequirementIds: uniqueToggle(criterion.sourceRequirementIds, requirement.id, event.target.checked) })} />{requirement.name}</label>)}</div></fieldset>
        </div>
        <button className="btn btn-danger mt-3" onClick={() => patch({ criteria: study.criteria.filter((item) => item.id !== criterion.id) }, true)}><Trash2 size={14} /> Delete criterion</button>
      </article>)}</div>
    </section>

    <section className="card p-5">
      <h2 className="text-lg font-bold">Explored features and design axes</h2>
      <p className="mt-1 text-sm text-slate-600">Select only variability intentionally explored by this decision; each candidate configuration still records its complete effective feature selection.</p>
      <div className="mt-3 grid grid-cols-3 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">{project.features.filter((feature) => feature.featureType !== "root").map((feature) => <label className={`rounded-lg border p-3 text-sm ${study.exploredFeatureIds.includes(feature.id) ? "border-blue-300 bg-blue-50" : "border-slate-200"}`} key={feature.id}><input className="mr-2" type="checkbox" checked={study.exploredFeatureIds.includes(feature.id)} onChange={(event) => patch({ exploredFeatureIds: uniqueToggle(study.exploredFeatureIds, feature.id, event.target.checked) })} />{feature.name}</label>)}</div>
    </section>
  </div>;
}

function ValueFunctionEditor({
  criterion,
  onChange
}: {
  criterion: StudyCriterion;
  onChange: (value: StakeholderValueFunction) => void;
}) {
  const value = criterion.stakeholderValueFunction ?? { type: "maximize", worst: 0, best: 100 };
  const number = (raw: string) => raw === "" ? undefined : Number(raw);
  const patch = (next: Partial<StakeholderValueFunction>) =>
    onChange({ ...value, ...next } as StakeholderValueFunction);
  return <>
    <label><span className="label">Fixed stakeholder value function</span><select className="field" value={value.type} onChange={(event) => {
      const type = event.target.value as StakeholderValueFunction["type"];
      onChange(type === "piecewiseLinear"
        ? { type, points: [{ input: 0, value: 0 }, { input: 100, value: 100 }] }
        : type === "target"
          ? { type, worst: 0, target: 50, best: 100 }
          : type === "acceptableRange"
            ? { type, worst: 0, acceptableMinimum: 40, acceptableMaximum: 60, best: 100 }
            : { type, worst: type === "minimize" ? 100 : 0, best: type === "minimize" ? 0 : 100 });
    }}><option value="maximize">Maximize</option><option value="minimize">Minimize</option><option value="target">Target</option><option value="acceptableRange">Acceptable range</option><option value="piecewiseLinear">Piecewise-linear curve</option></select></label>
    {value.type === "piecewiseLinear"
      ? <label className="col-span-2 max-md:col-span-1"><span className="label">Ordered input:value points</span><input className="field" value={(value.points ?? []).map((point) => `${point.input}:${point.value}`).join(", ")} onChange={(event) => {
        const points = event.target.value.split(",").map((item) => {
          const [input, output] = item.split(":").map(Number);
          return { input, value: output };
        }).filter((point) => Number.isFinite(point.input) && Number.isFinite(point.value));
        patch({ points });
      }} /><span className="mt-1 block text-xs text-slate-500">Example: 0:0, 30:40, 60:100. Inputs must increase; outputs remain 0–100.</span></label>
      : <>
        <label><span className="label">Worst-value bound (0 value)</span><input className="field" type="number" value={value.worst ?? ""} onChange={(event) => patch({ worst: number(event.target.value) })} /></label>
        <label><span className="label">Best-value bound (100 value)</span><input className="field" type="number" value={value.best ?? ""} onChange={(event) => patch({ best: number(event.target.value) })} /></label>
        {value.type === "target" && <label><span className="label">Target (100 value)</span><input className="field" type="number" value={value.target ?? ""} onChange={(event) => patch({ target: number(event.target.value) })} /></label>}
        {value.type === "acceptableRange" && <>
          <label><span className="label">Acceptable minimum</span><input className="field" type="number" value={value.acceptableMinimum ?? ""} onChange={(event) => patch({ acceptableMinimum: number(event.target.value) })} /></label>
          <label><span className="label">Acceptable maximum</span><input className="field" type="number" value={value.acceptableMaximum ?? ""} onChange={(event) => patch({ acceptableMaximum: number(event.target.value) })} /></label>
        </>}
      </>}
  </>;
}

export function TradeStudyCandidates({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const createCandidate = useAppStore((state) => state.createTradeStudyCandidate);
  const updateStudy = useAppStore((state) => state.updateComparisonStudy);
  const updateConfiguration = useAppStore((state) => state.updateConfiguration);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setVariabilityTab = useAppStore((state) => state.setVariabilityTab);
  const selectConfiguration = useAppStore((state) => state.selectConfiguration);
  const [sourceConfigurationId, setSourceConfigurationId] = useState(study.candidateRefs[0]?.configurationId ?? "");
  const [message, setMessage] = useState("");
  const readiness = tradeStudyReadiness(project, study);
  const mixedWarning = mixedEvidenceWarning(project, study);
  const create = (mode: "first" | "duplicate" | "different") => {
    const result = createCandidate(study.id, mode, sourceConfigurationId);
    setMessage(result.error ?? "Candidate created. Configure, validate and derive it before simulation.");
    if (result.candidateId) {
      const next = useAppStore.getState().projects.find((candidate) => candidate.id === project.id)
        ?.comparisonStudies.find((candidate) => candidate.id === study.id)
        ?.candidateRefs.find((candidate) => candidate.id === result.candidateId);
      if (next) setSourceConfigurationId(next.configurationId);
    }
  };
  const navigate = (item: CandidateReadinessItem) => {
    selectConfiguration(item.configurationId);
    setWorkspace(item.workspace);
    if (item.workspace === "variability") {
      setVariabilityTab(item.id === "derivation" || item.id === "modelRevision" ? "100% Realization" : "Configurator");
    }
  };
  return <div className="space-y-4">
    <section className="card p-5">
      <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Candidate creation</h2><p className="mt-1 text-sm text-slate-600">Candidates are named configurations with generated 100% architecture records and explicit Trade Study membership.</p></div><span className="badge bg-blue-50 text-blue-700">{study.candidateRefs.length} candidate(s)</span></div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <button className="btn btn-primary" disabled={study.candidateRefs.length > 0} onClick={() => create("first")}><Plus size={14} /> Create first candidate</button>
        <label className="min-w-64"><span className="label">Candidate to duplicate</span><select className="field" value={sourceConfigurationId} onChange={(event) => setSourceConfigurationId(event.target.value)}><option value="">Select candidate</option>{study.candidateRefs.map((candidate) => <option key={candidate.id} value={candidate.configurationId}>{candidate.label}</option>)}</select></label>
        <button className="btn" disabled={!sourceConfigurationId} onClick={() => create("duplicate")}><Copy size={14} /> Duplicate as another candidate</button>
        <button className="btn" onClick={() => create("different")}><Plus size={14} /> Create different candidate</button>
      </div>
      {message && <p className="mt-3 text-sm text-blue-800" aria-live="polite">{message}</p>}
    </section>

    {mixedWarning && <section className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900" role="alert">{mixedWarning}</section>}

    <section className="card overflow-hidden">
      <div className="p-5"><h2 className="text-lg font-bold">Evidence readiness</h2><p className="mt-1 text-sm text-slate-600">Ready requires a present configuration/architecture pair, valid configuration, current explicit derivation, current configured simulation, and complete coverage of the same required KPIs.</p></div>
      <div className="overflow-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead><tr><th>Candidate and membership</th><th>Configuration</th><th>Validation</th><th>100% derivation</th><th>Model revision</th><th>Simulation</th><th>Required KPI coverage</th><th>State / action</th></tr></thead><tbody>{readiness.map((item) => {
        const candidate = study.candidateRefs.find((reference) => reference.id === item.candidateId)!;
        const configuration = project.configurations.find((configuration) => configuration.id === item.configurationId);
        return <tr key={item.candidateId}>
          <td><input aria-label={`Candidate name ${item.label}`} className="field min-w-52" value={candidate.label} onChange={(event) => {
            const label = event.target.value;
            updateStudy(study.id, { candidateRefs: study.candidateRefs.map((reference) => reference.id === candidate.id ? { ...reference, label } : reference) }, false);
            if (configuration) updateConfiguration(configuration.id, { name: label });
          }} /><code className="mt-1 block text-[10px]">{candidate.id}</code></td>
          <ReadinessCell ready={item.configurationPresent} text={item.configurationPresent ? configuration?.name ?? "Present" : "Missing"} />
          <ReadinessCell ready={item.validationReady} text={item.validationReady ? "Valid" : configuration?.validationStatus ?? "Missing"} />
          <ReadinessCell ready={item.derivationReady} text={item.derivationReady ? "Current 100%" : "Missing / stale"} />
          <ReadinessCell ready={item.modelRevisionReady} text={item.modelRevisionReady ? `Revision ${project.modelRevision}` : `Needs revision ${project.modelRevision}`} />
          <ReadinessCell ready={item.simulationReady} text={item.simulationRunId ?? "Missing / stale"} />
          <ReadinessCell ready={item.kpiCoveragePercent === 100} text={`${item.coveredKpiIds.length}/${item.requiredKpiIds.length} · ${item.kpiCoveragePercent}%`} />
          <td><span className={`badge ${item.state === "Ready" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{item.state}</span>{item.missing[0] && <button className="btn mt-2 block" onClick={() => navigate({ ...item.missing[0], configurationId: item.configurationId })}><ExternalLink size={13} /> {item.missing[0].label}</button>}</td>
        </tr>;
      })}</tbody></table></div>
      {!readiness.length && <p className="p-5 text-sm text-slate-500">Create the first candidate to begin readiness assessment.</p>}
    </section>
  </div>;
}

type CandidateReadinessItem = {
  id: "configuration" | "validation" | "derivation" | "modelRevision" | "simulation" | "kpiCoverage" | "consistency";
  label: string;
  workspace: WorkspaceId;
  configurationId: string;
};

function ReadinessCell({ ready, text }: { ready: boolean; text: string }) {
  return <td><span className={`inline-flex items-center gap-1 ${ready ? "text-green-700" : "text-red-700"}`}>{ready ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{text}</span></td>;
}
