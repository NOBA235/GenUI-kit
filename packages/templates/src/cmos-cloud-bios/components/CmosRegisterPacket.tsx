import React, { useEffect, useRef } from "react";
import { validateConfig } from "../lib/cmos/engine.js";
import { getCmosStore, setCmosUi } from "./cmos-store.js";

export interface CmosRegisterPacketProps {
  readonly packetId: string;
  readonly coreVoltageMv: number;
  readonly multiplier: number;
  /** IRQ line for PCI slot 1. */
  readonly irqSlot1: number;
  /** IRQ line for PCI slot 2. */
  readonly irqSlot2: number;
}

export interface RegisterPacketOutcome {
  readonly applied: boolean;
  readonly notice: string;
}

/**
 * Apply a streamed hardware register write to the shared CMOS store. The GenUI catalog clamps
 * props to their ranges first; the CMOS engine then validates the packet against the exact
 * register grid (50 mV voltage steps, listed multipliers, routable IRQ lines). If the packet is
 * still invalid, the BIOS loads fail-safe defaults instead of applying a broken configuration.
 */
export function applyCmosRegisterPacket(packet: CmosRegisterPacketProps): RegisterPacketOutcome {
  const cmos = getCmosStore();
  if (cmos.getState().phase === "post") cmos.getState().dispatch({ type: "ENTER_SETUP" });
  const { draft } = cmos.getState();
  const irqs = [packet.irqSlot1, packet.irqSlot2];
  const candidate = {
    ...draft,
    cpu: { ...draft.cpu, coreVoltageMv: packet.coreVoltageMv, multiplier: packet.multiplier },
    bus: {
      ...draft.bus,
      slots: draft.bus.slots.map((slot, i) => ({ ...slot, irq: irqs[i] ?? slot.irq })),
    },
  };
  const result = validateConfig(candidate);
  if (result.ok) {
    cmos.getState().dispatch({ type: "LOAD_CONFIG", config: result.config });
    const notice = `REGISTER PACKET ${packet.packetId} APPLIED`;
    setCmosUi({ recoveryNotice: notice });
    return { applied: true, notice };
  }
  cmos.getState().dispatch({ type: "LOAD_DEFAULTS", preset: "bios" });
  const notice = `CMOS CHECKSUM ERROR in packet ${packet.packetId} (${result.issues
    .map((i) => i.path)
    .join(", ")}). FAIL-SAFE BIOS DEFAULTS LOADED.`;
  setCmosUi({ recoveryNotice: notice });
  return { applied: false, notice };
}

export const CmosRegisterPacket: React.FC<CmosRegisterPacketProps> = ({
  packetId,
  coreVoltageMv,
  multiplier,
  irqSlot1,
  irqSlot2,
}) => {
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = `${packetId}:${coreVoltageMv}:${multiplier}:${irqSlot1}:${irqSlot2}`;
    if (appliedRef.current === signature) return;
    appliedRef.current = signature;
    applyCmosRegisterPacket({ packetId, coreVoltageMv, multiplier, irqSlot1, irqSlot2 });
  }, [packetId, coreVoltageMv, multiplier, irqSlot1, irqSlot2]);

  return (
    <span hidden data-testid="cmos-register-packet" data-packet-id={packetId}>
      {packetId}
    </span>
  );
};
