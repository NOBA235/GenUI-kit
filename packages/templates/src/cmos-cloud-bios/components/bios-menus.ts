import {
  CACHE_TIERS,
  CPU_MULTIPLIERS,
  DRIVE_CAPACITIES_GB,
  DRIVE_TYPES,
  ECC_MODES,
  FSB_CLOCKS_MHZ,
  IRQ_LINES,
  PCI_CLOCKS_MHZ,
  PCI_DEVICES,
  PCI_SLOT_COUNT,
  PEAK_FACTORS,
  POWER_MODES,
  RAID_MODES,
  RAID_READ_REPLICAS,
  REGION_BY_TIME_ZONE,
  STANDBY_TIMERS_MIN,
  SYSTEM_RAM_MB,
  THROTTLE_TEMPS_C,
  TIME_ZONES,
  VECTOR_MODES,
  WATCHDOG_TIMEOUTS_SEC,
  DRIVE_SPECS,
  CACHE_SPECS,
  coreClockMhz,
  maxInstancesForVoltage,
  targetUtilizationForFan,
  perClientRpsForThrottle,
  vcpuForCoreMhz,
  type CloudTopology,
  type CmosConfig,
  type CmosTelemetry,
  type PciSlot,
  type RegisterPath,
} from "../lib/cmos/engine.js";
import type { BoardPart, MenuId } from "./cmos-store.js";

export interface BiosOption {
  readonly value: string | number;
  readonly label: string;
}

export interface BiosContext {
  readonly config: CmosConfig;
  readonly topology: CloudTopology;
  readonly telemetry: CmosTelemetry;
}

export interface BiosSelectRow {
  readonly kind: "select";
  readonly id: string;
  readonly label: string;
  readonly part: BoardPart;
  readonly help: string;
  readonly options: readonly BiosOption[];
  readonly get: (config: CmosConfig) => string | number;
  readonly set: (config: CmosConfig, value: string | number) => { readonly path: RegisterPath; readonly value: unknown };
}

export interface BiosInfoRow {
  readonly kind: "info";
  readonly id: string;
  readonly label: string;
  readonly part: BoardPart;
  readonly help: string;
  readonly read: (ctx: BiosContext) => string;
}

export type BiosRow = BiosSelectRow | BiosInfoRow;

export interface BiosMenu {
  readonly id: MenuId;
  readonly title: string;
  readonly part: BoardPart;
  readonly summary: string;
  readonly rows: readonly BiosRow[];
}

const opts = <T extends string | number>(values: readonly T[], label: (v: T) => string): BiosOption[] =>
  values.map((value) => ({ value, label: label(value) }));

const select = (row: Omit<BiosSelectRow, "kind">): BiosSelectRow => ({ kind: "select", ...row });
const info = (row: Omit<BiosInfoRow, "kind">): BiosInfoRow => ({ kind: "info", ...row });

/** Index of the current value, or of the nearest numeric option when the value is off-list. */
export function optionIndex(row: BiosSelectRow, config: CmosConfig): number {
  const current = row.get(config);
  const exact = row.options.findIndex((o) => o.value === current);
  if (exact >= 0 || typeof current !== "number") return Math.max(0, exact);
  let best = 0;
  row.options.forEach((o, i) => {
    if (typeof o.value === "number" && Math.abs(o.value - current) < Math.abs(Number(row.options[best]!.value) - current)) best = i;
  });
  return best;
}

export function displayValue(row: BiosSelectRow, config: CmosConfig): string {
  const current = row.get(config);
  return row.options.find((o) => o.value === current)?.label ?? String(current);
}

function slotPatch(config: CmosConfig, index: number, patch: Partial<PciSlot>) {
  const slots = config.bus.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot));
  return { path: "bus.slots" as const, value: slots };
}

const DEVICE_LABELS: Readonly<Record<(typeof PCI_DEVICES)[number], string>> = {
  empty: "Empty",
  "api-gateway": "API Gateway (Throttle)",
  "edge-middleware": "Edge Middleware + WAF",
  "webhook-queue": "Webhook Queue (Stripe/SQS)",
};

const BUDGET_STEPS = [25, 50, 100, 250, 500, 750, 1000, 1500, 2500, 5000, 10000, 25000, 30000, 50000] as const;
const FAN_STEPS = [1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600, 3900, 4200, 4500, 4800, 5100, 5400, 5700, 6000] as const;
const RPS_STEPS = [1, 2, 5, 10, 20, 40, 80, 120, 250, 500, 1000, 3000, 10000, 50000] as const;
const VOLTAGE_STEPS = Array.from({ length: 17 }, (_, i) => 2800 + i * 50);

