import type {
  AABBCollider,
  CemeteryZoneId,
  CircleCollider,
  DeadTreeInstanceSpec,
  LanternSpec,
  TombstoneInstanceSpec,
  ZoneTeleportTarget,
} from "../types.js";

/** Player horizontal collision cylinder radius in meters */
export const PLAYER_RADIUS = 0.48;
/** Standing eye height in meters */
export const PLAYER_EYE_HEIGHT = 1.7;

/**
 * Outer walkable horizon bounds (includes south approach corridor +30..+38.5 prior to gate entry).
 */
export const WORLD_OUTER_BOUNDS = {
  minX: -35.4,
  maxX: 35.4,
  minZ: -43.2,
  maxZ: 38.4,
} as const;

/**
 * Seeded deterministic pseudo-random helper in [0, 1) so geometry placement and
 * collision shapes stay 100% identical across SSR tests and browser renders.
 */
export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

/** Static AABB obstacles (stone perimeter walls, gate pillars, mausoleum, chapel) */
export const STATIC_AABB_COLLIDERS: readonly AABBCollider[] = [
  // North Boundary Stone Wall
  {
    id: "wall-north",
    kind: "wall",
    minX: -36.6,
    maxX: 36.6,
    minZ: -44.6,
    maxZ: -43.4,
    height: 3.4,
  },
  // West Boundary Stone Wall
  {
    id: "wall-west",
    kind: "wall",
    minX: -36.6,
    maxX: -35.4,
    minZ: -44.6,
    maxZ: 29.6,
    height: 3.2,
  },
  // East Boundary Stone Wall
  {
    id: "wall-east",
    kind: "wall",
    minX: 35.4,
    maxX: 36.6,
    minZ: -44.6,
    maxZ: 29.6,
    height: 3.2,
  },
  // South-West Perimeter Wall (stops at West Gate Pillar)
  {
    id: "wall-south-west",
    kind: "wall",
    minX: -36.6,
    maxX: -3.5,
    minZ: 28.4,
    maxZ: 29.6,
    height: 3.2,
  },
  // South-East Perimeter Wall (stops at East Gate Pillar)
  {
    id: "wall-south-east",
    kind: "wall",
    minX: 3.5,
    maxX: 36.6,
    minZ: 28.4,
    maxZ: 29.6,
    height: 3.2,
  },
  // West & East Carved Stone Gatehouse Pillars
  {
    id: "gate-pillar-west",
    kind: "pillar",
    minX: -3.6,
    maxX: -2.4,
    minZ: 28.0,
    maxZ: 30.0,
    height: 4.8,
  },
  {
    id: "gate-pillar-east",
    kind: "pillar",
    minX: 2.4,
    maxX: 3.6,
    minZ: 28.0,
    maxZ: 30.0,
    height: 4.8,
  },
  // Approach Forecourt Side Fences (prevent wandering off world prior to entering gate)
  {
    id: "approach-fence-west",
    kind: "approach",
    minX: -6.4,
    maxX: -5.4,
    minZ: 29.0,
    maxZ: 39.8,
    height: 2.2,
  },
  {
    id: "approach-fence-east",
    kind: "approach",
    minX: 5.4,
    maxX: 6.4,
    minZ: 29.0,
    maxZ: 39.8,
    height: 2.2,
  },
  {
    id: "approach-backstop",
    kind: "approach",
    minX: -6.4,
    maxX: 6.4,
    minZ: 39.0,
    maxZ: 40.2,
    height: 2.0,
  },
  // Gothic Chapel Main Sanctuary Body (steps start at z = -34.0)
  {
    id: "chapel-sanctuary",
    kind: "chapel",
    minX: -7.8,
    maxX: 7.8,
    minZ: -43.2,
    maxZ: -35.8,
    height: 11.5,
  },
  // East Mausoleum North, South & Back Stone Walls (west portico entrance open at z in [-15.8, -12.2])
  {
    id: "mausoleum-north",
    kind: "mausoleum",
    minX: 13.0,
    maxX: 22.0,
    minZ: -18.5,
    maxZ: -16.2,
    height: 4.5,
  },
  {
    id: "mausoleum-south",
    kind: "mausoleum",
    minX: 13.0,
    maxX: 22.0,
    minZ: -11.8,
    maxZ: -9.5,
    height: 4.5,
  },
  {
    id: "mausoleum-east-back",
    kind: "mausoleum",
    minX: 20.6,
    maxX: 22.2,
    minZ: -18.5,
    maxZ: -9.5,
    height: 4.8,
  },
];

