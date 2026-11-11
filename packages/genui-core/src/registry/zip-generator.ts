import JSZip from "jszip";
import type { AgentReadyPackManifest } from "./types.js";

export interface GenerateZipOptions {
  projectName?: string;
  authorName?: string;
  includeNextApp?: boolean;
}

/**
 * Builds a clean, fully configured Next.js 15 + TypeScript + GenUI project bundle as a .ZIP file.
 * Runs in both browser (Uint8Array / Blob) and Node.js environments.
 */
export async function generatePackZip(
  pack: AgentReadyPackManifest,
  options: GenerateZipOptions = {},
): Promise<Uint8Array> {
  const zip = new JSZip();
  const projectName = options.projectName ?? `${pack.name}-template`;

  // 1. package.json
  const packageJson = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "next dev --port 3000",
      build: "next build",
      start: "next start",
      lint: "next lint",
      "test:fuzz": "vitest run",
    },
    dependencies: {
      next: "^15.1.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "@json-render/core": "^0.22.0",
      "@json-render/react": "^0.22.0",
      "@genui-studio/core": "^1.0.0",
      zod: "^4.3.6",
      ...pack.dependencies,
    },
    devDependencies: {
      typescript: "^5.7.2",
      "@types/node": "^22.10.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      tailwindcss: "^4.0.0",
      vitest: "^3.0.0",
      "fast-check": "^4.10.2",
      ...pack.devDependencies,
    },
  };
  zip.file("package.json", JSON.stringify(packageJson, null, 2));

  // 2. tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
  zip.file("tsconfig.json", JSON.stringify(tsconfig, null, 2));

  // 3. next.config.mjs
  zip.file(
    "next.config.mjs",
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@genui-studio/core", "@json-render/core", "@json-render/react"]
};
export default nextConfig;
`,
  );

  // 4. app/layout.tsx & app/globals.css
  zip.file(
    "app/globals.css",
    `@import "tailwindcss";
body {
  background-color: #070B14;
  color: #F8FAFC;
}
`,
  );

  zip.file(
    "app/layout.tsx",
    `import "./globals.css";
export const metadata = {
  title: "${pack.title}",
  description: "${pack.description}"
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#070B14] text-slate-100">{children}</body>
    </html>
  );
}
`,
  );

  // 5. app/page.tsx (Demo preview page)
  zip.file(
    "app/page.tsx",
    `import React from "react";

export default function TemplateShowcase() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <span className="rounded bg-cyan-500/20 px-2.5 py-1 font-mono text-xs text-cyan-300 border border-cyan-500/40">
          ${pack.tier.toUpperCase()} TEMPLATE PACK
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-100">${pack.title}</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl">${pack.description}</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">AI Agent Instructions</h2>
        <p className="text-sm text-slate-300">
          This template includes complete agent skills in <code className="text-cyan-300">SKILL.md</code> and Kiro Powers in <code className="text-cyan-300">.kiro/powers/${pack.id}/POWER.md</code>.
        </p>
        <div className="font-mono text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300">
          Prompt your agent: &quot;Stream the ${pack.title} using the verified catalog in catalog/&quot;
        </div>
      </div>
    </main>
  );
}
`,
  );

  // 6. Included component files and catalog
  for (const f of pack.files) {
    zip.file(f.path, f.content);
  }

  // 7. AI Agent Skills & Kiro Power
  zip.file("SKILL.md", pack.agentSkill.skillMd);
  zip.file(`.claude/skills/${pack.id}/SKILL.md`, pack.agentSkill.skillMd);
  zip.file(`.kiro/powers/${pack.id}/POWER.md`, pack.agentSkill.kiroPowerMd);
  zip.file(
    `.kiro/steering/${pack.id}-rules.md`,
    pack.agentSkill.steeringRules,
  );

  // 8. Invariant fast-check PBT suite
  zip.file("__tests__/invariants.fuzz.test.ts", pack.pbtSuite.code);

  // 9. README.md
  zip.file(
    "README.md",
    `# ${pack.title}

${pack.description}

## Quickstart
\`\`\`bash
# 1. Install dependencies
pnpm install

# 2. Start dev server
pnpm dev

# 3. Run formal property-based test suite
pnpm test:fuzz
\`\`\`

## AI Agent Integration
- **Claude Code / Cursor:** \`SKILL.md\` is included in the project root.
- **Kiro IDE / CLI:** \`.kiro/powers/${pack.id}/POWER.md\` and \`.kiro/steering/${pack.id}-rules.md\` are pre-configured.

Pack generated by **GenUI Studio** (https://genui.studio).
`,
  );

  return zip.generateAsync({ type: "uint8array" });
}
