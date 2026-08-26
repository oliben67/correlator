---
description: Create a new catalyst SPRINT-NNN container and register it in work-items/sprints/sprints.md
argument-hint: <sprint goal> [--start YYYY-MM-DD] [--end YYYY-MM-DD]
---

Create a new catalyst sprint container. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md`, template:
`.catalyst-proj/work-items/sprints/templates/TEMPLATE-SPRINT-v1.md`.
Input: $ARGUMENTS

A sprint holds `STORY-`/`TASK-`/`SPIKE-` IDs as-is — it never restates
their acceptance criteria or rule targets.

1. Read `.catalyst-proj/work-items/sprints/sprints.md` and list
   `.catalyst-proj/work-items/sprints/` to find the highest existing
   `SPRINT-NNN` (**3-digit**, zero-padded — not 4). The new ID is the next
   number.
2. Copy the template to
   `.catalyst-proj/work-items/sprints/SPRINT-NNN-<short-kebab-summary>.md`
   and fill in: ID, Dates, Status (`planning`), Signed-off-by (resolve per
   `CODE-OF-CONDUCT.md` §2), Sprint goal, Committed items (empty table for
   now), Carried over from previous sprint (empty), Review notes (blank),
   Retrospective (blank).
3. Add a row to `.catalyst-proj/work-items/sprints/sprints.md`.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []`,
   `files` = every file just touched with real `git hash-object -w`
   before/after hashes).
5. Report the new sprint's ID and file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
