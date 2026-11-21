import { z } from "zod";
import {
  deepCloneAndSanitizeValue,
  isDangerousKey,
  isSafeJsonPointer,
  normalizeSafePointer,
  type DeepSanitizeCounters,
} from "../stream/dag-sanitizer.js";
import type { GraphIssue } from "../types.js";

export const MAX_INTERACTION_RULES = 64;
export const MAX_GUARDS_PER_RULE = 16;
export const MAX_EFFECTS_PER_RULE = 16;
export const MAX_GUARD_DEPTH = 6;
export const DEFAULT_MAX_TRANSITIONS_PER_STEP = 32;

export const OutcomeStatusSchema = z.enum(["playing", "win", "lose", "complete"]);
export type OutcomeStatus = z.infer<typeof OutcomeStatusSchema>;

export const SynthSoundCueSchema = z.enum([
  "click",
  "drop",
  "powerup",
  "unlock",
  "alert",
  "win",
  "lose",
]);
export type SynthSoundCue = z.infer<typeof SynthSoundCueSchema>;

export const InteractionTriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("onClick"),
    elementKey: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("onHover"),
    elementKey: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("onDragStart"),
    elementKey: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("onDrop"),
    sourceElementKey: z.string().min(1).max(80).optional(),
    targetElementKey: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("onKeyPress"),
    key: z.string().min(1).max(32),
  }),
  z.object({
    type: z.literal("onEnterZone"),
    entityKey: z.string().min(1).max(80).optional(),
    zoneKey: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("onTimerTick"),
    timerId: z.string().min(1).max(64).optional(),
    intervalMs: z.number().int().min(50).max(60_000).optional(),
  }),
  z.object({
    type: z.literal("onEvent"),
    eventName: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("onStateMatch"),
  }),
]);
export type InteractionTrigger = z.infer<typeof InteractionTriggerSchema>;

export type InteractionGuard =
  | {
      readonly op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      readonly path: string;
      readonly value: unknown;
    }
  | {
      readonly op: "in";
      readonly path: string;
      readonly values: readonly unknown[];
    }
  | {
      readonly op: "truthy" | "falsy";
      readonly path: string;
    }
  | {
      readonly op: "and" | "or";
      readonly guards: readonly InteractionGuard[];
    }
  | {
      readonly op: "not";
      readonly guard: InteractionGuard;
    };

export const InteractionGuardSchema: z.ZodType<InteractionGuard> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("eq"), path: z.string().min(1), value: z.unknown() }),
    z.object({ op: z.literal("neq"), path: z.string().min(1), value: z.unknown() }),
    z.object({ op: z.literal("gt"), path: z.string().min(1), value: z.unknown() }),
    z.object({ op: z.literal("gte"), path: z.string().min(1), value: z.unknown() }),
    z.object({ op: z.literal("lt"), path: z.string().min(1), value: z.unknown() }),
    z.object({ op: z.literal("lte"), path: z.string().min(1), value: z.unknown() }),
    z.object({
      op: z.literal("in"),
      path: z.string().min(1),
      values: z.array(z.unknown()).max(64),
    }),
    z.object({ op: z.literal("truthy"), path: z.string().min(1) }),
    z.object({ op: z.literal("falsy"), path: z.string().min(1) }),
    z.object({
      op: z.literal("and"),
      guards: z.array(InteractionGuardSchema).max(MAX_GUARDS_PER_RULE),
    }),
    z.object({
      op: z.literal("or"),
      guards: z.array(InteractionGuardSchema).max(MAX_GUARDS_PER_RULE),
    }),
    z.object({
      op: z.literal("not"),
      guard: InteractionGuardSchema,
    }),
  ]),
);

