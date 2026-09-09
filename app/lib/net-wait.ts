/**
 * Polls a URL until it responds 200 OK or a deadline passes. Ported from
 * cttc's `lib/net-wait.js` `waitForHttpOk` — used after provisioning a Sump
 * container: the port opening doesn't mean the app inside has actually
 * finished starting up, so this polls `/health/ready` instead of a raw TCP
 * connect check.
 */

export interface WaitForHttpOkOptions {
  timeoutMs?: number;
  intervalMs?: number;
  fetchFn?: typeof fetch;
  headers?: Record<string, string>;
}

export function waitForHttpOk(url: string, options: WaitForHttpOkOptions = {}): Promise<void> {
  const { timeoutMs = 15000, intervalMs = 300, fetchFn = fetch, headers } = options;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetchFn(url, {
          signal: AbortSignal.timeout(Math.min(intervalMs * 3, 5000)),
          ...(headers ? { headers } : {}),
        });
        if (response.ok) {
          resolve();
          return;
        }
        throw new Error(`${url}: ${response.status}`);
      } catch (err) {
        if (Date.now() >= deadline) {
          reject(
            new Error(`timed out waiting for ${url} to respond: ${(err as Error).message ?? err}`),
          );
        } else {
          setTimeout(attempt, intervalMs);
        }
      }
    };
    attempt();
  });
}
