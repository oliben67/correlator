"use strict";

// Thin bootstrap: require("electron") -- CommonJS, matching cttc's own
// proven main.js exactly (Electron's ESM support for its own built-in
// module has known rough edges in some versions/setups, and this
// sandboxed dev environment can't launch a real, non-ELECTRON_RUN_AS_NODE
// Electron process to verify either way, so this takes the lower-risk,
// battle-tested path) -- then hands off to shell.ts, plain ESM TypeScript
// with zero direct `electron` dependency, where the actual window/IPC
// logic lives and is unit tested. Node's own type-stripping (unflagged
// since Node 22.6) loads shell.ts directly via the dynamic import()
// below, no build step needed.
const electron = require("electron");
const path = require("node:path");

// cor-CORE.PROJECT-004: `open-file` can fire on macOS before shell.ts's
// dynamic import() below resolves, so the listener is registered
// synchronously here and queues paths until classifyOpenedFile is
// available, rather than risking a missed event.
const pendingOpenFilePaths = [];
let classifyOpenedFileRef = null;
let mainWindowRef = null;

function handleOpenedPath(filePath) {
  const kind = classifyOpenedFileRef(filePath);
  if (!kind) return;
  // No renderer-side "open this file" listener exists yet (Phase 6 is
  // the data model + file I/O, not a project-browser UI -- see
  // REQ-000008's Open questions) -- focusing the existing window is the
  // whole observable effect for now; forwarding `{kind, filePath}` via
  // IPC is the natural next step once that UI exists.
  if (mainWindowRef) {
    mainWindowRef.show();
  }
}

electron.app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (classifyOpenedFileRef) {
    handleOpenedPath(filePath);
  } else {
    pendingOpenFilePaths.push(filePath);
  }
});

const gotSingleInstanceLock = electron.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", (_event, argv) => {
    const filePath = classifyOpenedFileRef
      ? argv.find((arg) => classifyOpenedFileRef(arg))
      : undefined;
    if (filePath) handleOpenedPath(filePath);
  });
}

async function bootstrap() {
  const { createWindow, registerIpcHandlers, registerAppLifecycle, classifyOpenedFile } =
    await import("./shell.ts");
  const { buildMenuTemplate } = await import("./lib/menu.ts");
  classifyOpenedFileRef = classifyOpenedFile;
  for (const filePath of pendingOpenFilePaths.splice(0)) {
    handleOpenedPath(filePath);
  }

  registerAppLifecycle(electron);

  electron.app.whenReady().then(async () => {
    // RM-000028: role-based items only (undo/copy/toggleDevTools/etc.) --
    // Electron wires their real behavior itself, so this is safe to set
    // before the window exists.
    electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(buildMenuTemplate()));

    // cor-CORE.PROVISION-006: isPackaged/resourcesPath are only known
    // here (real electron.app state) -- threaded through so the
    // install-local-sump/install-remote-sump handlers can resolve the
    // bundled server/ resources directory. RM-000029: preloadPath/
    // indexHtmlPath are threaded the same way, for open-detached-panel.
    const preloadPath = path.join(__dirname, "preload.cjs");
    const indexHtmlPath = path.join(__dirname, "renderer", "index.html");
    await registerIpcHandlers(electron, undefined, undefined, undefined, {
      isPackaged: electron.app.isPackaged,
      resourcesPath: process.resourcesPath,
      preloadPath,
      indexHtmlPath,
    });
    mainWindowRef = await createWindow(electron, { preloadPath, indexHtmlPath });
  });
}

bootstrap();