export const InteractionEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set"),
    path: z.string().min(1),
    value: z.unknown(),
  }),
  z.object({
    type: z.literal("inc"),
    path: z.string().min(1),
    by: z.number().finite().optional(),
    max: z.number().finite().optional(),
  }),
  z.object({
    type: z.literal("dec"),
    path: z.string().min(1),
    by: z.number().finite().optional(),
    min: z.number().finite().optional(),
  }),
  z.object({
    type: z.literal("toggle"),
    path: z.string().min(1),
  }),
  z.object({
    type: z.literal("append"),
    path: z.string().min(1),
    value: z.unknown(),
    maxLength: z.number().int().min(1).max(200).optional(),
  }),
  z.object({
    type: z.literal("remove"),
    path: z.string().min(1),
    value: z.unknown(),
  }),
  z.object({
    type: z.literal("navigateScene"),
    sceneId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal("playSynthSound"),
    cue: SynthSoundCueSchema,
  }),
  z.object({
    type: z.literal("setOutcome"),
    outcome: OutcomeStatusSchema,
    reason: z.string().max(180).optional(),
  }),
  z.object({
    type: z.literal("emitEvent"),
    eventName: z.string().min(1).max(80),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("resetExperience"),
  }),
]);
export type InteractionEffect = z.infer<typeof InteractionEffectSchema>;

export const InteractionRuleSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().max(240).optional(),
  /** Optional Markdown heading/section from a Master Prompt (.md) for requirement traceability */
  sourceSection: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  once: z.boolean().optional(),
  trigger: InteractionTriggerSchema,
  guards: z.array(InteractionGuardSchema).max(MAX_GUARDS_PER_RULE).optional(),
  effects: z.array(InteractionEffectSchema).min(1).max(MAX_EFFECTS_PER_RULE),
});
export type InteractionRule = z.infer<typeof InteractionRuleSchema>;

export const PreservedConstraintCategorySchema = z.enum([
  "backend-api",
  "database",
  "auth-security",
  "stack",
  "performance",
  "other",
]);
export type PreservedConstraintCategory = z.infer<
  typeof PreservedConstraintCategorySchema
>;

export const PreservedConstraintSchema = z.object({
  id: z.string().min(1).max(64),
  category: PreservedConstraintCategorySchema,
  sourceSection: z.string().min(1).max(120),
  requirement: z.string().min(1).max(500),
});
export type PreservedConstraint = z.infer<typeof PreservedConstraintSchema>;

export const CreativeBriefSchema = z.object({
  title: z.string().min(1).max(100),
  slug: z.string().min(1).max(64),
  inputMode: z.enum(["vibe", "master-prompt", "starter"]),
  promptSummary: z.string().max(600),
  elevatorPitch: z.string().min(1).max(320),
  aestheticDirection: z.string().min(1).max(240),
  coreLoop: z.string().min(1).max(320),
  winCondition: z.string().max(240).optional(),
  loseCondition: z.string().max(240).optional(),
  targetStack: z.string().min(1).max(120),
  scenes: z.array(z.string().min(1).max(64)).max(24),
  /** Non-UI requirements extracted verbatim in Master Prompt mode so nothing is dropped */
  preservedConstraints: z.array(PreservedConstraintSchema).max(128).optional(),
  /** Optional elementKey -> Markdown section heading traceability map */
  elementSourceSections: z.record(z.string(), z.string()).optional(),
});
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

export type InteractionEvent =
  | { readonly type: "onClick"; readonly elementKey: string }
  | { readonly type: "onHover"; readonly elementKey: string }
  | { readonly type: "onDragStart"; readonly elementKey: string }
  | {
      readonly type: "onDrop";
      readonly sourceElementKey: string;
      readonly targetElementKey: string;
    }
  | { readonly type: "onKeyPress"; readonly key: string }
  | {
      readonly type: "onEnterZone";
      readonly entityKey?: string;
      readonly zoneKey: string;
    }
  | { readonly type: "onTimerTick"; readonly timerId?: string }
  | {
      readonly type: "onEvent";
      readonly eventName: string;
      readonly payload?: Readonly<Record<string, unknown>>;
    };

export interface RuleSanitizationResult {
  readonly rules: readonly InteractionRule[];
  readonly issues: readonly GraphIssue[];
  readonly droppedCount: number;
}

