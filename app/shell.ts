/**
 * The actual logic behind cor-CORE.SHELL-001/-002 -- window creation and
 * IPC handler registration -- factored out of main.cjs so it's plain,
 * testable ESM TypeScript with zero direct dependency on the `electron`
 * package (it only ever touches whatever `electronApi` its caller passes
 * in). main.cjs itself stays a thin, essentially-untested bootstrap that
 * `require("electron")`s the real thing and calls into here, the same
 * split cttc's own main.js/lib/* boundary already draws.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Catalog } from "./lib/catalog.ts";
import {
  addReference,
  defaultProjectPath,
  ensureDefaultProject,
  loadProject,
  saveProject,
} from "./lib/project.ts";

export interface RecordsQueryParams {
  kind?: "log" | "metric" | "both";
  containerId?: string;
  level?: string;
  q?: string;
  start?: string;
  end?: string;
  logCursor?: string;
  metricCursor?: string;
  limit?: number;
}

export interface FakeableBrowserWindow {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  once: (event: string, cb: (...args: unknown[]) => void) => void;
  show: () => void;
  loadFile: (path: string, options?: Record<string, unknown>) => Promise<void>;
}

export interface ElectronApi {
  BrowserWindow: new (options: Record<string, unknown>) => FakeableBrowserWindow;
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => void };
  app: { on: (event: string, cb: (...args: unknown[]) => void) => void; quit: () => void };
}

export function defaultCatalogPath(): string {
  // Mirrors cttc's own `~/.cttc/` convention (lib/api-token.js), not
  // Electron's app.getPath("userData") -- keeps the path predictable and
  // directly inspectable, same as cttc's was.
  return join(homedir(), ".correlator", "catalog.db");
}

export interface CreateWindowOptions {
  preloadPath: string;
  indexHtmlPath: string;
}

let mainWindow: FakeableBrowserWindow | null = null;

export async function createWindow(
  electronApi: ElectronApi,
  options: CreateWindowOptions,
): Promise<FakeableBrowserWindow> {
  const win = new electronApi.BrowserWindow({
    width: 1280,
    height: 800,
    // Created hidden -- shown only once the renderer has actually painted
    // a first frame (see 'ready-to-show' below), so the window never
    // paints as a blank rectangle before entry.tsx has rendered anything.
    show: false,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.once("ready-to-show", () => {
    win.show();
  });

  await win.loadFile(options.indexHtmlPath);
  return win;
}

// A per-record-kind camelCase->snake_case query-param mapping, matching
// cor-CORE.QUERY-002's GET /records contract exactly.
const RECORDS_PARAM_KEYS: Record<keyof RecordsQueryParams, string> = {
  kind: "kind",
  containerId: "container_id",
  level: "level",
  q: "q",
  start: "start",
  end: "end",
  logCursor: "log_cursor",
  metricCursor: "metric_cursor",
  limit: "limit",
};

function resolveSump(catalogPath: string, sumpId: string) {
  mkdirSync(dirname(catalogPath), { recursive: true });
  const catalog = new Catalog(catalogPath);
  try {
    const sump = catalog.getSump(sumpId);
    if (!sump) {
      throw new Error(`no sump ${sumpId} in catalog`);
    }
    return sump;
  } finally {
    catalog.close();
  }
}

export interface DownloadRecordingParams {
  sumpId: string;
  dataStreamId: string;
  dockerHost: string;
  start?: string;
  end?: string;
  projectPath?: string;
}

export interface DownloadTrackParams {
  sumpId: string;
  dataStreamId: string;
  dockerHost: string;
  containerId?: string;
  metric: string;
  start?: string;
  end?: string;
  projectPath?: string;
}

async function downloadAndRegister(
  catalogPath: string,
  fetchFn: typeof fetch,
  options: {
    sumpId: string;
    dataStreamId: string;
    exportPath: string;
    exportParams: Record<string, string | undefined>;
    fileExt: string;
    kind: "recording" | "track";
    projectPath?: string;
  },
): Promise<{ id: string; filePath: string }> {
  // Resolve + fetch first: cor-CORE.PROJECT-003's acceptance criterion
  // that a failed export registers nothing and adds no project
  // reference -- so no catalog/project write happens before this
  // succeeds.
  const sump = resolveSump(catalogPath, options.sumpId);
  const url = new URL(`http://${sump.host ?? "127.0.0.1"}:${sump.port}${options.exportPath}`);
  for (const [key, value] of Object.entries(options.exportParams)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetchFn(url, {
    headers: sump.authToken ? { "X-Correlator-Token": sump.authToken } : undefined,
  });
  if (!response.ok) {
    throw new Error(`GET ${options.exportPath} failed: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());

  const projectPath = options.projectPath ?? defaultProjectPath();
  const project = options.projectPath ? loadProject(options.projectPath) : ensureDefaultProject();

  const id = randomUUID();
  const filePath = join(dirname(projectPath), `${options.kind}s`, `${id}${options.fileExt}`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, bytes);

  const catalog = new Catalog(catalogPath);
  const now = new Date().toISOString();
  try {
    if (options.kind === "recording") {
      catalog.upsertRecording({
        id,
        dataStreamId: options.dataStreamId,
        sumpId: options.sumpId,
        filePath,
        catalogJson: "{}",
        createdAt: now,
      });
    } else {
      catalog.upsertTrack({
        id,
        recordingId: null,
        dataStreamId: options.dataStreamId,
        sumpId: options.sumpId,
        filePath,
        catalogJson: "{}",
        createdAt: now,
      });
    }
  } finally {
    catalog.close();
  }

  saveProject(projectPath, addReference(project, filePath));

  return { id, filePath };
}

export function registerIpcHandlers(
  electronApi: ElectronApi,
  catalogPath: string = defaultCatalogPath(),
  fetchFn: typeof fetch = fetch,
): void {
  electronApi.ipcMain.handle("list-sumps", async () => {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      return catalog.listSumps();
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("query-records", async (...args: unknown[]) => {
    const [, sumpId, dockerHost, params = {}] = args as [
      unknown,
      string,
      string,
      RecordsQueryParams,
    ];

    const sump = resolveSump(catalogPath, sumpId);
    const url = new URL(`http://${sump.host ?? "127.0.0.1"}:${sump.port}/records`);
    url.searchParams.set("docker_host", dockerHost);
    for (const [key, paramName] of Object.entries(RECORDS_PARAM_KEYS)) {
      const value = params[key as keyof RecordsQueryParams];
      if (value !== undefined) url.searchParams.set(paramName, String(value));
    }

    const response = await fetchFn(url, {
      headers: sump.authToken ? { "X-Correlator-Token": sump.authToken } : undefined,
    });
    if (!response.ok) {
      throw new Error(`GET /records failed: ${response.status}`);
    }
    return response.json();
  });

  electronApi.ipcMain.handle("download-recording", async (...args: unknown[]) => {
    const [, params] = args as [unknown, DownloadRecordingParams];
    return downloadAndRegister(catalogPath, fetchFn, {
      sumpId: params.sumpId,
      dataStreamId: params.dataStreamId,
      exportPath: "/recordings/export",
      exportParams: { docker_host: params.dockerHost, start: params.start, end: params.end },
      fileExt: ".recording",
      kind: "recording",
      projectPath: params.projectPath,
    });
  });

  electronApi.ipcMain.handle("download-track", async (...args: unknown[]) => {
    const [, params] = args as [unknown, DownloadTrackParams];
    return downloadAndRegister(catalogPath, fetchFn, {
      sumpId: params.sumpId,
      dataStreamId: params.dataStreamId,
      exportPath: "/tracks/export",
      exportParams: {
        docker_host: params.dockerHost,
        metric: params.metric,
        container_id: params.containerId,
        start: params.start,
        end: params.end,
      },
      fileExt: ".track",
      kind: "track",
      projectPath: params.projectPath,
    });
  });
}

export type OpenedFileKind = "track" | "recording" | "project" | null;

/** Classifies a file opened from the OS (double-click, second-instance
 * argv) by extension (cor-CORE.PROJECT-004) -- pure, so `main.cjs`'s
 * `open-file`/second-instance wiring can dispatch on this without
 * touching `electron` itself. */
export function classifyOpenedFile(path: string): OpenedFileKind {
  const lower = path.toLowerCase();
  if (lower.endsWith(".track")) return "track";
  if (lower.endsWith(".recording")) return "recording";
  if (lower.endsWith(".correlator")) return "project";
  return null;
}

export function registerAppLifecycle(electronApi: ElectronApi): void {
  electronApi.app.on("window-all-closed", () => {
    electronApi.app.quit();
  });
}
