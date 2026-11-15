import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog, specToJsonlStream } from "@genui-studio/core";
import {
  ArchiveSortOptionSchema,
  CategorySlugSchema,
  CRTModeSchema,
} from "./lib/archive/types.js";

/** Ordered with #000000 first so any non-monochrome foreground color heals safely to solid ink. */
export const MonochromeForegroundHexSchema = z.enum([
  "#000000",
  "#292929",
  "#808080",
  "#D9D9D9",
  "#FFFFFF",
]);

/** Ordered with #FFFFFF first so any invalid background surface heals safely to pure white paper. */
export const MonochromeSurfaceHexSchema = z.enum([
  "#FFFFFF",
  "#D9D9D9",
  "#808080",
  "#292929",
  "#000000",
]);

export const ArchiveYearBoundedSchema = z.number().int().min(1990).max(1999);

export const Ninety9EntrySlugEnumSchema = z.enum([
  "nirvana-nevermind",
  "the-matrix",
  "sony-playstation",
  "imac-g3",
  "nas-illmatic",
  "pulp-fiction",
  "windows-95",
  "nintendo-64",
  "twin-peaks",
  "seinfeld",
  "daft-punk-homework",
  "jurassic-park",
  "the-x-files",
  "neon-genesis-evangelion",
  "batman-tas",
  "doom-1993",
  "game-boy-pokemon",
  "palmpilot-1000",
  "sony-minidisc",
  "supreme-nyc",
  "minimalist-runway",
  "ncsa-mosaic",
  "netscape-navigator",
  "geocities-1994",
  "cybercafe-culture",
  "underground-rave",
  "tamagotchi",
  "beanie-babies",
  "dream-team-1992",
  "last-dance-1998",
  "y2k-bug-1999",
  "lollapalooza-91",
  "zine-diy-press",
  "dvd-optical-transition",
]);

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    WorkstationFrame: {
      description:
        "Monochrome NeXT/Macintosh workstation frame hosting global telemetry bar, primary navigation, routed sub-views, Paper-White CRT scanlines, and archival footer.",
      props: z.object({
        systemVersion: z.string().min(1).max(60),
        protocolLabel: z.string().min(1).max(60),
        defaultView: z.enum([
          "home",
          "archive",
          "timeline",
          "categories",
          "about",
          "dossier",
          "random-transmit",
          "arcade",
        ]),
        defaultCrtMode: CRTModeSchema,
        remixEditionLabel: z.string().max(96),
        inkHex: MonochromeForegroundHexSchema,
        surfaceHex: MonochromeSurfaceHexSchema,
      }),
      slots: ["default"],
    },
    HeroSection: {
      description:
        "Archival homepage masthead featuring classification badge, historical thesis statement, primary navigation actions, and live 4-cell dataset metrics.",
      props: z.object({
        classificationBadge: z.string().min(1).max(80),
        headline: z.string().min(1).max(140),
        subheadline: z.string().min(1).max(280),
        quote: z.string().min(1).max(240),
        quoteAttribution: z.string().min(1).max(80),
        primaryCtaLabel: z.string().min(1).max(48),
        secondaryCtaLabel: z.string().min(1).max(48),
        inkHex: MonochromeForegroundHexSchema,
        surfaceHex: MonochromeSurfaceHexSchema,
      }),
      slots: [],
    },
    FeaturedSection: {
      description:
        "Split lead artifact showcase plus four secondary halftone monochrome dossier cards clickable into the full Dossier Reader.",
      props: z.object({
        sectionHeading: z.string().min(1).max(96),
        leadSlug: Ninety9EntrySlugEnumSchema,
        secondarySlugs: z.array(Ninety9EntrySlugEnumSchema).min(1).max(4),
        panelSurfaceHex: MonochromeSurfaceHexSchema,
      }),
      slots: [],
    },
    CategoryGrid: {
      description:
        "Interactive 12-category indexed archive matrix linking directly into filtered archive sectors or deep category essays.",
      props: z.object({
        sectionHeading: z.string().min(1).max(96),
        subcaption: z.string().min(1).max(180),
        highlightCategory: z.union([z.literal("all"), CategorySlugSchema]),
        showEssaysPreview: z.boolean(),
      }),
      slots: [],
    },
    TimelinePreview: {
      description:
        "Interactive 1990-1999 horizontal year selector revealing quarterly cultural and technical milestones.",
      props: z.object({
        sectionHeading: z.string().min(1).max(96),
        initialYear: ArchiveYearBoundedSchema,
        displayMode: z.enum(["preview", "full"]),
      }),
      slots: [],
    },
    RandomTransmit: {
      description:
        "Simulated 99.4 MHz modem/radio packet tuner revealing random 1990s artifacts with re-transmit and dossier inspection actions.",
      props: z.object({
        frequencyLabel: z.string().min(1).max(48),
        heading: z.string().min(1).max(96),
        subheadline: z.string().min(1).max(200),
        defaultSeed: z.number().int().min(1).max(99999),
        autoExpandTelemetry: z.boolean(),
      }),
      slots: [],
    },
    ArchiveCatalogMatrix: {
      description:
        "Versatile archival grid supporting Homepage Recent Ingests, Searchable Catalog View 01, Category Essays View 03, and Manifesto About View 04.",
      props: z.object({
        heading: z.string().min(1).max(96),
        mode: z.enum(["recent", "catalog", "categories", "about"]),
        initialCategory: z.union([z.literal("all"), CategorySlugSchema]),
        initialYearFilter: z.enum([
          "all",
          "1990",
          "1991",
          "1992",
          "1993",
          "1994",
          "1995",
          "1996",
          "1997",
          "1998",
          "1999",
        ]),
        initialSort: ArchiveSortOptionSchema,
        limitCount: z.number().int().min(1).max(34),
      }),
      slots: [],
    },
    DossierReaderView: {
      description:
        "Full individual artifact dossier reader displaying SVG technical plate gallery, 4-cell specs table, numbered essays, cultural impact, citations, and 3 related dossiers.",
      props: z.object({
        slug: Ninety9EntrySlugEnumSchema,
        showRelated: z.boolean(),
        showGallery: z.boolean(),
      }),
      slots: [],
    },
    ArcadeCabinetSection: {
      description:
        "Monochrome 1990s workstation arcade cabinet hosting 3 playable HTML5 Canvas cartridges (Serpent-98, Break-Grid, Packet Invaders), Web Audio SFX, local high-score persistence, and Zod-clamped physics tuning.",
      props: z.object({
        heading: z.string().min(1).max(96),
        defaultGame: z.enum(["serpent-98", "break-grid", "packet-invaders"]),
        difficultyPreset: z.enum(["zen-91", "standard-1995", "turbo-y2k"]),
        paddleWidth: z.number().int().min(48).max(112),
        ballSpeed: z.number().int().min(2).max(6),
        snakeGridSize: z.number().int().min(14).max(26),
        invaderRows: z.number().int().min(2).max(5),
        inkHex: MonochromeForegroundHexSchema,
        surfaceHex: MonochromeSurfaceHexSchema,
        linkedDossierSlug: Ninety9EntrySlugEnumSchema,
      }),
      slots: [],
    },
  },
  actions: {},
});

