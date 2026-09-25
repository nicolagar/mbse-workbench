import { Maximize2, Network, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildModelerScopeOntologyLayout,
  modelerScopeLabels,
  type ModelerOntologyConnection,
  type ModelerOntologyPoint,
  type ModelerOntologyScope
} from "../domain/modelerScopeOntology";
import { selectActiveProject, useAppStore } from "../store/useAppStore";
import "./ModelerScopeOntology.css";

type DirectionMode = "upstream" | "both" | "downstream";

const scopeByProjectScope: Record<string, ModelerOntologyScope> = {
  architectureBuilding: 0,
  architectureAndSimulation: 1,
  tradeStudy: 2
};

const pathData = (points: ModelerOntologyPoint[]) => points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");

function wrapLabel(label: string, maximum = 17) {
  if (label.length <= maximum) return [label];
  const lines = [""];
  label.split(" ").forEach(word => {
    const index = lines.length - 1;
    if (`${lines[index]} ${word}`.trim().length > maximum && lines[index]) lines.push(word);
    else lines[index] = `${lines[index]} ${word}`.trim();
  });
  return lines.slice(0, 2);
}

function relatedConnections(connections: ModelerOntologyConnection[], nodes: Map<string, { semanticId: string }>, semanticId: string | undefined, mode: DirectionMode) {
  if (!semanticId) return connections;
  return connections.filter(connection => {
    const source = nodes.get(connection.source)?.semanticId;
    const target = nodes.get(connection.target)?.semanticId;
    return mode === "both" ? source === semanticId || target === semanticId : mode === "upstream" ? target === semanticId : source === semanticId;
  });
}

