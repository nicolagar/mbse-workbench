import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { NodeMeasurement } from "../hooks/useNodeMeasurements";
import type { LayoutPort, LayoutSide } from "../domain/graphLayouts";

export type GraphNodeVariant = "model" | "feature" | "featureGroup" | "ontology";

export interface MeasuredGraphNodeData extends Record<string, unknown> {
  content: ReactNode;
  accessibleLabel: string;
  width: number;
  minimumHeight: number;
  variant: GraphNodeVariant;
  borderColor: string;
  background: string;
  opacity?: number;
  borderStyle?: CSSProperties["borderStyle"];
  onMeasure: (id: string, measurement: NodeMeasurement) => void;
  elementType?: string;
  domain?: string;
  ports?: LayoutPort[];
}

type MeasuredNode<Type extends string> = Node<MeasuredGraphNodeData, Type>;

const portStyle: CSSProperties = {
  width: 9,
  height: 9,
  border: "2px solid white",
  background: "#64748b"
};

const positionBySide: Record<LayoutSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
};

function MeasurementAwareNode<Type extends string>({ id, data, selected, isConnectable }: NodeProps<MeasuredNode<Type>>) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const report = () => {
      const bounds = element.getBoundingClientRect();
      data.onMeasure(id, {
        width: element.offsetWidth || bounds.width,
        height: element.offsetHeight || bounds.height
      });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.onMeasure, data.width, data.minimumHeight, id]);

  const handle = (type: "source" | "target", position: Position, offset: string) => (
    <Handle
      aria-label={`${type === "source" ? "Outgoing" : "Incoming"} ${position.toLowerCase()} port for ${data.accessibleLabel}`}
      id={`${type}-${position.toLowerCase()}`}
      type={type}
      position={position}
      isConnectable={isConnectable}
      style={{
        ...portStyle,
        ...(position === Position.Top || position === Position.Bottom ? { left: offset } : { top: offset })
      }}
    />
  );

  const routedHandle = (port: LayoutPort) => {
    const position = positionBySide[port.side];
    return <Handle
      key={port.id}
      aria-label={`${port.role === "source" ? "Outgoing" : "Incoming"} routed port for ${data.accessibleLabel}`}
      id={port.id}
      type={port.role}
      position={position}
      isConnectable={false}
      style={{
        width: 5,
        height: 5,
        border: 0,
        background: "#64748b",
        opacity: selected ? 0.55 : 0.12,
        ...(position === Position.Top || position === Position.Bottom ? { left: port.offset } : { top: port.offset })
      }}
    />;
  };

  return <div
    ref={ref}
    aria-label={data.accessibleLabel}
    data-testid={`${data.variant}-graph-node`}
    className="relative box-border overflow-hidden rounded-xl px-3 py-2 text-xs text-slate-900 shadow-sm transition-[opacity,border-color] duration-150"
    style={{
      width: data.width,
      minHeight: data.minimumHeight,
      border: `${selected ? 3 : 2}px ${data.borderStyle ?? "solid"} ${selected ? "#1d4ed8" : data.borderColor}`,
      background: data.background,
      opacity: data.opacity ?? 1
    }}
  >
    {handle("target", Position.Top, "56%")}
    {handle("source", Position.Top, "44%")}
    {handle("target", Position.Bottom, "56%")}
    {handle("source", Position.Bottom, "44%")}
    {handle("target", Position.Left, "56%")}
    {handle("source", Position.Left, "44%")}
    {handle("target", Position.Right, "56%")}
    {handle("source", Position.Right, "44%")}
    {data.ports?.map(routedHandle)}
    {data.content}
  </div>;
}

export type ModelGraphNodeModel = MeasuredNode<"modelGraphNode">;
export type FeatureGraphNodeModel = MeasuredNode<"featureGraphNode">;
export type OntologyGraphNodeModel = MeasuredNode<"ontologyGraphNode">;

export const ModelGraphNode = (props: NodeProps<ModelGraphNodeModel>) => <MeasurementAwareNode {...props} />;
export const FeatureGraphNode = (props: NodeProps<FeatureGraphNodeModel>) => <MeasurementAwareNode {...props} />;
export const OntologyGraphNode = (props: NodeProps<OntologyGraphNodeModel>) => <MeasurementAwareNode {...props} />;

export const graphPortId = (type: "source" | "target", position: Position) => `${type}-${position.toLowerCase()}`;

export const routedGraphPortId = (type: "source" | "target", edgeId: string) => `${type}:${edgeId}`;

export const graphPositionForSide = (side: LayoutSide) => positionBySide[side];
