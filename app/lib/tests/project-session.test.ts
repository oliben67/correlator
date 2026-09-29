import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addReference, createProject, loadProject, saveProject } from "../project.ts";
import { type ProjectNotice, ProjectSession } from "../project-session.ts";
import {
  loadRecentProjects,
  pushRecentProject,
  RECENT_LIMIT,
  removeRecentProject,
} from "../recent-projects.ts";

// cor-CORE.PROJECT-000007 (REQ-000031): recent list + current-project session.

let dir: string;
let defaultPath: string;
let recentPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-session-test-"));
  defaultPath = join(dir, "default.correlator");
  recentPath = join(dir, "recent-projects.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function session(picks: { open?: (string | null)[]; save?: (string | null)[] } = {}) {
  const notices: ProjectNotice[] = [];
  let changes = 0;
  const s = new ProjectSession({
    defaultPath,
    recentPath,
    now: () => "2026-09-29T12:00:00.000Z",
    dialog: {
      pickOpenPath: async () => picks.open?.shift() ?? null,
      pickSavePath: async () => picks.save?.shift() ?? null,
    },
  });
  s.onNotice((n) => notices.push(n));
  s.onChange(() => changes++);
  return { s, notices, changes: () => changes };
}

describe("cor-CORE.PROJECT-000007: recent projects list", () => {
  it(`keeps at most ${RECENT_LIMIT}, newest first, one per path, never the default`, () => {
    let list = pushRecentProject([], "/p/a.correlator", defaultPath, "t1");
    list = pushRecentProject(list, "/p/b.correlator", defaultPath, "t2");
    list = pushRecentProject(list, "/p/a.correlator", defaultPath, "t3");
    list = pushRecentProject(list, defaultPath, defaultPath, "t4");
    expect(list.map((e) => [e.name, e.lastOpenedAt])).toEqual([
      ["a", "t3"],
      ["b", "t2"],
    ]);
    for (let i = 0; i < RECENT_LIMIT + 3; i++) {
      list = pushRecentProject(list, `/p/n${i}.correlator`, defaultPath, `n${i}`);
    }
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0].name).toBe(`n${RECENT_LIMIT + 2}`);
    expect(removeRecentProject(list, list[0].path)).toHaveLength(RECENT_LIMIT - 1);
  });

  it("reads a missing or malformed file as empty", () => {
    expect(loadRecentProjects(recentPath)).toEqual([]);
    writeFileSync(recentPath, "{not json");
    expect(loadRecentProjects(recentPath)).toEqual([]);
    writeFileSync(
      recentPath,
      JSON.stringify([{ path: 1 }, { path: "/x", name: "x", lastOpenedAt: "t" }]),
    );
    expect(loadRecentProjects(recentPath)).toEqual([{ path: "/x", name: "x", lastOpenedAt: "t" }]);
  });
});

