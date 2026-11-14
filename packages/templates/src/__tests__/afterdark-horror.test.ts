import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditCatalogRegistryParity,
  createGuardrailedStreamCompiler,
} from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import {
  generateTemplateZip,
  getTemplateBySlug,
  listTemplates,
} from "../index.js";
import {
  buildRemixJsonl,
  initialPageSpecs,
  verifiedCatalog as afterdarkCatalog,
} from "../afterdark-horror/catalog.js";
import { templateComponents as afterdarkRegistry } from "../afterdark-horror/components/index.js";
import {
  GATE_DOOR_COLLIDER,
  getWalkableFloorHeight,
  isInsideChapelFloorboards,
  isInUndergroundCrypt,
  isOnStonePaving,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  resolvePlayerMovement,
  resolveZoneAtPosition,
  TOMBSTONE_LAYOUT,
  DEAD_TREE_LAYOUT,
  ZONE_TELEPORT_TARGETS,
  STATIC_AABB_COLLIDERS,
} from "../afterdark-horror/engine/collision.js";
import {
  CLUE_RECORDS,
  computeLookDotProduct,
  createVisualEncounterSpec,
  ENCOUNTER_DEFINITIONS,
  evaluateEncounterProximity,
  evaluateInteractableFocus,
} from "../afterdark-horror/engine/world-data.js";
import {
  createAfterdarkSharedGeometries,
  disposeAfterdarkSharedGeometries,
} from "../afterdark-horror/engine/procedural-geometries.js";
import {
  disposeAfterdarkSoundscape,
  getAfterdarkSoundscape,
} from "../afterdark-horror/audio/soundscape.js";
import {
  QUALITY_BUDGETS,
  useAfterdarkStore,
} from "../afterdark-horror/store.js";

