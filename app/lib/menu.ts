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
 * implement or verify itself.
 *
 * cor-CORE.PROJECT-000007 (RM-000039): when given project options, the
 * File menu also carries the project actions (New/Open/Open Recent/Save/
 * Save As/Close Project). Their `click`s call back into the caller
 * (main.cjs -> the ProjectSession), which rebuilds the menu when the
 * recent list or the current project changes.
 */

export interface MenuTemplateItem {
  label?: string;
  role?: string;
  accelerator?: string;
  type?: "separator";
  enabled?: boolean;
  click?: () => void;
  submenu?: MenuTemplateItem[];
}

export type ProjectMenuAction =
  | "new"
  | "open"
  | "open-recent"
  | "clear-recent"
  | "save"
  | "save-as"
  | "close";

export interface ProjectMenuOptions {
  recentProjects: { name: string; path: string }[];
  isDefaultProject: boolean;
  onProjectAction: (action: ProjectMenuAction, path?: string) => void;
}

function projectItems(options: ProjectMenuOptions): MenuTemplateItem[] {
  const act = (action: ProjectMenuAction, path?: string) => () =>
    options.onProjectAction(action, path);
  const recent: MenuTemplateItem[] =
    options.recentProjects.length === 0
      ? [{ label: "No recent projects", enabled: false }]
      : [
          ...options.recentProjects.map((p) => ({
            label: p.name,
            click: act("open-recent", p.path),
          })),
          { type: "separator" as const },
          { label: "Clear Recent", click: act("clear-recent") },
        ];
  return [
    { label: "New Project…", accelerator: "CmdOrCtrl+N", click: act("new") },
    { label: "Open Project…", accelerator: "CmdOrCtrl+O", click: act("open") },
    { label: "Open Recent", submenu: recent },
    { type: "separator" },
    { label: "Save", accelerator: "CmdOrCtrl+S", click: act("save") },
    { label: "Save As…", accelerator: "CmdOrCtrl+Shift+S", click: act("save-as") },
    { label: "Close Project", enabled: !options.isDefaultProject, click: act("close") },
    { type: "separator" },
  ];
}

export function buildMenuTemplate(project?: ProjectMenuOptions): MenuTemplateItem[] {
  return [
    {
      label: "File",
      submenu: [
        ...(project ? projectItems(project) : []),
        { role: "quit", accelerator: "CmdOrCtrl+Q" },
      ],
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
