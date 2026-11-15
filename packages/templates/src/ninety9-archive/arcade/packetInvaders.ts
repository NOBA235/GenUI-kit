import {
  ARCADE_CANVAS_H,
  ARCADE_CANVAS_W,
  type ArcadeDifficultyPreset,
  type ArcadeGameStatus,
  type ArcadePaletteColors,
  type ArcadeSfxEvent,
} from "./types.js";

export interface InvaderEntity {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly row: number;
  readonly points: number;
  readonly alive: boolean;
}

export interface BunkerBlock {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly hp: number;
}

export interface Projectile {
  readonly x: number;
  readonly y: number;
  readonly dy: number;
}

export interface PacketInvadersState {
  readonly width: number;
  readonly height: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly playerWidth: number;
  readonly playerHeight: number;
  readonly playerCooldown: number;
  readonly enemyFireCooldown: number;
  readonly invaderDir: 1 | -1;
  readonly invaderRows: number;
  readonly invaders: readonly InvaderEntity[];
  readonly bunkers: readonly BunkerBlock[];
  readonly playerBullets: readonly Projectile[];
  readonly enemyBullets: readonly Projectile[];
  readonly ufoActive: boolean;
  readonly ufoX: number;
  readonly ufoDir: 1 | -1;
  readonly tick: number;
  readonly score: number;
  readonly lives: number;
  readonly wave: number;
  readonly difficultyPreset: ArcadeDifficultyPreset;
  readonly status: ArcadeGameStatus;
  readonly seed: number;
}

const INVADER_COLS = 8;
const INVADER_W = 24;
const INVADER_H = 18;

// Original 1-bit pixel matrices (copyright-free procedural glyph bitmaps)
const SPRITE_FRAMES_A = [
  [
    "01000010",
    "00111100",
    "01111110",
    "11011011",
    "11111111",
    "01011010",
  ],
  [
    "00111100",
    "01111110",
    "11011011",
    "11111111",
    "01011010",
    "10100101",
  ],
] as const;

const SPRITE_FRAMES_B = [
  [
    "00111100",
    "11111111",
    "11011011",
    "01111110",
    "10100101",
    "01000010",
  ],
  [
    "00111100",
    "11111111",
    "11011011",
    "01111110",
    "01011010",
    "10100101",
  ],
] as const;

function clampInvaderRows(raw: number): number {
  if (!Number.isFinite(raw)) return 4;
  return Math.max(2, Math.min(5, Math.round(raw)));
}

function nextPrng(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function createInvaderWave(rows: number, wave: number): InvaderEntity[] {
  const out: InvaderEntity[] = [];
  const startX = 68;
  const startY = 46 + Math.min(24, (wave - 1) * 6);
  const gapX = 44;
  const gapY = 30;
  let id = 0;

  for (let r = 0; r < rows; r++) {
    const points = r === 0 ? 30 : r === 1 ? 20 : 10;
    for (let c = 0; c < INVADER_COLS; c++) {
      out.push({
        id: id++,
        x: startX + c * gapX,
        y: startY + r * gapY,
        w: INVADER_W,
        h: INVADER_H,
        row: r,
        points,
        alive: true,
      });
    }
  }
  return out;
}

function createFirewallBunkers(): BunkerBlock[] {
  const blocks: BunkerBlock[] = [];
  const bunkerPositions = [64, 166, 268, 370];
  const baseY = ARCADE_CANVAS_H - 72;

  for (const bx of bunkerPositions) {
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        blocks.push({
          x: bx + col * 14,
          y: baseY + row * 10,
          w: 13,
          h: 9,
          hp: 2,
        });
      }
    }
  }
  return blocks;
}

