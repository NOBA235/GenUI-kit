"""Lifecycle hooks for the CHIMERA // LAB Kiro Crew app.

Declared in app.json as ``backend.hooks.on_startup`` and ``backend.hooks.on_shutdown``.
They run inside the Kiro Crew gateway process when the app is enabled or disabled.

The hooks only check prerequisites and report problems through ``ctx.health``. They start
no background work, so ``on_shutdown`` has nothing to stop.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
UI_BUNDLE = APP_ROOT / "dist" / "index.mjs"


def _mark_degraded(ctx, message: str) -> None:
    health = getattr(ctx, "health", None)
    if health is not None and hasattr(health, "mark_degraded"):
        health.mark_degraded(message)


async def on_startup(ctx) -> None:
    """Report missing prerequisites without blocking the app."""
    if not UI_BUNDLE.is_file():
        _mark_degraded(ctx, "Dashboard bundle dist/index.mjs is missing. Run: cd ui && npm install && npm run build")

    if not os.environ.get("CHIMERA_PROJECT_DIR"):
        _mark_degraded(
            ctx,
            "CHIMERA_PROJECT_DIR is not set. Set it in the gateway environment before resuming the "
            "chimera-bottleneck-audit cron.",
        )

    if os.environ.get("CHIMERA_DATABASE_URL") and shutil.which("psql") is None:
        _mark_degraded(ctx, "CHIMERA_DATABASE_URL is set but psql is not installed, so EXPLAIN checks are skipped.")


async def on_shutdown(ctx) -> None:
    """Nothing to stop: on_startup starts no background work."""
    return None
