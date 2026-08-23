# Global rules index

Authoritative index of every rule document and every concrete rule file
under `rules/`, per `Rules-of-Rules.md` §5/§8 (INV-8). A rule not listed
here is considered orphaned.

## Rule documents

| Prefix | Document | Type directory |
|---|---|---|
| `cor` | [`core/core-rules.md`](core/core-rules.md) | `rules/core/` |
| `env` | [`env/env-rules.md`](env/env-rules.md) | `rules/env/` |
| `rr` | [`Rules-of-Rules.md`](Rules-of-Rules.md) | *(this file — meta-rules, inline)* |

## Rules

| ID | Status | File |
|---|---|---|
| `cor-CORE-001-telemetry-log-correlation` | ❌ not implemented | [`core/cor-CORE-001-telemetry-log-correlation.md`](core/cor-CORE-001-telemetry-log-correlation.md) |
| `env-RUNTIME-001-python-uv-for-sump-server` | ✅ working | [`env/env-RUNTIME-001-python-uv-for-sump-server.md`](env/env-RUNTIME-001-python-uv-for-sump-server.md) |
| `env-RUNTIME-002-node-npm-typescript-for-app` | ✅ working | [`env/env-RUNTIME-002-node-npm-typescript-for-app.md`](env/env-RUNTIME-002-node-npm-typescript-for-app.md) |
| `env-DEPS-001-python-lockfile-and-direct-deps` | ✅ working | [`env/env-DEPS-001-python-lockfile-and-direct-deps.md`](env/env-DEPS-001-python-lockfile-and-direct-deps.md) |
| `env-DEPS-002-npm-lockfile` | ✅ working | [`env/env-DEPS-002-npm-lockfile.md`](env/env-DEPS-002-npm-lockfile.md) |
| `env-STYLE-001-ruff-ty-for-python` | ✅ working | [`env/env-STYLE-001-ruff-ty-for-python.md`](env/env-STYLE-001-ruff-ty-for-python.md) |
| `env-STYLE-002-biome-tsc-for-js-ts` | ✅ working | [`env/env-STYLE-002-biome-tsc-for-js-ts.md`](env/env-STYLE-002-biome-tsc-for-js-ts.md) |
| `env-TEST-001-pytest-for-sump-server` | ✅ working | [`env/env-TEST-001-pytest-for-sump-server.md`](env/env-TEST-001-pytest-for-sump-server.md) |
| `env-TEST-002-vitest-for-app` | ✅ working | [`env/env-TEST-002-vitest-for-app.md`](env/env-TEST-002-vitest-for-app.md) |
| `env-CI-001-github-actions-on-push` | ✅ working | [`env/env-CI-001-github-actions-on-push.md`](env/env-CI-001-github-actions-on-push.md) |
| `env-DEVENV-001-local-setup-documented-in-readme` | ✅ working | [`env/env-DEVENV-001-local-setup-documented-in-readme.md`](env/env-DEVENV-001-local-setup-documented-in-readme.md) |
| `env-LAYOUT-001-app-and-server-top-level-siblings` | ✅ working | [`env/env-LAYOUT-001-app-and-server-top-level-siblings.md`](env/env-LAYOUT-001-app-and-server-top-level-siblings.md) |
| `rr-META-001` … `rr-META-009` | ✅ working (process rules) | inline in [`Rules-of-Rules.md`](Rules-of-Rules.md) |

## Domains

| Code | File |
|---|---|
| `CORE` | [`domains/cor-CORE-telemetry-log-correlation.md`](domains/cor-CORE-telemetry-log-correlation.md) |
| `RUNTIME` | [`domains/env-RUNTIME-language-and-package-manager.md`](domains/env-RUNTIME-language-and-package-manager.md) |
| `DEPS` | [`domains/env-DEPS-dependency-policy.md`](domains/env-DEPS-dependency-policy.md) |
| `STYLE` | [`domains/env-STYLE-lint-and-format-tooling.md`](domains/env-STYLE-lint-and-format-tooling.md) |
| `TEST` | [`domains/env-TEST-framework-and-locations.md`](domains/env-TEST-framework-and-locations.md) |
| `CI` | [`domains/env-CI-continuous-integration.md`](domains/env-CI-continuous-integration.md) |
| `DEVENV` | [`domains/env-DEVENV-local-development-setup.md`](domains/env-DEVENV-local-development-setup.md) |
| `LAYOUT` | [`domains/env-LAYOUT-repository-module-layout.md`](domains/env-LAYOUT-repository-module-layout.md) |
