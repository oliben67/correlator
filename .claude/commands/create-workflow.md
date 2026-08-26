---
description: Create a new catalyst WORKFLOW-NNNNNN process-definition document and register it in work-items/workflows/workflows.md
argument-hint: <workflow title>
---

Create a new catalyst workflow (process-definition) document. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md` §7, template:
`.catalyst-proj/work-items/workflows/templates/TEMPLATE-WORKFLOW-v1.md`.
Input: $ARGUMENTS

A workflow documents a repeatable multi-step procedure (e.g. "how a bug
moves from triage to resolution") — never a unit of work: no parent
epic/story link, and never itself "done." **Not adopted by this
deployment yet**: confirm with the user this is genuinely a process worth
documenting rather than an ad hoc note, since a workflow persists as a
governed artifact once created.

1. If `.catalyst-proj/work-items/workflows/` doesn't exist yet, bootstrap
   it first (this type is optional and was never scaffolded — same
   first-use pattern as `/user-add` seeding `IAM/` from templates):
   create `.catalyst-proj/work-items/workflows/templates/`, seed
   `TEMPLATE-WORKFLOW-v1.md` from the catalyst framework's own
   `templates/workflow.template.md`, `templates-workflow.md` (v1, today's
   date), and `README.md` files for both `workflows/` and
   `workflows/templates/`, plus an empty `workflows.md` index.
2. Read `.catalyst-proj/work-items/workflows/workflows.md` and list
   `.catalyst-proj/work-items/workflows/` to find the highest existing
   `WORKFLOW-NNNNNN` (6-digit, zero-padded). The new ID is the next
   number.
3. Copy the current `TEMPLATE-WORKFLOW-vN.md` to
   `.catalyst-proj/work-items/workflows/WORKFLOW-NNNNNN-<short-kebab-summary>.md`
   and fill in: ID, Status (`Active`), Defined (today), Signed-off-by
   (resolve per `CODE-OF-CONDUCT.md` §2), Purpose, numbered Steps, Gates /
   exit criteria, and Related (empty unless the user names a superseded
   workflow — mark that one `Deprecated` in place, never delete it).
4. Add a row to `.catalyst-proj/work-items/workflows/workflows.md`.
5. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []`,
   `files` = every file just touched with real `git hash-object -w`
   before/after hashes).
6. Report the new workflow's ID and file path. Do not commit — leave the
   new files unstaged unless asked otherwise.
