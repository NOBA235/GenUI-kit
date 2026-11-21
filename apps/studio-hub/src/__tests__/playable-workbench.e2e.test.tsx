// @vitest-environment jsdom
/**
 * Phase 4 gate: mounts the playable workbench in jsdom and plays the flagship starter with
 * real DOM click / drag / drop events until it is won, then exercises time travel,
 * Verify Winnability, auto-replay, the live flow map, Edit mode, the zero-key LLM guard,
 * a pivot macro, and both exports (Skill Pack and Next.js starter).
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "../App.js";
import { PlayableWorkbenchPage } from "../pages/PlayableWorkbenchPage.js";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const capturedBlobs: Blob[] = [];
let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      capturedBlobs.push(blob);
      return `blob:genui-test/${capturedBlobs.length}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  // jsdom cannot navigate to blob: URLs; the download itself is not under test.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  vi.restoreAllMocks();
});

function q<T extends Element = HTMLElement>(selector: string): T {
  const found = container!.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element: ${selector}`);
  return found;
}

const byTestId = <T extends Element = HTMLElement>(id: string) => q<T>(`[data-testid="${id}"]`);
const element = (key: string) => q(`[data-genui-key="${key}"] > :not([data-genui-diagnostic-badge])`);

function fire(target: Element, type: string): void {
  act(() => {
    const event =
      type === "click" ? new MouseEvent("click", { bubbles: true, cancelable: true }) : new Event(type, { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
  });
}

function dragAndDrop(source: Element, target: Element): void {
  fire(source, "dragstart");
  fire(target, "dragover");
  fire(target, "drop");
  fire(source, "dragend");
}

function setFieldValue(field: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const stageState = () => byTestId("playable-stage-state");
const outcome = () => stageState().getAttribute("data-outcome");
const historyLength = () => Number(byTestId("timeline-scrubber").getAttribute("data-history-length"));
const historyIndex = () => Number(byTestId("timeline-scrubber").getAttribute("data-history-index"));
const charge = () => Number(element("charge-meter").getAttribute("aria-valuenow"));

async function waitFor(check: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function readZip(blob: Blob): Promise<JSZip> {
  const buffer =
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blob);
        });
  return JSZip.loadAsync(buffer);
}

describe("Playable workbench entry points", () => {
  it("the marketplace links to /play and /play server-renders the flagship starter", () => {
    const market = renderToStaticMarkup(<App initialPath="/" />);
    expect(market).toContain('data-testid="hero-open-playable-starter"');
    expect(market).toContain('data-testid="hero-open-sample-wireframe"');

    const play = renderToStaticMarkup(<App initialPath="/play" />);
    expect(play).toContain('data-testid="playable-workbench"');
    expect(play).toContain("Signal Relay Vault");
    expect(play).toContain('data-genui-key="charge-relay"');
    expect(play).toContain('data-testid="playtest-timeline-bar"');
    expect(play).toContain('data-testid="vibe-reframe-bar"');
    expect(play).not.toContain('data-genui-fault-card="true"');
  });
});

describe("Playable workbench in a real DOM (Phase 4 gate)", () => {
  it("plays to a win, time-travels, verifies, replays, maps, edits and exports", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<PlayableWorkbenchPage onNavigateHome={() => {}} replayStepMs={0} initialMuted />);
    });

    // Initial state comes from the rule engine's store.
    expect(outcome()).toBe("playing");
    expect(stageState().getAttribute("data-scene")).toBe("main");
    expect(element("signal-timer").textContent).toContain("15s");
    expect(container.querySelector('[data-genui-fault-card="true"]')).toBeNull();
    const startLength = historyLength();

    // 1. Real clicks charge the relay; each click commits a snapshot.
    const chargeButton = element("charge-relay");
    fire(chargeButton, "click");
    expect(charge()).toBe(1);
    expect(historyLength()).toBeGreaterThan(startLength);
    fire(chargeButton, "click");
    fire(chargeButton, "click");
    expect(charge()).toBe(3);
    fire(chargeButton, "click");
    expect(charge()).toBe(3); // inc is capped at max 3

    // 2. The signal timer ticks through the interval driver (fake setInterval).
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(element("signal-timer").textContent).toContain("14s");
    expect(byTestId("fired-rule-strip").textContent).toContain("Signal drains");

    // 3. HTML drag-and-drop seats the amber cell.
    dragAndDrop(element("cell-amber"), element("socket-amber"));
    expect(element("socket-amber").getAttribute("data-filled")).toBe("true");
    expect(element("cell-amber").getAttribute("data-placed")).toBe("true");

    // 4. Click-to-pick-up, click-to-drop (keyboard / touch path) seats the cyan cell.
    fire(element("cell-cyan"), "click");
    expect(container.querySelector('[data-genui-held-hint="true"]')?.textContent).toContain("Cyan cell");
    fire(element("socket-cyan"), "click");
    expect(container.querySelector('[data-genui-held-hint="true"]')).toBeNull();
    expect(element("socket-cyan").getAttribute("data-filled")).toBe("true");
    expect(element("open-vault").getAttribute("data-highlight")).toBe("true");

    // 5. Opening the vault wins.
    fire(element("open-vault"), "click");
    expect(outcome()).toBe("win");
    expect(stageState().getAttribute("data-scene")).toBe("vault");
    expect(element("vault-status").getAttribute("data-status")).toBe("win");
    expect(byTestId("playable-outcome-pill").getAttribute("data-outcome")).toBe("win");
    const wonLength = historyLength();
    expect(wonLength).toBeGreaterThanOrEqual(startLength + 8);
    expect(historyIndex()).toBe(wonLength - 1);

    // 6. Scrub back one snapshot (before the win), then replay the winning move live.
    fire(byTestId("timeline-undo-btn"), "click");
    expect(outcome()).toBe("playing");
    expect(stageState().getAttribute("data-scene")).toBe("main");
    fire(element("open-vault"), "click");
    expect(outcome()).toBe("win");

    // 7. Scrub the range input to the first snapshot: everything is back to the start.
    setFieldValue(byTestId<HTMLInputElement>("timeline-scrubber"), "0");
    expect(historyIndex()).toBe(0);
    expect(outcome()).toBe("playing");
    expect(charge()).toBe(0);
    expect(element("socket-amber").getAttribute("data-filled")).toBe("false");
    expect(element("signal-timer").textContent).toContain("15s");

    // 8. Verify Winnability fuzzes the rules and finds a winning trace.
    fire(byTestId("verify-winnability-btn"), "click");
    const report = byTestId("fuzz-report");
    expect(report.getAttribute("data-win-reachable")).toBe("true");
    expect(report.getAttribute("data-passed")).toBe("true");
    expect(byTestId("shortest-trace-win").textContent).toContain("click open-vault");
    expect(byTestId("shortest-trace-lose").textContent).toContain("Shortest lose");

    // 9. Auto-replay the winning trace through the same engine.
    fire(byTestId("replay-winning-trace-btn"), "click");
    expect(outcome()).toBe("win");

    // 10. The live flow map pulses the rules that fired on the last event.
    fire(byTestId("stage-tab-flow"), "click");
    const flowMap = byTestId("flow-map-view");
    expect(flowMap.getAttribute("data-active-rules")).toContain("open-vault");
    expect(q('[data-node-kind="rule"][data-node-ref="open-vault"]').getAttribute("data-active")).toBe("true");
    expect(container.querySelectorAll('.flow-edge[data-active="true"]').length).toBeGreaterThan(0);
    expect(q('[data-node-kind="outcome"][data-node-ref="win"]').getAttribute("data-active")).toBe("true");
    expect(q('[data-node-kind="element"][data-node-ref="charge-relay"]').getAttribute("data-interactive")).toBe("true");
    fire(byTestId("stage-tab-preview"), "click");

    // 11. Edit mode selects elements instead of dispatching, and rules can be toggled.
    fire(byTestId("timeline-reset-btn"), "click");
    expect(outcome()).toBe("playing");
    fire(byTestId("playtest-mode-edit"), "click");
    fire(element("charge-relay"), "click");
    expect(charge()).toBe(0);
    const inspector = byTestId("rule-inspector-drawer");
    expect(inspector.textContent).toContain("Rules for charge-relay: 1");
    fire(byTestId<HTMLInputElement>("rule-toggle-charge-relay"), "click");
    expect(byTestId("rule-card-charge-relay").getAttribute("data-enabled")).toBe("false");
    fire(byTestId("playtest-mode-play"), "click");
    fire(element("charge-relay"), "click");
    expect(charge()).toBe(0); // disabled rule does not fire
    fire(byTestId("open-rule-inspector-btn"), "click");
    fire(byTestId("open-rule-inspector-btn"), "click");
    fire(byTestId<HTMLInputElement>("rule-toggle-charge-relay"), "click");
    fire(byTestId("close-rule-inspector-btn"), "click");
    fire(element("charge-relay"), "click");
    expect(charge()).toBe(1);

    // 12. Freeform text without an LLM endpoint is refused honestly (no fake NLP).
    setFieldValue(byTestId<HTMLTextAreaElement>("vibe-prompt-input"), "make it a submarine airlock");
    fire(byTestId("vibe-submit-btn"), "click");
    expect(byTestId("llm-config-required").textContent).toContain("need an LLM");
    expect(byTestId("model-drawer")).toBeTruthy();
    expect(element("charge-relay").textContent).toContain("Charge relay");

    // 13. Mode A export: Universal Agent Skill & Contract Pack.
    fire(byTestId("open-playable-export-btn"), "click");
    capturedBlobs.length = 0;
    await act(async () => {
      byTestId("export-skill-pack-btn").click();
    });
    await waitFor(
      () => container!.querySelector('[data-testid="playable-export-status"][data-export-mode="skill-pack"]') !== null,
      "skill pack export",
    );
    expect(byTestId("playable-export-status").getAttribute("data-ok")).toBe("true");
    const skillZip = await readZip(capturedBlobs.at(-1)!);
    const contract = await skillZip.file("contracts/invariants.pbt.test.ts")!.async("string");
    expect(contract).toContain('"outcome": "win"');
    expect(contract).toContain('"outcome": "lose"');
    const behavioral = JSON.parse(await skillZip.file("contracts/wireframe.spec.json")!.async("string")) as {
      rules: Array<{ id: string; enabled?: boolean }>;
    };
    expect(behavioral.rules.find((r) => r.id === "charge-relay")?.enabled).toBe(true);
    expect(skillZip.file("contracts/production-driver.ts")).not.toBeNull();
    expect(skillZip.file("wireframe/signal-relay-vault.excalidraw.json")).not.toBeNull();
    expect(skillZip.file(".kiro/specs/signal-relay-vault/tasks.md")).not.toBeNull();

    // 14. Mode B export: runnable Next.js 15 starter running the same rules.
    await act(async () => {
      byTestId("export-nextjs-starter-btn").click();
    });
    await waitFor(
      () => container!.querySelector('[data-testid="playable-export-status"][data-export-mode="nextjs"]') !== null,
      "next.js export",
    );
    const nextZip = await readZip(capturedBlobs.at(-1)!);
    const page = await nextZip.file("app/page.tsx")!.async("string");
    expect(page).toContain("createInteractionRuleEngine");
    expect(page).toContain("<InteractionSurface");
    const components = await nextZip.file("src/template/components.tsx")!.async("string");
    expect(components).toContain("export const templateComponents = playableRegistry");
    const catalogFile = await nextZip.file("src/template/catalog.ts")!.async("string");
    expect(catalogFile).toContain("export const verifiedCatalog = playableCatalog");
    const exportedSpec = JSON.parse(await nextZip.file("src/template/wireframe.spec.json")!.async("string")) as {
      root: string;
      rules: unknown[];
      initialScene: string;
    };
    expect(exportedSpec.root).toBe("vault-shell");
    expect(exportedSpec.rules.length).toBe(14);
    expect(exportedSpec.initialScene).toBe("main");
    fire(byTestId("close-playable-export-btn"), "click");

    // 15. An offline pivot macro reshapes the spec with renderable playable components.
    fire(byTestId("pivot-macro-add-win-goal"), "click");
    expect(byTestId("open-rule-inspector-btn").textContent).toContain("Rules (16)");
    expect(element("macro-win-goal-panel").textContent).toContain("Advance objective");
    expect(container.querySelector('[data-genui-fault-card="true"]')).toBeNull();
    fire(element("macro-win-goal-panel"), "click");
    expect(byTestId("fired-rule-strip").textContent).toContain("Advance Win Goal");
  }, 60_000);
});
