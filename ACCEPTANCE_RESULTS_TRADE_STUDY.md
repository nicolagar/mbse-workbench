# Architecture Trade Study Acceptance

Candidate version: 1.1.0

Project schema: 6

Source baseline: `agent/stage-c-comparison-delivery_V02` at `745996509d98e33c793cf39de0fbfd90fad89f4b`

Preparation branch: `agent/trade-study-methodology`

## Automated gate

| Check | Result |
|---|:---:|
| Clean install with Node.js 24.14.0 / npm 11.9.0 | PASS |
| Production dependency audit | PASS — 0 vulnerabilities |
| Full dependency audit | PASS — 0 vulnerabilities |
| Strict TypeScript | PASS |
| Full regression suite | PASS — 118/118 tests across 5 files |
| Production build | PASS |
| Changed-file whitespace | PASS |

The production build retains Vite’s non-blocking large-chunk advisory. No mandatory implementation placeholder remains in the application source. Manual acceptance is intentionally still pending.

## Manual Codespaces acceptance — PENDING

Do not publish the implementation commit, create a pull request, or merge before this checklist passes.

1. Create a Codespace on `agent/trade-study-methodology`.
2. Before uploading the candidate, confirm the branch and clean accepted baseline:

```bash
git branch --show-current
git rev-parse --short HEAD
git status --short
```

Expected branch: `agent/trade-study-methodology`. Expected commit: `7459965`. The initial status must be empty.

3. Upload the supplied candidate ZIP into the repository root, overlay it while preserving `.git`, and move the ZIP out of the checkout:

```bash
unzip -o mbse-mbple-workbench-prompt2-v1.1.0-candidate.zip -d .
mv mbse-mbple-workbench-prompt2-v1.1.0-candidate.zip /tmp/
```

4. Run the automated gate:

```bash

nvm use
node --version
npm --version

npm ci
npm audit --omit=dev
npm audit
npm run typecheck
npm run test
npm run build
git diff --check
git status --short

npm run dev
```

5. Open forwarded port 5173 and verify:

   - Existing projects migrate to schema 6 without reset, loss, or duplicated objectives.
   - Dashboard objective edits change first-class objective records and KPI objective mappings persist.
   - The 23-step **Model Definition and Validation** workflow still opens its contextual views.
   - **Architecture Trade Study** is a separate workspace with the saved sample study.
   - Guided Workflow shows ten steps and supports non-linear navigation.
   - Framing edits the question, intended outcome, lifecycle/system scope, originating open decision, objectives, mandatory requirements, criteria, and explored features.
   - Candidate creation supports first, duplicate, and different candidates with paired configuration/architecture records.
   - Readiness reports configuration, validation, 100% derivation, model revision, configured simulation, and required KPI coverage, with useful navigation for blocked items.
   - Manager view excludes non-ready evidence and refuses to analyze fewer than two ready candidates.
   - Mixing a 150% architecture-only alternative with configured 100% evidence produces the explicit comparability warning.
   - Existing side-by-side, KPI, charts, risks, sensitivity, immutable evidence, coverage, and threshold behavior still works.
   - A formal Decision is created only after analysis; approval is blocked without rationale and, when approved, resolves the originating open question and establishes the selected baseline architecture.
   - Expert **Digital Thread** renders the read-only grouped ontology, node detail, controls, and exact relationship table without changing canonical model relationships.
   - Complete JSON round-trips with stable new references; invalid references are rejected without changing the active project.
   - XLSX opens without repair warnings and contains framing, criteria, candidate readiness, open-decision, KPI-objective, ID, unit, coverage, and manifest data.
   - PDF opens without clipped content and contains framing, scope, criteria, readiness, evidence, decision, risks, baseline, headers/footers, and the preliminary-estimate disclaimer.
   - Refresh preserves the Trade Study, view selection, candidate membership, decisions, and baseline.
   - Desktop, icon-rail, and mobile navigation expose the renamed workflows without clipping primary controls.

6. Report either:

```text
Prompt 2 automated checks: PASS
Prompt 2 manual acceptance: PASS
```

or list the exact failed item, browser, viewport, and reproduction steps.
