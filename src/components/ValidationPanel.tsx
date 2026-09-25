import { Play, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import type { ModelTabId, ValidationCategory, ValidationResult, ValidationSeverity } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

type ValidationDomain = "all" | "model" | "variability" | "parameters" | "simulation";
type FindingTarget = { id: string; label: string; kind: "element" | "relationship" | "feature" | "variationPoint" | "configuration" };

const modelTabForElement = (type: string): ModelTabId => {
  if (["mission", "stakeholder", "need", "objective", "useCase"].includes(type)) return "mission-context";
  if (type === "systemRequirement") return "requirements-validation";
  if (type === "productFunction") return "product-functional";
  if (["productComponent", "productInterface"].includes(type)) return "product-technical";
  if (type === "processFunction") return "process-functional";
  return "process-technical";
};

const findingDomain = (finding: ValidationResult): Exclude<ValidationDomain, "all"> => {
  if (finding.ruleId === "PMB-113") return "simulation";
  if (finding.category === "feature") return "variability";
  if (["parameter", "formula"].includes(finding.category)) return "parameters";
  return "model";
};

export function ValidationPanel() {
  const project = useAppStore(selectActiveProject)!;
  const runValidation = useAppStore((state) => state.runValidation);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const setModelTab = useAppStore((state) => state.setModelTab);
  const setModelView = useAppStore((state) => state.setModelView);
  const selectElement = useAppStore((state) => state.selectElement);
  const selectRelationship = useAppStore((state) => state.selectRelationship);
  const selectFeature = useAppStore((state) => state.selectFeature);
  const selectVariationPoint = useAppStore((state) => state.selectVariationPoint);
  const selectConfiguration = useAppStore((state) => state.selectConfiguration);
  const setVariabilityTab = useAppStore((state) => state.setVariabilityTab);
  const setValidationFilters = useAppStore((state) => state.setValidationFilters);
  const severity = useAppStore((state) => state.uiPreferences.validationSeverity);
  const category = useAppStore((state) => state.uiPreferences.validationCategory);
  const domain = useAppStore((state) => state.uiPreferences.validationDomain);
  const [targetChoice, setTargetChoice] = useState<{ finding: ValidationResult; targets: FindingTarget[] } | null>(null);

  const results = project.validationResults.filter((finding) =>
    (severity === "all" || finding.severity === severity)
    && (category === "all" || finding.category === category)
    && (domain === "all" || findingDomain(finding) === domain)
  );
  const categories = [...new Set(project.validationResults.map((finding) => finding.category))];
  const counts = (level: ValidationSeverity) => project.validationResults.filter((finding) => finding.severity === level).length;

  const inferredTargets = (finding: ValidationResult): FindingTarget[] => {
    const targets: FindingTarget[] = [
      ...finding.affectedElementIds.flatMap((id) => {
        const element = project.elements.find((candidate) => candidate.id === id);
        return element ? [{ id, label: `${element.name} · model element`, kind: "element" as const }] : [];
      }),
      ...finding.affectedRelationshipIds.flatMap((id) => {
        const relationship = project.relationships.find((candidate) => candidate.id === id);
        return relationship ? [{ id, label: `${relationship.relationshipType} · relationship`, kind: "relationship" as const }] : [];
      })
    ];
    if (finding.category === "feature") {
      project.features.forEach((feature) => {
        if (finding.message.includes(feature.id) || finding.message.includes(`“${feature.name}”`)) {
          targets.push({ id: feature.id, label: `${feature.name} · feature`, kind: "feature" });
        }
      });
      project.variationPoints.forEach((variationPoint) => {
        if (finding.message.includes(variationPoint.id) || finding.message.includes(`“${variationPoint.name}”`)) {
          targets.push({ id: variationPoint.id, label: `${variationPoint.name} · variation point`, kind: "variationPoint" });
        }
      });
      project.configurations.forEach((configuration) => {
        if (finding.message.includes(configuration.id) || finding.message.includes(`“${configuration.name}”`)) {
          targets.push({ id: configuration.id, label: `${configuration.name} · configuration`, kind: "configuration" });
        }
      });
    }
    return [...new Map(targets.map((target) => [`${target.kind}:${target.id}`, target])).values()];
  };

  const navigate = (target: FindingTarget) => {
    setTargetChoice(null);
    if (target.kind === "element") {
      const element = project.elements.find((candidate) => candidate.id === target.id);
      if (!element) return;
      setWorkspace("model");
      setModelTab(modelTabForElement(element.elementType));
      setModelView("table");
      selectElement(element.id);
      return;
    }
    if (target.kind === "relationship") {
      setWorkspace("model");
      setModelView("graph");
      selectRelationship(target.id);
      return;
    }
    setWorkspace("variability");
    if (target.kind === "feature") {
      setVariabilityTab("Feature Model");
      selectFeature(target.id);
    } else if (target.kind === "variationPoint") {
      setVariabilityTab("Variation Points");
      selectVariationPoint(target.id);
    } else {
      setVariabilityTab("Configurator");
      selectConfiguration(target.id);
    }
  };

  const openFinding = (finding: ValidationResult) => {
    const targets = inferredTargets(finding);
    if (targets.length === 1) navigate(targets[0]);
    else if (targets.length > 1) setTargetChoice({ finding, targets });
  };

  return (
    <section className="card">
      <div className="flex items-center gap-3 border-b border-slate-200 p-4">
        <ShieldCheck className="text-blue-600" />
        <div className="min-w-0 flex-1"><h2 className="font-bold">Project validation results</h2><p className="text-xs text-slate-500">Complete-project deterministic checks grouped by engineering domain. Select a finding to open its affected object.</p></div>
        <span className="badge bg-red-50 text-red-700">{counts("error")} errors</span>
        <span className="badge bg-amber-50 text-amber-700">{counts("warning")} warnings</span>
        <span className="badge bg-blue-50 text-blue-700">{counts("information")} info</span>
        <button className="btn btn-primary" onClick={runValidation}><Play size={15} /> Run validation</button>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-3">
        <label><span className="label">Severity</span><select className="field" value={severity} onChange={(event) => setValidationFilters({ severity: event.target.value as ValidationSeverity | "all" })}><option value="all">All severities</option><option>error</option><option>warning</option><option>information</option></select></label>
        <label><span className="label">Category</span><select className="field" value={category} onChange={(event) => setValidationFilters({ category: event.target.value as ValidationCategory | "all" })}><option value="all">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span className="label">Workspace / domain</span><select className="field" value={domain} onChange={(event) => setValidationFilters({ domain: event.target.value as ValidationDomain })}><option value="all">All domains</option><option value="model">Model</option><option value="variability">Variability</option><option value="parameters">Parameters and KPIs</option><option value="simulation">Simulation</option></select></label>
        <button className="btn self-end" onClick={() => setValidationFilters({ severity: "all", category: "all", domain: "all" })}>Clear filters</button>
      </div>
      <div className="max-h-[560px] overflow-auto">
        {results.map((finding) => {
          const targetCount = inferredTargets(finding).length;
          return <button key={finding.id} className="flex w-full gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50" onClick={() => openFinding(finding)}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${finding.severity === "error" ? "bg-red-500" : finding.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
            <span className="min-w-0 flex-1"><span className="font-semibold">{finding.ruleId} · {finding.title}</span><span className="mt-1 block text-sm text-slate-600">{finding.message}</span><span className="mt-1 block text-[11px] text-blue-700">{targetCount ? `Open ${targetCount} affected object${targetCount === 1 ? "" : "s"}` : "No directly addressable object"}</span></span>
            <span className="space-y-1 text-right"><span className="badge block bg-slate-100 text-slate-600">{finding.category}</span><span className="text-[10px] text-slate-500">{findingDomain(finding)}</span></span>
          </button>;
        })}
        {!results.length && <p className="p-10 text-center text-sm text-slate-500">No findings match these filters.</p>}
      </div>
      {targetChoice && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div className="flex items-start gap-3 border-b p-4"><div className="min-w-0 flex-1"><h3 className="font-bold">Choose affected object</h3><p className="mt-1 text-sm text-slate-600">{targetChoice.finding.ruleId} · {targetChoice.finding.title}</p></div><button className="btn p-2" onClick={() => setTargetChoice(null)}><X size={15} /></button></div><div className="space-y-2 p-4">{targetChoice.targets.map((target) => <button className="btn w-full justify-start" key={`${target.kind}:${target.id}`} onClick={() => navigate(target)}>{target.label}</button>)}</div></section></div>}
    </section>
  );
}
