# `HK-NNNN` — short title

House-keeping = development of tools/scripts/process that support the
dev effort itself, not product behavior. Still requires a rule target,
because house-keeping work exists to keep some rule enforceable/
verifiable/documented, even indirectly.

| Field | Value |
|---|---|
| **ID** | `HK-NNNN` |
| **Status** | proposed / in-progress / done / abandoned |
| **Priority** | High / Medium / Low — how urgently this blocks or de-risks other work |
| **Opened** | YYYY-MM-DD |
| **Targets** | the rule ID(s) this work supports the enforcement/verification/documentation of. If genuinely none applies, state that explicitly rather than leaving the field blank |
| **Domain** | the `DOMAIN` code of the targeted rule(s), or `META` if this supports a `rr-META-*` process rule |
| **Area** | free-text, e.g. "CI", "test harness", "release tooling" |
| **Signed-off-by** | name of the registered user (`development/users.json`) who signed this item — see `CODE-OF-CONDUCT.md` §2 |

## Description

What's being built/changed and why.

## Plan

Brief — steps, files touched.

## Verification

Concrete check that it works — CI run green, script output against a
known-good fixture, etc.

## Related

Other `BUG-`/`REQ-`/`HK-`/`FEAT-` IDs, or rule IDs.
