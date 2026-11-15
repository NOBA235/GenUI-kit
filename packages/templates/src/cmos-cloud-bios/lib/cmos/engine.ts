/**
 * BIOS // NECROMANCER — Cloud-to-CMOS State Engine (`lib/cmos/engine.ts`)
 *
 * The pure, deterministic core of the `cmos-cloud-bios` template:
 * 1. A Zod-validated CMOS register schema (Award Modular BIOS v4.51PG style setup pages).
 * 2. Register -> cloud topology mapping, plus the inverse cloud -> CMOS patch.
 * 3. A cost / P99 latency / max RPS / thermal / stability simulator.
 * 4. POST diagnostics with Award-style beep codes.
 * 5. A BIOS setup state machine (`cmosReducer`) and a battery-backed vanilla store.
 *
 * No Date, no randomness, no I/O outside the injectable persistence adapter: the same
 * CmosConfig always yields identical telemetry. Prices are approximate public on-demand
 * list prices (us-east-1, 2025) for relative estimates only. They are not quotes.
 */

import { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";

/* ═══════════════════════════ 1. Register option tables ═══════════════════════════ */

export const FSB_CLOCKS_MHZ = [50, 60, 66, 75, 83, 100] as const;
export const CPU_MULTIPLIERS = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] as const;
export const SYSTEM_RAM_MB = [4, 8, 16, 32, 64, 128] as const;
export const ECC_MODES = ["disabled", "ecc", "ecc-scrub"] as const;
export const DRIVE_TYPES = ["none", "ide-hdd", "scsi", "nvme"] as const;
export const DRIVE_CAPACITIES_GB = [20, 50, 100, 250, 500, 1000] as const;
export const RAID_MODES = ["none", "raid0", "raid1", "raid5", "raid10"] as const;
export const VECTOR_MODES = ["none", "pgvector"] as const;
export const CACHE_TIERS = ["none", "0.5gb", "1.5gb", "3gb", "6gb"] as const;
export const PCI_CLOCKS_MHZ = [25, 30, 33, 37, 41] as const;
export const PCI_DEVICES = ["empty", "api-gateway", "edge-middleware", "webhook-queue"] as const;
export const IRQ_LINES = [3, 4, 5, 7, 9, 10, 11, 12, 14, 15] as const;
export const PCI_SLOT_COUNT = 4;
export const POWER_MODES = ["disabled", "min-saving", "max-saving"] as const;
export const STANDBY_TIMERS_MIN = [1, 2, 4, 8, 15, 30, 60] as const;
export const WATCHDOG_TIMEOUTS_SEC = [10, 15, 30, 60, 120, 300] as const;
export const THROTTLE_TEMPS_C = [60, 65, 70, 75, 80, 85, 90] as const;
export const PEAK_FACTORS = [1, 1.5, 2, 3, 4, 6, 8, 10] as const;
export const VCPU_ALLOCATIONS = [0.25, 0.5, 1, 2, 4] as const;

export const CORE_VOLTAGE_MV = { min: 2800, max: 3600, step: 50 } as const;
export const FAN_RPM = { min: 1200, max: 6000, step: 100 } as const;
export const BUDGET_CAP_USD = { min: 25, max: 50000, step: 25 } as const;
export const AVERAGE_RPS = { min: 1, max: 50000 } as const;

export type FsbClockMhz = (typeof FSB_CLOCKS_MHZ)[number];
export type CpuMultiplier = (typeof CPU_MULTIPLIERS)[number];
export type SystemRamMb = (typeof SYSTEM_RAM_MB)[number];
export type EccMode = (typeof ECC_MODES)[number];
export type DriveType = (typeof DRIVE_TYPES)[number];
export type RaidMode = (typeof RAID_MODES)[number];
export type CacheTier = (typeof CACHE_TIERS)[number];
export type PciDevice = (typeof PCI_DEVICES)[number];
export type IrqLine = (typeof IRQ_LINES)[number];
export type PowerMode = (typeof POWER_MODES)[number];
export type WatchdogTimeoutSec = (typeof WATCHDOG_TIMEOUTS_SEC)[number];
export type Vcpu = (typeof VCPU_ALLOCATIONS)[number];

/** Standard CMOS "Time Zone" doubles as the deployment region. */
export const TIME_ZONES = [
  "UTC-08:00",
  "UTC-05:00",
  "UTC-03:00",
  "UTC+00:00",
  "UTC+01:00",
  "UTC+05:30",
  "UTC+08:00",
  "UTC+09:00",
  "UTC+10:00",
] as const;
export type TimeZone = (typeof TIME_ZONES)[number];

export const AWS_REGIONS = [
  "us-west-2",
  "us-east-1",
  "sa-east-1",
  "eu-west-2",
  "eu-central-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "ap-southeast-2",
] as const;
export type AwsRegion = (typeof AWS_REGIONS)[number];

export interface RegionSpec {
  readonly timeZone: TimeZone;
  readonly awsRegion: AwsRegion;
  /** Vercel compute region id (https://vercel.com/docs/regions). */
  readonly vercelRegion: string;
  readonly city: string;
  /** Approximate price level relative to us-east-1. */
  readonly priceMultiplier: number;
}

export const REGION_BY_TIME_ZONE: Readonly<Record<TimeZone, RegionSpec>> = {
  "UTC-08:00": { timeZone: "UTC-08:00", awsRegion: "us-west-2", vercelRegion: "pdx1", city: "Portland", priceMultiplier: 1.0 },
  "UTC-05:00": { timeZone: "UTC-05:00", awsRegion: "us-east-1", vercelRegion: "iad1", city: "Washington, D.C.", priceMultiplier: 1.0 },
  "UTC-03:00": { timeZone: "UTC-03:00", awsRegion: "sa-east-1", vercelRegion: "gru1", city: "Sao Paulo", priceMultiplier: 1.5 },
  "UTC+00:00": { timeZone: "UTC+00:00", awsRegion: "eu-west-2", vercelRegion: "lhr1", city: "London", priceMultiplier: 1.1 },
  "UTC+01:00": { timeZone: "UTC+01:00", awsRegion: "eu-central-1", vercelRegion: "fra1", city: "Frankfurt", priceMultiplier: 1.15 },
  "UTC+05:30": { timeZone: "UTC+05:30", awsRegion: "ap-south-1", vercelRegion: "bom1", city: "Mumbai", priceMultiplier: 1.1 },
  "UTC+08:00": { timeZone: "UTC+08:00", awsRegion: "ap-southeast-1", vercelRegion: "sin1", city: "Singapore", priceMultiplier: 1.2 },
  "UTC+09:00": { timeZone: "UTC+09:00", awsRegion: "ap-northeast-1", vercelRegion: "hnd1", city: "Tokyo", priceMultiplier: 1.25 },
  "UTC+10:00": { timeZone: "UTC+10:00", awsRegion: "ap-southeast-2", vercelRegion: "syd1", city: "Sydney", priceMultiplier: 1.25 },
};

/* ═══════════════════════════ 2. Zod register schema ═══════════════════════════ */

const steppedInt = (range: { readonly min: number; readonly max: number; readonly step: number }) =>
  z.number().int().min(range.min).max(range.max).multipleOf(range.step);

export const PciSlotSchema = z.strictObject({
  device: z.enum(PCI_DEVICES),
  irq: z.union([z.literal("auto"), z.literal(IRQ_LINES)]),
});

