---
description: Register a new user in .criterion/IAM/users/users.json with an initial role
argument-hint: <name> <role>
---

Register a new user. Full spec: `.criterion/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<name> <role>`. If either is missing, ask for it.
2. If `<name>` already has an entry in
   `.criterion/IAM/users/users.json`, refuse and point to
   `/user-modify`/`/user-assign-role` instead.
3. If `<role>` isn't one of the roles listed in
   `.criterion/IAM/roles/roles.json`, ask whether to use an
   existing role or run `/role-add` for `<role>` first.
4. Generate a `userid` (`rules/Rules-of-Rules.md` §11, INV-26): draw 8
   characters from `[A-Za-z0-9]` via a cryptographically-secure random
   source; redraw if the result contains no uppercase letter; check
   against every existing `userid` already in
   `.criterion/IAM/users/users.json`; redraw from scratch on any
   collision.
5. Append a new object to the `users` array:
   `{"name": "<name>", "roles": ["<role>"], "registered": "<today>",
   "active": true, "notes": "", "userid": "<generated>"}`.
6. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []`,
   `files` = `IAM/users/users.json` with real `git hash-object -w`
   before/after hashes).
7. Report the result, including the assigned `userid`. If this is the
   project's first registered user, note that the hard "at least one
   active user" requirement (INV-16) is now satisfied.

Do not commit or push — leave changes unstaged unless the user asks
otherwise. This role model is advisory, not access control — catalyst has
no way to verify who is actually typing.
