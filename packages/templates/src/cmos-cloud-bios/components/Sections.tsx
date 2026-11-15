import { defineRegistry } from "@json-render/react";
import { verifiedCatalog } from "../catalog.js";
import { AcousticModemOscilloscope } from "./AcousticModemOscilloscope.js";
import { AwardBiosMenuGrid } from "./AwardBiosMenuGrid.js";
import { CmosRegisterPacket } from "./CmosRegisterPacket.js";
import { CmosWorkstationShell } from "./CmosWorkstationShell.js";
import { DevToolsHeroSection } from "./DevToolsHeroSection.js";
import { HardwareTelemetryMonitor } from "./HardwareTelemetryMonitor.js";
import { IaCCodeCompilerOutput } from "./IaCCodeCompilerOutput.js";
import { Motherboard3DTwin } from "./Motherboard3DTwin.js";
import { PostBootSequence } from "./PostBootSequence.js";

export const { registry: templateComponents } = defineRegistry(verifiedCatalog.catalog, {
  components: {
    CmosWorkstationShell: ({ props, children }) => (
      <CmosWorkstationShell
        workspaceTitle={props.workspaceTitle}
        defaultMode={props.defaultMode}
        bootPreset={props.bootPreset}
        showPostOnBoot={props.showPostOnBoot}
      >
        {children}
      </CmosWorkstationShell>
    ),
    PostBootSequence: ({ props }) => (
      <PostBootSequence biosVersion={props.biosVersion} vendorLine={props.vendorLine} memoryTestMs={props.memoryTestMs} />
    ),
    AwardBiosMenuGrid: ({ props }) => <AwardBiosMenuGrid title={props.title} copyrightLine={props.copyrightLine} />,
    Motherboard3DTwin: ({ props }) => <Motherboard3DTwin caption={props.caption} />,
    HardwareTelemetryMonitor: ({ props }) => (
      <HardwareTelemetryMonitor heading={props.heading} showCostBreakdown={props.showCostBreakdown} />
    ),
    IaCCodeCompilerOutput: ({ props }) => <IaCCodeCompilerOutput heading={props.heading} projectName={props.projectName} />,
    AcousticModemOscilloscope: ({ props }) => <AcousticModemOscilloscope heading={props.heading} />,
    DevToolsHeroSection: ({ props }) => (
      <DevToolsHeroSection
        eyebrow={props.eyebrow}
        headline={props.headline}
        subheadline={props.subheadline}
        primaryCtaLabel={props.primaryCtaLabel}
        installCommand={props.installCommand}
        features={props.features}
      />
    ),
    CmosRegisterPacket: ({ props }) => (
      <CmosRegisterPacket
        packetId={props.packetId}
        coreVoltageMv={props.coreVoltageMv}
        multiplier={props.multiplier}
        irqSlot1={props.irqSlot1}
        irqSlot2={props.irqSlot2}
      />
    ),
  },
});