const CONFIG_GROUP_SCHEMAS = {
  standard: z.strictObject({ timeZone: z.enum(TIME_ZONES) }),
  cpu: z.strictObject({
    fsbMhz: z.literal(FSB_CLOCKS_MHZ),
    multiplier: z.literal(CPU_MULTIPLIERS),
    coreVoltageMv: steppedInt(CORE_VOLTAGE_MV),
  }),
  memory: z.strictObject({
    systemRamMb: z.literal(SYSTEM_RAM_MB),
    ecc: z.enum(ECC_MODES),
  }),
  storage: z.strictObject({
    primaryMaster: z.enum(DRIVE_TYPES),
    capacityGb: z.literal(DRIVE_CAPACITIES_GB),
    raid: z.enum(RAID_MODES),
    primarySlave: z.enum(VECTOR_MODES),
    secondaryMaster: z.enum(CACHE_TIERS),
  }),
  bus: z.strictObject({
    pciClockMhz: z.literal(PCI_CLOCKS_MHZ),
    slots: z.array(PciSlotSchema).length(PCI_SLOT_COUNT),
  }),
  power: z.strictObject({
    mode: z.enum(POWER_MODES),
    standbyMin: z.literal(STANDBY_TIMERS_MIN),
    watchdogSec: z.literal(WATCHDOG_TIMEOUTS_SEC),
    budgetCapUsd: steppedInt(BUDGET_CAP_USD),
  }),
  health: z.strictObject({
    fanRpm: steppedInt(FAN_RPM),
    throttleC: z.literal(THROTTLE_TEMPS_C),
  }),
  workload: z.strictObject({
    averageRps: z.number().int().min(AVERAGE_RPS.min).max(AVERAGE_RPS.max),
    peakFactor: z.literal(PEAK_FACTORS),
  }),
} as const;

export const CmosConfigSchema = z.strictObject(CONFIG_GROUP_SCHEMAS).superRefine((cfg, ctx) => {
  if (cfg.storage.primaryMaster !== "none") return;
  if (cfg.storage.raid !== "none") {
    ctx.addIssue({
      code: "custom",
      path: ["storage", "raid"],
      message: "RAID needs a Primary Master drive (PostgreSQL primary) to replicate.",
    });
  }
  if (cfg.storage.primarySlave !== "none") {
    ctx.addIssue({
      code: "custom",
      path: ["storage", "primarySlave"],
      message: "Vector storage (pgvector) needs a Primary Master drive.",
    });
  }
});

export type CmosConfig = z.infer<typeof CmosConfigSchema>;
export type PciSlot = z.infer<typeof PciSlotSchema>;
type GroupKey = keyof CmosConfig;

/** Every editable register, addressed as `"group.field"` (e.g. `"cpu.multiplier"`). */
export type RegisterPath = {
  [G in GroupKey]: `${G}.${Extract<keyof CmosConfig[G], string>}`;
}[GroupKey];

export type RegisterValue<P extends RegisterPath> = P extends `${infer G extends GroupKey}.${infer F}`
  ? F extends keyof CmosConfig[G]
    ? CmosConfig[G][F]
    : never
  : never;

export const REGISTER_PATHS: readonly RegisterPath[] = Object.entries(CONFIG_GROUP_SCHEMAS).flatMap(
  ([group, schema]) => Object.keys(schema.shape).map((field) => `${group}.${field}` as RegisterPath),
);
const REGISTER_PATH_SET: ReadonlySet<string> = new Set(REGISTER_PATHS);

export function isRegisterPath(value: unknown): value is RegisterPath {
  return typeof value === "string" && REGISTER_PATH_SET.has(value);
}

/* ═══════════════════════════ 3. Utilities & checksum ═══════════════════════════ */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** JSON with recursively sorted keys, so equal configs always serialize identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/** 32-bit FNV-1a hash as 8 uppercase hex digits. */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/** The "CMOS checksum" printed on POST screens and in every compiled artifact header. */
export function cmosChecksum(config: CmosConfig): string {
  return fnv1a32(canonicalJson(config));
}

export interface CmosIssue {
  readonly path: string;
  readonly message: string;
}

export type ConfigValidation =
  | { readonly ok: true; readonly config: CmosConfig }
  | { readonly ok: false; readonly issues: readonly CmosIssue[] };

/** Validate untrusted input and return a deeply frozen config. */
export function validateConfig(input: unknown): ConfigValidation {
  const result = CmosConfigSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    };
  }
  return { ok: true, config: deepFreeze(result.data) };
}

/* ═══════════════════════════ 4. Defaults ═══════════════════════════ */

/** Award "LOAD SETUP DEFAULTS": balanced production profile. */
export const SETUP_DEFAULTS: CmosConfig = deepFreeze({
  standard: { timeZone: "UTC-05:00" },
  cpu: { fsbMhz: 66, multiplier: 3, coreVoltageMv: 3250 },
  memory: { systemRamMb: 16, ecc: "ecc" },
  storage: { primaryMaster: "ide-hdd", capacityGb: 50, raid: "raid1", primarySlave: "none", secondaryMaster: "0.5gb" },
  bus: {
    pciClockMhz: 33,
    slots: [
      { device: "api-gateway", irq: "auto" },
      { device: "edge-middleware", irq: "auto" },
      { device: "webhook-queue", irq: "auto" },
      { device: "empty", irq: "auto" },
    ],
  },
  power: { mode: "min-saving", standbyMin: 15, watchdogSec: 30, budgetCapUsd: 750 },
  health: { fanRpm: 3000, throttleC: 75 },
  workload: { averageRps: 40, peakFactor: 3 },
});

/** Award "LOAD BIOS DEFAULTS": fail-safe profile. Slow, cool, always-on, fully redundant. */
export const BIOS_DEFAULTS: CmosConfig = deepFreeze({
  standard: { timeZone: "UTC-05:00" },
  cpu: { fsbMhz: 50, multiplier: 2, coreVoltageMv: 3000 },
  memory: { systemRamMb: 8, ecc: "ecc-scrub" },
  storage: { primaryMaster: "ide-hdd", capacityGb: 20, raid: "raid1", primarySlave: "none", secondaryMaster: "none" },
  bus: {
    pciClockMhz: 33,
    slots: [
      { device: "api-gateway", irq: "auto" },
      { device: "empty", irq: "auto" },
      { device: "empty", irq: "auto" },
      { device: "empty", irq: "auto" },
    ],
  },
  power: { mode: "disabled", standbyMin: 30, watchdogSec: 30, budgetCapUsd: 500 },
  health: { fanRpm: 6000, throttleC: 70 },
  workload: { averageRps: 40, peakFactor: 3 },
});

/* ═══════════════════════════ 5. Hardware -> cloud mapping tables ═══════════════════════════ */

export interface DriveSpec {
  readonly label: string;
  readonly rdsClass: string;
  readonly hourlyUsd: number;
  readonly baseLatencyMs: number;
  readonly nodeQps: number;
  readonly composeCpus: number;
  readonly composeMemoryMb: number;
}

export const DRIVE_SPECS: Readonly<Record<Exclude<DriveType, "none">, DriveSpec>> = {
  "ide-hdd": { label: "IDE HDD ATA-2", rdsClass: "db.t4g.medium", hourlyUsd: 0.065, baseLatencyMs: 14, nodeQps: 900, composeCpus: 2, composeMemoryMb: 4096 },
  scsi: { label: "SCSI-2 FAST", rdsClass: "db.m6g.large", hourlyUsd: 0.152, baseLatencyMs: 7, nodeQps: 2600, composeCpus: 2, composeMemoryMb: 8192 },
  nvme: { label: "M.2 NVMe", rdsClass: "db.r6g.xlarge", hourlyUsd: 0.45, baseLatencyMs: 2.5, nodeQps: 9000, composeCpus: 4, composeMemoryMb: 16384 },
};

