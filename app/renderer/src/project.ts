import { useCallback, useEffect, useState } from "react";
import type {
  ProjectFolderSummary,
  ProjectSummary,
  RecentProjectSummary,
  SumpSummary,
} from "./correlator-api.js";

// cor-CORE.PROJECT-000007 (REQ-000031): renderer side of the project
// browser. The current project lives in the main process (one
// ProjectSession for the File menu, this view and OS-opened files); this
// window mirrors it and re-reads it on every `project-changed` push.

/** The mode badge text: "Default project" / "Not bound" / "Bound to …". */
export function projectModeLabel(project: ProjectSummary, sumps: readonly SumpSummary[]): string {
  if (project.mode === "default") return "Default project";
  if (project.mode === "unbound" || !project.context) return "Not bound";
  const { sumpId, dataStreamId } = project.context;
  const sumpName = sumps.find((s) => s.id === sumpId)?.name ?? sumpId;
  return dataStreamId === sumpId
    ? `Bound to ${sumpName}`
    : `Bound to ${sumpName} · data stream ${dataStreamId}`;
}

/** Bind is offered only for an unbound, non-default project and an
 * active Sump to bind it to (cor-CORE.PROJECT-000006's one-way bind). */
export function canBindProject(project: ProjectSummary, activeSumpId: string | null): boolean {
  return project.mode === "unbound" && activeSumpId !== null;
}

export interface ReferenceGroup {
  /** Folder path from the root; [] for references in no folder. */
  folder: string[];
  items: string[];
}

/** The references grouped by virtual folder (cor-CORE.PROJECT-000001),
 * depth-first, with references in no folder first. */
export function groupReferences(project: ProjectSummary): ReferenceGroup[] {
  const groups: ReferenceGroup[] = [];
  const filed = new Set<string>();
  const walk = (folders: ProjectFolderSummary[], path: string[]) => {
    for (const folder of folders) {
      const here = [...path, folder.name];
      if (folder.items.length > 0) groups.push({ folder: here, items: [...folder.items] });
      for (const item of folder.items) filed.add(item);
      walk(folder.folders, here);
    }
  };
  walk(project.folders, []);
  const unfiled = project.references.filter((ref) => !filed.has(ref));
  return unfiled.length > 0 ? [{ folder: [], items: unfiled }, ...groups] : groups;
}

/** The file name of a reference path, for display. */
export function referenceLabel(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export interface ProjectState {
  project: ProjectSummary | null;
  recent: RecentProjectSummary[];
}

/** Mirrors the main process's current project and recent list. */
export function useProject(): ProjectState & { reload: () => void } {
  const [state, setState] = useState<ProjectState>({ project: null, recent: [] });

  const reload = useCallback(() => {
    Promise.all([window.correlator.getCurrentProject(), window.correlator.listRecentProjects()])
      .then(([project, recent]) => setState({ project, recent }))
      .catch(() => {
        // Keep what's shown; the next project-changed push retries.
      });
  }, []);

  useEffect(() => {
    reload();
    return window.correlator.onProjectChanged(reload);
  }, [reload]);

  return { ...state, reload };
}
