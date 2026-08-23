---
description: Vet the deployment against its own rules — check_rules plus a four-eyes drift check, reports without auto-fixing
argument-hint: (no arguments)
---

Vet the deployment against its own claims. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. Run `/check-rules` first (missing rule targets, conflicting domains,
   missing indexes, broken links).
2. Spawn two independent four-eyes sub-agents (no shared context between
   them) that each separately evaluate whether the deployment's actual
   state — its code, its tests, its documentation — still matches what
   its own rules claim: for a rule marked ✅, does the cited `file:line`
   still hold and still have real test coverage; for a rule marked
   ⚠️/❌, is that status still accurate rather than stale.
3. Reconcile the two passes; where they disagree, surface the
   disagreement rather than picking one silently.
4. Report every drift found — a rule whose implementation moved, whose
   test was deleted, whose status marker no longer matches reality —
   **without fixing any of it automatically**; fixing is the user's or a
   follow-up command's call.

This is exactly the check `/thingamabob push` runs against an incoming
branch before merging (`rules/Rules-of-Rules.md` §13) — running it here
standalone doesn't touch `thingamabob` or any branch.
