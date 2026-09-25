import { parseFeatureExpression } from "./featureExpressions";
import { GraphBuilder, ref, type Ref } from "./semanticGraphBuilder";
import type { DeepReadonly } from "./semanticGraphTypes";
import type { Project } from "./types";
export function variabilityAdapter(b: GraphBuilder, p: DeepReadonly<Project>, er: (id: string) => Ref) {
  if (p.features.length) {
    b.node(ref("featureModel", p.id), "Feature model", "Project.features", { virtual: true });
    const roots = p.features.filter(f => f?.featureType === "root");
    if (roots.length !== 1) b.warn("SG-REF-FEATURE-ROOT", `Expected one feature root, found ${roots.length}.`, "Project.features");
  }
  b.each(p.features, "Project.features", f => {
    const n = b.node(ref("feature", f.id), f.name, `Project.features[${f.id}]`, { featureType: f.featureType, valueType: f.valueType, allowedValues: f.allowedValues, defaultValue: f.defaultValue, legacyGroupId: f.groupId }, f.description);
    if (f.featureType === "root") b.edge(ref("featureModel", p.id), n, "containsFeature", `Project.features[${f.id}].featureType`);
    if (f.parentId) b.edge(ref("feature", f.parentId), n, "containsFeature", `Project.features[${f.id}].parentId`);
    // Legacy groupId is an XOR/OR grouping key, not necessarily a FeatureGroup ID.
    const group = f.parentGroupId ?? (p.featureGroups?.some(g => g?.id === f.groupId) ? f.groupId : undefined);
    if (group) b.edge(ref("featureGroup", group), n, "containsFeature", `Project.features[${f.id}].${f.parentGroupId ? "parentGroupId" : "groupId"}`);
  });
  b.each(p.featureGroups, "Project.featureGroups", g => {
    const n = b.node(ref("featureGroup", g.id), g.name, `Project.featureGroups[${g.id}]`, {}, g.description);
    if (g.parentFeatureId) b.edge(ref("feature", g.parentFeatureId), n, "containsFeatureGroup", `Project.featureGroups[${g.id}].parentFeatureId`);
    if (g.parentGroupId) b.edge(ref("featureGroup", g.parentGroupId), n, "containsFeatureGroup", `Project.featureGroups[${g.id}].parentGroupId`);
  });
  b.each(p.variabilityAxes, "Project.variabilityAxes", a => {
    const n = b.node(ref("variabilityAxis", a.id), a.name, `Project.variabilityAxes[${a.id}]`, {}, a.description);
    b.edge(n, ref("featureGroup", a.featureGroupId), "organizesFeatureGroup", `Project.variabilityAxes[${a.id}].featureGroupId`);
  });
  b.each(p.featureConstraints, "Project.featureConstraints", c => {
    if (c.type !== "requires" && c.type !== "excludes") { b.warn("SG-PRED-CONSTRAINT", "Unknown feature constraint.", c.id); return; }
    b.edge(ref("feature", c.sourceFeatureId), ref("feature", c.targetFeatureId), c.type === "requires" ? "requiresFeature" : "excludesFeature", `Project.featureConstraints[${c.id}]`, { type: "typedReference", ownerId: c.id, field: "sourceFeatureId / targetFeatureId" }, { constraintId: c.id });
  });
  b.each(p.variationPoints, "Project.variationPoints", v => {
    const path = `Project.variationPoints[${v.id}]`;
    const n = b.node(ref("variationPoint", v.id), v.name, path, { kind: v.kind, enabled: v.enabled, expression: v.featureExpression, conditions: v.featureValueConditions, propertyPath: v.propertyPath, valueRules: [...v.valueRules].sort((a,b) => a.id < b.id ? -1 : 1), realizationScopes: v.realizationScopes, affectedRelationshipIds: [...v.constrainedRelationshipIds].sort() }, v.description);
    for (const id of v.constrainedElementIds) b.edge(n, er(id), "affectsElement", `${path}.constrainedElementIds[${id}]`);
    for (const id of v.constrainedRelationshipIds) if (!p.relationships.some(r => r.id === id)) b.warn("SG-REF-VP-RELATIONSHIP", `Target relationship ${id} is unavailable.`, path);
    const expressions = [{ id: "activation", featureExpression: v.featureExpression, featureValueConditions: v.featureValueConditions }, ...v.valueRules];
    b.each(expressions, `${path}.expressions`, rule => {
      const ids = [...new Set([...parseFeatureExpression(rule.featureExpression).featureIds, ...rule.featureValueConditions.map(c => c.featureId)])].sort();
      for (const id of ids) b.edge(ref("feature", id), n, "conditionsVariationPoint", `${path}.expressions[${rule.id}][${id}]`, { type: "parsedExpression", ownerId: v.id, field: rule.id, referencedIds: ids }, { expression: rule.featureExpression, conditions: rule.featureValueConditions, enabled: v.enabled, activationAsserted: false });
    });
  });
  b.each(p.configurations, "Project.configurations", c => {
    const n = b.node(ref("configuration", c.id), c.name, `Project.configurations[${c.id}]`, { featureValues: c.featureValues, validationStatus: c.validationStatus, derivationId: c.derivation?.id }, "", c.validationStatus);
    b.edge(n, ref("architecture", c.architectureId), "configuresArchitecture", `Project.configurations[${c.id}].architectureId`);
    for (const id of c.effectiveSelectedFeatureIds) b.edge(n, ref("feature", id), "selectsFeature", `Project.configurations[${c.id}].effectiveSelectedFeatureIds[${id}]`);
    // A live index exposes frozen evidence identity only. Open its context for realized topology.
    if (c.derivation) {
      const d = c.derivation;
      const rn = b.node(ref("realization", d.id, c.id), `Realization ${d.id}`, `Project.configurations[${c.id}].derivation`, { referenceOnly: true, sourceModelRevision: d.sourceModelRevision, timestamp: d.timestamp, evidenceContext: { type: "derivation", configurationId: c.id, derivationId: d.id } });
      b.edge(n, rn, "derivesRealization", `Project.configurations[${c.id}].derivation.id`);
      b.edge(rn, ref("architecture", d.sourceArchitectureId), "derivedFromArchitecture", `Project.configurations[${c.id}].derivation.sourceArchitectureId`);
    }
  });
}
