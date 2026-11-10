import React, { Component, type ErrorInfo, type ReactNode } from "react";
import {
  Renderer,
  type ComponentRegistry,
  type ComponentRenderProps,
  type ComponentRenderer,
} from "@json-render/react";
import type { Spec, UIElement } from "@json-render/core";
import { sanitizeSpecGraph } from "../stream/dag-sanitizer.js";
import type { TelemetryTracker } from "../telemetry/telemetry-tracker.js";
import type {
  ElementFaultRecord,
  PropDiagnostic,
  VerifiedCatalog,
} from "../types.js";

export interface DiagnosticBadgeProps {
  readonly elementKey: string;
  readonly componentType: string;
  readonly diagnostics: readonly PropDiagnostic[];
}

/**
 * Inspectable diagnostic badge rendered when an LLM streams a malformed prop,
 * out-of-bounds number, or unresolved state path that was automatically healed
 * at the node boundary.
 */
export function DiagnosticHealedBadge({
  elementKey,
  componentType,
  diagnostics,
}: DiagnosticBadgeProps): React.JSX.Element | null {
  if (diagnostics.length === 0) return null;

  return (
    <div
      data-genui-diagnostic-badge="healed"
      data-element-key={elementKey}
      data-component-type={componentType}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 8px",
        marginBottom: "4px",
        fontSize: "11px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        lineHeight: 1.4,
        color: "#F59E0B",
        backgroundColor: "rgba(245, 158, 11, 0.10)",
        border: "1px solid rgba(245, 158, 11, 0.30)",
        borderRadius: "4px",
      }}
      title={diagnostics
        .map((d) => `[${d.status.toUpperCase()}] ${d.propName}: ${d.reason}`)
        .join("\n")}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "9999px",
          backgroundColor: "#F59E0B",
          display: "inline-block",
        }}
      />
      <span>
        HEALED {componentType} ({diagnostics.length}{" "}
        {diagnostics.length === 1 ? "prop" : "props"})
      </span>
    </div>
  );
}

export interface ElementFaultCardProps {
  readonly elementKey: string;
  readonly componentType: string;
  readonly phase: ElementFaultRecord["phase"];
  readonly message: string;
  readonly diagnostics?: readonly PropDiagnostic[];
  readonly children?: ReactNode;
}

/**
 * High-craft developer telemetry fault card rendered when an individual UIElement
 * fails unrecoverably or throws during React rendering. Never crashes parent or sibling nodes.
 */
export function ElementFaultCard({
  elementKey,
  componentType,
  phase,
  message,
  diagnostics,
  children,
}: ElementFaultCardProps): React.JSX.Element {
  return (
    <div
      role="alert"
      data-genui-fault-card="true"
      data-element-key={elementKey}
      data-component-type={componentType}
      data-fault-phase={phase}
      style={{
        padding: "10px 12px",
        borderRadius: "6px",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.35)",
        color: "#FCA5A5",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "4px",
        }}
      >
        <strong style={{ color: "#EF4444", fontSize: "11px", letterSpacing: "0.04em" }}>
          NODE QUARANTINED · {componentType}
        </strong>
        <span
          style={{
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: "3px",
            backgroundColor: "rgba(239, 68, 68, 0.18)",
            color: "#FECACA",
          }}
        >
          {phase} · #{elementKey}
        </span>
      </div>
      <div style={{ color: "#E4E4E7", fontSize: "11px", wordBreak: "break-word" }}>
        {message}
      </div>
      {diagnostics && diagnostics.length > 0 && (
        <ul
          style={{
            margin: "6px 0 0 0",
            paddingLeft: "16px",
            fontSize: "11px",
            color: "#F87171",
          }}
        >
          {diagnostics.map((d, idx) => (
            <li key={`${d.propName}-${idx}`}>
              <code>{d.propName}</code>: {d.reason}
            </li>
          ))}
        </ul>
      )}
      {children && <div style={{ marginTop: "8px" }}>{children}</div>}
    </div>
  );
}

interface BoundaryProps {
  readonly elementKey: string;
  readonly componentType: string;
  readonly propsSignature: string;
  readonly telemetryTracker?: TelemetryTracker;
  readonly onElementFault?: (fault: ElementFaultRecord) => void;
  readonly fallbackChildren?: ReactNode;
  readonly children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
  errorMessage: string;
  lastPropsSignature: string;
}