export interface CacheSpec {
  readonly node: string;
  readonly memoryMb: number;
  readonly hourlyUsd: number;
  readonly hitRatio: number;
}

export const CACHE_SPECS: Readonly<Record<Exclude<CacheTier, "none">, CacheSpec>> = {
  "0.5gb": { node: "cache.t4g.micro", memoryMb: 512, hourlyUsd: 0.016, hitRatio: 0.55 },
  "1.5gb": { node: "cache.t4g.small", memoryMb: 1536, hourlyUsd: 0.032, hitRatio: 0.72 },
  "3gb": { node: "cache.t4g.medium", memoryMb: 3072, hourlyUsd: 0.065, hitRatio: 0.82 },
  "6gb": { node: "cache.m6g.large", memoryMb: 6144, hourlyUsd: 0.149, hitRatio: 0.9 },
};

export const RAID_READ_REPLICAS: Readonly<Record<RaidMode, number>> = {
  none: 0,
  raid0: 0,
  raid1: 1,
  raid5: 2,
  raid10: 3,
};

export const PRICING = {
  hoursPerMonth: 730,
  secondsPerMonth: 2_628_000,
  computeVcpuHour: 0.04048,
  computeGbHour: 0.004445,
  requestsPerMillion: 0.2,
  httpApiPerMillion: 1.0,
  cdnPerMillion: 1.0,
  wafPerMillion: 0.6,
  wafAclMonthly: 5,
  wafRuleMonthly: 1,
  sqsPerMillion: 0.4,
  lambdaGbSecond: 0.0000166667,
  rdsGp3GbMonth: 0.115,
  natGatewayHour: 0.045,
  secretMonthly: 0.4,
  webhookShare: 0.05,
  workerDurationSec: 0.2,
  workerMemoryGb: 0.5,
} as const;

export function coreClockMhz(cpu: CmosConfig["cpu"]): number {
  return round(cpu.fsbMhz * cpu.multiplier, 1);
}

export function vcpuForCoreMhz(coreMhz: number): Vcpu {
  if (coreMhz <= 100) return 0.25;
  if (coreMhz <= 150) return 0.5;
  if (coreMhz <= 250) return 1;
  if (coreMhz <= 400) return 2;
  return 4;
}

/** Vcore sets the autoscaling ceiling: 2.80 V = 4 instances, doubling every +0.10 V. */
export function maxInstancesForVoltage(coreVoltageMv: number): number {
  return Math.round(4 * 2 ** ((coreVoltageMv - CORE_VOLTAGE_MV.min) / 100));
}

/** Voltage a core clock needs to run stable (2.80 V at 75 MHz up to 3.60 V at 600 MHz). */
export function requiredVoltageMv(coreMhz: number): number {
  return Math.round(2800 + (800 * (clamp(coreMhz, 75, 600) - 75)) / 525);
}

/** Faster fans scale out earlier: 1200 rpm = 85% target utilization, 6000 rpm = 40%. */
export function targetUtilizationForFan(fanRpm: number): number {
  return round(0.85 - (0.45 * (fanRpm - FAN_RPM.min)) / (FAN_RPM.max - FAN_RPM.min), 3);
}

/** CPU warning temperature becomes the per-client DDoS circuit breaker (requests/sec per IP). */
export function perClientRpsForThrottle(throttleC: number): number {
  return (throttleC - 50) * 3;
}

/* ═══════════════════════════ 6. IRQ routing (PnP resolver) ═══════════════════════════ */

export interface IrqAssignment {
  readonly slot: number;
  readonly device: PciDevice;
  readonly requested: "auto" | IrqLine;
  readonly irq: IrqLine | null;
}

export interface IrqConflict {
  readonly irq: IrqLine;
  readonly holders: readonly string[];
}

export interface IrqRouting {
  readonly assignments: readonly IrqAssignment[];
  readonly conflicts: readonly IrqConflict[];
  readonly conflictCount: number;
}

const AUTO_IRQ_ORDER: readonly IrqLine[] = [9, 10, 11, 12, 5, 7, 3, 4, 15, 14];

export function resolveIrqRouting(config: CmosConfig): IrqRouting {
  const holders = new Map<IrqLine, string[]>();
  const reserve = (irq: IrqLine, holder: string) => {
    const list = holders.get(irq) ?? [];
    list.push(holder);
    holders.set(irq, list);
  };
  if (config.storage.primaryMaster !== "none") reserve(14, "IDE PRIMARY (POSTGRES)");
  if (config.storage.secondaryMaster !== "none") reserve(15, "IDE SECONDARY (REDIS)");

  const resolved = new Map<number, IrqLine>();
  config.bus.slots.forEach((slot, i) => {
    if (slot.device !== "empty" && slot.irq !== "auto") {
      reserve(slot.irq, `PCI${i + 1} ${slot.device.toUpperCase()}`);
      resolved.set(i, slot.irq);
    }
  });
  config.bus.slots.forEach((slot, i) => {
    if (slot.device !== "empty" && slot.irq === "auto") {
      const irq = AUTO_IRQ_ORDER.find((line) => !holders.has(line)) ?? AUTO_IRQ_ORDER[0]!;
      reserve(irq, `PCI${i + 1} ${slot.device.toUpperCase()}`);
      resolved.set(i, irq);
    }
  });

  const conflicts: IrqConflict[] = [...holders.entries()]
    .filter(([, list]) => list.length > 1)
    .sort(([a], [b]) => a - b)
    .map(([irq, list]) => ({ irq, holders: [...list] }));

  return {
    assignments: config.bus.slots.map((slot, i) => ({
      slot: i + 1,
      device: slot.device,
      requested: slot.irq,
      irq: resolved.get(i) ?? null,
    })),
    conflicts,
    conflictCount: conflicts.reduce((sum, c) => sum + c.holders.length - 1, 0),
  };
}

/* ═══════════════════════════ 7. Cloud topology ═══════════════════════════ */

export interface ComputeTopology {
  readonly coreMhz: number;
  readonly vcpu: Vcpu;
  readonly memoryMb: number;
  /** Lambda allocates CPU by memory (1769 MB = 1 vCPU), so memory is raised to cover the vCPU. */
  readonly lambdaMemoryMb: number;
  readonly vercelFunctionCpu: "standard" | "performance";
  readonly concurrencyPerInstance: number;
  readonly minWarmInstances: number;
  readonly maxInstances: number;
  readonly targetUtilization: number;
  readonly timeoutSec: WatchdogTimeoutSec;
  readonly scaleInCooldownSec: number;
  readonly reservedConcurrency: number;
  readonly provisionedConcurrency: number;
}

export interface DatabaseTopology {
  readonly drive: Exclude<DriveType, "none">;
  readonly spec: DriveSpec;
  readonly storageGb: number;
  readonly raid: RaidMode;
  readonly readReplicas: number;
  readonly multiAz: boolean;
  readonly dataChecksums: boolean;
  readonly synchronousReplication: boolean;
  readonly backupRetentionDays: number;
  readonly vector: boolean;
}

export interface CacheTopology {
  readonly tier: Exclude<CacheTier, "none">;
  readonly spec: CacheSpec;
  /** Redis `maxmemory` for Compose: 75% of the node so overhead fits inside the limit. */
  readonly maxMemoryMb: number;
}

export interface GatewayTopology {
  readonly slots: number;
  readonly rateLimitRps: number;
  readonly burstLimit: number;
}

export interface EdgeTopology {
  readonly slots: number;
  readonly perClientRps: number;
  readonly wafLimitPer5Min: number;
}

export interface QueueTopology {
  readonly slots: number;
  readonly maxConcurrency: number;
  readonly visibilityTimeoutSec: number;
}

