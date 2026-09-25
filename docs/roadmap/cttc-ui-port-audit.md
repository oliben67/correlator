# CTTC → correlator UI audit: capabilities + style gap roadmap

> Status: proposed. Grounded in two direct, read-only surveys conducted
> 2026-09-19: `cttc` (`/Users/oliviersteck/sources/cttc` — `main.js`,
> `preload.js`, `renderer/index.html`, `renderer/app.js`, `renderer/style.css`,
> `renderer/src/modules/**`, `lib/**`, `MANUAL.md`, `docs/images/*.png`) and
> correlator's own current UI (`app/renderer/src/**`) as of commit `9636e6c`.
> cttc was not modified in any way during this survey — it remains
> reference-only, per standing project policy.
>
> This is a continuation of
> [`cttc-feature-parity.md`](cttc-feature-parity.md) (Phases 11–18, all
> Done except the exploratory Phase 18) — that document wired the
> correlation engine into the app shell and shipped Sump management,
> recording sessions, events, snapshots, and app-shell chrome as
> *functional* parity passes. This document is the first pass to compare
> cttc and correlator **screen-by-screen and pixel-by-pixel**, after that
> functional work landed, and to fold in the "Correlator project" feature
> work (Tiers 1–3) from the current session. Its finding, in one
> sentence: **correlator has real functional depth today but almost none
> of cttc's UI polish, chrome, or visual design system** — zero CSS file,
> zero dark-mode wiring, zero icon usage, ad hoc inline-style colors that
> happen to resemble Bootstrap by coincidence, and several already-built
> backend capabilities with no UI attached at all.

## 0. The Sump reframing (read this before the item list)

cttc splits what correlator calls a **Sump** into two independent
entities with two independent dialogs, registries, and status pills:

- **Gateway** — where the server process runs (embedded / local Docker /
  remote-over-SSH), tracked in `~/.cttc/gateways.json`.
- **Docker Host** — the target being watched, tracked per-gateway inside
  that same file's nested `dockerHosts[]` array, with its own SSH-key
  selection, container/service checklist, and per-source transforms.

correlator's Sump already collapses this into one entity. Every item
below that touches Sump UI (§2) is written against that collapsed model
from the start — it ports cttc's *fields and interaction patterns* (SSH
key selection, image source choice, container checklist, status pill
behavior) onto correlator's single Sump dialog/registry, not cttc's
two-entity structure. Interestingly, cttc's own newer "Correlator
project" code already speaks `sumpId`/`streamId` internally
(`cor-descriptor.js`, `types.ts`) — an unfinished attempt at the same
unification — but never wired a UI control to actually bind one. Item 5
below is, in effect, the thing cttc started and didn't finish.

## 1. Proposed items

Numbered in reading/reference order (Item 1, 2, 3, …) — see the note in
§3 on how this maps to catalyst's own globally-sequential `RM-NNNNNN`
IDs, which are assigned in this same order but do not restart at 1.

### A. Visual style foundation

**Item 1 — Token-based color system + real light/dark mode.**
correlator has zero CSS files; every color is an inline-style hex
literal (`app/renderer/src/*.tsx`), and the existing `Preferences.tsx`
theme selector (`light`/`dark`/`system`) persists to the backend catalog
but is never read by anything that changes appearance — it's fully
inert. Port cttc's `--surface-*`/`--text-*`/`--accent`/`--critical`/
`--warning`/`--series-1..8`/`--radius-*`/`--shadow-*` custom-property
palette (`style.css:1-69`, both light and dark blocks) as correlator's
first real design-token set, wired through `prefers-color-scheme` by
default with an explicit override (mirroring cttc's
`nativeTheme.themeSource` approach in Electron) so the theme selector
finally does something.

**Item 2 — Wire up the already-present shared icon set.**
`.icons-src` (→ `~/sources/icons/correlator`, verified present with
exactly 8 files as of 2026-09-19) is symlinked into both repos but has
**zero consumers anywhere in correlator's renderer today** (confirmed:
no reference to `icons-src` or these filenames in `app/renderer/src`,
`app/main.cjs`, or `app/preload.cjs`), and only 4 of the 8 are consumed
even by cttc. The 8 files map almost one-to-one onto correlator's own
domain vocabulary (Sump → DataStream → Recording/Track → Project) —
this is not a generic icon set to pick from, it was clearly drawn
*for* this object model:

