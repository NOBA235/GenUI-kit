import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog, specToJsonlStream } from "@genui-studio/core";

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    // 1. 3D World & Horror Director Nodes
    DarknessAndWeatherController: {
      description:
        "Root horror scene director controlling darkness level, exponential fog density, wind strength, seizure-safe lightning pulses, hardware quality preset, and Scene 01/02/FPS camera progression.",
      props: z.object({
        experienceTitle: z.string().min(1).max(60),
        fogDensity: z.number().min(0.005).max(0.14),
        darknessLevel: z.number().min(0).max(1),
        windStrength: z.number().min(0).max(1.5),
        lightningEnabled: z.boolean(),
        qualityPreset: z.enum(["low", "medium", "high"]),
        debugMode: z.boolean(),
        lightModeRestored: z.boolean(),
      }),
      slots: ["default"],
    },
    CemeteryZoneCluster: {
      description:
        "Procedural 3D cemetery district node configuring instanced graves, iron pickets, dead trees, lantern anchoring, and spatial collision boundaries.",
      props: z.object({
        zoneId: z.enum([
          "gatehouse",
          "central_path",
          "weeping_grove",
          "mausoleum",
          "chapel_steps",
          "crypt_entrance",
        ]),
        zoneName: z.string().min(1).max(80),
        ambientHint: z.string().min(1).max(180),
        lanternCount: z.number().int().min(0).max(6),
      }),
      slots: [],
    },
    ClueMonumentNode: {
      description:
        "Interactive 3D weathered monument / gravestone inscription anchor synced to world coordinates and catalog lore records.",
      props: z.object({
        clueId: z.string().min(1).max(48),
        title: z.string().min(1).max(80),
        inscription: z.string().min(1).max(240),
        yearStamped: z.string().min(1).max(24),
        worldPosition: z.tuple([z.number(), z.number(), z.number()]),
        discovered: z.boolean(),
      }),
      slots: [],
    },
    SupernaturalEncounterTrigger: {
      description:
        "Spatial proximity anomaly trigger controlling rear breath whispers, hinge creaks, and psychological tension envelopes.",
      props: z.object({
        triggerId: z.string().min(1).max(48),
        label: z.string().min(1).max(80),
        cueType: z.enum(["rear_whisper", "gate_slam", "branch_creak", "thunder_crack"]),
        radiusMeters: z.number().min(1).max(25),
        armed: z.boolean(),
      }),
      slots: [],
    },
    PhysicalLightModeSwitch: {
      description:
        "Physical 3D circuit breaker / sanctuary switch node anchored inside the cemetery to dispel darkness and illuminate the restored editorial website.",
      props: z.object({
        switchId: z.string().min(1).max(48),
        locationLabel: z.string().min(1).max(80),
        worldPosition: z.tuple([z.number(), z.number(), z.number()]),
        engaged: z.boolean(),
      }),
      slots: [],
    },

    // 2. Restored Illuminated Editorial Website Sections (Revealed when Light Mode is restored)
    RestoredEditorialHero: {
      description:
        "Daylight-restored editorial hero masthead revealing AFTERDARK's documentary case study once darkness is dispelled.",
      props: z.object({
        editionLabel: z.string().min(1).max(48),
        headline: z.string().min(1).max(140),
        standfirst: z.string().min(1).max(320),
        primaryActionLabel: z.string().min(1).max(48),
      }),
      slots: [],
    },
    EncounterArchiveGrid: {
      description:
        "Structured editorial grid documenting architectural landmarks, anomalies, and spatial audio syntheses experienced in the cemetery.",
      props: z.object({
        sectionTitle: z.string().min(1).max(80),
        entries: z.array(
          z.object({
            code: z.string().min(1).max(24),
            title: z.string().min(1).max(80),
            summary: z.string().min(1).max(200),
          }),
        ),
      }),
      slots: [],
    },
    InteractiveLoreTimeline: {
      description:
        "Chronological historical ledger linking Ravenshollow Cemetery dates to discovered 3D landmarks.",
      props: z.object({
        heading: z.string().min(1).max(80),
        milestones: z.array(
          z.object({
            year: z.string().min(1).max(24),
            event: z.string().min(1).max(140),
            detail: z.string().min(1).max(220),
          }),
        ),
      }),
      slots: [],
    },
    ExperienceReplayFooter: {
      description:
        "Editorial closing colophon providing one-click return to the pitch-black 2:17 AM shutdown sequence and engineering architecture specs.",
      props: z.object({
        colophon: z.string().min(1).max(160),
        replayButtonLabel: z.string().min(1).max(48),
        hardwareNote: z.string().min(1).max(120),
      }),
      slots: [],
    },
  },
  actions: {},
});

