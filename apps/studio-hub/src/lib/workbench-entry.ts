/**
 * Entry-point constants for the "Open Sample Wireframe" first-success flow.
 * Kept free of compiler / Excalidraw imports so the marketplace bundle stays small;
 * the sample scene itself lives in `sample-wireframe.ts` (loaded with Wireframe Architect).
 */

/**
 * Template the sample flow opens. It uses the shared showcase catalog
 * (SiteShell, HeroSection, MetricStrip, FeatureGrid) and is free/MIT.
 */
export const SAMPLE_WIREFRAME_SLUG = "product-landing-starter";

/** Fallback when the preferred sample template is not registered. */
export const SAMPLE_WIREFRAME_FALLBACK_SLUG = "saas-dashboard-starter";

/** URL query that opens Wireframe Architect with the sample scene loaded. */
export const SAMPLE_WIREFRAME_QUERY = "wireframe=sample";
