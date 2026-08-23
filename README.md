# correlator
Correlate container telemetry (CPU / memory / network) with service logs.

## Development

Two components, each with its own toolchain (governed by
[`.catalyst-proj/rules/env/env-rules.md`](.catalyst-proj/rules/env/env-rules.md)):

- **`server/`** — the Sump server (Python 3.12, [uv](https://docs.astral.sh/uv/)):
  ```
  cd server
  uv sync --all-extras --dev
  uv run ruff check .      # lint + format check
  uvx ty check              # type-check
  uv run pytest             # test
  ```
- **`app/`** — the Electron/React client (Node.js, npm):
  ```
  cd app
  npm install
  npm run lint               # Biome
  npm run typecheck          # tsc --noEmit
  npm run test               # Vitest
  ```

CI (`.github/workflows/ci.yml`) runs all six checks on every push and pull
request. Both directories are currently an empty tooling scaffold — see
[`docs/roadmap/cttc-to-correlator-port.md`](docs/roadmap/cttc-to-correlator-port.md)
for what actually gets built in each, phase by phase.
