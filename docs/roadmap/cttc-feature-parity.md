# CTTC ↔ correlator feature parity — side-by-side comparison & next roadmap

> Status: proposed. Continuation of
> [`cttc-to-correlator-port.md`](cttc-to-correlator-port.md) (Phases 0–10,
> all Done — see `development/BACKLOG.md`). Grounded in a direct survey of
> `cttc` (`/Users/oliviersteck/sources/cttc`) — its source tree, its own
> retrofitted catalyst deployment (451 rules across 36 domains,
> `/Users/oliviersteck/.claude/projects/-Users-oliviersteck-sources-cttc/.criterion`),
> its 112-bug history, and `MANUAL.md` — cross-referenced against
> correlator's current catalyst deployment (13 `core` domains) and a direct
> read of the relevant source, 2026-09-12.

## 0. Purpose

The original port (Phases 0–10) delivered the *architecture*: a
containerized, pluggable Sump; a plugin-sourced data-stream model; secondary
Sumps as first-class peers; the recording/track/project file formats; the
correlation engine's pure functions. It deliberately did **not** attempt
feature-for-feature UI parity with cttc — most of cttc's actual day-to-day
surface (gateway/docker-host dialogs, events, live recording controls, the
sidebar, status bar, preferences) was out of scope by design, tracked only
as vocabulary mappings and dialog-inventory tables (§9.2 of the original
doc), not built.

This document is the second survey the original doc's own §13 anticipated:
now that the architecture is real, compare cttc's actual shipped behavior
(all 451 of its rules, not just the ones already cited) against what
correlator has today, domain by domain, and turn the gap into a concrete
next-phase roadmap.

## 1. Three findings that change the shape of the next roadmap

These aren't gaps in the "haven't built it yet" sense — they're structural
facts worth fixing the plan around before writing more code.

### 1.1 The correlation engine is built and tested, but invisible

`app/renderer/src/correlate/` (`Chart.tsx`, `EventDensityLane.tsx`,
`LogPanel.tsx`, `atoms.ts`, `chartDraw.ts`, `correlate.ts`,
`densityBuckets.ts`, `logWindow.ts`, `timeMapping.ts`) is real,
unit-tested code implementing exactly cttc's `CHART`/`LOGP` domains' pure
math (time↔pixel mapping, click-correlate `setCursor`/`recenterOn`,
event-density bucketing). **`App.tsx` imports none of it.** The entire
"non-negotiable, must not regress" UX the original roadmap's §2 was
built around exists only as dormant, disconnected modules. Wiring this in
is not new design work — it's assembly of already-proven pieces — and
should be the first thing the next phase does, both because it's cheap
and because it's the literal product thesis.

### 1.2 Single-connection model vs. cttc's multi-gateway-with-switcher

`installLocalSump`/`connectExistingSump`/`installRemoteSump` all gate on
`hasLiveSump()` — the "Add Sump" chooser (§`cor-CORE.PROVISION-006`) only
ever appears when the catalog has zero live rows, and nothing lets a user
add a *second* Sump connection or switch between existing ones once one
exists. The underlying catalog schema doesn't forbid multiple `sumps`
rows (secondary-Sump federation already creates more than one), but
there is no UI concept of "which Sump is active" the way cttc's `GATE`
domain (43 rules: New/Edit/Uninstall/Switch, a status-pill switcher)
has. This needs a decision — see §5.1 — before Phase 12 designs a
sump-management UI, since "add one more" vs. "manage several, switch
between them" are different UIs.

### 1.3 Recording is export-shaped, not session-shaped

correlator's only recording-adjacent IPC (`download-recording`,
`download-track`) queries an already-retained time range out of the
Sump's Redis Streams and packages it — there is no `start`/`pause`/
`resume`/`stop` concept anywhere in `shell.ts`, `provision.ts`, or the
server. cttc's `REC` (client, 19 rules) + `RECS` (server, 13 rules) +
`SEG` (5 rules) + `ORPHAN` (5 rules) domains implement a genuine
multi-segment, pausable, crash-recoverable **recording session** — a
materially different mechanism, not a renamed version of what exists
today. `cor-CORE.ARCHIVE-001`'s `*.recording`/`*.track` file format is
still the right target shape; what's missing is the live control surface
and the server-side session lifecycle that produces one. Flagged in §5.2.

## 2. Domain-by-domain comparison

