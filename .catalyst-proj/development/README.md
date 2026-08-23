# `development/`

Rule-linked development artifacts: bugs, house-keeping, and meta-tags (see
[`../CODE-OF-CONDUCT.md`](../CODE-OF-CONDUCT.md); requirements live in
[`../requirements/`](../requirements/) instead).

- [`TEMPLATE-BUG.md`](TEMPLATE-BUG.md) / [`bugs.md`](bugs.md) / `bugs/` —
  an existing rule that doesn't hold in the running system.
- [`TEMPLATE-HOUSE-KEEPING.md`](TEMPLATE-HOUSE-KEEPING.md) /
  [`house-keeping.md`](house-keeping.md) / `house-keeping/` — dev-support
  tooling/process work, not product behavior.
- [`TEMPLATE-META-TAG.md`](TEMPLATE-META-TAG.md) / [`meta-tags.md`](meta-tags.md)
  / `meta-tags/` — lightweight `comment`/`version`/`link-to` annotations on
  an existing artifact.
- [`BACKLOG.md`](BACKLOG.md) — the go-to snapshot of open work and
  blockers. Never hand-edited: `/show-backlog` regenerates it in full on
  every run (catalyst framework `INVARIANTS.md` INV-14).
- [`roadmaps/`](roadmaps/roadmaps.md) — one `RM-NNNN`-numbered file per
  named roadmap ingested via `/roadmap-add`, indexed in `roadmaps.md`.
  Status/Linked columns are machine-maintained by `/show-backlog`, same
  discipline as `BACKLOG.md` (INV-15). Formalizing a row means
  `/create-feature` citing its `RM-NNNN` in the new `FEAT-`'s `Roadmap`
  field.
- [`users.json`](users.json) / [`roles.json`](roles.json) — the registry
  of who can sign work and what each role typically does. Managed only by
  `/user-*`/`/role-*` commands (`../CODE-OF-CONDUCT.md` §2); at least one
  active user is a hard requirement (INV-16).
- [`journal.jsonl`](journal.jsonl) — append-only, transaction-log-grade
  history: every command that creates/modifies/closes/retires an
  artifact, rule, domain, or work item, or changes a `Status`, appends
  one entry with exact before/after content hashes (`../CODE-OF-CONDUCT.md`
  §9, `../rules/Rules-of-Rules.md` §12, INV-17). Query with `/journal`,
  reconstruct a point in time with `/journal-restore` — never hand-edited,
  never rewritten.
