## Rule metadata

- **Type**: `env`
- **Domain**: `DEVENV`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-001`, `env-RUNTIME-002`

## Rule

Local setup for both components is documented in the root `README.md`'s
"Development" section (plain `uv sync`/`npm install` steps — no
devcontainer/Nix/etc., matching cttc, which used none either).

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4 (proportionality
  principle: don't introduce setup machinery cttc itself never needed).
- Implemented: `README.md` "Development" section.
- Tested: the documented commands are exactly the ones verified clean
  under `env-RUNTIME-001`/`env-RUNTIME-002` above — a new contributor
  following the README reproduces the same verified state.
- Related rules: `env-RUNTIME-001`, `env-RUNTIME-002`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
