# Rules of Rules

> Instantiates the [catalyst framework](https://github.com/oliben67/catalyst.git)'s
> `development-framework/rules-of-rules.template.md`.

Meta-rules governing how any rule gets added to, changed in, or retired
from one of this project's rule documents: `rules/core/core-rules.md` and
`rules/env/env-rules.md` (see "Which document does a rule belong in?"
below). These apply to the *process* of maintaining those documents and the
code they describe, not to the app's behavior itself. Binding on anyone
(human or agent) adding to any of them, at any point after this file
exists.

Each rule must belong to a rule type directory under `rules/`, be stored as
its own markdown file in that directory, be listed in the corresponding
type index, and be referenced from the global index `rules/rules.md`.
There must be exactly one template file at `rules/TEMPLATE-RULE.md` and no
`TEMPLATE-RULE.md` files inside the rule-type directories. No rule may be
orphaned by missing a type, a local index entry, or a global index entry.

---

## 1. `rr-META-001` Check for conflicts before adding a new rule

Before a new rule is implemented, check it against the rules already
recorded in **every** rule document (`rules/core/core-rules.md` and
`rules/env/env-rules.md`) — not just the document that seems most relevant, since the same underlying
behavior is sometimes governed from more than one angle, and a change to
one side can silently break the other. Check, in order:

1. The same functionality area in whichever document(s) are relevant.
2. Each document's Cross-Cutting Notes heading (or equivalent).
3. Each document's Known Bugs / Quick Index heading — a "new" rule is
   sometimes actually a conflicting rewrite of an existing one.

If the new rule **contradicts, narrows, silently overrides, or would
break** an existing ✅ rule in any document, **stop and prompt for a
decision** — do not silently override it, and do not silently implement
both side by side and let whichever runs last win.

## 2. `rr-META-002` A new rule is never done until it's gathered, implemented, tested, and documented

All four, no exceptions:

- **Gathered** — the rule's actual current/intended behavior is
  understood and written down before code changes.
- **Implemented** — the rule actually exists in the code, not just in a
  comment, commit message, or this documentation.
- **Tested** — it has **at least one test** exercising it. `{{TEST_LOCATIONS}}`
  resolved (`env-TEST-001`/`env-TEST-002`): **`server/tests/`** (pytest +
  pytest-asyncio/pytest-cov/fakeredis/httpx) for the Sump server,
  **`app/renderer/src/**/*.test.ts`** (Vitest) for the Electron/React app.
  Both toolchains are live and verified clean as of 2026-08-23 — see
  `rules/env/env-rules.md`. A rule with zero test coverage is not "done" —
  it's "implemented but untested," and should be marked as such (see status
  markers below), not treated as an acceptable end state.
- **Documented** — added to the correct rule document, under the
  functionality domain it belongs to and the right rule category, with a
  `file:line` citation and a status marker, in the same format every
  existing entry already uses.

**Status markers**: ✅ working · ⚠️ buggy/incomplete · ❌ not implemented
/ regressed · 🗑 retired (see §4).

## Which document does a rule belong in?

Two rule documents so far:

- **`env` (`rules/env/env-rules.md`)**: toolchain, dependency, style,
  test, CI, local-dev, and repo-layout decisions for `server/`/`app/` —
  governs *how the codebase is built and maintained*, not what it does.
  Seeded via catalyst's greenfield instantiation path (framework v0.7.0+).
