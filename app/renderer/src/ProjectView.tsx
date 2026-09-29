import { useSetAtom } from "jotai/react";
import { type CSSProperties, useCallback, useEffect, useRef } from "react";
import { Button } from "./components/Button.js";
import { Panel } from "./components/Panel.js";
import { viewAtom } from "./correlate/atoms.js";
import type { ProjectSummary, RecentProjectSummary, SumpSummary } from "./correlator-api.js";
import { ProjectIcon } from "./icons.js";
import { ProjectViewer } from "./ProjectViewer.js";
import {
  canBindProject,
  groupReferences,
  projectModeLabel,
  referenceLabel,
  useProject,
} from "./project.js";
import { unionRange, useProjectArchives, viewStateOf } from "./projectTracks.js";

// cor-CORE.PROJECT-000007 (REQ-000031, RM-000039): the project browser.
// Every action here runs on the main process's ProjectSession -- the same
// one the File menu uses -- and reports its outcome as a notification
// from there, so this view only asks and re-reads.

export type ProjectAction = "new" | "open" | "save" | "save-as" | "close" | "bind";

const badgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "1px 8px",
  borderRadius: 999,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  fontSize: "0.85em",
};

export interface ProjectPanelProps {
  project: ProjectSummary;
  recent: readonly RecentProjectSummary[];
  sumps: readonly SumpSummary[];
  activeSumpId: string | null;
  onAction: (action: ProjectAction) => void;
  onOpenRecent: (path: string) => void;
  onForgetRecent: (path: string) => void;
}

export function ProjectPanel({
  project,
  recent,
  sumps,
  activeSumpId,
  onAction,
  onOpenRecent,
  onForgetRecent,
}: ProjectPanelProps) {
  const groups = groupReferences(project);
  const activeSumpName = sumps.find((s) => s.id === activeSumpId)?.name ?? activeSumpId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProjectIcon size={22} />
          <h2 style={{ margin: 0, fontSize: "1.2em" }}>{project.name}</h2>
          <span data-mode={project.mode} style={badgeStyle}>
            {projectModeLabel(project, sumps)}
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.85em", wordBreak: "break-all" }}>
          {project.path}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button onClick={() => onAction("new")}>New…</Button>
          <Button onClick={() => onAction("open")}>Open…</Button>
          <Button onClick={() => onAction("save")}>Save</Button>
          <Button onClick={() => onAction("save-as")}>Save As…</Button>
          <Button onClick={() => onAction("close")} disabled={project.isDefault}>
            Close
          </Button>
        </div>
        {project.mode === "unbound" && (
          <div style={{ marginTop: 12 }}>
            <Button
              variant="primary"
              onClick={() => onAction("bind")}
              disabled={!canBindProject(project, activeSumpId)}
            >
              {activeSumpId ? `Bind to ${activeSumpName}` : "Bind to active data stream"}
            </Button>
            <p style={{ color: "var(--muted)", fontSize: "0.85em", marginBottom: 0 }}>
              A bound project only accepts recordings and tracks from that data stream, and the
              binding can't be changed later. An unbound project binds itself to the first data
              stream it records from.
            </p>
          </div>
        )}
      </Panel>

      <Panel>
        <h3 style={{ marginTop: 0 }}>References ({project.references.length})</h3>
        {groups.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No recordings or tracks yet. Snapshot exports and recording sessions are added here.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.folder.join("/") || "(unfiled)"} style={{ marginBottom: 8 }}>
              {group.folder.length > 0 && (
                <div style={{ fontWeight: 600 }}>📁 {group.folder.join(" / ")}</div>
              )}
              <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                {group.items.map((item) => (
                  <li key={item} title={item}>
                    {referenceLabel(item)}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Panel>

      <Panel>
        <h3 style={{ marginTop: 0 }}>Recent projects</h3>
        {recent.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No recent projects.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {recent.map((entry) => (
              <li
                key={entry.path}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}
              >
                <Button
                  onClick={() => onOpenRecent(entry.path)}
                  disabled={entry.path === project.path}
                  title={entry.path}
                >
                  {entry.name}
                </Button>
                <span style={{ color: "var(--muted)", fontSize: "0.85em" }}>
                  {new Date(entry.lastOpenedAt).toLocaleString()}
                </span>
                <Button
                  onClick={() => onForgetRecent(entry.path)}
                  aria-label={`Forget ${entry.name}`}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export interface ProjectViewProps {
  sumps: readonly SumpSummary[];
  /** The active, correlatable Sump the Bind action targets, if any. */
  activeSumpId: string | null;
}

export function ProjectView({ sumps, activeSumpId }: ProjectViewProps) {
  const { project, recent } = useProject();
  if (!project) return <p>Loading project…</p>;
  return (
    <LoadedProjectView
      project={project}
      recent={recent}
      sumps={sumps}
      activeSumpId={activeSumpId}
    />
  );
}

function LoadedProjectView({
  project,
  recent,
  sumps,
  activeSumpId,
}: ProjectViewProps & { project: ProjectSummary; recent: RecentProjectSummary[] }) {
  const api = window.correlator;
  // cor-CORE.PROJECT-000008: the project's own tracks/recordings.
  const archives = useProjectArchives(project.references);
  const setView = useSetAtom(viewAtom);

  const fitView = useCallback(() => {
    const items = project.references.flatMap((path) => {
      const entry = archives[path];
      const { visible, delayMs } = viewStateOf(project, path);
      if (!visible || !entry || entry.kind === "error") return [];
      return [{ archive: entry.kind === "track" ? entry.track : entry.recording, delayMs }];
    });
    const range = unionRange(items);
    if (range) setView(range);
    return range !== null;
  }, [archives, project, setView]);

  // Fit once each time the current project changes, as soon as something
  // visible has loaded.
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (fittedFor.current === project.path) return;
    if (fitView()) fittedFor.current = project.path;
  }, [fitView, project.path]);

  const run = (action: ProjectAction) => {
    switch (action) {
      case "new":
        return api.newProject();
      case "open":
        return api.openProject();
      case "save":
        return api.saveProject();
      case "save-as":
        return api.saveProjectAs();
      case "close":
        return api.closeProject();
      case "bind": {
        if (!activeSumpId) return;
        const name = sumps.find((s) => s.id === activeSumpId)?.name ?? activeSumpId;
        // cor-CORE.PROJECT-000006: a binding is permanent -- ask first.
        if (!window.confirm(`Bind "${project.name}" to ${name}? This can't be undone.`)) return;
        return api.bindProjectContext({ sumpId: activeSumpId, dataStreamId: activeSumpId });
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 960 }}>
      <ProjectPanel
        project={project}
        recent={recent}
        sumps={sumps}
        activeSumpId={activeSumpId}
        onAction={(action) => {
          void run(action);
        }}
        onOpenRecent={(path) => {
          void api.openProject(path);
        }}
        onForgetRecent={(path) => {
          void api.forgetRecentProject(path);
        }}
      />
      <ProjectViewer
        project={project}
        archives={archives}
        onToggle={(path, visible) => {
          void api.setTrackViewState({ path, visible });
        }}
        onDelay={(path, delayMs) => {
          void api.setTrackViewState({ path, delayMs });
        }}
        onFit={() => {
          fitView();
        }}
      />
    </div>
  );
}
