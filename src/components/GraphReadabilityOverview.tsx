import { ArrowLeft, ArrowRight, Check, Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ElementType, ModelElement, RelationshipType } from "../domain/types";

export interface ReadableGraphConnection {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType?: RelationshipType;
  label?: string;
  containment?: boolean;
}

export type WorkflowAreaId = "mission" | "system" | "context" | "intent" | "useCases" | "productFunctions" | "productArchitecture" | "processFunctions" | "industrialArchitecture" | "resources" | "verification" | "requirements";

export interface WorkflowArea {
  id: WorkflowAreaId;
  label: string;
  description: string;
  elementTypes: ElementType[];
}

export const workflowAreas: WorkflowArea[] = [
  { id: "mission", label: "Mission", description: "Purpose of the modeled system", elementTypes: ["mission"] },
  { id: "system", label: "System of Interest", description: "Modeled system boundary", elementTypes: ["system"] },
  { id: "context", label: "Context", description: "Stakeholders and external systems", elementTypes: ["stakeholder", "externalSystem"] },
  { id: "intent", label: "Objectives and needs", description: "Stakeholder intent and engineering objectives", elementTypes: ["need", "objective"] },
  { id: "useCases", label: "Use cases", description: "Interactions addressed by the system", elementTypes: ["useCase"] },
  { id: "productFunctions", label: "Product functions", description: "Behavior required from the product", elementTypes: ["productFunction"] },
  { id: "productArchitecture", label: "Product components", description: "Components and product interfaces", elementTypes: ["productComponent", "productInterface"] },
  { id: "processFunctions", label: "Process functions", description: "Industrial behavior and work steps", elementTypes: ["processFunction"] },
  { id: "industrialArchitecture", label: "Industrial-system components", description: "Industrial components and process interfaces", elementTypes: ["industrialSystemComponent", "processInterface"] },
  { id: "resources", label: "Resources", description: "Resources required by the industrial system", elementTypes: ["resource"] },
  { id: "verification", label: "Verification methods", description: "Methods used to verify requirements", elementTypes: ["verificationMethod"] },
  { id: "requirements", label: "Requirements", description: "Cross-cutting system requirements", elementTypes: ["systemRequirement"] }
];

const areaByType = new Map(workflowAreas.flatMap((area) => area.elementTypes.map((type) => [type, area.id] as const)));
const areaById = new Map(workflowAreas.map((area) => [area.id, area]));
const rootAreaIds = new Set<WorkflowAreaId>(["mission", "system"]);
const requirementAreaId: WorkflowAreaId = "requirements";

// The overview follows the engineering workflow. Some stored predicates point
// against that workflow; their identity and canonical endpoints remain intact.
export function workflowConnections(elements: ModelElement[], connections: ReadableGraphConnection[]) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  return crossAreaConnections(elements, connections).map((connection) => {
    const source = byId.get(connection.sourceId)!;
    const target = byId.get(connection.targetId)!;
    const reverse = (connection.relationshipType === "consumes" && source.elementType === "processFunction" && target.elementType === "productComponent")
      || (connection.relationshipType === "verifies" && source.elementType === "verificationMethod" && target.elementType === "systemRequirement");
    return reverse ? { ...connection, sourceId: connection.targetId, targetId: connection.sourceId } : connection;
  });
}

export function workflowAreaForElementType(elementType: ElementType): WorkflowAreaId {
  return areaByType.get(elementType) ?? "context";
}

type TraversalDirection = "self" | "upstream" | "downstream";

export interface WorkflowSelectionSeed {
  elementId: string;
  direction: TraversalDirection;
}

export interface WorkflowSelectionResult {
  directElementIds: Set<string>;
  reachedElementIds: Set<string>;
  visibleConnectionIds: Set<string>;
}

export function crossAreaConnections(elements: ModelElement[], connections: ReadableGraphConnection[]) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  return connections.filter((connection) => {
    const source = byId.get(connection.sourceId);
    const target = byId.get(connection.targetId);
    return source && target && workflowAreaForElementType(source.elementType) !== workflowAreaForElementType(target.elementType);
  });
}

