---
description: Create a new catalyst BUG-NNNN artifact and register it in development/bugs.md
argument-hint: <short description of the bug> [--targets rule-id,...] [--domain CODE] [--severity Critical|High|Medium|Low]
---

Create a new catalyst bug artifact. Full spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §2/§3.
Input: $ARGUMENTS

1. Read `.catalyst-proj/development/bugs.md` and list
   `.catalyst-proj/development/bugs/` to find the highest existing
   `BUG-NNNN` (4-digit, zero-padded). The new ID is the next number
   (`0001` if none exist yet).
2. Determine the target rule(s): a bug is **never** allowed with an empty
   `Targets` field (`CODE-OF-CONDUCT.md` §1). If the user's arguments don't
   name an existing rule ID, ask which rule this bug violates — do not
   invent one. If genuinely no rule covers it, that's a sign this should be
   a requirement or house-keeping item instead, not a bug; say so.
3. Determine `Domain` from the targeted rule's domain code
   (`.catalyst-proj/rules/domains/domains.md`) — never free text.
4. Copy `.catalyst-proj/development/TEMPLATE-BUG.md` to
   `.catalyst-proj/development/bugs/BUG-NNNN-<short-kebab-summary>.md`
   (descriptive filename, not the bare ID — `CODE-OF-CONDUCT.md` §5) and
   fill in every field: ID, filename, Status (`open`), Severity (ask if not
   given — required, no default), Opened (today), Targets, Domain, Area,
   Signed-off-by (resolve per `CODE-OF-CONDUCT.md` §2), and the
   Description/Reproduction/Expected-vs-actual/Root cause/Fix plan/Test
   plan/Related sections from what the user described.
5. Add a row for it to `.catalyst-proj/development/bugs.md` (the index —
   every bug must be listed there, `CODE-OF-CONDUCT.md` §2).
6. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets` = the
   Targets field, `files` = every file just touched with real
   `git hash-object -w` before/after hashes).
7. Report the new bug's ID and file path. Do not commit — leave the new
   files unstaged/uncommitted unless the user asks otherwise.
