---
description: Ingest a new named roadmap from a local file into .criterion/development/roadmaps/
argument-hint: <name> <file>
---

Ingest a new named roadmap from a local file. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, template:
`.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v3.md`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <file>`. If either is missing, ask for it.
2. If `.criterion/development/roadmaps/<name>.md` already exists,
   refuse and point to `/roadmap-update` or `/roadmap-merge` instead.
3. Read `<file>` from the local filesystem and identify its distinct
   roadmap items (headings, bullets, table rows — whatever structure the
   source uses).
4. Determine the next `RM-NNNNNN` ID by scanning every existing
   `.criterion/development/roadmaps/*.md` file for the highest current
   number — never guess or reuse.
5. Resolve who is signing this (per `CODE-OF-CONDUCT.md` §2) and confirm
   they have a `userid` (`rules/Rules-of-Rules.md` §11/INV-26) —
   register one first if not. Every item's `ID` gets that signer's
   `userid` appended as its suffix (`rules/Rules-of-Rules.md` §20);
   every item ingested in the same run shares the same signer and
   suffix.
6. Create `.criterion/development/roadmaps/<name>.md` from
   `.criterion/development/roadmaps/templates/TEMPLATE-ROADMAP-v3.md`, with
   `Name: <name>`, `Source: <file>`, `Added`/`Last updated` set to today,
   and one row per identified item (`ID`: `RM-NNNNNN-<userid>`;
   `Description` a sentence or two summarizing the item, drawn from
   `<file>` — not a restatement of `Title`; `Status: Not triaged`,
   `Linked: *(none)*`, `Signed-off-by` set to the resolved user).
7. Register `<name>` in `.criterion/development/roadmaps/roadmaps.md`.
8. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []` —
   roadmap items aren't rule-linked, `files` = every file just touched
   with real `git hash-object -w` before/after hashes).
9. Report the roadmap name and the IDs assigned. Do not commit or push —
   leave changes unstaged unless the user asks otherwise.
