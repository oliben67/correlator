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
  // cor-CORE.ARCHIVE-000003: live recording session actions.
  startRecordingSession: (params) => ipcRenderer.invoke("start-recording-session", params),
  pauseRecordingSession: (params) => ipcRenderer.invoke("pause-recording-session", params),
  resumeRecordingSession: (params) => ipcRenderer.invoke("resume-recording-session", params),
  stopRecordingSession: (params) => ipcRenderer.invoke("stop-recording-session", params),
  getRecordingSession: (params) => ipcRenderer.invoke("get-recording-session", params),
  getInterruptedSessions: () => ipcRenderer.invoke("get-interrupted-sessions"),
  dismissInterruptedSession: (params) => ipcRenderer.invoke("dismiss-interrupted-session", params),
  // cor-CORE.EVENT-000001/-000002: event trigger actions.
  listEventRules: (params) => ipcRenderer.invoke("list-event-rules", params),
  createEventRule: (params) => ipcRenderer.invoke("create-event-rule", params),
  toggleEventRule: (params) => ipcRenderer.invoke("toggle-event-rule", params),
  deleteEventRule: (params) => ipcRenderer.invoke("delete-event-rule", params),
  evaluateEventRules: (params) => ipcRenderer.invoke("evaluate-event-rules", params),
  // cor-CORE.SHELL-000005: app preferences actions.
  getPreferences: () => ipcRenderer.invoke("get-preferences"),
  setPreferences: (updates) => ipcRenderer.invoke("set-preferences", updates),
});
