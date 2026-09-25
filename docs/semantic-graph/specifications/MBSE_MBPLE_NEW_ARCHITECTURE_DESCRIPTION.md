# MBSE–MBPLE Workbench: Semantic-Projection Architecture

## Document authority

This architecture is tied to repository `nicolagar/mbse-mbple-workbench`, branch `04_updated_ontology_v03`, commit `37c6270416a88186d1d9b22f4d09d5afe211e5d3`, application 1.8.0, schema 14.

It must be used with:

- `CURRENT_CODE_DOMAIN_INVENTORY_04_UPDATED_ONTOLOGY_V03.md`
- `SEMANTIC_PREDICATE_NODE_MAPPING_REGISTER.md`
- `SEMANTIC_GRAPH_DETERMINISM_PROVENANCE_HISTORY_FAILURE_SPEC.md`
- `SEMANTIC_GRAPH_FEATURE_FLAGGED_PARALLEL_ROLLOUT.md`

If the branch head changes, revalidate the inventory before implementation.

## Goal

Provide one precise, directional and machine-readable project digital thread across modelling, MBPLE, simulation, Trade Study and Decision evidence without changing operational behaviour, persistence or existing pages until parity is proven.

## Governing invariant

> Authoritative domain records produce the Semantic Graph. The Semantic Graph never becomes an alternate execution or persistence path.

```text
Schema-14 Project and immutable evidence
  ├─ ModelElements and Relationships
  ├─ typed references and embedded records
  ├─ Features, constraints and Variation Points
  ├─ Configurations and DerivationResults
  ├─ Simulation snapshots/results
  └─ Studies, risks, Decisions and evidence snapshots
                         ↓ pure projection
Registry → adapters → Semantic Graph → traversal/diagnostics
                         ↓ read only
Digital Thread UI · schema view · inspectors · semantic export · future AI
```

Requirement assessment, configuration validation, Variation Point application, derivation, KPI calculation, simulation, comparison, Decision approval, baseline mutation, persistence and import/export remain graph-independent.

## Architectural components

### Registry

`ontologyRegistry.ts` is the only semantic vocabulary authority. It defines node kinds, predicates, valid endpoints, role, authoritative source, display labels, inverse navigation labels and external mappings. It references `allowedRelationships`; it does not duplicate operational validation.

### Graph model

`semanticGraphTypes.ts` contains closed unions and immutable structures. Every edge has context, role, predicate, provenance and authority locator. Baseline is an Architecture lifecycle state, not a node.

### Adapters

Pure, isolated adapters cover model relationships; Parameters/formulas; architecture/scope; feature/group/axis/constraint; Variation Points; configuration/realization; simulation/KPI evidence; Trade Study/criteria/alternatives/results; risks/Decision/baseline; and historical snapshots.

Each returns nodes, edges and diagnostics. One malformed record produces partial output, not application failure.

### Builder and query layer

`buildSemanticGraph(project, options)` calls adapters in fixed order, resolves endpoints, merges duplicates, sorts deterministically and returns graph, diagnostics, completeness and fingerprint. It performs no mutation and writes nothing to the store.

Traversal provides node lookup, neighbours, filtered upstream/downstream traversal, canonical paths, evidence lookup and provenance explanation. Inverse traversal never creates or persists reversed relationships.

### Diagnostics

Semantic diagnostics cover references, identity, predicate endpoints, context integrity, canonical continuity, baseline consistency, build failure and parity. They are non-blocking and separate from `Project.validationResults` in release 1.

## Authoritative ownership

One fact has one owner:

- model connections: `Project.relationships`;
- use-case subject: `metadata.subjectSystemId`;
- Parameter ownership: embedded Parameter and `ownerElementId`;
- architecture membership: `architectureId`/scope;
- Feature hierarchy/constraint: Feature records and constraints;
- VP transformation: Variation Point;
- selection: Configuration arrays/values;
- 100% realization: `DerivationResult`;
- evaluated historical model: Simulation input snapshot;
- study definition/results: Comparison Study;
- approved rationale: Decision/evidence snapshot;
- baseline: Project baseline ID plus Architecture status.

The graph projects these facts and never stores duplicate domain relationships.

## Architecture and Realization

Architecture remains the persisted design identity. Configuration selects variation for an Architecture. The embedded Derivation Result becomes a Semantic `realization` node representing one immutable 100% state.

```text
Configuration ─derivesRealization→ Realization
Realization ─derivedFromArchitecture→ Architecture
Variation Point ─contributesToRealization→ Realization
Realization ─evaluatedBy→ Simulation Run
```

Do not label a candidate Architecture as a 100% realization and do not create an Architecture for every Derivation.

## Parameters and requirement evidence

Parameters are Semantic Nodes because they are stable embedded records used by requirement formulas, KPIs, VPs, simulations and risk applicability. They remain embedded operationally.

Requirement status is projected as evidence from current assessment or frozen evidence. The graph never modifies or replaces assessment logic.

## Variability

The Feature Model is one virtual Project node. Features, Groups and Axes remain real domain records. Feature constraints use role `constraint`. VP expressions are parsed with the existing safe parser and may reference several Features. VP targets may be any supported element kind; affected relationship IDs are represented through semantic-edge provenance metadata rather than making every relationship a normal node.

## Evidence and history

Contexts are live, derivation, simulation and decision. Historical adapters prefer frozen records. Current records may supply display-only fallback labels and must be marked. Missing references create diagnostics/unresolved placeholders in Full/Diagnostics view only.

Live state and historical evidence are never merged silently.

## Trade Study, Decision and baseline

Study Criteria are embedded Semantic Nodes. Candidates and Alternatives are distinct roles. Alternatives reference exact Architecture, optional Configuration and Simulation Run. Comparison Results remain immutable evidence.

Decision selection is resolved only inside supporting Studies: alternative ID first, then exact label, requiring exactly one result. `selectsArchitecture` is projected only when selection and evidence are unambiguous. Baseline consistency is checked but never repaired by the graph. No Baseline node is created.

## Presentation architecture

The Scope Ontology workspace evolves additively:

1. Existing Schema Graph.
2. Existing Connection Register.
3. New Project Digital Thread beta.
4. Later registry-driven Schema beta.

The new graph preserves orthogonal routing, multiple ports, label toggles without geometry movement, zoom, pan, stage focus, search, inspector and responsive behaviour.

`ModelGraph` remains the engineering editor. The editable Traceability Matrix remains unchanged. A heterogeneous semantic matrix is read-only. Architect View retains its authoring/reveal graph until semantic parity is proven.

## Feature flags and compatibility

Every UI adoption is independently flagged outside Project data. All flags initially default off. Failure falls back to the preserved legacy view. Rollback requires no data migration because schema 14 is unchanged.

## Semantic export and AI

Semantic JSON is a new independent export containing ontology version, source commit/schema, nodes, edges, contexts, provenance and diagnostics. Native JSON/XLSX/PDF and import remain unchanged.

Future AI receives read-only lookup, trace and evidence operations first. Future mutations must call existing domain/store commands and validators; AI cannot edit graph edges.

## Quality attributes

- deterministic IDs and ordering;
- zero Project mutation during build/view;
- partial graph on recoverable defects;
- exact frozen historical context;
- no schema migration in release 1;
- feature-flag rollback;
- identical operational outputs;
- stable narrow-screen and keyboard behaviour;
- reusable, versioned exchange surface.

## Completion definition

The architecture is complete when Coffee and OHSC expose a coherent Mission-to-baseline thread, every new consumer passes parity gates, all existing regressions remain green, saved Project serialization remains unchanged by graph viewing, and each legacy page remains available until explicitly accepted.
