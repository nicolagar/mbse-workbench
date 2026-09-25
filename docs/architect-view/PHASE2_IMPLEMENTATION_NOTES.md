# Architect View Phase 2 — Implementation Notes

Phase 2 implements the guided **Parameters, KPIs and simulation** section (AV-I01 through AV-I12) on top of the Phase 1 architecture model.

## Scope behavior

- Architecture definition: Phase 2 questions are not shown.
- Architecture and simulation: Phase 2 follows the traceability recap.
- Trade-off: Phase 2 follows the traceability recap and prepares analysis evidence for later variability/comparison phases.

## Main implementation choices

- Reuse the existing standard KPI algorithms, formula parser and simulation engine.
- Store exact parameter and KPI IDs in formulas while displaying readable owner/name choices.
- Create missing semantic inputs as canonical parameters owned by a selected function or technical component.
- Require explicit value, unit, source and origin; uncertainty is optional and no hidden numerical default is introduced.
- Store successful simulation evidence immutably and keep failed execution on the run question with targeted messages.
- Treat reviews and evidence storage as revision-neutral; calculation-affecting answers still advance model revision and stale older runs.

## Verification summary

- 6 Phase 2 tests passed.
- 177 total regression tests passed.
- TypeScript validation passed.
- Production build passed.

See [`../../internal/ACCEPTANCE_RESULTS_PARITY_CONSOLIDATION.md`](../../internal/ACCEPTANCE_RESULTS_PARITY_CONSOLIDATION.md) for the current integrated Architect/Modeler acceptance record.

This package is not deployed. Phase 3 variability/configuration work is intentionally excluded.
