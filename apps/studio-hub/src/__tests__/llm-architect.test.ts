import { describe, expect, it, vi } from "vitest";
import type { Spec } from "@json-render/core";
import {
  CreativeBriefSchema,
  createInteractionRuleEngine,
  inspectSpecGraph,
  type InteractionRule,
} from "@genui-studio/core";
import { fuzzPlaytestSpec } from "@genui-studio/core/testing";
import {
  buildSkillPackFiles,
  showcasePreviewCatalog,
} from "@genui-studio/templates";
import {
  ArchitectHttpError,
  ArchitectStreamAbortedError,
  ArchitectStreamError,
  LLM_PROVIDER_PRESETS,
  LlmConfigurationRequiredError,
  detectRecommendedInputMode,
  isLlmConfigured,
  streamArchitectPatch,
  type ArchitectSnapshot,
  type FetchLike,
} from "../lib/llm-architect.js";
import {
  PIVOT_MACROS,
  addCountdownTimerMacro,
  addDragAndDropMacro,
  addWinGoalMacro,
  applyPivotMacro,
  simplifyUnusedNodesMacro,
} from "../lib/pivot-macros.js";
import {
  serializeSpecToExcalidrawJson,
  specToExcalidrawScene,
} from "../lib/spec-to-excalidraw.js";
import { compileExcalidrawToGenUI } from "../lib/excalidraw-compiler.js";

function createBaseSpec(): Spec {
  return {
    root: "site-shell",
    elements: {
      "site-shell": {
        type: "SiteShell",
        props: {
          brandName: "Starter Studio",
          tagline: "Baseline Blueprint",
          badge: "STARTER",
          layoutDensity: "spacious",
        },
        children: ["hero-1", "metrics-1"],
      },
      "hero-1": {
        type: "HeroSection",
        props: {
          eyebrow: "BASELINE",
          headline: "Initial Hero",
          summary: "Baseline summary text.",
          primaryCta: "Launch",
          secondaryCta: null,
        },
        children: [],
      },
      "metrics-1": {
        type: "MetricStrip",
        props: {
          heading: "Telemetry",
          primaryValue: "0",
          primaryLabel: "Score",
          secondaryValue: "100%",
          secondaryLabel: "Health",
          uptimePercent: 99.5,
        },
        children: [],
      },
    },
    state: {
      outcome: "playing",
      score: 0,
    },
  };
}

/**
 * Splits a UTF-8 string into arbitrary fixed-size byte chunks to simulate hostile
 * TCP/HTTP stream framing that splits mid-character, mid-SSE-frame, and mid-JSON-line.
 */
function makeChunkedStreamResponse(
  rawWireText: string,
  chunkByteSize: number,
  options: { readonly status?: number; readonly contentType?: string } = {},
): Response {
  const bytes = new TextEncoder().encode(rawWireText);
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      const slice = bytes.slice(offset, offset + chunkByteSize);
      offset += chunkByteSize;
      controller.enqueue(slice);
    },
  });

  return new Response(stream, {
    status: options.status ?? 200,
    headers: {
      "Content-Type": options.contentType ?? "text/event-stream; charset=utf-8",
    },
  });
}

function wrapInOpenAiSse(modelContent: string, deltaChars = 19): string {
  const frames: string[] = [": stream-keepalive\n\n"];
  for (let i = 0; i < modelContent.length; i += deltaChars) {
    const piece = modelContent.slice(i, i + deltaChars);
    frames.push(
      `data: ${JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
      })}\n\n`,
    );
  }
  frames.push("data: [DONE]\n\n");
  return frames.join("");
}

function wrapInGeminiSse(modelContent: string, deltaChars = 23): string {
  const frames: string[] = [];
  for (let i = 0; i < modelContent.length; i += deltaChars) {
    const piece = modelContent.slice(i, i + deltaChars);
    frames.push(
      `data: ${JSON.stringify({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: piece }],
            },
          },
        ],
      })}\n\n`,
    );
  }
  return frames.join("");
}

