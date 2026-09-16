import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpawnFn } from "../lib/provision.ts";
import type { ElectronApi, FakeableBrowserWindow } from "../shell.ts";
import {
  classifyOpenedFile,
  createWindow,
  defaultCatalogPath,
  registerAppLifecycle,
  registerIpcHandlers,
} from "../shell.ts";

// shell.ts (cor-CORE.SHELL-001/-002) takes electronApi as an explicit
// parameter rather than requiring "electron" itself, so it's plain,
// testable ESM TypeScript -- a fake object literal here, no module
// mocking needed. (.cjs files like main.cjs, the real bootstrap, bypass
// Vitest's transform pipeline entirely -- neither vi.mock nor vi.doMock
// intercepts a require() call inside one -- which is exactly why the
// electron-touching logic lives in shell.ts instead.)
let lastWindow: FakeableBrowserWindow & { handlers: Record<string, (...args: unknown[]) => void> };
let lastWindowOptions: Record<string, unknown> | null;
let electronApi: ElectronApi;

beforeEach(() => {
  lastWindowOptions = null;
  electronApi = {
    BrowserWindow: vi.fn().mockImplementation((options: Record<string, unknown>) => {
      lastWindowOptions = options;
      const handlers: Record<string, (...args: unknown[]) => void> = {};
      lastWindow = {
        handlers,
        show: vi.fn(),
        loadFile: vi.fn(async () => undefined),
        on: (event, cb) => {
          handlers[event] = cb;
        },
        once: (event, cb) => {
          handlers[event] = cb;
        },
      };
      return lastWindow;
    }) as unknown as ElectronApi["BrowserWindow"],
    ipcMain: { handle: vi.fn() },
    app: { on: vi.fn(), quit: vi.fn() },
  };
});

const windowOptions = { preloadPath: "/fake/preload.cjs", indexHtmlPath: "/fake/index.html" };

// Every registerIpcHandlers(...) call below passes this explicitly --
// its default (getOrCreateUserId()) touches the real
// ~/.correlator/identity.json, which a test must never do (same reason
// every call here already passes an explicit catalogPath/fetchFn
// instead of relying on defaultCatalogPath()/global fetch).
const testUserId = "test-user-id";

describe("cor-CORE.SHELL-001: window shell", () => {
  it("creates the window hidden, with contextIsolation on and nodeIntegration off", async () => {
    await createWindow(electronApi, windowOptions);

    expect(lastWindowOptions?.show).toBe(false);
    const webPreferences = lastWindowOptions?.webPreferences as Record<string, unknown>;
    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.nodeIntegration).toBe(false);
    expect(webPreferences.preload).toBe("/fake/preload.cjs");
  });

  it("shows the window only once ready-to-show fires, not before", async () => {
    await createWindow(electronApi, windowOptions);

    expect(lastWindow.show).not.toHaveBeenCalled();
    lastWindow.handlers["ready-to-show"]?.();
    expect(lastWindow.show).toHaveBeenCalledOnce();
  });

  it("quits the app when window-all-closed fires", () => {
    registerAppLifecycle(electronApi);
    const registeredEvent = (electronApi.app.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "window-all-closed",
    );
    expect(registeredEvent).toBeDefined();
    const handler = registeredEvent?.[1] as () => void;
    handler();
    expect(electronApi.app.quit).toHaveBeenCalledOnce();
  });
});

