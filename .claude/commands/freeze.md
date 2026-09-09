---
description: Protect a catalyst item from /sync-framework by recording it in the root .frozen file
argument-hint: <item-id|item-path|type|template-name>
---

Freeze an item against future `/sync-framework` overwrites. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3.
Input: $ARGUMENTS

1. Resolve the argument to a concrete file path, trying in order: (a) an
   exact item ID (e.g. `REQ-000001` → its file under `requirements/`),
   (b) a literal file path, (c) a type name (e.g. `templates` — resolves
   to every `TEMPLATE-*-vN.md` file), (d) a template name (e.g.
   `TEMPLATE-BUG-v1.md`). If none resolve, say so and stop.
2. Read `.frozen` at the repo root (create it if missing) and append the
   resolved path(s) if not already present — one path per line, no
   duplicates.
3. Report what was frozen and remind the user this only protects against
   `/sync-framework`; it does not prevent normal edits.
