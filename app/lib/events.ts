/**
 * Event triggers, evaluation engine, and rolling buffer (cor-CORE.EVENT-000001/-000002).
 */

import type { EventRuleRow } from "./catalog.ts";

export interface LogRecordSample {
  kind: "log";
  ts: string;
  message?: string;
  level?: string;
  docker_host: string;
}

export interface MetricRecordSample {
  kind: "metric";
  ts: string;
  cpu_pct?: number;
  mem_pct?: number;
  mem_used_bytes?: number;
  docker_host: string;
}

export type TelemetrySample = LogRecordSample | MetricRecordSample;

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  action: string;
  triggered: boolean;
  matchingSamples: TelemetrySample[];
}

export class RollingBuffer<T extends { ts: string }> {
  private samples: T[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity: number = 500) {
    this.maxCapacity = maxCapacity;
  }

  add(sample: T): void {
    this.samples.push(sample);
    if (this.samples.length > this.maxCapacity) {
      this.samples.shift();
    }
  }

  addAll(samples: T[]): void {
    for (const sample of samples) {
      this.add(sample);
    }
  }

  getSamples(): T[] {
    return [...this.samples];
  }

  getSamplesInWindow(windowMs: number, nowMs: number = Date.now()): T[] {
    const cutoff = nowMs - windowMs;
    return this.samples.filter((s) => {
      const tsMs = new Date(s.ts).getTime();
      return !Number.isNaN(tsMs) && tsMs >= cutoff;
    });
  }

  clear(): void {
    this.samples = [];
  }
}

export function evaluateMetricCondition(
  sample: MetricRecordSample,
  rule: EventRuleRow,
): boolean {
  if (!rule.metricName || !rule.operator || rule.threshold == null) {
    return false;
  }

  const rawVal = sample[rule.metricName as keyof MetricRecordSample];
  if (typeof rawVal !== "number") {
    return false;
  }

  const threshold = rule.threshold;
  switch (rule.operator) {
    case "gt":
      return rawVal > threshold;
    case "gte":
      return rawVal >= threshold;
    case "lt":
      return rawVal < threshold;
    case "lte":
      return rawVal <= threshold;
    case "eq":
      return rawVal === threshold;
    default:
      return false;
  }
}

export function evaluateLogCondition(
  sample: LogRecordSample,
  rule: EventRuleRow,
): boolean {
  if (!rule.pattern || !sample.message) {
    return false;
  }

  try {
    const regex = new RegExp(rule.pattern, "i");
    return regex.test(sample.message);
  } catch {
    return false;
  }
}

export function evaluateEventRule(
  rule: EventRuleRow,
  samples: TelemetrySample[],
): RuleEvaluationResult {
  if (!rule.enabled) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      triggered: false,
      matchingSamples: [],
    };
  }

  const matchingSamples: TelemetrySample[] = [];

  for (const sample of samples) {
    if (rule.conditionType === "metric" && sample.kind === "metric") {
      if (evaluateMetricCondition(sample, rule)) {
        matchingSamples.push(sample);
      }
    } else if (rule.conditionType === "log" && sample.kind === "log") {
      if (evaluateLogCondition(sample, rule)) {
        matchingSamples.push(sample);
      }
    }
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    action: rule.action,
    triggered: matchingSamples.length > 0,
    matchingSamples,
  };
}

export function evaluateEventRules(
  rules: EventRuleRow[],
  samples: TelemetrySample[],
): RuleEvaluationResult[] {
  return rules.map((rule) => evaluateEventRule(rule, samples));
}
