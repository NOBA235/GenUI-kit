import { z } from "zod";
import type { Spec } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog, specToJsonlStream } from "@genui-studio/core";

export const verifiedCatalog = createVerifiedCatalog(schema, {
  components: {
    CmosWorkstationShell: {
      description:
        "Root workspace for BIOS // NECROMANCER. Switches between CMOS SETUP (split-screen Award BIOS + 3D motherboard) and HARDWARE LANDING PAGE modes, lays out child modules, and loads a register preset (bios, setup, overclock, undervolt).",
      props: z.object({
        workspaceTitle: z.string().min(1).max(80),
        defaultMode: z.enum(["setup", "landing"]),
        bootPreset: z.enum(["bios", "setup", "overclock", "undervolt"]),
        showPostOnBoot: z.boolean(),
      }),
      slots: ["default"],
    },
    PostBootSequence: {
      description:
        "1994 Power-On Self-Test screen: Energy Star emblem, RAM count-up, IDE device detection from the live CMOS registers, and Award beep codes. DEL or click enters SETUP; SPACE skips.",
      props: z.object({
        biosVersion: z.string().min(1).max(24),
        vendorLine: z.string().min(1).max(80),
        memoryTestMs: z.number().int().min(0).max(8000),
      }),
      slots: [],
    },
    AwardBiosMenuGrid: {
      description:
        "Award Modular BIOS setup utility with six menus (standard cloud features, chipset & serverless, peripherals & IRQ, power & FinOps, PnP/PCIe accelerator, modem & IaC compiler). Keyboard and mouse driven; every register write is Zod validated.",
      props: z.object({
        title: z.string().min(1).max(80),
        copyrightLine: z.string().min(1).max(80),
      }),
      slots: [],
    },
    Motherboard3DTwin: {
      description:
        "Instanced 3D ATX motherboard (React Three Fiber) synchronized with the BIOS: camera follows menu focus, heatsink tints with die temperature, fan spins with clock speed, PCIe cards mirror slot devices.",
      props: z.object({
        caption: z.string().min(1).max(60),
      }),
      slots: [],
    },
    HardwareTelemetryMonitor: {
      description:
        "PC Health Status panel showing simulated monthly burn, P99 latency, max throughput, CPU temperature, package power, stability and active alarms.",
      props: z.object({
        heading: z.string().min(1).max(60),
        showCostBreakdown: z.boolean(),
      }),
      slots: [],
    },
    IaCCodeCompilerOutput: {
      description:
        "Live tabs with the compiled docker-compose.yml, vercel.json and main.tf for the current CMOS registers, plus deployment notes. Rendered as a landing-page section; embedded in BIOS menu 6 in setup mode.",
      props: z.object({
        heading: z.string().min(1).max(60),
        projectName: z.string().regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/),
      }),
      slots: [],
    },
    AcousticModemOscilloscope: {
      description:
        "Live oscilloscope and FFT of the Web Audio output, and the TRANSMIT CONFIG OVER AUDIO button that sends the compiled cloud manifest as Bell 103 FSK tones.",
      props: z.object({
        heading: z.string().min(1).max(60),
      }),
      slots: [],
    },
    DevToolsHeroSection: {
      description:
        "Landing-page hero for HARDWARE LANDING PAGE mode with install command, feature list and live simulator metrics.",
      props: z.object({
        eyebrow: z.string().min(1).max(80),
        headline: z.string().min(1).max(120),
        subheadline: z.string().min(1).max(320),
        primaryCtaLabel: z.string().min(1).max(40),
        installCommand: z.string().min(1).max(80),
        features: z.array(z.string().min(1).max(120)).min(1).max(6),
      }),
      slots: [],
    },
    CmosRegisterPacket: {
      description:
        "Streamed hardware register write (Vcore, CPU multiplier, PCI IRQs). Props are clamped by the catalog, then validated against the exact CMOS register grid; invalid packets trigger fail-safe BIOS defaults instead of crashing.",
      props: z.object({
        packetId: z.string().min(1).max(32),
        coreVoltageMv: z.number().int().min(2000).max(4000),
        multiplier: z.number().min(1).max(8),
        irqSlot1: z.number().int().min(0).max(15),
        irqSlot2: z.number().int().min(0).max(15),
      }),
      slots: [],
    },
  },
  actions: {},
});

const SHELL_KEY = "cmos-shell";

