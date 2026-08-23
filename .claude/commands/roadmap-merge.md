---
description: Fold a partial delta file into an existing named roadmap
argument-hint: <name> <update-file>
---

Merge a partial delta into a named roadmap. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <update file>`. If either is missing, ask
   for it.
2. If `.catalyst-proj/development/roadmaps/<name>.md` doesn't exist,
   refuse and point to `/roadmap-add` instead.
3. Read `<update file>` as a **partial delta**, not the full roadmap:
   identify only the items it actually contains.
4. Apply the same add/update matching rule as `/roadmap-update` for those
   items only — do not compare against or flag any row `<update file>`
   doesn't mention.
5. Update `Last updated` only — never change `Source` (this isn't a full
   re-ingest).
6. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "update"`, `targets: []`,
   `files` = every file just touched with real `git hash-object -w`
   before/after hashes).
7. Report a short summary of what was added/updated. Do not commit or
   push — leave changes unstaged unless the user asks otherwise.
