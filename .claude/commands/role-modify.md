---
description: Replace an existing role's actions in .criterion/IAM/roles/roles.json
argument-hint: <role> <actions>
---

Replace a role's actions. Full spec: `.criterion/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<role> <actions>`. If either is missing, ask for
   it.
2. If `<role>` has no entry in `.criterion/IAM/roles/roles.json`,
   refuse and point to `/role-add` instead.
3. Replace that entry's `actions` array with `<actions>`.
4. Report the result — and note that this never retroactively changes a
   `Signed-off-by` value already recorded on an existing artifact under
   the old mapping.
5. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "update"`, `targets: []`,
   `files` = `IAM/roles/roles.json` with real `git hash-object -w`
   before/after hashes).
6. Do not commit or push — leave changes unstaged unless the user asks
   otherwise.
