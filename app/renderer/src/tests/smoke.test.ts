import { describe, expect, it } from "vitest";
import { APP_NAME } from "../version";

describe("toolchain smoke test", () => {
  it("resolves the empty scaffold's one module", () => {
    expect(APP_NAME).toBe("correlator");
  });
});
