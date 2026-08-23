# `CORE` — Core correlation

**Document:** `rules/core/core-rules.md`
**Defined:** 2026-08-22
**Parent:** none
**Sub-domains:** none

Rules in this domain do not supersede, amend, or contradict any rule in
another domain unless explicitly stated below against that rule's ID.

## Scope

The core correlation engine: ingesting container telemetry (CPU, memory,
network) and service logs, and associating them by time window and
container/service identity so both can be retrieved together. This is
currently the only domain in the only rule document (`core`) — split it
into sub-domains (e.g. `CORE.INGEST` vs `CORE.MATCH`) only once its rule
list is large enough that a flat list stops being obvious to navigate.

## Relationship to other domains

None — this is the project's first and only domain.

## Contents

- Scope
- Relationship to other domains

## Known Bugs — Quick Index

*(empty — no bugs filed against this domain yet.)*