export interface ServiceModel {
  readonly computeMs: number;
  readonly dbMs: number;
  readonly serviceMs: number;
  readonly perInstanceRps: number;
  readonly dbCapacityRps: number | null;
  readonly overheadMs: number;
  readonly coldStartMs: number;
}

export interface CloudTopology {
  readonly checksum: string;
  readonly region: RegionSpec;
  readonly compute: ComputeTopology;
  readonly database: DatabaseTopology | null;
  readonly cache: CacheTopology | null;
  readonly gateway: GatewayTopology | null;
  readonly edge: EdgeTopology | null;
  readonly queue: QueueTopology | null;
  readonly perClientRps: number;
  readonly irq: IrqRouting;
  readonly budgetCapUsd: number;
  readonly powerMode: PowerMode;
  readonly model: ServiceModel;
}

function countSlots(config: CmosConfig, device: PciDevice): number {
  return config.bus.slots.filter((slot) => slot.device === device).length;
}

export function deriveCloudTopology(config: CmosConfig): CloudTopology {
  const coreMhz = coreClockMhz(config.cpu);
  const vcpu = vcpuForCoreMhz(coreMhz);
  const memoryMb = config.memory.systemRamMb * 32;
  const lambdaMemoryMb = Math.min(10240, Math.max(memoryMb, Math.ceil(vcpu * 1769)));
  const concurrencyPerInstance = Math.max(1, Math.round(vcpu * 8));
  const maxInstances = maxInstancesForVoltage(config.cpu.coreVoltageMv);
  const targetUtilization = targetUtilizationForFan(config.health.fanRpm);
  const irq = resolveIrqRouting(config);

  const drive = config.storage.primaryMaster;
  const driveSpec = drive === "none" ? null : DRIVE_SPECS[drive];
  const replicas = driveSpec ? RAID_READ_REPLICAS[config.storage.raid] : 0;
  const cacheTier = config.storage.secondaryMaster;
  const cacheSpec = cacheTier === "none" ? null : CACHE_SPECS[cacheTier];
  const hit = cacheSpec?.hitRatio ?? 0;
  const raid0 = config.storage.raid === "raid0";
  const ecc = config.memory.ecc;

  const memFactor = memoryMb < 256 ? 1.4 : memoryMb < 512 ? 1.15 : 1;
  const computeMs = (9000 / coreMhz) * memFactor;
  let dbMs = cacheSpec ? 0.6 * hit : 0;
  let dbCapacityRps: number | null = null;
  if (driveSpec) {
    const base = driveSpec.baseLatencyMs * (raid0 ? 0.7 : 1);
    const eccMs = ecc === "ecc" ? 0.3 : ecc === "ecc-scrub" ? (replicas > 0 ? 1.8 : 1.2) : 0;
    const vectorMs = config.storage.primarySlave === "pgvector" ? 0.8 : 0;
    dbMs = base * (1 - hit) + 0.6 * hit + eccMs + vectorMs;
    dbCapacityRps = (driveSpec.nodeQps * (raid0 ? 1.6 : 1) * (1 + 0.85 * replicas)) / Math.max(0.08, 1 - hit);
  }
  const serviceMs = computeMs + dbMs;
  const perInstanceRps = (concurrencyPerInstance * 1000) / serviceMs;

  const gatewaySlots = countSlots(config, "api-gateway");
  const edgeSlots = countSlots(config, "edge-middleware");
  const webhookSlots = countSlots(config, "webhook-queue");
  const overheadMs = 6 + (edgeSlots > 0 ? 1.5 : 0) + 6 * irq.conflictCount;
  const coldStartMs = 220 + (driveSpec ? 160 : 0) + (lambdaMemoryMb < 512 ? 120 : 0);

  const instancesForAvg = config.workload.averageRps / (perInstanceRps * targetUtilization);
  const minWarmInstances =
    config.power.mode === "disabled"
      ? clamp(Math.ceil(instancesForAvg), 1, maxInstances)
      : config.power.mode === "min-saving"
        ? clamp(Math.ceil(instancesForAvg * 0.5), 1, maxInstances)
        : 0;

  const perClientRps = perClientRpsForThrottle(config.health.throttleC);
  const gatewayRate = Math.round(
    gatewaySlots * config.bus.pciClockMhz * 120 * (1 - Math.min(0.75, 0.25 * irq.conflictCount)),
  );

  return {
    checksum: cmosChecksum(config),
    region: REGION_BY_TIME_ZONE[config.standard.timeZone],
    compute: {
      coreMhz,
      vcpu,
      memoryMb,
      lambdaMemoryMb,
      vercelFunctionCpu: vcpu >= 2 || memoryMb > 2048 ? "performance" : "standard",
      concurrencyPerInstance,
      minWarmInstances,
      maxInstances,
      targetUtilization,
      timeoutSec: config.power.watchdogSec,
      scaleInCooldownSec: config.power.standbyMin * 60,
      reservedConcurrency: maxInstances * concurrencyPerInstance,
      provisionedConcurrency: minWarmInstances * concurrencyPerInstance,
    },
    database: driveSpec && drive !== "none"
      ? {
          drive,
          spec: driveSpec,
          storageGb: config.storage.capacityGb,
          raid: config.storage.raid,
          readReplicas: replicas,
          multiAz: ecc === "ecc-scrub",
          dataChecksums: ecc !== "disabled",
          synchronousReplication: ecc === "ecc-scrub" && replicas > 0,
          backupRetentionDays: ecc === "ecc-scrub" ? 14 : ecc === "ecc" ? 7 : 1,
          vector: config.storage.primarySlave === "pgvector",
        }
      : null,
    cache: cacheSpec && cacheTier !== "none"
      ? { tier: cacheTier, spec: cacheSpec, maxMemoryMb: Math.floor(cacheSpec.memoryMb * 0.75) }
      : null,
    gateway: gatewaySlots > 0 ? { slots: gatewaySlots, rateLimitRps: gatewayRate, burstLimit: gatewayRate * 2 } : null,
    edge: edgeSlots > 0 ? { slots: edgeSlots, perClientRps, wafLimitPer5Min: Math.max(100, perClientRps * 300) } : null,
    queue:
      webhookSlots > 0
        ? {
            slots: webhookSlots,
            maxConcurrency: clamp(webhookSlots * 5, 2, 1000),
            visibilityTimeoutSec: Math.min(43200, Math.max(30, config.power.watchdogSec * 6)),
          }
        : null,
    perClientRps,
    irq,
    budgetCapUsd: config.power.budgetCapUsd,
    powerMode: config.power.mode,
    model: {
      computeMs: round(computeMs, 2),
      dbMs: round(dbMs, 2),
      serviceMs: round(serviceMs, 2),
      perInstanceRps: round(perInstanceRps, 2),
      dbCapacityRps: dbCapacityRps === null ? null : Math.floor(dbCapacityRps),
      overheadMs,
      coldStartMs,
    },
  };
}

/* ═══════════════════════════ 8. Cost / latency / thermal simulator ═══════════════════════════ */

export type Bottleneck = "compute" | "database" | "gateway" | "thermal";

export interface CostLine {
  readonly id: string;
  readonly label: string;
  readonly usd: number;
}

export type AlarmCode =
  | "THERMAL_LIMIT"
  | "BUDGET_EXCEEDED"
  | "IRQ_CONFLICT"
  | "UNDERVOLT"
  | "OVERVOLT"
  | "SATURATED"
  | "RATE_LIMITED"
  | "NO_REDUNDANCY"
  | "NON_ECC"
  | "DDOS_EXPOSED";

export interface CmosAlarm {
  readonly code: AlarmCode;
  readonly severity: "warn" | "fail";
  readonly message: string;
}

