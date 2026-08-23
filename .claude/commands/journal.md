---
description: Filter and report development/journal.jsonl entries (read-only)
argument-hint: [--since <date>] [--artifact <id>] [--actor <name>] [--rule <id>]
---

Report journal entries. Full spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §9,
`.catalyst-proj/rules/Rules-of-Rules.md` §12.
Input: $ARGUMENTS

This command is **read-only** — it never writes to the journal itself.

1. Read `.catalyst-proj/development/journal.jsonl` (one JSON object per
   line). If it doesn't exist or is empty, say so rather than inventing
   history.
2. Apply whichever filters were given: `--since` on `timestamp`,
   `--artifact` on `artifact`, `--actor` on `actor`, `--rule` on
   membership in `targets`.
3. Report the matching entries in timestamp order: what changed, who,
   which command, which rule(s), and each entry's `intent`. If nothing
   matches, say so rather than inventing matches.
