# `REQ-NNNN` — <requirement name>

This document captures concrete, application-bound requirements derived
from `rules/core/core-rules.md`. Use it to translate documented
expectations into testable behavior that is directly tied to specific
parts of correlator. These requirements are the main input for tests,
acceptance criteria, and the bugs that will be raised when behavior is
incorrect.

This is also the artifact to open when a **new feature** needs to be
developed — never a `BUG-NNNN` for that (a bug asserts an existing rule
doesn't hold; a requirement introduces or extends behavior). A `FEAT-NNNN`
entry (see [`features/TEMPLATE-FEATURE.md`](../features/TEMPLATE-FEATURE.md))
may have motivated it, but a requirement stands on its own: it must be
vetted against every existing rule document before it's opened, it always
carries a `Domain`, and it always answers — targets or proposes — one or
more rules. None of those three are optional.

| Field | Value |
|---|---|
| **ID** | `REQ-NNNN` |
| **Filename** | descriptive kebab-case filename, e.g. `REQ-0002-log-timestamp-alignment.md` — prefer specific problem/context over generic labels like `requirement.md` |
| **Status** | proposed / approved / in-progress / done / rejected |
| **Opened** | YYYY-MM-DD |
| **Targets** | one or more rule IDs this requirement implements or extends — **required, never empty** (see `CODE-OF-CONDUCT.md` §1). If none exist yet, define them first (see New rules proposed below) |
| **Domain** | the `DOMAIN` code(s) of the targeted/new rule(s), from `rules/domains/` — **required, never free text** |
| **Feature** | `FEAT-NNNN`, if this requirement was motivated by a documented feature — omit if none |
| **Signed-off-by** | name of the registered user (`development/users.json`) who signed this requirement — see `CODE-OF-CONDUCT.md` §2 |

## Vetted against existing rules

Per `rules/Rules-of-Rules.md` §1: confirm this requirement was checked
against every rule document (currently just `rules/core/core-rules.md`),
not only the one that seems most relevant, and record the outcome — no
conflict found, or the specific existing rule ID(s) this requirement
narrows/amends (and the decision that authorized that).

## New domain proposed

*(omit if this requirement fits an existing domain.)* Per
`rules/Rules-of-Rules.md` §7: domain-level conflict check performed;
proposed code; the domain file content
(`rules/domains/cor-<CODE>-<short-description>.md`) this will create,
including Scope and Relationship to other domains.

## New rules proposed

*(omit if none — only valid when the `Targets` field above already cites
existing rule IDs instead.)* List each new rule here **before**
implementation starts, in the exact form it will take once added to the
rule document: proposed ID, rule text, starting status marker (almost
always ❌). Run the `rules/Rules-of-Rules.md` §1 conflict check first.

## Source rules

Capture the rule document and rule IDs that informed this requirements set.

- **`core` rules**: list relevant rule IDs
- **Application area**: name the specific component or workflow

## Summary

Describe the user problem, requirement scope, or change being requested.

## Functional requirements

List the requirements in a structured way. Each item should reference one or
more source rules, name the relevant application area, and include
acceptance criteria that can be tested directly.

### Requirement 1 — <short title>

- **Source rule(s)**: `RULE-ID`
- **Application area**: component or workflow
- **Description**: what must be true in that specific part of the app
- **Acceptance criteria**:
  - ...
  - ...

## Business rules

Capture the domain or workflow constraints that govern the feature.

- ...
- ...

## Non-functional requirements

- **Accuracy**: ...
- **Security**: ...
- **Performance**: ...
- **Observability**: ...

## Design / implementation plan

Brief — files touched, approach.

## Test plan

Per rule targeted or introduced, the specific test that will cover it. A
rule with no test is not "done" regardless of whether the code exists.

## Open questions

- ...

## Related

Other `BUG-`/`REQ-`/`HK-`/`FEAT-` IDs, or rule IDs.
