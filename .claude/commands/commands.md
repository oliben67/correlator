---
description: List every slash command available in this deployment
argument-hint: "list [--filter ...]"
---

List available commands. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. List every slash command documented in `.catalyst-proj/CODE-OF-CONDUCT.md`
   §4 — name, one-line purpose — sourced from there, never re-enumerated
   as a hand-maintained subset. Group them (create-artifact commands,
   query/inspect commands, framework maintenance commands) the same way
   `/help` with no argument does.
2. Apply `--filter` the same way `/list` does, if given.
3. `/help` with no argument delegates here for its command listing rather
   than re-describing it.

Note: `/dogfood` is catalyst-development-only (`rules/Rules-of-Rules.md`
§13) and is never part of this deployment's command set — this listing
never mentions it here, unlike when running inside catalyst's own
repository.
