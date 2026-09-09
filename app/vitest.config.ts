import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "renderer/src/**/tests/*.test.ts",
      "lib/tests/**/*.test.ts",
      "tests/**/*.test.ts",
      "build/tests/**/*.test.ts",
    ],
  },
});
