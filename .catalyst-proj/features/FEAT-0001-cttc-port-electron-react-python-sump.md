# `FEAT-0001` — Port cttc to correlator (Electron/React/Python Sump architecture)

| Field | Value |
|---|---|
| **ID** | `FEAT-0001` |
| **Filename** | `FEAT-0001-cttc-port-electron-react-python-sump.md` |
| **Status** | planned |
| **Opened** | 2026-08-23 |
| **Area** | whole-product architecture (app + server) |
| **Roadmap** | *(none — not triaged from an ingested `development/roadmaps/<name>.md` item)* |
| **Requirement(s)** | *(none yet — each phase in the roadmap opens its own `REQ-NNNN` when work on it starts, per `CODE-OF-CONDUCT.md` §1)* |
| **Signed-off-by** | Olivier Steck *(retroactively signed during `/sync-framework 0.8.0` — this entry predates INV-16)* |

## Description

Rewrite cttc (an existing Electron app + log-sump-based Docker log/telemetry
correlation tool) as correlator, on a new stack (Electron/React/TypeScript/
Jotai/Babel/Webpack/electron-builder/Vitest for the app; Python/Redis/
Fluent Bit/OpenTelemetry for the server), with three structural changes:
Gateway → **Sump** (containerized, pluggable transports, SSH first), Docker
host → **data stream** (plugin-sourced, not Docker-only), and a new
**secondary-Sump federation** capability (a data-stream host can be promoted
to its own independently-connectable Sump).

## Motivation

correlator's core value — click a log line to recenter the graph, click a
graph point to jump to the corresponding logs — is proven in cttc. The
rewrite exists to generalize the transport/data-source layer (today
hardcoded to Docker+SSH) into a real plugin system, and to add multi-Sump
federation and a proper local catalog/data-model (recordings, tracks,
`.correlator` projects), while carrying the correlation UX forward unchanged.

## Rough scope

Full detail lives in the roadmap document — this entry is a pointer per
`rules/Rules-of-Rules.md` §9, not a duplicate of it:
[`docs/roadmap/cttc-to-correlator-port.md`](../../docs/roadmap/cttc-to-correlator-port.md).

In: Sump provisioning/catalog, SSH data-stream plugin, App shell + core
correlation UX parity, recording/track/project data model, logstream
data-stream plugin, secondary-Sump federation, packaging parity.

Later/exploratory: Kibana-oriented data-stream plugin (§6.5 of the roadmap).

## Open questions

See roadmap §12 in full; the two biggest are per-user identity for Sump auth
(needed for per-user private data streams, §7.3) and a required upstream
survey of `log-sump` itself before the logstream plugin's design is final
(§6.4).

## Related

None yet — this is the first `FEAT-` entry in this deployment.