export type BeepCode = "ok" | "thermal" | "irq-conflict" | "undervolt" | "budget";

export interface PostCheck {
  readonly id: "cpu" | "memory" | "primary-master" | "raid" | "irq" | "thermal" | "budget" | "capacity";
  readonly label: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
}

export interface PostReport {
  readonly passed: boolean;
  readonly checks: readonly PostCheck[];
  readonly beepCode: BeepCode;
}

export interface CmosTelemetry {
  readonly checksum: string;
  readonly monthlyCostUsd: number;
  readonly costBreakdown: readonly CostLine[];
  /** Monthly cost divided by the budget cap (1 = exactly at cap). */
  readonly budgetUsage: number;
  readonly p99LatencyMs: number;
  readonly maxRps: number;
  readonly bottleneck: Bottleneck;
  readonly peakDemandRps: number;
  readonly peakUtilization: number;
  readonly rejectedShare: number;
  /** CPU die temperature the peak demand would produce. */
  readonly thermalC: number;
  /** Package power at peak demand (watts); grows with clock and Vcore squared. */
  readonly powerDrawW: number;
  readonly thermalThrottled: boolean;
  readonly stabilityPct: number;
  readonly coldStartShare: number;
  readonly alarms: readonly CmosAlarm[];
  /** True when the dual-tone alarm should sound (thermal or budget failure). */
  readonly alarmActive: boolean;
  readonly post: PostReport;
}

const ECC_LABELS: Readonly<Record<EccMode, string>> = {
  disabled: "NON-ECC",
  ecc: "ECC",
  "ecc-scrub": "ECC + PATROL SCRUB",
};