- **`core` (`rules/core/core-rules.md`)**: application/product behavior —
  what correlator actually does (telemetry/log correlation, Sump
  provisioning, data streams, and so on as they're built).

Not a hard wall: a rule about *how a rule is tested* (e.g. "every Sump
lifecycle transition needs its own test") is `env`; a rule about *what the
Sump lifecycle actually does* is `core`. Split `core` itself out by
natural seam (e.g. telemetry ingestion vs. correlation engine vs.
Sump/data-stream management — see `docs/roadmap/cttc-to-correlator-port.md`
§13's note on likely future `CORE.SUMP`/`CORE.DATASTREAM`/`CORE.PROJECT`
sub-domains) only once a single document stops being a useful single
source of truth — not preemptively.

## 3. `rr-META-003` Every rule has a unique, stable ID

Format: **`(DOC_PREFIX)-(DOMAIN)-(NNN)[-(parent-id)]`**

- **`DOC_PREFIX`** — which rule document the rule lives in. `cor` for
  `rules/core/core-rules.md`, `env` for `rules/env/env-rules.md`, plus the
  fixed `rr` prefix reserved for this file itself.
- **Name format** — every rule name must be more than the bare ID. The
  canonical name format is **`<rule-id>-<short-summary>`**, where the suffix
  is a lowercase slug that briefly describes what the rule is about. Example:
  `cor-CORE-001-telemetry-log-correlation`. This is a hard requirement for
  all new rules and must also be applied retroactively to existing deployed
  rules during framework deployment or synchronization.
- **`DOMAIN`** — a short, stable mnemonic code for the `##` functional
  domain the rule sits under. Fixed once assigned — renaming a domain's
  prose heading does not change its code, since existing IDs (in code
  comments, tests, Known Bugs indexes, cross-references) must keep
  resolving.
- **`NNN`** — a zero-padded 3-digit sequence number, unique within that
  `DOMAIN`, assigned in document order the first time IDs are
  retrofitted (or in creation order thereafter). Never reused, never
  renumbered, even if an earlier rule in the same domain is later
  deleted/retired.
- **`[-parent-id]`** — optional. Used two ways: (a) a rule that is a
  specialization/consequence of another rule references that rule's full
  ID as its own suffix; (b) a numbered sub-item inside a single rule
  bullet that enumerates several concretely distinct behaviors gets the
  parent's ID plus its own position (e.g. `cor-CORE-001-1`). Prefer this
  over inventing a new top-level rule when the sub-items are only
  meaningful in the context of the parent bullet.

Rules with no sub-items or parent never have the trailing segment — it's
absent, not empty.

### Domain codes — `core` (`rules/core/core-rules.md`)

| Code | Domain |
|------|--------|
| `CORE` | Core correlation engine: ingesting container telemetry (CPU / memory / network) and service logs, and associating them. |

### Domain codes — `env` (`rules/env/env-rules.md`)

| Code | Domain |
|------|--------|
| `RUNTIME` | Language and package manager for `server/`/`app/`. |
| `DEPS` | Dependency/lockfile policy. |
| `STYLE` | Lint/format/type-check tooling. |
| `TEST` | Test framework and locations. |
| `CI` | Continuous integration. |
| `DEVENV` | Local development setup. |
| `LAYOUT` | Repository/module layout. |

### Domain code — this file

| Code | Domain |
|------|--------|
| `META` | This file's own numbered rules (`rr-META-NNN`) |

### Adding a new rule

1. Pick (or confirm) the `DOMAIN` it belongs to.
2. Take the next unused `NNN` in that domain — check both the domain's
   existing bullets and the Known Bugs index.
3. Only add `[-parent-id]` if the rule is a numbered sub-case of one
   existing bullet, or an explicit specialization of another rule.

## 4. `rr-META-004` Retiring a rule

A rule ID, once assigned, is **never deleted and never reused** —
deleting the bullet outright breaks every cross-reference to it with no
trace of why. Instead, retire it in place:

1. Change its status marker to **🗑 retired**.
2. Leave the rule's text as-is (don't rewrite it to match new behavior —
   that's a *new* rule with a *new* ID) and append a one-line reason plus
   the date, e.g. `🗑 retired 2026-08-22 — superseded by \`cor-CORE-002\``.
3. If something replaces it, the replacement is a normal new rule (next
   `NNN` in its domain) — retirement does not imply the new rule
   inherits the old number, even via `[-parent-id]`.
4. Never repurpose a retired rule's ID for an unrelated rule later, even
   in the same domain.
5. A retired rule can still be a valid target for dev-artifact work (e.g.
   a bug explaining why it had to be retired) — retirement is a status
   change, not removal from the graph of things development work can
   cite.

## 5. `rr-META-005` Rules use typed directories and indexes

Every rule must live in a type-specific directory under `rules/`, for
example `rules/core/` or `rules/env/`. This is a hard requirement. Each
rule must be stored as its own markdown file in that directory (per
`rules/TEMPLATE-RULE.md`), and that file must be listed in the
corresponding local type index (`rules/core/core-rules.md` or
`rules/env/env-rules.md`) and the global `rules/rules.md` index. A rule
that is not present in its type index or the
global index is considered invalid until it is added to both. The only
rule-template file allowed at the rules root is `rules/TEMPLATE-RULE.md`;
concrete rule files belong under the type folders, not under the rules
root. Aggregating multiple rules into one file or relying on unindexed
notes is not permitted.

## 6. `rr-META-006` Development artifacts have their own ID scheme

If the deployed framework is missing `version.txt`, or if its version is
missing or lower than the current catalyst framework version (`0.8.0`), the
deployed framework must be synchronized before further work proceeds (see
the catalyst framework repository's `development-framework/SYNCHRONIZE.md`).

Format: **`(BUG|REQ|HK)-(NNNN)`** — see [`CODE-OF-CONDUCT.md`](../CODE-OF-CONDUCT.md).
`NNNN` is a zero-padded 4-digit sequence number, global within its own
type, assigned in creation order, never reused. See §9 for the separate,
non-rule-linked `FEAT-` scheme used for feature entries — it is not a
fourth member of this format.

## 7. `rr-META-007` Defining a new `##` domain

A bug or requirement is not required to fit an existing domain — it may
propose a new one, but only by following this standard.

**Domains are defined in their own directory, not inline in the rule
document.** Each domain gets one file at
`rules/domains/{{DOC_PREFIX}}-{{CODE}}-{{short-description}}.md` (e.g.
`rules/domains/cor-CORE-telemetry-log-correlation.md`). This is a hard
requirement, the same as for artifact and work-item filenames: the bare
`{{DOC_PREFIX}}-{{CODE}}.md` is not a valid filename — the file must carry a
short description of what the domain covers as part of its name. The
`{{CODE}}` used inside rule IDs (`{{DOC_PREFIX}}-{{CODE}}-{{NNN}}`) is
unaffected by this — only the on-disk filename gains the description
suffix. See [`rules/TEMPLATE-DOMAIN.md`](TEMPLATE-DOMAIN.md) for the exact
file structure (`Document`, `Defined`, `Parent`, `Sub-domains`, `Scope`,
`Relationship to other domains`).

### Sub-domains

A domain may be split into sub-domains when its scope is genuinely
large enough that "which part of CORE does this rule belong to" stops
being obvious from the flat list — not by default, and not just to make a
domain file shorter.

- **Code**: `{{PARENT}}.{{SUB}}` — parent code, a literal `.`, then a
  short sub-mnemonic (e.g. `CORE.INGEST`). This is still one `DOMAIN`
  value for ID purposes: a rule under it is
  `cor-{{PARENT}}.{{SUB}}-{{NNN}}` (e.g. `cor-CORE.INGEST-004`), with
  `NNN` scoped to the sub-domain, not the parent.
- **File**: `rules/domains/cor-{{PARENT}}.{{SUB}}-{{short-description}}.md`,
  alongside (not nested under) the parent's own
  `rules/domains/cor-{{PARENT}}-{{short-description}}.md` — the directory
  itself stays flat; the nesting is expressed by the code and by the
  `Parent`/`Sub-domains` fields cross-linking the two files.
- **Parent file** lists every child in its `Sub-domains` field. **Child
  file** names its `Parent` and inherits the parent's Scope/Relationship
  statements unless it explicitly narrows or overrides them.
- A sub-domain is subject to every other rule in this domain (conflict
  check, permanence, retirement) exactly like a top-level domain — it is
  not a lesser or informal category, just a narrower one.
- Sub-domains do not nest further than one level. If a sub-domain needs
  its own sub-domains, that's a sign the parent domain should be split
  into multiple top-level domains instead.

The `##` heading in the rule document itself carries only a one-line
pointer back to this file, not the full metadata:

```
## Core correlation

> **Domain:** `CORE` — see [`domains/cor-CORE-telemetry-log-correlation.md`](../domains/cor-CORE-telemetry-log-correlation.md).
```

This keeps the rule document itself readable (just rules) while the
domain's scope/conflict metadata lives in one findable, greppable place
per domain — `rules/domains/` is the authoritative index of every domain
that exists across every rule document, independent of which document's
prose you happen to be reading.

### Creating a new domain

1. **Conflict check first**, at the domain level: does an existing
   domain already cover this scope, even partially, under a different
   name? Check `rules/domains/` directly — it's the complete list.
   Extend the existing domain instead of duplicating it.
2. **Pick a code** — uppercase mnemonic, 3–7 characters, not already used
   as a `DOMAIN` code in the same document.
3. **Add the code to the canonical table** in this file, and create its
   `rules/domains/cor-{{CODE}}-{{short-description}}.md` file, in the
   same change that adds the domain.
4. **Write the domain file's Scope and Relationship-to-other-domains**,
   declaring either no conflict or the specific supersede/amend/
   contradict relationship to named existing rule IDs.
5. Add the one-line pointer under the `##` heading in the rule document.
6. Only then add the domain's first rule bullet(s), `NNN` starting at
   `001`.

A domain's code is permanent, same as a rule ID — never reused for an
unrelated domain even if the original is later emptied out or retired
(its `rules/domains/` file gets the same 🗑 retired treatment as a rule,
§4).

## 8. `rr-META-008` Scrum/agile work items have their own ID scheme

The framework version is tracked in `version.txt` at this deployment's
root. If it is missing, or its version is lower than `0.8.0`, it is
considered out of date and must be synchronized.

Format: **`(EPIC|STORY|TASK|SPIKE)-(NNNN)`** and **`SPRINT-(NNN)`** — see
[`work-items/rules-of-work-items.md`](../work-items/rules-of-work-items.md).
Work items are the process layer sitting above `BUG-`/`REQ-`/`HK-` docs.

## 9. `rr-META-009` Feature entries have their own, non-rule-linked scheme

Format: **`FEAT-(NNNN)`** — zero-padded 4-digit sequence number, global,
assigned in creation order, never reused. Same descriptive-naming
requirement as every other artifact and work-item ID: the name and
filename are `FEAT-NNNN-<short-summary>` / `FEAT-NNNN-<short-summary>.md`,
never the bare ID. Stored one file per entry under `features/`, indexed in
`features/features.md`, using [`features/TEMPLATE-FEATURE.md`](../features/TEMPLATE-FEATURE.md).

A feature entry documents a possible future capability — an idea or
roadmap item, not a claim about current or required behavior. It is
**not** one of the development artifacts in §6 and is exempt from:

- §1 (`rr-META-001`)'s conflict check,
- `CODE-OF-CONDUCT.md` §1 ("no development without a targeted rule"), and
- ever carrying a `Targets` or `Domain` field.

It is never "done" against a rule and is never itself implemented. Once
work on a feature actually starts, open a `REQ-NNNN` requirement (§6)
that targets or proposes the rule(s) the feature requires — that
requirement, not the feature entry, is what gets vetted against existing
rules, assigned a domain, and measured for completion. The feature entry
records which requirement(s) resulted from it, for traceability back to
the original idea, but that link is informational, not a rule target.

## 10. `rr-META-010` Roadmap items have their own, source-tracked scheme

Format: **`RM-(NNNN)`** — zero-padded 4-digit sequence number, **global
across every named roadmap**, assigned in the order
`/roadmap-add`/`/roadmap-update`/`/roadmap-merge` first adds each item,
never reused. Unlike a rule or a dev-artifact but like `FEAT-NNNN`, an
`RM-` item is a table row, not its own file — but unlike `FEAT-NNNN` (one
flat `features/features.md`), roadmap rows are partitioned across **one
file per named roadmap**: `development/roadmaps/<name>.md`
(`development/roadmaps/TEMPLATE-ROADMAP.md`), each registered in
`development/roadmaps/roadmaps.md`. A project may hold several named
roadmaps at once (e.g. a product roadmap and an infra roadmap, ingested
and updated independently); an `RM-NNNN` ID stays unique and resolvable
regardless of which named roadmap's file it lives in.

A roadmap item records that an external source (a product roadmap, a
planning doc, a stakeholder request) named this as a future direction —
not a claim about current or required behavior, and not itself one of the
development artifacts in §6. It is exempt from:

- §1 (`rr-META-001`)'s conflict check,
- `CODE-OF-CONDUCT.md` §1 ("no development without a targeted rule"), and
- ever carrying a `Targets` or `Domain` field.

A roadmap item is never "done" against a rule and is never itself
implemented. Once a human decides it's worth tracking inside catalyst,
`/create-feature` opens a `FEAT-NNNN` for it (§9), citing the `RM-NNNN` ID
in the feature's `Roadmap` field — that feature entry, and the `REQ-NNNN`
it may later become, are what actually get vetted, assigned a domain, and
measured. Each roadmap file's `Status`/`Linked` columns mirror whichever
of those is currently linked, refreshed by `/show-backlog`, so a roadmap
item's progress stays visible without becoming a second, competing source
of truth for completion.

A named roadmap itself is never hard-deleted once any of its rows carry a
`Linked` value — see §4's retirement principle. `/roadmap-remove` retires
it in place instead (marks it retired, keeps every row and ID resolvable)
whenever removing it outright would break a `FEAT-`/`REQ-` cross-reference.

## 11. `rr-META-011` Users and roles are advisory, not access control

`development/users.json` (`development/users.json`, seeded from the
catalyst framework's `templates/users.template.json`) is the registry of
people who can sign work — a JSON array of `{name, roles, registered,
active, notes}` objects, kept as data rather than a hand-edited document
because it is managed exclusively by commands:
`/user-add`/`/user-remove`/`/user-modify`/`/user-assign-role`/`/user-list`
— see `CODE-OF-CONDUCT.md` §4. `development/roles.json` (seeded from
`templates/roles.template.json`) maps each role to the actions/commands
it typically performs — a JSON array of `{name, actions}` objects, seeded
with a default agile-role mapping and then extended via `/role-add` (new
role) and `/role-modify` (change an existing role's actions).

**`development/users.json` must contain at least one entry with
`"active": true`.** This is a hard requirement, unlike `roadmaps.md`'s
"empty is fine": a project with zero active users has nobody to sign
work, so deployment is not complete until `/user-add` has registered at
least one person. `/user-remove` refuses (or warns, per the command's own
spec) if removing the last active user would leave zero.

Catalyst has no way to verify who is actually typing, so beyond that one
hard existence requirement, this scheme is **advisory**: before an
artifact-creating or status-changing command completes, the agent
resolves who is signing it, checks their role(s) against `roles.json`,
and — if the action isn't one their role covers, or they aren't
registered at all — asks for confirmation rather than refusing outright.
Every dev-artifact, feature entry, roadmap item, and work item carries a
`Signed-off-by` field recording the outcome (`CODE-OF-CONDUCT.md` §2).

`/user-remove` never deletes a user's entry, the same "never delete,
retire in place" principle as §4 and §10: it sets `active` to `false` so
every `Signed-off-by` reference already recorded against that name stays
resolvable. A changed or removed role in `roles.json` likewise never
retroactively changes a `Signed-off-by` value already recorded — that
value reflects who signed it under the mapping in effect at the time.

## 12. `rr-META-012` The journal is transaction-log-grade, not a changelog

`development/journal.jsonl` — one JSON object per line, strictly
append-only. A "changelog" narrates what happened; this journal is
precise enough to **replay**: every entry carries exact content pointers,
not just prose, so a point in time is mechanically reconstructable, not
just describable.

### Entry schema

```json
{
  "timestamp": "2026-08-23T19:00:00Z",
  "actor": "<name (or git_username, once set — see §13) from development/users.json>",
  "command": "/create-req",
  "action": "create | update | close | retire | status-change | sync",
  "artifact": "REQ-0001",
  "targets": ["cor-CORE-001"],
  "intent": ["one or more sentences — the goal driving this change, not a label"],
  "files": [
    {"path": "requirements/REQ-0001-foo.md", "before": null, "after": "a1b2c3...(40 hex)"},
    {"path": "requirements/requirements.md", "before": "d4e5f6...", "after": "g7h8i9..."}
  ]
}
```

- **`targets`** — the rule ID(s) this change relates to, when applicable;
  `[]` for non-rule-linked artifacts (`FEAT-`, `RM-`, users, roles). This
  is the machine-readable half of the chain invariant (`rr-META-005`) —
  every entry either names the rule(s) it serves or explicitly carries
  none, never leaves it ambiguous.
- **`intent`** — the *why*, as one or more full statements of purpose
  (what the actor was trying to achieve), not a terse label. Plural
  because one atomic change sometimes serves more than one goal (e.g.
  "close a gap found while retrofitting a different rule" *and* "satisfy
  the rule being retrofitted").
- **`files[].before`/`files[].after`** — the `git hash-object` SHA-1 of
  that file's content immediately before and immediately after this
  change, computed **and written to the git object store** with
  `git hash-object -w <path>` (not just computed) so the blob is
  retrievable via `git cat-file -p <hash>` independent of whether
  anything was ever committed or staged — this command never commits or
  stages on its own (`rules/Rules-of-Rules.md` hard rules,
  catalyst framework `INVARIANTS.md` INV-4). `null` means the file didn't
  exist before (create) or doesn't exist after (delete).

### Point-in-time restore

To reconstruct the tree as of timestamp `T`: for every file path that
appears in any entry with `timestamp <= T`, take that file's `after` hash
from its **latest** such entry (or treat it as absent if that latest
`after` is `null`), then materialize each into a side directory via
`git cat-file -p <hash> > <side-dir>/<path>` — **never overwrite the live
working tree directly**; that's the user's call once they've reviewed the
reconstruction. `/journal-restore <timestamp>` performs exactly this.

### What must append an entry

Every command that creates, modifies, closes, or retires a rule-linked
artifact, rule, domain, or work item, or changes a `Status` field
(`CODE-OF-CONDUCT.md` §9) — resolve every touched file's `before` hash
*before* editing it, make the edit, then compute+write its `after` hash,
append one entry covering every file the command touched, then report the
result. This is the last step of the command, after everything else it
already does — it does not replace any of a command's existing steps.

### Complements, does not duplicate, `catalyst-git`

The `catalyst-git` plugin continuously audits a *deployed project* for
rule violations and writes pass/fail reports to `audits/` (catalyst
framework `INVARIANTS.md` INV-13: never catalyst's own repository). This
journal is core framework infrastructure — it applies to catalyst's own
self-deployment too — and it records history for reconstruction, not
violations for alerting. A project may have both: the journal answers
"what changed and why, and can I get back to how it was," `catalyst-git`
answers "did anything just break a rule."

## 13. `rr-META-013` Repoed deployments: `thingamabob` and per-user branches

Every deployment's `.catalyst-proj/` is a **local working copy**
(catalyst framework `INVARIANTS.md` INV-6 — that never changes). A
deployment additionally becomes **repoed** when `DEPLOYMENT.md` records
`repoed: true`, `catalyst_repo`, `catalyst_repo_url`, and `created_by`:
from then on, its canonical, shared state also lives in a dedicated
repository, letting multiple users/instances of the same deployed
project converge on one agreed-upon `.catalyst-proj/` rather than
silently diverging. **This is opt-in — most deployments never need it.
correlator is not currently repoed** (no `DEPLOYMENT.md` exists yet;
deployment target tracking uses this session's persistent memory
instead, per `BOOTSTRAP.md` §1's primary path).

### Bootstrap and branching: `/thingamabob create <name> <git-info>`

**First call for this deployment** (not yet repoed): establishes the
dedicated repo. If `<git-info>` doesn't already exist, create it there
(named `<name>`, conventionally `<project-name>-catalyst-proj` but not
enforced); if it already exists, register it as-is rather than
recreating it. **This is an externally-visible, hard-to-reverse action —
confirm with the user before creating it, distinct from the general
push-assent already implied by invoking this command.** Record
`repoed: true`, `catalyst_repo: <name>`, `catalyst_repo_url: <git-info>`,
`created_by: <the current Signed-off-by actor>` in `DEPLOYMENT.md`, then
push the current local `.catalyst-proj/` state as the first commit on a
branch named `thingamabob` — the **master version**: the canonical
branch every subsequent push targets. Nothing is vetted on this first
push; there's nothing yet to vet it against.

**Called again, already repoed:** does not refuse. If `<git-info>`
matches the already-registered `catalyst_repo_url`, this **branches the
repo**: create a new branch, named `<name>` in its branch-safe form (see
below), seeded from `thingamabob`'s current state — a fresh line of work
that doesn't touch `thingamabob` or `created_by`. If `<git-info>` names a
*different* repo than the one already registered, that's unusual enough
to confirm explicitly with the user before proceeding (adding a second,
independent dedicated repo for one deployment, rather than the ordinary
branching case) rather than silently doing either.

### Joining: `/thingamabob get <repo> <username>`

For a user who doesn't have a local `.catalyst-proj/` copy of an
already-repoed deployment yet — the "join" path, distinct from `create`
(which is for establishing or branching the repo itself). Validate
`<username>` per the branch-safe-name rule below, refusing with a
suggested alternative if it doesn't survive sanitization uniquely.
Download `<repo>`'s current `thingamabob` branch content and check out a
new branch for it named `<username>.catalyst-proj` (in its branch-safe
form) — this materializes as this user's local `.catalyst-proj/`, ready
for `/thingamabob push` from there on. This is a valid alternative to the
normal `INSTANTIATION-GUIDE.md` install flow when the project is already
repoed elsewhere: join what exists rather than re-instantiating from the
framework templates.

### Branch-safe names

Every git ref name this mechanism derives from a person's identity — the
`<name>` in a branching `/thingamabob create` call, `/thingamabob get`'s
`<username>`, and (before a user has a `git_username` — see below) the
push-branch name derived from `Signed-off-by` — uses that name's
**branch-safe form**: lowercase, every run of characters that
isn't `[a-z0-9]` collapsed to a single `-`, leading/trailing `-` trimmed.
A registered display name like "Olivier Steck" is not itself a valid git
ref component (`olivier-steck` is); this is deterministic and applied
uniformly, never skipped because a name happens to already look
git-safe. If two distinct registered names would collapse to the same
branch-safe form, refuse and ask for a manual override rather than
silently colliding two people's branches.

### Identity migration: `git_username`

The moment a user's real git identity becomes known to catalyst — the
current actor running `/thingamabob create` (resolved from `git config
user.name`, branch-safe form applied), or a joining user via
`/thingamabob get <repo> <username>` (`<username>` *is* their git
identity, given explicitly) — that value is written as `git_username` on
their `development/users.json` entry, alongside (not replacing) `name`.
**From that point on, every `Signed-off-by` field and every journal
`actor` field this framework writes for that user uses `git_username`
instead of `name`.**

Existing artifacts are handled differently from the journal, deliberately:

- **Artifacts** (`bugs/`, `requirements/`, `features/`, roadmap rows,
  work items) are living documents, not a log. Every existing
  `Signed-off-by` occurrence that currently names this user's old `name`
  is rewritten in place to their new `git_username` — this is what "the
  signature of everything done before is updated" means concretely.
- **The journal is never rewritten.** §12 (INV-17) makes it immutable —
  entries are never edited, deleted, or reordered, full stop, and that
  guarantee does not bend for identity migration either. Instead, the
  migration itself gets **one new entry appended**: `command:
  "/thingamabob create"` (or `"/thingamabob get"`), `action: "update"`,
  `intent: ["migrate <old name>'s signing identity to git_username
  <git_username> for all operations henceforth"]`, and `files` covering
  every artifact file actually rewritten, with real before/after hashes
  like any other change. The history before the migration still reads
  "signed by `<name>`," truthfully — that's what happened at the time —
  and the migration entry is what makes the *why* of the shift
  reconstructable later, consistent with the whole point of §12.

### Sync: `/thingamabob push`

Refuses if this deployment isn't repoed yet (point to `/thingamabob
create`). Push the local `.catalyst-proj/` state to the current actor's
branch — `<git_username>.catalyst-proj` once they have one, otherwise the
branch-safe form of `name` — in the dedicated repo (creating that branch
if it's this user's first push, the same branch `/thingamabob get` would
have created for them if they joined that way instead). Then:

1. **Vet** the incoming branch against `thingamabob`: run `/dogfood`
   (`CODE-OF-CONDUCT.md` §4) against the merged-in state — the same
   `/check-rules` + four-eyes sub-agent check available standalone,
   reused here rather than re-described. Disagreement between the two
   sub-agents, or a rule violation either flags, is not silently
   resolved — surface it and stop short of merging.
2. **Merge** using AI where a plain merge can't resolve it: attempt a
   normal merge of the branch into `thingamabob` first; only where that
   leaves conflicts (git-level, or a vetting-flagged semantic clash), a
   sub-agent proposes a resolution guided by `rr-META-001`'s own
   conflict-check principle — never silently drop either side's
   rule-compliant intent, and if the conflict is genuinely irreconcilable,
   stop and prompt the user rather than guessing which side wins.
3. **Update both branches** with the merged result: `thingamabob` gets
   the merge commit, and the contributor's own push branch (above) is
   fast-forwarded to match, so their next push starts from the
   already-merged state instead of re-triggering the same merge.
4. **Refresh the local copy**: pull the updated `thingamabob` down and
   overwrite the local `.catalyst-proj/` directory (and this session's own
   in-memory record of it) to match — the local copy never silently drifts
   from what was just agreed upon remotely.

### `--force`

`/thingamabob push --force` skips vetting and merging entirely and
overwrites `thingamabob` directly with the local state — the same
destructive-shortcut shape as `/sync-framework --force`, and gated the
same way access to anything destructive is gated in this framework:
**refused for anyone other than the repo's recorded `created_by` user.**
Every other contributor only ever gets the vetted-and-merged path.

### What this is not

Not a replacement for `/sync-framework` (that synchronizes the *framework
template* into a deployment; this synchronizes one deployment's *own
state* across its contributors) and not a substitute for the journal
(§12) — a `thingamabob` merge is itself a change subject to the same
journaling rule as any other, once it lands locally.
