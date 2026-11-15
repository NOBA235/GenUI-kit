import {
  ARCADE_CANVAS_H,
  ARCADE_CANVAS_W,
  type ArcadeDifficultyPreset,
  type ArcadeGameStatus,
  type ArcadePaletteColors,
  type ArcadeSfxEvent,
} from "./types.js";

export type SerpentDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface GridCell {
  readonly x: number;
  readonly y: number;
}

export interface SerpentState {
  readonly gridSize: number;
  readonly snake: readonly GridCell[];
  readonly direction: SerpentDirection;
  readonly queuedDirection: SerpentDirection;
  readonly food: GridCell;
  readonly score: number;
  readonly level: number;
  readonly pelletsEaten: number;
  readonly difficultyPreset: ArcadeDifficultyPreset;
  readonly status: ArcadeGameStatus;
  readonly seed: number;
}

function clampGridSize(raw: number): number {
  if (!Number.isFinite(raw)) return 20;
  return Math.max(14, Math.min(26, Math.round(raw)));
}

function nextPrng(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function findAvailableFoodCell(
  gridSize: number,
  snake: readonly GridCell[],
  seed: number
): { readonly food: GridCell; readonly nextSeed: number } {
  const occupied = new Set(snake.map((cell) => `${cell.x},${cell.y}`));
  const freeCells: GridCell[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!occupied.has(`${x},${y}`)) {
        freeCells.push({ x, y });
      }
    }
  }
  if (freeCells.length === 0) {
    return { food: snake[0] ?? { x: 0, y: 0 }, nextSeed: seed };
  }
  const nextSeed = nextPrng(seed);
  const idx = nextSeed % freeCells.length;
  return { food: freeCells[idx]!, nextSeed };
}

export function createSerpentState(options: {
  readonly gridSize?: number;
  readonly difficultyPreset?: ArcadeDifficultyPreset;
  readonly seed?: number;
} = {}): SerpentState {
  const gridSize = clampGridSize(options.gridSize ?? 20);
  const center = Math.floor(gridSize / 2);
  const snake: GridCell[] = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
    { x: center - 3, y: center },
  ];
  const initialSeed = options.seed ?? 1998;
  const { food, nextSeed } = findAvailableFoodCell(gridSize, snake, initialSeed);
  return {
    gridSize,
    snake,
    direction: "RIGHT",
    queuedDirection: "RIGHT",
    food,
    score: 0,
    level: 1,
    pelletsEaten: 0,
    difficultyPreset: options.difficultyPreset ?? "standard-1995",
    status: "ready",
    seed: nextSeed,
  };
}

export function isOppositeSerpentDirection(
  a: SerpentDirection,
  b: SerpentDirection
): boolean {
  return (
    (a === "UP" && b === "DOWN") ||
    (a === "DOWN" && b === "UP") ||
    (a === "LEFT" && b === "RIGHT") ||
    (a === "RIGHT" && b === "LEFT")
  );
}

export function queueSerpentDirection(
  state: SerpentState,
  nextDir: SerpentDirection
): SerpentState {
  if (isOppositeSerpentDirection(state.direction, nextDir)) {
    return state;
  }
  return { ...state, queuedDirection: nextDir };
}

export function getSerpentTickMs(state: SerpentState): number {
  const baseMs =
    state.difficultyPreset === "turbo-y2k"
      ? 105
      : state.difficultyPreset === "zen-91"
        ? 170
        : 135;
  return Math.max(65, baseMs - (state.level - 1) * 9);
}

