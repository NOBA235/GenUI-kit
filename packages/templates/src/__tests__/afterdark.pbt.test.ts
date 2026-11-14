import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { createGuardrailedStreamCompiler } from "@genui-studio/core";
import {
  buildChaosPackets,
  buildRemixJsonl,
  initialPageSpecs,
  verifiedCatalog as afterdarkCatalog,
} from "../afterdark-horror/catalog.js";
import {
  GATE_DOOR_COLLIDER,
  PLAYER_RADIUS,
  resolvePlayerMovement,
  STATIC_AABB_COLLIDERS,
  WORLD_OUTER_BOUNDS,
  ZONE_TELEPORT_TARGETS,
} from "../afterdark-horror/engine/collision.js";
import {
  CLUE_RECORDS,
  ENCOUNTER_DEFINITIONS,
  LIGHT_MODE_SWITCH_SPEC,
  resolveTransformationStage,
  TOTAL_TRANSFORMATION_DURATION,
} from "../afterdark-horror/engine/world-data.js";
import {
  AFTERDARK_PROGRESS_STORAGE_KEY,
  useAfterdarkStore,
} from "../afterdark-horror/store.js";

describe("AFTERDARK 2.0 — fast-check Property-Based Verification Suite", () => {
  afterEach(() => {
    useAfterdarkStore.getState().plungeBackIntoDarkness();
  });

  it("Property 1: Collision Boundary Invariance across 1,000 randomized movement vectors & Zone A-E anchors", () => {
    const eps = 1e-4;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: ZONE_TELEPORT_TARGETS.length - 1 }),
        fc.double({ min: -8.0, max: 8.0, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -8.0, max: 8.0, noNaN: true, noDefaultInfinity: true }),
        fc.boolean(),
        (zoneIdx, dx, dz, gateLocked) => {
          const anchor = ZONE_TELEPORT_TARGETS[zoneIdx]!;
          const feetY = anchor.zoneId === "crypt_entrance" ? -4.5 : anchor.zoneId === "chapel_steps" ? 0.3 : 0;
          const startX = anchor.position[0];
          const startZ = anchor.position[2];

          const res = resolvePlayerMovement(
            startX,
            startZ,
            startX + dx,
            startZ + dz,
            {
              playerFeetY: feetY,
              gateLocked,
            },
          );

          // 1. Coordinates are always finite and strictly inside world outer perimeter limits
          expect(Number.isFinite(res.x)).toBe(true);
          expect(Number.isFinite(res.z)).toBe(true);
          expect(res.x).toBeGreaterThanOrEqual(WORLD_OUTER_BOUNDS.minX - eps);
          expect(res.x).toBeLessThanOrEqual(WORLD_OUTER_BOUNDS.maxX + eps);
          expect(res.z).toBeLessThanOrEqual(WORLD_OUTER_BOUNDS.maxZ + eps);
          expect(res.z).toBeGreaterThanOrEqual(WORLD_OUTER_BOUNDS.cryptMinZ - eps);

          // 2. Final resolved position never intersects the interior of any active AABB obstacle
          for (const box of STATIC_AABB_COLLIDERS) {
            const minY = box.minY ?? -1.0;
            const maxY = box.maxY ?? 15.0;
            if (feetY < minY || feetY > maxY) continue;

            const insideX =
              res.x > box.minX - PLAYER_RADIUS + 0.02 &&
              res.x < box.maxX + PLAYER_RADIUS - 0.02;
            const insideZ =
              res.z > box.minZ - PLAYER_RADIUS + 0.02 &&
              res.z < box.maxZ + PLAYER_RADIUS - 0.02;
            expect(insideX && insideZ).toBe(false);
          }

          if (gateLocked && feetY >= -0.5) {
            const insideGateX =
              res.x > GATE_DOOR_COLLIDER.minX - PLAYER_RADIUS + 0.02 &&
              res.x < GATE_DOOR_COLLIDER.maxX + PLAYER_RADIUS - 0.02;
            const insideGateZ =
              res.z > GATE_DOOR_COLLIDER.minZ - PLAYER_RADIUS + 0.02 &&
              res.z < GATE_DOOR_COLLIDER.maxZ + PLAYER_RADIUS - 0.02;
            expect(insideGateX && insideGateZ).toBe(false);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("Property 2: Progression State Machine Determinism & non-soft-locking LIGHT MODE breaker switch", () => {
    const validClueIds = new Set(CLUE_RECORDS.map((c) => c.id));
    const validEncIds = new Set(ENCOUNTER_DEFINITIONS.map((e) => e.id));

    type ActionStep =
      | { kind: "clue"; id: (typeof CLUE_RECORDS)[number]["id"] }
      | { kind: "enc"; id: (typeof ENCOUNTER_DEFINITIONS)[number]["id"] }
      | { kind: "distance"; meters: number }
      | { kind: "trigger_switch" }
      | { kind: "complete_dawn" }
      | { kind: "plunge_dark" };

    const actionArb: fc.Arbitrary<ActionStep> = fc.oneof(
      fc.constantFrom(...CLUE_RECORDS.map((c) => c.id)).map((id) => ({
        kind: "clue" as const,
        id,
      })),
      fc.constantFrom(...ENCOUNTER_DEFINITIONS.map((e) => e.id)).map((id) => ({
        kind: "enc" as const,
        id,
      })),
      fc.double({ min: 0.1, max: 25, noNaN: true }).map((meters) => ({
        kind: "distance" as const,
        meters,
      })),
      fc.constant({ kind: "trigger_switch" as const }),
      fc.constant({ kind: "complete_dawn" as const }),
      fc.constant({ kind: "plunge_dark" as const }),
    );

    fc.assert(
      fc.property(fc.array(actionArb, { minLength: 1, maxLength: 35 }), (steps) => {
        useAfterdarkStore.getState().plungeBackIntoDarkness();
        useAfterdarkStore.getState().finishGateEntry();

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i]!;
          const store = useAfterdarkStore.getState();

          if (step.kind === "clue") {
            store.revealClue(step.id);
          } else if (step.kind === "enc") {
            store.triggerEncounter(step.id, 100000 + i * 35000, false);
          } else if (step.kind === "distance") {
            store.addDistanceWalked(step.meters);
          } else if (step.kind === "trigger_switch") {
            const wasRestored = store.phase === "restored_light";
            store.triggerLightModeSequence();
            if (wasRestored) {
              expect(useAfterdarkStore.getState().phase).toBe("restored_light");
            } else {
              expect(useAfterdarkStore.getState().phase).toBe("restoring_light");
              expect(useAfterdarkStore.getState().lightSwitchActivated).toBe(true);
            }
          } else if (step.kind === "complete_dawn") {
            store.completeLightModeTransition();
            expect(useAfterdarkStore.getState().phase).toBe("restored_light");
            expect(useAfterdarkStore.getState().lightModeRestored).toBe(true);
          } else if (step.kind === "plunge_dark") {
            store.plungeBackIntoDarkness();
            expect(useAfterdarkStore.getState().phase).toBe("shutdown");
            expect(useAfterdarkStore.getState().lightModeRestored).toBe(false);
            expect(useAfterdarkStore.getState().discoveredClues).toEqual([]);
            expect(useAfterdarkStore.getState().triggeredEncounters).toEqual([]);
          }

          const current = useAfterdarkStore.getState();
          // Discovered clues & triggered encounters must stay strictly unique valid IDs
          expect(new Set(current.discoveredClues).size).toBe(
            current.discoveredClues.length,
          );
          expect(current.discoveredClues.every((c) => validClueIds.has(c))).toBe(
            true,
          );
          expect(new Set(current.triggeredEncounters).size).toBe(
            current.triggeredEncounters.length,
          );
          expect(
            current.triggeredEncounters.every((e) => validEncIds.has(e)),
          ).toBe(true);
          expect(current.distanceWalkedMeters).toBeGreaterThanOrEqual(0);
          expect(current.transformationStage).toBeGreaterThanOrEqual(0);
          expect(current.transformationStage).toBeLessThanOrEqual(10);
        }

        // Regardless of arbitrary prior steps, plunging & descending into Zone E must never soft-lock the LIGHT MODE switch
        useAfterdarkStore.getState().plungeBackIntoDarkness();
        useAfterdarkStore.getState().finishGateEntry();
        useAfterdarkStore.getState().teleportToZone("crypt_entrance");
        expect(LIGHT_MODE_SWITCH_SPEC.position).toEqual([-4.0, -3.2, -50.22]);
        useAfterdarkStore.getState().triggerLightModeSequence();
        expect(useAfterdarkStore.getState().phase).toBe("restoring_light");
        useAfterdarkStore.getState().completeLightModeTransition();
        expect(useAfterdarkStore.getState().lightModeRestored).toBe(true);
        expect(resolveTransformationStage(TOTAL_TRANSFORMATION_DURATION)).toBe(10);
        expect(typeof AFTERDARK_PROGRESS_STORAGE_KEY).toBe("string");
      }),
      { numRuns: 200 },
    );
  });

  it("Property 3: Catalog Schema Resilience & Corrupted Encounter Coordinate Healing", () => {
    const baseSpec = initialPageSpecs.home!;
    const outOfBoundsArb = fc.oneof(
      fc.double({ min: 121, max: 10000, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -10000, max: -121, noNaN: true, noDefaultInfinity: true }),
    );
    const outOfBoundsRadiusArb = fc.oneof(
      fc.double({ min: 26, max: 10000, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -500, max: 0.9, noNaN: true, noDefaultInfinity: true }),
    );

    fc.assert(
      fc.property(
        outOfBoundsArb,
        outOfBoundsArb,
        outOfBoundsRadiusArb,
        fc.constantFrom(
          "Remix Horror Preset: Blood Moon Storm",
          "Remix Restored Site into Brutalist Archive",
          "Dense Subterranean Fog",
        ),
        (badX, badZ, badRadius, prompt) => {
          const compiler = createGuardrailedStreamCompiler({
            catalog: afterdarkCatalog,
          });
          compiler.push(buildRemixJsonl(prompt, baseSpec));

          // 1. Out-of-bounds scalar encounter radius is deterministically clamped into [1, 25] & badged
          const healedPatch = [
            JSON.stringify({
              op: "add",
              path: "/elements/fuzzed-healed-trigger",
              value: {
                type: "SupernaturalEncounterTrigger",
                props: {
                  triggerId: "fuzzed-01",
                  label: "Fuzzed Encounter",
                  cueType: "the_watcher",
                  radiusMeters: badRadius,
                  armed: true,
                },
                children: [],
              },
            }),
            JSON.stringify({
              op: "add",
              path: `/elements/${baseSpec.root}/children/-`,
              value: "fuzzed-healed-trigger",
            }),
            // 2. Corrupted out-of-bounds [x, y, z] coordinate tuple is safely rejected without throwing
            JSON.stringify({
              op: "add",
              path: "/elements/fuzzed-bad-coord",
              value: {
                type: "ClueMonumentNode",
                props: {
                  clueId: "bad-clue",
                  title: "Corrupted Node",
                  inscription: "ERR",
                  yearStamped: "0000",
                  worldPosition: [badX, 0, badZ],
                  discovered: false,
                },
                children: [],
              },
            }),
            JSON.stringify({
              op: "add",
              path: `/elements/${baseSpec.root}/children/-`,
              value: "fuzzed-bad-coord",
            }),
          ].join("\n") + "\n";

          const step = compiler.push(healedPatch);
          const finalized = compiler.finalize();

          expect(finalized.spec.root).toBe(baseSpec.root);
          expect(step.healedDiagnostics["fuzzed-healed-trigger"]).toBeDefined();
          const clampedRadius = Number(
            (
              finalized.spec.elements["fuzzed-healed-trigger"]?.props as Record<
                string,
                unknown
              >
            )?.radiusMeters,
          );
          expect(clampedRadius).toBeGreaterThanOrEqual(1);
          expect(clampedRadius).toBeLessThanOrEqual(25);
          // Corrupted coordinate node was either pruned or rejected in diagnostics
          expect(
            finalized.telemetry.rejectedPropsCount + finalized.issues.length,
          ).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );

    // Explicitly verify built-in Chaos Packet injector heals trigger radius AND blocks bad coord packet
    const chaosCompiler = createGuardrailedStreamCompiler({
      catalog: afterdarkCatalog,
    });
    chaosCompiler.push(buildRemixJsonl("Illuminate Editorial Site", baseSpec));
    chaosCompiler.push(buildChaosPackets(baseSpec.root).join("\n") + "\n");
    const result = chaosCompiler.finalize();
    expect(result.healedDiagnostics["corrupted-encounter-trigger"]).toBeDefined();
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