| File | Size / paths | Fill | Maps to | First use |
|---|---|---|---|---|
| `sump.svg` | 64×64, 13 paths | none set (inherits `currentColor`) | The unified **Sump** entity | Sidebar "Sump Manager" nav icon, unified Sump status pill (Item 6), Sump connect/manage dialog header (Item 5) — neither app uses this file today |
| `data-stream.svg` | 3 paths | none set (inherits `currentColor`) | **DataStream** | Data-stream picker/browser UI (Item 7), which has zero UI at all today |
| `project.svg` | 1 path | none set (inherits `currentColor`) | **Project** | Project-browser UI (Item 20), sidebar/File-menu project actions |
| `track.svg` | 1 path | none set (inherits `currentColor`) | **Track** | Per-track view-state controls (Item 21) |
| `recordind.svg` *(sic — filename typo for "recording", kept as-is; cttc's own `icons.ts` references it under the same misspelled name)* | 3601 bytes | **hardcoded `fill="#060606"` on a `<g>`** | **Recording** | Recording-session controls (Items 20/23/24), recording-in-progress motif (Item 24) — needs the same "strip the hardcoded fill" step cttc's own `correlator/icons.ts` already performs for this exact file, or it will stay pinned to near-black in dark mode |
| `correlator-app.svg` | 64×64, gradient fill (`#7f00ff`→…) | intentional full-color branding, **not** meant to be recolored | The app itself | Electron app/window/dock/taskbar icon (`main.cjs` sets none today) |
| `correlator.svg` | 64×64, 26 paths | none set (inherits `currentColor`) | A flat/mono variant of the brand mark, distinct from `correlator-app.svg` | Candidate for an in-app header/About-dialog logo (Item 11) — no consumer in either app today |
| `stream.svg` | 16 paths | none set (inherits `currentColor`) | Ambiguous — named distinctly from `data-stream.svg` but nothing in either app clarifies the intended distinction | Flagged as an open question (§4) rather than guessed at: is this a generic "live stream" glyph distinct from the catalog `DataStream` entity, or a duplicate/earlier draft? |

Technical note for whoever implements this: 6 of the 8 files set no
`fill` attribute anywhere in the SVG, so they already render via
whatever CSS `fill`/`color` wraps them — directly compatible with
cttc's own stated convention (`currentColor`-driven, theme-adaptive,
no per-icon override needed). Only `recordind.svg` needs the fill
stripped first, and `correlator-app.svg` is deliberately excluded from
that treatment since its gradient branding is the point. Once these are
wired in, replace `Sidebar.tsx`'s emoji characters (📊🔌⚡⚙️ℹ️) with the
matching real icons from this set (Sump for the manager tab, a
correlation-specific glyph for the chart tab — none of today's 8 files
obviously covers "Correlation"/"Events"/"Preferences" nav items, which
is itself worth flagging to whoever commissions any further icons).

**Item 3 — Shared button/panel/dialog component patterns.**
Port cttc's `.btn`/`.btn-fetch`/`.btn-danger`/`.seg-control`/`.switch`
component patterns and its bordered-panel convention (`1px solid
border`, consistent radius/shadow tokens) as reusable correlator
components, replacing today's per-file redefinition of the same "bordered
panel" look (`AddSump.tsx`'s `sectionStyle`, `SumpSwitcher.tsx`'s
`rowStyle`, and inline duplicates in `Correlate.tsx` are all the same
pattern reimplemented three times).

**Item 4 — Real modal/dialog system.**
correlator has no overlay/modal pattern at all — `AboutDialog`/
`Preferences` are inline panels swapped into the main content area, not
actual dialogs. cttc uses native `<dialog>` consistently for every
secondary flow. Introduce a real dialog/overlay primitive before
building any of the dialogs items 5, 20, 23, 25, etc. actually need.

### B. Sump UI unification

