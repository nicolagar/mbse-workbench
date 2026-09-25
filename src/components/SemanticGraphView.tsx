import { useEffect, useId, useMemo, useRef, useState } from "react";
import { nodeLabel, type SemanticRole } from "../domain/ontologyRegistry";
import { contextKey } from "../domain/semanticGraphIdentity";
import { layoutSemanticGraph, semanticLanes } from "../domain/semanticGraphLayout";
import { traceSemanticGraph } from "../domain/semanticGraphTraversal";
import { missionToBaselineSemanticView } from "../domain/semanticGraphViews";
import type { SemanticGraph } from "../domain/semanticGraphTypes";
import "./SemanticGraphView.css";
const colors: Record<SemanticRole, string> = { canonical: "#334155", supporting: "#64748b", constraint: "#8b5cf6", evidence: "#19758a" };
export function SemanticGraphView({ graph, initialFocus, matrixAvailable = false, schema = false, initialView = "graph", initialPreset = "canonical" }: { graph: SemanticGraph; initialFocus?: string; matrixAvailable?: boolean; schema?: boolean; initialView?: "graph" | "matrix"; initialPreset?: "canonical" | "missionToBaseline" }) {
  const [selected, setSelected] = useState(initialFocus ?? "");
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<SemanticRole[]>(initialPreset === "missionToBaseline" ? ["canonical", "supporting", "evidence"] : ["canonical"]);
  const [missionToBaseline, setMissionToBaseline] = useState(initialPreset === "missionToBaseline");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState("");
  const [zoom, setZoom] = useState(.65);
  const [view, setView] = useState<"graph" | "register" | "matrix">(initialView);
  const [focus, setFocus] = useState(false);
  const [page, setPage] = useState(0);
  const [columnPage, setColumnPage] = useState(0);
  const viewport = useRef<HTMLDivElement>(null), drag = useRef<{ x: number; y: number; left: number; top: number }>();
  const marker = useId().replace(/:/g, "");
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); setZoom(z => Math.min(2, Math.max(.08, z * (event.deltaY < 0 ? 1.1 : .9)))); } };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [view]);
  const relevant = useMemo(() => {
    const edges = graph.edges.filter(e => roles.includes(e.role));
    const endpoints = new Set(edges.flatMap(e => [e.source, e.target]));
    const nodes = graph.nodes.filter(n => roles.length === 4 || endpoints.has(n.id) || ["mission", "system", "stakeholder", "need", "objective", "useCase", "systemRequirement", "architecture", "configuration", "tradeStudy", "decision"].includes(n.kind));
    const g = missionToBaselineSemanticView({ ...graph, edges, nodes });
    const selectedGraph = missionToBaseline ? g : { ...graph, edges, nodes };
    return focus && selected ? traceSemanticGraph(selectedGraph, selected, { maxDepth: 2 }) : selectedGraph;
  }, [graph, roles, selected, focus, stage, missionToBaseline]);
  const layout = useMemo(() => layoutSemanticGraph(relevant), [relevant]);
  const byId = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph]);
  const current = byId.get(selected);
  const matches = (id: string) => { const n = byId.get(id); return (!stage || n?.domain === stage) && (!search || `${n?.label} ${n?.recordId} ${n?.kind}`.toLowerCase().includes(search.toLowerCase())); };
  const links = graph.edges.filter(e => e.source === selected || e.target === selected);
  const filteredEdges = relevant.edges.filter(e => matches(e.source) || matches(e.target));
  const scrollTo = (id: string) => { setSelected(id); const box = layout.positions.get(id); if (box) viewport.current?.scrollTo({ left: Math.max(0, box.x * zoom - 80), top: Math.max(0, box.y * zoom - 80), behavior: "smooth" }); };
  const matrixNodes = relevant.nodes.filter(n => matches(n.id)).slice(page * 20, page * 20 + 20);
  const matrixColumns = relevant.nodes.filter(n => matches(n.id)).slice(columnPage * 20, columnPage * 20 + 20);
  return <section className="semantic-view" aria-label={schema ? "Semantic ontology schema" : "Project digital thread"}>
    <div className="semantic-toolbar">
      <div className="semantic-tabs" role="group" aria-label="Semantic display"><button aria-pressed={view === "graph"} onClick={() => setView("graph")}>Graph</button><button aria-pressed={view === "register"} onClick={() => setView("register")}>Register</button>{matrixAvailable && <button aria-pressed={view === "matrix"} onClick={() => setView("matrix")}>Read-only matrix</button>}</div>
      <label>Search <input aria-label="Search semantic model" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
      <label>Find node <select aria-label="Find semantic node" value={selected} onChange={e => scrollTo(e.target.value)}><option value="">Choose…</option>{relevant.nodes.map(n => <option key={n.id} value={n.id}>{n.label} · {nodeLabel(n.kind)}</option>)}</select></label>
      {!schema && <button aria-pressed={missionToBaseline} onClick={() => { setRoles(["canonical", "supporting", "evidence"]); setMissionToBaseline(true); setStage(""); setFocus(false); setSelected(""); }}>Mission → baseline</button>}
      <button onClick={() => { setRoles(["canonical", "supporting", "constraint", "evidence"]); setMissionToBaseline(false); setStage(""); }}>Full model</button>
      <button onClick={() => { setRoles(["canonical", "supporting", "evidence"]); setMissionToBaseline(false); }}>Thread with evidence</button>
    </div>
    <div className="semantic-toolbar" role="group" aria-label="Semantic roles">{(Object.keys(colors) as SemanticRole[]).map(role => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={e => setRoles(v => e.target.checked ? [...v, role] : v.filter(r => r !== role))} /><i style={{ background: colors[role] }} />{role}</label>)}<small>Roles describe meaning; provenance identifies the authoritative record.</small></div>
    <div className="semantic-columns">
      <aside className="semantic-rail"><strong>Workflow focus</strong>{semanticLanes.map(lane => <button key={lane} aria-pressed={stage === lane} onClick={() => { setStage(stage === lane ? "" : lane); const first = relevant.nodes.find(n => n.domain === lane); if (first) scrollTo(first.id); }}>{lane}</button>)}<p>{schema ? "Type definitions" : "Project instances"}<br />{contextKey(graph.context)}</p><p>Canonical trace and evidence are distinct. Use both to examine decisions.</p></aside>
      <main className="semantic-main">
        {view === "graph" && <><div className="semantic-toolbar"><button onClick={() => setZoom(z => Math.max(.08, z / 1.25))} aria-label="Semantic zoom out">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(2, z * 1.25))} aria-label="Semantic zoom in">+</button><button onClick={() => setZoom(Math.max(.08, (viewport.current?.clientWidth ?? 800) / layout.width))}>Fit width</button><button onClick={() => { setFocus(false); setStage(""); setSelected(""); setSearch(""); }}>Overview</button><label><input type="checkbox" checked={focus} disabled={!selected} onChange={e => setFocus(e.target.checked)} />Focus two steps</label></div>
          {!relevant.nodes.length && <p className="p-4">{missionToBaseline ? "A Mission and a confirmed baseline Architecture are required for this digital-thread view." : "No records in this context. Select another context or create model content in the existing editors."}</p>}
          <div ref={viewport} className="semantic-viewport" role="region" aria-label="Semantic graph canvas" tabIndex={0}
            onPointerDown={e => { if (e.button !== 0 || (e.target as Element).closest("[role=button]")) return; const v = viewport.current!; drag.current = { x: e.clientX, y: e.clientY, left: v.scrollLeft, top: v.scrollTop }; v.setPointerCapture?.(e.pointerId); }}
            onPointerMove={e => { if (drag.current && viewport.current) { viewport.current.scrollLeft = drag.current.left - e.clientX + drag.current.x; viewport.current.scrollTop = drag.current.top - e.clientY + drag.current.y; } }} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
            <svg width={layout.width * zoom} height={layout.height * zoom} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="Directional semantic graph">
              <defs>{(Object.keys(colors) as SemanticRole[]).map(role => <marker key={role} id={`${marker}-${role}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill={colors[role]} /></marker>)}</defs>
              {layout.bands.map(b => <g key={b.id}><rect {...{ x: b.x, y: b.y, width: b.width, height: b.height }} rx={12} fill="#f2f7fa" stroke="#cbd5e1" /><text x={b.x + 18} y={b.y + 28} className="semantic-lane-label">{b.id.toUpperCase()}</text></g>)}
              {relevant.edges.map(e => { const r = layout.routes.get(e.id); if (!r) return null; return <g key={e.id} opacity={!selected || e.source === selected || e.target === selected ? 1 : .18}><path data-semantic-edge={e.id} d={r.points.map((p,i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")} fill="none" stroke={colors[e.role]} strokeWidth={1.6} strokeDasharray={e.role === "constraint" ? "5 4" : undefined} markerEnd={`url(#${marker}-${e.role})`} /><circle cx={r.points[0].x} cy={r.points[0].y} r={2.5} fill="white" stroke={colors[e.role]} /><circle cx={r.points.at(-1)!.x} cy={r.points.at(-1)!.y} r={2.5} fill="white" stroke={colors[e.role]} /></g>; })}
              {relevant.nodes.map(n => { const box = layout.positions.get(n.id)!; return <g key={n.id} data-semantic-node={n.id} transform={`translate(${box.x} ${box.y})`} role="button" tabIndex={0} aria-label={`${nodeLabel(n.kind)}: ${n.label}`} opacity={matches(n.id) ? 1 : .2} onClick={() => setSelected(n.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(n.id); } }}><title>{n.label} · {n.recordId}</title><rect width={box.width} height={box.height} rx={8} fill={selected === n.id ? "#dbeafe" : "white"} stroke={selected === n.id ? "#2563eb" : "#8ea9b7"} strokeWidth={selected === n.id ? 2 : 1} /><rect width={4} height={48} y={12} fill="#19758a" /><text x={14} y={25} className="semantic-node-title">{n.label.length > 31 ? n.label.slice(0,28) + "…" : n.label}</text><text x={14} y={46} className="semantic-node-kind">{nodeLabel(n.kind)}</text><text x={14} y={61} className="semantic-node-state">{n.lifecycleState ?? (n.attributes.referenceOnly ? "Evidence reference" : n.resolution)}</text></g>; })}
              {relevant.edges.map(e => { const r = layout.routes.get(e.id)!; if (!r) return null; const open = expanded.has(e.id); return <g key={e.id} transform={`translate(${r.midpoint.x} ${r.midpoint.y})`} role="button" tabIndex={0} aria-label={`${open ? "Hide" : "Show"} semantic ${e.predicate}`} aria-expanded={open} onClick={() => setExpanded(prev => { const v = new Set(prev); if (v.has(e.id)) v.delete(e.id); else v.add(e.id); return v; })} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true })); } }}><rect x={-9} y={-9} width={18} height={18} rx={4} fill="white" stroke={colors[e.role]} /><text y={5} textAnchor="middle" fontSize={14}>{open ? "−" : "+"}</text>{open && <g pointerEvents="none"><line x1={10} y1={0} x2={r.labelBox.x - r.midpoint.x} y2={r.labelBox.y + 14 - r.midpoint.y} stroke="#94a3b8" strokeDasharray="3 4" /><rect x={r.labelBox.x - r.midpoint.x} y={r.labelBox.y - r.midpoint.y} width={240} height={28} rx={4} fill="white" stroke="#94a3b8" /><text x={r.labelBox.x + 10 - r.midpoint.x} y={r.labelBox.y + 18 - r.midpoint.y} fontSize={12}>{e.predicate}</text></g>}</g>; })}
            </svg>
          </div><p className="semantic-caption">{missionToBaseline ? "Mission → baseline · navigation may follow edges in either direction; arrowheads preserve authoritative direction · " : ""}{relevant.nodes.length} nodes · {relevant.edges.length} connections · + expands labels without moving nodes · crossings are not junctions</p></>}
        {view === "register" && <div className="semantic-table"><table><caption>Directional connection register · read only</caption><thead><tr><th>Source</th><th>Predicate / role</th><th>Target</th><th>Authoritative source</th></tr></thead><tbody>{filteredEdges.map(e => <tr key={e.id}><td><button onClick={() => setSelected(e.source)}>{byId.get(e.source)?.label}</button></td><td>{e.predicate}<small>{e.role} · {e.provenance.type}</small></td><td><button onClick={() => setSelected(e.target)}>{byId.get(e.target)?.label}</button></td><td><code>{e.authoritativeSource.locator}</code></td></tr>)}</tbody></table></div>}
        {view === "matrix" && <><p className="p-3">Rows are sources, columns are targets. Read-only pages of 20 source and target nodes; page each axis independently.</p><div className="semantic-toolbar"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous nodes</button><span>Page {page + 1}</span><button disabled={(page + 1) * 20 >= relevant.nodes.filter(n => matches(n.id)).length} onClick={() => setPage(p => p + 1)}>Next nodes</button><button disabled={columnPage === 0} onClick={() => setColumnPage(p => p - 1)}>Previous targets</button><span>Target page {columnPage + 1}</span><button disabled={(columnPage + 1) * 20 >= relevant.nodes.filter(n => matches(n.id)).length} onClick={() => setColumnPage(p => p + 1)}>Next targets</button></div><div className="semantic-table"><table><thead><tr><th>Source → target</th>{matrixColumns.map(n => <th key={n.id}>{n.label}</th>)}</tr></thead><tbody>{matrixNodes.map(n => <tr key={n.id}><th>{n.label}</th>{matrixColumns.map(t => <td key={t.id}>{relevant.edges.filter(e => e.source === n.id && e.target === t.id).map(e => e.predicate).join(", ") || "—"}</td>)}</tr>)}</tbody></table></div></>}
      </main>
      {current && <aside className="semantic-inspector" aria-label="Semantic trace details"><button onClick={() => setSelected("")}>Close details</button><h3>{current.label}</h3><p>{nodeLabel(current.kind)} · {current.lifecycleState ?? current.resolution}</p><code>{current.recordId}</code><p>{current.description}</p>{current.resolution === "currentDisplayFallback" && <p>Current display label only; historical topology is unchanged.</p>}{current.attributes.referenceOnly === true && <p>Identity reference. Open its historical context to inspect captured evidence.</p>}<h4>Authoritative source</h4><code>{current.source.locator}</code>{(["canonical", "supporting", "constraint", "evidence"] as SemanticRole[]).map(role => <section key={role}><h4>{role === "canonical" ? "Why it exists / what it influences" : role}</h4>{links.filter(e => e.role === role).map(e => <div key={e.id}><button onClick={() => scrollTo(e.source === selected ? e.target : e.source)}>{e.source === selected ? "→" : "←"} {e.predicate} · {byId.get(e.source === selected ? e.target : e.source)?.label}</button><small>{e.provenance.type}</small></div>)}</section>)}<details><summary>Record attributes</summary><pre>{JSON.stringify(current.attributes, null, 2)}</pre></details></aside>}
    </div>
  </section>;
}
