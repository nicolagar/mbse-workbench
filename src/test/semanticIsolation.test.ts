import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import baseline from "../../docs/semantic-graph/BASELINE_DOMAIN_HASHES.json";
import { createCoffeeMachineSampleProject } from "../data/sample";
import { createOhscSampleProject } from "../data/ohscSample";
import { buildSemanticGraph } from "../domain/semanticGraph";
import { deriveTradeStudyOntology } from "../domain/tradeStudyOntology";
import { findPath } from "../domain/semanticGraphTraversal";
describe("semantic isolation and shadow parity", () => {
  it("keeps every existing domain engine, store and sample byte-identical to V03", () => {
    for (const [path, expected] of Object.entries(baseline)) {
      const content = readFileSync(path);
      const actual = createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
      expect(actual, path).toBe(expected);
    }
  });
  for (const [name, make] of [["Coffee",createCoffeeMachineSampleProject],["OHSC",createOhscSampleProject]] as const) it(`${name}: every legacy study record survives and Mission-to-baseline navigation preserves arrow meanings`, () => {
    const p = make(), g = buildSemanticGraph(p).graph;
    for (const s of p.comparisonStudies) for (const n of deriveTradeStudyOntology(p,s).nodes) expect(g.nodes.some(next => next.recordId === n.recordId), `${n.kind} ${n.recordId}`).toBe(true);
    const mission = g.nodes.find(n=>n.kind === "mission")!, baseline = g.nodes.find(n=>n.kind === "architecture" && n.attributes.isBaseline)!;
    expect(mission).toBeDefined(); expect(baseline).toBeDefined();
    expect(findPath(g,mission.id,baseline.id,{direction:"both",roles:["canonical","supporting","evidence"]}).length).toBeGreaterThan(0);
  });
});
