# Graph Readability Specification — V10

## Scope and presentation-only invariant

This specification applies to Model workspace graphs, product and process function-sequence graphs, the Variability workspace Variation Points graph, editable 150% Product-Line Model, read-only 100% realization, Feature Model, and Configurator Feature Model.

Every behavior in this document is a presentation projection. It does not create, remove, reverse, reinterpret, or persist canonical relationships. It does not change the ontology, `ModelElement`, relationship or feature semantics, variation points, configuration or derivation logic, `modelRevision`, architecture filtering, or the persistence schema.

## Presentation availability

| Surface | Available presentation |
| --- | --- |
| Model workspace | Workflow overview and Full graph |
| Product/process function sequence | Full graph only |
| Variation Points graph | Full graph only |
| Editable 150% Product-Line Model | Full graph only |
| Read-only 100% realization | Full graph only |
| Feature Model | Full graph only |
| Configurator Feature Model | Full graph only |

Element focus, Hierarchy overview, and the Variability Workflow overview are removed. Surfaces with only one presentation do not show a presentation selector.

## Model Workflow overview

The Workflow overview is a fixed semantic map intended to communicate modeled scope and canonical engineering flow without requiring canvas navigation.

### Semantic layout constraints

- Mission and System of Interest are selectable areas at the top.
- The continuous, horizontally scrollable upper flow is: Context → Objectives and needs → Use cases → Product functions → Product components and product interfaces → Process functions → Industrial-system components and process interfaces → Resources → Verification methods.
- Requirements occupy a separate lower flow.
- Product interfaces share the Product components area.
- Process interfaces share the Industrial-system components area.
- Cards are ordered deterministically by cross-area connection degree, then name and ID as tie-breakers.
- Normal laptop presentation scrolls horizontally instead of shrinking cards to an unreadable scale.

These areas are presentation groups only. They do not alter an element's canonical type or any engineering relationship.

### Selection and traversal

- No connector is shown before the user makes a selection.
- Clicking a card toggles it as a direct seed and reveals only its directly incident eligible connectors.
- `← select` recursively follows canonical incoming relationships to the complete upstream closure.
- `select →` recursively follows canonical outgoing relationships to the complete downstream closure.
- Area controls provide `← all`, `Select all`, and `all →` with the same semantics for every card in the area.
- Multiple seeds combine by union. Traversal is cycle-safe and deterministic.
- Direct seeds use strong green styling and a checked corner marker. Transitively reached cards use lighter green styling without the marker. Unrelated cards stay visible but faded, and unrelated connectors are hidden.
- Clicking any directly selected card removes all traversal seeds for that card and recalculates the union.
- `Clear selection` removes every seed.
- Selection is retained while navigating workspaces or switching between Workflow overview and Full graph in the current project. It is cleared by the Clear action, page reload, or project change.
- Primary structure is the default. Switching to All relationships preserves seeds and recalculates the closure against the newly eligible connectors.

### Relationship visibility

- Only relationships whose source and target belong to different Workflow areas are eligible for overview display and traversal.
- Relationships within one area, including function `precedes` and requirement `refines`, remain available in Full graph or function-sequence views but are excluded from the Workflow overview.
- Overview relationships show connectors and canonical arrow direction only. Names, labels, label-expand controls, and relationship text are intentionally absent.

### Interaction and fullscreen

- Single-click selection never opens element properties, a definition menu, or another presentation.
- Full screen uses the browser Fullscreen API when available and an in-page overlay fallback otherwise. Entering full screen fits the complete overview; Escape exits native fullscreen.
- Fullscreen and overview selection do not mutate model data or stored graph positions.

## Model and Variability Full graph — restored V04 behavior

Full graph behavior is intentionally isolated on the latest V04 graph implementation:

- non-sequence engineering direction is top-to-bottom;
- every visible element type occupies its V04 semantic band;
- sequence stages run left-to-right;
- ELK determines stable ordering, after which V04 band placement and connector lanes are applied;
- V04 source/target handles, relationship labels, automatic fit behavior, zoom limits, and manual-position behavior are retained;
- Primary structure, All relationships, and Selected element relationship views remain available in Model Full graph and reuse one layout request;
- automatic node coordinates do not change when the relationship view or local selection changes;
- single click selects/highlights locally only; double click retains the existing edit/inspect callback behavior;
- stored manual positions are read and written through the existing fields without migration.

