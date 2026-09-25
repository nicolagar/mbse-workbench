import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import { AlertTriangle, CheckCircle2, Play, Plus, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  inherentExposure,
  residualExposure,
  riskBand,
  summarizeRisks
} from "../domain/tradeStudyMethodology";
import type {
  ComparisonScenario,
  ComparisonStudy,
  ParetoAlternativeResult
} from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { useDialogs } from "./dialogs/DialogProvider";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const format = (value: number | null | undefined, unit = "") =>
  finite(value) ? `${value.toFixed(2)}${unit ? ` ${unit}` : ""}` : "Missing";

function latestFixedResult(study: ComparisonStudy) {
  return [...study.results].reverse().find((result) => result.methodology === "fixed-smart-mavt");
}

function alternativeName(study: ComparisonStudy, id: string) {
  return study.alternativeRefs.find((alternative) => alternative.id === id)?.label ?? id;
}

function paretoLabel(item?: ParetoAlternativeResult) {
  if (!item) return "Not analyzed";
  return item.status === "nonDominated"
    ? "Non-dominated"
    : item.status === "dominated"
      ? "Dominated"
      : item.status === "infeasible"
        ? "Outside feasible set"
        : "Unknown";
}

export function ManagerTradeStudySummary({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const result = latestFixedResult(study);
  const decision = project.decisions.find((item) => item.supportingComparisonStudyIds.includes(study.id));
  const risks = summarizeRisks(project, study);
  const robustness = study.robustnessResults?.at(-1);
  const stable = robustness
    ? robustness.cases.every((item) => !item.recommendationChanged)
    : undefined;
  const twoKpis = study.criteria.filter((criterion) => criterion.type === "optimization" && criterion.kpiId).slice(0, 2);
  const chartData = result && twoKpis.length === 2
    ? study.alternativeRefs.map((alternative) => ({
        name: alternative.label,
        x: result.rawValues[alternative.id]?.[twoKpis[0].kpiId!],
        y: result.rawValues[alternative.id]?.[twoKpis[1].kpiId!],
        feasible: result.feasibility?.[alternative.id]?.status === "feasible"
      })).filter((item) => finite(item.x) && finite(item.y))
    : [];
  const leaderNames = (result?.recommendedAlternativeIds ?? []).map((id) => alternativeName(study, id));
  return <div className="space-y-4">
    <section className="card overflow-hidden">
      <div className="bg-slate-950 p-6 text-white">
        <div className="text-xs font-semibold uppercase tracking-widest text-blue-300">Decision at a glance</div>
        <h2 className="mt-2 text-2xl font-bold">{study.question || "Decision question not framed"}</h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-300">{study.intendedOutcome}</p>
      </div>
      <div className="grid grid-cols-4 gap-px bg-slate-200 max-xl:grid-cols-2 max-md:grid-cols-1">
        <SummaryFact label="Alternatives studied" value={String(study.alternativeRefs.length)} />
        <SummaryFact label="Mandatory-feasible" value={result
          ? String(study.alternativeRefs.filter((alternative) => result.feasibility?.[alternative.id]?.status === "feasible").length)
          : "Not analyzed"} />
        <SummaryFact label="Highest stakeholder value" value={leaderNames.join(", ") || "Not available"} />
        <SummaryFact label="Recommendation stability" value={stable === undefined ? "Not tested" : stable ? "Stable in tested bounds" : "Changes in tested bounds"} />
      </div>
    </section>

    {!result
      ? <section className="card p-8 text-center text-slate-500">Run the fixed-value Trade Study analysis to populate the manager summary.</section>
      : <>
        <section className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
          {study.alternativeRefs.map((alternative) => {
            const feasibility = result.feasibility?.[alternative.id];
            const pareto = result.pareto?.[alternative.id];
            const recommended = result.recommendedAlternativeIds?.includes(alternative.id);
            return <article key={alternative.id} className={`card border-t-4 p-5 ${recommended ? "border-t-green-600" : feasibility?.status === "feasible" ? "border-t-blue-500" : "border-t-red-500"}`}>
              <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{alternative.label}</h3>{recommended && <span className="badge bg-green-100 text-green-800">Highest feasible value</span>}</div>
              <dl className="mt-4 grid grid-cols-[110px_1fr] gap-2 text-sm">
                <dt className="font-semibold">Feasibility</dt><dd>{feasibility?.status ?? "Unknown"}</dd>
                <dt className="font-semibold">Pareto</dt><dd>{paretoLabel(pareto)}</dd>
                <dt className="font-semibold">Value</dt><dd>{format(result.stakeholderValueScores?.[alternative.id])} / 100</dd>
                <dt className="font-semibold">Coverage</dt><dd>{result.dataCoveragePercent[alternative.id]}%</dd>
                <dt className="font-semibold">Residual risk</dt><dd>{risks[alternative.id]?.totalResidualExposure ?? 0} total; {risks[alternative.id]?.unresolvedHighCriticalCount ?? 0} high/critical open</dd>
              </dl>
              {(feasibility?.failedRequirementIds.length ?? 0) > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-red-700">Why infeasible</summary><ul className="mt-2 list-disc pl-5">{feasibility!.requirementEvidence.filter((item) => item.status !== "satisfied").map((item) => <li key={item.requirementId}>{item.requirementName}: {item.evidence}</li>)}</ul></details>}
            </article>;
          })}
        </section>
        <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          <div className="card p-5">
            <h2 className="text-lg font-bold">Principal trade-offs</h2>
            <p className="mt-1 text-sm text-slate-600">Feasible Pareto status across comparable optimization criteria. Missing evidence remains Unknown.</p>
            <div className="mt-4 space-y-3">{study.alternativeRefs.map((alternative) => <div key={alternative.id} className="rounded-lg border p-3"><div className="flex gap-2"><strong>{alternative.label}</strong><span className="badge bg-slate-100 text-slate-700">{paretoLabel(result.pareto?.[alternative.id])}</span></div><p className="mt-1 text-sm text-slate-600">{result.pareto?.[alternative.id]?.explanation}</p></div>)}</div>
          </div>
          <div className="card p-5">
            <h2 className="text-lg font-bold">Two-KPI tradespace</h2>
            <p className="mt-1 text-sm text-slate-600">Raw values and units are preserved. Green points satisfy every mandatory requirement.</p>
            {twoKpis.length === 2 && chartData.length
              ? <div className="mt-3 h-80" role="img" aria-label="Two KPI Pareto tradespace chart"><ResponsiveContainer><ScatterChart margin={{ left: 16, right: 20, top: 12, bottom: 16 }}><CartesianGrid /><XAxis type="number" dataKey="x" name={twoKpis[0].name} unit={project.kpis.find((kpi) => kpi.id === twoKpis[0].kpiId)?.outputUnit} /><YAxis type="number" dataKey="y" name={twoKpis[1].name} unit={project.kpis.find((kpi) => kpi.id === twoKpis[1].kpiId)?.outputUnit} /><ZAxis dataKey="name" name="Alternative" /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Legend /><Scatter name="Feasible alternatives" data={chartData.filter((item) => item.feasible)} fill="#059669" /><Scatter name="Infeasible or unknown" data={chartData.filter((item) => !item.feasible)} fill="#dc2626" /></ScatterChart></ResponsiveContainer></div>
              : <p className="mt-6 text-sm text-slate-500">Select two KPI-backed optimization criteria with finite evidence.</p>}
          </div>
        </section>
        <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          <div className="card p-5"><h2 className="text-lg font-bold">Risks</h2><p className="mt-2 text-sm text-slate-700">{project.comparisonRisks.filter((risk) => risk.comparisonStudyId === study.id).map((risk) => `${risk.title}: residual ${residualExposure(risk)} (${riskBand(residualExposure(risk))})`).join("; ") || "No risks recorded."}</p></div>
          <div className="card p-5"><h2 className="text-lg font-bold">Selection rationale</h2><p className="mt-2 text-sm text-slate-700">{decision?.rationale || "No formal rationale recorded."}</p><p className="mt-3 text-xs text-slate-500">{decision ? `${decision.status} · ${decision.owner ?? "Owner not recorded"} · ${decision.decisionDate ?? "Date pending"}` : "Formal decision pending."}</p></div>
        </section>
      </>}
  </div>;
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 font-bold text-slate-900">{value}</div></div>;
}

export function ExpertTradeStudyEvidence({ study }: { study: ComparisonStudy }) {
  const { promptText } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const updateStudy = useAppStore((state) => state.updateComparisonStudy);
  const result = latestFixedResult(study);
  const riskSummaries = summarizeRisks(project, study);
  if (!result) return <section className="card p-8 text-center text-slate-500">No fixed SMART/MAVT evidence result is available.</section>;
  return <div className="space-y-4">
    <section className="card p-5"><div className="flex flex-wrap items-start gap-3"><div><h2 className="text-xl font-bold">Expert evidence ledger</h2><p className="mt-1 text-sm text-slate-600">Immutable result {result.id} · model revision {result.inputProjectModelRevision} · {result.timestamp}</p></div><span className="badge ml-auto bg-purple-100 text-purple-800">{result.methodology}</span></div>
      <div className="mt-4 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Alternative</th><th>Criterion / KPI</th><th>Raw evidence</th><th>Fixed value</th><th>Weight</th><th>Contribution</th><th>Explanation</th></tr></thead><tbody>{study.alternativeRefs.flatMap((alternative) => study.criteria.filter((criterion) => criterion.type === "optimization" && criterion.kpiId).map((criterion) => {
        const kpi = project.kpis.find((item) => item.id === criterion.kpiId);
        return <tr key={`${alternative.id}-${criterion.id}`}><th>{alternative.label}</th><td>{criterion.name}<div className="text-xs text-slate-500">{criterion.kpiId}</div></td><td>{format(result.rawValues[alternative.id]?.[criterion.kpiId!], kpi?.outputUnit)}</td><td>{format(result.stakeholderValues?.[alternative.id]?.[criterion.kpiId!])}</td><td>{criterion.weight ?? 0}</td><td>{format(result.weightedContributions?.[alternative.id]?.[criterion.kpiId!])}</td><td className="min-w-72 text-xs">{result.calculationExplanations?.[alternative.id]?.[criterion.kpiId!]}</td></tr>;
      }))}</tbody></table></div>
    </section>
    <section className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
      <div className="card p-5"><h2 className="text-lg font-bold">Mandatory requirement evidence</h2>{study.alternativeRefs.map((alternative) => <article className="mt-3 rounded-lg border p-3" key={alternative.id}><div className="flex gap-2"><strong>{alternative.label}</strong><span className={`badge ${result.feasibility?.[alternative.id]?.status === "feasible" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{result.feasibility?.[alternative.id]?.status}</span></div>{result.feasibility?.[alternative.id]?.requirementEvidence.map((item) => <div className="mt-2 text-sm" key={item.requirementId}><div className="font-semibold">{item.requirementName} · {item.status}</div><div className="text-xs text-slate-600">{item.expression ?? "No formula"} · {item.evidence}</div></div>)}{result.feasibility?.[alternative.id]?.status !== "feasible" && <div className="mt-3 border-t pt-3"><div className="text-xs text-slate-600">{study.feasibilityExceptions?.[alternative.id]?.rationale || "No exception rationale recorded."}</div><div className="mt-2 flex flex-wrap gap-2"><button className="btn" onClick={async () => {
        const rationale = await promptText("Document the feasibility-exception rationale. The alternative remains outside the normal recommendation.", study.feasibilityExceptions?.[alternative.id]?.rationale ?? "");
        if (!rationale?.trim()) return;
        updateStudy(study.id, {
          feasibilityExceptions: {
            ...(study.feasibilityExceptions ?? {}),
            [alternative.id]: { rationale: rationale.trim(), approvalState: "requested" }
          }
        }, true);
      }}>Request documented exception</button>{study.feasibilityExceptions?.[alternative.id]?.approvalState === "requested" && <button className="btn" onClick={async () => {
        const approvedBy = await promptText("Approver name");
        if (!approvedBy?.trim()) return;
        updateStudy(study.id, {
          feasibilityExceptions: {
            ...(study.feasibilityExceptions ?? {}),
            [alternative.id]: {
              ...study.feasibilityExceptions![alternative.id],
              approvalState: "approved",
              approvedBy: approvedBy.trim(),
              approvedAt: new Date().toISOString()
            }
          }
        }, true);
      }}>Approve exception explicitly</button>}</div></div>}</article>)}</div>
      <div className="card p-5"><h2 className="text-lg font-bold">Pareto dominance</h2>{study.alternativeRefs.map((alternative) => <article className="mt-3 rounded-lg border p-3" key={alternative.id}><strong>{alternative.label}: {paretoLabel(result.pareto?.[alternative.id])}</strong><p className="mt-1 text-sm text-slate-600">{result.pareto?.[alternative.id]?.explanation}</p><p className="mt-2 text-xs text-slate-500">Dominates: {result.pareto?.[alternative.id]?.dominatesAlternativeIds.map((id) => alternativeName(study, id)).join(", ") || "none"} · Dominated by: {result.pareto?.[alternative.id]?.dominatedByAlternativeIds.map((id) => alternativeName(study, id)).join(", ") || "none"}</p></article>)}</div>
    </section>
    <section className="card p-5"><h2 className="text-lg font-bold">Risk movement and model lineage</h2><div className="mt-3 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Risk</th><th>Alternative</th><th>Inherent</th><th>Residual</th><th>Movement</th><th>Owner / status</th><th>Applicable IDs</th></tr></thead><tbody>{project.comparisonRisks.filter((risk) => risk.comparisonStudyId === study.id).map((risk) => <tr key={risk.id}><th>{risk.title}<div className="text-xs text-slate-500">{risk.id}</div></th><td>{alternativeName(study, risk.alternativeId)}</td><td>{inherentExposure(risk)} ({risk.inherentLikelihood}×{risk.inherentImpact})</td><td>{residualExposure(risk)} ({risk.residualLikelihood}×{risk.residualImpact})</td><td>{inherentExposure(risk) - residualExposure(risk)}</td><td>{risk.owner ?? "Unassigned"} · {risk.status}{risk.reviewRequired ? " · review required" : ""}</td><td className="text-xs">{[...risk.applicableArchitectureIds, ...risk.applicableConfigurationIds, ...risk.applicableRequirementIds, ...risk.applicableParameterIds, ...risk.applicableKpiIds].join(", ") || "None"}</td></tr>)}</tbody></table></div>
      <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">{study.alternativeRefs.map((alternative) => <div className="rounded-lg bg-slate-50 p-3 text-sm" key={alternative.id}><strong>{alternative.label}</strong><div>Total residual {riskSummaries[alternative.id]?.totalResidualExposure ?? 0}</div><div>Maximum residual {riskSummaries[alternative.id]?.maximumResidualExposure ?? 0}</div><div>High/critical unresolved {riskSummaries[alternative.id]?.unresolvedHighCriticalCount ?? 0}</div></div>)}</div>
    </section>
  </div>;
}

export function RiskMatrix({ study }: { study: ComparisonStudy }) {
  const project = useAppStore(selectActiveProject)!;
  const risks = project.comparisonRisks.filter((risk) => risk.comparisonStudyId === study.id);
  const countAt = (likelihood: number, impact: number, residual: boolean) => risks.filter((risk) =>
    residual
      ? risk.residualLikelihood === likelihood && risk.residualImpact === impact
      : risk.inherentLikelihood === likelihood && risk.inherentImpact === impact
  ).length;
  return <section className="card p-5"><h2 className="text-lg font-bold">5×5 risk matrix</h2><p className="mt-1 text-sm text-slate-600">Each cell shows inherent → residual risk counts. Exposure is likelihood × impact.</p><div className="mt-4 grid grid-cols-6 gap-1 text-center text-xs"><div /><>{[1, 2, 3, 4, 5].map((impact) => <div className="p-2 font-semibold" key={impact}>Impact {impact}</div>)}</>{[5, 4, 3, 2, 1].flatMap((likelihood) => [<div className="grid place-items-center p-2 font-semibold" key={`label-${likelihood}`}>L{likelihood}</div>, ...[1, 2, 3, 4, 5].map((impact) => {
    const exposure = likelihood * impact;
    const band = riskBand(exposure);
    const color = band === "critical" ? "bg-red-200" : band === "high" ? "bg-orange-200" : band === "moderate" ? "bg-amber-100" : "bg-green-100";
    return <div key={`${likelihood}-${impact}`} className={`${color} rounded p-2`}><div className="font-bold">{exposure}</div><div>{countAt(likelihood, impact, false)} → {countAt(likelihood, impact, true)}</div></div>;
  })])}</div></section>;
}

export function RobustnessPanel({ study }: { study: ComparisonStudy }) {
  const { alertUser } = useDialogs();
  const update = useAppStore((state) => state.updateComparisonStudy);
  const execute = useAppStore((state) => state.executeRobustness);
  const [name, setName] = useState("");
  const [kpiId, setKpiId] = useState(study.selectedKpiIds[0] ?? "");
  const [percent, setPercent] = useState(10);
  const latest = study.robustnessResults?.at(-1);
  const immutableScenarios = useMemo(() => study.scenarios ?? [], [study.scenarios]);
  const addScenario = () => {
    if (!name.trim() || !kpiId || !Number.isFinite(percent)) return;
    const scenario: ComparisonScenario = {
      id: `scenario-${crypto.randomUUID()}`,
      name: name.trim(),
      description: "Named immutable KPI percentage screening scenario.",
      createdAt: new Date().toISOString(),
      effects: [{ id: `effect-${crypto.randomUUID()}`, type: "kpiPercent", targetId: kpiId, percent }]
    };
    update(study.id, { scenarios: [...immutableScenarios, scenario] }, true);
    setName("");
  };
  return <div className="space-y-4">
    <section className="card p-5"><div className="flex flex-wrap items-start gap-3"><div><h2 className="text-xl font-bold">Bounded robustness analysis</h2><p className="mt-1 text-sm text-slate-600">Deterministic nominal, one-at-a-time bounds, combined pessimistic/optimistic cases and named scenarios. This is not Monte Carlo and reports no probabilities.</p></div><button className="btn btn-primary ml-auto" onClick={() => {
      const errors = execute(study.id);
      if (errors.length) void alertUser(errors.join("\n"));
    }}><Play size={14} /> Run bounded analysis</button></div>
      <div className="mt-4 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1"><label><span className="label">Scenario name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span className="label">KPI effect</span><select className="field" value={kpiId} onChange={(event) => setKpiId(event.target.value)}>{study.selectedKpiIds.map((id) => <option value={id} key={id}>{id}</option>)}</select></label><label><span className="label">Percentage consequence</span><input className="field" type="number" value={percent} onChange={(event) => setPercent(Number(event.target.value))} /></label><div className="self-end"><button className="btn" onClick={addScenario}><Plus size={14} /> Save immutable scenario</button></div></div>
      <div className="mt-4 flex flex-wrap gap-2">{immutableScenarios.map((scenario) => <span className="badge bg-slate-100 text-slate-700" key={scenario.id}>{scenario.name} · {scenario.id}</span>)}</div>
    </section>
    {latest ? <section className="card p-5"><div className="flex items-center gap-2"><ShieldCheck className="text-blue-600" /><h2 className="text-lg font-bold">{latest.label}</h2><span className="ml-auto text-xs text-slate-500">{latest.id} · {latest.timestamp}</span></div><div className="mt-4 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Case</th><th>Leader(s)</th><th>Feasibility changes</th><th>Pareto changes</th><th>Recommendation</th><th>Notes</th></tr></thead><tbody>{latest.cases.map((item) => <tr key={item.id}><th>{item.name}<div className="text-xs text-slate-500">{item.kind}</div></th><td>{item.leadingAlternativeIds.map((id) => alternativeName(study, id)).join(", ") || "None"}</td><td>{item.changedFeasibilityAlternativeIds.map((id) => alternativeName(study, id)).join(", ") || "None"}</td><td>{item.changedParetoAlternativeIds.map((id) => alternativeName(study, id)).join(", ") || "None"}</td><td>{item.recommendationChanged ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle size={14} /> Changed</span> : <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} /> Stable</span>}</td><td className="min-w-64 text-xs">{item.notes.join(" ")}</td></tr>)}</tbody></table></div></section> : <section className="card p-8 text-center text-slate-500">Run the bounded robustness analysis after a fixed-value Trade Study result exists.</section>}
  </div>;
}