/** Dynamic iron gate blocker covering the archway when closed/locked */
export const GATE_DOOR_COLLIDER: AABBCollider = {
  id: "iron-gate-doors",
  kind: "gate",
  minX: -2.45,
  maxX: 2.45,
  minZ: 28.65,
  maxZ: 29.35,
  height: 3.6,
};

/** Antique iron lanterns flanking the central avenue & entrance */
export const LANTERN_SPECS: readonly LanternSpec[] = [
  { id: "lantern-gate-w", x: -3.0, z: 27.2, baseIntensity: 2.1, flickerSeed: 1.1 },
  { id: "lantern-gate-e", x: 3.0, z: 27.2, baseIntensity: 2.0, flickerSeed: 2.7 },
  { id: "lantern-ave-w1", x: -3.5, z: 14.0, baseIntensity: 1.65, flickerSeed: 4.2 },
  { id: "lantern-ave-e1", x: 3.5, z: 4.0, baseIntensity: 1.55, flickerSeed: 5.9 },
  { id: "lantern-ave-w2", x: -3.5, z: -10.0, baseIntensity: 1.75, flickerSeed: 7.4 },
  { id: "lantern-chapel-e", x: 3.6, z: -28.0, baseIntensity: 1.85, flickerSeed: 9.3 },
];

/** Generate deterministic 120-max tombstone layout (subset sliced by hardware preset) */
export const TOMBSTONE_LAYOUT: readonly TombstoneInstanceSpec[] = (() => {
  const items: TombstoneInstanceSpec[] = [];
  let idx = 0;

  // West burial field & East burial field rows
  const rowZValues = [-26, -21, -16, -11, -6, -1, 4, 9, 14, 19, 23];
  const colOffsets = [6.8, 11.2, 15.6, 20.0, 24.4, 28.8];

  for (let r = 0; r < rowZValues.length; r++) {
    const baseZ = rowZValues[r]!;
    for (let side = -1; side <= 1; side += 2) {
      for (let c = 0; c < colOffsets.length; c++) {
        if (items.length >= 120) break;
        const baseX = side * colOffsets[c]!;
        // Keep Mausoleum clearing & Crypt landing unobstructed
        if (baseX > 10.5 && baseX < 24.5 && baseZ > -21.0 && baseZ < -7.0) {
          continue;
        }
        // Keep Weeping Grove walkway center clear around (-14, 3)
        if (Math.hypot(baseX + 14.0, baseZ - 3.0) < 2.6) {
          continue;
        }
        idx += 1;
        const jx = (seededUnit(idx * 3 + 1) - 0.5) * 1.1;
        const jz = (seededUnit(idx * 3 + 2) - 0.5) * 1.1;
        items.push({
          id: `tomb-${idx}`,
          x: Number((baseX + jx).toFixed(3)),
          z: Number((baseZ + jz).toFixed(3)),
          rotY: (seededUnit(idx * 5 + 3) - 0.5) * 0.28 + (side < 0 ? 0.08 : -0.08),
          tiltX: (seededUnit(idx * 7 + 4) - 0.5) * 0.14,
          tiltZ: (seededUnit(idx * 11 + 5) - 0.5) * 0.16,
          scaleY: 0.85 + seededUnit(idx * 13 + 6) * 0.55,
          variant: idx % 5 === 0 ? "obelisk" : "lancet",
        });
      }
    }
  }
  return items;
})();

