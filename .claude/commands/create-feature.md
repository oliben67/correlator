---
description: Create a new catalyst FEAT-NNNNNN roadmap entry and register it in features/features.md
argument-hint: <short description of the feature idea> [--area label]
---

Create a new catalyst feature entry (non-rule-linked roadmap idea). Full
spec: `.criterion/rules/Rules-of-Rules.md` §9, template:
`.criterion/features/templates/TEMPLATE-FEATURE-v2.md`.
Input: $ARGUMENTS

Unlike `/create-bug`/`/create-req`, **never** prompt for a rule target or
domain — feature entries are explicitly exempt (§9). A feature is an idea
or roadmap item, never itself implemented.

1. Read `.criterion/features/features.md` and list
   `.criterion/features/` to find the highest existing `FEAT-NNNNNN`
   (6-digit, zero-padded). The new ID is the next number, with the
   signer's `userid` appended as its suffix once resolved in step 2
   (`rules/Rules-of-Rules.md` §20).
2. Copy the template to
   `.criterion/features/FEAT-NNNNNN-<userid>-<short-kebab-summary>.md`
   (descriptive filename, not the bare ID) and fill in: ID, filename,
   Status (`idea`), Opened (today), Area, Roadmap (the `RM-NNNNNN-<userid>`
   ID if this formalizes an existing `development/roadmaps/<name>.md` row —
   otherwise "none"), Requirement(s) (empty for now), Signed-off-by
   (resolve per `CODE-OF-CONDUCT.md` §2), Description, Motivation, Rough
   scope, Open questions, Related.
3. Add a row to `.criterion/features/features.md`. If a `Roadmap`
   `RM-NNNNNN-<userid>` was set, also update that row in its
   `development/roadmaps/<name>.md`: `Status` → `Triaged`, `Linked` →
   this new `FEAT-NNNNNN-<userid>`.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []` —
   features aren't rule-linked, `files` = every file just touched with
   real `git hash-object -w` before/after hashes).
5. Report the new feature's ID and file path, and remind the user: when
   work on this actually starts, open a `/create-req` against it — never a
   bug. Do not commit — leave the new files unstaged unless asked otherwise.