export function calculateWorkflowSelection(elements: ModelElement[], connections: ReadableGraphConnection[], seeds: WorkflowSelectionSeed[]): WorkflowSelectionResult {
  const ids = new Set(elements.map((element) => element.id));
  const eligible = crossAreaConnections(elements, connections);
  const incoming = new Map<string, ReadableGraphConnection[]>();
  const outgoing = new Map<string, ReadableGraphConnection[]>();
  eligible.forEach((connection) => {
    outgoing.set(connection.sourceId, [...(outgoing.get(connection.sourceId) ?? []), connection]);
    incoming.set(connection.targetId, [...(incoming.get(connection.targetId) ?? []), connection]);
  });
  const directElementIds = new Set(seeds.map((seed) => seed.elementId).filter((id) => ids.has(id)));
  const reachedElementIds = new Set<string>();
  const visibleConnectionIds = new Set<string>();
  seeds.forEach((seed) => {
    if (!ids.has(seed.elementId)) return;
    if (seed.direction === "self") return;
    const visited = new Set([seed.elementId]);
    const queue = [seed.elementId];
    while (queue.length) {
      const current = queue.shift()!;
      const nextConnections = seed.direction === "upstream" ? incoming.get(current) ?? [] : outgoing.get(current) ?? [];
      nextConnections.slice().sort((a, b) => a.id.localeCompare(b.id)).forEach((connection) => {
        visibleConnectionIds.add(connection.id);
        const nextId = seed.direction === "upstream" ? connection.sourceId : connection.targetId;
        if (visited.has(nextId)) return;
        visited.add(nextId);
        reachedElementIds.add(nextId);
        queue.push(nextId);
      });
    }
  });
  directElementIds.forEach((id) => reachedElementIds.delete(id));
  return { directElementIds, reachedElementIds, visibleConnectionIds };
}

const sessionSelections = new Map<string, WorkflowSelectionSeed[]>();
let sessionProjectId: string | undefined;
const elementTypeName = (elementType: ElementType) => elementType.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const seedKey = (seed: WorkflowSelectionSeed) => `${seed.elementId}:${seed.direction}`;

