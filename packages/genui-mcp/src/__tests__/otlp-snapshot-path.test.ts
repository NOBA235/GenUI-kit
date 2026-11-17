import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDefaultOtlpSnapshotPath } from "../tools/otlp-snapshot-provider.js";

// Must stay in lockstep with apps/spatial-ops/server/otlp-collector.ts getDefaultOtlpStoragePaths().
describe("OTLP snapshot path (MCP reader side)", () => {
  const ENV = "SPATIAL_OPS_OTLP_SNAPSHOT";
  const original = process.env[ENV];

  afterEach(() => {
    if (original === undefined) delete process.env[ENV];
    else process.env[ENV] = original;
  });

  it("defaults to ~/.spatial-ops/otlp-snapshot.json", () => {
    delete process.env[ENV];
    expect(getDefaultOtlpSnapshotPath()).toBe(
      path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json")
    );
  });

  it("honours SPATIAL_OPS_OTLP_SNAPSHOT", () => {
    const custom = path.join(os.tmpdir(), "custom-otlp-snapshot.json");
    process.env[ENV] = custom;
    expect(getDefaultOtlpSnapshotPath()).toBe(custom);
  });

  it("ignores an empty or whitespace-only override", () => {
    process.env[ENV] = "";
    expect(getDefaultOtlpSnapshotPath()).toBe(
      path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json")
    );
    process.env[ENV] = "   ";
    expect(getDefaultOtlpSnapshotPath()).toBe(
      path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json")
    );
  });
});
