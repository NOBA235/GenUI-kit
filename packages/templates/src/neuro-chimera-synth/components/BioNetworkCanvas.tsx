import React, { useEffect, useRef } from "react";
import { MAX_LINKS, MAX_NODES, type BioNodeKind, type NetworkTelemetry } from "../lib/chimera/bio-solver.js";
import {
  CREW_AGENT_NAMES,
  WORKER_FLIGHT_MS,
  dispatchAgent,
  getLabNetwork,
  getLabStore,
  injectBestIndex,
  moveLabNode,
  setLab,
  toggleNode,
  useLab,
} from "./lab-store.js";

export interface BioNetworkCanvasProps {
  readonly caption: string;
  /** Maximum flux particles alive at once (pool size). */
  readonly particleBudget: number;
  readonly showLabels: boolean;
}

/* ═══════════════════════════ Static drawing constants ═══════════════════════════ */

const FLUX_RGB = [0, 245, 184] as const;
const MUTATION_RGB = [255, 42, 109] as const;
const COLOR_STEPS = 16;
/** Pre-built CSS colour strings from flux (0) to mutation (16): the frame loop never builds strings. */
const LINK_COLORS: readonly string[] = Array.from({ length: COLOR_STEPS + 1 }, (_, i) => {
  const t = i / COLOR_STEPS;
  const mix = (k: 0 | 1 | 2) => Math.round(FLUX_RGB[k] + (MUTATION_RGB[k] - FLUX_RGB[k]) * t);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
});
const NODE_FILL = ["#00F5B8", "#FFB000", "#FF2A6D", "#3b4a50"] as const;
const NODE_STATE_LABEL = ["healthy", "warm", "fault", "severed"] as const;
const DASH: number[] = [4, 6];
const NO_DASH: number[] = [];
const LABEL_FONT = "11px ui-monospace, Consolas, monospace";
const PAD = 36;
const SPAWN_PER_SECOND = 70;
export const MAX_PARTICLES = 1500;
const PULSE_HZ = 1.5; // below the 3 flashes/second limit
const KIND_CODE: Readonly<Record<BioNodeKind, number>> = { gateway: 0, service: 1, agent: 2, primary: 3, replica: 3, shard: 3 };
const KIND_RADIUS = [9, 7.5, 8, 11] as const;

/** Node status: 0 healthy, 1 warm (load or mixed faults), 2 fault (saturated or full scans), 3 severed. */
export function nodeStatus(t: NetworkTelemetry, nodeId: string): 0 | 1 | 2 | 3 {
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  if (!node.alive) return 3;
  let flux = 0;
  let fault = 0;
  for (const l of t.links) {
    if (l.a === nodeId || l.b === nodeId) {
      flux += l.flux;
      fault += l.faultFlux;
    }
  }
  const faultRatio = flux > 1e-9 ? fault / flux : 0;
  if (node.saturated || faultRatio > 0.3) return 2;
  if (node.load > 0.7 || faultRatio > 0.05) return 1;
  return 0;
}

