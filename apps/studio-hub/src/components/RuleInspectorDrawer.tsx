import React, { useEffect, useId, useRef, useState } from "react";
import { FileText, X } from "lucide-react";
import {
  sanitizeInteractionRules,
  type GraphIssue,
  type InteractionRule,
  type PreservedConstraint,
} from "@genui-studio/core";
import type { PlaytestFuzzReport } from "@genui-studio/core/testing";
import type { MasterPromptAudit } from "../lib/llm-architect.js";
import { describeEffect, describeGuard, describeTrigger } from "../lib/rule-describe.js";

export interface RuleInspectorDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly rules: readonly InteractionRule[];
  /** Replaces the rule set; returns sanitizer issues. */
  readonly onChangeRules: (rules: readonly InteractionRule[]) => readonly GraphIssue[];
  readonly firedCounts: Readonly<Record<string, number>>;
  /** Only show rules that reference this element (set by clicking in Edit mode). */
  readonly selectedElementKey?: string | null;
  readonly onClearSelection?: () => void;
  readonly audit?: MasterPromptAudit | null;
  readonly preservedConstraints?: readonly PreservedConstraint[];
  readonly fuzzReport?: PlaytestFuzzReport | null;
}

function referencesElement(rule: InteractionRule, key: string): boolean {
  const t = rule.trigger;
  if (t.type === "onClick" || t.type === "onHover" || t.type === "onDragStart") {
    return t.elementKey === key;
  }
  if (t.type === "onDrop") return t.targetElementKey === key || t.sourceElementKey === key;
  return false;
}

