import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps
} from "@xyflow/react";
import type { LayoutPoint } from "../domain/graphLayouts";

export type RoutedEdgeData = {
  points?: LayoutPoint[];
  label?: string;
  primary?: boolean;
};

export type RoutedEdgeModel = Edge<RoutedEdgeData, "routed">;

const routePath = (points: LayoutPoint[]) => points.length
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
    {data?.label && <EdgeLabelRenderer>
      <div
        className={`pointer-events-none absolute rounded-md border bg-white/95 px-1.5 py-0.5 text-[9px] shadow-sm ${selected ? "border-red-300 font-bold text-red-700" : data.primary ? "border-slate-200 text-slate-600" : "border-slate-200 text-slate-500"}`}
        style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}
      >
        {data.label}
      </div>
    </EdgeLabelRenderer>}
  </>;
}
