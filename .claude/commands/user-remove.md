---
description: Deactivate a registered user (never deletes their entry)
argument-hint: <name>
---

Deactivate a user. Full spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §2/§4.
Input: $ARGUMENTS

1. If `<name>` has no entry in `.catalyst-proj/IAM/users/users.json`,
   refuse with a clear message.
2. If `<name>` is the only entry with `"active": true`, warn that this
   would leave the project with zero active users (hard rule, INV-16) and
   ask for confirmation, or suggest `/user-add` for a replacement first.
3. Otherwise set that entry's `active` field to `false` — **never delete
   the entry**, since existing `Signed-off-by` references on already-signed
   artifacts must stay resolvable.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "update"`, `targets: []`,
   `files` = `IAM/users/users.json` with real `git hash-object -w`
   before/after hashes).
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
