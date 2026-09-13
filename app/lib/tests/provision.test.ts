import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Catalog } from "../catalog.ts";
import {
  connectExistingSump,
  detectLocalDocker,
  NetworkExposureError,
  provisionLocal,
  provisionRemote,
  type SpawnFn,
  uninstallLocal,
  uninstallRemote,
  uninstallSump,
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
    // touchSump stamps the real "now" at success time, not params.now
    // (that's the provisioning-start timestamp, a different moment).
    expect(row?.lastSeenAt).toBeTruthy();
    expect(new Date(row?.lastSeenAt ?? "").toISOString()).toBe(row?.lastSeenAt);
    expect(calls.some((c) => c.includes("pull"))).toBe(true);
    expect(calls.some((c) => c.includes("up"))).toBe(true);
    catalog.close();
  });

  it("does not set last_seen_at when a docker step fails", async () => {
    const catalog = new Catalog(dbPath);
    await expect(
      provisionLocal(
        catalog,
        {
          id: "sump-1",
          name: "local",
          source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
          now: "2026-09-08T00:00:00Z",
        },
        { spawnFn: fakeSpawn(1, []) },
      ),
    ).rejects.toThrow();

    expect(catalog.getSump("sump-1")?.lastSeenAt).toBeNull();
    catalog.close();
  });

  // cor-CORE.PROVISION-005 (auto-start) needs to run the bundled Sump
  // without any registry -- no `docker pull`/`docker load` at all, only
  // `docker compose up -d`, which builds locally from the compose file's
  // own `build:` config when the tagged image isn't present yet.
  it('"build" source: never pulls or loads, only runs docker compose up', async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];
    await provisionLocal(
      catalog,
      {
        id: "sump-1",
        name: "local",
        source: { type: "build", composeFile: composeOkPath },
        now: "2026-09-12T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, calls) },
    );

    expect(calls.some((c) => c.includes("pull"))).toBe(false);
    expect(calls.some((c) => c.includes("load"))).toBe(false);
    expect(calls.some((c) => c.includes("up"))).toBe(true);
    expect(catalog.getSump("sump-1")?.status).toBe("active");
    catalog.close();
  });

  it('"build" source: marks the sump retired, not stuck provisioning, on failure', async () => {
    const catalog = new Catalog(dbPath);
    const calls: string[][] = [];
    await expect(
      provisionLocal(
        catalog,
        {
          id: "sump-1",
          name: "local",
          source: { type: "build", composeFile: composeOkPath },
          now: "2026-09-12T00:00:00Z",
        },
        { spawnFn: fakeSpawn(1, calls) },
      ),
    ).rejects.toThrow();

    expect(catalog.getSump("sump-1")?.status).toBe("retired");
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
    expect(catalog.getSump("sump-2")?.lastSeenAt).toBeTruthy();
    catalog.close();
  });

  // cor-CORE.PROVISION-007: the SSH target must survive in the catalog so
  // a later uninstall can reconstruct it without asking the user again.
  it("persists the SSH target in catalogJson", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    await provisionRemote(
      catalog,
      {
        id: "sump-2",
        name: "remote",
        target: { sshTarget: "user@example.com", sshKey: "/path/to/key", sshPort: 2222 },
        remotePort: 8765,
        source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, []) },
    );

    const doc = JSON.parse(catalog.getSump("sump-2")?.catalogJson ?? "{}");
    expect(doc.sshTarget).toEqual({
      sshTarget: "user@example.com",
      sshKey: "/path/to/key",
      sshPort: 2222,
    });
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

