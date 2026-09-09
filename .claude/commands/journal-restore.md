---
description: Reconstruct the tree as it stood at a given timestamp into a side directory (never overwrites the live tree)
argument-hint: <timestamp>
---

Reconstruct a point-in-time snapshot. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §9, `.criterion/rules/Rules-of-Rules.md` §12.
Input: $ARGUMENTS

1. If `<timestamp>` is missing, ask for it.
2. Read `.criterion/development/journal.jsonl`. For every file path
   that appears in any entry with `timestamp <= <timestamp>`, take that
   path's `after` hash from its **latest** such entry (skip the path
   entirely if that latest `after` is `null` — the file didn't exist at
   that point).
3. Materialize each into a new side directory (e.g.
   `.criterion/.journal-restore/<timestamp>/`) via
   `git cat-file -p <hash> > <side-dir>/<path>`. **Never write into the
   live working tree.**
4. If a referenced hash isn't retrievable from the git object store (was
   never written with `-w`, or the repository was pruned), report that
   file as unrecoverable rather than silently omitting it.
5. Report the side directory's path and which files it contains.
