import React, { useMemo } from "react";
import {
  scopeTemplateCss,
  type TemplateThemeConfig,
} from "@genui-studio/templates";

// Optional Vite raw glob for instant HMR when editing Mode A/Mode B theme.css files
const LIVE_THEME_CSS_MODULES: Record<string, string> =
  typeof import.meta.glob === "function"
    ? (import.meta.glob("../../../packages/templates/src/**/theme.css", {
        query: "?raw",
        import: "default",
        eager: true,
      }) as Record<string, string>)
    : {};

function resolveLiveThemeCss(slug: string, fallbackCss: string): string {
  for (const [modPath, cssContent] of Object.entries(LIVE_THEME_CSS_MODULES)) {
    if (
      modPath.endsWith(`/${slug}/theme.css`) &&
      typeof cssContent === "string"
    ) {
      return cssContent;
    }
  }
  return fallbackCss;
}

export interface ScopedTemplateContainerProps {
  readonly slug: string;
  readonly themeCss: string;
  readonly theme: TemplateThemeConfig;
  readonly colorSchemeOverride?: "dark" | "light";
  readonly children: React.ReactNode;
}

/**
 * Strictly isolates a Mode A or Mode B website's fonts, color tokens, border radii,
 * and dark/light color-scheme inside `[data-template-theme="<slug>"]` so nothing
 * bleeds into the Studio Hub shell.
 */
export const ScopedTemplateContainer: React.FC<
  ScopedTemplateContainerProps
> = ({ slug, themeCss, theme, colorSchemeOverride, children }) => {
  const effectiveScheme = colorSchemeOverride ?? theme.defaultColorScheme;

  const scopedCss = useMemo(() => {
    const rawCss = resolveLiveThemeCss(slug, themeCss);
    return scopeTemplateCss(rawCss, slug, theme, {
      colorSchemeOverride: effectiveScheme,
    });
  }, [slug, themeCss, theme, effectiveScheme]);

  return (
    <div
      data-template-theme={slug}
      data-color-scheme={effectiveScheme}
      data-testid={`scoped-template-${slug}`}
      className="w-full min-h-full"
      style={
        {
          colorScheme: `only ${effectiveScheme}`,
          backgroundColor: theme.surfaceBg,
          color: theme.textColor,
          fontFamily: theme.bodyFont,
          "--tpl-bg": theme.surfaceBg,
          "--tpl-surface": theme.surfaceElevated ?? theme.surfaceBg,
          "--tpl-fg": theme.textColor,
          "--tpl-muted": theme.mutedColor ?? theme.textColor,
          "--tpl-accent": theme.accentColor,
          "--tpl-font-display": theme.displayFont,
          "--tpl-font-body": theme.bodyFont,
          "--tpl-radius": theme.borderRadius,
        } as React.CSSProperties
      }
    >
      <style data-template-style={slug}>{scopedCss}</style>
      {children}
    </div>
  );
};
