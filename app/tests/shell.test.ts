import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    registerIpcHandlers(electronApi, "/fake/catalog.db");
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

    registerIpcHandlers(electronApi, catalogPath);
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
      connectionType: "local",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
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

    registerIpcHandlers(electronApi, catalogPath, fakeFetch);
    const queryRecordsHandler = (
      electronApi.ipcMain.handle as ReturnType<typeof vi.fn>
    ).mock.calls.find((call) => call[0] === "query-records")?.[1] as (
      ...args: unknown[]
    ) => Promise<unknown>;

    const result = await queryRecordsHandler(null, "sump-1", "h1", { kind: "log", limit: 50 });

    expect(requestedUrl?.origin).toBe("http://127.0.0.1:5170");
    expect(requestedUrl?.pathname).toBe("/records");
    expect(requestedUrl?.searchParams.get("docker_host")).toBe("h1");
    expect(requestedUrl?.searchParams.get("kind")).toBe("log");
    expect(requestedUrl?.searchParams.get("limit")).toBe("50");
    expect(requestedHeaders).toEqual({ "X-Correlator-Token": "tok" });
    expect(result).toEqual({ records: [], next_log_cursor: null, next_metric_cursor: null });

    rmSync(dir, { recursive: true, force: true });
  });

  it("queryRecords throws for a sump not in the catalog", async () => {
    const dir = mkdtempSync(join(tmpdir(), "correlator-shell-test-"));
    const catalogPath = join(dir, "catalog.db");

    registerIpcHandlers(electronApi, catalogPath, vi.fn() as unknown as typeof fetch);
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
      connectionType: "local",
      host: "127.0.0.1",
      port: 5170,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-10T00:00:00Z",
      lastSeenAt: null,
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

    registerIpcHandlers(electronApi, catalogPath, fakeFetch);
    const handler = (electronApi.ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "download-recording",
    )?.[1] as (...args: unknown[]) => Promise<{ id: string; filePath: string }>;

    const result = await handler(null, {
      sumpId: "sump-1",
      dataStreamId: "ds-1",
      dockerHost: "h1",
      projectPath,
    });

    expect(existsSync(result.filePath)).toBe(true);
    expect(new Uint8Array(readFileSync(result.filePath))).toEqual(fakeBytes);

    const check = new Catalog(catalogPath);
    const row = check.getRecording(result.id);
    check.close();
    expect(row?.filePath).toBe(result.filePath);

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

    registerIpcHandlers(electronApi, catalogPath, fakeFetch);
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

    expect(loadProject(projectPath).references).toEqual([]);

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
});

describe("defaultCatalogPath", () => {
  it("resolves to ~/.correlator/catalog.db", () => {
    expect(defaultCatalogPath().endsWith(join(".correlator", "catalog.db"))).toBe(true);
  });
});
