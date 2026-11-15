/**
 * Procedural Canvas2D painters for the ghostly warning sign and ambient hauntings.
 * Zero external image fetches: every face, figure and sign board is painted at runtime.
 * All painters return null under SSR / headless environments without a 2D canvas.
 */

import * as THREE from "three";

export type ApparitionFaceVariant = 0 | 1 | 2;
export type ApparitionFigureVariant = 0 | 1;

/** Deterministic mulberry32 PRNG so textures look identical across reloads. */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Film-grain noise applied only where pixels are already painted (keeps alpha edges clean). */
function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, rng: () => number): void {
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return;
  }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    const n = (rng() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i]! + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Feathers the outer edge of the painting to transparent so sprites never show a hard box. */
function featherEdges(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function paintEyeSocket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  glint: boolean,
  bleeding: boolean,
): void {
  // Bruised hollow around the socket
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx * 1.7, ry * 1.6);
  const bruise = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1);
  bruise.addColorStop(0, "rgba(40,22,30,0.85)");
  bruise.addColorStop(0.6, "rgba(70,50,60,0.4)");
  bruise.addColorStop(1, "rgba(70,50,60,0)");
  ctx.fillStyle = bruise;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Void socket
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const voidGrad = ctx.createRadialGradient(0, 0.1, 0, 0, 0, 1);
  voidGrad.addColorStop(0, "rgba(0,0,0,1)");
  voidGrad.addColorStop(0.75, "rgba(4,2,3,0.96)");
  voidGrad.addColorStop(1, "rgba(15,8,10,0)");
  ctx.fillStyle = voidGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (glint) {
    // Tiny pinprick pupil staring back
    const pg = ctx.createRadialGradient(x, y + ry * 0.05, 0, x, y + ry * 0.05, rx * 0.22);
    pg.addColorStop(0, "rgba(245,240,225,0.95)");
    pg.addColorStop(1, "rgba(245,240,225,0)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x, y + ry * 0.05, rx * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  if (bleeding) {
    // Dark tear streaks running from the socket
    for (let i = 0; i < 2; i++) {
      const sx = x - rx * 0.35 + i * rx * 0.6;
      const len = ry * (2.4 + i * 1.3);
      const sg = ctx.createLinearGradient(sx, y, sx, y + len);
      sg.addColorStop(0, "rgba(28,4,6,0.9)");
      sg.addColorStop(1, "rgba(28,4,6,0)");
      ctx.strokeStyle = sg;
      ctx.lineWidth = rx * (0.16 - i * 0.04);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, y + ry * 0.6);
      ctx.bezierCurveTo(sx + rx * 0.1, y + len * 0.4, sx - rx * 0.12, y + len * 0.7, sx + rx * 0.05, y + len);
      ctx.stroke();
    }
  }
}