const RuleCard: React.FC<{
  readonly rule: InteractionRule;
  readonly fired: number;
  readonly onToggle: (enabled: boolean) => void;
  readonly onApplyJson: (json: string) => string | null;
}> = ({ rule, fired, onToggle, onApplyJson }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toggleId = useId();
  const editorId = useId();
  const enabled = rule.enabled !== false;
  const guards = rule.guards ?? [];

  return (
    <li
      data-testid={`rule-card-${rule.id}`}
      data-enabled={enabled ? "true" : "false"}
      className={`rounded-lg border p-3 text-xs ${enabled ? "border-[#E4E4E7] bg-white" : "border-dashed border-[#E4E4E7] bg-[#FAFAFA] opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="m-0 font-semibold text-[#09090B]">{rule.label}</p>
          <p className="m-0 font-mono text-[0.6875rem] text-[#71717A]">
            {rule.id}
            {rule.once ? " · once" : ""} · fired {fired}×
          </p>
          {rule.sourceSection ? (
            <p className="m-0 inline-flex items-center gap-1 rounded border border-[#E4E4E7] bg-[#FAFAFA] px-1.5 py-0.5 font-mono text-[0.625rem] text-[#52525B]">
              <FileText aria-hidden="true" className="h-3 w-3" />
              {rule.sourceSection}
            </p>
          ) : null}
        </div>
        <label htmlFor={toggleId} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[0.6875rem] text-[#52525B]">
          <input
            id={toggleId}
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            data-testid={`rule-toggle-${rule.id}`}
            className="accent-[#2563EB]"
          />
          Enabled
        </label>
      </div>

      <dl className="mt-2 grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-1">
        <dt className="font-mono text-[0.6875rem] font-semibold text-[#2563EB]">When</dt>
        <dd className="m-0 text-[#09090B]">{describeTrigger(rule.trigger)}</dd>
        {guards.length > 0 ? (
          <>
            <dt className="font-mono text-[0.6875rem] font-semibold text-[#B45309]">If</dt>
            <dd className="m-0 text-[#09090B]">{guards.map(describeGuard).join(" and ")}</dd>
          </>
        ) : null}
        <dt className="font-mono text-[0.6875rem] font-semibold text-[#047857]">Then</dt>
        <dd className="m-0 text-[#09090B]">{rule.effects.map(describeEffect).join(", ")}</dd>
      </dl>

      {editing ? (
        <div className="mt-2 space-y-1.5">
          <label htmlFor={editorId} className="block font-mono text-[0.6875rem] text-[#52525B]">
            Rule JSON (sanitized on apply)
          </label>
          <textarea
            id={editorId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            spellCheck={false}
            data-testid={`rule-json-${rule.id}`}
            className="w-full rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-2 font-mono text-[0.6875rem] text-[#09090B] focus-visible:outline-2 focus-visible:outline-[#2563EB]"
          />
          {error ? (
            <p role="alert" className="m-0 text-[0.6875rem] text-[#B91C1C]">
              {error}
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const problem = onApplyJson(draft);
                setError(problem);
                if (!problem) setEditing(false);
              }}
              className="min-h-[28px] cursor-pointer rounded-md bg-[#09090B] px-2.5 text-[0.6875rem] font-medium text-white hover:bg-[#18181B]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="min-h-[28px] cursor-pointer rounded-md border border-[#E4E4E7] bg-white px-2.5 text-[0.6875rem] font-medium text-[#52525B]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(JSON.stringify(rule, null, 2));
            setError(null);
            setEditing(true);
          }}
          className="mt-2 min-h-[26px] cursor-pointer rounded-md border border-[#E4E4E7] bg-white px-2 text-[0.6875rem] font-medium text-[#52525B] hover:text-[#09090B]"
        >
          Edit JSON
        </button>
      )}
    </li>
  );
};

/**
 * Slide-over rule inspector: "When → If → Then" view of every rule with live enable
 * toggles and JSON editing (re-sanitized on apply), plus the Master Prompt Audit.
 */
export const RuleInspectorDrawer: React.FC<RuleInspectorDrawerProps> = ({
  isOpen,
  onClose,
  rules,
  onChangeRules,
  firedCounts,
  selectedElementKey = null,
  onClearSelection,
  audit = null,
  preservedConstraints = [],
  fuzzReport = null,
}) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [issues, setIssues] = useState<readonly GraphIssue[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visible = selectedElementKey
    ? rules.filter((r) => referencesElement(r, selectedElementKey))
    : rules;

  const replaceRule = (id: string, next: unknown): readonly GraphIssue[] => {
    const merged = rules.map((r) => (r.id === id ? next : r));
    const result = onChangeRules(sanitizeInteractionRules(merged).rules);
    setIssues(result);
    return result;
  };

  const deadRules = audit?.deadRules ?? fuzzReport?.deadRules ?? [];
  const constraints = audit?.preservedConstraints ?? preservedConstraints;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-testid="rule-inspector-drawer"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[#E4E4E7] bg-[#FAFAFA] shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#E4E4E7] bg-white px-4 py-3">
        <div>
          <h2 id={titleId} className="m-0 text-sm font-semibold text-[#09090B]">
            Rule inspector
          </h2>
          <p className="m-0 text-xs text-[#52525B]">
            {rules.length} rules · When trigger → If guards → Then effects
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          data-testid="close-rule-inspector-btn"
          className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2 text-xs font-medium text-[#52525B] hover:text-[#09090B]"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Close
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {selectedElementKey ? (
          <p className="m-0 flex items-center justify-between gap-2 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1.5 text-xs text-[#1D4ED8]">
            <span>
              Rules for <code>{selectedElementKey}</code>: {visible.length}
            </span>
            {onClearSelection ? (
              <button type="button" onClick={onClearSelection} className="cursor-pointer text-[0.6875rem] font-medium underline">
                Show all
              </button>
            ) : null}
          </p>
        ) : null}

        {issues.length > 0 ? (
          <ul role="alert" className="m-0 list-none space-y-1 rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-2.5 text-[0.6875rem] text-[#92400E]">
            {issues.slice(0, 6).map((issue, i) => (
              <li key={`${issue.code}-${i}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}

        <ul className="m-0 list-none space-y-2 p-0">
          {visible.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              fired={firedCounts[rule.id] ?? 0}
              onToggle={(enabled) => replaceRule(rule.id, { ...rule, enabled })}
              onApplyJson={(json) => {
                let parsed: unknown;
                try {
                  parsed = JSON.parse(json);
                } catch (err) {
                  return `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`;
                }
                const check = sanitizeInteractionRules([parsed]);
                if (check.rules.length === 0) {
                  return check.issues[0]?.message ?? "The rule failed validation.";
                }
                replaceRule(rule.id, check.rules[0]);
                return null;
              }}
            />
          ))}
          {visible.length === 0 ? (
            <li className="text-xs text-[#71717A]">No rules reference this element.</li>
          ) : null}
        </ul>

        <section data-testid="master-prompt-audit" className="space-y-2 rounded-lg border border-[#E4E4E7] bg-white p-3 text-xs">
          <h3 className="m-0 text-xs font-semibold text-[#09090B]">
            {audit ? "Master Prompt Audit" : "Behavior audit"}
          </h3>
          {audit ? (
            <>
              <p className="m-0 text-[#52525B]">
                Sections mapped to rules: {audit.mappedSections.length} of {audit.promptSections.length}
              </p>
              {audit.unmappedSections.length > 0 ? (
                <p className="m-0 text-[#92400E]">Not mapped: {audit.unmappedSections.join(", ")}</p>
              ) : null}
            </>
          ) : (
            <p className="m-0 text-[#52525B]">
              Load a Master Prompt (.md) to see which sections became rules. Dead rules come from the latest fuzz run.
            </p>
          )}

          <div>
            <p className="m-0 font-medium text-[#09090B]">Preserved non-UI constraints ({constraints.length})</p>
            {constraints.length === 0 ? (
              <p className="m-0 text-[#71717A]">None.</p>
            ) : (
              <ul className="m-0 list-disc space-y-1 pl-4 text-[#52525B]">
                {constraints.map((c) => (
                  <li key={c.id}>
                    <span className="font-mono text-[0.6875rem]">{c.id}</span> ({c.category}): {c.requirement}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="m-0 font-medium text-[#09090B]">Dead rules ({deadRules.length})</p>
            {deadRules.length === 0 ? (
              <p className="m-0 text-[#71717A]">{fuzzReport || audit ? "Every enabled rule fired at least once." : "Run Verify Winnability to check."}</p>
            ) : (
              <ul data-testid="dead-rule-list" className="m-0 list-disc space-y-1 pl-4 text-[#92400E]">
                {deadRules.map((r) => (
                  <li key={r.id}>
                    {r.label} <span className="font-mono text-[0.6875rem]">({r.id})</span>
                    {r.sourceSection ? ` from ${r.sourceSection}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
};
