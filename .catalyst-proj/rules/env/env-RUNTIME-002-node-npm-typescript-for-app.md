## Rule metadata

- **Type**: `env`
- **Domain**: `RUNTIME`
- **Status**: ✅ working
- **Targets**: none (foundational rule)

## Rule

The Electron/React client (`app/`) is Node.js + npm + TypeScript (strict
mode). Electron, React, Jotai, and electron-builder are the decided
target application stack (`docs/roadmap/cttc-to-correlator-port.md` §4)
but are **not** installed into this scaffold yet — they land as
`app/package.json` dependencies when Phase 4 of that roadmap actually
starts building the app shell, per the greenfield path's own principle
that real application code is normal `REQ-`-driven work, not part of the
tooling pass.

## Notes

- Source: `docs/roadmap/cttc-to-correlator-port.md` §4 (unchanged from
  cttc: Node/npm/TypeScript), §4.4 dev tooling.
- Implemented: `app/package.json` (`typescript` devDependency),
  `app/renderer/src/tsconfig.json` (strict mode, matches cttc's own
  config with `jsxImportSource` retargeted from `preact` to `react` ahead
  of Phase 4).
- Tested: `cd app && npm install && npm run typecheck` completes clean
  (verified 2026-08-23, Node v26.7.0, TypeScript ^7.0.2, `tsc --noEmit`
  against `app/renderer/src/version.ts`).
- Related rules: `env-DEPS-002`, `env-STYLE-002`, `env-TEST-002`.

## Contents

- Rule
- Notes

## Known Bugs — Quick Index

*(empty — no bugs filed against this rule yet.)*
