# Graphic Remodel V01 Acceptance Results

Candidate branch: `agent/graphic_remodel_V01`

Candidate version: 1.5.1

Project schema: 9 — unchanged

Date: 2026-08-12

## Implemented contracts

- Rendered Model, Feature and ontology cards use dedicated custom React Flow node components.
- Each custom node exposes explicit incoming and outgoing handles on its top, bottom, left and right sides.
- Hierarchical and sequence edges bind to the directional handle matching the route.
- Each card is observed through `ResizeObserver`; its unscaled DOM width and height feed the shared semantic ELK request.
- Feature Model and Trade Study ontology are covered by direct rendered-component acceptance tests.
- A focused measurement test verifies that DOM dimensions are reported to the layout owner.
- Canonical relationships, persisted Manual positions and schema 9 remain unchanged.

## Automated gates

- Strict TypeScript: PASS
- Vitest and React Testing Library: PASS — 143/143 tests across 8 files
- Production build: PASS — 2,128 modules transformed
- Dependency audit: PASS — 0 production and 0 complete-tree vulnerabilities
- Development-server entry and graph-module retrieval: PASS
- `git diff --check`: PASS

## Manual gate

Browser visual acceptance: PENDING

Verify that measured detailed cards reflow without overlap, explicit handles remain unobtrusive, connectors terminate at the intended side, and Feature/ontology graphs retain readable top-down bands at desktop and mobile widths.
