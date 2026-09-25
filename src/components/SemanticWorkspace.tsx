import { scopeLabels, scopeLevelByProjectScope, type OntologyScopeLevel } from "../domain/scopeOntology";
import { useMemo, useState, type ReactNode } from "react";
import { buildSemanticGraph } from "../domain/semanticGraph";
import { semanticGraphExport } from "../domain/semanticGraphExport";
import { canonicalJson } from "../domain/semanticGraphIdentity";
import { buildSemanticSchema } from "../domain/semanticGraphSchema";
import { validateSemanticGraph } from "../domain/semanticGraphValidation";
import { architectSemanticView, studySemanticView } from "../domain/semanticGraphViews";
import type { SemanticContext } from "../domain/semanticGraphTypes";
import type { Project } from "../domain/types";
import { disableSemanticGraphPreviews, getSemanticGraphFlags, semanticFlagNames, setSemanticGraphFlag, useSemanticGraphFlags, type SemanticFlag } from "../features/semanticGraphFlags";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import { SemanticGraphErrorBoundary } from "./SemanticGraphErrorBoundary";
import { SemanticGraphView } from "./SemanticGraphView";
export function SemanticRolloutControls() {
  const flags = useSemanticGraphFlags();
  const labels: Record<SemanticFlag, string> = { buildInShadow: "Background diagnostics", showProjectDigitalThreadTab: "Project digital thread", useRegistryForSchemaView: "Registry schema", useSemanticTradeStudyView: "Trade Study preview", showSemanticMatrix: "Read-only matrix", showArchitectSemanticGraph: "Architect preview", showModelerSemanticInspector: "Modeler trace inspector", enableSemanticExport: "Semantic JSON export" };
  return <details className="semantic-options"><summary>Semantic view controls</summary><p className="mt-2">The Project Digital Thread and registry schema are enabled after parity verification. Other views can be enabled independently for this session. These choices do not change your project.</p>{semanticFlagNames.map(flag => <label key={flag}><input type="checkbox" checked={flags[flag]} onChange={e => setSemanticGraphFlag(flag, e.target.checked)} />{labels[flag]}</label>)}<button onClick={disableSemanticGraphPreviews}>Use existing views only</button></details>;
}
export function SemanticProjectPanel({ project, studyId, visibleElementIds, initialRecordId, schema = false, initialView = "graph", initialPreset = "canonical" }: { project: Project; studyId?: string; visibleElementIds?: ReadonlySet<string>; initialRecordId?: string; schema?: boolean; initialView?: "graph" | "matrix"; initialPreset?: "canonical" | "missionToBaseline" }) {
  const flags = useSemanticGraphFlags();
  const [schemaScope, setSchemaScope] = useState<OntologyScopeLevel>(scopeLevelByProjectScope[project.overallScope ?? "tradeStudy"]);
  const [exportError, setExportError] = useState("");
  const [context, setContext] = useState<SemanticContext>({ type: "live" });
  const contexts: { label: string; context: SemanticContext }[] = [{ label: "Current project", context: { type: "live" } },
    ...project.configurations.flatMap(c => c.derivation ? [{ label: `Derivation · ${c.name} · ${c.derivation.timestamp}`, context: { type: "derivation" as const, configurationId: c.id, derivationId: c.derivation.id } }] : []),
    ...project.simulationRuns.map(r => ({ label: `Simulation · ${r.name} · ${r.timestamp}`, context: { type: "simulation" as const, simulationRunId: r.id } })),
    ...project.decisions.map(d => ({ label: `Decision · ${d.question}`, context: { type: "decision" as const, decisionId: d.id } }))];
  const result = useMemo(() => schema ? { graph: (() => {
    const g = buildSemanticSchema();
    const nodes = g.nodes.filter(n => (n.domain === "variability" || n.domain === "decision" || n.kind === "comparisonResult" ? 2 : ["kpi", "simulationRun", "simulationResult"].includes(n.kind) ? 1 : 0) <= schemaScope);
    const ids = new Set(nodes.map(n => n.id)); return { ...g, nodes, edges: g.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
  })(), diagnostics: [], completeness: "complete" as const } : buildSemanticGraph(project, { context }), [project, context, schema, schemaScope]);
  const diagnostics = useMemo(() => [...result.diagnostics, ...(schema ? [] : validateSemanticGraph(result.graph))], [result, schema]);
  const graph = useMemo(() => visibleElementIds ? architectSemanticView(result.graph, visibleElementIds) : studyId && context.type === "live" ? studySemanticView(result.graph, studyId) : result.graph, [result, studyId, visibleElementIds, context.type]);
  const initialFocus = graph.nodes.find(n => n.recordId === initialRecordId)?.id;
  return <div className="space-y-3">
    <div className="semantic-toolbar"><strong>{schema ? "Ontology schema · registry" : "Project digital thread"}</strong>{!schema && !visibleElementIds && <label>Context <select aria-label="Semantic context" value={canonicalJson(context)} onChange={e => setContext(JSON.parse(e.target.value))}>{contexts.map(c => <option key={canonicalJson(c.context)} value={canonicalJson(c.context)}>{c.label}</option>)}</select></label>}<span>{schema ? "Supported entity types and directed predicates" : `${result.completeness} · ${diagnostics.length} trace diagnostics`}</span></div>
    {schema && <div className="semantic-toolbar" role="group" aria-label="Registry schema scope">{([0, 1, 2] as OntologyScopeLevel[]).map(level => <button key={level} aria-pressed={schemaScope === level} onClick={() => setSchemaScope(level)}>{scopeLabels[level]}</button>)}</div>}
    {!schema && flags.enableSemanticExport && <div className="semantic-toolbar"><button onClick={() => { try { downloadSemanticContext(project, context); setExportError(""); } catch { setExportError("Semantic export could not be prepared. Existing exports remain available."); } }}>Download this semantic context</button>{exportError && <p role="alert">{exportError}</p>}</div>}
    <SemanticGraphView key={`${project.id}:${canonicalJson(context)}:${initialFocus ?? ""}:${schema}:${initialPreset}`} graph={graph} initialView={initialView} initialFocus={initialFocus} matrixAvailable={flags.showSemanticMatrix} schema={schema} initialPreset={initialPreset} />
    {!!diagnostics.length && <details className="semantic-options"><summary>{diagnostics.length} non-blocking trace diagnostics</summary><ul>{diagnostics.map((d, i) => <li key={`${d.code}:${d.locator}:${i}`}><strong>{d.code}</strong> {d.message} <code>{d.locator}</code></li>)}</ul><p>These findings do not change requirement verification, configuration validity or simulation readiness.</p></details>}
  </div>;
}
export function SemanticParallelPanel({ flag, label, children, studyId, visibleElementIds, initialRecordId }: { flag: SemanticFlag; label: string; children?: ReactNode; studyId?: string; visibleElementIds?: ReadonlySet<string>; initialRecordId?: string }) {
  const flags = useSemanticGraphFlags(), project = useAppStore(selectActiveProject);
  const [open, setOpen] = useState(false);
  if (!flags[flag] || !project) return <>{children}</>;
  return <div className="space-y-3"><div className="semantic-toolbar"><button aria-pressed={open} onClick={() => setOpen(!open)}>{open ? "Open legacy view" : label}</button></div><div hidden={open}>{children}</div>{open && <SemanticGraphErrorBoundary onLegacy={() => setOpen(false)}><SemanticProjectPanel project={project} studyId={studyId} visibleElementIds={visibleElementIds} initialRecordId={initialRecordId} initialView={flag === "showSemanticMatrix" ? "matrix" : "graph"} /></SemanticGraphErrorBoundary>}</div>;
}
function downloadSemanticContext(project: Project, context: SemanticContext = { type: "live" }) {
  const url = URL.createObjectURL(new Blob([semanticGraphExport(project, context)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `semantic-model-${context.type}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function SemanticExportPanel() {
  const flags = useSemanticGraphFlags(), project = useAppStore(selectActiveProject);
  const [error, setError] = useState("");
  if (!flags.enableSemanticExport || !project) return null;
  return <section className="card p-5"><h2 className="font-bold">Semantic model / Digital Thread JSON</h2><p className="my-2 text-sm">Export the current semantic projection with authoritative references and diagnostics. Historical contexts can be selected in Scope Ontology.</p><button className="btn" onClick={() => {
    try {
      downloadSemanticContext(project); setError("");
    } catch { setError("Semantic export could not be prepared. Native project exports remain available."); }
  }}>Download semantic JSON</button>{error && <p role="alert">{error}</p>}</section>;
}
export function SemanticShadow({ project }: { project: Project }) {
  const result = useMemo(() => getSemanticGraphFlags().buildInShadow ? buildSemanticGraph(project) : undefined, [project]);
  return result ? <details className="semantic-options"><summary>Background trace diagnostics: {result.diagnostics.length}</summary><p>{result.graph.nodes.length} nodes · {result.graph.edges.length} connections · {result.completeness}</p></details> : null;
}

export function SemanticElementInspector({ elementId, kind }: { elementId: string; kind: import("../domain/types").ElementType }) {
  const flags = useSemanticGraphFlags(), project = useAppStore(selectActiveProject);
  const [open, setOpen] = useState(false);
  if (!flags.showModelerSemanticInspector || !project) return null;
  return <div className="semantic-options"><button type="button" onClick={() => setOpen(!open)}>{open ? "Open legacy view" : "Inspect selected element digital thread"}</button>{open && <SemanticGraphErrorBoundary onLegacy={() => setOpen(false)}><SavedElementTrace project={project} elementId={elementId} kind={kind} /></SemanticGraphErrorBoundary>}</div>;
}
function SavedElementTrace({ project, elementId, kind }: { project: Project; elementId: string; kind: import("../domain/types").ElementType }) {
  const result = useMemo(() => buildSemanticGraph(project), [project]);
  const [focusedId, setFocusedId] = useState("");
  const node = result.graph.nodes.find(n => focusedId ? n.id === focusedId : n.recordId === elementId && n.kind === kind);
  const links = result.graph.edges.filter(e => e.source === node?.id || e.target === node?.id);
  return <aside className="mt-3 max-h-96 space-y-3 overflow-auto" aria-label="Semantic trace details"><strong>{node?.label ?? "Record unavailable"}</strong><p>Saved model context. Unsaved editor changes appear here after saving.</p>{["canonical", "supporting", "constraint", "evidence"].map(role => <section key={role}><h3 className="font-bold capitalize">{role}</h3>{links.filter(e => e.role === role).map(e => {
    const id = e.source === node?.id ? e.target : e.source;
    return <div key={e.id} className="my-2"><button type="button" onClick={() => setFocusedId(id)}>{e.source === node?.id ? "→" : "←"} {e.predicate}: {result.graph.nodes.find(n => n.id === id)?.label}</button><details><summary>Provenance</summary><code className="break-all">{e.authoritativeSource.locator}</code><p>{e.provenance.type}</p></details></div>;
  })}</section>)}{focusedId && <button type="button" onClick={() => setFocusedId("")}>Back to selected element</button>}</aside>;
}
