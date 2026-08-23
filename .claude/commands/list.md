---
description: List catalyst artifacts, work items, rules, or templates, optionally filtered
argument-hint: bug|req|feature|hk|meta-tag|epic|story|task|spike|sprint|rule|domain|template|all [--filter key=value ...]
---

List catalyst items of the requested type. Full spec:
`.catalyst-proj/CODE-OF-CONDUCT.md` §3.
Input: $ARGUMENTS

1. Resolve `<type>` to its index file:
   - `bug` → `.catalyst-proj/development/bugs.md`
   - `req`/`requirement` → `.catalyst-proj/requirements/requirements.md`
   - `feature` → `.catalyst-proj/features/features.md`
   - `hk`/`house-keeping` → `.catalyst-proj/development/house-keeping.md`
   - `meta-tag` → `.catalyst-proj/development/meta-tags.md`
   - `epic`/`story`/`task`/`spike`/`sprint` →
     `.catalyst-proj/work-items/<type>s.md`
   - `rule` → `.catalyst-proj/rules/rules.md`
   - `domain` → `.catalyst-proj/rules/domains/domains.md`
   - `template` → **requires** an additional `--type <template-type>`
     argument identifying which template family (e.g. `--type bug`); if
     missing, ask for it rather than guessing.
   - `all` → inspect every collection above and merge results.
2. Each `--filter key=value` (or `key="value*"` for a prefix match) narrows
   the result set by that field across the selected collection(s).
3. Return the matching items (ID, status, and the field(s) filtered on, at
   minimum). If nothing matches, say so plainly — don't invent matches.