Legend: **✅ ported** (equivalent exists and is reachable in the app) ·
**⚙️ built, unwired** (code exists, tested, not connected to any UI) ·
**⚠️ partial** (some mechanism exists, materially thinner than cttc's) ·
**❌ not started** · **🔄 different by design** (correlator deliberately
does this differently; not a gap).

### cttc UI domains (13 domains, 258 rules)

| cttc domain | Rules | correlator status | Notes |
|---|---|---|---|
| `BOOT` — boot/first-run/gateway connection | 12 | ⚠️ partial | `cor-CORE.PROVISION-006`'s chooser covers the connect/deploy decision, but no splash screen, no step narration, no fallback cascade, no orphaned-state cleanup (correlator has no tunnels to orphan — §1.3-adjacent, not applicable the same way). |
| `GATE` — gateway new/edit/uninstall/switch | 43 | ⚠️ partial | Connect/Deploy exist (`PROVISION-006`); no Edit, no Uninstall UI (`uninstallLocal`/`uninstallRemote` exist in `provision.ts` with zero UI callers), no switcher — see §1.2. |
| `DHOST` — docker host set/edit/disconnect/remove | 30 | ❌ not started | `list-data-sources`/`set-data-source-privacy` IPC exists (`cor-CORE.FEDERATION-002`) with **zero UI callers** — `App.tsx` never invokes them. |
| `REC` — recording (client) | 19 | ❌ not started | See §1.3. |
| `EVT` — event creation/editing | 25 | ❌ not started | No event/trigger concept anywhere in correlator. |
| `LIVE` — live tracking / analysis mode | 19 | ⚙️ built, unwired | `correlate/atoms.ts` has the view-state shape; no live/analysis toggle exists because nothing renders it yet. |
| `CHART` — timeline/chart math | 26 | ⚙️ built, unwired | `chartDraw.ts`/`timeMapping.ts` — see §1.1. Metric per-pixel bucketing (cttc's hard-won "max, not mean" lesson, `br-BUCKET-002`) **doesn't exist yet either way** — `chartDraw.ts` draws raw points, no downsampling. Worth building it right the first time — see §5.4. |
| `LOGP` — log panels | 10 | ⚙️ built, unwired | `LogPanel.tsx`/`logWindow.ts` — virtualized, tested, unwired. |
| `SBAR` — status bar & history | 11 | ❌ not started | No status bar in `App.tsx` at all. |
| `SIDE` — sidebar / window management | 22 | ❌ not started | `App.tsx` is a single flat `<div>` — no sidebar, no pop-out windows. |
| `PREF` — preferences dialog | 10 | ❌ not started | No settings surface of any kind. |
| `EXPORT` — sample export/snapshot, active-view model | 23 | ⚠️ partial | Download IPC exists (`cor-CORE.PROJECT-003`) with no UI trigger; no snapshot mechanism; no "active view" concept (moot without a UI to have multiple views in). |
| `FMT` — formatting helpers | 8 | ⚠️ partial | Scattered inline formatting exists where needed; no centralized, audited module the way cttc's `FMT` domain is. Low priority — port opportunistically alongside whichever UI needs it. |

### cttc Business domains (23 domains, 193 rules)

| cttc domain | Rules | correlator status | Notes |
|---|---|---|---|
| `CONN` — SSH transport | 10 | ✅ ported | `cor-CORE.DATASTREAM-002`, paramiko-equivalent via `provision.ts`'s ssh/scp calls. |
| `PROV` — provisioning/image resolution/uninstall | 13 | ✅ ported (install) / ⚠️ (uninstall) | Install flow fully covered (`PROVISION-002`/`-006`); uninstall functions exist, no UI. |
| `NET` — network binding/exposure policy | 10 | ⚠️ partial | `validateComposeFile`'s `network_mode: host`/`0.0.0.0` rejection (BUG-0025 lineage) covers the highest-severity lesson; no explicit review of Redis loopback-binding/auth posture in `docker-compose.yml` against cttc's `br-NET-*` catalog — worth a quick audit, not a rebuild (§5.4). |
| `SSHK` — SSH key handling & security | 9 | ❌ not started | The remote-deploy form (`AddSump.tsx`) takes a raw SSH key **path** and passes it straight to `ssh -i`; cttc's copy-into-`~/.cttc/keys/`+format-check+chmod-lockdown module has no correlator equivalent at all. |
| `TUNL` — local transport / tunnel lifecycle | 9 | 🔄 different by design | `cor-CORE.PROVISION-002`'s own docs are explicit: SSH is one-time provisioning only, ongoing traffic is always plain HTTP, never tunneled. Deliberate simplification, not a gap. |
| `DEDUP` — source collector identity/dedup | 12 | ⚠️ partial | Sump-side collector/entity-identity design not separately audited against cttc's host/kind/source-id collision-chain lessons (`br-DEDUP-006/010/011/012`) — worth a targeted review before data-stream volume grows (§5.4). |
| `REDIS` — Redis-backed durable store | 23 | ⚠️ partial | `cor-CORE.QUERY-001`'s per-daemon-per-kind Streams exist; no explicit retention/eviction-policy/persistence-mode review against cttc's hard-won lessons (`maxmemory-policy`, `set_ttl` edge cases, bulk-import queue-capacity dropping) — real risk of rediscovering the same bugs (§5.4). |
| `PERSIST` — local JSON persistence | 9 | 🔄 different by design | Superseded by `cor-CORE.PROVISION-001`'s SQLite catalog — an intentional improvement the original roadmap already called out (§5.2), not a gap. |
| `BUILD` — container build/deploy constraints | 6 | ⚠️ partial | `server/Dockerfile` written fresh; not explicitly checked against cttc's specific lessons (CLI-only image, wildcard-COPY caution, `--no-dev` sync) — likely fine, worth a quick confirm (§5.4). |
| `APPVER` — release/version metadata | 1 | ❌ not started | No About dialog exists to show one. |
| `ORCH` — boot sequence / background-loop orchestration | 10 | ⚠️ partial — **highest-priority gap in this table** | cttc's own audit calls its tick-loop-wide unhandled-exception bug "the single highest-severity finding in this whole audit" (`br-ORCH-004`). correlator's plugin manager has a `register_background_task` hook (`cor-CORE.DATASTREAM-003`) with **no confirmed per-plugin exception isolation** — one misbehaving background task could plausibly take down every other plugin's polling the same way. Verify/fix before adding more background-task plugins (§5.3). |
| `AUTO` — always-on collection lifecycle | 5 | 🔄 different by design | Superseded by the retired auto-start (`PROVISION-005`) → interactive chooser (`PROVISION-006`) redesign — different trigger model, deliberate. |
| `RECS` — recording session lifecycle (server) | 13 | ❌ not started | See §1.3. |
| `EVTO` — event trigger orchestration (server) | 17 | ❌ not started | No event system. |
| `SCHED` — scheduler firing policy | 8 | ❌ not started | No scheduling. |
| `RBUF` — rolling buffer window policy | 6 | ❌ not started | No snapshot/rolling-buffer mechanism. |
| `EMBED` — embedded server lifecycle | 5 (retired in cttc) | n/a | Retired in cttc itself; correlator never had a non-containerized mode to begin with. |
| `QUEUE` — queue/capacity limits & poll intervals | 10 | ⚠️ partial | `cor-CORE.QUERY-002`'s pagination has *some* limits; no comprehensive, centrally-documented catalog of every queue/interval magic number the way cttc's `QUEUE` domain is. |
| `BUCKET` — bucketing/resolution policy | 3 | ❌ not started (same finding as `CHART` above) | No metric downsampling exists yet at all — when it's built, apply cttc's "max, not mean" lesson from day one (§5.4). |
| `SEG` — segment/merge boundaries | 5 | ❌ not started | Tied to §1.3 — no live recording sessions to segment. |
| `ORPHAN` — crash-recovery reclaim policy | 5 | ❌ not started | Tied to §1.3 — no live session/tunnel state to recover. |
| `PLUG` — server plugin/extension routing | 4 | ⚠️ partial | `cor-CORE.PLUGIN-001` is explicitly modeled on the pytest/pluggy lesson cttc's `PLUG` domain motivated (entry-points, not directory-scanning — already the right call per the original roadmap's §5.4). Not confirmed: whether correlator's plugin manager rejects a route-path/method conflict the way cttc's `create_app()` diffs `(path, method)` pairs (`br-PLUG-001`) — worth a direct test (§5.4). |
| `WIRE` — wire protocol Content-Type strictness | 1 | 🔄 not applicable | correlator's Sump was built on FastAPI/Pydantic from day one, not migrated from a looser hand-rolled server — the historical bug class this documents doesn't have an equivalent migration moment. Good lesson to keep in mind if a compat shim is ever added for a different client. |

## 3. cttc's own top open items worth inheriting

From cttc's 39 open bugs, the two with real product-behavior impact that
correlator would otherwise be positioned to independently rediscover:

- **Remote SSH key never actually threaded through the connection**
  (`BUG-000099`) — cttc's own regression of a previously-fixed bug.
  correlator's remote-deploy form (§`SSHK` above) has the same shape of
  risk already, before ever fixing it once: verify `installRemoteSump`'s
  `sshKey` param is actually honored end-to-end, not just accepted.
- **Daemon/gateway registry can't survive a restart** (`BUG-000060`) —
  an architecture-level gap (Redis wiped before the registry is read)
  cttc still hasn't resolved. correlator's SQLite catalog (`PROVISION-001`)
  is structurally immune to this exact failure (the catalog isn't stored
  in the same ephemeral store as the records it retains), but worth an
  explicit note in `PROVISION-001`'s own rule file confirming this is a
  deliberate structural avoidance, not an accident.

## 4. Proposed phases (continuing the original roadmap's numbering)

| Phase | Goal | Key deliverables | Builds on | Why this order |
|---|---|---|---|---|
| **11. Wire the correlation engine into the app shell** | Make the protected-core UX in §1.1 actually visible/usable | A data-stream picker (minimal — list + toggle, no styling investment yet); wire `Chart`/`EventDensityLane`/`LogPanel`/`atoms` into `App.tsx`; a live/analysis mode toggle | `correlate/*` (already built, tested) | Cheapest, highest-value phase — assembly, not design. Also the literal product thesis; everything else is easier to justify once this is real. |
| **12. Sump & data-stream management UI** | `GATE`+`DHOST` parity | Sump list/switch/edit/uninstall UI; data-stream picker/toggle wired to `list-data-sources`/`set-data-source-privacy` | Phase 11's picker, existing IPC (`uninstallLocal/Remote`, `FEDERATION-002`) | Needs §5.1's decision first (single vs. multi-sump UI model). |
| **13. Live recording sessions** | `REC`+`RECS`+`SEG`+`ORPHAN` parity | Start/Pause/Resume/Stop controls; server-side session lifecycle; multi-segment archives; crash-recovery resume choice | `cor-CORE.ARCHIVE-001`'s file format (target shape already right) | Needs §5.2's decision first (adopt cttc's session model vs. a correlator-native equivalent). |
| **14. Events & scheduling** | `EVT`+`EVTO`+`SCHED`+`RBUF` parity | Trigger conditions (metric threshold/log regex), snapshot/recording actions, one-shot+cron scheduling, rolling buffer | Phase 13 (actions reuse recording primitives) | New subsystem; naturally sequenced after recording exists to trigger. |
| **15. Snapshots & sample export UI** | `EXPORT`+`FMT` parity | Point-in-time snapshot capture, drag-to-select capture UI, Raw/JSON view, active-view model | Phase 11 (needs a real chart to select a range on) | Shares mechanics with Phase 14's snapshot action. |
| **16. App shell UX parity** | `SIDE`+`SBAR`+`PREF`+`BOOT`+`APPVER` | Sidebar with sections, status bar, preferences dialog, boot splash, About dialog with real version metadata | Phases 11–15 (needs real sections to hold) | Structural chrome — sequenced last among UI phases since it wraps content that needs to exist first. |
| **17. Hardening: apply cttc's hard-won lessons** | Close the ⚠️-partial rows in §2 before they become real bugs | `ORCH` background-task exception isolation (highest priority); Redis retention/eviction review; `DEDUP` entity-identity audit; `SSHK` proper key handling; `BUCKET` max-not-mean when metric downsampling is built; `PLUG` route-conflict test; `NET`/`BUILD` quick audits | cttc's own bug history as a named regression checklist — same technique the original roadmap's §5.5 used for Phase 2 | Can run in parallel with 11–16; not gated on any of them. `ORCH` specifically should not wait — it's a latent risk today. |
| **18. Kibana/Elasticsearch plugin (exploratory)** | Ship what `cor-CORE.DATASTREAM-004` already validated | A real `sump-plugin-kibana` package | `DATASTREAM-004`'s interface validation | Unchanged from the original roadmap's own "later/exploratory" framing — still not a committed deliverable. |

## 5. Open questions needing a decision before implementation

1. **Single-active-Sump vs. multi-Sump-with-switcher** (§1.2, blocking
   Phase 12) — does correlator adopt cttc's full Gateway-switcher model,
   or a lighter "one primary connection, others reachable only via
   federation" model? The catalog schema supports either; the UI design
   differs materially.
2. **Recording session model** (§1.3, blocking Phase 13) — port cttc's
   live start/pause/resume/stop session model close to as-is, or design
   a correlator-native equivalent that still produces `*.recording`/
   `*.track` files? Affects both server-side state machine design and
   how much of `RECS`/`SEG`/`ORPHAN`'s 23 combined rules are directly
   portable vs. need rethinking.
3. **Background-task exception isolation** (§`ORCH`, Phase 17) — should
   be answered by direct testing (does one failing `register_background_task`
   plugin already stop others, or not?) rather than a design decision —
   flagged here so it isn't lost among the larger open questions above.

## 6. Traceability

Continuation of
[`cttc-to-correlator-port.md`](cttc-to-correlator-port.md) §13's own
anticipation of a follow-up survey. Per `CODE-OF-CONDUCT.md` §1, no phase
above starts as real development work without first opening a `REQ-NNNNN`
against it, vetted against `rules/Rules-of-Rules.md` §1 and assigned a
domain — most phases above land under existing domains (`CORE.CORRELATE`,
`CORE.PROVISION`, `CORE.ARCHIVE`, `CORE.PLUGIN`) rather than new ones,
except Phase 14 (events/scheduling), which likely needs its own new
domain given no existing one covers that surface.
