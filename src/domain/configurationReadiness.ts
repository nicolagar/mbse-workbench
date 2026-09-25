import { derivationStatus } from "./derivation";
import { assessRequirement, assessmentModel } from "./requirementAssessment";
import { validateConfiguration } from "./variability";
import { modelConsistencyErrors } from "./validation";
import type { Configuration, Project } from "./types";

export function configurationReadiness(project: Project, configuration: Configuration) {
  const featureErrors = validateConfiguration(project, configuration).filter((item) => item.severity === "error");
  const derivation = derivationStatus(project, configuration);
  const context = assessmentModel(project, configuration.id);
  const modelErrors = modelConsistencyErrors(configuration.derivation?.validationSnapshot ?? []);
  const requirements = project.elements.filter((item) => item.elementType === "systemRequirement");
  const results = requirements.map((requirement) => {
    const effective = context.project.elements.find((item) => item.id === requirement.id);
    return effective ? assessRequirement(context.project, effective, configuration.id) : { status: "notChecked" as const };
  });
  const failed = results.filter((item) => item.status === "notMet").length;
  const pending = results.filter((item) => ["notChecked", "needsUpdate"].includes(item.status)).length;
  const assumed = results.filter((item) => item.status === "assumed").length;
  const engineeringEligible = requirements.length > 0 && !featureErrors.length && !context.errors.length && derivation === "Current" && !modelErrors.length && !failed && !pending && !configuration.archivedAt;
  const eligibility = configuration.archivedAt
    ? "No — configuration is archived"
    : featureErrors.length
      ? "No — invalid feature selection"
      : context.errors.length
        ? "No — variation rules are unresolved"
        : derivation !== "Current"
          ? `No — 100% architecture is ${derivation.toLowerCase()}`
          : modelErrors.length
            ? `No — ${modelErrors.length} model-consistency issue${modelErrors.length === 1 ? "" : "s"}`
            : failed
              ? `No — ${failed} requirement${failed === 1 ? "" : "s"} not met`
              : pending
                ? `No — ${pending} requirement${pending === 1 ? "" : "s"} pending`
                : assumed
                  ? `Yes — based on ${assumed} demonstration assumption${assumed === 1 ? "" : "s"}`
                  : "Yes";
  return {
    featureChoices: featureErrors.length ? "Invalid" : "Valid",
    derivation: context.errors.length ? "Blocked by rules" : derivation,
    consistency: derivation !== "Current" ? "Needs current derivation" : modelErrors.length ? `${modelErrors.length} model issues` : "Checked",
    requirements: `${failed} not met · ${pending} pending · ${assumed} assumed / ${requirements.length}`,
    eligibility,
    engineeringEligible,
    errors: [...featureErrors.map((item) => item.message), ...context.errors]
  };
}