const DEFAULT_HOME_ELEMENTS: Spec["elements"] = {
  "ninety9-shell": {
    type: "WorkstationFrame",
    props: {
      systemVersion: "SYS_ARCH_VER: 1990.99",
      protocolLabel: "PROTOCOL: HTTP/1.0 WHITE MONO",
      defaultView: "home",
      defaultCrtMode: "SUBTLE",
      remixEditionLabel: "",
      inkHex: "#000000",
      surfaceHex: "#FFFFFF",
    },
    children: [
      "ninety9-hero",
      "ninety9-home-arcade",
      "ninety9-featured",
      "ninety9-categories",
      "ninety9-timeline",
      "ninety9-transmit",
      "ninety9-recent",
    ],
  },
  "ninety9-hero": {
    type: "HeroSection",
    props: {
      classificationBadge: "SYS_CLASSIFICATION // PUBLIC ARCHIVE 1990-1999",
      headline: "NINETY9 // THE MONOCHROME ARCHIVE OF THE 1990S",
      subheadline:
        "Curated workstation publication indexing 34 cultural, hardware, cinema, web 1.0, and subcultural artifacts that defined the transition from analog tape to ubiquitous silicon.",
      quote:
        "Before every screen smoothed into glass, culture traveled by Xerox zine, 56k carrier tone, cartridge bus, and matte-black plastic.",
      quoteAttribution: "EDITORIAL MANIFESTO // REV 1999.12",
      primaryCtaLabel: "ENTER ARCHIVE CATALOG [01]",
      secondaryCtaLabel: "TUNE 99.4 MHZ TRANSMITTER",
      inkHex: "#000000",
      surfaceHex: "#FFFFFF",
    },
    children: [],
  },
  "ninety9-home-arcade": {
    type: "ArcadeCabinetSection",
    props: {
      heading: "WORKSTATION BAY // INSTANT PLAYABLE NINETY9 ARCADE",
      defaultGame: "packet-invaders",
      difficultyPreset: "standard-1995",
      paddleWidth: 80,
      ballSpeed: 4,
      snakeGridSize: 20,
      invaderRows: 4,
      inkHex: "#000000",
      surfaceHex: "#FFFFFF",
      linkedDossierSlug: "y2k-bug-1999",
    },
    children: [],
  },
  "ninety9-featured": {
    type: "FeaturedSection",
    props: {
      sectionHeading: "FEATURED ARTIFACT DOSSIERS // CURATED TRANSMISSION",
      leadSlug: "nirvana-nevermind",
      secondarySlugs: [
        "sony-playstation",
        "the-matrix",
        "ncsa-mosaic",
        "neon-genesis-evangelion",
      ],
      panelSurfaceHex: "#FFFFFF",
    },
    children: [],
  },
  "ninety9-categories": {
    type: "CategoryGrid",
    props: {
      sectionHeading: "ARCHIVAL DIRECTORY // 12 INDEXED SECTORS",
      subcaption:
        "Select any classification plate to filter artifacts or inspect full historical sector essays.",
      highlightCategory: "all",
      showEssaysPreview: true,
    },
    children: [],
  },
  "ninety9-timeline": {
    type: "TimelinePreview",
    props: {
      sectionHeading: "DECADE CHRONOLOGY // 1990-1999 SIGNAL SWITCHER",
      initialYear: 1991,
      displayMode: "preview",
    },
    children: [],
  },
  "ninety9-transmit": {
    type: "RandomTransmit",
    props: {
      frequencyLabel: "99.4 MHZ // V.90 PACKET TUNER",
      heading: "RANDOM PACKET TRANSMITTER",
      subheadline:
        "Sweep the 1990-1999 carrier band to lock onto an arbitrary cataloged artifact packet.",
      defaultSeed: 1997,
      autoExpandTelemetry: true,
    },
    children: [],
  },
  "ninety9-recent": {
    type: "ArchiveCatalogMatrix",
    props: {
      heading: "LATEST INGESTED DOSSIERS // VERIFIED PLATES",
      mode: "recent",
      initialCategory: "all",
      initialYearFilter: "all",
      initialSort: "chronological-desc",
      limitCount: 6,
    },
    children: [],
  },
};