/** AWS published monthly-uptime SLAs multiplied across the serving path. */
export function compositeSlaPct(t: CloudTopology): number {
  let sla = 0.9995 * 0.9995; // Lambda x HTTP API
  if (t.database) sla *= t.database.multiAz ? 0.9995 : 0.995;
  if (t.cache) sla *= 0.999;
  if (t.edge) sla *= 0.999;
  return Math.round(sla * 100000) / 1000;
}

export const BIOS_MENUS: readonly BiosMenu[] = [
  {
    id: "standard",
    title: "STANDARD CLOUD CMOS FEATURES",
    part: "nvme",
    summary: "Region, database drive, replicas, cache tier",
    rows: [
      select({
        id: "timeZone",
        label: "Time Zone (Edge Region)",
        part: "battery",
        help: "Sets the AWS region, Vercel function region and regional price level.",
        options: opts(TIME_ZONES, (tz) => `${tz} ${REGION_BY_TIME_ZONE[tz].awsRegion}`),
        get: (c) => c.standard.timeZone,
        set: (_c, v) => ({ path: "standard.timeZone", value: v }),
      }),
      select({
        id: "primaryMaster",
        label: "IDE Primary Master",
        part: "nvme",
        help: "PostgreSQL primary instance class. None runs the app stateless.",
        options: opts(DRIVE_TYPES, (d) => (d === "none" ? "None" : `${DRIVE_SPECS[d].label} ${DRIVE_SPECS[d].rdsClass}`)),
        get: (c) => c.storage.primaryMaster,
        set: (_c, v) => ({ path: "storage.primaryMaster", value: v }),
      }),
      select({
        id: "capacity",
        label: "Primary Master Capacity",
        part: "nvme",
        help: "Allocated gp3 storage for the primary and each replica.",
        options: opts(DRIVE_CAPACITIES_GB, (gb) => `${gb} GB`),
        get: (c) => c.storage.capacityGb,
        set: (_c, v) => ({ path: "storage.capacityGb", value: v }),
      }),
      select({
        id: "raid",
        label: "RAID Mode (Read Replicas)",
        part: "nvme",
        help: "RAID 1/5/10 add 1/2/3 streaming read replicas. RAID 0 stripes IOPS with no redundancy.",
        options: opts(RAID_MODES, (r) => (r === "none" ? "Disabled" : `${r.toUpperCase()} (${RAID_READ_REPLICAS[r]} replica)`)),
        get: (c) => c.storage.raid,
        set: (_c, v) => ({ path: "storage.raid", value: v }),
      }),
      select({
        id: "secondaryMaster",
        label: "IDE Secondary Master",
        part: "cache",
        help: "Redis cache tier. Higher tiers raise the cache hit ratio and offload PostgreSQL.",
        options: opts(CACHE_TIERS, (t) => (t === "none" ? "None" : `Redis ${t.toUpperCase()} ${CACHE_SPECS[t].node}`)),
        get: (c) => c.storage.secondaryMaster,
        set: (_c, v) => ({ path: "storage.secondaryMaster", value: v }),
      }),
      info({
        id: "sla",
        label: "Composite Uptime SLA",
        part: "overview",
        help: "Product of AWS published SLAs for each service on the request path.",
        read: ({ topology }) => `${compositeSlaPct(topology).toFixed(3)}%`,
      }),
    ],
  },
  {
    id: "chipset",
    title: "ADVANCED CHIPSET & SERVERLESS",
    part: "cpu",
    summary: "vCPU multiplier, memory bus, pre-warming, timeouts",
    rows: [
      select({
        id: "fsb",
        label: "CPU External Clock",
        part: "cpu",
        help: "Front-side bus. Core clock = FSB x multiplier, which sets vCPU per instance.",
        options: opts(FSB_CLOCKS_MHZ, (v) => `${v} MHz`),
        get: (c) => c.cpu.fsbMhz,
        set: (_c, v) => ({ path: "cpu.fsbMhz", value: v }),
      }),
      select({
        id: "multiplier",
        label: "CPU Clock Multiplier",
        part: "cpu",
        help: "Raises core clock, vCPU and per-instance concurrency. Needs more Vcore to stay stable.",
        options: opts(CPU_MULTIPLIERS, (v) => `${v.toFixed(1)}x`),
        get: (c) => c.cpu.multiplier,
        set: (_c, v) => ({ path: "cpu.multiplier", value: v }),
      }),
      info({
        id: "coreClock",
        label: "Core Clock / vCPU",
        part: "cpu",
        help: "Derived: core MHz, vCPU per instance and concurrent requests per instance.",
        read: ({ config, topology }) =>
          `${coreClockMhz(config.cpu)}MHz = ${vcpuForCoreMhz(coreClockMhz(config.cpu))} vCPU x${topology.compute.concurrencyPerInstance}`,
      }),
      select({
        id: "vcore",
        label: "CPU Vcore (Autoscale Max)",
        part: "vrm",
        help: "Each +0.10 V doubles the autoscaling ceiling. More voltage means more heat.",
        options: VOLTAGE_STEPS.map((mv) => ({ value: mv, label: `${(mv / 1000).toFixed(2)}V ${maxInstancesForVoltage(mv)} inst` })),
        get: (c) => c.cpu.coreVoltageMv,
        set: (_c, v) => ({ path: "cpu.coreVoltageMv", value: v }),
      }),
      select({
        id: "ram",
        label: "DRAM Size (Memory Bus)",
        part: "ram",
        help: "Function memory = RAM x 32. Below 512 MB, garbage collection slows each request.",
        options: opts(SYSTEM_RAM_MB, (mb) => `${mb}MB = ${mb * 32}MB fn`),
        get: (c) => c.memory.systemRamMb,
        set: (_c, v) => ({ path: "memory.systemRamMb", value: v }),
      }),
      select({
        id: "ecc",
        label: "ECC Memory Mode",
        part: "ram",
        help: "ECC enables data checksums and backups. Patrol scrub adds Multi-AZ and synchronous replicas.",
        options: opts(ECC_MODES, (m) => (m === "disabled" ? "Disabled" : m === "ecc" ? "ECC" : "ECC + Scrub")),
        get: (c) => c.memory.ecc,
        set: (_c, v) => ({ path: "memory.ecc", value: v }),
      }),
      select({
        id: "powerMode",
        label: "Cold-Start Pre-Warming",
        part: "vrm",
        help: "Disabled keeps all average-load instances warm. Max Saving scales to zero.",
        options: opts(POWER_MODES, (m) => (m === "disabled" ? "Always Warm" : m === "min-saving" ? "Half Warm" : "Scale To Zero")),
        get: (c) => c.power.mode,
        set: (_c, v) => ({ path: "power.mode", value: v }),
      }),
      select({
        id: "standby",
        label: "Standby Timer (Scale-In)",
        part: "vrm",
        help: "Idle minutes before scaling in. Longer timers cost more but cause fewer cold starts.",
        options: opts(STANDBY_TIMERS_MIN, (m) => `${m} Min`),
        get: (c) => c.power.standbyMin,
        set: (_c, v) => ({ path: "power.standbyMin", value: v }),
      }),
      select({
        id: "watchdog",
        label: "CPU Watchdog (Timeout)",
        part: "cpu",
        help: "Function timeout and Vercel maxDuration.",
        options: opts(WATCHDOG_TIMEOUTS_SEC, (s) => `${s} Sec`),
        get: (c) => c.power.watchdogSec,
        set: (_c, v) => ({ path: "power.watchdogSec", value: v }),
      }),
    ],
  },
  {
    id: "peripherals",
    title: "INTEGRATED PERIPHERALS & IRQ",
    part: "pcie",
    summary: "PCI slot devices and IRQ routing",
    rows: [
      ...Array.from({ length: PCI_SLOT_COUNT }, (_, i) => [
        select({
          id: `slot${i + 1}Device`,
          label: `PCI Slot ${i + 1} Device`,
          part: "pcie",
          help: "Gateway = stage throttling. Edge = CDN + WAF + security headers. Webhook = queue + worker.",
          options: opts(PCI_DEVICES, (d) => DEVICE_LABELS[d]),
          get: (c) => c.bus.slots[i]?.device ?? "empty",
          set: (c, v) => slotPatch(c, i, { device: v as PciSlot["device"] }),
        }),
        select({
          id: `slot${i + 1}Irq`,
          label: `PCI Slot ${i + 1} IRQ`,
          part: "pcie",
          help: "IRQ 14/15 belong to the IDE channels. Sharing a line costs latency and stability.",
          options: [{ value: "auto", label: "Auto" }, ...opts(IRQ_LINES, (l) => `IRQ ${l}`)],
          get: (c) => c.bus.slots[i]?.irq ?? "auto",
          set: (c, v) => slotPatch(c, i, { irq: v as PciSlot["irq"] }),
        }),
      ]).flat(),
      info({
        id: "irqStatus",
        label: "IRQ Routing Status",
        part: "pcie",
        help: "Live PnP resolution of every slot and IDE channel.",
        read: ({ topology }) =>
          topology.irq.conflicts.length === 0
            ? topology.irq.assignments.filter((a) => a.irq !== null).map((a) => `${a.slot}:IRQ${a.irq}`).join(" ") || "No devices"
            : `CONFLICT ${topology.irq.conflicts.map((c) => `IRQ${c.irq}`).join(" ")}`,
      }),
    ],
  },
  {
    id: "power",
    title: "POWER & FINOPS BUDGET MANAGEMENT",
    part: "battery",
    summary: "Spend cap, auto-throttle, DDoS breaker",
    rows: [
      select({
        id: "budget",
        label: "Hard Spend Cap",
        part: "battery",
        help: "Monthly AWS Budget. Exceeding it fails POST and sounds the alarm.",
        options: opts(BUDGET_STEPS, (v) => `$${v.toLocaleString("en-US")}/mo`),
        get: (c) => c.power.budgetCapUsd,
        set: (_c, v) => ({ path: "power.budgetCapUsd", value: v }),
      }),
      select({
        id: "fan",
        label: "CPU Fan (Auto-Throttle)",
        part: "cpu",
        help: "Faster fans scale out earlier: lower target utilization, cooler and faster, more instances.",
        options: FAN_STEPS.map((rpm) => ({ value: rpm, label: `${rpm} RPM ${Math.round(targetUtilizationForFan(rpm) * 100)}%` })),
        get: (c) => c.health.fanRpm,
        set: (_c, v) => ({ path: "health.fanRpm", value: v }),
      }),
      select({
        id: "throttle",
        label: "CPU Warning Temp",
        part: "cpu",
        help: "Thermal breaker and per-client DDoS limit: (C - 50) x 3 requests/sec per IP.",
        options: opts(THROTTLE_TEMPS_C, (c) => `${c}C ${perClientRpsForThrottle(c)} rps/IP`),
        get: (c) => c.health.throttleC,
        set: (_c, v) => ({ path: "health.throttleC", value: v }),
      }),
      info({
        id: "burn",
        label: "Estimated Monthly Burn",
        part: "battery",
        help: "List-price estimate across compute, data, network and edge. Not a quote.",
        read: ({ telemetry }) => `$${telemetry.monthlyCostUsd.toFixed(2)} (${Math.round(telemetry.budgetUsage * 100)}% of cap)`,
      }),
    ],
  },
  {
    id: "pnp",
    title: "PnP / PCIe AI ACCELERATOR CONFIG",
    part: "pcie",
    summary: "Bus throughput, vector index, inference load",
    rows: [
      select({
        id: "pciClock",
        label: "PCI Bus Clock",
        part: "pcie",
        help: "Gateway throughput: each gateway slot passes MHz x 120 requests/sec.",
        options: opts(PCI_CLOCKS_MHZ, (v) => `${v} MHz ${v * 120} rps/slot`),
        get: (c) => c.bus.pciClockMhz,
        set: (_c, v) => ({ path: "bus.pciClockMhz", value: v }),
      }),
      select({
        id: "vector",
        label: "IDE Primary Slave (Vector)",
        part: "nvme",
        help: "pgvector index on the primary. Requires a Primary Master drive.",
        options: opts(VECTOR_MODES, (v) => (v === "none" ? "Disabled" : "pgvector Index")),
        get: (c) => c.storage.primarySlave,
        set: (_c, v) => ({ path: "storage.primarySlave", value: v }),
      }),
      select({
        id: "rps",
        label: "Inference Request Rate",
        part: "pcie",
        help: "Average requests/sec used for cost and autoscaling.",
        options: opts(RPS_STEPS, (v) => `${v.toLocaleString("en-US")} rps`),
        get: (c) => c.workload.averageRps,
        set: (_c, v) => ({ path: "workload.averageRps", value: v }),
      }),
      select({
        id: "peak",
        label: "Token Burst Multiplier",
        part: "pcie",
        help: "Peak traffic = average x burst. Drives P99, thermal load and rejected traffic.",
        options: opts(PEAK_FACTORS, (v) => `${v}x`),
        get: (c) => c.workload.peakFactor,
        set: (_c, v) => ({ path: "workload.peakFactor", value: v }),
      }),
      info({
        id: "throughput",
        label: "Max Throughput",
        part: "pcie",
        help: "Lowest of compute, database, gateway and thermal capacity.",
        read: ({ telemetry }) => `${telemetry.maxRps.toLocaleString("en-US")} rps (${telemetry.bottleneck.toUpperCase()})`,
      }),
    ],
  },
  {
    id: "compiler",
    title: "ACOUSTIC MODEM & IaC COMPILER",
    part: "overview",
    summary: "docker-compose.yml, vercel.json, main.tf, FSK modem",
    rows: [],
  },
];

export function getMenu(id: string | null | undefined): BiosMenu | undefined {
  return BIOS_MENUS.find((m) => m.id === id);
}
