/**
 * The actual logic behind cor-CORE.SHELL-001/-002 -- window creation and
 * IPC handler registration -- factored out of main.cjs so it's plain,
 * testable ESM TypeScript with zero direct dependency on the `electron`
 * package (it only ever touches whatever `electronApi` its caller passes
 * in). main.cjs itself stays a thin, essentially-untested bootstrap that
 * `require("electron")`s the real thing and calls into here, the same
 * split cttc's own main.js/lib/* boundary already draws.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRecordingArchive, readTrackArchive } from "./lib/archive-reader.ts";
import { getOrCreateToken, getOrCreateUserId } from "./lib/auth-token.ts";
import {
  Catalog,
  type EventAction,
  type EventConditionType,
  type EventOperator,
  type EventRuleRow,
  type RecordingSessionRow,
  type SumpRow,
} from "./lib/catalog.ts";
import {
  buildDetachSearch,
  type DetachPanelKind,
  DetachRegistry,
  type DetachViewState,
  detachWindowSpec,
} from "./lib/detach.ts";
import { evaluateEventRules, type TelemetrySample } from "./lib/events.ts";
import { transition } from "./lib/lifecycle.ts";
import { installLocalSump, LOCAL_SUMP_ID, resolveServerResourcesDir } from "./lib/local-sump.ts";
import { type AppPreferences, getPreferences, savePreferences } from "./lib/preferences.ts";
import {
  addReference,
  bindLiveContext,
  canAddReferenceToProject,
  defaultProjectPath,
  ensureDefaultProject,
  loadProject,
  saveProject,
} from "./lib/project.ts";
import {
  connectExistingSump,
  detectLocalDocker,
  provisionRemote,
  type RemoteProvisionParams,
  type SpawnFn,
  uninstallSump,
} from "./lib/provision.ts";
import {
  coerceInterruptedSessions,
  type ExportSegmentFn,
  pauseRecordingSession,
  resumeRecordingSession,
  startRecordingSession,
  stopRecordingSession,
} from "./lib/recording-session.ts";

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

export interface FakeableWebContents {
  id: number;
  send: (channel: string, ...args: unknown[]) => void;
}

export interface FakeableBrowserWindow {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  once: (event: string, cb: (...args: unknown[]) => void) => void;
  show: () => void;
  loadFile: (path: string, options?: Record<string, unknown>) => Promise<void>;
  webContents: FakeableWebContents;
}

export interface ElectronApi {
  BrowserWindow: {
    new (options: Record<string, unknown>): FakeableBrowserWindow;
    /** RM-000029: the sync-broadcast relay fans a message out to every
     * open window except the sender -- real Electron's own static
     * method, duck-typed here the same way the rest of this interface
     * mirrors `electron`'s real shape. */
    getAllWindows: () => FakeableBrowserWindow[];
  };
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => void;
    /** RM-000029: sync-broadcast is fire-and-forget pub/sub, not a
     * request/response -- `ipcMain.on`, not `.handle`. */
    on: (
      channel: string,
      handler: (event: { sender: FakeableWebContents }, ...args: unknown[]) => void,
    ) => void;
  };
  app: { on: (event: string, cb: (...args: unknown[]) => void) => void; quit: () => void };
  /** cor-CORE.UI-000001: forces Chromium's own `prefers-color-scheme`
   * reporting to match the user's explicit theme choice (`"system"`
   * lets the OS decide). Optional so every existing fake `electronApi`
   * in tests keeps compiling unchanged; real Electron always has this. */
  nativeTheme?: { themeSource: "system" | "light" | "dark" };
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

/** `X-Correlator-Token` (cor-CORE.PROVISION-003) + `X-Correlator-User-Id`
 * (cor-CORE.FEDERATION-001) for a request to `sump` -- the one place
 * every outgoing fetch builds its headers, replacing what were two
 * separately-duplicated, token-only header objects. */
function sumpHeaders(sump: SumpRow, userId: string): Record<string, string> | undefined {
  const headers: Record<string, string> = { "X-Correlator-User-Id": userId };
  if (sump.authToken) headers["X-Correlator-Token"] = sump.authToken;
  return headers;
}

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

