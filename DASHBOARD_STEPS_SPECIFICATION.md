# Dashboard Steps Specification

## Trade Study scope

The Dashboard derives every status from canonical project data. Users may open blocked activities, but invalid completion actions remain blocked. The persisted active Trade Study drives Problem Space Step 3 and Solution Space Step 7.

### Problem Space

| Step | User activities | Completion result |
|---|---|---|
| 1. Define system and intent | Designate exactly one System of Interest. Create relevant stakeholders, needs and measurable objectives. Connect stakeholders to their needs and objectives. | One System of Interest and at least one need and objective exist. |
| 2. Define use-case and requirement scope | Create use cases and select the active working scope. Derive system requirements from relevant needs and objectives. Define formulas, limits and units needed for compliance. | At least one active use case and one traceable requirement exist. |
| 3. Define trade study, variability axes and evaluation KPIs | Create or select the active Trade Study; enter its decision question; select existing needs, objectives and active use cases; review automatically derived requirements; link the shared Root Feature; select reusable variability axes; create or edit only the canonical KPIs needed for comparison. | The complete traceable study scope exists, one shared Root Feature is linked, at least one valid axis/FeatureGroup is selected, every selected KPI is valid and objective-linked, and at least one selected KPI has positive weight. |

Each project has one shared Root Feature and a reusable variability-axis catalogue. Each axis owns one synchronized major FeatureGroup. Existing FeatureGroups require explicit adoption; migration never guesses their meaning.

### Solution Space

| Step | User activities | Completion result |
|---|---|---|
| 1. Build the 150% architecture | Define functions required by selected use cases. Create realizing architecture elements and the relationships, parameters, processes and resources needed for requirement and KPI evaluation. Include common and variable solution content. | Selected use cases trace to functions; required functions are realized; the reusable architecture contains the intended alternatives. |
| 2. Define the feature model and constraints | Starting from the Root Feature and major FeatureGroups, create mandatory, optional, XOR or OR features. Define hierarchy and any required `requires` or `excludes` constraints. | Selectable features exist and no feature-model or constraint errors remain. An explicit cross-feature constraint is optional. |
| 3. Map variability to architecture | Map features or feature expressions to architecture elements, relationships or property values. | At least one valid mapping exists and every reference resolves. |
| 4. Create valid configurations | Create at least two named configurations, select feature choices and values, validate and correct violations. | At least two distinct configurations are valid. |
| 5. Derive 100% architectures | Transform each valid configuration, review the result and save the derivation. | At least two current saved derivations exist without transformation errors. |
| 6. Simulate architectures | Run the same selected KPI set on each current 100% architecture and save each run. | Every alternative has a current complete numeric simulation result for every selected KPI. |
| 7. Compare and decide | Select configuration-derived alternatives, run requirement-feasibility and weighted-KPI comparison, review Manager or Expert evidence, choose a feasible alternative and record rationale. | A current comparison exists and one feasible alternative has an approved, traceably linked decision. |

Changing selected scope, axes or KPI definitions preserves immutable historical evidence but marks downstream results stale. Comparison and approval remain blocked until affected evidence is refreshed.
