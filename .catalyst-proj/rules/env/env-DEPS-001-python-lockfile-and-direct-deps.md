## Rule metadata

- **Type**: `env`
- **Domain**: `DEPS`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-001`

## Rule

Python dependencies are declared in `server/pyproject.toml` and pinned
via a committed `server/uv.lock`. A direct git dependency (bypassing
PyPI) is acceptable when it pins an exact tag and the target repository
is itself a real, versioned project — the precedent being
`log-sump-extended`'s own pin of `log-sump @ git+https://...@v0.4.2` — not
as a general substitute for registry packages.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4 (cttc's own
  `pyproject.toml`/`uv.lock` convention, carried forward unchanged).
- Implemented: `server/pyproject.toml`'s `dependencies`/`dependency-groups.dev`,
  `server/uv.lock` (committed once created by `uv sync`).
- Tested: `uv sync --all-extras --dev` resolves and locks cleanly
  (verified 2026-08-23, 22 packages resolved).
- Related rules: `env-RUNTIME-001`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
