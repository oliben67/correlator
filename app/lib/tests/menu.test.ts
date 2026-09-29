import { describe, expect, it } from "vitest";
import { buildMenuTemplate } from "../menu.ts";

describe("buildMenuTemplate", () => {
  it("returns File/Edit/View/Window top-level menus", () => {
    const template = buildMenuTemplate();
    expect(template.map((item) => item.label)).toEqual(["File", "Edit", "View", "Window"]);
  });

  it("wires Quit under File with the standard accelerator", () => {
    const [file] = buildMenuTemplate();
    expect(file?.submenu).toEqual([{ role: "quit", accelerator: "CmdOrCtrl+Q" }]);
  });

  it("wires Undo/Redo/Cut/Copy/Paste/SelectAll under Edit via built-in roles", () => {
    const [, edit] = buildMenuTemplate();
    const roles = edit?.submenu?.filter((item) => item.role).map((item) => item.role);
    expect(roles).toEqual(["undo", "redo", "cut", "copy", "paste", "selectAll"]);
  });

  it("wires DevTools/Zoom/Fullscreen under View", () => {
    const [, , view] = buildMenuTemplate();
    const roles = view?.submenu?.filter((item) => item.role).map((item) => item.role);
    expect(roles).toEqual([
      "reload",
      "toggleDevTools",
      "zoomIn",
      "zoomOut",
      "resetZoom",
      "togglefullscreen",
    ]);
  });

  it("wires Minimize/Close under Window", () => {
    const [, , , windowMenu] = buildMenuTemplate();
    expect(windowMenu?.submenu).toEqual([
      { role: "minimize", accelerator: "CmdOrCtrl+M" },
      { role: "close", accelerator: "CmdOrCtrl+W" },
    ]);
  });

  it("every accelerator-bearing item has a non-empty accelerator string", () => {
    const template = buildMenuTemplate();
    for (const menu of template) {
      for (const item of menu.submenu ?? []) {
        if (item.type === "separator") continue;
        expect(item.accelerator).toBeTruthy();
      }
    }
  });
});

// cor-CORE.PROJECT-000007 (REQ-000031): File-menu project actions.
describe("buildMenuTemplate with project options", () => {
  function fileMenu(overrides: Partial<Parameters<typeof buildMenuTemplate>[0] & object> = {}) {
    const calls: [string, string | undefined][] = [];
    const [file] = buildMenuTemplate({
      recentProjects: [],
      isDefaultProject: true,
      onProjectAction: (action, path) => calls.push([action, path]),
      ...overrides,
    });
    return { items: file?.submenu ?? [], calls };
  }

  it("lists the project actions before Quit, with the standard accelerators", () => {
    const { items } = fileMenu();
    expect(items.map((i) => i.label ?? i.role ?? i.type)).toEqual([
      "New Project…",
      "Open Project…",
      "Open Recent",
      "separator",
      "Save",
      "Save As…",
      "Close Project",
      "separator",
      "quit",
    ]);
    const accel = Object.fromEntries(items.map((i) => [i.label, i.accelerator]));
    expect(accel).toMatchObject({
      "New Project…": "CmdOrCtrl+N",
      "Open Project…": "CmdOrCtrl+O",
      Save: "CmdOrCtrl+S",
      "Save As…": "CmdOrCtrl+Shift+S",
    });
  });

  it("disables Close Project on the default project", () => {
    expect(fileMenu().items.find((i) => i.label === "Close Project")?.enabled).toBe(false);
    expect(
      fileMenu({ isDefaultProject: false }).items.find((i) => i.label === "Close Project")?.enabled,
    ).toBe(true);
  });

  it("shows a disabled placeholder when there are no recent projects", () => {
    const recent = fileMenu().items.find((i) => i.label === "Open Recent")?.submenu;
    expect(recent).toEqual([{ label: "No recent projects", enabled: false }]);
  });

  it("routes clicks to the handler, recent entries with their path", () => {
    const { items, calls } = fileMenu({
      recentProjects: [{ name: "work", path: "/p/work.correlator" }],
    });
    items.find((i) => i.label === "Save")?.click?.();
    const recent = items.find((i) => i.label === "Open Recent")?.submenu ?? [];
    recent.find((i) => i.label === "work")?.click?.();
    recent.find((i) => i.label === "Clear Recent")?.click?.();
    expect(calls).toEqual([
      ["save", undefined],
      ["open-recent", "/p/work.correlator"],
      ["clear-recent", undefined],
    ]);
  });
});
