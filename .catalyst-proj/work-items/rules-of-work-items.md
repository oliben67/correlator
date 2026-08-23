# Rules of Work Items

> Instantiates the [catalyst framework](https://github.com/oliben67/catalyst.git)'s
> `development-framework/rules-of-work-items.template.md`.

Standards for the agile process layer — epics, stories, tasks, spikes,
sprints. correlator uses Scrum vocabulary by default (see the "Agile-
methodology agnostic" note in the catalyst framework's own README); switch
to Kanban or a hybrid at any time per that note without changing anything
below the work-items layer. Sits above [`CODE-OF-CONDUCT.md`](../CODE-OF-CONDUCT.md),
which sits above [`rules/Rules-of-Rules.md`](../rules/Rules-of-Rules.md).
Work items never bypass that chain.

```
EPIC ─▶ STORY ─▶ TASK           (agile layer — this document)
          │
          ▼
       REQ- / BUG- / HK-        (rule-linked work)
          │
          ▼
       rule IDs                 (documented behavior)
```

---

## 1. A story is not a substitute for a `REQ-`/`BUG-` doc

Every `STORY-NNNN` links to exactly one `REQ-NNNN` (or `BUG-NNNN`). The
`REQ-`/`BUG-` doc owns rule targets, conflict checks, and new-rule
proposals. The story is the sized, scheduled slice of that same work.

If a story has no `REQ-`/`BUG-` doc yet, create one before pulling the
story into a sprint/iteration. (A `FEAT-NNNN` entry may motivate a story
too, but it never substitutes for the `REQ-`/`BUG-` doc — features aren't
rule-linked; see `rules/Rules-of-Rules.md` §9.)

## 2. Tasks inherit their parent story's rule target

A `TASK-NNNN` never gets its own rule target — it inherits its parent
story's. If task-level work needs a rule the story doesn't cover, fix the
story/feature doc first rather than letting scope creep in unreviewed.

## 3. Spikes exist to produce rules or estimates, not code

A `SPIKE-NNNN` is time-boxed and never itself "implements" anything. Its
outcome is a new rule proposal (handed to a `REQ-NNNN`), an
implementation approach, or a go/no-go decision. A spike that ships
production code has stopped being a spike.

## 4. Epics are decomposition, not a fourth rule namespace

An epic names the `DOMAIN` code(s) it spans and groups child stories. It
never targets a rule directly. "Done" means all child stories are done.

## 5. Iteration containers schedule work items; they don't reclassify them

Whatever container your methodology uses (`SPRINT-NNN`, a Kanban column,
etc.) holds `STORY-`/`TASK-`/`SPIKE-` IDs as-is — it never restates
acceptance criteria or rule targets. Retro/review action items that imply
a process change get filed as `HK-NNNN`, not left as an untracked note.

## 6. IDs

Per `rules/Rules-of-Rules.md` §8: `(EPIC|STORY|TASK|SPIKE)-NNNN` (4 digits),
`SPRINT-NNN` (3 digits), each sequence global within its own type, never
reused.

## 7. Templates

| Type | Folder | Template |
|---|---|---|
| Epic | `work-items/epics/` | `work-items/TEMPLATE-EPIC.md` |
| Story | `work-items/stories/` | `work-items/TEMPLATE-STORY.md` |
| Task | `work-items/tasks/` | `work-items/TEMPLATE-TASK.md` |
| Spike | `work-items/spikes/` | `work-items/TEMPLATE-SPIKE.md` |
| Sprint | `work-items/sprints/` | `work-items/TEMPLATE-SPRINT.md` |
