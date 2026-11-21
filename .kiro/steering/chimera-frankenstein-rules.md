---
inclusion: fileMatch
fileMatchPattern: "packages/templates/src/neuro-chimera-synth/**"
---

# CHIMERA // LAB Steering (`chimera-frankenstein-rules.md`)

Applies only to CHIMERA // LAB (`packages/templates/src/neuro-chimera-synth/**`). It adds to, and never overrides, `genui-invariants.md`, `spatial-3d-rules.md` and `tech.md`.

## 1. Scope & Isolation
1. Keep every file inside `packages/templates/src/neuro-chimera-synth/`. Do not edit unrelated templates.
2. The template renders at `/preview/neuro-chimera-synth`. All styles stay inside `[data-template-theme="neuro-chimera-synth"]`.
3. WizFrame (`apps/studio-hub`) chrome collapses to a corner bio-tag reading `[ALT+G] WIZFRAME // EXPORT CHIMERA LAB`.

## 2. Bioluminescent Laboratory Palette
1. Use only these colours:
   - Abyssal Void `#020A0E` (background)
   - Bioluminescent Cyan-Emerald `#00F5B8` (healthy flux, primary accent)
   - Neural Synapse Amber `#FFB000` (warnings, synapse firing)
   - Mutation Crimson `#FF2A6D` (faults, full-table scans, severed nodes)
   - Frosted Quartz panels `rgba(2, 18, 24, 0.78)` with `1px solid rgba(0, 245, 184, 0.25)` borders
2. Status must never rely on colour alone. Pair every colour state with a label or icon.
3. Glow and pulse effects stay below 3 flashes per second and stop under `prefers-reduced-motion`.

## 3. Deterministic SQL Analysis
1. `lib/chimera/sql-parser.ts` is a pure, hand-written parser for a documented SELECT subset. No `eval`, `new Function`, regex-based SQL rewriting, or network calls.
2. Unsupported syntax throws `SqlParseError` with a character offset. Never guess at a partial parse.
3. Input is bounded: `MAX_SQL_LENGTH` (8 KB), `MAX_SQL_TOKENS` (2,000) and `MAX_EXPR_DEPTH` (64) stop adversarial input.
4. Rewrites (N+1 batching) go through the AST printer (`printSql`), never through string replacement.
5. `lib/chimera/query-planner.ts` uses fixed PostgreSQL-style cost constants and deterministic join enumeration. The same SQL and table statistics always produce the same plan, cost and `EXPLAIN` text.

## 4. Physarum Solver
1. `lib/chimera/bio-solver.ts` is pure: no `Date`, no `Math.random`, no I/O. Any randomness uses a seeded PRNG passed in by the caller.
2. Conductivity updates use the implicit form `D' = (D + dt·f(|Q|)) / (1 + dt)` so any step size is stable. Conductivity never drops below `MIN_CONDUCTIVITY`, which keeps the Kirchhoff system solvable.
3. Only nodes connected to an alive sink enter the linear solve. Unreachable queries are reported as failed, never as NaN.
4. Graph size is bounded (`MAX_NODES` 64, `MAX_LINKS` 256, `MAX_QUERIES` 32). The shipped scenarios step in under 1 ms. At the bounds one step takes about 10–14 ms (measured median 10.6 ms, p95 13.7 ms), so the UI steps the solver on a timer (10–20 Hz), never inside the render loop.

## 5. 60 FPS Canvas Rendering
1. The network renders on a single 2D `<canvas>` driven by one `requestAnimationFrame` loop. The loop is cancelled on unmount and paused while `document.hidden`.
2. The frame loop allocates nothing: reuse typed arrays and path buffers between frames.
3. React re-renders the HUD at most 10 times per second from throttled telemetry. It never re-renders per frame.
4. DPR is capped at 2. A `ResizeObserver` resizes the canvas.

## 6. Local Optimizer Agent Constellation Compliance
1. All three built-in optimizer agents (`chimera-architect`, `index-surgeon`, `deadlock-hunter`) run deterministically in-memory against the active `PhysarumNetwork` via `components/lab-store.ts` and `components/OptimizerAgentConstellation.tsx`.
2. Agents are read-only with respect to external systems: they mutate only local simulator state and record content-hash checkpoints with suggested Conventional Commit messages.
3. Audit schedule previews use `nextCronRuns()` in `lib/chimera/cron.ts` after client mount to avoid SSR hydration mismatches.

## 7. Sonification
1. `lib/chimera/sonifier.ts` uses only the Web Audio API and no-ops under SSR or without `AudioContext`.
2. Audio starts only after `unlock()` runs inside a user gesture. Mute, master volume and root frequency are always controllable.
3. `mapTelemetryToSound()` is pure. The audio engine only schedules what it returns.
4. Geiger clicks are capped at `MAX_GEIGER_RATE` per second and scheduled with a look-ahead clock, never with per-click timers.
