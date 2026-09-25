import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps
} from "@xyflow/react";
import type { LayoutPoint } from "../domain/graphLayouts";
import { useState } from "react";

export type RoutedEdgeData = {
  points?: LayoutPoint[];
  label?: string;
  primary?: boolean;
};

export type RoutedEdgeModel = Edge<RoutedEdgeData, "routed">;

export const routePath = (points: LayoutPoint[]) => points.length
  ? points.reduce((path, point, index) => `${path}${index ? " L" : "M"}${point.x} ${point.y}`, "")
  : "";

const labelPosition = (points: LayoutPoint[], fallback: LayoutPoint) => {
  if (points.length < 2) return fallback;
  let longest = { length: -1, start: points[0], end: points[1] };
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (length > longest.length) longest = { length, start, end };
  }
  return {
    x: (longest.start.x + longest.end.x) / 2,
    y: (longest.start.y + longest.end.y) / 2
  };
};

export function RoutedEdgeLabel({
  edgeId,
  label,
  position,
  primary,
  selected,
  hovered = false
}: {
  edgeId: string;
  label: string;
  position: LayoutPoint;
  primary?: boolean;
  selected?: boolean;
  hovered?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const revealLabel = expanded || hovered || selected;
  return <div
    className="nodrag nopan absolute flex items-center"
    style={{ transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)` }}
  >
    {revealLabel && <span
      className={`whitespace-nowrap rounded-md border bg-white px-1.5 py-0.5 text-[9px] shadow-sm ${selected ? "border-red-300 font-bold text-red-700" : primary ? "border-slate-200 text-slate-600" : "border-slate-200 text-slate-500"}`}
    >{label}</span>}
    <button
      type="button"
      className={`${revealLabel ? "ml-1" : ""} pointer-events-auto grid h-4 w-4 place-items-center rounded-full border border-slate-300 bg-white text-[11px] font-bold leading-none text-slate-600 shadow-sm hover:border-blue-400 hover:text-blue-700`}
      aria-label={`${expanded ? "Hide" : "Show"} relationship label: ${label}`}
      data-edge-id={edgeId}
      aria-expanded={expanded}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setExpanded((value) => !value);
      }}
    >{expanded ? "−" : "+"}</button>
  </div>;
}

export function RoutedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
  style,
  selected
}: EdgeProps<RoutedEdgeModel>) {
  const [hovered, setHovered] = useState(false);
  const points = data?.points ?? [];
  const [fallbackPath, fallbackX, fallbackY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, borderRadius: 10 });
  const path = routePath(points) || fallbackPath;
  const label = labelPosition(points, { x: fallbackX, y: fallbackY });
  return <>
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={18}
    />
    <path
      d={path}
      fill="none"
      stroke="transparent"
      strokeWidth={18}
      data-testid={`routed-edge-hit-area-${id}`}
      data-route={path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    />
    {data?.label && <EdgeLabelRenderer>
      <RoutedEdgeLabel
        edgeId={id}
        label={data.label}
        position={label}
        primary={data.primary}
        selected={selected}
        hovered={hovered}
      />
    </EdgeLabelRenderer>}
  </>;
}