export function stepSerpentState(state: SerpentState): {
  readonly nextState: SerpentState;
  readonly sfx: readonly ArcadeSfxEvent[];
} {
  if (state.status !== "playing") {
    return { nextState: state, sfx: [] };
  }

  const dir = isOppositeSerpentDirection(state.direction, state.queuedDirection)
    ? state.direction
    : state.queuedDirection;
  const head = state.snake[0]!;
  const nextHead: GridCell = {
    x: head.x + (dir === "RIGHT" ? 1 : dir === "LEFT" ? -1 : 0),
    y: head.y + (dir === "DOWN" ? 1 : dir === "UP" ? -1 : 0),
  };

  if (
    nextHead.x < 0 ||
    nextHead.x >= state.gridSize ||
    nextHead.y < 0 ||
    nextHead.y >= state.gridSize
  ) {
    return {
      nextState: { ...state, direction: dir, status: "gameover" },
      sfx: ["gameover"],
    };
  }

  const ateFood = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const bodyToCheck = ateFood ? state.snake : state.snake.slice(0, -1);
  if (
    bodyToCheck.some(
      (segment) => segment.x === nextHead.x && segment.y === nextHead.y
    )
  ) {
    return {
      nextState: { ...state, direction: dir, status: "gameover" },
      sfx: ["gameover"],
    };
  }

  const nextSnake: GridCell[] = ateFood
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];

  if (!ateFood) {
    return {
      nextState: {
        ...state,
        direction: dir,
        snake: nextSnake,
      },
      sfx: [],
    };
  }

  const nextPellets = state.pelletsEaten + 1;
  const nextLevel = 1 + Math.floor(nextPellets / 5);
  const nextScore = state.score + 10 * state.level;
  const { food, nextSeed } = findAvailableFoodCell(
    state.gridSize,
    nextSnake,
    state.seed
  );

  return {
    nextState: {
      ...state,
      direction: dir,
      snake: nextSnake,
      food,
      score: nextScore,
      level: nextLevel,
      pelletsEaten: nextPellets,
      seed: nextSeed,
      status: nextSnake.length >= state.gridSize * state.gridSize ? "gameover" : "playing",
    },
    sfx: nextLevel > state.level ? ["clear"] : ["pickup"],
  };
}

export function renderSerpentCanvas(
  ctx: CanvasRenderingContext2D,
  state: SerpentState,
  palette: ArcadePaletteColors
): void {
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, ARCADE_CANVAS_W, ARCADE_CANVAS_H);

  const arenaPx = Math.min(ARCADE_CANVAS_W - 24, ARCADE_CANVAS_H - 24);
  const cellPx = Math.floor(arenaPx / state.gridSize);
  const boardPx = cellPx * state.gridSize;
  const offsetX = Math.floor((ARCADE_CANVAS_W - boardPx) / 2);
  const offsetY = Math.floor((ARCADE_CANVAS_H - boardPx) / 2);

  // Subtle 1px monochrome workstation matrix grid
  ctx.strokeStyle = palette.light;
  ctx.lineWidth = 1;
  for (let i = 0; i <= state.gridSize; i++) {
    const gx = offsetX + i * cellPx + 0.5;
    const gy = offsetY + i * cellPx + 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, offsetY);
    ctx.lineTo(gx, offsetY + boardPx);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offsetX, gy);
    ctx.lineTo(offsetX + boardPx, gy);
    ctx.stroke();
  }

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, boardPx, boardPx);

  // Render Food Target (Crisp Dithered Plus Target)
  const fx = offsetX + state.food.x * cellPx;
  const fy = offsetY + state.food.y * cellPx;
  const pad = Math.max(2, Math.floor(cellPx * 0.2));
  ctx.fillStyle = palette.ink;
  ctx.fillRect(fx + pad, fy + pad, cellPx - pad * 2, cellPx - pad * 2);
  ctx.fillStyle = palette.surface;
  ctx.fillRect(
    fx + Math.floor(cellPx / 2) - 2,
    fy + Math.floor(cellPx / 2) - 2,
    4,
    4
  );

  // Render Snake Segments
  state.snake.forEach((seg, index) => {
    const sx = offsetX + seg.x * cellPx + 1;
    const sy = offsetY + seg.y * cellPx + 1;
    const sw = Math.max(4, cellPx - 2);
    ctx.fillStyle =
      index === 0 ? palette.ink : index % 2 === 0 ? palette.dark : palette.mid;
    ctx.fillRect(sx, sy, sw, sw);

    if (index === 0) {
      ctx.fillStyle = palette.surface;
      ctx.fillRect(sx + 3, sy + 3, 3, 3);
      ctx.fillRect(sx + sw - 6, sy + 3, 3, 3);
    }
  });
}
