/**
 * Docker-detect and provisioning flow (cor-CORE.PROVISION-002).
 *
 * Ported from cttc's `app/lib/server-provision.js`
 * (`ensureLocalContainer`/`ensureRemoteContainer`/`uninstallLocalContainer`/
 * `uninstallRemoteContainer`). Shells out to the system `docker`/`ssh`/`scp`
 * binaries via `child_process` — no new npm dependency (env-DEPS-002).
 *
 * cttc's own bundled-resources image resolution (`releases/_shared`/
 * `releases/_repo`, tied to electron-builder `extraResources`) isn't
 * ported: that packaging infrastructure doesn't exist in correlator yet
 * (Phase 4). Callers here pass an explicit `ImageSource` — which compose
 * file to use is part of that source, not re-derived — so the historical
 * `br-PROV-007` bug (uninstall silently resolving a *different* image
 * than the one actually provisioned) can't recur: uninstall always uses
 * the `ImageSource` recorded in the sump's own catalog document, never a
 * freshly re-resolved default.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { Catalog } from "./catalog.ts";
import { transition } from "./lifecycle.ts";
import { waitForHttpOk } from "./net-wait.ts";

export type ImageSource =
  | { type: "tarball"; tarballPath: string; composeFile: string; imageRef?: string }
  | { type: "registry"; ref: string; composeFile: string }
  | { type: "build"; composeFile: string };

export interface SshTarget {
  sshTarget: string;
  sshKey: string | null;
  sshPort?: number;
}

export type SpawnFn = typeof spawn;

interface RunOptions {
  spawnFn?: SpawnFn;
  onLog?: (line: string) => void;
  env?: NodeJS.ProcessEnv;
}

function run(cmd: string, args: string[], options: RunOptions = {}): Promise<void> {
  const { spawnFn = spawn, onLog, env } = options;
  const line = `${cmd} ${args.join(" ")}`;
  onLog?.(`$ ${line}`);
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawnFn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...(env ? { env } : {}),
    });
    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d;
      onLog?.(String(d));
    });
    proc.on("error", (err) => {
      onLog?.(`  error: ${err.message}`);
      reject(new Error(`could not run ${cmd}: ${err.message}`));
    });
    proc.on("exit", (code) => {
      if (code === 0) {
        onLog?.("  -> exit 0");
        resolve();
      } else {
        onLog?.(`  -> exit ${code}`);
        reject(
          new Error(
            `${cmd} ${args.join(" ")} exited (code ${code}): ${stderr.trim() || "no output"}`,
          ),
        );
      }
    });
  });
}

// BUG-0025 (br-NET-004): a container binding 0.0.0.0/network_mode: host is
// reachable by anything else on the LAN, not just this machine -- reject
// it before provisioning proceeds rather than discovering it later.
export class NetworkExposureError extends Error {}

export async function validateComposeFile(composeFilePath: string): Promise<void> {
  const content = await readFile(composeFilePath, "utf8");
  if (/network_mode:\s*["']?host["']?/.test(content)) {
    throw new NetworkExposureError(`${composeFilePath} sets network_mode: host`);
  }
  if (/["']?0\.0\.0\.0["']?\s*:/.test(content)) {
    throw new NetworkExposureError(`${composeFilePath} binds a port on 0.0.0.0`);
  }
}

function sshExecArgs(target: SshTarget): string[] {
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=10",
  ];
  if (target.sshKey) args.push("-i", target.sshKey, "-o", "IdentitiesOnly=yes");
  if (target.sshPort) args.push("-p", String(target.sshPort));
  args.push(target.sshTarget);
  return args;
}

function scpArgs(target: SshTarget): string[] {
  const args: string[] = [];
  if (target.sshKey) args.push("-i", target.sshKey);
  if (target.sshPort) args.push("-P", String(target.sshPort));
  return args;
}

function hostFromTarget(sshTarget: string): string {
  const at = sshTarget.lastIndexOf("@");
  return at === -1 ? sshTarget : sshTarget.slice(at + 1);
}

export async function detectLocalDocker(spawnFn: SpawnFn = spawn): Promise<boolean> {
  try {
    await run("docker", ["info"], { spawnFn });
    return true;
  } catch {
    return false;
  }
}

interface ProvisionCommonOptions {
  spawnFn?: SpawnFn;
  onLog?: (line: string) => void;
}

export interface LocalProvisionParams {
  id: string;
  name: string;
  port?: number;
  source: ImageSource;
  apiToken?: string | null;
  now: string;
}

function sumpDocument(source: ImageSource, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ imageSource: source, ...extra });
}

export async function provisionLocal(
  catalog: Catalog,
  params: LocalProvisionParams,
  options: ProvisionCommonOptions = {},
): Promise<void> {
  const { spawnFn = spawn, onLog } = options;
  const port = params.port ?? 8765;

  catalog.upsertSump({
    id: params.id,
    name: params.name,
    connectionType: "local",
    host: null,
    port,
    status: "provisioning",
    authToken: params.apiToken ?? null,
    catalogJson: sumpDocument(params.source, { name: params.name }),
    createdAt: params.now,
    lastSeenAt: null,
  });

  try {
    await validateComposeFile(params.source.composeFile);

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (params.apiToken) env.CORRELATOR_API_TOKEN = params.apiToken;
    if (params.source.type === "tarball") {
      await run("docker", ["load", "-i", params.source.tarballPath], { spawnFn, onLog });
    } else if (params.source.type === "registry") {
      env.CORRELATOR_IMAGE = params.source.ref;
      await run("docker", ["pull", params.source.ref], { spawnFn, onLog });
    }
    // "build": no pull/load step -- `docker compose up -d` below builds
    // from the compose file's own `build:` config when the tagged image
    // isn't present locally yet (standard Compose behavior), and reuses
    // it unchanged on later launches once it's been built once.
    await run("docker", ["compose", "-f", params.source.composeFile, "up", "-d"], {
      spawnFn,
      onLog,
      env,
    });

    onLog?.(`$ waiting for the container to become ready (http://127.0.0.1:${port}/health) ...`);
    await waitForHttpOk(`http://127.0.0.1:${port}/health`, {
      timeoutMs: 30000,
      ...(params.apiToken ? { headers: { "X-Correlator-Token": params.apiToken } } : {}),
    });

    catalog.setSumpStatus(params.id, transition("provisioning", "provision_succeeded"));
    catalog.touchSump(params.id, new Date().toISOString());
  } catch (err) {
    catalog.setSumpStatus(params.id, transition("provisioning", "provision_failed"));
    throw err;
  }
}

export interface RemoteProvisionParams {
  id: string;
  name: string;
  target: SshTarget;
  remotePort: number;
  host?: string;
  // "build" is deliberately excluded: shipping a full build context over
  // SSH to build remotely is out of scope -- remote provisioning always
  // ships a tarball or pulls from a registry on the remote host.
  source: Exclude<ImageSource, { type: "build" }>;
  apiToken?: string | null;
  now: string;
}

interface RemoteProvisionOptions extends ProvisionCommonOptions {
  sshBin?: string;
  scpBin?: string;
}

const REMOTE_DIR = ".correlator-sump";

export async function provisionRemote(
  catalog: Catalog,
  params: RemoteProvisionParams,
  options: RemoteProvisionOptions = {},
): Promise<void> {
  const { spawnFn = spawn, sshBin = "ssh", scpBin = "scp", onLog } = options;
  const host = params.host ?? hostFromTarget(params.target.sshTarget);
  const ssh = sshExecArgs(params.target);
  const scp = scpArgs(params.target);
  const scpTarget = params.target.sshTarget;

  catalog.upsertSump({
    id: params.id,
    name: params.name,
    connectionType: "ssh",
    host,
    port: params.remotePort,
    status: "provisioning",
    authToken: params.apiToken ?? null,
    // cor-CORE.PROVISION-007: the SSH target is persisted here (not just
    // used transiently) so a later uninstall can reconstruct it without
    // asking the user to retype it.
    catalogJson: sumpDocument(params.source, { name: params.name, sshTarget: params.target }),
    createdAt: params.now,
    lastSeenAt: null,
  });

  try {
    await validateComposeFile(params.source.composeFile);

    await run(sshBin, [...ssh, `mkdir -p ${REMOTE_DIR}`], { spawnFn, onLog });

    let idRsaEnv = "";
    if (params.target.sshKey) {
      await run(scpBin, [...scp, params.target.sshKey, `${scpTarget}:${REMOTE_DIR}/id_rsa`], {
        spawnFn,
        onLog,
      });
      await run(sshBin, [...ssh, `chmod 600 ${REMOTE_DIR}/id_rsa`], { spawnFn, onLog });
      idRsaEnv = 'CORRELATOR_ID_RSA="$PWD/id_rsa" ';
    }
    const apiTokenEnv = params.apiToken ? `CORRELATOR_API_TOKEN=${params.apiToken} ` : "";

    if (params.source.type === "tarball") {
      await run(scpBin, [...scp, params.source.tarballPath, `${scpTarget}:${REMOTE_DIR}/`], {
        spawnFn,
        onLog,
      });
      await run(
        scpBin,
        [...scp, params.source.composeFile, `${scpTarget}:${REMOTE_DIR}/docker-compose.yml`],
        { spawnFn, onLog },
      );
      const tarballName = params.source.tarballPath.split("/").pop();
      await run(
        sshBin,
        [
          ...ssh,
          `cd ${REMOTE_DIR} && docker load -i ${tarballName} && ${apiTokenEnv}${idRsaEnv}docker compose -f docker-compose.yml up -d`,
        ],
        { spawnFn, onLog },
      );
    } else {
      await run(
        scpBin,
        [...scp, params.source.composeFile, `${scpTarget}:${REMOTE_DIR}/docker-compose.yml`],
        { spawnFn, onLog },
      );
      await run(
        sshBin,
        [
          ...ssh,
          `cd ${REMOTE_DIR} && docker pull ${params.source.ref} && CORRELATOR_IMAGE=${params.source.ref} ${apiTokenEnv}${idRsaEnv}docker compose -f docker-compose.yml up -d`,
        ],
        { spawnFn, onLog },
      );
    }

    onLog?.(
      `$ waiting for the container to come up (http://${host}:${params.remotePort}/health) ...`,
    );
    try {
      await waitForHttpOk(`http://${host}:${params.remotePort}/health`, {
        timeoutMs: 30000,
        ...(params.apiToken ? { headers: { "X-Correlator-Token": params.apiToken } } : {}),
      });
      // Only reachability actually confirmed just now counts as "seen" --
      // the catch below is a best-effort warning, not confirmed contact.
      catalog.touchSump(params.id, new Date().toISOString());
    } catch (err) {
      // Provisioning-only SSH: not being directly reachable yet is a
      // best-effort warning, not a hard failure -- ongoing traffic is
      // plain HTTP, never tunneled through this SSH connection.
      onLog?.(`  -> not reachable directly yet (${(err as Error).message ?? err})`);
    }

    catalog.setSumpStatus(params.id, transition("provisioning", "provision_succeeded"));
  } catch (err) {
    catalog.setSumpStatus(params.id, transition("provisioning", "provision_failed"));
    throw err;
  }
}

function parseImageSource(catalogJson: string): ImageSource {
  const doc = JSON.parse(catalogJson) as { imageSource?: ImageSource };
  if (!doc.imageSource) {
    throw new Error(
      "catalog document has no recorded imageSource -- cannot resolve what to uninstall",
    );
  }
  return doc.imageSource;
}

function parseSshTarget(catalogJson: string): SshTarget | null {
  const doc = JSON.parse(catalogJson) as { sshTarget?: SshTarget };
  return doc.sshTarget ?? null;
}

export async function uninstallLocal(
  catalog: Catalog,
  sumpId: string,
  options: ProvisionCommonOptions = {},
): Promise<void> {
  const { spawnFn = spawn, onLog } = options;
  const row = catalog.getSump(sumpId);
  if (!row) throw new Error(`no sump ${sumpId} in catalog`);

  // BUG-0027/br-PROV-007: must resolve against what this sump was actually
  // provisioned with, never a freshly re-resolved default.
  const source = parseImageSource(row.catalogJson);
  await run("docker", ["compose", "-f", source.composeFile, "down", "--rmi", "all"], {
    spawnFn,
    onLog,
  });

  catalog.setSumpToken(sumpId, null);
  catalog.setSumpStatus(
    sumpId,
    transition(row.status === "unreachable" ? "unreachable" : "active", "retire"),
  );
}

// cor-CORE.PROVISION-006 ("connect to an existing Sump"): a single
// short-timeout reachability check, not waitForHttpOk's retry loop -- the
// user is asserting a Sump is *already* running, so a bad host/port
// should fail fast and visibly rather than retrying silently for up to
// 30s. Registers directly (no "provisioning" interim state) since there
// is no installation side effect to recover from mid-crash, mirroring
// shell.ts's promote-data-stream handler ("only register on success").
export interface ConnectExistingParams {
  id: string;
  name: string;
  host: string;
  port: number;
  authToken?: string | null;
  now: string;
}

export async function connectExistingSump(
  catalog: Catalog,
  params: ConnectExistingParams,
  options: { fetchFn?: typeof fetch } = {},
): Promise<void> {
  const { fetchFn = fetch } = options;
  const headers: Record<string, string> = {};
  if (params.authToken) headers["X-Correlator-Token"] = params.authToken;

  const url = `http://${params.host}:${params.port}/health`;
  let response: Response;
  try {
    response = await fetchFn(url, { headers, signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new Error(`could not reach ${url}: ${(err as Error).message ?? err}`);
  }
  if (!response.ok) {
    throw new Error(`GET /health failed: ${response.status}`);
  }

  catalog.upsertSump({
    id: params.id,
    name: params.name,
    connectionType: "external",
    host: params.host,
    port: params.port,
    status: "active",
    authToken: params.authToken ?? null,
    catalogJson: "{}",
    createdAt: params.now,
    lastSeenAt: params.now,
  });
}

export async function uninstallRemote(
  catalog: Catalog,
  sumpId: string,
  target: SshTarget,
  options: ProvisionCommonOptions & { sshBin?: string } = {},
): Promise<void> {
  const { spawnFn = spawn, sshBin = "ssh", onLog } = options;
  const row = catalog.getSump(sumpId);
  if (!row) throw new Error(`no sump ${sumpId} in catalog`);

  const ssh = sshExecArgs(target);
  await run(
    sshBin,
    [
      ...ssh,
      `cd ${REMOTE_DIR} && docker compose down --rmi all; cd "$HOME" && rm -rf ${REMOTE_DIR}`,
    ],
    { spawnFn, onLog },
  );

  catalog.setSumpToken(sumpId, null);
  catalog.setSumpStatus(
    sumpId,
    transition(row.status === "unreachable" ? "unreachable" : "active", "retire"),
  );
}

// cor-CORE.PROVISION-007: the switcher UI's single "Uninstall"/"Disconnect"
// action dispatches here regardless of connectionType -- callers never need
// to know which underlying mechanism a given Sump uses.
export async function uninstallSump(
  catalog: Catalog,
  sumpId: string,
  options: ProvisionCommonOptions & { sshBin?: string } = {},
): Promise<void> {
  const row = catalog.getSump(sumpId);
  if (!row) throw new Error(`no sump ${sumpId} in catalog`);

  if (row.connectionType === "local") {
    await uninstallLocal(catalog, sumpId, options);
  } else if (row.connectionType === "ssh") {
    const target = parseSshTarget(row.catalogJson);
    if (!target) {
      throw new Error(
        `sump ${sumpId} has no recorded SSH target -- cannot resolve how to uninstall`,
      );
    }
    await uninstallRemote(catalog, sumpId, target, options);
  } else if (row.connectionType === "external") {
    // correlator never provisioned this Sump and owns no lifecycle for
    // it -- nothing to tear down, just forget it.
    catalog.setSumpToken(sumpId, null);
    catalog.setSumpStatus(
      sumpId,
      transition(row.status === "unreachable" ? "unreachable" : "active", "retire"),
    );
  } else {
    // cor-CORE.PROVISION-008: "logical" -- a docker-host-scoped row has
    // no container/connection of its own to tear down and shares its
    // parent's token, so just retire the row. The switcher UI doesn't
    // offer this action for a logical row in this pass; defensive only.
    catalog.setSumpStatus(
      sumpId,
      transition(row.status === "unreachable" ? "unreachable" : "active", "retire"),
    );
  }

  // cor-CORE.PROVISION-008: a root Sump's discovered docker hosts share
  // its connection -- their data disappears with it, so any host-scoped
  // children go with it too, regardless of which branch above ran.
  catalog.retireChildSumps(sumpId);

  if (catalog.getPrimarySumpId() === sumpId) {
    catalog.setPrimarySumpId(null);
  }
}
