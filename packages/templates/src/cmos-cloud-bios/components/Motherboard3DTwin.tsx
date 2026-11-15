import React, { Suspense, lazy, useEffect, useState } from "react";
import { useCmos, useCmosUi } from "./cmos-store.js";
import { PART_ANCHORS } from "./MotherboardScene.js";

const LazyCanvas = lazy(async () => {
  const [{ Canvas }, { MotherboardScene }] = await Promise.all([
    import("@react-three/fiber"),
    import("./MotherboardScene.js"),
  ]);
  const BoardCanvas: React.FC<{ readonly onContextLost: () => void }> = ({ onContextLost }) => (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 200, position: [0, 26, 22] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor("#000000");
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
    >
      <MotherboardScene />
    </Canvas>
  );
  return { default: BoardCanvas };
});

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export interface Motherboard3DTwinProps {
  readonly caption: string;
}

/**
 * 3D ATX motherboard twin. Reads the same CMOS store as the BIOS: the camera follows menu focus,
 * the heatsink tints with die temperature, the fan spins with clock speed, and PCIe cards appear
 * per occupied slot. The canvas mounts on the client only; SSR renders a text fallback.
 */
export const Motherboard3DTwin: React.FC<Motherboard3DTwinProps> = ({ caption }) => {
  const focusPart = useCmosUi((s) => s.hoverPart ?? s.focusPart);
  const thermalC = useCmos((s) => s.telemetry.thermalC);
  const coreMhz = useCmos((s) => s.draft.cpu.fsbMhz * s.draft.cpu.multiplier);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    setReady(webglAvailable());
  }, []);

  return (
    <figure
      data-cmos-area="twin"
      data-testid="cmos-motherboard-twin"
      className="cmos-frame relative m-0 min-h-[22rem] overflow-hidden bg-black"
    >
      <span className="cmos-frame-title cmos-text z-10">{caption}</span>
      <div className="absolute inset-0">
        {ready && !contextLost ? (
          <Suspense fallback={<p className="p-6 cmos-text cmos-help">LOADING DIGITAL TWIN...</p>}>
            <LazyCanvas onContextLost={() => setContextLost(true)} />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center cmos-text cmos-help">
            {contextLost ? "WEBGL CONTEXT LOST - BOARD TELEMETRY CONTINUES BELOW" : "3D DIGITAL TWIN REQUIRES WEBGL"}
          </div>
        )}
      </div>
      <figcaption className="absolute bottom-0 left-0 right-0 z-10 flex justify-between gap-2 bg-[#0000AA]/85 px-2 cmos-small">
        <span className="cmos-value">FOCUS: {focusPart.toUpperCase()}</span>
        <span className="cmos-help">
          CPU {Math.round(coreMhz)}MHz · {thermalC.toFixed(1)}C · ANCHOR {PART_ANCHORS[focusPart].map((v) => v.toFixed(0)).join(",")}
        </span>
      </figcaption>
    </figure>
  );
};
