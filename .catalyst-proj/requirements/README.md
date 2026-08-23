# `requirements/`

Rule-linked, testable requirements — the artifact type to open when new
product behavior needs to be built (never a `BUG-` for that; see
[`../CODE-OF-CONDUCT.md`](../CODE-OF-CONDUCT.md)).

- [`TEMPLATE-REQUIREMENT.md`](TEMPLATE-REQUIREMENT.md) — the template for
  every new requirement doc.
- [`requirements.md`](requirements.md) — the canonical index of every
  requirement doc that exists.
- Each `REQ-NNNN-<short-summary>.md` file is a standalone requirement,
  vetted against `rules/Rules-of-Rules.md` §1 before it's opened, always
  carrying a `Targets` and `Domain` field.