/** Deterministic gnarled dead trees framing the Weeping Grove & cemetery treeline */
export const DEAD_TREE_LAYOUT: readonly DeadTreeInstanceSpec[] = (() => {
  const coords: Array<[number, number, number]> = [
    [-20.5, 8.5, 1.15],
    [-19.2, -1.5, 1.25],
    [-11.0, 9.2, 0.98],
    [-10.2, -5.0, 1.05],
    [-24.5, -9.5, 1.3],
    [-27.5, 16.5, 1.22],
    [-30.5, -24.5, 1.35],
    [-17.8, -28.0, 1.1],
    [-11.8, -32.0, 0.95],
    [10.2, 22.0, 1.08],
    [26.0, 18.0, 1.28],
    [29.5, 4.5, 1.2],
    [28.5, -24.0, 1.32],
    [13.5, -31.5, 1.12],
    [-31.2, 4.0, 1.26],
    [31.5, -9.0, 1.22],
    [-22.0, 24.5, 1.14],
    [21.5, 25.0, 1.18],
    [-14.5, 18.0, 0.96],
    [16.0, 11.5, 1.02],
  ];

  // Expand cleanly up to 52 procedural perimeter & inner trees
  for (let i = coords.length; i < 52; i++) {
    const angle = (i / 52) * Math.PI * 2;
    const tx = Math.cos(angle) * (28.5 + (seededUnit(i * 19) - 0.5) * 5.2);
    const tz = -8 + Math.sin(angle) * (28.0 + (seededUnit(i * 23) - 0.5) * 4.8);
    // Keep south entrance gate aisle and chapel clear
    if (Math.abs(tx) < 6.0) continue;
    coords.push([
      Number(tx.toFixed(2)),
      Number(tz.toFixed(2)),
      0.9 + seededUnit(i * 29) * 0.45,
    ]);
  }

  return coords.map(([x, z, scale], i) => ({
    id: `dead-tree-${i + 1}`,
    x,
    z,
    rotY: seededUnit(i * 31 + 7) * Math.PI * 2,
    scale,
  }));
})();

export function buildCircleColliders(
  tombstoneCount = TOMBSTONE_LAYOUT.length,
  deadTreeCount = DEAD_TREE_LAYOUT.length,
): readonly CircleCollider[] {
  const colliders: CircleCollider[] = [];

  for (const lantern of LANTERN_SPECS) {
    colliders.push({
      id: lantern.id,
      kind: "lantern",
      x: lantern.x,
      z: lantern.z,
      radius: 0.42,
      height: 2.8,
    });
  }

  const maxTombs = Math.min(tombstoneCount, TOMBSTONE_LAYOUT.length);
  for (let i = 0; i < maxTombs; i++) {
    const t = TOMBSTONE_LAYOUT[i]!;
    colliders.push({
      id: t.id,
      kind: "tombstone",
      x: t.x,
      z: t.z,
      radius: t.variant === "obelisk" ? 0.62 : 0.55,
      height: 1.7 * t.scaleY,
    });
  }

  const maxTrees = Math.min(deadTreeCount, DEAD_TREE_LAYOUT.length);
  for (let i = 0; i < maxTrees; i++) {
    const tree = DEAD_TREE_LAYOUT[i]!;
    colliders.push({
      id: tree.id,
      kind: "tree",
      x: tree.x,
      z: tree.z,
      radius: 0.68 * tree.scale,
      height: 5.2 * tree.scale,
    });
  }

  return colliders;
}

/** Resolve horizontal circle-vs-AABB pushout */
function pushOutAABB(
  px: number,
  pz: number,
  radius: number,
  box: AABBCollider,
): [number, number] {
  const closestX = Math.max(box.minX, Math.min(px, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
  const dx = px - closestX;
  const dz = pz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return [px, pz];
  }

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    return [px + (dx / dist) * push, pz + (dz / dist) * push];
  }

  // Player center lies directly inside AABB: eject out of nearest face
  const distLeft = Math.abs(px - box.minX);
  const distRight = Math.abs(box.maxX - px);
  const distTop = Math.abs(pz - box.minZ);
  const distBottom = Math.abs(box.maxZ - pz);
  const minPen = Math.min(distLeft, distRight, distTop, distBottom);

  if (minPen === distLeft) return [box.minX - radius, pz];
  if (minPen === distRight) return [box.maxX + radius, pz];
  if (minPen === distTop) return [px, box.minZ - radius];
  return [px, box.maxZ + radius];
}

/** Resolve horizontal circle-vs-circle pushout */
function pushOutCircle(
  px: number,
  pz: number,
  playerRadius: number,
  obstacle: CircleCollider,
): [number, number] {
  const minSep = playerRadius + obstacle.radius;
  const dx = px - obstacle.x;
  const dz = pz - obstacle.z;
  const distSq = dx * dx + dz * dz;

  if (distSq >= minSep * minSep) {
    return [px, pz];
  }

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const push = minSep - dist;
    return [px + (dx / dist) * push, pz + (dz / dist) * push];
  }

  return [px, obstacle.z + minSep];
}

export interface MovementCollisionOptions {
  readonly gateLocked: boolean;
  readonly playerRadius?: number;
  readonly aabbColliders?: readonly AABBCollider[];
  readonly circleColliders?: readonly CircleCollider[];
}

