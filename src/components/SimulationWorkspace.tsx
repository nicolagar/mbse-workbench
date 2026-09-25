import { ConfigurationReadiness } from "./ConfigurationReadiness";
import { Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { derivationStatus } from "../domain/derivation";
import { defaultSimulationName, simulationStatus, type SimulationRequest } from "../domain/simulation";
import type { StandardAlgorithmKey } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { useDialogs } from "./dialogs/DialogProvider";

const directAlgorithms: StandardAlgorithmKey[] = [
  "totalMass", "directElementCost", "processCost", "estimatedTotalCost", "totalPower",
  "manufacturingLeadTime", "resourceDemand", "basicUtilization", "throughputProxy"
];

export function SimulationWorkspace() {
  const { confirm } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const execute = useAppStore((state) => state.executeSimulation);
  const activeConfigurations = project.configurations.filter((configuration) => !configuration.archivedAt);
  const activeArchitectures = project.architectures.filter((architecture) => architecture.status !== "archived");
  const fixedCurrentArchitectureMode = project.overallScope === "architectureAndSimulation";
  const [mode, setMode] = useState<"configured" | "architectureOnly">(fixedCurrentArchitectureMode ? "architectureOnly" : "configured");
  const [configurationId, setConfigurationId] = useState(activeConfigurations[0]?.id ?? "");
  const [architectureId, setArchitectureId] = useState(activeArchitectures[0]?.id ?? "");
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>(project.kpis.map((kpi) => kpi.id));
  const [selectedAlgorithmKeys, setSelectedAlgorithmKeys] = useState<StandardAlgorithmKey[]>([]);
  const [name, setName] = useState(() => defaultSimulationName(project, activeConfigurations[0]?.id ?? ""));
  const [selectedRunId, setSelectedRunId] = useState(project.simulationRuns.at(-1)?.id ?? "");
  const [messages, setMessages] = useState<string[]>([]);
  const selectedConfiguration = activeConfigurations.find((configuration) => configuration.id === configurationId);
  const selectedRun = project.simulationRuns.find((run) => run.id === selectedRunId) ?? project.simulationRuns.at(-1);
  useEffect(() => {
    if (fixedCurrentArchitectureMode) setMode("architectureOnly");
  }, [fixedCurrentArchitectureMode]);
  useEffect(() => setName(mode === "configured"
    ? defaultSimulationName(project, configurationId)
    : `${project.architectures.find((architecture) => architecture.id === architectureId)?.name ?? "Architecture"} — ${fixedCurrentArchitectureMode ? "current model" : "150%"}`
  ), [configurationId, architectureId, mode, project.id, fixedCurrentArchitectureMode]);
  const warningSummary = useMemo(() => [
    ...project.validationResults.filter((finding) => finding.severity === "warning").map((finding) => `${finding.ruleId}: ${finding.message}`),
    ...(mode === "configured" && configurationId
      ? project.configurations.find((configuration) => configuration.id === configurationId)?.derivation?.warnings ?? []
      : [])
  ], [project, configurationId, mode]);

  const run = async () => {
    if ((mode === "configured" && !configurationId) || (mode === "architectureOnly" && !architectureId)) {
      setMessages([mode === "configured" ? "Select a configuration." : "Select an architecture."]);
      return;
    }
    if (warningSummary.length && !(await confirm(`Acknowledge the following non-blocking warnings before simulation?\n\n${warningSummary.join("\n")}`, { confirmLabel: "Acknowledge" }))) return;
    const request: SimulationRequest = {
      name,
      mode,
      configurationId: mode === "configured" ? configurationId : undefined,
      architectureId: mode === "architectureOnly" ? architectureId : undefined,
      selectedKpiIds,
      selectedAlgorithmKeys
    };
    const attempt = execute(request);
    if (attempt.errors.length) {
      setMessages(attempt.errors);
      return;
    } else if (attempt.run && !attempt.warnings.length) {
      setSelectedRunId(attempt.run.id);
      setMessages([]);
      return;
    } else if (attempt.run && attempt.warnings.length) {
      if (!(await confirm(`Acknowledge calculation warnings before saving this run?\n\n${attempt.warnings.join("\n")}`, { confirmLabel: "Acknowledge" }))) return;
      const acknowledged = execute(request, true);
      if (acknowledged.run) {
        setSelectedRunId(acknowledged.run.id);
        setMessages([]);
      }
      return;
    }
  };

  return <div className="space-y-4">
    <header><div className="flex items-center gap-3"><h1 className="text-3xl font-bold">Simulation</h1><span className="badge bg-blue-50 text-blue-700">Saved-run analysis</span></div><p className="mt-1 text-slate-600">{fixedCurrentArchitectureMode ? "Calculate KPIs directly from the current architecture. This scope does not require a variability configuration." : "Run a configured 100% realization or explicitly evaluate the canonical unconfigured 150% model in an architecture context."}</p></header>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Preliminary engineering estimate — not a verified detailed-design result.</div>
    <section className="card p-5"><h2 className="text-lg font-bold">Prepare run</h2><fieldset className={`mt-4 flex flex-wrap gap-5 ${fixedCurrentArchitectureMode ? "text-slate-400" : ""}`}><legend className="label">Analysis mode{fixedCurrentArchitectureMode ? " · fixed by project scope" : ""}</legend><label><input className="mr-2" type="radio" checked={mode === "configured"} disabled={fixedCurrentArchitectureMode} onChange={() => setMode("configured")} />Configured 100% model</label><label><input className="mr-2" type="radio" checked={mode === "architectureOnly"} disabled={fixedCurrentArchitectureMode} onChange={() => setMode("architectureOnly")} />{fixedCurrentArchitectureMode ? "Current architecture · no configuration required" : "Architecture-only 150% model"}</label></fieldset><div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
      {mode === "configured" ? <label><span className="label">Configuration</span><select className="field" value={configurationId} onChange={(event) => setConfigurationId(event.target.value)}><option value="">Select a configuration</option>{activeConfigurations.map((configuration) => <option value={configuration.id} key={configuration.id}>{configuration.name} · {configuration.validationStatus}</option>)}</select></label>
        : <label><span className="label">Architecture context</span><select className="field" value={architectureId} onChange={(event) => setArchitectureId(event.target.value)}><option value="">Select an architecture</option>{activeArchitectures.map((architecture) => <option value={architecture.id} key={architecture.id}>{architecture.name} · {architecture.status}</option>)}</select></label>}
      <label><span className="label">Run name (editable before running)</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
    </div>
    {mode === "configured" && selectedConfiguration && <ConfigurationReadiness project={project} configuration={selectedConfiguration} />}
    {mode === "configured" && selectedConfiguration && <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{derivationStatus(project, selectedConfiguration) === "Current"
      ? <><strong>Architecture used:</strong> This simulation uses the current 100% architecture for “{selectedConfiguration.name}”. It includes {selectedConfiguration.derivation?.appliedVariations.length ?? 0} changes produced by the selected features.</>
      : <><strong>Architecture used:</strong> No current 100% architecture is saved for “{selectedConfiguration.name}”. When the run starts, the workbench will temporarily generate the architecture from this configuration.</>}</div>}
    {mode === "architectureOnly" && (fixedCurrentArchitectureMode
      ? <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>Current-architecture analysis:</strong> Validate and run calculates the selected KPIs directly from this architecture. No configuration or 100% derivation is required.</div>
      : <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Unconfigured analysis:</strong> this run evaluates the canonical 150% model without feature selection or deterministic 100% derivation. Variability remains unresolved and is captured explicitly in the run provenance.</div>)}
    <div className="mt-5 grid grid-cols-2 gap-5"><div><h3 className="font-semibold">KPI definitions</h3><p className="text-xs text-slate-500">Formula dependencies must also be selected explicitly.</p><div className="mt-2 grid gap-2">{project.kpis.map((kpi) => <label className="rounded-lg border p-2 text-sm" key={kpi.id}><input className="mr-2" type="checkbox" checked={selectedKpiIds.includes(kpi.id)} onChange={(event) => setSelectedKpiIds(event.target.checked ? [...selectedKpiIds, kpi.id] : selectedKpiIds.filter((id) => id !== kpi.id))} />{kpi.name}<span className="ml-2 text-xs text-slate-500">{kpi.outputUnit} · {kpi.id}</span></label>)}</div></div>
      <div><h3 className="font-semibold">Additional direct algorithms</h3><p className="text-xs text-slate-500">Use these only when no saved KPI definition is needed.</p><div className="mt-2 grid gap-2">{directAlgorithms.map((key) => <label className="rounded-lg border p-2 text-sm" key={key}><input className="mr-2" type="checkbox" checked={selectedAlgorithmKeys.includes(key)} onChange={(event) => setSelectedAlgorithmKeys(event.target.checked ? [...selectedAlgorithmKeys, key] : selectedAlgorithmKeys.filter((item) => item !== key))} />{key}</label>)}</div></div></div>
    {warningSummary.length > 0 && <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><summary className="cursor-pointer font-semibold text-amber-900">{warningSummary.length} warning(s) require acknowledgement before the run</summary><ul className="mt-2 list-disc pl-5 text-sm text-amber-900">{warningSummary.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></details>}
    {messages.length > 0 && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{messages.map((message) => <div key={message}>{message}</div>)}</div>}
    <button className="btn btn-primary mt-4" onClick={run}><Play size={15} /> Validate and run</button></section>

    <section className="grid grid-cols-[300px_1fr] gap-4 max-lg:grid-cols-1"><aside className="card p-4"><h2 className="font-bold">Read-only run history</h2><p className="mt-1 text-xs text-slate-500">Completed runs retain their exact immutable input snapshot.</p><div className="mt-3 space-y-2">{[...project.simulationRuns].reverse().map((simulation) => <button key={simulation.id} onClick={() => setSelectedRunId(simulation.id)} className={`w-full rounded-lg border p-3 text-left ${selectedRun?.id === simulation.id ? "border-blue-300 bg-blue-50" : ""}`}><strong className="block text-sm">{simulation.name}</strong><span className="text-xs text-slate-500">{new Date(simulation.timestamp).toLocaleString()} · rev {simulation.projectModelRevisionAtRun}</span><span className={`badge mt-2 ${simulationStatus(project, simulation) === "Stale" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>{simulationStatus(project, simulation)}</span></button>)}</div>{!project.simulationRuns.length && <p className="mt-4 text-sm text-slate-500">No saved runs yet.</p>}</aside>
      <div>{selectedRun ? <RunDetail runId={selectedRun.id} /> : <section className="card p-8 text-center text-slate-500">Run a valid selection to create an immutable record.</section>}</div></section>
  </div>;
}

function RunDetail({ runId }: { runId: string }) {
  const project = useAppStore(selectActiveProject)!;
  const run = project.simulationRuns.find((item) => item.id === runId);
  if (!run) return null;
  const architecture = project.architectures.find((item) => item.id === run.architectureId);
  const configuration = project.configurations.find((item) => item.id === run.configurationId);
  const architectureOnlyLabel = project.overallScope === "architectureAndSimulation" ? "Current architecture" : "Architecture-only 150% model";
  const architectureOnlyProvenance = project.overallScope === "architectureAndSimulation" ? "current canonical architecture" : "unconfigured canonical model";
  return <section className="card p-5"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{run.name}</h2><p className="text-sm text-slate-500">{architecture?.name ?? run.architectureId} · {configuration?.name ?? run.configurationId ?? architectureOnlyLabel} · {new Date(run.timestamp).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{run.inputSnapshot.appliedVariationPointIds?.length ?? 0} variation point(s) captured · {run.configurationId ? (run.inputSnapshot.backgroundRealization ? "in-memory realization" : "explicit realization") : architectureOnlyProvenance}.</p></div><span className={`badge ${simulationStatus(project, run) === "Stale" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>{simulationStatus(project, run)}</span></div>
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Preliminary engineering estimate — not a verified detailed-design result. Source project revision {run.projectModelRevisionAtRun}.</div>
    <div className="mt-4 space-y-3">{run.results.map((result) => <article className="rounded-lg border p-4" key={result.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{result.name}</h3><code className="text-xs">{result.kpiId ? `KPI ${result.kpiId}` : `Algorithm ${result.algorithmKey}`}</code></div><strong className="text-xl text-blue-700">{result.value ?? "Not available"} {result.unit}</strong></div><dl className="mt-3 grid grid-cols-[150px_1fr] gap-2 text-xs max-sm:grid-cols-1"><dt className="font-semibold">Formula / algorithm</dt><dd>{result.formulaOrAlgorithm}</dd><dt className="font-semibold">Input sources</dt><dd>{result.inputSources.map((input) => `${input.name}: ${input.value ?? "Not available"} ${input.unit ?? ""}${input.source ? ` (${input.source})` : ""}`).join("; ") || "None"}</dd><dt className="font-semibold">Missing information</dt><dd>{result.missingInformation.join(" ") || "None"}</dd><dt className="font-semibold">Warnings</dt><dd>{result.warnings.join(" ") || "None"}</dd>{result.breakdown && <><dt className="font-semibold">Breakdown</dt><dd>{Object.entries(result.breakdown).map(([id, value]) => `${project.elements.find((element) => element.id === id)?.name ?? id}: ${value ?? "Not available"}`).join("; ")}</dd></>}{result.criticalChainElementIds && <><dt className="font-semibold">Critical chain</dt><dd>{result.criticalChainElementIds.map((id) => project.elements.find((element) => element.id === id)?.name ?? id).join(" → ")}</dd></>}</dl></article>)}</div>
    <details className="mt-4 rounded-lg bg-slate-50 p-3 text-xs"><summary className="cursor-pointer font-semibold"><RefreshCw className="mr-1 inline" size={13} /> Exact immutable input snapshot</summary><pre className="mt-2 overflow-auto">{JSON.stringify(run.inputSnapshot, null, 2)}</pre></details>
  </section>;
}
