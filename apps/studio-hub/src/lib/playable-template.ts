import {
  generateStarterThemeCss,
  type DualModeTemplateEntry,
  type TemplateManifest,
} from "@genui-studio/templates";
import { playableCatalog } from "../playable/catalog.js";
import { playableRegistry } from "../playable/components.js";
// The exported starter ships the same catalog and component files the workbench renders.
import catalogSource from "../playable/catalog.ts?raw";
import componentsSource from "../playable/components.tsx?raw";
import type { PlayableBlueprint } from "./playable-starter.js";

const THEME: TemplateManifest["theme"] = {
  defaultColorScheme: "dark",
  accentColor: "#F59E0B",
  surfaceBg: "#0B0F14",
  surfaceElevated: "#111821",
  textColor: "#E6EDF3",
  mutedColor: "#9FB0C0",
  displayFont: '"Inter", system-ui, sans-serif',
  bodyFont: '"Inter", system-ui, sans-serif',
  borderRadius: "0.75rem",
};

/**
 * Wraps a playable blueprint as a template entry so `generateTemplateZip` can export it
 * as a runnable Next.js 15 starter. The entry is not registered in the marketplace.
 */
export function createPlayableTemplateEntry(blueprint: PlayableBlueprint): DualModeTemplateEntry {
  const { brief, spec } = blueprint;
  const slug = brief.slug;
  const manifest: TemplateManifest = {
    slug,
    id: slug,
    name: slug,
    title: brief.title,
    description: brief.elevatorPitch,
    mode: "native",
    version: "1.0.0",
    author: "GenUI Studio",
    license: "MIT",
    tier: "free",
    priceUsd: 0,
    category: "Playable",
    tags: ["GenUI Verified"],
    verified: true,
    theme: THEME,
    pages: [
      { id: "home", slug: "home", title: brief.title, route: "/", sections: [spec.root] },
    ],
    dependencies: {},
    devDependencies: {},
  };

  const skillMd = `# ${brief.title}

${brief.elevatorPitch}

- Core loop: ${brief.coreLoop}
- Win: ${brief.winCondition ?? "not specified"}
- Lose: ${brief.loseCondition ?? "not specified"}

\`app/page.tsx\` renders \`src/template/wireframe.spec.json\` and runs its interaction rules through
\`createInteractionRuleEngine\` on the store the renderer reads. Change behavior by editing the
rules in that file (they are re-sanitized at load) or re-export from GenUI Studio.
`;

  return {
    manifest,
    catalog: playableCatalog,
    registry: playableRegistry,
    pageSpecs: { home: spec },
    initialState: (spec.state ?? {}) as Record<string, unknown>,
    themeCss: generateStarterThemeCss(slug, THEME),
    steeringMd: `# ${brief.title} steering\n\n${brief.aestheticDirection}\n\nKeep every interaction going through the rule engine; components hold no domain state.\n`,
    skillMd,
    kiroPowerMd: `# ${brief.title}\n\nPlayable GenUI starter exported from GenUI Studio. See SKILL.md.\n`,
    sourceFiles: [
      { path: "catalog.ts", content: catalogSource, kind: "catalog" },
      { path: "components.tsx", content: componentsSource, kind: "component" },
    ],
  };
}
