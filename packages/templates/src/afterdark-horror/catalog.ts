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
          "forgotten_graves",
          "dead_garden",
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
        cueType: z.enum([
          "rear_whisper",
          "gate_slam",
          "branch_creak",
          "thunder_crack",
          "the_watcher",
          "moving_shadow",
          "weeping_woman",
          "the_presence",
          "final_warning",
        ]),
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
          "zone-graves",
          "zone-garden",
          "zone-chapel",
          "zone-crypt",
          "clue-01-grave",
          "clue-02-chapel",
          "clue-03-caretaker",
          "trigger-enc-01",
          "trigger-enc-02",
          "trigger-enc-03",
          "trigger-enc-04",
          "trigger-enc-05",
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
          zoneName: "Zone A · Wrought-Iron Gatehouse",
          ambientHint: "Twin lanterns sputter beside the locked iron entry.",
          lanternCount: 2,
        },
      },
      "zone-graves": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "forgotten_graves",
          zoneName: "Zone B · Forgotten Graves",
          ambientHint: "Instanced lancet stones, obelisks, and Celtic crosses crowd the mist.",
          lanternCount: 1,
        },
      },
      "zone-garden": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "dead_garden",
          zoneName: "Zone C · The Dead Garden",
          ambientHint: "Crumbling stone fountain and concealed northern trail to the chapel.",
          lanternCount: 2,
        },
      },
      "zone-chapel": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "chapel_steps",
          zoneName: "Zone D · Abandoned Gothic Chapel",
          ambientHint: "Enterable sanctuary nave with altar and east stairwell to the crypt.",
          lanternCount: 1,
        },
      },
      "zone-crypt": {
        type: "CemeteryZoneCluster",
        props: {
          zoneId: "crypt_entrance",
          zoneName: "Zone E · The Underground Crypt",
          ambientHint: "Subterranean sarcophagi corridor hiding the concealed LIGHT MODE switch.",
          lanternCount: 0,
        },
      },
      "clue-01-grave": {
        type: "ClueMonumentNode",
        props: {
          clueId: "clue-01",
          title: "The Grave Inscription",
          inscription: "THE LIGHT WAS NEVER LOST. IT WAS HIDDEN.",
          yearStamped: "1894",
          worldPosition: [-7.2, 1.12, 12.2],
          discovered: false,
        },
      },
      "clue-02-chapel": {
        type: "ClueMonumentNode",
        props: {
          clueId: "clue-02",
          title: "The Chapel Altar Message",
          inscription: "WHEN THE WORLD WENT DARK, THE KEEPER LEFT A WAY BACK.",
          yearStamped: "1902",
          worldPosition: [0.0, 1.45, -40.3],
          discovered: false,
        },
      },
      "clue-03-caretaker": {
        type: "ClueMonumentNode",
        props: {
          clueId: "clue-03",
          title: "The Caretaker's Note",
          inscription:
            "Descend the east chapel stairs into Zone E, follow the stone sarcophagi West behind the sealed arch, and trip the concealed LIGHT MODE breaker before the storm floods the vault.",
          yearStamped: "OCT 31",
          worldPosition: [-11.2, 1.05, -24.5],
          discovered: false,
        },
      },
      "trigger-enc-01": {
        type: "SupernaturalEncounterTrigger",
        props: {
          triggerId: "enc-01",
          label: "The Watcher (Zone B)",
          cueType: "the_watcher",
          radiusMeters: 13.5,
          armed: true,
        },
      },
      "trigger-enc-02": {
        type: "SupernaturalEncounterTrigger",
        props: {
          triggerId: "enc-02",
          label: "The Moving Shadow (Zone C)",
          cueType: "moving_shadow",
          radiusMeters: 6.2,
          armed: true,
        },
      },
      "trigger-enc-03": {
        type: "SupernaturalEncounterTrigger",
        props: {
          triggerId: "enc-03",
          label: "The Weeping Woman (Zone C Fountain)",
          cueType: "weeping_woman",
          radiusMeters: 9.5,
          armed: true,
        },
      },
      "trigger-enc-04": {
        type: "SupernaturalEncounterTrigger",
        props: {
          triggerId: "enc-04",
          label: "The Presence (Chapel Avenue)",
          cueType: "the_presence",
          radiusMeters: 7.5,
          armed: true,
        },
      },
      "trigger-enc-05": {
        type: "SupernaturalEncounterTrigger",
        props: {
          triggerId: "enc-05",
          label: "The Final Warning (Zone E Crypt)",
          cueType: "final_warning",
          radiusMeters: 6.8,
          armed: true,
        },
      },
      "switch-chapel-breaker": {
        type: "PhysicalLightModeSwitch",
        props: {
          switchId: "breaker-01",
          locationLabel: "Zone E Crypt NW Breaker Alcove",
          worldPosition: [-4.0, -3.2, -50.22],
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
