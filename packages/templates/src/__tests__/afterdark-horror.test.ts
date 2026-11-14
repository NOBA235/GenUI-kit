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
  isOnStonePaving,
  PLAYER_RADIUS,
  resolvePlayerMovement,
  resolveZoneAtPosition,
  TOMBSTONE_LAYOUT,
  DEAD_TREE_LAYOUT,
  ZONE_TELEPORT_TARGETS,
  STATIC_AABB_COLLIDERS,
} from "../afterdark-horror/engine/collision.js";
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

    it("keeps every zone teleport waypoint collision-free and accurately classifies surfaces", () => {
      for (const wp of ZONE_TELEPORT_TARGETS) {
        const res = resolvePlayerMovement(
          wp.position[0],
          wp.position[2],
          wp.position[0],
          wp.position[2],
          { gateLocked: true },
        );
        expect(res.collided).toBe(false);
        expect(resolveZoneAtPosition(wp.position[0], wp.position[2])).toBe(
          wp.zoneId,
        );
      }

      expect(isOnStonePaving(0, 8.0)).toBe(true);
      expect(isOnStonePaving(-16.0, 3.0)).toBe(false);
    });
  });

  describe("3. Procedural 3D Geometries, Hardware Budgets & Web Audio Fallback", () => {
    it("constructs and disposes Three.js BufferGeometries cleanly with capped quality budgets", () => {
      const geoms = createAfterdarkSharedGeometries();
      expect(geoms.lancetTombstone.getAttribute("position").count).toBeGreaterThan(24);
      expect(geoms.obeliskTombstone.getAttribute("position").count).toBeGreaterThan(24);
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
        audio.playFootstep("gravel", true);
        audio.playLightningThunder();
        audio.dispose();
      }).not.toThrow();
    });
  });

  describe("4. Zustand Phase State Machine & Next.js .ZIP Export", () => {
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
