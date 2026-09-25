import { SemanticExportPanel } from "./SemanticWorkspace";
import { Download, FileJson, FileSpreadsheet, FileText, FolderOpen, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildExportPackage, defaultExportFilters, serializeExportPackage, type ExportFilters } from "../domain/exportImport";
import { buildPdfReport, type PdfReportOptions } from "../domain/pdfReport";
import { sourceProjectSnapshots } from "../domain/snapshots";
import { elementTypeLabels, elementTypes, relationshipTypes } from "../domain/types";
import { xlsxBlob } from "../domain/xlsxExport";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

const tabs = ["Save / Load Project", "Snapshots", "Selective Export", "PDF Report", "Demo Checklist"] as const;
type Tab = typeof tabs[number];

function downloadBlob(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";

export function ExportWorkspace() {
  const workflowFocus = useAppStore((state) => state.uiPreferences.workflowFocus);
  const [tab, setTab] = useState<Tab>(workflowFocus?.startsWith("delivery:") ? "Save / Load Project" : "Snapshots");
  useEffect(() => {
    if (!workflowFocus?.startsWith("delivery:")) return;
    setTab("Save / Load Project");
    const targetId = workflowFocus === "delivery:load" ? "load-project" : "save-project";
    const frame = requestAnimationFrame(() => document.getElementById(targetId)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [workflowFocus]);
  return <div className="space-y-4">
    <header className="flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1"><div className="flex items-center gap-3"><h1 className="text-3xl font-bold">Snapshots and Delivery</h1><span className="badge bg-blue-50 text-blue-700">Stage C</span></div><p className="mt-1 text-slate-600">Create basic local recovery points and export validated, scoped engineering evidence.</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Preliminary engineering estimate — not a verified detailed-design result.</div></header>
    <section className="card flex flex-wrap gap-2 p-4" role="tablist" aria-label="Delivery sections">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>{item}</button>)}</section>
    {tab === "Save / Load Project" && <ProjectSaveLoad />}
    {tab === "Snapshots" && <SnapshotsPanel />}
    {tab === "Selective Export" && <><SelectiveExport /><SemanticExportPanel /></>}
    {tab === "PDF Report" && <PdfPanel />}
    {tab === "Demo Checklist" && <DemoChecklist />}
  </div>;
}

function ProjectSaveLoad() {
  const project = useAppStore(selectActiveProject)!;
  const [message, setMessage] = useState("");
  const exportState = useMemo(() => {
    try {
      return { payload: buildExportPackage(project, defaultExportFilters()), error: "" };
    } catch (cause) {
      return {
        payload: undefined,
        error: cause instanceof Error ? cause.message : "The project package could not be prepared."
      };
    }
  }, [project]);
  return <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
    <section className="card p-5" aria-labelledby="save-project-heading">
      <div className="flex items-start gap-3"><div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Save size={20} /></div><div><h2 id="save-project-heading" className="text-lg font-bold">Save Project</h2><p className="mt-1 text-sm text-slate-600">Download the complete active project as a portable, validated JSON package.</p></div></div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong>{project.name}</strong><br />Schema {project.schemaVersion} · revision {project.modelRevision} · {project.elements.length} model elements</div>
      <p className="mt-3 text-xs text-slate-500">The project file includes model, variability, configurations, derivations, simulation evidence, Trade Studies and decisions. Application-level snapshots and interface preferences remain local and are not embedded.</p>
      <button id="save-project" className="btn btn-primary mt-4" disabled={!exportState.payload} onClick={() => {
        if (!exportState.payload) return;
        downloadBlob(`${safeName(project.name)}.mbse-project.json`, serializeExportPackage(exportState.payload), "application/json");
        setMessage("Project file downloaded.");
      }}><Download size={15} /> Download project file</button>
      {exportState.error && <p className="mt-3 text-sm text-red-700" role="alert">Project file unavailable: {exportState.error}</p>}
      {message && <p className="mt-3 text-sm text-green-700" aria-live="polite">{message}</p>}
    </section>
    <JsonImport />
  </div>;
}

function SnapshotsPanel() {
  const project = useAppStore(selectActiveProject)!;
  const snapshots = useAppStore((state) => state.snapshots);
  const create = useAppStore((state) => state.createSnapshot);
  const remove = useAppStore((state) => state.deleteSnapshot);
  const restore = useAppStore((state) => state.restoreSnapshot);
  const duplicate = useAppStore((state) => state.duplicateSnapshot);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const list = sourceProjectSnapshots(snapshots, project.id);
  const submit = () => {
    let error = create(name, note);
    if (error?.startsWith("PMC-112") && window.confirm(`${error}\n\nReplace the oldest snapshot?`)) error = create(name, note, true);
    setMessage(error ?? "Snapshot created.");
    if (!error) { setName(""); setNote(""); }
  };
  return <div className="grid grid-cols-[360px_1fr] gap-4 max-lg:grid-cols-1">
    <section className="card p-5"><h2 className="text-lg font-bold">Create named snapshot</h2><p className="mt-1 text-sm text-slate-500">Basic local snapshots — not enterprise version control.</p><label className="mt-4 block"><span className="label">Required name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="mt-3 block"><span className="label">Optional note</span><textarea className="field" value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="btn btn-primary mt-4" disabled={!name.trim()} onClick={submit}><Plus size={14} /> Create snapshot</button>{message && <p aria-live="polite" className={`mt-3 text-sm ${message.includes("created") ? "text-green-700" : "text-amber-800"}`}>{message}</p>}</section>
    <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Application-level snapshots</h2><p className="text-sm text-slate-500">{list.length}/20 for this source project · newest first</p></div></div><div className="mt-4 space-y-3">{list.map((snapshot) => <article className="rounded-lg border p-4" key={snapshot.id}><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-bold">{snapshot.name}</h3><p className="text-sm text-slate-600">{snapshot.note || "No note."}</p><p className="mt-1 text-xs text-slate-500">{new Date(snapshot.createdAt).toLocaleString()} · schema {snapshot.schemaVersion} · {snapshot.projectName}</p></div><button className="btn" onClick={() => {
          if (!window.confirm(`Restore “${snapshot.name}”? A safety snapshot will be created first.`)) return;
          let error = restore(snapshot.id);
          if (error?.startsWith("PMC-112") && window.confirm(`${error}\n\nReplace the oldest snapshot?`)) {
            error = restore(snapshot.id, true);
          }
          setMessage(error ?? "PMC-203: Safety snapshot created and project restored.");
        }}><RotateCcw size={14} /> Restore</button><button className="btn" onClick={() => setMessage(duplicate(snapshot.id) ?? "Snapshot duplicated as a new project.")}>Duplicate as project</button><button className="btn" onClick={() => downloadBlob(`${safeName(snapshot.name)}.json`, snapshot.projectData, "application/json")}><Download size={14} /> Raw</button><button aria-label={`Delete snapshot ${snapshot.name}`} className="btn btn-danger" onClick={() => window.confirm(`Delete snapshot “${snapshot.name}”?`) && remove(snapshot.id)}><Trash2 size={14} /></button></div></article>)}</div>{!list.length && <p className="py-10 text-center text-sm text-slate-500">No snapshots for this project.</p>}</section>
  </div>;
}

