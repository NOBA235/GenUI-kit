import React, { useMemo } from "react";
import type { Spec } from "@json-render/core";
import { JSONUIProvider } from "@json-render/react";
import {
  createGuardrailedStreamCompiler,
  createTelemetryTracker,
  createTimeTravelStateStore,
  SafeGenUIRenderer,
  specToJsonlStream,
  wrapRegistryWithTelemetry,
} from "@genui-studio/core";
import { getTemplateBySlug, scopeTemplateCss } from "@genui-studio/templates";

const SLUG = "cmos-cloud-bios";

/**
 * Standalone Skeleton Crew Application #2:
 * Mounts BIOS // NECROMANCER (1994 Award CMOS BIOS + 3D Motherboard Twin + Cloud IaC Compiler)
 * directly on the exact same @genui-studio/core runtime as apps/ninety9-archive and apps/studio-hub.
 */
export const App: React.FC = () => {
  const template = useMemo(() => {
    const entry = getTemplateBySlug(SLUG);
    if (!entry) throw new Error(`Template "${SLUG}" is not registered.`);
    return entry;
  }, []);

  const store = useMemo(
    () => createTimeTravelStateStore(template.initialState ?? {}),
    [template],
  );
  const tracker = useMemo(() => createTelemetryTracker(), []);
  const safeRegistry = useMemo(
    () =>
      wrapRegistryWithTelemetry(template.catalog, template.registry, {
        telemetryTracker: tracker,
        showHealedBadges: true,
      }),
    [template, tracker],
  );

  const scopedCss = useMemo(
    () => scopeTemplateCss(template.themeCss, SLUG, template.manifest.theme),
    [template],
  );

  const spec: Spec | null = useMemo(() => {
    const baseSpec =
      template.pageSpecs.home ?? Object.values(template.pageSpecs)[0];
    if (!baseSpec) return null;
    const compiler = createGuardrailedStreamCompiler({
      catalog: template.catalog,
      telemetryTracker: tracker,
    });
    compiler.push(specToJsonlStream(baseSpec));
    return { ...compiler.finalize().spec };
  }, [template, tracker]);

  return (
    <div
      data-template-theme={SLUG}
      data-color-scheme={template.manifest.theme.defaultColorScheme}
      data-testid="standalone-app-cmos-bios"
      className="min-h-dvh w-full"
      style={
        {
          colorScheme: `only ${template.manifest.theme.defaultColorScheme}`,
          backgroundColor: template.manifest.theme.surfaceBg,
          color: template.manifest.theme.textColor,
          fontFamily: template.manifest.theme.bodyFont,
          "--tpl-bg": template.manifest.theme.surfaceBg,
          "--tpl-surface":
            template.manifest.theme.surfaceElevated ??
            template.manifest.theme.surfaceBg,
          "--tpl-fg": template.manifest.theme.textColor,
          "--tpl-muted":
            template.manifest.theme.mutedColor ??
            template.manifest.theme.textColor,
          "--tpl-accent": template.manifest.theme.accentColor,
          "--tpl-font-display": template.manifest.theme.displayFont,
          "--tpl-font-body": template.manifest.theme.bodyFont,
          "--tpl-radius": template.manifest.theme.borderRadius,
        } as React.CSSProperties
      }
    >
      <style data-template-style={SLUG}>{scopedCss}</style>
      <JSONUIProvider registry={safeRegistry} store={store}>
        <SafeGenUIRenderer
          spec={spec}
          registry={safeRegistry}
          catalog={template.catalog}
          telemetryTracker={tracker}
        />
      </JSONUIProvider>
    </div>
  );
};