export const initialPageSpecs: Record<string, Spec> = {
  home: {
    root: SHELL_KEY,
    elements: {
      [SHELL_KEY]: {
        type: "CmosWorkstationShell",
        props: {
          workspaceTitle: "BIOS // NECROMANCER  CMOS SETUP UTILITY",
          defaultMode: "setup",
          bootPreset: "setup",
          showPostOnBoot: true,
        },
        children: ["post", "bios", "twin", "telemetry", "hero", "iac", "modem"],
      },
      post: {
        type: "PostBootSequence",
        props: {
          biosVersion: "v4.51PG",
          vendorLine: "Copyright (C) 1984-94, Award Software, Inc. // GenUI Cloud Edition",
          memoryTestMs: 1600,
        },
        children: [],
      },
      bios: {
        type: "AwardBiosMenuGrid",
        props: {
          title: "ROM PCI/ISA BIOS (2A59GN2C) CMOS SETUP UTILITY",
          copyrightLine: "AWARD SOFTWARE, INC. // CLOUD-TO-CMOS EDITION",
        },
        children: [],
      },
      twin: {
        type: "Motherboard3DTwin",
        props: { caption: "MOTHERBOARD DIGITAL TWIN" },
        children: [],
      },
      telemetry: {
        type: "HardwareTelemetryMonitor",
        props: { heading: "PC HEALTH STATUS", showCostBreakdown: true },
        children: [],
      },
      hero: {
        type: "DevToolsHeroSection",
        props: {
          eyebrow: "OPEN SOURCE // GENUI STUDIO TEMPLATE",
          headline: "Configure your cloud like it's 1994.",
          subheadline:
            "Tune clock multipliers, RAID arrays and IRQ lines in an Award BIOS, watch cost, P99 latency and thermals react, then compile real docker-compose.yml, vercel.json and main.tf.",
          primaryCtaLabel: "ENTER CMOS SETUP",
          installCommand: "npx genui-studio add cmos-cloud-bios",
          features: [
            "Deterministic IaC compiler with a CMOS checksum in every file",
            "Cost, latency, thermal and stability simulator",
            "60 FPS instanced 3D motherboard twin",
            "Bell 103 FSK modem with a live oscilloscope",
          ],
        },
        children: [],
      },
      iac: {
        type: "IaCCodeCompilerOutput",
        props: { heading: "IaC COMPILER OUTPUT", projectName: "cmos-cloud" },
        children: [],
      },
      modem: {
        type: "AcousticModemOscilloscope",
        props: { heading: "ACOUSTIC MODEM // 300 BAUD" },
        children: [],
      },
    },
  },
};

type RemixKind = "overclock" | "undervolt" | "corrupted" | null;

function classifyPrompt(prompt: string): RemixKind {
  const lower = prompt.toLowerCase();
  if (lower.includes("corrupt") || lower.includes("negative irq") || lower.includes("inject")) return "corrupted";
  if (lower.includes("overclock") || lower.includes("ai agent") || lower.includes("gpu")) return "overclock";
  if (lower.includes("undervolt") || lower.includes("indie") || lower.includes("zero-cost") || lower.includes("finops")) {
    return "undervolt";
  }
  return null;
}

/** Corrupted register packet: negative Vcore and out-of-range IRQ lines. */
export function buildCorruptedPacketElement(packetId = "chaos-vcore-irq") {
  return {
    type: "CmosRegisterPacket",
    props: {
      packetId,
      coreVoltageMv: -9999,
      multiplier: 99,
      irqSlot1: -1,
      irqSlot2: 99,
    },
    children: [] as string[],
  };
}

export function buildRemixJsonl(prompt: string, currentSpec: Spec | null): string {
  const base = currentSpec ?? initialPageSpecs.home!;
  const shell = base.elements[SHELL_KEY];
  const shellProps = (shell?.props as Record<string, unknown> | undefined) ?? {};
  const kind = classifyPrompt(prompt);
  const elements: Spec["elements"] = { ...base.elements };
  const children = [...(shell?.children ?? [])];

  let bootPreset = (shellProps.bootPreset as string | undefined) ?? "setup";
  let workspaceTitle = (shellProps.workspaceTitle as string | undefined) ?? "BIOS // NECROMANCER  CMOS SETUP UTILITY";
  if (kind === "overclock") {
    bootPreset = "overclock";
    workspaceTitle = "BIOS // NECROMANCER  AI AGENT CLUSTER OVERCLOCK";
  } else if (kind === "undervolt") {
    bootPreset = "undervolt";
    workspaceTitle = "BIOS // NECROMANCER  ZERO-COST INDIE UNDERVOLT";
  } else if (kind === "corrupted") {
    elements["chaos-packet"] = buildCorruptedPacketElement();
    if (!children.includes("chaos-packet")) children.push("chaos-packet");
  }

  elements[SHELL_KEY] = {
    ...(shell ?? { type: "CmosWorkstationShell", children: [] }),
    props: { ...shellProps, bootPreset, workspaceTitle },
    children,
  };
  return specToJsonlStream({ ...base, elements });
}

export function buildChaosPackets(rootKey: string): string[] {
  return [
    JSON.stringify({ op: "add", path: "/elements/chaos-packet", value: buildCorruptedPacketElement() }),
    JSON.stringify({ op: "add", path: `/elements/${rootKey}/children/-`, value: "chaos-packet" }),
  ];
}
