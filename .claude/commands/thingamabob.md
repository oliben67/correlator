---
description: Bootstrap/join/sync a repoed deployment (dedicated git repo mirroring .catalyst-proj/ across contributors)
argument-hint: create <name> <git-info> | get <repo> <username> | push [--force]
---

Manage a repoed deployment. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4, `.catalyst-proj/rules/Rules-of-Rules.md` §13.
Input: $ARGUMENTS

**This deployment (correlator) is repoed** — `.catalyst-proj/DEPLOYMENT.md`
shows `repoed: true` (mirrored in `correlator.catalyst` at the project
root). `create` is opt-in and creates/registers an externally-visible git
repository — do not run it without the user explicitly asking for it in
this invocation, and even then, confirm the specific repo name/location
before creating anything (this is separate from, and in addition to, the
fact that the user invoked this command at all).

1. Parse the subcommand: `create`, `get`, or `push`. If missing or
   unrecognized, ask which one.

**`create <name> <git-info>`:**
2. If `.catalyst-proj/DEPLOYMENT.md` doesn't show `repoed: true` yet,
   this is the first-call bootstrap: confirm with the user the exact
   repo to create/register before doing anything (name, host,
   visibility) — this is hard to reverse. Check whether `<git-info>`
   already exists: if it does, inspect its content before registering it
   as-is — if it's genuinely this same deployment's own prior state (a
   real rejoin), proceed; if it holds *unrelated* content (a different
   project's own `.catalyst-proj/` deployment), stop and confirm
   explicitly with the user before doing anything; if `<git-info>`
   doesn't exist yet, create it there under `<name>`. Record
   `repoed: true`, `catalyst_repo: <name>`, `catalyst_repo_url:
   <git-info>`, `created_by: <the current Signed-off-by actor>` in
   `.catalyst-proj/DEPLOYMENT.md`, **ask which branch this actor will
   push to** (step 5b below) and record it as `thingamabob_branch` in
   both `.catalyst-proj/DEPLOYMENT.md` and `<app-name>.catalyst`. Then
   push the current local `.catalyst-proj/` state as the first commit on
   a branch named `thingamabob` — the master version every subsequent
   push targets, and, if the chosen `thingamabob_branch` *is*
   `thingamabob` itself, also the branch this actor keeps pushing to
   going forward. Nothing is vetted on this first push. Then run the
   identity migration (step 6).
3. If `.catalyst-proj/DEPLOYMENT.md` already shows `repoed: true`: don't
   refuse. If `<git-info>` matches the registered `catalyst_repo_url`,
   branch instead — create a new branch off `thingamabob`'s current
   state, named `<name>` in its branch-safe form (step 5a), no
   `.catalyst-proj/DEPLOYMENT.md`/`<app-name>.catalyst` change. If
   `<git-info>` names a different repo, confirm explicitly with the user
   before doing anything.

**`get <repo> <username>`:**
4. Validate `<username>` against the branch-safe-name rule (step 5a) —
   refuse with a suggested alternative if it collides with an
   already-registered user's branch-safe form. Download `<repo>`'s
   `thingamabob` branch content and check out `<username>.catalyst-proj`
   (branch-safe form) from it as this user's local `.catalyst-proj/`,
   creating an `IAM/users/users.json` entry for them first if needed.
   **Ask which branch this actor will push to** (step 5b — the
   just-created `<username>.catalyst-proj` is the default) and record it
   as `thingamabob_branch`. Then run the identity migration (step 6).

**5a. Branch-safe names** (used by `create` branching, `get`, and any
push-branch derived from a name without a `git_username` yet): lowercase
the name, collapse every run of characters that isn't `[a-z0-9]` to a
single `-`, trim leading/trailing `-`. If two distinct registered names
collapse to the same form, refuse and ask for a manual override rather
than silently colliding.

**5b. Choosing `thingamabob_branch`** (`create`'s first call and `get`
both ask this, rather than silently deriving one): the suggested default
is the actor's own fixed branch, `<branch-safe-name>.catalyst-proj`, but
choosing `thingamabob` itself instead is valid and switches this
deployment into single-maintainer mode (see `push` step 9 below). The
answer is recorded so later pushes don't need to ask again — a
deployment created before this field existed asks once, on its next
push, then remembers.

**Identity migration** (step 6, part of both `create`'s first call and
`get`): set `git_username` on the current user's `IAM/users/users.json`
entry to their resolved git identity (`git config user.name`,
branch-safe form, for `create`; the given `<username>` for `get`).
Rewrite every existing artifact's `Signed-off-by` field that currently
names this user's old `name` to their new `git_username`. **Never
rewrite the journal** — instead append one new entry (`action:
"update"`, `intent` describing the migration) covering every artifact
file actually rewritten.

**`push [--force]`:**
7. Refuse with a clear message if not yet repoed (point to `create`). If
   no `thingamabob_branch` is recorded yet (a deployment from before this
   field existed), ask now (step 5b) and record it before proceeding.
8. If `--force`: refuse unless the current actor matches
   `.catalyst-proj/DEPLOYMENT.md`'s `created_by`; otherwise confirm with
   the user, then overwrite `thingamabob` directly from local state and
   stop. Meaningless in single-maintainer mode (step 9), where every push
   already behaves this way by default.
9. If `thingamabob_branch` **is** `thingamabob` itself (single-maintainer
   mode, e.g. catalyst's own self-dogfooding): every push overwrites
   `thingamabob` directly, no vetting, no merge — the normal behavior in
   this mode, not a `--force`-only shortcut — still refused for anyone
   but `created_by`. Report the result and stop.
10. Otherwise (`thingamabob_branch` is a real contributor branch — the
    default, `<git_username>.catalyst-proj` once the actor has one,
    otherwise the branch-safe form of `name`): push local
    `.catalyst-proj/` there (creating the branch on this actor's first
    push), then (a) run `/check-rules` against the merged-in state, plus
    an independent four-eyes sub-agent pass checking whether the
    merged-in state still matches what its own rules claim — disagreement
    between the two sub-agents, or a flagged violation, stops here (this
    is the exact procedure `/dogfood` runs standalone when developing
    catalyst itself — not available here, so described directly instead);
    (b) attempt a normal merge into `thingamabob`, and only where that
    leaves conflicts, have a sub-agent propose a resolution guided by
    `rules/Rules-of-Rules.md` §1's conflict-check principle, asking the
    user if genuinely irreconcilable; (c) update both `thingamabob` (the
    merge commit) and the contributor's own branch (fast-forwarded); (d)
    pull the updated `thingamabob` down and overwrite the local
    `.catalyst-proj/` to match.
11. Report the result of whichever subcommand ran.
