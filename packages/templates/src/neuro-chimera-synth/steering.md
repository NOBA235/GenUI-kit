# CHIMERA // LAB (`neuro-chimera-synth`) — Template Steering

- **Mode:** Mode A native website inside WizFrame, previewed at `/preview/neuro-chimera-synth`.
- **Spec:** `.kiro/specs/neuro-chimera-synth/` (`requirements.md`, `design.md`, `tasks.md`).
- **Scoped rules:** `.kiro/steering/chimera-frankenstein-rules.md`.
- **State:** `components/lab-store.ts` owns the live `PhysarumNetwork` and the lab UI state. Components read it through `useLab` and change it only through the store's actions.
- **Engine:** `lib/chimera/` is pure: SQL parser, cost planner, Physarum solver, scenarios, benchmarks, cron preview and the sonification mapping. No `Date`, `Math.random`, `eval` or network calls.
- **Rendering:** one 2D canvas and one `requestAnimationFrame` loop for the network, with preallocated buffers. The solver steps on a timer (at most 10 store publishes per second), never inside the render loop.
- **Visuals:** bioluminescent palette only (`#020A0E #00F5B8 #FFB000 #FF2A6D`, quartz panels `rgba(2, 18, 24, 0.78)` with `1px solid rgba(0, 245, 184, 0.25)` borders). Every colour state also has a label or icon. Pulses stay under 3 per second and stop under reduced motion.
- **Safety:** streamed props are Zod validated and healed. Chemotaxis packets with unknown nodes, invalid strengths or unparsable SQL are quarantined. No raw HTML or `eval`.