export function createPacketInvadersState(options: {
  readonly invaderRows?: number;
  readonly difficultyPreset?: ArcadeDifficultyPreset;
  readonly seed?: number;
} = {}): PacketInvadersState {
  const invaderRows = clampInvaderRows(options.invaderRows ?? 4);
  const preset = options.difficultyPreset ?? "standard-1995";
  const playerWidth = 34;

  return {
    width: ARCADE_CANVAS_W,
    height: ARCADE_CANVAS_H,
    playerX: Math.floor((ARCADE_CANVAS_W - playerWidth) / 2),
    playerY: ARCADE_CANVAS_H - 28,
    playerWidth,
    playerHeight: 14,
    playerCooldown: 0,
    enemyFireCooldown: preset === "turbo-y2k" ? 20 : 34,
    invaderDir: 1,
    invaderRows,
    invaders: createInvaderWave(invaderRows, 1),
    bunkers: createFirewallBunkers(),
    playerBullets: [],
    enemyBullets: [],
    ufoActive: false,
    ufoX: 20,
    ufoDir: 1,
    tick: 0,
    score: 0,
    lives: 3,
    wave: 1,
    difficultyPreset: preset,
    status: "ready",
    seed: options.seed ?? 1999,
  };
}

export function clampCannonX(rawX: number, width: number, playerWidth: number): number {
  return Math.max(12, Math.min(width - playerWidth - 12, rawX));
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function stepPacketInvadersState(
  state: PacketInvadersState,
  input: {
    readonly move: -1 | 0 | 1;
    readonly fire?: boolean;
  }
): {
  readonly nextState: PacketInvadersState;
  readonly sfx: readonly ArcadeSfxEvent[];
} {
  if (state.status !== "playing") {
    return { nextState: state, sfx: [] };
  }

  const sfx: ArcadeSfxEvent[] = [];
  const nextTick = state.tick + 1;
  let nextSeed = state.seed;
  const moveStep = 5.5;
  const nextPlayerX = clampCannonX(
    state.playerX + input.move * moveStep,
    state.width,
    state.playerWidth
  );

  // Player laser fire (capped at 3 concurrent bolts)
  let nextCooldown = Math.max(0, state.playerCooldown - 1);
  let pBullets = state.playerBullets.map((b) => ({ ...b, y: b.y + b.dy }));
  if (input.fire && nextCooldown === 0 && pBullets.length < 3) {
    pBullets.push({
      x: nextPlayerX + Math.floor(state.playerWidth / 2) - 1,
      y: state.playerY - 6,
      dy: -7,
    });
    nextCooldown = state.difficultyPreset === "turbo-y2k" ? 9 : 13;
    sfx.push("shoot");
  }
  pBullets = pBullets.filter((b) => b.y > 10);

  let eBullets = state.enemyBullets
    .map((b) => ({ ...b, y: b.y + b.dy }))
    .filter((b) => b.y < state.height - 6);

  // Move optional bonus Y2K UFO
  let ufoActive = state.ufoActive;
  let ufoX = state.ufoX;
  let ufoDir = state.ufoDir;
  if (!ufoActive && nextTick % 260 === 140) {
    ufoActive = true;
    ufoDir = (nextTick / 260) % 2 === 0 ? 1 : -1;
    ufoX = ufoDir === 1 ? 12 : state.width - 42;
  } else if (ufoActive) {
    ufoX += ufoDir * 2.4;
    if (ufoX < 8 || ufoX + 30 > state.width - 8) {
      ufoActive = false;
    }
  }

  // Invader fleet step speed scales as bugs are eliminated
  let invaders = state.invaders.map((inv) => ({ ...inv }));
  const aliveInvaders = invaders.filter((i) => i.alive);
  const aliveRatio = aliveInvaders.length / Math.max(1, invaders.length);
  const presetMod =
    state.difficultyPreset === "turbo-y2k"
      ? 2
      : state.difficultyPreset === "zen-91"
        ? 4
        : 3;
  const stepPeriod = Math.max(1, Math.round(presetMod * (0.4 + aliveRatio * 0.8)));

  let nextDir = state.invaderDir;
  if (aliveInvaders.length > 0 && nextTick % stepPeriod === 0) {
    const horizSpeed = 4 + Math.min(4, state.wave - 1);
    const hitsEdge = aliveInvaders.some((inv) => {
      const targetX = inv.x + nextDir * horizSpeed;
      return targetX < 14 || targetX + inv.w > state.width - 14;
    });
    if (hitsEdge) {
      nextDir = (nextDir === 1 ? -1 : 1) as 1 | -1;
      invaders = invaders.map((inv) =>
        inv.alive ? { ...inv, y: inv.y + 12 } : inv
      );
    } else {
      invaders = invaders.map((inv) =>
        inv.alive ? { ...inv, x: inv.x + nextDir * horizSpeed } : inv
      );
    }
  }

  // Resolve Player Bullets -> UFO, Invaders, Bunkers
  let bunkers = state.bunkers.map((b) => ({ ...b }));
  let nextScore = state.score;
  const survivingPBullets: Projectile[] = [];

  for (const pb of pBullets) {
    let consumed = false;

    if (ufoActive && rectsOverlap(pb.x, pb.y, 3, 8, ufoX, 16, 30, 12)) {
      ufoActive = false;
      nextScore += 100;
      consumed = true;
      sfx.push("clear");
    }

    if (!consumed) {
      for (const bunker of bunkers) {
        if (bunker.hp > 0 && rectsOverlap(pb.x, pb.y, 3, 8, bunker.x, bunker.y, bunker.w, bunker.h)) {
          (bunker as { hp: number }).hp -= 1;
          consumed = true;
          sfx.push("hit");
          break;
        }
      }
    }

    if (!consumed) {
      for (const inv of invaders) {
        if (inv.alive && rectsOverlap(pb.x, pb.y, 3, 8, inv.x, inv.y, inv.w, inv.h)) {
          (inv as { alive: boolean }).alive = false;
          nextScore += inv.points;
          consumed = true;
          sfx.push("hit");
          break;
        }
      }
    }

    if (!consumed) {
      survivingPBullets.push(pb);
    }
  }

  // Enemy Shooting Cadence
  let nextEnemyCooldown = state.enemyFireCooldown - 1;
  const postHitAlive = invaders.filter((i) => i.alive);
  if (nextEnemyCooldown <= 0 && postHitAlive.length > 0 && eBullets.length < 4) {
    nextSeed = nextPrng(nextSeed);
    const shooter = postHitAlive[nextSeed % postHitAlive.length]!;
    eBullets.push({
      x: shooter.x + Math.floor(shooter.w / 2),
      y: shooter.y + shooter.h + 2,
      dy: state.difficultyPreset === "turbo-y2k" ? 4.6 : 3.8,
    });
    const baseCd =
      state.difficultyPreset === "turbo-y2k"
        ? 22
        : state.difficultyPreset === "zen-91"
          ? 44
          : 32;
    nextEnemyCooldown = Math.max(12, baseCd - (state.wave - 1) * 3);
  }

  // Enemy Bullets -> Bunkers & Cannon
  let nextLives = state.lives;
  const survivingEBullets: Projectile[] = [];
  for (const eb of eBullets) {
    let consumed = false;
    for (const bunker of bunkers) {
      if (bunker.hp > 0 && rectsOverlap(eb.x, eb.y, 3, 8, bunker.x, bunker.y, bunker.w, bunker.h)) {
        (bunker as { hp: number }).hp -= 1;
        consumed = true;
        break;
      }
    }
    if (
      !consumed &&
      rectsOverlap(eb.x, eb.y, 3, 8, nextPlayerX, state.playerY, state.playerWidth, state.playerHeight)
    ) {
      nextLives -= 1;
      consumed = true;
      sfx.push("hit");
    }
    if (!consumed) {
      survivingEBullets.push(eb);
    }
  }

  bunkers = bunkers.filter((b) => b.hp > 0);

  // Breach check (if bugs touch cannon floor)
  const breached = postHitAlive.some((inv) => inv.y + inv.h >= state.playerY - 2);
  if (nextLives <= 0 || breached) {
    sfx.push("gameover");
    return {
      nextState: {
        ...state,
        playerX: nextPlayerX,
        playerCooldown: nextCooldown,
        enemyFireCooldown: nextEnemyCooldown,
        invaderDir: nextDir,
        invaders,
        bunkers,
        playerBullets: survivingPBullets,
        enemyBullets: survivingEBullets,
        ufoActive,
        ufoX,
        ufoDir,
        tick: nextTick,
        score: nextScore,
        lives: Math.max(0, nextLives),
        status: "gameover",
        seed: nextSeed,
      },
      sfx,
    };
  }

  // Wave Clear
  if (postHitAlive.length === 0) {
    const nextWave = state.wave + 1;
    sfx.push("clear");
    return {
      nextState: {
        ...state,
        playerX: nextPlayerX,
        playerCooldown: 0,
        enemyFireCooldown: 26,
        invaderDir: 1,
        invaders: createInvaderWave(state.invaderRows, nextWave),
        bunkers,
        playerBullets: [],
        enemyBullets: [],
        ufoActive: false,
        tick: nextTick,
        score: nextScore + 100,
        lives: nextLives,
        wave: nextWave,
        seed: nextSeed,
      },
      sfx,
    };
  }

  return {
    nextState: {
      ...state,
      playerX: nextPlayerX,
      playerCooldown: nextCooldown,
      enemyFireCooldown: nextEnemyCooldown,
      invaderDir: nextDir,
      invaders,
      bunkers,
      playerBullets: survivingPBullets,
      enemyBullets: survivingEBullets,
      ufoActive,
      ufoX,
      ufoDir,
      tick: nextTick,
      score: nextScore,
      lives: nextLives,
      seed: nextSeed,
    },
    sfx,
  };
}

function drawBitmapSprite(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  pixelW: number,
  pixelH: number,
  fill: string
): void {
  ctx.fillStyle = fill;
  for (let r = 0; r < rows.length; r++) {
    const line = rows[r]!;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === "1") {
        ctx.fillRect(x + c * pixelW, y + r * pixelH, pixelW, pixelH);
      }
    }
  }
}

