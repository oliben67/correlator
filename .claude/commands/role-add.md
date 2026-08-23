---
description: Add a new role to .catalyst-proj/development/roles.json
argument-hint: <role> <actions>
---

Add a new role. Full spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. Parse `$ARGUMENTS` as `<role> <actions>`. If either is missing, ask for
   it.
2. If `<role>` already has an entry in
   `.catalyst-proj/development/roles.json`, refuse and point to
   `/role-modify` instead.
3. Append a new object `{"name": "<role>", "actions": <actions>}` to the
   `roles` array.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets: []`,
   `files` = `development/roles.json` with real `git hash-object -w`
   before/after hashes).
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
