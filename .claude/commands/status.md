---
description: Update a catalyst artifact or work item's Status field
argument-hint: <artefact-id> <status> [force]
---

Update an artifact/work-item's `Status` field. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §3.
Input: $ARGUMENTS

1. Resolve `<artefact-id>` to its file (search
   `.catalyst-proj/{development,requirements,features,work-items}/**`).
   If it doesn't resolve, state plainly that the artifact cannot be found
   — do not guess or create it.
2. Look up that artifact type's valid `Status` values (each template's
   `| **Status** |` row documents its own valid set, e.g. bugs:
   open/in-progress/fixed/wontfix/duplicate-of; requirements:
   proposed/approved/in-progress/done/rejected; etc.).
3. If `<status>` is one of the valid values for that type, update the
   `Status` field in place and update the corresponding index row if it
   also carries a status column.
4. If `<status>` is **not** valid: with `force` supplied, set it anyway
   and note in your report that it's a forced, non-standard value; without
   `force`, refuse — report that the status change is impossible and leave
   the artifact untouched.
5. Before marking a bug "fixed" or a requirement "done", check
   `CODE-OF-CONDUCT.md` §6's closing bar (bug: test-plan item landed;
   requirement: acceptance criteria + rule targets reflected in
   implementation and tests) — flag if it isn't actually met yet rather
   than silently allowing the status change.
6. If the status actually changed (step 3 or a forced step 4, not a
   refusal), append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "status-change"`, `targets` =
   the artifact's own Targets/Domain field if it has one, `files` = every
   file just touched with real `git hash-object -w` before/after hashes).