// cor-CORE.PROVISION-007: the switcher UI's single "Uninstall"/"Disconnect"
// action -- dispatches on connectionType so callers never need to know
// which underlying mechanism a given Sump uses.
describe("uninstallSump", () => {
  it("dispatches to uninstallLocal for a local sump", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    await provisionLocal(
      catalog,
      {
        id: "sump-1",
        name: "local",
        source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, []) },
    );

    const calls: string[][] = [];
    await uninstallSump(catalog, "sump-1", { spawnFn: fakeSpawn(0, calls) });

    expect(calls.some((c) => c.includes("down"))).toBe(true);
    expect(catalog.getSump("sump-1")?.status).toBe("retired");
    catalog.close();
  });

  it("dispatches to uninstallRemote for an ssh sump, using the persisted target", async () => {
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

    const calls: string[][] = [];
    await uninstallSump(catalog, "sump-2", { spawnFn: fakeSpawn(0, calls) });

    expect(calls.some((c) => c[0] === "ssh")).toBe(true);
    expect(catalog.getSump("sump-2")?.status).toBe("retired");
    catalog.close();
  });

  it("throws for an ssh sump with no recorded target", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-3",
      name: "legacy ssh",
      connectionType: "ssh",
      host: "10.0.0.9",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });

    await expect(uninstallSump(catalog, "sump-3", { spawnFn: fakeSpawn(0, []) })).rejects.toThrow(
      /no recorded SSH target/,
    );
    catalog.close();
  });

  it("retires an external sump with no docker/ssh side effect", async () => {
    const catalog = new Catalog(dbPath);
    await connectExistingSump(
      catalog,
      { id: "sump-4", name: "existing", host: "10.0.0.5", port: 9000, now: "2026-09-12T00:00:00Z" },
      { fetchFn: fakeFetchOk() },
    );

    const calls: string[][] = [];
    await uninstallSump(catalog, "sump-4", { spawnFn: fakeSpawn(0, calls) });

    expect(calls).toHaveLength(0);
    expect(catalog.getSump("sump-4")?.status).toBe("retired");
    expect(catalog.getSump("sump-4")?.authToken).toBeNull();
    catalog.close();
  });

  it("clears the primary selection when the uninstalled sump was primary", async () => {
    const catalog = new Catalog(dbPath);
    await connectExistingSump(
      catalog,
      { id: "sump-5", name: "existing", host: "10.0.0.5", port: 9000, now: "2026-09-12T00:00:00Z" },
      { fetchFn: fakeFetchOk() },
    );
    catalog.setPrimarySumpId("sump-5");

    await uninstallSump(catalog, "sump-5", { spawnFn: fakeSpawn(0, []) });

    expect(catalog.getPrimarySumpId()).toBeNull();
    catalog.close();
  });

  it("leaves an unrelated primary selection untouched", async () => {
    const catalog = new Catalog(dbPath);
    await connectExistingSump(
      catalog,
      { id: "sump-6", name: "existing", host: "10.0.0.5", port: 9000, now: "2026-09-12T00:00:00Z" },
      { fetchFn: fakeFetchOk() },
    );
    catalog.setPrimarySumpId("sump-other");

    await uninstallSump(catalog, "sump-6", { spawnFn: fakeSpawn(0, []) });

    expect(catalog.getPrimarySumpId()).toBe("sump-other");
    catalog.close();
  });

  // cor-CORE.PROVISION-008: uninstalling a root cascades to retire the
  // host-scoped Sumps discovered under it, regardless of connectionType.
  it("cascades to retire host-scoped children of a local sump", async () => {
    vi.stubGlobal("fetch", fakeFetchOk());
    const catalog = new Catalog(dbPath);
    await provisionLocal(
      catalog,
      {
        id: "sump-7",
        name: "local",
        source: { type: "registry", ref: "correlator/sump:latest", composeFile: composeOkPath },
        now: "2026-09-08T00:00:00Z",
      },
      { spawnFn: fakeSpawn(0, []) },
    );
    catalog.syncLogicalSump({
      id: "sump-7:host-a",
      parentSumpId: "sump-7",
      dockerHost: "host-a",
      name: "host-a",
      host: null,
      port: 8765,
      authToken: null,
      createdAt: "2026-09-08T00:01:00Z",
    });

    await uninstallSump(catalog, "sump-7", { spawnFn: fakeSpawn(0, []) });

    expect(catalog.getSump("sump-7:host-a")?.status).toBe("retired");
    catalog.close();
  });

  it("cascades to retire host-scoped children of an external sump", async () => {
    const catalog = new Catalog(dbPath);
    await connectExistingSump(
      catalog,
      { id: "sump-8", name: "existing", host: "10.0.0.5", port: 9000, now: "2026-09-12T00:00:00Z" },
      { fetchFn: fakeFetchOk() },
    );
    catalog.syncLogicalSump({
      id: "sump-8:host-a",
      parentSumpId: "sump-8",
      dockerHost: "host-a",
      name: "host-a",
      host: "10.0.0.5",
      port: 9000,
      authToken: null,
      createdAt: "2026-09-12T00:01:00Z",
    });

    await uninstallSump(catalog, "sump-8", { spawnFn: fakeSpawn(0, []) });

    expect(catalog.getSump("sump-8:host-a")?.status).toBe("retired");
    catalog.close();
  });

  it("defensively retires a logical sump directly, with no parent side-effect, if ever invoked on one", async () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "root-9",
      name: "root",
      connectionType: "local",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-12T00:00:00Z",
      lastSeenAt: null,
    });
    catalog.syncLogicalSump({
      id: "root-9:host-a",
      parentSumpId: "root-9",
      dockerHost: "host-a",
      name: "host-a",
      host: "127.0.0.1",
      port: 8765,
      authToken: "tok",
      createdAt: "2026-09-12T00:01:00Z",
    });

    await uninstallSump(catalog, "root-9:host-a", { spawnFn: fakeSpawn(0, []) });

    expect(catalog.getSump("root-9:host-a")?.status).toBe("retired");
    expect(catalog.getSump("root-9")?.status).toBe("active");
    catalog.close();
  });
});

