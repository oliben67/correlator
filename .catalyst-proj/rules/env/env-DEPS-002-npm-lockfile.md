## Rule metadata

- **Type**: `env`
- **Domain**: `DEPS`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-002`

## Rule

JS/TS dependencies are declared in `app/package.json` and pinned via a
committed `app/package-lock.json`, using plain npm — matching cttc's own
convention exactly (`docs/roadmap/cttc-to-correlator-port.md` §4.4: "no
proposal to switch to pnpm/yarn without a concrete reason to").

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4.
- Implemented: `app/package.json`, `app/package-lock.json` (created by
  `npm install`, committed).
- Tested: `npm install` completes clean (verified 2026-08-23, 54 packages,
  0 vulnerabilities).
- Related rules: `env-RUNTIME-002`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
