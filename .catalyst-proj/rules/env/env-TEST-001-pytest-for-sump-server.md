## Rule metadata

- **Type**: `env`
- **Domain**: `TEST`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-001`

## Rule

Sump server tests use `pytest` + `pytest-asyncio` + `pytest-cov` +
`fakeredis` + `httpx`, living under `server/tests/`, with
`--import-mode=importlib` (matching cttc's own reason: avoids basename
collisions once `tests/{common,listener,server}/` subpackages exist).
This is the resolution of `{{TEST_LOCATIONS}}` in `rules/Rules-of-Rules.md`
§2 for the server side.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4/§10.
- Implemented: `server/pyproject.toml`'s `[tool.pytest.ini_options]`,
  `server/tests/test_smoke.py`.
- Tested: `uv run pytest` → `1 passed` (verified 2026-08-23, pytest 9.1.1).
- Related rules: `env-RUNTIME-001`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
