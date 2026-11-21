import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ComponentRegistry, ComponentRenderProps } from "@json-render/react";
import { GENUI_ELEMENT_KEY_FIELD } from "../boundary/safe-renderer.js";
import type { InteractionEvent, InteractionRule } from "./rule-types.js";

/**
 * DOM bridge between rendered catalog components and the interaction rule engine.
 *
 * Catalog components stay free of event handlers. `withInteractionKeys` tags each rendered
 * element with its spec key, `InteractionSurface` turns delegated clicks, drags, drops and
 * hovers into `InteractionEvent`s, and `useInteractionDrivers` adds key presses and timer
 * ticks. Which elements react is derived from the rule triggers, so this works for any catalog.
 */

/** Attribute carrying the spec element key on the wrapper around each rendered component. */
export const INTERACTION_KEY_ATTRIBUTE = "data-genui-key";

const MAX_KEY_LENGTH = 80;

export interface InteractionTimer {
  readonly timerId?: string;
  readonly intervalMs: number;
}

export interface InteractionTargets {
  readonly click: ReadonlySet<string>;
  readonly hover: ReadonlySet<string>;
  readonly dragSources: ReadonlySet<string>;
  readonly dropTargets: ReadonlySet<string>;
  /** Lowercased `onKeyPress` keys */
  readonly keys: ReadonlySet<string>;
  /** One entry per distinct `onTimerTick` timer that declares `intervalMs` */
  readonly timers: readonly InteractionTimer[];
}

/** Collects which element keys, keys and timers the enabled rules react to. */
export function collectInteractionTargets(
  rules: readonly InteractionRule[],
): InteractionTargets {
  const click = new Set<string>();
  const hover = new Set<string>();
  const dragSources = new Set<string>();
  const dropTargets = new Set<string>();
  const keys = new Set<string>();
  const timers = new Map<string, InteractionTimer>();

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const t = rule.trigger;
    switch (t.type) {
      case "onClick":
        click.add(t.elementKey);
        break;
      case "onHover":
        hover.add(t.elementKey);
        break;
      case "onDragStart":
        dragSources.add(t.elementKey);
        break;
      case "onDrop":
        dropTargets.add(t.targetElementKey);
        if (t.sourceElementKey) dragSources.add(t.sourceElementKey);
        break;
      case "onKeyPress":
        keys.add(t.key.toLowerCase());
        break;
      case "onTimerTick":
        if (t.intervalMs) {
          const id = `${t.timerId ?? ""}|${t.intervalMs}`;
          timers.set(id, {
            ...(t.timerId ? { timerId: t.timerId } : {}),
            intervalMs: t.intervalMs,
          });
        }
        break;
      default:
        break;
    }
  }

  return { click, hover, dragSources, dropTargets, keys, timers: [...timers.values()] };
}

const SelectedElementContext = createContext<string | null>(null);

/**
 * Wraps every component of a registry in a `display: contents` element carrying its spec
 * key (`data-genui-key`), so `InteractionSurface` can map DOM events back to spec elements
 * without changing layout. Use the result as the registry passed to
 * `wrapRegistryWithTelemetry`, which supplies the key.
 */
export function withInteractionKeys(registry: ComponentRegistry): ComponentRegistry {
  const keyed: ComponentRegistry = {};
  for (const [name, Component] of Object.entries(registry)) {
    const KeyedComponent = (props: ComponentRenderProps<any>) => {
      const selectedKey = useContext(SelectedElementContext);
      const rawKey = (props.element as unknown as Record<string, unknown> | undefined)?.[
        GENUI_ELEMENT_KEY_FIELD
      ];
      const key = typeof rawKey === "string" ? rawKey : undefined;
      return (
        <div
          data-genui-key={key}
          data-genui-selected={key !== undefined && key === selectedKey ? "true" : undefined}
          style={{ display: "contents" }}
        >
          <Component {...props} />
        </div>
      );
    };
    KeyedComponent.displayName = `GenUIInteractionKey(${name})`;
    keyed[name] = KeyedComponent;
  }
  return keyed;
}

interface KeyedNode {
  readonly key: string;
  readonly node: Element;
}

/** Spec keys from the event target outwards, innermost first, staying inside `boundary`. */
function keyChain(target: EventTarget | null, boundary: Element): KeyedNode[] {
  const chain: KeyedNode[] = [];
  const selector = `[${INTERACTION_KEY_ATTRIBUTE}]`;
  let node =
    target && typeof (target as Element).closest === "function"
      ? (target as Element).closest(selector)
      : null;
  while (node && boundary.contains(node)) {
    const key = node.getAttribute(INTERACTION_KEY_ATTRIBUTE);
    if (key && key.length <= MAX_KEY_LENGTH) chain.push({ key, node });
    node = node.parentElement ? node.parentElement.closest(selector) : null;
  }
  return chain;
}

