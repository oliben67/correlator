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
  connectionType: "local" | "ssh" | "external";
  host: string | null;
  port: number | null;
  status: SumpState;
  authToken: string | null;
  catalogJson: string;
  createdAt: string;
  lastSeenAt: string | null;
}

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
  last_seen_at TEXT
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
`;

function sumpFromRow(row: Record<string, unknown>): SumpRow {
  return {
    id: row.id as string,
    name: row.name as string,
    connectionType: row.connection_type as "local" | "ssh" | "external",
    host: (row.host as string | null) ?? null,
    port: (row.port as number | null) ?? null,
    status: row.status as SumpState,
    authToken: (row.auth_token as string | null) ?? null,
    catalogJson: row.catalog_json as string,
    createdAt: row.created_at as string,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
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

export class Catalog {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  upsertSump(sump: SumpRow): void {
    this.db
      .prepare(`
      INSERT INTO sumps (id, name, connection_type, host, port, status, auth_token, catalog_json, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        connection_type = excluded.connection_type,
        host = excluded.host,
        port = excluded.port,
        status = excluded.status,
        auth_token = excluded.auth_token,
        catalog_json = excluded.catalog_json,
        last_seen_at = excluded.last_seen_at
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
}
