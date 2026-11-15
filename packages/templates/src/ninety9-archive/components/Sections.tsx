import React, { useEffect, useRef } from "react";
import { defineRegistry } from "@json-render/react";
import { verifiedCatalog } from "../catalog.js";
import type {
  ArchiveSortOption,
  CategorySlug,
  CRTMode,
} from "../lib/archive/types.js";
import {
  useNinety9OperatorName,
  useNinety9Store,
  type Ninety9ViewId,
} from "../store.js";
import { ArcadeView } from "./ArcadeView.js";
import { ArchiveCatalogView } from "./ArchiveCatalogView.js";
import { CobolBootTerminal } from "./CobolBootTerminal.js";
import { DossierReaderView } from "./DossierReaderView.js";
import { AboutView, CategoriesView } from "./ExtendedViews.js";
import { CategoryGrid, FeaturedSection, HeroSection } from "./HomeSections.js";
import {
  RandomTransmit,
  RecentArchive,
  TimelinePreview,
} from "./InteractiveFeatures.js";
import { CrtOverlay, Footer, Header } from "./WorkstationChrome.js";

const STRICT_MONOCHROME_HEX_SET = new Set<string>([
  "#FFFFFF",
  "#000000",
  "#D9D9D9",
  "#808080",
  "#292929",
]);

function resolveSafeSurfaceAndInk(
  inkHex: string | undefined,
  surfaceHex: string | undefined
): { readonly safeSurface: string; readonly safeInk: string } {
  const safeSurface =
    surfaceHex && STRICT_MONOCHROME_HEX_SET.has(surfaceHex)
      ? surfaceHex
      : "#FFFFFF";
  let safeInk =
    inkHex && STRICT_MONOCHROME_HEX_SET.has(inkHex) ? inkHex : "#000000";

  if (safeInk === safeSurface) {
    safeInk = safeSurface === "#000000" ? "#FFFFFF" : "#000000";
  }
  return { safeSurface, safeInk };
}

export interface WorkstationFrameProps {
  readonly systemVersion: string;
  readonly protocolLabel: string;
  readonly defaultView: Ninety9ViewId;
  readonly defaultCrtMode: CRTMode;
  readonly remixEditionLabel: string;
  readonly inkHex: string;
  readonly surfaceHex: string;
  readonly children?: React.ReactNode;
}

