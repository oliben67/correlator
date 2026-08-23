---
description: Analyze the change-impact of a file — its role, related rules/artifacts, and likely blast radius
argument-hint: <file-name>
---

Analyze the change-impact of a file. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §3.
Input: $ARGUMENTS

1. Resolve `<file-name>` in the repository. If it can't be found, report
   that plainly — don't invent a result.
2. Identify what kind of thing it is: a catalyst rule, template, artifact,
   plugin contract, application source file, or other framework/project
   asset.
3. Inspect what depends on it or references it: for a rule, its domain
   file, its entries in local + global indexes, and any dev artifacts that
   target it (`grep` its ID across `development/`, `requirements/`,
   `work-items/`); for application source, its importers/callers and any
   tests exercising it.
4. Return a concise summary: what the file is, what would be affected by
   changing it, and any blocking concerns (e.g. it's targeted by open
   work, or it's a template with no corresponding index entry).
