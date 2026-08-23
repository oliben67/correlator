---
description: Create a new catalyst TASK-NNNN work item and register it in work-items/tasks.md
argument-hint: <short description of the task> --story STORY-NNNN|--hk HK-NNNN [--assignee name] [--estimate ...]
---

Create a new catalyst task work item. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md` §2, template:
`.catalyst-proj/work-items/TEMPLATE-TASK.md`.
Input: $ARGUMENTS

A task **never** gets its own rule target — it inherits its parent story's.
Technical/house-keeping work with no story goes under `HK-NNNN` directly
instead of a task with no parent.

1. Read `.catalyst-proj/work-items/tasks.md` and list
   `.catalyst-proj/work-items/tasks/` to find the highest existing
   `TASK-NNNN` (4-digit, zero-padded). The new ID is the next number.
2. Copy the template to
   `.catalyst-proj/work-items/tasks/TASK-NNNN-<short-kebab-summary>.md`
   and fill in: ID, Status (`todo`), Parent (the given `STORY-NNNN`),
   Assignee, Estimate, Signed-off-by (resolve per `CODE-OF-CONDUCT.md`
   §2), Description, Definition of done (rolls up into the parent story's
   acceptance criteria, not new ones), Related. Also add a row for this
   task to the parent story's Tasks table.
3. Add a row to `.catalyst-proj/work-items/tasks.md`.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets` = the
   parent story's rule target(s), `files` = every file just touched with
   real `git hash-object -w` before/after hashes).
5. Report the new task's ID and file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
