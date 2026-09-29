/**
 * Recently opened/created projects (cor-CORE.PROJECT-000007): at most
 * RECENT_LIMIT entries, newest first, one per path, never the default
 * project. Kept as a small JSON file next to the catalog, the same
 * `~/.correlator/` convention as the rest of the app's state -- modelled
 * on cttc's lib/cor-registry.js.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

export const RECENT_LIMIT = 10;

export interface RecentProject {
  path: string;
  /** Display name: the file name without `.correlator`. */
  name: string;
  /** ISO timestamp of the last open/create/save-as. */
  lastOpenedAt: string;
}

export function defaultRecentProjectsPath(): string {
  return join(homedir(), ".correlator", "recent-projects.json");
}

export function projectDisplayName(path: string): string {
  return basename(path).replace(/\.correlator$/i, "");
}

/** Missing or unreadable file, or malformed entries, read as empty. */
export function loadRecentProjects(file: string): RecentProject[] {
  if (!existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentProject =>
        typeof e === "object" &&
        e !== null &&
        typeof e.path === "string" &&
        typeof e.name === "string" &&
        typeof e.lastOpenedAt === "string",
    );
  } catch {
    return [];
  }
}

export function saveRecentProjects(file: string, list: readonly RecentProject[]): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(list, null, 2)}\n`);
}

/** Moves (or adds) `path` to the front. The default project is never listed. */
export function pushRecentProject(
  list: readonly RecentProject[],
  path: string,
  defaultPath: string,
  now: string,
): RecentProject[] {
  const target = resolve(path);
  if (target === resolve(defaultPath)) return [...list];
  const rest = list.filter((e) => resolve(e.path) !== target);
  return [{ path: target, name: projectDisplayName(target), lastOpenedAt: now }, ...rest].slice(
    0,
    RECENT_LIMIT,
  );
}

export function removeRecentProject(list: readonly RecentProject[], path: string): RecentProject[] {
  const target = resolve(path);
  return list.filter((e) => resolve(e.path) !== target);
}
