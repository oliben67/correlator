import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, context } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let dir: string;
let entryPath: string;
let outfile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "correlator-build-renderer-test-"));
  entryPath = join(dir, "entry.tsx");
  outfile = join(dir, "bundle.js");
  writeFileSync(
    entryPath,
    `export function marker() { return "correlator-renderer-marker"; }\nmarker();\n`,
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Exercises the same esbuild options build/build-renderer.js uses, against a
// throwaway entry point, rather than importing that script directly (it
// resolves its paths from import.meta.url relative to its own file, not a
// temp dir, and always targets the real renderer/src/entry.tsx).
function buildOptions() {
  return {
    entryPoints: [entryPath],
    outfile,
    bundle: true,
    format: "iife" as const,
    jsx: "automatic" as const,
    jsxImportSource: "react",
    sourcemap: true,
    logLevel: "silent" as const,
  };
}

describe("cor-CORE.SHELL-003: esbuild renderer bundle", () => {
  it("produces a bundle containing the entry's output", async () => {
    await build(buildOptions());
    expect(existsSync(outfile)).toBe(true);
    const content = readFileSync(outfile, "utf8");
    expect(content).toContain("correlator-renderer-marker");
  });

  it("--watch mode rebuilds on a source file change", async () => {
    const ctx = await context(buildOptions());
    await ctx.watch();
    // esbuild's watch does an initial build before returning from watch().
    await new Promise((resolve) => setTimeout(resolve, 200));
    const firstMtime = statSync(outfile).mtimeMs;

    writeFileSync(
      entryPath,
      `export function marker() { return "correlator-renderer-marker-v2"; }\nmarker();\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, 400));

    const content = readFileSync(outfile, "utf8");
    expect(content).toContain("correlator-renderer-marker-v2");
    expect(statSync(outfile).mtimeMs).toBeGreaterThanOrEqual(firstMtime);

    await ctx.dispose();
  });
});