export function renderPacketInvadersCanvas(
  ctx: CanvasRenderingContext2D,
  state: PacketInvadersState,
  palette: ArcadePaletteColors
): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, ARCADE_CANVAS_W, ARCADE_CANVAS_H);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, ARCADE_CANVAS_W - 8, ARCADE_CANVAS_H - 8);

  // Subtle floor baseline
  ctx.fillStyle = palette.light;
  ctx.fillRect(10, ARCADE_CANVAS_H - 12, ARCADE_CANVAS_W - 20, 2);

  // Optional Y2K Bonus UFO
  if (state.ufoActive) {
    ctx.fillStyle = palette.ink;
    ctx.fillRect(Math.round(state.ufoX), 16, 30, 10);
    ctx.fillStyle = palette.surface;
    ctx.fillRect(Math.round(state.ufoX) + 6, 19, 4, 4);
    ctx.fillRect(Math.round(state.ufoX) + 13, 19, 4, 4);
    ctx.fillRect(Math.round(state.ufoX) + 20, 19, 4, 4);
  }

  // Invader Formation
  const frameIdx = Math.floor(state.tick / 14) % 2;
  for (const inv of state.invaders) {
    if (!inv.alive) continue;
    const spriteSet = inv.row % 2 === 0 ? SPRITE_FRAMES_A : SPRITE_FRAMES_B;
    const tone = inv.row === 0 ? palette.ink : palette.dark;
    drawBitmapSprite(ctx, spriteSet[frameIdx]!, inv.x, inv.y, 3, 3, tone);
  }

  // Destructible Bunkers
  for (const bunker of state.bunkers) {
    ctx.fillStyle = bunker.hp >= 2 ? palette.dark : palette.mid;
    ctx.fillRect(bunker.x, bunker.y, bunker.w, bunker.h);
  }

  // Cannon Turret
  const cx = Math.round(state.playerX);
  const cy = state.playerY;
  ctx.fillStyle = palette.ink;
  ctx.fillRect(cx, cy + 5, state.playerWidth, 9);
  ctx.fillRect(cx + Math.floor(state.playerWidth / 2) - 4, cy, 8, 5);

  // Projectiles
  ctx.fillStyle = palette.ink;
  for (const pb of state.playerBullets) {
    ctx.fillRect(Math.round(pb.x), Math.round(pb.y), 3, 9);
  }
  ctx.fillStyle = palette.dark;
  for (const eb of state.enemyBullets) {
    ctx.fillRect(Math.round(eb.x), Math.round(eb.y), 4, 9);
  }
}
