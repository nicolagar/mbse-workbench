import { useSyncExternalStore } from "react";
export const semanticFlagNames = ["buildInShadow", "showProjectDigitalThreadTab", "useRegistryForSchemaView", "useSemanticTradeStudyView", "showSemanticMatrix", "showArchitectSemanticGraph", "showModelerSemanticInspector", "enableSemanticExport"] as const;
export type SemanticFlag = typeof semanticFlagNames[number];
export type SemanticGraphFlags = Readonly<Record<SemanticFlag, boolean>>;
const environmentFlags = new Set((import.meta.env.VITE_SEMANTIC_GRAPH_FLAGS ?? "").split(","));
const promotedDefaults = new Set<SemanticFlag>(["showProjectDigitalThreadTab", "useRegistryForSchemaView"]);
const defaults = () => Object.fromEntries(semanticFlagNames.map(name => [name, promotedDefaults.has(name) || environmentFlags.has(name)])) as SemanticGraphFlags;
let flags = defaults();
const listeners = new Set<() => void>();
export const getSemanticGraphFlags = () => flags;
export function setSemanticGraphFlag(name: SemanticFlag, enabled: boolean) { flags = { ...flags, [name]: enabled }; listeners.forEach(listener => listener()); }
export function resetSemanticGraphFlags() { flags = defaults(); listeners.forEach(listener => listener()); }
export function disableSemanticGraphPreviews() { flags = Object.fromEntries(semanticFlagNames.map(name => [name, false])) as SemanticGraphFlags; listeners.forEach(listener => listener()); }
export const useSemanticGraphFlags = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getSemanticGraphFlags, getSemanticGraphFlags);
// Deliberately memory-only: these choices never enter Project, the store, autosave, or schema 14.
