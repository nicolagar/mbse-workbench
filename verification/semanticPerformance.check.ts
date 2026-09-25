import { describe, expect, it } from "vitest";
import { createCoffeeMachineSampleProject } from "../src/data/sample";
import { buildSemanticGraph } from "../src/domain/semanticGraph";
import type { Project } from "../src/domain/types";
import { performance } from "node:perf_hooks";
const synthetic = (count: number): Project => {
  const p = createCoffeeMachineSampleProject();
  p.configurations=[]; p.variationPoints=[]; p.features=[]; p.featureGroups=[]; p.featureConstraints=[]; p.variabilityAxes=[]; p.kpis=[]; p.simulationRuns=[]; p.decisions=[]; p.openDecisions=[]; p.comparisonStudies=[]; p.comparisonRisks=[]; p.validationResults=[]; p.architectures=[]; p.baselineArchitectureId=undefined;
  const template = p.elements[0], rel = p.relationships[0];
  p.elements=Array.from({length:count},(_,i)=>({...template,id:`e-${i}`,elementType:"productComponent",name:`Component ${i}`,parameters:[],metadata:{},architectureScope:"common"}));
  p.relationships=Array.from({length:count*3},(_,i)=>({...rel,id:`r-${i}`,relationshipType:"refines",sourceId:`e-${i%count}`,targetId:`e-${(i+1+Math.floor(i/count))%count}`}));
  return p;
};
describe("semantic projection performance", () => {
  for(const [count, budget] of [[500,75],[2000,250]]) it(`${count} nodes / ${count*3} edges within ${budget} ms`,()=>{
    const p=synthetic(count); buildSemanticGraph(p);
    const times=Array.from({length:3},()=>{const start=performance.now();const r=buildSemanticGraph(p);expect(r.graph.edges).toHaveLength(count*3);return performance.now()-start;}).sort((a,b)=>a-b);
    console.info(JSON.stringify({nodes:count,edges:count*3,medianMs:Math.round(times[1]),budgetMs:budget}));
    expect(times[1]).toBeLessThan(budget);
  });
});
