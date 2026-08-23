---
description: Bootstrap/join/sync a repoed deployment (dedicated git repo mirroring .catalyst-proj/ across contributors)
argument-hint: create <name> <git-info> | get <repo> <username> | push [--force]
---

Manage a repoed deployment. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4, `.catalyst-proj/rules/Rules-of-Rules.md` §13.
Input: $ARGUMENTS

**This deployment (correlator) is not currently repoed** — no
`DEPLOYMENT.md` with `repoed: true` exists. `create` is opt-in and
creates/registers an externally-visible git repository — do not run it
without the user explicitly asking for it in this invocation, and even
then, confirm the specific repo name/location before creating anything
(this is separate from, and in addition to, the fact that the user
invoked this command at all).

1. Parse the subcommand: `create`, `get`, or `push`. If missing or
   unrecognized, ask which one.

**`create <name> <git-info>`:**
2. If `.catalyst-proj/`-adjacent `DEPLOYMENT.md` doesn't show
   `repoed: true` yet, this is the first-call bootstrap: confirm with the
   user the exact repo to create/register before doing anything (name,
   host, visibility) — this is hard to reverse. Check whether `<git-info>`
   already exists: if so, register it as-is; if not, create it under
   `<name>`. Write `repoed: true`, `catalyst_repo: <name>`,
   `catalyst_repo_url: <git-info>`, `created_by: <current Signed-off-by
   actor>` to `DEPLOYMENT.md`. Push the current local `.catalyst-proj/`
   state as the first commit on a `thingamabob` branch there — nothing is
   vetted on this first push. Then run the identity migration (step 6).
3. If `DEPLOYMENT.md` already shows `repoed: true`: don't refuse. If
   `<git-info>` matches the registered `catalyst_repo_url`, branch
   instead — create a new branch off `thingamabob`'s current state,
   named `<name>` in its branch-safe form (step 5), no `DEPLOYMENT.md`
   change. If `<git-info>` names a different repo, confirm explicitly
   with the user before doing anything.

**`get <repo> <username>`:**
4. Validate `<username>` against the branch-safe-name rule (step 5) —
   refuse with a suggested alternative if it collides with an
   already-registered user's branch-safe form. Download `<repo>`'s
   `thingamabob` branch content and check out `<username>.catalyst-proj`
   (branch-safe form) from it as this user's local `.catalyst-proj/`,
   creating a `development/users.json` entry for them first if needed.
   Then run the identity migration (step 6).

**Branch-safe names** (step 5, used by both `create` branching and
`get`): lowercase the name, collapse every run of characters that isn't
`[a-z0-9]` to a single `-`, trim leading/trailing `-`. If two distinct
registered names collapse to the same form, refuse and ask for a manual
override rather than silently colliding.

**Identity migration** (step 6, part of both `create`'s first call and
`get`): set `git_username` on the current user's
`development/users.json` entry to their resolved git identity
(`git config user.name`, branch-safe form, for `create`; the given
`<username>` for `get`). Rewrite every existing artifact's
`Signed-off-by` field that currently names this user's old `name` to
their new `git_username`. **Never rewrite the journal** — instead append
one new entry (`action: "update"`, `intent` describing the migration)
covering every artifact file actually rewritten.

**`push [--force]`:**
7. Refuse with a clear message if not yet repoed (point to `create`).
   Resolve the current actor's push branch (`<git_username>.catalyst-proj`
   if they have one, else the branch-safe form of `name`) and push local
   `.catalyst-proj/` there (creating the branch on first push).
8. If `--force`: refuse unless the current actor matches
   `DEPLOYMENT.md`'s `created_by`; otherwise confirm with the user, then
   overwrite `thingamabob` directly from local state and stop.
9. Otherwise: (a) run `/dogfood` against the merged-in state to vet it —
   disagreement between its two sub-agents, or a flagged violation, stops
   here; (b) attempt a normal merge into `thingamabob`, and only where
   that leaves conflicts, have a sub-agent propose a resolution guided by
   `rules/Rules-of-Rules.md` §1's conflict-check principle, asking the
   user if genuinely irreconcilable; (c) update both `thingamabob` (the
   merge commit) and the contributor's own branch (fast-forwarded); (d)
   pull the updated `thingamabob` down and overwrite the local
   `.catalyst-proj/` to match.
10. Report the result of whichever subcommand ran.
