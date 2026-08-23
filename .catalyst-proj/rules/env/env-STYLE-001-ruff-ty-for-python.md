## Rule metadata

- **Type**: `env`
- **Domain**: `STYLE`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-001`

## Rule

Python code is linted and formatted with `ruff` (one tool, no separate
flake8/isort/black) and type-checked with `ty` (Astral's Rust-based
checker, not mypy) — exactly cttc's own toolchain, carried forward
unchanged.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4 (verified
  directly against cttc's `pyproject.toml`: `ruff>=0.7`, `line-length=100`,
  `target-version=py312`, rules `E,F,I,UP,B,ASYNC`; `ty>=0.0.71`).
- Implemented: `server/pyproject.toml`'s `[tool.ruff]`, `[tool.ruff.lint]`,
  `[tool.ty.environment]`.
- Tested: `uv run ruff check .` → "All checks passed!"; `uvx ty check` →
  "All checks passed!" (verified 2026-08-23, ruff 0.16.4, ty 0.0.74).
- Related rules: `env-RUNTIME-001`, `env-DEPS-001`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
