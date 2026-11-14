import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  ArchiveEntry,
  CategoryManifest,
  MotifKind,
} from "../packages/templates/src/ninety9-archive/lib/archive/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const PALETTE = {
  white: "#FFFFFF",
  black: "#000000",
  lightGray: "#D9D9D9",
  mediumGray: "#808080",
  darkGray: "#292929",
} as const;

interface SchematicSpec {
  readonly slug: string;
  readonly kind: "ENTRY" | "CATEGORY";
  readonly topLeftLabel: string;
  readonly topRightLabel: string;
  readonly plateTitle: string;
  readonly plateSubtitle: string;
  readonly bottomCells: readonly [string, string, string, string];
  readonly motif: MotifKind;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

/** Deterministic FNV-1a 32-bit hash for reproducible plate geometry variations. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function createPrng(seedInput: string): () => number {
  let state = hashString(seedInput) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function buildSharedDefs(): string {
  return `<defs>
    <pattern id="ortho-grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${PALETTE.lightGray}" stroke-width="0.75" />
    </pattern>
    <pattern id="halftone-light" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${PALETTE.white}" />
      <circle cx="3" cy="3" r="1" fill="${PALETTE.lightGray}" />
    </pattern>
    <pattern id="halftone-medium" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${PALETTE.white}" />
      <circle cx="2" cy="2" r="1.15" fill="${PALETTE.mediumGray}" />
      <circle cx="5" cy="5" r="0.85" fill="${PALETTE.lightGray}" />
    </pattern>
    <pattern id="halftone-dark" width="5" height="5" patternUnits="userSpaceOnUse">
      <rect width="5" height="5" fill="${PALETTE.lightGray}" />
      <circle cx="2.5" cy="2.5" r="1.45" fill="${PALETTE.darkGray}" />
    </pattern>
    <pattern id="diag-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="${PALETTE.darkGray}" stroke-width="1.2" />
    </pattern>
    <pattern id="scan-lines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="${PALETTE.white}" />
      <rect y="2" width="4" height="2" fill="${PALETTE.lightGray}" />
    </pattern>
  </defs>`;
}

function renderOpticalDiscMotif(rand: () => number): string {
  const cx = 264;
  const cy = 236;
  const armAngle = -28 + Math.round(rand() * 24);
  const trackCount = 5 + Math.floor(rand() * 4);
  const rings = Array.from({ length: trackCount }, (_, idx) => {
    const r = 38 + idx * 10;
    const stroke = idx % 2 === 0 ? PALETTE.black : PALETTE.mediumGray;
    const dash = idx % 3 === 1 ? ' stroke-dasharray="6 4"' : "";
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="1.25"${dash} />`;
  }).join("\n    ");

  const waveformBars = Array.from({ length: 18 }, (_, i) => {
    const h = 14 + Math.round(rand() * 64);
    const x = 492 + i * 11;
    const y = 266 - h;
    const fill = i % 3 === 0 ? PALETTE.black : i % 2 === 0 ? PALETTE.darkGray : PALETTE.mediumGray;
    return `<rect x="${x}" y="${y}" width="7" height="${h}" fill="${fill}" />`;
  }).join("\n    ");

  return `<g>
    <rect x="468" y="114" width="236" height="244" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="472" y="118" width="228" height="22" fill="${PALETTE.black}" />
    <text x="480" y="133" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.white}">TOC // PCM-16BIT-44.1KHZ</text>
    <rect x="484" y="156" width="204" height="122" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    ${waveformBars}
    <line x1="484" y1="266" x2="688" y2="266" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="484" y="290" width="96" height="52" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <text x="492" y="310" font-family="monospace" font-size="9" fill="${PALETTE.darkGray}">WAVELENGTH</text>
    <text x="492" y="330" font-family="monospace" font-size="13" font-weight="700" fill="${PALETTE.black}">780 NM</text>
    <rect x="592" y="290" width="96" height="52" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <text x="600" y="310" font-family="monospace" font-size="9" fill="${PALETTE.darkGray}">PIT PITCH</text>
    <text x="600" y="330" font-family="monospace" font-size="13" font-weight="700" fill="${PALETTE.black}">1.6 UM</text>
    <circle cx="${cx}" cy="${cy}" r="126" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="2.5" />
    <circle cx="${cx}" cy="${cy}" r="118" fill="${PALETTE.white}" stroke="${PALETTE.darkGray}" stroke-width="1" />
    ${rings}
    <circle cx="${cx}" cy="${cy}" r="30" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <circle cx="${cx}" cy="${cy}" r="14" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="${cx - 140}" y1="${cy}" x2="${cx + 140}" y2="${cy}" stroke="${PALETTE.mediumGray}" stroke-width="1" stroke-dasharray="3 3" />
    <line x1="${cx}" y1="${cy - 140}" x2="${cx}" y2="${cy + 140}" stroke="${PALETTE.mediumGray}" stroke-width="1" stroke-dasharray="3 3" />
    <g transform="rotate(${armAngle} ${cx} ${cy})">
      <rect x="${cx + 42}" y="${cy - 8}" width="96" height="16" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
      <rect x="${cx + 42}" y="${cy - 4}" width="18" height="8" fill="${PALETTE.black}" />
      <circle cx="${cx + 128}" cy="${cy}" r="5" fill="${PALETTE.black}" />
    </g>
  </g>`;
}

function renderCinemaFrameMotif(rand: () => number): string {
  const aspectY = 128 + Math.floor(rand() * 14);
  const sprockets = Array.from({ length: 8 }, (_, idx) => {
    const y = 104 + idx * 34;
    return `<rect x="108" y="${y}" width="16" height="20" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="676" y="${y}" width="16" height="20" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />`;
  }).join("\n    ");

  const focalX = 330 + Math.round(rand() * 140);
  const focalY = 205 + Math.round(rand() * 55);

  return `<g>
    <rect x="96" y="96" width="608" height="284" fill="${PALETTE.black}" stroke="${PALETTE.black}" stroke-width="2" />
    ${sprockets}
    <rect x="142" y="${aspectY}" width="516" height="220" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="154" y="${aspectY + 12}" width="492" height="196" fill="url(#halftone-light)" stroke="${PALETTE.darkGray}" stroke-width="1" />
    <polygon points="154,${aspectY + 208} ${focalX},${focalY} 646,${aspectY + 208}" fill="url(#halftone-medium)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <line x1="154" y1="${aspectY + 12}" x2="${focalX}" y2="${focalY}" stroke="${PALETTE.black}" stroke-width="1.25" stroke-dasharray="5 3" />
    <line x1="646" y1="${aspectY + 12}" x2="${focalX}" y2="${focalY}" stroke="${PALETTE.black}" stroke-width="1.25" stroke-dasharray="5 3" />
    <circle cx="${focalX}" cy="${focalY}" r="42" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <circle cx="${focalX}" cy="${focalY}" r="28" fill="url(#diag-hatch)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <circle cx="${focalX}" cy="${focalY}" r="11" fill="${PALETTE.black}" />
    <path d="M 168 ${aspectY + 34} h 22 m -22 0 v 22 M 632 ${aspectY + 34} h -22 m 22 0 v 22 M 168 ${aspectY + 190} h 22 m -22 0 v -22 M 632 ${aspectY + 190} h -22 m 22 0 v -22" fill="none" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="506" y="${aspectY + 20}" width="128" height="24" fill="${PALETTE.black}" />
    <text x="514" y="${aspectY + 36}" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.white}">24 FPS // 35MM</text>
  </g>`;
}

function renderCrtOscilloscopeMotif(rand: () => number): string {
  const points: string[] = [];
  const phase = rand() * Math.PI;
  const freq = 2 + Math.floor(rand() * 3);
  for (let i = 0; i <= 36; i++) {
    const x = 148 + i * 10;
    const amp = 48 * Math.sin(i * 0.25 * freq + phase) * Math.cos(i * 0.08);
    const y = Math.round(234 + amp);
    points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  const wavePath = points.join(" ");

  const dials = [0, 1, 2].map((i) => {
    const cy = 148 + i * 74;
    const deg = -45 + Math.round(rand() * 190);
    return `<circle cx="628" cy="${cy}" r="24" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <circle cx="628" cy="${cy}" r="17" fill="url(#halftone-light)" stroke="${PALETTE.darkGray}" stroke-width="1" />
    <g transform="rotate(${deg} 628 ${cy})">
      <line x1="628" y1="${cy}" x2="628" y2="${cy - 18}" stroke="${PALETTE.black}" stroke-width="3" />
    </g>
    <rect x="598" y="${cy + 30}" width="60" height="12" fill="${PALETTE.black}" />`;
  }).join("\n    ");

  return `<g>
    <rect x="108" y="102" width="584" height="272" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="2.5" />
    <rect x="128" y="122" width="420" height="232" fill="${PALETTE.darkGray}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="140" y="134" width="396" height="208" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="140" y="134" width="396" height="208" fill="url(#scan-lines)" opacity="0.45" />
    <line x1="140" y1="238" x2="536" y2="238" stroke="${PALETTE.mediumGray}" stroke-width="1" stroke-dasharray="4 4" />
    <line x1="338" y1="134" x2="338" y2="342" stroke="${PALETTE.mediumGray}" stroke-width="1" stroke-dasharray="4 4" />
    <path d="${wavePath}" fill="none" stroke="${PALETTE.black}" stroke-width="3" stroke-linejoin="round" />
    <rect x="572" y="114" width="108" height="248" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    ${dials}
    <text x="150" y="152" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.black}">NTSC 525-LINE // CH-03</text>
  </g>`;
}

function renderCelGridMotif(rand: () => number): string {
  const tilt = -6 + Math.round(rand() * 12);
  const pegXs = [230, 400, 570];
  const pegs = pegXs
    .map(
      (x) =>
        `<rect x="${x - 14}" y="98" width="28" height="14" fill="${PALETTE.black}" />
    <circle cx="${x}" cy="105" r="3" fill="${PALETTE.white}" />`
    )
    .join("\n    ");

  const gridLines = Array.from({ length: 7 }, (_, i) => {
    const x = 150 + i * 75;
    return `<line x1="${x}" y1="120" x2="${x}" y2="360" stroke="${PALETTE.mediumGray}" stroke-width="0.9" />`;
  }).join("\n    ");

  return `<g>
    <rect x="130" y="112" width="540" height="258" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2.5" />
    ${pegs}
    <rect x="150" y="128" width="500" height="224" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    ${gridLines}
    <g transform="rotate(${tilt} 400 240)">
      <rect x="260" y="152" width="280" height="176" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
      <polygon points="400,164 474,316 326,316" fill="${PALETTE.black}" />
      <polygon points="400,192 438,298 362,298" fill="${PALETTE.white}" />
      <circle cx="400" cy="242" r="24" fill="url(#diag-hatch)" stroke="${PALETTE.black}" stroke-width="2" />
      <line x1="274" y1="240" x2="526" y2="240" stroke="${PALETTE.black}" stroke-width="1.5" stroke-dasharray="6 4" />
    </g>
    <rect x="162" y="314" width="142" height="26" fill="${PALETTE.black}" />
    <text x="170" y="331" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.white}">CEL LAYER A+B // 12FPS</text>
  </g>`;
}

function renderControllerPcbMotif(rand: () => number): string {
  const pins = Array.from({ length: 12 }, (_, i) => {
    const x = 294 + i * 18;
    return `<rect x="${x}" y="170" width="8" height="14" fill="${PALETTE.black}" />
    <rect x="${x}" y="284" width="8" height="14" fill="${PALETTE.black}" />`;
  }).join("\n    ");

  const traceShift = Math.round(rand() * 18);

  return `<g>
    <rect x="122" y="106" width="556" height="264" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="2.5" />
    <path d="M 122 148 H 284 V 190 M 122 184 H 244 V 230 H 284 M 514 210 H 592 V ${150 + traceShift} H 678 M 514 252 H 620 V ${310 - traceShift} H 678" fill="none" stroke="${PALETTE.black}" stroke-width="2" />
    <path d="M 122 308 H 248 V 264 H 284 M 514 276 H 568 V 338 H 678" fill="none" stroke="${PALETTE.darkGray}" stroke-width="1.5" />
    <rect x="284" y="182" width="230" height="104" fill="${PALETTE.black}" stroke="${PALETTE.black}" stroke-width="2" />
    ${pins}
    <rect x="298" y="196" width="202" height="76" fill="${PALETTE.white}" stroke="${PALETTE.white}" stroke-width="1" />
    <text x="312" y="226" font-family="monospace" font-size="14" font-weight="700" fill="${PALETTE.black}">32/64-BIT RISC</text>
    <text x="312" y="250" font-family="monospace" font-size="11" fill="${PALETTE.darkGray}">GEOMETRY + TEXTURE BUS</text>
    <g transform="translate(180 236)">
      <rect x="-12" y="-34" width="24" height="68" fill="${PALETTE.black}" />
      <rect x="-34" y="-12" width="68" height="24" fill="${PALETTE.black}" />
      <circle cx="0" cy="0" r="8" fill="${PALETTE.white}" />
    </g>
    <g transform="translate(612 224)">
      <circle cx="-18" cy="0" r="14" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
      <circle cx="18" cy="0" r="14" fill="${PALETTE.black}" />
      <circle cx="0" cy="-22" r="14" fill="url(#halftone-dark)" stroke="${PALETTE.black}" stroke-width="2" />
      <circle cx="0" cy="22" r="14" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    </g>
  </g>`;
}

function renderWorkstationMacMotif(rand: () => number): string {
  const offset = Math.round(rand() * 24);
  const progressWidth = 90 + Math.round(rand() * 70);

  return `<g>
    <rect x="192" y="96" width="416" height="284" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="2.5" />
    <rect x="216" y="116" width="368" height="206" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="216" y="116" width="368" height="20" fill="${PALETTE.black}" />
    <text x="228" y="130" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.white}">NEXTSTEP // SYSTEM 7 MONOLITH</text>
    <rect x="${242 + offset}" y="152" width="220" height="142" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="${242 + offset}" y="152" width="220" height="18" fill="${PALETTE.darkGray}" />
    <line x1="${242 + offset}" y1="170" x2="${462 + offset}" y2="170" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="${256 + offset}" y="186" width="192" height="18" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="${256 + offset}" y="186" width="${progressWidth}" height="18" fill="${PALETTE.black}" />
    <rect x="${256 + offset}" y="218" width="84" height="58" fill="url(#halftone-medium)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="${350 + offset}" y="218" width="98" height="58" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <line x1="${360 + offset}" y1="234" x2="${434 + offset}" y2="234" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="${360 + offset}" y1="248" x2="${420 + offset}" y2="248" stroke="${PALETTE.mediumGray}" stroke-width="2" />
    <line x1="${360 + offset}" y1="262" x2="${438 + offset}" y2="262" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="406" y="340" width="168" height="18" fill="${PALETTE.black}" />
    <rect x="224" y="340" width="24" height="18" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <circle cx="280" cy="349" r="7" fill="${PALETTE.darkGray}" stroke="${PALETTE.black}" stroke-width="1.5" />
  </g>`;
}

function renderSiliconChipMotif(rand: () => number): string {
  const clockDiv = 6 + Math.floor(rand() * 4);
  const pins = Array.from({ length: 10 }, (_, i) => {
    const pos = 166 + i * 24;
    return `<line x1="250" y1="${pos}" x2="274" y2="${pos}" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="526" y1="${pos}" x2="550" y2="${pos}" stroke="${PALETTE.black}" stroke-width="2" />`;
  }).join("\n    ");
  const topPins = Array.from({ length: 10 }, (_, i) => {
    const pos = 290 + i * 24;
    return `<line x1="${pos}" y1="100" x2="${pos}" y2="124" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="${pos}" y1="354" x2="${pos}" y2="378" stroke="${PALETTE.black}" stroke-width="2" />`;
  }).join("\n    ");

  return `<g>
    ${pins}
    ${topPins}
    <rect x="274" y="124" width="252" height="230" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="3" />
    <rect x="292" y="142" width="216" height="194" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="308" y="156" width="88" height="76" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="406" y="156" width="88" height="76" fill="url(#diag-hatch)" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="308" y="242" width="186" height="80" fill="${PALETTE.black}" />
    <text x="322" y="274" font-family="monospace" font-size="13" font-weight="700" fill="${PALETTE.white}">ALU // L1 CACHE</text>
    <text x="322" y="298" font-family="monospace" font-size="11" fill="${PALETTE.lightGray}">CLOCK DIV x${clockDiv} // CMOS</text>
    <circle cx="294" cy="144" r="7" fill="${PALETTE.black}" />
  </g>`;
}

function renderBrowserWindowMotif(rand: () => number): string {
  const winShift = Math.round(rand() * 20);
  return `<g>
    <rect x="116" y="102" width="568" height="274" fill="${PALETTE.black}" />
    <rect x="110" y="96" width="568" height="274" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2.5" />
    <rect x="110" y="96" width="568" height="26" fill="${PALETTE.black}" />
    <rect x="118" y="102" width="14" height="14" fill="${PALETTE.white}" />
    <text x="142" y="114" font-family="monospace" font-size="11" font-weight="700" fill="${PALETTE.white}">HTTP/1.0 // DOCUMENT VIEWPORT</text>
    <rect x="110" y="122" width="568" height="28" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="122" y="127" width="44" height="18" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="172" y="127" width="44" height="18" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="228" y="127" width="436" height="18" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <text x="236" y="140" font-family="monospace" font-size="10" fill="${PALETTE.black}">http://info.cern.ch/archive/index.html</text>
    <rect x="128" y="166" width="160" height="184" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="${306 + winShift}" y="166" width="318" height="86" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="${320 + winShift}" y1="190" x2="${566 + winShift}" y2="190" stroke="${PALETTE.black}" stroke-width="4" />
    <line x1="${320 + winShift}" y1="210" x2="${532 + winShift}" y2="210" stroke="${PALETTE.darkGray}" stroke-width="2" />
    <line x1="${320 + winShift}" y1="228" x2="${484 + winShift}" y2="228" stroke="${PALETTE.black}" stroke-width="2" stroke-dasharray="4 2" />
    <rect x="306" y="266" width="166" height="84" fill="url(#diag-hatch)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="488" y="266" width="174" height="84" fill="${PALETTE.black}" />
    <text x="502" y="302" font-family="monospace" font-size="12" font-weight="700" fill="${PALETTE.white}">&lt;HTML 2.0&gt;</text>
    <text x="502" y="324" font-family="monospace" font-size="10" fill="${PALETTE.lightGray}">GIF89A READY</text>
    <rect x="660" y="150" width="18" height="220" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="662" y="182" width="14" height="54" fill="${PALETTE.black}" />
  </g>`;
}

function renderRunwayMonolithMotif(rand: () => number): string {
  const cutRatio = Math.round(rand() * 32);
  return `<g>
    <polygon points="400,98 638,370 162,370" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <rect x="190" y="114" width="172" height="242" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="438" y="114" width="172" height="242" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <path d="M 224 148 L 328 148 L 314 236 L 336 336 L 216 336 L 238 236 Z" fill="url(#halftone-medium)" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="276" y1="138" x2="276" y2="344" stroke="${PALETTE.black}" stroke-width="1.5" stroke-dasharray="6 4" />
    <rect x="466" y="144" width="116" height="${76 + cutRatio}" fill="${PALETTE.black}" />
    <text x="480" y="180" font-family="monospace" font-size="16" font-weight="700" fill="${PALETTE.white}">PATTERN</text>
    <text x="480" y="202" font-family="monospace" font-size="11" fill="${PALETTE.lightGray}">GRADE: MONO</text>
    <line x1="466" y1="286" x2="582" y2="286" stroke="${PALETTE.black}" stroke-width="2" />
    <line x1="466" y1="308" x2="582" y2="308" stroke="${PALETTE.black}" stroke-width="2" stroke-dasharray="3 3" />
    <line x1="466" y1="330" x2="548" y2="330" stroke="${PALETTE.mediumGray}" stroke-width="2" />
  </g>`;
}

function renderRaveSpeakerMotif(rand: () => number): string {
  const activeStep = Math.floor(rand() * 8);
  const steps = Array.from({ length: 8 }, (_, idx) => {
    const x = 446 + idx * 28;
    const isOn = idx === activeStep || idx % 2 === 0;
    return `<rect x="${x}" y="302" width="22" height="36" fill="${isOn ? PALETTE.black : PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />`;
  }).join("\n    ");

  return `<g>
    <rect x="132" y="102" width="252" height="270" fill="${PALETTE.black}" />
    <rect x="148" y="118" width="220" height="238" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <circle cx="258" cy="184" r="50" fill="url(#halftone-dark)" stroke="${PALETTE.black}" stroke-width="2.5" />
    <circle cx="258" cy="184" r="20" fill="${PALETTE.black}" />
    <circle cx="258" cy="296" r="46" fill="url(#halftone-medium)" stroke="${PALETTE.black}" stroke-width="2.5" />
    <circle cx="258" cy="296" r="18" fill="${PALETTE.black}" />
    <rect x="424" y="114" width="256" height="246" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="444" y="134" width="216" height="128" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <path d="M 454 220 Q 502 150 552 204 T 648 184" fill="none" stroke="${PALETTE.black}" stroke-width="3" />
    <text x="446" y="286" font-family="monospace" font-size="11" font-weight="700" fill="${PALETTE.black}">TB-303 // 134 BPM SEQ</text>
    ${steps}
  </g>`;
}

function renderToyLcdMotif(rand: () => number): string {
  const cells: string[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const filled = rand() > 0.44;
      if (filled) {
        const x1 = 336 + col * 16;
        const x2 = 336 + (7 - col) * 16;
        const y = 152 + row * 16;
        cells.push(`<rect x="${x1}" y="${y}" width="14" height="14" fill="${PALETTE.black}" />`);
        cells.push(`<rect x="${x2}" y="${y}" width="14" height="14" fill="${PALETTE.black}" />`);
      }
    }
  }

  return `<g>
    <rect x="262" y="96" width="276" height="284" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="2.5" />
    <rect x="312" y="128" width="176" height="176" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2.5" />
    <rect x="328" y="144" width="144" height="144" fill="${PALETTE.lightGray}" stroke="${PALETTE.black}" stroke-width="1.5" />
    ${cells.join("\n    ")}
    <circle cx="332" cy="340" r="14" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <circle cx="400" cy="348" r="14" fill="${PALETTE.black}" />
    <circle cx="468" cy="340" r="14" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <text x="326" y="118" font-family="monospace" font-size="11" font-weight="700" fill="${PALETTE.black}">DOT MATRIX 32X16</text>
  </g>`;
}

function renderArenaCourtMotif(rand: () => number): string {
  const apexY = 128 + Math.round(rand() * 26);
  return `<g>
    <rect x="118" y="110" width="564" height="256" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2.5" />
    <rect x="130" y="122" width="540" height="232" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="1.5" />
    <line x1="400" y1="122" x2="400" y2="354" stroke="${PALETTE.black}" stroke-width="2" />
    <circle cx="400" cy="238" r="46" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="130" y="186" width="108" height="104" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <rect x="562" y="186" width="108" height="104" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <path d="M 130 144 H 204 A 104 104 0 0 1 204 332 H 130" fill="none" stroke="${PALETTE.black}" stroke-width="2" />
    <path d="M 670 144 H 596 A 104 104 0 0 0 596 332 H 670" fill="none" stroke="${PALETTE.black}" stroke-width="2" />
    <path d="M 192 238 Q 396 ${apexY} 618 238" fill="none" stroke="${PALETTE.black}" stroke-width="2.5" stroke-dasharray="6 4" />
    <circle cx="618" cy="238" r="10" fill="${PALETTE.black}" />
  </g>`;
}

function renderNetworkTopologyMotif(rand: () => number): string {
  const nodes: Array<readonly [number, number, string]> = [
    [194, 152, "NODE-01"],
    [400, 128, "ROOT-DNS"],
    [606, 156, "NODE-02"],
    [256, 294, "GATEWAY"],
    [544, 296, "MIRROR"],
    [400, 232, "HUB-99"],
  ];

  const links = [
    [0, 1],
    [1, 2],
    [0, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [3, 4],
    [0, 3],
    [2, 4],
  ]
    .map(([a, b]) => {
      const na = nodes[a]!;
      const nb = nodes[b]!;
      return `<line x1="${na[0]}" y1="${na[1]}" x2="${nb[0]}" y2="${nb[1]}" stroke="${PALETTE.black}" stroke-width="1.75" />`;
    })
    .join("\n    ");

  const nodeShapes = nodes
    .map(([x, y, label], idx) => {
      const w = 88;
      const h = 32;
      const isDark = idx === 5 || rand() > 0.65;
      return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="${isDark ? PALETTE.black : PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
    <text x="${x}" y="${y + 4}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="${isDark ? PALETTE.white : PALETTE.black}">${label}</text>`;
    })
    .join("\n    ");

  return `<g>
    <rect x="116" y="96" width="568" height="276" fill="url(#halftone-light)" stroke="${PALETTE.black}" stroke-width="2" />
    ${links}
    ${nodeShapes}
    <rect x="284" y="330" width="232" height="26" fill="${PALETTE.black}" />
    <text x="400" y="347" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="${PALETTE.white}">CLOCK: 1999-12-31 TO 2000</text>
  </g>`;
}

function renderMotifBody(motif: MotifKind, seedSlug: string): string {
  const rand = createPrng(seedSlug);
  switch (motif) {
    case "optical-disc":
      return renderOpticalDiscMotif(rand);
    case "cinema-frame":
      return renderCinemaFrameMotif(rand);
    case "crt-oscilloscope":
      return renderCrtOscilloscopeMotif(rand);
    case "cel-grid":
      return renderCelGridMotif(rand);
    case "controller-pcb":
      return renderControllerPcbMotif(rand);
    case "workstation-mac":
      return renderWorkstationMacMotif(rand);
    case "silicon-chip":
      return renderSiliconChipMotif(rand);
    case "browser-window":
      return renderBrowserWindowMotif(rand);
    case "runway-monolith":
      return renderRunwayMonolithMotif(rand);
    case "rave-speaker":
      return renderRaveSpeakerMotif(rand);
    case "toy-lcd":
      return renderToyLcdMotif(rand);
    case "arena-court":
      return renderArenaCourtMotif(rand);
    case "network-topology":
      return renderNetworkTopologyMotif(rand);
  }
}

function renderSchematicSvg(spec: SchematicSpec): string {
  const hash = hashString(spec.slug);
  const barcodeRects = Array.from({ length: 16 }, (_, idx) => {
    const bit = (hash >> (idx % 31)) & 1;
    const width = bit === 1 ? 3 : 1.5;
    const x = 668 + idx * 5;
    return `<rect x="${x}" y="446" width="${width}" height="24" fill="${PALETTE.black}" />`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500" role="img" aria-label="${escapeXml(spec.plateTitle)}">
  ${buildSharedDefs()}
  <rect width="800" height="500" fill="${PALETTE.white}" />
  <rect x="12" y="12" width="776" height="476" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2.5" />
  <rect x="20" y="20" width="760" height="460" fill="url(#ortho-grid)" stroke="${PALETTE.darkGray}" stroke-width="1" />

  <!-- Top Telemetry Bar -->
  <rect x="20" y="20" width="760" height="36" fill="${PALETTE.black}" />
  <text x="34" y="42" font-family="monospace" font-size="13" font-weight="700" fill="${PALETTE.white}">${escapeXml(spec.topLeftLabel)}</text>
  <text x="766" y="42" text-anchor="end" font-family="monospace" font-size="12" font-weight="700" fill="${PALETTE.lightGray}">${escapeXml(spec.topRightLabel)}</text>

  <!-- Corner Registration Marks -->
  <path d="M 32 72 h 12 m -6 -6 v 12 M 768 72 h -12 m 6 -6 v 12 M 32 414 h 12 m -6 -6 v 12 M 768 414 h -12 m 6 -6 v 12" fill="none" stroke="${PALETTE.black}" stroke-width="1.5" />

  <!-- Central Motif Schematic -->
  ${renderMotifBody(spec.motif, spec.slug)}

  <!-- Plate Identification Strip -->
  <rect x="34" y="388" width="732" height="38" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="2" />
  <rect x="34" y="388" width="112" height="38" fill="${PALETTE.black}" />
  <text x="90" y="411" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="${PALETTE.white}">${spec.kind}</text>
  <text x="160" y="405" font-family="monospace" font-size="13" font-weight="700" fill="${PALETTE.black}">${escapeXml(truncateText(spec.plateTitle, 44))}</text>
  <text x="160" y="420" font-family="monospace" font-size="10" fill="${PALETTE.darkGray}">${escapeXml(truncateText(spec.plateSubtitle, 68))}</text>

  <!-- Bottom 4-Cell Brutalist Telemetry Grid + Barcode -->
  <rect x="34" y="434" width="152" height="40" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
  <text x="42" y="458" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.black}">${escapeXml(truncateText(spec.bottomCells[0], 18))}</text>

  <rect x="190" y="434" width="152" height="40" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
  <text x="198" y="458" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.black}">${escapeXml(truncateText(spec.bottomCells[1], 18))}</text>

  <rect x="346" y="434" width="152" height="40" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
  <text x="354" y="458" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.black}">${escapeXml(truncateText(spec.bottomCells[2], 18))}</text>

  <rect x="502" y="434" width="152" height="40" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
  <text x="510" y="458" font-family="monospace" font-size="10" font-weight="700" fill="${PALETTE.black}">${escapeXml(truncateText(spec.bottomCells[3], 18))}</text>

  <rect x="658" y="434" width="108" height="40" fill="${PALETTE.white}" stroke="${PALETTE.black}" stroke-width="1.5" />
  ${barcodeRects}
</svg>
`;
}

function assertStrictMonochromeSvg(
  svgContent: string,
  filePath: string,
  allowedHexes: ReadonlySet<string>
): void {
  const hexMatches = svgContent.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  for (const hex of hexMatches) {
    const normalized = hex.toUpperCase();
    if (!allowedHexes.has(normalized)) {
      throw new Error(
        `Off-palette hex color ${normalized} found in ${filePath}. Allowed: ${[...allowedHexes].join(", ")}`
      );
    }
  }
  if (/\brgba?\(|\bhsla?\(/i.test(svgContent)) {
    throw new Error(`Disallowed rgb/hsl color function found in ${filePath}`);
  }
}

async function main(): Promise<void> {
  console.log("[ninety9-assets] Compiling @genui-studio/templates...");
  execSync("pnpm --filter @genui-studio/templates build", {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  const distBase = path.join(
    ROOT_DIR,
    "packages",
    "templates",
    "dist",
    "ninety9-archive"
  );

  const typesMod = (await import(
    pathToFileURL(path.join(distBase, "lib", "archive", "types.js")).href
  )) as {
    ALLOWED_MONOCHROME_HEXES: readonly string[];
  };

  const categoriesMod = (await import(
    pathToFileURL(path.join(distBase, "content", "categories.js")).href
  )) as {
    CATEGORIES: readonly CategoryManifest[];
  };

  const entriesMod = (await import(
    pathToFileURL(path.join(distBase, "content", "entries.js")).href
  )) as {
    ARCHIVE_ENTRIES: readonly ArchiveEntry[];
  };

  const allowedHexes = new Set(
    typesMod.ALLOWED_MONOCHROME_HEXES.map((hex) => hex.toUpperCase())
  );

  const entriesOutDir = path.join(ROOT_DIR, "public", "images", "ninety9", "entries");
  const categoriesOutDir = path.join(
    ROOT_DIR,
    "public",
    "images",
    "ninety9",
    "categories"
  );
  fs.mkdirSync(entriesOutDir, { recursive: true });
  fs.mkdirSync(categoriesOutDir, { recursive: true });

  let generatedCount = 0;

  for (const entry of entriesMod.ARCHIVE_ENTRIES) {
    const svg = renderSchematicSvg({
      slug: entry.slug,
      kind: "ENTRY",
      topLeftLabel: `NINETY9 // ${entry.serialNumber} // ${entry.id}`,
      topRightLabel: `${entry.monthLabel.toUpperCase()} // CAT-${entry.categoryCode}`,
      plateTitle: entry.title.toUpperCase(),
      plateSubtitle: `${entry.creatorOrPublisher.toUpperCase()} — ${entry.origin.toUpperCase()}`,
      bottomCells: [
        entry.type,
        `YEAR: ${entry.year}`,
        `SECTOR: ${entry.category.toUpperCase()}`,
        entry.specs[0]?.value.toUpperCase() ?? "ARCHIVED",
      ],
      motif: entry.illustrationMotif,
    });

    const outPath = path.join(entriesOutDir, `${entry.slug}.svg`);
    assertStrictMonochromeSvg(svg, outPath, allowedHexes);
    fs.writeFileSync(outPath, svg, "utf8");
    generatedCount++;
  }

  for (const category of categoriesMod.CATEGORIES) {
    const svg = renderSchematicSvg({
      slug: category.slug,
      kind: "CATEGORY",
      topLeftLabel: `NINETY9 // INDEX ${category.label}`,
      topRightLabel: `YEARS: ${category.keyYears.join(" / ")}`,
      plateTitle: category.shortLabel.toUpperCase(),
      plateSubtitle: category.tagline.toUpperCase(),
      bottomCells: [
        `SECTION: ${category.code}`,
        `SECTOR: ${category.slug.toUpperCase()}`,
        `KEYS: ${category.keyYears.length}`,
        "5-TONE MONO",
      ],
      motif: category.illustrationMotif,
    });

    const outPath = path.join(categoriesOutDir, `${category.slug}.svg`);
    assertStrictMonochromeSvg(svg, outPath, allowedHexes);
    fs.writeFileSync(outPath, svg, "utf8");
    generatedCount++;
  }

  console.log(
    `[ninety9-assets] Generated ${generatedCount} strict 5-tone monochrome SVGs (${entriesMod.ARCHIVE_ENTRIES.length} entries + ${categoriesMod.CATEGORIES.length} categories).`
  );
}

main().catch((error) => {
  console.error("[ninety9-assets] Generation failed:", error);
  process.exit(1);
});