function SelectiveExport() {
  const project = useAppStore(selectActiveProject)!;
  const [filters, setFilters] = useState<ExportFilters>(defaultExportFilters);
  const [message, setMessage] = useState("");
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const payload = useMemo(() => {
    try { return buildExportPackage(project, filters); } catch { return undefined; }
  }, [project, filters]);
  const error = useMemo(() => {
    try { buildExportPackage(project, filters); return ""; } catch (cause) { return cause instanceof Error ? cause.message : "Export preview failed."; }
  }, [project, filters]);
  const tags = [...new Set(project.elements.flatMap((element) => element.tags))].sort();
  const patch = (value: Partial<ExportFilters>) => setFilters((current) => ({ ...current, ...value }));
  const toggle = <T extends string>(items: T[], item: T, checked: boolean) => checked ? [...items, item] : items.filter((candidate) => candidate !== item);
  return <div className="grid grid-cols-[420px_1fr] gap-4 max-xl:grid-cols-1">
    <section className="card p-5"><h2 className="text-lg font-bold">Shared JSON/XLSX scope</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label><span className="label">Scope</span><select className="field" value={filters.scope} onChange={(event) => patch({ scope: event.target.value as ExportFilters["scope"] })}><option value="complete">Complete project</option><option value="selection">Selection</option></select></label>
        <label><span className="label">Model domain</span><select className="field" value={filters.modelDomain} onChange={(event) => patch({ modelDomain: event.target.value as ExportFilters["modelDomain"] })}><option value="all">All domains</option><option value="requirements">Mission and requirements</option><option value="product">Product</option><option value="process">Process</option><option value="resources">Resources</option></select></label>
        <label><span className="label">Architecture</span><select className="field" value={filters.architectureId ?? ""} onChange={(event) => patch({ architectureId: event.target.value || undefined })}><option value="">All</option>{project.architectures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className="label">Configuration</span><select className="field" value={filters.configurationId ?? ""} onChange={(event) => patch({ configurationId: event.target.value || undefined })}><option value="">All</option>{project.configurations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {filters.scope === "selection" && <><details className="mt-4 rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Element types and individual elements</summary><div className="mt-3 grid grid-cols-2 gap-2">{elementTypes.map((type) => <label key={type} className="text-sm"><input className="mr-2" type="checkbox" checked={filters.elementTypes.includes(type)} onChange={(event) => patch({ elementTypes: toggle(filters.elementTypes, type, event.target.checked) })} />{elementTypeLabels[type]}</label>)}</div><label className="mt-3 block"><span className="label">Individual elements</span><select multiple className="field min-h-40" value={filters.elementIds} onChange={(event) => patch({ elementIds: [...event.target.selectedOptions].map((option) => option.value) })}>{project.elements.map((element) => <option key={element.id} value={element.id}>{element.name} · {element.elementType}</option>)}</select></label></details>
        <details className="mt-3 rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Features, relationships, and tags</summary><label className="mt-3 block"><span className="label">Features</span><select multiple className="field min-h-32" value={filters.featureIds} onChange={(event) => patch({ featureIds: [...event.target.selectedOptions].map((option) => option.value) })}>{project.features.map((feature) => <option key={feature.id} value={feature.id}>{feature.name}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-2">{relationshipTypes.map((type) => <label className="text-sm" key={type}><input className="mr-2" type="checkbox" checked={filters.relationshipTypes.includes(type)} onChange={(event) => patch({ relationshipTypes: toggle(filters.relationshipTypes, type, event.target.checked) })} />{type}</label>)}</div><div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <label className="rounded border px-2 py-1 text-sm" key={tag}><input className="mr-2" type="checkbox" checked={filters.tags.includes(tag)} onChange={(event) => patch({ tags: toggle(filters.tags, tag, event.target.checked) })} />{tag}</label>)}</div></details></>}
      <fieldset className="mt-4"><legend className="label">Optional records</legend><div className="grid grid-cols-2 gap-2">{([
        ["includeValidationResults", "Validation results"], ["includeKpiDefinitions", "KPI definitions"],
        ["includeSimulationResults", "Simulation results"], ["includeComparisons", "Comparisons"],
        ["includeDecisions", "Decisions"]
      ] as const).map(([key, label]) => <label key={key} className="text-sm"><input className="mr-2" type="checkbox" checked={filters[key]} onChange={(event) => patch({ [key]: event.target.checked })} />{label}</label>)}</div></fieldset>
      <fieldset className="mt-4"><legend className="label">Relationship integrity</legend><label className="block text-sm"><input className="mr-2" type="radio" checked={filters.relationshipClosure === "includeEndpoints"} onChange={() => patch({ relationshipClosure: "includeEndpoints" })} />Automatically include relationship endpoints</label><label className="mt-2 block text-sm"><input className="mr-2" type="radio" checked={filters.relationshipClosure === "omitIncomplete"} onChange={() => patch({ relationshipClosure: "omitIncomplete" })} />Omit incomplete relationships and record them</label></fieldset>
    </section>
    <section className="space-y-4">
      <div className="card p-5"><h2 className="text-lg font-bold">Export preview</h2><p className="mt-1 text-sm text-slate-500">Scope and reference closure are calculated before any download.</p>{payload ? <><dl className="mt-4 grid grid-cols-2 gap-3">{Object.entries(payload.manifest.counts).map(([key, value]) => <div className="rounded-lg bg-slate-50 p-3" key={key}><dt className="text-xs text-slate-500">{key}</dt><dd className="text-xl font-bold">{value}</dd></div>)}</dl><p className="mt-4 text-sm">Omitted relationships: {payload.manifest.omittedRelationshipIds.length}</p>{payload.manifest.warnings.map((warning) => <p className="mt-2 text-sm text-amber-800" key={warning}>{warning}</p>)}</> : <p className="mt-4 text-sm text-red-700">{error}</p>}</div>
      <div className="card p-5"><h2 className="text-lg font-bold">Download selected delivery</h2><div className="mt-4 flex flex-wrap gap-3"><button className="btn btn-primary" disabled={!payload} onClick={() => {
        if (!payload) return;
        downloadBlob(`${safeName(project.name)}-export.json`, serializeExportPackage(payload), "application/json");
        setMessage("JSON package downloaded.");
      }}><FileJson size={15} /> JSON</button><button className="btn btn-primary" disabled={!payload || exportingXlsx} onClick={async () => {
        if (!payload) return;
        setExportingXlsx(true);
        setMessage("Preparing XLSX workbook…");
        try {
          const workbook = await xlsxBlob(payload);
          downloadBlob(`${safeName(project.name)}-export.xlsx`, workbook, workbook.type);
          setMessage("XLSX workbook downloaded.");
        } catch {
          setMessage("XLSX workbook generation failed. No file was downloaded.");
        } finally {
          setExportingXlsx(false);
        }
      }}><FileSpreadsheet size={15} /> {exportingXlsx ? "Preparing XLSX…" : "XLSX"}</button></div>{message && <p className={`mt-3 text-sm ${message.includes("failed") ? "text-red-700" : "text-green-700"}`} aria-live="polite">{message}</p>}</div>
    </section>
  </div>;
}

