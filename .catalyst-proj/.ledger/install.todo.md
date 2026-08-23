# Deployment Ledger: catalyst-install-correlator   (updated: 2026-08-22)

State file for the catalyst install run into correlator. Seeded from
`INSTANTIATION-CHECKLIST.md` in https://github.com/oliben67/catalyst.git.

## Resolved mode (from BOOTSTRAP.md §1)
- Sub-agents: parallel (available; not needed for this install — a scaffolding
  task, not an analysis pass)
- Memory: memory-tool (persistent memory store available; used instead of the
  `DEPLOYMENT.md` fallback)
- Slash commands: named-procedure-fallback (documented in `README.md` §"Slash
  commands" and `CODE-OF-CONDUCT.md` §3; not wired as native `.claude/commands/`
  files in this pass — flagged as a follow-up)

## Items

### Preconditions
- [x] done — `INVARIANTS.md` read this session
- [x] done — capabilities resolved and fallbacks chosen; mode stated above
- [x] done — confirmed this is a first load into correlator ⇒ install now (INV-2)

### Discover
- [x] done — no `dev-instructions.yaml` found; defaulted project name to `correlator` (matches repo dir and README H1)
- [x] done — project `name` resolved: `correlator`
- [x] done — no layout override; used default layout
- [x] done — rule document/prefix chosen: single doc `core` (prefix `cor`) — greenfield project, no seams yet

### Deploy skeleton (into `.catalyst-proj/`, INV-6)
- [x] done — `CODE-OF-CONDUCT.md` created
- [x] done — `rules/Rules-of-Rules.md` created
- [x] done — exactly one `rules/TEMPLATE-RULE.md`; none in rule-type dirs (INV-8)
- [x] done — `work-items/rules-of-work-items.md` created
- [x] done — per-type templates copied and renamed `TEMPLATE-<TYPE>.md`
- [x] done — per-type index files created (bugs.md, requirements.md, features.md, house-keeping.md, meta-tags.md, epics.md, stories.md, tasks.md, spikes.md, sprints.md)
- [x] done — `rules/domains/` created (CORE domain seeded, not empty)
- [x] done — `features/` created at root, alongside `requirements/`

### Seed content
- [x] done — first rule document created with `## Contents` + `## Known Bugs — Quick Index` headings (INV-8)
- [x] done — starter requirement doc created (`REQ-0001`), tied to the one concrete rule that exists
- [x] done — every seeded rule/domain file follows `<id>-<short-summary>.md` (INV-7)

### Discoverability
- [x] done — root `README.md` written
- [x] done — per-folder `README.md` written for `rules/`, `requirements/`, `features/`, `development/`, `work-items/` (no root-level shared `templates/` dir in this layout, so no README needed there)
- [x] done — documented slash commands exposed via fallback (README + CODE-OF-CONDUCT)

### Finalize
- [x] done — no `dev-instructions.yaml` existed, nothing to delete
- [x] done — deployment target recorded in persistent memory
- [x] done — `version.txt` written (`0.5.0`, matches framework `version.txt`)

