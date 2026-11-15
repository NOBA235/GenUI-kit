import React, { useEffect, useRef, useState } from "react";
import {
  FSK_BAUD_RATES,
  FSK_TONES_HZ,
  MAX_FSK_PAYLOAD_BYTES,
  estimateFskDurationSec,
  getCmosAudio,
  type FskBaud,
  type FskTransmission,
} from "../lib/cmos/audio.js";
import { useCmosUi, useCompilation } from "./cmos-store.js";

const WIDTH = 640;
const HEIGHT = 160;

/**
 * Live oscilloscope (top) and FFT (bottom) driven by the shared AnalyserNode, plus the
 * TRANSMIT button that encodes the compiled cloud manifest as audible FSK tones.
 */
export const ModemPanel: React.FC = () => {
  const compilation = useCompilation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [baud, setBaud] = useState<FskBaud>(300);
  const [tx, setTx] = useState<FskTransmission | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("CARRIER IDLE");
  const payloadBytes = new TextEncoder().encode(compilation.manifestJson).length;

  // Draw loop runs only while the panel is mounted and the tab is visible.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    let wave: Uint8Array<ArrayBuffer> | null = null;
    let spectrum: Uint8Array<ArrayBuffer> | null = null;
    const draw = () => {
      frame = window.requestAnimationFrame(draw);
      if (document.hidden) return;
      const analyser = getCmosAudio().getAnalyser();
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#0000AA";
      ctx.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, HEIGHT);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT / 4 + 0.5);
      ctx.lineTo(WIDTH, HEIGHT / 4 + 0.5);
      ctx.stroke();
      if (!analyser) return;
      if (!wave || wave.length !== analyser.fftSize) wave = new Uint8Array(analyser.fftSize);
      if (!spectrum || spectrum.length !== analyser.frequencyBinCount) spectrum = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(wave);
      analyser.getByteFrequencyData(spectrum);

      ctx.strokeStyle = "#FFFF55";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / wave.length) * WIDTH;
        const y = ((wave[i]! / 255) * HEIGHT) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // FFT up to 4 kHz, with markers at the three modem tones.
      const nyquist = analyser.context.sampleRate / 2;
      const maxBin = Math.floor((4000 / nyquist) * spectrum.length);
      ctx.fillStyle = "#00AAAA";
      for (let i = 0; i < maxBin; i++) {
        const h = (spectrum[i]! / 255) * (HEIGHT / 2 - 6);
        ctx.fillRect((i / maxBin) * WIDTH, HEIGHT - h, Math.max(1, WIDTH / maxBin - 1), h);
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "11px monospace";
      for (const hz of [FSK_TONES_HZ.space, FSK_TONES_HZ.mark, FSK_TONES_HZ.answer]) {
        const x = (hz / 4000) * WIDTH;
        ctx.fillRect(x, HEIGHT / 2, 1, 6);
        ctx.fillText(`${hz}`, x + 3, HEIGHT / 2 + 12);
      }
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!tx) return;
    const timer = window.setInterval(() => setProgress(tx.progress()), 100);
    let alive = true;
    void tx.done.then((outcome) => {
      if (!alive) return;
      setStatus(outcome === "completed" ? "TRANSMISSION COMPLETE (CRC-16 OK)" : "CARRIER LOST");
      setProgress(outcome === "completed" ? 1 : tx.progress());
      setTx(null);
    });
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [tx]);

  useEffect(() => () => getCmosAudio().cancelTransmission(), []);

  const transmit = () => {
    const audio = getCmosAudio();
    if (!audio.unlock()) {
      setStatus("NO AUDIO DEVICE");
      return;
    }
    const handle = audio.transmit(compilation.manifestJson, { baud });
    if (!handle) {
      setStatus("AUDIO LOCKED");
      return;
    }
    setStatus(`TRANSMITTING ${handle.payloadBytes} BYTES @ ${baud} BAUD`);
    setProgress(0);
    setTx(handle);
  };

  return (
    <section className="space-y-2" aria-label="Acoustic modem" data-testid="cmos-modem-panel">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block w-full h-auto bg-black"
        role="img"
        aria-label="Live oscilloscope and frequency spectrum of the modem output"
      />
      <div className="flex flex-wrap items-center gap-2 cmos-small">
        <button
          type="button"
          className="cmos-button"
          data-variant="danger"
          data-testid="cmos-transmit-btn"
          onClick={tx ? () => tx.cancel() : transmit}
        >
          {tx ? "HANG UP" : "TRANSMIT CONFIG OVER AUDIO"}
        </button>
        <label className="flex items-center gap-1">
          <span className="cmos-help">BAUD</span>
          <select
            className="cmos-button"
            value={baud}
            disabled={tx !== null}
            onChange={(e) => setBaud(Number(e.target.value) as FskBaud)}
          >
            {FSK_BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
        </label>
        <span className="cmos-help">
          {payloadBytes}/{MAX_FSK_PAYLOAD_BYTES} BYTES, ~{estimateFskDurationSec(payloadBytes, baud).toFixed(1)}S
        </span>
      </div>
      <div className="cmos-small" aria-live="polite" data-testid="cmos-modem-status">
        <span className="cmos-value">{status}</span>
        <span className="cmos-help"> [{"#".repeat(Math.round(progress * 24)).padEnd(24, ".")}]</span>
      </div>
      <p className="cmos-small cmos-help">
        Bell 103 FSK: {FSK_TONES_HZ.answer} Hz handshake, {FSK_TONES_HZ.mark} Hz mark / {FSK_TONES_HZ.space} Hz space, 8-N-1 with
        CRC-16. Payload: the compiled cloud manifest.
      </p>
    </section>
  );
};

export interface AcousticModemOscilloscopeProps {
  readonly heading: string;
}

/** Catalog wrapper: landing-page section. In CMOS SETUP mode the panel lives inside BIOS menu 6. */
export const AcousticModemOscilloscope: React.FC<AcousticModemOscilloscopeProps> = ({ heading }) => {
  const mode = useCmosUi((s) => s.mode);
  if (mode !== "landing") return null;
  return (
    <div data-cmos-area="modem" className="cmos-frame p-4 pt-5 min-w-0">
      <span className="cmos-frame-title cmos-text">{heading}</span>
      <ModemPanel />
    </div>
  );
};
