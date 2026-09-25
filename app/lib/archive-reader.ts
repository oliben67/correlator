/**
 * Reads back `*.recording`/`*.track` archives (cor-CORE.ARCHIVE-001) in
 * Electron's main process. This has to live here, not the server: the
 * files only ever exist on the Electron user's local disk once
 * downloaded (`downloadAndRegister` in `shell.ts`), and correlator's
 * servers are per-Sump Docker containers with no reachable bare-Python
 * path to hand bytes to. The renderer can't do it either
 * (`contextIsolation: true`/`nodeIntegration: false`) -- main process,
 * `node:zlib`/`node:fs` only (env-DEPS-002: no new npm dependency).
 *
 * Narrow by design, not a general-purpose zip reader: coupled to
 * exactly what `server/src/correlator_sump/archive.py`'s `zipfile`
 * writer emits -- a single-disk archive (no multi-disk spanning), each
 * entry either `ZIP_DEFLATED` or stored, no zip64, no encryption, no
 * data descriptors (Python's `zipfile` writer doesn't use streaming
 * mode here since every entry is written from an in-memory buffer).
 */

import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

interface CentralDirectoryEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(data: Uint8Array): DataView {
  // The EOCD record is at the very end, except for a variable-length
  // (0-65535 byte) trailing comment -- scan backwards for its
  // signature rather than assuming a fixed offset.
  const maxCommentLength = Math.min(data.length - EOCD_MIN_SIZE, 65535);
  for (let commentLength = 0; commentLength <= maxCommentLength; commentLength++) {
    const offset = data.length - EOCD_MIN_SIZE - commentLength;
    if (offset < 0) break;
    const view = new DataView(data.buffer, data.byteOffset + offset, EOCD_MIN_SIZE);
    if (view.getUint32(0, true) === EOCD_SIGNATURE) {
      return view;
    }
  }
  throw new Error("not a valid zip archive: end-of-central-directory record not found");
}

function readCentralDirectory(data: Uint8Array): CentralDirectoryEntry[] {
  const eocd = findEndOfCentralDirectory(data);
  const entryCount = eocd.getUint16(10, true);
  const centralDirectoryOffset = eocd.getUint32(16, true);

  const entries: CentralDirectoryEntry[] = [];
  let offset = centralDirectoryOffset;
  for (let i = 0; i < entryCount; i++) {
    const view = new DataView(data.buffer, data.byteOffset + offset);
    if (view.getUint32(0, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`not a valid zip archive: central directory entry ${i} has a bad signature`);
    }
    const compressionMethod = view.getUint16(10, true);
    const compressedSize = view.getUint32(20, true);
    const uncompressedSize = view.getUint32(24, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const localHeaderOffset = view.getUint32(42, true);
    const nameStart = data.byteOffset + offset + 46;
    const name = new TextDecoder().decode(data.buffer.slice(nameStart, nameStart + nameLength));

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntryData(data: Uint8Array, entry: CentralDirectoryEntry): Buffer {
  const view = new DataView(data.buffer, data.byteOffset + entry.localHeaderOffset);
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataStart = data.byteOffset + entry.localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = Buffer.from(data.buffer.slice(dataStart, dataStart + entry.compressedSize));

  if (entry.compressionMethod === METHOD_STORED) return compressed;
  if (entry.compressionMethod === METHOD_DEFLATED) return inflateRawSync(compressed);
  throw new Error(`unsupported zip compression method: ${entry.compressionMethod}`);
}

function readZipEntries(data: Uint8Array): Map<string, Buffer> {
  const entries = readCentralDirectory(data);
  const contents = new Map<string, Buffer>();
  for (const entry of entries) {
    contents.set(entry.name, readEntryData(data, entry));
  }
  return contents;
}

export type SystemKind = "host" | "container";
const DEFAULT_SYSTEM_KIND: SystemKind = "container";

export interface ArchivedLogRow {
  tsMs: number;
  text: string;
}

export interface RecordingArchive {
  t0: number;
  t1: number;
  created: string;
  sources: Record<string, ArchivedLogRow[]>;
  systemKinds: Record<string, SystemKind>;
}

export interface TrackArchive {
  t0: number;
  t1: number;
  created: string;
  seriesName: string;
  points: [number, number][];
  systemKind: SystemKind;
}

export function readRecordingArchive(data: Uint8Array): RecordingArchive {
  const contents = readZipEntries(data);
  const manifestRaw = contents.get("manifest.json");
  if (!manifestRaw) throw new Error("not a valid recording archive: missing manifest.json");
  const manifest = JSON.parse(manifestRaw.toString("utf8"));

  const sources: Record<string, ArchivedLogRow[]> = {};
  const systemKinds: Record<string, SystemKind> = {};
  for (const meta of manifest.sources as Array<{
    name: string;
    file: string;
    system_kind?: SystemKind;
  }>) {
    const fileData = contents.get(meta.file);
    if (!fileData) throw new Error(`not a valid recording archive: missing ${meta.file}`);
    const rows: ArchivedLogRow[] = fileData
      .toString("utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const row = JSON.parse(line);
        return { tsMs: row.ts, text: row.text ?? "" };
      });
    sources[meta.name] = rows;
    systemKinds[meta.name] = meta.system_kind ?? DEFAULT_SYSTEM_KIND;
  }

  return {
    t0: manifest.from,
    t1: manifest.to,
    created: manifest.created ?? "",
    sources,
    systemKinds,
  };
}

export function readTrackArchive(data: Uint8Array): TrackArchive {
  const contents = readZipEntries(data);
  const manifestRaw = contents.get("manifest.json");
  if (!manifestRaw) throw new Error("not a valid track archive: missing manifest.json");
  const manifest = JSON.parse(manifestRaw.toString("utf8"));

  const fileData = contents.get(manifest.file);
  if (!fileData) throw new Error(`not a valid track archive: missing ${manifest.file}`);
  const payload = JSON.parse(fileData.toString("utf8"));
  const points: [number, number][] = payload.points.map((p: [number, number]) => [p[0], p[1]]);

  return {
    t0: manifest.from,
    t1: manifest.to,
    created: manifest.created ?? "",
    seriesName: manifest.series_name,
    points,
    systemKind: manifest.system_kind ?? DEFAULT_SYSTEM_KIND,
  };
}
