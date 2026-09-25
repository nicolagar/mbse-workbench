import type { SemanticContext, SemanticNodeKind, SemanticPredicate } from "./semanticGraphTypes";
// JSON tuples encode compound keys without ambiguous slash-delimited owner/child IDs.
export const contextKey = (c: SemanticContext): string => c.type === "live" ? "live" : c.type === "derivation" ? JSON.stringify([c.type, c.configurationId, c.derivationId]) : c.type === "simulation" ? JSON.stringify([c.type, c.simulationRunId]) : JSON.stringify([c.type, c.decisionId]);
export const recordKey = (kind: SemanticNodeKind, id: string, ownerId?: string) => JSON.stringify([kind, ownerId ?? null, id]);
export const semanticNodeId = (c: SemanticContext, kind: SemanticNodeKind, id: string, ownerId?: string): string => `sgn:${encodeURIComponent(contextKey(c))}:${kind}:${encodeURIComponent(JSON.stringify([ownerId ?? null, id]))}`;
export const semanticEdgeId = (c: SemanticContext, p: SemanticPredicate, s: string, t: string, authority: string): string => `sge:${[contextKey(c), p, s, t, authority].map(encodeURIComponent).join(":")}`;
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}
export const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
// A change token, not a cryptographic authenticity assertion. Never persisted or used as the sole cache key.
export function fingerprint(value: unknown): string {
  const text = canonicalJson(value); let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
