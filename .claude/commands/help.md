---
description: List catalyst's slash commands, or show detailed help for one
argument-hint: [command-name]
---

Show catalyst help. Full spec: `.criterion/CODE-OF-CONDUCT.md` §3.
Input: $ARGUMENTS

- **No argument**: run `/commands list` for the command listing rather
  than re-describing it — grouped (create-artifact commands,
  query/inspect commands, framework maintenance commands), one-line
  purpose each — then list every artifact/work-item type and its purpose
  in a compact reference format.
- **`<command>` given**: if it matches one of the commands in §3 (or one
  of this project's `.claude/commands/*.md` files), return its detailed
  syntax, behavior, and prerequisites. If it doesn't match anything,
  respond that it's unsupported and suggest the closest available
  commands rather than guessing at behavior for it.
