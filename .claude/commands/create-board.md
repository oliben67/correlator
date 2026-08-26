---
description: Create a new catalyst BOARD-NNNNNN container and register it in work-items/boards/boards.md
argument-hint: <board title>
---

Create a new catalyst board container. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md` §6, template:
`.catalyst-proj/work-items/boards/templates/TEMPLATE-BOARD-v1.md`.
Input: $ARGUMENTS

Kanban/Scrumban flavor only — the structural counterpart to `/create-sprint`.
**Not adopted by this deployment** (correlator uses Scrum): confirm with the
user that they actually want a board before proceeding, since this
introduces a second, unused work-item flavor into the deployment rather
than fixing anything.

1. If `.catalyst-proj/work-items/boards/` doesn't exist yet, bootstrap it
   first (this type is optional and was never scaffolded — same
   first-use pattern as `/user-add` seeding `IAM/` from templates):
   create `.catalyst-proj/work-items/boards/templates/`, seed
   `TEMPLATE-BOARD-v1.md` from the catalyst framework's own
   `templates/board.template.md`, `templates-board.md` (v1, today's
   date), and `README.md` files for both `boards/` and `boards/templates/`,
   plus an empty `boards.md` index.
2. Read `.catalyst-proj/work-items/boards/boards.md` and list
   `.catalyst-proj/work-items/boards/` to find the highest existing
   `BOARD-NNNNNN` (6-digit, zero-padded). The new ID is the next number.
3. Copy the current `TEMPLATE-BOARD-vN.md` to
   `.catalyst-proj/work-items/boards/BOARD-NNNNNN-<short-kebab-summary>.md`
   and fill in: ID, Status (`Active`), Opened (today), Signed-off-by
   (resolve per `CODE-OF-CONDUCT.md` §2), Purpose, an empty
   Columns/WIP-limits table, and an empty Items table.
4. Add a row to `.catalyst-proj/work-items/boards/boards.md`.
5. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []`,
   `files` = every file just touched with real `git hash-object -w`
   before/after hashes).
6. Report the new board's ID and file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
