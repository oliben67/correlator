// RM-000029: DetachPanelKind/DetachViewState are pure, portable types
// (string literals and primitives only) with no Node- or DOM-specific
// dependency, so they're imported directly from app/lib/detach.ts --
// unlike SumpSummary below, which deliberately duplicates app/lib/
// catalog.ts's SumpRow instead of importing it, since that one *does*
// depend on tsconfig-incompatible types across the renderer/lib split
// (DOM vs. Node lib).
import type { DetachPanelKind, DetachViewState } from "../../lib/detach.js";

// Mirrors the shape of app/lib/catalog.ts's SumpRow as it crosses the IPC
// boundary (a plain serialized object, not the same type instance) --
// deliberately not imported from app/lib/ directly, since renderer/src and
// lib/ type-check under different tsconfigs (DOM vs. Node lib).
export interface SumpSummary {
  id: string;
  name: string;
  connectionType: "local" | "ssh" | "external" | "logical";
  host: string | null;
  port: number | null;
  status: "provisioning" | "active" | "unreachable" | "retired";
  authToken: string | null;
  catalogJson: string;
  createdAt: string;
  lastSeenAt: string | null;
  parentSumpId: string | null;
  dockerHost: string | null;
}

export interface LogRecord {
  kind: "log";
  docker_host: string;
  container_name?: string;
  container_id?: string;
  ts: string;
  seq: number;
  stream?: "stdout" | "stderr";
  level?: string;
  message?: string;
  fields?: Record<string, unknown>;
  raw?: string;
}

export interface MetricRecord {
  kind: "metric";
  docker_host: string;
  container_name?: string;
  container_id?: string;
  ts: string;
  seq: number;
  metric_scope?: "container" | "system";
  cpu_pct?: number;
  mem_used_bytes?: number;
  mem_limit_bytes?: number;
  mem_pct?: number;
  net_rx_bytes?: number;
  net_tx_bytes?: number;
  blk_read_bytes?: number;
  blk_write_bytes?: number;
  pids?: number;
  system?: unknown;
  source?: string;
  raw?: unknown;
}

export type SumpRecord = LogRecord | MetricRecord;

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

