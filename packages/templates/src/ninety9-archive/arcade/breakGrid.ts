import {
  ARCADE_CANVAS_H,
  ARCADE_CANVAS_W,
  type ArcadeDifficultyPreset,
  type ArcadeGameStatus,
  type ArcadePaletteColors,
  type ArcadeSfxEvent,
} from "./types.js";

export interface BreakBrick {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly hp: number;
  readonly maxHp: number;
}

export interface BreakGridState {
  readonly width: number;
  readonly height: number;
  readonly paddleX: number;
  readonly paddleY: number;
  readonly paddleWidth: number;
  readonly paddleHeight: number;
  readonly ballX: number;
  readonly ballY: number;
  readonly ballVx: number;
  readonly ballVy: number;
  readonly ballSize: number;
  readonly ballSpeed: number;
  readonly launched: boolean;
  readonly bricks: readonly BreakBrick[];
  readonly score: number;
  readonly lives: number;
  readonly wave: number;
  readonly difficultyPreset: ArcadeDifficultyPreset;
  readonly status: ArcadeGameStatus;
}

const BRICK_COLS = 8;
const BRICK_PAD_X = 6;
const BRICK_PAD_Y = 6;
const BRICK_TOP = 38;
const BRICK_HEIGHT = 16;

function clampPaddleWidth(raw: number): number {
  if (!Number.isFinite(raw)) return 80;
  return Math.max(48, Math.min(112, Math.round(raw)));
}

function clampBallSpeed(raw: number): number {
  if (!Number.isFinite(raw)) return 4;
  return Math.max(2, Math.min(6, Math.round(raw)));
}

function buildWaveBricks(wave: number): BreakBrick[] {
  const rows = Math.min(6, 4 + Math.floor((wave - 1) / 2));
  const marginX = 24;
  const totalW = ARCADE_CANVAS_W - marginX * 2;
  const brickW = Math.floor((totalW - (BRICK_COLS - 1) * BRICK_PAD_X) / BRICK_COLS);
  const out: BreakBrick[] = [];

  for (let r = 0; r < rows; r++) {
    const maxHp = r === 0 ? 3 : r < 2 ? 2 : 1;
    for (let c = 0; c < BRICK_COLS; c++) {
      out.push({
        x: marginX + c * (brickW + BRICK_PAD_X),
        y: BRICK_TOP + r * (BRICK_HEIGHT + BRICK_PAD_Y),
        w: brickW,
        h: BRICK_HEIGHT,
        hp: maxHp,
        maxHp,
      });
    }
  }
  return out;
}

export function createBreakGridState(options: {
  readonly paddleWidth?: number;
  readonly ballSpeed?: number;
  readonly difficultyPreset?: ArcadeDifficultyPreset;
} = {}): BreakGridState {
  const paddleWidth = clampPaddleWidth(options.paddleWidth ?? 80);
  const ballSpeed = clampBallSpeed(options.ballSpeed ?? 4);
  const preset = options.difficultyPreset ?? "standard-1995";
  const effectiveSpeed =
    preset === "turbo-y2k"
      ? Math.min(6, ballSpeed + 1)
      : preset === "zen-91"
        ? Math.max(2, ballSpeed - 1)
        : ballSpeed;

  const paddleX = Math.floor((ARCADE_CANVAS_W - paddleWidth) / 2);
  const paddleY = ARCADE_CANVAS_H - 28;
  const ballSize = 8;

  return {
    width: ARCADE_CANVAS_W,
    height: ARCADE_CANVAS_H,
    paddleX,
    paddleY,
    paddleWidth,
    paddleHeight: 10,
    ballX: paddleX + Math.floor(paddleWidth / 2) - 4,
    ballY: paddleY - ballSize - 2,
    ballVx: Math.max(1.8, effectiveSpeed * 0.65),
    ballVy: -Math.max(2.2, effectiveSpeed * 0.9),
    ballSize,
    ballSpeed: effectiveSpeed,
    launched: false,
    bricks: buildWaveBricks(1),
    score: 0,
    lives: 3,
    wave: 1,
    difficultyPreset: preset,
    status: "ready",
  };
}

