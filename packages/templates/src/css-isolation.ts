import type {
  ScopedThemeContainerOptions,
  TemplateThemeConfig,
} from "./types.js";

/**
 * Sanitizes template CSS and strictly scopes all selectors inside
 * `[data-template-theme="<slug>"]` so a template's global tokens, fonts,
 * radii, and dark/light color-scheme never bleed into the Studio Hub shell.
 */
export function scopeTemplateCss(
  rawCss: string,
  slug: string,
  theme?: TemplateThemeConfig,
  options: ScopedThemeContainerOptions = {},
): string {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "");
  const scopeSelector = `[data-template-theme="${safeSlug}"]`;
  const scheme = options.colorSchemeOverride ?? theme?.defaultColorScheme ?? "dark";

  // Neutralize any style-tag breakout or unsafe javascript: URL references
  let sanitized = rawCss
    .replace(/<\/style/gi, "/* blocked-style-close */")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/@import\s+["']tailwindcss["']\s*;?/gi, "")
    .replace(/@import\s+url\s*\(\s*["']?javascript:[^)]*\)\s*;?/gi, "");

  // Rewrite global root/document selectors to the scoped container attribute
  sanitized = sanitized
    .replace(/:root\b/g, scopeSelector)
    .replace(/(^|[\s,{])html(?=\s*[,{:])/gim, `$1${scopeSelector}`)
    .replace(/(^|[\s,{])body(?=\s*[,{:])/gim, `$1${scopeSelector}`);

  const baseVarsBlock = theme
    ? `${scopeSelector} {
  color-scheme: only ${scheme};
  --tpl-bg: ${theme.surfaceBg};
  --tpl-surface: ${theme.surfaceElevated ?? theme.surfaceBg};
  --tpl-fg: ${theme.textColor};
  --tpl-muted: ${theme.mutedColor ?? theme.textColor};
  --tpl-accent: ${theme.accentColor};
  --tpl-font-display: ${theme.displayFont};
  --tpl-font-body: ${theme.bodyFont};
  --tpl-radius: ${theme.borderRadius};
  background-color: var(--tpl-bg);
  color: var(--tpl-fg);
  font-family: var(--tpl-font-body);
  accent-color: var(--tpl-accent);
  isolation: isolate;
  contain: layout style;
  container-type: inline-size;
}
`
    : `${scopeSelector} {
  color-scheme: only ${scheme};
  isolation: isolate;
  contain: layout style;
  container-type: inline-size;
}
`;

  const trimmed = sanitized.trim();
  if (!trimmed) {
    return baseVarsBlock;
  }

  // If the template author already wrote @scope ([data-template-theme="..."]),
  // keep it intact alongside the base container token block; otherwise wrap inside @scope
  // so nested selectors obey proximity and cannot leak outside the container.
  const hasExplicitScope = trimmed.includes(`@scope (${scopeSelector})`);
  const hasExplicitAttrPrefix = trimmed.includes(scopeSelector);

  if (hasExplicitScope) {
    return `${baseVarsBlock}\n${trimmed}\n`;
  }

  if (hasExplicitAttrPrefix) {
    return `${baseVarsBlock}\n@scope (${scopeSelector}) {\n${trimmed}\n}\n`;
  }

  return `${baseVarsBlock}\n@scope (${scopeSelector}) {\n${trimmed}\n}\n`;
}

/**
 * Generates an authoritative starter theme.css block strictly scoped to `[data-template-theme="<slug>"]`.
 */
export function generateStarterThemeCss(
  slug: string,
  theme: TemplateThemeConfig,
): string {
  const scopeSelector = `[data-template-theme="${slug}"]`;
  return `/* Scoped Theme Tokens for "${slug}" — strictly isolated to ${scopeSelector} */
${scopeSelector} {
  color-scheme: only ${theme.defaultColorScheme};
  --tpl-bg: ${theme.surfaceBg};
  --tpl-surface: ${theme.surfaceElevated ?? theme.surfaceBg};
  --tpl-fg: ${theme.textColor};
  --tpl-muted: ${theme.mutedColor ?? "#94a3b8"};
  --tpl-accent: ${theme.accentColor};
  --tpl-font-display: ${theme.displayFont};
  --tpl-font-body: ${theme.bodyFont};
  --tpl-radius: ${theme.borderRadius};
  background-color: var(--tpl-bg);
  color: var(--tpl-fg);
  font-family: var(--tpl-font-body);
}

@scope (${scopeSelector}) {
  .tpl-heading {
    font-family: var(--tpl-font-display);
    color: var(--tpl-fg);
  }

  .tpl-card {
    background-color: var(--tpl-surface);
    border-radius: var(--tpl-radius);
    border: 1px solid color-mix(in srgb, var(--tpl-fg) 14%, transparent);
  }

  .tpl-cta {
    background-color: var(--tpl-accent);
    border-radius: var(--tpl-radius);
    color: ${theme.defaultColorScheme === "light" ? "#ffffff" : "#06090f"};
  }
}
`;
}