export function ModelWorkflowOverview({ elements, connections, projectId, selectionKey, heightClass, onElementDoubleClick }: {
  elements: ModelElement[];
  connections: ReadableGraphConnection[];
  projectId: string;
  selectionKey: string;
  heightClass: string;
  onElementDoubleClick?: (elementId: string) => void;
}) {
  const [seeds, setSeeds] = useState<WorkflowSelectionSeed[]>(() => {
    if (sessionProjectId !== projectId) {
      sessionSelections.clear();
      sessionProjectId = projectId;
    }
    return sessionSelections.get(selectionKey) ?? [];
  });
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const areaRefs = useRef(new Map<WorkflowAreaId, HTMLElement>());
  const [edgePaths, setEdgePaths] = useState<Array<{ id: string; path: string }>>([]);

  useEffect(() => {
    if (sessionProjectId !== projectId) {
      sessionSelections.clear();
      sessionProjectId = projectId;
    }
    setSeeds(sessionSelections.get(selectionKey) ?? []);
  }, [projectId, selectionKey]);

  const updateSeeds = useCallback((next: WorkflowSelectionSeed[]) => {
    const elementIds = new Set(elements.map((element) => element.id));
    const normalized = next.filter((seed) => elementIds.has(seed.elementId)).filter((seed, index, all) => all.findIndex((candidate) => seedKey(candidate) === seedKey(seed)) === index).sort((a, b) => a.elementId.localeCompare(b.elementId) || a.direction.localeCompare(b.direction));
    sessionSelections.set(selectionKey, normalized);
    setSeeds(normalized);
  }, [elements, selectionKey]);

  const eligibleConnections = useMemo(() => workflowConnections(elements, connections), [connections, elements]);
  const selection = useMemo(() => calculateWorkflowSelection(elements, eligibleConnections, seeds), [eligibleConnections, elements, seeds]);
  const visibleConnections = useMemo(() => {
    const seenPairs = new Set<string>();
    return eligibleConnections.filter((connection) => {
      if (!selection.visibleConnectionIds.has(connection.id)) return false;
      const pair = `${connection.sourceId}\u0000${connection.targetId}`;
      if (seenPairs.has(pair)) return false;
      seenPairs.add(pair);
      return true;
    });
  }, [eligibleConnections, selection.visibleConnectionIds]);
  const hasSelection = seeds.length > 0;
  const degree = useMemo(() => {
    const values = new Map<string, number>();
    eligibleConnections.forEach((connection) => {
      values.set(connection.sourceId, (values.get(connection.sourceId) ?? 0) + 1);
      values.set(connection.targetId, (values.get(connection.targetId) ?? 0) + 1);
    });
    return values;
  }, [eligibleConnections]);
  const elementsByArea = useMemo(() => new Map(workflowAreas.map((area) => [area.id, elements.filter((element) => workflowAreaForElementType(element.elementType) === area.id).sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))])), [degree, elements]);

  const toggleElement = (elementId: string) => {
    const directlySelected = seeds.some((seed) => seed.elementId === elementId);
    updateSeeds(directlySelected ? seeds.filter((seed) => seed.elementId !== elementId) : [...seeds, { elementId, direction: "self" }]);
  };
  const toggleDirection = (elementId: string, direction: Exclude<TraversalDirection, "self">) => {
    const key = `${elementId}:${direction}`;
    updateSeeds(seeds.some((seed) => seedKey(seed) === key) ? seeds.filter((seed) => seedKey(seed) !== key) : [...seeds, { elementId, direction }]);
  };
  const toggleArea = (areaId: WorkflowAreaId, direction: TraversalDirection) => {
    const areaElements = elementsByArea.get(areaId) ?? [];
    const candidates = direction === "self" ? areaElements : areaElements.filter((element) => seeds.some((seed) => seed.elementId === element.id));
    if (!candidates.length) return;
    const allActive = candidates.every((element) => seeds.some((seed) => seed.elementId === element.id && seed.direction === direction));
    const areaIds = new Set(candidates.map((element) => element.id));
    const withoutDirection = seeds.filter((seed) => !areaIds.has(seed.elementId) || seed.direction !== direction);
    updateSeeds(allActive ? withoutDirection : [...withoutDirection, ...candidates.map((element) => ({ elementId: element.id, direction }))]);
  };

  const registerNode = useCallback((elementId: string, node: HTMLDivElement | null) => {
    if (node) nodeRefs.current.set(elementId, node);
    else nodeRefs.current.delete(elementId);
  }, []);

  const updatePaths = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const base = surface.getBoundingClientRect();
    const inverseScale = fitScale * zoom || 1;
    type Side = "top" | "right" | "bottom" | "left";
    type Endpoint = { connectionId: string; nodeId: string; opposite: number; role: "source" | "target"; side: Side };
    const descriptors = visibleConnections.flatMap((connection) => {
      // Verification is explored from requirement to method, but its stored
      // verifies arrow still points from the method into the requirement.
      const verification = connection.relationshipType === "verifies";
      const visualSourceId = verification ? connection.targetId : connection.sourceId;
      const visualTargetId = verification ? connection.sourceId : connection.targetId;
      const sourceNode = nodeRefs.current.get(visualSourceId);
      const targetNode = nodeRefs.current.get(visualTargetId);
      if (!sourceNode || !targetNode) return [];
      const source = sourceNode.getBoundingClientRect();
      const target = targetNode.getBoundingClientRect();
      const sourceCenter = { x: (source.left + source.right) / 2, y: (source.top + source.bottom) / 2 };
      const targetCenter = { x: (target.left + target.right) / 2, y: (target.top + target.bottom) / 2 };
      const dx = targetCenter.x - sourceCenter.x;
      const dy = targetCenter.y - sourceCenter.y;
      const sourceArea = workflowAreaForElementType(elements.find((element) => element.id === visualSourceId)!.elementType);
      const targetArea = workflowAreaForElementType(elements.find((element) => element.id === visualTargetId)!.elementType);
      const fromRequirements = sourceArea === requirementAreaId && targetArea !== "verification";
      const intoRequirements = targetArea === requirementAreaId && sourceArea !== "verification";
      const fromRoot = rootAreaIds.has(sourceArea) && !rootAreaIds.has(targetArea);
      const sourceSide: Side = fromRequirements ? "top" : intoRequirements ? "right" : fromRoot ? "bottom" : dx >= 0 ? "right" : "left";
      const targetSide: Side = fromRequirements ? "left" : intoRequirements ? "top" : fromRoot ? "top" : dx >= 0 ? "left" : "right";
      return [{ connection, source, target, sourceCenter, targetCenter, sourceArea, targetArea, sourceSide, targetSide }];
    });
    const endpointGroups = new Map<string, Endpoint[]>();
    descriptors.forEach(({ connection, sourceCenter, sourceSide, targetCenter, targetSide }) => {
      const endpoints: Endpoint[] = [
        { connectionId: connection.id, nodeId: connection.relationshipType === "verifies" ? connection.targetId : connection.sourceId, opposite: sourceSide === "left" || sourceSide === "right" ? targetCenter.y : targetCenter.x, role: "source", side: sourceSide },
        { connectionId: connection.id, nodeId: connection.relationshipType === "verifies" ? connection.sourceId : connection.targetId, opposite: targetSide === "left" || targetSide === "right" ? sourceCenter.y : sourceCenter.x, role: "target", side: targetSide }
      ];
      endpoints.forEach((endpoint) => {
        const key = `${endpoint.nodeId}:${endpoint.side}`;
        endpointGroups.set(key, [...(endpointGroups.get(key) ?? []), endpoint]);
      });
    });
    const endpointIndexes = new Map<string, { index: number; count: number }>();
    endpointGroups.forEach((endpoints) => endpoints
      .sort((a, b) => a.opposite - b.opposite || a.connectionId.localeCompare(b.connectionId) || a.role.localeCompare(b.role))
      .forEach((endpoint, index) => endpointIndexes.set(`${endpoint.connectionId}:${endpoint.role}`, { index, count: endpoints.length })));
    const pointOnSide = (rect: DOMRect, side: Side, slot: { index: number; count: number }) => {
      const fraction = (slot.index + 1) / (slot.count + 1);
      return side === "left" ? { x: rect.left, y: rect.top + rect.height * fraction }
        : side === "right" ? { x: rect.right, y: rect.top + rect.height * fraction }
          : side === "top" ? { x: rect.left + rect.width * fraction, y: rect.top }
            : { x: rect.left + rect.width * fraction, y: rect.bottom };
    };
    const areaRects = new Map([...areaRefs.current].map(([id, node]) => [id, node.getBoundingClientRect()]));
    const requirementsTop = areaRects.get(requirementAreaId)?.top ?? base.bottom;
    const upperBottom = Math.max(...[...areaRects].filter(([id]) => id !== requirementAreaId && id !== "verification").map(([, rect]) => rect.bottom), base.top);
    const upperTop = Math.min(...[...areaRects].filter(([id]) => !rootAreaIds.has(id) && id !== requirementAreaId && id !== "verification").map(([, rect]) => rect.top), base.top);
    const rootBottom = Math.max(...[...areaRects].filter(([id]) => rootAreaIds.has(id)).map(([, rect]) => rect.bottom), base.top);
    setEdgePaths(descriptors.map(({ connection, source, target, sourceArea, targetArea, sourceSide, targetSide }, index) => {
      const start = pointOnSide(source, sourceSide, endpointIndexes.get(`${connection.id}:source`) ?? { index: 0, count: 1 });
      const end = pointOnSide(target, targetSide, endpointIndexes.get(`${connection.id}:target`) ?? { index: 0, count: 1 });
      const local = (point: { x: number; y: number }) => ({ x: (point.x - base.left) / inverseScale, y: (point.y - base.top) / inverseScale });
      const a = local(start);
      const b = local(end);
      const sourceRect = areaRects.get(sourceArea);
      const targetRect = areaRects.get(targetArea);
      const gutter = (rect: DOMRect | undefined, side: "left" | "right", lane: number) =>
        local({ x: (side === "left" ? rect?.left ?? start.x : rect?.right ?? start.x) + (side === "left" ? -1 : 1) * (7 + lane * 0.7), y: start.y }).x;
      const lane = index % 17;
      let path: string;
      if (sourceArea === requirementAreaId && targetArea !== "verification") {
        // Rise from the requirement into the clear band, then use the gap
        // beside the destination environment. No segment crosses an area.
        const corridor = local({ x: start.x, y: (requirementsTop + upperBottom) / 2 - lane * 0.4 }).y;
        const channel = gutter(targetRect, "left", lane);
        path = `M ${a.x} ${a.y} V ${corridor} H ${channel} V ${b.y} H ${b.x}`;
      } else if (targetArea === requirementAreaId && sourceArea !== "verification") {
        const corridor = local({ x: start.x, y: (requirementsTop + upperBottom) / 2 - lane * 0.4 }).y;
        const channel = gutter(sourceRect, "right", lane);
        path = `M ${a.x} ${a.y} H ${channel} V ${corridor} H ${b.x} V ${b.y}`;
      } else if (rootAreaIds.has(sourceArea) && !rootAreaIds.has(targetArea)) {
        const corridor = local({ x: start.x, y: (rootBottom + upperTop) / 2 }).y;
        path = `M ${a.x} ${a.y} V ${corridor} H ${b.x} V ${b.y}`;
      } else if (sourceArea === "verification" && targetArea === requirementAreaId) {
        path = `M ${a.x} ${a.y} H ${(a.x + b.x) / 2} V ${b.y} H ${b.x}`;
      } else if (sourceArea === targetArea || Math.abs(a.x - b.x) < 300) {
        path = `M ${a.x} ${a.y} H ${(a.x + b.x) / 2} V ${b.y} H ${b.x}`;
      } else {
        // Skip intermediate environments by using the lower open corridor
        // and the empty vertical gaps alongside the source and destination.
        const corridor = local({ x: start.x, y: (requirementsTop + upperBottom) / 2 - lane * 0.4 }).y;
        const departure = gutter(sourceRect, sourceSide === "left" ? "left" : "right", lane);
        const arrival = gutter(targetRect, targetSide === "right" ? "right" : "left", lane);
        path = `M ${a.x} ${a.y} H ${departure} V ${corridor} H ${arrival} V ${b.y} H ${b.x}`;
      }
      return { id: connection.id, path };
    }));
  }, [elements, fitScale, visibleConnections, zoom]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(updatePaths);
    const observer = typeof ResizeObserver === "undefined" || !surfaceRef.current ? undefined : new ResizeObserver(updatePaths);
    if (surfaceRef.current) observer?.observe(surfaceRef.current);
    window.addEventListener("resize", updatePaths);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", updatePaths); };
  }, [updatePaths]);

  const fitFullscreen = useCallback(() => {
    const scroller = scrollerRef.current;
    const surface = surfaceRef.current;
    if (!scroller || !surface) return;
    const scale = Math.min(1, Math.max(320, scroller.clientWidth - 32) / surface.offsetWidth, Math.max(320, scroller.clientHeight - 32) / surface.offsetHeight);
    setFitScale(Number.isFinite(scale) ? scale : 1);
    setZoom(1);
    scroller.scrollTo?.({ left: 0, top: 0 });
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === wrapperRef.current;
      setBrowserFullscreen(active);
      if (active) requestAnimationFrame(fitFullscreen);
      else setFitScale(1);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [fitFullscreen]);

  useEffect(() => {
    if (fallbackFullscreen) requestAnimationFrame(fitFullscreen);
    else if (!browserFullscreen) setFitScale(1);
  }, [browserFullscreen, fallbackFullscreen, fitFullscreen]);

  const toggleFullscreen = async () => {
    if (browserFullscreen) return void await document.exitFullscreen?.();
    if (fallbackFullscreen) return void setFallbackFullscreen(false);
    try {
      if (!wrapperRef.current?.requestFullscreen) throw new Error("Fullscreen API unavailable");
      await wrapperRef.current.requestFullscreen();
    } catch {
      setFallbackFullscreen(true);
    }
  };

  const isFullscreen = browserFullscreen || fallbackFullscreen;
  const Card = ({ element, staticContext = false }: { element: ModelElement; staticContext?: boolean }) => {
    const direct = selection.directElementIds.has(element.id);
    const reached = selection.reachedElementIds.has(element.id);
    const faded = hasSelection && !direct && !reached;
    return <div ref={(node) => registerNode(element.id, node)} className={`relative z-10 rounded-lg border px-2.5 py-2 shadow-sm transition ${direct ? "border-green-600 bg-green-200" : reached ? "border-green-400 bg-green-100" : "border-slate-200 bg-white"} ${faded ? "opacity-30" : "opacity-100"}`} data-overview-element={element.id} onDoubleClick={() => { if (isFullscreen && !staticContext) { if (browserFullscreen) void document.exitFullscreen?.(); else setFallbackFullscreen(false); onElementDoubleClick?.(element.id); } }}>
      {direct && <span aria-label={`Directly selected: ${element.name}`} className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded border border-green-700 bg-white text-green-700"><Check size={11} strokeWidth={3} /></span>}
      {staticContext ? <div><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">{elementTypeName(element.elementType)}</span><span className="mt-0.5 block line-clamp-3 text-[11px] font-semibold leading-4 text-slate-800">{element.name}</span></div> : <>
        <button aria-label={`Select ${element.name}`} className="block w-full pr-5 text-left" onClick={() => toggleElement(element.id)}><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">{elementTypeName(element.elementType)}</span><span className="mt-0.5 block line-clamp-3 text-[11px] font-semibold leading-4 text-slate-800">{element.name}</span></button>
        <div className="mt-2 flex items-center justify-between gap-1">
          <button aria-label={`Expand upstream from ${element.name}`} className={`rounded border px-1.5 py-1 text-[9px] font-semibold ${seeds.some((seed) => seed.elementId === element.id && seed.direction === "upstream") ? "border-green-600 bg-green-600 text-white" : "border-slate-300 bg-white text-slate-600"}`} onClick={() => toggleDirection(element.id, "upstream")}><ArrowLeft className="inline" size={10} /> expand</button>
          <button aria-label={`Expand downstream from ${element.name}`} className={`rounded border px-1.5 py-1 text-[9px] font-semibold ${seeds.some((seed) => seed.elementId === element.id && seed.direction === "downstream") ? "border-green-600 bg-green-600 text-white" : "border-slate-300 bg-white text-slate-600"}`} onClick={() => toggleDirection(element.id, "downstream")}>expand <ArrowRight className="inline" size={10} /></button>
        </div>
      </>}
    </div>;
  };

  const Area = ({ area, wide = false }: { area: WorkflowArea; wide?: boolean }) => {
    const areaElements = elementsByArea.get(area.id) ?? [];
    const staticContext = rootAreaIds.has(area.id);
    const selectedInArea = areaElements.some((element) => seeds.some((seed) => seed.elementId === element.id));
    return <section ref={(node) => { if (node) areaRefs.current.set(area.id, node); else areaRefs.current.delete(area.id); }} className={`relative z-10 rounded-xl border border-slate-200 bg-slate-100/95 shadow-sm ${wide ? "min-w-full" : "w-[230px] shrink-0"}`} data-overview-area={area.id}>
      <header className="border-b border-slate-200 px-2.5 py-2"><div className="flex items-center justify-between gap-2"><h4 className="text-[11px] font-bold text-slate-800">{area.label}</h4><span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{areaElements.length}</span></div>{!staticContext && <div className="mt-1.5 grid grid-cols-3 gap-1"><button aria-label={`Expand selected upstream in ${area.label}`} disabled={!selectedInArea} className="rounded border border-slate-300 bg-white px-1 py-1 text-[8px] font-semibold text-slate-600 disabled:opacity-40" onClick={() => toggleArea(area.id, "upstream")}><ArrowLeft className="inline" size={9} /> expand selected</button><button className="rounded border border-slate-300 bg-white px-1 py-1 text-[8px] font-semibold text-slate-600" onClick={() => toggleArea(area.id, "self")}>Select all</button><button aria-label={`Expand selected downstream in ${area.label}`} disabled={!selectedInArea} className="rounded border border-slate-300 bg-white px-1 py-1 text-[8px] font-semibold text-slate-600 disabled:opacity-40" onClick={() => toggleArea(area.id, "downstream")}>expand selected <ArrowRight className="inline" size={9} /></button></div>}</header>
      <div className={wide ? "grid grid-flow-col auto-cols-[220px] gap-2 overflow-visible p-2" : "space-y-2 p-2"}>{areaElements.map((element) => <Card element={element} staticContext={staticContext} key={element.id} />)}{!areaElements.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-5 text-center text-[10px] text-slate-400">No modeled elements</div>}</div>
    </section>;
  };

  const rootAreas = workflowAreas.filter((area) => rootAreaIds.has(area.id));
  const upperAreas = workflowAreas.filter((area) => !rootAreaIds.has(area.id) && area.id !== requirementAreaId && area.id !== "verification");
  const requirements = areaById.get(requirementAreaId)!;
  const markerId = `workflow-arrow-${selectionKey.replace(/[^a-zA-Z0-9]/g, "-")}`;

  return <div ref={wrapperRef} className={`${fallbackFullscreen ? "fixed inset-0 z-50 bg-white" : "relative"} ${browserFullscreen ? "bg-white" : ""}`}>
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 bg-white px-4 py-2"><button className="btn text-xs" disabled={!hasSelection} onClick={() => updateSeeds([])}><RotateCcw size={13} /> Clear selection</button>{isFullscreen && <div className="flex items-center gap-1" aria-label="Graph navigation and zoom"><button className="btn text-xs" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.25, value / 1.25))}><Minus size={13} /></button><span className="min-w-12 text-center text-xs">{Math.round(fitScale * zoom * 100)}%</span><button className="btn text-xs" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(8, value * 1.25))}><Plus size={13} /></button><button className="btn text-xs" onClick={fitFullscreen}>Fit graph</button></div>}<button className="btn text-xs" onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />} {isFullscreen ? "Exit full screen" : "Full screen"}</button></div>
    <div ref={scrollerRef} className={`${isFullscreen ? "h-[calc(100vh-57px)] cursor-grab active:cursor-grabbing" : heightClass} overflow-auto bg-slate-50 p-4`}
      onPointerDown={(event) => { if (!isFullscreen || event.button !== 0 || (event.target as HTMLElement).closest("button")) return; const scroller = scrollerRef.current; if (!scroller) return; panRef.current = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop }; scroller.setPointerCapture?.(event.pointerId); }}
      onPointerMove={(event) => { const pan = panRef.current; const scroller = scrollerRef.current; if (pan && scroller) { scroller.scrollLeft = pan.left + pan.x - event.clientX; scroller.scrollTop = pan.top + pan.y - event.clientY; } }}
      onPointerUp={() => { panRef.current = null; }} onPointerCancel={() => { panRef.current = null; }}
      onWheel={(event) => { if (isFullscreen && event.ctrlKey) { event.preventDefault(); setZoom((value) => Math.min(8, Math.max(0.25, value * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))); } }}>
      <div style={{ zoom: fitScale * zoom } as CSSProperties}><div ref={surfaceRef} className="relative min-w-max space-y-5 p-2" data-testid="workflow-overview-surface">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"><defs><marker id={markerId} markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5"><path d="M0,0 L7,3.5 L0,7 Z" fill="#15803d" /></marker></defs>{edgePaths.map((edge) => <path d={edge.path} fill="none" key={edge.id} markerEnd={`url(#${markerId})`} stroke="#15803d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />)}</svg>
        <div className="relative z-10 mx-auto grid w-[720px] grid-cols-2 gap-6 border-b border-slate-300 pb-5">{rootAreas.map((area) => <Area area={area} key={area.id} />)}</div>
        <div className="relative z-10 flex items-start gap-6">{upperAreas.map((area) => <Area area={area} key={area.id} />)}</div>
        <div className="relative z-10 flex items-start gap-6 border-t-4 border-dashed border-slate-400 pt-5"><Area area={areaById.get("verification")!} /><Area area={requirements} wide /></div>
      </div></div>
    </div>
  </div>;
}
