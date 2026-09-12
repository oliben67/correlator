import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Catalog } from "../catalog.ts";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-catalog-test-"));
  dbPath = join(dir, "catalog.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Catalog", () => {
  it("creates all five tables on a fresh path", () => {
    const catalog = new Catalog(dbPath);
    expect(catalog.listSumps()).toEqual([]);
    catalog.close();
  });

  it("round-trips a sump's catalog_json and projection columns exactly", () => {
    const catalog = new Catalog(dbPath);
    const doc = { name: "local sump", tags: ["dev"] };
    catalog.upsertSump({
      id: "sump-1",
      name: "local sump",
      connectionType: "local",
      host: null,
      port: 8080,
      status: "provisioning",
      authToken: null,
      catalogJson: JSON.stringify(doc),
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });

    const row = catalog.getSump("sump-1");
    expect(row).not.toBeNull();
    expect(JSON.parse(row?.catalogJson ?? "")).toEqual(doc);
    expect(row?.connectionType).toBe("local");
    expect(row?.port).toBe(8080);
    catalog.close();
  });

  it("round-trips a data stream/recording/track's catalog_json exactly", () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "local sump",
      connectionType: "local",
      host: null,
      port: 8080,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });
    const dsDoc = { label: "ssh: db-host" };
    catalog.upsertDataStream({
      id: "ds-1",
      sumpId: "sump-1",
      kind: "ssh",
      sourceRef: "db-host",
      ownerUserId: null,
      isPrivate: false,
      catalogJson: JSON.stringify(dsDoc),
      createdAt: "2026-09-08T00:00:00Z",
    });

    const recDoc = { label: "first capture" };
    catalog.upsertRecording({
      id: "rec-1",
      dataStreamId: "ds-1",
      sumpId: "sump-1",
      filePath: "/recordings/rec-1.recording",
      catalogJson: JSON.stringify(recDoc),
      createdAt: "2026-09-08T00:00:00Z",
    });

    const trackDoc = { metric: "cpu" };
    catalog.upsertTrack({
      id: "track-1",
      recordingId: "rec-1",
      dataStreamId: "ds-1",
      sumpId: "sump-1",
      filePath: "/recordings/track-1.track",
      catalogJson: JSON.stringify(trackDoc),
      createdAt: "2026-09-08T00:00:00Z",
    });

    expect(JSON.parse(catalog.getDataStream("ds-1")?.catalogJson ?? "")).toEqual(dsDoc);
    expect(JSON.parse(catalog.getRecording("rec-1")?.catalogJson ?? "")).toEqual(recDoc);
    expect(JSON.parse(catalog.getTrack("track-1")?.catalogJson ?? "")).toEqual(trackDoc);
    catalog.close();
  });

  it("queries every track for a given [sump_id, data_stream_id] via a single indexed lookup", () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "s",
      connectionType: "local",
      host: null,
      port: null,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });
    catalog.upsertDataStream({
      id: "ds-1",
      sumpId: "sump-1",
      kind: "ssh",
      sourceRef: "host-a",
      ownerUserId: null,
      isPrivate: false,
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
    });
    catalog.upsertDataStream({
      id: "ds-2",
      sumpId: "sump-1",
      kind: "ssh",
      sourceRef: "host-b",
      ownerUserId: null,
      isPrivate: false,
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
    });
    for (const [id, dataStreamId] of [
      ["track-1", "ds-1"],
      ["track-2", "ds-1"],
      ["track-3", "ds-2"],
    ] as const) {
      catalog.upsertTrack({
        id,
        recordingId: null,
        dataStreamId,
        sumpId: "sump-1",
        filePath: `/${id}.track`,
        catalogJson: "{}",
        createdAt: "2026-09-08T00:00:00Z",
      });
    }

    const tracks = catalog.listTracks("sump-1", "ds-1");
    expect(tracks.map((t) => t.id).sort()).toEqual(["track-1", "track-2"]);
    catalog.close();
  });

  it("reopening an existing catalog file reuses its schema without error or duplication", () => {
    const first = new Catalog(dbPath);
    first.upsertSump({
      id: "sump-1",
      name: "s",
      connectionType: "local",
      host: null,
      port: null,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });
    first.close();

    const second = new Catalog(dbPath);
    expect(second.listSumps()).toHaveLength(1);
    expect(second.getSump("sump-1")?.id).toBe("sump-1");
    second.close();
  });

  // BUG-0035: cttc's daemon registry had no explicit "forget" path at all --
  // removing a Docker host in the UI didn't stop it being silently
  // re-collected forever after a restart. The catalog fixes this by making
  // retirement an explicit, durable, queryable status: a retired sump stays
  // retired across reopens and its token is actually cleared, not just
  // hidden from a listing.
  it("BUG-0035: a retired sump's status and cleared token survive reopening the catalog", () => {
    const first = new Catalog(dbPath);
    first.upsertSump({
      id: "sump-1",
      name: "s",
      connectionType: "local",
      host: null,
      port: null,
      status: "active",
      authToken: "some-token",
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });
    first.setSumpStatus("sump-1", "retired");
    first.setSumpToken("sump-1", null);
    first.close();

    const second = new Catalog(dbPath);
    const row = second.getSump("sump-1");
    expect(row?.status).toBe("retired");
    expect(row?.authToken).toBeNull();
    second.close();
  });

  it("touchSump sets last_seen_at, leaving every other column untouched", () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "s",
      connectionType: "local",
      host: null,
      port: 8765,
      status: "active",
      authToken: "tok",
      catalogJson: "{}",
      createdAt: "2026-09-08T00:00:00Z",
      lastSeenAt: null,
    });

    catalog.touchSump("sump-1", "2026-09-12T04:00:00Z");

    const row = catalog.getSump("sump-1");
    expect(row?.lastSeenAt).toBe("2026-09-12T04:00:00Z");
    expect(row?.status).toBe("active");
    expect(row?.authToken).toBe("tok");
    catalog.close();
  });

  // cor-CORE.PROVISION-006: "connect to an existing Sump" registers it
  // with connectionType "external" -- correlator didn't provision it and
  // owns no lifecycle for it.
  it("round-trips a sump with connectionType 'external'", () => {
    const catalog = new Catalog(dbPath);
    catalog.upsertSump({
      id: "sump-1",
      name: "existing",
      connectionType: "external",
      host: "10.0.0.5",
      port: 9000,
      status: "active",
      authToken: null,
      catalogJson: "{}",
      createdAt: "2026-09-12T00:00:00Z",
      lastSeenAt: "2026-09-12T00:00:00Z",
    });

    expect(catalog.getSump("sump-1")?.connectionType).toBe("external");
    catalog.close();
  });
});
