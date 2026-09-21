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
