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
/** Standing eye height above walkable floor in meters */
export const PLAYER_EYE_HEIGHT = 1.7;

/** Outer walkable ground perimeter bounds */
export const WORLD_OUTER_BOUNDS = {
  minX: -35.4,
  maxX: 35.4,
  minZ: -43.2,
  maxZ: 38.4,
  cryptMinZ: -58.4,
} as const;

/**
 * Seeded deterministic pseudo-random helper in [0, 1) so geometry placement and
 * collision shapes stay 100% identical across SSR tests and browser renders.
 */
export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Returns deterministic walkable floor height (y of feet) for Zone A-D ground,
 * Chapel raised nave, East Chapel stairway descent, and Zone E Underground Crypt.
 */
export function getWalkableFloorHeight(
  x: number,
  z: number,
  currentFeetY = 0,
): number {
  // Stairway ramp in Chapel East sanctuary (x in [2.3, 5.6], z in [-51.0, -40.8])
  if (x >= 2.25 && x <= 5.65 && z <= -40.8 && z >= -51.0) {
    const t = Math.max(0, Math.min(1, (-40.8 - z) / 10.2));
    return Number((0.3 - t * 4.8).toFixed(4));
  }

  // Subterranean Zone E Crypt level
  if (currentFeetY < -1.0 || z < -50.8) {
    return -4.5;
  }

  // Chapel Sanctuary Interior Floor
  if (x >= -7.5 && x <= 7.5 && z <= -34.0 && z >= -43.8) {
    return 0.3;
  }

  // Chapel Front Stone Steps ramp (z from -31.6 to -34.0)
  if (Math.abs(x) <= 3.4 && z <= -31.6 && z > -34.0) {
    const stepFrac = (-31.6 - z) / 2.4;
    return Number((stepFrac * 0.3).toFixed(4));
  }

  // East Mausoleum stone plinth
  if (x >= 13.0 && x <= 21.0 && z >= -17.5 && z <= -10.5) {
    return 0.12;
  }

  return 0;
}

export function isInsideChapelFloorboards(
  x: number,
  z: number,
  feetY = 0,
): boolean {
  if (feetY < -0.5) return false;
  return x >= -7.1 && x <= 7.1 && z <= -34.2 && z >= -43.3;
}

export function isInUndergroundCrypt(z: number, feetY = 0): boolean {
  return feetY < -0.9 || z < -49.5;
}

