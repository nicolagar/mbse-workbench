import { ModelerScopeOntology } from "./ModelerScopeOntology";
import { GitBranch, Home, List, Maximize2, Network, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ontologyNodeName,
  ontologyStages,
  scopeLabels,
  scopeLevelByProjectScope,
  scopeOntologyNodes,
  type OntologyDensity,
  type OntologyScopeLevel
} from "../domain/scopeOntology";
import { semanticScopeConnection, semanticScopeOntologyConnections, visibleSemanticScopeOntology, type SemanticScopeOntologyConnection } from "../domain/scopeOntologySemantics";
import {
  buildScopeOntologyLayout,
  ontologySectionMeta,
  type OntologyBox,
  type OntologyPoint
} from "../domain/scopeOntologyLayout";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import "./ScopeOntologyWorkspace.css";

type Selection = { kind: "node" | "connection"; id: string } | null;
type ViewMode = "graph" | "register";

const lineClass = (connection: SemanticScopeOntologyConnection) => `scope-ontology__connection-line scope-ontology__connection-line--${connection.provenance} scope-ontology__connection-line--role-${connection.role}`;
const markerId = (role: SemanticScopeOntologyConnection["role"]) => `scope-ontology-arrow-${role}`;
const pathData = (points: OntologyPoint[]) => points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");

function wrapLabel(label: string, maximum = 24) {
  if (label.length <= maximum) return [label];
  const lines = [""];
  label.split(" ").forEach((word) => {
    const index = lines.length - 1;
    if (`${lines[index]} ${word}`.trim().length > maximum && lines[index]) lines.push(word);
    else lines[index] = `${lines[index]} ${word}`.trim();
  });
  return lines.slice(0, 2);
}

function hasConnection(selection: Selection, nodeId: string) {
  if (!selection) return true;
  if (selection.kind === "node") {
    if (selection.id === nodeId) return true;
    return semanticScopeOntologyConnections.some((connection) =>
      (connection.source === selection.id && connection.target === nodeId)
      || (connection.target === selection.id && connection.source === nodeId)
    );
  }
  const connection = semanticScopeOntologyConnections.find((candidate) => candidate.id === selection.id);
  return connection?.source === nodeId || connection?.target === nodeId;
}

function connectionSelected(selection: Selection, connection: SemanticScopeOntologyConnection) {
  if (!selection) return true;
  if (selection.kind === "connection") return selection.id === connection.id;
  return connection.source === selection.id || connection.target === selection.id;
}