describe("cor-CORE.SHELL-002: IPC bridge", () => {
  it("every preload.cjs channel has a matching ipcMain.handle registration", () => {
    registerIpcHandlers(electronApi, "/fake/catalog.db", fetch, testUserId);
    const registeredChannels = (
      electronApi.ipcMain.handle as ReturnType<typeof vi.fn>
    ).mock.calls.map((call) => call[0] as string);

    const preloadSource = readFileSync(new URL("../preload.cjs", import.meta.url), "utf8");
    const exposedChannels = [...preloadSource.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)].map(
      (m) => m[1],
    );

    expect(exposedChannels.length).toBeGreaterThan(0);
    expect(new Set(registeredChannels)).toEqual(new Set(exposedChannels));
  });

  it("listSumps reads a real Catalog instance, not a mock of app/lib/", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "seeded",
      connectionType: "local",
      host: null,
      port: null,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();

    registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);
    const listSumpsHandler = (
      electronApi.ipcMain.handle as ReturnType<typeof vi.fn>
    ).mock.calls.find((call) => call[0] === "list-sumps")?.[1] as (
      ...args: unknown[]
    ) => Promise<unknown>;
    const result = (await listSumpsHandler()) as Array<{ id: string }>;

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sump-1");

    rmSync(dir, { recursive: true, force: true });
  });

  it("queryRecords fetches the connected Sump's /records with the right URL, params, and auth header", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "seeded",
      connectionType: "logical",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
      dockerHost: "h1",
    });
    seeded.close();

    let requestedUrl: URL | undefined;
    let requestedHeaders: unknown;
    const fakeFetch = vi.fn(async (url: URL, options?: RequestInit) => {
      requestedUrl = url;
      requestedHeaders = options?.headers;
      return new Response(
        JSON.stringify({ records: [], next_log_cursor: null, next_metric_cursor: null }),
        {
          status: 200,
        },
      );
    }) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const queryRecordsHandler = (
      electronApi.ipcMain.handle as ReturnType<typeof vi.fn>
    ).mock.calls.find((call) => call[0] === "query-records")?.[1] as (
      ...args: unknown[]
    ) => Promise<unknown>;

    const result = await queryRecordsHandler(null, "sump-1", { kind: "log", limit: 50 });

    expect(requestedUrl?.origin).toBe("http://127.0.0.1:5170");
    expect(requestedUrl?.pathname).toBe("/records");
    expect(requestedUrl?.searchParams.get("docker_host")).toBe("h1");
    expect(requestedUrl?.searchParams.get("kind")).toBe("log");
    expect(requestedUrl?.searchParams.get("limit")).toBe("50");
    expect(requestedHeaders).toEqual({
      "X-Correlator-Token": "tok",
      "X-Correlator-User-Id": testUserId,
    });
    expect(result).toEqual({ records: [], next_log_cursor: null, next_metric_cursor: null });

    const check = new Catalog(catalogPath);
    expect(check.getSump("sump-1")?.lastSeenAt).toBeTruthy();
    check.close();

    rmSync(dir, { recursive: true, force: true });
  });

  it("queryRecords throws for a sump not in the catalog", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    registerIpcHandlers(electronApi, catalogPath, vi.fn() as unknown as typeof fetch, testUserId);
    const queryRecordsHandler = (
      electronApi.ipcMain.handle as ReturnType<typeof vi.fn>
    ).mock.calls.find((call) => call[0] === "query-records")?.[1] as (
      ...args: unknown[]
    ) => Promise<unknown>;

    await expect(queryRecordsHandler(null, "no-such-sump", "h1", {})).rejects.toThrow();

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.PROJECT-003: recording/track download and catalog registration", () => {
  it("downloadRecording writes the file, registers it in the catalog, and adds a project reference", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const projectPath = join(dir, "test.correlator");

    const { Catalog } = await import("../lib/catalog.ts");
    const { saveProject, createProject, loadProject } = await import("../lib/project.ts");
    saveProject(projectPath, createProject());

    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "seeded",
      connectionType: "logical",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-10T00:00:00Z",
      lastSeenAt: null,
      dockerHost: "h1",
    });
    seeded.upsertDataStream({
      id: "ds-1",
      sumpId: "sump-1",
      kind: "ssh",
      sourceRef: "h1",
      ownerUserId: null,
      isPrivate: false,
      catalogJson: "{}",
      createdAt: "2026-09-10T00:00:00Z",
    });
    seeded.close();

    const fakeBytes = new Uint8Array([1, 2, 3, 4]);
    const fakeFetch = vi.fn(
      async () => new Response(fakeBytes, { status: 200 }),
    ) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "download-recording",
    )?.[1] as (...args: unknown[]) => Promise<{ id: string; filePath: string }>;

    const result = await handler(null, {
      sumpId: "sump-1",
      dataStreamId: "ds-1",
      projectPath,
    });

    expect(existsSync(result.filePath)).toBe(true);
    expect(new Uint8Array(readFileSync(result.filePath))).toEqual(fakeBytes);

    const check = new Catalog(catalogPath);
    const row = check.getRecording(result.id);
    expect(row?.filePath).toBe(result.filePath);
    expect(check.getSump("sump-1")?.lastSeenAt).toBeTruthy();
    check.close();

    expect(loadProject(projectPath).references).toContain(result.filePath);

    rmSync(dir, { recursive: true, force: true });
  });

  it("registers nothing and adds no project reference when the export fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const projectPath = join(dir, "test.correlator");

    const { Catalog } = await import("../lib/catalog.ts");
    const { saveProject, createProject, loadProject } = await import("../lib/project.ts");
    saveProject(projectPath, createProject());

    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "seeded",
      connectionType: "local",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-10T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();

    const fakeFetch = vi.fn(
      async () => new Response("nope", { status: 404 }),
    ) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "download-track",
    )?.[1] as (...args: unknown[]) => Promise<unknown>;

    await expect(
      handler(null, {
        sumpId: "sump-1",
        dataStreamId: "ds-1",
        dockerHost: "h1",
        metric: "cpu_pct",
        projectPath,
      }),
    ).rejects.toThrow();

    const check = new Catalog(catalogPath);
    const sumps = check.listSumps();
    check.close();
    expect(sumps).toHaveLength(1); // only the seeded sump, nothing else registered
    expect(sumps[0].lastSeenAt).toBeNull();

    expect(loadProject(projectPath).references).toEqual([]);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.FEDERATION-001/-002: data-source listing and privacy", () => {
  async function seedSump(catalogPath: string): Promise<void> {
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "seeded",
      connectionType: "local",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-11T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();
  }

  it("listDataSources fetches GET /data-sources with both auth headers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    await seedSump(catalogPath);

    let requestedUrl: URL | undefined;
    let requestedHeaders: unknown;
    const fakeFetch = vi.fn(async (url: URL, options?: RequestInit) => {
      requestedUrl = url;
      requestedHeaders = options?.headers;
      return new Response(JSON.stringify({ data_sources: ["self"] }), { status: 200 });
    }) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "list-data-sources",
    )?.[1] as (...args: unknown[]) => Promise<unknown>;

    const result = await handler(null, "sump-1");

    expect(requestedUrl?.pathname).toBe("/data-sources");
    expect(requestedHeaders).toEqual({
      "X-Correlator-Token": "tok",
      "X-Correlator-User-Id": testUserId,
    });
    expect(result).toEqual({ data_sources: ["self"] });

    const { Catalog } = await import("../lib/catalog.ts");
    const check = new Catalog(catalogPath);
    expect(check.getSump("sump-1")?.lastSeenAt).toBeTruthy();
    check.close();

    rmSync(dir, { recursive: true, force: true });
  });

  it("setDataSourcePrivacy PUTs the privacy flag as JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    await seedSump(catalogPath);

    let requestedMethod: string | undefined;
    let requestedBody: unknown;
    const fakeFetch = vi.fn(async (_url: URL, options?: RequestInit) => {
      requestedMethod = options?.method;
      requestedBody = options?.body ? JSON.parse(String(options.body)) : undefined;
      return new Response(JSON.stringify({ owner_user_id: testUserId, is_private: true }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "set-data-source-privacy",
    )?.[1] as (...args: unknown[]) => Promise<unknown>;

    const result = await handler(null, { sumpId: "sump-1", name: "self", isPrivate: true });

    expect(requestedMethod).toBe("PUT");
    expect(requestedBody).toEqual({ is_private: true });
    expect(result).toEqual({ owner_user_id: testUserId, is_private: true });

    const { Catalog } = await import("../lib/catalog.ts");
    const check = new Catalog(catalogPath);
    expect(check.getSump("sump-1")?.lastSeenAt).toBeTruthy();
    check.close();

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.FEDERATION-004: promote-data-stream", () => {
  it("registers a new sump, data stream, and secondary-sump link only on success", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "parent-1",
      name: "parent",
      connectionType: "local",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-11T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();

    const fakeFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            container_name: "correlator-sump-remote",
            host: "10.0.0.5",
            port: 8770,
            reachable: true,
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "promote-data-stream",
    )?.[1] as (...args: unknown[]) => Promise<{ childSumpId: string }>;

    const result = await handler(null, {
      parentSumpId: "parent-1",
      name: "remote",
      host: "10.0.0.5",
      imageRef: "img",
      port: 8770,
    });

    const check = new Catalog(catalogPath);
    const childSump = check.getSump(result.childSumpId);
    const parentSump = check.getSump("parent-1");
    const links = check.listSecondarySumpLinks("parent-1");
    check.close();

    expect(childSump?.host).toBe("10.0.0.5");
    expect(childSump?.port).toBe(8770);
    expect(childSump?.status).toBe("active");
    // The parent was the one actually contacted -- the newly-created
    // child hasn't been directly reached by correlator yet.
    expect(parentSump?.lastSeenAt).toBeTruthy();
    expect(childSump?.lastSeenAt).toBeNull();
    expect(links).toHaveLength(1);
    expect(links[0].childSumpId).toBe(result.childSumpId);

    rmSync(dir, { recursive: true, force: true });
  });

  it("registers nothing when the parent's /promote call fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "parent-1",
      name: "parent",
      connectionType: "local",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-11T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();

    const fakeFetch = vi.fn(
      async () => new Response("nope", { status: 422 }),
    ) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "promote-data-stream",
    )?.[1] as (...args: unknown[]) => Promise<unknown>;

    await expect(
      handler(null, { parentSumpId: "parent-1", name: "remote", host: "h", imageRef: "img" }),
    ).rejects.toThrow();

    const check = new Catalog(catalogPath);
    const sumps = check.listSumps();
    check.close();
    expect(sumps).toHaveLength(1); // only the seeded parent, nothing else registered

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.PROJECT-004: classifyOpenedFile", () => {
  it("classifies each of the three extensions, case-insensitively", () => {
    expect(classifyOpenedFile("/x/a.track")).toBe("track");
    expect(classifyOpenedFile("/x/a.TRACK")).toBe("track");
    expect(classifyOpenedFile("/x/a.recording")).toBe("recording");
    expect(classifyOpenedFile("/x/a.correlator")).toBe("project");
  });

  it("returns null for anything else", () => {
    expect(classifyOpenedFile("/x/a.json")).toBeNull();
    expect(classifyOpenedFile("/x/a")).toBeNull();
  });

  it("package.json's build.fileAssociations lists all three extensions with correct fields", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const byExt = Object.fromEntries(
      (pkg.build.fileAssociations as Array<{ ext: string; name: string; role: string }>).map(
        (assoc) => [assoc.ext, assoc],
      ),
    );

    for (const ext of ["recording", "track", "correlator"]) {
      expect(byExt[ext]).toBeDefined();
      expect(typeof byExt[ext].name).toBe("string");
      expect(byExt[ext].role).toBe("Editor");
    }
  });

  it("cor-CORE.PACKAGING-002: package.json's build config has all three platform targets", async () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

    expect(pkg.build.mac.target).toBe("dmg");
    expect(pkg.build.win.target).toBe("nsis");
    expect(pkg.build.linux.target).toBe("AppImage");
    expect(pkg.build.directories.output).toBe("dist");
  });
});