/** cor-CORE.PROVISION-001: marks `sumpId` as last seen now -- called after
 * any authenticated request through the IPC bridge succeeds. */
function touchSump(catalogPath: string, sumpId: string): void {
  const catalog = new Catalog(catalogPath);
  try {
    catalog.touchSump(sumpId, new Date().toISOString());
  } finally {
    catalog.close();
  }
}

/** cor-CORE.PROVISION-008: for every active root Sump, best-effort
 * discovers the docker hosts it knows about and registers one
 * host-scoped logical Sump per host, sharing the root's own connection.
 * A failed discovery for one root Sump never blocks the rest -- this
 * runs on every `list-sumps` call, not as a one-time action. */
async function syncLogicalSumps(
  catalog: Catalog,
  fetchFn: typeof fetch,
  userId: string,
): Promise<void> {
  const roots = catalog
    .listSumps()
    .filter((sump) => sump.connectionType !== "logical" && sump.status === "active");

  for (const root of roots) {
    try {
      const url = new URL(`http://${root.host ?? "127.0.0.1"}:${root.port}/data-sources`);
      const response = await fetchFn(url, { headers: sumpHeaders(root, userId) });
      if (!response.ok) continue;
      const result = (await response.json()) as { data_sources?: string[] };
      const now = new Date().toISOString();
      for (const dockerHost of result.data_sources ?? []) {
        catalog.syncLogicalSump({
          id: `${root.id}:${dockerHost}`,
          parentSumpId: root.id,
          dockerHost,
          name: dockerHost,
          host: root.host,
          port: root.port,
          authToken: root.authToken,
          createdAt: now,
        });
      }
    } catch {
      // Best-effort: an unreachable root Sump just keeps whatever
      // logical children it already had, if any.
    }
  }
}

export interface DownloadRecordingParams {
  sumpId: string;
  dataStreamId: string;
  start?: string;
  end?: string;
  projectPath?: string;
}

export interface DownloadTrackParams {
  sumpId: string;
  dataStreamId: string;
  containerId?: string;
  metric: string;
  start?: string;
  end?: string;
  projectPath?: string;
}