export function ModelerScopeOntology() {
  const project = useAppStore(selectActiveProject);
  const projectScope = scopeByProjectScope[project?.overallScope ?? "architectureBuilding"] ?? 0;
  const [scope, setScope] = useState<ModelerOntologyScope>(projectScope);
  const [selectedNode, setSelectedNode] = useState<string>();
  const [mode, setMode] = useState<DirectionMode>("both");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number; moved: boolean }>();
  const layout = useMemo(() => buildModelerScopeOntologyLayout(scope), [scope]);
  const nodeById = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout.nodes]);
  const selectedSemanticId = selectedNode ? nodeById.get(selectedNode)?.semanticId : undefined;
  const activeConnections = useMemo(() => relatedConnections(layout.connections, nodeById, selectedSemanticId, mode), [layout.connections, mode, nodeById, selectedSemanticId]);
  const activeConnectionIds = useMemo(() => new Set(activeConnections.map(connection => connection.id)), [activeConnections]);
  const activeNodeIds = useMemo(() => {
    if (!selectedNode) return new Set(layout.nodes.map(node => node.id));
    const ids = new Set(layout.nodes.filter(node => node.semanticId === selectedSemanticId).map(node => node.id));
    activeConnections.forEach(connection => { ids.add(connection.source); ids.add(connection.target); });
    return ids;
  }, [activeConnections, layout.nodes, selectedNode, selectedSemanticId]);

  const fitGraph = () => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth <= 18) return;
    const next = Math.max(.18, Math.min(2.5, (viewport.clientWidth - 18) / layout.width));
    setZoom(next);
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  };

  useEffect(() => { setScope(projectScope); }, [project?.id, projectScope]);
  useEffect(() => {
    setSelectedNode(undefined);
    setExpanded(new Set());
    const frame = requestAnimationFrame(fitGraph);
    return () => cancelAnimationFrame(frame);
    // fitGraph follows each immutable layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(current => Math.max(.18, Math.min(1.55, current + (event.deltaY < 0 ? .08 : -.08))));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  if (!project) return null;

  const selectNode = (id: string) => setSelectedNode(current => current === id ? undefined : id);
  const toggleConnection = (id: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <section className="modeler-ontology" aria-labelledby="modeler-ontology-title">
    <header className="modeler-ontology__header">
      <div><div className="modeler-ontology__eyebrow">Modeler / Ontology Explorer</div><h1 id="modeler-ontology-title">Scope ontology</h1><p>See how each model element connects to the next. Follow the arrows in either direction to explore the workflow.</p></div>
      <div className="modeler-ontology__schema">Schema 14 · read-only ontology guidance</div>
    </header>

    <div className="modeler-ontology__toolbar">
      <div className="modeler-ontology__scopes" role="group" aria-label="Ontology project scope">
        {([0, 1, 2] as ModelerOntologyScope[]).map(level => <button key={level} aria-pressed={scope === level} onClick={() => setScope(level)}>{modelerScopeLabels[level]}</button>)}
      </div>
      <div className="modeler-ontology__controls">
        <button onClick={fitGraph}><Network size={15} />Fit graph</button>
        <button aria-label="Zoom out" onClick={() => setZoom(current => Math.max(.18, current - .1))}><ZoomOut size={15} /></button>
        <button aria-label="Reset zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button aria-label="Zoom in" onClick={() => setZoom(current => Math.min(2.5, current + .1))}><ZoomIn size={15} /></button>
        <button onClick={async () => {
          const viewport = viewportRef.current;
          if (!viewport) return;
          if (!document.fullscreenElement) await viewport.requestFullscreen?.();
          else await document.exitFullscreen?.();
          requestAnimationFrame(fitGraph);
        }}><Maximize2 size={15} />Fullscreen</button>
      </div>
      <div className="modeler-ontology__directions" role="group" aria-label="Selected element connections">
        {(["upstream", "both", "downstream"] as DirectionMode[]).map(direction => <button key={direction} aria-pressed={mode === direction} onClick={() => setMode(direction)}>{direction[0].toUpperCase() + direction.slice(1)}</button>)}
      </div>
      <div className="modeler-ontology__selection" aria-live="polite">{selectedNode ? <><strong>{nodeById.get(selectedNode)?.label}</strong> · {activeConnections.length} direct {mode} relationship{activeConnections.length === 1 ? "" : "s"}</> : <><strong>No stereotype selected.</strong> Select an element to highlight its direct relationships.</>}</div>
    </div>

    <div className="modeler-ontology__legend"><span className="modeler-ontology__line-sample" aria-hidden="true" /><strong>Semantic relationship</strong><span>Exact predicate names are collapsed behind the midpoint + control.</span><span className="modeler-ontology__count">{layout.nodes.length} stereotypes · {layout.connections.length} relationships</span></div>

    <div className="modeler-ontology__viewport" ref={viewportRef} role="region" aria-label={`${modelerScopeLabels[scope]} scope ontology graph`}
      onPointerDown={event => {
        if (event.button !== 0 || (event.target as Element).closest("[data-interactive='true']")) return;
        const viewport = viewportRef.current!;
        dragRef.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
        viewport.classList.add("dragging");
        viewport.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={event => {
        const drag = dragRef.current, viewport = viewportRef.current;
        if (!drag || !viewport) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) { viewport.scrollLeft = drag.left - dx; viewport.scrollTop = drag.top - dy; }
      }}
      onPointerUp={() => { dragRef.current = undefined; viewportRef.current?.classList.remove("dragging"); }}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width * zoom} height={layout.height * zoom} role="img" aria-label={`${modelerScopeLabels[scope]} generic ontology`}>
        <defs><marker id="modeler-ontology-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" /></marker></defs>

        {layout.bands.map(band => <g key={`${band.environment}-${band.y}`} className={`modeler-ontology__band modeler-ontology__band--${band.environment}`}><rect x={band.x} y={band.y} width={band.width} height={band.height} /><text x={band.x + 15} y={band.y + 24}>{band.label}</text></g>)}
        {layout.activities.map((activity, index) => <g key={activity.id} className="modeler-ontology__activity"><rect x={0} y={activity.y} width={layout.bands[0].x} height={activity.height} /><text className="number" x={14} y={activity.y + 27}>{index + 1}</text><text x={42} y={activity.y + 26}>{activity.label.map((line, lineIndex) => <tspan key={line} x={42} dy={lineIndex ? 14 : 0}>{line}</tspan>)}</text><line x1={layout.bands[0].x} y1={activity.y} x2={layout.width} y2={activity.y} /></g>)}
        {layout.groups.map(group => <g key={`${group.environment}-${group.label}`} className="modeler-ontology__group"><text x={layout.bands[0].x + 10} y={group.absoluteY + 15}>{group.label}</text><line x1={layout.bands[0].x + 10} y1={group.absoluteY + 22} x2={layout.width - 12} y2={group.absoluteY + 22} /></g>)}

        <g className="modeler-ontology__edges">
          {layout.connections.map(connection => {
            const route = layout.routes.get(connection.id);
            if (!route) return null;
            const dimmed = Boolean(selectedNode && !activeConnectionIds.has(connection.id));
            return <g key={connection.id} className={`${dimmed ? "dimmed" : ""}${selectedNode && activeConnectionIds.has(connection.id) ? " related" : ""}`}>
              <path d={pathData(route.points)} className="halo" />
              <path d={pathData(route.points)} className="line" markerEnd="url(#modeler-ontology-arrow)" />
            </g>;
          })}
        </g>

        <g className="modeler-ontology__nodes">
          {layout.nodes.map(node => {
            const box = layout.positions.get(node.id)!;
            const lines = wrapLabel(node.label);
            const dimmed = Boolean(selectedNode && !activeNodeIds.has(node.id));
            return <g key={node.id} transform={`translate(${box.x} ${box.y})`} data-interactive="true" data-node-id={node.id} data-semantic-id={node.semanticId} role="button" tabIndex={0} aria-label={`${node.label} stereotype${node.recalled ? " recalled" : ""}`} className={`${node.recalled ? "recalled " : ""}${selectedNode === node.id ? "selected" : ""}${selectedNode && activeNodeIds.has(node.id) && selectedNode !== node.id ? " related" : ""}${dimmed ? " dimmed" : ""}`} onClick={() => selectNode(node.id)} onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNode(node.id); }
            }}>
              <rect className="node" width={box.width} height={box.height} rx={8} />
              <line className="stripe" x1={5} y1={11} x2={5} y2={box.height - 11} />
              <text className="label" x={box.width / 2} y={lines.length === 1 ? 25 : 19}>{lines.map((line, index) => <tspan key={line} x={box.width / 2} dy={index ? 16 : 0}>{line}</tspan>)}</text>
              <text className="kind" x={box.width / 2} y={box.height - 9}>{node.kind}</text>
              {node.recalled && <><rect className="recall" x={(box.width - 58) / 2} y={-10} width={58} height={15} rx={7.5} /><text className="recall-label" x={box.width / 2} y={.5}>RECALLED</text></>}
              {node.baseline && scope === 2 && <><rect className="baseline" x={(box.width - 94) / 2} y={-13} width={94} height={18} rx={9} /><text className="baseline-label" x={box.width / 2} y={-1}>APPROVED BASELINE</text></>}
            </g>;
          })}
        </g>

        <g className="modeler-ontology__labels">
          {layout.connections.map(connection => {
            const route = layout.routes.get(connection.id);
            if (!route) return null;
            const open = expanded.has(connection.id);
            const width = Math.max(86, Math.min(205, connection.predicate.length * 7.4 + 24));
            const dimmed = Boolean(selectedNode && !activeConnectionIds.has(connection.id));
            return <g key={connection.id} transform={`translate(${route.midpoint.x} ${route.midpoint.y})`} className={dimmed ? "dimmed" : ""} data-interactive="true" role="button" tabIndex={0} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${connection.predicate}`} onClick={event => { event.stopPropagation(); toggleConnection(connection.id); }} onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); toggleConnection(connection.id); }
            }}>
              {open ? <><rect className="predicate" x={-width / 2} y={-13} width={width} height={26} rx={6} /><text className="predicate-label" y={.5}>{connection.predicate}</text></> : <><circle r={9} /><text className="plus" y={.5}>+</text></>}
            </g>;
          })}
        </g>
      </svg>
    </div>
  </section>;
}
