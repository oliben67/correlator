/**
 * The current project (cor-CORE.PROJECT-000007): exactly one at a time,
 * the default project (cor-CORE.PROJECT-000002) at start. Every way of
 * changing it -- File menu, Project view, a `.correlator` opened from the
 * OS -- goes through this one object, so the semantics live in one place:
 * New / Open / Open Recent / Save / Save As / Close, and the explicit
 * one-way live bind (cor-CORE.PROJECT-000006).
 *
 * Free of any `electron` import (this project's lib/ convention): the
 * native open/save dialogs are injected. Outcomes are reported as notices
 * (shown as status-bar notifications, cor-CORE.SHELL-000007) rather than
 * thrown, because menu-initiated actions have no caller to catch them.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  bindLiveContext,
  contextsEqual,
  createProject,
  defaultProjectPath,
  ensureDefaultProject,
  loadProject,
  type Project,
  type ProjectContext,
  saveProject,
  saveProjectAs,
  type VirtualFolder,
} from "./project.ts";
import {
  defaultRecentProjectsPath,
  loadRecentProjects,
  projectDisplayName,
  pushRecentProject,
  type RecentProject,
  removeRecentProject,
  saveRecentProjects,
} from "./recent-projects.ts";

export interface ProjectDialog {
  /** An existing `*.correlator` to open, or null if cancelled. */
  pickOpenPath(): Promise<string | null>;
  /** Where to write a project, or null if cancelled. */
  pickSavePath(suggestedPath: string): Promise<string | null>;
}

export interface ProjectNotice {
  message: string;
  severity: "info" | "error";
}

export type ProjectMode = "default" | "unbound" | "bound";

export interface ProjectSummary {
  path: string;
  name: string;
  isDefault: boolean;
  mode: ProjectMode;
  context: ProjectContext | null;
  references: string[];
  folders: VirtualFolder[];
}

export interface ProjectSessionOptions {
  defaultPath?: string;
  recentPath?: string;
  dialog?: ProjectDialog;
  now?: () => string;
}

const EXT = ".correlator";

