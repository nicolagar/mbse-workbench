import { MassContributions } from "./MassContributions";
import { Calculator, Plus, Ruler, Trash2 } from "lucide-react";
import { useState } from "react";
import { architectureCompatibleModel } from "../domain/derivation";
import { formulaReferences, parseKpiFormula } from "../domain/kpiFormulas";
import { calculateSelectedKpis } from "../domain/presizing";
import type { KPI, Parameter, StandardAlgorithmKey } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { UnitCatalogueDialog } from "./UnitCatalogueDialog";
import { KpiFormulaBuilder } from "./KpiFormulaBuilder";
import { useDialogs } from "./dialogs/DialogProvider";

const algorithms: StandardAlgorithmKey[] = [
  "totalMass", "directElementCost", "processCost", "estimatedTotalCost", "totalPower",
  "manufacturingLeadTime", "resourceDemand", "basicUtilization", "throughputProxy"
];
const algorithmDetails: Record<StandardAlgorithmKey, { logic: string; inputs: string; unit: string; limitations: string }> = {
  totalMass: { logic: "Sums every active numeric parameter whose semantic key is mass.", inputs: "Active mass parameters with compatible units.", unit: "Inherited from the active mass inputs.", limitations: "All included masses must use one compatible unit." },
  directElementCost: { logic: "Sums every active numeric parameter whose semantic key is directCost.", inputs: "Active direct-cost parameters.", unit: "Inherited from the active cost inputs.", limitations: "All included direct costs must use one compatible currency unit." },
  processCost: { logic: "For each industrial-component resource assignment: summed duration of its realized process functions × hourlyRate × requiredQuantity.", inputs: "Authoritative process durations, process-function realization links, industrial-component resource assignments and resource hourly rates.", unit: "EUR in the current pre-sizing model.", limitations: "One engineering day equals eight hours; missing quantity defaults to one with a warning." },
  estimatedTotalCost: { logic: "Adds Direct Element Cost and Process Cost.", inputs: "Results of the directElementCost and processCost algorithms.", unit: "EUR in the current pre-sizing model.", limitations: "Both component calculations must be available." },
  totalPower: { logic: "Sums every active numeric parameter whose semantic key is power.", inputs: "Active power parameters with compatible units.", unit: "Inherited from the active power inputs.", limitations: "All included power values must use one compatible unit." },
  manufacturingLeadTime: { logic: "Calculates the longest path through active process-function precedes relationships.", inputs: "Authoritative process durations and acyclic process precedence links.", unit: "hours", limitations: "Parallel branches use critical-path semantics; one engineering day equals eight hours." },
  resourceDemand: { logic: "Sums realized process-function duration × requiredQuantity for each industrial-component resource assignment and provides a per-resource breakdown.", inputs: "Process durations, realization links and industrial-component resource-assignment quantities.", unit: "resource-hours", limitations: "Missing assignment quantity defaults to one with a warning." },
  basicUtilization: { logic: "Divides resource demand by available resource capacity.", inputs: "Resource demand, capacity hours and availability percentage.", unit: "%", limitations: "This is simplified planning utilization, not a detailed schedule." },
  throughputProxy: { logic: "Calculates 1 ÷ manufacturingLeadTimeHours.", inputs: "Manufacturing lead-time result.", unit: "1/h", limitations: "Comparative proxy only; it is not actual production throughput." }
};

export function ParametersWorkspace() {
  const [tab, setTab] = useState<"parameters" | "kpis">("parameters");
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  return <div className="space-y-4"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">Parameters and KPIs</h1><p className="mt-1 text-slate-600">Editable engineering inputs, exact applicability, safe formulas, units, and standard pre-sizing algorithms.</p></div><button className="btn" onClick={() => setUnitDialogOpen(true)}><Ruler size={16} /> Project units</button></header>
    <nav className="card flex gap-2 p-2"><button className={`btn ${tab === "parameters" ? "btn-primary" : ""}`} onClick={() => setTab("parameters")}>Engineering inputs</button><button className={`btn ${tab === "kpis" ? "btn-primary" : ""}`} onClick={() => setTab("kpis")}>KPI definitions</button></nav>
    {tab === "parameters" ? <ParameterTable /> : <KpiTable />}
    {unitDialogOpen && <UnitCatalogueDialog onClose={() => setUnitDialogOpen(false)} />}
  </div>;
}

