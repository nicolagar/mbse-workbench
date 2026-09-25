# Graph Readability Specification — V07

## Scope

This specification applies to every React Flow surface in the workbench:

- Model section graphs
- Product and process function sequences
- Variation-point targeting graphs
- Editable 150% Product-Line Model
- Read-only 100% realizations
- Feature Model and Configurator graphs
- Legacy Expert Trade Study ontology

The layout is a presentation projection only. It does not create, remove or reverse canonical model relationships.

## Layout rules

### Non-sequence Model graphs

- Direction is top to bottom.
- Every visible element type occupies one labelled semantic band.
- The highest available root concept is centered in the first band; Mission is the root of the complete model overview.
- Nodes in the same type band share the same vertical origin.
- Empty semantic types are omitted so the graph remains compact.
- Same-type refinement links remain canonical and use same-band connector lanes.

### Function sequences

- Direction is left to right.
- Each topological sequence stage occupies one labelled vertical band.
- Parallel functions remain in the same stage.
- Use-case and requirement context appears before sequence stages; technical/evidence context follows them.

### Feature Models

- Root features occupy the top band.
- Features and organizational FeatureGroups are placed by recursive containment depth.
- Containment is the primary tree.
- Requires and excludes constraints are secondary cross-links and are hidden by default.

### Trade Study ontology

- The diagram follows Open decision → Trade Study → problem-space scope → variability/configurations → architectures → evidence → Decision/Baseline.
- Node color identifies engineering, variability, evidence or decision domain.
- Semantic kind, not domain color, determines vertical position.

## Connector rules

- Primary adjacent-level relationships use orthogonal paths in the space between bands.
- Long-range and secondary relationships use distinct outer connector lanes.
- Connectors terminate at the appropriate top/bottom or left/right side of a card.
- Direction is shown with an arrow; canonical source and target remain unchanged.
- Connector labels use an opaque background so lines do not obscure text.
- Automatic node dimensions and band spacing prevent cards from covering connectors.
- Every semantic card is rendered by a graph-specific custom node component.
- A `ResizeObserver` reports the rendered card dimensions to the layout owner; measured dimensions replace estimates in the next ELK layout request.
- Explicit incoming and outgoing handles exist on all four sides, and each edge binds to the handle matching its route direction.

## Interaction rules

- Automatic hierarchy is the default for non-sequence Model graphs.
- Manual mode preserves explicitly dragged coordinates.
- Auto-arrange recalculates deterministic automatic placement.
- Compact cards are the default; Detailed cards expose parameters, duration and tags.
- Primary structure is the default relationship view.
- All relationships exposes secondary traceability.
- Selected element isolates immediate relationships and fades unrelated cards.
- Feature constraints and ontology secondary links are explicit optional overlays.

## Acceptance conditions

- No two cards overlap in automatic layout.
- Types or stages align to their declared bands.
- Adjacent-level structural connectors run only through inter-band space.
- Long and secondary connectors use outer lanes instead of crossing intermediate cards.
- Feature containment depth is deterministic and cycle-safe.
- Direct component tests verify measured custom nodes and directional ports in the Feature Model and Trade Study ontology.
- Existing Manual graph positions and all canonical model records remain unchanged.
- TypeScript, regression tests and production build pass.
