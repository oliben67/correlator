# `rules/`

Documented behavior — the bottom layer of the catalyst chain. Every rule
here is what implementation and tests are measured against.

- [`Rules-of-Rules.md`](Rules-of-Rules.md) — the meta-rules governing how
  rules themselves get added, changed, or retired. Read this first.
- [`TEMPLATE-RULE.md`](TEMPLATE-RULE.md) — the one template used to create
  every concrete rule file. Never duplicated into a type directory.
- [`rules.md`](rules.md) — the global index of every rule document and rule
  file. A rule not listed here is orphaned.
- `core/` — the `cor` rule document (`core-rules.md`), application/product
  behavior, and its concrete rule files.
- `env/` — the `env` rule document (`env-rules.md`), dev-environment
  tooling for `server/`/`app/` (seeded via catalyst's greenfield
  instantiation path), and its concrete rule files.
- [`domains/`](domains/domains.md) — the functional domains rules are
  grouped under, one file per domain, indexed in `domains/domains.md`.