function ParameterTable() {
  const { confirm, promptText, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addParameter = useAppStore((state) => state.addParameter);
  const updateParameter = useAppStore((state) => state.updateParameter);
  const deleteParameter = useAppStore((state) => state.deleteParameter);
  const updateElement = useAppStore((state) => state.updateElement);
  const updateRelationship = useAppStore((state) => state.updateRelationship);
  const [search, setSearch] = useState("");
  const entries = project.elements.flatMap((element) => element.parameters.map((parameter) => ({ element, parameter })))
    .filter(({ element, parameter }) => `${element.name} ${parameter.name} ${parameter.semanticKey}`.toLowerCase().includes(search.toLowerCase()));
  const edit = async (elementId: string, parameter: Parameter) => {
    const name = (await promptText("Parameter name", parameter.name))?.trim();
    if (!name) return;
    const semanticKey = (await promptText("Semantic key", parameter.semanticKey))?.trim() ?? parameter.semanticKey;
    const rawValue = await promptText("Typed value (blank = null)", parameter.value === null ? "" : String(parameter.value));
    if (rawValue === null) return;
    let value: Parameter["value"] = rawValue;
    if (parameter.dataType === "number") {
      value = rawValue.trim() === "" ? null : Number(rawValue);
      if (value !== null && !Number.isFinite(value)) return void alertUser("Numeric values must be finite or blank.");
    } else if (parameter.dataType === "boolean") value = rawValue.toLowerCase() === "true";
    const unit = (await promptText("Unit", parameter.unit ?? "")) ?? parameter.unit;
    const minimumText = await promptText("Recommended minimum (blank = none)", parameter.minimum?.toString() ?? "");
    const maximumText = await promptText("Recommended maximum (blank = none)", parameter.maximum?.toString() ?? "");
    const uncertaintyText = await promptText("Uncertainty percent 0–100 (blank = none)", parameter.uncertaintyPercent?.toString() ?? "");
    const valueOrigin = (await promptText("Value origin: entered, assumed, calculated, or simulated", parameter.valueOrigin))?.trim() as Parameter["valueOrigin"] | undefined;
    if (!valueOrigin || !["entered", "assumed", "calculated", "simulated"].includes(valueOrigin)) return void alertUser("Choose entered, assumed, calculated, or simulated.");
    const source = await promptText("Source / provenance", parameter.source ?? "");
    if (source === null) return;
    const minimum = minimumText?.trim() ? Number(minimumText) : undefined;
    const maximum = maximumText?.trim() ? Number(maximumText) : undefined;
    const uncertaintyPercent = uncertaintyText?.trim() ? Number(uncertaintyText) : undefined;
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) return void alertUser("Minimum must not exceed maximum.");
    if (uncertaintyPercent !== undefined && (!Number.isFinite(uncertaintyPercent) || uncertaintyPercent < 0 || uncertaintyPercent > 100)) return void alertUser("Uncertainty must be between 0 and 100.");
    const applicable = await promptText("Applicable configuration IDs, comma-separated. Blank means every configuration.", parameter.applicableConfigurationIds.join(","));
    if (applicable === null) return;
    const applicableConfigurationIds = applicable.split(",").map((id) => id.trim()).filter(Boolean);
    const unknown = applicableConfigurationIds.filter((id) => !project.configurations.some((configuration) => configuration.id === id));
    if (unknown.length) return void alertUser(`Unknown configuration IDs: ${unknown.join(", ")}`);
    const unitOnly = unit !== parameter.unit && value === parameter.value;
    updateParameter(elementId, parameter.id, { name, semanticKey, value: unitOnly ? undefined : value, unit, minimum: unitOnly && minimum === parameter.minimum ? undefined : minimum, maximum: unitOnly && maximum === parameter.maximum ? undefined : maximum, uncertaintyPercent, valueOrigin, source, applicableConfigurationIds });
  };
  const create = async () => {
    const ownerElementId = (await promptText("Owner element ID", project.elements[0]?.id))?.trim();
    const owner = project.elements.find((element) => element.id === ownerElementId);
    if (!owner) return void alertUser("Choose an existing owner element ID.");
    const name = (await promptText("Parameter name", "New parameter"))?.trim();
    if (!name) return;
    const nowParameter: Parameter = {
      id: `parameter-${crypto.randomUUID()}`, ownerElementId: owner.id, name,
      semanticKey: name.toLowerCase().replace(/\W+/g, "_"), description: "", dataType: "number",
      value: null, unit: "", source: "", valueOrigin: "entered", applicableConfigurationIds: []
    };
    addParameter(owner.id, nowParameter);
  };
  return <div className="space-y-4">
    <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Engineering input table</h2><p className="text-sm text-slate-500">Blank applicability means every configuration. Value-origin classification and source provenance are independently recorded.</p></div><div className="flex gap-2"><input className="field w-60" placeholder="Search owner, name, semantic key" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="btn btn-primary" onClick={create}><Plus size={15} /> Parameter</button></div></div>
      <div className="mt-4 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Owner / parameter</th><th>Semantic key</th><th>Value</th><th>Range</th><th>Origin</th><th>Applicability</th><th /></tr></thead><tbody>{entries.map(({ element, parameter }) => <tr className="border-b border-slate-100" key={parameter.id}><td className="p-2"><strong>{parameter.name}</strong><div className="text-xs text-slate-500">{element.name} · {parameter.id}</div></td><td><code>{parameter.semanticKey}</code></td><td>{parameter.value === null ? "Not available" : String(parameter.value)} {parameter.unit}</td><td>{parameter.minimum ?? "—"} … {parameter.maximum ?? "—"}{parameter.uncertaintyPercent !== undefined && ` · ±${parameter.uncertaintyPercent}%`}</td><td><span className={`badge ${parameter.valueOrigin === "entered" ? "bg-blue-50 text-blue-700" : parameter.valueOrigin === "assumed" ? "bg-amber-50 text-amber-700" : "bg-purple-50 text-purple-700"}`}>{parameter.valueOrigin}</span><div className="text-xs text-slate-500">{parameter.source || "No source"}</div></td><td>{parameter.applicableConfigurationIds.length ? parameter.applicableConfigurationIds.join(", ") : "Every configuration"}</td><td className="whitespace-nowrap"><button className="btn mr-1" onClick={() => edit(element.id, parameter)}>Edit</button><button className="btn btn-danger" onClick={async () => {
          const references = project.kpis.filter((kpi) => kpi.inputParameterIds.includes(parameter.id) || kpi.formula?.includes(`param("${parameter.id}")`));
          if (await confirm(`Delete ${parameter.name}? ${references.length} KPI formula reference(s) may become invalid.`, { confirmLabel: "Delete", tone: "danger" })) deleteParameter(element.id, parameter.id);
        }}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>
    </section>
    <section className="card p-5"><h2 className="text-lg font-bold">Authoritative process duration</h2><p className="text-sm text-slate-500">Only metadata.duration and metadata.durationUnit are editable. One engineering day is assumed to equal eight hours.</p><div className="mt-3 grid grid-cols-3 gap-2">{project.elements.filter((element) => element.elementType === "processFunction").map((process) => <button className="rounded-lg border p-3 text-left" key={process.id} onClick={async () => {
      const duration = Number(await promptText("Positive process duration", String(process.metadata.duration ?? "")));
      const durationUnit = (await promptText("Unit: minute, hour, or day", process.metadata.durationUnit ?? "minute")) as "minute" | "hour" | "day" | null;
      if (!Number.isFinite(duration) || duration <= 0 || !durationUnit || !["minute", "hour", "day"].includes(durationUnit)) return void alertUser("Enter a positive duration and valid unit.");
      updateElement(process.id, { metadata: { ...process.metadata, duration, durationUnit } });
    }}><strong>{process.name}</strong><div className="text-sm text-slate-500">{process.metadata.duration ?? "Missing"} {process.metadata.durationUnit ?? ""}</div></button>)}</div></section>
    <section className="card p-5"><h2 className="text-lg font-bold">Industrial-component resource quantity</h2><p className="text-sm text-slate-500">The authoritative quantity lives on each industrial-system component —requiresResource→ resource relationship. Process cost and demand use the durations of the process functions realized by that component.</p><div className="mt-3 space-y-2">{project.relationships.filter((relationship) => relationship.relationshipType === "requiresResource").map((relationship) => {
      const source = project.elements.find((element) => element.id === relationship.sourceId);
      const target = project.elements.find((element) => element.id === relationship.targetId);
      return <button className="flex w-full justify-between rounded-lg border p-3 text-left" key={relationship.id} onClick={async () => {
        const quantity = Number(await promptText("Required component resource quantity (> 0)", String(relationship.requiredQuantity ?? 1)));
        if (!Number.isFinite(quantity) || quantity <= 0) return void alertUser("Required quantity must be finite and greater than zero.");
        const error = updateRelationship(relationship.id, { requiredQuantity: quantity, quantity });
        if (error) void alertUser(error);
      }}><span><strong>{source?.name}</strong> → {target?.name}</span><span>{relationship.requiredQuantity ?? "1 (default)"} {relationship.unit}</span></button>;
    })}</div></section>
  </div>;
}