**Item 5 — Multi-section Sump connect/manage dialog.**
Redesign `AddSump.tsx`/`SumpSwitcher.tsx`'s plain inline forms into a
proper dialog mirroring cttc's New/Edit Gateway + New/Edit Docker Host
flows merged onto one entity: SSH-key selection (file / paste / keep
current), image-source choice (bundled / registry ref / local tarball —
correlator's current default registry image is already flagged
unavailable, matching a real gap cttc's own dialog copy would have
caught with its validation rules), the Fetch-Sources
container/service checklist with group-select-all and a
gone-but-still-selected 🚫 state, and the (currently disabled-everywhere,
per both apps) per-source transforms checklist.

**Item 6 — Unified Sump status pill.**
correlator's `StatusBar` shows a static colored dot + name, no history,
no menu. Port cttc's Gateway/Docker-Host pill behavior (5s-polled
up/checking/down dot, click-to-open dropdown of every known Sump with
live re-check, right-click New/Edit/Uninstall/Current-Status menu) as
one unified Sump pill — this is the single most direct, ready-made
precedent cttc offers, since its own two pills are already
structurally identical.

**Item 7 — Data-stream picker/browser UI.**
`listDataSources`/`setDataSourcePrivacy` are fully implemented in the
IPC bridge (`preload.cjs:14-19`, `correlator-api.d.ts`) with **zero
call sites anywhere in the renderer** — there is no UI to browse a
Sump's data streams or toggle per-stream privacy today. Port cttc's
per-container/service checklist UX for this.

**Item 8 — Edit an existing Sump's connection details.**
correlator's `SumpSwitcher` supports rename only; cttc supports full
edit (host/port/token, SSH target, image ref) for both of its
equivalent entities.

### C. App shell / chrome parity

**Item 9 — Application menu + keyboard shortcuts.**
correlator has no menu system at all. Port cttc's File/Edit/View/
Window/Help structure (or an OS-native equivalent) with its keyboard
shortcuts (Save/Save-As, Undo/Redo, Zoom, Fullscreen, DevTools, Quit)
and right-click Cut/Copy/Paste context menu on editable fields.

**Item 10 — Panel pop-out/detach support.**
Port cttc's ability to detach the chart, a log panel, or the sidebar
into its own always-on-top window, synced via the shared cursor/view
state and re-docking on close.

**Item 11 — Real About dialog with real version metadata.**
Convert `AboutDialog.tsx` from a static inline panel with a hardcoded
`"0.1.0"` string into a real modal (Item 4) reading the actual
`package.json` version + build metadata, matching cttc's About dialog
content (version, build date/commit, dependency versions, icon
attribution) and its "User Manual" action.

**Item 12 — Status-bar notification/history feed.**
`StatusBar.tsx` shows only current state. Port cttc's transient
notification area + History popup (recent connect/error/event-trigger
lines, with its own Clear button).

**Item 13 — Fix: wire the dead `recordingStatus` prop through.**
A concrete, already-identified bug, not a design gap: `App.tsx:100`
never passes `recordingStatus` to `<StatusBar>`, so the status bar's
own recording-state display (`StatusBar.tsx:26-44`) is unreachable dead
code even though `Correlate.tsx` tracks real session state. Small,
immediate, and independent of every other item here.

### D. Correlation / chart UX capability parity

**Item 14 — Multi-series chart + container legend.**
`Chart.tsx` is hardcoded to one metric (`cpu_pct`) for the first
container only, with no legend. Port cttc's per-container color legend
(curated 8-color palette + procedural overflow), select/hide/track
states, and legend↔log-panel linkage (hide one, hide the matching
other; drag to reorder both in lockstep).

**Item 15 — Chart zoom/pan interaction.**
correlator's chart viewport only ever changes via `defaultWindow()` on
load or a log-row click; there is no drag-to-zoom, wheel-zoom, or
double-click-recenter. Port cttc's interaction set including its
right-click zoom menu.

**Item 16 — Axis labels, gridlines, and a live/analysis mode
indicator.**
`chartDraw.ts` renders no axis labels or gridlines today, and
correlator has no explicit "am I looking at a live stream or a loaded
file" concept the way cttc's toolbar switches modes wholesale.

