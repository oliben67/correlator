## Rule metadata

- **Type**: `env`
- **Domain**: `TEST`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-002`

## Rule

App tests use `Vitest`, living alongside source under
`app/renderer/src/**/*.test.ts`, replacing cttc's Node built-in test
runner (`docs/roadmap/cttc-to-correlator-port.md` §4/§10). This is the
resolution of `{{TEST_LOCATIONS}}` in `rules/Rules-of-Rules.md` §2 for
the app side.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4/§10.
- Implemented: `app/vitest.config.ts`,
  `app/renderer/src/__tests__/smoke.test.ts`.
- Tested: `npm run test` (`vitest run`) → `Test Files 1 passed (1)`,
  `Tests 1 passed (1)` (verified 2026-08-23, Vitest 3.2.7).
- Related rules: `env-RUNTIME-002`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
