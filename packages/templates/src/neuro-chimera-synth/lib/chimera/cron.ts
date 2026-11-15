/**
 * Next-run calculator for standard 5-field cron expressions (`lib/chimera/cron.ts`).
 *
 * Supports `*`, numbers, ranges, steps, lists and three-letter month/day names, with the usual
 * rule that day-of-month and day-of-week are OR-ed when both are restricted. It steps minute by
 * minute in the given time zone offset (UTC by default), bounded to one year, which is plenty for
 * dashboard previews.
 */

const FIELD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MAX_MINUTES = 366 * 24 * 60;

function parseValue(token: string, field: number): number {
  const upper = token.toUpperCase();
  if (field === 3 && MONTHS.includes(upper)) return MONTHS.indexOf(upper) + 1;
  if (field === 4 && DAYS.includes(upper)) return DAYS.indexOf(upper);
  if (!/^\d+$/.test(token)) throw new Error(`Invalid cron value ${token}`);
  return Number(token);
}

function parseField(text: string, field: number): Set<number> {
  const [min, max] = FIELD_RANGES[field]!;
  const values = new Set<number>();
  for (const part of text.split(",")) {
    const [base, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron step ${part}`);
    let lo = min;
    let hi = max;
    if (base !== "*") {
      const [a, b] = base!.split("-");
      lo = parseValue(a!, field);
      hi = b === undefined ? (stepText === undefined ? lo : max) : parseValue(b, field);
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`Cron value out of range: ${part}`);
    for (let v = lo; v <= hi; v += step) values.add(field === 4 && v === 7 ? 0 : v);
  }
  return values;
}

export interface CronSchedule {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly daysOfMonth: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly daysOfWeek: ReadonlySet<number>;
  readonly domRestricted: boolean;
  readonly dowRestricted: boolean;
}

export function parseCron(expr: string): CronSchedule {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("Cron expressions need 5 fields");
  return {
    minutes: parseField(fields[0]!, 0),
    hours: parseField(fields[1]!, 1),
    daysOfMonth: parseField(fields[2]!, 2),
    months: parseField(fields[3]!, 3),
    daysOfWeek: parseField(fields[4]!, 4),
    domRestricted: fields[2] !== "*",
    dowRestricted: fields[4] !== "*",
  };
}

function matches(s: CronSchedule, d: Date): boolean {
  if (!s.minutes.has(d.getUTCMinutes()) || !s.hours.has(d.getUTCHours()) || !s.months.has(d.getUTCMonth() + 1)) return false;
  const dom = s.daysOfMonth.has(d.getUTCDate());
  const dow = s.daysOfWeek.has(d.getUTCDay());
  if (s.domRestricted && s.dowRestricted) return dom || dow;
  if (s.domRestricted) return dom;
  if (s.dowRestricted) return dow;
  return true;
}

/**
 * The next `count` run times strictly after `from`. `utcOffsetMinutes` shifts the schedule into
 * a fixed-offset time zone (e.g. -480 for UTC-08:00). Returns fewer runs if none occur within a year.
 */
export function nextCronRuns(expr: string, from: Date, count = 3, utcOffsetMinutes = 0): Date[] {
  const schedule = parseCron(expr);
  const out: Date[] = [];
  const offsetMs = utcOffsetMinutes * 60_000;
  const start = Math.floor((from.getTime() + offsetMs) / 60_000) * 60_000 + 60_000;
  for (let i = 0; i < MAX_MINUTES && out.length < count; i++) {
    const local = new Date(start + i * 60_000);
    if (matches(schedule, local)) out.push(new Date(local.getTime() - offsetMs));
  }
  return out;
}
