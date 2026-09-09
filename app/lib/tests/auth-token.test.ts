import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetToken, getOrCreateToken } from "../auth-token.ts";
import { Catalog } from "../catalog.ts";

let dir: string;
let catalog: Catalog;

function seedSump(id: string): void {
  catalog.upsertSump({
    id,
    name: id,
    connectionType: "local",
    host: null,
    port: null,
    status: "active",
    authToken: null,
    catalogJson: "{}",
    createdAt: "2026-09-08T00:00:00Z",
    lastSeenAt: null,
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-auth-token-test-"));
  catalog = new Catalog(join(dir, "catalog.db"));
  seedSump("sump-1");
  seedSump("sump-2");
});

afterEach(() => {
  catalog.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("auth-token", () => {
  it("returns the identical token on repeat calls for the same sump", () => {
    const first = getOrCreateToken("sump-1", catalog);
    const second = getOrCreateToken("sump-1", catalog);
    expect(second).toBe(first);
  });

  it("returns different tokens for different sumps", () => {
    const tokenA = getOrCreateToken("sump-1", catalog);
    const tokenB = getOrCreateToken("sump-2", catalog);
    expect(tokenA).not.toBe(tokenB);
  });

  it("forgetToken followed by getOrCreateToken generates a genuinely new token", () => {
    const original = getOrCreateToken("sump-1", catalog);
    forgetToken("sump-1", catalog);
    const regenerated = getOrCreateToken("sump-1", catalog);
    expect(regenerated).not.toBe(original);
  });
});
