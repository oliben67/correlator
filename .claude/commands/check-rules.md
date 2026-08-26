---
description: Verify catalyst rules, domains, and artifact links stay consistent and non-conflicting
argument-hint: (no arguments)
---

Verify catalyst rule/domain/artifact consistency. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §3, invariants:
`.catalyst-proj/rules/Rules-of-Rules.md` (especially INV-7/INV-8).
Input: $ARGUMENTS

1. If `scripts/check_deployment.py` from the catalyst framework repository
   is available this session, run it against `.catalyst-proj/` first — it
   mechanically checks INV-7 (naming), INV-8 (`TEMPLATE-RULE*.md` lives
   in `rules/templates/`, no orphan rules, required headings), and INV-20
   (uniform artifact-type layout). If it isn't available, do the
   equivalent checks by hand.
2. Beyond what the script covers, check by inspection:
   - Every rule ID referenced in a dev artifact's `Targets` field actually
     exists.
   - Every `Domain` field value exists in `rules/domains/domains.md`.
   - No two rules in the same domain reuse an `NNN`.
   - Every `STORY-`/`TASK-` traces back to a real `REQ-`/`BUG-` doc
     (`work-items/rules-of-work-items.md` §1), and no task has its own
     independent rule target (§2).
3. Report findings as a list of concrete issues (file + what's wrong), or
   confirm everything checks out. Don't silently fix anything found —
   report it so the user decides.
