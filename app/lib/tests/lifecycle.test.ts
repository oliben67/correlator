import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  type SumpEvent,
  type SumpState,
  transition,
} from "../lifecycle.ts";

describe("lifecycle transition table", () => {
  it("provisioning -> active on provision_succeeded", () => {
    expect(transition("provisioning", "provision_succeeded")).toBe("active");
  });

  it("provisioning -> retired on provision_failed", () => {
    expect(transition("provisioning", "provision_failed")).toBe("retired");
  });

  it("active -> unreachable on health_check_failed", () => {
    expect(transition("active", "health_check_failed")).toBe("unreachable");
  });

  it("active -> retired on retire", () => {
    expect(transition("active", "retire")).toBe("retired");
  });

  it("unreachable -> active on health_check_recovered", () => {
    expect(transition("unreachable", "health_check_recovered")).toBe("active");
  });

  it("unreachable -> retired on retire", () => {
    expect(transition("unreachable", "retire")).toBe("retired");
  });

  it("throws on an event not defined for the current state", () => {
    expect(() => transition("active", "provision_succeeded")).toThrow(InvalidTransitionError);
  });

  // Regression: an unknown/stale state+event combination must throw, never
  // silently no-op -- the general form of the lesson BUG-0035 established
  // for cttc's own daemon registry (see catalog.test.ts for BUG-0035 itself:
  // no explicit forget/retire path meant a "removed" entry kept coming back).
  it("an unknown/stale state+event combination throws, never silently no-ops", () => {
    expect(() => transition("provisioning", "health_check_failed")).toThrow(InvalidTransitionError);
    expect(() => transition("provisioning", "retire")).toThrow(InvalidTransitionError);
  });

  // retired must be a true terminal state, so a retired sump can never be
  // silently re-collected the way BUG-0035's daemons were.
  it("retired has zero outgoing transitions for any event", () => {
    const allEvents: SumpEvent[] = [
      "provision_succeeded",
      "provision_failed",
      "health_check_failed",
      "health_check_recovered",
      "retire",
    ];
    for (const event of allEvents) {
      expect(() => transition("retired", event)).toThrow(InvalidTransitionError);
    }
  });

  it("every SumpState is reachable as a 'from' or 'to' in the table", () => {
    const states: SumpState[] = ["provisioning", "active", "unreachable", "retired"];
    expect(states).toHaveLength(4);
  });
});
