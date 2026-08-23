## Rule metadata

- **Type**: `env`
- **Domain**: `STYLE`
- **Status**: ✅ working
- **Targets**: `env-RUNTIME-002`

## Rule

JS/TS code is linted and formatted with `Biome` (one tool, no separate
ESLint/Prettier — cttc had **no** linter/formatter at all; Biome fills
that gap rather than assembling the older two-tool combination) and
type-checked with `tsc --noEmit` in strict mode.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4.4 (explicit
  finding: cttc's `package.json` has zero lint/format tooling; Biome
  chosen as "the closest JS/TS equivalent to ruff's single-binary
  philosophy").
- Implemented: `app/biome.json` (recommended preset, 2-space/double-quote
  formatting), `app/renderer/src/tsconfig.json` (`strict: true`).
- Tested: `npm run lint` (`biome check .`) → "Checked 6 files... No fixes
  applied."; `npm run typecheck` (`tsc --noEmit -p renderer/src`) → clean
  (verified 2026-08-23, Biome 2.5.10, TypeScript ^7.0.2). `biome.json`'s
  `linter.rules.preset` value was corrected from `biome migrate`'s
  incorrect `"none"` output to the actual-intended `"recommended"` during
  this same verification pass — see `biome init`'s own canonical output,
  cross-checked directly.
- Related rules: `env-RUNTIME-002`, `env-DEPS-002`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
