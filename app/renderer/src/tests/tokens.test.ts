import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// BUG-000007 regression / cor-CORE.UI-000001: every `var(--name)` the
// renderer uses must be a token tokens.css actually defines -- a mismatched
// name silently falls back (LogPanel read `--hl` while the token is
// `--hl-color`).

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "tests" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("cor-CORE.UI-000001: design-token coverage", () => {
  it("every var(--name) used in renderer source is defined in tokens.css", () => {
    const defined = new Set(
      [...readFileSync(join(SRC, "tokens.css"), "utf8").matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
        (m) => m[1],
      ),
    );
    const undefinedUses: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (!defined.has(m[1])) undefinedUses.push(`${relative(SRC, file)}: ${m[1]}`);
      }
    }
    expect(undefinedUses).toEqual([]);
  });
});
