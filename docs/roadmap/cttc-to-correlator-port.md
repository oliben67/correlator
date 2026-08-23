# CTTC → correlator port roadmap

> Status: proposed. Traced from [`FEAT-0001`](../../.catalyst-proj/features/FEAT-0001-cttc-port-electron-react-python-sump.md).
> Grounded in a direct code survey of `cttc` (`/Users/oliviersteck/sources/cttc`,
> reached from this repo via `.source/cttc`) and of the `log-sump-extended`
> submodule (`log-sump-container/`) at commit `e2dc824`, 2026-08-23.

## 0. Purpose

correlator is a from-scratch rewrite of cttc onto a new stack, with three
structural changes beyond a technology swap:

1. **Sump** (renamed Gateway) becomes a properly containerized, pluggable-transport
   service instead of a fixed Docker-container-over-HTTP-with-SSH-fallback design.
2. **Data streams** (renamed Docker host) become a plugin-sourced concept —
   Docker-over-SSH is the first plugin, not the only possible one.
3. **Sumps can beget Sumps.** A host reachable as a data stream can be promoted
   to a first-class, independently-connectable Sump of its own — a real mesh,
   not just today's gateway peer-discovery scaffolding.

Everything else — the correlation UX, the recording/track/snapshot model, the
plugin-hostile lessons cttc already learned the hard way — is **preserved and
built on**, not reinvented. Sections III and later cite the exact cttc/log-sump
mechanisms each new piece replaces or extends, so the "why" stays traceable.

## 1. Vocabulary map

| cttc term | correlator term | Notes |
|---|---|---|
| Gateway | **Sump** | Containerized; provisioned locally (Docker present) or remotely over SSH (Docker absent locally). |
| Docker host | **Data stream** | Now plugin-sourced, not hardcoded to Docker+SSH. |
| `~/.cttc/gateways.json` | **correlator instance catalog** (`.correlator/`) | JSON-shaped, SQLite-backed (§5.2), not a flat file. |
| Recording session (`app/server/recording_session.py` lineage, `sample_archive`) | **Recording** (`*.recording`) | Same underlying archive mechanism, renamed. |
| Metric export / capture | **Track** (`*.track`) | A single captured series; a recording contains one or more tracks. |
| Snapshot | **Snapshot** (unchanged name) | Still a point-in-time export to plain `.json`/text — no new binary format. |
| *(none — new)* | **Project** (`*.correlator`) | Workspace file akin to VS Code's `.code-workspace`; organizes tracks/recordings/exports into virtual folders, by reference. |
| Gateway mesh (`gateway_mesh.py`, ownership claim/rotate, `/gateways/sync`) | **Secondary Sump federation** | Same prior art, extended: promotion flow, per-user private data streams. |
| `log_sump.server.app.create_app(extra_routers=...)` | **Sump plugin registration** (§5.4) | Compile-time composition kept as the safe core; wrapped in a formal plugin protocol. |

## 2. Non-negotiable: what must not regress

cttc's actual product value is the **shared-timeline correlation UX**: click a
log line → the chart recenters/highlights on that timestamp (± a few seconds);
click a point on a chart → the log panel jumps to the corresponding lines. This
is implemented today via one shared, clickable timeline over CPU/MEM/NET
charts, one event-density lane per log source, and virtual-scrolled log panels
(`app/renderer/app.js`, `index.html`). **Every phase below is sequenced so this
UX is working end-to-end as early as possible (Phase 5)** and nothing after it
is allowed to degrade it.

## 3. Current state of cttc (as surveyed)

### 3.1 Client
Electron 43 app, **not** a website today. Renderer is mostly hand-rolled
vanilla JS/HTML/CSS (`app.js`, dependency-free canvas charting + virtual-scrolled
log panels) with a partial, incremental TypeScript module carve-out
(`renderer/src/modules/{docker-host,gateway,events,preferences,redis-cli,status-bar}/`)
using `jotai` + `preact` in a few spots (`DockerTargetList.tsx`,
`TransformList.tsx`, `HistoryList.tsx`, `status-bar/index.tsx`) — most state is
still module-level globals and `localStorage`, not a full component tree.
Build: esbuild (`build/build-renderer.js`), TypeScript for type-checking only
(`tsc --noEmit`), electron-builder → NSIS/DMG/AppImage.

### 3.2 Gateway = Sump's predecessor
A Docker container running **log-sump** (github.com/oliben67/log-sump,
generic, CTTC-agnostic — daemon registry, Redis-Streams record store, query
layer, `Transport` ABC, gateway/API auth, mesh routes) **extended by
log-sump-extended** (a thin FastAPI-router shim, `create_app(extra_routers=[router])`,
that reproduces cttc's original wire protocol on top of log-sump's model so the
legacy renderer keeps working unmodified). Four s6-supervised processes per
container: `log-listener`, `fluentd`, `redis` (embedded), `log-server`.
Three connection modes client-side (`app/lib/gateway-registry.js`): `local`
(embedded, provisioned via `ensureLocalContainer()`), `remote` (direct HTTP,
provisioned once over SSH), `remote-tunnel` (client-side `ssh -N -L`
port-forward, fallback only). Auth: shared bearer token, `X-CTTC-Token`
(`app/lib/api-token.js`).

