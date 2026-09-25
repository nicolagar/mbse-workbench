# Static user guides

These PDFs are kept in the repository, not removed, but their body pages still show application version 1.5.3, schema 9, as implemented on `03_Architect_view_v01`. For version 1.8.0 / schema 14 behavior, use the maintained [Architect and Modeler guide](../user-guides/ARCHITECT_MODELER_GUIDE.md) and [worked-example guide](../user-guides/EXAMPLES_GUIDE.md) - both are current.

- `MBSE_MBPLE_Workbench_First_Use_Guide_With_Clickable_Index.pdf` - plain-language guided use for new users.
- `MBSE_MBPLE_Workbench_Expert_Use_Guide_With_Clickable_Index.pdf` - operating semantics, evidence and completion guidance for experienced users.
- `MBSE_MBPLE_Workbench_Full_Guide_Hierarchical_Index.pdf` - complete reference for workspaces, fields, formulas, workflows and the Architect question catalogue.

## Update status

Each PDF has two parts: an original walkthrough body (screenshots and steps from v1.5.3) and an appended "Architect and Modeler answer handbook" generated from the current [`ARCHITECT_MODELER_GUIDE.md`](../user-guides/ARCHITECT_MODELER_GUIDE.md). The appended handbook and the cover page are refreshed by [`scripts/build_static_guides.py`](../../scripts/build_static_guides.py), which now reads the live app version and schema straight from `package.json` and `src/store/persistence.ts` instead of a hardcoded label, so a future run always stamps the correct version.

The original walkthrough body pages are not auto-generated - they were produced once, outside this repository, from screenshots of that earlier version. Refreshing them (new screenshots and steps matching v1.8.0) is manual documentation work, not something this script does, and has not been done yet.

To refresh the cover and appended handbook to the current version, from an environment with Python, `pypdf` and `reportlab` installed:

```bash
python3 scripts/build_static_guides.py
```

This reads each PDF currently in `docs/guides/`, replaces its cover, and appends the current handbook content, writing the result back to `docs/guides/`.
