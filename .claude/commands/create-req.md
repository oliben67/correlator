---
description: Create a new catalyst REQ-NNNNNN artifact and register it in requirements/requirements.md
argument-hint: <short description of the requirement> [--targets rule-id,...] [--domain CODE] [--feature FEAT-NNNNNN]
---

Create a new catalyst requirement artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §2/§3, template:
`.criterion/requirements/templates/TEMPLATE-REQUIREMENT-v1.md`.
Input: $ARGUMENTS

This is the artifact to open when **new** product behavior needs to be
built — never a `/create-bug` for that.

1. Read `.criterion/requirements/requirements.md` and list
   `.criterion/requirements/` to find the highest existing `REQ-NNNNNN`
   (4-digit, zero-padded). The new ID is the next number.
2. **Vet against every existing rule document** first
   (`.criterion/rules/Rules-of-Rules.md` §1 — currently just
   `rules/core/core-rules.md`), not just the seemingly-relevant part. Record
   the outcome: no conflict found, or which existing rule ID(s) this
   narrows/amends.
3. Resolve `Targets`: one or more existing rule IDs this requirement
   implements/extends. If none exist yet for this behavior, define the new
   rule(s) first (per `rules/Rules-of-Rules.md` §3/§7 — ID scheme, domain)
   and list them under "New rules proposed" in the requirement doc instead
   — **never** leave `Targets` empty (`CODE-OF-CONDUCT.md` §1).
4. Resolve `Domain` from `.criterion/rules/domains/domains.md` — never
   free text. If a new domain is needed, follow `Rules-of-Rules.md` §7
   before writing the requirement.
5. Copy the template to
   `.criterion/requirements/REQ-NNNNNN-<short-kebab-summary>.md`
   (descriptive filename, not the bare ID) and fill in every section:
   Vetted-against-existing-rules, New domain/rules proposed (if any),
   Source rules, Signed-off-by (resolve per `CODE-OF-CONDUCT.md` §2),
   Summary, Functional requirements with acceptance criteria, Business
   rules, Non-functional requirements, Design/implementation plan, Test
   plan, Open questions, Related. If a `--feature FEAT-NNNNNN` was given,
   set the `Feature` field and add this REQ to that feature's
   `Requirement(s)` field.
6. Add a row to `.criterion/requirements/requirements.md`.
7. Append a journal entry per `CODE-OF-CONDUCT.md` §9 /
   `rules/Rules-of-Rules.md` §12 (`action: "create"`, `targets` = the
   Targets field, `files` = every file just touched with real
   `git hash-object -w` before/after hashes).
8. Report the new requirement's ID and file path. Do not commit — leave
   the new files unstaged unless asked otherwise.
