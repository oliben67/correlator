/**
 * `*.correlator` project files (cor-CORE.PROJECT-001) and the
 * always-present default project (cor-CORE.PROJECT-002). Modeled on VS
 * Code's `.code-workspace`: a flat list of referenced item paths plus a
 * virtual-folder tree for logical grouping, independent of where the
 * referenced files physically live. A project never copies or embeds
 * the files it references, only paths to them -- every mutator here is
 * a pure function over a `Project` value; only `saveProject`/
 * `ensureDefaultProject` touch disk.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface VirtualFolder {
  name: string;
  items: string[];
  folders: VirtualFolder[];
}

export interface Project {
  references: string[];
  folders: VirtualFolder[];
}

export function createProject(): Project {
  return { references: [], folders: [] };
}

export function addReference(project: Project, path: string): Project {
  if (project.references.includes(path)) return project;
  return { ...project, references: [...project.references, path] };
}

function removeFromFolders(folders: VirtualFolder[], path: string): VirtualFolder[] {
  return folders.map((folder) => ({
    ...folder,
    items: folder.items.filter((item) => item !== path),
    folders: removeFromFolders(folder.folders, path),
  }));
}

export function removeReference(project: Project, path: string): Project {
  return {
    references: project.references.filter((ref) => ref !== path),
    folders: removeFromFolders(project.folders, path),
  };
}

function insertIntoPath(
  folders: VirtualFolder[],
  folderPath: string[],
  path: string,
): VirtualFolder[] {
  const [head, ...rest] = folderPath;
  if (head === undefined) {
    return folders;
  }
  let found = false;
  const updated = folders.map((folder) => {
    if (folder.name !== head) return folder;
    found = true;
    if (rest.length === 0) {
      return folder.items.includes(path) ? folder : { ...folder, items: [...folder.items, path] };
    }
    return { ...folder, folders: insertIntoPath(folder.folders, rest, path) };
  });
  if (found) return updated;
  // Folder didn't exist at this level -- create it (and any nested
  // folders the rest of folderPath names) rather than requiring the
  // caller to pre-create the whole path.
  const newFolder: VirtualFolder = {
    name: head,
    items: rest.length === 0 ? [path] : [],
    folders: rest.length === 0 ? [] : insertIntoPath([], rest, path),
  };
  return [...folders, newFolder];
}

/**
 * Moves `path` (already a reference, per `cor-CORE.PROJECT-001`) into
 * the virtual folder named by `folderPath` (created if it doesn't
 * exist yet), removing it from wherever it currently sits in the tree
 * first. Never touches `project.references` or any file on disk --
 * purely a reorganization of the tree.
 */
export function moveToFolder(project: Project, path: string, folderPath: string[]): Project {
  const withoutPath = removeFromFolders(project.folders, path);
  return { ...project, folders: insertIntoPath(withoutPath, folderPath, path) };
}

export function loadProject(path: string): Project {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Project;
}

export function saveProject(path: string, project: Project): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(project, null, 2), "utf8");
}

/** Writes `project` to a new, separately-managed file -- never the
 * default project's own file, and never moves it. */
export function saveProjectAs(newPath: string, project: Project): void {
  saveProject(newPath, project);
}

export function defaultProjectPath(): string {
  // Mirrors cor-CORE.PROVISION-002's `~/.correlator/catalog.db`
  // convention (`os.homedir()`-based, not Electron's
  // `app.getPath("userData")`).
  return join(homedir(), ".correlator", "default.correlator");
}

/** Loads the default project if it already exists, otherwise creates
 * an empty one at `path` (default: `defaultProjectPath()`) -- never
 * overwrites an existing (possibly already-modified) one. */
export function ensureDefaultProject(path: string = defaultProjectPath()): Project {
  if (existsSync(path)) {
    return loadProject(path);
  }
  const project = createProject();
  saveProject(path, project);
  return project;
}