function JsonImport() {
  const importPackage = useAppStore((state) => state.importProjectPackage);
  const project = useAppStore(selectActiveProject)!;
  const snapshots = useAppStore((state) => state.snapshots);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"new" | "replace">("new");
  const [messages, setMessages] = useState<string[]>([]);
  const execute = () => {
    let replaceOldestSnapshot = false;
    if (mode === "replace") {
      const atLimit = sourceProjectSnapshots(snapshots, project.id).length >= 20;
      const prompt = atLimit
        ? "Replace only the active project? A safety snapshot will replace the oldest existing snapshot because the 20-snapshot limit has been reached."
        : "Replace only the active project? A safety snapshot will be created first.";
      if (!window.confirm(prompt)) return;
      replaceOldestSnapshot = atLimit;
    }
    const result = importPackage(raw, mode, replaceOldestSnapshot);
    setMessages([...result.errors, ...result.warnings, ...(!result.errors.length ? ["Project loaded."] : [])]);
  };
  return <section className="card p-5" aria-labelledby="load-project-heading"><div className="flex items-start gap-3"><div className="rounded-lg bg-purple-50 p-2 text-purple-700"><FolderOpen size={20} /></div><div><h2 id="load-project-heading" className="text-lg font-bold">Load Project</h2><p className="mt-1 text-sm text-slate-600">Validate a saved project file before loading it. Invalid input changes nothing and remains available for raw download.</p></div></div><label className="mt-4 block"><span className="label">Saved project file</span><input id="load-project" className="field" type="file" accept=".json,.mbse-project.json,application/json" onChange={async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRaw(await file.text());
    setMessages([]);
  }} /></label><fieldset className="mt-4"><legend className="label">Load behavior</legend><label className="mr-5 inline-flex items-start"><input className="mr-2 mt-1" type="radio" checked={mode === "new"} onChange={() => setMode("new")} /><span><strong className="block">Load as new project</strong><span className="text-xs text-slate-500">Keep the active project and resolve only a top-level project-ID collision.</span></span></label><label className="mt-3 inline-flex items-start sm:mt-0"><input className="mr-2 mt-1" type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /><span><strong className="block">Replace active project</strong><span className="text-xs text-slate-500">Preserve the active project ID and create a safety snapshot first.</span></span></label></fieldset><div className="mt-4 flex flex-wrap gap-3"><button className="btn btn-primary" disabled={!raw} onClick={execute}><Upload size={14} /> Validate and load</button>{raw && <button className="btn" onClick={() => downloadBlob(fileName || "raw-import.json", raw, "application/json")}><Download size={14} /> Download raw input</button>}</div>{messages.length > 0 && <ul aria-live="polite" className={`mt-4 list-disc pl-5 text-sm ${messages.some((message) => message.startsWith("PMC-00")) ? "text-red-700" : "text-green-700"}`}>{messages.map((message) => <li key={message}>{message}</li>)}</ul>}</section>;
}

