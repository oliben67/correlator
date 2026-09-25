import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addReference,
  bindLiveContext,
  canAddReferenceToProject,
  canBindContext,
  contextsEqual,
  createProject,
  defaultProjectPath,
  ensureDefaultProject,
  getTrackViewState,
  loadProject,
  moveToFolder,
  projectMode,
  removeReference,
  saveProject,
  saveProjectAs,
  setTrackDelay,
  setTrackVisibility,
} from "../project.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-project-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("cor-CORE.PROJECT-001: project file format", () => {
  it("round-trips references and the folder tree exactly through save/load", () => {
    let project = createProject();
    project = addReference(project, "/recordings/a.recording");
    project = addReference(project, "/tracks/b.track");
    project = moveToFolder(project, "/recordings/a.recording", ["Session 1"]);

    const path = join(dir, "test.correlator");
    saveProject(path, project);
    const loaded = loadProject(path);

    expect(loaded).toEqual(project);
  });

  it("moveToFolder changes only the folder tree, never references or disk", () => {
    let project = createProject();
    project = addReference(project, "/a.recording");
    const referencesBefore = project.references;

    const moved = moveToFolder(project, "/a.recording", ["Folder A"]);

    expect(moved.references).toBe(referencesBefore);
    expect(moved.folders).toEqual([{ name: "Folder A", items: ["/a.recording"], folders: [] }]);
  });

  it("moveToFolder relocates an item already in a different folder", () => {
    let project = createProject();
    project = addReference(project, "/a.recording");
    project = moveToFolder(project, "/a.recording", ["Old"]);

    const moved = moveToFolder(project, "/a.recording", ["New"]);

    expect(moved.folders.find((f) => f.name === "Old")?.items).toEqual([]);
    expect(moved.folders.find((f) => f.name === "New")?.items).toEqual(["/a.recording"]);
  });

  it("removeReference removes a path from every folder that referenced it, not just the top-level list", () => {
    let project = createProject();
    project = addReference(project, "/a.recording");
    project = moveToFolder(project, "/a.recording", ["Folder A", "Nested"]);

    const removed = removeReference(project, "/a.recording");

    expect(removed.references).toEqual([]);
    expect(removed.folders[0].folders[0].items).toEqual([]);
  });
});

describe("cor-CORE.PROJECT-002: default project", () => {
  it("resolves to ~/.correlator/default.correlator", () => {
    expect(defaultProjectPath().endsWith(join(".correlator", "default.correlator"))).toBe(true);
  });

  it("creates the file at exactly the given path on a fresh directory", () => {
    const path = join(dir, "default.correlator");
    expect(existsSync(path)).toBe(false);

    ensureDefaultProject(path);

    expect(existsSync(path)).toBe(true);
    expect(loadProject(path)).toEqual(createProject());
  });

  it("never overwrites an already-modified default project on a second call", () => {
    const path = join(dir, "default.correlator");
    ensureDefaultProject(path);

    let project = loadProject(path);
    project = addReference(project, "/a.recording");
    saveProject(path, project);

    const result = ensureDefaultProject(path);

    expect(result.references).toEqual(["/a.recording"]);
  });

  it("saveProjectAs writes to a new path and leaves the default project's own file untouched", () => {
    const defaultPath = join(dir, "default.correlator");
    ensureDefaultProject(defaultPath);
    const originalContent = loadProject(defaultPath);

    const otherPath = join(dir, "other.correlator");
    let otherProject = createProject();
    otherProject = addReference(otherProject, "/x.track");
    saveProjectAs(otherPath, otherProject);

    expect(loadProject(otherPath).references).toEqual(["/x.track"]);
    expect(loadProject(defaultPath)).toEqual(originalContent);
  });
});