export function clampPaddleX(
  rawX: number,
  width: number,
  paddleWidth: number
): number {
  return Math.max(8, Math.min(width - paddleWidth - 8, rawX));
}

export function stepBreakGridState(
  state: BreakGridState,
  input: {
    readonly move: -1 | 0 | 1;
    readonly launch?: boolean;
  }
): {
  readonly nextState: BreakGridState;
  readonly sfx: readonly ArcadeSfxEvent[];
} {
  if (state.status !== "playing") {
    return { nextState: state, sfx: [] };
  }

  const sfx: ArcadeSfxEvent[] = [];
  const paddleSpeed = 7.5;
  const nextPaddleX = clampPaddleX(
    state.paddleX + input.move * paddleSpeed,
    state.width,
    state.paddleWidth
  );

  let launched = state.launched || Boolean(input.launch);
  if (!launched) {
    return {
      nextState: {
        ...state,
        paddleX: nextPaddleX,
        ballX: nextPaddleX + Math.floor(state.paddleWidth / 2) - Math.floor(state.ballSize / 2),
        ballY: state.paddleY - state.ballSize - 2,
      },
      sfx,
    };
  }

  let bx = state.ballX + state.ballVx;
  let by = state.ballY + state.ballVy;
  let vx = state.ballVx;
  let vy = state.ballVy;

  // Left & Right Arena Walls
  if (bx <= 8) {
    bx = 8;
    vx = Math.abs(vx);
    sfx.push("hit");
  } else if (bx + state.ballSize >= state.width - 8) {
    bx = state.width - 8 - state.ballSize;
    vx = -Math.abs(vx);
    sfx.push("hit");
  }

  // Top Arena Wall
  if (by <= 8) {
    by = 8;
    vy = Math.abs(vy);
    sfx.push("hit");
  }

  // Paddle Collision
  if (
    vy > 0 &&
    by + state.ballSize >= state.paddleY &&
    by <= state.paddleY + state.paddleHeight &&
    bx + state.ballSize >= nextPaddleX &&
    bx <= nextPaddleX + state.paddleWidth
  ) {
    const ballCenter = bx + state.ballSize / 2;
    const paddleCenter = nextPaddleX + state.paddleWidth / 2;
    const ratio = Math.max(
      -1,
      Math.min(1, (ballCenter - paddleCenter) / (state.paddleWidth / 2))
    );
    const speedMag = Math.max(state.ballSpeed * 1.15, Math.hypot(vx, vy));
    vx = ratio * speedMag * 0.82;
    vy = -Math.max(2.2, Math.sqrt(Math.max(4, speedMag * speedMag - vx * vx)));
    by = state.paddleY - state.ballSize - 1;
    sfx.push("pickup");
  }

  // Brick AABB Collision (single brick resolution per step for deterministic bounce)
  let nextScore = state.score;
  let hitBrickIndex = -1;
  for (let i = 0; i < state.bricks.length; i++) {
    const br = state.bricks[i]!;
    if (
      bx + state.ballSize >= br.x &&
      bx <= br.x + br.w &&
      by + state.ballSize >= br.y &&
      by <= br.y + br.h
    ) {
      hitBrickIndex = i;
      const overlapLeft = bx + state.ballSize - br.x;
      const overlapRight = br.x + br.w - bx;
      const overlapTop = by + state.ballSize - br.y;
      const overlapBottom = br.y + br.h - by;
      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapTop, overlapBottom);
      if (minX < minY) {
        vx = -vx;
      } else {
        vy = -vy;
      }
      break;
    }
  }

  const nextBricks: BreakBrick[] = [];
  state.bricks.forEach((br, idx) => {
    if (idx !== hitBrickIndex) {
      nextBricks.push(br);
      return;
    }
    const nextHp = br.hp - 1;
    nextScore += nextHp === 0 ? br.maxHp * 15 : 10;
    sfx.push("hit");
    if (nextHp > 0) {
      nextBricks.push({ ...br, hp: nextHp });
    }
  });

  // Wave Clear
  if (nextBricks.length === 0) {
    const nextWave = state.wave + 1;
    sfx.push("clear");
    return {
      nextState: {
        ...state,
        paddleX: nextPaddleX,
        ballX: nextPaddleX + Math.floor(state.paddleWidth / 2) - 4,
        ballY: state.paddleY - state.ballSize - 2,
        ballVx: state.ballSpeed * 0.72 * (vx >= 0 ? 1 : -1),
        ballVy: -Math.max(2.6, state.ballSpeed * 0.95),
        launched: false,
        bricks: buildWaveBricks(nextWave),
        score: nextScore + 100,
        wave: nextWave,
      },
      sfx,
    };
  }

  // Bottom Boundary Miss
  if (by > state.height) {
    const nextLives = state.lives - 1;
    if (nextLives <= 0) {
      sfx.push("gameover");
      return {
        nextState: {
          ...state,
          paddleX: nextPaddleX,
          lives: 0,
          score: nextScore,
          bricks: nextBricks,
          status: "gameover",
        },
        sfx,
      };
    }
    sfx.push("hit");
    return {
      nextState: {
        ...state,
        paddleX: nextPaddleX,
        ballX: nextPaddleX + Math.floor(state.paddleWidth / 2) - 4,
        ballY: state.paddleY - state.ballSize - 2,
        ballVx: Math.max(1.8, state.ballSpeed * 0.65),
        ballVy: -Math.max(2.2, state.ballSpeed * 0.9),
        launched: false,
        bricks: nextBricks,
        score: nextScore,
        lives: nextLives,
      },
      sfx,
    };
  }

  return {
    nextState: {
      ...state,
      paddleX: nextPaddleX,
      ballX: bx,
      ballY: by,
      ballVx: vx,
      ballVy: vy,
      launched,
      bricks: nextBricks,
      score: nextScore,
    },
    sfx,
  };
}

