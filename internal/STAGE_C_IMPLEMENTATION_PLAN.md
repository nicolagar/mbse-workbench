# Stage C implementation plan

This plan maps Prompt C and the two completed decision grills onto the verified
Stage-B REV04 baseline. Stage-A and Stage-B behavior remains regression scope.

## Persistence and migration

- Advance persisted-app and project schema from 4 to 5.
- Add a pure, idempotent 4-to-5 migration while retaining migrations from
  schemas 1–3.
- Convert any singular comparison result into immutable result history.
- Move legacy project-nested snapshots to application-level snapshots without
  recursive `projectData`.
- Preserve IDs, derivations, runs, validation data, applied variations, and
  invalid raw recovery data.
- Keep engineering `modelRevision` independent from comparison, risk, decision,
  snapshot, and delivery-record edits.

## Domain engines

- Add deterministic comparison validation, exact run/KPI matching,
  normalization, weighted scoring, data coverage, thresholds, ties, staleness,
  and one-factor-at-a-time weight sensitivity.
- Retain immutable comparison result history.
- Add snapshot validation, creation, restore safety, duplication, limits, and
  corrupt-snapshot recovery.
- Add selective export filtering and referential closure, JSON package
  validation/import, XLSX workbook generation, and PDF report generation.
- Add deterministic dashboard rollups and recommended actions.

## Canonical store

- Extend the existing Zustand store only; do not create a second store.
- Add study, risk, decision, snapshot, import, and export actions.
- Protect historical evidence from destructive deletion.
- Keep planning questions separate from formal decisions and support explicit
  promotion to a linked draft.
- Preserve the active project ID during replacement import.

## User interface

- Replace Stage-C placeholders with Comparison and Export workspaces.
- Implement all seven comparison tabs, saved-result history, charts,
  sensitivity table, risks, and decision workflow.
- Add explicit architecture-only simulation against the canonical 150% model.
- Add snapshot management in Export and a Dashboard quick action.
- Add JSON/XLSX shared selection scope and a separate PDF report scope.
- Make the shell responsive through full sidebar, icon rail, and mobile drawer.
- Add semantic labels, focus visibility, textual chart summaries, and
  non-colour status indicators.

## Sample and delivery

- Complete the sample with manual and automated runs, one comparison, threshold
  violation, risks, sensitivity, draft decision, and one application snapshot.
- Pin `xlsx` and `jspdf` to verified exact versions.
- Update README, changelog, package metadata, and acceptance record.

## Verification

- Preserve and run all Stage-A and Stage-B tests.
- Add Prompt-C migration, comparison, sensitivity, snapshot, import/export,
  XLSX, PDF, store, and focused UI tests.
- Run `npm install`, `npm run typecheck`, `npm test -- --run`, and
  `npm run build` until all pass.
