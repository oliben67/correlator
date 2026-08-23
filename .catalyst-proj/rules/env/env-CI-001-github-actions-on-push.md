## Rule metadata

- **Type**: `env`
- **Domain**: `CI`
- **Status**: ✅ working
- **Targets**: `env-STYLE-001`, `env-STYLE-002`, `env-TEST-001`, `env-TEST-002`

## Rule

`.github/workflows/ci.yml` runs on every `push` and `pull_request`, with
two jobs: `server` (`uv sync`, `ruff check`, `ty check`, `pytest`) and
`app` (`npm ci`, Biome, `tsc --noEmit`, `vitest run`). This is explicitly
what cttc never had — its only GitHub Actions workflow was a
manual-dispatch Docker-image push, not test-on-push CI
(`docs/roadmap/cttc-to-correlator-port.md` §3.7/§10).

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §10, Phase 0.
- Implemented: `.github/workflows/ci.yml`.
- Tested: every command the workflow runs (`uv sync --all-extras --dev`,
  `uv run ruff check .`, `uvx ty check`, `uv run pytest`, `npm install`,
  `npm run lint`, `npm run typecheck`, `npm run test`) was run directly
  and verified clean on 2026-08-23 (see `env-RUNTIME-001/002`,
  `env-STYLE-001/002`, `env-TEST-001/002`'s own Notes). The workflow
  itself has not yet run on GitHub's runners (no push/PR triggered it
  yet) — flagged as ⚠️ rather than a hard blocker, since every step it
  runs is independently proven; the first real push will confirm the
  workflow file's own YAML is valid end-to-end.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
