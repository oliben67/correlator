---
description: Create a new catalyst EPIC-NNNN work item and register it in work-items/epics.md
argument-hint: <short description of the epic> [--domain CODE,...] [--sponsor name]
---

Create a new catalyst epic work item. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md`, template:
`.catalyst-proj/work-items/TEMPLATE-EPIC.md`.
Input: $ARGUMENTS

An epic names the `DOMAIN` code(s) it spans and groups child stories — it
never targets a rule directly (that's what its child stories' requirement
docs do).

1. Read `.catalyst-proj/work-items/epics.md` and list
   `.catalyst-proj/work-items/epics/` to find the highest existing
   `EPIC-NNNN` (4-digit, zero-padded). The new ID is the next number.
2. Copy the template to
   `.catalyst-proj/work-items/epics/EPIC-NNNN-<short-kebab-summary>.md`
   and fill in: ID, Status (`proposed`), Opened (today), Domain(s) (from
   `.catalyst-proj/rules/domains/domains.md`), Sponsor/owner, Signed-off-by
   (resolve per `CODE-OF-CONDUCT.md` §2), Goal, Business value, Scope,
   Child stories (empty table for now), Definition of done, Related.
3. Add a row to `.catalyst-proj/work-items/epics.md`.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets` = the
   Domain(s) field's rule(s) if any, `files` = every file just touched
   with real `git hash-object -w` before/after hashes).
5. Report the new epic's ID and file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