/**
 * Deterministic iterative AABB + Circle sliding collision solver.
 * Sub-steps fast sprint vectors to prevent tunneling through thin fences/walls.
 */
export function resolvePlayerMovement(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  options: MovementCollisionOptions,
): { readonly x: number; readonly z: number; readonly collided: boolean } {
  const radius = options.playerRadius ?? PLAYER_RADIUS;
  const aabbs = options.aabbColliders ?? STATIC_AABB_COLLIDERS;
  const circles = options.circleColliders ?? buildCircleColliders();

  const totalDx = targetX - currentX;
  const totalDz = targetZ - currentZ;
  const totalDist = Math.hypot(totalDx, totalDz);
  const subSteps = Math.max(1, Math.min(6, Math.ceil(totalDist / 0.25)));

  let px = currentX;
  let pz = currentZ;
  let collided = false;

  for (let step = 1; step <= subSteps; step++) {
    px += totalDx / subSteps;
    pz += totalDz / subSteps;

    // 2 relaxation passes handle corner sliding cleanly
    for (let iter = 0; iter < 2; iter++) {
      for (const box of aabbs) {
        const [nx, nz] = pushOutAABB(px, pz, radius, box);
        if (nx !== px || nz !== pz) collided = true;
        px = nx;
        pz = nz;
      }

      if (options.gateLocked) {
        const [nx, nz] = pushOutAABB(px, pz, radius, GATE_DOOR_COLLIDER);
        if (nx !== px || nz !== pz) collided = true;
        px = nx;
        pz = nz;
      }

      for (const c of circles) {
        const [nx, nz] = pushOutCircle(px, pz, radius, c);
        if (nx !== px || nz !== pz) collided = true;
        px = nx;
        pz = nz;
      }

      // Clamp inside outer horizon perimeter
      const clampedX = Math.max(
        WORLD_OUTER_BOUNDS.minX,
        Math.min(WORLD_OUTER_BOUNDS.maxX, px),
      );
      const clampedZ = Math.max(
        WORLD_OUTER_BOUNDS.minZ,
        Math.min(WORLD_OUTER_BOUNDS.maxZ, pz),
      );
      if (clampedX !== px || clampedZ !== pz) collided = true;
      px = clampedX;
      pz = clampedZ;
    }
  }

  return { x: px, z: pz, collided };
}

export function resolveZoneAtPosition(x: number, z: number): CemeteryZoneId {
  if (z >= 21.5) return "gatehouse";
  if (z <= -28.0) return "chapel_steps";
  if (x >= 10.5 && z >= -20.5 && z <= -7.5) return "mausoleum";
  if (Math.abs(x) <= 4.5 && z <= -19.0 && z > -28.0) return "crypt_entrance";
  if (x <= -8.5) return "weeping_grove";
  return "central_path";
}

export function isOnStonePaving(x: number, z: number): boolean {
  if (Math.abs(x) <= 2.6 && z >= -35.8 && z <= 38.0) return true;
  if (z <= -29.0 && Math.abs(x) <= 6.2) return true;
  if (x >= 11.0 && x <= 20.5 && z >= -18.0 && z <= -10.0) return true;
  return false;
}

export const ZONE_TELEPORT_TARGETS: readonly ZoneTeleportTarget[] = [
  {
    zoneId: "gatehouse",
    label: "Iron Gatehouse",
    position: [0, PLAYER_EYE_HEIGHT, 25.0],
    yaw: Math.PI, // Look back at locked iron gate
  },
  {
    zoneId: "central_path",
    label: "Central Avenue",
    position: [0, PLAYER_EYE_HEIGHT, 8.0],
    yaw: 0,
  },
  {
    zoneId: "weeping_grove",
    label: "Weeping Grove",
    position: [-14.0, PLAYER_EYE_HEIGHT, 3.0],
    yaw: 0.4,
  },
  {
    zoneId: "mausoleum",
    label: "East Mausoleum",
    position: [11.0, PLAYER_EYE_HEIGHT, -14.0],
    yaw: -Math.PI / 2,
  },
  {
    zoneId: "chapel_steps",
    label: "Chapel Steps",
    position: [0, PLAYER_EYE_HEIGHT, -31.5],
    yaw: 0,
  },
  {
    zoneId: "crypt_entrance",
    label: "Crypt Threshold",
    position: [0, PLAYER_EYE_HEIGHT, -23.0],
    yaw: 0,
  },
];
