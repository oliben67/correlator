---
description: Manage catalyst plugin installation and activation (list, activate, download, deactivate, upgrade, downgrade)
argument-hint: list | activate <name> <version|latest> | download <name> <version|latest> | deactivate <name> | upgrade <name|latest> | downgrade <name> <version>
---

Manage catalyst plugins. Full spec: `.criterion/CODE-OF-CONDUCT.md` §3,
hard rules: `.criterion/rules/Rules-of-Rules.md` INV-10/11/12/13 (a
plugin is never loaded unless activated here; every plugin has its own
repository and is never sourced from the catalyst framework repository
itself; a plugin's runtime target is this deployed project, never the
catalyst framework's or the plugin's own installation directory).
Input: $ARGUMENTS

1. Resolve the registry: every subcommand reads
   `plugins/<type>/catalog.md` (currently only `plugins/repository/catalog.md`)
   **from the catalyst framework's own repository**, not this project. If
   it isn't already available locally this session, clone
   `https://github.com/oliben67/catalyst.git` to a scratch location and
   read it from there — refer to catalyst only by its repository name in
   anything you tell the user (never a local path), per INV-1.
2. **`list`** — read every plugin type's `catalog.md` and report available
   plugins grouped by type, each with repository URL, pinned release/tag,
   and compatibility.
3. **`activate <name> <version|latest>`** — requires a version argument;
   if missing, ask. Look up `<name>` in the registry; if it has no entry,
   refuse ("plugin is not registered") rather than guessing a repo URL.
   Resolve `latest` from that plugin's own repository if given. Download
   the plugin into `plugins/<type>/<name>/` in **this** project if not
   already present (never into the catalyst framework repository). Before
   activating, confirm the plugin directory contains both `README.md` and
   `working-contract.md` — refuse activation and report what's missing if
   either isn't there. Read `working-contract.md` and fulfill its
   Operational-loop section, targeting this project's own repository root.
   If a plugin with the same name is already active, replace it.
4. **`download <name> <version|latest>`** — same resolution as activate,
   but installs without activating; stays inactive until a later
   `activate`.
5. **`deactivate <name>`** — leave it installed, mark inactive, drop it
   from memory.
6. **`upgrade <name|latest>`** / **`downgrade <name> <version>`** —
   resolve the plugin's repository URL from the registry, then
   update/downgrade to the requested version.
7. Report what changed. Do not commit or push — leave changes unstaged
   unless the user asks otherwise (`Rules-of-Rules.md` INV-4).
