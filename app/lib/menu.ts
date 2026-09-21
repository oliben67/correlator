/**
 * The application menu bar template (RM-000028) -- correlator had no
 * menu system at all before this. Returns a plain, Electron-shaped
 * template (duck-typed against `Menu.buildFromTemplate`'s own
 * `MenuItemConstructorOptions[]`) rather than importing `electron`
 * itself, matching this project's `lib/` convention (`shell.ts`'s own
 * "zero direct electron dependency" design) -- keeps this pure and
 * testable without a real Electron `Menu` instance.
 *
 * Every item here uses Electron's built-in role-based behavior
 * (`role: "undo"`, `role: "copy"`, `role: "toggleDevTools"`, etc.) --
 * well-tested platform behavior, not custom logic this module has to
 * implement or verify itself. Deliberately excludes cttc's project-file
 * actions (Save/Open/Recent) -- correlator has no project-browser UI
 * yet for those to act on (a later roadmap item, not this one).
 */

export interface MenuTemplateItem {
  label?: string;
  role?: string;
  accelerator?: string;
  type?: "separator";
  submenu?: MenuTemplateItem[];
}

export function buildMenuTemplate(): MenuTemplateItem[] {
  return [
    {
      label: "File",
      submenu: [{ role: "quit", accelerator: "CmdOrCtrl+Q" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", accelerator: "CmdOrCtrl+Z" },
        { role: "redo", accelerator: "CmdOrCtrl+Shift+Z" },
        { type: "separator" },
        { role: "cut", accelerator: "CmdOrCtrl+X" },
        { role: "copy", accelerator: "CmdOrCtrl+C" },
        { role: "paste", accelerator: "CmdOrCtrl+V" },
        { role: "selectAll", accelerator: "CmdOrCtrl+A" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", accelerator: "CmdOrCtrl+R" },
        { role: "toggleDevTools", accelerator: "F12" },
        { type: "separator" },
        { role: "zoomIn", accelerator: "CmdOrCtrl+=" },
        { role: "zoomOut", accelerator: "CmdOrCtrl+-" },
        { role: "resetZoom", accelerator: "CmdOrCtrl+0" },
        { type: "separator" },
        { role: "togglefullscreen", accelerator: "F11" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize", accelerator: "CmdOrCtrl+M" },
        { role: "close", accelerator: "CmdOrCtrl+W" },
      ],
    },
  ];
}