function withExtension(path: string): string {
  return path.toLowerCase().endsWith(EXT) ? path : `${path}${EXT}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ProjectSession {
  private readonly defaultPath: string;
  private readonly recentPath: string;
  private readonly dialog: ProjectDialog | undefined;
  private readonly now: () => string;
  private current: string;
  private readonly changeListeners = new Set<() => void>();
  private readonly noticeListeners = new Set<(notice: ProjectNotice) => void>();

  constructor(options: ProjectSessionOptions = {}) {
    this.defaultPath = resolve(options.defaultPath ?? defaultProjectPath());
    this.recentPath = options.recentPath ?? defaultRecentProjectsPath();
    this.dialog = options.dialog;
    this.now = options.now ?? (() => new Date().toISOString());
    this.current = this.defaultPath;
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  onNotice(listener: (notice: ProjectNotice) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  get currentPath(): string {
    return this.current;
  }

  get isDefault(): boolean {
    return this.current === this.defaultPath;
  }

  /** Where a download should go: undefined means the default project,
   * which cor-CORE.PROJECT-000006 exempts from isolation. */
  downloadTarget(): string | undefined {
    return this.isDefault ? undefined : this.current;
  }

  recent(): RecentProject[] {
    return loadRecentProjects(this.recentPath);
  }

  summary(): ProjectSummary {
    const project = this.loadCurrent();
    const context = project.context ?? null;
    return {
      path: this.current,
      name: this.isDefault ? "Default project" : projectDisplayName(this.current),
      isDefault: this.isDefault,
      mode: this.isDefault ? "default" : context ? "bound" : "unbound",
      context,
      references: [...project.references],
      folders: project.folders,
    };
  }

  async newProject(path?: string): Promise<boolean> {
    const target = await this.resolvePath(path, () =>
      this.dialog?.pickSavePath(join(dirname(this.defaultPath), `Untitled${EXT}`)),
    );
    if (!target) return false;
    if (target === this.defaultPath) {
      this.notice("The default project already exists; choose another file", "error");
      return false;
    }
    return this.attempt(`Could not create ${projectDisplayName(target)}`, () => {
      saveProject(target, createProject());
      this.becomeCurrent(target);
      this.notice(`Created project "${projectDisplayName(target)}"`);
    });
  }

  async open(path?: string): Promise<boolean> {
    const target = await this.resolvePath(path, () => this.dialog?.pickOpenPath());
    if (!target) return false;
    if (target === this.defaultPath) {
      this.close();
      return true;
    }
    if (!existsSync(target)) {
      this.writeRecent(removeRecentProject(this.recent(), target));
      this.notice(`Project not found: ${target} (removed from recent projects)`, "error");
      this.emitChange();
      return false;
    }
    return this.attempt(`Could not open ${projectDisplayName(target)}`, () => {
      const project = loadProject(target);
      if (!Array.isArray(project?.references) || !Array.isArray(project?.folders)) {
        throw new Error("not a correlator project file");
      }
      this.becomeCurrent(target);
      this.notice(`Opened project "${projectDisplayName(target)}"`);
    });
  }

  async save(): Promise<boolean> {
    // cor-CORE.PROJECT-000002: the default project is never what Save
    // overwrites into another file -- Save on it means Save As.
    if (this.isDefault) return this.saveAs();
    return this.attempt(`Could not save ${projectDisplayName(this.current)}`, () => {
      saveProject(this.current, loadProject(this.current));
      this.notice(`Saved project "${projectDisplayName(this.current)}"`);
    });
  }

  async saveAs(path?: string): Promise<boolean> {
    const suggested = this.isDefault
      ? join(dirname(this.defaultPath), `Untitled${EXT}`)
      : this.current.replace(/\.correlator$/i, ` copy${EXT}`);
    const target = await this.resolvePath(path, () => this.dialog?.pickSavePath(suggested));
    if (!target) return false;
    if (target === this.defaultPath) {
      this.notice("Save As can't overwrite the default project", "error");
      return false;
    }
    if (target === this.current) return this.save();
    return this.attempt(`Could not save ${projectDisplayName(target)}`, () => {
      saveProjectAs(target, this.loadCurrent());
      this.becomeCurrent(target);
      this.notice(`Saved project as "${projectDisplayName(target)}"`);
    });
  }

  close(): void {
    if (this.isDefault) return;
    const name = projectDisplayName(this.current);
    this.current = this.defaultPath;
    this.notice(`Closed "${name}"; the default project is current`);
    this.emitChange();
  }

  /** The explicit one-way live bind (cor-CORE.PROJECT-000006). */
  bind(context: ProjectContext): boolean {
    if (this.isDefault) {
      this.notice("The default project can't be bound to a data stream", "error");
      return false;
    }
    const name = projectDisplayName(this.current);
    const project = this.loadCurrent();
    if (project.context) {
      if (contextsEqual(project.context, context)) return true;
      this.notice(`"${name}" is already bound to another data stream`, "error");
      return false;
    }
    return this.attempt(`Could not bind ${name}`, () => {
      saveProject(this.current, bindLiveContext(project, context));
      this.notice(`Bound "${name}" to Sump ${context.sumpId}, data stream ${context.dataStreamId}`);
      this.emitChange();
    });
  }

  forgetRecent(path: string): void {
    this.writeRecent(removeRecentProject(this.recent(), path));
    this.emitChange();
  }

  clearRecent(): void {
    this.writeRecent([]);
    this.emitChange();
  }

  private loadCurrent(): Project {
    if (this.isDefault) return ensureDefaultProject(this.defaultPath);
    try {
      return loadProject(this.current);
    } catch (err) {
      // The current file vanished or broke underneath us: fall back to
      // the default project rather than leaving the app pointing at it.
      const name = projectDisplayName(this.current);
      this.current = this.defaultPath;
      this.notice(
        `Could not read "${name}" (${errorMessage(err)}); the default project is current`,
        "error",
      );
      this.emitChange();
      return ensureDefaultProject(this.defaultPath);
    }
  }

  private async resolvePath(
    path: string | undefined,
    pick: () => Promise<string | null> | undefined,
  ): Promise<string | null> {
    const chosen = path ?? (await pick()) ?? null;
    return chosen ? resolve(withExtension(chosen)) : null;
  }

  private becomeCurrent(path: string): void {
    this.current = path;
    this.writeRecent(pushRecentProject(this.recent(), path, this.defaultPath, this.now()));
    this.emitChange();
  }

  private attempt(failure: string, work: () => void): boolean {
    try {
      work();
      return true;
    } catch (err) {
      this.notice(`${failure}: ${errorMessage(err)}`, "error");
      return false;
    }
  }

  private writeRecent(list: RecentProject[]): void {
    try {
      saveRecentProjects(this.recentPath, list);
    } catch {
      // The recent list is a convenience; failing to write it must not
      // fail the project action itself.
    }
  }

  private notice(message: string, severity: ProjectNotice["severity"] = "info"): void {
    for (const listener of this.noticeListeners) listener({ message, severity });
  }

  private emitChange(): void {
    for (const listener of this.changeListeners) listener();
  }
}