The earlier V05 independent-port and occupancy-aware routing behavior is removed from Model and Variability Full graph because the requested reference behavior is V04. This changes drawing only and leaves canonical source, target, relationship kind, and model semantics untouched.

### 150% and 100% spatial behavior

The V05 rule that a 100% realization inherits the 150% layout reference is removed. The 150% preview and 100% realization now each use V04 Full graph layout independently. Therefore a 100% graph may compact after excluded elements disappear, matching V04 behavior. Derivation results and removed/modified statuses remain unchanged.

## Feature Model and Configurator Full graph — retained V05 behavior

Feature Model and Configurator retain the V05 routed Full graph and share the same base geometry:

- root remains at containment depth zero;
- recursive containment depth is authoritative and parents precede children;
- organizational FeatureGroups remain in the containment hierarchy;
- siblings are ordered deterministically with connection-aware layout and stable tie-breakers;
- requires/excludes participate in base routing but are hidden by default;
- edge-specific stable ports prevent high-degree relationships from sharing one endpoint;
- automatic and manual layouts use deterministic orthogonal, node-avoiding routes;
- unrelated relationships avoid coincident collinear segments wherever geometry permits;
- outer lanes are a fallback and receive independent occupancy-aware channels;
- relationship names are hidden by default behind a midpoint `+` control; expanding a label does not alter node or route geometry;
- Configurator selection styling uses the same card dimensions and node coordinates as Feature Model;
- feature selection is local on single click and invokes the existing details callback only on double click.

### Edge overlap and edge crossing

For retained V05 Feature graphs, edge overlap and crossing remain distinct concerns. Edge overlap is a meaningful shared collinear segment and is prevented through separate ports and occupied-channel checks. Edge crossing is a point intersection and is minimized through ordering and orthogonal routing, but may remain when required by topology.

## Layout stability and determinism

- Equal nodes, relationships, dimensions, layout mode, and implementation version produce equal automatic coordinates and routes.
- No random layout behavior is used.
- Relationship filtering and local selection do not rerun the active Full graph layout.
- Workflow overview selection changes visibility and connector closure without changing Full graph geometry.
- Configurator choices change feature state styling without moving the Feature graph.
- Auto-arrange is the explicit action that requests a new automatic calculation.
- Adding/removing nodes or changing measured card dimensions may legitimately recalculate automatic geometry.
- Manual positions are preserved and are never silently overwritten by Auto-arrange.

## Rules removed or relaxed

| Previous rule | New rule | Why the change is safe |
| --- | --- | --- |
| Model/Variability Full graph uses V05 semantic regions and independent-port routing | Restore the complete V04 Full graph presentation | Layout and routing are projections; canonical records are unchanged |
| 100% nodes retain corresponding 150% coordinates | 100% is independently compacted by V04 layout | Derivation membership/status is unchanged; only displayed coordinates differ |
| Model Element focus presentation | Removed | Selection still highlights locally and double-click editing remains |
| Variability Workflow overview and Element focus | Removed | Full graph continues to show the same engineering data |
| Feature Hierarchy overview and presentation selector | Removed; V05 Full graph retained | Containment depth and feature semantics remain authoritative in the retained graph |
| Same-area relationships participate in Workflow overview | Excluded from overview display and traversal | They remain canonical and visible in the appropriate Full graph/sequence view |
| Overview relationship labels | Connector-only overview | Relationship identity remains available in Full graph; overview prioritizes rapid path recognition |

## Regression acceptance

Automated coverage must verify:

- V04 deterministic layout and exact semantic-band behavior for Model/Variability Full graph;
- stable Model coordinates across Primary, All, and Selected element relationship modes;
- single click does not open Model or Feature editors;
- no Workflow overview or presentation selector on Variability graphs;
- no Hierarchy overview or presentation selector on Feature graphs;
- independent V04 compaction of a 100% realization;
- deterministic Workflow area assignment and canonical upstream/downstream traversal;
- exclusion of same-area relationships from overview display and traversal;
- no connectors before overview selection and no relationship labels in overview;
- overview selection persistence across presentation navigation and explicit clearing;
- V05 deterministic Feature layout, containment depth, distinct ports, node avoidance, and non-coincident routes;
- Feature Model/Configurator coordinate equality;
- manual-position preservation;
- unchanged canonical relationship endpoints.

Browser screenshot review should be performed when an executable browser is available. When it is unavailable, component and geometry regression tests are the acceptance evidence and no visual-verification claim is made.
