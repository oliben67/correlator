/**
 * The local `.correlator/` instance catalog (cor-CORE.PROVISION-001).
 *
 * JSON documents, SQLite-backed via Node's built-in `node:sqlite` — no new
 * npm dependency (env-DEPS-002). Each table's `catalog_json` column holds
 * the full, authoritative JSON document; the remaining columns are a
 * read-side projection for indexed lookups only. Schema per
 * docs/roadmap/cttc-to-correlator-port.md §5.2, refined during Phase 2
 * with a `status`/`auth_token` column on `sumps` (the sketch there is
 * explicitly "subject to refinement in Phase 2").
 */

import { DatabaseSync } from "node:sqlite";
import type { SumpState } from "./lifecycle.ts";

export interface SumpRow {
  id: string;
  name: string;
  connectionType: "local" | "ssh" | "external" | "logical";
  host: string | null;
  port: number | null;
  status: SumpState;
  authToken: string | null;
  catalogJson: string;
  createdAt: string;
  lastSeenAt: string | null;
  /** cor-CORE.PROVISION-008: the root Sump this row was discovered under,
   * or `null` for a root Sump itself. */
  parentSumpId: string | null;
  /** cor-CORE.PROVISION-008: the docker_host this row is scoped to, or
   * `null` for a root Sump with no fixed scope. */
  dockerHost: string | null;
}

/** `upsertSump`'s input -- `parentSumpId`/`dockerHost` are optional here
 * (defaulted to `null`) so every pre-existing call site constructing a
 * plain root-Sump row keeps compiling unchanged; `SumpRow` itself (the
 * read-back shape) always carries them concretely. */
export type UpsertSumpInput = Omit<SumpRow, "parentSumpId" | "dockerHost"> & {
  parentSumpId?: string | null;
  dockerHost?: string | null;
};

export interface DataStreamRow {
  id: string;
  sumpId: string;
  kind: string;
  sourceRef: string;
  ownerUserId: string | null;
  isPrivate: boolean;
  catalogJson: string;
  createdAt: string;
}

export interface SecondarySumpLinkRow {
  childSumpId: string;
  parentSumpId: string;
  promotedFromDataStreamId: string;
  createdAt: string;
}

export interface RecordingRow {
  id: string;
  dataStreamId: string;
  sumpId: string;
  filePath: string;
  catalogJson: string;
  createdAt: string;
}

export interface TrackRow {
  id: string;
  recordingId: string | null;
  dataStreamId: string;
  sumpId: string;
  filePath: string;
  catalogJson: string;
  createdAt: string;
}

export type EventConditionType = "metric" | "log";
export type EventOperator = "gt" | "lt" | "eq" | "gte" | "lte";
export type EventAction = "start_recording" | "stop_recording" | "notify";

export interface EventRuleRow {
  id: string;
  sumpId: string;
  name: string;
  conditionType: EventConditionType;
  metricName: string | null;
  operator: EventOperator | null;
  threshold: number | null;
  pattern: string | null;
  action: EventAction;
  enabled: boolean;
  createdAt: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sumps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  host TEXT,
  port INTEGER,
  status TEXT NOT NULL DEFAULT 'provisioning',
  auth_token TEXT,
  catalog_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  parent_sump_id TEXT REFERENCES sumps(id),
  docker_host TEXT
);

