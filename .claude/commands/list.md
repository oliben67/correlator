---
description: List catalyst artifacts, work items, rules, or templates, optionally filtered
argument-hint: bug|req|feature|hk|meta-tag|reconciliation|epic|story|task|spike|sprint|rule|domain|template|all [--filter key=value ...]
---

List catalyst items of the requested type. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3.
Input: $ARGUMENTS

1. Resolve `<type>` to its index file:
   - `bug` → `.criterion/development/bugs/bugs.md`
   - `req`/`requirement` → `.criterion/requirements/requirements.md`
   - `feature` → `.criterion/features/features.md`
   - `hk`/`house-keeping` → `.criterion/development/house-keeping/house-keeping.md`
   - `meta-tag` → `.criterion/development/meta-tags/meta-tags.md`
   - `reconciliation` → `.criterion/reconciliations/reconciliations.md`
   - `epic`/`story`/`task`/`spike`/`sprint` — only if a
     project-management plugin has deployed `work-items/` (`rules/Rules-of-Rules.md`
     §8/§17); if it hasn't, say so rather than inventing an index. When
     deployed: `.criterion/work-items/<type>s/<type>s.md`
   - `rule` → `.criterion/rules/rules.md`
   - `domain` → `.criterion/rules/domains/domains.md`
   - `template` → **requires** an additional `--type <template-type>`
     argument identifying which template family (e.g. `--type bug`); if
     missing, ask for it rather than guessing.
   - `all` → inspect every collection above and merge results.
2. Each `--filter key=value` (or `key="value*"` for a prefix match) narrows
   the result set by that field across the selected collection(s).
3. Return the matching items (ID, status, and the field(s) filtered on, at
   minimum). If nothing matches, say so plainly — don't invent matches.
