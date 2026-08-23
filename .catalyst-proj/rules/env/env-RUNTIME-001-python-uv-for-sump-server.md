## Rule metadata

- **Type**: `env`
- **Domain**: `RUNTIME`
- **Status**: ✅ working
- **Targets**: none (foundational rule)

## Rule

The Sump server (`server/`) is Python ≥3.12, pinned via `server/.python-version`,
managed with `uv`.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4 target-stack table
  (unchanged from cttc), §4.4 dev tooling.
- Implemented: `server/pyproject.toml` (`requires-python = ">=3.12"`),
  `server/.python-version` (`3.12`).
- Tested: `cd server && uv sync --all-extras --dev` completes clean
  (verified 2026-08-23, uv 0.11.26, resolves CPython 3.12.13).
- Related rules: `env-DEPS-001`, `env-STYLE-001`, `env-TEST-001`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