describe("AFTERDARK Flagship Website #1 — Milestone 1 Verification Suite", () => {
  afterEach(() => {
    useAfterdarkStore.getState().resetExperience();
    disposeAfterdarkSoundscape();
  });

  describe("1. Dual-Mode Registry & Zod Catalog Parity + PBT", () => {
    it("is registered in Unified Dual-Mode Registry with immersion & 3D tags", () => {
      const entry = getTemplateBySlug("afterdark-horror");
      expect(entry).toBeDefined();
      expect(entry!.manifest.mode).toBe("native");
      expect(entry!.manifest.immersiveExperience).toBe(true);
      expect(entry!.manifest.category).toBe("3D / WebGL");
      expect(entry!.manifest.tags).toContain("3D / WebGL");
      expect(entry!.manifest.tags).toContain("GenUI Verified");

      const webglTemplates = listTemplates({ tag: "3D / WebGL" });
      expect(webglTemplates.map((t) => t.manifest.slug)).toContain(
        "afterdark-horror",
      );
    });

    it("enforces 1:1 parity across all 9 Horror Director & Restored Editorial components", () => {
      const parity = auditCatalogRegistryParity(
        afterdarkCatalog,
        afterdarkRegistry,
      );
      expect(parity.synchronized).toBe(true);
      expect(parity.missingComponents).toEqual([]);
      expect(parity.extraComponents).toEqual([]);
      expect(parity.missingDescriptions).toEqual([]);

      expect([...afterdarkCatalog.metadata.componentNames].sort()).toEqual(
        [
          "DarknessAndWeatherController",
          "CemeteryZoneCluster",
          "ClueMonumentNode",
          "SupernaturalEncounterTrigger",
          "PhysicalLightModeSwitch",
          "RestoredEditorialHero",
          "EncounterArchiveGrid",
          "InteractiveLoreTimeline",
          "ExperienceReplayFooter",
        ].sort(),
      );
    });

    it("passes formal fast-check PBT invariant theorems INV-PBT-01 through INV-PBT-04", () => {
      const report = runCatalogInvariantSuite(afterdarkCatalog, { numRuns: 20 });
      expect(report.allPassed).toBe(true);
      expect(report.theorems).toHaveLength(4);
    });

    it("streams GenUI Live Remix patches for atmosphere and light-mode restoration", () => {
      const jsonl = buildRemixJsonl(
        "Illuminate Editorial Site",
        initialPageSpecs.home!,
      );
      const compiler = createGuardrailedStreamCompiler({
        catalog: afterdarkCatalog,
      });
      compiler.push(jsonl);
      const compiled = compiler.finalize();
      const director = compiled.spec.elements["horror-director"];
      expect(director?.props.lightModeRestored).toBe(true);
    });
  });

  describe("2. Deterministic AABB & Circle/Sphere Collision Engine", () => {
    it("prevents walking back through locked wrought-iron gates once entered", () => {
      const unlocked = resolvePlayerMovement(0, 31.0, 0, 27.0, {
        gateLocked: false,
      });
      expect(unlocked.z).toBeCloseTo(27.0, 2);

      // Try escaping south from inside gatehouse through locked iron gate
      const lockedAttempt = resolvePlayerMovement(0, 27.5, 0, 32.0, {
        gateLocked: true,
      });
      expect(lockedAttempt.collided).toBe(true);
      expect(lockedAttempt.z).toBeLessThanOrEqual(
        GATE_DOOR_COLLIDER.minZ - PLAYER_RADIUS + 0.01,
      );
    });

    it("blocks perimeter wall exits while preserving smooth diagonal wall sliding", () => {
      // Slide diagonally northeast into East Wall at x = 35.4
      const res = resolvePlayerMovement(34.5, 5.0, 38.0, 2.0, {
        gateLocked: true,
      });
      expect(res.collided).toBe(true);
      const eastWall = STATIC_AABB_COLLIDERS.find((b) => b.id === "wall-east")!;
      expect(res.x).toBeLessThanOrEqual(eastWall.minX - PLAYER_RADIUS + 0.01);
      // Should still slide along Z axis
      expect(res.z).toBeLessThan(5.0);
    });

    it("prevents clipping into tombstones and gnarled dead trees", () => {
      const sampleTomb = TOMBSTONE_LAYOUT[0]!;
      const hitTomb = resolvePlayerMovement(
        sampleTomb.x - 1.5,
        sampleTomb.z,
        sampleTomb.x,
        sampleTomb.z,
        { gateLocked: true },
      );
      expect(hitTomb.collided).toBe(true);
      expect(
        Math.hypot(hitTomb.x - sampleTomb.x, hitTomb.z - sampleTomb.z),
      ).toBeGreaterThanOrEqual(PLAYER_RADIUS + 0.54);

      const sampleTree = DEAD_TREE_LAYOUT[0]!;
      const hitTree = resolvePlayerMovement(
        sampleTree.x - 1.8,
        sampleTree.z,
        sampleTree.x,
        sampleTree.z,
        { gateLocked: true },
      );
      expect(hitTree.collided).toBe(true);
      expect(
        Math.hypot(hitTree.x - sampleTree.x, hitTree.z - sampleTree.z),
      ).toBeGreaterThan(PLAYER_RADIUS + 0.65);
    });

    it("keeps every zone teleport waypoint (Zones A-E) collision-free and accurately classifies surfaces & floors", () => {
      expect(ZONE_TELEPORT_TARGETS.map((w) => w.code)).toEqual([
        "A",
        "B",
        "C",
        "D",
        "E",
      ]);

      for (const wp of ZONE_TELEPORT_TARGETS) {
        const feetY = wp.position[1] - PLAYER_EYE_HEIGHT;
        const res = resolvePlayerMovement(
          wp.position[0],
          wp.position[2],
          wp.position[0],
          wp.position[2],
          { gateLocked: true, playerFeetY: feetY },
        );
        expect(res.collided).toBe(false);
        expect(
          resolveZoneAtPosition(wp.position[0], wp.position[2], wp.position[1]),
        ).toBe(wp.zoneId);
      }

      // Zone C Dead Garden Fountain collision circle blocks clipping at (-16, -9)
      const hitFountain = resolvePlayerMovement(-13.0, -9.0, -16.0, -9.0, {
        gateLocked: true,
      });
      expect(hitFountain.collided).toBe(true);
      expect(Math.hypot(hitFountain.x + 16.0, hitFountain.z + 9.0)).toBeGreaterThan(
        PLAYER_RADIUS + 1.85,
      );

      // Zone D Enterable Gothic Chapel doorway allows walking inside onto creaking wood floor (y = 0.3)
      const chapelEntry = resolvePlayerMovement(0, -32.2, 0, -38.5, {
        gateLocked: true,
        playerFeetY: 0,
      });
      expect(chapelEntry.collided).toBe(false);
      expect(getWalkableFloorHeight(0, -38.5, 0.3)).toBeCloseTo(0.3, 2);
      expect(isInsideChapelFloorboards(0, -38.5, 0.3)).toBe(true);
      expect(isOnStonePaving(0, -38.5, 0.3)).toBe(false);

      // East Stairwell smoothly descends from Chapel Nave (0.3m) down to Zone E Crypt (-4.5m)
      expect(getWalkableFloorHeight(4.0, -40.8, 0.3)).toBeCloseTo(0.3, 2);
      expect(getWalkableFloorHeight(4.0, -45.9, -2.0)).toBeCloseTo(-2.1, 1);
      expect(getWalkableFloorHeight(4.0, -51.0, -4.5)).toBeCloseTo(-4.5, 2);
      expect(isInUndergroundCrypt(-53.2, -4.5)).toBe(true);

      // Subterranean Zone E sarcophagus blocks movement at feetY = -4.5 without colliding above ground
      const cryptHit = resolvePlayerMovement(-2.4, -55.4, -4.2, -55.4, {
        gateLocked: true,
        playerFeetY: -4.5,
      });
      expect(cryptHit.collided).toBe(true);

      expect(isOnStonePaving(0, 8.0)).toBe(true);
      expect(isOnStonePaving(-16.0, 3.0)).toBe(false);
    });
  });

  describe("3. Procedural 3D Geometries, Hardware Budgets & Web Audio Fallback", () => {
    it("constructs and disposes Three.js BufferGeometries cleanly with capped quality budgets", () => {
      const geoms = createAfterdarkSharedGeometries();
      expect(geoms.lancetTombstone.getAttribute("position").count).toBeGreaterThan(24);
      expect(geoms.obeliskTombstone.getAttribute("position").count).toBeGreaterThan(24);
      expect(geoms.celticCross.getAttribute("position").count).toBeGreaterThan(24);
      expect(geoms.fountainBasin.getAttribute("position").count).toBeGreaterThan(24);
      expect(geoms.apparitionSilhouette.getAttribute("position").count).toBeGreaterThan(24);
      expect(geoms.gnarledTree.getAttribute("position").count).toBeGreaterThan(60);
      expect(geoms.fencePicket.getAttribute("position").count).toBeGreaterThan(24);
      disposeAfterdarkSharedGeometries(geoms);

      expect(QUALITY_BUDGETS.low.maxDynamicPointLights).toBe(1);
      expect(QUALITY_BUDGETS.medium.maxDynamicPointLights).toBe(2);
      expect(QUALITY_BUDGETS.high.maxDynamicPointLights).toBe(3);
    });

    it("degrades procedural Web Audio safely in headless SSR / unsupported contexts", () => {
      const audio = getAfterdarkSoundscape();
      expect(audio.isSupported).toBe(false);
      expect(audio.initAndStart()).toBe(false);
      expect(() => {
        audio.playRearWhisperCue();
        audio.playGateCreak();
        audio.playGateSlam();
        audio.playFootstep("wood", false);
        audio.playFootstep("gravel", true);
        audio.playLightningThunder();
        audio.playClueChime();
        audio.playMovingShadowRustle();
        audio.playWeepingAudio(-0.3);
        audio.playPresenceWhisperSteps();
        audio.playCryptWarningSpike();
        audio.setIntimidationLevel(0.8);
        audio.dispose();
      }).not.toThrow();
    });
  });

  describe("4. Zustand Phase State Machine, [E] 3-Clue Chain, 5 Encounters & .ZIP Export", () => {
    it("discovers all 3 mystery clues via raycast focus & persists state cleanly", () => {
      const clue01 = CLUE_RECORDS.find((c) => c.id === "clue-01")!;
      expect(clue01.inscription).toBe("THE LIGHT WAS NEVER LOST. IT WAS HIDDEN.");

      // Looking straight toward Clue 01 from 2.2m south (-Z forward is yaw = 0)
      const camPos: readonly [number, number, number] = [
        clue01.position[0],
        PLAYER_EYE_HEIGHT,
        clue01.position[2] + 2.2,
      ];
      expect(
        computeLookDotProduct(camPos, 0, -0.1, clue01.position),
      ).toBeGreaterThan(0.85);
      expect(evaluateInteractableFocus(camPos, 0, -0.1)?.id).toBe("clue-01");
      // Looking opposite direction (yaw = Math.PI) clears focus
      expect(evaluateInteractableFocus(camPos, Math.PI, 0)).toBeNull();

      useAfterdarkStore.getState().examineClue("clue-01");
      const afterC1 = useAfterdarkStore.getState();
      expect(afterC1.activeReaderClueId).toBe("clue-01");
      expect(afterC1.discoveredClues).toContain("clue-01");
      expect(afterC1.chapelBeaconPulseUntil).toBeGreaterThan(Date.now() - 100);

      useAfterdarkStore.getState().examineClue("clue-02");
      useAfterdarkStore.getState().examineClue("clue-03");
      expect(useAfterdarkStore.getState().discoveredClues).toEqual([
        "clue-01",
        "clue-02",
        "clue-03",
      ]);

      useAfterdarkStore.getState().closeClueReader();
      expect(useAfterdarkStore.getState().activeReaderClueId).toBeNull();

      useAfterdarkStore.getState().resetClues();
      expect(useAfterdarkStore.getState().discoveredClues).toEqual([]);
    });

    it("triggers all 5 cooldown-governed supernatural encounters with gaze & proximity checks", () => {
      expect(ENCOUNTER_DEFINITIONS.map((e) => e.id)).toEqual([
        "enc-01",
        "enc-02",
        "enc-03",
        "enc-04",
        "enc-05",
      ]);

      // 1. Trigger Watcher near Zone B (far away -> spawns visual entity)
      const t0 = 100_000;
      const eval1 = evaluateEncounterProximity({
        playerPosition: [1.5, PLAYER_EYE_HEIGHT, 9.2],
        playerYaw: 0,
        playerPitch: 0,
        nowMs: t0,
        cooldownUntilById: {},
        activeVisual: null,
      });
      expect(eval1.triggerId).toBe("enc-01");

      useAfterdarkStore.getState().triggerEncounter("enc-01", t0);
      const vis1 = useAfterdarkStore.getState().activeVisualEncounter!;
      expect(vis1.id).toBe("enc-01");

      // Looking directly at Watcher causes gaze vanish
      const watcherYaw = Math.atan2(
        -(vis1.position[0] - 1.5),
        -(vis1.position[2] - 9.2),
      );
      const evalVanish = evaluateEncounterProximity({
        playerPosition: [1.5, PLAYER_EYE_HEIGHT, 9.2],
        playerYaw: watcherYaw,
        playerPitch: 0,
        nowMs: t0 + 800,
        cooldownUntilById: useAfterdarkStore.getState().encounterCooldownUntil,
        activeVisual: vis1,
      });
      expect(evalVanish.vanishActive).toBe(true);

      // Re-triggering enc-01 inside cooldown without force is ignored
      useAfterdarkStore.getState().clearVisualEncounter();
      const blocked = evaluateEncounterProximity({
        playerPosition: [8.4, PLAYER_EYE_HEIGHT, 9.2],
        playerYaw: 0,
        playerPitch: 0,
        nowMs: t0 + 2000,
        cooldownUntilById: useAfterdarkStore.getState().encounterCooldownUntil,
        activeVisual: null,
      });
      expect(blocked.triggerId).toBeNull();

      // 2-5. Encounters 02, 03 (Weeping guide), 04 (Rear Presence), 05 (Crypt Warning)
      useAfterdarkStore.getState().triggerEncounter("enc-02", t0 + 5000, true);
      expect(useAfterdarkStore.getState().activeVisualEncounter?.moveTarget).toBeDefined();

      useAfterdarkStore.getState().triggerEncounter("enc-03", t0 + 8000, true);
      expect(useAfterdarkStore.getState().weepingGuideActive).toBe(true);

      useAfterdarkStore.getState().triggerEncounter("enc-04", t0 + 11000, true);
      expect(useAfterdarkStore.getState().encounterSubtitle).toBe(
        "You're looking in the wrong direction.",
      );
      const vis4 = createVisualEncounterSpec("enc-04", [0, PLAYER_EYE_HEIGHT, -24], 0, t0);
      expect(vis4.position[2]).toBeGreaterThan(-24);

      useAfterdarkStore.getState().triggerEncounter("enc-05", t0 + 14000, true);
      expect(useAfterdarkStore.getState().cryptIntimidationActive).toBe(true);
      expect(useAfterdarkStore.getState().triggeredEncounters).toEqual([
        "enc-01",
        "enc-02",
        "enc-03",
        "enc-04",
        "enc-05",
      ]);
    });
    it("progresses cleanly from shutdown -> typography -> gate_transition -> exploration -> restored_light", () => {
      const store = useAfterdarkStore.getState();
      expect(store.phase).toBe("shutdown");

      store.startSequence();
      expect(useAfterdarkStore.getState().phase).toBe("typography");
      expect(useAfterdarkStore.getState().typographyStep).toBe(1);

      store.setTypographyStep(4);
      store.beginGateTransition();
      expect(useAfterdarkStore.getState().phase).toBe("gate_transition");

      store.finishGateEntry();
      expect(useAfterdarkStore.getState().phase).toBe("exploration");
      expect(useAfterdarkStore.getState().gateLockedBehind).toBe(true);

      store.teleportToZone("chapel_steps");
      expect(useAfterdarkStore.getState().currentZone).toBe("chapel_steps");

      store.restoreLightMode();
      expect(useAfterdarkStore.getState().lightModeRestored).toBe(true);
      expect(useAfterdarkStore.getState().phase).toBe("restored_light");
    });

    it("exports afterdark-horror into a standalone Next.js 15 .zip with all engine files", async () => {
      const entry = getTemplateBySlug("afterdark-horror")!;
      const bytes = await generateTemplateZip(entry);
      const zip = await JSZip.loadAsync(bytes);

      expect(zip.file("package.json")).not.toBeNull();
      expect(zip.file("src/template/catalog.ts")).not.toBeNull();
      expect(zip.file("src/template/engine/collision.ts")).not.toBeNull();
      expect(zip.file("src/template/audio/soundscape.ts")).not.toBeNull();
      expect(zip.file("SKILL.md")).not.toBeNull();
      expect(zip.file(".kiro/powers/afterdark-horror/POWER.md")).not.toBeNull();
    });
  });
});