function labelOf(node: Element, fallback: string): string {
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

export interface InteractionSurfaceProps {
  readonly rules: readonly InteractionRule[];
  readonly dispatch: (event: InteractionEvent) => void;
  /** When false, clicks select elements via `onSelectElement` and nothing is dispatched. */
  readonly interactive?: boolean;
  readonly onSelectElement?: (elementKey: string | null) => void;
  /** Element marked with `data-genui-selected="true"` (style it with CSS). */
  readonly selectedElementKey?: string | null;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly children: ReactNode;
  readonly "data-testid"?: string;
}

/**
 * Container that dispatches interaction events for the elements inside it:
 * - click on an `onClick` target -> `onClick`
 * - HTML drag-and-drop from a drag source onto an `onDrop` target -> `onDragStart`, `onDrop`
 * - click a drag source, then click a drop target -> the same events, so drag-and-drop
 *   also works from the keyboard and on touch screens (Escape puts the item down)
 * - pointer entering an `onHover` target -> `onHover`
 */
export function InteractionSurface({
  rules,
  dispatch,
  interactive = true,
  onSelectElement,
  selectedElementKey = null,
  className,
  style,
  children,
  "data-testid": testId,
}: InteractionSurfaceProps): React.JSX.Element {
  const targets = useMemo(() => collectInteractionTargets(rules), [rules]);
  const heldRef = useRef<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [held, setHeld] = useState<{ key: string; label: string } | null>(null);

  const hold = (entry: KeyedNode) => {
    heldRef.current = entry.key;
    setHeld({ key: entry.key, label: labelOf(entry.node, entry.key) });
  };
  const release = () => {
    heldRef.current = null;
    setHeld(null);
  };

  // Drop a held item when the rules change or the surface becomes read-only.
  useEffect(() => {
    heldRef.current = null;
    setHeld(null);
  }, [targets, interactive]);

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const chain = keyChain(e.target, e.currentTarget);
    if (!interactive) {
      if (onSelectElement) {
        e.preventDefault();
        e.stopPropagation();
        onSelectElement(chain[0]?.key ?? null);
      }
      return;
    }

    const holding = heldRef.current;
    if (holding) {
      const drop = chain.find((entry) => targets.dropTargets.has(entry.key));
      if (drop && drop.key !== holding) {
        release();
        dispatch({ type: "onDrop", sourceElementKey: holding, targetElementKey: drop.key });
        return;
      }
      if (chain.some((entry) => entry.key === holding)) {
        release();
        return;
      }
    }

    const clickTarget = chain.find((entry) => targets.click.has(entry.key));
    if (clickTarget) {
      dispatch({ type: "onClick", elementKey: clickTarget.key });
      return;
    }

    const source = chain.find((entry) => targets.dragSources.has(entry.key));
    if (source) {
      hold(source);
      dispatch({ type: "onDragStart", elementKey: source.key });
    }
  };

  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const source = keyChain(e.target, e.currentTarget).find((entry) =>
      targets.dragSources.has(entry.key),
    );
    if (!source) return;
    hold(source);
    try {
      e.dataTransfer?.setData("text/plain", source.key);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    } catch {
      // Some runtimes expose a read-only or missing dataTransfer.
    }
    dispatch({ type: "onDragStart", elementKey: source.key });
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const isTarget = keyChain(e.target, e.currentTarget).some((entry) =>
      targets.dropTargets.has(entry.key),
    );
    if (!isTarget) return;
    e.preventDefault();
    try {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    } catch {
      // Ignore read-only dataTransfer.
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const target = keyChain(e.target, e.currentTarget).find((entry) =>
      targets.dropTargets.has(entry.key),
    );
    if (!target) return;
    e.preventDefault();
    let source = heldRef.current;
    if (!source) {
      try {
        source = e.dataTransfer?.getData("text/plain") || null;
      } catch {
        source = null;
      }
    }
    release();
    if (source && source !== target.key && targets.dragSources.has(source)) {
      dispatch({ type: "onDrop", sourceElementKey: source, targetElementKey: target.key });
    }
  };

  const onDragEnd = () => {
    // Fires after a drop as well; only clears a cancelled drag.
    if (heldRef.current) release();
  };

  const onMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || targets.hover.size === 0) return;
    const hoverTarget = keyChain(e.target, e.currentTarget).find((entry) =>
      targets.hover.has(entry.key),
    );
    if (!hoverTarget) {
      hoverRef.current = null;
      return;
    }
    if (hoverTarget.key === hoverRef.current) return;
    hoverRef.current = hoverTarget.key;
    dispatch({ type: "onHover", elementKey: hoverTarget.key });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && heldRef.current) {
      e.stopPropagation();
      release();
    }
  };

  return (
    <SelectedElementContext.Provider value={selectedElementKey}>
      <div
        className={className}
        style={style}
        data-testid={testId}
        data-genui-interactive={interactive ? "true" : "false"}
        data-genui-holding={held?.key}
        onClickCapture={onClickCapture}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onMouseOver={onMouseOver}
        onKeyDown={onKeyDown}
      >
        {held ? (
          <div
            role="status"
            data-genui-held-hint="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              margin: "0 0 8px",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #F59E0B",
              background: "#FFFBEB",
              color: "#78350F",
              font: "500 12px/1.4 ui-sans-serif, system-ui, sans-serif",
            }}
          >
            <span>
              Holding {held.label}. Click a drop target to place it, or press Escape.
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                release();
              }}
              style={{
                border: "1px solid #F59E0B",
                borderRadius: 6,
                background: "#FFFFFF",
                color: "#78350F",
                padding: "2px 8px",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              Put down
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </SelectedElementContext.Provider>
  );
}

