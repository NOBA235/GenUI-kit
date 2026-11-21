import { z } from "zod";
import { schema } from "@json-render/react/schema";
import { createVerifiedCatalog } from "@genui-studio/core";

/**
 * Catalog for playable experiences in the Studio Hub workbench.
 *
 * This file is also copied verbatim into exported Next.js starters as
 * `src/template/catalog.ts`, so it may only import packages the starter depends on.
 * Every prop has a default so LLM output and pivot macros heal into a renderable element.
 */
export const playableCatalog = createVerifiedCatalog(schema, {
  components: {
    PlayShell: {
      description:
        "Root container for a playable experience: a title, a subtitle and the panels below it.",
      props: z.object({
        title: z.string().min(1).max(80).default("Playable experience"),
        subtitle: z.string().max(240).default(""),
      }),
      slots: ["default"],
    },
    Panel: {
      description: "Labelled group that lays its children out in 1 to 3 columns.",
      props: z.object({
        heading: z.string().min(1).max(60).default("Panel"),
        columns: z.number().int().min(1).max(3).default(2),
      }),
      slots: ["default"],
    },
    ControlButton: {
      description:
        "Clickable control. Target it with onClick rules; bind highlight to a boolean $state path to mark it as ready.",
      props: z.object({
        label: z.string().min(1).max(48).default("Action"),
        hint: z.string().max(120).default(""),
        tone: z.enum(["primary", "neutral", "danger"]).default("neutral"),
        highlight: z.boolean().default(false),
      }),
      slots: [],
    },
    SignalMeter: {
      description:
        "Horizontal meter showing value out of max; bind value to a numeric $state path.",
      props: z.object({
        label: z.string().min(1).max(48).default("Progress"),
        value: z.number().min(0).max(1_000_000).default(0),
        max: z.number().min(1).max(1_000_000).default(10),
        unit: z.string().max(16).default(""),
      }),
      slots: [],
    },
    CountdownDisplay: {
      description:
        "Large seconds readout that turns red at or below warnAt; bind seconds to a $state timer.",
      props: z.object({
        label: z.string().min(1).max(48).default("Time left"),
        seconds: z.number().min(0).max(86_400).default(30),
        warnAt: z.number().min(0).max(3_600).default(5),
      }),
      slots: [],
    },
    DragToken: {
      description:
        "Draggable item (HTML drag-and-drop or click to pick up). Use it as the source of onDragStart / onDrop rules; bind placed to hide it once used.",
      props: z.object({
        label: z.string().min(1).max(48).default("Item"),
        glyph: z.string().min(1).max(4).default("◆"),
        placed: z.boolean().default(false),
      }),
      slots: [],
    },
    DropSlot: {
      description:
        "Drop target for DragToken items. Use it as the target of onDrop rules; bind filled to show it as occupied.",
      props: z.object({
        label: z.string().min(1).max(48).default("Drop zone"),
        hint: z.string().max(120).default(""),
        filled: z.boolean().default(false),
      }),
      slots: [],
    },
    OutcomeBanner: {
      description:
        "Live outcome banner; bind status to /experience/outcome and message to /experience/outcomeReason.",
      props: z.object({
        status: z.enum(["playing", "win", "lose", "complete"]).default("playing"),
        message: z.string().max(180).default(""),
        playingText: z.string().max(80).default("In progress"),
      }),
      slots: [],
    },
  },
  actions: {},
});

/** Name the exported Next.js starter imports from `src/template/catalog`. */
export const verifiedCatalog = playableCatalog;
