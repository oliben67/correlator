## Rule metadata

- **Type**: `env`
- **Domain**: `LAYOUT`
- **Status**: ✅ working
- **Targets**: none (foundational rule)

## Rule

`app/` (Electron/React client) and `server/` (Python Sump) are top-level
sibling directories, not nested — unlike cttc, which nested its server as
`app/server-logsump/` and `app/log-sump-extended/`. `docs/` holds
documentation (including the port roadmap), `.catalyst-proj/` holds this
framework's own deployment. First-party Sump plugins (starting with SSH,
`docs/roadmap/cttc-to-correlator-port.md` §5.4) are expected to live under
`server/plugins/<name>/` as their own installable packages during early
development, extractable to independent repositories later if/when they
need independent versioning — mirroring the `log-sump` → `log-sump-extended`
precedent, not a commitment to extract on day one.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §7 (secondary-Sump
  federation — the Sump is an independently-deployable, potentially-remote
  service, not a sub-component of the Electron app, which is why it isn't
  nested under `app/` the way cttc nested `server-logsump`).
- Implemented: `app/`, `server/`, `docs/`, `.catalyst-proj/` — the actual
  top-level tree.
- Tested: not independently testable (a structural/organizational rule,
  not a tool invocation) — verified by inspection that the tree matches
  what's stated.
- Related rules: none yet.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
