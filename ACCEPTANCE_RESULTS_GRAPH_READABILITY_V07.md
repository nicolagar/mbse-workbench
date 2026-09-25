# Graph Readability V07 Acceptance Results

Candidate branch: `agent/dashboard-trade-study-simplification_V07`

Candidate version: 1.5.0

Project schema: 9 — unchanged

Date: 2026-08-12

## Automated gates

- Strict TypeScript: PASS
- Vitest and React Testing Library: PASS — 140/140 tests across 7 files
- Production build: PASS — 2,126 modules transformed; ELK emitted as a lazy `graph-layout` chunk
- Development-server startup and HTTP entry/module retrieval: PASS — application entry, layout module and bundled ELK worker-safe module retrieved over HTTP
- `git diff --check`: PASS

## Covered V07 contracts

- Top-down semantic type bands for non-sequence Model graphs.
- Left-to-right stage bands for product and process sequences.
- Root-to-leaf Feature Model containment hierarchy.
- Top-down Trade Study ontology evidence chain.
- ELK crossing-minimized ordering with deterministic fallback.
- Orthogonal adjacent connectors and outer lanes for long/secondary links.
- Compact/detailed Model cards and relationship visibility controls.
- Automatic hierarchy default with preserved Manual positions.
- No persistence or canonical relationship changes.

## Dependency audit

- Production dependencies: PASS — 0 vulnerabilities
- Complete dependency tree: PASS — 0 vulnerabilities
- ELK layout engine: `elkjs@0.12.0`
- Security maintenance: `postcss@8.5.26`, `dompurify@3.4.13` and `nanoid@3.3.18`

## Manual gates

Manager browser acceptance: PENDING

Expert browser acceptance: PENDING

Verify at desktop and mobile widths:

- Mission-rooted cross-domain overview is readable top to bottom.
- Each Model section aligns same-type cards within labelled bands.
- Primary structure does not place connectors through cards.
- All relationships and Selected element views expose secondary traceability without losing context.
- Product/process sequences remain readable left to right with parallel stages aligned.
- Feature root, groups and child features follow containment depth; constraint overlay is optional.
- 150% and 100% graphs use consistent semantic placement for visual comparison.
- Expert Trade Study ontology reads as a top-down evidence chain.
- Zoom, pan, selection, edge inspection, relationship creation and Manual dragging remain functional.
