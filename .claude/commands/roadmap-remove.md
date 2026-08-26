---
description: Delete or retire a named roadmap
argument-hint: <name>
---

Remove a named roadmap. Full spec: `.catalyst-proj/CODE-OF-CONDUCT.md` §4,
`rules/Rules-of-Rules.md` §10.
Input: $ARGUMENTS

1. If `.catalyst-proj/development/roadmaps/<name>.md` doesn't exist,
   refuse with a clear message.
2. Check every row's `Linked` field.
3. **If every row's `Linked` field is empty**: delete the file and its
   entry in `.catalyst-proj/development/roadmaps/roadmaps.md` outright,
   and report that it was removed.
4. **If any row has a non-empty `Linked` field**: do **not** delete
   anything — removing it would break a live `FEAT-`/`REQ-`
   cross-reference. Instead add a `Retired` field (today's date) to the
   file, mark its `roadmaps.md` entry `retired`, leave every row and
   `RM-NNNNNN` ID exactly as they are, and tell the user it was retired
   rather than removed, and why.
5. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "retire"` if retired, `"close"`
   if deleted outright; `targets: []`; `files` = every file just touched,
   with real `git hash-object -w` before/after hashes — `after: null` for
   a deleted file).
6. Do not commit or push — leave changes unstaged unless the user asks
   otherwise.