/** Static AABB obstacles (layered with minY/maxY for surface vs Zone E crypt isolation) */
export const STATIC_AABB_COLLIDERS: readonly AABBCollider[] = [
  // North Boundary Stone Wall split cleanly around the Gothic Chapel (-8.2..8.2)
  {
    id: "wall-north-west",
    kind: "wall",
    minX: -36.6,
    maxX: -8.1,
    minZ: -44.6,
    maxZ: -43.4,
    height: 3.4,
    minY: -0.5,
    maxY: 6.0,
  },
  {
    id: "wall-north-east",
    kind: "wall",
    minX: 8.1,
    maxX: 36.6,
    minZ: -44.6,
    maxZ: -43.4,
    height: 3.4,
    minY: -0.5,
    maxY: 6.0,
  },
  // West & East Boundary Stone Walls
  {
    id: "wall-west",
    kind: "wall",
    minX: -36.6,
    maxX: -35.4,
    minZ: -44.6,
    maxZ: 29.6,
    height: 3.2,
    minY: -0.5,
    maxY: 6.0,
  },
  {
    id: "wall-east",
    kind: "wall",
    minX: 35.4,
    maxX: 36.6,
    minZ: -44.6,
    maxZ: 29.6,
    height: 3.2,
    minY: -0.5,
    maxY: 6.0,
  },
  // South Perimeter Walls flanking Zone A Wrought-Iron Gatehouse
  {
    id: "wall-south-west",
    kind: "wall",
    minX: -36.6,
    maxX: -3.5,
    minZ: 28.4,
    maxZ: 29.6,
    height: 3.2,
    minY: -0.5,
    maxY: 6.0,
  },
  {
    id: "wall-south-east",
    kind: "wall",
    minX: 3.5,
    maxX: 36.6,
    minZ: 28.4,
    maxZ: 29.6,
    height: 3.2,
    minY: -0.5,
    maxY: 6.0,
  },
  // Carved Stone Gatehouse Pillars
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
  // South Approach Corridor Fences (outside gate prior to transition)
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
  // Zone B Clue 01 Engraved Slab Monument
  {
    id: "monument-clue-01",
    kind: "pillar",
    minX: -7.75,
    maxX: -6.65,
    minZ: 11.75,
    maxZ: 12.65,
    height: 2.1,
    minY: -0.5,
    maxY: 4.0,
  },
  // Zone C Dead Garden Stone Benches & Ruined Hedge Parapets
  {
    id: "garden-bench-north",
    kind: "bench",
    minX: -17.3,
    maxX: -14.7,
    minZ: -13.7,
    maxZ: -12.7,
    height: 0.75,
    minY: -0.5,
    maxY: 3.0,
  },
  {
    id: "garden-bench-south",
    kind: "bench",
    minX: -17.3,
    maxX: -14.7,
    minZ: -5.3,
    maxZ: -4.3,
    height: 0.75,
    minY: -0.5,
    maxY: 3.0,
  },
  {
    id: "garden-bench-west",
    kind: "bench",
    minX: -20.8,
    maxX: -19.8,
    minZ: -10.3,
    maxZ: -7.7,
    height: 0.75,
    minY: -0.5,
    maxY: 3.0,
  },
  {
    id: "garden-parapet-west",
    kind: "wall",
    minX: -25.2,
    maxX: -24.1,
    minZ: -16.5,
    maxZ: -3.0,
    height: 1.5,
    minY: -0.5,
    maxY: 4.0,
  },
  {
    id: "garden-parapet-nw",
    kind: "wall",
    minX: -24.5,
    maxX: -17.5,
    minZ: -17.5,
    maxZ: -16.4,
    height: 1.5,
    minY: -0.5,
    maxY: 4.0,
  },
  // Clue 03 Caretaker's Lectern (North of Dead Garden concealed path near Chapel)
  {
    id: "monument-clue-03",
    kind: "pillar",
    minX: -11.75,
    maxX: -10.65,
    minZ: -25.05,
    maxZ: -23.95,
    height: 1.6,
    minY: -0.5,
    maxY: 4.0,
  },
  // Zone D Enterable Abandoned Gothic Chapel Walls (Open front doors at x in [-1.75, +1.75])
  {
    id: "chapel-wall-sw",
    kind: "chapel",
    minX: -8.2,
    maxX: -1.75,
    minZ: -34.7,
    maxZ: -33.7,
    height: 10.5,
    minY: -0.5,
    maxY: 12.0,
  },
  {
    id: "chapel-wall-se",
    kind: "chapel",
    minX: 1.75,
    maxX: 8.2,
    minZ: -34.7,
    maxZ: -33.7,
    height: 10.5,
    minY: -0.5,
    maxY: 12.0,
  },
  {
    id: "chapel-wall-west",
    kind: "chapel",
    minX: -8.2,
    maxX: -7.1,
    minZ: -44.2,
    maxZ: -33.7,
    height: 10.5,
    minY: -0.5,
    maxY: 12.0,
  },
  {
    id: "chapel-wall-east",
    kind: "chapel",
    minX: 7.1,
    maxX: 8.2,
    minZ: -44.2,
    maxZ: -33.7,
    height: 10.5,
    minY: -0.5,
    maxY: 12.0,
  },
  {
    id: "chapel-wall-nw",
    kind: "chapel",
    minX: -8.2,
    maxX: 2.45,
    minZ: -44.3,
    maxZ: -43.2,
    height: 10.5,
    minY: -0.5,
    maxY: 12.0,
  },
  {
    id: "chapel-wall-ne",
    kind: "chapel",
    minX: 5.55,
    maxX: 8.2,
    minZ: -44.3,
    maxZ: -43.2,
    height: 10.5,
    minY: -0.5,
    maxY: 12.0,
  },
  // Chapel Altar & Timber Pews
  {
    id: "chapel-altar",
    kind: "chapel",
    minX: -1.65,
    maxX: 1.65,
    minZ: -42.3,
    maxZ: -40.7,
    height: 1.4,
    minY: -0.5,
    maxY: 4.0,
  },
  {
    id: "chapel-pew-w1",
    kind: "bench",
    minX: -5.6,
    maxX: -2.3,
    minZ: -39.2,
    maxZ: -38.3,
    height: 1.0,
    minY: -0.5,
    maxY: 3.0,
  },
  {
    id: "chapel-pew-w2",
    kind: "bench",
    minX: -5.6,
    maxX: -2.3,
    minZ: -37.2,
    maxZ: -36.3,
    height: 1.0,
    minY: -0.5,
    maxY: 3.0,
  },
  // East Chapel Stairwell Enclosing Chute Walls (span upper & subterranean height)
  {
    id: "stair-wall-west",
    kind: "crypt",
    minX: 1.9,
    maxX: 2.48,
    minZ: -51.4,
    maxZ: -40.9,
    height: 7.0,
    minY: -6.0,
    maxY: 5.0,
  },
  {
    id: "stair-wall-east",
    kind: "crypt",
    minX: 5.52,
    maxX: 6.3,
    minZ: -58.6,
    maxZ: -40.9,
    height: 7.0,
    minY: -6.0,
    maxY: 5.0,
  },
  // Zone E Underground Crypt Subterranean Walls & Sarcophagi (only active when playerFeetY < -0.7)
  {
    id: "crypt-wall-north",
    kind: "crypt",
    minX: -7.5,
    maxX: 6.3,
    minZ: -59.2,
    maxZ: -58.1,
    height: 4.0,
    minY: -6.0,
    maxY: -0.7,
  },
  {
    id: "crypt-corridor-south-divider",
    kind: "crypt",
    minX: -1.4,
    maxX: 2.48,
    minZ: -54.2,
    maxZ: -52.8,
    height: 4.0,
    minY: -6.0,
    maxY: -0.7,
  },
  {
    id: "crypt-wall-west",
    kind: "crypt",
    minX: -7.5,
    maxX: -6.6,
    minZ: -59.2,
    maxZ: -49.0,
    height: 4.0,
    minY: -6.0,
    maxY: -0.7,
  },
  {
    id: "crypt-chamber-north",
    kind: "crypt",
    minX: -7.5,
    maxX: -0.4,
    minZ: -50.2,
    maxZ: -49.0,
    height: 4.0,
    minY: -6.0,
    maxY: -0.7,
  },
  {
    id: "crypt-chamber-east",
    kind: "crypt",
    minX: -1.3,
    maxX: -0.4,
    minZ: -54.2,
    maxZ: -49.0,
    height: 4.0,
    minY: -6.0,
    maxY: -0.7,
  },
  {
    id: "crypt-sarcophagus-1",
    kind: "sarcophagus",
    minX: -5.3,
    maxX: -3.1,
    minZ: -56.1,
    maxZ: -54.7,
    height: 1.25,
    minY: -6.0,
    maxY: -0.7,
  },
  {
    id: "crypt-sarcophagus-2",
    kind: "sarcophagus",
    minX: -0.2,
    maxX: 1.9,
    minZ: -57.9,
    maxZ: -56.5,
    height: 1.25,
    minY: -6.0,
    maxY: -0.7,
  },
  // East Mausoleum Portico Walls
  {
    id: "mausoleum-north",
    kind: "mausoleum",
    minX: 13.0,
    maxX: 22.0,
    minZ: -18.5,
    maxZ: -16.2,
    height: 4.5,
    minY: -0.5,
    maxY: 6.0,
  },
  {
    id: "mausoleum-south",
    kind: "mausoleum",
    minX: 13.0,
    maxX: 22.0,
    minZ: -11.8,
    maxZ: -9.5,
    height: 4.5,
    minY: -0.5,
    maxY: 6.0,
  },
  {
    id: "mausoleum-east-back",
    kind: "mausoleum",
    minX: 20.6,
    maxX: 22.2,
    minZ: -18.5,
    maxZ: -9.5,
    height: 4.8,
    minY: -0.5,
    maxY: 6.0,
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

/** Antique iron lanterns flanking Zone A-D paths */
export const LANTERN_SPECS: readonly LanternSpec[] = [
  { id: "lantern-gate-w", x: -3.0, z: 27.2, baseIntensity: 2.1, flickerSeed: 1.1 },
  { id: "lantern-gate-e", x: 3.0, z: 27.2, baseIntensity: 2.0, flickerSeed: 2.7 },
  { id: "lantern-ave-w1", x: -3.5, z: 14.0, baseIntensity: 1.65, flickerSeed: 4.2 },
  { id: "lantern-garden-c", x: -12.8, z: -3.8, baseIntensity: 1.55, flickerSeed: 5.9 },
  { id: "lantern-caretaker", x: -10.0, z: -24.0, baseIntensity: 1.75, flickerSeed: 7.4 },
  { id: "lantern-chapel-e", x: 3.6, z: -31.8, baseIntensity: 1.85, flickerSeed: 9.3 },
];

/** Crumbling Stone Fountain centerpiece in Zone C */
export const DEAD_GARDEN_FOUNTAIN = {
  id: "dead-garden-fountain",
  x: -16.0,
  z: -9.0,
  radius: 1.95,
} as const;

/** Generate deterministic 120-max tombstone layout across Zone B & eastern/western fields */
export const TOMBSTONE_LAYOUT: readonly TombstoneInstanceSpec[] = (() => {
  const items: TombstoneInstanceSpec[] = [];
  let idx = 0;

  const rowZValues = [-26, -21, -16, -11, -6, -1, 4, 9, 14, 19, 23];
  const colOffsets = [6.8, 11.2, 15.6, 20.0, 24.4, 28.8];

  for (let r = 0; r < rowZValues.length; r++) {
    const baseZ = rowZValues[r]!;
    for (let side = -1; side <= 1; side += 2) {
      for (let c = 0; c < colOffsets.length; c++) {
        if (items.length >= 120) break;
        const baseX = side * colOffsets[c]!;
        // Keep Mausoleum clearing unobstructed
        if (baseX > 10.5 && baseX < 24.5 && baseZ > -21.0 && baseZ < -7.0) {
          continue;
        }
        // Keep Zone C Dead Garden fountain, benches & concealed trail unobstructed
        if (baseX >= -26.0 && baseX <= -9.0 && baseZ >= -27.5 && baseZ <= 1.5) {
          continue;
        }
        // Keep Zone B Clue 01 examination clearing & Encounter 01 alcove open
        if (Math.hypot(baseX + 7.2, baseZ - 12.2) < 2.2) continue;
        if (Math.hypot(baseX - 8.4, baseZ - 9.2) < 1.9) continue;

        idx += 1;
        const jx = (seededUnit(idx * 3 + 1) - 0.5) * 0.95;
        const jz = (seededUnit(idx * 3 + 2) - 0.5) * 0.95;
        const variant =
          idx % 6 === 0 ? "celtic" : idx % 4 === 0 ? "obelisk" : "lancet";

        items.push({
          id: `tomb-${idx}`,
          x: Number((baseX + jx).toFixed(3)),
          z: Number((baseZ + jz).toFixed(3)),
          rotY: (seededUnit(idx * 5 + 3) - 0.5) * 0.28 + (side < 0 ? 0.08 : -0.08),
          tiltX: (seededUnit(idx * 7 + 4) - 0.5) * 0.14,
          tiltZ: (seededUnit(idx * 11 + 5) - 0.5) * 0.16,
          scaleY: 0.85 + seededUnit(idx * 13 + 6) * 0.55,
          variant,
        });
      }
    }
  }
  return items;
})();

/** Deterministic gnarled dead trees framing Zone A-C perimeter & glades */
export const DEAD_TREE_LAYOUT: readonly DeadTreeInstanceSpec[] = (() => {
  const coords: Array<[number, number, number]> = [
    [-21.5, 9.5, 1.15],
    [-22.2, -1.0, 1.25],
    [-9.8, 17.5, 0.98],
    [-26.5, -11.5, 1.3],
    [-27.5, 16.5, 1.22],
    [-30.5, -24.5, 1.35],
    [-19.8, -28.0, 1.1],
    [-14.8, -32.0, 0.95],
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

  for (let i = coords.length; i < 52; i++) {
    const angle = (i / 52) * Math.PI * 2;
    const tx = Math.cos(angle) * (29.0 + (seededUnit(i * 19) - 0.5) * 4.5);
    const tz = -8 + Math.sin(angle) * (28.0 + (seededUnit(i * 23) - 0.5) * 4.5);
    if (Math.abs(tx) < 7.0) continue;
    if (tx >= -25 && tx <= -9 && tz >= -27 && tz <= 0) continue;
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

  // Dead Garden Crumbling Fountain & flanking Weeping Statues (ground level)
  colliders.push(
    {
      id: DEAD_GARDEN_FOUNTAIN.id,
      kind: "fountain",
      x: DEAD_GARDEN_FOUNTAIN.x,
      z: DEAD_GARDEN_FOUNTAIN.z,
      radius: DEAD_GARDEN_FOUNTAIN.radius,
      height: 3.1,
      minY: -0.5,
      maxY: 5.0,
    },
    {
      id: "statue-weeping-w",
      kind: "statue",
      x: -22.2,
      z: -14.2,
      radius: 0.72,
      height: 2.5,
      minY: -0.5,
      maxY: 4.0,
    },
    {
      id: "statue-weeping-e",
      kind: "statue",
      x: -10.8,
      z: -14.8,
      radius: 0.72,
      height: 2.5,
      minY: -0.5,
      maxY: 4.0,
    },
  );

  for (const lantern of LANTERN_SPECS) {
    colliders.push({
      id: lantern.id,
      kind: "lantern",
      x: lantern.x,
      z: lantern.z,
      radius: 0.42,
      height: 2.8,
      minY: -0.5,
      maxY: 5.0,
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
      minY: -0.5,
      maxY: 4.0,
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
      minY: -0.5,
      maxY: 7.0,
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
  readonly playerFeetY?: number;
  readonly playerRadius?: number;
  readonly aabbColliders?: readonly AABBCollider[];
  readonly circleColliders?: readonly CircleCollider[];
}

/**
 * Deterministic iterative AABB + Circle sliding collision solver across all 5 zones.
 * Respects vertical separation (surface cemetery vs Underground Crypt) and prevents tunneling.
 */
export function resolvePlayerMovement(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  options: MovementCollisionOptions,
): { readonly x: number; readonly z: number; readonly collided: boolean } {
  const radius = options.playerRadius ?? PLAYER_RADIUS;
  const feetY = options.playerFeetY ?? 0;
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

    for (let iter = 0; iter < 2; iter++) {
      for (const box of aabbs) {
        const minY = box.minY ?? -1.0;
        const maxY = box.maxY ?? 15.0;
        if (feetY < minY || feetY > maxY) continue;

        const [nx, nz] = pushOutAABB(px, pz, radius, box);
        if (nx !== px || nz !== pz) collided = true;
        px = nx;
        pz = nz;
      }

      if (options.gateLocked && feetY >= -0.5) {
        const [nx, nz] = pushOutAABB(px, pz, radius, GATE_DOOR_COLLIDER);
        if (nx !== px || nz !== pz) collided = true;
        px = nx;
        pz = nz;
      }

      for (const c of circles) {
        const minY = c.minY ?? -1.0;
        const maxY = c.maxY ?? 15.0;
        if (feetY < minY || feetY > maxY) continue;

        const [nx, nz] = pushOutCircle(px, pz, radius, c);
        if (nx !== px || nz !== pz) collided = true;
        px = nx;
        pz = nz;
      }

      // Allow deeper North extension inside East Chapel Stairwell & Underground Crypt
      const allowDeepCrypt =
        feetY < -0.2 || (px >= 2.1 && px <= 5.8 && pz <= -40.5);
      const minZLimit = allowDeepCrypt
        ? WORLD_OUTER_BOUNDS.cryptMinZ
        : WORLD_OUTER_BOUNDS.minZ;

      const clampedX = Math.max(
        WORLD_OUTER_BOUNDS.minX,
        Math.min(WORLD_OUTER_BOUNDS.maxX, px),
      );
      const clampedZ = Math.max(
        minZLimit,
        Math.min(WORLD_OUTER_BOUNDS.maxZ, pz),
      );
      if (clampedX !== px || clampedZ !== pz) collided = true;
      px = clampedX;
      pz = clampedZ;
    }
  }

  return { x: px, z: pz, collided };
}

export function resolveZoneAtPosition(
  x: number,
  z: number,
  eyeY = PLAYER_EYE_HEIGHT,
): CemeteryZoneId {
  if (eyeY < -0.5 || z <= -45.0) return "crypt_entrance";
  if (z >= 21.5) return "gatehouse";
  if (z <= -28.0 && Math.abs(x) <= 10.5) return "chapel_steps";
  if (x <= -8.0 && z < 1.5 && z >= -28.5) return "dead_garden";
  if (x >= 10.5 && z >= -20.5 && z <= -7.5) return "mausoleum";
  if (z >= 1.5 && z < 21.5) return "forgotten_graves";
  return "chapel_steps";
}

export function isOnStonePaving(
  x: number,
  z: number,
  feetY = 0,
): boolean {
  if (feetY < -0.5) return true;
  if (Math.abs(x) <= 2.6 && z >= -34.2 && z <= 38.0) return true;
  if (z <= -29.0 && z >= -34.2 && Math.abs(x) <= 6.2) return true;
  if (x >= -15.5 && x <= -9.5 && z >= -26.5 && z <= -12.0) return true;
  if (x >= 11.0 && x <= 20.5 && z >= -18.0 && z <= -10.0) return true;
  return false;
}

export const ZONE_TELEPORT_TARGETS: readonly ZoneTeleportTarget[] = [
  {
    zoneId: "gatehouse",
    code: "A",
    label: "Zone A: Entrance",
    position: [0, PLAYER_EYE_HEIGHT, 25.0],
    yaw: Math.PI,
  },
  {
    zoneId: "forgotten_graves",
    code: "B",
    label: "Zone B: Forgotten Graves",
    position: [0, PLAYER_EYE_HEIGHT, 10.0],
    yaw: 0.48,
  },
  {
    zoneId: "dead_garden",
    code: "C",
    label: "Zone C: Dead Garden",
    position: [-16.0, PLAYER_EYE_HEIGHT, -2.5],
    yaw: 0.08,
  },
  {
    zoneId: "chapel_steps",
    code: "D",
    label: "Zone D: Chapel Steps & Nave",
    position: [0, PLAYER_EYE_HEIGHT, -31.5],
    yaw: 0,
  },
  {
    zoneId: "crypt_entrance",
    code: "E",
    label: "Zone E: Underground Crypt",
    position: [4.0, -4.5 + PLAYER_EYE_HEIGHT, -53.2],
    yaw: Math.PI / 2,
  },
];