describe("cor-CORE.PROJECT-005: per-project track view-state", () => {
  it("round-trips delay and visibility through save/load, keyed by reference path", () => {
    let project = createProject();
    project = addReference(project, "/tracks/a.track");
    project = setTrackDelay(project, "/tracks/a.track", 250);
    project = setTrackVisibility(project, "/tracks/a.track", false);

    const path = join(dir, "test.correlator");
    saveProject(path, project);
    const loaded = loadProject(path);

    expect(getTrackViewState(loaded, "/tracks/a.track")).toEqual({ delayMs: 250, visible: false });
  });

  it("setTrackDelay and setTrackVisibility don't clobber each other's field", () => {
    let project = createProject();
    project = setTrackDelay(project, "/a.track", 100);
    project = setTrackVisibility(project, "/a.track", true);

    expect(getTrackViewState(project, "/a.track")).toEqual({ delayMs: 100, visible: true });
  });

  it("getTrackViewState returns an empty object for a reference with no settings yet", () => {
    const project = createProject();
    expect(getTrackViewState(project, "/never-touched.track")).toEqual({});
  });

  it("an old project file with no trackSettings key at all still loads and reports empty view-state", () => {
    const path = join(dir, "legacy.correlator");
    saveProject(path, { references: ["/a.track"], folders: [] });

    const loaded = loadProject(path);

    expect(getTrackViewState(loaded, "/a.track")).toEqual({});
  });

  it("removeReference also strips that path's view-state, but leaves others intact", () => {
    let project = createProject();
    project = addReference(project, "/a.track");
    project = addReference(project, "/b.track");
    project = setTrackDelay(project, "/a.track", 50);
    project = setTrackDelay(project, "/b.track", 75);

    const removed = removeReference(project, "/a.track");

    expect(getTrackViewState(removed, "/a.track")).toEqual({});
    expect(getTrackViewState(removed, "/b.track")).toEqual({ delayMs: 75 });
  });

  it("removeReference preserves the project's bound context (no silent field drop)", () => {
    let project = createProject();
    project = addReference(project, "/a.track");
    project = bindLiveContext(project, { sumpId: "s1", dataStreamId: "ds1" });

    const removed = removeReference(project, "/a.track");

    expect(removed.context).toEqual({ sumpId: "s1", dataStreamId: "ds1" });
  });
});

describe("cor-CORE.PROJECT-005: live-project context isolation", () => {
  it("contextsEqual compares by sumpId and dataStreamId, false when either is missing", () => {
    const a = { sumpId: "s1", dataStreamId: "ds1" };
    const b = { sumpId: "s1", dataStreamId: "ds1" };
    const c = { sumpId: "s1", dataStreamId: "ds2" };

    expect(contextsEqual(a, b)).toBe(true);
    expect(contextsEqual(a, c)).toBe(false);
    expect(contextsEqual(a, null)).toBe(false);
    expect(contextsEqual(undefined, b)).toBe(false);
  });

  it("an unbound project can bind to any context", () => {
    const project = createProject();
    expect(canBindContext(project, { sumpId: "s1", dataStreamId: "ds1" })).toBe(true);
  });

  it("a project bound to a context accepts a matching context and rejects a mismatched one", () => {
    let project = createProject();
    project = bindLiveContext(project, { sumpId: "s1", dataStreamId: "ds1" });

    expect(canBindContext(project, { sumpId: "s1", dataStreamId: "ds1" })).toBe(true);
    expect(canBindContext(project, { sumpId: "s2", dataStreamId: "ds1" })).toBe(false);
    expect(canBindContext(project, { sumpId: "s1", dataStreamId: "ds2" })).toBe(false);
  });

  it("a bound project with every reference removed still rejects a foreign context (empty but bound)", () => {
    let project = createProject();
    project = addReference(project, "/a.track");
    project = bindLiveContext(project, { sumpId: "s1", dataStreamId: "ds1" });
    project = removeReference(project, "/a.track");

    expect(project.references).toEqual([]);
    expect(canBindContext(project, { sumpId: "s2", dataStreamId: "ds1" })).toBe(false);
    expect(canBindContext(project, { sumpId: "s1", dataStreamId: "ds1" })).toBe(true);
  });

  it("bindLiveContext sets the context only once; a second bind attempt is a no-op", () => {
    let project = createProject();
    project = bindLiveContext(project, { sumpId: "s1", dataStreamId: "ds1" });
    project = bindLiveContext(project, { sumpId: "s2", dataStreamId: "ds2" });

    expect(project.context).toEqual({ sumpId: "s1", dataStreamId: "ds1" });
  });

  it("canAddReferenceToProject mirrors canBindContext for the isolation check callers actually run", () => {
    let project = createProject();
    project = bindLiveContext(project, { sumpId: "s1", dataStreamId: "ds1" });

    expect(canAddReferenceToProject(project, { sumpId: "s1", dataStreamId: "ds1" })).toBe(true);
    expect(canAddReferenceToProject(project, { sumpId: "s2", dataStreamId: "ds1" })).toBe(false);
  });

  it("projectMode reports unbound for a fresh project and live once a context is bound", () => {
    let project = createProject();
    expect(projectMode(project)).toBe("unbound");

    project = bindLiveContext(project, { sumpId: "s1", dataStreamId: "ds1" });
    expect(projectMode(project)).toBe("live");
  });
});