export function simulateCmos(config: CmosConfig, topology: CloudTopology = deriveCloudTopology(config)): CmosTelemetry {
  const { compute, model } = topology;
  const avg = config.workload.averageRps;
  const peak = avg * config.workload.peakFactor;
  const perInstance = model.perInstanceRps;

  const instancesFor = (demand: number) => demand / (perInstance * compute.targetUtilization);
  const activeAt = (demand: number) =>
    clamp(
      Math.ceil(instancesFor(demand)),
      Math.max(compute.minWarmInstances, demand > 0 ? 1 : 0),
      compute.maxInstances,
    );
  const utilAt = (demand: number) => (demand > 0 ? demand / (activeAt(demand) * perInstance) : 0);

  // Thermal model: P = k * V^2 * f, die temp = ambient + Rth * P.
  const mv = config.cpu.coreVoltageMv;
  const p0 = 16 * (mv / 3300) ** 2 * (compute.coreMhz / 200);
  const rth = 1.25 - (0.85 * (config.health.fanRpm - FAN_RPM.min)) / (FAN_RPM.max - FAN_RPM.min);
  const scrubHeat = config.memory.ecc === "ecc-scrub" ? 2 : 0;
  const powerAt = (u: number) => p0 * (0.3 + 0.7 * clamp(u, 0, 1));
  const tempAt = (u: number) => 25 + rth * powerAt(u) + scrubHeat;
  const throttleC = config.health.throttleC;

  const computeCap = compute.maxInstances * perInstance;
  let thermalCap = Infinity;
  if (tempAt(1) > throttleC) {
    const uStar = clamp(((throttleC - 25 - scrubHeat) / (rth * p0) - 0.3) / 0.7, 0, 1);
    thermalCap = uStar * computeCap;
  }

  const caps: ReadonlyArray<readonly [Bottleneck, number]> = [
    ["compute", computeCap],
    ["database", model.dbCapacityRps ?? Infinity],
    ["gateway", topology.gateway?.rateLimitRps ?? Infinity],
    ["thermal", thermalCap],
  ];
  let bottleneck: Bottleneck = "compute";
  let capacity = Infinity;
  for (const [name, cap] of caps) {
    if (cap < capacity) {
      capacity = cap;
      bottleneck = name;
    }
  }
  const maxRps = Math.max(0, Math.floor(capacity));
  const served = Math.min(peak, maxRps);
  const rejectedShare = peak > 0 ? Math.max(0, (peak - served) / peak) : 0;
  const demandUtil = utilAt(peak);
  const thermalC = tempAt(demandUtil);
  const servedUtil = utilAt(served);

  // P99: overhead + queueing tails on compute and database + cold-start contribution.
  const rhoC = clamp(servedUtil, 0, 0.97);
  const rhoDb = model.dbCapacityRps ? clamp(served / model.dbCapacityRps, 0, 0.97) : 0;
  const tail = (serviceMs: number, rho: number) => serviceMs * (1.9 + (1.2 * rho * rho) / (1 - rho));
  const coldStartsPerHour =
    Math.max(0, activeAt(peak) - compute.minWarmInstances) * (60 / config.power.standbyMin) * 0.5;
  const coldStartShare = clamp((coldStartsPerHour * compute.concurrencyPerInstance) / (avg * 3600), 0, 1);
  const coldMs = coldStartShare >= 0.01 ? model.coldStartMs : model.coldStartMs * (coldStartShare / 0.01);
  const p99 = Math.min(
    compute.timeoutSec * 1000,
    model.overheadMs + tail(model.computeMs, rhoC) + tail(model.dbMs, rhoDb) + coldMs,
  );

  // Monthly cost (estimates from public list prices).
  const P = PRICING;
  const mul = topology.region.priceMultiplier;
  const millionRequests = (avg * P.secondsPerMonth) / 1e6;
  const lines: CostLine[] = [];
  const push = (id: string, label: string, usd: number) => {
    lines.push({ id, label, usd: round(usd * mul, 2) });
  };
  const avgActive = Math.max(compute.minWarmInstances, instancesFor(avg)) * (1 + config.power.standbyMin * 0.004);
  push(
    "compute",
    `FN COMPUTE ${compute.vcpu} vCPU / ${compute.memoryMb}MB`,
    avgActive * P.hoursPerMonth * (compute.vcpu * P.computeVcpuHour + (compute.memoryMb / 1024) * P.computeGbHour),
  );
  push("requests", "FN INVOCATIONS", millionRequests * P.requestsPerMillion);
  push("gateway", "HTTP API GATEWAY", millionRequests * P.httpApiPerMillion);
  if (topology.edge) {
    push(
      "edge",
      "EDGE CDN + WAF",
      millionRequests * (P.cdnPerMillion + P.wafPerMillion) + P.wafAclMonthly + P.wafRuleMonthly,
    );
  }
  const db = topology.database;
  if (db) {
    const nodes = (db.multiAz ? 2 : 1) + db.readReplicas;
    const storage = db.storageGb * P.rdsGp3GbMonth * nodes * (db.raid === "raid0" ? 1.25 : 1);
    push("database", `POSTGRES ${db.spec.rdsClass} x${1 + db.readReplicas}`, db.spec.hourlyUsd * nodes * P.hoursPerMonth + storage);
    push("secrets", "DB SECRET (SECRETS MANAGER)", P.secretMonthly);
  }
  if (topology.cache) {
    push("cache", `REDIS ${topology.cache.spec.node}`, topology.cache.spec.hourlyUsd * P.hoursPerMonth);
  }
  if (topology.queue) {
    const messages = avg * P.secondsPerMonth * P.webhookShare;
    push(
      "queue",
      "WEBHOOK QUEUE + WORKER",
      ((messages * 3) / 1e6) * P.sqsPerMillion + messages * P.workerDurationSec * P.workerMemoryGb * P.lambdaGbSecond,
    );
  }
  if (db || topology.cache) push("network", "VPC NAT GATEWAY", P.natGatewayHour * P.hoursPerMonth);
  const monthlyCostUsd = round(lines.reduce((sum, line) => sum + line.usd, 0), 2);
  const budgetUsage = round(monthlyCostUsd / config.power.budgetCapUsd, 4);

  // Stability score.
  const vreq = requiredVoltageMv(compute.coreMhz);
  const deficitMv = vreq - mv;
  const overMv = mv - vreq - 300;
  let stability = 100;
  if (deficitMv > 0) stability -= (deficitMv / 10) * 1.2;
  if (overMv > 0) stability -= (overMv / 10) * 0.4;
  if (thermalC > throttleC) stability -= (thermalC - throttleC) * 1.5;
  if (thermalC > 95) stability -= 25;
  stability -= 15 * topology.irq.conflictCount;
  if (config.memory.ecc === "disabled") stability -= 8;
  else if (config.memory.ecc === "ecc") stability -= 2;
  if (db && db.raid === "raid0") stability -= 10;
  else if (db && db.readReplicas === 0) stability -= 5;
  if (!topology.gateway && !topology.edge) stability -= 5;
  if (servedUtil >= 0.9) stability -= 10;
  stability -= rejectedShare * 40;
  if (monthlyCostUsd > config.power.budgetCapUsd) stability -= 10;
  const stabilityPct = clamp(Math.round(stability), 0, 100);

  // POST checks.
  const checks: PostCheck[] = [];
  checks.push({
    id: "cpu",
    label: "CPU CLOCK",
    status: deficitMv > 100 ? "fail" : deficitMv > 0 || overMv > 0 ? "warn" : "ok",
    detail: `${compute.coreMhz}MHz @ ${(mv / 1000).toFixed(2)}V (STABLE AT ${(vreq / 1000).toFixed(2)}V)`,
  });
  checks.push({
    id: "memory",
    label: "MEMORY TEST",
    status: config.memory.ecc === "disabled" ? "warn" : "ok",
    detail: `${config.memory.systemRamMb * 1024}K OK ${ECC_LABELS[config.memory.ecc]}`,
  });
  checks.push({
    id: "primary-master",
    label: "PRIMARY MASTER",
    status: "ok",
    detail: db ? `${db.spec.label} ${db.storageGb}GB (POSTGRES ${db.spec.rdsClass})` : "NONE",
  });
  checks.push({
    id: "raid",
    label: "RAID ARRAY",
    status: db && (db.raid === "raid0" || db.readReplicas === 0) ? "warn" : "ok",
    detail: !db
      ? "N/A"
      : db.raid === "raid0"
        ? "RAID 0 STRIPED - NO REDUNDANCY"
        : db.readReplicas === 0
          ? "SINGLE PRIMARY - NO REPLICA"
          : `${db.raid.toUpperCase()} - ${db.readReplicas} READ REPLICA(S)`,
  });
  checks.push({
    id: "irq",
    label: "IRQ ROUTING",
    status: topology.irq.conflictCount > 0 ? "fail" : "ok",
    detail:
      topology.irq.conflicts.length > 0
        ? topology.irq.conflicts.map((c) => `IRQ ${c.irq}: ${c.holders.join(" + ")}`).join("; ")
        : "NO CONFLICTS",
  });
  checks.push({
    id: "thermal",
    label: "CPU TEMPERATURE",
    status: thermalC > throttleC ? "fail" : thermalC > throttleC - 5 ? "warn" : "ok",
    detail: `${round(thermalC, 1)}C / WARNING AT ${throttleC}C`,
  });
  checks.push({
    id: "budget",
    label: "POWER BUDGET",
    status: monthlyCostUsd > config.power.budgetCapUsd ? "fail" : budgetUsage > 0.9 ? "warn" : "ok",
    detail: `$${monthlyCostUsd.toFixed(2)}/MO OF $${config.power.budgetCapUsd} CAP (ESTIMATE)`,
  });
  checks.push({
    id: "capacity",
    label: "BUS CAPACITY",
    status: rejectedShare > 0 || servedUtil >= 0.9 ? "warn" : "ok",
    detail:
      rejectedShare > 0
        ? `SHEDDING ${Math.round(rejectedShare * 100)}% AT PEAK (${bottleneck.toUpperCase()} LIMIT)`
        : `${maxRps} RPS MAX (${bottleneck.toUpperCase()} LIMIT)`,
  });

  const failed = (id: PostCheck["id"]) => checks.some((c) => c.id === id && c.status === "fail");
  const beepCode: BeepCode = failed("thermal")
    ? "thermal"
    : failed("irq")
      ? "irq-conflict"
      : failed("cpu")
        ? "undervolt"
        : failed("budget")
          ? "budget"
          : "ok";

  const alarms: CmosAlarm[] = [];
  const alarm = (code: AlarmCode, severity: "warn" | "fail", message: string) => {
    alarms.push({ code, severity, message });
  };
  if (thermalC > throttleC) alarm("THERMAL_LIMIT", "fail", `CPU ${round(thermalC, 1)}C exceeds ${throttleC}C. Circuit breaker sheds load.`);
  if (monthlyCostUsd > config.power.budgetCapUsd) alarm("BUDGET_EXCEEDED", "fail", `Estimated $${monthlyCostUsd.toFixed(2)}/mo exceeds the $${config.power.budgetCapUsd} cap.`);
  if (topology.irq.conflictCount > 0) alarm("IRQ_CONFLICT", "fail", `${topology.irq.conflictCount} IRQ conflict(s) on the PCI bus.`);
  if (deficitMv > 0) alarm("UNDERVOLT", deficitMv > 100 ? "fail" : "warn", `Vcore is ${deficitMv}mV below stable for ${compute.coreMhz}MHz.`);
  if (overMv > 0) alarm("OVERVOLT", "warn", `Vcore is ${overMv}mV above the safe margin.`);
  if (rejectedShare > 0) alarm(bottleneck === "gateway" ? "RATE_LIMITED" : "SATURATED", "warn", `${Math.round(rejectedShare * 100)}% of peak traffic is rejected.`);
  if (db && (db.raid === "raid0" || db.readReplicas === 0)) alarm("NO_REDUNDANCY", "warn", "PostgreSQL has no read replica.");
  if (config.memory.ecc === "disabled") alarm("NON_ECC", "warn", "Data checksums and backups are minimal.");
  if (!topology.gateway && !topology.edge) alarm("DDOS_EXPOSED", "warn", "No API gateway or edge slot: ingress is unthrottled.");

  return {
    checksum: topology.checksum,
    monthlyCostUsd,
    costBreakdown: lines,
    budgetUsage,
    p99LatencyMs: round(p99, 1),
    maxRps,
    bottleneck,
    peakDemandRps: round(peak, 1),
    peakUtilization: round(demandUtil, 3),
    rejectedShare: round(rejectedShare, 4),
    thermalC: round(thermalC, 1),
    powerDrawW: round(powerAt(demandUtil), 2),
    thermalThrottled: thermalCap < Infinity && peak > thermalCap,
    stabilityPct,
    coldStartShare: round(coldStartShare, 5),
    alarms,
    alarmActive: failed("thermal") || failed("budget"),
    post: { passed: !checks.some((c) => c.status === "fail"), checks, beepCode },
  };
}

/* ═══════════════════════════ 9. Cloud -> CMOS inverse mapping ═══════════════════════════ */

export const DATABASE_CLASSES = ["none", "db.t4g.medium", "db.m6g.large", "db.r6g.xlarge"] as const;
const DRIVE_FOR_CLASS: Readonly<Record<(typeof DATABASE_CLASSES)[number], DriveType>> = {
  none: "none",
  "db.t4g.medium": "ide-hdd",
  "db.m6g.large": "scsi",
  "db.r6g.xlarge": "nvme",
};

