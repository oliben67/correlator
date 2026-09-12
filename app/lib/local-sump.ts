/**
 * Install a local Sump (cor-CORE.PROVISION-006's "Deploy" action, Docker
 * branch). Renamed from `auto-start.ts` -- this is no longer triggered
 * automatically on launch (see cor-CORE.PROVISION-005, retired), but
 * from an explicit user action in the "Add Sump" chooser.
 *
 * Ties cor-CORE.PROVISION-002's `detectLocalDocker`/`provisionLocal`,
 * cor-CORE.PROVISION-001's catalog, and cor-CORE.PROVISION-003's token
 * scheme together: builds from the bundled `server/` Dockerfile rather
 * than pulling from a registry (see provision.ts's `"build"` `ImageSource`
 * variant -- a registry pull would reliably fail today, since
 * cor-CORE.PACKAGING-003's release workflow has never published a
 * `:latest` tag). No `electron` import, mirroring provision.ts's own
 * injected-dependency style.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getOrCreateToken } from "./auth-token.ts";
import type { Catalog, SumpRow } from "./catalog.ts";
import { detectLocalDocker, provisionLocal, type SpawnFn } from "./provision.ts";

export const LOCAL_SUMP_ID = "local";
export const LOCAL_SUMP_NAME = "Local Sump";
export const LOCAL_SUMP_PORT = 8765;

/** True iff any existing Sump row is not `retired` -- i.e. a connection
 * already exists. Used to guard against installing a second local Sump
 * over an existing one. */
export function hasLiveSump(sumps: SumpRow[]): boolean {
  return sumps.some((s) => s.status !== "retired");
}

/** Dev-vs-packaged resolution for the bundled `server/` resources
 * directory (Dockerfile, docker-compose.yml, fluent-bit.conf, and the
 * Python build context) -- packaged via `app/package.json`'s
 * `build.extraResources`. */
export function resolveServerResourcesDir(isPackaged: boolean, resourcesPath?: string): string {
  if (isPackaged) {
    if (!resourcesPath) {
      throw new Error("resourcesPath is required when isPackaged is true");
    }
    return join(resourcesPath, "server");
  }
  // <repo-root>/app/lib/local-sump.ts -> <repo-root>/server
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "server");
}

export interface InstallLocalOptions {
  isPackaged: boolean;
  resourcesPath?: string;
  spawnFn?: SpawnFn;
  onLog?: (line: string) => void;
}

/** Installs a local Sump. Throws (does not silently no-op) if Docker is
 * unavailable or a live Sump already exists -- this is now a direct,
 * user-triggered action with someone waiting to see the result, not a
 * background heuristic that should fail quietly. `provisionLocal`'s own
 * failure propagates rather than being swallowed, for the same reason. */
export async function installLocalSump(
  catalog: Catalog,
  options: InstallLocalOptions,
): Promise<void> {
  const { isPackaged, resourcesPath, spawnFn, onLog } = options;

  if (hasLiveSump(catalog.listSumps())) {
    throw new Error("a Sump is already connected -- remove it before installing another");
  }

  const dockerAvailable = await detectLocalDocker(spawnFn);
  if (!dockerAvailable) {
    throw new Error("Docker is not available locally");
  }

  const composeFile = join(
    resolveServerResourcesDir(isPackaged, resourcesPath),
    "docker-compose.yml",
  );
  const apiToken = getOrCreateToken(LOCAL_SUMP_ID, catalog);

  await provisionLocal(
    catalog,
    {
      id: LOCAL_SUMP_ID,
      name: LOCAL_SUMP_NAME,
      port: LOCAL_SUMP_PORT,
      source: { type: "build", composeFile },
      apiToken,
      now: new Date().toISOString(),
    },
    { spawnFn, onLog },
  );
}
