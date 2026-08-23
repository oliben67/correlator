---
description: Create a new catalyst STORY-NNNN work item and register it in work-items/stories.md
argument-hint: <short description of the story> [--epic EPIC-NNNN] [--req REQ-NNNN|--bug BUG-NNNN] [--points N]
---

Create a new catalyst story work item. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md` §1, template:
`.catalyst-proj/work-items/TEMPLATE-STORY.md`.
Input: $ARGUMENTS

A story is **never** a substitute for a `REQ-`/`BUG-` doc. Every story
links to exactly one. If the user hasn't named one and it doesn't already
exist, stop and suggest `/create-req` (or `/create-bug`) first — don't
create the story without it.

1. Read `.catalyst-proj/work-items/stories.md` and list
   `.catalyst-proj/work-items/stories/` to find the highest existing
   `STORY-NNNN` (4-digit, zero-padded). The new ID is the next number.
2. Copy the template to
   `.catalyst-proj/work-items/stories/STORY-NNNN-<short-kebab-summary>.md`
   and fill in: ID, Status (`backlog`), Epic (or "none"), Targets (the
   linked requirement/bug's rule target(s)), Requirement doc, Points,
   Domain, Signed-off-by (resolve per `CODE-OF-CONDUCT.md` §2), the Story
   (as a/I want/so that), Acceptance criteria (mirroring the linked REQ's,
   not diverging), Tasks (empty table for now), Related.
   If `--epic` was given, also add a row for this story to that epic's
   Child stories table.
3. Add a row to `.catalyst-proj/work-items/stories.md`.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets` = the
   Targets field, `files` = every file just touched with real
   `git hash-object -w` before/after hashes).
5. Report the new story's ID and file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