describe("cor-CORE.PROJECT-000007: ProjectSession", () => {
  it("starts on the default project, which is exempt as a download target", () => {
    const { s } = session();
    expect(s.isDefault).toBe(true);
    expect(s.downloadTarget()).toBeUndefined();
    expect(s.summary()).toMatchObject({ mode: "default", name: "Default project", references: [] });
    expect(existsSync(defaultPath)).toBe(true);
  });

  it("New Project writes an empty project at the picked path and makes it current", async () => {
    const { s, notices } = session({ save: [join(dir, "work")] });
    expect(await s.newProject()).toBe(true);
    const path = join(dir, "work.correlator");
    expect(s.currentPath).toBe(path);
    expect(s.downloadTarget()).toBe(path);
    expect(loadProject(path)).toEqual(createProject());
    expect(s.summary()).toMatchObject({ name: "work", mode: "unbound", isDefault: false });
    expect(s.recent().map((e) => e.path)).toEqual([path]);
    expect(notices.at(-1)).toEqual({ message: 'Created project "work"', severity: "info" });
  });

  it("a cancelled dialog changes nothing and says nothing", async () => {
    const { s, notices, changes } = session();
    expect(await s.newProject()).toBe(false);
    expect(await s.open()).toBe(false);
    expect(s.isDefault).toBe(true);
    expect(notices).toEqual([]);
    expect(changes()).toBe(0);
  });

  it("Open makes an existing project current; a missing one leaves the recent list", async () => {
    const path = join(dir, "a.correlator");
    saveProject(path, addReference(createProject(), "/data/x.recording"));
    const { s, notices } = session({ open: [path] });
    expect(await s.open()).toBe(true);
    expect(s.summary().references).toEqual(["/data/x.recording"]);

    rmSync(path);
    s.close();
    expect(await s.open(path)).toBe(false);
    expect(s.isDefault).toBe(true);
    expect(s.recent()).toEqual([]);
    expect(notices.at(-1)?.severity).toBe("error");
  });

  it("refuses to open a file that isn't a project", async () => {
    const path = join(dir, "junk.correlator");
    writeFileSync(path, JSON.stringify({ hello: 1 }));
    const { s, notices } = session();
    expect(await s.open(path)).toBe(false);
    expect(s.isDefault).toBe(true);
    expect(notices.at(-1)?.message).toContain("not a correlator project");
  });

  it("Save on the default project acts as Save As and never overwrites the default", async () => {
    saveProject(defaultPath, addReference(createProject(), "/data/d.recording"));
    const before = readFileSync(defaultPath, "utf8");
    const { s } = session({ save: [join(dir, "copy.correlator")] });
    expect(await s.save()).toBe(true);
    expect(s.currentPath).toBe(join(dir, "copy.correlator"));
    expect(loadProject(s.currentPath).references).toEqual(["/data/d.recording"]);
    expect(readFileSync(defaultPath, "utf8")).toBe(before);
  });

  it("Save As refuses the default project's own path", async () => {
    const { s, notices } = session({ save: [join(dir, "work.correlator"), defaultPath] });
    await s.newProject();
    expect(await s.saveAs()).toBe(false);
    expect(s.currentPath).toBe(join(dir, "work.correlator"));
    expect(notices.at(-1)?.severity).toBe("error");
  });

  it("Save As copies to a new current file and leaves the old one", async () => {
    const { s } = session({ save: [join(dir, "a.correlator"), join(dir, "b.correlator")] });
    await s.newProject();
    expect(await s.saveAs()).toBe(true);
    expect(s.currentPath).toBe(join(dir, "b.correlator"));
    expect(existsSync(join(dir, "a.correlator"))).toBe(true);
    expect(s.recent().map((e) => e.name)).toEqual(["b", "a"]);
  });

  it("Close returns to the default project", async () => {
    const { s } = session({ save: [join(dir, "a.correlator")] });
    await s.newProject();
    s.close();
    expect(s.isDefault).toBe(true);
  });

  it("binds once, explicitly; never the default project; never a second context", async () => {
    const ctx = { sumpId: "s1", dataStreamId: "s1" };
    const { s, notices } = session({ save: [join(dir, "a.correlator")] });
    expect(s.bind(ctx)).toBe(false); // default
    await s.newProject();
    expect(s.bind(ctx)).toBe(true);
    expect(s.summary()).toMatchObject({ mode: "bound", context: ctx });
    expect(s.bind(ctx)).toBe(true); // same context: no-op
    expect(s.bind({ sumpId: "s2", dataStreamId: "s2" })).toBe(false);
    expect(loadProject(s.currentPath).context).toEqual(ctx);
    expect(notices.filter((n) => n.severity === "error")).toHaveLength(2);
  });

  it("falls back to the default project if the current file disappears", async () => {
    const { s, notices } = session({ save: [join(dir, "a.correlator")] });
    await s.newProject();
    rmSync(join(dir, "a.correlator"));
    expect(s.summary().mode).toBe("default");
    expect(s.isDefault).toBe(true);
    expect(notices.at(-1)?.severity).toBe("error");
  });

  it("forgets and clears recent entries", async () => {
    const { s } = session({ save: [join(dir, "a.correlator"), join(dir, "b.correlator")] });
    await s.newProject();
    await s.newProject();
    s.forgetRecent(join(dir, "a.correlator"));
    expect(s.recent().map((e) => e.name)).toEqual(["b"]);
    s.clearRecent();
    expect(s.recent()).toEqual([]);
  });
});
