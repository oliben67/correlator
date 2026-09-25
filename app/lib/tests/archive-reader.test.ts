import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readRecordingArchive, readTrackArchive } from "../archive-reader.ts";

/**
 * A minimal zip writer, independent of `archive-reader.ts`'s own
 * reading code, so these tests exercise the real zip format rather
 * than round-tripping against themselves. Structurally matches what
 * Python's `zipfile.ZipFile(..., "w", zipfile.ZIP_DEFLATED)` (the
 * writer `archive.py` actually uses) produces: local file header per
 * entry, central directory, end-of-central-directory record.
 */
function buildZip(entries: { name: string; data: string; stored?: boolean }[]): Uint8Array {
  const chunks: Buffer[] = [];
  const centralDirectoryEntries: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawData = Buffer.from(entry.data, "utf8");
    const method = entry.stored ? 0 : 8;
    const payload = entry.stored ? rawData : deflateRawSync(rawData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localHeaderOffset = offset;
    chunks.push(localHeader, nameBuf, payload);
    offset += localHeader.length + nameBuf.length + payload.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localHeaderOffset, 42);
    centralDirectoryEntries.push(Buffer.concat([centralHeader, nameBuf]));
  }

  const centralDirectory = Buffer.concat(centralDirectoryEntries);
  const centralDirectoryOffset = offset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return new Uint8Array(Buffer.concat([...chunks, centralDirectory, eocd]));
}

function recordingManifest(sources: { name: string; file: string; system_kind?: string }[]) {
  return JSON.stringify({
    version: 1,
    kind: "recording",
    from: 1000,
    to: 2000,
    created: "2026-09-19T00:00:00.000Z",
    sources,
  });
}

function trackManifest(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    kind: "track",
    from: 0,
    to: 20,
    created: "2026-09-19T00:00:00.000Z",
    series_name: "cpu_pct",
    system_kind: "container",
    file: "series.json",
    ...overrides,
  });
}

describe("cor-CORE.ARCHIVE-001: recording archive read-back", () => {
  it("reads every log row and each source's system_kind back exactly", () => {
    const zip = buildZip([
      {
        name: "logs/0.jsonl",
        data: [
          JSON.stringify({ ts: 1000, text: "hello" }),
          JSON.stringify({ ts: 2000, text: "world" }),
        ].join("\n"),
      },
      {
        name: "logs/1.jsonl",
        data: JSON.stringify({ ts: 1500, text: "daemon line" }),
        stored: true,
      },
      {
        name: "manifest.json",
        data: recordingManifest([
          { name: "web-1", file: "logs/0.jsonl", system_kind: "container" },
          { name: "h1", file: "logs/1.jsonl", system_kind: "host" },
        ]),
      },
    ]);

    const archive = readRecordingArchive(zip);

    expect(archive.t0).toBe(1000);
    expect(archive.t1).toBe(2000);
    expect(archive.sources["web-1"]).toEqual([
      { tsMs: 1000, text: "hello" },
      { tsMs: 2000, text: "world" },
    ]);
    expect(archive.sources["h1"]).toEqual([{ tsMs: 1500, text: "daemon line" }]);
    expect(archive.systemKinds).toEqual({ "web-1": "container", h1: "host" });
  });

  it("defaults a source with no system_kind key to container", () => {
    const zip = buildZip([
      { name: "logs/0.jsonl", data: JSON.stringify({ ts: 10, text: "hi" }) },
      { name: "manifest.json", data: recordingManifest([{ name: "web-1", file: "logs/0.jsonl" }]) },
    ]);

    const archive = readRecordingArchive(zip);
    expect(archive.systemKinds).toEqual({ "web-1": "container" });
  });
});

describe("cor-CORE.ARCHIVE-001: track archive read-back", () => {
  it("reads every point and the track's system_kind back exactly", () => {
    const zip = buildZip([
      {
        name: "series.json",
        data: JSON.stringify({
          points: [
            [0, 0.5],
            [10, 0.75],
          ],
        }),
      },
      { name: "manifest.json", data: trackManifest({ system_kind: "host" }) },
    ]);

    const archive = readTrackArchive(zip);

    expect(archive.seriesName).toBe("cpu_pct");
    expect(archive.points).toEqual([
      [0, 0.5],
      [10, 0.75],
    ]);
    expect(archive.systemKind).toBe("host");
  });

  it("defaults to container when system_kind is missing from the manifest", () => {
    const manifest = JSON.parse(trackManifest());
    delete manifest.system_kind;
    const zip = buildZip([
      { name: "series.json", data: JSON.stringify({ points: [[0, 0.5]] }) },
      { name: "manifest.json", data: JSON.stringify(manifest) },
    ]);

    const archive = readTrackArchive(zip);
    expect(archive.systemKind).toBe("container");
  });

  it("reads a stored (uncompressed) entry as well as a deflated one", () => {
    const zip = buildZip([
      { name: "series.json", data: JSON.stringify({ points: [[0, 1]] }), stored: true },
      { name: "manifest.json", data: trackManifest(), stored: true },
    ]);

    const archive = readTrackArchive(zip);
    expect(archive.points).toEqual([[0, 1]]);
  });
});
