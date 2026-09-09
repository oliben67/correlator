import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addReference,
  createProject,
  defaultProjectPath,
  ensureDefaultProject,
  loadProject,
  moveToFolder,
  removeReference,
  saveProject,
  saveProjectAs,
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