export const initialPageSpecs: Readonly<Record<string, Spec>> = {
  home: {
    root: "ninety9-shell",
    elements: DEFAULT_HOME_ELEMENTS,
  },
  archive: {
    root: "ninety9-shell",
    elements: {
      "ninety9-shell": {
        type: "WorkstationFrame",
        props: {
          systemVersion: "SYS_ARCH_VER: 1990.99",
          protocolLabel: "PROTOCOL: HTTP/1.0 WHITE MONO",
          defaultView: "archive",
          defaultCrtMode: "SUBTLE",
          remixEditionLabel: "",
          inkHex: "#000000",
          surfaceHex: "#FFFFFF",
        },
        children: ["ninety9-catalog-view"],
      },
      "ninety9-catalog-view": {
        type: "ArchiveCatalogMatrix",
        props: {
          heading: "VIEW [01] // COMPLETE SEARCHABLE ARCHIVE CATALOG",
          mode: "catalog",
          initialCategory: "all",
          initialYearFilter: "all",
          initialSort: "chronological-asc",
          limitCount: 34,
        },
        children: [],
      },
    },
  },
  timeline: {
    root: "ninety9-shell",
    elements: {
      "ninety9-shell": {
        type: "WorkstationFrame",
        props: {
          systemVersion: "SYS_ARCH_VER: 1990.99",
          protocolLabel: "PROTOCOL: HTTP/1.0 WHITE MONO",
          defaultView: "timeline",
          defaultCrtMode: "SUBTLE",
          remixEditionLabel: "",
          inkHex: "#000000",
          surfaceHex: "#FFFFFF",
        },
        children: ["ninety9-timeline-view"],
      },
      "ninety9-timeline-view": {
        type: "TimelinePreview",
        props: {
          sectionHeading: "VIEW [02] // DECADE TIMELINE LEDGER (1990-1999)",
          initialYear: 1994,
          displayMode: "full",
        },
        children: [],
      },
    },
  },
  categories: {
    root: "ninety9-shell",
    elements: {
      "ninety9-shell": {
        type: "WorkstationFrame",
        props: {
          systemVersion: "SYS_ARCH_VER: 1990.99",
          protocolLabel: "PROTOCOL: HTTP/1.0 WHITE MONO",
          defaultView: "categories",
          defaultCrtMode: "SUBTLE",
          remixEditionLabel: "",
          inkHex: "#000000",
          surfaceHex: "#FFFFFF",
        },
        children: ["ninety9-categories-view"],
      },
      "ninety9-categories-view": {
        type: "ArchiveCatalogMatrix",
        props: {
          heading: "VIEW [03] // CATEGORY ESSAYS & SECTOR INDEX",
          mode: "categories",
          initialCategory: "music",
          initialYearFilter: "all",
          initialSort: "chronological-asc",
          limitCount: 34,
        },
        children: [],
      },
    },
  },
  about: {
    root: "ninety9-shell",
    elements: {
      "ninety9-shell": {
        type: "WorkstationFrame",
        props: {
          systemVersion: "SYS_ARCH_VER: 1990.99",
          protocolLabel: "PROTOCOL: HTTP/1.0 WHITE MONO",
          defaultView: "about",
          defaultCrtMode: "SUBTLE",
          remixEditionLabel: "",
          inkHex: "#000000",
          surfaceHex: "#FFFFFF",
        },
        children: ["ninety9-about-view"],
      },
      "ninety9-about-view": {
        type: "ArchiveCatalogMatrix",
        props: {
          heading: "VIEW [04] // ABOUT, MANIFESTO & MONOCHROME SPECIMEN",
          mode: "about",
          initialCategory: "all",
          initialYearFilter: "all",
          initialSort: "chronological-asc",
          limitCount: 34,
        },
        children: [],
      },
    },
  },
  arcade: {
    root: "ninety9-shell",
    elements: {
      "ninety9-shell": {
        type: "WorkstationFrame",
        props: {
          systemVersion: "SYS_ARCH_VER: 1990.99",
          protocolLabel: "PROTOCOL: HTTP/1.0 WHITE MONO",
          defaultView: "arcade",
          defaultCrtMode: "SUBTLE",
          remixEditionLabel: "",
          inkHex: "#000000",
          surfaceHex: "#FFFFFF",
        },
        children: ["ninety9-arcade-view"],
      },
      "ninety9-arcade-view": {
        type: "ArcadeCabinetSection",
        props: {
          heading: "VIEW [05] // NINETY9 ARCADE WORKSTATION",
          defaultGame: "packet-invaders",
          difficultyPreset: "standard-1995",
          paddleWidth: 80,
          ballSpeed: 4,
          snakeGridSize: 20,
          invaderRows: 4,
          inkHex: "#000000",
          surfaceHex: "#FFFFFF",
          linkedDossierSlug: "y2k-bug-1999",
        },
        children: [],
      },
    },
  },
};

