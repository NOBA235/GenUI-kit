import type {
  InteractionEffect,
  InteractionEvent,
  InteractionGuard,
  InteractionTrigger,
} from "@genui-studio/core";

/** Plain-text descriptions of rule parts for the workbench UI. */

function value(v: unknown): string {
  const text = JSON.stringify(v) ?? "undefined";
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

export function describeTrigger(trigger: InteractionTrigger): string {
  switch (trigger.type) {
    case "onClick":
      return `click ${trigger.elementKey}`;
    case "onHover":
      return `hover ${trigger.elementKey}`;
    case "onDragStart":
      return `pick up ${trigger.elementKey}`;
    case "onDrop":
      return trigger.sourceElementKey
        ? `drop ${trigger.sourceElementKey} on ${trigger.targetElementKey}`
        : `drop on ${trigger.targetElementKey}`;
    case "onKeyPress":
      return `press ${trigger.key}`;
    case "onEnterZone":
      return `${trigger.entityKey ?? "entity"} enters ${trigger.zoneKey}`;
    case "onTimerTick":
      return `${trigger.timerId ? `timer ${trigger.timerId}` : "timer"} ticks${
        trigger.intervalMs ? ` (${trigger.intervalMs} ms)` : ""
      }`;
    case "onEvent":
      return `event ${trigger.eventName}`;
    case "onStateMatch":
      return "state matches";
  }
}

export function describeGuard(guard: InteractionGuard): string {
  switch (guard.op) {
    case "eq":
      return `${guard.path} = ${value(guard.value)}`;
    case "neq":
      return `${guard.path} ≠ ${value(guard.value)}`;
    case "gt":
      return `${guard.path} > ${value(guard.value)}`;
    case "gte":
      return `${guard.path} ≥ ${value(guard.value)}`;
    case "lt":
      return `${guard.path} < ${value(guard.value)}`;
    case "lte":
      return `${guard.path} ≤ ${value(guard.value)}`;
    case "in":
      return `${guard.path} in ${value(guard.values)}`;
    case "truthy":
      return `${guard.path} is set`;
    case "falsy":
      return `${guard.path} is not set`;
    case "and":
      return `(${guard.guards.map(describeGuard).join(" and ")})`;
    case "or":
      return `(${guard.guards.map(describeGuard).join(" or ")})`;
    case "not":
      return `not ${describeGuard(guard.guard)}`;
  }
}

export function describeEffect(effect: InteractionEffect): string {
  switch (effect.type) {
    case "set":
      return `set ${effect.path} = ${value(effect.value)}`;
    case "inc":
      return `${effect.path} + ${effect.by ?? 1}${effect.max !== undefined ? ` (max ${effect.max})` : ""}`;
    case "dec":
      return `${effect.path} − ${effect.by ?? 1}${effect.min !== undefined ? ` (min ${effect.min})` : ""}`;
    case "toggle":
      return `toggle ${effect.path}`;
    case "append":
      return `append ${value(effect.value)} to ${effect.path}`;
    case "remove":
      return `remove ${value(effect.value)} from ${effect.path}`;
    case "navigateScene":
      return `go to scene ${effect.sceneId}`;
    case "playSynthSound":
      return `play ${effect.cue} sound`;
    case "setOutcome":
      return `outcome → ${effect.outcome}`;
    case "emitEvent":
      return `emit ${effect.eventName}`;
    case "resetExperience":
      return "reset the experience";
  }
}

export function describeEvent(event: InteractionEvent): string {
  switch (event.type) {
    case "onClick":
      return `click ${event.elementKey}`;
    case "onHover":
      return `hover ${event.elementKey}`;
    case "onDragStart":
      return `pick up ${event.elementKey}`;
    case "onDrop":
      return `drop ${event.sourceElementKey} on ${event.targetElementKey}`;
    case "onKeyPress":
      return `press ${event.key}`;
    case "onEnterZone":
      return `${event.entityKey ?? "entity"} enters ${event.zoneKey}`;
    case "onTimerTick":
      return event.timerId ? `tick ${event.timerId}` : "tick";
    case "onEvent":
      return `emit ${event.eventName}`;
  }
}