### 3.3 Docker-host connectivity (→ becomes data-stream plugin territory)
`log_sump.common.transport.Transport` ABC, two implementations:
`LocalTransport` (local `docker` CLI subprocess) and `SSHTransport`
(`paramiko`, not the system `ssh` binary, not `docker -H ssh://`; `sudo`
prepended since the SSH account often isn't in the `docker` group). Once
connected: container listing (`containers_listing.py`), log streaming
(`container_listener.py`, `docker logs -f --timestamps`), stats polling
(`container_stats.py`, `system_stats.py`). This `Transport` abstraction is the
single best piece of prior art for the new data-stream plugin interface — it
already anticipates non-Docker transports in its own docstring, it's just never
had a second implementation.

### 3.4 Recording / snapshot / capture mechanism (→ becomes recording/track/snapshot)
Built on `log_sump.common.sample_archive.write_archive`, orchestrated
client-side by `sessions_compat.py`-equivalent logic. Produces
`.cttc-record`/`.cttc-metric` binary archives today, downloaded via
`/legacy/session/{id}/download`. **This is a working mechanism to rename and
reshape, not to build from zero.**

### 3.5 Mesh / ownership scaffolding (→ prior art for secondary Sumps)
`app/server-logsump/src/log_sump/server/routers/gateway.py` +
`gateway_mesh.py`: `/ping`, `/gateways/sync` (peer discovery), `/gateway/ownership/claim|rotate`
(signature-based, using an owner's SSH public key). Real, but currently
single-tenant in spirit — there's no per-user data-stream visibility model
(see §7.3's open question).

### 3.6 Plugin history — read this before designing the new plugin system
cttc **already tried and abandoned** a runtime, directory-scanned,
dynamically-imported plugin loader (`log_sump.server.plugins`, driven by
`Settings.plugins.directory`; the predecessor project `log-sump-plugin` used
it). It was removed in favor of the current compile-time `extra_routers`
composition specifically because of **empty/missing-plugin-directory-at-deploy-time
bugs and state-leak edge cases**. The new Sump/data-stream plugin system
(§5.4, §6.3) must have an answer for those two failure modes, not just
re-invent the directory scanner with different naming.

### 3.7 Testing & CI
Client: Node built-in test runner (`app/test/unit/*.test.js`, 17 files) +
one Electron E2E spec. Server: pytest + pytest-asyncio + fakeredis (41 files
across `log-sump`, plus 5 more in `log-sump-extended` covering compat/sessions/events/log-index).
**No automated test-on-push CI anywhere** — the only GitHub Actions workflow
in the whole tree is a manual-dispatch image-push job in the `releases`
submodule. Fixing this is in scope for Phase 0 (§11), not a someday item.

## 4. Target stack

| Layer | cttc today | correlator target | Change type |
|---|---|---|---|
| UI framework | Vanilla JS + partial Preact | **React + TypeScript** | Rewrite |
| State | Module globals + partial Jotai | **Jotai** (full) | Extend existing choice |
| Bundler / transpile | esbuild | **esbuild** (retained — see §4.1) | Unchanged |
| Packaging | electron-builder | **electron-builder** | Unchanged |
| Unit/UI tests (app) | Node test runner | **Vitest** | Swap |
| Server language | Python 3.12 | **Python** | Unchanged |
| Server framework | FastAPI + uvicorn | **FastAPI + uvicorn** (assumed carried forward — not contradicted by the brief) | Unchanged |
| Event/metric store | Redis (embedded per-container) | **Redis** | Unchanged mechanism; revisit embedded-vs-shared in Phase 1 |
| Log ingestion | Fluentd (Ruby, vendored) | **Fluent Bit** | **Real swap** — not a rename. See §4.2. |
| Observability | none | **OpenTelemetry** | Wholly net-new. See §4.3. |
| Local metadata store | flat JSON (`gateways.json`) | **JSON + SQLite** (§5.2) | New |

### 4.1 Bundler: esbuild retained
Originally scoped as a swap to Webpack + Babel, for wider plugin ecosystem
and more conventional Electron+React+TS starter-template precedent.
**Reconsidered and reversed**: cttc already proves esbuild works well for
this exact app shape (fast rebuilds, native TS/JSX support, simple config),
and the Webpack swap was a speed-for-ecosystem trade-off rather than a hard
requirement — not worth paying for without a concrete need for a
Webpack-only loader/plugin. Phase 4's app shell scaffold builds on cttc's
existing esbuild setup (`build/build-renderer.js`) rather than replacing it;
Babel is dropped along with it (esbuild's own transpiler covers TS/JSX).

### 4.2 Fluentd → Fluent Bit
cttc's Fluentd config + custom Ruby output plugin
(`fluentd/plugin/out_log_sump_redis_list.rb`) is vendored wholesale from
`log-sump` and untouched by `log-sump-extended`. Fluent Bit does not run Ruby
plugins — this is a genuine reimplementation of the log-forwarding hop
(container stdout/stderr → structured record → Redis Stream), most naturally
as a Fluent Bit **output plugin** (Go, or its C plugin API) reproducing the
current `RPUSH`-into-Redis-list contract, or by having Fluent Bit's built-in
Redis output write directly in the shape `log-listener`'s `ingest.consumer`
already expects. Needs its own spike (Phase 1) before committing to one
approach.

### 4.3 OpenTelemetry
Confirmed absent from cttc, log-sump, and log-sump-extended entirely — no
SDK, no OTLP exporter, no instrumentation of any kind. Treat as new
infrastructure: instrument the Sump server (traces across
transport → ingest → query, metrics for stream depth/consumer lag) from
Phase 1 onward so it's load-bearing from day one rather than retrofitted.

### 4.4 Dev tooling
Grounded in cttc's actual `pyproject.toml`/`package.json`, not assumed.

**Python (Sump server) — carried forward as-is, nothing new:**

| Tool | Role | Notes |
|---|---|---|
| **uv** | Package manager / venv (`uv sync --frozen`) | `uv.lock` |
| **ruff** | Lint + format, one tool | `line-length=100`, `target-version=py312`, rules `E,F,I,UP,B,ASYNC` |
| **ty** | Type checker — Astral's Rust-based checker, **not mypy** | `python-version=3.12` |
| **hatchling** | Build backend | — |
| **pytest** + pytest-asyncio + pytest-cov + fakeredis + httpx | Testing | `asyncio_mode=auto`, `--import-mode=importlib` |

No pre-commit config, no mypy, no black exist in cttc today — ruff already
replaces all of that in one binary, so there's nothing to add here.

**React/Electron — mostly carried forward, with one deliberate addition.**
cttc's actual current `package.json` devDependencies are just `electron`,
`electron-builder`, `esbuild`, `typescript`, `jotai`, `preact`,
`@floating-ui/dom` — plain npm, `tsc --noEmit` for type-checking (strict
mode), Node's built-in test runner. **No linter or formatter of any kind
exists today** — a real gap relative to the Python side's ruff.

| Tool | Role | Change |
|---|---|---|
| **esbuild** | Bundler | Carried forward (§4.1) |
| **TypeScript** | Type-checking, strict mode | Carried forward; retarget JSX from `preact` to `react` in `tsconfig.json` |
| **React**, **Jotai** | UI framework / state | Per §4 |
| **electron-builder** | Packaging | Carried forward |
| **Vitest** | Testing | Replaces Node's built-in test runner (already decided) |
| **Biome** | Lint + format, one tool | **New** — the closest JS/TS equivalent to ruff's single-binary lint+format philosophy; fills the gap cttc never had |

Package manager: plain npm, matching cttc (`package-lock.json`) — no
proposal to switch to pnpm/yarn without a concrete reason to.

## 5. Sump (renamed Gateway)

### 5.1 Provisioning flow
On correlator start:
1. Detect local Docker (`docker info` or daemon socket probe).
2. **Docker present locally** → install/run the Sump container locally
   (mirrors `ensureLocalContainer()`'s logic — reuse that flow's shape).
3. **Docker absent locally** → prompt for SSH credentials to a remote host,
   verify that host has Docker, then provision the Sump container there
   (mirrors `ensureRemoteContainer()` — SSH used for one-time provisioning,
   same as today; ongoing traffic stays HTTP).
4. Either way, the provisioned Sump is registered into the **correlator
   instance catalog** (§5.2).

### 5.2 correlator instance catalog
Lives in `.correlator/` (the local app-data directory). Structurally **JSON
documents, SQLite-backed** — not a flat `gateways.json`-style file. Rationale
per the spec: JSON keeps the record shape close to what the app already
reasons about (a Sump/data-stream is naturally a JSON object today, per
`gateway-registry.js`), SQLite gives queryability and durability the flat file
never had (concurrent-write safety, indexed lookups by host/status, and room
for the "further info" call-out — audit history, last-seen timestamps,
per-data-stream metadata — without hand-rolling file-locking).

Sketch (subject to refinement in Phase 2):
```
sumps(id, name, connection_type, host, port, catalog_json, created_at, last_seen_at)
data_streams(id, sump_id, kind, source_ref, catalog_json, owner_user_id, is_private, created_at)
secondary_sump_links(child_sump_id, parent_sump_id, promoted_from_data_stream_id, created_at)
recordings(id, data_stream_id, sump_id, file_path, catalog_json, created_at)
tracks(id, recording_id, data_stream_id, sump_id, file_path, catalog_json, created_at)
```
`catalog_json` columns hold the full JSON document (so the JSON shape stays
authoritative and human-inspectable); SQLite columns are the queryable
projection over it (id, host, owner, privacy flag, timestamps).

**Provenance (per the spec):** every recording and track keeps a foreign-key
link in this same store back to the data stream (and transitively the sump)
it was captured from — `recordings.data_stream_id`/`tracks.data_stream_id`
above, denormalized with `sump_id` for direct lookup without a join. This is
what makes "given a `[sump, data stream]` pair, list every track/recording
that originated from it" a plain indexed query rather than something the app
has to reconstruct from file metadata. Note this link lives in the catalog's
SQLite store regardless of which *project* (§8.3) a track/recording is later
organized into — provenance is about where the data came from, project
membership is about how the user chose to organize it; the two are
independent and neither implies the other.

**Catalog manipulation UI:** the sumps/data-streams management UI operates
directly on the `catalog_json` documents above — a JSON view is the primary
manipulation surface (view and edit), not a bespoke per-field form schema.
Practically: the same JSON structure the catalog persists is what the UI
renders and lets the user edit in place, with the SQLite columns staying a
read-side projection for lookups/filtering only. See §9.3.

### 5.3 Auth model
**One scheme, reused twice.** Whatever token/credential mechanism correlator
uses client → Sump is the *same* mechanism a Sump uses when talking to a
secondary Sump it spawned (§7). This directly simplifies on cttc's current
single shared `X-CTTC-Token` bearer model — no separate mesh-auth protocol to
design. Open question this raises (not blocking, tracked in §12): today's
token is shared per-gateway, not per-user; §7.3 depends on per-user identity
existing somewhere, so this needs a decision — either the correlator↔Sump
scheme already carries per-user identity (e.g. per-install keypair) or it
needs to grow one before Phase 8.

### 5.4 Sump plugin architecture — modeled on pytest/pluggy
**Explicit direction: get this as close as possible to how pytest plugins
work.** pytest's own plugin system (`pluggy`) is the model, for a specific
reason — it independently solves both of §3.6's failure modes (empty/missing
plugin directory, state-leak edge cases) while still hitting the actual goal:
**install any properly-packaged library into the Sump's container image and
have it integrate with zero code changes to the Sump itself.**

**Discovery — entry points, not a scanned directory.** A plugin is an
ordinary installed Python package that declares itself under a dedicated
entry-point group (e.g. `[project.entry-points."sump.plugins"]` in its own
`pyproject.toml`, exactly like a real pytest plugin declares itself under
`pytest11`). At startup, the Sump resolves that group via
`importlib.metadata.entry_points(group="sump.plugins")` — a lookup over
*installed package metadata*, not a filesystem scan. This is the key
distinction from the abandoned `log_sump.server.plugins` loader: there is no
"directory that might be empty or missing at deploy time," because a plugin
either exists as a real, versioned dependency in the image or it doesn't —
there's nothing in between to be caught out by. `pip install
correlator-sump-plugin-ssh` (or bake it into the image) and it's discovered
automatically, the same way `pip install pytest-xdist` "just works" for
pytest.

**Default-on, explicit opt-out — not an activation allowlist.** Matches
pytest's own default (every installed plugin auto-loads) rather than an
opt-in manifest: an installed plugin is active unless explicitly disabled
(a Sump-level equivalent of pytest's `-p no:cacheprovider` /
`PYTEST_DISABLE_PLUGIN_AUTOLOAD`), not the other way around. This keeps
"install a library and it's integrated" true without an extra activation
step.

**Hook specs, not one `extra_routers` list.** Today's single composition
seam (`create_app(extra_routers=...)`) doesn't disappear — it becomes an
implementation detail the plugin manager drives internally, one hookspec
among several. The Sump defines a small set of `pluggy`-style hookspecs a
plugin implements whichever subset of:
- `sump_plugin_info()` — name/version/capability manifest.
- `register_transport(manager)` — for a Sump-level transport plugin (§5's
  original scope); registers a `TransportPlugin` extending the existing
  `Transport` ABC's `run`/`stream_lines`/`run_shell` contract.
- `register_data_source(manager)` — for a data-stream plugin (§6.3);
  registers something meeting §6.3's minimal contract (list sources, stream
  logs, poll stats).
- `contribute_routes(app)` — optional custom API endpoints; this is where
  today's `extra_routers` seam lives now, generalized from a hardcoded list
  to whatever plugins actually register.
- `on_health_check()` — see below.

**This unifies §5.4 and §6.3 into one plugin system.** A Sump transport
plugin and a data-stream plugin aren't two parallel mechanisms to build and
maintain — they're the same `PluginManager`, the same entry-point group,
differing only in which hookspecs a given plugin implements. The SSH plugin
(§6.3) is expected to implement *both* `register_transport` and
`register_data_source` from one package, since SSH connectivity is what
both the Sump-level and data-stream-level SSH use.

**Graceful degradation: sleep, don't crash, don't hard-fail loudly.**
`on_health_check()` lets the plugin manager notice a plugin has become
unavailable (its backing dependency broke, a required binary/library
disappeared, its own health probe fails). **When that happens, the
functionality that specific plugin backs — not the whole Sump — transitions
into a sleep-like/idle state**: it stops actively polling/streaming, stops
consuming resources, but stays registered in the catalog (§5.2) rather than
being torn down, and resumes on its own once the health check passes again.
*(Flagging a scoping call here: "the server shall gracefully put itself in a
sleep-like mode" is being read as scoped to the affected plugin's own
footprint — e.g. the data streams/processes it backs — not the entire
multi-plugin Sump process going idle over one plugin's failure, since that
would take down unrelated, healthy plugins too. Correct if the intent was
whole-process. See §12.)*

First plugin: **SSH** (directly ports `SSHTransport`/`paramiko` logic,
implementing both `register_transport` and `register_data_source`).

### 5.5 Stability discipline — Sump code and UI must not churn
**Explicit priority, grounded in cttc's own history, not a general
sentiment.** Of cttc's 114 filed bugs, **19 (~17%) are directly against
Gateway/Docker-host/daemon code** — a disproportionate share of the entire
backlog concentrated in one subsystem. Two concrete illustrations, cited
because they show *why* this happened, not just that it did:

- **The status-pill saga**: `BUG-0071` → `BUG-0084` → `BUG-0088` reworked
  the *same* Gateway/Docker-host status pill — hover popup → right-click
  entry replacing the hover → a leftover native tooltip still showing
  underneath — across **three iterations opened within 48 hours**
  (2026-08-05 to 2026-08-06), the first two eventually retired and
  reclassified as requirements rather than bugs. A UI surface that gets
  redesigned three times in two days is churn by definition, and it's the
  single Gateway-adjacent element with the most rework in the whole backlog.
- **`BUG-0112`** (High severity): `preview_containers` never self-healed an
  already-stuck daemon — the same root-cause lineage as the
  `db05568`/`e2dc824` fixes already cited in §3.5's `log-sump-extended`
  survey. A High-severity bug reaching the app layer from an implicit-state
  bug two layers down is exactly the failure mode a real state machine (below)
  is meant to make structurally harder to reintroduce.
- (`BUG-0104`, log-sump's own container appearing in its own docker-host
  listing, is the historical bug that §6.1's self-filter-by-default design
  already exists to prevent — direct validation that decision is grounded,
  not speculative.)

Translating "rock solid" into concrete practice for Sump-related work only
(not a blanket policy for the whole app):

1. **One explicit Sump lifecycle state machine, not scattered flags.**
   `provisioning → active ⇄ unreachable → retired` at the Sump level;
   `active ⇄ sleeping` at the data-stream/plugin level, which is precisely
   §5.4's `on_health_check()` mechanism, now framed as *one* state model
   spanning both levels rather than an ad-hoc per-feature flag. Implicit,
   duplicated, or UI-vs-backend-desynced state is the common root cause
   behind the daemon-registry (`BUG-0035`/`0036`/`0060`) and stuck-daemon
   (`BUG-0109`/`0112`) bugs above — a single authoritative state machine,
   with the UI as a pure read of it, structurally closes that class of bug
   rather than relying on catching each instance after the fact.
2. **Mine cttc's own bug history into a regression corpus before/during
   Phase 2.** The 19 Gateway/Docker-host/daemon bugs above are a ready-made
   checklist, not a source to rediscover by accident: each becomes a named
   regression test against the new Sump code before Phase 2 is considered
   done, not an incidental side effect of feature tests.
3. **State-transition test coverage, not just feature coverage.** Every
   edge in the state machine above (§10) gets its own test — this is what
   actually catches "stuck in a weird state" bugs like `BUG-0112`, which
   feature-level happy-path tests reliably miss.
4. **Post-Phase-2 stability gate.** Once the Sump lifecycle state machine
   and catalog schema (§5.2) ship, treat them as a stable contract: further
   changes go through a `REQ-NNNN` with an explicit migration note (per
   `CODE-OF-CONDUCT.md` §1), not an ad-hoc patch — the same discipline that
   was missing when the same pill got reworked three times in two days.
5. **Smaller UI surface, by construction.** §9.5's sidebar consolidation
   (Gateway + Docker Host → one Sump section) already reduces the number of
   places Sump-related state can be shown inconsistently, compared to
   cttc's two-separate-sections-plus-status-pills design — worth naming
   explicitly as a stability property of that decision, not just a UX
   simplification.

## 6. Data streams (renamed Docker host)

### 6.1 Self-host detection
Once connected to a Sump, correlator asks it (over the same connection used
for provisioning-time SSH, or a local check if the Sump is local) whether its
own host is a Docker host. If so, its containers are offered as data-stream
candidates — mirrors `LocalTransport` + `containers_listing.py` — **with the
Sump's own container filtered out of the list by default**, selectable
manually for users who explicitly want to watch the Sump watching itself.

### 6.2 Remote host via SSH
User supplies another host the Sump can reach over SSH; same container
listing/log-streaming/stats-polling mechanics apply as for the local case —
directly reuses `SSHTransport`'s existing behavior, just generalized under the
new plugin interface (§6.3) instead of being the only hardcoded path.

### 6.3 Data-stream plugin interface
Realized through the **same** pytest/pluggy-style plugin manager as §5.4 —
a data-stream plugin is just a package implementing the `register_data_source`
hookspec (§5.4), not a second plugin system. Must be genuinely source-agnostic
per explicit direction ("any data for logs and stats is welcomed") — the
interface should not assume Docker or even containers as a concept, only "a
source that can be listed, and that emits logs and/or stats." Three planned
plugins:

| Plugin | Status | Notes |
|---|---|---|
| **ssh** | Phase 3, first to ship | Direct port of `SSHTransport`/`LocalTransport`. |
| **logstream** | Phase 7 | See §6.4 — needs an upstream survey first. |
| **kibana** | Later / exploratory (§6.5) | Explicitly out of committed scope for now. |

### 6.4 logstream plugin — open item, needs a follow-up survey
The spec: connect to "a logstream server running either as a container (or
not)", "leverage the existing configuration but output it to
stdout/stderr", with support for "any output type supported by logstream."
**The survey done for this roadmap could not confirm what output-type options
actually exist**, because `log-sump-extended` (this repo's submodule) is only
a thin compat shim — it exercises `log-sump`'s daemon-registry/query/schema
surface but has zero output-sink abstraction of its own, and no OpenTelemetry/
FluentBit references anywhere. The real "logstream server" referred to here is
almost certainly **`log-sump` itself** (github.com/oliben67/log-sump,
pulled in by `log-sump-extended` as a pinned dependency at `v0.4.2`, not
checked out anywhere in this workspace). **Action item before Phase 7 design
work starts: survey `log-sump` directly** to confirm what configurable
output types (if any) it exposes, and whether "leverage the existing
configuration but output to stdout/stderr" means adding a new stdout/stderr
sink to log-sump itself, or building an adapter in front of it. Tentative
shape either way: a lightweight process that takes log-sump's own
daemon/stream config and taps its output onto stdout/stderr in a defined
schema the Sump's own ingestion can consume generically — but that shape
should not be locked in until the upstream survey happens.

### 6.5 kibana plugin
Confirmed in-scope-but-later. The only firm requirement so far is that
§6.3's plugin interface must not preclude it — Kibana as a source means
"logs and stats coming from an Elasticsearch-backed system," which is a
different shape from "logs and stats coming from a container/host," so the
plugin interface's minimum contract (list sources, stream logs, poll stats)
needs to be validated against this case even though implementation is
deferred. Treat as a design constraint on §6.3, not a Phase-N deliverable yet.

## 7. Secondary Sumps (mesh / federation)

### 7.1 Promotion flow
A host currently reachable as a data stream (§6) can be promoted: install a
Sump container there too (same provisioning mechanics as §5.1, just
SSH-initiated from the parent Sump instead of from correlator directly).

### 7.2 Independence + reachability
The resulting secondary Sump's data stays reachable *from* the parent (so a
correlator session connected to the parent can still see the child's
collection), but the secondary Sump is **fully first-class** afterward — any
correlator instance can connect to it directly, exactly as it would a
primary Sump. Build this on cttc's existing gateway-mesh prior art
(`gateway_mesh.py`'s `/gateways/sync` peer discovery and
`/gateway/ownership/claim|rotate` signature-based ownership) rather than
designing federation semantics from scratch — it already solves "how does a
Sump learn about and vouch for a peer," which is most of this problem.

### 7.3 Per-user data-stream catalog + privacy — open design question
New requirement beyond what cttc's mesh code does today: **the Sump
maintains its own catalog of the data streams created through it, per user**,
with a per-data-stream privacy flag a user can set to keep a stream out of
other users' view. This is a real multi-tenancy capability cttc does not
have — its current auth is one shared token per gateway, not per-user
identity. **This needs a decision before Phase 8 design starts**: either
§5.3's shared correlator↔Sump auth scheme already carries (or is extended to
carry) a distinguishable per-user identity, or a lightweight identity layer
needs to be added to the Sump specifically to make "per user" and "private to
that user" meaningful. Track as the single biggest open question in this
roadmap (see §12).

## 8. Data model: recordings, tracks, snapshots, projects

### 8.1 Containment rules (as specified)
- A **sump** contains one or more **data streams**, and/or **secondary sumps**.
- A **recording** (`*.recording`) contains one or more **tracks** (`*.track`).
- A **project** (`*.correlator`) contains tracks, recordings, and their
  text/JSON exports (snapshots), organized however the user wants, **by
  reference, never duplicated** — a project is an organizing view over
  existing files, not a copy of them.
- Independently of project membership, every recording/track retains a
  **provenance link** back to the data stream (and sump) it was captured
  from, tracked in the catalog's SQLite store (§5.2) — so a sump can answer
  "every track/recording created via this `[sump, data stream]`" directly,
  regardless of which project(s) a user has since organized them into.

### 8.2 File formats
`*.recording` and `*.track` are the renamed continuation of cttc's existing
`.cttc-record`/`.cttc-metric` archives (`sample_archive.write_archive`) — same
underlying mechanism, new extensions. Snapshots remain plain `.json`/text
exports with no dedicated binary format, matching cttc's current
`/stats_export` behavior.

### 8.3 Projects (`*.correlator`)
Modeled on VS Code's `.code-workspace`: a JSON file referencing
recordings/tracks/exports by path plus a virtual-folder tree for logical
grouping (independent of where the referenced files physically live).
**Default project**: always exists at a fixed location inside `.correlator/`
(never relocates); every newly created recording/track lands there unless the
user has an explicit project open. "Save As" on the default project creates a
*separate*, independently-managed `*.correlator` file elsewhere — it does not
move the default.

### 8.4 File-association / open-on-double-click
`*.track`, `*.recording`, and `*.correlator` files should open in correlator
when double-clicked from the OS. Implement via electron-builder's
`fileAssociations` config (extends the existing electron-builder packaging
setup — no new packaging tool needed) plus the corresponding
`app.on('open-file', ...)`/Windows second-instance argv handling in the
Electron main process.

## 9. UI/UX parity

### 9.1 Protected core (see §2)
Shared timeline, per-source event-density lanes, virtual-scrolled log panels,
bidirectional click-to-correlate. No phase before Phase 5 should be
considered blocking for this; no phase after it should touch it without an
explicit regression check.

### 9.2 Dialog/screen inventory (old → new naming only; behavior preserved)
| cttc dialog | correlator equivalent |
|---|---|
| Set Sources (`dlg-set`) | Data-stream picker (plugin-aware: ssh today, logstream/kibana later), nested under the Sump section (§9.5) |
| Gateway setup (`dlg-gateway-setup`) | Sump setup wizard (local-Docker-first, SSH fallback) |
| Docker-host remove/edit | Data-stream remove/edit, nested under the Sump section |
| Export metrics (`dlg-export-metrics`) | Track/snapshot export |
| Snapshot (`dlg-snapshot`) | Snapshot (unchanged) |
| Events (`dlg-event-create`/`dlg-event-list`) | Events — kept as a sidebar section, but redesigned from scratch (§9.5), not ported behavior |
| Recording start/pause/stop/resume | Recording controls (unchanged concept, new file extension) |
| Redis CLI dev tool | Carried forward as-is (dev tool, not user-facing priority) |
| Opened Data / Analysis section | **Projects** sidebar section (§9.5) |

### 9.3 Catalog JSON view
Per §5.2: sump and data-stream management is done through a JSON view/editor
over the catalog's `catalog_json` documents, not a bespoke settings-form
component per entity type. This simplifies the React/Jotai component surface
for the Sump setup wizard and data-stream picker (§9.2) considerably — one
generic JSON-view component, parameterized by schema/validation per entity
kind, rather than N hand-built forms — but the validation/schema layer behind
that generic editor is itself real Phase 2/3 work, not a shortcut.

### 9.4 React/Jotai rewrite plan
cttc's `renderer/src/modules/{docker-host,gateway,events,preferences,redis-cli,status-bar}/`
and its `.tsx` files (`DockerTargetList`, `TransformList`, `HistoryList`,
`status-bar/index`) are already component-shaped even though they're
Preact-on-esbuild today. Use their module boundaries as the starting point for
correlator's React component tree rather than re-deriving screen
decomposition from scratch — the implementation is a rewrite (Preact→React;
esbuild itself is retained, §4.1), but the *seams* are proven.

### 9.5 Sidebar scope & icon assets
cttc's action bar (`app/renderer/index.html`, the `.ab-group[data-section=...]`
mechanism — real, substantial infrastructure: dock-left/right/detach, collapse
to a rail, one-open-section-at-a-time, popout-into-its-own-window, all covered
by the `ui-SIDE-*` rule series) currently has **four** top-level sections:
`gateway`, `sources` ("Docker Host"), `events-capture`, and `analysis`
("Load Data" / "Opened Data"), plus flat Preferences/About/Quit items.

**correlator's initial sidebar is scoped down to three sections**, per
explicit direction:
- **Sump** — evolves the `gateway` section (new/edit/uninstall Sump, secure
  storage). Data-stream management (today's separate `sources`/"Docker Host"
  section) **folds into this section** rather than staying a top-level entry
  of its own — consistent with §8.1's containment rule that a sump *contains*
  its data streams, so managing them belongs under the sump they belong to,
  not beside it. *(Flagging this as an inference from the containment model,
  not an explicit instruction — correct if wrong.)*
- **Projects** — evolves the `analysis` section (Load Data/Opened Data),
  renamed and reshaped around `*.correlator` projects (§8.3) rather than
  bare metric files.
- **Events** — kept as a section, but **its contents are being redesigned
  from scratch**, not ported from `events-capture`'s current Create/Edit
  Event behavior. Ships as an empty/stub section for now; real design TBD.

The `sources`/Docker-Host section and the `analysis` section's exact
UI aren't being ported wholesale under new names — only their *place in the
sidebar* is accounted for above; their actual interaction design is Phase 4/6
work, informed by but not copied from cttc's dialogs.

**Icon assets are reused, not commissioned.** Three existing stocks, in order
of preference:
1. **`~/sources/icons/correlator/`** — already built for the new vocabulary:
   `sump.svg`, `project.svg`, `data-stream.svg`, `track.svg`, `recordind.svg`
   (recording — filename typo to fix on use), `stream.svg`. Use these first
   wherever a concept has a purpose-built icon here.
2. **`~/sources/icons/`** (general stock) — covers everything else
   (`events.svg`, `preferences.svg`-equivalents, `gateway.svg`/
   `cttc-gateway*.svg` for reference, transport/connectivity icons, etc.).
3. **cttc's own asset set** — `app/renderer/assets/sidebar/{sources,preferences,metrics}.svg`
   plus the many inline `<svg>` icons already in `action-bar.js`/`index.html`
   (new/edit/uninstall, connect/disconnect, create/edit-event, load/opened-data,
   etc.) — reusable directly for actions that keep their meaning across the
   rename (e.g. the edit-pencil, trash/uninstall, and create-plus glyphs).

Notably, cttc's own `events-capture` "Create Event" button icon and
`~/sources/icons/stream.svg`/`correlator/stream.svg` are **the same SVG
asset** (a bolt/swoosh glyph doing double duty for "event trigger" and
"stream") — a sign the existing stock was already curated with this
vocabulary overlap in mind, not two unrelated icon sets to reconcile by hand.

## 10. Testing & CI strategy
- App: **Vitest**, replacing the Node built-in test runner; keep an Electron
  E2E harness equivalent to `run-e2e.sh`'s approach.
- Server: pytest + pytest-asyncio + fakeredis, continuing log-sump's own
  pattern; add OpenTelemetry-aware integration tests once instrumentation
  lands (Phase 1).
- **CI**: cttc has none (only a manual Docker-push workflow). Standing up
  automated test-on-push CI for both app and server is explicit Phase 0 work,
  not deferred — the port is the right moment to fix this, not a later
  cleanup pass.
- **Sump lifecycle: state-transition coverage, held to a higher bar than
  feature coverage elsewhere** (§5.5). Every edge of the `provisioning →
  active ⇄ unreachable → retired` / `active ⇄ sleeping` state machine gets
  its own test, plus a named regression test per historical cttc
  Gateway/Docker-host/daemon bug (§5.5) — this is the one area of the port
  explicitly exempted from "test what the feature needs" in favor of "test
  the failure modes that already happened once."

## 11. Phased roadmap

| Phase | Goal | Key deliverables | Builds on (cttc/log-sump) | Net-new |
|---|---|---|---|---|
| **0. Foundations** | Toolchains + CI stood up for both app and server; naming locked | esbuild/TS/Vitest/Biome app scaffold; uv/ruff/ty/pytest server scaffold (§4.4); Python/Redis/FluentBit/OTel server scaffold; CI on push for both | Repo layout, Taskfile conventions, cttc's `build/build-renderer.js`, cttc's `pyproject.toml` tool config | CI (cttc has none), Biome (cttc has no JS/TS linter today) |
| **1. Sump server core** | Server skeleton with the new ingestion pipeline | FluentBit swap-in (or adapter, per §4.2 spike); OpenTelemetry instrumentation baked in from the start; pytest/pluggy-style plugin manager + hookspecs (§5.4), entry-point discovery, no plugins registered yet | `log-sump`'s 4-process shape, Redis-Streams schema, `Transport` ABC | FluentBit output path, OTel instrumentation, the plugin manager itself |
| **2. Provisioning + catalog** | Sump install flow + local metadata store, built to the stability bar in §5.5 | Docker-detect/local-or-SSH-provision flow; `.correlator/` JSON+SQLite catalog; unified auth token; explicit Sump lifecycle state machine (§5.5) with state-transition test coverage; cttc's 19 Gateway/Docker-host/daemon bugs (§5.5) ported to a regression corpus | `ensureLocalContainer`/`ensureRemoteContainer`, `api-token.js` | SQLite-backed catalog schema, the state machine itself |
| **3. Data-stream SSH plugin** | First data-stream plugin, self-host detection | Ported `SSHTransport`/`LocalTransport`, packaged as an installable entry-point plugin implementing `register_transport` + `register_data_source` (§5.4); self-filter w/ opt-in self-watch | `SSHTransport`, `containers_listing.py`, `container_listener.py` | First real plugin package + entry-point registration proving out the manager built in Phase 1 |
| **4. App shell parity** | Electron+React+TS+Jotai+esbuild scaffold wired to new Sump API | Window/dialog shell, IPC bridge, esbuild watch-mode HMR loop | `main.js`/`preload.js` IPC patterns, `build/build-renderer.js` | Full React rewrite of the shell |
| **5. Core correlation UX parity** | The non-negotiable UX (§2) working end-to-end | Charts, shared timeline, event-density lanes, virtual-scrolled log panels, bidirectional click-correlate | `app.js` canvas engine's behavior (reimplemented, not ported verbatim) | React/Jotai implementation |
| **6. Recording/track/project data model** | File formats + `.correlator` projects | `.recording`/`.track` (renamed archive format), default project, virtual folders, file-association open handlers | `sample_archive.write_archive` | Project file format, virtual folders, OS file-association |
| **7. Data-stream logstream plugin** | Second data-stream plugin | Upstream `log-sump` survey (blocking, see §6.4) → stdout/stderr adapter design → implementation | `log-sump`'s daemon/stream config (pending survey) | Output-sink abstraction (confirmed absent everywhere today) |
| **8. Secondary-Sump federation** | Mesh/promotion + per-user privacy | Promotion flow, shared-auth reuse (§5.3), per-user data-stream catalog + privacy flag | `gateway_mesh.py` ownership/peer-discovery | Per-user identity layer (open question, §7.3/§12) |
| **9. Packaging/distribution parity** | Installers + release pipeline | electron-builder installers (NSIS/DMG/AppImage), Sump image publishing | `releases` submodule pattern | — |
| **10. Kibana-oriented plugin (exploratory)** | Validate plugin interface against a non-container source | Design spike only, no committed implementation date | §6.3's generic contract | Kibana/Elasticsearch data-stream plugin |

Sequencing note: Phases 1–3 (server-side) and Phase 4 (app shell) can run in
parallel once Phase 0 is done, since the app shell doesn't need the real Sump
API to build its scaffold against a mock. Phase 5 should not start until both
tracks have a real, if minimal, integration point.

## 12. Risks & open questions

1. **Per-user identity for Sump auth** (§5.3, §7.3) — blocking for Phase 8,
   worth resolving as early as Phase 2 so the catalog schema doesn't need a
   breaking migration later.
2. **`log-sump` upstream survey** (§6.4) — blocking for Phase 7 design;
   should happen well before Phase 7 starts, not at its kickoff.
3. **Fluentd → Fluent Bit feasibility** (§4.2) — needs a short spike in
   Phase 1 to pick between "Fluent Bit output plugin" vs. "Fluent Bit's
   built-in Redis output, reshaped ingestion side" before committing.
4. **Embedded vs. shared Redis** — cttc runs Redis as a bundled in-container
   process; worth an explicit decision in Phase 1 on whether correlator keeps
   that or moves to an externally shared instance (relevant once secondary
   Sumps and multi-user catalogs exist).
5. **Sleep-mode scope** (§5.4) — read as "the functionality the failed
   plugin backs goes idle," not "the whole Sump process sleeps." Confirm
   before Phase 1 implements `on_health_check()`, since the blast radius is
   very different (one data stream pausing vs. every plugin's traffic
   stopping because one plugin broke).
6. **Kibana plugin shape** — deliberately undecided; tracked only as a
   constraint on the Phase 3/6.3 plugin interface, not a scoped deliverable.

## 13. Traceability

This roadmap is the detailed content behind
[`FEAT-0001-cttc-port-electron-react-python-sump`](../../.catalyst-proj/features/FEAT-0001-cttc-port-electron-react-python-sump.md)
in the catalyst deployment (`.catalyst-proj/`). Per `CODE-OF-CONDUCT.md` §1,
no phase above starts as real development work without first opening a
`REQ-NNNN` against it (never a `BUG-`), vetted against `rules/Rules-of-Rules.md`
§1 and assigned a domain — most likely new domains under the `core` rule
document (e.g. `CORE.SUMP`, `CORE.DATASTREAM`, `CORE.PROJECT`) rather than
folding everything into the existing single `CORE` domain, given the scope
here. That domain split is itself a Phase-0-adjacent decision, not something
this roadmap document itself needs to resolve.
