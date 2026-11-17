import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getDefaultOtlpStoragePaths,
  OTLP_SNAPSHOT_ENV_VAR,
} from "../../server/otlp-collector.js";

// Must stay in lockstep with packages/genui-mcp getDefaultOtlpSnapshotPath().
describe("OTLP snapshot path (collector side)", () => {
  const original = process.env[OTLP_SNAPSHOT_ENV_VAR];

  afterEach(() => {
    if (original === undefined) delete process.env[OTLP_SNAPSHOT_ENV_VAR];
    else process.env[OTLP_SNAPSHOT_ENV_VAR] = original;
  });

  it("uses the env var name shared with the MCP server", () => {
    expect(OTLP_SNAPSHOT_ENV_VAR).toBe("SPATIAL_OPS_OTLP_SNAPSHOT");
  });

  it("defaults to ~/.spatial-ops/otlp-snapshot.json", () => {
    delete process.env[OTLP_SNAPSHOT_ENV_VAR];
    expect(getDefaultOtlpStoragePaths().snapshotFile).toBe(
      path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json")
    );
  });

  it("honours SPATIAL_OPS_OTLP_SNAPSHOT", () => {
    const custom = path.join(os.tmpdir(), "custom-otlp-snapshot.json");
    process.env[OTLP_SNAPSHOT_ENV_VAR] = custom;
    expect(getDefaultOtlpStoragePaths().snapshotFile).toBe(custom);
  });

  it("ignores an empty or whitespace-only override", () => {
    process.env[OTLP_SNAPSHOT_ENV_VAR] = "   ";
    expect(getDefaultOtlpStoragePaths().snapshotFile).toBe(
      path.join(os.homedir(), ".spatial-ops", "otlp-snapshot.json")
    );
  });

  it("does not move the NDJSON trace store when only the snapshot is overridden", () => {
    process.env[OTLP_SNAPSHOT_ENV_VAR] = path.join(os.tmpdir(), "x.json");
    expect(getDefaultOtlpStoragePaths().dataFile).toBe(
      path.join(os.homedir(), ".spatial-ops", "otlp-traces.ndjson")
    );
  });
});
