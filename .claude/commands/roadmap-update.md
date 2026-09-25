---
description: Re-ingest a file as the new full, authoritative version of an existing named roadmap
argument-hint: <name> <file>
---

Re-ingest a named roadmap's source file. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <file>`. If either is missing, ask for it.
2. If `.criterion/development/roadmaps/<name>.md` doesn't exist,
   refuse and point to `/roadmap-add` instead.
3. Read `<file>` and identify its distinct items, the same way
   `/roadmap-add` would.
4. For each item: if it matches an existing row by title/description
   similarity, update that row's `Title`/`Description`/`Notes` (ask the
   user rather than guessing when a match is ambiguous — never touch its
   `ID`, including its `userid` suffix, which stays fixed for the life
   of the row per `rules/Rules-of-Rules.md` §20); if it's new, resolve
   who is signing this re-ingest (`CODE-OF-CONDUCT.md` §2), confirm they
   have a `userid` (registering one first if not), and add a row with
   the next global `RM-NNNNNN-<userid>` ID (its own `Description`, same
   rule as `/roadmap-add`; `Status: Not triaged`, `Linked: *(none)*`,
   `Signed-off-by` the resolved signer).
5. Flag — in `Notes`, never by deleting — any existing row whose item no
   longer appears in `<file>`.
6. Update the file's `Source` and `Last updated` fields.
7. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "update"`, `targets: []`,
   `files` = every file just touched with real `git hash-object -w`
   before/after hashes).
8. Report a short summary of what was added/updated/flagged. Do not
   commit or push — leave changes unstaged unless the user asks
   otherwise.
