import React, { useId, useRef, useState } from "react";
import { FileUp, Settings2, Sparkles, Square } from "lucide-react";
import {
  LLM_PROVIDER_PRESETS,
  detectRecommendedInputMode,
  isLlmConfigured,
  type ArchitectInputMode,
  type LlmArchitectConfig,
  type LlmProviderPresetId,
} from "../lib/llm-architect.js";
import { PIVOT_MACROS, type PivotMacroId } from "../lib/pivot-macros.js";

export interface VibeReframeBarProps {
  /** Runs the streaming architect; resolves with a status line or rejects with the error. */
  readonly onSubmitPrompt: (request: {
    readonly prompt: string;
    readonly mode: ArchitectInputMode;
    readonly config: LlmArchitectConfig;
    readonly signal: AbortSignal;
  }) => Promise<string>;
  readonly onApplyMacro: (macroId: PivotMacroId) => string;
  readonly isStreaming: boolean;
  readonly streamProgress?: string | null;
  /** Show the "Use dev proxy" option (only works under `vite dev`). */
  readonly devProxyAvailable?: boolean;
}

const MAX_MARKDOWN_BYTES = 256 * 1024;
const PROVIDER_IDS = Object.keys(LLM_PROVIDER_PRESETS) as LlmProviderPresetId[];

const FIELD =
  "min-h-[34px] w-full rounded-md border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs text-[#09090B] focus:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563EB]";

/**
 * Dual-mode input: Quick Vibe or Master Prompt (.md), offline pivot macro chips, and a
 * model/endpoint drawer. Freeform text needs a configured LLM endpoint; without one the
 * bar says so instead of faking a result.
 */
