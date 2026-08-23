# `BUG-NNNN` — descriptive title

| Field | Value |
|---|---|
| **ID** | `BUG-NNNN` |
| **Filename** | descriptive kebab-case filename, e.g. `BUG-0001-cpu-metric-drift.md` — prefer specific problem/context over generic labels like `bug.md` |
| **Status** | open / in-progress / fixed / wontfix / duplicate-of `BUG-xxxx` |
| **Severity** | Critical / High / Medium / Low — see scale below. **Required.** |
| **Opened** | YYYY-MM-DD |
| **Targets** | one or more rule IDs this bug violates — **required, never empty** (see `CODE-OF-CONDUCT.md` §1) |
| **Domain** | the `DOMAIN` code(s) of the targeted rule(s), from `rules/domains/` |
| **Area** | short free-text area label |
| **Signed-off-by** | name of the registered user (`development/users.json`) who signed this bug — see `CODE-OF-CONDUCT.md` §2 |

## Severity scale

- **Critical** — data loss/corruption (silent or irreversible), a
  security exposure, or a failure that permanently disables a whole
  subsystem for the rest of the process's uptime (no self-recovery).
- **High** — a functional break with no workaround, or silent data
  divergence/staleness that looks healthy but isn't.
- **Medium** — validation/UX gap with a workaround, or a functional
  break confined to an edge case.
- **Low** — cosmetic, or test-coverage/tech-debt with no observed user
  impact yet.

## Description

What's wrong, in terms of the targeted rule(s) — not just symptoms.

## Reproduction

Concrete steps or inputs that trigger it. Cite a failing/missing test if
one exists.

## Expected vs actual

- **Expected** (per the targeted rule): …
- **Actual**: …

## Root cause

`file:line` pointer(s) once known.

## Fix plan

Whether the fix changes the implementation (rule stays as-is) or the rule
itself (subject to `rules/Rules-of-Rules.md` §1 conflict check first).

## Test plan

The specific test (existing or new) that will cover this once fixed. Not
closeable as "fixed" without one.

## Related

Other `BUG-`/`REQ-`/`HK-` IDs, or rule IDs.