// cor-CORE.PROVISION-006 ("connect to an existing Sump"): a single-shot
// reachability check, not provisionLocal/Remote's install flow -- no
// spawn faking needed, only fetch.
describe("connectExistingSump", () => {
  it("registers the sump when GET /health succeeds", async () => {
    const catalog = new Catalog(dbPath);
    let requestedUrl: string | URL | undefined;
    let requestedHeaders: unknown;
    const fakeFetch = vi.fn(async (url: string | URL, options?: RequestInit) => {
      requestedUrl = url;
      requestedHeaders = options?.headers;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    await connectExistingSump(
      catalog,
      {
        id: "sump-1",
        name: "existing",
        host: "10.0.0.5",
        port: 9000,
        authToken: "tok",
        now: "2026-09-12T00:00:00Z",
      },
      { fetchFn: fakeFetch },
    );

    expect(String(requestedUrl)).toBe("http://10.0.0.5:9000/health");
    expect(requestedHeaders).toEqual({ "X-Correlator-Token": "tok" });
    const row = catalog.getSump("sump-1");
    expect(row?.connectionType).toBe("external");
    expect(row?.status).toBe("active");
    expect(row?.lastSeenAt).toBe("2026-09-12T00:00:00Z");
    catalog.close();
  });

  it("sends no auth header when no token is given", async () => {
    const catalog = new Catalog(dbPath);
    let requestedHeaders: unknown;
    const fakeFetch = vi.fn(async (_url: string | URL, options?: RequestInit) => {
      requestedHeaders = options?.headers;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    await connectExistingSump(
      catalog,
      { id: "sump-1", name: "existing", host: "10.0.0.5", port: 9000, now: "2026-09-12T00:00:00Z" },
      { fetchFn: fakeFetch },
    );

    expect(requestedHeaders).toEqual({});
    catalog.close();
  });

  it("rejects and writes nothing when the response is not ok", async () => {
    const catalog = new Catalog(dbPath);
    const fakeFetch = vi.fn(
      async () => new Response(null, { status: 503 }),
    ) as unknown as typeof fetch;

    await expect(
      connectExistingSump(
        catalog,
        {
          id: "sump-1",
          name: "existing",
          host: "10.0.0.5",
          port: 9000,
          now: "2026-09-12T00:00:00Z",
        },
        { fetchFn: fakeFetch },
      ),
    ).rejects.toThrow(/GET \/health failed: 503/);

    expect(catalog.listSumps()).toHaveLength(0);
    catalog.close();
  });

  it("rejects and writes nothing when fetch itself throws", async () => {
    const catalog = new Catalog(dbPath);
    const fakeFetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    await expect(
      connectExistingSump(
        catalog,
        {
          id: "sump-1",
          name: "existing",
          host: "10.0.0.5",
          port: 9000,
          now: "2026-09-12T00:00:00Z",
        },
        { fetchFn: fakeFetch },
      ),
    ).rejects.toThrow(/could not reach/);

    expect(catalog.listSumps()).toHaveLength(0);
    catalog.close();
  });
});