export function nodeStatusLabel(status: 0 | 1 | 2 | 3): string {
  return NODE_STATE_LABEL[status];
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/* ═══════════════════════════ Component ═══════════════════════════ */

export const BioNetworkCanvas: React.FC<BioNetworkCanvasProps> = ({ caption, particleBudget, showLabels }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const telemetry = useLab((s) => s.telemetry);
  const selectedNodeId = useLab((s) => s.selectedNodeId);
  const network = getLabNetwork();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;
    const store = getLabStore();
    const budget = Math.max(0, Math.min(MAX_PARTICLES, Math.floor(particleBudget)));

    // Geometry buffers, refilled from telemetry by the store subscription (outside the frame loop).
    const nodeX = new Float32Array(MAX_NODES);
    const nodeY = new Float32Array(MAX_NODES);
    const nodeR = new Float32Array(MAX_NODES);
    const nodeState = new Uint8Array(MAX_NODES);
    const linkA = new Int16Array(MAX_LINKS);
    const linkB = new Int16Array(MAX_LINKS);
    const linkFlux = new Float32Array(MAX_LINKS);
    const linkFaultRatio = new Float32Array(MAX_LINKS);
    const linkCond = new Float32Array(MAX_LINKS);
    const linkActive = new Uint8Array(MAX_LINKS);
    const linkSpeed = new Float32Array(MAX_LINKS);
    const spawnAcc = new Float32Array(MAX_LINKS);
    const spawnCount = new Uint32Array(MAX_LINKS);
    let nodeCount = 0;
    let linkCount = 0;
    let labels: readonly string[] = [];
    let nodeIds: readonly string[] = [];

    // Particle pool.
    const pLink = new Int16Array(budget).fill(-1);
    const pT = new Float32Array(budget);
    const pDir = new Int8Array(budget);
    const pFault = new Uint8Array(budget);
    let cursor = 0;

    let width = 0;
    let height = 0;
    const sizeCanvas = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const sync = (t: NetworkTelemetry) => {
      const index = new Map<string, number>();
      nodeCount = Math.min(MAX_NODES, t.nodes.length);
      const kinds = getLabNetwork().nodes;
      for (let i = 0; i < nodeCount; i++) {
        const n = t.nodes[i]!;
        index.set(n.id, i);
        nodeX[i] = n.x;
        nodeY[i] = n.y;
        nodeR[i] = KIND_RADIUS[KIND_CODE[kinds[i]?.kind ?? "service"] as 0 | 1 | 2 | 3];
        nodeState[i] = nodeStatus(t, n.id);
      }
      linkCount = Math.min(MAX_LINKS, t.links.length);
      for (let i = 0; i < linkCount; i++) {
        const l = t.links[i]!;
        linkA[i] = index.get(l.a) ?? 0;
        linkB[i] = index.get(l.b) ?? 0;
        linkFlux[i] = l.flux;
        linkFaultRatio[i] = l.flux > 1e-9 ? l.faultFlux / l.flux : 0;
        linkCond[i] = l.conductivity;
        linkActive[i] = l.active ? 1 : 0;
        // Fraction of the link travelled per second: fast on thick, low-latency tubes.
        linkSpeed[i] = (0.25 + 0.75 * Math.min(1, l.conductivity * 1.6)) / (0.6 + Math.log10(1 + l.latencyMs));
      }
      if (labels.length !== nodeCount) {
        labels = kinds.slice(0, nodeCount).map((n) => n.label);
        nodeIds = kinds.slice(0, nodeCount).map((n) => n.id);
      }
    };
    sync(store.getState().telemetry);
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.telemetry !== prev.telemetry) sync(state.telemetry);
      if (state.scenarioId !== prev.scenarioId) {
        pLink.fill(-1);
        spawnAcc.fill(0);
        labels = [];
        sync(state.telemetry);
      }
    });

    sizeCanvas();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sizeCanvas) : null;
    observer?.observe(wrap);

    const px = (i: number): number => PAD + (nodeX[i] ?? 0) * (width - 2 * PAD);
    const py = (i: number): number => PAD + (nodeY[i] ?? 0) * (height - 2 * PAD);
    let reducedMotion = prefersReducedMotion();
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery?.addEventListener("change", onMotion);

    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      frame = window.requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      ctx.clearRect(0, 0, width, height);

      // Tubes: a wide translucent glow pass, then a thin bright core.
      for (let i = 0; i < linkCount; i++) {
        const a = linkA[i]!;
        const b = linkB[i]!;
        const color = LINK_COLORS[Math.round(Math.min(1, linkFaultRatio[i]!) * COLOR_STEPS)]!;
        const strength = Math.min(1, linkFlux[i]! * 3);
        ctx.setLineDash(linkActive[i] ? NO_DASH : DASH);
        ctx.strokeStyle = linkActive[i] ? color : "#3b4a50";
        ctx.globalAlpha = linkActive[i] ? 0.12 + 0.25 * strength : 0.35;
        ctx.lineWidth = 3 + linkCond[i]! * 14;
        ctx.beginPath();
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
        ctx.stroke();
        if (!linkActive[i]) continue;
        ctx.globalAlpha = 0.35 + 0.65 * strength;
        ctx.lineWidth = 0.8 + linkCond[i]! * 3.5;
        ctx.stroke();
      }
      ctx.setLineDash(NO_DASH);

      // Flux particles (skipped under reduced motion; tube brightness still shows flux).
      if (!reducedMotion && budget > 0) {
        for (let i = 0; i < linkCount; i++) {
          if (!linkActive[i]) continue;
          spawnAcc[i] = spawnAcc[i]! + linkFlux[i]! * SPAWN_PER_SECOND * dt;
          while (spawnAcc[i]! >= 1) {
            spawnAcc[i] = spawnAcc[i]! - 1;
            let slot = -1;
            for (let k = 0; k < budget; k++) {
              const c = (cursor + k) % budget;
              if (pLink[c] === -1) {
                slot = c;
                break;
              }
            }
            if (slot === -1) {
              spawnAcc[i] = 0;
              break;
            }
            cursor = (slot + 1) % budget;
            const forward = nodeX[linkB[i]!]! >= nodeX[linkA[i]!]!;
            pLink[slot] = i;
            pDir[slot] = forward ? 1 : -1;
            pT[slot] = forward ? 0 : 1;
            spawnCount[i] = spawnCount[i]! + 1;
            pFault[slot] = spawnCount[i]! % COLOR_STEPS < Math.round(linkFaultRatio[i]! * COLOR_STEPS) ? 1 : 0;
          }
        }
        for (let pass = 0; pass < 2; pass++) {
          ctx.fillStyle = pass === 0 ? LINK_COLORS[0]! : LINK_COLORS[COLOR_STEPS]!;
          ctx.globalAlpha = 0.95;
          for (let p = 0; p < budget; p++) {
            const l = pLink[p]!;
            if (l === -1 || pFault[p] !== pass) continue;
            const t = pT[p]! + pDir[p]! * linkSpeed[l]! * dt;
            if (t < 0 || t > 1 || !linkActive[l]) {
              pLink[p] = -1;
              continue;
            }
            pT[p] = t;
            const a = linkA[l]!;
            const b = linkB[l]!;
            const x = px(a) + (px(b) - px(a)) * t;
            const y = py(a) + (py(b) - py(a)) * t;
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
          }
        }
      }

      // Crew worker sprites flying from the gateway to their target node.
      const workers = store.getState().workers;
      ctx.fillStyle = "#FFB000";
      ctx.globalAlpha = 1;
      for (let w = 0; w < workers.length; w++) {
        const sprite = workers[w]!;
        const progress = (now - sprite.startedAt) / WORKER_FLIGHT_MS;
        if (progress < 0 || progress > 1) continue;
        const from = nodeIds.indexOf(sprite.fromNodeId);
        const to = nodeIds.indexOf(sprite.toNodeId);
        if (from < 0 || to < 0) continue;
        const e = progress * progress * (3 - 2 * progress);
        const x = px(from) + (px(to) - px(from)) * e;
        const y = py(from) + (py(to) - py(from)) * e;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();
      }

      // Nodes.
      const pulse = reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(now * 0.001 * Math.PI * 2 * PULSE_HZ);
      const selected = store.getState().selectedNodeId;
      ctx.font = LABEL_FONT;
      for (let i = 0; i < nodeCount; i++) {
        const x = px(i);
        const y = py(i);
        const r = nodeR[i]!;
        const state = nodeState[i]!;
        ctx.globalAlpha = state === 2 ? 0.25 * pulse : 0.18;
        ctx.fillStyle = NODE_FILL[state]!;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = state === 2 ? pulse : 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (state === 3) {
          ctx.strokeStyle = "#FF2A6D";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(x - r, y - r);
          ctx.lineTo(x + r, y + r);
          ctx.moveTo(x + r, y - r);
          ctx.lineTo(x - r, y + r);
          ctx.stroke();
        }
        if (selected !== null && nodeIds[i] === selected) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#FFB000";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (showLabels) {
          ctx.globalAlpha = state === 3 ? 0.5 : 0.85;
          ctx.fillStyle = "#d9fff4";
          ctx.fillText(labels[i] ?? "", x + r + 6, y + 4);
        }
      }
      ctx.globalAlpha = 1;
    };
    frame = window.requestAnimationFrame(draw);

    // Pointer: click selects a node, drag moves it (latency follows link length).
    let drag: { index: number; startX: number; startY: number; moved: boolean; lastSent: number } | null = null;
    const hit = (clientX: number, clientY: number): number => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < nodeCount; i++) {
        const d = Math.hypot(px(i) - x, py(i) - y);
        if (d < nodeR[i]! + 8 && d < bestDist) {
          best = i;
          bestDist = d;
        }
      }
      return best;
    };
    const toUnit = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - PAD) / Math.max(1, width - 2 * PAD),
        y: (clientY - rect.top - PAD) / Math.max(1, height - 2 * PAD),
      };
    };
    const onDown = (e: PointerEvent) => {
      const index = hit(e.clientX, e.clientY);
      if (index < 0) {
        setLab({ selectedNodeId: null });
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      drag = { index, startX: e.clientX, startY: e.clientY, moved: false, lastSent: 0 };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) {
        canvas.style.cursor = hit(e.clientX, e.clientY) >= 0 ? "pointer" : "default";
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4) drag.moved = true;
      if (drag.moved && e.timeStamp - drag.lastSent > 60) {
        drag.lastSent = e.timeStamp;
        const u = toUnit(e.clientX, e.clientY);
        moveLabNode(nodeIds[drag.index]!, u.x, u.y);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!drag) return;
      const id = nodeIds[drag.index]!;
      if (drag.moved) {
        const u = toUnit(e.clientX, e.clientY);
        moveLabNode(id, u.x, u.y);
      } else {
        setLab({ selectedNodeId: id });
      }
      drag = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
      observer?.disconnect();
      motionQuery?.removeEventListener("change", onMotion);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [particleBudget, showLabels]);

  const selected = selectedNodeId ? network.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const selectedTelemetry = selectedNodeId ? telemetry.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const selectedStatus = selectedNodeId ? nodeStatus(telemetry, selectedNodeId) : 0;
  const faults = telemetry.nodes.filter((n) => nodeStatus(telemetry, n.id) === 2).length;
  const summary = `${caption}. Health ${Math.round(telemetry.health * 100)}%. ${faults} node(s) in fault, ${telemetry.fullScanRate.toFixed(0)} full-table scans per second, mean request latency ${telemetry.meanRequestLatencyMs.toFixed(1)} ms.`;

  return (
    <section data-chimera-area="canvas" className="chimera-panel space-y-3" aria-label={caption} data-testid="chimera-bio-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="chimera-heading">{caption}</h2>
        <div className="flex flex-wrap items-center gap-2 chimera-mono text-[11px]">
          <span className="chimera-badge chimera-flux">● Flux</span>
          <span className="chimera-badge chimera-synapse">◆ Optimizer agent</span>
          <span className="chimera-badge chimera-mutation">▲ Full scan / stall</span>
        </div>
      </div>

      <div ref={wrapRef} className="chimera-canvas-wrap">
        <canvas ref={canvasRef} role="img" aria-label={summary} className="block h-full w-full touch-none" />

        {selected && selectedTelemetry && (
          <div
            role="dialog"
            aria-label={`${selected.label} actions`}
            data-testid="chimera-node-popover"
            className="chimera-panel absolute z-10 w-64 space-y-2 !p-3"
            style={{
              left: `clamp(8px, calc(${(selectedTelemetry.x * 100).toFixed(2)}% - 8rem), calc(100% - 16.5rem))`,
              top: `clamp(8px, calc(${(selectedTelemetry.y * 100).toFixed(2)}% + 18px), calc(100% - 15rem))`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selected.label}</p>
                <p className="chimera-mono text-[11px] chimera-muted">
                  {selected.kind} · {nodeStatusLabel(selectedStatus)}
                  {selected.datasetId ? ` · ${Math.round(selectedTelemetry.load * 100)}% load · ${selectedTelemetry.servedPerSecond.toFixed(0)} stmt/s` : ""}
                </p>
              </div>
              <button type="button" className="chimera-button !px-2 !py-1" aria-label="Close" onClick={() => setLab({ selectedNodeId: null })}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className="chimera-button"
                data-variant={selectedTelemetry.alive ? "danger" : undefined}
                data-testid="chimera-toggle-node"
                onClick={() => toggleNode(selected.id)}
              >
                {selectedTelemetry.alive ? "Sever node" : "Revive node"}
              </button>
              <button
                type="button"
                className="chimera-button"
                disabled={!selected.datasetId || !selectedTelemetry.alive}
                onClick={() => injectBestIndex(selected.id)}
              >
                Inject index
              </button>
            </div>
            <p className="chimera-mono text-[10px] chimera-muted">Dispatch optimizer agent</p>
            <div className="grid grid-cols-1 gap-1">
              {CREW_AGENT_NAMES.map((agent) => (
                <button key={agent} type="button" className="chimera-button text-left" onClick={() => dispatchAgent(agent, selected.id)}>
                  ◆ {agent}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div role="group" aria-label="Network nodes" className="flex flex-wrap gap-1.5">
        {network.nodes.map((node) => {
          const status = nodeStatus(telemetry, node.id);
          return (
            <button
              key={node.id}
              type="button"
              className="chimera-node-chip"
              aria-pressed={selectedNodeId === node.id}
              onClick={() => setLab({ selectedNodeId: selectedNodeId === node.id ? null : node.id })}
            >
              <span className={status === 2 || status === 3 ? "chimera-mutation" : status === 1 ? "chimera-synapse" : "chimera-flux"}>
                {status === 3 ? "✕" : status === 2 ? "▲" : status === 1 ? "◐" : "●"}
              </span>{" "}
              {node.label} <span className="chimera-muted">({nodeStatusLabel(status)})</span>
            </button>
          );
        })}
      </div>
      <p className="chimera-mono text-[11px] chimera-muted" aria-live="polite">
        Click a node for actions, or drag it: link latency scales with distance and the slime mould re-routes. {summary}
      </p>
    </section>
  );
};