export function StoredScopeOntologyWorkspace() {
  const project = useAppStore(selectActiveProject);
  const projectScope = project?.overallScope ?? "architectureBuilding";
  const [scope, setScope] = useState<OntologyScopeLevel>(() => scopeLevelByProjectScope[projectScope]);
  const [density, setDensity] = useState<OntologyDensity>("thread");
  const [view, setView] = useState<ViewMode>("graph");
  const [selection, setSelection] = useState<Selection>(null);
  const [stageFocus, setStageFocus] = useState<string>();
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(() => new Set());
  const [zoom, setZoom] = useState(.9);
  const [search, setSearch] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number; moved: boolean }>();
  const layout = useMemo(() => {
    const result = buildScopeOntologyLayout(scope, "all");
    const visibleIds = new Set(visibleSemanticScopeOntology(scope, density).connections.map(connection => connection.id));
    return {
      ...result,
      connections: result.connections.filter(connection => visibleIds.has(connection.id)).map(connection => semanticScopeConnection(connection.id)!),
      routes: new Map([...result.routes].filter(([id]) => visibleIds.has(id)))
    };
  }, [density, scope]);
  const nodesById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);

  useEffect(() => {
    setScope(scopeLevelByProjectScope[projectScope]);
  }, [project?.id, projectScope]);

  const fitWidth = () => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth <= 18) return;
    setZoom(Math.min(1.12, Math.max(.55, (viewport.clientWidth - 18) / layout.width)));
    viewport.scrollLeft = 0;
  };

  useEffect(() => {
    setSelection(null);
    setStageFocus(undefined);
    setExpandedConnections(new Set());
    const frame = requestAnimationFrame(() => {
      fitWidth();
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
    // fitWidth deliberately follows each new immutable layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      const worldX = (viewport.scrollLeft + localX) / zoom;
      const worldY = (viewport.scrollTop + localY) / zoom;
      const next = Math.min(3.2, Math.max(.55, zoom * Math.exp(-event.deltaY * .0012)));
      setZoom(next);
      requestAnimationFrame(() => {
        viewport.scrollLeft = worldX * next - localX;
        viewport.scrollTop = worldY * next - localY;
      });
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoom]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  if (!project) return null;

  const visibleStages = ontologyStages.filter(([id]) => layout.nodes.some((node) => node.stage === id));
  const allScopeConnections = visibleSemanticScopeOntology(scope, "all").connections;
  const filteredRegister = allScopeConnections.filter((connection) => [
    ontologyNodeName(connection.source), ontologyNodeName(connection.target), connection.label, connection.role, connection.provenance, connection.note
  ].join(" ").toLowerCase().includes(search.toLowerCase()));

  const zoomAroundCenter = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const worldX = (viewport.scrollLeft + centerX) / zoom;
    const worldY = (viewport.scrollTop + centerY) / zoom;
    const next = Math.min(3.2, Math.max(.55, zoom * factor));
    setZoom(next);
    requestAnimationFrame(() => {
      viewport.scrollLeft = worldX * next - centerX;
      viewport.scrollTop = worldY * next - centerY;
    });
  };

  const showOverview = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const next = Math.max(.22, Math.min((viewport.clientWidth - 18) / layout.width, (viewport.clientHeight - 18) / layout.height));
    setZoom(next);
    viewport.scrollTo({ left: 0, top: 0 });
  };

  const scrollToNode = (id: string) => {
    const viewport = viewportRef.current;
    const box = layout.positions.get(id);
    if (!viewport || !box) return;
    viewport.scrollTo({
      left: Math.max(0, (box.x + box.width / 2) * zoom - viewport.clientWidth / 2),
      top: Math.max(0, (box.y - 70) * zoom),
      behavior: "smooth"
    });
  };

  const selectStage = (stage: string) => {
    const next = stageFocus === stage ? undefined : stage;
    setStageFocus(next);
    setSelection(null);
    if (!next) return;
    const bounds = layout.stageBounds.get(next);
    if (bounds) viewportRef.current?.scrollTo({ top: Math.max(0, bounds.top * zoom - 80), behavior: "smooth" });
  };

  const toggleConnectionName = (id: string) => {
    setExpandedConnections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedNode = selection?.kind === "node" ? scopeOntologyNodes.find((node) => node.id === selection.id) : undefined;
  const selectedConnection = selection?.kind === "connection" ? semanticScopeOntologyConnections.find((connection) => connection.id === selection.id) : undefined;
  const selectedConnections = selectedNode ? semanticScopeOntologyConnections.filter((connection) => connection.source === selectedNode.id || connection.target === selectedNode.id) : [];

  return <section className="scope-ontology" aria-labelledby="scope-ontology-title">
    <header className="scope-ontology__header">
      <div>
        <div className="scope-ontology__eyebrow">Modeler / Ontology Explorer</div>
        <h1 id="scope-ontology-title">Scope ontology</h1>
        <p>Explore the supported entity types from mission to architecture and decision evidence. Architecture is the design identity; a 100% realization is a frozen derivation. The project digital thread projects existing records without changing the model.</p>
      </div>
      <div className="scope-ontology__schema">Schema 14 · read-only ontology guidance</div>
    </header>

    <div className="scope-ontology__body">
      <aside className="scope-ontology__rail" aria-label="Workflow focus">
        <h2>Workflow focus</h2>
        <nav>
          {visibleStages.map(([id, label], index) => <button key={id} className={stageFocus === id ? "active" : ""} onClick={() => selectStage(id)}>
            <b>{String(index + 1).padStart(2, "0")}</b><span>{label}</span>
          </button>)}
        </nav>
        <p><strong>One node, one identity.</strong><br />Stages focus existing nodes; they never recreate them.<br /><br />Elbows use separate block ports. Crossings are not junctions. Optional supporting elements use dashed cards.</p>
      </aside>

      <div className="scope-ontology__main">
        <div className="scope-ontology__toolbar">
          <div className="scope-ontology__scope" role="group" aria-label="Ontology project scope">
            {([0, 1, 2] as OntologyScopeLevel[]).map((level) => <button key={level} className={scope === level ? "active" : ""} aria-pressed={scope === level} onClick={() => setScope(level)}>{scopeLabels[level]}</button>)}
          </div>
          {view === "graph" && <div className="scope-ontology__tools">
            <select aria-label="Relationship density" value={density} onChange={(event) => setDensity(event.target.value as OntologyDensity)}>
              <option value="thread">Canonical + minimum thread</option>
              <option value="all">All mapped connections</option>
            </select>
            <label className="scope-ontology__finder"><Search size={14} /><span>Find element</span><select aria-label="Find ontology element" value="" onChange={(event) => {
              if (!event.target.value) return;
              setSelection({ kind: "node", id: event.target.value });
              requestAnimationFrame(() => scrollToNode(event.target.value));
            }}><option value="">Select an element…</option>{[...layout.nodes].sort((a, b) => a.label.localeCompare(b.label)).map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
            <button aria-label="Zoom out" title="Zoom out" onClick={() => zoomAroundCenter(.82)}><ZoomOut size={15} /></button>
            <span className="scope-ontology__zoom">{Math.round(zoom * 100)}%</span>
            <button aria-label="Zoom in" title="Zoom in" onClick={() => zoomAroundCenter(1.22)}><ZoomIn size={15} /></button>
            <button onClick={fitWidth}><Maximize2 size={14} />Fit width</button>
            <button onClick={showOverview}><Network size={14} />Overview</button>
            <button onClick={() => { setStageFocus(undefined); setSelection(null); setZoom(Math.max(zoom, .9)); requestAnimationFrame(() => scrollToNode("mission")); }}><Home size={14} />Mission</button>
          </div>}
        </div>

        <div className="scope-ontology__subtoolbar">
          <div role="tablist" aria-label="Ontology view">
            <button role="tab" aria-selected={view === "graph"} className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}><GitBranch size={14} />Ontology graph</button>
            <button role="tab" aria-selected={view === "register"} className={view === "register" ? "active" : ""} onClick={() => setView("register")}><List size={14} />Connection register</button>
          </div>
          <div className="scope-ontology__legend" aria-label="Connection legend">
            <b>Role</b><span><i className="role-canonical" />Canonical</span><span><i className="role-supporting" />Supporting</span><span><i className="role-constraint" />Constraint</span><span><i className="role-evidence" />Evidence</span>
            <b>Provenance</b><span><i className="stored" />Stored relationship</span><span><i className="typed" />Typed reference</span><span><i className="embedded" />Embedded record</span><span><i className="reference" />Cross-environment reference</span>
          </div>
        </div>

        {view === "graph" ? <>
          <div className={`scope-ontology__workspace${selection ? " open" : ""}`}>
            <div
              className="scope-ontology__viewport"
              ref={viewportRef}
              role="region"
              aria-label="Scope-scaled top-down ontology"
              onPointerDown={(event) => {
                if (event.button !== 0 || (event.target as Element).closest("[data-interactive='true']")) return;
                const viewport = viewportRef.current!;
                dragRef.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
                viewport.classList.add("dragging");
                viewport.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                const viewport = viewportRef.current;
                if (!drag || !viewport) return;
                const deltaX = event.clientX - drag.x;
                const deltaY = event.clientY - drag.y;
                if (Math.abs(deltaX) + Math.abs(deltaY) > 3) drag.moved = true;
                if (drag.moved) {
                  viewport.scrollLeft = drag.left - deltaX;
                  viewport.scrollTop = drag.top - deltaY;
                }
              }}
              onPointerUp={() => {
                dragRef.current = undefined;
                viewportRef.current?.classList.remove("dragging");
              }}
            >
              <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width * zoom} height={layout.height * zoom} aria-label={`${scopeLabels[scope]} ontology graph`}>
                <defs>
                  <marker id="scope-ontology-arrow-canonical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#334155" /></marker>
                  <marker id="scope-ontology-arrow-supporting" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#64748b" /></marker>
                  <marker id="scope-ontology-arrow-constraint" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7c3aed" /></marker>
                  <marker id="scope-ontology-arrow-evidence" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0f766e" /></marker>
                </defs>

                {layout.sections.map((section) => {
                  const meta = ontologySectionMeta[section.id];
                  return <g key={section.id} className={stageFocus && !layout.nodes.some((node) => node.stage === stageFocus && node.environment === section.id) ? "scope-ontology__dim-section" : ""}>
                    <rect x={section.x} y={section.y} width={section.width} height={section.height} rx={12} fill={meta.fill} stroke="#d0dde3" />
                    <text x={section.x + 20} y={section.y + 30} className="scope-ontology__environment-title">{meta.label}</text>
                    <text x={section.x + 20} y={section.y + 49} className="scope-ontology__environment-note">{meta.note}</text>
                    {section.referenceIds.length > 0 && <text x={section.x + section.width - 20} y={section.y + 30} textAnchor="end" className="scope-ontology__row-label">References from earlier environments</text>}
                  </g>;
                })}

                {layout.sections.flatMap((section) => ontologyStages.flatMap(([stage, label]) => {
                  const stageNodes = layout.nodes.filter((node) => node.environment === section.id && node.stage === stage).map((node) => layout.positions.get(node.id)).filter((box): box is OntologyBox => Boolean(box));
                  if (!stageNodes.length) return [];
                  const stageY = Math.min(...stageNodes.map((box) => box.y)) - 17;
                  return [<g key={`${section.id}-${stage}`} className={stageFocus && stageFocus !== stage ? "scope-ontology__dim-section" : ""}>
                    <line x1={section.x + 18} y1={stageY} x2={section.x + section.width - 18} y2={stageY} stroke="#c7d5dc" strokeDasharray="4 7" />
                    <text x={section.x + 18} y={stageY - 6} className="scope-ontology__row-label">{label}</text>
                  </g>];
                }))}

                {layout.connections.map((connection) => {
                  const route = layout.routes.get(connection.id);
                  if (!route) return null;
                  const dimmed = !connectionSelected(selection, connection)
                    || Boolean(stageFocus && nodesById.get(connection.source)?.stage !== stageFocus && nodesById.get(connection.target)?.stage !== stageFocus);
                  return <g key={connection.id} className={dimmed ? "scope-ontology__dim" : ""} data-interactive="true" role="button" tabIndex={0} aria-label={`${ontologyNodeName(connection.source)} ${connection.label} ${ontologyNodeName(connection.target)}`} onClick={() => setSelection({ kind: "connection", id: connection.id })} onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelection({ kind: "connection", id: connection.id });
                    }
                  }}>
                    <title>{ontologyNodeName(connection.source)} → {connection.label} → {ontologyNodeName(connection.target)}</title>
                    <path d={pathData(route.points)} className="scope-ontology__connection-halo" />
                    <path d={pathData(route.points)} className={lineClass(connection)} markerEnd={`url(#${markerId(connection.role)})`} />
                  </g>;
                })}

                {[...layout.referencePositions.entries()].map(([key, box]) => {
                  const id = box.referenceId!;
                  const node = nodesById.get(id) ?? scopeOntologyNodes.find((candidate) => candidate.id === id)!;
                  const dimmed = !hasConnection(selection, id) || Boolean(stageFocus && node.stage !== stageFocus);
                  return <g key={key} transform={`translate(${box.x} ${box.y})`} className={`scope-ontology__reference${dimmed ? " scope-ontology__dim" : ""}`} data-interactive="true" role="button" tabIndex={0} aria-label={`${node.label}, reference to earlier environment`} onClick={() => { setSelection({ kind: "node", id }); if (!box.terminal) scrollToNode(id); }} onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelection({ kind: "node", id });
                    }
                  }}>
                    <rect width={box.width} height={box.height} rx={box.terminal ? 8 : 18} />
                    <text x={box.width / 2} y={box.terminal ? 29 : 25} textAnchor="middle">{box.terminal ? "Architecture / baseline" : `${node.label} ↗`}</text>
                  </g>;
                })}

                {layout.nodes.map((node) => {
                  const box = layout.positions.get(node.id)!;
                  const lines = wrapLabel(node.id === "architecture" && scope === 2 ? "Architecture (source)" : node.label);
                  const dimmed = !hasConnection(selection, node.id) || Boolean(stageFocus && node.stage !== stageFocus);
                  return <g key={node.id} transform={`translate(${box.x} ${box.y})`} className={`scope-ontology__node scope-ontology__node--${node.environment}${node.optional ? " optional" : ""}${selection?.kind === "node" && selection.id === node.id ? " selected" : ""}${dimmed ? " scope-ontology__dim" : ""}`} data-interactive="true" role="button" tabIndex={0} aria-label={node.label} onClick={() => setSelection({ kind: "node", id: node.id })} onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelection({ kind: "node", id: node.id });
                    }
                  }}>
                    <rect className="main" width={box.width} height={box.height} rx={8} />
                    <rect className="stripe" x={0} y={10} width={5} height={box.height - 20} rx={2} />
                    {lines.map((line, index) => <text key={line} x={15} y={26 + index * 16}>{line}</text>)}
                    <text className="type" x={15} y={box.height - 11}>{node.optional ? "Conditional model element" : node.type}</text>
                  </g>;
                })}

                {[...layout.routes.entries()].flatMap(([connectionId, route]) => route.ports.map((port, index) => <circle key={`${connectionId}-${index}`} cx={port.x} cy={port.y} r={2.5} fill="#fff" stroke="#537889" strokeWidth={1.1} />))}

                {layout.connections.map((connection) => {
                  const route = layout.routes.get(connection.id);
                  if (!route) return null;
                  const expanded = expandedConnections.has(connection.id);
                  const box = route.labelBox;
                  const dimmed = !connectionSelected(selection, connection)
                    || Boolean(stageFocus && nodesById.get(connection.source)?.stage !== stageFocus && nodesById.get(connection.target)?.stage !== stageFocus);
                  return <g key={`label-${connection.id}`} className={dimmed ? "scope-ontology__dim" : ""} data-interactive="true">
                    <g visibility={expanded ? "visible" : "hidden"} aria-hidden={!expanded} onClick={() => setSelection({ kind: "connection", id: connection.id })}>
                      <line x1={route.midpoint.x} y1={route.midpoint.y} x2={Math.max(box.x, Math.min(box.x + box.width, route.midpoint.x))} y2={Math.max(box.y, Math.min(box.y + box.height, route.midpoint.y))} className="scope-ontology__label-leader" />
                      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={4} className="scope-ontology__label-back" />
                      <text x={box.x + box.width / 2} y={box.y + 15} textAnchor="middle" className="scope-ontology__label-text">{connection.label}</text>
                    </g>
                    <g transform={`translate(${route.midpoint.x} ${route.midpoint.y})`} className="scope-ontology__connector-toggle" role="button" tabIndex={0} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} ${connection.label}`} onClick={(event) => { event.stopPropagation(); toggleConnectionName(connection.id); }} onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleConnectionName(connection.id);
                      }
                    }}>
                      <rect x={-11} y={-11} width={22} height={22} rx={6} />
                      <text x={0} y={5} textAnchor="middle">{expanded ? "−" : "+"}</text>
                    </g>
                  </g>;
                })}
              </svg>
              <div className="scope-ontology__hint">+ shows a connection name · scroll to explore · Ctrl/⌘ + scroll to zoom</div>
            </div>

            {selection && <aside className="scope-ontology__inspector" aria-label="Ontology details">
              <button className="scope-ontology__close" aria-label="Close ontology details" onClick={() => setSelection(null)}><X size={18} /></button>
              {selectedNode && <>
                <div className="scope-ontology__kicker">{ontologySectionMeta[selectedNode.environment].label}</div>
                <h2>{selectedNode.label}</h2><code>{selectedNode.type}</code><p>{selectedNode.note}</p>
                <h3>{selectedConnections.length} mapped connections</h3>
                {selectedConnections.map((connection) => <ConnectionDetail key={connection.id} connection={connection} />)}
              </>}
              {selectedConnection && <>
                <div className="scope-ontology__kicker">{selectedConnection.role} · {selectedConnection.provenance} provenance</div>
                <h2>{ontologyNodeName(selectedConnection.source)} → {ontologyNodeName(selectedConnection.target)}</h2>
                <ConnectionDetail connection={selectedConnection} />
                <p>The label is the exact canonical relationship or stored field used by the current schema.</p>
              </>}
            </aside>}
          </div>
          <div className="scope-ontology__status"><span>{layout.nodes.length} unique entities · {layout.connections.length} visible connections · {layout.sections.length} environment{layout.sections.length === 1 ? "" : "s"}</span><span>Workflow reads top to bottom · arrowheads preserve stored direction</span></div>
        </> : <section className="scope-ontology__register" aria-labelledby="scope-ontology-register-title">
          <h2 id="scope-ontology-register-title">Connection register</h2>
          <p>Only connections available in the selected scope are listed. Visual grouping never creates a model relationship.</p>
          <div className="scope-ontology__register-search"><Search size={15} /><input type="search" aria-label="Search ontology connections" placeholder="Search entity, relationship, or field…" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{filteredRegister.length} mapped connections</span></div>
          <div className="scope-ontology__table-wrap"><table><thead><tr><th>Source</th><th>Role</th><th>Provenance</th><th>Exact relationship / field</th><th>Target</th><th>Purpose</th></tr></thead><tbody>{filteredRegister.map((connection) => <tr key={connection.id}><td>{ontologyNodeName(connection.source)}</td><td>{connection.role}</td><td>{connection.provenance}</td><td><code>{connection.label}</code></td><td>{ontologyNodeName(connection.target)}</td><td>{connection.note}</td></tr>)}</tbody></table></div>
        </section>}
      </div>
    </div>
  </section>;
}

function ConnectionDetail({ connection }: { connection: SemanticScopeOntologyConnection }) {
  return <div className="scope-ontology__connection-detail"><div className="scope-ontology__kicker">{connection.role} · {connection.provenance} provenance</div><code>{connection.label}</code><div>{ontologyNodeName(connection.source)} → {ontologyNodeName(connection.target)}</div><p>{connection.note}</p></div>;
}

export function ScopeOntologyWorkspace() {
  return <ModelerScopeOntology />;
}
