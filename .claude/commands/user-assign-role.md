---
description: Add a role to a registered user (additive, doesn't remove existing roles)
argument-hint: <name> <role>
---

Assign an additional role to a user. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `<name>` has no entry in `.catalyst-proj/IAM/users/users.json`,
   refuse and point to `/user-add`.
3. If `<role>` isn't one of the roles listed in
   `.catalyst-proj/IAM/roles/roles.json`, ask whether to use an
   existing role or run `/role-add` for `<role>` first.
4. If `<name>`'s `roles` array already contains `<role>`, say so and make
   no change.
5. Otherwise append `<role>` to that array.
6. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "update"`, `targets: []`,
   `files` = `IAM/users/users.json` with real `git hash-object -w`
   before/after hashes).
7. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