export const VibeReframeBar: React.FC<VibeReframeBarProps> = ({
  onSubmitPrompt,
  onApplyMacro,
  isStreaming,
  streamProgress = null,
  devProxyAvailable = false,
}) => {
  const promptId = useId();
  const drawerId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ArchitectInputMode>("vibe");
  const [modeChosenByUser, setModeChosenByUser] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [provider, setProvider] = useState<LlmProviderPresetId>("yantra");
  const [baseUrl, setBaseUrl] = useState(LLM_PROVIDER_PRESETS.yantra.baseUrl);
  const [model, setModel] = useState(LLM_PROVIDER_PRESETS.yantra.defaultModel);
  const [apiKey, setApiKey] = useState("");
  const [useDevProxy, setUseDevProxy] = useState(false);
  const [status, setStatus] = useState<{ tone: "info" | "error" | "warn"; text: string } | null>(null);

  const preset = LLM_PROVIDER_PRESETS[provider];
  const config: LlmArchitectConfig = {
    provider,
    baseUrl,
    model,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    ...(devProxyAvailable && useDevProxy ? { useDevProxy: true } : {}),
  };
  const configured = isLlmConfigured(config);

  const updateText = (next: string) => {
    setText(next);
    if (!modeChosenByUser && next.trim()) {
      setMode(detectRecommendedInputMode(next));
    }
  };

  const chooseProvider = (id: LlmProviderPresetId) => {
    setProvider(id);
    setBaseUrl(LLM_PROVIDER_PRESETS[id].baseUrl);
    setModel(LLM_PROVIDER_PRESETS[id].defaultModel);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MARKDOWN_BYTES) {
      setStatus({ tone: "error", text: `${file.name} is larger than 256 KB.` });
      return;
    }
    const content = await file.text();
    setText(content);
    setMode("master-prompt");
    setModeChosenByUser(true);
    setStatus({ tone: "info", text: `Loaded ${file.name} as a Master Prompt.` });
  };

  const submit = async () => {
    const prompt = text.trim();
    if (!prompt || isStreaming) return;
    if (!configured) {
      setDrawerOpen(true);
      setStatus({
        tone: "warn",
        text: "Freeform prompts need an LLM. Add an API key, a local Ollama URL or the dev proxy in Model settings. Without one, use a pivot macro below.",
      });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ tone: "info", text: "Streaming from the model…" });
    try {
      const summary = await onSubmitPrompt({ prompt, mode, config, signal: controller.signal });
      setStatus({ tone: "info", text: summary });
    } catch (err) {
      setStatus({
        tone: "error",
        text: `${err instanceof Error ? err.message : String(err)} The previous spec was kept.`,
      });
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <section aria-label="Reframe the experience" data-testid="vibe-reframe-bar" className="hub-card space-y-2.5 p-3">
      <form
        className="flex flex-col gap-2 lg:flex-row lg:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div role="group" aria-label="Input mode" className="flex shrink-0 rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] p-0.5">
          {(
            [
              ["vibe", "Quick Vibe"],
              ["master-prompt", "Master Prompt (.md)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              data-testid={`input-mode-${id}`}
              onClick={() => {
                setMode(id);
                setModeChosenByUser(true);
              }}
              className={`min-h-[30px] cursor-pointer rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2563EB] ${
                mode === id ? "bg-white text-[#09090B] shadow-xs" : "text-[#52525B] hover:text-[#09090B]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label htmlFor={promptId} className="visually-hidden">
          {mode === "vibe" ? "Describe a change or a new idea" : "Paste a Markdown PRD"}
        </label>
        <textarea
          id={promptId}
          value={text}
          onChange={(e) => updateText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={mode === "master-prompt" ? 5 : 1}
          placeholder={
            mode === "vibe"
              ? "Describe a twist, e.g. “make it a submarine airlock with a pressure gauge”"
              : "# Product name\n## Core loop\n## Win condition\n## Backend…"
          }
          data-testid="vibe-prompt-input"
          className={`${FIELD} min-h-[34px] flex-1 resize-y font-sans`}
        />

        <div className="flex shrink-0 items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              void onUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
            data-testid="master-prompt-file-input"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2.5 text-xs font-medium text-[#09090B] hover:bg-[#FAFAFA]"
          >
            <FileUp aria-hidden="true" className="h-3.5 w-3.5" />
            .md
          </button>
          <button
            type="button"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            onClick={() => setDrawerOpen((v) => !v)}
            data-testid="model-drawer-toggle"
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border border-[#E4E4E7] bg-white px-2.5 text-xs font-medium text-[#09090B] hover:bg-[#FAFAFA]"
          >
            <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
            Model
            <span
              aria-label={configured ? "configured" : "not configured"}
              className={`h-1.5 w-1.5 rounded-full ${configured ? "bg-[#10B981]" : "bg-[#D4D4D8]"}`}
            />
          </button>
          {isStreaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              data-testid="abort-stream-btn"
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3 text-xs font-medium text-[#B91C1C]"
            >
              <Square aria-hidden="true" className="h-3.5 w-3.5" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              data-testid="vibe-submit-btn"
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md bg-[#09090B] px-3 text-xs font-medium text-white hover:enabled:bg-[#18181B] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {mode === "vibe" ? "Reframe" : "Extract spec"}
            </button>
          )}
        </div>
      </form>

      {drawerOpen ? (
        <div id={drawerId} data-testid="model-drawer" className="grid gap-2 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-[0.6875rem] font-medium text-[#52525B]">
            Provider
            <select
              value={provider}
              onChange={(e) => chooseProvider(e.target.value as LlmProviderPresetId)}
              data-testid="llm-provider-select"
              className={FIELD}
            >
              {PROVIDER_IDS.map((id) => (
                <option key={id} value={id}>
                  {LLM_PROVIDER_PRESETS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[0.6875rem] font-medium text-[#52525B]">
            Base URL
            <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={`${FIELD} font-mono`} />
          </label>
          <label className="space-y-1 text-[0.6875rem] font-medium text-[#52525B]">
            Model
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list={`${drawerId}-models`}
              className={`${FIELD} font-mono`}
            />
            <datalist id={`${drawerId}-models`}>
              {preset.suggestedModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1 text-[0.6875rem] font-medium text-[#52525B]">
            API key {preset.requiresApiKey ? "" : "(optional)"}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={preset.keyHint}
              autoComplete="off"
              spellCheck={false}
              data-testid="llm-api-key-input"
              className={`${FIELD} font-mono`}
            />
          </label>
          <p className="m-0 text-[0.6875rem] text-[#71717A] sm:col-span-2 lg:col-span-4">
            The key stays in this tab's memory and is sent only to the base URL above. Cloud providers may block
            direct browser calls (CORS); local Ollama needs <code>OLLAMA_ORIGINS</code> set.
            {devProxyAvailable ? (
              <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 font-medium text-[#09090B]">
                <input
                  type="checkbox"
                  checked={useDevProxy}
                  onChange={(e) => setUseDevProxy(e.target.checked)}
                  className="accent-[#2563EB]"
                />
                Use dev proxy (GENUI_LLM_API_KEY in .env.local)
              </label>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[0.6875rem] text-[#71717A]">Offline macros:</span>
        {PIVOT_MACROS.map((macro) => (
          <button
            key={macro.id}
            type="button"
            title={macro.shortDescription}
            disabled={isStreaming}
            onClick={() => setStatus({ tone: "info", text: onApplyMacro(macro.id) })}
            data-testid={`pivot-macro-${macro.id}`}
            className="min-h-[28px] cursor-pointer rounded-full border border-[#E4E4E7] bg-white px-2.5 text-[0.6875rem] font-medium text-[#09090B] hover:enabled:border-[#2563EB] hover:enabled:text-[#1D4ED8] disabled:opacity-45"
          >
            {macro.label}
          </button>
        ))}
      </div>

      {streamProgress || status ? (
        <p
          role="status"
          data-testid={status?.tone === "warn" ? "llm-config-required" : "vibe-status"}
          className={`m-0 rounded-md px-2.5 py-1.5 text-xs ${
            status?.tone === "error"
              ? "bg-[#FEF2F2] text-[#B91C1C]"
              : status?.tone === "warn"
                ? "bg-[#FFFBEB] text-[#92400E]"
                : "bg-[#F4F4F5] text-[#52525B]"
          }`}
        >
          {isStreaming && streamProgress ? streamProgress : status?.text}
        </p>
      ) : null}
    </section>
  );
};