describe("defaultCatalogPath", () => {
  it("resolves to ~/.correlator/catalog.db", () => {
    expect(defaultCatalogPath().endsWith(join(".correlator", "catalog.db"))).toBe(true);
  });
});

describe("cor-CORE.PROVISION-006: Add Sump chooser backing actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  function findHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
    return (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === channel,
    )?.[1] as (...args: unknown[]) => Promise<unknown>;
  }

  describe("detect-docker", () => {
    it("returns true when docker info succeeds", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId, {
        spawnFn: fakeSpawn(0, 0),
      });

      expect(await findHandler("detect-docker")()).toBe(true);

      rmSync(dir, { recursive: true, force: true });
    });

    it("returns false when docker info fails", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId, {
        spawnFn: fakeSpawn(1, 0),
      });

      expect(await findHandler("detect-docker")()).toBe(false);

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("connect-existing-sump", () => {
    it("registers the sump on a successful health check", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");

      let requestedUrl: string | URL | undefined;
      let requestedHeaders: unknown;
      const fakeFetch = vi.fn(async (url: string | URL, options?: RequestInit) => {
        requestedUrl = url;
        requestedHeaders = options?.headers;
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch;

      registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
      const result = (await findHandler("connect-existing-sump")(null, {
        name: "existing",
        host: "10.0.0.5",
        port: 9000,
        authToken: "tok",
      })) as { connectionType: string; status: string; host: string; port: number };

      expect(String(requestedUrl)).toBe("http://10.0.0.5:9000/health");
      expect(requestedHeaders).toEqual({ "X-Correlator-Token": "tok" });
      expect(result.connectionType).toBe("external");
      expect(result.status).toBe("active");
      expect(result.host).toBe("10.0.0.5");
      expect(result.port).toBe(9000);

      const { Catalog } = await import("../lib/catalog.ts");
      const check = new Catalog(catalogPath);
      expect(check.listSumps()).toHaveLength(1);
      check.close();

      rmSync(dir, { recursive: true, force: true });
    });

    it("rejects and writes nothing when the health check fails", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      const fakeFetch = vi.fn(
        async () => new Response(null, { status: 503 }),
      ) as unknown as typeof fetch;

      registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
      await expect(
        findHandler("connect-existing-sump")(null, {
          name: "existing",
          host: "10.0.0.5",
          port: 9000,
        }),
      ).rejects.toThrow();

      const { Catalog } = await import("../lib/catalog.ts");
      const check = new Catalog(catalogPath);
      expect(check.listSumps()).toHaveLength(0);
      check.close();

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("install-local-sump", () => {
    it("installs via provisionLocal and returns the active row", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      vi.stubGlobal("fetch", fakeFetchOk());

      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId, {
        spawnFn: fakeSpawn(0, 0),
      });
      const result = (await findHandler("install-local-sump")()) as {
        id: string;
        status: string;
      };

      expect(result.id).toBe("local");
      expect(result.status).toBe("active");

      rmSync(dir, { recursive: true, force: true });
    });

    it("rejects when Docker is unavailable", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");

      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId, {
        spawnFn: fakeSpawn(1, 0),
      });
      await expect(findHandler("install-local-sump")()).rejects.toThrow(/docker/i);

      const { Catalog } = await import("../lib/catalog.ts");
      const check = new Catalog(catalogPath);
      expect(check.listSumps()).toHaveLength(0);
      check.close();

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("install-remote-sump", () => {
    it("provisions via provisionRemote and returns the active row", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      vi.stubGlobal("fetch", fakeFetchOk());

      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId, {
        spawnFn: fakeSpawn(0, 0),
      });
      const result = (await findHandler("install-remote-sump")(null, {
        name: "remote",
        sshTarget: "user@example.com",
        remotePort: 8765,
        imageRef: "correlator/sump:latest",
      })) as { connectionType: string; status: string };

      expect(result.connectionType).toBe("ssh");
      expect(result.status).toBe("active");

      rmSync(dir, { recursive: true, force: true });
    });

    it("leaves the row retired when a docker step fails on the remote host", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");

      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId, {
        spawnFn: fakeSpawn(0, 1),
      });
      await expect(
        findHandler("install-remote-sump")(null, {
          name: "remote",
          sshTarget: "user@example.com",
          remotePort: 8765,
          imageRef: "correlator/sump:latest",
        }),
      ).rejects.toThrow();

      const { Catalog } = await import("../lib/catalog.ts");
      const check = new Catalog(catalogPath);
      const sumps = check.listSumps();
      check.close();
      expect(sumps).toHaveLength(1);
      expect(sumps[0].status).toBe("retired");

      rmSync(dir, { recursive: true, force: true });
    });
  });
});

