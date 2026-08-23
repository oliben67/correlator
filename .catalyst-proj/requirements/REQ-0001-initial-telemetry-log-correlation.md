# `REQ-0001` — Initial telemetry/log correlation

| Field | Value |
|---|---|
| **ID** | `REQ-0001` |
| **Filename** | `REQ-0001-initial-telemetry-log-correlation.md` |
| **Status** | proposed |
| **Opened** | 2026-08-22 |
| **Targets** | `cor-CORE-001-telemetry-log-correlation` |
| **Domain** | `CORE` |
| **Feature** | *(none — opened directly against the foundational rule)* |
| **Signed-off-by** | Olivier Steck *(retroactively signed during `/sync-framework 0.8.0` — this requirement predates INV-16)* |

## Vetted against existing rules

Checked against the only rule document, `rules/core/core-rules.md`: no
existing rule to conflict with — `cor-CORE-001` was just defined
(alongside this requirement, since this is the framework's first
instantiation for correlator) and no other rule exists yet.

## New domain proposed

*(omitted — targets the existing `CORE` domain, created in the same
change.)*

## New rules proposed

*(omitted — targets the existing `cor-CORE-001-telemetry-log-correlation`
rule rather than proposing a new one.)*

## Source rules

- **`core` rules**: `cor-CORE-001-telemetry-log-correlation`
- **Application area**: the correlation engine as a whole — no components
  exist yet to scope this more narrowly.

## Summary

correlator has no implementation yet. This is the first requirement: stand
up the minimal path that ingests container telemetry (CPU / memory /
network) and the service logs from the same container, and returns them
joined by container identity and time window, so `cor-CORE-001` moves from
❌ to at least ⚠️ (partial) or ✅ (working, tested).

## Functional requirements

### Requirement 1 — Correlate telemetry and logs by container + time window

- **Source rule(s)**: `cor-CORE-001-telemetry-log-correlation`
- **Application area**: correlation engine (not yet scoped to a specific
  module — this requirement is what will define that scope)
- **Description**: Given a container's telemetry samples and its service
  logs over a time range, correlator must return the log lines that fall
  within the same window as a given telemetry sample (or anomaly), keyed by
  container/service identity.
- **Acceptance criteria**:
  - Given telemetry and logs for the same container over an overlapping
    time range, correlator returns the log lines whose timestamps fall
    inside a queried telemetry window for that container.
  - Given telemetry/logs from different containers, correlator never
    cross-matches log lines to a container they didn't originate from.

## Business rules

- ...

## Non-functional requirements

- **Accuracy**: correlation must not cross-match across container/service
  identity boundaries.
- **Security**: not yet scoped.
- **Performance**: not yet scoped.
- **Observability**: not yet scoped.

## Design / implementation plan

Not yet designed — no code exists. This section fills in once an
implementation approach (ingestion source for telemetry/logs, storage,
matching strategy) is chosen.

## Test plan

At least one test exercising the Requirement 1 acceptance criteria above,
once implementation starts. No test location exists yet in this repo (see
`rules/Rules-of-Rules.md` §2's `{{TEST_LOCATIONS}}` note) — name it here
once established.

## Open questions

- What are the concrete telemetry and log ingestion sources (e.g. a
  specific container runtime's stats API, a specific log shipper/format)?
- What matching window/tolerance counts as "the same time window"?

## Related

`cor-CORE-001-telemetry-log-correlation`.
