// Classic JSX runtime: the bundle then needs only the "react" specifier, which the Crew host
// provides through its import map alongside @kirocrew/app-sdk.
import React, { useEffect, useState } from "react";
import { useAppApi, useAppEvents, useChatLauncher } from "@kirocrew/app-sdk";
import { Card, CardTitle, PageHeader, StatCard } from "@kirocrew/app-sdk/ui";

const AUDIT_CRON = "chimera-bottleneck-audit";
const MAX_EVENTS = 8;

interface CronSummary {
  readonly found: boolean;
  readonly enabled: boolean | null;
  readonly schedule: string;
}

/** The /api/crons response shape is not documented, so read only the fields this page needs. */
function findAuditCron(payload: unknown): CronSummary {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (Object.values(payload as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? []
      : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const job = item as Record<string, unknown>;
    const name = typeof job.name === "string" ? job.name : "";
    if (!name.endsWith(AUDIT_CRON)) continue;
    const enabled = typeof job.enabled === "boolean" ? job.enabled : null;
    const schedule = typeof job.cron_expr === "string" ? job.cron_expr : "0 */6 * * *";
    return { found: true, enabled, schedule };
  }
  return { found: false, enabled: null, schedule: "0 */6 * * *" };
}

function describeEvent(event: unknown): string {
  if (event && typeof event === "object") {
    const e = event as Record<string, unknown>;
    for (const key of ["title", "message", "text", "body"]) {
      if (typeof e[key] === "string" && e[key]) return String(e[key]).slice(0, 160);
    }
  }
  return "Notification received";
}

export default function ChimeraLabPage() {
  const api = useAppApi();
  const { openChat } = useChatLauncher();
  const [cron, setCron] = useState<CronSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<readonly string[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .get<unknown>("/api/crons")
      .then((payload) => {
        if (alive) setCron(findAuditCron(payload));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not read cron jobs");
      });
    return () => {
      alive = false;
    };
  }, [api]);

  useAppEvents("notification", (event) => {
    setEvents((prev) => [describeEvent(event), ...prev].slice(0, MAX_EVENTS));
  });

  const status = cron === null ? "Loading" : !cron.found ? "Not registered" : cron.enabled === false ? "Paused" : "Active";

  const draftAudit = () =>
    openChat({
      agent: "chimera-architect",
      autoSend: false,
      message:
        "Run a CHIMERA bottleneck audit on this project with the bio-query-optimizer skill. Report sequential scans, N+1 loops and missing composite indexes with proposed SQL. Do not apply changes.",
    });

  return (
    <>
      <PageHeader title="CHIMERA // LAB" subtitle="Slow query and N+1 audits, proposed as indexes and batched rewrites" />
      <div className="px-6 pb-8 overflow-y-auto flex-1 min-h-0">
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(160px,1fr))] mb-6">
          <StatCard label="Audit cron" value={status} accent={status === "Active"} />
          <StatCard label="Schedule" value={cron?.schedule ?? "0 */6 * * *"} />
          <StatCard label="Agent" value="chimera-architect" />
        </div>

        <Card>
          <CardTitle>Run an audit now</CardTitle>
          <p className="text-sm text-muted mb-3">
            Opens a draft chat with the chimera-architect agent. Nothing is sent until you press send.
          </p>
          <button type="button" onClick={draftAudit} className="rounded-md border px-3 py-1.5 text-sm">
            Draft audit in chat
          </button>
        </Card>

        {status === "Paused" && (
          <Card>
            <CardTitle>Finish setup</CardTitle>
            <p className="text-sm text-muted">
              Set CHIMERA_PROJECT_DIR (and optionally a read-only CHIMERA_DATABASE_URL) in the gateway environment, then
              resume the {AUDIT_CRON} cron.
            </p>
          </Card>
        )}

        {error && (
          <Card>
            <CardTitle>Cron status unavailable</CardTitle>
            <p className="text-sm text-muted">{error}</p>
          </Card>
        )}

        <Card>
          <CardTitle>Recent notifications</CardTitle>
          {events.length === 0 ? (
            <p className="text-sm text-muted">No notifications since this page opened.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {events.map((text, i) => (
                <li key={`${i}-${text}`}>{text}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// Keep the default React import referenced for the classic JSX runtime used by the Vite build.
void React;