describe("cor-CORE.PROVISION-007: sump management and switcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function findHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
    return (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === channel,
    )?.[1] as (...args: unknown[]) => Promise<unknown>;
  }

  function fakeFetchOk(): typeof fetch {
    return (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
  }

  async function seedExternalSump(catalogPath: string, id: string) {
    const { Catalog } = await import("../lib/catalog.ts");
    const { connectExistingSump } = await import("../lib/provision.ts");
    const catalog = new Catalog(catalogPath);
    await connectExistingSump(
      catalog,
      { id, name: "existing", host: "10.0.0.5", port: 9000, now: "2026-09-12T00:00:00Z" },
      { fetchFn: fakeFetchOk() },
    );
    catalog.close();
  }

  describe("get-primary-sump-id / select-primary-sump", () => {
    it("defaults to null, then round-trips a selection", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      await seedExternalSump(catalogPath, "sump-1");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

      expect(await findHandler("get-primary-sump-id")()).toBeNull();

      await findHandler("select-primary-sump")(null, { sumpId: "sump-1" });
      expect(await findHandler("get-primary-sump-id")()).toBe("sump-1");

      rmSync(dir, { recursive: true, force: true });
    });

    it("rejects an unknown sump id", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

      await expect(
        findHandler("select-primary-sump")(null, { sumpId: "no-such-sump" }),
      ).rejects.toThrow(/no sump/i);

      rmSync(dir, { recursive: true, force: true });
    });

    it("rejects a retired sump id", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      await seedExternalSump(catalogPath, "sump-1");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);
      await findHandler("uninstall-sump")(null, { sumpId: "sump-1" });

      await expect(findHandler("select-primary-sump")(null, { sumpId: "sump-1" })).rejects.toThrow(
        /retired/i,
      );

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("rename-sump", () => {
    it("renames and returns the updated row", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      await seedExternalSump(catalogPath, "sump-1");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

      const result = (await findHandler("rename-sump")(null, {
        sumpId: "sump-1",
        name: "renamed",
      })) as { name: string };

      expect(result.name).toBe("renamed");

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("uninstall-sump", () => {
    it("retires an external sump with no docker/ssh side effect", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      await seedExternalSump(catalogPath, "sump-1");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

      await findHandler("uninstall-sump")(null, { sumpId: "sump-1" });

      const { Catalog } = await import("../lib/catalog.ts");
      const check = new Catalog(catalogPath);
      const row = check.getSump("sump-1");
      check.close();
      expect(row?.status).toBe("retired");

      rmSync(dir, { recursive: true, force: true });
    });

    it("clears the primary selection when the uninstalled sump was primary", async () => {
      const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
      const catalogPath = join(dir, "catalog.db");
      await seedExternalSump(catalogPath, "sump-1");
      registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);
      await findHandler("select-primary-sump")(null, { sumpId: "sump-1" });

      await findHandler("uninstall-sump")(null, { sumpId: "sump-1" });

      expect(await findHandler("get-primary-sump-id")()).toBeNull();

      rmSync(dir, { recursive: true, force: true });
    });
  });
});

