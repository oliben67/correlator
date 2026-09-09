#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Bundles renderer/src/entry.tsx into renderer/dist/bundle.js for the
 * Electron shell to load (cor-CORE.SHELL-003). Ported from cttc's
 * build/build-renderer.js -- same esbuild.build()/esbuild.context().watch()
 * shape -- with the Preact aliasing removed since this targets real React
 * from the start (cttc bundled Preact under the `react`/`react-dom`
 * specifiers so Jotai's React-hook imports resolved without pulling in
 * real React; this project has real React as a dependency instead).
 */
import { build, context } from "esbuild";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [path.join(ROOT, "renderer/src/entry.tsx")],
  outfile: path.join(ROOT, "renderer/dist/bundle.js"),
  bundle: true,
  format: "iife",
  jsx: "automatic",
  jsxImportSource: "react",
  sourcemap: true,
  logLevel: "info",
};

async function main() {
  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    console.log("[build-renderer] watching for changes...");
  } else {
    await build(options);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
