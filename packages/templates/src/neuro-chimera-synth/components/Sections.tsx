import { defineRegistry } from "@json-render/react";
import { verifiedCatalog } from "../catalog.js";
import { BioNetworkCanvas } from "./BioNetworkCanvas.js";
import { BiotechHeroSection } from "./BiotechHeroSection.js";
import { ChemotaxisPacket } from "./ChemotaxisPacket.js";
import { ChimeraLabShell } from "./ChimeraLabShell.js";
import { InteractiveBenchmarkBento } from "./InteractiveBenchmarkBento.js";
import { KiroCrewAgentConstellation } from "./KiroCrewAgentConstellation.js";
import { PricingTiersSection } from "./PricingTiersSection.js";
import { SonificationSpectrumHUD } from "./SonificationSpectrumHUD.js";
import { SqlAstExecutionCompare } from "./SqlAstExecutionCompare.js";

export const { registry: templateComponents } = defineRegistry(verifiedCatalog.catalog, {
  components: {
    ChimeraLabShell: ({ props, children }) => (
      <ChimeraLabShell
        workspaceTitle={props.workspaceTitle}
        defaultMode={props.defaultMode}
        scenarioId={props.scenarioId}
        autoStep={props.autoStep}
        stepHz={props.stepHz}
        nightShift={props.nightShift}
      >
        {children}
      </ChimeraLabShell>
    ),
    BioNetworkCanvas: ({ props }) => (
      <BioNetworkCanvas caption={props.caption} particleBudget={props.particleBudget} showLabels={props.showLabels} />
    ),
    SqlAstExecutionCompare: ({ props }) => <SqlAstExecutionCompare heading={props.heading} showAst={props.showAst} />,
    KiroCrewAgentConstellation: ({ props }) => (
      <KiroCrewAgentConstellation heading={props.heading} utcOffsetMinutes={props.utcOffsetMinutes} showCronPreview={props.showCronPreview} />
    ),
    SonificationSpectrumHUD: ({ props }) => <SonificationSpectrumHUD heading={props.heading} showPartials={props.showPartials} />,
    BiotechHeroSection: ({ props }) => (
      <BiotechHeroSection
        eyebrow={props.eyebrow}
        headline={props.headline}
        subheadline={props.subheadline}
        primaryCtaLabel={props.primaryCtaLabel}
        installCommand={props.installCommand}
        features={props.features}
      />
    ),
    InteractiveBenchmarkBento: ({ props }) => (
      <InteractiveBenchmarkBento heading={props.heading} benchmarkCaption={props.benchmarkCaption} architecture={props.architecture} />
    ),
    PricingTiersSection: ({ props }) => <PricingTiersSection heading={props.heading} footnote={props.footnote} tiers={props.tiers} />,
    ChemotaxisPacket: ({ props, children }) => (
      <ChemotaxisPacket packetId={props.packetId} nodeId={props.nodeId} strength={props.strength} queryId={props.queryId} sql={props.sql}>
        {children}
      </ChemotaxisPacket>
    ),
  },
});
