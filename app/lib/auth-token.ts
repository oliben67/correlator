/**
 * Unified auth token (cor-CORE.PROVISION-003) + per-installation user
 * identity (cor-CORE.FEDERATION-001).
 *
 * One token scheme, reused for both correlator<->Sump and Sump<->secondary-
 * Sump — ported from cttc's `api-token.js`, catalog-stored instead of a
 * flat JSON file. Keyed by `sump_id`, not user, by design for this phase
 * (see REQ-000005's Open questions for the per-user-identity deferral);
 * growing a `user_id` column later is additive, not a breaking migration.
 *
 * `getOrCreateUserId` is that later addition (Phase 8): one stable,
 * opaque, non-secret id per correlator installation, generated once and
 * persisted outside the catalog (`~/.correlator/identity.json`, not a
 * catalog column — it isn't scoped to any one Sump the way a token is)
 * — sent as `X-Correlator-User-Id` alongside the token on every request.
 * No login/account system: §7.3 named this "a lightweight identity
 * layer" explicitly, not a new authentication factor.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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

export function defaultIdentityPath(): string {
  return join(homedir(), ".correlator", "identity.json");
}

export function getOrCreateUserId(path: string = defaultIdentityPath()): string {
  if (existsSync(path)) {
    const doc = JSON.parse(readFileSync(path, "utf8")) as { userId: string };
    return doc.userId;
  }
  const userId = randomUUID();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ userId }));
  return userId;
}