export const CloudPatchSchema = z.strictObject({
  awsRegion: z.enum(AWS_REGIONS).optional(),
  vcpu: z.literal(VCPU_ALLOCATIONS).optional(),
  functionMemoryMb: z.number().int().min(128).max(4096).optional(),
  maxInstances: z.number().int().min(1).max(1024).optional(),
  databaseClass: z.enum(DATABASE_CLASSES).optional(),
  readReplicas: z.number().int().min(0).max(3).optional(),
  vectorStore: z.boolean().optional(),
  cacheTier: z.enum(CACHE_TIERS).optional(),
  timeoutSec: z.number().int().min(1).max(300).optional(),
  monthlyBudgetUsd: z.number().min(BUDGET_CAP_USD.min).max(BUDGET_CAP_USD.max).optional(),
});
export type CloudPatch = z.infer<typeof CloudPatchSchema>;

export interface CloudAdjustment {
  readonly field: keyof CloudPatch;
  readonly requested: string;
  readonly applied: string;
}

export type CloudPatchResult =
  | { readonly ok: true; readonly config: CmosConfig; readonly adjustments: readonly CloudAdjustment[] }
  | { readonly ok: false; readonly issues: readonly CmosIssue[] };

function nearestCpuForVcpu(cpu: CmosConfig["cpu"], vcpu: Vcpu): Pick<CmosConfig["cpu"], "fsbMhz" | "multiplier"> {
  let best: { fsbMhz: FsbClockMhz; multiplier: CpuMultiplier; score: number } | null = null;
  for (const fsbMhz of FSB_CLOCKS_MHZ) {
    for (const multiplier of CPU_MULTIPLIERS) {
      if (vcpuForCoreMhz(fsbMhz * multiplier) !== vcpu) continue;
      // Prefer keeping the current FSB, then the smallest multiplier change.
      const score = Math.abs(fsbMhz - cpu.fsbMhz) * 10 + Math.abs(multiplier - cpu.multiplier);
      if (!best || score < best.score) best = { fsbMhz, multiplier, score };
    }
  }
  return best ? { fsbMhz: best.fsbMhz, multiplier: best.multiplier } : { fsbMhz: cpu.fsbMhz, multiplier: cpu.multiplier };
}

/** Translate cloud-side targets back into the nearest representable CMOS registers. */
export function applyCloudPatch(config: CmosConfig, patchInput: unknown): CloudPatchResult {
  const parsed = CloudPatchSchema.safeParse(patchInput);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
    };
  }
  const patch = parsed.data;
  const adjustments: CloudAdjustment[] = [];
  const note = (field: keyof CloudPatch, requested: unknown, applied: unknown) => {
    if (String(requested) !== String(applied)) {
      adjustments.push({ field, requested: String(requested), applied: String(applied) });
    }
  };

  const standard = { ...config.standard };
  const cpu = { ...config.cpu };
  const memory = { ...config.memory };
  const storage = { ...config.storage };
  const power = { ...config.power };

  if (patch.awsRegion !== undefined) {
    const match = TIME_ZONES.find((tz) => REGION_BY_TIME_ZONE[tz].awsRegion === patch.awsRegion);
    if (match) standard.timeZone = match;
  }
  if (patch.vcpu !== undefined) Object.assign(cpu, nearestCpuForVcpu(cpu, patch.vcpu));
  if (patch.functionMemoryMb !== undefined) {
    const ram = SYSTEM_RAM_MB.find((mb) => mb * 32 >= patch.functionMemoryMb!) ?? 128;
    memory.systemRamMb = ram;
    note("functionMemoryMb", patch.functionMemoryMb, ram * 32);
  }
  if (patch.maxInstances !== undefined) {
    const ideal = 2800 + 100 * Math.log2(patch.maxInstances / 4);
    const mv = clamp(Math.round(ideal / 50) * 50, CORE_VOLTAGE_MV.min, CORE_VOLTAGE_MV.max);
    cpu.coreVoltageMv = mv;
    note("maxInstances", patch.maxInstances, maxInstancesForVoltage(mv));
  }
  if (patch.databaseClass !== undefined) storage.primaryMaster = DRIVE_FOR_CLASS[patch.databaseClass];
  if (patch.readReplicas !== undefined) {
    storage.raid =
      patch.readReplicas === 0
        ? storage.raid === "raid0"
          ? "raid0"
          : "none"
        : patch.readReplicas === 1
          ? "raid1"
          : patch.readReplicas === 2
            ? "raid5"
            : "raid10";
  }
  if (patch.vectorStore !== undefined) storage.primarySlave = patch.vectorStore ? "pgvector" : "none";
  if (patch.cacheTier !== undefined) storage.secondaryMaster = patch.cacheTier;
  if (patch.timeoutSec !== undefined) {
    const watchdog = WATCHDOG_TIMEOUTS_SEC.find((s) => s >= patch.timeoutSec!) ?? 300;
    power.watchdogSec = watchdog;
    note("timeoutSec", patch.timeoutSec, watchdog);
  }
  if (patch.monthlyBudgetUsd !== undefined) {
    const cap = clamp(Math.round(patch.monthlyBudgetUsd / 25) * 25, BUDGET_CAP_USD.min, BUDGET_CAP_USD.max);
    power.budgetCapUsd = cap;
    note("monthlyBudgetUsd", patch.monthlyBudgetUsd, cap);
  }

  // Dropping the database cascades: RAID and vector storage have nothing to attach to.
  if (storage.primaryMaster === "none" && patch.databaseClass === "none") {
    storage.raid = "none";
    storage.primarySlave = "none";
  }

  const validated = validateConfig({ ...config, standard, cpu, memory, storage, power });
  if (!validated.ok) return { ok: false, issues: validated.issues };
  return { ok: true, config: validated.config, adjustments };
}

/* ═══════════════════════════ 10. BIOS setup state machine ═══════════════════════════ */

export type CmosPhase = "post" | "setup" | "confirm-save" | "confirm-exit" | "rebooting";
export type DefaultsPreset = "bios" | "setup";

export interface CmosMachineState {
  readonly phase: CmosPhase;
  /** Registers being edited (live-previewed by telemetry). */
  readonly draft: CmosConfig;
  /** Registers last written to CMOS with "SAVE & EXIT". */
  readonly saved: CmosConfig;
  readonly dirty: boolean;
  readonly telemetry: CmosTelemetry;
  readonly issues: readonly CmosIssue[];
  readonly adjustments: readonly CloudAdjustment[];
  /** True when persisted CMOS data failed validation and defaults were loaded. */
  readonly checksumError: boolean;
  readonly revision: number;
}

export type CmosEvent =
  | { readonly type: "ENTER_SETUP" }
  | { readonly type: "SET_REGISTER"; readonly path: RegisterPath; readonly value: unknown }
  | { readonly type: "APPLY_CLOUD_PATCH"; readonly patch: unknown }
  | { readonly type: "LOAD_CONFIG"; readonly config: unknown }
  | { readonly type: "LOAD_DEFAULTS"; readonly preset: DefaultsPreset }
  | { readonly type: "RESTORE_SAVED" }
  | { readonly type: "REQUEST_SAVE" }
  | { readonly type: "REQUEST_EXIT" }
  | { readonly type: "CONFIRM" }
  | { readonly type: "CANCEL" }
  | { readonly type: "REBOOT_COMPLETE" };

function configsEqual(a: CmosConfig, b: CmosConfig): boolean {
  return a === b || canonicalJson(a) === canonicalJson(b);
}

