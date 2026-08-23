# Code of Conduct

> Instantiates the [catalyst framework](https://github.com/oliben67/catalyst.git)'s
> `development-framework/rules-of-development.template.md`.

Standards for how development work — bugs, requirements, house-keeping, and
meta-tags — gets proposed, tracked, and closed. Subordinate to
[`rules/Rules-of-Rules.md`](rules/Rules-of-Rules.md): that file governs the
rules themselves; this file governs the work items that reference those
rules.

---

## 1. No development without a targeted rule

**No bug, requirement, house-keeping work, or meta-tag may start without
citing one or more existing rule IDs in its `Targets` field when the tag is
used to annotate a rule-linked artifact.** If no rule currently covers the
behavior in question:

1. Define the rule(s) first, as a normal edit to the relevant rule
   document (currently just `rules/core/core-rules.md` — see §3 below).
2. That definition must satisfy `rules/Rules-of-Rules.md` §1 (conflict check)
   and follow the ID scheme in §3 of that file.
3. Only then open the `BUG-`/`REQ-`/`HK-` item, citing the new ID(s).

House-keeping is the one category where "no rule applies" is a legitimate
answer (pure repo hygiene with no bearing on any documented behavior or
process) — but it must be stated explicitly, not left blank.

## 2. Users, roles, and signing

`development/users.json` is a JSON array of registered users (`{name,
roles, registered, active, notes}`, plus `git_username` once a repoed
deployment resolves it — see `rules/Rules-of-Rules.md` §13), managed only by
`/user-add`/`/user-remove`/`/user-modify`/`/user-assign-role`/`/user-list`
— see §4. Once a user has a `git_username`, every `Signed-off-by`/journal
`actor` written for them uses that, never `name`. Each user has one or
more roles drawn from
`development/roles.json`, a JSON array of `{name, actions}` objects
mapping each role to the actions/commands it's expected to perform.
`roles.json` is seeded with a default agile-role mapping and then extended
via `/role-add` (new role) or `/role-modify` (change an existing role's
actions).

**This is JSON, not hand-edited markdown, precisely because it's managed
exclusively by commands** — the same reasoning that keeps
`development/BACKLOG.md` machine-only, just with structured data instead
of a regenerated document.

**Hard requirement: `development/users.json` must always have at least one
entry with `"active": true`.** A project with nobody registered has nobody
to sign work. `/user-remove` must refuse or warn (per its own spec) rather
than silently drop the last active user to zero.

**Beyond that one hard requirement, this role model is advisory, not an
access-control system.** Catalyst has no way to verify who is actually
typing, so a role mismatch is a prompt for confirmation, never a silent
block:

1. Before an artifact-creating or work-item-status-changing command
   completes, resolve who is signing it: the user established earlier this
   session, or ask if not yet established (don't guess from git config —
   confirm with the user).
2. Look up that name in `development/users.json`. If unregistered, say so
   and ask whether to proceed anyway or register them first via
   `/user-add`.
3. Look up their role(s) in `development/roles.json` and check whether the
   action being performed is one that role covers. If it isn't, say so and
   ask for confirmation before continuing — never refuse outright.
4. Once confirmed (or if the role already covers the action), fill the
   artifact's `Signed-off-by` field with the user's name and proceed.

Every dev-artifact, feature entry, roadmap item, and work item carries a
`Signed-off-by` field for this reason (see each type's template). It
records who actually signed the artifact, which may differ from who typed
the command on their behalf.

## 3. Standard document types

| Type | Folder | Template | ID prefix |
|---|---|---|---|
| Bug | `development/bugs/` | `development/TEMPLATE-BUG.md` | `BUG-NNNN` |
| Requirement | `requirements/` | `requirements/TEMPLATE-REQUIREMENT.md` | `REQ-NNNN` |
| House-keeping | `development/house-keeping/` | `development/TEMPLATE-HOUSE-KEEPING.md` | `HK-NNNN` |
| Meta-tag | `development/meta-tags/` | `development/TEMPLATE-META-TAG.md` | `TAG-<KEY>-<ARTEFACT-ID>` |

Feature entries (`FEAT-NNNN`, folder `features/`, template
`features/TEMPLATE-FEATURE.md`) are a related but **separate,
non-rule-linked** scheme — see `rules/Rules-of-Rules.md` §9. They document
possible future work, are not one of the four development-artifact types
above, and are exempt from this document's rules (no `Targets`, no
`Domain`, never "done" against a rule). When a new feature actually needs
to be developed, open a `REQ-NNNN` requirement — never a `BUG-NNNN` — to
track it.

Roadmap items (`RM-NNNN`, table rows inside `development/roadmaps/<name>.md`
files — one file per named roadmap, template
`development/roadmaps/TEMPLATE-ROADMAP.md`, index
`development/roadmaps/roadmaps.md`) sit one level above feature entries —
see `rules/Rules-of-Rules.md` §10. They are populated by
`/roadmap-add`/`/roadmap-update`/`/roadmap-merge` from an external source
file rather than created one at a time, and are exempt from this
document's rules the same way feature entries are (no `Targets`, no
`Domain`, never "done" against a rule). Formalizing a roadmap item means
opening a `FEAT-NNNN` for it via `/create-feature`, citing the `RM-NNNN`
ID in the feature's `Roadmap` field.

