# Environment rules (`env`)

The dev-environment rule document, per catalyst's greenfield instantiation
path (`INSTANTIATION-GUIDE.md` §3, framework v0.7.0+). Governs the
toolchain and workflow decisions for both of correlator's components —
`server/` (the Sump) and `app/` (the Electron/React client) — established
as rules *before* application code exists, per that path's own principle.
See [`../Rules-of-Rules.md`](../Rules-of-Rules.md) for the meta-rules
governing this document.

## Contents

- [Language and package manager](#language-and-package-manager) — `RUNTIME`
- [Dependency policy](#dependency-policy) — `DEPS`
- [Lint and format tooling](#lint-and-format-tooling) — `STYLE`
- [Test framework and locations](#test-framework-and-locations) — `TEST`
- [Continuous integration](#continuous-integration) — `CI`
- [Local development setup](#local-development-setup) — `DEVENV`
- [Repository / module layout](#repository--module-layout) — `LAYOUT`

## Language and package manager

> **Domain:** `RUNTIME` — see [`../domains/env-RUNTIME-language-and-package-manager.md`](../domains/env-RUNTIME-language-and-package-manager.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-RUNTIME-001-python-uv-for-sump-server`](env-RUNTIME-001-python-uv-for-sump-server.md) | ✅ working | Python ≥3.12 + uv for `server/`. |
| [`env-RUNTIME-002-node-npm-typescript-for-app`](env-RUNTIME-002-node-npm-typescript-for-app.md) | ✅ working | Node.js + npm + TypeScript for `app/`. |

## Dependency policy

> **Domain:** `DEPS` — see [`../domains/env-DEPS-dependency-policy.md`](../domains/env-DEPS-dependency-policy.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-DEPS-001-python-lockfile-and-direct-deps`](env-DEPS-001-python-lockfile-and-direct-deps.md) | ✅ working | uv-managed, `uv.lock` committed, direct git deps only when pinned+justified. |
| [`env-DEPS-002-npm-lockfile`](env-DEPS-002-npm-lockfile.md) | ✅ working | npm-managed, `package-lock.json` committed. |

## Lint and format tooling

> **Domain:** `STYLE` — see [`../domains/env-STYLE-lint-and-format-tooling.md`](../domains/env-STYLE-lint-and-format-tooling.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-STYLE-001-ruff-ty-for-python`](env-STYLE-001-ruff-ty-for-python.md) | ✅ working | ruff (lint+format) + ty (types) for `server/`. |
| [`env-STYLE-002-biome-tsc-for-js-ts`](env-STYLE-002-biome-tsc-for-js-ts.md) | ✅ working | Biome (lint+format) + `tsc --noEmit` for `app/`. |

## Test framework and locations

> **Domain:** `TEST` — see [`../domains/env-TEST-framework-and-locations.md`](../domains/env-TEST-framework-and-locations.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-TEST-001-pytest-for-sump-server`](env-TEST-001-pytest-for-sump-server.md) | ✅ working | pytest stack, `server/tests/`. |
| [`env-TEST-002-vitest-for-app`](env-TEST-002-vitest-for-app.md) | ✅ working | Vitest, `app/renderer/src/**/*.test.ts`. |

## Continuous integration

> **Domain:** `CI` — see [`../domains/env-CI-continuous-integration.md`](../domains/env-CI-continuous-integration.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-CI-001-github-actions-on-push`](env-CI-001-github-actions-on-push.md) | ✅ working | GitHub Actions, both jobs, on every push/PR. |

## Local development setup

> **Domain:** `DEVENV` — see [`../domains/env-DEVENV-local-development-setup.md`](../domains/env-DEVENV-local-development-setup.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-DEVENV-001-local-setup-documented-in-readme`](env-DEVENV-001-local-setup-documented-in-readme.md) | ✅ working | Plain `uv sync`/`npm install`, documented in root `README.md`. |

## Repository / module layout

> **Domain:** `LAYOUT` — see [`../domains/env-LAYOUT-repository-module-layout.md`](../domains/env-LAYOUT-repository-module-layout.md).

| Rule | Status | Summary |
|---|---|---|
| [`env-LAYOUT-001-app-and-server-top-level-siblings`](env-LAYOUT-001-app-and-server-top-level-siblings.md) | ✅ working | `app/` and `server/` as top-level siblings, not nested. |

## Known Bugs — Quick Index

*(empty — no bugs filed yet.)*