export interface RecordsPage {
  records: SumpRecord[];
  next_log_cursor: string | null;
  next_metric_cursor: string | null;
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

export interface DownloadResult {
  id: string;
  filePath: string;
}

export type SystemKind = "host" | "container";

export interface ArchivedLogRow {
  tsMs: number;
  text: string;
}

export interface ArchivedRecording {
  t0: number;
  t1: number;
  created: string;
  sources: Record<string, ArchivedLogRow[]>;
  systemKinds: Record<string, SystemKind>;
}

export interface ArchivedTrack {
  t0: number;
  t1: number;
  created: string;
  seriesName: string;
  points: [number, number][];
  systemKind: SystemKind;
}

export interface DataSourcesResult {
  data_sources: string[];
}

export interface SetDataSourcePrivacyParams {
  sumpId: string;
  name: string;
  isPrivate: boolean;
}

export interface PrivacyResult {
  owner_user_id: string;
  is_private: boolean;
}

export interface PromoteDataStreamParams {
  parentSumpId: string;
  name: string;
  host: string;
  imageRef: string;
  port?: number;
}

export interface PromoteResult {
  container_name: string;
  host: string;
  port: number;
  reachable: boolean;
  childSumpId: string;
}

// cor-CORE.PROVISION-006: the "Add Sump" chooser's backing actions.
export interface ConnectExistingSumpParams {
  name: string;
  host: string;
  port: number;
  authToken?: string;
}

export interface InstallRemoteSumpParams {
  name: string;
  sshTarget: string;
  sshKey?: string;
  sshPort?: number;
  remotePort: number;
  imageRef: string;
}

// cor-CORE.PROVISION-007: the switcher UI's backing actions.
export interface SelectPrimarySumpParams {
  sumpId: string;
}

export interface RenameSumpParams {
  sumpId: string;
  name: string;
}

export interface UninstallSumpParams {
  sumpId: string;
}

export interface UpdateSumpConnectionParams {
  sumpId: string;
  host?: string | null;
  port?: number | null;
  authToken?: string | null;
}

export interface RecordingSegmentSummary {
  segmentNumber: number;
  startedAt: string;
  stoppedAt: string;
  recordingId?: string;
  filePath?: string;
}

export interface RecordingSessionSummary {
  id: string;
  sumpId: string;
  status: "idle" | "recording" | "paused" | "stopped";
  startedAt: string;
  stoppedAt: string | null;
  activeSegmentStartedAt: string | null;
  segments: RecordingSegmentSummary[];
  wasInterrupted: boolean;
  createdAt: string;
}

export interface EventRuleSummary {
  id: string;
  sumpId: string;
  name: string;
  conditionType: "metric" | "log";
  metricName: string | null;
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | null;
  threshold: number | null;
  pattern: string | null;
  action: "start_recording" | "stop_recording" | "notify";
  enabled: boolean;
  createdAt: string;
}

export interface CreateEventRuleParams {
  sumpId: string;
  name: string;
  conditionType: "metric" | "log";
  metricName?: string;
  operator?: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold?: number;
  pattern?: string;
  action: "start_recording" | "stop_recording" | "notify";
}

export interface RuleEvaluationSummary {
  ruleId: string;
  ruleName: string;
  action: string;
  triggered: boolean;
  matchingSamples: unknown[];
}

/** Mirrors app/lib/project-session.ts's ProjectSummary (cor-CORE.PROJECT-000007). */
export interface ProjectContextSummary {
  sumpId: string;
  dataStreamId: string;
}

export interface ProjectFolderSummary {
  name: string;
  items: string[];
  folders: ProjectFolderSummary[];
}

export interface ProjectSummary {
  path: string;
  name: string;
  isDefault: boolean;
  mode: "default" | "unbound" | "bound";
  context: ProjectContextSummary | null;
  references: string[];
  folders: ProjectFolderSummary[];
  /** cor-CORE.PROJECT-000008: per-reference view-state, keyed by path. */
  trackSettings: Record<string, TrackViewStateSummary>;
}

export interface TrackViewStateSummary {
  delayMs?: number;
  visible?: boolean;
}

export interface RecentProjectSummary {
  path: string;
  name: string;
  lastOpenedAt: string;
}

/** A main-process outcome to show as a status-bar notification. */
export interface MainNotification {
  message: string;
  severity: "info" | "error";
}

/** Mirrors app/lib/preferences.ts's AppPreferences (cor-CORE.SHELL-000008). */
export interface AppPreferencesSummary {
  defaultQueryLimit: number;
  autoRefreshIntervalSeconds: number;
  theme: "light" | "dark" | "system";
  logHighlightWindowSeconds: number;
  notificationClearSeconds: number;
  highlightColor: string;
  showStatusBar: boolean;
  nowLineColor: string;
  nowLineStyle: "dotted" | "dashed" | "solid";
  liveTrackColor: string;
  liveTrackEnabled: boolean;
  liveTrackOffsetSeconds: number;
  recenterResumeSeconds: number;
  recordingBandColor: string;
  recordingSprocketHoles: boolean;
}

export interface AppVersionInfo {
  version: string;
  node: string;
  electron: string | null;
  chrome: string | null;
}

// RM-000029: pop-out/detach support.
export interface OpenDetachedPanelResult {
  opened: boolean;
}

export interface DetachedPanelClosedPayload {
  kind: DetachPanelKind;
}

// The nav variant lets a detached sidebar drive the main window's active
// tab (and vice versa) -- Sidebar.tsx's NavView union, inlined rather
// than imported to avoid a renderer-component -> IPC-contract dependency.
export type SyncMessage =
  | { type: "view"; t0: number; t1: number }
  | { type: "cursor"; cursorT: number | null }
  // cor-CORE.CORRELATE-000009: live follow on/off.
  | { type: "live"; live: boolean }
  | { type: "nav"; view: "correlate" | "project" | "sumps" | "events" | "preferences" | "about" }
  // cor-CORE.CORRELATE-000007: container hide/order, and a new window asking for it.
  | { type: "series"; hidden: string[]; order: string[] }
  | { type: "series-request" };

export interface CorrelatorApi {
  listSumps: () => Promise<SumpSummary[]>;
  queryRecords: (sumpId: string, params?: RecordsQueryParams) => Promise<RecordsPage>;
  downloadRecording: (params: DownloadRecordingParams) => Promise<DownloadResult>;
  downloadTrack: (params: DownloadTrackParams) => Promise<DownloadResult>;
  readRecordingArchive: (filePath: string) => Promise<ArchivedRecording>;
  readTrackArchive: (filePath: string) => Promise<ArchivedTrack>;
  /** cor-CORE.EXPORT-000004: save dialog + write; null when cancelled. */
  saveExportFile: (params: {
    defaultName: string;
    content: string;
  }) => Promise<{ filePath: string } | null>;
  listDataSources: (sumpId: string) => Promise<DataSourcesResult>;
  setDataSourcePrivacy: (params: SetDataSourcePrivacyParams) => Promise<PrivacyResult>;
  promoteDataStream: (params: PromoteDataStreamParams) => Promise<PromoteResult>;
  detectDocker: () => Promise<boolean>;
  connectExistingSump: (params: ConnectExistingSumpParams) => Promise<SumpSummary>;
  installLocalSump: () => Promise<SumpSummary>;
  installRemoteSump: (params: InstallRemoteSumpParams) => Promise<SumpSummary>;
  getPrimarySumpId: () => Promise<string | null>;
  selectPrimarySump: (params: SelectPrimarySumpParams) => Promise<void>;
  renameSump: (params: RenameSumpParams) => Promise<SumpSummary>;
  updateSumpConnection: (params: UpdateSumpConnectionParams) => Promise<SumpSummary>;
  uninstallSump: (params: UninstallSumpParams) => Promise<void>;
  // cor-CORE.ARCHIVE-000003: live recording session operations
  startRecordingSession: (params: { sumpId: string }) => Promise<RecordingSessionSummary>;
  pauseRecordingSession: (params: { sessionId: string }) => Promise<RecordingSessionSummary | null>;
  resumeRecordingSession: (params: {
    sessionId: string;
    /** cor-CORE.ARCHIVE-000003 §2: default "now". */
    from?: "now" | "interruption";
  }) => Promise<RecordingSessionSummary | null>;
  stopRecordingSession: (params: { sessionId: string }) => Promise<RecordingSessionSummary | null>;
  getRecordingSession: (params: { sumpId: string }) => Promise<RecordingSessionSummary | null>;
  getInterruptedSessions: () => Promise<RecordingSessionSummary[]>;
  dismissInterruptedSession: (params: { sessionId: string }) => Promise<void>;
  // cor-CORE.EVENT-000001/-000002: event trigger operations
  listEventRules: (params: { sumpId: string }) => Promise<EventRuleSummary[]>;
  createEventRule: (params: CreateEventRuleParams) => Promise<EventRuleSummary>;
  toggleEventRule: (params: { ruleId: string; enabled: boolean }) => Promise<EventRuleSummary>;
  deleteEventRule: (params: { ruleId: string }) => Promise<void>;
  evaluateEventRules: (params: {
    sumpId: string;
    samples: unknown[];
  }) => Promise<RuleEvaluationSummary[]>;
  // cor-CORE.SHELL-000005: app preferences operations
  getAppVersion: () => Promise<AppVersionInfo>;
  getPreferences: () => Promise<AppPreferencesSummary>;
  setPreferences: (updates: Partial<AppPreferencesSummary>) => Promise<AppPreferencesSummary>;
  // RM-000029: pop-out/detach support.
  openDetachedPanel: (
    kind: DetachPanelKind,
    state: DetachViewState,
  ) => Promise<OpenDetachedPanelResult>;
  onDetachedPanelClosed: (callback: (payload: DetachedPanelClosedPayload) => void) => () => void;
  broadcastSync: (message: SyncMessage) => void;
  onSync: (callback: (message: SyncMessage) => void) => () => void;
  // cor-CORE.PROJECT-000007: project browser.
  getCurrentProject: () => Promise<ProjectSummary>;
  listRecentProjects: () => Promise<RecentProjectSummary[]>;
  /** Without a path, main shows a native dialog. */
  newProject: (path?: string) => Promise<ProjectSummary>;
  openProject: (path?: string) => Promise<ProjectSummary>;
  saveProject: () => Promise<ProjectSummary>;
  saveProjectAs: () => Promise<ProjectSummary>;
  closeProject: () => Promise<ProjectSummary>;
  bindProjectContext: (context: ProjectContextSummary) => Promise<ProjectSummary>;
  forgetRecentProject: (path: string) => Promise<RecentProjectSummary[]>;
  setTrackViewState: (params: { path: string } & TrackViewStateSummary) => Promise<ProjectSummary>;
  clearRecentProjects: () => Promise<RecentProjectSummary[]>;
  /** cor-CORE.SHELL-000009: resets app-local UI state; returns the default
   * preferences. The caller reloads the window. */
  hardReset: () => Promise<AppPreferencesSummary>;
  onProjectChanged: (callback: () => void) => () => void;
  onMainNotification: (callback: (notice: MainNotification) => void) => () => void;
}

declare global {
  interface Window {
    correlator: CorrelatorApi;
  }
}