function KpiTable() {
  const { confirm, promptText, alertUser } = useDialogs();
  const project = useAppStore(selectActiveProject)!;
  const addKpi = useAppStore((state) => state.addKpi);
  const updateKpi = useAppStore((state) => state.updateKpi);
  const deleteKpi = useAppStore((state) => state.deleteKpi);
  const [formulaEditorId, setFormulaEditorId] = useState("");
  const [formulaDraft, setFormulaDraft] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [kpiName, setKpiName] = useState("");
  const [kpiMode, setKpiMode] = useState<KPI["calculationMode"]>("formula");
  const [kpiAlgorithm, setKpiAlgorithm] = useState<StandardAlgorithmKey>("totalMass");
  const [kpiUnit, setKpiUnit] = useState("");
  const [kpiDirection, setKpiDirection] = useState<KPI["optimizationDirection"]>("minimize");
  const [kpiWeight, setKpiWeight] = useState(1);
  const [kpiObjectiveId, setKpiObjectiveId] = useState("");
  const [kpiFormula, setKpiFormula] = useState("");
  const [createError, setCreateError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const formulaKpi = project.kpis.find((kpi) => kpi.id === formulaEditorId);
  const parameterTokens = project.elements.flatMap((element) => element.parameters.map((parameter) => ({
    id: parameter.id,
    label: `${element.name} / ${parameter.name}`,
    token: `param("${parameter.id}")`
  })));
  const kpiTokens = project.kpis.filter((kpi) => kpi.id !== formulaEditorId).map((kpi) => ({
    id: kpi.id,
    label: kpi.name,
    token: `kpi("${kpi.id}")`
  }));
  const matchingTokens = [...parameterTokens, ...kpiTokens].filter((item) =>
    `${item.label} ${item.id}`.toLowerCase().includes(tokenSearch.toLowerCase())
  );
  const create = () => {
    const name = kpiName.trim();
    if (!name || !kpiUnit.trim() || !Number.isFinite(kpiWeight) || kpiWeight < 0) {
      setCreateError("Enter a KPI name, output unit and non-negative weight.");
      return;
    }
    let references = { parameterIds: [] as string[], kpiIds: [] as string[] };
    try {
      if (kpiMode === "formula") {
        references = formulaReferences(parseKpiFormula(kpiFormula));
        const parameters = new Set(project.elements.flatMap((element) => element.parameters.map((parameter) => parameter.id)));
        const missing = [...references.parameterIds.filter((id) => !parameters.has(id)), ...references.kpiIds.filter((id) => !project.kpis.some((kpi) => kpi.id === id))];
        if (missing.length) throw new Error(`Missing references: ${missing.join(", ")}.`);
      }
    } catch (error) { setCreateError(error instanceof Error ? error.message : "Invalid KPI formula."); return; }
    const now = new Date().toISOString();
    const id = `kpi-${crypto.randomUUID()}`;
    addKpi({ id, name, description: "", objectiveIds: kpiObjectiveId ? [kpiObjectiveId] : [], calculationMode: kpiMode, formula: kpiMode === "formula" ? kpiFormula : undefined, standardAlgorithmKey: kpiMode === "standardAlgorithm" ? kpiAlgorithm : undefined, outputUnit: kpiUnit.trim(), optimizationDirection: kpiDirection, weight: kpiWeight, inputParameterIds: references.parameterIds, dependsOnKpiIds: references.kpiIds, calculationWarnings: [], createdAt: now, updatedAt: now });
    setKpiName(""); setKpiFormula(""); setCreateError(""); setShowCreateForm(false);
  };
  const edit = async (kpi: KPI) => {
    if (kpi.calculationMode === "formula") {
      setFormulaEditorId(kpi.id);
      setFormulaDraft(kpi.formula ?? "");
    } else {
      const name = (await promptText("KPI name", kpi.name))?.trim();
      if (!name) return;
      const description = (await promptText("KPI description", kpi.description)) ?? kpi.description;
      const outputUnit = (await promptText("Output unit", kpi.outputUnit)) ?? kpi.outputUnit;
      const optimizationDirection = (await promptText("Optimization direction: minimize or maximize", kpi.optimizationDirection))?.trim() as KPI["optimizationDirection"] | undefined;
      const weight = Number(await promptText("Weight", String(kpi.weight)));
      if (!optimizationDirection || !["minimize", "maximize"].includes(optimizationDirection) || !Number.isFinite(weight)) return void alertUser("Enter a valid optimization direction and finite weight.");
      updateKpi(kpi.id, { name, description, outputUnit, optimizationDirection, weight, formula: undefined });
    }
  };
  const preview = (kpi: KPI) => {
    const dependencies = kpi.calculationMode === "formula" && kpi.formula ? formulaReferences(parseKpiFormula(kpi.formula)).kpiIds : [];
    const calculation = calculateSelectedKpis(project, architectureCompatibleModel(project, project.activeArchitectureId ?? ""), [...dependencies, kpi.id]);
    const value = calculation.results.find((result) => result.kpiId === kpi.id);
    void alertUser(calculation.errors.length ? calculation.errors.join("\n") : `${kpi.name}: ${value?.value ?? "Not available"} ${value?.unit ?? kpi.outputUnit}\n${value?.warnings.join("\n") ?? ""}`);
  };
  return <section className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">KPI definitions</h2><p className="text-sm text-slate-500">Formula references are exact stable IDs; no display-name matching or dynamic JavaScript is used.</p></div>{!showCreateForm && <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}><Plus size={15} /> KPI</button>}</div>
    {showCreateForm && <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold">Create and select KPI</h3><button className="btn" onClick={() => { setShowCreateForm(false); setCreateError(""); }}>Close</button></div>
      <div className="mt-3 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        <label><span className="label">KPI name</span><input className="field" value={kpiName} onChange={(event) => setKpiName(event.target.value)} /></label>
        <label><span className="label">Calculation method</span><select className="field" value={kpiMode} onChange={(event) => setKpiMode(event.target.value as KPI["calculationMode"])}><option value="formula">Formula</option><option value="standardAlgorithm">Standard algorithm</option></select></label>
        {kpiMode === "standardAlgorithm" && <label><span className="label">Standard algorithm</span><select className="field" value={kpiAlgorithm} onChange={(event) => setKpiAlgorithm(event.target.value as StandardAlgorithmKey)}>{algorithms.map((algorithm) => <option key={algorithm} value={algorithm}>{algorithm}</option>)}</select></label>}
        <label><span className="label">Output unit</span><input className="field" value={kpiUnit} onChange={(event) => setKpiUnit(event.target.value)} placeholder="kg, EUR, h…" /></label>
        <label><span className="label">Optimization direction</span><select className="field" value={kpiDirection} onChange={(event) => setKpiDirection(event.target.value as KPI["optimizationDirection"])}><option value="minimize">Minimize</option><option value="maximize">Maximize</option></select></label>
        <label><span className="label">Global weight</span><input className="field" type="number" min="0" value={kpiWeight} onChange={(event) => setKpiWeight(Number(event.target.value))} /></label>
        <label><span className="label">Objective measured</span><select className="field" value={kpiObjectiveId} onChange={(event) => setKpiObjectiveId(event.target.value)}><option value="">Select an objective (optional)</option>{project.elements.filter((element) => element.elementType === "objective").map((objective) => <option key={objective.id} value={objective.id}>{objective.name}</option>)}</select></label>
      </div>
      {kpiMode === "formula" && <div className="mt-4"><KpiFormulaBuilder project={project} value={kpiFormula} onDraftChange={setKpiFormula} onSave={(formula) => { setKpiFormula(formula); setCreateError(""); }} /></div>}
      {createError && <p role="alert" className="mt-2 text-sm text-red-700">{createError}</p>}
      <button className="btn btn-primary mt-4" onClick={create}><Plus size={15} /> Create KPI</button>
    </div>}
    {formulaKpi && <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4"><div className="flex justify-between"><div><h3 className="font-bold">Formula editor · {formulaKpi.name}</h3><p className="text-xs text-slate-600">Search the canonical model and insert exact immutable reference tokens.</p></div><button className="btn" onClick={() => setFormulaEditorId("")}>Close</button></div>
      <textarea className="field mt-3 min-h-24 font-mono" value={formulaDraft} onChange={(event) => setFormulaDraft(event.target.value)} />
      <div className="mt-3 grid grid-cols-[260px_1fr] gap-3 max-md:grid-cols-1"><input className="field" value={tokenSearch} onChange={(event) => setTokenSearch(event.target.value)} placeholder="Search parameters and KPIs" /><div className="flex max-h-32 flex-wrap gap-2 overflow-auto">{matchingTokens.map((item) => <button className="btn bg-white" key={`${item.token}-${item.id}`} title={item.token} onClick={() => setFormulaDraft((draft) => `${draft}${draft && !/[\s(,+\-*/]$/.test(draft) ? " " : ""}${item.token}`)}>{item.label}<code className="ml-1 text-[10px]">{item.token}</code></button>)}</div></div>
      <button className="btn btn-primary mt-3" onClick={() => {
        try {
          const ast = parseKpiFormula(formulaDraft);
          const references = formulaReferences(ast);
          updateKpi(formulaKpi.id, { formula: formulaDraft, inputParameterIds: references.parameterIds, dependsOnKpiIds: references.kpiIds, standardAlgorithmKey: undefined });
          setFormulaEditorId("");
        } catch (error) { void alertUser(error instanceof Error ? error.message : "Invalid formula."); }
      }}>Validate and save formula</button>
    </div>}
    <div className="mt-4 space-y-3">{project.kpis.map((kpi) => {
      const details = kpi.standardAlgorithmKey ? algorithmDetails[kpi.standardAlgorithmKey] : undefined;
      return <article className="rounded-lg border p-4" key={kpi.id}><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex gap-2"><h3 className="font-bold">{kpi.name}</h3><span className="badge bg-purple-50 text-purple-700">{kpi.calculationMode}</span>{details && <span className="badge bg-slate-100 text-slate-700">algorithm locked</span>}</div><code className="mt-1 block text-xs">{kpi.formula ?? kpi.standardAlgorithmKey}</code><p className="mt-1 text-xs text-slate-500">Output {kpi.outputUnit || "dimensionless"} · {kpi.optimizationDirection} · weight {kpi.weight} · {kpi.id}</p>{kpi.inputParameterIds.length > 0 && <p className="text-xs text-slate-500">Parameters: {kpi.inputParameterIds.join(", ")}</p>}{kpi.dependsOnKpiIds.length > 0 && <p className="text-xs text-slate-500">Required selected KPI dependencies: {kpi.dependsOnKpiIds.join(", ")}</p>}<fieldset className="mt-3"><legend className="label">Objectives measured by this KPI</legend><div className="flex flex-wrap gap-2">{project.elements.filter((element) => element.elementType === "objective").map((objective) => <label className={`rounded-lg border px-2 py-1 text-xs ${kpi.objectiveIds.includes(objective.id) ? "border-purple-300 bg-purple-50" : "border-slate-200"}`} key={objective.id}><input className="mr-1" type="checkbox" checked={kpi.objectiveIds.includes(objective.id)} onChange={(event) => updateKpi(kpi.id, { objectiveIds: event.target.checked ? [...kpi.objectiveIds, objective.id] : kpi.objectiveIds.filter((id) => id !== objective.id) })} />{objective.name}</label>)}</div></fieldset>{kpi.standardAlgorithmKey === "totalMass" && <MassContributions />}{details && <details className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs"><summary className="cursor-pointer font-semibold text-blue-900">Standard algorithm explanation</summary><dl className="mt-2 grid grid-cols-[100px_1fr] gap-2"><dt className="font-semibold">Logic</dt><dd>{details.logic}</dd><dt className="font-semibold">Inputs</dt><dd>{details.inputs}</dd><dt className="font-semibold">Output</dt><dd>{details.unit}</dd><dt className="font-semibold">Conditions / limitations</dt><dd>{details.limitations}</dd></dl></details>}</div><button className="btn" onClick={() => preview(kpi)}><Calculator size={14} /> Preview</button><button className="btn" onClick={() => edit(kpi)}>Edit metadata</button><button className="btn btn-danger" onClick={async () => {
        if (!(await confirm(`Delete KPI ${kpi.name}? Historical evidence may require it to be retained.`, { confirmLabel: "Delete", tone: "danger" }))) return;
        const error = deleteKpi(kpi.id);
        if (error) void alertUser(error);
      }}><Trash2 size={14} /></button></div></article>;
    })}</div>
  </section>;
}
