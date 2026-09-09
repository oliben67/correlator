/**
 * Client-side event-density bucketing (cor-CORE.CORRELATE-003) --
 * correlator computes this from `/records` results rather than a server
 * `GET /legacy/ticks?px=` call (that endpoint is `log-sump-extended`
 * cttc-legacy-wire-protocol territory, not `log-sump`'s own generic
 * API -- see `cor-CORE.QUERY-002`'s Notes).
 */

import type { Viewport } from "./atoms.js";

/**
 * Buckets `recordTimestamps` into `bucketCount` equal-width buckets
 * spanning `view`, returning the count per bucket. A timestamp exactly
 * on a bucket boundary lands in the later bucket (matches how `tToX`
 * maps `t1` itself to the rightmost pixel, not one past it), except the
 * very last bucket, which is inclusive of `view.t1`.
 */
export function bucketize(
  recordTimestamps: number[],
  view: Viewport,
  bucketCount: number,
): number[] {
  const counts = new Array<number>(bucketCount).fill(0);
  const span = view.t1 - view.t0;
  if (span <= 0 || bucketCount <= 0) return counts;

  for (const ts of recordTimestamps) {
    if (ts < view.t0 || ts > view.t1) continue;
    let bucket = Math.floor(((ts - view.t0) / span) * bucketCount);
    if (bucket >= bucketCount) bucket = bucketCount - 1;
    counts[bucket]++;
  }
  return counts;
}