CREATE TABLE IF NOT EXISTS data_streams (
  id TEXT PRIMARY KEY,
  sump_id TEXT NOT NULL REFERENCES sumps(id),
  kind TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  owner_user_id TEXT,
  is_private INTEGER NOT NULL DEFAULT 0,
  catalog_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_data_streams_sump_id ON data_streams(sump_id);

CREATE TABLE IF NOT EXISTS secondary_sump_links (
  child_sump_id TEXT NOT NULL REFERENCES sumps(id),
  parent_sump_id TEXT NOT NULL REFERENCES sumps(id),
  promoted_from_data_stream_id TEXT NOT NULL REFERENCES data_streams(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (child_sump_id, parent_sump_id)
);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  data_stream_id TEXT NOT NULL REFERENCES data_streams(id),
  sump_id TEXT NOT NULL REFERENCES sumps(id),
  file_path TEXT NOT NULL,
  catalog_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recordings_data_stream_sump ON recordings(data_stream_id, sump_id);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  recording_id TEXT REFERENCES recordings(id),
  data_stream_id TEXT NOT NULL REFERENCES data_streams(id),
  sump_id TEXT NOT NULL REFERENCES sumps(id),
  file_path TEXT NOT NULL,
  catalog_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracks_data_stream_sump ON tracks(data_stream_id, sump_id);
CREATE INDEX IF NOT EXISTS idx_tracks_recording_id ON tracks(recording_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recording_sessions (
  id TEXT PRIMARY KEY,
  sump_id TEXT NOT NULL REFERENCES sumps(id),
  status TEXT NOT NULL DEFAULT 'idle',
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  active_segment_started_at TEXT,
  segments_json TEXT NOT NULL DEFAULT '[]',
  was_interrupted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_sump_id ON recording_sessions(sump_id);

CREATE TABLE IF NOT EXISTS event_rules (
  id TEXT PRIMARY KEY,
  sump_id TEXT NOT NULL REFERENCES sumps(id),
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  metric_name TEXT,
  operator TEXT,
  threshold REAL,
  pattern TEXT,
  action TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_rules_sump_id ON event_rules(sump_id);
`;

const PRIMARY_SUMP_ID_KEY = "primary_sump_id";

export type RecordingSessionStatus = "idle" | "recording" | "paused" | "stopped";

export interface RecordingSegment {
  segmentNumber: number;
  startedAt: string;
  stoppedAt: string;
  recordingId?: string;
  filePath?: string;
}

export interface RecordingSessionRow {
  id: string;
  sumpId: string;
  status: RecordingSessionStatus;
  startedAt: string;
  stoppedAt: string | null;
  activeSegmentStartedAt: string | null;
  segmentsJson: string;
  wasInterrupted: boolean;
  createdAt: string;
}

function sumpFromRow(row: Record<string, unknown>): SumpRow {
  return {
    id: row.id as string,
    name: row.name as string,
    connectionType: row.connection_type as "local" | "ssh" | "external" | "logical",
    host: (row.host as string | null) ?? null,
    port: (row.port as number | null) ?? null,
    status: row.status as SumpState,
    authToken: (row.auth_token as string | null) ?? null,
    catalogJson: row.catalog_json as string,
    createdAt: row.created_at as string,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    parentSumpId: (row.parent_sump_id as string | null) ?? null,
    dockerHost: (row.docker_host as string | null) ?? null,
  };
}

function dataStreamFromRow(row: Record<string, unknown>): DataStreamRow {
  return {
    id: row.id as string,
    sumpId: row.sump_id as string,
    kind: row.kind as string,
    sourceRef: row.source_ref as string,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    isPrivate: Boolean(row.is_private),
    catalogJson: row.catalog_json as string,
    createdAt: row.created_at as string,
  };
}

function recordingFromRow(row: Record<string, unknown>): RecordingRow {
  return {
    id: row.id as string,
    dataStreamId: row.data_stream_id as string,
    sumpId: row.sump_id as string,
    filePath: row.file_path as string,
    catalogJson: row.catalog_json as string,
    createdAt: row.created_at as string,
  };
}

function trackFromRow(row: Record<string, unknown>): TrackRow {
  return {
    id: row.id as string,
    recordingId: (row.recording_id as string | null) ?? null,
    dataStreamId: row.data_stream_id as string,
    sumpId: row.sump_id as string,
    filePath: row.file_path as string,
    catalogJson: row.catalog_json as string,
    createdAt: row.created_at as string,
  };
}

function recordingSessionFromRow(row: Record<string, unknown>): RecordingSessionRow {
  return {
    id: row.id as string,
    sumpId: row.sump_id as string,
    status: row.status as RecordingSessionStatus,
    startedAt: row.started_at as string,
    stoppedAt: (row.stopped_at as string | null) ?? null,
    activeSegmentStartedAt: (row.active_segment_started_at as string | null) ?? null,
    segmentsJson: row.segments_json as string,
    wasInterrupted: Boolean(row.was_interrupted),
    createdAt: row.created_at as string,
  };
}

function eventRuleFromRow(row: Record<string, unknown>): EventRuleRow {
  return {
    id: row.id as string,
    sumpId: row.sump_id as string,
    name: row.name as string,
    conditionType: row.condition_type as EventConditionType,
    metricName: (row.metric_name as string | null) ?? null,
    operator: (row.operator as EventOperator | null) ?? null,
    threshold: (row.threshold as number | null) ?? null,
    pattern: (row.pattern as string | null) ?? null,
    action: row.action as EventAction,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at as string,
  };
}

/** BUG-000002: `CREATE TABLE IF NOT EXISTS` never adds a column to a
 * `sumps` table that already existed before that column was introduced
 * -- a real, pre-existing `.correlator/catalog.db` needs an explicit
 * migration, not just a schema string covering a fresh install. */
function ensureColumn(db: DatabaseSync, table: string, column: string, ddl: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export class Catalog {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA);
    // cor-CORE.PROVISION-008: added after this table already shipped --
    // migrate an existing database, not just a fresh one.
    ensureColumn(this.db, "sumps", "parent_sump_id", "parent_sump_id TEXT REFERENCES sumps(id)");
    ensureColumn(this.db, "sumps", "docker_host", "docker_host TEXT");
  }

  close(): void {
    this.db.close();
  }

  upsertSump(sump: UpsertSumpInput): void {
    this.db
      .prepare(`
      INSERT INTO sumps (id, name, connection_type, host, port, status, auth_token, catalog_json, created_at, last_seen_at, parent_sump_id, docker_host)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        connection_type = excluded.connection_type,
        host = excluded.host,
        port = excluded.port,
        status = excluded.status,
        auth_token = excluded.auth_token,
        catalog_json = excluded.catalog_json,
        last_seen_at = excluded.last_seen_at,
        parent_sump_id = excluded.parent_sump_id,
        docker_host = excluded.docker_host
    `)
      .run(
        sump.id,
        sump.name,
        sump.connectionType,
        sump.host,
        sump.port,
        sump.status,
        sump.authToken,
        sump.catalogJson,
        sump.createdAt,
        sump.lastSeenAt,
        sump.parentSumpId ?? null,
        sump.dockerHost ?? null,
      );
  }

  getSump(id: string): SumpRow | null {
    const row = this.db.prepare("SELECT * FROM sumps WHERE id = ?").get(id);
    return row ? sumpFromRow(row as Record<string, unknown>) : null;
  }

  listSumps(): SumpRow[] {
    const rows = this.db.prepare("SELECT * FROM sumps ORDER BY created_at").all();
    return rows.map((r) => sumpFromRow(r as Record<string, unknown>));
  }

  setSumpToken(id: string, token: string | null): void {
    this.db.prepare("UPDATE sumps SET auth_token = ? WHERE id = ?").run(token, id);
  }

  setSumpStatus(id: string, status: SumpState): void {
    this.db.prepare("UPDATE sumps SET status = ? WHERE id = ?").run(status, id);
  }

  /** cor-CORE.PROVISION-001: records the last time correlator successfully
   * talked to this Sump (a provisioning health check, or any authenticated
   * request through the IPC bridge). */
  touchSump(id: string, timestamp: string): void {
    this.db.prepare("UPDATE sumps SET last_seen_at = ? WHERE id = ?").run(timestamp, id);
  }

  renameSump(id: string, name: string): void {
    this.db.prepare("UPDATE sumps SET name = ? WHERE id = ?").run(name, id);
  }

  /** RM-000027: edits an existing Sump's connection details -- only
   * `rename-sump` existed before this; a connection mistake (wrong
   * host/port/token) previously had no fix short of uninstalling and
   * re-adding the Sump from scratch. */
  updateSumpConnection(
    id: string,
    updates: { host?: string | null; port?: number | null; authToken?: string | null },
  ): void {
    if (updates.host !== undefined) {
      this.db.prepare("UPDATE sumps SET host = ? WHERE id = ?").run(updates.host, id);
    }
    if (updates.port !== undefined) {
      this.db.prepare("UPDATE sumps SET port = ? WHERE id = ?").run(updates.port, id);
    }
    if (updates.authToken !== undefined) {
      this.db.prepare("UPDATE sumps SET auth_token = ? WHERE id = ?").run(updates.authToken, id);
    }
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
      .run(key, value);
  }

  /** cor-CORE.PROVISION-007: which Sump the switcher UI currently treats
   * as primary -- a UI-selection concept, distinct from `SumpState`'s
   * `"active"` (reachability). `null` until a user explicitly picks one. */
  getPrimarySumpId(): string | null {
    return this.getSetting(PRIMARY_SUMP_ID_KEY);
  }

  setPrimarySumpId(id: string | null): void {
    if (id === null) {
      this.db.prepare("DELETE FROM app_settings WHERE key = ?").run(PRIMARY_SUMP_ID_KEY);
      return;
    }
    this.setSetting(PRIMARY_SUMP_ID_KEY, id);
  }

  /** cor-CORE.PROVISION-008: idempotently registers one docker-host-scoped
   * logical Sump under a parent -- INSERT ... DO NOTHING so a later sync
   * never clobbers a user's own rename of this row.
   * cor-CORE.ARCHIVE-000003: auto-registers a matching data_streams row
   * so download-recording IPC succeeds for logical Sumps. */
  syncLogicalSump(params: {
    id: string;
    parentSumpId: string;
    dockerHost: string;
    name: string;
    host: string | null;
    port: number | null;
    authToken: string | null;
    createdAt: string;
  }): void {
    this.db
      .prepare(`
      INSERT INTO sumps (id, name, connection_type, host, port, status, auth_token, catalog_json, created_at, last_seen_at, parent_sump_id, docker_host)
      VALUES (?, ?, 'logical', ?, ?, 'active', ?, '{}', ?, NULL, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `)
      .run(
        params.id,
        params.name,
        params.host,
        params.port,
        params.authToken,
        params.createdAt,
        params.parentSumpId,
        params.dockerHost,
      );

    this.upsertDataStream({
      id: params.id,
      sumpId: params.id,
      kind: "sump",
      sourceRef: params.dockerHost,
      ownerUserId: null,
      isPrivate: false,
      catalogJson: "{}",
      createdAt: params.createdAt,
    });
  }

  /** cor-CORE.PROVISION-008: retires every logical Sump discovered under
   * `parentSumpId` -- their data disappears with the parent's connection,
   * so a dangling live-looking child would be wrong. */
  retireChildSumps(parentSumpId: string): void {
    this.db
      .prepare("UPDATE sumps SET status = 'retired' WHERE parent_sump_id = ?")
      .run(parentSumpId);
  }

  upsertDataStream(dataStream: DataStreamRow): void {
    this.db
      .prepare(`
      INSERT INTO data_streams (id, sump_id, kind, source_ref, owner_user_id, is_private, catalog_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sump_id = excluded.sump_id,
        kind = excluded.kind,
        source_ref = excluded.source_ref,
        owner_user_id = excluded.owner_user_id,
        is_private = excluded.is_private,
        catalog_json = excluded.catalog_json
    `)
      .run(
        dataStream.id,
        dataStream.sumpId,
        dataStream.kind,
        dataStream.sourceRef,
        dataStream.ownerUserId,
        dataStream.isPrivate ? 1 : 0,
        dataStream.catalogJson,
        dataStream.createdAt,
      );
  }

  getDataStream(id: string): DataStreamRow | null {
    const row = this.db.prepare("SELECT * FROM data_streams WHERE id = ?").get(id);
    return row ? dataStreamFromRow(row as Record<string, unknown>) : null;
  }

  listDataStreamsForSump(sumpId: string): DataStreamRow[] {
    const rows = this.db
      .prepare("SELECT * FROM data_streams WHERE sump_id = ? ORDER BY created_at")
      .all(sumpId);
    return rows.map((r) => dataStreamFromRow(r as Record<string, unknown>));
  }

  linkSecondarySump(link: SecondarySumpLinkRow): void {
    this.db
      .prepare(`
      INSERT INTO secondary_sump_links (child_sump_id, parent_sump_id, promoted_from_data_stream_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(child_sump_id, parent_sump_id) DO UPDATE SET
        promoted_from_data_stream_id = excluded.promoted_from_data_stream_id
    `)
      .run(link.childSumpId, link.parentSumpId, link.promotedFromDataStreamId, link.createdAt);
  }

  listSecondarySumpLinks(parentSumpId: string): SecondarySumpLinkRow[] {
    const rows = this.db
      .prepare("SELECT * FROM secondary_sump_links WHERE parent_sump_id = ? ORDER BY created_at")
      .all(parentSumpId);
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        childSumpId: row.child_sump_id as string,
        parentSumpId: row.parent_sump_id as string,
        promotedFromDataStreamId: row.promoted_from_data_stream_id as string,
        createdAt: row.created_at as string,
      };
    });
  }

  upsertRecording(recording: RecordingRow): void {
    this.db
      .prepare(`
      INSERT INTO recordings (id, data_stream_id, sump_id, file_path, catalog_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data_stream_id = excluded.data_stream_id,
        sump_id = excluded.sump_id,
        file_path = excluded.file_path,
        catalog_json = excluded.catalog_json
    `)
      .run(
        recording.id,
        recording.dataStreamId,
        recording.sumpId,
        recording.filePath,
        recording.catalogJson,
        recording.createdAt,
      );
  }

  getRecording(id: string): RecordingRow | null {
    const row = this.db.prepare("SELECT * FROM recordings WHERE id = ?").get(id);
    return row ? recordingFromRow(row as Record<string, unknown>) : null;
  }

  listRecordings(sumpId: string, dataStreamId: string): RecordingRow[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM recordings WHERE sump_id = ? AND data_stream_id = ? ORDER BY created_at",
      )
      .all(sumpId, dataStreamId);
    return rows.map((r) => recordingFromRow(r as Record<string, unknown>));
  }

  upsertTrack(track: TrackRow): void {
    this.db
      .prepare(`
      INSERT INTO tracks (id, recording_id, data_stream_id, sump_id, file_path, catalog_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        recording_id = excluded.recording_id,
        data_stream_id = excluded.data_stream_id,
        sump_id = excluded.sump_id,
        file_path = excluded.file_path,
        catalog_json = excluded.catalog_json
    `)
      .run(
        track.id,
        track.recordingId,
        track.dataStreamId,
        track.sumpId,
        track.filePath,
        track.catalogJson,
        track.createdAt,
      );
  }

  getTrack(id: string): TrackRow | null {
    const row = this.db.prepare("SELECT * FROM tracks WHERE id = ?").get(id);
    return row ? trackFromRow(row as Record<string, unknown>) : null;
  }

  listTracks(sumpId: string, dataStreamId: string): TrackRow[] {
    const rows = this.db
      .prepare("SELECT * FROM tracks WHERE sump_id = ? AND data_stream_id = ? ORDER BY created_at")
      .all(sumpId, dataStreamId);
    return rows.map((r) => trackFromRow(r as Record<string, unknown>));
  }

  listTracksForRecording(recordingId: string): TrackRow[] {
    const rows = this.db
      .prepare("SELECT * FROM tracks WHERE recording_id = ? ORDER BY created_at")
      .all(recordingId);
    return rows.map((r) => trackFromRow(r as Record<string, unknown>));
  }

  upsertRecordingSession(session: RecordingSessionRow): void {
    this.db
      .prepare(`
      INSERT INTO recording_sessions (id, sump_id, status, started_at, stopped_at, active_segment_started_at, segments_json, was_interrupted, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sump_id = excluded.sump_id,
        status = excluded.status,
        started_at = excluded.started_at,
        stopped_at = excluded.stopped_at,
        active_segment_started_at = excluded.active_segment_started_at,
        segments_json = excluded.segments_json,
        was_interrupted = excluded.was_interrupted
    `)
      .run(
        session.id,
        session.sumpId,
        session.status,
        session.startedAt,
        session.stoppedAt,
        session.activeSegmentStartedAt,
        session.segmentsJson,
        session.wasInterrupted ? 1 : 0,
        session.createdAt,
      );
  }

  getRecordingSession(id: string): RecordingSessionRow | null {
    const row = this.db.prepare("SELECT * FROM recording_sessions WHERE id = ?").get(id);
    return row ? recordingSessionFromRow(row as Record<string, unknown>) : null;
  }

  getActiveRecordingSessionForSump(sumpId: string): RecordingSessionRow | null {
    const row = this.db
      .prepare(
        "SELECT * FROM recording_sessions WHERE sump_id = ? AND status IN ('recording', 'paused') ORDER BY created_at DESC LIMIT 1",
      )
      .get(sumpId);
    return row ? recordingSessionFromRow(row as Record<string, unknown>) : null;
  }

  listRecordingSessionsForSump(sumpId: string): RecordingSessionRow[] {
    const rows = this.db
      .prepare("SELECT * FROM recording_sessions WHERE sump_id = ? ORDER BY created_at DESC")
      .all(sumpId);
    return rows.map((r) => recordingSessionFromRow(r as Record<string, unknown>));
  }

  /** Read-only lookup for boot-time crash recovery (cor-CORE.ARCHIVE-000003)
   * -- unlike the old `coerceInterruptedSessions`, this never mutates a
   * row itself; the caller (`recording-session.ts`'s own
   * `coerceInterruptedSessions`) decides how to close out each session,
   * since doing that properly means exporting its still-open segment
   * first, an async operation this synchronous catalog layer has no
   * business performing. */
  listRecordingSessionsByStatus(status: RecordingSessionStatus): RecordingSessionRow[] {
    const rows = this.db.prepare("SELECT * FROM recording_sessions WHERE status = ?").all(status);
    return rows.map((r) => recordingSessionFromRow(r as Record<string, unknown>));
  }

  getInterruptedSessions(): RecordingSessionRow[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM recording_sessions WHERE was_interrupted = 1 ORDER BY created_at DESC",
      )
      .all();
    return rows.map((r) => recordingSessionFromRow(r as Record<string, unknown>));
  }

  clearInterruptedFlag(id: string): void {
    this.db.prepare("UPDATE recording_sessions SET was_interrupted = 0 WHERE id = ?").run(id);
  }

  upsertEventRule(rule: EventRuleRow): void {
    this.db
      .prepare(`
      INSERT INTO event_rules (id, sump_id, name, condition_type, metric_name, operator, threshold, pattern, action, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sump_id = excluded.sump_id,
        name = excluded.name,
        condition_type = excluded.condition_type,
        metric_name = excluded.metric_name,
        operator = excluded.operator,
        threshold = excluded.threshold,
        pattern = excluded.pattern,
        action = excluded.action,
        enabled = excluded.enabled
    `)
      .run(
        rule.id,
        rule.sumpId,
        rule.name,
        rule.conditionType,
        rule.metricName,
        rule.operator,
        rule.threshold,
        rule.pattern,
        rule.action,
        rule.enabled ? 1 : 0,
        rule.createdAt,
      );
  }

  getEventRule(id: string): EventRuleRow | null {
    const row = this.db.prepare("SELECT * FROM event_rules WHERE id = ?").get(id);
    return row ? eventRuleFromRow(row as Record<string, unknown>) : null;
  }

  listEventRulesForSump(sumpId: string): EventRuleRow[] {
    const rows = this.db
      .prepare("SELECT * FROM event_rules WHERE sump_id = ? ORDER BY created_at DESC")
      .all(sumpId);
    return rows.map((r) => eventRuleFromRow(r as Record<string, unknown>));
  }

  deleteEventRule(id: string): void {
    this.db.prepare("DELETE FROM event_rules WHERE id = ?").run(id);
  }

  toggleEventRule(id: string, enabled: boolean): void {
    this.db.prepare("UPDATE event_rules SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
  }
}