export function buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
  const base = currentSpec ?? initialPageSpecs.home!;
  const lower = prompt.toLowerCase();

  // Preset 3: Inject deliberately corrupted non-monochrome colors + invalid year
  // as a full self-contained Spec stream so both warm and fresh GuardrailedStreamCompilers
  // heal every off-palette hex and out-of-range year with provenance badges.
  if (
    lower.includes("corrupt") ||
    lower.includes("non-monochrome") ||
    lower.includes("invalid year") ||
    lower.includes("chaos")
  ) {
    const corruptedSpec = {
      root: "ninety9-shell",
      elements: {
        ...DEFAULT_HOME_ELEMENTS,
        ...(base.root === "ninety9-shell" ? base.elements : {}),
        "ninety9-shell": {
          ...(base.elements["ninety9-shell"] ?? DEFAULT_HOME_ELEMENTS["ninety9-shell"]!),
          type: "WorkstationFrame",
          props: {
            ...(base.elements["ninety9-shell"]?.props ??
              DEFAULT_HOME_ELEMENTS["ninety9-shell"]!.props),
            defaultView: "home",
            remixEditionLabel: "GUARDRAIL HEALED // NON-MONO & YEAR 2045 REJECTED",
          },
        },
        "ninety9-hero": {
          ...(base.elements["ninety9-hero"] ?? DEFAULT_HOME_ELEMENTS["ninety9-hero"]!),
          type: "HeroSection",
          props: {
            ...(base.elements["ninety9-hero"]?.props ??
              DEFAULT_HOME_ELEMENTS["ninety9-hero"]!.props),
            classificationBadge: "CHAOS RECOVERY // CORRUPTED PACKET INTERCEPTED",
            inkHex: "#FF00FF",
            surfaceHex: "#00FFCC",
          },
        },
        "ninety9-timeline": {
          ...(base.elements["ninety9-timeline"] ?? DEFAULT_HOME_ELEMENTS["ninety9-timeline"]!),
          type: "TimelinePreview",
          props: {
            ...(base.elements["ninety9-timeline"]?.props ??
              DEFAULT_HOME_ELEMENTS["ninety9-timeline"]!.props),
            initialYear: 2045,
          },
        },
      },
    } as unknown as Spec;

    return specToJsonlStream(corruptedSpec);
  }

  // Preset 4: 1998 NINETY9 Arcade Special Edition (Turbo Packet Invaders / Break-Grid)
  if (
    lower.includes("arcade") ||
    lower.includes("invader") ||
    lower.includes("break-grid") ||
    lower.includes("serpent")
  ) {
    const arcadeSpec: Spec = {
      root: "ninety9-shell",
      elements: {
        "ninety9-shell": {
          type: "WorkstationFrame",
          props: {
            systemVersion: "SYS_ARCH_VER: 1998.99",
            protocolLabel: "PROTOCOL: HTTP/1.0 ARCADE BAY",
            defaultView: "arcade",
            defaultCrtMode: "ACTIVE",
            remixEditionLabel: "SPECIAL CARTRIDGE // TURBO Y2K ARCADE BAY",
            inkHex: "#000000",
            surfaceHex: "#FFFFFF",
          },
          children: ["ninety9-arcade-view"],
        },
        "ninety9-arcade-view": {
          type: "ArcadeCabinetSection",
          props: {
            heading: "VIEW [05] // TURBO Y2K ARCADE WORKSTATION",
            defaultGame: "packet-invaders",
            difficultyPreset: "turbo-y2k",
            paddleWidth: 64,
            ballSpeed: 5,
            snakeGridSize: 18,
            invaderRows: 5,
            inkHex: "#000000",
            surfaceHex: "#FFFFFF",
            linkedDossierSlug: "y2k-bug-1999",
          },
          children: [],
        },
      },
    };
    return specToJsonlStream(arcadeSpec);
  }

  // Preset 1: 1995 Cyber-Hardware Special Issue (Technology & Gaming)
  if (
    lower.includes("1995") ||
    lower.includes("cyber") ||
    lower.includes("hardware") ||
    lower.includes("gaming") ||
    lower.includes("technology")
  ) {
    const nextSpec: Spec = {
      root: "ninety9-shell",
      elements: {
        ...DEFAULT_HOME_ELEMENTS,
        "ninety9-shell": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-shell"]!,
          props: {
            ...DEFAULT_HOME_ELEMENTS["ninety9-shell"]!.props,
            defaultView: "home",
            remixEditionLabel: "SPECIAL ISSUE // 1995 CYBER-HARDWARE & GAMING",
          },
        },
        "ninety9-hero": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-hero"]!,
          props: {
            ...DEFAULT_HOME_ELEMENTS["ninety9-hero"]!.props,
            classificationBadge: "SPECIAL ISSUE // 1995 SILICON & POLYGON EDITION",
            headline: "1995 CYBER-HARDWARE & REAL-TIME 3D FRONTIER",
            subheadline:
              "Focus dossier assembling 32-bit polygon consoles, Windows 95 Winsock TCP/IP stacks, MIPS workstations, and pocket PDAs.",
            quote:
              "Every living-room television became a geometry pipeline the week real-time texture mapping crossed under three hundred dollars.",
          },
        },
        "ninety9-featured": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-featured"]!,
          props: {
            sectionHeading: "1995 SPECIAL ISSUE // HARDWARE & GAMING PLATES",
            leadSlug: "sony-playstation",
            secondarySlugs: [
              "windows-95",
              "doom-1993",
              "nintendo-64",
              "imac-g3",
            ],
            panelSurfaceHex: "#D9D9D9",
          },
        },
        "ninety9-categories": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-categories"]!,
          props: {
            ...DEFAULT_HOME_ELEMENTS["ninety9-categories"]!.props,
            highlightCategory: "hardware",
          },
        },
        "ninety9-timeline": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-timeline"]!,
          props: {
            sectionHeading: "1995 HARDWARE & GAMING PIVOT // CHRONOLOGY",
            initialYear: 1995,
            displayMode: "preview",
          },
        },
        "ninety9-recent": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-recent"]!,
          props: {
            heading: "GAMING & SILICON MATRIX // FILTERED PLATES",
            mode: "recent",
            initialCategory: "gaming",
            initialYearFilter: "all",
            initialSort: "chronological-asc",
            limitCount: 6,
          },
        },
      },
    };
    return specToJsonlStream(nextSpec);
  }

  // Preset 2: 1991 Underground Zine Edition (Music & Cinema)
  if (
    lower.includes("1991") ||
    lower.includes("zine") ||
    lower.includes("underground") ||
    lower.includes("music") ||
    lower.includes("cinema")
  ) {
    const nextSpec: Spec = {
      root: "ninety9-shell",
      elements: {
        ...DEFAULT_HOME_ELEMENTS,
        "ninety9-shell": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-shell"]!,
          props: {
            ...DEFAULT_HOME_ELEMENTS["ninety9-shell"]!.props,
            defaultView: "home",
            remixEditionLabel: "UNDERGROUND ZINE // 1991 MUSIC & CINEMA EDITION",
          },
        },
        "ninety9-hero": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-hero"]!,
          props: {
            ...DEFAULT_HOME_ELEMENTS["ninety9-hero"]!.props,
            classificationBadge: "ZINE EDITION // 1991 XEROX COUNTERCULTURE",
            headline: "1991 UNDERGROUND ZINE & CELLULOID EDITION",
            subheadline:
              "Focus transmission tracing distorted basement punk, independent noir film reels, nomadic alt-festivals, and hand-stapled Riot Grrrl presses.",
            quote:
              "A twenty-five-cent photocopied pamphlet stapled in an apartment hallway carried more signal than an entire cable syndicate.",
          },
        },
        "ninety9-featured": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-featured"]!,
          props: {
            sectionHeading: "1991 ZINE ISSUE // MUSIC & CINEMA PLATES",
            leadSlug: "nirvana-nevermind",
            secondarySlugs: [
              "pulp-fiction",
              "zine-diy-press",
              "lollapalooza-91",
              "nas-illmatic",
            ],
            panelSurfaceHex: "#FFFFFF",
          },
        },
        "ninety9-categories": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-categories"]!,
          props: {
            ...DEFAULT_HOME_ELEMENTS["ninety9-categories"]!.props,
            highlightCategory: "music",
          },
        },
        "ninety9-timeline": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-timeline"]!,
          props: {
            sectionHeading: "1991 UNDERGROUND BREAKOUT // CHRONOLOGY",
            initialYear: 1991,
            displayMode: "preview",
          },
        },
        "ninety9-recent": {
          ...DEFAULT_HOME_ELEMENTS["ninety9-recent"]!,
          props: {
            heading: "MUSIC & ZINE PLATES // ARCHIVAL FEED",
            mode: "recent",
            initialCategory: "music",
            initialYearFilter: "all",
            initialSort: "chronological-asc",
            limitCount: 6,
          },
        },
      },
    };
    return specToJsonlStream(nextSpec);
  }

  // Fallback custom prompt remix: update headline cleanly inside strict monochrome tokens
  const hero = base.elements["ninety9-hero"];
  if (!hero) {
    return specToJsonlStream(base);
  }
  const cleanPromptHeadline = prompt.trim().slice(0, 120).toUpperCase();
  const lines = [
    JSON.stringify({
      op: "replace",
      path: "/elements/ninety9-hero/props/headline",
      value: cleanPromptHeadline || "NINETY9 // CUSTOM ARCHIVE REMIX",
    }),
    JSON.stringify({
      op: "replace",
      path: `/elements/${base.root}/props/remixEditionLabel`,
      value: `CUSTOM TRANSMISSION // ${cleanPromptHeadline.slice(0, 48)}`,
    }),
  ];
  return `${lines.join("\n")}\n`;
}

