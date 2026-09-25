import { useMemo } from "react";
import { configurationReadiness } from "../domain/configurationReadiness";
import type { Configuration, Project } from "../domain/types";

export function ConfigurationReadiness({ project, configuration, emphasized = false, showDetails = true }: { project: Project; configuration: Configuration; emphasized?: boolean; showDetails?: boolean }) {
  const state = useMemo(() => configurationReadiness(project, configuration), [project, configuration]);
  return <div className={`mt-3 rounded-lg p-4 text-sm ${emphasized ? "border border-blue-200 bg-blue-50" : "bg-slate-50"}`}>{emphasized && <h3 className="mb-3 text-base font-bold text-slate-900">Configuration Recap</h3>}<dl className="grid grid-cols-[minmax(150px,1fr)_2fr] gap-2 max-sm:grid-cols-1"><dt>Feature choices</dt><dd className="font-medium">{state.featureChoices}</dd><dt>100% architecture</dt><dd className="font-medium">{state.derivation}</dd><dt>Model consistency</dt><dd className="font-medium">{state.consistency}</dd><dt>Requirements</dt><dd className="font-medium">{state.requirements}</dd><dt>Eligible for Trade-off Study</dt><dd className="font-medium">{state.eligibility}</dd></dl>{showDetails && state.errors.length > 0 && <p role="alert" className="mt-2 text-red-700">{state.errors.join(" ")}</p>}</div>;
}
