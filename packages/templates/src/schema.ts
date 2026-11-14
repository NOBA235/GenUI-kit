import { z } from "zod";

export const TemplateThemeSchema = z.object({
  defaultColorScheme: z.enum(["dark", "light"]),
  accentColor: z.string().min(1),
  surfaceBg: z.string().min(1),
  surfaceElevated: z.string().optional(),
  textColor: z.string().min(1),
  mutedColor: z.string().optional(),
  displayFont: z.string().min(1),
  bodyFont: z.string().min(1),
  borderRadius: z.string().min(1),
});

export const TemplatePageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  route: z.string().min(1),
  description: z.string().optional(),
  sections: z.array(z.string().min(1)).min(1),
});

export const TemplateRemixPresetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  prompt: z.string().min(1),
  patchesJsonl: z.string().optional(),
});

export const StandaloneProjectMetaSchema = z.object({
  sourceDir: z.string().min(1),
  framework: z.enum(["nextjs-app", "nextjs-pages", "react-vite", "react"]),
  packageName: z.string().min(1),
  entryFiles: z.array(z.string()),
  detectedPages: z.array(z.string()),
  detectedSections: z.array(z.string()),
  fileCount: z.number().int().nonnegative(),
  ingestedAt: z.string().min(1),
});

export const TemplateManifestSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  mode: z.enum(["native", "standalone"]),
  version: z.string().min(1),
  author: z.string().min(1),
  license: z.enum(["MIT", "Commercial-Single", "Commercial-Team"]),
  tier: z.enum(["free", "pro"]),
  priceUsd: z.number().nonnegative(),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)),
  verified: z.boolean(),
  immersiveExperience: z.boolean().optional(),
  theme: TemplateThemeSchema,
  pages: z.array(TemplatePageSchema).min(1),
  remixPresets: z.array(TemplateRemixPresetSchema).optional(),
  dependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()),
  standaloneMeta: StandaloneProjectMetaSchema.optional(),
});

export function validateTemplateSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(
      `Invalid template slug "${slug}". Use lowercase kebab-case (e.g. "ai-saas-landing").`,
    );
  }
  return normalized;
}