export function buildChaosPackets(rootKey: string): string[] {
  return [
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-monochrome-timeline",
      value: {
        type: "TimelinePreview",
        props: {
          sectionHeading: "HEALED CHAOS NODE (YEAR 2077 CLAMPED TO 1999)",
          initialYear: 2077,
          displayMode: "preview",
        },
        children: [],
      },
    }),
    JSON.stringify({
      op: "add",
      path: `/elements/${rootKey}/children/-`,
      value: "chaos-monochrome-timeline",
    }),
    JSON.stringify({
      op: "add",
      path: "/elements/chaos-monochrome-hero",
      value: {
        type: "HeroSection",
        props: {
          classificationBadge: "CHAOS HEALED // NEON HEX -> #000000",
          headline: "CORRUPTED PACKET SANITIZED BY GENUI CORE",
          subheadline:
            "Injected off-palette hex #FF00FF and #39FF14 were intercepted before DOM mount and healed to strict 5-tone monochrome tokens.",
          quote:
            "Every schema invariant holds even under malformed JSONL packet injection.",
          quoteAttribution: "GENUI GUARDRAIL // STREAM COMPILER",
          primaryCtaLabel: "ENTER ARCHIVE CATALOG [01]",
          secondaryCtaLabel: "TUNE 99.4 MHZ TRANSMITTER",
          inkHex: "#FF00FF",
          surfaceHex: "#39FF14",
        },
        children: [],
      },
    }),
    JSON.stringify({
      op: "add",
      path: `/elements/${rootKey}/children/-`,
      value: "chaos-monochrome-hero",
    }),
  ];
}