/**
 * Granular React Error Boundary that wraps a single catalog element.
 * Automatically resets when `propsSignature` changes (e.g. when a subsequent stream patch repairs the element).
 */
export class GenUIElementErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      lastPropsSignature: props.propsSignature,
    };
  }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : String(error ?? "Render error"),
    };
  }

  static getDerivedStateFromProps(
    nextProps: BoundaryProps,
    prevState: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (nextProps.propsSignature !== prevState.lastPropsSignature) {
      return {
        hasError: false,
        errorMessage: "",
        lastPropsSignature: nextProps.propsSignature,
      };
    }
    return null;
  }

  override componentDidCatch(error: unknown, _errorInfo: ErrorInfo): void {
    const message =
      error instanceof Error ? error.message : String(error ?? "Render error");
    const fault: ElementFaultRecord = {
      id: `${this.props.elementKey}-${Date.now()}`,
      elementKey: this.props.elementKey,
      componentType: this.props.componentType,
      phase: "react_render",
      message,
      timestamp: Date.now(),
    };
    this.props.telemetryTracker?.recordElementFault(fault);
    this.props.onElementFault?.(fault);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ElementFaultCard
          elementKey={this.props.elementKey}
          componentType={this.props.componentType}
          phase="react_render"
          message={this.state.errorMessage}
        >
          {this.props.fallbackChildren}
        </ElementFaultCard>
      );
    }
    return this.props.children;
  }
}

export interface WrapRegistryOptions {
  /** TelemetryTracker to receive live prop healing and boundary fault metrics */
  readonly telemetryTracker?: TelemetryTracker;
  /** Whether to show visual DiagnosticHealedBadge above elements whose props were auto-healed (default: true) */
  readonly showHealedBadges?: boolean;
  /** Callback when an element fails schema validation or throws during render */
  readonly onElementFault?: (fault: ElementFaultRecord) => void;
}

/**
 * Wraps every component in a `@json-render/react` `ComponentRegistry` with:
 * 1. Pre-render Zod schema validation & deterministic prop healing (catching NaN, out-of-bounds numbers,
 *    unresolved `$state` paths, and invalid enums).
 * 2. Inspectable `<DiagnosticHealedBadge />` when props are healed.
 * 3. Per-element `<GenUIElementErrorBoundary>` isolation so a throwing component never crashes the parent tree.
 */
