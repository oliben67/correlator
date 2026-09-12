# correlator
Correlate container telemetry (CPU / memory / network) with service logs.

## Development

Two components, each with its own toolchain (governed by the `env` rule
document in this project's catalyst deployment — see "Catalyst deployment"
below):

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

## Catalyst deployment

correlator's development process is governed by an instance of the
[catalyst framework](https://github.com/oliben67/catalyst.git): every
requirement, bug, and piece of house-keeping traces down to a documented
rule (`rules/Rules-of-Rules.md`). The working copy lives in agent-owned
space, not in this repo tree — resolve it via `correlator.catalyst`'s
`agent-source` field. Its own `README.md` documents the full artifact
layout (requirements, rules, features, IAM, reconciliations) and the
slash-command interface (`/create-bug`, `/create-req`, `/sync-framework`,
`/help`, etc.), each wired up as a native command under
`.claude/commands/`.