### Hard rule: individual files and indexes

- **This is a hard requirement.** Bugs, requirements, house-keeping items, and
  meta-tags must each be stored as their own individual markdown file in the
  corresponding folder, not only as free-form notes or grouped content.
- **This is also a hard requirement.** Every item must be listed in the
  corresponding type index file so the repository has an authoritative catalog
  of the concrete documents that exist.
- Each item type has an index file:
  - `development/bugs.md` for the bug index.
  - `requirements/requirements.md` for the requirements index.
  - `development/house-keeping.md` for the house-keeping index.
  - `development/meta-tags.md` for the meta-tag index.
- These index files are the canonical indexes for their directory and must be
  kept up to date.
- **This is a hard requirement.** `development/BACKLOG.md` always exists —
  seeded from the catalyst framework's `templates/backlog.template.md` on
  first deploy — as the go-to document for developers to review work to be
  done and current status. It is not hand-maintained: `/show-backlog`
  regenerates it in full every time it runs, including every
  `development/roadmaps/<name>.md`, so it never drifts from the real
  indexes. See the catalyst framework's `INVARIANTS.md` INV-14.
- **This is also a hard requirement.** `development/roadmaps/` and its
  `roadmaps.md` index always exist (empty is fine — individual named
  roadmaps are created only via `/roadmap-add`). Within any
  `development/roadmaps/<name>.md` that does exist, only the
  `/roadmap-add`/`-update`/`-merge`/`-remove` commands and `/show-backlog`
  (Status/Linked refresh) ever change it; hand-editing anything but a
  row's Notes column is pointless. See the catalyst framework's
  `INVARIANTS.md` INV-15.
- **This is a hard requirement, stricter than the others above.**
  `development/users.json` and `development/roles.json` always exist, and
  `users.json` must contain **at least one entry with `"active": true`** —
  not "empty is fine," since a project with nobody registered has nobody
  to sign work. Both files are managed only by the `/user-*`/`/role-*`
  commands (§2, §4), never hand-edited. See the catalyst framework's
  `INVARIANTS.md` INV-16.
- **This is a hard requirement.** `development/journal.jsonl` always
  exists (empty is fine). Once a line is appended it is never edited,
  deleted, or reordered — stricter than every other "never hand-edited"
  rule above, since even the commands that write to it only ever append.
  See the catalyst framework's `INVARIANTS.md` INV-17 and §9 below.

- **Bug**: an existing ✅ rule doesn't actually hold in the running system,
  or formalizes an already-known ⚠️/❌ rule into trackable, closeable work.
  Never introduces a new rule by itself.
- **Requirement**: an explicit, tracked requirement that captures
  user/business behavior that must be implemented and tested — this is the
  artifact to open when a new feature needs to be developed, never a bug.
  It must be vetted against every existing rule document (`rules/Rules-of-Rules.md`
  §1 conflict check) before it's opened, it always carries a `Domain`, and it
  always answers — targets and/or proposes — one or more rules (and, if
  needed, a new domain — see `rules/Rules-of-Rules.md` §6/§7) inline in the
  requirement doc so rule and requirement are reviewed together. None of
  those three are optional.
- **House-keeping**: dev-support tooling/process, not product behavior.
  Still targets a rule where one exists — most commonly a `rr-META-*`
  process rule.