function PdfPanel() {
  const project = useAppStore(selectActiveProject)!;
  const [options, setOptions] = useState<PdfReportOptions>({
    title: "",
    architectureId: project.activeArchitectureId,
    configurationId: undefined,
    comparisonStudyId: project.comparisonStudies[0]?.id,
    comparisonResultId: project.comparisonStudies[0]?.results.at(-1)?.id,
    decisionId: project.decisions[0]?.id,
    includeValidation: true,
    includeSimulationDetails: true,
    includeRisks: true,
    scopeSummary: "Active project report"
  });
  const patch = (value: Partial<PdfReportOptions>) => setOptions((current) => ({ ...current, ...value }));
  const study = project.comparisonStudies.find((candidate) => candidate.id === options.comparisonStudyId);
  return <section className="card p-5"><h2 className="text-lg font-bold">PDF report scope</h2><p className="mt-1 text-sm text-slate-500">PDF scope is independent from JSON/XLSX selection. Missing Trade Study or decision content is reported honestly as unavailable.</p><div className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1">
    <label><span className="label">Report title</span><input className="field" value={options.title} onChange={(event) => patch({ title: event.target.value })} /></label>
    <label><span className="label">Scope summary</span><input className="field" value={options.scopeSummary} onChange={(event) => patch({ scopeSummary: event.target.value })} /></label>
    <label><span className="label">Architecture</span><select className="field" value={options.architectureId ?? ""} onChange={(event) => patch({ architectureId: event.target.value || undefined })}><option value="">Not selected</option>{project.architectures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Configuration</span><select className="field" value={options.configurationId ?? ""} onChange={(event) => patch({ configurationId: event.target.value || undefined })}><option value="">Not selected</option>{project.configurations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Trade Study</span><select className="field" value={options.comparisonStudyId ?? ""} onChange={(event) => patch({ comparisonStudyId: event.target.value || undefined, comparisonResultId: project.comparisonStudies.find((item) => item.id === event.target.value)?.results.at(-1)?.id })}><option value="">Not selected</option>{project.comparisonStudies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Trade Study result</span><select className="field" value={options.comparisonResultId ?? ""} onChange={(event) => patch({ comparisonResultId: event.target.value || undefined })}><option value="">Not selected</option>{study?.results.map((item) => <option key={item.id} value={item.id}>{new Date(item.timestamp).toLocaleString()}</option>)}</select></label>
    <label><span className="label">Formal decision</span><select className="field" value={options.decisionId ?? ""} onChange={(event) => patch({ decisionId: event.target.value || undefined })}><option value="">Not selected</option>{project.decisions.map((item) => <option key={item.id} value={item.id}>{item.question}</option>)}</select></label>
  </div><div className="mt-4 flex flex-wrap gap-4">{(["includeValidation", "includeSimulationDetails", "includeRisks"] as const).map((key) => <label key={key}><input className="mr-2" type="checkbox" checked={options[key]} onChange={(event) => patch({ [key]: event.target.checked })} />{key === "includeValidation" ? "Validation" : key === "includeSimulationDetails" ? "Simulation detail" : "Risks"}</label>)}</div><button className="btn btn-primary mt-5" onClick={() => buildPdfReport(project, options).save(`${safeName(project.name)}-report.pdf`)}><FileText size={15} /> Generate PDF</button></section>;
}

function DemoChecklist() {
  const items = [
    "Review objectives and evidence.", "Inspect traceability.", "Configure a variant.",
    "Derive the 100% model.", "Review parameters and KPIs.", "Run pre-sizing.",
    "Frame the unresolved decision.", "Select objectives, constraints, criteria, and design axes.",
    "Create candidate configurations.", "Check 100% evidence readiness.",
    "Analyze the Trade Study.", "Record and approve a baseline decision.",
    "Create a snapshot.", "Export selected results."
  ];
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  return <section className="card p-5"><h2 className="text-lg font-bold">In-app demo checklist</h2><ol className="mt-4 space-y-3">{items.map((item, index) => <li key={item}><label className={`flex items-center gap-3 rounded-lg border p-3 ${checked[index] ? "border-green-200 bg-green-50" : ""}`}><input type="checkbox" checked={checked[index]} onChange={(event) => setChecked((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /><span className="font-semibold">{index + 1}. {item}</span></label></li>)}</ol></section>;
}
