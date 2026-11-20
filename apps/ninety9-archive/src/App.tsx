import React, { useEffect, useMemo, useState } from "react";
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

const SLUG = "ninety9-archive";

function resolvePageId(
  pages: readonly { readonly id: string; readonly route: string }[],
  pathname: string,
): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const match = pages.find((p) => p.route === clean || `/${p.id}` === clean);
  if (match) return match.id;
  if (clean.startsWith("/dossier/")) return "archive";
  return pages[0]?.id ?? "home";
}

export interface Ninety9AppProps {
  readonly initialPath?: string;
}

/**
 * Standalone Skeleton Crew Application #1:
 * Mounts the 1997 monochrome archive directly on @genui-studio/core's SafeGenUIRenderer,
 * TimeTravelStateStore, and GuardrailedStreamCompiler without any Studio Hub dependency.
 */
export const App: React.FC<Ninety9AppProps> = ({ initialPath }) => {
  const template = useMemo(() => {
    const entry = getTemplateBySlug(SLUG);
    if (!entry) throw new Error(`Template "${SLUG}" is not registered.`);
    return entry;
  }, []);

  const [pathname, setPathname] = useState<string>(() => {
    if (initialPath !== undefined) return initialPath;
    return typeof window !== "undefined" ? window.location.pathname || "/" : "/";
  });

  useEffect(() => {
    if (typeof window === "undefined" || initialPath !== undefined) return;
    const onPopState = () => setPathname(window.location.pathname || "/");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialPath]);

  const activePageId = resolvePageId(template.manifest.pages, pathname);

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
      template.pageSpecs[activePageId] ?? Object.values(template.pageSpecs)[0];
    if (!baseSpec) return null;
    const compiler = createGuardrailedStreamCompiler({
      catalog: template.catalog,
      telemetryTracker: tracker,
    });
    compiler.push(specToJsonlStream(baseSpec));
    return { ...compiler.finalize().spec };
  }, [template, activePageId, tracker]);

  return (
    <div
      data-template-theme={SLUG}
      data-color-scheme={template.manifest.theme.defaultColorScheme}
      data-testid="standalone-app-ninety9"
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
