---
description: Create, remove, export, or import a catalyst deployment (agent-owned working copy + <app-name>.catalyst pointer)
argument-hint: create <project name> | remove <project name> [force] | export <project name> [export filename] | import <export filename> [force]
---

Manage this project's catalyst deployment lifecycle. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §4, mechanism:
`.catalyst-proj/rules/Rules-of-Rules.md` §14.
Input: $ARGUMENTS

**`remove ... force` and `import ... force` are destructive and
hard-to-reverse — confirm with the user explicitly before either, even
though invoking this command already implies intent.**

1. Parse the subcommand: `create`, `remove`, `export`, or `import`. If
   missing or unrecognized, ask which one.

**`create <project name>`:**
2. Refuses if a `<app-name>.catalyst` pointer or an in-project
   `.catalyst-proj/` already exists at this project's root — that's
   `import ... force`'s job, not this one's.
3. Resolve `agent-source` (`BOOTSTRAP.md` §1): agent-owned per-project
   storage if this agent has one, else the in-project fallback.
4. Run the instantiation procedure (`INSTANTIATION-GUIDE.md`), building
   the working copy at `agent-source`.
5. Write `<app-name>.catalyst` at this project's root, from
   `templates/catalyst-pointer.template.json`, with `<project name>` and
   the resolved `agent-source`.
6. Report the result. Nothing is committed automatically.

**`remove <project name> [force]`:**
7. Without `force`: delete this project's `<app-name>.catalyst` only
   (and, on the in-project fallback, stop treating that `.catalyst-proj/`
   as active). The working copy, this agent's memory note, and any
   `thingamabob` repo are left untouched — never delete, retire in place.
8. With `force`: confirm explicitly first, then additionally delete the
   working copy at `agent-source` and this agent's memory note for the
   project. Never deletes a `thingamabob` repo regardless.

**`export <project name> [export filename]`:**
9. Resolve `agent-source` for `<project name>`.
10. Read every file under its working copy into one JSON bundle, keyed
    by path relative to `.catalyst-proj/`, plus the pointer fields from
    `<app-name>.catalyst` (all but `agent-source` — meaningless outside
    this machine).
11. Write it to `<export filename>` if given, else
    `<project name>-catalyst-export-<UTC timestamp>.json` in the current
    directory.
12. Report the result.

**`import <export filename> [force]`:**
13. Without `force`: refuses if a `<app-name>.catalyst` pointer or an
    in-project `.catalyst-proj/` already exists at the current project's
    root.
14. With `force` (or when nothing exists yet): confirm explicitly what
    will be overwritten if this replaces an existing deployment, then:
    parse the bundle; resolve a **fresh** `agent-source` (never the
    exporting machine's original); materialize every bundled file there;
    write `<app-name>.catalyst`, carrying the bundle's pointer fields
    over as-is (`repoed`, `catalyst_repo`, `catalyst_repo_url`,
    `created_by`), `agent-source` set to the new location; append one
    journal entry (`action: "import"`).
15. Report the result.

Not a replacement for `/thingamabob get` (that joins an already-repoed
deployment's shared history via its dedicated repo; this installs from a
standalone export file with no repo involved).