export function renderBreakGridCanvas(
  ctx: CanvasRenderingContext2D,
  state: BreakGridState,
  palette: ArcadePaletteColors
): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, ARCADE_CANVAS_W, ARCADE_CANVAS_H);

  // Outer Frame Border
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, ARCADE_CANVAS_W - 8, ARCADE_CANVAS_H - 8);

  // Subtle background halftone dot grid
  ctx.fillStyle = palette.light;
  for (let y = 16; y < ARCADE_CANVAS_H - 16; y += 18) {
    for (let x = 16; x < ARCADE_CANVAS_W - 16; x += 18) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Bricks
  for (const br of state.bricks) {
    ctx.fillStyle =
      br.hp >= 3 ? palette.ink : br.hp === 2 ? palette.dark : palette.mid;
    ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(br.x + 0.5, br.y + 0.5, br.w - 1, br.h - 1);

    if (br.hp >= 2) {
      ctx.fillStyle = palette.surface;
      ctx.fillRect(br.x + 3, br.y + 3, Math.max(4, br.w - 6), 2);
    }
  }

  // Paddle
  ctx.fillStyle = palette.ink;
  ctx.fillRect(state.paddleX, state.paddleY, state.paddleWidth, state.paddleHeight);
  ctx.fillStyle = palette.light;
  ctx.fillRect(state.paddleX + 4, state.paddleY + 2, state.paddleWidth - 8, 2);

  // Pixel Ball
  ctx.fillStyle = palette.ink;
  ctx.fillRect(
    Math.round(state.ballX),
    Math.round(state.ballY),
    state.ballSize,
    state.ballSize
  );
  ctx.fillStyle = palette.surface;
  ctx.fillRect(Math.round(state.ballX) + 2, Math.round(state.ballY) + 2, 2, 2);
}
