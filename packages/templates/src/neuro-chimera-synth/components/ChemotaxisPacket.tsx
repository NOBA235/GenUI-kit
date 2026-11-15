import React, { useEffect, useRef } from "react";
import { applyChemotaxisPacket } from "./lab-store.js";

export interface ChemotaxisPacketProps {
  readonly packetId: string;
  readonly nodeId: string;
  /** Attractant strength in [0, 1]. The catalog heals null/NaN to 0 and clamps out-of-range values. */
  readonly strength: number;
  readonly queryId: string | null;
  /** Optional SQL payload; it must parse and plan or the packet is quarantined. */
  readonly sql: string | null;
  readonly children?: React.ReactNode;
}

/**
 * Streamed chemotaxis packet: an attractant pulse at a network node, optionally carrying a SQL
 * payload. It is applied once per distinct payload. Invalid parts (unknown node, non-finite
 * strength, unparsable SQL) are quarantined by the lab store and leave the network unchanged.
 */
export const ChemotaxisPacket: React.FC<ChemotaxisPacketProps> = ({ packetId, nodeId, strength, queryId, sql, children }) => {
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = JSON.stringify([packetId, nodeId, strength, queryId, sql]);
    if (appliedRef.current === signature) return;
    appliedRef.current = signature;
    applyChemotaxisPacket({ packetId, nodeId, strength, queryId, sql });
  }, [packetId, nodeId, strength, queryId, sql]);

  return (
    <span hidden data-testid="chimera-chemotaxis-packet" data-packet-id={packetId}>
      {children}
    </span>
  );
};
