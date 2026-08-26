---
description: Ingest a new named roadmap from a local file into .catalyst-proj/development/roadmaps/
argument-hint: <name> <file>
---

Ingest a new named roadmap from a local file. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4, template:
`.catalyst-proj/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <file>`. If either is missing, ask for it.
2. If `.catalyst-proj/development/roadmaps/<name>.md` already exists,
   refuse and point to `/roadmap-update` or `/roadmap-merge` instead.
3. Read `<file>` from the local filesystem and identify its distinct
   roadmap items (headings, bullets, table rows — whatever structure the
   source uses).
4. Determine the next `RM-NNNNNN` ID by scanning every existing
   `.catalyst-proj/development/roadmaps/*.md` file for the highest current
   number — never guess or reuse.
5. Resolve who is signing this (per `CODE-OF-CONDUCT.md` §2) and create
   `.catalyst-proj/development/roadmaps/<name>.md` from
   `.catalyst-proj/development/roadmaps/templates/TEMPLATE-ROADMAP-v1.md`, with
   `Name: <name>`, `Source: <file>`, `Added`/`Last updated` set to today,
   and one row per identified item (`Status: Not triaged`,
   `Linked: *(none)*`, `Signed-off-by` set to the resolved user).
6. Register `<name>` in `.catalyst-proj/development/roadmaps/roadmaps.md`.
7. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []` —
   roadmap items aren't rule-linked, `files` = every file just touched
   with real `git hash-object -w` before/after hashes).
8. Report the roadmap name and the IDs assigned. Do not commit or push —
   leave changes unstaged unless the user asks otherwise.