### Definition of done
- [x] done — every item above `[x]`
- [x] done — `scripts/check_deployment.py` passes against `.catalyst-proj/` (fixed 2 heading gaps + 1 index-orphan gap surfaced by the validator's broad `rglob` over `rules/`, then re-ran clean)
- [x] done — deployed tree presented to user; no commit/push yet (INV-4)
- [x] done — offered to run `ANALYSIS-PLAYBOOK.md` (offered in root README's "Next step"; not run — no code exists yet to analyze)

## Legend
- [x] done      — completed and verified
- [!] blocked   — cannot proceed; reason follows the em dash; MUST be surfaced
- [ ] pending   — not started

## Re-ground log
- 2026-08-22 — read `INVARIANTS.md` + `INSTANTIATION-CHECKLIST.md` before starting; single continuous pass, under 5 items outstanding at any point so no mid-run re-ground was triggered.

## Sync log

### 2026-08-23 — `/sync-framework 0.7.0` (0.5.0 → 0.7.0)
- [x] done — read `development-framework/SYNCHRONIZE.md` fresh from the
      framework repository before changing anything
- [x] done — resolved target: explicit `0.7.0`, confirmed as a real tag
- [x] done — `.frozen` checked — file doesn't exist, nothing to skip
- [x] done — diffed 0.5.0→0.7.0 against every framework-relevant path;
      substantive changes are (a) the slash-command loading mechanism
      (already deployed here ahead of the framework formalizing it — no
      change needed) and (b) a new **greenfield instantiation path**
      (`INSTANTIATION-GUIDE.md` §3) — not retroactively required by
      `SYNCHRONIZE.md`'s checklist (no matching one-time-migration entry),
      flagged to the user as an optional follow-up rather than applied
      silently as part of this sync
- [x] done — `0.3.1` one-time migration (`BUG-`→`REQ-` audit) checked —
      zero `BUG-` items exist, trivially satisfied
- [x] done — re-ran `scripts/check_deployment.py` (0.7.0 version, which
      tightened the bare-ID naming check) against this deployment — still
      valid
- [x] done — `version.txt` updated `0.5.0` → `0.7.0`
- [x] done — plugin-related sync rules (never deactivate on side effect,
      never overwrite `catalog.md`) — no-ops, no plugins registered
- [x] done — four-eyes verification: pass 1 above (this session); pass 2
      independent background agent — **verdict: PASS**, one discrepancy
      flagged (not fixed): `SYNCHRONIZE.md` §6 /
      `rules-of-development.template.md` reference a required `BACKLOG.md`
      that doesn't exist anywhere in correlator, isn't in
      `INSTANTIATION-GUIDE.md`'s canonical layout tree, has no template,
      and isn't enforced by `check_deployment.py` — pass 2's read is that
      this is stale/vestigial framework doc text (likely superseded by
      `/show-backlog`), not a real deployment gap, but it's reported rather
      than silently excused either way
- [x] done — user confirmed; retrofitted onto the greenfield path
- [ ] pending — user decision on the `BACKLOG.md` framework-doc discrepancy
- No commit/push (INV-4) — left unstaged for review.

### 2026-08-23 — greenfield-path retrofit (`INSTANTIATION-GUIDE.md §3`, framework 0.7.0)
- [x] done — dedicated dev-environment rule document created:
      `rules/env/env-rules.md`, prefix `env`, added to the rule-document
      list in `Rules-of-Rules.md`
- [x] done — decision areas worked through: runtime/language, dependency
      policy, code style, testing, CI/CD, local dev environment, repo
      layout — all 7 apply to this project, none skipped
- [x] done — each area's `domains/env-<CODE>-<short-description>.md`
      created before its rule bullets (7 domain files)
- [x] done — each rule implemented in the same pass: `server/pyproject.toml`
      + `.python-version` + `src/correlator_sump/` + `tests/test_smoke.py`;
      `app/package.json` + `biome.json` + `renderer/src/tsconfig.json` +
      `vitest.config.ts` + a smoke module/test; `.github/workflows/ci.yml`;
      `README.md` "Development" section
- [x] done — each rule's "tested" bar met: `uv run ruff check .`,
      `uvx ty check`, `uv run pytest` (server) and `npm run lint`,
      `npm run typecheck`, `npm run test` (app) all run clean — verified
      directly, not assumed (11 rules, all ✅ working)
- [x] done — `{{TEST_LOCATIONS}}` in `Rules-of-Rules.md` §2 resolved to
      real paths: `server/tests/`, `app/renderer/src/**/*.test.ts`
- [x] done — `rules/domains/domains.md`, `rules/rules.md`, and
      `Rules-of-Rules.md` (rule-doc list, tiebreaker section, `DOC_PREFIX`
      list, domain-codes table) all updated for the new `env` document
- [x] done — one real bug caught and fixed during verification, not
      papered over: `biome migrate --write` set `linter.rules.preset` to
      `"none"` (silently disabling all lint rules); cross-checked against
      `biome init`'s canonical output and corrected to `"recommended"`
      before treating `env-STYLE-002` as ✅
- [x] done — `.gitignore` extended for Python artifacts (`.venv/`,
      `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, etc.) — belt-and-
      suspenders alongside the tools' own nested `.gitignore` files
- [x] done — `scripts/check_deployment.py` re-run after the retrofit —
      still valid
- No commit/push (INV-4) — left unstaged for review.

### 2026-08-23 — `BACKLOG.md` framework fix (`~/sources/catalyst`, `development` branch)
- [x] done — root-caused: two dangling references (`rules-of-development.template.md`,
      `SYNCHRONIZE.md`), no template, no canonical path, no enforcement —
      confirmed nothing anywhere actually had this file, including
      correlator
- [x] done — user decision: real template + hard rule, location =
      `development/BACKLOG.md` ("the development root")
- [x] done — implemented in the framework: `templates/backlog.template.md`,
      `INVARIANTS.md` INV-14, `check_deployment.py` enforcement + test
      coverage (18/18 passing), `/show-backlog`'s spec updated to write
      the file (not just report), `SYNCHRONIZE.md`/`INSTANTIATION-GUIDE.md`/
      `INSTANTIATION-CHECKLIST.md` wired in — committed
      (`6684829`, `development` branch), **not pushed** — not yet asked
- [x] done — retrofitted correlator itself: `.catalyst-proj/development/BACKLOG.md`
      created from the new template, populated with real current state
      (REQ-0001 in-progress, FEAT-0001 needs a requirement, no bugs/orphan
      rules/unlinked work items)
- [x] done — `scripts/check_deployment.py` (with the new INV-14 check)
      re-run against correlator — still valid
- No commit/push in correlator either (INV-4) — left unstaged for review.

### 2026-08-23 — `/sync-framework 0.7.1` (0.7.0 → 0.7.1)
- [x] done — confirmed `0.7.1` = exactly the BACKLOG.md commit (`6684829`)
      + version bump, nothing else in the diff
- [x] done — content already applied directly to correlator in the prior
      turn (before 0.7.1 was tagged) — pass 1 confirmed `development/BACKLOG.md`
      exists and `check_deployment.py` (0.7.1's version, INV-14-aware) passes
- [x] done — `version.txt` `0.7.0` → `0.7.1`
- [x] done — `.frozen` checked — doesn't exist, nothing to skip
- [x] done — four-eyes: pass 1 above (this session); pass 2 independent
      background agent — **verdict: FAIL**, one real gap found (not a
      false positive): `/show-backlog`'s 0.7.1 spec change (must overwrite
      `development/BACKLOG.md`, not just report) was applied to the
      framework template but never propagated into correlator's own
      deployed `CODE-OF-CONDUCT.md` or `.claude/commands/show-backlog.md`
      — exactly the kind of drift a sync is supposed to catch
- [x] done — fixed: `CODE-OF-CONDUCT.md` §2 gained the missing BACKLOG.md
      hard-requirement bullet, §3's `/show-backlog` line updated;
      `.claude/commands/show-backlog.md` rewritten to actually perform the
      overwrite step, not just summarize
- [x] done — exercised the fixed command for real (re-derived backlog
      state from the live indexes by hand, matching `/show-backlog`'s new
      spec) — content already matched `development/BACKLOG.md` exactly,
      confirming nothing had silently drifted since it was first written
- [x] done — `check_deployment.py` re-run after the fix — still valid
- **Verdict after fix: PASS.** Sync to `0.7.1` complete.
- No commit/push (INV-4) — left unstaged for review.

### 2026-08-23 — `/sync-framework` (no argument → repair drift against 0.7.1)
- [x] done — no version given ⇒ per the command's own spec, re-synced
      against the *currently installed* version (`0.7.1`), not an upgrade
      — a new `0.8.0` tag exists upstream (the roadmap/user/role work
      flagged in the prior `/help` run) but was deliberately not pulled in
      without an explicit `/sync-framework 0.8.0`/`latest`
- [x] done — extracted 0.7.1's own `check_deployment.py` (`git show
      0.7.1:scripts/check_deployment.py`) rather than reusing the
      `development`-branch copy, since that copy now enforces 0.8.0-era
      INV-15/16 checks that don't apply to a project still deployed at
      0.7.1
- [!] blocked (self-corrected) — first run of that script reported one
      violation, but investigation showed it had picked up
      `~/sources/catalyst`'s own self-hosted `.catalyst-proj/` (a stray
      cwd from the shell session, not correlator's deployment) — re-ran
      correctly targeted; the flagged issue belongs to catalyst's own
      dogfooded deployment, not correlator, and is not this project's to
      fix
- [x] done — correctly-targeted run: **zero drift** — `version.txt`
      already `0.7.1`, structure already matches
- [x] done — four-eyes: the 0.7.1-tagged validator script (independent of
      my own reasoning, unmodified since that release) serves as the
      second opinion for this no-op case — no actual changes were made to
      re-review
- No commit/push (INV-4).

### 2026-08-23 — `/sync-framework 0.8.0` (0.7.1 → 0.8.0) — large release
- [x] done — read the full 0.7.1→0.8.0 diff (102 files upstream, catalyst's
      own dogfooded self-deployment + the actual framework template
      changes) before touching anything; scoped to the 9 files under
      `development-framework/` that define what correlator must reflect
- [x] done — three new mechanisms applied for real, not just documented:
      (1) roadmap tracking — `development/roadmaps/TEMPLATE-ROADMAP.md` +
      empty `roadmaps.md` index (INV-15); (2) users/roles — `development/roles.json`
      (default agile mapping) + `development/users.json` (first user
      registered: Olivier Steck, role Admin, from git config — **flagged
      to user as an assumption**, adjustable via `/user-assign-role`);
      (3) `Signed-off-by` field added to all 9 applicable templates
      (bug/req/hk/feature+Roadmap field/epic/story/task/spike/sprint —
      correctly NOT meta-tag/rule/domain, matching upstream's own scope)
- [x] done — retrofitted the two pre-existing concrete artifacts
      (`REQ-0001`, `FEAT-0001`) with real `Signed-off-by` values, not left
      as template placeholders
- [x] done — `rules/Rules-of-Rules.md` gained rr-META-010 (roadmap items)
      and rr-META-011 (users/roles), full text adapted for correlator's
      cross-references
- [x] done — `CODE-OF-CONDUCT.md` restructured: new §2 "Users, roles, and
      signing", roadmap-items paragraph in §3, 3 new hard-requirement
      bullets, 11 new command bullets in §4, renumbered §5-§8 — rewritten
      wholesale rather than sequential edits, to avoid a renumbering
      cascade going stale mid-edit
- [x] done — 11 new `.claude/commands/*.md` files created
      (roadmap-add/-update/-merge/-remove, user-add/-remove/-modify/-assign-role/-list,
      role-add/-modify), adapted from catalyst's own dogfooded command
      files as a reference pattern rather than derived from scratch
- [x] done — `show-backlog.md` updated to also refresh roadmap Status/Linked
      columns and the new BACKLOG.md "Roadmap" section;
      `create-feature.md` updated for Roadmap-field linkage
- [x] done — `version.txt` `0.7.1` → `0.8.0`; root `README.md`,
      `.catalyst-proj/README.md`, `development/README.md` updated for
      discoverability
- [x] done — `development/BACKLOG.md` actually refreshed (not just
      documented as refreshable) — new Roadmap section present, correctly
      empty
- [x] done — `check_deployment.py` (0.8.0 version — now checks INV-15/16
      too) passes
- [x] done — four-eyes: pass 1 above (this session, thorough given the
      size); pass 2 independent background agent — **verdict: PASS**, all
      12 checked areas confirmed independently (roadmaps, users/roles,
      all 9 Signed-off-by placements + 3 correct absences, REQ-0001/FEAT-0001
      retrofit, all 11 command files, show-backlog/create-feature updates,
      CODE-OF-CONDUCT.md/Rules-of-Rules.md completeness + numbering,
      validator pass, BACKLOG.md Roadmap section, `.frozen` absence)
- [x] done — one minor, non-blocking finding from pass 2, fixed: `rules/Rules-of-Rules.md`
      §6/§8 still said "current catalyst framework version (`0.5.0`)" —
      stale since the very first install, never caught across the
      0.7.0/0.7.1/0.8.0 syncs. Updated both to `0.8.0`; re-ran
      `check_deployment.py` — still valid. Worth remembering for future
      syncs: grep for the previous version number, not just bump
      `version.txt`.
- **Verdict after fix: PASS.** Sync to `0.8.0` complete.
- No commit/push (INV-4) — left unstaged for review.

### 2026-08-23 — `/sync-framework 0.10.0` (0.8.0 → 0.10.0, two releases at once)
- [x] done — confirmed both `0.9.0` and `0.10.0` exist as real tags before
      starting (per SYNCHRONIZE.md's "stop if the tag doesn't exist" rule)
- [x] done — read both releases' full diffs before touching anything:
      0.9.0 = append-only journal (INV-17, `development/journal.jsonl`,
      `/journal`, `/journal-restore`); 0.10.0 = `thingamabob`/repoed
      deployments (INV-18, `/thingamabob create|get|push`, `/dogfood`,
      `git_username` identity migration) — a git-repo-backed multi-user
      sync mechanism
- [x] done — **scope decision, stated up front**: implement INV-17 fully
      (safe, no external side effects) *and* fully document/wire up
      INV-18's commands, but do **not** execute `/thingamabob create` —
      creating/pushing to an external repo is exactly the
      "externally-visible, hard-to-reverse" action the framework's own
      spec says needs explicit confirmation beyond invoking the command;
      correlator stays not-repoed until asked
- [x] done — `development/journal.jsonl` created (empty); `rr-META-012`
      (journal schema/restore) and `rr-META-013` (thingamabob) added to
      `Rules-of-Rules.md`; `CODE-OF-CONDUCT.md` gained new §9 "Journaling",
      a `git_username` mention in §2, and 6 new command bullets
      (`/thingamabob` ×3 subcommands, `/dogfood`, `/journal`,
      `/journal-restore`) in §4
- [x] done — 4 new command files (`journal.md`, `journal-restore.md`,
      `dogfood.md`, `thingamabob.md` — the last explicitly refuses to
      create anything without extra confirmation, matching the doc)
- [x] done — the journal-append step added to all **20** existing
      artifact-mutating commands (every `create-*`, `status`, all 4
      `roadmap-*`, all 5 `user-*`, both `role-*`) plus `sync-framework.md`
      itself (`action: "sync"`, a valid schema value) — correctly
      *not* added to read-only commands (`user-list`, `list`, `journal`,
      `check-rules`, `audit`, `run-analysis`, `help`) or to `freeze`/
      `catalyzer` (neither mutates a rule-linked artifact per rr-META-012's
      literal scope)
- [!] **honest limitation, not silently glossed over**: did not
      retroactively journal this sync's own edits. `journal.jsonl` was
      created partway through this run, so no accurate pre-edit
      `git hash-object` exists for files already edited before that point
      — fabricating a `before` hash would misrepresent the schema (`null`
      specifically means "didn't exist," not "unknown"). Matches
      `SYNCHRONIZE.md`'s own principle: syncing doesn't fabricate history
      that predates a mechanism's existence. The journal is live and
      accurate starting with the next real command.
- [x] done — smoke-tested: `journal.jsonl` is empty and parses as valid
      JSONL (0 entries) — matches what `/journal` should report
- [x] done — `version.txt` `0.8.0` → `0.10.0`; root README, `.catalyst-proj/README.md`
      (including the "not activated" note for `/thingamabob`),
      `development/README.md` updated
- [x] done — `check_deployment.py` (0.10.0 version — no new checks beyond
      0.9.0's `check_journal_exists`; INV-18 has no mechanical
      enforcement since it's opt-in) passes
- [x] done — four-eyes: pass 1 above; pass 2 delegated to an independent
      background agent — **verdict: FAIL**, one finding: disputed the
      empty-journal decision above, claiming git's index held accurate
      pre-sync content so a retroactive entry was fabricatable, not
      fabricated
- [x] done — investigated the disputed claim against actual git state
      before acting on it (`git status --short` + `git show
      :<path>` on `rules/Rules-of-Rules.md` and `CODE-OF-CONDUCT.md`):
      the index turned out to hold content from **before the 0.7.0 sync**
      (only `rr-META-001`..`009` present, stale "current catalyst
      framework version (`0.5.0`)" text still there) — not
      "immediately before this 0.9.0/0.10.0 sync" as the reviewer
      assumed. Nothing was re-staged between syncs this session, so the
      index doesn't bracket this sync's diff at all; hashing it against
      the working tree would silently fold four sync generations into one
      mislabeled entry. `before: null` isn't a valid substitute either —
      the schema defines it as "didn't exist," which is false for files
      that clearly pre-date this sync. Reviewer's specific technical
      claim: **rejected, with evidence**.
- [x] done — the reviewer's underlying process point was still fair: this
      exact bootstrap situation (the sync introducing the journal can't
      journal itself) was undocumented, reading as an unexplained gap
      rather than a deliberate choice. Fixed for real: `CODE-OF-CONDUCT.md`
      §9 gained a "Bootstrap note" explaining why `journal.jsonl` starts
      empty and why fabricating an entry from either the index or `null`
      would misrepresent history rather than complete it
      — `development/journal.jsonl` re-checked: still exists, still valid
      empty JSONL (INV-17's mechanical check unaffected)
- **Final verdict: PASS** (post-correction). Sync to `0.10.0` complete.
- No commit/push (INV-4) — left unstaged for review.