**Item 17 — Drag-to-select range capture on the chart.**
`Correlate.tsx`'s range-snapshot form currently requires hand-typed
ISO-8601 timestamps. Port cttc's shift-drag/right-click capture
gesture directly on the chart.

**Item 18 — "Now" line, live-tracking bar, and timeline navigator.**
None of these exist in correlator today; cttc uses a dotted/configurable
"now" indicator distinct from the manual cursor line, a live-tracking
bar, and a scrollbar-like navigator with click-to-jump.

**Item 19 — Host-vs-container telemetry separation in the live
correlation view.**
This is the UI layer this session's own Tier 1/2 backend work
(`system_kind` tagging, `cor-CORE.PROJECT-000006` live-context
isolation) was explicitly built for and does not yet have: two
structurally separate chart groups (never overlaid), matching cttc's
`partitionTelemetryTracks` convention. Directly extends the already-
deferred Tier 4 of the current port plan — not new scope, just now
grounded in cttc's actual prior art for how the split should look.

### E. Project / recording / snapshot capability parity

**Item 20 — The actual project-browser UI.**
correlator's project data model (`app/lib/project.ts`, including this
session's Tier 1–3 additions) has no UI at all today — no New/Open/
Recent/Save/Save-As, no Window-menu project switcher. Port cttc's
dialog set as the direct template, but — unlike cttc, which never
finished wiring a "bind a live Sump to this project" control despite
having the data model for it (`cor-project.js`'s own
`canAddRecordingToProject`/`canRebindLiveSource` logic with no UI call
site) — this item should actually finish that step, since correlator's
backend-side live-context isolation (`cor-CORE.PROJECT-000006`, this
session) already exists to support it.

**Item 21 — Per-track delay/visibility controls in the project view.**
`project.ts`'s `setTrackDelay`/`setTrackVisibility`/`getTrackViewState`
(this session's Tier 2) have zero UI consuming them. Port cttc's
"Add Track to View" checklist+delay-input pattern.

**Item 22 — (Explicitly not porting) legacy-file import.**
cttc's `.cttc-metric`/`.cttc-record` legacy import
(`lib/legacy-import.js`) exists to migrate its own predecessor format.
correlator has no predecessor format of its own — this was already an
explicit non-goal of the current port plan and stays one here. Listed
so the roadmap is complete rather than silently missing it.

**Item 23 — Recording crash-recovery choice UI.**
This session's Tier 3 fixed the underlying silent-data-loss bug
(`coerceInterruptedSessions` now actually exports the open segment
instead of dropping it), but the UI still only offers Dismiss + a
plain from-scratch Resume. Port cttc's three-way
Resume-from-interruption-point / Resume-from-now / Decide-later choice
— this is the change that actually closes the
`cor-CORE.ARCHIVE-000003` rule/UI drift `BUG`-style gap noted during
Tier 3, not just the data-loss half of it.

**Item 24 — Recording-in-progress visual motif.**
Port cttc's pulsing recording indicator and capture-range band drawn on
the chart strip (with its optional "sprocket holes" decoration) —
correlator's recording-session state exists with no chart-level visual
trace of which ranges were actually captured.

**Item 25 — Two-step export wizard for an already-loaded file's full
range.**
correlator's export (`downloadRecording`/`downloadTrack`) is live-
range-only. Port cttc's Export Metrics wizard (what to include, then
format: Text/JSON, Summary vs. full series) for flattening a file
that's already open.

### F. Events UI polish

**Item 26 — "Hosted on gateway vs. local-to-app" semantics for event
rules.**
correlator's `EventRuleRow` is Sump-scoped only, with no distinction
between a rule that should keep running server-side versus one that
dies when the window closes. Port cttc's explicit choice from its
Create Event form — note this needs a decision on what "gateway" even
means now that gateways are bundled into Sumps (does this become
"survives this app instance" vs. "lives in the Sump's own server
process"?), flagged as an open question in §4.

**Item 27 — Retention-override option on event-triggered actions.**
Port cttc's "keep longer than default retention" field for
snapshot/recording actions triggered by an event rule.

### G. Settings/Preferences parity

**Item 28 — Expand Preferences to match cttc's Settings + Appearance
panes.**
correlator's `Preferences.tsx` has exactly 3 fields today (query limit,
refresh interval, an inert theme selector). Once Item 1 gives theme
mode somewhere real to apply, port cttc's Settings pane (time-window/
highlight-seconds, live-tracking offset + resume delay, own-logs
collection) and Appearance pane (mode, highlight color, now-line
color/style, live-track color, capture-band color + sprocket toggle,
status-bar visibility toggle).

