import { CheckCircle2, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { evaluateKpiFormula, formulaReferences, parseKpiFormula, type FormulaReferences } from "../domain/kpiFormulas";
import type { Project } from "../domain/types";

interface FormulaToken {
  id: string;
  token: string;
  label: string;
  detail: string;
  searchText: string;
  availability?: string;
}

export function KpiFormulaBuilder({
  project,
  value,
  onDraftChange,
  onSave,
  alternativeConfigurationIds = [],
  excludeKpiId,
  saveLabel = "Validate and use formula"
}: {
  project: Project;
  value: string;
  onDraftChange?: (formula: string) => void;
  onSave: (formula: string, references: FormulaReferences) => void;
  alternativeConfigurationIds?: string[];
  excludeKpiId?: string;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => setDraft(value), [value]);

  const configurationIds = useMemo(() => [...new Set(alternativeConfigurationIds)], [alternativeConfigurationIds]);
  const parameterTokens = useMemo<FormulaToken[]>(() => project.elements.flatMap((element) =>
    element.parameters.filter((parameter) => parameter.dataType === "number").map((parameter) => {
      const available = configurationIds.filter((configurationId) => {
        const configuration = project.configurations.find((candidate) => candidate.id === configurationId);
        return configuration?.derivation?.realizedElements.some((realized) =>
          realized.parameters.some((candidate) => candidate.id === parameter.id)
        );
      }).length;
      return {
        id: parameter.id,
        token: `param("${parameter.id}")`,
        label: parameter.name,
        detail: `${parameter.unit || "dimensionless"} · ${element.name} · ${element.elementType}`,
        availability: configurationIds.length
          ? `${available}/${configurationIds.length} selected alternatives`
          : "Available in the project model",
        searchText: `${parameter.name} ${parameter.description} ${parameter.unit ?? ""} ${parameter.semanticKey} ${element.name} ${element.elementType} ${element.tags.join(" ")} ${parameter.id}`.toLowerCase()
      };
    })
  ), [configurationIds, project]);
  const kpiTokens = useMemo<FormulaToken[]>(() => project.kpis
    .filter((kpi) => kpi.id !== excludeKpiId)
    .map((kpi) => ({
      id: kpi.id,
      token: `kpi("${kpi.id}")`,
      label: kpi.name,
      detail: `${kpi.outputUnit || "dimensionless"} · KPI reference`,
      searchText: `${kpi.name} ${kpi.description} ${kpi.outputUnit} ${kpi.id}`.toLowerCase()
    })), [excludeKpiId, project.kpis]);
  const matches = [...parameterTokens, ...kpiTokens]
    .filter((token) => !search.trim() || token.searchText.includes(search.toLowerCase()))
    .slice(0, 40);

  const changeDraft = (next: string) => {
    setDraft(next);
    setMessage("");
    onDraftChange?.(next);
  };
  const insert = (token: string) => {
    const separator = draft && !/[\s(,+\-*/]$/.test(draft) ? " + " : "";
    changeDraft(`${draft}${separator}${token}`);
  };
  const readable = draft
    .replace(/param\("([^"]+)"\)/g, (_match, id: string) => {
      const token = parameterTokens.find((candidate) => candidate.id === id);
      return token ? `[${token.detail.split(" · ")[1]} / ${token.label}]` : `[Missing parameter: ${id}]`;
    })
    .replace(/kpi\("([^"]+)"\)/g, (_match, id: string) => {
      const token = kpiTokens.find((candidate) => candidate.id === id);
      return token ? `[KPI: ${token.label}]` : `[Missing KPI: ${id}]`;
    });

  const validateAndSave = () => {
    try {
      const ast = parseKpiFormula(draft);
      const references = formulaReferences(ast);
      const parameters = new Map(project.elements.flatMap((element) => element.parameters).map((parameter) => [parameter.id, parameter]));
      const missingParameters = references.parameterIds.filter((id) => !parameters.has(id));
      const missingKpis = references.kpiIds.filter((id) => !project.kpis.some((kpi) => kpi.id === id));
      if (missingParameters.length || missingKpis.length) {
        throw new Error(`Missing references: ${[...missingParameters, ...missingKpis].join(", ")}.`);
      }
      if (!references.kpiIds.length) {
        const unitCheckParameters = new Map([...parameters].map(([id, parameter]) => [id, {
          ...parameter,
          value: typeof parameter.value === "number" ? parameter.value : 1
        }]));
        evaluateKpiFormula(ast, unitCheckParameters, new Map());
      }
      onSave(draft, references);
      setMessage("Formula syntax, references and available units are valid.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid KPI formula.");
    }
  };

  return <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4">
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)] gap-4 max-lg:grid-cols-1">
      <div>
        <label><span className="label">Formula</span><textarea aria-label="KPI formula" className="field min-h-28 font-mono" value={draft} onChange={(event) => changeDraft(event.target.value)} placeholder='param("parameter-id") + param("parameter-id")' /></label>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Formula operators">
          {[" + ", " - ", " * ", " / ", "min(", "max(", "sum(", "average(", ", ", ")"].map((operator) => <button type="button" className="btn bg-white font-mono" key={operator} onClick={() => changeDraft(`${draft}${operator}`)}>{operator.trim() || operator}</button>)}
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><div className="label">Readable formula</div><p className="break-words font-mono text-sm text-slate-700">{readable || "Select parameters or KPIs to construct the formula."}</p></div>
        <button type="button" className="btn btn-primary mt-3" onClick={validateAndSave}><CheckCircle2 size={15} /> {saveLabel}</button>
        {message && <p className={`mt-2 text-sm ${message.startsWith("Formula syntax") ? "text-green-700" : "text-red-700"}`} aria-live="polite">{message}</p>}
      </div>
      <div>
        <label className="relative block"><span className="label">Search model parameters or KPIs</span><Search className="absolute bottom-2.5 left-3 text-slate-400" size={16} /><input aria-label="Search formula parameters" className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, unit, element, type or tag" /></label>
        <p className="mt-1 text-[11px] text-slate-500">Only numeric model parameters are calculable. Custom table columns are not formula inputs.</p>
        <div className="mt-2 max-h-72 space-y-2 overflow-auto" aria-label="Formula token results">{matches.map((token) => <button type="button" key={`${token.token}-${token.id}`} className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-purple-400" onClick={() => insert(token.token)}><Plus className="mt-0.5 shrink-0 text-purple-700" size={15} /><span className="min-w-0"><strong className="block text-sm text-slate-950">{token.label}</strong><span className="block text-xs text-slate-600">{token.detail}</span>{token.availability && <span className="block text-xs text-blue-700">{token.availability}</span>}<code className="mt-1 block truncate text-[10px] text-slate-400">{token.token}</code></span></button>)}{!matches.length && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No matching calculable parameter or KPI.</p>}</div>
      </div>
    </div>
  </div>;
}
