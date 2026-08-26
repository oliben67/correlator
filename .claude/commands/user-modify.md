---
description: Edit a registered user's notes (or reactivate them)
argument-hint: <name> <field> <value>
---

Edit a user's field. Full spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <field> <value>`. If any part is missing,
   ask for it.
2. If `<name>` has no entry in `.catalyst-proj/IAM/users/users.json`,
   refuse and point to `/user-add`.
3. Refuse if `<field>` is `roles` — point to `/user-assign-role` instead.
4. Refuse if `<field>` is `name` or `registered` — identity/audit fields,
   never edited in place.
5. Refuse if `<field>` is `active` and `<value>` is `false` — point to
   `/user-remove`, which also checks the "at least one active user" rule.
   Setting `active` to `true` (reactivating) is fine here.
6. Otherwise update `<field>` to `<value>`.
7. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "update"`, `targets: []`,
   `files` = `IAM/users/users.json` with real `git hash-object -w`
   before/after hashes).
8. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