function paintHairStrands(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  spread: number,
  length: number,
  count: number,
  rng: () => number,
  coverFace: boolean,
): void {
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const side = t < 0.5 ? -1 : 1;
    const startX = cx + (t - 0.5) * spread * 0.9;
    const outward = coverFace ? (rng() - 0.5) * spread * 0.25 : side * spread * (0.35 + rng() * 0.35);
    const endX = startX + outward;
    const endY = topY + length * (0.75 + rng() * 0.3);
    ctx.strokeStyle = `rgba(${6 + rng() * 10},${4 + rng() * 6},${6 + rng() * 8},${0.55 + rng() * 0.4})`;
    ctx.lineWidth = 1.2 + rng() * 2.6;
    ctx.beginPath();
    ctx.moveTo(startX, topY);
    ctx.bezierCurveTo(
      startX + (rng() - 0.5) * 18,
      topY + length * 0.3,
      endX + (rng() - 0.5) * 22,
      topY + length * 0.6,
      endX,
      endY,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Pale corpse-like face with hollow eye sockets and a gaping mouth.
 * Variant 0: screaming void eyes · 1: pinprick pupils, curtain of hair · 2: bleeding sockets, stitched grin.
 */
export function createApparitionFaceTexture(variant: ApparitionFaceVariant): THREE.CanvasTexture | null {
  const W = 512;
  const H = 512;
  const surface = createCanvas(W, H);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const rng = createRng(0xfa ^ (variant * 7919));
  const cx = W / 2;
  const cy = H * 0.5;
  const headRx = W * 0.27;
  const headRy = H * 0.37;

  // Cold spectral halo behind the head
  const halo = ctx.createRadialGradient(cx, cy, headRx * 0.6, cx, cy, W * 0.5);
  halo.addColorStop(0, "rgba(150,170,190,0.25)");
  halo.addColorStop(1, "rgba(150,170,190,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  if (variant === 1) {
    paintHairStrands(ctx, cx, cy - headRy * 1.05, headRx * 2.6, headRy * 2.3, 120, rng, false);
  }

  // Skull-tight skin: slightly elongated, narrow jaw
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - headRy);
  ctx.bezierCurveTo(cx + headRx * 1.15, cy - headRy, cx + headRx * 1.05, cy + headRy * 0.35, cx + headRx * 0.42, cy + headRy * 0.92);
  ctx.quadraticCurveTo(cx, cy + headRy * 1.08, cx - headRx * 0.42, cy + headRy * 0.92);
  ctx.bezierCurveTo(cx - headRx * 1.05, cy + headRy * 0.35, cx - headRx * 1.15, cy - headRy, cx, cy - headRy);
  ctx.closePath();
  const skin = ctx.createRadialGradient(cx, cy - headRy * 0.2, headRx * 0.1, cx, cy, headRy * 1.15);
  skin.addColorStop(0, variant === 2 ? "#cfc6b8" : "#dcd8cd");
  skin.addColorStop(0.55, variant === 2 ? "#9d9384" : "#a9a69c");
  skin.addColorStop(1, "#3a3833");
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.clip();

  // Sunken temples and cheek hollows
  for (const side of [-1, 1]) {
    const cheek = ctx.createRadialGradient(
      cx + side * headRx * 0.55,
      cy + headRy * 0.28,
      0,
      cx + side * headRx * 0.55,
      cy + headRy * 0.28,
      headRx * 0.55,
    );
    cheek.addColorStop(0, "rgba(40,36,38,0.55)");
    cheek.addColorStop(1, "rgba(40,36,38,0)");
    ctx.fillStyle = cheek;
    ctx.fillRect(0, 0, W, H);
    const temple = ctx.createRadialGradient(
      cx + side * headRx * 0.95,
      cy - headRy * 0.35,
      0,
      cx + side * headRx * 0.95,
      cy - headRy * 0.35,
      headRx * 0.45,
    );
    temple.addColorStop(0, "rgba(30,28,30,0.6)");
    temple.addColorStop(1, "rgba(30,28,30,0)");
    ctx.fillStyle = temple;
    ctx.fillRect(0, 0, W, H);
  }

  // Heavy brow shadow
  const brow = ctx.createLinearGradient(0, cy - headRy * 0.42, 0, cy - headRy * 0.05);
  brow.addColorStop(0, "rgba(20,18,20,0)");
  brow.addColorStop(0.6, "rgba(20,18,20,0.45)");
  brow.addColorStop(1, "rgba(20,18,20,0)");
  ctx.fillStyle = brow;
  ctx.fillRect(0, 0, W, H);

  // Blue-grey veins crawling over the skin
  ctx.lineCap = "round";
  for (let v = 0; v < 26; v++) {
    let x = cx + (rng() - 0.5) * headRx * 1.8;
    let y = cy + (rng() - 0.5) * headRy * 1.6;
    ctx.strokeStyle = `rgba(${55 + rng() * 25},${65 + rng() * 25},${95 + rng() * 30},${0.18 + rng() * 0.22})`;
    ctx.lineWidth = 0.7 + rng() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rng() * 6);
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 26;
      y += (rng() - 0.5) * 26;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Eyes
  const eyeY = cy - headRy * 0.12;
  const eyeDx = headRx * 0.42;
  const eyeRx = headRx * (variant === 0 ? 0.27 : 0.22);
  const eyeRy = headRy * (variant === 0 ? 0.17 : 0.12);
  paintEyeSocket(ctx, cx - eyeDx, eyeY, eyeRx, eyeRy, variant === 1, variant === 2);
  paintEyeSocket(ctx, cx + eyeDx, eyeY + (variant === 2 ? 4 : 0), eyeRx, eyeRy, variant === 1, variant === 2);

  // Collapsed nose
  ctx.fillStyle = "rgba(12,8,10,0.85)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * headRx * 0.09, cy + headRy * 0.2, headRx * 0.05, headRy * 0.035, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const noseShadow = ctx.createLinearGradient(cx, cy - headRy * 0.05, cx, cy + headRy * 0.2);
  noseShadow.addColorStop(0, "rgba(30,26,28,0)");
  noseShadow.addColorStop(1, "rgba(30,26,28,0.35)");
  ctx.fillStyle = noseShadow;
  ctx.fillRect(cx - headRx * 0.12, cy - headRy * 0.05, headRx * 0.24, headRy * 0.25);

  // Mouth
  const mouthY = cy + headRy * 0.52;
  if (variant === 2) {
    // Unnaturally wide stitched grin
    ctx.strokeStyle = "rgba(10,4,6,0.95)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - headRx * 0.78, mouthY - headRy * 0.12);
    ctx.quadraticCurveTo(cx, mouthY + headRy * 0.2, cx + headRx * 0.78, mouthY - headRy * 0.12);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = -6; i <= 6; i++) {
      const t = (i + 6) / 12;
      const mx = cx - headRx * 0.78 + t * headRx * 1.56;
      const my = mouthY - headRy * 0.12 + Math.sin(t * Math.PI) * headRy * 0.16;
      ctx.beginPath();
      ctx.moveTo(mx - 3, my - 9);
      ctx.lineTo(mx + 3, my + 9);
      ctx.stroke();
    }
  } else {
    // Gaping, unhinged scream
    const mRx = headRx * (variant === 0 ? 0.3 : 0.2);
    const mRy = headRy * (variant === 0 ? 0.3 : 0.18);
    ctx.save();
    ctx.translate(cx, mouthY);
    ctx.scale(mRx, mRy);
    const mg = ctx.createRadialGradient(0, 0.15, 0, 0, 0, 1);
    mg.addColorStop(0, "rgba(0,0,0,1)");
    mg.addColorStop(0.8, "rgba(10,3,5,0.97)");
    mg.addColorStop(1, "rgba(40,16,20,0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Jagged yellowed teeth along the upper lip
    ctx.fillStyle = "rgba(196,184,150,0.85)";
    for (let i = 0; i < 7; i++) {
      const tx = cx - mRx * 0.7 + (i / 6) * mRx * 1.4;
      const tw = mRx * 0.12;
      const th = mRy * (0.18 + rng() * 0.16);
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2, mouthY - mRy * 0.82);
      ctx.lineTo(tx + tw / 2, mouthY - mRy * 0.82);
      ctx.lineTo(tx + (rng() - 0.5) * tw * 0.5, mouthY - mRy * 0.82 + th);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (variant === 1) {
    // Wet strands falling across the face
    paintHairStrands(ctx, cx, cy - headRy * 1.0, headRx * 1.6, headRy * 1.5, 34, rng, true);
  }

  addGrain(ctx, W, H, 34, rng);
  featherEdges(ctx, cx, cy, W * 0.5, H * 0.5);
  return toTexture(canvas);
}

/**
 * Full-height translucent apparition.
 * Variant 0: veiled weeping bride in a tattered shroud · 1: gaunt hunched figure, hair over face.
 */
export function createApparitionFigureTexture(variant: ApparitionFigureVariant): THREE.CanvasTexture | null {
  const W = 256;
  const H = 576;
  const surface = createCanvas(W, H);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const rng = createRng(0x9057 + variant * 104729);
  const cx = W / 2;
  const headY = variant === 0 ? H * 0.12 : H * 0.17;
  const headR = W * 0.11;

  ctx.save();
  ctx.shadowColor = "rgba(170,200,225,0.75)";
  ctx.shadowBlur = 24;

  // Shroud / body with ragged, dissolving hem
  const shoulder = variant === 0 ? W * 0.2 : W * 0.24;
  const hemY = H * 0.97;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.9, headY + headR * 0.6);
  ctx.bezierCurveTo(cx - shoulder, headY + headR * 1.6, cx - shoulder * 1.25, H * 0.55, cx - shoulder * 1.6, hemY);
  const tatters = 9;
  for (let i = 0; i <= tatters; i++) {
    const t = i / tatters;
    const x = cx - shoulder * 1.6 + t * shoulder * 3.2;
    const y = hemY - (i % 2 === 0 ? 0 : 18 + rng() * 40);
    ctx.lineTo(x, y);
  }
  ctx.bezierCurveTo(cx + shoulder * 1.25, H * 0.55, cx + shoulder, headY + headR * 1.6, cx + headR * 0.9, headY + headR * 0.6);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, headY, 0, hemY);
  body.addColorStop(0, "rgba(222,228,236,0.85)");
  body.addColorStop(0.45, "rgba(190,200,214,0.5)");
  body.addColorStop(1, "rgba(160,175,195,0)");
  ctx.fillStyle = body;
  ctx.fill();

  // Long dangling arms with elongated fingers
  ctx.strokeStyle = "rgba(205,212,222,0.6)";
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    const sx = cx + side * shoulder * 0.85;
    const sy = headY + headR * 2.2;
    const hx = cx + side * shoulder * (variant === 1 ? 1.05 : 0.95);
    const hy = H * (variant === 1 ? 0.66 : 0.58);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + side * 14, (sy + hy) / 2, hx, hy);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    for (let f = 0; f < 4; f++) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + side * (f - 1.5) * 4, hy + 30 + f * 4);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Head
  ctx.save();
  if (variant === 1) {
    ctx.translate(cx, headY);
    ctx.rotate(0.32);
    ctx.translate(-cx, -headY);
  }
  const headGrad = ctx.createRadialGradient(cx, headY - headR * 0.2, 0, cx, headY, headR * 1.15);
  headGrad.addColorStop(0, "rgba(232,230,224,0.95)");
  headGrad.addColorStop(1, "rgba(150,155,160,0.4)");
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR * 0.82, headR * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hollow eyes and gaping mouth
  paintEyeSocket(ctx, cx - headR * 0.32, headY - headR * 0.1, headR * 0.2, headR * 0.17, false, variant === 0);
  paintEyeSocket(ctx, cx + headR * 0.32, headY - headR * 0.1, headR * 0.2, headR * 0.17, false, variant === 0);
  ctx.fillStyle = "rgba(0,0,0,0.92)";
  ctx.beginPath();
  ctx.ellipse(cx, headY + headR * 0.5, headR * 0.17, headR * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (variant === 0) {
    // Translucent bridal veil draped over the head
    const veil = ctx.createLinearGradient(0, headY - headR * 1.3, 0, headY + headR * 4);
    veil.addColorStop(0, "rgba(235,238,242,0.55)");
    veil.addColorStop(1, "rgba(235,238,242,0)");
    ctx.fillStyle = veil;
    ctx.beginPath();
    ctx.moveTo(cx, headY - headR * 1.3);
    ctx.bezierCurveTo(cx + headR * 1.8, headY - headR, cx + headR * 2.2, headY + headR * 2.5, cx + headR * 1.6, headY + headR * 4);
    ctx.lineTo(cx - headR * 1.6, headY + headR * 4);
    ctx.bezierCurveTo(cx - headR * 2.2, headY + headR * 2.5, cx - headR * 1.8, headY - headR, cx, headY - headR * 1.3);
    ctx.fill();
  } else {
    paintHairStrands(ctx, cx, headY - headR * 1.0, headR * 2.0, headR * 4.2, 60, rng, true);
  }
  ctx.restore();

  addGrain(ctx, W, H, 26, rng);
  return toTexture(canvas);
}