- **Meta-tag**: a lightweight annotation attached to an existing artifact.
  It stores one key/value pair whose key is one of `comment`, `version`, or
  `link-to`, and it is saved under the name `tag-<key>-<artefact-id>`.

## 4. Slash-command entry points

The catalyst framework defines the following custom slash commands. This
deployment has them wired up as native Claude Code command files under
`.claude/commands/*.md` at the project root (see the root
[`README.md`](README.md)'s "Slash commands" note) — this section remains
the authoritative behavior spec each command file points back to:

- `/create-bug` — create a new bug artifact immediately, register it in
  `development/bugs.md`, and track it in the same workflow as any other bug.
- `/create-req` or `/create-requirement` — create a new requirement artifact
  immediately, register it in `requirements/requirements.md`, and track it in
  the same workflow.
- `/create-feature` — create a new feature entry immediately and register it
  in `features/features.md`. Unlike `/create-bug`/`/create-req`, this never
  prompts for a rule target or domain — features are not rule-linked (see
  `rules/Rules-of-Rules.md` §9). If it formalizes an existing roadmap row,
  cite that row's `RM-NNNN` ID in the new feature's `Roadmap` field and set
  the row's `Status` to `Triaged` and `Linked` to the new `FEAT-NNNN`.
- `/roadmap-add <name> <file>` — ingest a new named roadmap from a local
  file, creating `development/roadmaps/<name>.md` (from
  `development/roadmaps/TEMPLATE-ROADMAP.md`) with one `RM-NNNN` row per
  distinct item it identifies (IDs continuing the global sequence across
  every existing named roadmap, never reused), and registering it in
  `development/roadmaps/roadmaps.md`. Refuses if `<name>` already exists —
  use `/roadmap-update` or `/roadmap-merge` instead.
- `/roadmap-update <name> <file>` — re-ingest `<file>` as the new full,
  authoritative version of an existing named roadmap: add new rows, update
  matched rows' `Title`/`Notes` (matched by similarity — ask if ambiguous),
  and flag — never delete — any row whose item no longer appears in the
  new file. Refuses if `<name>` doesn't exist.
- `/roadmap-merge <name> <update file>` — fold a partial delta file into an
  existing named roadmap: add/update only the rows the delta mentions,
  without flagging anything as missing, and without changing `Source`
  (only `Last updated`). Refuses if `<name>` doesn't exist.
- `/roadmap-remove <name>` — delete `development/roadmaps/<name>.md` and
  its `roadmaps.md` entry if no row is linked to a `FEAT-`/`REQ-`;
  otherwise retire it in place (add a `Retired` date, mark it `retired` in
  the index) rather than deleting it, since that would break a live
  cross-reference.
- `/user-add <name> <role>` — register a new user in
  `development/users.json` with an initial role from
  `development/roles.json` (creating both files from their templates
  first if neither exists yet). Refuses if `<name>` is already registered.
- `/user-remove <name>` — set `<name>`'s `active` field to `false`. Never
  deletes the entry (existing `Signed-off-by` references must stay
  resolvable). Refuses or warns if this would leave zero active users.
- `/user-modify <name> <field> <value>` — edit `<name>`'s `notes` field
  (or `active`, but never to `false` — use `/user-remove` for that, which
  also checks the zero-active-users rule). Refuses for `roles` (use
  `/user-assign-role`) and identity/audit fields (`name`, `registered`).
- `/user-assign-role <name> <role>` — add `<role>` to `<name>`'s `roles`
  array (additive).
- `/user-list [--role <role>] [--active-only]` — list registered users,
  optionally filtered.
- `/role-add <role> <actions>` — add a new role entry to
  `development/roles.json`. Refuses if `<role>` already exists.
- `/role-modify <role> <actions>` — replace an existing role's `actions`.
  Refuses if `<role>` doesn't exist. Never retroactively changes a
  `Signed-off-by` value already recorded under the old mapping.
- `/create-epic` — create a new epic work item and register it in
  `work-items/epics.md`.
- `/create-story` — create a new story work item and register it in
  `work-items/stories.md`.
- `/create-task` — create a new task work item and register it in
  `work-items/tasks.md`.
- `/create-spike` — create a new spike work item and register it in
  `work-items/spikes.md`.
- `/create-sprint` — create a new sprint container and register it in
  `work-items/sprints.md`.
- `/meta-tag` — create a new meta-tag artifact, save it as
  `tag-<key>-<artefact-id>`, register it in `development/meta-tags.md`, and
  link it to the specified artifact.
- `/list <type> [--filter ...]` — list artifacts, work items, rules, or
  templates of the requested type. Use `all` to list everything. Each
  `--filter` is a property filter expressed as `key=value` or
  `key="value*"`; filters apply across the selected collection. If the
  requested type is `template`, the command requires an additional
  `--type <template-type>` argument to identify which template family to
  inspect.
- `/freeze <item-id|item-path|type|template-name>` — protect the resolved
  item from `/sync-framework` by recording its file path in a root-level
  `.frozen` file. The command accepts one of four argument forms: an item
  ID, an item path, a type, or a template name.
- `/catalyzer <subcommand>` — manage plugin installation and activation
  through the framework interface. Every subcommand resolves plugins against
  the registry file `plugins/<type>/catalog.md` in the catalyst framework
  repository (currently only `plugins/repository/catalog.md`, since the
  repository type is the only plugin type defined at this time), which is
  the sole source of truth for which plugins are registered, their git
  repository URL, the release/tag that ships with the current catalyst
  release, and their framework-version compatibility. Each catalog entry has
  a `Compatibility` field: a bare `*` means the plugin is compatible with
  every framework version — the default for a registered plugin, and never
  grounds for `/sync-framework` to deactivate it. A future convention allows
  specific version constraints in that field instead, expressed with the
  same range syntax used in a dependency lock file, to mark a plugin as
  excluded from named framework versions. Supported subcommands:
  - `list` — list all available plugins by type, read from each type's
    `catalog.md`, including each plugin's repository URL, pinned
    release/tag, and compatibility.
  - `activate <name> <version|latest>` — download or update the plugin to
    the specified version (or `latest`) and activate it. This command
    requires a version argument.
  - `download <name> <version|latest>` — download the plugin into the
    framework without activating it. The plugin remains installed and
    inactive until it is explicitly activated.
  - `deactivate <name>` — deactivate a plugin by its registered name, remove
    it from memory, and mark it inactive.
  - `upgrade <name|latest>` — upgrade an already installed plugin to a
    specified version or to the latest available version.
  - `downgrade <name> <version>` — downgrade an already installed plugin to
    the specified version.

  Plugins are not loaded into memory unless they are explicitly activated
  via this command, and on framework startup the framework must scan the
  installed plugin list and activate only those marked active. This is a
  hard rule. The framework defines the interface and lifecycle contract; the
  plugin itself owns its implementation details, operational guidance, and
  domain-specific behavior. Each plugin must live in its own repository,
  with no exceptions, and plugins must be pulled directly from that
  plugin's own repository rather than from the catalyst framework
  repository.
- `/thingamabob create <name> <git-info>` — bootstrap a repoed deployment
  (`rules/Rules-of-Rules.md` §13): register or create the dedicated repo,
  then push local `.catalyst-proj/` as the first commit on its
  `thingamabob` branch. Also resolves the current actor's `git_username`
  and migrates their prior `Signed-off-by` occurrences to it (never the
  journal). Called again against the same repo with a different `<name>`,
  branches instead of refusing. **Creating/registering an external repo
  is externally-visible and hard to reverse — confirm with the user
  before doing it, beyond the general assent already implied by invoking
  this command.** *(Not activated for this deployment — correlator has no
  `DEPLOYMENT.md`/`repoed: true` yet.)*
- `/thingamabob get <repo> <username>` — join an already-repoed
  deployment: download `<repo>`'s `thingamabob` branch and check out
  `<username>.catalyst-proj` (branch-safe form) as this user's local
  `.catalyst-proj/`. Same identity-migration treatment as `create`.
- `/thingamabob push [--force]` — vet the current user's push branch
  against `thingamabob` (`/check-rules` + a four-eyes sub-agent pass via
  `/dogfood`), AI-merge where a plain merge can't resolve it, update both
  branches, refresh the local copy. Refuses if not yet repoed. `--force`
  skips vetting and overwrites `thingamabob` directly — refused for
  anyone but the repo's `created_by` user.
- `/status <artefact-id> <status> [force]` — update an artifact or work
  item's `Status` field. If the supplied status is one of the valid statuses
  for that artifact type, change it normally. If the status is invalid and
  the command includes the word `force`, change it to that invalid value
  anyway. If the status is invalid and `force` is not supplied, respond that
  the status change is impossible and do not modify the artifact. If the
  artifact ID does not resolve to an existing artifact, state that the
  artifact cannot be found.
- `/audit <file-name>` — analyze the change-impact of the specified file by
  checking the current repository state, the file's role in the framework,
  and the rules or artifacts that depend on it, then return a concise
  impact summary. If the file cannot be resolved, report that it was not
  found and do not invent a result.
- `/run-analysis` — open and execute the analysis playbook from the
  catalyst framework repository's `development-framework/ANALYSIS-PLAYBOOK.md`,
  following its steps and returning the resulting analysis summary. If the
  playbook is unavailable, report that and do not invent missing content.
- `/sync-framework [latest|<version>] [--force <scope>]` — synchronize the
  deployed framework with the requested framework version. If the argument
  is `latest`, use the newest framework version available from the catalyst
  framework repository. If no argument is provided, synchronize against the
  currently installed local version (see `version.txt`). Before
  synchronizing an item, check the root-level `.frozen` file; if the item's
  path is listed there, skip it unless the command includes one of the
  valid overrides: `--force <type>`, `--force <item-id>`, or `--force all`.
  When an item is refreshed, remove it from `.frozen` so the refreshed
  version no longer carries the frozen protection. Synchronization must
  never deactivate an already-active plugin as a side effect of a framework
  version change unless that plugin's `Compatibility` field explicitly
  excludes the target version. Synchronization must never treat a deployed
  `plugins/<type>/catalog.md` or any installed plugin directory, an
  existing named roadmap file, or `development/roles.json`/`users.json` as
  overwritable framework template content — those merge or get created
  once, never overwritten wholesale. After the refresh completes, perform
  a four-eyes verification pass: one sub-agent verifies the newly deployed
  framework against the framework's `INSTANTIATION-GUIDE.md` and rules,
  and a second independent sub-agent repeats the verification from a
  separate pass. The sync is not complete until both approve; any
  disagreement or failed validation becomes a blocking issue.
- `/check-rules` — verify that rules, domains, and artifact links remain
  consistent and do not conflict.
- `/dogfood` — vet the current deployment against its own rules: run
  `/check-rules`, then an independent four-eyes sub-agent pass checking
  whether the deployment's actual state (code, tests, docs) still matches
  what its rules claim, surfacing drift without fixing it automatically.
  This is the same check `/thingamabob push` runs on every push — usable
  standalone any time.
- `/show-backlog` — summarize open work, blockers, and missing links,
  **overwrite `development/BACKLOG.md` in full** with the result, and
  refresh every active `development/roadmaps/<name>.md`'s Status/Linked
  columns from whichever `FEAT-`/`REQ-` each row is linked to (not
  optional — a stale `BACKLOG.md` or roadmap file that doesn't match the
  last run is itself a bug in the deployment, per INV-14/INV-15).
- `/journal [--since <date>] [--artifact <id>] [--actor <name>] [--rule <id>]`
  — read-only: filter and report `development/journal.jsonl` entries.
  Never writes to the journal.
- `/journal-restore <timestamp>` — read-only: reconstruct the tree as it
  stood at `<timestamp>` into a side directory, from the journal's
  before/after file hashes (`rules/Rules-of-Rules.md` §12). Never
  overwrites the live working tree.
- `/help` — list all supported custom slash commands and their purpose, then
  list every artifact type and its purpose in a compact reference format.
  `/help <command>` returns the detailed help for that command only,
  including syntax, behavior, and prerequisites. If the command is unknown,
  respond that it is unsupported and suggest the available commands.

When the user enters `/catalyzer activate <name> <version|latest>`, look up
`<name>` in the registry to resolve its repository URL, then download or
update the plugin into `plugins/<type>/` from that repository if it is not
already present, then load it into memory: read that plugin's own
`working-contract.md` and fulfill its Operational-loop section — always
targeting **this deployed project's** own repository root, never the
catalyst framework's own repository or the plugin's installation directory.
A plugin is considered invalid for activation unless its root directory
contains both a `README.md` file and a `working-contract.md` file; if either
is missing, refuse activation and report the missing requirement.

Each plugin must be defined by the following minimum metadata fields:
`name`, `description`, `uuid`, `version`, `active`, and `type`. The
framework must read the plugin's `active` flag at startup and activate only
the plugins marked active; this is mandatory and must not be bypassed.

## 5. Domain field

Every item's `Domain` field is the `DOMAIN` code of the rule(s) it targets,
from `rules/domains/` — not free text. (Feature entries under `features/`
and roadmap items under `development/roadmaps/` are not development
artifacts under this document and carry no `Domain` field — see
`rules/Rules-of-Rules.md` §9/§10.)

## 6. Development-artifact IDs

Per `rules/Rules-of-Rules.md` §6: `(BUG|REQ|HK)-(NNNN)`, global per type,
sequential, zero-padded 4 digits, never reused. Meta-tags use a file-name
pattern of `tag-<key>-<artefact-id>` rather than a sequential numeric ID.
Every item name must be more than the bare ID and must follow the format
**`<artifact-id>-<short-summary>`**. The corresponding markdown filename
must also follow the same descriptive pattern,
**`<artifact-id>-<short-summary>.md`**, not simply `<artifact-id>.md`.
Example: `BUG-0001-login-form-validation.md`,
`REQ-0002-password-reset-flow.md`.

## 7. Closing an item

Before closing a bug or requirement, ensure the corresponding entry exists in
its individual file and is reflected in the relevant index file.

- **Bug**: not closeable as "fixed" without its test-plan item landing.
- **Requirement**: not closeable as "done" until the acceptance criteria and
  rule targets are reflected in the implementation and tests.
- **House-keeping**: closeable once its stated verification passes.

## 8. Retired rules and development work

A dev artifact that targets a rule which is later 🗑 retired stays valid —
retirement is a status change on the rule, not a reason to invalidate work
that already cited it. Note the retirement in the artifact's `Related`
section if it changes the artifact's own disposition.

Retiring a *rule* is `rules/Rules-of-Rules.md` §4's process — status
marker to 🗑, reason plus date appended, ID never reused. Closing a
*dev-artifact* (`BUG-`/`REQ-`/`HK-`) as `wontfix`/`rejected`/`abandoned`
is independent of that: closing an artifact never retires the rule(s) it
targeted, and retiring a rule never auto-closes the artifacts that cite
it. Each is closed on its own, citing the other's ID and the reason, so
the history stays traceable in both directions rather than one silently
orphaning the other.

## 9. Journaling

`development/journal.jsonl` is an append-only, transaction-log-grade
record — see `rules/Rules-of-Rules.md` §12 for the full entry schema
(exact before/after `git hash-object -w` content pointers per file, one
or more `intent` statements, the `targets` rule IDs) and the
point-in-time restore mechanism (`/journal-restore`, materializes a
reconstructed tree into a side directory — never overwrites the live
tree).

**Every command in §4 that creates, modifies, closes, or retires a
rule-linked artifact, rule, domain, or work item, or changes a `Status`
field, appends exactly one journal entry as its last step** — after
everything that command's own section above already specifies, not
instead of any of it. Concretely: resolve each touched file's `before`
hash before editing it, make the edit(s), compute and write each file's
`after` hash, then append one entry covering every file the command
touched. Entries are immutable — never edited, deleted, or reordered
afterward, the same "never delete, retire in place" principle as a
retired rule (`rules/Rules-of-Rules.md` §4) applies here in its strictest
form: nothing about a written entry ever changes, period.

Two read-only commands operate on the journal without writing to it
themselves: `/journal` reconstructs/filters the history for review, and
`/journal-restore <timestamp>` materializes the tree as it stood at that
point into a side directory for inspection.

This is core framework infrastructure, distinct from a project-owned
compliance-audit plugin's continuous rule-compliance auditing of a
*deployed* project — the journal applies to this deployment itself, and
answers "what changed, why, and can I get back to how it was," not "did
anything just break a rule."

**Bootstrap note:** `development/journal.jsonl` starts empty by design.
It was introduced by the `0.9.0`/`0.10.0` sync, and that sync's own edits
necessarily predate the mechanism it was creating — no accurate `before`
hash exists for content it modified, since git's index in this deployment
reflects an even earlier, unrelated staging point (not "immediately
before that sync"), and `before: null` specifically means "didn't exist,"
which would misrepresent files that already existed. Retroactively
fabricating an entry from either source would misrepresent the deployment's
real history rather than complete it. The journal is authoritative and
complete starting from the first command run after this deployment reached
`0.10.0` — it was never meant to reconstruct pre-journal history.