export function wrapRegistryWithTelemetry(
  verifiedCatalog: VerifiedCatalog<any, any>,
  registry: ComponentRegistry,
  options: WrapRegistryOptions = {},
): ComponentRegistry {
  const showHealedBadges = options.showHealedBadges ?? true;
  const wrappedRegistry: ComponentRegistry = {};

  let nodeCounter = 0;

  for (const [compName, OriginalComponent] of Object.entries(registry)) {
    const SafeWrappedComponent: ComponentRenderer<any> = (
      renderProps: ComponentRenderProps<any>,
    ) => {
      const rawElement = renderProps.element ?? {
        type: compName,
        props: {},
      };
      const elementKey =
        ((rawElement as unknown as Record<string, unknown>).key as string | undefined) ??
        `${compName}-${++nodeCounter}`;

      const rawProps =
        rawElement.props &&
        typeof rawElement.props === "object" &&
        !Array.isArray(rawElement.props)
          ? (rawElement.props as Record<string, unknown>)
          : {};

      const validation = verifiedCatalog.validateAndHealProps(
        elementKey,
        compName,
        rawProps,
      );

      if (
        validation.healedCount > 0 ||
        validation.rejectedCount > 0 ||
        Object.keys(rawProps).length > 0
      ) {
        options.telemetryTracker?.recordPropEvaluation({
          evaluated: Math.max(1, Object.keys(rawProps).length),
          healed: validation.healedCount,
          rejected: validation.rejectedCount,
          diagnostics: validation.diagnostics,
        });
      }

      if (!validation.ok) {
        const fault: ElementFaultRecord = {
          id: `${elementKey}-schema`,
          elementKey,
          componentType: compName,
          phase: "schema_validation",
          message:
            validation.diagnostics[0]?.reason ??
            `Props for ${compName} failed catalog schema validation.`,
          diagnostics: validation.diagnostics,
          timestamp: Date.now(),
        };
        options.telemetryTracker?.recordElementFault(fault);
        options.onElementFault?.(fault);

        return (
          <ElementFaultCard
            elementKey={elementKey}
            componentType={compName}
            phase="schema_validation"
            message={fault.message}
            diagnostics={validation.diagnostics}
          >
            {renderProps.children}
          </ElementFaultCard>
        );
      }

      const healedElement: UIElement = {
        ...rawElement,
        props: validation.props,
      };

      let propsSignature = compName;
      try {
        propsSignature = JSON.stringify(validation.props);
      } catch {
        propsSignature = `${compName}-dynamic`;
      }

      const healedDiagnostics = validation.diagnostics.filter(
        (d) => d.status === "healed",
      );

      let renderedSubtree: ReactNode;
      try {
        const callable = OriginalComponent as unknown as (
          p: ComponentRenderProps<any>,
        ) => ReactNode;
        renderedSubtree = callable({
          ...renderProps,
          element: healedElement,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err ?? "Render error");
        const fault: ElementFaultRecord = {
          id: `${elementKey}-sync-render`,
          elementKey,
          componentType: compName,
          phase: "react_render",
          message,
          timestamp: Date.now(),
        };
        options.telemetryTracker?.recordElementFault(fault);
        options.onElementFault?.(fault);

        return (
          <ElementFaultCard
            elementKey={elementKey}
            componentType={compName}
            phase="react_render"
            message={message}
          >
            {renderProps.children}
          </ElementFaultCard>
        );
      }

      return (
        <GenUIElementErrorBoundary
          elementKey={elementKey}
          componentType={compName}
          propsSignature={propsSignature}
          telemetryTracker={options.telemetryTracker}
          onElementFault={options.onElementFault}
          fallbackChildren={renderProps.children}
        >
          {showHealedBadges && healedDiagnostics.length > 0 && (
            <DiagnosticHealedBadge
              elementKey={elementKey}
              componentType={compName}
              diagnostics={healedDiagnostics}
            />
          )}
          {renderedSubtree}
        </GenUIElementErrorBoundary>
      );
    };

    SafeWrappedComponent.displayName = `GenUISafe(${compName})`;
    wrappedRegistry[compName] = SafeWrappedComponent;
  }

  return wrappedRegistry;
}

export interface SafeGenUIRendererProps {
  readonly spec: Spec | null;
  readonly registry: ComponentRegistry;
  readonly catalog?: VerifiedCatalog<any, any>;
  readonly loading?: boolean;
  readonly telemetryTracker?: TelemetryTracker;
}

/**
 * Fallback renderer for unknown/unregistered component types so an LLM hallucinating
 * `<FancyNonExistentWidget />` degrades to a telemetry card instead of vanishing silently or crashing.
 */
export const DefaultUnknownComponentFallback: ComponentRenderer = ({
  element,
  children,
}) => {
  return (
    <ElementFaultCard
      elementKey="unknown"
      componentType={element?.type ?? "UnknownComponent"}
      phase="schema_validation"
      message={`Hallucinated component type "${element?.type ?? "Unknown"}" is not registered in the active catalog.`}
    >
      {children}
    </ElementFaultCard>
  );
};

/**
 * Drop-in safe wrapper around `@json-render/react`'s `<Renderer />`.
 * Automatically sanitizes the Spec DAG before rendering so cyclic specs can never trigger
 * a React Maximum Call Stack Size Exceeded crash.
 */
export function SafeGenUIRenderer({
  spec,
  registry,
  catalog,
  loading,
  telemetryTracker,
}: SafeGenUIRendererProps): React.JSX.Element | null {
  if (!spec || !spec.root) {
    return null;
  }

  const sanitized = sanitizeSpecGraph(spec, {
    pruneMissingChildren: !loading,
    ...(catalog
      ? { allowedComponents: catalog.metadata.componentNames }
      : {}),
  });

  if (sanitized.severedCyclesCount > 0 && telemetryTracker) {
    telemetryTracker.recordChunkPass({
      charsCount: 0,
      appliedPatchesCount: 0,
      rejectedPatchesCount: 0,
      validationLatencyMs: 0,
      evaluatedPropsDelta: 0,
      healedPropsDelta: sanitized.healedNumbersCount,
      rejectedPropsDelta: sanitized.blockedPathsCount,
      severedCyclesDelta: sanitized.severedCyclesCount,
      issues: sanitized.inspection.issues,
    });
  }

  return (
    <Renderer
      spec={sanitized.spec}
      registry={registry}
      loading={loading}
      fallback={DefaultUnknownComponentFallback}
    />
  );
}
