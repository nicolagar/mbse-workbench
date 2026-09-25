# Architect/Modeler documentation acceptance

Target branch: `03_Architect_view_v01`  
Application: v1.5.3 / schema 9  
Documentation date: 4 September 2026

## Scope audited

- Perspective selection and both application frames.
- All scope and conditional question definitions in `src/domain/architectView.ts`.
- Architect progress, guidance, impact-review and completion behavior in `src/components/ArchitectView.tsx`.
- Modeler navigation and dashboard workflow routing.
- Existing First Use, Expert Use and Full Guide content and hierarchy.

## Updated documentation

- README introduction and guide links.
- Manager and Expert manual acceptance checks.
- Phase 2/3 acceptance-record links and Phase 4 guide statement.
- Maintained Architect/Modeler answer reference.
- Three static PDF guides with a one-page introduction and appended indexed answer handbook.

## PDF verification gates

| Gate | Expected |
|---|---|
| Format | Three readable A4 PDFs under `docs/guides/`. |
| Introduction | One page only; goal, two perspectives, page structure and three scopes explained in plain language. |
| Architect coverage | AV-A/B/C/D/T/E/F/G/H/I/J/K/S/L/M question groups explain user input and canonical effect. |
| Modeler coverage | Dashboard, direct workspaces, synchronization and safe-edit behavior explained. |
| Existing content | Prior guide pages, screenshots, formulas, workflows and reference sections preserved. |
| Navigation | Existing bookmarks/links retained; new handbook index links and bookmarks resolve to valid pages. |
| Rendering | Every page rendered with Poppler and visually checked for clipping, overlap and unreadable text. |
| Structural validity | `pdfinfo`, text extraction and PDF object/link inspection complete without invalid destinations. |

## Results

- `npm ci`: PASS - 332 packages installed from the existing lockfile.
- `npm test -- --run`: PASS - 15 files, 205/205 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS - 2,133 modules transformed.
- `git diff --check`: PASS.
- Markdown relative-link check: PASS - no missing targets.
- PDF metadata/text checks: PASS - 32-page First Use, 31-page Expert Use and 100-page Full Guide, all A4.
- PDF outline/link check: PASS - 250 valid outline destinations and 440 valid internal link annotations across the three files; no invalid destinations.
- Poppler render and visual inspection: PASS - every preserved page and all final cover/handbook pages checked; no clipping, overlap or unreadable layout found.
