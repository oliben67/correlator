# correlator — catalyst deployment

This is correlator's instantiation of the
[catalyst framework](https://github.com/oliben67/catalyst.git): a
four-layer chain where no work happens without a traceable link down to a
documented rule.

```
Work items    EPIC ─▶ STORY ─▶ TASK / SPIKE / SPRINT   (work-items/)
                        ▼
Dev artifacts        REQ- / BUG- / HK- / TAG-          (requirements/, development/)
                        ▼
Rules            cor-/env-(DOMAIN)-(NNN)                (rules/)
                        ▼
Rules of rules   rr-META-(NNN)                          (rules/Rules-of-Rules.md)
```

correlator is a greenfield project — "Correlate container telemetry
(CPU / memory / network) with service logs." Two rule documents exist:
`core` (product behavior — one seed rule, `cor-CORE-001`, mirroring the
stated purpose, plus starter requirement `REQ-0001`) and `env` (dev
environment — 11 rules across 7 domains, seeded via catalyst's greenfield
instantiation path, all ✅ working and verified against the real
`server/`/`app/` tooling scaffold). See
[`rules/env/env-rules.md`](../rules/env/env-rules.md) for what's actually
governed there, and the root [`README.md`](../../README.md)'s
"Development" section for how to run it.

## Layout

| Path | Purpose |
|---|---|
| [`CODE-OF-CONDUCT.md`](../CODE-OF-CONDUCT.md) | Standards for bugs, requirements, house-keeping, meta-tags, and the framework's slash-command interface. |
| [`rules/`](../rules/README.md) | Documented behavior — `Rules-of-Rules.md` (meta-rules), the `core` and `env` rule documents, and `domains/`. |
| [`requirements/`](../requirements/README.md) | `REQ-NNNN` — rule-linked, testable requirements. |
| [`features/`](../features/README.md) | `FEAT-NNNN` — non-rule-linked roadmap ideas. |
| [`development/`](../development/README.md) | `BUG-NNNN` / `HK-NNNN` / meta-tags. |
| [`work-items/`](../work-items/README.md) | `EPIC-`/`STORY-`/`TASK-`/`SPIKE-`/`SPRINT-` — the agile process layer. |
| `version.txt` | Deployed framework version (`0.10.0`). Keep in sync via `/sync-framework`. |

## Slash commands

The catalyst framework defines a full set of slash commands
(`/create-bug`, `/create-req`, `/create-feature`, `/roadmap-add`,
`/roadmap-update`, `/roadmap-merge`, `/roadmap-remove`, `/user-add`,
`/user-remove`, `/user-modify`, `/user-assign-role`, `/user-list`,
`/role-add`, `/role-modify`, `/thingamabob`, `/dogfood`, `/create-epic`,
`/create-story`, `/create-task`, `/create-spike`, `/create-sprint`,
`/meta-tag`, `/list`, `/freeze`, `/catalyzer`, `/status`, `/audit`,
`/run-analysis`, `/sync-framework`, `/check-rules`, `/show-backlog`,
`/journal`, `/journal-restore`, `/help`) — see
[`CODE-OF-CONDUCT.md`](../CODE-OF-CONDUCT.md) §4 for the full spec of
each. **These are wired up as native Claude Code slash commands** — see
`.claude/commands/*.md` at the project root (one file per command,
`create-req.md` doubling as `/create-requirement`'s alias). Each command
file points back to this framework's own templates/indexes/rule docs as
the source of truth, so it stays correct if the framework is later
synchronized via `/sync-framework`.

**`/thingamabob` is documented but not activated** — correlator has no
`DEPLOYMENT.md`/`repoed: true` yet. `create`/`get`/`push` establish or
join a dedicated git repo mirroring `.catalyst-proj/` across contributors
(`rules/Rules-of-Rules.md` §13); `create` is an externally-visible,
hard-to-reverse action and requires explicit confirmation beyond just
invoking the command.

## Plugins

None activated. Plugins are gated behind `/catalyzer activate` and are
never sourced from the catalyst framework repository itself — only from
each plugin's own repository (see `CODE-OF-CONDUCT.md` §3).

## Next step

With no prior work items, the natural next step is to run the framework's
`ANALYSIS-PLAYBOOK.md` once there's actual code to analyze, to bootstrap
further project-specific rules from the real implementation as it lands.
