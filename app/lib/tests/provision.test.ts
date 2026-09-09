import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Catalog } from "../catalog.ts";
import {
  detectLocalDocker,
  NetworkExposureError,
  provisionLocal,
  provisionRemote,
  type SpawnFn,
  uninstallLocal,
  uninstallRemote,
  validateComposeFile,
} from "../provision.ts";

let dir: string;
let composeOkPath: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-provision-test-"));
  composeOkPath = join(dir, "docker-compose.yml");
  writeFileSync(composeOkPath, 'services:\n  sump:\n    ports:\n      - "127.0.0.1:8765:8765"\n');
  dbPath = join(dir, "catalog.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

/** A fake `child_process.spawn` that immediately exits with the given code and never touches a real process. */
function fakeSpawn(exitCode: number, calls: string[][]): SpawnFn {
  return ((cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    const proc = new EventEmitter() as unknown as ReturnType<SpawnFn>;
    (proc as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
    (proc as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
    queueMicrotask(() => proc.emit("exit", exitCode));
    return proc;
  }) as SpawnFn;
}

function fakeFetchOk(): typeof fetch {
  return (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
}

describe("detectLocalDocker", () => {
  it("returns true when docker info succeeds", async () => {
    const calls: string[][] = [];
    await expect(detectLocalDocker(fakeSpawn(0, calls))).resolves.toBe(true);
  });

  it("returns false, never throws, when docker info fails", async () => {
    const calls: string[][] = [];
    await expect(detectLocalDocker(fakeSpawn(1, calls))).resolves.toBe(false);
  });

  it("returns false, never throws, when the docker binary itself errors", async () => {
    const spawnFn = (() => {
      const proc = new EventEmitter() as unknown as ReturnType<SpawnFn>;
      (proc as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
      (proc as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
      queueMicrotask(() => proc.emit("error", new Error("ENOENT")));
      return proc;
    }) as SpawnFn;
    await expect(detectLocalDocker(spawnFn)).resolves.toBe(false);
  });
});

describe("provisionLocal", () => {
  it("registers a catalog row, provisioning -> active only after health-ready succeeds", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];
    await provisionLocal(
      catalog,
      {
        id: "sump-1",
        name: "local",
        source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, calls) },
    );

    const row = catalog.getSump("sump-1");
    expect(row?.status).toBe("active");
    expect(calls.some((c) => c.includes("pull"))).toBe(true);
    expect(calls.some((c) => c.includes("up"))).toBe(true);
    catalog.close();
  });

  it("marks the sump retired, not stuck provisioning, when a docker step fails", async () => {
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];
    await expect(
      provisionLocal(
        catalog,
        {
          id: "sump-1",
          name: "local",
          source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
          now: "2026-09-08T00:00:00Z",
        },
        { spawnFn: fakeSpawn(1, calls) },
      ),
    ).rejects.toThrow();

    expect(catalog.getSump("sump-1")?.status).toBe("retired");
    catalog.close();
  });

  // BUG-0025 (br-NET-004): a container config binding 0.0.0.0/network_mode: host
  // must be rejected before any docker command runs -- fixed by validating the
  // compose file up front, never provisioning something LAN-reachable.
  it("BUG-0025: rejects a compose file with network_mode: host before touching docker", async () => {
    const badCompose = join(dir, "bad-compose.yml");
    writeFileSync(badCompose, "services:\n  sump:\n    network_mode: host\n");
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];

    await expect(
      provisionLocal(
        catalog,
        {
          id: "sump-1",
          name: "local",
          source: { type: "registry", ref: "correlator/sump:latest", composeFile: badCompose },
          now: "2026-09-08T00:00:00Z",
        },
        { spawnFn: fakeSpawn(0, calls) },
      ),
    ).rejects.toThrow(NetworkExposureError);

    expect(calls).toHaveLength(0);
    catalog.close();
  });

  it("BUG-0025: rejects a compose file binding a port on 0.0.0.0", async () => {
    const badCompose = join(dir, "bad-compose-2.yml");
    writeFileSync(badCompose, 'services:\n  sump:\n    ports:\n      - "0.0.0.0:8765:8765"\n');
    await expect(validateComposeFile(badCompose)).rejects.toThrow(NetworkExposureError);
  });

  it("accepts a compose file bound to 127.0.0.1", async () => {
    await expect(validateComposeFile(composeOkPath)).resolves.toBeUndefined();
  });
});

describe("uninstallLocal", () => {
  // BUG-0027 (br-PROV-007): uninstall must resolve against the compose file
  // the sump was *actually* provisioned with, never a freshly re-resolved
  // default -- otherwise a sump provisioned from a custom source gets
  // --rmi all'd against the wrong image, leaving the real one behind.
  it("BUG-0027: uses the catalog-recorded image source, not a different default", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    const customCompose = join(dir, "custom-compose.yml");
    writeFileSync(customCompose, 'services:\n  sump:\n    ports:\n      - "127.0.0.1:9999:9999"\n');
    const defaultCompose = join(dir, "default-compose.yml");
    writeFileSync(
      defaultCompose,
      'services:\n  sump:\n    ports:\n      - "127.0.0.1:8765:8765"\n',
    );

    await provisionLocal(
      catalog,
      {
        id: "sump-1",
        name: "local",
        source: { type: "registry", ref: "custom/sump:0.0.2", composeFile: customCompose },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, []) },
    );

    const calls: string[][] = [];
    await uninstallLocal(catalog, "sump-1", { spawnFn: fakeSpawn(0, calls) });

    const downCall = calls.find((c) => c.includes("down"));
    expect(downCall).toBeDefined();
    expect(downCall).toContain(customCompose);
    expect(downCall).not.toContain(defaultCompose);
    expect(catalog.getSump("sump-1")?.status).toBe("retired");
    expect(catalog.getSump("sump-1")?.authToken).toBeNull();
    catalog.close();
  });
});

describe("provisionRemote / uninstallRemote", () => {
  // BUG-0105 (br-PROV-013): remote provisioning must never require git/GitHub
  // access on the target host -- the remote command is docker load/pull +
  // compose up only, nothing that clones or fetches a repo.
  it("BUG-0105: the remote ssh command never invokes git/clone", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];
    await provisionRemote(
      catalog,
      {
        id: "sump-2",
        name: "remote",
        target: { sshTarget: "user@example.com", sshKey: null },
        remotePort: 8765,
        source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, calls) },
    );

    const sshCalls = calls.filter((c) => c[0] === "ssh");
    for (const call of sshCalls) {
      const joined = call.join(" ");
      expect(joined).not.toMatch(/\bgit\b/);
    }
    expect(catalog.getSump("sump-2")?.status).toBe("active");
    catalog.close();
  });

  it("uninstallRemote clears the token and marks the sump retired", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    await provisionRemote(
      catalog,
      {
        id: "sump-2",
        name: "remote",
        target: { sshTarget: "user@example.com", sshKey: null },
        remotePort: 8765,
        source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, []) },
    );

    await uninstallRemote(
      catalog,
      "sump-2",
      { sshTarget: "user@example.com", sshKey: null },
      {
        spawnFn: fakeSpawn(0, []),
      },
    );

    expect(catalog.getSump("sump-2")?.status).toBe("retired");
    expect(catalog.getSump("sump-2")?.authToken).toBeNull();
    catalog.close();
  });
});
