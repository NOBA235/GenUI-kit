import { describe, expect, it } from "vitest";
import { sanitizeInteractionRules } from "@genui-studio/core";
import { runCatalogInvariantSuite } from "@genui-studio/core/testing";
import { buildSkillPack } from "@genui-studio/templates";
import { buildFlowGraph } from "../lib/flow-graph.js";
import { applyPivotMacro, PIVOT_MACROS } from "../lib/pivot-macros.js";
import { createPlayableSession, verifyWinnability } from "../lib/playable-session.js";
import { createPlayableStarter, PLAYABLE_FUZZ_SETTINGS } from "../lib/playable-starter.js";
import { playableCatalog } from "../playable/catalog.js";
import { playableRegistry } from "../playable/components.js";

describe("Signal Relay Vault playable starter", () => {
  const starter = createPlayableStarter();

  it("passes the catalog, rule sanitizer and spec validation without changes", () => {
    expect(Object.keys(playableRegistry).sort()).toEqual([...playableCatalog.metadata.componentNames].sort());
    const rules = sanitizeInteractionRules(starter.rules);
    expect(rules.droppedCount).toBe(0);
    expect(rules.issues).toEqual([]);
    const validated = playableCatalog.validateFull(starter.spec);
    expect(validated.valid).toBe(true);
    expect(validated.propDiagnostics.filter((d) => d.status === "rejected")).toEqual([]);
  });

  it("is winnable and losable, with no dead rules", () => {
    const report = verifyWinnability(starter);
    expect(report.passed).toBe(true);
    expect(report.unhandledExceptions).toBe(0);
    expect(report.shortestTraces.win?.at(-1)).toEqual({ type: "onClick", elementKey: "open-vault" });
    expect(report.shortestTraces.lose).not.toBeNull();
    expect(report.deadRules).toEqual([]);
  });

  it("bakes verified win and lose traces into its Skill Pack", () => {
    const pack = buildSkillPack({
      brief: starter.brief,
      spec: starter.spec,
      rules: starter.rules,
      catalog: playableCatalog,
      initialScene: starter.initialScene,
      fuzz: PLAYABLE_FUZZ_SETTINGS,
    });
    expect(pack.verifiedTraces.map((t) => t.outcome).sort()).toEqual(["lose", "win"]);
    expect(pack.verifiedTraces.find((t) => t.outcome === "win")?.expectedScene).toBe("vault");
    expect(pack.unknownComponentTypes).toEqual([]);
  });

  it("keeps the playable catalog valid for the exported starter's invariant suite", () => {
    const suite = runCatalogInvariantSuite(playableCatalog, { numRuns: 15 });
    expect(suite.allPassed).toBe(true);
  });

  it("session: scrubbing back from a loss and replaying reaches the win", () => {
    const session = createPlayableSession(starter, { muted: true });
    const win = verifyWinnability(starter).shortestTraces.win!;
    session.dispatch({ type: "onClick", elementKey: "charge-relay" });
    for (let i = 0; i < 4; i += 1) {
      session.dispatch({ type: "onDrop", sourceElementKey: "cell-amber", targetElementKey: "socket-cyan" });
    }
    expect(session.getView().outcome).toBe("lose");
    expect(session.scrubTo(0)).toBe(true);
    expect(session.getView().outcome).toBe("playing");
    for (const event of win) session.dispatch(event);
    expect(session.getView().outcome).toBe("win");
    expect(session.getView().lastFired.map((t) => t.ruleId)).toContain("open-vault");
  });

  it("every pivot macro produces renderable playable components", () => {
    for (const macro of PIVOT_MACROS) {
      const result = applyPivotMacro(macro.id, {
        spec: starter.spec,
        rules: starter.rules,
        catalog: playableCatalog,
      });
      const validated = playableCatalog.validateFull(result.spec);
      expect(validated.issues.filter((i) => i.code === "unknown_component"), macro.id).toEqual([]);
      expect(validated.propDiagnostics.filter((d) => d.status === "rejected"), macro.id).toEqual([]);
    }
    const timer = applyPivotMacro("add-countdown-timer", { spec: starter.spec, rules: starter.rules, catalog: playableCatalog });
    expect(timer.spec.elements["macro-countdown-hud"]?.type).toBe("CountdownDisplay");
    const drag = applyPivotMacro("add-drag-and-drop", { spec: starter.spec, rules: starter.rules, catalog: playableCatalog });
    expect(drag.spec.elements["macro-drag-source"]?.type).toBe("DragToken");
    expect(drag.spec.elements["macro-drop-target"]?.type).toBe("DropSlot");
  });

  it("macro timers stop once the experience is won", () => {
    const timer = applyPivotMacro("add-countdown-timer", { spec: starter.spec, rules: starter.rules, catalog: playableCatalog });
    const session = createPlayableSession({ ...starter, spec: timer.spec, rules: timer.rules }, { muted: true });
    for (const event of verifyWinnability(starter).shortestTraces.win!) session.dispatch(event);
    expect(session.getView().outcome).toBe("win");
    for (let i = 0; i < 40; i += 1) session.dispatch({ type: "onTimerTick", timerId: "countdown" });
    expect(session.getView().outcome).toBe("win");
  });

  it("builds a deterministic flow graph covering every rule", () => {
    const graph = buildFlowGraph(starter);
    expect(JSON.stringify(buildFlowGraph(createPlayableStarter()))).toBe(JSON.stringify(graph));
    const ruleNodes = graph.nodes.filter((n) => n.kind === "rule").map((n) => n.ref);
    expect(ruleNodes).toEqual(starter.rules.map((r) => r.id));
    expect(graph.edges.some((e) => e.kind === "trigger" && e.from === "el:open-vault" && e.ruleId === "open-vault")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "effect" && e.ruleId === "open-vault" && e.to === "out:win")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "match" && e.ruleId === "signal-lost" && e.from === "st:/signal/seconds")).toBe(true);
  });
});
