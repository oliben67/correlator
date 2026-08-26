---
description: Create a new catalyst SPIKE-NNNNNN work item and register it in work-items/spikes/spikes.md
argument-hint: <the question to answer> --parent STORY-NNNNNN|EPIC-NNNNNN [--timebox "1 day"]
---

Create a new catalyst spike work item. Full spec:
`.catalyst-proj/work-items/rules-of-work-items.md` §3, template:
`.catalyst-proj/work-items/spikes/templates/TEMPLATE-SPIKE-v1.md`.
Input: $ARGUMENTS

A spike is time-boxed research, never a commitment to build anything, and
never itself "implements" anything — its outcome is a new rule proposal
(handed to a `/create-req`), an approach, or a go/no-go decision.

1. Read `.catalyst-proj/work-items/spikes/spikes.md` and list
   `.catalyst-proj/work-items/spikes/` to find the highest existing
   `SPIKE-NNNNNN` (4-digit, zero-padded). The new ID is the next number.
2. Copy the template to
   `.catalyst-proj/work-items/spikes/SPIKE-NNNNNN-<short-kebab-summary>.md`
   and fill in: ID, Status (`open`), Parent, Timebox (a hard stop, not an
   estimate — ask if not given), Related rule(s) if any, Signed-off-by
   (resolve per `CODE-OF-CONDUCT.md` §2), the Question (phrased so
   "answered: yes/no/X" is unambiguous), Findings (left blank until
   timebox end), Outcome, Related.
3. Add a row to `.catalyst-proj/work-items/spikes/spikes.md`.
4. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets` = Related
   rule(s) if any, `files` = every file just touched with real
   `git hash-object -w` before/after hashes).
5. Report the new spike's ID and file path. Do not commit — leave the new
   files unstaged unless asked otherwise.