const EVENT_FIELDS: Readonly<Record<InteractionEvent["type"], readonly string[]>> = {
  onClick: ["elementKey"],
  onHover: ["elementKey"],
  onDragStart: ["elementKey"],
  onDrop: ["sourceElementKey", "targetElementKey"],
  onKeyPress: ["key"],
  onEnterZone: ["zoneKey", "entityKey"],
  onTimerTick: ["timerId"],
  onEvent: ["eventName"],
};

const REQUIRED_FIELDS: Readonly<Record<InteractionEvent["type"], readonly string[]>> = {
  onClick: ["elementKey"],
  onHover: ["elementKey"],
  onDragStart: ["elementKey"],
  onDrop: ["sourceElementKey", "targetElementKey"],
  onKeyPress: ["key"],
  onEnterZone: ["zoneKey"],
  onTimerTick: [],
  onEvent: ["eventName"],
};

/**
 * Turns untrusted action params (e.g. a spec binding
 * `on: { drop: { action: "dispatchInteraction", params: { type: "onDrop", ... } } }`)
 * into an `InteractionEvent`. Only the known string fields of the event type are kept, so
 * params cannot smuggle objects or extra keys into the engine. Returns null when invalid.
 */
export function parseInteractionEventParams(
  params: Readonly<Record<string, unknown>> | null | undefined,
): InteractionEvent | null {
  if (!params || typeof params !== "object") return null;
  const type = params.type;
  if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(EVENT_FIELDS, type)) {
    return null;
  }
  const eventType = type as InteractionEvent["type"];
  const event: Record<string, string> = { type: eventType };
  for (const field of EVENT_FIELDS[eventType]) {
    const value = params[field];
    if (typeof value === "string" && value.length > 0 && value.length <= MAX_KEY_LENGTH) {
      event[field] = value;
    }
  }
  for (const field of REQUIRED_FIELDS[eventType]) {
    if (event[field] === undefined) return null;
  }
  return event as unknown as InteractionEvent;
}

export interface InteractionDriverOptions {
  readonly rules: readonly InteractionRule[];
  readonly dispatch: (event: InteractionEvent) => void;
  /** Attach the keyboard listener and timers (default: true). */
  readonly enabled?: boolean;
  /** Checked before every timer tick; return false to skip it (e.g. game over). */
  readonly shouldTick?: () => boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
}

function isActivationKey(e: KeyboardEvent): boolean {
  if (e.key !== "Enter" && e.key !== " ") return false;
  const el = e.target as Element | null;
  return Boolean(el && typeof el.closest === "function" && el.closest("button, a[href], [role='button']"));
}

/**
 * Dispatches `onKeyPress` for keys the rules react to (ignoring typing in form fields and
 * Enter/Space on buttons) and one `onTimerTick` interval per timer declaring `intervalMs`.
 * Ticks pause while the document is hidden. Everything is removed on unmount or disable.
 */
export function useInteractionDrivers(options: InteractionDriverOptions): void {
  const { rules, enabled = true } = options;
  const targets = useMemo(() => collectInteractionTargets(rules), [rules]);
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target) || isActivationKey(e)) return;
      if (!targets.keys.has(e.key.toLowerCase())) return;
      latest.current.dispatch({ type: "onKeyPress", key: e.key });
    };
    if (targets.keys.size > 0) window.addEventListener("keydown", onKeyDown);

    const intervalIds = targets.timers.map((timer) =>
      setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        const shouldTick = latest.current.shouldTick;
        if (shouldTick && !shouldTick()) return;
        latest.current.dispatch(
          timer.timerId ? { type: "onTimerTick", timerId: timer.timerId } : { type: "onTimerTick" },
        );
      }, timer.intervalMs),
    );

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      for (const id of intervalIds) clearInterval(id);
    };
  }, [enabled, targets]);
}