function sanitizeGuardNode(
  guard: InteractionGuard,
  depth: number,
  issues: GraphIssue[],
  ruleId: string,
  counters: DeepSanitizeCounters,
): InteractionGuard | null {
  if (depth > MAX_GUARD_DEPTH) {
    issues.push({
      severity: "warning",
      code: "depth_limit_exceeded",
      elementKey: ruleId,
      message: `Rule "${ruleId}" guard exceeded max depth ${MAX_GUARD_DEPTH} and was pruned.`,
    });
    return null;
  }

  switch (guard.op) {
    case "and":
    case "or": {
      const cleanChildren: InteractionGuard[] = [];
      for (const child of guard.guards.slice(0, MAX_GUARDS_PER_RULE)) {
        const sanitized = sanitizeGuardNode(child, depth + 1, issues, ruleId, counters);
        if (sanitized) cleanChildren.push(sanitized);
      }
      if (cleanChildren.length === 0) return null;
      return { op: guard.op, guards: cleanChildren };
    }
    case "not": {
      const inner = sanitizeGuardNode(guard.guard, depth + 1, issues, ruleId, counters);
      return inner ? { op: "not", guard: inner } : null;
    }
    case "truthy":
    case "falsy": {
      const safePath = normalizeSafePointer(guard.path);
      if (!safePath || safePath === "/" || !isSafeJsonPointer(safePath)) {
        issues.push({
          severity: "warning",
          code: "blocked_unsafe_path",
          elementKey: ruleId,
          path: guard.path,
          message: `Rule "${ruleId}" guard referenced blocked pointer "${guard.path}".`,
        });
        return null;
      }
      return { op: guard.op, path: safePath };
    }
    case "in": {
      const safePath = normalizeSafePointer(guard.path);
      if (!safePath || safePath === "/" || !isSafeJsonPointer(safePath)) {
        issues.push({
          severity: "warning",
          code: "blocked_unsafe_path",
          elementKey: ruleId,
          path: guard.path,
          message: `Rule "${ruleId}" guard referenced blocked pointer "${guard.path}".`,
        });
        return null;
      }
      return {
        op: "in",
        path: safePath,
        values: guard.values.map((v) =>
          deepCloneAndSanitizeValue(v, counters, `${ruleId}:guard`),
        ),
      };
    }
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const safePath = normalizeSafePointer(guard.path);
      if (!safePath || safePath === "/" || !isSafeJsonPointer(safePath)) {
        issues.push({
          severity: "warning",
          code: "blocked_unsafe_path",
          elementKey: ruleId,
          path: guard.path,
          message: `Rule "${ruleId}" guard referenced blocked pointer "${guard.path}".`,
        });
        return null;
      }
      return {
        op: guard.op,
        path: safePath,
        value: deepCloneAndSanitizeValue(guard.value, counters, `${ruleId}:guard`),
      };
    }
  }
}

function sanitizeEffectNode(
  effect: InteractionEffect,
  issues: GraphIssue[],
  ruleId: string,
  counters: DeepSanitizeCounters,
): InteractionEffect | null {
  if (
    effect.type === "set" ||
    effect.type === "inc" ||
    effect.type === "dec" ||
    effect.type === "toggle" ||
    effect.type === "append" ||
    effect.type === "remove"
  ) {
    const safePath = normalizeSafePointer(effect.path);
    if (!safePath || safePath === "/" || !isSafeJsonPointer(safePath)) {
      issues.push({
        severity: "warning",
        code: "blocked_unsafe_path",
        elementKey: ruleId,
        path: effect.path,
        message: `Rule "${ruleId}" effect targeted blocked pointer "${effect.path}".`,
      });
      return null;
    }

    if (effect.type === "set") {
      return {
        type: "set",
        path: safePath,
        value: deepCloneAndSanitizeValue(effect.value, counters, safePath),
      };
    }
    if (effect.type === "append") {
      return {
        type: "append",
        path: safePath,
        value: deepCloneAndSanitizeValue(effect.value, counters, safePath),
        ...(effect.maxLength !== undefined ? { maxLength: effect.maxLength } : {}),
      };
    }
    if (effect.type === "remove") {
      return {
        type: "remove",
        path: safePath,
        value: deepCloneAndSanitizeValue(effect.value, counters, safePath),
      };
    }
    return { ...effect, path: safePath };
  }

  if (effect.type === "emitEvent") {
    if (isDangerousKey(effect.eventName)) return null;
    return {
      type: "emitEvent",
      eventName: effect.eventName,
      ...(effect.payload
        ? {
            payload: deepCloneAndSanitizeValue(
              effect.payload,
              counters,
              `${ruleId}:emitEvent`,
            ) as Record<string, unknown>,
          }
        : {}),
    };
  }

  if (effect.type === "setOutcome") {
    return {
      type: "setOutcome",
      outcome: effect.outcome,
      ...(effect.reason !== undefined
        ? {
            reason: String(
              deepCloneAndSanitizeValue(effect.reason, counters, `${ruleId}:outcome`),
            ),
          }
        : {}),
    };
  }

  return effect;
}

