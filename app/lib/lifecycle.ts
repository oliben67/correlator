/**
 * Sump lifecycle state machine (cor-CORE.PROVISION-004).
 *
 * cttc had no explicit state machine for a Gateway/daemon's lifecycle,
 * which the roadmap traces as the root cause behind a large share of its
 * filed bugs (stuck "installing" spinners, status pills that never
 * recovered after a daemon restart, uninstalls racing a health check).
 * Every transition here is table-driven and exhaustive: an event with no
 * edge for the current state throws rather than guessing.
 */

export type SumpState = "provisioning" | "active" | "unreachable" | "retired";

export type SumpEvent =
  | "provision_succeeded"
  | "provision_failed"
  | "health_check_failed"
  | "health_check_recovered"
  | "retire";

interface Transition {
  from: SumpState;
  event: SumpEvent;
  to: SumpState;
}

// Provisioning either reaches "active" or fails outright — it never goes
// stale into "unreachable" — and "retired" is a terminal state with no
// outgoing edges.
const TRANSITIONS: readonly Transition[] = [
  { from: "provisioning", event: "provision_succeeded", to: "active" },
  { from: "provisioning", event: "provision_failed", to: "retired" },
  { from: "active", event: "health_check_failed", to: "unreachable" },
  { from: "active", event: "retire", to: "retired" },
  { from: "unreachable", event: "health_check_recovered", to: "active" },
  { from: "unreachable", event: "retire", to: "retired" },
];

export class InvalidTransitionError extends Error {
  readonly state: SumpState;
  readonly event: SumpEvent;

  constructor(state: SumpState, event: SumpEvent) {
    super(`No transition defined for event "${event}" in state "${state}"`);
    this.name = "InvalidTransitionError";
    this.state = state;
    this.event = event;
  }
}

export function transition(current: SumpState, event: SumpEvent): SumpState {
  const match = TRANSITIONS.find((t) => t.from === current && t.event === event);
  if (!match) {
    throw new InvalidTransitionError(current, event);
  }
  return match.to;
}
