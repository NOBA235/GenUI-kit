# CHIMERA // LAB — Kiro Crew app

A [Kiro Crew](https://github.com/kirodotdev/KiroCrew) app that audits slow SQL, N+1 query loops and missing composite indexes. It proposes fixes as SQL and code diffs and never applies them on its own.

| Resource | File |
| --- | --- |
| Manifest | `app.json` |
| Agent | `agents/chimera-architect.json` (`model: auto`, `tools: ["@kirocrew-core"]`) |
| Skill | `skills/bio-query-optimizer/SKILL.md` |
| Cron | `chimera-bottleneck-audit`, `0 */6 * * *`, ships paused |
| Dashboard page | `ui/src/App.tsx`, built to `dist/index.mjs` |
| Lifecycle hooks | `backend/hooks.py` (prerequisite checks only) |

## Install
Requires Kiro Crew running (`kirocrew gateway`), plus Node.js 22.12+ and git.

```bash
kirocrew app install /absolute/path/to/kiro-crew-app   # runs: cd ui && npm install && npm run build
```

Before enabling, trust the app. Enabling from the App Store asks you to trust it, or use Settings → Security → Third-party apps. Then:

```bash
kirocrew app enable chimera-lab
```

"Chimera Lab" appears in the dashboard sidebar.

## Configure the audit cron
The cron is registered paused because it needs a target repository first.

1. In the environment that runs `kirocrew gateway`, set:
   - `CHIMERA_PROJECT_DIR`: the repository to audit.
   - `CHIMERA_DATABASE_URL` (optional): a **read-only** PostgreSQL URL. EXPLAIN checks need `psql`.
2. Restart the gateway, then resume `chimera-bottleneck-audit` from the dashboard's cron list.

The lifecycle hooks report a degraded status while `CHIMERA_PROJECT_DIR` is missing or the UI bundle has not been built.

## Run an audit by hand
From the Chimera Lab page, press **Draft audit in chat**. Or ask in any chat:

> Use the chimera-architect agent to audit ~/projects/shop-api for slow queries and N+1 loops.

## Safety
- The agent proposes `CREATE INDEX CONCURRENTLY` statements and batched rewrites. It does not run DDL, migrations or file edits unless you approve that exact change.
- It runs `EXPLAIN` without `ANALYZE` unless it is on a replica or inside `BEGIN; ... ROLLBACK;`.
- `permissions.network` is `false`. The page only reads `/api/crons` and `/api/status` and listens for `notification` events.

## Development
The dashboard page does not install or bundle `@kirocrew/app-sdk` or React; the Crew host provides both through its import map. `ui/src/kirocrew-app-sdk.d.ts` is a small local type subset. To get the full types, replace it with the dashboard's declarations:

```bash
curl --fail -o ui/src/kirocrew-app-sdk.d.ts http://localhost:5476/vendor/kirocrew-app-sdk.d.ts
```

Built to the Kiro Crew App Kit docs: [manifest reference](https://kiro.dev/docs/crew/apps/manifest/) and [getting started](https://github.com/kirodotdev/KiroCrew/blob/main/docs/app-kit/getting-started.md).