export const WorkstationFrame: React.FC<WorkstationFrameProps> = ({
  systemVersion,
  protocolLabel,
  defaultView,
  defaultCrtMode,
  remixEditionLabel,
  inkHex,
  surfaceHex,
  children,
}) => {
  const crtMode = useNinety9Store((s) => s.crtMode);
  const operatorName = useNinety9OperatorName();
  const storeActiveView = useNinety9Store((s) => s.activeView);
  const activeDossierSlug = useNinety9Store((s) => s.activeDossierSlug);
  const timelineYear = useNinety9Store((s) => s.timelineYear);
  const setCrtMode = useNinety9Store((s) => s.setCrtMode);
  const syncFromCatalogView = useNinety9Store((s) => s.syncFromCatalogView);
  const setActiveRemixBanner = useNinety9Store((s) => s.setActiveRemixBanner);

  const prevDefaultViewRef = useRef<Ninety9ViewId | null>(null);
  const prevDefaultCrtRef = useRef<CRTMode | null>(null);

  useEffect(() => {
    const prevView = prevDefaultViewRef.current;
    prevDefaultViewRef.current = defaultView;

    if (prevView === null) {
      // Respect explicit deep links (?entry=..., ?view=..., /dossier/...) on initial hydration,
      // otherwise align client store cleanly with the page spec's defaultView.
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const hasDeepLinkQuery =
          Boolean(params.get("entry")) || Boolean(params.get("view"));
        const hasDossierPath = /\/dossier\/[a-z0-9-]+\/?$/i.test(
          window.location.pathname
        );
        if (!hasDeepLinkQuery && !hasDossierPath) {
          syncFromCatalogView(defaultView);
        }
      }
      return;
    }

    if (prevView !== defaultView) {
      syncFromCatalogView(defaultView);
    }
  }, [defaultView, syncFromCatalogView]);

  useEffect(() => {
    const prevCrt = prevDefaultCrtRef.current;
    prevDefaultCrtRef.current = defaultCrtMode;
    if (prevCrt !== null && prevCrt !== defaultCrtMode) {
      setCrtMode(defaultCrtMode);
    }
  }, [defaultCrtMode, setCrtMode]);

  useEffect(() => {
    setActiveRemixBanner(
      remixEditionLabel.trim().length > 0 ? remixEditionLabel : null
    );
  }, [remixEditionLabel, setActiveRemixBanner]);

  const { safeSurface, safeInk } = resolveSafeSurfaceAndInk(inkHex, surfaceHex);
  const effectiveView: Ninety9ViewId =
    typeof window === "undefined" ? defaultView : storeActiveView;
  const showStreamedChildren =
    typeof window === "undefined" || storeActiveView === defaultView;

  const renderRoutedFallbackView = () => {
    switch (storeActiveView) {
      case "home":
        return (
          <>
            <HeroSection
              classificationBadge="SYS_CLASSIFICATION // PUBLIC ARCHIVE 1990-1999"
              headline="NINETY9 // THE MONOCHROME ARCHIVE OF THE 1990S"
              subheadline="Curated workstation publication indexing 34 cultural, hardware, cinema, web 1.0, and subcultural artifacts that defined the transition from analog tape to ubiquitous silicon."
              quote="Before every screen smoothed into glass, culture traveled by Xerox zine, 56k carrier tone, cartridge bus, and matte-black plastic."
              quoteAttribution="EDITORIAL MANIFESTO // REV 1999.12"
              primaryCtaLabel="ENTER ARCHIVE CATALOG [01]"
              secondaryCtaLabel="TUNE 99.4 MHZ TRANSMITTER"
              inkHex="#000000"
              surfaceHex="#FFFFFF"
            />
            <ArcadeView
              heading="WORKSTATION BAY // INSTANT PLAYABLE NINETY9 ARCADE"
              defaultGame="packet-invaders"
              difficultyPreset="standard-1995"
              paddleWidth={80}
              ballSpeed={4}
              snakeGridSize={20}
              invaderRows={4}
              inkHex="#000000"
              surfaceHex="#FFFFFF"
              linkedDossierSlug="y2k-bug-1999"
            />
            <FeaturedSection
              sectionHeading="FEATURED ARTIFACT DOSSIERS // CURATED TRANSMISSION"
              leadSlug="nirvana-nevermind"
              secondarySlugs={[
                "sony-playstation",
                "the-matrix",
                "ncsa-mosaic",
                "neon-genesis-evangelion",
              ]}
              panelSurfaceHex="#FFFFFF"
            />
            <CategoryGrid
              sectionHeading="ARCHIVAL DIRECTORY // 12 INDEXED SECTORS"
              subcaption="Select any classification plate to filter artifacts or inspect full historical sector essays."
              highlightCategory="all"
              showEssaysPreview={true}
            />
            <TimelinePreview
              sectionHeading="DECADE LEDGER PREVIEW // 1990-1999 CHRONOLOGY"
              initialYear={1991}
              displayMode="preview"
            />
            <RandomTransmit
              frequencyLabel="99.4 MHZ // RANDOM PACKET UPLINK"
              heading="SIMULATED ARCHIVE TRANSMISSION"
              subheadline="Pull a deterministic artifact packet from the 1990-1999 frequency pool via simulated modem handshake."
              defaultSeed={1994}
              autoExpandTelemetry={true}
            />
            <RecentArchive
              heading="RECENT ARCHIVE INGESTS // LATEST VERIFIED PLATES"
              initialCategory="all"
              initialYearFilter="all"
              initialSort="chronological-desc"
              limitCount={6}
            />
          </>
        );
      case "archive":
        return (
          <ArchiveCatalogView
            heading="VIEW [01] // SEARCHABLE ARCHIVE CATALOG"
            initialCategory="all"
            initialYearFilter="all"
            initialSort="chronological-asc"
          />
        );
      case "timeline":
        return (
          <TimelinePreview
            sectionHeading="VIEW [02] // DECADE TIMELINE LEDGER (1990-1999)"
            initialYear={timelineYear === "all" ? 1994 : timelineYear}
            displayMode="full"
          />
        );
      case "categories":
        return (
          <CategoriesView
            heading="VIEW [03] // CATEGORY ESSAYS & SECTOR INDEX"
            initialCategory="music"
          />
        );
      case "about":
        return (
          <AboutView heading="VIEW [04] // ABOUT, MANIFESTO & MONOCHROME SPECIMEN" />
        );
      case "dossier":
        return (
          <DossierReaderView
            slug={activeDossierSlug}
            showRelated={true}
            showGallery={true}
          />
        );
      case "random-transmit":
        return (
          <RandomTransmit
            frequencyLabel="99.4 MHZ // RANDOM PACKET UPLINK"
            heading="SIMULATED ARCHIVE TRANSMISSION"
            subheadline="Deterministic modem/radio packet uplink pulling archival dossiers across the 1990-1999 continuum."
            defaultSeed={1994}
            autoExpandTelemetry={true}
          />
        );
      case "arcade":
        return (
          <ArcadeView
            heading="VIEW [05] // NINETY9 ARCADE WORKSTATION"
            defaultGame="packet-invaders"
            difficultyPreset="standard-1995"
            paddleWidth={80}
            ballSpeed={4}
            snakeGridSize={20}
            invaderRows={4}
            inkHex="#000000"
            surfaceHex="#FFFFFF"
            linkedDossierSlug="y2k-bug-1999"
          />
        );
    }
  };

  const isBootGateOpen = operatorName === null;

  return (
    <div
      data-template-theme="ninety9-archive"
      data-view={effectiveView}
      className="n99-workstation-root min-h-screen"
      style={{ backgroundColor: safeSurface, color: safeInk }}
    >
      {!isBootGateOpen && <CrtOverlay mode={crtMode} />}

      {isBootGateOpen && <CobolBootTerminal systemVersion={systemVersion} />}

      <div
        hidden={isBootGateOpen}
        aria-hidden={isBootGateOpen ? "true" : undefined}
        inert={isBootGateOpen ? true : undefined}
      >
        <Header
          systemVersion={systemVersion}
          protocolLabel={protocolLabel}
          activeView={effectiveView}
          remixEditionLabel={remixEditionLabel}
        />

        <main id="ninety9-main" tabIndex={-1} className="outline-none">
          {showStreamedChildren ? children : renderRoutedFallbackView()}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export interface ArchiveCatalogMatrixProps {
  readonly heading: string;
  readonly mode: "recent" | "catalog" | "categories" | "about";
  readonly initialCategory: CategorySlug | "all";
  readonly initialYearFilter:
    | "all"
    | "1990"
    | "1991"
    | "1992"
    | "1993"
    | "1994"
    | "1995"
    | "1996"
    | "1997"
    | "1998"
    | "1999";
  readonly initialSort: ArchiveSortOption;
  readonly limitCount: number;
}

export const ArchiveCatalogMatrix: React.FC<ArchiveCatalogMatrixProps> = ({
  heading,
  mode,
  initialCategory,
  initialYearFilter,
  initialSort,
  limitCount,
}) => {
  switch (mode) {
    case "recent":
      return (
        <RecentArchive
          heading={heading}
          initialCategory={initialCategory}
          initialYearFilter={initialYearFilter}
          initialSort={initialSort}
          limitCount={limitCount}
        />
      );
    case "catalog":
      return (
        <ArchiveCatalogView
          heading={heading}
          initialCategory={initialCategory}
          initialYearFilter={initialYearFilter}
          initialSort={initialSort}
        />
      );
    case "categories":
      return (
        <CategoriesView
          heading={heading}
          initialCategory={initialCategory}
        />
      );
    case "about":
      return <AboutView heading={heading} />;
  }
};

const { registry: templateComponents } = defineRegistry(
  verifiedCatalog.catalog,
  {
    components: {
      WorkstationFrame: ({ props, children }) => (
        <WorkstationFrame {...props}>{children}</WorkstationFrame>
      ),
      HeroSection: ({ props }) => <HeroSection {...props} />,
      FeaturedSection: ({ props }) => <FeaturedSection {...props} />,
      CategoryGrid: ({ props }) => <CategoryGrid {...props} />,
      TimelinePreview: ({ props }) => <TimelinePreview {...props} />,
      RandomTransmit: ({ props }) => <RandomTransmit {...props} />,
      ArchiveCatalogMatrix: ({ props }) => <ArchiveCatalogMatrix {...props} />,
      DossierReaderView: ({ props }) => <DossierReaderView {...props} />,
      ArcadeCabinetSection: ({ props }) => <ArcadeView {...props} />,
    },
  }
);

export { templateComponents };
export {
  ArcadeView,
  ArchiveCatalogView,
  CobolBootTerminal,
  DossierReaderView,
  CategoriesView,
  AboutView,
  HeroSection,
  FeaturedSection,
  CategoryGrid,
  TimelinePreview,
  RandomTransmit,
  RecentArchive,
  Header,
  Footer,
  CrtOverlay,
};
