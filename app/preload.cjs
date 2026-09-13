"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Every entry here must have a matching ipcMain.handle(...) registration
// in main.cjs with the same channel name -- see cor-CORE.SHELL-002's
// acceptance criteria. The renderer never gets nodeIntegration or a
// direct app/lib/ import; this bridge is the only path across the
// process boundary.
contextBridge.exposeInMainWorld("correlator", {
  listSumps: () => ipcRenderer.invoke("list-sumps"),
  queryRecords: (sumpId, params) => ipcRenderer.invoke("query-records", sumpId, params),
  downloadRecording: (params) => ipcRenderer.invoke("download-recording", params),
  downloadTrack: (params) => ipcRenderer.invoke("download-track", params),
  listDataSources: (sumpId) => ipcRenderer.invoke("list-data-sources", sumpId),
  setDataSourcePrivacy: (params) => ipcRenderer.invoke("set-data-source-privacy", params),
  promoteDataStream: (params) => ipcRenderer.invoke("promote-data-stream", params),
  // cor-CORE.PROVISION-006: the "Add Sump" chooser's backing actions --
  // all direct invoke/handle pairs, no push channel needed (each is a
  // user-triggered, awaited action; the renderer already knows when it
  // succeeds).
  detectDocker: () => ipcRenderer.invoke("detect-docker"),
  connectExistingSump: (params) => ipcRenderer.invoke("connect-existing-sump", params),
  installLocalSump: () => ipcRenderer.invoke("install-local-sump"),
  installRemoteSump: (params) => ipcRenderer.invoke("install-remote-sump", params),
  // cor-CORE.PROVISION-007: the switcher UI's backing actions.
  getPrimarySumpId: () => ipcRenderer.invoke("get-primary-sump-id"),
  selectPrimarySump: (params) => ipcRenderer.invoke("select-primary-sump", params),
  renameSump: (params) => ipcRenderer.invoke("rename-sump", params),
  uninstallSump: (params) => ipcRenderer.invoke("uninstall-sump", params),
});
