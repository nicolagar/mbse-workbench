# Architect View - Phase 4 acceptance

Branch: `03_Architect_view_v01`  
Base branch: `02_Rework_fix_v01`  
Application schema: 9

## Delivered behavior

- Existing v1.5.3 projects open unchanged when no Architect session exists.
- Incomplete or older Architect sessions are normalized on load. Missing answer arrays, section state, parameter intents and stale question keys no longer prevent the project from opening.
- The session resumes at its stored current question when that question still exists; otherwise it opens the first incomplete applicable question.
- Architect and Modeler perspectives operate on the same project. A Modeler-side domain edit marks only dependent confirmed answers for review and sets the Architect session to Out of date; unrelated documentation edits leave guided evidence confirmed.
- The completion page is recomputed from the current canonical project and uses green, amber or red status according to reviewed readiness, pending/warning evidence, and failed/blocking evidence. It never asks the user to refresh the overview.
- Skip remains an explicit, untimed action. It records a visible gap and never advances automatically.
- Final recap pages are scope-dependent:
  - Architecture definition: overview, stakeholder traceability, architecture and requirements.
  - Architecture and simulation: the four shared recaps plus simulation evidence.
  - Trade-off study: all shared and simulation recaps plus comparison and baseline evidence.
- The mobile progress panel is removed from keyboard navigation while closed, reports its expanded state, and closes with Escape.
- Question headings receive focus after navigation. The change-impact dialog receives initial focus, closes with Escape and returns focus to Continue.

## Automated acceptance

The Phase 4 regression tests cover:

1. Migration of an existing schema-9 coffee-machine project with no Architect session.
2. Recovery from an incomplete session with missing generated-reference arrays and a removed current question.
3. Scope-specific M01-M06 recap branching.
4. Dependency-based Modeler-to-Architect review synchronization, including current-value projection and harmless-edit preservation.
5. Untimed Skip text and absence of timer/countdown content.
6. Progress drawer ARIA state, Escape behavior and question-heading focus.
7. Existing Phase 1-3 coffee-machine modeling, KPI, simulation, variability, derivation, comparison and baseline regressions.

The production gate is:

```text
npm test
npm run typecheck
npm run build
```

## Responsive and device verification

Automated component checks verify the narrow-screen drawer structure and keyboard behavior. Final physical-device verification should be performed after a preview of this branch is available:

| Environment | Widths | Checks |
|---|---:|---|
| Chrome on ChromeOS | 1366 px and available narrow window | Perspective dialog, question fields, progress drawer, tables, impact dialog, recap pages |
| Edge on Windows 11 | 1920 px and 1280 px | Same checks plus keyboard-only navigation and browser zoom at 200% |

Acceptance requires no horizontal page overflow, no clipped controls, readable question options, a keyboard-reachable Continue/Skip pair, and a closed progress drawer that cannot receive focus.

## Guide updates

The versioned [Architect and Modeler user guide](../user-guides/ARCHITECT_MODELER_GUIDE.md) explains the two synchronized perspectives and every scope-dependent Architect question group, including what an unfamiliar user should enter and what canonical content each answer changes. The repository also contains refreshed, indexed [First Use, Expert Use and Full PDF guides](../guides/README.md). Each PDF preserves the established guide content, replaces its cover with a one-page plain-language introduction and adds the current answer handbook with clickable PDF bookmarks.
