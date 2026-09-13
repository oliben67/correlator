import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Catalog, type SumpRow } from "../catalog.ts";
import {
  hasLiveSump,
  installLocalSump,
  LOCAL_SUMP_ID,
  resolveServerResourcesDir,
} from "../local-sump.ts";
import type { SpawnFn } from "../provision.ts";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-local-sump-test-"));
  dbPath = join(dir, "catalog.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function sumpRow(overrides: Partial<SumpRow>): SumpRow {
  return {
    id: "id",
    name: "name",
    connectionType: "local",
    host: null,
    port: null,
    status: "active",
    authToken: null,
    catalogJson: "{}",
    createdAt: "2026-09-12T00:00:00Z",
    lastSeenAt: null,
    parentSumpId: null,
    dockerHost: null,
    ...overrides,
  };
}

describe("hasLiveSump", () => {
  it("is false for an empty catalog", () => {
    expect(hasLiveSump([])).toBe(false);
  });

  it("is false when every existing row is retired", () => {
    expect(
      hasLiveSump([
        sumpRow({ id: "a", status: "retired" }),
        sumpRow({ id: "b", status: "retired" }),
      ]),
    ).toBe(false);
  });

  it("is true when any row is not retired", () => {
    expect(hasLiveSump([sumpRow({ id: "a", status: "active" })])).toBe(true);
    expect(hasLiveSump([sumpRow({ id: "a", status: "provisioning" })])).toBe(true);
    expect(hasLiveSump([sumpRow({ id: "a", status: "unreachable" })])).toBe(true);
  });

  it("is true for a mix of retired and non-retired rows", () => {
    expect(
      hasLiveSump([
        sumpRow({ id: "a", status: "retired" }),
        sumpRow({ id: "b", status: "active" }),
      ]),
    ).toBe(true);
  });
});

describe("resolveServerResourcesDir", () => {
  it("resolves under resourcesPath when packaged", () => {
    expect(resolveServerResourcesDir(true, "/fake/resources")).toBe(
      join("/fake/resources", "server"),
    );
  });

  it("throws when packaged but no resourcesPath is given", () => {
    expect(() => resolveServerResourcesDir(true, undefined)).toThrow();
  });

  it("resolves to <repo-root>/server in dev, independent of resourcesPath", () => {
    const resolved = resolveServerResourcesDir(false, "/ignored");
    expect(resolved.endsWith(join("correlator", "server"))).toBe(true);
  });
});

describe("installLocalSump", () => {
  function fakeSpawn(dockerInfoExitCode: number, restExitCode: number): SpawnFn {
    return ((cmd: string, args: string[]) => {
      const proc = new EventEmitter() as unknown as ReturnType<SpawnFn>;
      (proc as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
      (proc as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
      const code = cmd === "docker" && args[0] === "info" ? dockerInfoExitCode : restExitCode;
      queueMicrotask(() => proc.emit("exit", code));
      return proc;
    }) as SpawnFn;
  }

  function fakeFetchOk(): typeof fetch {
    return (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
  }

  it("rejects and writes nothing when Docker is unavailable", async () => {
    const catalog = new Catalog(dbPath);
    await expect(
      installLocalSump(catalog, { isPackaged: false, spawnFn: fakeSpawn(1, 0) }),
    ).rejects.toThrow(/docker is not available/i);

    expect(catalog.listSumps()).toHaveLength(0);
    catalog.close();
  });

  it("rejects and leaves the catalog untouched when a live sump already exists", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump(sumpRow({ id: "other", status: "active" }));

    await expect(
      installLocalSump(catalog, { isPackaged: false, spawnFn: fakeSpawn(0, 0) }),
    ).rejects.toThrow(/already connected/i);

    expect(catalog.listSumps()).toHaveLength(1);
    catalog.close();
  });

  it("provisions the local sump on success", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);

    await installLocalSump(catalog, { isPackaged: false, spawnFn: fakeSpawn(0, 0) });

    const row = catalog.getSump(LOCAL_SUMP_ID);
    expect(row?.status).toBe("active");
    expect(row?.port).toBe(8765);
    expect(row?.authToken).toBeTruthy();
    catalog.close();
  });

  it("rejects and leaves the sump retired when provisioning fails", async () => {
    const catalog = new Catalog(dbPath);

    await expect(
      installLocalSump(catalog, { isPackaged: false, spawnFn: fakeSpawn(0, 1) }),
    ).rejects.toThrow();

    expect(catalog.getSump(LOCAL_SUMP_ID)?.status).toBe("retired");
    catalog.close();
  });

  it("retries after a prior retired attempt, reusing the same stored auth token", async () => {
    const catalog = new Catalog(dbPath);
    await expect(
      installLocalSump(catalog, { isPackaged: false, spawnFn: fakeSpawn(0, 1) }),
    ).rejects.toThrow();
    const firstToken = catalog.getSump(LOCAL_SUMP_ID)?.authToken;
    expect(firstToken).toBeTruthy();

    vi.stubGlobal("fetch", fakeFetchOk());
    await installLocalSump(catalog, { isPackaged: false, spawnFn: fakeSpawn(0, 0) });

    const row = catalog.getSump(LOCAL_SUMP_ID);
    expect(row?.status).toBe("active");
    expect(row?.authToken).toBe(firstToken);
    catalog.close();
  });

  it("uses a real bundled docker-compose.yml when resolving the compose file in dev", async () => {
    // Not stubbed with a fixture -- resolveServerResourcesDir(false, ...)
    // points at this repo's own real server/docker-compose.yml, and
    // provisionLocal's validateComposeFile reads whatever path it's given,
    // so this also incidentally proves that file still passes the
    // BUG-0025 network-exposure check.
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];
    const spawnFn = ((cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      const proc = new EventEmitter() as unknown as ReturnType<SpawnFn>;
      (proc as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
      (proc as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
      queueMicrotask(() => proc.emit("exit", 0));
      return proc;
    }) as SpawnFn;

    await installLocalSump(catalog, { isPackaged: false, spawnFn });

    const upCall = calls.find((c) => c.includes("up"));
    expect(upCall?.some((arg) => arg.endsWith(join("server", "docker-compose.yml")))).toBe(true);
    catalog.close();
  });
});
