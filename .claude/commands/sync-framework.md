---
description: Synchronize this deployed catalyst framework with a given (or the latest) framework version
argument-hint: [latest|<version>] [--force <type>|<item-id>|all]
---

Synchronize the deployed catalyst framework. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3, `.criterion/version.txt` for
the currently installed version.
Input: $ARGUMENTS

1. If it isn't already available locally this session, clone
   `https://github.com/oliben67/catalyst.git` to a scratch location —
   refer to catalyst only by its repository name in anything you tell the
   user (never a local path), per `Rules-of-Rules.md` INV-1. Read its
   `development-framework/SYNCHRONIZE.md` for the authoritative,
   detailed synchronization rules before changing anything — this command
   summarizes the high-level contract but that file is canonical for edge
   cases.
2. Resolve the target version: `latest` from that repository's
   `development-framework/version.txt`; a specific version if given; if no
   argument at all, re-sync against the currently installed version (i.e.
   repair drift rather than upgrade).
3. Before touching any item, check the root-level `.frozen` file — skip
   anything listed there unless the command includes a matching
   `--force <type>`, `--force <item-id>`, or `--force all`. When an item
   *is* refreshed, remove it from `.frozen` afterward.
4. Never deactivate an already-active plugin as a side effect unless its
   `plugins/<type>/catalog.md` entry's `Compatibility` field explicitly
   excludes the target version (a bare `*` or absent field never counts).
   Never treat a deployed `plugins/<type>/catalog.md` or an installed
   plugin directory as overwritable template content — only merge new
   rows / refresh pinned columns into an existing `catalog.md`, never
   delete a row or a plugin's installed contents.
5. Update `.criterion/version.txt` to the resolved target version once
   synchronized.
6. Perform a four-eyes verification pass: review the refreshed deployment
   against the framework's `INSTANTIATION-GUIDE.md` and rules once
   yourself, then re-review independently as a second pass before calling
   it done (if background sub-agents are available, run these as two
   separate agents rather than one pass twice from the same context).
7. If anything actually changed (a no-op drift-repair with zero changes
   needs no entry), append **one** journal entry per `CODE-OF-CONDUCT.md`
   §9 / `rules/Rules-of-Rules.md` §12 covering the whole run
   (`action: "sync"`, `artifact`: the resolved target version,
   `targets: []`, `files` = every file this sync actually touched, each
   with a real `git hash-object -w` before/after hash).
8. Report what changed. Do not commit or push — leave changes unstaged
   unless the user asks otherwise (`Rules-of-Rules.md` INV-4).
