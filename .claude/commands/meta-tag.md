---
description: Create a catalyst meta-tag annotation on an existing artifact
argument-hint: <artefact-id> --key comment|version|link-to --value "..."
---

Create a new catalyst meta-tag artifact. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §2/§3, template:
`.catalyst-proj/development/TEMPLATE-META-TAG.md`.
Input: $ARGUMENTS

A meta-tag is a lightweight annotation — one key/value pair on an existing
artifact. It does not define a rule or work item on its own.

1. Resolve the target artifact ID from the input. If it doesn't resolve to
   an existing artifact (rule, bug, requirement, feature, work item),
   stop and say so — don't create a tag for something that doesn't exist.
2. If `--key` wasn't supplied, ask for it — must be exactly one of
   `comment`, `version`, or `link-to`. Validate `--value`'s type against
   the key (`comment`: free string; `version`: number; `link-to`: another
   artefact ID that must also resolve).
3. Copy the template to
   `.catalyst-proj/development/meta-tags/tag-<key>-<artefact-id>.md`
   (the storage name is fixed by this pattern — not a sequential ID) and
   fill in Stored as, Target artifact, Key, Value type, Value.
4. Add a row to `.catalyst-proj/development/meta-tags.md`.
5. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []`,
   `files` = every file just touched with real `git hash-object -w`
   before/after hashes).
6. Report the new meta-tag's file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
