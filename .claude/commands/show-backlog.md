---
description: Summarize open catalyst work, blockers, and missing links, and refresh development/BACKLOG.md
argument-hint: (no arguments)
---

Summarize the catalyst backlog and refresh the persisted snapshot. Full
spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §2/§3, catalyst framework
`INVARIANTS.md` INV-14.
Input: $ARGUMENTS

1. Read every index: `development/bugs.md`, `requirements/requirements.md`,
   `features/features.md`, `development/house-keeping.md`,
   `work-items/{epics,stories,tasks,spikes,sprints}.md`, and every
   `development/roadmaps/<name>.md` not marked `Retired`.
2. Compute: open bugs by severity, in-progress/proposed requirements,
   any story with no linked `REQ-`/`BUG-` doc (a rules-of-work-items §1
   violation), any `⚠️`/`❌` rules with no open work targeting them,
   feature ideas with no requirement opened yet, and every active
   roadmap's rows grouped by roadmap name then Status.
3. **Overwrite `development/BACKLOG.md` in full** with the result (same
   sections as `development/BACKLOG.md`'s existing structure — Open bugs,
   In-progress/proposed requirements, Work items missing links, Rules with
   no open work, Feature ideas with no requirement yet, Roadmap
   (grouped by roadmap name then Status) — plus a refreshed
   `**Last refreshed:**` timestamp).
4. **Also refresh every active `development/roadmaps/<name>.md` in
   place**: for each `RM-NNNN` row, resolve whichever `FEAT-`/`REQ-` its
   `Linked` field names (if any) and set `Status` to `Not triaged` /
   `Triaged` / `In progress` / `Done` accordingly, leaving
   `Title`/`Notes`/`Source` untouched. No file write in steps 3–4 is
   optional — a stale `BACKLOG.md`, or any roadmap file that doesn't
   match this run, is itself a bug in the deployment (INV-14/INV-15) —
   never skip either just because the terminal summary below covers the
   same information.
5. Also present the same result to the user as a compact, skimmable status
   report in this turn — not a re-listing of every index verbatim.