export const initialPageSpecs: Record<string, Spec> = {
  home: {
    root: "horror-director",
    elements: {
      "horror-director": {
        type: "DarknessAndWeatherController",
        props: {
          experienceTitle: "AFTERDARK · Ravenshollow 1902",
          fogDensity: 0.056,
          darknessLevel: 0.94,
          windStrength: 0.65,
          lightningEnabled: true,
          qualityPreset: "medium",
          debugMode: false,
          lightModeRestored: false,
        },
        children: [
          "zone-gatehouse",
          "zone-central",
          "zone-chapel",
          "clue-gate-plaque",
          "trigger-rear-whisper",
          "switch-chapel-breaker",
          "restored-hero",
          "restored-archive",
          "restored-timeline",
          "restored-footer",
        ],
      },
      "zone-gatehouse": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "gatehouse",
          zoneName: "Wrought-Iron Gatehouse",
          ambientHint: "Twin lanterns sputter beside the locked iron entry.",
          lanternCount: 2,
        },
      },
      "zone-central": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "central_path",
          zoneName: "Ashen Central Avenue",
          ambientHint: "Instanced lancet headstones lean beside flagstone paving.",
          lanternCount: 3,
        },
      },
      "zone-chapel": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "chapel_steps",
          zoneName: "Sanctuary Chapel Steps",
          ambientHint: "Crimson stained glass pulses faintly through storm mist.",
          lanternCount: 1,
        },
      },
      "clue-gate-plaque": {
        type: "ClueMonumentNode",
        props: {
          clueId: "clue-01",
          title: "Sexton Brass Plaque (1902)",
          inscription: "Herein none depart before breaking the sanctuary circuit.",
          yearStamped: "MCMII",
          worldPosition: [-3.0, 1.4, 28.1],
          discovered: false,
        },
      },
      "trigger-rear-whisper": {
        type: "SupernaturalEncounterTrigger",
        props: {
          triggerId: "trig-01",
          label: "2:17 AM Rear Breath Anomaly",
          cueType: "rear_whisper",
          radiusMeters: 6,
          armed: true,
        },
      },
      "switch-chapel-breaker": {
        type: "PhysicalLightModeSwitch",
        props: {
          switchId: "breaker-01",
          locationLabel: "Chapel Vestibule Power Lever",
          worldPosition: [0, 1.5, -35.2],
          engaged: false,
        },
      },
      "restored-hero": {
        type: "RestoredEditorialHero",
        props: {
          editionLabel: "RESTORED DAYLIGHT EDITION · ISSUE 01",
          headline: "Ravenshollow Municipal Archive: Illumination Restored",
          standfirst:
            "Every shadow in AFTERDARK ran live inside a single-server WebGL & Zod-verified Dual-Mode template—transitioning cleanly from horror exploration to editorial publication.",
          primaryActionLabel: "Re-Enter 2:17 AM Shutdown",
        },
      },
      "restored-archive": {
        type: "EncounterArchiveGrid",
        props: {
          sectionTitle: "Cataloged Spatial & Acoustic Landmarks",
          entries: [
            {
              code: "ZONE-01",
              title: "Wrought-Iron Gatehouse",
              summary:
                "Hinged iron leaves with AABB collision lock behind the explorer after cinematic dolly transit.",
            },
            {
              code: "ZONE-02",
              title: "The Weeping Grove & Plots",
              summary:
                "Instanced gnarled dead trees and lancet tombstones with deterministic circle-sliding collision.",
            },
            {
              code: "ZONE-03",
              title: "Sanctuary Chapel Spire",
              summary:
                "Emissive stained-glass horizon beacon visible through exponential fog during lightning reveals.",
            },
          ],
        },
      },
      "restored-timeline": {
        type: "InteractiveLoreTimeline",
        props: {
          heading: "Chronology of the Grounds",
          milestones: [
            {
              year: "1902",
              event: "Ravenshollow Consecration & Gate Forge",
              detail: "Wrought-iron entrance arches erected over the south flagstone avenue.",
            },
            {
              year: "1974",
              event: "The 2:17 AM Grid Failure",
              detail: "Storm lightning severed the sanctuary feed along the east mausoleum portico.",
            },
            {
              year: "2026",
              event: "Dual-Mode Archive Reconstruction",
              detail: "Rebuilt inside @genui-studio/core with locked 60 FPS WebGL and Web Audio synthesis.",
            },
          ],
        },
      },
      "restored-footer": {
        type: "ExperienceReplayFooter",
        props: {
          colophon:
            "AFTERDARK Flagship Template · Built with @genui-studio/core, Three.js & Procedural Web Audio.",
          replayButtonLabel: "Return to Pitch-Black Shutdown",
          hardwareNote: "Hardware Preset Support: LOW / MEDIUM / HIGH (InstancedMesh + Zero-GC Loop)",
        },
      },
    },
  },
};

export function buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
  const base = currentSpec ?? initialPageSpecs.home!;
  const director = base.elements["horror-director"];
  const lower = prompt.toLowerCase();

  let fogDensity = 0.056;
  let darknessLevel = 0.94;
  let windStrength = 0.65;
  let lightningEnabled = true;
  let lightModeRestored = false;

  if (lower.includes("storm") || lower.includes("thunder") || lower.includes("blood moon")) {
    fogDensity = 0.044;
    darknessLevel = 0.88;
    windStrength = 1.25;
    lightningEnabled = true;
  } else if (lower.includes("fog") || lower.includes("mist") || lower.includes("crypt")) {
    fogDensity = 0.095;
    darknessLevel = 0.96;
    windStrength = 0.45;
  } else if (
    lower.includes("daylight") ||
    lower.includes("illuminate") ||
    lower.includes("light mode") ||
    lower.includes("restore")
  ) {
    fogDensity = 0.012;
    darknessLevel = 0.05;
    windStrength = 0.25;
    lightningEnabled = false;
    lightModeRestored = true;
  }

  const nextSpec: Spec = {
    ...base,
    elements: {
      ...base.elements,
      "horror-director": {
        ...(director ?? { type: "DarknessAndWeatherController", children: [] }),
        props: {
          ...((director?.props as Record<string, unknown>) ?? {}),
          fogDensity,
          darknessLevel,
          windStrength,
          lightningEnabled,
          lightModeRestored,
        },
      },
    },
  };

  return specToJsonlStream(nextSpec);
}