/**
 * Validates and sanitizes an untrusted array of InteractionRules (from AI streams,
 * Master Prompt extraction, user edits, or JSON imports): enforces rule/guard/effect caps,
 * blocks dangerous RFC 6901 prototype-pollution pointers, and neutralizes unsafe URI values.
 */
export function sanitizeInteractionRules(rawRules: unknown): RuleSanitizationResult {
  const issues: GraphIssue[] = [];
  if (!Array.isArray(rawRules)) {
    return { rules: [], issues, droppedCount: 0 };
  }

  const sanitized: InteractionRule[] = [];
  const seenIds = new Set<string>();
  let droppedCount = 0;

  const counters: DeepSanitizeCounters = {
    healedNumbersCount: 0,
    blockedUrisCount: 0,
    blockedPathsCount: 0,
    issues,
  };

  for (let i = 0; i < rawRules.length; i += 1) {
    if (sanitized.length >= MAX_INTERACTION_RULES) {
      droppedCount += rawRules.length - i;
      issues.push({
        severity: "warning",
        code: "element_budget_exceeded",
        message: `Truncated interaction rules to maximum budget of ${MAX_INTERACTION_RULES}.`,
      });
      break;
    }

    const parsed = InteractionRuleSchema.safeParse(rawRules[i]);
    if (!parsed.success) {
      droppedCount += 1;
      issues.push({
        severity: "warning",
        code: "malformed_patch_line",
        message: `Dropped malformed interaction rule at index ${i}: ${parsed.error.issues[0]?.message ?? "schema error"}.`,
      });
      continue;
    }

    const rule = parsed.data;
    if (isDangerousKey(rule.id)) {
      droppedCount += 1;
      issues.push({
        severity: "warning",
        code: "blocked_unsafe_path",
        elementKey: rule.id,
        message: `Dropped rule with dangerous identifier "${rule.id}".`,
      });
      continue;
    }

    let uniqueId = rule.id;
    let suffix = 1;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${rule.id}-${suffix++}`;
    }
    seenIds.add(uniqueId);

    const cleanGuards: InteractionGuard[] = [];
    for (const guard of rule.guards ?? []) {
      const clean = sanitizeGuardNode(guard, 0, issues, uniqueId, counters);
      if (clean) cleanGuards.push(clean);
    }

    const cleanEffects: InteractionEffect[] = [];
    for (const effect of rule.effects) {
      const clean = sanitizeEffectNode(effect, issues, uniqueId, counters);
      if (clean) cleanEffects.push(clean);
    }

    if (cleanEffects.length === 0) {
      droppedCount += 1;
      issues.push({
        severity: "warning",
        code: "blocked_unsafe_path",
        elementKey: uniqueId,
        message: `Dropped rule "${uniqueId}" because no safe effects remained after sanitization.`,
      });
      continue;
    }

    sanitized.push({
      ...rule,
      id: uniqueId,
      enabled: rule.enabled ?? true,
      ...(cleanGuards.length > 0 ? { guards: cleanGuards } : {}),
      effects: cleanEffects,
    });
  }

  return { rules: sanitized, issues, droppedCount };
}
