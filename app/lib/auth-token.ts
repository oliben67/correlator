/**
 * Unified auth token (cor-CORE.PROVISION-003).
 *
 * One token scheme, reused for both correlator<->Sump and Sump<->secondary-
 * Sump — ported from cttc's `api-token.js`, catalog-stored instead of a
 * flat JSON file. Keyed by `sump_id`, not user, by design for this phase
 * (see REQ-000005's Open questions for the per-user-identity deferral);
 * growing a `user_id` column later is additive, not a breaking migration.
 */

import { randomBytes } from "node:crypto";
import type { Catalog } from "./catalog.ts";

export function getOrCreateToken(sumpId: string, catalog: Catalog): string {
  const existing = catalog.getSump(sumpId)?.authToken;
  if (existing) {
    return existing;
  }
  const token = randomBytes(32).toString("hex");
  catalog.setSumpToken(sumpId, token);
  return token;
}

export function forgetToken(sumpId: string, catalog: Catalog): void {
  catalog.setSumpToken(sumpId, null);
}