export function createInitialMachineState(saved: CmosConfig, checksumError = false): CmosMachineState {
  return {
    phase: "post",
    draft: saved,
    saved,
    dirty: false,
    telemetry: simulateCmos(saved),
    issues: [],
    adjustments: [],
    checksumError,
    revision: 0,
  };
}

function withDraft(state: CmosMachineState, draft: CmosConfig, adjustments: readonly CloudAdjustment[] = []): CmosMachineState {
  return {
    ...state,
    draft,
    dirty: !configsEqual(draft, state.saved),
    telemetry: simulateCmos(draft),
    issues: [],
    adjustments,
    revision: state.revision + 1,
  };
}

function withIssues(state: CmosMachineState, issues: readonly CmosIssue[]): CmosMachineState {
  return { ...state, issues, adjustments: [], revision: state.revision + 1 };
}

const NOT_IN_SETUP: readonly CmosIssue[] = [{ path: "phase", message: "Registers can only change inside SETUP." }];

/** Set one register on a config. Validated, frozen, with BIOS-style dependent cascades. */
export function setRegisterValue(config: CmosConfig, path: RegisterPath, value: unknown): ConfigValidation {
  if (!isRegisterPath(path)) return { ok: false, issues: [{ path: String(path), message: "Unknown CMOS register." }] };
  const [group, field] = path.split(".") as [GroupKey, string];
  const nextGroup: Record<string, unknown> = { ...(config[group] as Record<string, unknown>), [field]: value };
  if (path === "storage.primaryMaster" && value === "none") {
    nextGroup.raid = "none";
    nextGroup.primarySlave = "none";
  }
  return validateConfig({ ...config, [group]: nextGroup });
}

export function cmosReducer<S extends CmosMachineState>(state: S, event: CmosEvent): S {
  const editable = state.phase === "setup";
  switch (event.type) {
    case "ENTER_SETUP":
      return state.phase === "post" ? { ...state, phase: "setup" } : state;
    case "SET_REGISTER": {
      if (!editable) return withIssues(state, NOT_IN_SETUP) as S;
      const result = setRegisterValue(state.draft, event.path, event.value);
      return (result.ok ? withDraft(state, result.config) : withIssues(state, result.issues)) as S;
    }
    case "APPLY_CLOUD_PATCH": {
      if (!editable) return withIssues(state, NOT_IN_SETUP) as S;
      const result = applyCloudPatch(state.draft, event.patch);
      return (result.ok ? withDraft(state, result.config, result.adjustments) : withIssues(state, result.issues)) as S;
    }
    case "LOAD_CONFIG": {
      if (!editable) return withIssues(state, NOT_IN_SETUP) as S;
      const result = validateConfig(event.config);
      return (result.ok ? withDraft(state, result.config) : withIssues(state, result.issues)) as S;
    }
    case "LOAD_DEFAULTS":
      if (!editable) return withIssues(state, NOT_IN_SETUP) as S;
      return withDraft(state, event.preset === "bios" ? BIOS_DEFAULTS : SETUP_DEFAULTS) as S;
    case "RESTORE_SAVED":
      if (!editable) return withIssues(state, NOT_IN_SETUP) as S;
      return withDraft(state, state.saved) as S;
    case "REQUEST_SAVE":
      return editable ? { ...state, phase: "confirm-save" } : state;
    case "REQUEST_EXIT":
      return editable ? { ...state, phase: "confirm-exit" } : state;
    case "CANCEL":
      return state.phase === "confirm-save" || state.phase === "confirm-exit" ? { ...state, phase: "setup" } : state;
    case "CONFIRM":
      if (state.phase === "confirm-save") {
        return {
          ...state,
          phase: "rebooting",
          saved: state.draft,
          dirty: false,
          checksumError: false,
          revision: state.revision + 1,
        };
      }
      if (state.phase === "confirm-exit") {
        return { ...withDraft(state, state.saved), phase: "rebooting", dirty: false } as S;
      }
      return state;
    case "REBOOT_COMPLETE":
      return state.phase === "rebooting" ? { ...state, phase: "post" } : state;
  }
}

/* ═══════════════════════════ 11. Battery-backed persistence & store ═══════════════════════════ */

export const CMOS_STORAGE_KEY = "genui-cmos-cloud-bios:v1";
const MAX_PERSISTED_BYTES = 64 * 1024;

export interface CmosPersistence {
  load(): string | null;
  save(serialized: string): void;
}

/** localStorage adapter, or null when storage is unavailable (SSR, privacy mode). */
export function createBrowserCmosPersistence(key: string = CMOS_STORAGE_KEY): CmosPersistence | null {
  try {
    const storage = typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
    if (!storage) return null;
    return {
      load: () => storage.getItem(key),
      save: (serialized) => {
        try {
          storage.setItem(key, serialized);
        } catch {
          // Quota or privacy errors: CMOS battery is "dead", keep running in memory.
        }
      },
    };
  } catch {
    return null;
  }
}

export function serializeCmos(config: CmosConfig): string {
  return JSON.stringify({ v: 1, checksum: cmosChecksum(config), config });
}

export function deserializeCmos(serialized: string | null): { readonly config: CmosConfig; readonly checksumError: boolean } {
  if (serialized === null) return { config: SETUP_DEFAULTS, checksumError: false };
  try {
    if (serialized.length > MAX_PERSISTED_BYTES) throw new Error("oversized");
    const record = JSON.parse(serialized) as { v?: unknown; checksum?: unknown; config?: unknown };
    if (record.v !== 1) throw new Error("version");
    const validated = validateConfig(record.config);
    if (!validated.ok || cmosChecksum(validated.config) !== record.checksum) throw new Error("checksum");
    return { config: validated.config, checksumError: false };
  } catch {
    return { config: SETUP_DEFAULTS, checksumError: true };
  }
}

export interface CmosStoreActions {
  dispatch(event: CmosEvent): void;
  setRegister<P extends RegisterPath>(path: P, value: RegisterValue<P>): boolean;
  applyCloudPatch(patch: CloudPatch): readonly CloudAdjustment[] | null;
  loadDefaults(preset: DefaultsPreset): void;
}

export type CmosStore = CmosMachineState & CmosStoreActions;

export interface CreateCmosStoreOptions {
  /** `undefined` = browser localStorage, `null` = no persistence. */
  readonly persistence?: CmosPersistence | null;
  readonly initialConfig?: CmosConfig;
}

export function createCmosStore(options: CreateCmosStoreOptions = {}): StoreApi<CmosStore> {
  const persistence = options.persistence === undefined ? createBrowserCmosPersistence() : options.persistence;
  let boot: { config: CmosConfig; checksumError: boolean };
  if (options.initialConfig) {
    const validated = validateConfig(options.initialConfig);
    boot = validated.ok ? { config: validated.config, checksumError: false } : { config: SETUP_DEFAULTS, checksumError: true };
  } else {
    boot = deserializeCmos(persistence?.load() ?? null);
  }

  return createStore<CmosStore>()((set, get) => ({
    ...createInitialMachineState(boot.config, boot.checksumError),
    dispatch: (event) => {
      const prev = get();
      const next = cmosReducer(prev, event);
      if (next === prev) return;
      set(next);
      if (persistence && next.saved !== prev.saved) persistence.save(serializeCmos(next.saved));
    },
    setRegister: (path, value) => {
      get().dispatch({ type: "SET_REGISTER", path, value });
      return get().issues.length === 0;
    },
    applyCloudPatch: (patch) => {
      get().dispatch({ type: "APPLY_CLOUD_PATCH", patch });
      return get().issues.length === 0 ? get().adjustments : null;
    },
    loadDefaults: (preset) => get().dispatch({ type: "LOAD_DEFAULTS", preset }),
  }));
}