describe("cor-CORE.PROVISION-008: docker-host-scoped logical sumps", () => {
  function findHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
    return (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === channel,
    )?.[1] as (...args: unknown[]) => Promise<unknown>;
  }

  it("list-sumps discovers docker hosts under an active root and registers one logical sump per host", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "root-1",
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
    seeded.close();

    const fakeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data_sources: ["self", "host-b"] }), { status: 200 }),
    ) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const result = (await findHandler("list-sumps")()) as Array<{
      id: string;
      connectionType: string;
      parentSumpId: string | null;
      dockerHost: string | null;
    }>;

    expect(result).toHaveLength(3);
    const self = result.find((r) => r.id === "root-1:self");
    const hostB = result.find((r) => r.id === "root-1:host-b");
    expect(self?.connectionType).toBe("logical");
    expect(self?.parentSumpId).toBe("root-1");
    expect(self?.dockerHost).toBe("self");
    expect(hostB?.dockerHost).toBe("host-b");

    rmSync(dir, { recursive: true, force: true });
  });

  it("list-sumps skips a root that fails to answer /data-sources, without breaking the rest of the list", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "root-1",
      name: "unreachable root",
      connectionType: "local",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-12T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();

    const fakeFetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    const result = (await findHandler("list-sumps")()) as Array<{ id: string }>;

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("root-1");

    rmSync(dir, { recursive: true, force: true });
  });

  it("query-records resolves docker_host from the target sump's own row, not a caller-supplied argument", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "root-1",
      name: "root",
      connectionType: "local",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-12T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.upsertSump({
      id: "root-1:host-a",
      name: "host-a",
      connectionType: "logical",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-12T00:00:00Z",
      lastSeenAt: null,
      parentSumpId: "root-1",
      dockerHost: "host-a",
    });
    seeded.close();

    let requestedUrl: URL | undefined;
    const fakeFetch = vi.fn(async (url: URL) => {
      requestedUrl = url;
      return new Response(
        JSON.stringify({ records: [], next_log_cursor: null, next_metric_cursor: null }),
        {
          status: 200,
        },
      );
    }) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);
    await findHandler("query-records")(null, "root-1:host-a", {});

    expect(requestedUrl?.searchParams.get("docker_host")).toBe("host-a");

    rmSync(dir, { recursive: true, force: true });
  });

  it("query-records throws a clear error against a root sump with no docker_host scope", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "root-1",
      name: "root",
      connectionType: "local",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-12T00:00:00Z",
      lastSeenAt: null,
    });
    seeded.close();

    registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);
    await expect(findHandler("query-records")(null, "root-1", {})).rejects.toThrow(
      /no docker_host scope/,
    );

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.ARCHIVE-000003: live recording session IPC handlers", () => {
  function findHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
    return (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === channel,
    )?.[1] as (...args: unknown[]) => Promise<unknown>;
  }

  it("handles start, get, pause, resume, stop recording sessions via IPC", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "logical",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-16T00:00:00Z",
      lastSeenAt: null,
      dockerHost: "sump-1",
    });
    seeded.upsertDataStream({
      id: "sump-1",
      sumpId: "sump-1",
      kind: "sump",
      sourceRef: "sump-1",
      ownerUserId: null,
      isPrivate: false,
      catalogJson: "{}",
      createdAt: "2026-09-16T00:00:00Z",
    });
    seeded.close();

    const fakeFetch = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    ) as unknown as typeof fetch;

    registerIpcHandlers(electronApi, catalogPath, fakeFetch, testUserId);

    // Start
    const started = (await findHandler("start-recording-session")(null, {
      sumpId: "sump-1",
    })) as { id: string; status: string };
    expect(started.status).toBe("recording");

    // Get active
    const active = (await findHandler("get-recording-session")(null, {
      sumpId: "sump-1",
    })) as { id: string; status: string };
    expect(active?.id).toBe(started.id);

    // Pause (flushes segment)
    const paused = (await findHandler("pause-recording-session")(null, {
      sessionId: started.id,
    })) as { status: string; segments: unknown[] };
    expect(paused?.status).toBe("paused");
    expect(paused?.segments).toHaveLength(1);

    // Resume
    const resumed = (await findHandler("resume-recording-session")(null, {
      sessionId: started.id,
    })) as { status: string };
    expect(resumed?.status).toBe("recording");

    // Stop
    const stopped = (await findHandler("stop-recording-session")(null, {
      sessionId: started.id,
    })) as { status: string; segments: unknown[] };
    expect(stopped?.status).toBe("stopped");
    expect(stopped?.segments).toHaveLength(2);

    rmSync(dir, { recursive: true, force: true });
  });

  it("coerces crashed recording sessions on boot and returns them via get-interrupted-sessions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const { startRecordingSession } = await import("../lib/recording-session.ts");

    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "local",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-16T00:00:00Z",
      lastSeenAt: null,
    });
    startRecordingSession(seeded, { sumpId: "sump-1" });
    seeded.close();

    // Re-register IPC handlers (simulates app boot)
    registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

    const interrupted = (await findHandler("get-interrupted-sessions")()) as Array<{
      id: string;
      status: string;
      wasInterrupted: boolean;
    }>;

    expect(interrupted).toHaveLength(1);
    expect(interrupted[0].status).toBe("paused");
    expect(interrupted[0].wasInterrupted).toBe(true);

    // Dismiss
    await findHandler("dismiss-interrupted-session")(null, { sessionId: interrupted[0].id });
    const remaining = (await findHandler("get-interrupted-sessions")()) as Array<unknown>;
    expect(remaining).toHaveLength(0);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.EVENT-000001/-000002: event triggers IPC handlers", () => {
  function findHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
    return (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === channel,
    )?.[1] as (...args: unknown[]) => Promise<unknown>;
  }

  it("handles event rule CRUD and evaluation via IPC", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");
    const { Catalog } = await import("../lib/catalog.ts");
    const seeded = new Catalog(catalogPath);
    seeded.upsertSump({
      id: "sump-1",
      name: "local",
      connectionType: "logical",
      host: "127.0.0.1",
      port: 8765,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-16T00:00:00Z",
      lastSeenAt: null,
      dockerHost: "sump-1",
    });
    seeded.close();

    registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

    // Create Rule
    const created = (await findHandler("create-event-rule")(null, {
      sumpId: "sump-1",
      name: "High CPU Trigger",
      conditionType: "metric",
      metricName: "cpu_pct",
      operator: "gt",
      threshold: 75,
      action: "notify",
    })) as { id: string; name: string };

    expect(created.name).toBe("High CPU Trigger");

    // List Rules
    const rules = (await findHandler("list-event-rules")(null, { sumpId: "sump-1" })) as Array<{
      id: string;
      enabled: boolean;
    }>;
    expect(rules).toHaveLength(1);
    expect(rules[0].enabled).toBe(true);

    // Toggle Rule
    const toggled = (await findHandler("toggle-event-rule")(null, {
      ruleId: created.id,
      enabled: false,
    })) as { enabled: boolean };
    expect(toggled.enabled).toBe(false);

    // Evaluate Rules
    const evals = (await findHandler("evaluate-event-rules")(null, {
      sumpId: "sump-1",
      samples: [{ kind: "metric", ts: "2026-09-16T10:00:00Z", cpu_pct: 90, docker_host: "sump-1" }],
    })) as Array<{ triggered: boolean }>;
    expect(evals).toHaveLength(1);
    expect(evals[0].triggered).toBe(false); // Because disabled

    // Delete Rule
    await findHandler("delete-event-rule")(null, { ruleId: created.id });
    const remaining = (await findHandler("list-event-rules")(null, {
      sumpId: "sump-1",
    })) as Array<unknown>;
    expect(remaining).toHaveLength(0);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("cor-CORE.SHELL-000005: app preferences IPC handlers", () => {
  function findHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
    return (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === channel,
    )?.[1] as (...args: unknown[]) => Promise<unknown>;
  }

  it("handles get-preferences and set-preferences via IPC", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    registerIpcHandlers(electronApi, catalogPath, fetch, testUserId);

    const initial = (await findHandler("get-preferences")()) as { defaultQueryLimit: number };
    expect(initial.defaultQueryLimit).toBe(100);

    const updated = (await findHandler("set-preferences")(null, {
      defaultQueryLimit: 300,
      theme: "dark",
    })) as { defaultQueryLimit: number; theme: string };

    expect(updated.defaultQueryLimit).toBe(300);
    expect(updated.theme).toBe("dark");

    const reRead = (await findHandler("get-preferences")()) as { defaultQueryLimit: number };
    expect(reRead.defaultQueryLimit).toBe(300);

    rmSync(dir, { recursive: true, force: true });
  });
});
