---
name: "ninety9-archive"
displayName: "NINETY9 — The Monochrome Archive of the 1990s"
description: "1997 NeXT/Macintosh paper-white monochrome editorial publication archiving 34 historical artifacts across 12 sectors with Zod-verified GenUI remixes and deterministic search."
---

# NINETY9 Kiro Power

## Steering Summary
- **Color Budget:** Pure `#FFFFFF` ground, `#000000` ink & 1px/2px brutalist rules, `#D9D9D9` light halftone chrome, `#808080` secondary labels, `#292929` body prose.
- **Data Model:** 34 `ArchiveEntry` records (`ARC-01-*`..`ARC-12-*`), 12 `CategoryManifest` essays, and 1990-1999 `TimelineMilestone` records in `content/` queried through `lib/archive/api.ts`.
- **Verification Hooks:** Run `ninety9.pbt.test.ts` and `ninety9-archive.m1.test.ts` via Vitest to enforce the 5-tone monochrome hex invariant, query determinism, and Zod stream healing.