function paintHandprint(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rot: number, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = `rgba(214,232,226,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  const fingers: Array<[number, number, number, number]> = [
    [-20, -30, 6, 22],
    [-7, -40, 6, 26],
    [7, -40, 6, 26],
    [19, -32, 5.5, 21],
    [-30, 4, 6, 17],
  ];
  for (const [fx, fy, rw, rh] of fingers) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, rw, rh, fx < -25 ? -0.9 : fx * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 1024x512 rotten-wood warning board with scratched, ghost-lit lettering. */
export function createWarningSignTexture(): THREE.CanvasTexture | null {
  const W = 1024;
  const H = 512;
  const surface = createCanvas(W, H);
  if (!surface) return null;
  const { canvas, ctx } = surface;
  const rng = createRng(0x51617);

  // Weathered, rain-blackened planks
  const planks = 4;
  for (let p = 0; p < planks; p++) {
    const y0 = (p / planks) * H;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + H / planks);
    const base = 28 + rng() * 14;
    g.addColorStop(0, `rgb(${base + 8},${base},${base - 6})`);
    g.addColorStop(1, `rgb(${base - 6},${base - 10},${base - 14})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, H / planks);
    // Wood grain
    for (let l = 0; l < 26; l++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.12 + rng() * 0.2})`;
      ctx.lineWidth = 1 + rng() * 2;
      const gy = y0 + rng() * (H / planks);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= W; x += 64) {
        ctx.lineTo(x, gy + Math.sin(x * 0.01 + l) * 3 + (rng() - 0.5) * 3);
      }
      ctx.stroke();
    }
    // Plank seam
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, y0, W, 4);
  }

  // Rusted nails
  for (const [nx, ny] of [
    [44, 64],
    [W - 44, 64],
    [44, H - 64],
    [W - 44, H - 64],
    [W / 2, 30],
  ] as const) {
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 12);
    ng.addColorStop(0, "#6b4a2b");
    ng.addColorStop(0.6, "#3a2414");
    ng.addColorStop(1, "rgba(58,36,20,0)");
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(nx, ny, 12, 0, Math.PI * 2);
    ctx.fill();
    // Rust bleed
    const rg = ctx.createLinearGradient(nx, ny, nx, ny + 70);
    rg.addColorStop(0, "rgba(110,50,20,0.55)");
    rg.addColorStop(1, "rgba(110,50,20,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(nx - 3, ny, 6, 70);
  }

  // Ghostly handprints pressed into the wood
  paintHandprint(ctx, 140, 380, 1.1, -0.35, 0.16);
  paintHandprint(ctx, 890, 150, 1.0, 0.4, 0.13);
  paintHandprint(ctx, 820, 420, 0.9, 0.15, 0.1);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // "WARNING" in dripping blood-red paint
  ctx.save();
  ctx.font = "900 112px Georgia, 'Times New Roman', serif";
  ctx.shadowColor = "rgba(220,38,38,0.65)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#a3161b";
  ctx.fillText("WARNING", W / 2, 104);
  ctx.restore();
  ctx.fillStyle = "#7f1014";
  for (let d = 0; d < 16; d++) {
    const dx = W / 2 - 250 + rng() * 500;
    const len = 20 + rng() * 70;
    const dw = 3 + rng() * 5;
    ctx.fillRect(dx, 140, dw, len);
    ctx.beginPath();
    ctx.arc(dx + dw / 2, 140 + len, dw * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ghost-lit body lettering
  ctx.save();
  ctx.shadowColor = "rgba(200,235,220,0.8)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#e7ebe2";
  ctx.font = "700 42px Georgia, 'Times New Roman', serif";
  ctx.fillText("THE GATE HAS SEALED BEHIND YOU.", W / 2, 236);
  ctx.fillText("NO SOUL LEAVES RAVENSHOLLOW", W / 2, 292);
  ctx.fillText("UNTIL THE LIGHT IS RESTORED.", W / 2, 348);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(110,231,183,0.95)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#a7f3d0";
  ctx.font = "800 46px 'Courier New', monospace";
  ctx.fillText("— FIND  LIGHT MODE —", W / 2, 430);
  ctx.restore();

  // Claw scratches gouged through the paint
  ctx.lineCap = "round";
  for (let s = 0; s < 4; s++) {
    const sx = 560 + s * 22;
    ctx.strokeStyle = "rgba(8,6,6,0.85)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(sx, 190);
    ctx.quadraticCurveTo(sx + 50, 280, sx + 30, 380);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,100,80,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + 3, 192);
    ctx.quadraticCurveTo(sx + 53, 282, sx + 33, 382);
    ctx.stroke();
  }

  addGrain(ctx, W, H, 22, rng);
  return toTexture(canvas);
}
