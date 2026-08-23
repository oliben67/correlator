# `RM-NNNN` roadmap — template

> Copy this file to `development/roadmaps/<name>.md` each time
> `/roadmap-add <name> <file>` ingests a new named roadmap — one file per
> named roadmap, registered in `development/roadmaps/roadmaps.md`. See
> `rules/Rules-of-Rules.md` §10.
>
> Unlike the other artifact templates, a roadmap file is not filled in
> once by a human: `/roadmap-add`/`/roadmap-update`/`/roadmap-merge` add
> or update its `RM-NNNN` rows from an external source file, and
> `/show-backlog` refreshes each row's `Status`/`Linked` columns from
> whichever `FEAT-`/`REQ-` is currently linked to it. Hand-edit the
> `Notes` column freely; never hand-edit `Status` or `Linked` — the next
> `/show-backlog` run overwrites them from the real indexes, the same way
> it overwrites `development/BACKLOG.md` (INV-14).

**Name:** {{name — the identifier used in `/roadmap-add`/`-remove`/`-update`/`-merge`, and this file's own filename}}
**Source:** {{the file path last ingested via `/roadmap-add` or `/roadmap-update` — `/roadmap-merge` does not change this}}
**Added:** {{DATE}}
**Last updated:** {{DATE}}
**Retired:** {{DATE, only present if `/roadmap-remove` retired this roadmap instead of deleting it because one or more of its items are still linked — omit this field entirely otherwise}}

## Items

| ID | Title | Status | Linked | Signed-off-by | Notes |
|---|---|---|---|---|---|
| `RM-0001` | {{short title, as given by the source file}} | Not triaged | *(none)* | {{registered user who ran the ingest — see `CODE-OF-CONDUCT.md` §2}} | {{free text}} |

## Status values

- **Not triaged** — ingested; no `FEAT-`/`REQ-` for it yet.
- **Triaged** — a `FEAT-NNNN` exists for this item (see its `Roadmap` field).
- **In progress** — the linked `FEAT-` was promoted to a `REQ-NNNN` that is not yet done.
- **Done** — the linked `REQ-NNNN` is complete.

## How this file is maintained

- `/roadmap-add <name> <file>` creates this file (this template, once)
  and parses `<file>` into one `RM-NNNN` row per distinct item it
  identifies (`Not triaged`, globally next ID across every named
  roadmap — never reused, same as `FEAT-NNNN`), `Signed-off-by` set per
  `CODE-OF-CONDUCT.md` §2.
- `/roadmap-update <name> <file>` re-reads `<file>` as the new full,
  authoritative version of this roadmap: adds rows for new items,
  updates matched rows' `Title`/`Notes` (matched by title/description
  similarity — ask the user rather than guessing when ambiguous), and
  flags in `Notes` (never deletes) any row whose item no longer appears
  in the new file. Updates `Source`/`Last updated` above.
- `/roadmap-merge <name> <update file>` treats `<update file>` as a
  partial delta, not the full roadmap: only adds/updates the rows it
  actually contains, with the same matching rule as `-update`. Does not
  compare against or flag rows the delta doesn't mention, and does not
  change `Source` — only `Last updated`.
- `/roadmap-remove <name>` deletes this file and its `roadmaps.md` entry
  outright **only if no row's `Linked` field is set**. If any row is
  linked to a `FEAT-`/`REQ-`, deleting would break that cross-reference
  (`rules/Rules-of-Rules.md` §4's "never delete, retire in place"
  principle applies here too) — instead it adds the `Retired` field
  above, marks this roadmap `retired` in `roadmaps.md`, and leaves every
  row and ID exactly as they are, resolvable, just excluded from
  `/show-backlog`'s active Roadmap section going forward.
- A row stays `Not triaged` until a human decides it's worth tracking
  inside catalyst, at which point `/create-feature` opens its `FEAT-NNNN`
  (citing this row's `RM-NNNN` ID in the feature's own `Roadmap` field).
- From there, the normal `FEAT-` → `REQ-` promotion applies
  (`rules/Rules-of-Rules.md` §9/§10, catalyst framework `INVARIANTS.md`
  INV-9); this file's `Status`/`Linked` columns always mirror whichever
  artifact is currently linked, refreshed by `/show-backlog` — never
  edited here directly.
