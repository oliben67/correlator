---
description: Run the catalyst framework's ANALYSIS-PLAYBOOK.md against this project
argument-hint: (no arguments)
---

Run the catalyst analysis playbook. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. `ANALYSIS-PLAYBOOK.md` lives in the catalyst framework's own repository
   (`framework/kernel/ANALYSIS-PLAYBOOK.md`), not this project. If
   it isn't already available locally this session, clone
   `https://github.com/oliben67/catalyst.git` to a scratch location and
   read it from there — refer to catalyst only by its repository name in
   anything you tell the user (never a local path), per
   `Rules-of-Rules.md` INV-1. If the playbook is genuinely unavailable
   (repository unreachable, file missing), report that and stop — don't
   invent playbook content.
2. Follow its steps against this project's current state.
3. Return the resulting analysis summary, and if it proposes new rules or
   domains, route them through `/create-req` (never directly editing rule
   documents outside that flow) so the usual conflict-check
   (`Rules-of-Rules.md` §1) still applies.