**Item 29 — Danger-zone Hard Reset.**
Port cttc's confirm-gated Preferences action that clears the app's own
local UI state and reloads — scoped, as cttc's own is, to never touch
`.recording`/`.track`/`.correlator` files or Sump registrations.

### H. Developer tooling (optional / exploratory)

**Item 30 — Redis-CLI-equivalent developer panel (exploratory).**
cttc's Help→Developers→Redis CLI gives direct access to its sole
backing store. Flagged as optional/exploratory, matching cttc's own
"Developers" menu framing — not a committed deliverable, only worth
building if correlator's server-side store ever needs the same kind of
direct-inspection tool during development.

## 2. Style-system reference values (for whoever triages Item 1)

Full palette, icon inventory, typography, and spacing/shadow/radius
token values are in the raw audit transcripts (not reproduced here to
keep this roadmap doc scannable) — pull them fresh from `cttc/app/
renderer/style.css:1-69` (palette + tokens) and `style.css`'s button/
dialog/switch rules (`:987-1015`, `:1606-1699`, `:946-972`) rather than
copying secondhand values into a REQ, since the source file is the
ground truth and small transcription errors in a design-token set are
exactly the kind of thing worth avoiding.

## 3. On item numbering vs. catalyst's `RM-NNNNNN` IDs

catalyst's roadmap items are numbered globally across every named
roadmap in the project (currently up to `RM-000019`, from the two prior
roadmaps) — a new roadmap's items continue that sequence rather than
restarting at 1. Item 1 above will be ingested as whatever the next
real `RM-NNNNNN` is at ingest time, Item 2 the one after it, and so on
in the same order — so "Item N" here and the Nth `RM-` ID assigned to
this roadmap always refer to the same thing, even though the `RM-`
number itself isn't literally 1.

## 4. Open questions needing a decision before implementation

1. **Item 26's "hosted on" semantics** — now that gateway+SSH-host are
   bundled into Sump, what does "runs even after this app window closes"
   actually map to? A Sump's own server process is the natural
   candidate, but this needs a decision before Item 26 is designed, not
   during it.
2. **Dialog vs. inline-panel scope for Items 5/20/23/25** — Item 4
   introduces a real modal primitive; whoever triages Items 5/20/23/25
   should confirm they're meant to become real dialogs (matching cttc)
   rather than staying as inline panels-in-place-of-main-content the way
   `AboutDialog`/`Preferences` are today.
3. **Priority/sequencing across sections A–H** — this document lists
   items in a logical dependency-aware reading order (style foundation →
   Sump unification → shell chrome → correlation UX → project/recording
   → events → settings → dev tooling), but does not commit to that as
   the actual build order; that's a triage decision once each item is
   promoted to a `FEAT-`/`REQ-`.
4. **`stream.svg`'s intended meaning** (Item 2's icon table) — it's
   named distinctly from `data-stream.svg` but no consuming code in
   either app disambiguates the two. Resolve directly with whoever
   commissioned the set before Item 2 is implemented, rather than
   guessing a mapping.
5. **No icon covers "Correlation"/"Events"/"Preferences"** (Item 2) —
   the 8-file set maps cleanly onto the Sump/DataStream/Recording/
   Track/Project entities but has nothing for the sidebar's other three
   nav items (currently 📊⚡⚙️ emoji). Either commission 3 more icons in
   the same style before Item 2 lands, or scope Item 2 to only replace
   the 5 entity-backed nav/dialog icons and leave the other 3 as a
   follow-up.

## 5. Traceability

Continuation of [`cttc-feature-parity.md`](cttc-feature-parity.md).
Per `CODE-OF-CONDUCT.md` §1, no item above starts as real development
work without first opening a `FEAT-`/`REQ-` against it once triaged —
this document only registers the `RM-NNNNNN` seeds via `/roadmap-add`.
