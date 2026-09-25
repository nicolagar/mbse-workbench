import { useMemo } from "react";
import { assessmentModel } from "../domain/requirementAssessment";
import { runStandardAlgorithm } from "../domain/presizing";
import { systemOfInterest } from "../domain/ontology";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

export function MassContributions() {
  const project = useAppStore(selectActiveProject)!;
  const selectElement = useAppStore((state) => state.selectElement);
  const configuration = project.configurations.find((item) => item.architectureId === project.activeArchitectureId);
  const model = useMemo(() => assessmentModel(project, configuration?.id), [project, configuration?.id]);
  const total = runStandardAlgorithm("totalMass", { ...model.project, configurationId: configuration?.id, rollupRootId: systemOfInterest(model.project)?.metadata.architectureRootId });
  return <details className="mt-3 rounded-lg border border-slate-200 p-3 text-sm"><summary className="cursor-pointer font-medium">Mass contributions · {configuration?.name ?? "150% model"} · {total.value === null || model.errors.length ? "Incomplete" : `${total.value} ${total.unit}`}</summary><p className="my-2 text-xs text-slate-600">Boundary: {systemOfInterest(project)?.metadata.systemBoundary || systemOfInterest(project)?.name || "Modeled product components"}. Assembly: {model.project.elements.find((item) => item.id === systemOfInterest(model.project)?.metadata.architectureRootId)?.name ?? "All modeled product components"}. Values already include their declared quantity.</p><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Part</th><th>Mass</th><th>Accounting / basis</th></tr></thead><tbody>{project.elements.filter((item) => item.elementType === "productComponent").map((item) => {
    const active = model.project.elements.find((element) => element.id === item.id);
    const masses = active?.parameters.filter((parameter) => parameter.semanticKey === "mass" && (!parameter.applicableConfigurationIds.length || parameter.applicableConfigurationIds.includes(configuration?.id ?? ""))) ?? [];
    return <tr key={item.id}><td className="table-cell"><button className="text-left text-blue-700 hover:underline" onClick={() => selectElement(item.id)}>{item.name}</button></td><td className="table-cell">{masses.length ? masses.map((mass) => `${mass.value ?? "missing"} ${mass.unit ?? ""}`).join("; ") : "—"}</td><td className="table-cell text-xs">{!active ? "Excluded by configuration" : active.metadata.massAccounting === "outsideBoundary" ? `Outside boundary: ${active.metadata.massAccountingNote ?? "not counted"}` : active.metadata.massAccounting === "includedElsewhere" ? active.metadata.massAccountingNote || "Accounting explanation missing" : masses.length && !masses.some((mass) => total.sourceParameterIds.includes(mass.id)) ? "Outside selected assembly" : masses.length ? masses.map((mass) => `${mass.contributionBasis ?? "local"}: ${mass.quantityBasis || "Quantity basis not recorded"}`).join("; ") : active.metadata.massAccountingNote || "Missing contribution or accounting explanation"}</td></tr>;
  })}</tbody><tfoot><tr><th className="table-cell">Modeled total</th><td className="table-cell">{total.value === null || model.errors.length ? "Incomplete" : `${total.value} ${total.unit}`}</td><td className="table-cell text-xs">{[...model.errors, ...total.missingInformation].join(" ") || "Each contribution counted once."}</td></tr></tfoot></table></div></details>;
}
