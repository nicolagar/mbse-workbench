import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  hasActiveLaneTraceSelection,
  LANE_TRACE_CARD_HEIGHT,
  LANE_TRACE_HEADER_HEIGHT,
  LANE_TRACE_WIDE_ROW_LABEL_WIDTH,
  layoutLaneTraceGraph,
  type LaneTraceSelection,
  type TraceDirection,
  type TraceSeed
} from "../domain/laneTraceGraph";
import { elementTypeColors, elementTypeLabels, type ElementType, type ModelElement, type Relationship } from "../domain/types";
import "./LaneTraceGraphView.css";

function wrapName(name: string, maxCharsPerLine = 25): [string, string?] {
  if (name.length <= maxCharsPerLine) return [name];
  const words = name.split(" ");
  let line1 = "";
  let index = 0;
  while (index < words.length && (line1 + words[index]).length <= maxCharsPerLine) {
    line1 += (line1 ? " " : "") + words[index];
    index += 1;
  }
  if (!line1) line1 = name.slice(0, maxCharsPerLine);
  let line2 = words.slice(index).join(" ");
  if (line2.length > maxCharsPerLine) line2 = `${line2.slice(0, maxCharsPerLine - 1)}…`;
  return line2 ? [line1, line2] : [line1];
}

export function LaneTraceGraphView({ elements, relationships }: { elements: ModelElement[]; relationships: Relationship[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [seeds, setSeeds] = useState<TraceSeed[]>([]);
  const [forceExpandedTypes, setForceExpandedTypes] = useState<Set<ElementType>>(new Set());
  const [zoom, setZoom] = useState(0.85);
  const orderRef = useRef<Record<string, string[]>>({});
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number }>();
  const marker = useId().replace(/:/g, "");

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((z) => Math.min(2, Math.max(0.2, z * (event.deltaY < 0 ? 1.1 : 0.9))));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  const selection: LaneTraceSelection = useMemo(
    () => ({ selectedIds, seeds, forceExpandedTypes }),
    [selectedIds, seeds, forceExpandedTypes]
  );
  const layout = useMemo(
    () => layoutLaneTraceGraph(elements, relationships, selection, orderRef.current),
    [elements, relationships, selection]
  );
  useEffect(() => {
    orderRef.current = layout.newOrder;
  }, [layout]);

  const active = hasActiveLaneTraceSelection(selection);
  const presentTypes = useMemo(() => [...new Set(elements.map((element) => element.elementType))], [elements]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const traceLane = (type: ElementType, direction: TraceDirection) => {
    const picked = [...selectedIds].filter((id) => elements.find((element) => element.id === id)?.elementType === type);
    if (!picked.length) return;
    setSeeds((prev) => {
      const next = [...prev];
      picked.forEach((id) => {
        if (!next.some((seed) => seed.id === id && seed.direction === direction)) next.push({ id, direction });
      });
      return next;
    });
    setForceExpandedTypes((prev) => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  };
  const reopenLane = (type: ElementType) => setForceExpandedTypes((prev) => new Set(prev).add(type));
  const clearSelection = () => {
    setSelectedIds(new Set());
    setSeeds([]);
    setForceExpandedTypes(new Set());
    orderRef.current = {};
  };

  if (!elements.length) {
    return <p className="p-4 text-sm text-slate-500">No elements in this scope yet.</p>;
  }

  return (
    <div className="lane-trace-view">
      <div className="lane-trace-toolbar">
        <button onClick={clearSelection}>Clear selection</button>
        <span className="lane-trace-hint">
          {active
            ? "Click ← up / down → on a lane to trace from its selected cards, or + on a collapsed lane to add an unrelated one."
            : "Click any card to select it, then use a lane's ← / → button to trace and collapse the rest to what's connected."}
        </span>
        <div className="lane-trace-zoom">
          <button onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, z * 1.2))} aria-label="Zoom in">+</button>
        </div>
      </div>
      <div className="lane-trace-legend">
        {presentTypes.map((type) => (
          <span key={type}>
            <i style={{ background: elementTypeColors[type] }} />
            {elementTypeLabels[type]}
          </span>
        ))}
      </div>
      <div
        ref={viewport}
        className="lane-trace-viewport"
        role="region"
        aria-label="Lane trace digital-thread graph"
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest("[role=button]")) return;
          const el = viewport.current!;
          drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
          el.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current && viewport.current) {
            viewport.current.scrollLeft = drag.current.left - event.clientX + drag.current.x;
            viewport.current.scrollTop = drag.current.top - event.clientY + drag.current.y;
          }
        }}
        onPointerUp={() => {
          drag.current = undefined;
        }}
        onPointerCancel={() => {
          drag.current = undefined;
        }}
      >
        <svg width={layout.width * zoom} height={layout.height * zoom} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="Lane trace connectors and elements">
          <defs>
            <marker id={`${marker}-dot`} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5">
              <circle cx="4" cy="4" r="3" />
            </marker>
          </defs>
          {layout.lanes.map((lane) => {
            const btnWidth = (lane.wide ? 90 : lane.width - 16) / (lane.wide ? 1 : 2) - 3;
            const downBtnX = lane.x + 8 + (lane.wide ? 93 : (lane.width - 16) / 2 + 3);
            return (
              <g key={lane.type}>
                <rect x={lane.x} y={lane.y} width={lane.width} height={lane.height} rx={10} fill="#f8fafc" stroke="#cbd5e1" />
                <rect x={lane.x} y={lane.y} width={4} height={lane.height} fill={lane.color} />
                <text x={lane.x + 12} y={lane.y + 18} className="lane-trace-lane-label">
                  {lane.label.toUpperCase()}
                </text>
                <text x={lane.x + lane.width - 10} y={lane.y + 18} textAnchor="end" className="lane-trace-lane-count">
                  {lane.visibleCount}/{lane.totalCount}
                </text>
                <g role="button" tabIndex={0} aria-label={`Trace ${lane.label} upstream from selection`} onClick={() => traceLane(lane.type, "upstream")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); traceLane(lane.type, "upstream"); } }}>
                  <rect x={lane.x + 8} y={lane.y + 26} width={btnWidth} height={20} rx={5} fill="white" stroke="#94a3b8" />
                  <text x={lane.x + 8 + btnWidth / 2} y={lane.y + 40} textAnchor="middle" className="lane-trace-btn-label">
                    {"← up"}
                  </text>
                </g>
                <g role="button" tabIndex={0} aria-label={`Trace ${lane.label} downstream from selection`} onClick={() => traceLane(lane.type, "downstream")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); traceLane(lane.type, "downstream"); } }}>
                  <rect x={downBtnX} y={lane.y + 26} width={btnWidth} height={20} rx={5} fill="white" stroke="#94a3b8" />
                  <text x={downBtnX + btnWidth / 2} y={lane.y + 40} textAnchor="middle" className="lane-trace-btn-label">
                    {"down →"}
                  </text>
                </g>
                {lane.collapsed && (() => {
                  const lastCard = lane.cards[lane.cards.length - 1];
                  const plusX = lane.wide
                    ? (lastCard ? lastCard.x + lastCard.width + 20 : lane.x + LANE_TRACE_WIDE_ROW_LABEL_WIDTH + 20)
                    : lane.x + lane.width - 20;
                  const plusY = lane.wide ? lane.y + LANE_TRACE_HEADER_HEIGHT + LANE_TRACE_CARD_HEIGHT / 2 : lane.y + lane.height - 17;
                  return (
                    <g role="button" tabIndex={0} aria-label={`Show all ${lane.label}`} onClick={() => reopenLane(lane.type)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); reopenLane(lane.type); } }}>
                      <circle cx={plusX} cy={plusY} r={11} fill="white" stroke="#94a3b8" />
                      <text x={plusX} y={plusY + 4} textAnchor="middle" className="lane-trace-btn-label">
                        +
                      </text>
                    </g>
                  );
                })()}
                {lane.cards.map((card) => {
                  const [line1, line2] = wrapName(card.name);
                  const fill = card.state === "direct" ? "#dcf5e0" : "white";
                  const stroke = card.state === "direct" ? "#16a34a" : card.state === "reached" ? "#6cbf7d" : "#cbd5e1";
                  const opacity = card.state === "hidden" ? 0.4 : 1;
                  return (
                    <g
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      opacity={opacity}
                      aria-label={`${card.state === "direct" ? "Selected" : "Element"}: ${card.name}`}
                      onClick={() => toggleSelect(card.id)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSelect(card.id); } }}
                      transform={`translate(${card.x} ${card.y})`}
                    >
                      <title>{card.name}</title>
                      <rect width={card.width} height={card.height} rx={7} fill={fill} stroke={stroke} strokeWidth={card.state === "reached" ? 1.5 : 1.2} strokeDasharray={card.state === "reached" ? "4 3" : undefined} />
                      <rect width={4} height={card.height} fill={lane.color} />
                      <text x={12} y={card.height / 2 - (line2 ? 4 : -4)} className="lane-trace-card-name">
                        {line1}
                      </text>
                      {line2 && (
                        <text x={12} y={card.height / 2 + 14} className="lane-trace-card-name">
                          {line2}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {layout.edges.map((edge) => (
            <g key={edge.id} opacity={0.85}>
              <path d={edge.path} fill="none" stroke={edge.color} strokeWidth={1.8} strokeLinecap="round" />
              <circle cx={edge.endX} cy={edge.endY} r={2.6} fill={edge.color} />
            </g>
          ))}
        </svg>
      </div>
      <p className="lane-trace-caption">
        {elements.length} elements · {relationships.length} relationships · connectors are bundled per source element and only fork apart near their targets; where paths cross, a small jump shows which one passes above.
      </p>
    </div>
  );
}
