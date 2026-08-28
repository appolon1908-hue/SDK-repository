import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION } from "../src/index.js";

describe("contract package", () => {
  it("exposes a stable semantic version", () => {
    expect(CONTRACT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