async function downloadAndRegister(
  catalogPath: string,
  fetchFn: typeof fetch,
  userId: string,
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
  if (!sump.dockerHost) {
    throw new Error(`sump ${options.sumpId} has no docker_host scope -- target a host-scoped sump`);
  }
  const url = new URL(`http://${sump.host ?? "127.0.0.1"}:${sump.port}${options.exportPath}`);
  url.searchParams.set("docker_host", sump.dockerHost);
  for (const [key, value] of Object.entries(options.exportParams)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetchFn(url, { headers: sumpHeaders(sump, userId) });
  if (!response.ok) {
    throw new Error(`GET ${options.exportPath} failed: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());

  const projectPath = options.projectPath ?? defaultProjectPath();
  let project = options.projectPath ? loadProject(options.projectPath) : ensureDefaultProject();

  // Live-project isolation (cor-CORE.PROJECT-005) applies only to an
  // explicitly-named project -- never the default project, which must
  // keep accepting downloads from any Sump regardless of what it
  // already holds.
  if (options.projectPath) {
    const context = { sumpId: options.sumpId, dataStreamId: options.dataStreamId };
    if (!canAddReferenceToProject(project, context)) {
      throw new Error(
        `project is bound to a different live context (sump ${project.context?.sumpId}, ` +
          `data stream ${project.context?.dataStreamId}) -- cannot add a reference from ` +
          `sump ${context.sumpId}, data stream ${context.dataStreamId}`,
      );
    }
    project = bindLiveContext(project, context);
  }

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
      // A track is a single self-contained series -- its `system_kind`
      // (unlike a recording's, which can differ per log source) is one
      // scalar fact about the whole file, read straight out of the
      // archive we just wrote and stored on the catalog row so the
      // project view can separate host/container tracks without
      // re-parsing the archive on every load.
      const systemKind = readTrackArchive(bytes).systemKind;
      catalog.upsertTrack({
        id,
        recordingId: null,
        dataStreamId: options.dataStreamId,
        sumpId: options.sumpId,
        filePath,
        catalogJson: JSON.stringify({ systemKind }),
        createdAt: now,
      });
    }
    catalog.touchSump(options.sumpId, now);
  } finally {
    catalog.close();
  }

  saveProject(projectPath, addReference(project, filePath));

  return { id, filePath };
}

/** The `ExportSegmentFn` every recording-session close point (pause,
 * stop, an event rule's automated stop, and boot-time crash recovery)
 * shares: export the segment as a `.recording` into the sump's own
 * default project, via the same `downloadAndRegister` path a manual
 * download uses. No `projectPath` is passed -- a live session has no
 * notion of an explicitly-open project to target. */
function makeRecordingExportSegmentFn(
  catalogPath: string,
  fetchFn: typeof fetch,
  userId: string,
): ExportSegmentFn {
  return async (sumpId, startIso, endIso) => {
    return downloadAndRegister(catalogPath, fetchFn, userId, {
      sumpId,
      dataStreamId: sumpId,
      exportPath: "/recordings/export",
      exportParams: { start: startIso, end: endIso },
      fileExt: ".recording",
      kind: "recording",
    });
  };
}

function formatSessionSummary(session: RecordingSessionRow) {
  return {
    id: session.id,
    sumpId: session.sumpId,
    status: session.status,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    activeSegmentStartedAt: session.activeSegmentStartedAt,
    segments: JSON.parse(session.segmentsJson ?? "[]"),
    wasInterrupted: session.wasInterrupted,
    createdAt: session.createdAt,
  };
}

export interface ProvisionIpcOptions {
  isPackaged?: boolean;
  resourcesPath?: string;
  spawnFn?: SpawnFn;
  /** RM-000029: a detached panel window loads this same `index.html`
   * (with a `detach=<kind>` query param) via this same preload -- both
   * are only known in main.cjs's bootstrap, same as `createWindow`'s
   * own `CreateWindowOptions`, so they're threaded through here too. */
  preloadPath?: string;
  indexHtmlPath?: string;
}

export async function registerIpcHandlers(
  electronApi: ElectronApi,
  catalogPath: string = defaultCatalogPath(),
  fetchFn: typeof fetch = fetch,
  userId: string = getOrCreateUserId(),
  provisionOptions: ProvisionIpcOptions = {},
): Promise<void> {
  const {
    isPackaged = false,
    resourcesPath,
    spawnFn = spawn,
    preloadPath,
    indexHtmlPath,
  } = provisionOptions;
  // RM-000029: scoped to this call, not module-level -- real Electron
  // only ever calls registerIpcHandlers once per app lifetime, so this
  // changes nothing in production, but it means each test's fresh
  // registerIpcHandlers() call also gets a fresh, independent registry
  // instead of leaking open-panel state across tests.
  const detachedPanels = new DetachRegistry<FakeableBrowserWindow>();

  try {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const bootCatalog = new Catalog(catalogPath);
    try {
      await coerceInterruptedSessions(
        bootCatalog,
        makeRecordingExportSegmentFn(catalogPath, fetchFn, userId),
      );
      // cor-CORE.UI-000001: apply the stored theme preference before the
      // window paints, so the very first frame already matches it
      // instead of flashing the OS-default theme first.
      if (electronApi.nativeTheme) {
        electronApi.nativeTheme.themeSource = getPreferences(bootCatalog).theme;
      }
    } finally {
      bootCatalog.close();
    }
  } catch {
    // Best-effort boot coercion (e.g. dummy test catalog path)
  }

  electronApi.ipcMain.handle("list-sumps", async () => {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      await syncLogicalSumps(catalog, fetchFn, userId);
      return catalog.listSumps();
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("query-records", async (...args: unknown[]) => {
    const [, sumpId, params = {}] = args as [unknown, string, RecordsQueryParams];

    const sump = resolveSump(catalogPath, sumpId);
    if (!sump.dockerHost) {
      throw new Error(`sump ${sumpId} has no docker_host scope -- target a host-scoped sump`);
    }
    const url = new URL(`http://${sump.host ?? "127.0.0.1"}:${sump.port}/records`);
    url.searchParams.set("docker_host", sump.dockerHost);
    for (const [key, paramName] of Object.entries(RECORDS_PARAM_KEYS)) {
      const value = params[key as keyof RecordsQueryParams];
      if (value !== undefined) url.searchParams.set(paramName, String(value));
    }

    const response = await fetchFn(url, { headers: sumpHeaders(sump, userId) });
    if (!response.ok) {
      throw new Error(`GET /records failed: ${response.status}`);
    }
    touchSump(catalogPath, sumpId);
    return response.json();
  });

  electronApi.ipcMain.handle("download-recording", async (...args: unknown[]) => {
    const [, params] = args as [unknown, DownloadRecordingParams];
    return downloadAndRegister(catalogPath, fetchFn, userId, {
      sumpId: params.sumpId,
      dataStreamId: params.dataStreamId,
      exportPath: "/recordings/export",
      exportParams: { start: params.start, end: params.end },
      fileExt: ".recording",
      kind: "recording",
      projectPath: params.projectPath,
    });
  });

  electronApi.ipcMain.handle("download-track", async (...args: unknown[]) => {
    const [, params] = args as [unknown, DownloadTrackParams];
    return downloadAndRegister(catalogPath, fetchFn, userId, {
      sumpId: params.sumpId,
      dataStreamId: params.dataStreamId,
      exportPath: "/tracks/export",
      exportParams: {
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

  electronApi.ipcMain.handle("read-recording-archive", async (...args: unknown[]) => {
    const [, filePath] = args as [unknown, string];
    return readRecordingArchive(new Uint8Array(readFileSync(filePath)));
  });

  electronApi.ipcMain.handle("read-track-archive", async (...args: unknown[]) => {
    const [, filePath] = args as [unknown, string];
    return readTrackArchive(new Uint8Array(readFileSync(filePath)));
  });

  electronApi.ipcMain.handle("list-data-sources", async (...args: unknown[]) => {
    const [, sumpId] = args as [unknown, string];
    const sump = resolveSump(catalogPath, sumpId);
    const url = new URL(`http://${sump.host ?? "127.0.0.1"}:${sump.port}/data-sources`);
    const response = await fetchFn(url, { headers: sumpHeaders(sump, userId) });
    if (!response.ok) {
      throw new Error(`GET /data-sources failed: ${response.status}`);
    }
    touchSump(catalogPath, sumpId);
    return response.json();
  });

  electronApi.ipcMain.handle("set-data-source-privacy", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string; name: string; isPrivate: boolean }];
    const sump = resolveSump(catalogPath, params.sumpId);
    const url = new URL(
      `http://${sump.host ?? "127.0.0.1"}:${sump.port}/data-sources/${params.name}/privacy`,
    );
    const response = await fetchFn(url, {
      method: "PUT",
      headers: { ...sumpHeaders(sump, userId), "Content-Type": "application/json" },
      body: JSON.stringify({ is_private: params.isPrivate }),
    });
    if (!response.ok) {
      throw new Error(`PUT /data-sources/${params.name}/privacy failed: ${response.status}`);
    }
    touchSump(catalogPath, params.sumpId);
    return response.json();
  });

  electronApi.ipcMain.handle("promote-data-stream", async (...args: unknown[]) => {
    const [, params] = args as [
      unknown,
      { parentSumpId: string; name: string; host: string; imageRef: string; port?: number },
    ];
    const parent = resolveSump(catalogPath, params.parentSumpId);
    const url = new URL(`http://${parent.host ?? "127.0.0.1"}:${parent.port}/promote`);
    const response = await fetchFn(url, {
      method: "POST",
      headers: { ...sumpHeaders(parent, userId), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: params.name,
        host: params.host,
        image_ref: params.imageRef,
        port: params.port,
      }),
    });
    if (!response.ok) {
      throw new Error(`POST /promote failed: ${response.status}`);
    }
    const result = (await response.json()) as { host: string; port: number };

    // Only register on success -- a failed promotion leaves nothing in
    // the catalog, matching cor-CORE.PROJECT-003's own "failed export
    // registers nothing" posture.
    const catalog = new Catalog(catalogPath);
    const now = new Date().toISOString();
    const childSumpId = randomUUID();
    try {
      // secondary_sump_links.promoted_from_data_stream_id has a real FK
      // onto data_streams(id) -- the local catalog has no picker UI yet
      // to have already created this row, so this handler creates the
      // minimal one itself (id != the server's own data-source name;
      // sourceRef carries that instead, same pattern list-data-sources'
      // results would feed into once a picker exists).
      const dataStreamId = randomUUID();
      catalog.upsertDataStream({
        id: dataStreamId,
        sumpId: params.parentSumpId,
        kind: "promoted",
        sourceRef: params.name,
        ownerUserId: null,
        isPrivate: false,
        catalogJson: "{}",
        createdAt: now,
      });
      catalog.upsertSump({
        id: childSumpId,
        name: params.name,
        connectionType: "ssh",
        host: result.host,
        port: result.port,
        // Always "active" once the parent's docker run itself succeeded
        // (this handler wouldn't reach here otherwise) -- an
        // unreachable-yet health check is a warning, not a failure,
        // mirroring provisionRemote's own posture (ongoing traffic is
        // plain HTTP, never tunneled through the promotion SSH hop).
        status: transition("provisioning", "provision_succeeded"),
        authToken: null,
        catalogJson: "{}",
        createdAt: now,
        lastSeenAt: null,
      });
      catalog.touchSump(params.parentSumpId, now);
      catalog.linkSecondarySump({
        childSumpId,
        parentSumpId: params.parentSumpId,
        promotedFromDataStreamId: dataStreamId,
        createdAt: now,
      });
    } finally {
      catalog.close();
    }

    return { ...result, childSumpId };
  });

  // cor-CORE.PROVISION-006: the "Add Sump" chooser's three backing actions,
  // plus the Docker-availability check it renders around. Each is a
  // direct, awaited, user-triggered call -- no fire-and-forget, no push
  // notification back to the renderer needed (unlike the retired
  // cor-CORE.PROVISION-005's `sumps-changed`).
  electronApi.ipcMain.handle("detect-docker", async () => detectLocalDocker(spawnFn));

  electronApi.ipcMain.handle("connect-existing-sump", async (...args: unknown[]) => {
    const [, params] = args as [
      unknown,
      { name: string; host: string; port: number; authToken?: string },
    ];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const id = randomUUID();
      await connectExistingSump(
        catalog,
        {
          id,
          name: params.name,
          host: params.host,
          port: params.port,
          authToken: params.authToken ?? null,
          now: new Date().toISOString(),
        },
        { fetchFn },
      );
      return catalog.getSump(id);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("install-local-sump", async () => {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      await installLocalSump(catalog, {
        isPackaged,
        resourcesPath,
        spawnFn,
        onLog: (line) => console.error(`[install-local] ${line}`),
      });
      return catalog.getSump(LOCAL_SUMP_ID);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("install-remote-sump", async (...args: unknown[]) => {
    const [, params] = args as [
      unknown,
      {
        name: string;
        sshTarget: string;
        sshKey?: string;
        sshPort?: number;
        remotePort: number;
        imageRef: string;
      },
    ];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const id = randomUUID();
      const composeFile = join(
        resolveServerResourcesDir(isPackaged, resourcesPath),
        "docker-compose.yml",
      );
      const apiToken = getOrCreateToken(id, catalog);
      const remoteParams: RemoteProvisionParams = {
        id,
        name: params.name,
        target: {
          sshTarget: params.sshTarget,
          sshKey: params.sshKey ?? null,
          sshPort: params.sshPort,
        },
        remotePort: params.remotePort,
        source: { type: "registry", ref: params.imageRef, composeFile },
        apiToken,
        now: new Date().toISOString(),
      };
      await provisionRemote(catalog, remoteParams, {
        spawnFn,
        onLog: (line) => console.error(`[install-remote] ${line}`),
      });
      return catalog.getSump(id);
    } finally {
      catalog.close();
    }
  });

  // cor-CORE.PROVISION-007: the switcher UI's four backing actions --
  // which Sump is primary, rename, and uninstall/disconnect (dispatched
  // per connectionType by uninstallSump). Reuses the same
  // mkdirSync+Catalog+try/finally pattern as every other handler above.
  electronApi.ipcMain.handle("get-primary-sump-id", async () => {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      return catalog.getPrimarySumpId();
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("select-primary-sump", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const sump = catalog.getSump(params.sumpId);
      if (!sump) throw new Error(`no sump ${params.sumpId} in catalog`);
      if (sump.status === "retired") throw new Error(`sump ${params.sumpId} is retired`);
      catalog.setPrimarySumpId(params.sumpId);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("rename-sump", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string; name: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      catalog.renameSump(params.sumpId, params.name);
      return catalog.getSump(params.sumpId);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("update-sump-connection", async (...args: unknown[]) => {
    const [, params] = args as [
      unknown,
      { sumpId: string; host?: string | null; port?: number | null; authToken?: string | null },
    ];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      catalog.updateSumpConnection(params.sumpId, {
        host: params.host,
        port: params.port,
        authToken: params.authToken,
      });
      return catalog.getSump(params.sumpId);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("uninstall-sump", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      await uninstallSump(catalog, params.sumpId, {
        spawnFn,
        onLog: (line) => console.error(`[uninstall] ${line}`),
      });
    } finally {
      catalog.close();
    }
  });

  // cor-CORE.ARCHIVE-000003: live recording session IPC handlers.
  electronApi.ipcMain.handle("start-recording-session", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const session = startRecordingSession(catalog, { sumpId: params.sumpId });
      return formatSessionSummary(session);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("pause-recording-session", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sessionId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const session = await pauseRecordingSession(catalog, {
        sessionId: params.sessionId,
        exportSegmentFn: makeRecordingExportSegmentFn(catalogPath, fetchFn, userId),
      });
      return session ? formatSessionSummary(session) : null;
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("resume-recording-session", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sessionId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const session = resumeRecordingSession(catalog, { sessionId: params.sessionId });
      return session ? formatSessionSummary(session) : null;
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("stop-recording-session", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sessionId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const session = await stopRecordingSession(catalog, {
        sessionId: params.sessionId,
        exportSegmentFn: makeRecordingExportSegmentFn(catalogPath, fetchFn, userId),
      });
      return session ? formatSessionSummary(session) : null;
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("get-recording-session", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const session = catalog.getActiveRecordingSessionForSump(params.sumpId);
      return session ? formatSessionSummary(session) : null;
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("get-interrupted-sessions", async () => {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const sessions = catalog.getInterruptedSessions();
      return sessions.map(formatSessionSummary);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("dismiss-interrupted-session", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sessionId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      catalog.clearInterruptedFlag(params.sessionId);
    } finally {
      catalog.close();
    }
  });

  // cor-CORE.EVENT-000001/-000002: event triggers & evaluation IPC handlers.
  electronApi.ipcMain.handle("list-event-rules", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      return catalog.listEventRulesForSump(params.sumpId);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("create-event-rule", async (...args: unknown[]) => {
    const [, params] = args as [
      unknown,
      {
        sumpId: string;
        name: string;
        conditionType: EventConditionType;
        metricName?: string;
        operator?: EventOperator;
        threshold?: number;
        pattern?: string;
        action: EventAction;
      },
    ];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    const id = `ev_${randomUUID()}`;
    const rule: EventRuleRow = {
      id,
      sumpId: params.sumpId,
      name: params.name,
      conditionType: params.conditionType,
      metricName: params.metricName ?? null,
      operator: params.operator ?? null,
      threshold: params.threshold ?? null,
      pattern: params.pattern ?? null,
      action: params.action,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    try {
      catalog.upsertEventRule(rule);
      return catalog.getEventRule(id);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("toggle-event-rule", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { ruleId: string; enabled: boolean }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      catalog.toggleEventRule(params.ruleId, params.enabled);
      return catalog.getEventRule(params.ruleId);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("delete-event-rule", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { ruleId: string }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      catalog.deleteEventRule(params.ruleId);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("evaluate-event-rules", async (...args: unknown[]) => {
    const [, params] = args as [unknown, { sumpId: string; samples: TelemetrySample[] }];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const rules = catalog.listEventRulesForSump(params.sumpId);
      const results = evaluateEventRules(rules, params.samples);

      // Perform automated actions (start/stop recording sessions)
      for (const res of results) {
        if (res.triggered) {
          if (res.action === "start_recording") {
            startRecordingSession(catalog, { sumpId: params.sumpId });
          } else if (res.action === "stop_recording") {
            const active = catalog.getActiveRecordingSessionForSump(params.sumpId);
            if (active) {
              await stopRecordingSession(catalog, {
                sessionId: active.id,
                exportSegmentFn: makeRecordingExportSegmentFn(catalogPath, fetchFn, userId),
              });
            }
          }
        }
      }

      return results;
    } finally {
      catalog.close();
    }
  });

  // RM-000030: the real app version + runtime metadata for the About
  // dialog -- previously a hardcoded "0.1.0" literal in the renderer,
  // never actually read from package.json.
  electronApi.ipcMain.handle("get-app-version", async () => {
    const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "package.json");
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };
    return {
      version: pkg.version,
      node: process.versions.node,
      electron: process.versions.electron ?? null,
      chrome: process.versions.chrome ?? null,
    };
  });

  // cor-CORE.SHELL-000005: preferences management IPC.
  electronApi.ipcMain.handle("get-preferences", async () => {
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      return getPreferences(catalog);
    } finally {
      catalog.close();
    }
  });

  electronApi.ipcMain.handle("set-preferences", async (...args: unknown[]) => {
    const [, updates] = args as [unknown, Partial<AppPreferences>];
    mkdirSync(dirname(catalogPath), { recursive: true });
    const catalog = new Catalog(catalogPath);
    try {
      const saved = savePreferences(catalog, updates);
      // cor-CORE.UI-000001: a live theme change takes effect immediately,
      // not just on next launch.
      if (updates.theme !== undefined && electronApi.nativeTheme) {
        electronApi.nativeTheme.themeSource = saved.theme;
      }
      return saved;
    } finally {
      catalog.close();
    }
  });

  // RM-000029: pop-out/detach support -- ported from cttc's `popout`
  // handler (same index.html, a `detach=<kind>` query param, no
  // separate HTML entry point) plus its generic sync-broadcast relay
  // (main.js:922-970). At most one open window per panel kind
  // (`detachedPanels`); reopening an already-open kind just refocuses it.
  electronApi.ipcMain.handle("open-detached-panel", async (...args: unknown[]) => {
    const [, kind, state = {}] = args as [unknown, DetachPanelKind, DetachViewState];
    const existing = detachedPanels.get(kind);
    if (existing) {
      existing.show();
      return { opened: false };
    }
    if (!preloadPath || !indexHtmlPath) {
      throw new Error("open-detached-panel requires preloadPath/indexHtmlPath");
    }
    const spec = detachWindowSpec(kind);
    const win = new electronApi.BrowserWindow({
      width: spec.width,
      height: spec.height,
      alwaysOnTop: spec.alwaysOnTop,
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.once("ready-to-show", () => win.show());
    win.on("closed", () => {
      detachedPanels.delete(kind);
      // No explicit re-dock action -- the docked panel in the main
      // window always reappears when its detached window closes, by
      // any means (OS close, Cmd+W, crash), same as cttc's own design.
      mainWindow?.webContents.send("detached-panel-closed", { kind });
    });
    detachedPanels.set(kind, win);
    await win.loadFile(indexHtmlPath, { search: buildDetachSearch(kind, state) });
    return { opened: true };
  });

  // Fire-and-forget pub/sub, not request/response -- every open window
  // (main + every detached panel) both emits its own view/cursor
  // changes on this channel and listens for every other window's.
  electronApi.ipcMain.on("sync-broadcast", (event, ...rest: unknown[]) => {
    const [msg] = rest;
    for (const win of electronApi.BrowserWindow.getAllWindows()) {
      if (win.webContents.id !== event.sender.id) {
        win.webContents.send("sync-broadcast", msg);
      }
    }
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