describe("Phase 3: Streaming BYO-LLM Architect, Dual Input Modes, Pivot Macros & Excalidraw Serializer", () => {
  it("1a. parses split-chunk OpenAI-compatible (Yantra AI) SSE streams across arbitrary byte boundaries", async () => {
    const baseSpec = createBaseSpec();
    const modelLines = [
      `BRIEF: ${JSON.stringify({
        title: "Café Signal Relay — Tactile Vault",
        slug: "cafe-signal-relay",
        inputMode: "vibe",
        promptSummary: "Cozy retro relay console with tactile power switch",
        elevatorPitch: "Power up three relays before signal decay.",
        aestheticDirection: "Warm studio hardware console",
        coreLoop: "Click relay switches to reach power level 2.",
        winCondition: "Power reaches 2",
        targetStack: "Next.js 15 + React 19 + TypeScript",
        scenes: ["main"],
      })}`,
      JSON.stringify({
        op: "replace",
        path: "/elements/hero-1/props/headline",
        value: "Café Signal Relay Console ⚡",
      }),
      JSON.stringify({
        op: "add",
        path: "/state/power",
        value: 0,
      }),
      JSON.stringify({
        op: "add",
        path: "/experience/rules",
        value: [
          {
            id: "boost-power",
            label: "Boost Relay Power",
            trigger: { type: "onClick", elementKey: "hero-1" },
            effects: [
              { type: "inc", path: "/power", by: 1, max: 2 },
              { type: "playSynthSound", cue: "powerup" },
            ],
          },
          {
            id: "relay-win",
            label: "Relay Stabilized Win",
            once: true,
            trigger: { type: "onStateMatch" },
            guards: [{ op: "gte", path: "/power", value: 2 }],
            effects: [
              { type: "setOutcome", outcome: "win", reason: "Relay stabilized!" },
              { type: "playSynthSound", cue: "win" },
            ],
          },
        ],
      }),
    ].join("\n");

    const ssePayload = wrapInOpenAiSse(modelLines, 13);
    let capturedUrl = "";
    let capturedAuth = "";
    let capturedModel = "";

    const fetchMock: FetchLike = async (input, init) => {
      capturedUrl = String(input);
      const headers = new Headers(init?.headers);
      capturedAuth = headers.get("Authorization") ?? "";
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
      capturedModel = body.model ?? "";
      // Split every 7 bytes to break UTF-8 multi-byte chars ("é", "—", "⚡") and SSE lines
      return makeChunkedStreamResponse(ssePayload, 7);
    };

    const result = await streamArchitectPatch({
      prompt: "Make a cozy retro signal relay console",
      mode: "vibe",
      config: {
        provider: "yantra",
        apiKey: "yk_live_unit_test_key",
      },
      currentSpec: baseSpec,
      currentRules: [],
      catalog: showcasePreviewCatalog,
      fetchImpl: fetchMock,
    });

    expect(capturedUrl).toBe(`${LLM_PROVIDER_PRESETS.yantra.baseUrl}/chat/completions`);
    expect(capturedAuth).toBe("Bearer yk_live_unit_test_key");
    expect(capturedModel).toBe("auto:fast");
    expect(result.mode).toBe("vibe");
    expect(result.brief.title).toBe("Café Signal Relay — Tactile Vault");
    expect(result.spec.elements["hero-1"]?.props?.headline).toBe(
      "Café Signal Relay Console ⚡",
    );
    expect(result.rules).toHaveLength(2);
    expect(result.audit?.fuzzReport.shortestTraces.win).toHaveLength(2);
    expect(showcasePreviewCatalog.validateFull(result.spec).valid).toBe(true);
  });

  it("1b. parses split-chunk native Gemini SSE streams identically", async () => {
    const baseSpec = createBaseSpec();
    const modelLines = [
      `BRIEF: ${JSON.stringify({
        title: "Gemini Pulse Deck",
        slug: "gemini-pulse-deck",
        inputMode: "vibe",
        promptSummary: "Pulse deck",
        elevatorPitch: "Tap to charge the pulse core.",
        aestheticDirection: "Precision monochrome HUD",
        coreLoop: "Click hero once to complete calibration.",
        targetStack: "Next.js 15",
        scenes: ["main"],
      })}`,
      JSON.stringify({
        op: "replace",
        path: "/elements/hero-1/props/headline",
        value: "Gemini Pulse Calibration",
      }),
      JSON.stringify({
        op: "add",
        path: "/experience/rules/-",
        value: {
          id: "calibrate-complete",
          label: "Complete Calibration",
          trigger: { type: "onClick", elementKey: "hero-1" },
          effects: [{ type: "setOutcome", outcome: "complete", reason: "Calibrated" }],
        },
      }),
    ].join("\n");

    let capturedUrl = "";
    let capturedKeyHeader = "";

    const fetchMock: FetchLike = async (input, init) => {
      capturedUrl = String(input);
      const headers = new Headers(init?.headers);
      capturedKeyHeader = headers.get("x-goog-api-key") ?? "";
      return makeChunkedStreamResponse(wrapInGeminiSse(modelLines, 11), 9);
    };

    const result = await streamArchitectPatch({
      prompt: "Build a pulse calibration deck",
      config: {
        provider: "gemini",
        apiKey: "AIza_fake_test_key",
        model: "gemini-2.5-flash",
      },
      currentSpec: baseSpec,
      currentRules: [],
      catalog: showcasePreviewCatalog,
      fetchImpl: fetchMock,
    });

    expect(capturedUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
    expect(capturedKeyHeader).toBe("AIza_fake_test_key");
    expect(result.spec.elements["hero-1"]?.props?.headline).toBe(
      "Gemini Pulse Calibration",
    );
    expect(result.rules.map((r) => r.id)).toContain("calibrate-complete");
    expect(result.audit?.fuzzReport.shortestTraces.complete).toHaveLength(1);
  });

  it("2. heals/blocks hostile LLM payloads (uptimePercent: 999, __proto__, javascript:alert(1), cycles)", async () => {
    const baseSpec = createBaseSpec();
    const hostileModelOutput = [
      // Out-of-range numeric prop (999 -> healed to 100) + unsafe URI in heading
      JSON.stringify({
        op: "add",
        path: "/elements/hostile-metric",
        value: {
          type: "MetricStrip",
          props: {
            heading: "javascript:alert(1)",
            primaryValue: "999",
            primaryLabel: "Injected",
            secondaryValue: "BAD",
            secondaryLabel: "Probe",
            uptimePercent: 999,
          },
          children: ["hostile-metric"], // self-cycle!
        },
      }),
      JSON.stringify({
        op: "add",
        path: "/elements/site-shell/children/-",
        value: "hostile-metric",
      }),
      // Prototype pollution RFC 6902 pointer attack
      JSON.stringify({
        op: "add",
        path: "/__proto__/polluted",
        value: "pwned",
      }),
      // Hostile interaction rules: one targeting __proto__, one with javascript: URI value
      JSON.stringify({
        op: "add",
        path: "/experience/rules",
        value: [
          {
            id: "evil-proto-rule",
            label: "Proto Pollution Rule",
            trigger: { type: "onClick", elementKey: "hero-1" },
            effects: [{ type: "set", path: "/__proto__/isAdmin", value: true }],
          },
          {
            id: "xss-uri-rule",
            label: "Neutralized URI Rule",
            trigger: { type: "onClick", elementKey: "hero-1" },
            effects: [{ type: "set", path: "/redirectUrl", value: "javascript:alert(1)" }],
          },
        ],
      }),
    ].join("\n");

    const fetchMock: FetchLike = async () =>
      makeChunkedStreamResponse(wrapInOpenAiSse(hostileModelOutput, 17), 13);

    const result = await streamArchitectPatch({
      prompt: "Inject adversarial telemetry",
      mode: "vibe",
      config: { provider: "ollama" },
      currentSpec: baseSpec,
      currentRules: [],
      catalog: showcasePreviewCatalog,
      fetchImpl: fetchMock,
    });

    // Object.prototype must remain completely clean
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();

    // MetricStrip uptimePercent: 999 healed to 100 and javascript: neutralized
    const hostileMetric = result.spec.elements["hostile-metric"];
    expect(hostileMetric).toBeDefined();
    expect(hostileMetric?.props?.uptimePercent).toBe(100);
    expect(hostileMetric?.props?.heading).toBe("#blocked-unsafe-uri");
    expect(result.healedDiagnostics["hostile-metric"]?.length).toBeGreaterThan(0);

    // Self-cycle severed
    const graph = inspectSpecGraph(result.spec);
    expect(graph.hasCycles).toBe(false);
    expect(hostileMetric?.children ?? []).not.toContain("hostile-metric");

    // Prototype pollution rule dropped; XSS URI rule neutralized
    expect(result.rules.some((r) => r.id === "evil-proto-rule")).toBe(false);
    const xssRule = result.rules.find((r) => r.id === "xss-uri-rule");
    expect(xssRule).toBeDefined();
    expect(xssRule?.effects[0]).toEqual({
      type: "set",
      path: "/redirectUrl",
      value: "#blocked-unsafe-uri",
    });
    expect(result.issues.some((i) => i.code === "blocked_unsafe_path")).toBe(true);
    expect(result.issues.some((i) => i.code === "blocked_unsafe_uri")).toBe(true);
  });

  it("3. performs full transactional rollback on mid-stream AbortController.abort(), HTTP 500, and stream error", async () => {
    const initialSpec = createBaseSpec();
    const initialRules: InteractionRule[] = [
      {
        id: "baseline-rule",
        label: "Baseline Click",
        trigger: { type: "onClick", elementKey: "hero-1" },
        effects: [{ type: "inc", path: "/score", by: 1 }],
      },
    ];

    // Case A: Mid-stream abort after partial patch has already streamed and triggered onProgress
    const abortController = new AbortController();
    const progressUpdates: string[] = [];
    let rolledBackSnapshot: ArchitectSnapshot | null = null;

    const firstPatchLine = `${JSON.stringify({
      op: "replace",
      path: "/elements/hero-1/props/headline",
      value: "PARTIAL MUTATION THAT MUST ROLL BACK",
    })}\n`;
    const sseFirstChunk = `data: ${JSON.stringify({
      choices: [{ delta: { content: firstPatchLine } }],
    })}\n\n`;

    let chunkIndex = 0;
    const abortingFetch: FetchLike = async () => {
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (chunkIndex === 0) {
            chunkIndex += 1;
            controller.enqueue(new TextEncoder().encode(sseFirstChunk));
            return;
          }
          // Wait briefly for consumer to process chunk 0 and abort mid-stream
          await new Promise((resolve) => setTimeout(resolve, 25));
          if (!abortController.signal.aborted) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: '{"op":"replace","path":"/state/score","value":99}\n' } }],
                })}\n\n`,
              ),
            );
            controller.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };

    await expect(
      streamArchitectPatch({
        prompt: "Reframe hero title",
        config: { provider: "yantra", apiKey: "yk_live_abort_test" },
        currentSpec: initialSpec,
        currentRules: initialRules,
        catalog: showcasePreviewCatalog,
        signal: abortController.signal,
        fetchImpl: abortingFetch,
        onProgress: (p) => {
          const headline = String(p.spec.elements["hero-1"]?.props?.headline ?? "");
          progressUpdates.push(headline);
          if (headline === "PARTIAL MUTATION THAT MUST ROLL BACK") {
            abortController.abort();
          }
        },
        onRollback: (snap) => {
          rolledBackSnapshot = snap;
        },
      }),
    ).rejects.toThrow(ArchitectStreamAbortedError);

    expect(progressUpdates).toContain("PARTIAL MUTATION THAT MUST ROLL BACK");
    expect(rolledBackSnapshot).not.toBeNull();
    expect(rolledBackSnapshot!.spec).toEqual(initialSpec);
    expect(rolledBackSnapshot!.rules).toEqual(initialRules);

    // Case B: HTTP 500 error triggers rollback
    const onRollbackHttp = vi.fn();
    const failingHttpFetch: FetchLike = async () =>
      new Response("Upstream gateway error", { status: 500, statusText: "Internal Server Error" });

    await expect(
      streamArchitectPatch({
        prompt: "Reframe hero",
        config: { provider: "yantra", apiKey: "yk_live_500_test" },
        currentSpec: initialSpec,
        currentRules: initialRules,
        fetchImpl: failingHttpFetch,
        onRollback: onRollbackHttp,
      }),
    ).rejects.toThrow(ArchitectHttpError);

    expect(onRollbackHttp).toHaveBeenCalledTimes(1);
    expect(onRollbackHttp.mock.calls[0]?.[0]).toEqual({
      spec: initialSpec,
      rules: initialRules,
      brief: null,
    });

    // Case C: Mid-stream network error triggers rollback
    const onRollbackStreamErr = vi.fn();
    const brokenStreamFetch: FetchLike = async () => {
      let emitted = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!emitted) {
            emitted = true;
            controller.enqueue(new TextEncoder().encode(sseFirstChunk));
          } else {
            controller.error(new Error("Simulated TCP socket reset"));
          }
        },
      });
      return new Response(stream, { status: 200 });
    };

    await expect(
      streamArchitectPatch({
        prompt: "Reframe hero",
        config: { provider: "yantra", apiKey: "yk_live_err_test" },
        currentSpec: initialSpec,
        currentRules: initialRules,
        fetchImpl: brokenStreamFetch,
        onRollback: onRollbackStreamErr,
      }),
    ).rejects.toThrow(ArchitectStreamError);

    expect(onRollbackStreamErr).toHaveBeenCalledTimes(1);
    expect(onRollbackStreamErr.mock.calls[0]?.[0]).toEqual({
      spec: initialSpec,
      rules: initialRules,
      brief: null,
    });
  });

  it("4. Master Prompt (.md) fixture compiles traced rules, surfaces deadRules, and preserves non-UI constraints verbatim into Phase 2 Skill Pack", async () => {
    const masterPromptMd = [
      "# Vault Dispatch Console",
      "",
      "## 1. Interactive Operator Workflow",
      "- Clicking `verify-panel` advances `/checksPassed` by 1 until 2 checks pass.",
      "- When `/checksPassed >= 2`, mark the dispatch outcome as `win`.",
      "",
      "## 2. Backend API & Persistence",
      "- Expose `POST /api/v1/dispatches` returning HTTP 201 with an idempotency key header.",
      "- Persist every dispatch audit row in PostgreSQL 16 (`dispatch_events` table) via Prisma.",
      "",
      "## 3. Security & Auth",
      "- Enforce JWT RS256 Bearer auth with `operator:dispatch` RBAC scope on all write routes.",
      "",
      "## 4. Hidden Admin Override (Edge Case)",
      "- Unreachable override branch requiring `/adminOverrideSecret === 'IMPOSSIBLE_TOKEN'`.",
    ].join("\n");

    expect(detectRecommendedInputMode("cozy synthwave timer")).toBe("vibe");
    expect(detectRecommendedInputMode(masterPromptMd)).toBe("master-prompt");

    const constraintApi =
      "Expose POST /api/v1/dispatches returning HTTP 201 with an idempotency key header.";
    const constraintDb =
      "Persist every dispatch audit row in PostgreSQL 16 (dispatch_events table) via Prisma.";
    const constraintAuth =
      "Enforce JWT RS256 Bearer auth with operator:dispatch RBAC scope on all write routes.";

    const extractorOutput = [
      `BRIEF: ${JSON.stringify({
        title: "Vault Dispatch Console",
        slug: "vault-dispatch-console",
        inputMode: "master-prompt",
        promptSummary: "Operator dispatch workflow with backend persistence and RBAC auth.",
        elevatorPitch: "Two-step verified dispatch console backed by PostgreSQL audit logs.",
        aestheticDirection: "High-contrast industrial control room",
        coreLoop: "Verify two operator checks to authorize vault dispatch.",
        winCondition: "checksPassed >= 2",
        targetStack: "Next.js 15 + PostgreSQL 16 + Prisma",
        scenes: ["dispatch"],
        elementSourceSections: {
          "verify-panel": "1. Interactive Operator Workflow",
          "telemetry-strip": "1. Interactive Operator Workflow",
        },
      })}`,
      `CONSTRAINTS: ${JSON.stringify([
        {
          id: "c-api-1",
          category: "backend-api",
          sourceSection: "2. Backend API & Persistence",
          requirement: constraintApi,
        },
        {
          id: "c-db-1",
          category: "database",
          sourceSection: "2. Backend API & Persistence",
          requirement: constraintDb,
        },
        {
          id: "c-auth-1",
          category: "auth-security",
          sourceSection: "3. Security & Auth",
          requirement: constraintAuth,
        },
      ])}`,
      JSON.stringify({
        op: "add",
        path: "/root",
        value: "dispatch-shell",
      }),
      JSON.stringify({
        op: "add",
        path: "/elements",
        value: {
          "dispatch-shell": {
            type: "SiteShell",
            props: {
              brandName: "Vault Dispatch Console",
              tagline: "Master Prompt Extracted Spec",
              badge: "PRD VERIFIED",
              layoutDensity: "compact",
            },
            children: ["verify-panel", "telemetry-strip"],
          },
          "verify-panel": {
            type: "HeroSection",
            props: {
              eyebrow: "1. INTERACTIVE OPERATOR WORKFLOW",
              headline: "Authorize Vault Dispatch",
              summary: "Complete two safety checks to unlock dispatch.",
              primaryCta: "Verify Safety Check",
              secondaryCta: "Requires 2 Checks",
            },
            children: [],
          },
          "telemetry-strip": {
            type: "MetricStrip",
            props: {
              heading: "Dispatch Readiness Telemetry",
              primaryValue: "0 / 2",
              primaryLabel: "Checks Passed",
              secondaryValue: "LOCKED",
              secondaryLabel: "Vault State",
              uptimePercent: 99.99,
            },
            children: [],
          },
        },
      }),
      JSON.stringify({
        op: "add",
        path: "/state",
        value: {
          checksPassed: 0,
          outcome: "playing",
          adminOverrideSecret: "",
        },
      }),
      JSON.stringify({
        op: "add",
        path: "/experience/rules",
        value: [
          {
            id: "operator-verify-check",
            label: "Verify Safety Check",
            sourceSection: "1. Interactive Operator Workflow",
            trigger: { type: "onClick", elementKey: "verify-panel" },
            guards: [{ op: "eq", path: "/outcome", value: "playing" }],
            effects: [
              { type: "inc", path: "/checksPassed", by: 1, max: 2 },
              { type: "playSynthSound", cue: "unlock" },
            ],
          },
          {
            id: "dispatch-authorized-win",
            label: "Dispatch Authorized Win",
            sourceSection: "1. Interactive Operator Workflow",
            once: true,
            trigger: { type: "onStateMatch" },
            guards: [
              { op: "gte", path: "/checksPassed", value: 2 },
              { op: "eq", path: "/outcome", value: "playing" },
            ],
            effects: [
              { type: "setOutcome", outcome: "win", reason: "Dispatch authorized." },
              { type: "playSynthSound", cue: "win" },
            ],
          },
          {
            id: "unreachable-admin-override",
            label: "Dead Admin Override Branch",
            sourceSection: "4. Hidden Admin Override (Edge Case)",
            trigger: { type: "onClick", elementKey: "verify-panel" },
            guards: [
              { op: "eq", path: "/adminOverrideSecret", value: "IMPOSSIBLE_TOKEN" },
            ],
            effects: [
              { type: "setOutcome", outcome: "complete", reason: "Override" },
            ],
          },
        ],
      }),
    ].join("\n");

    const fetchMock: FetchLike = async () =>
      makeChunkedStreamResponse(wrapInOpenAiSse(extractorOutput, 29), 17);

    const result = await streamArchitectPatch({
      prompt: masterPromptMd,
      // Omit mode to prove auto-detection switches to "master-prompt"
      config: { provider: "yantra", apiKey: "yk_live_prd_test", model: "auto:reasoning" },
      currentSpec: createBaseSpec(),
      currentRules: [],
      catalog: showcasePreviewCatalog,
      fetchImpl: fetchMock,
      fuzzRuns: 80,
      fuzzSeed: 42,
    });

    expect(result.mode).toBe("master-prompt");
    expect(CreativeBriefSchema.safeParse(result.brief).success).toBe(true);
    expect(result.rules).toHaveLength(3);
    expect(result.rules[0]?.sourceSection).toBe("1. Interactive Operator Workflow");
    expect(result.preservedConstraints).toHaveLength(3);

    // Master Prompt Audit catches the dead rule AND verifies the winning trace!
    expect(result.audit).not.toBeNull();
    expect(result.audit!.fuzzReport.shortestTraces.win).toHaveLength(2);
    expect(result.audit!.deadRules).toEqual([
      {
        id: "unreachable-admin-override",
        label: "Dead Admin Override Branch",
        sourceSection: "4. Hidden Admin Override (Edge Case)",
      },
    ]);
    expect(result.audit!.mappedSections).toContain("1. Interactive Operator Workflow");
    expect(result.audit!.mappedSections).toContain("2. Backend API & Persistence");
    expect(result.audit!.mappedSections).toContain("3. Security & Auth");
    expect(result.audit!.mappedSections).toContain("4. Hidden Admin Override (Edge Case)");

    // End-to-end Phase 3 -> Phase 2 verification: preservedConstraints survive verbatim
    // into SKILL.md, requirements.md, design.md, and tasks.md!
    const excalidrawJson = serializeSpecToExcalidrawJson({
      spec: result.spec,
      rules: result.rules,
      brief: result.brief,
      catalog: showcasePreviewCatalog,
    });
    const packFiles = buildSkillPackFiles({
      brief: result.brief,
      spec: result.spec,
      rules: result.rules,
      catalog: showcasePreviewCatalog,
      excalidrawJson,
      fuzz: { numRuns: 80, seed: 42 },
    });

    const docsToVerify = [
      "SKILL.md",
      ".kiro/specs/vault-dispatch-console/requirements.md",
      ".kiro/specs/vault-dispatch-console/design.md",
      ".kiro/specs/vault-dispatch-console/tasks.md",
    ];
    for (const filePath of docsToVerify) {
      const content = packFiles[filePath];
      expect(content, `Expected Skill Pack file ${filePath}`).toBeDefined();
      expect(content).toContain(constraintApi);
      expect(content).toContain(constraintDb);
      expect(content).toContain(constraintAuth);
    }
    const exportedExcalidraw =
      packFiles["wireframe/vault-dispatch-console.excalidraw.json"];
    expect(exportedExcalidraw).toBeDefined();
    expect(exportedExcalidraw!.trim()).toBe(excalidrawJson.trim());
    expect(JSON.parse(exportedExcalidraw!)).toEqual(JSON.parse(excalidrawJson));
  });

  it("5a. enforces zero fake NLP: throws LlmConfigurationRequiredError without a real endpoint/key", async () => {
    const fetchSpy = vi.fn();

    expect(isLlmConfigured(null)).toBe(false);
    expect(isLlmConfigured({ provider: "yantra", apiKey: "" })).toBe(false);
    expect(isLlmConfigured({ provider: "openai" })).toBe(false);
    expect(isLlmConfigured({ provider: "gemini", apiKey: "   " })).toBe(false);
    expect(isLlmConfigured({ provider: "custom", baseUrl: "" })).toBe(false);

    expect(isLlmConfigured({ provider: "ollama" })).toBe(true);
    expect(isLlmConfigured({ provider: "yantra", apiKey: "yk_live_abc" })).toBe(true);
    expect(isLlmConfigured({ provider: "yantra", useDevProxy: true })).toBe(true);

    await expect(
      streamArchitectPatch({
        prompt: "Turn this into a retro arcade synth",
        config: { provider: "yantra", apiKey: "" },
        currentSpec: createBaseSpec(),
        currentRules: [],
        fetchImpl: fetchSpy,
      }),
    ).rejects.toThrow(LlmConfigurationRequiredError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("5b. executes all 4 deterministic offline Pivot Macros cleanly and satisfies catalog & fuzzer invariants", () => {
    expect(PIVOT_MACROS.map((m) => m.id)).toEqual([
      "add-countdown-timer",
      "add-win-goal",
      "add-drag-and-drop",
      "simplify-unused-nodes",
    ]);

    const baseSpec = createBaseSpec();

    // Macro 1: + Add Countdown Timer -> reaches "lose" when timer ticks to 0
    const timerRes = addCountdownTimerMacro(
      { spec: baseSpec, rules: [], catalog: showcasePreviewCatalog },
      { initialSeconds: 3 },
    );
    expect(showcasePreviewCatalog.validateFull(timerRes.spec).valid).toBe(true);
    expect(timerRes.spec.elements["macro-countdown-hud"]).toBeDefined();
    const timerFuzz = fuzzPlaytestSpec({
      initialState: timerRes.spec.state,
      rules: timerRes.rules,
      numRuns: 60,
      seed: 42,
    });
    expect(timerFuzz.shortestTraces.lose).toHaveLength(3);

    // Macro 2: + Add Win Goal -> reaches "win" in 3 clicks
    const winRes = addWinGoalMacro(
      { spec: timerRes.spec, rules: timerRes.rules, catalog: showcasePreviewCatalog },
      { targetScore: 3 },
    );
    expect(showcasePreviewCatalog.validateFull(winRes.spec).valid).toBe(true);
    const winFuzz = fuzzPlaytestSpec({
      initialState: winRes.spec.state,
      rules: winRes.rules,
      numRuns: 100,
      seed: 42,
    });
    expect(winFuzz.shortestTraces.win).not.toBeNull();

    // Macro 3: + Add Drag & Drop -> dispatches real onDragStart + onDrop events
    const dndRes = addDragAndDropMacro({
      spec: winRes.spec,
      rules: winRes.rules,
      catalog: showcasePreviewCatalog,
    });
    expect(showcasePreviewCatalog.validateFull(dndRes.spec).valid).toBe(true);
    const engine = createInteractionRuleEngine({
      initialState: dndRes.spec.state,
      rules: dndRes.rules,
    });
    engine.dispatch({ type: "onDragStart", elementKey: "macro-drag-source" });
    expect(engine.store.get("/draggingItem")).toBe("macro-drag-source");
    engine.dispatch({
      type: "onDrop",
      sourceElementKey: "macro-drag-source",
      targetElementKey: "macro-drop-target",
    });
    expect(engine.store.get("/dropCount")).toBe(1);
    expect(engine.store.get("/droppedItems")).toEqual(["macro-drag-source"]);

    // Macro 4: Simplify Unused Nodes -> removes orphan element & dangling/disabled rules
    const specWithOrphan: Spec = {
      ...dndRes.spec,
      elements: {
        ...dndRes.spec.elements,
        "orphan-card": {
          type: "HeroSection",
          props: {
            eyebrow: "ORPHAN",
            headline: "Unreachable Element",
            summary: "Not referenced in site-shell.children",
            primaryCta: "Orphan",
            secondaryCta: null,
          },
          children: [],
        },
      },
    };
    const rulesWithCruft: InteractionRule[] = [
      ...dndRes.rules,
      {
        id: "dangling-orphan-rule",
        label: "Targets Orphan",
        trigger: { type: "onClick", elementKey: "orphan-card" },
        effects: [{ type: "inc", path: "/score", by: 1 }],
      },
      {
        id: "disabled-rule",
        label: "Disabled Rule",
        enabled: false,
        trigger: { type: "onClick", elementKey: "hero-1" },
        effects: [{ type: "inc", path: "/score", by: 1 }],
      },
    ];

    const simplified = simplifyUnusedNodesMacro({
      spec: specWithOrphan,
      rules: rulesWithCruft,
      catalog: showcasePreviewCatalog,
    });
    expect(simplified.changed).toBe(true);
    expect(simplified.removedElementKeys).toEqual(["orphan-card"]);
    expect(simplified.removedRuleIds).toEqual(["dangling-orphan-rule", "disabled-rule"]);
    expect(simplified.spec.elements["orphan-card"]).toBeUndefined();
    expect(showcasePreviewCatalog.validateFull(simplified.spec).valid).toBe(true);

    // Dispatcher parity check
    const dispatched = applyPivotMacro("add-win-goal", {
      spec: baseSpec,
      rules: [],
      catalog: showcasePreviewCatalog,
    });
    expect(dispatched.spec.elements["macro-win-goal-panel"]).toBeDefined();
  });

  it("6. specToExcalidrawScene produces deterministic valid Excalidraw v2 JSON that round-trips cleanly", () => {
    const dndRes = addDragAndDropMacro({
      spec: createBaseSpec(),
      rules: [],
      catalog: showcasePreviewCatalog,
    });

    const doc1 = specToExcalidrawScene({
      spec: dndRes.spec,
      rules: dndRes.rules,
      catalog: showcasePreviewCatalog,
    });
    const doc2 = specToExcalidrawScene({
      spec: dndRes.spec,
      rules: dndRes.rules,
      catalog: showcasePreviewCatalog,
    });

    // Byte-identical deterministic output
    expect(JSON.stringify(doc1)).toBe(JSON.stringify(doc2));
    expect(doc1.type).toBe("excalidraw");
    expect(doc1.version).toBe(2);

    // Includes a labelled dashed arrow for the onDrop rule connecting source -> target
    const ruleArrows = doc1.elements.filter((el) => el.type === "arrow");
    expect(ruleArrows.length).toBeGreaterThanOrEqual(1);

    // Clean round-trip back through compileExcalidrawToGenUI (zero cycles, valid catalog spec)
    const recompiled = compileExcalidrawToGenUI(doc1.elements, {
      catalog: showcasePreviewCatalog,
    });
    expect(recompiled.compiledNodeCount).toBeGreaterThanOrEqual(4);
    expect(inspectSpecGraph(recompiled.spec).hasCycles).toBe(false);
    expect(showcasePreviewCatalog.validateFull(recompiled.spec).valid).toBe(true);
  });
});
