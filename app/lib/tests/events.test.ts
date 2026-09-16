import { describe, expect, it } from "vitest";
import type { EventRuleRow } from "../catalog.ts";
import {
  evaluateEventRule,
  evaluateEventRules,
  RollingBuffer,
  type TelemetrySample,
} from "../events.ts";

describe("RollingBuffer", () => {
  it("maintains max capacity by shifting oldest items", () => {
    const buffer = new RollingBuffer<TelemetrySample>(3);
    buffer.add({ kind: "log", ts: "2026-09-16T10:00:00Z", message: "m1", docker_host: "h1" });
    buffer.add({ kind: "log", ts: "2026-09-16T10:01:00Z", message: "m2", docker_host: "h1" });
    buffer.add({ kind: "log", ts: "2026-09-16T10:02:00Z", message: "m3", docker_host: "h1" });
    expect(buffer.getSamples()).toHaveLength(3);

    buffer.add({ kind: "log", ts: "2026-09-16T10:03:00Z", message: "m4", docker_host: "h1" });
    const samples = buffer.getSamples();
    expect(samples).toHaveLength(3);
    expect(samples[0].ts).toBe("2026-09-16T10:01:00Z");
  });

  it("filters samples in a sliding time window", () => {
    const buffer = new RollingBuffer<TelemetrySample>(10);
    const nowMs = 100000;
    buffer.add({ kind: "log", ts: new Date(nowMs - 50000).toISOString(), message: "m1", docker_host: "h1" });
    buffer.add({ kind: "log", ts: new Date(nowMs - 10000).toISOString(), message: "m2", docker_host: "h1" });

    const inWindow = buffer.getSamplesInWindow(20000, nowMs);
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0].message).toBe("m2");
  });
});

describe("evaluateEventRule", () => {
  it("evaluates metric threshold triggers (gt, lt, gte)", () => {
    const rule: EventRuleRow = {
      id: "r-1",
      sumpId: "s-1",
      name: "High CPU",
      conditionType: "metric",
      metricName: "cpu_pct",
      operator: "gt",
      threshold: 80,
      pattern: null,
      action: "start_recording",
      enabled: true,
      createdAt: "2026-09-16T10:00:00Z",
    };

    const samples: TelemetrySample[] = [
      { kind: "metric", ts: "2026-09-16T10:00:00Z", cpu_pct: 50, docker_host: "h1" },
      { kind: "metric", ts: "2026-09-16T10:01:00Z", cpu_pct: 85, docker_host: "h1" },
    ];

    const result = evaluateEventRule(rule, samples);
    expect(result.triggered).toBe(true);
    expect(result.matchingSamples).toHaveLength(1);
    expect((result.matchingSamples[0] as { cpu_pct?: number }).cpu_pct).toBe(85);
  });

  it("evaluates log message regex triggers", () => {
    const rule: EventRuleRow = {
      id: "r-2",
      sumpId: "s-1",
      name: "Fatal Log Error",
      conditionType: "log",
      metricName: null,
      operator: null,
      threshold: null,
      pattern: "FATAL|CRITICAL",
      action: "notify",
      enabled: true,
      createdAt: "2026-09-16T10:00:00Z",
    };

    const samples: TelemetrySample[] = [
      { kind: "log", ts: "2026-09-16T10:00:00Z", message: "Normal info log", docker_host: "h1" },
      { kind: "log", ts: "2026-09-16T10:01:00Z", message: "A CRITICAL error occurred", docker_host: "h1" },
    ];

    const results = evaluateEventRules([rule], samples);
    expect(results[0].triggered).toBe(true);
    expect(results[0].matchingSamples).toHaveLength(1);
  });

  it("ignores disabled event rules", () => {
    const rule: EventRuleRow = {
      id: "r-disabled",
      sumpId: "s-1",
      name: "Disabled Rule",
      conditionType: "metric",
      metricName: "cpu_pct",
      operator: "gt",
      threshold: 10,
      pattern: null,
      action: "start_recording",
      enabled: false,
      createdAt: "2026-09-16T10:00:00Z",
    };

    const samples: TelemetrySample[] = [
      { kind: "metric", ts: "2026-09-16T10:00:00Z", cpu_pct: 99, docker_host: "h1" },
    ];

    const result = evaluateEventRule(rule, samples);
    expect(result.triggered).toBe(false);
    expect(result.matchingSamples).toHaveLength(0);
  });
});
