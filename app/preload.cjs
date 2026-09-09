"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Every entry here must have a matching ipcMain.handle(...) registration
// in main.cjs with the same channel name -- see cor-CORE.SHELL-002's
// acceptance criteria. The renderer never gets nodeIntegration or a
// direct app/lib/ import; this bridge is the only path across the
// process boundary.
contextBridge.exposeInMainWorld("correlator", {
  listSumps: () => ipcRenderer.invoke("list-sumps"),
  queryRecords: (sumpId, dockerHost, params) =>
    ipcRenderer.invoke("query-records", sumpId, dockerHost, params),
  downloadRecording: (params) => ipcRenderer.invoke("download-recording", params),
  downloadTrack: (params) => ipcRenderer.invoke("download-track", params),
  listDataSources: (sumpId) => ipcRenderer.invoke("list-data-sources", sumpId),
  setDataSourcePrivacy: (params) => ipcRenderer.invoke("set-data-source-privacy", params),
  promoteDataStream: (params) => ipcRenderer.invoke("promote-data-stream", params),
});
