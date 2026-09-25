import { useEffect, useMemo, useState } from "react";
import {
  calculateLayeredLayout,
  fallbackLayeredLayout,
  type LayeredLayoutRequest,
  type LayeredLayoutResult
} from "../domain/graphLayouts";

export function useLayeredLayout(request: LayeredLayoutRequest, revision = 0): LayeredLayoutResult {
  const signature = useMemo(() => JSON.stringify({
    revision,
    direction: request.direction,
    nodeGap: request.nodeGap,
    layerGap: request.layerGap,
    bandPadding: request.bandPadding,
    nodes: request.nodes.map((node) => [node.id, node.width, node.height, node.layer, node.layerLabel, node.orderHint]),
    edges: request.edges.map((edge) => [edge.id, edge.source, edge.target, edge.primary])
  }), [request, revision]);
  const fallback = useMemo(() => fallbackLayeredLayout(request), [signature]);
  const [resolved, setResolved] = useState<{ signature: string; layout: LayeredLayoutResult }>();

  useEffect(() => {
    let active = true;
    calculateLayeredLayout(request).then((layout) => {
      if (active) setResolved({ signature, layout });
    });
    return () => {
      active = false;
    };
  }, [signature]);

  return resolved?.signature === signature ? resolved.layout : fallback;
}
