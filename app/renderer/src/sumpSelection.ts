import type { SumpSummary } from "./correlator-api.js";

// cor-CORE.PROVISION-008: correlator has one addressable concept, the
// log Sump -- a root Sump with a discovered host is hidden here, only
// its host-scoped children are selectable; a root with no discovered
// hosts yet stays selectable so a just-connected Sump never shows a
// blank screen. Pulled out of App.tsx as a pure module so this decision
// logic is unit-tested directly, not only reachable through a rendered
// component (BUG-000003: a childless root was reaching Correlate, which
// requires a docker_host scope no root has).
export function selectableSumps(liveSumps: SumpSummary[]): SumpSummary[] {
  return liveSumps.filter(
    (sump) =>
      sump.parentSumpId !== null || !liveSumps.some((other) => other.parentSumpId === sump.id),
  );
}

// cor-CORE.PROVISION-007: the primary Sump if one is selected and still
// selectable, else the first selectable Sump -- a UI-selection concept,
// distinct from SumpState's "active" (reachability).
export function resolveActiveSump(
  selectable: SumpSummary[],
  primaryId: string | null,
): SumpSummary | null {
  return selectable.find((sump) => sump.id === primaryId) ?? selectable[0] ?? null;
}

// BUG-000003: a Sump is only ever correlatable once it has a resolved
// docker_host scope -- a childless root stays selectable (see above) so
// the switcher isn't empty, but querying it directly is meaningless
// (there is no docker_host to scope /records to) and throws. Handing a
// non-correlatable Sump to <Correlate> was exactly this bug.
export function isCorrelatable(
  sump: SumpSummary | null,
): sump is SumpSummary & { dockerHost: string } {
  return sump !== null && sump.dockerHost !== null;
}
