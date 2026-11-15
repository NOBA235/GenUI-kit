import React, { useEffect, useState } from "react";
import { getArchiveStats } from "../lib/archive/api.js";
import { MONOCHROME_PALETTE, type CRTMode } from "../lib/archive/types.js";
import { useNinety9Store, type Ninety9ViewId } from "../store.js";

export const CrtOverlay: React.FC<{ readonly mode: CRTMode }> = ({ mode }) => {
  if (mode === "OFF") {
    return null;
  }

  const modeClass =
    mode === "ACTIVE"
      ? "n99-crt-layer n99-crt-active"
      : "n99-crt-layer n99-crt-subtle";

  return (
    <div
      data-testid="ninety9-crt-overlay"
      data-crt-mode={mode}
      aria-hidden="true"
      className={modeClass}
    />
  );
};

export const SignalIndicator: React.FC = () => (
  <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#000000]">
    <span className="n99-signal-dot" aria-hidden="true" />
    <span>SIGNAL: 99.4% // ARCHIVE ONLINE</span>
  </span>
);

function formatUtcTimestamp(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

export interface WorkstationHeaderProps {
  readonly systemVersion: string;
  readonly protocolLabel: string;
  readonly activeView: Ninety9ViewId;
  readonly remixEditionLabel?: string;
}

const NAV_ITEMS: readonly {
  readonly view: Ninety9ViewId;
  readonly label: string;
}[] = [
  { view: "home", label: "[00] HOME" },
  { view: "archive", label: "[01] ARCHIVE" },
  { view: "timeline", label: "[02] TIMELINE" },
  { view: "categories", label: "[03] CATEGORIES" },
  { view: "about", label: "[04] ABOUT" },
];

export const Header: React.FC<WorkstationHeaderProps> = ({
  systemVersion,
  protocolLabel,
  activeView,
  remixEditionLabel,
}) => {
  const crtMode = useNinety9Store((s) => s.crtMode);
  const cycleCrtMode = useNinety9Store((s) => s.cycleCrtMode);
  const navigateTo = useNinety9Store((s) => s.navigateTo);
  const retransmitRandomPacket = useNinety9Store((s) => s.retransmitRandomPacket);

  const [utcClock, setUtcClock] = useState<string>("02:17:00 UTC");

  useEffect(() => {
    setUtcClock(formatUtcTimestamp(new Date()));
    const timer = window.setInterval(() => {
      setUtcClock(formatUtcTimestamp(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleRandomNav = () => {
    retransmitRandomPacket();
    navigateTo("random-transmit");
  };

  return (
    <header className="border-b-2 border-[#000000] bg-[#FFFFFF] text-[#000000]">
      <a href="#ninety9-main" className="n99-skip-link">
        SKIP TO ARCHIVE CONTENT
      </a>

      {/* Top System Telemetry Strip */}
      <div className="border-b border-[#000000] bg-[#D9D9D9] px-4 py-1.5">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#000000]">
          <span>
            {systemVersion} // {protocolLabel}
          </span>

          <div className="flex flex-wrap items-center gap-4">
            <SignalIndicator />
            <span
              data-testid="ninety9-utc-clock"
              className="border border-[#000000] bg-[#FFFFFF] px-2 py-0.5 text-[11px] text-[#000000]"
            >
              {utcClock}
            </span>
            <button
              type="button"
              onClick={cycleCrtMode}
              data-testid="ninety9-crt-toggle"
              aria-label={`Cycle Paper-White CRT scanlines (current: ${crtMode})`}
              className="min-h-[28px] border border-[#000000] bg-[#FFFFFF] px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] transition-colors cursor-pointer"
            >
              CRT: [{crtMode}]
            </button>
          </div>
        </div>
      </div>

      {/* Main Workstation Navbar */}
      <div className="px-4 py-3">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigateTo("home")}
              aria-label="NINETY9 Home"
              className="n99-shadow-sm flex h-11 w-11 items-center justify-center border-2 border-[#000000] bg-[#000000] font-mono text-xl font-bold text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#000000] transition-colors cursor-pointer"
            >
              99
            </button>
            <div>
              <div className="n99-font-mono text-base font-bold tracking-tight text-[#000000]">
                NINETY9 ARCHIVE
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#292929]">
                NEURAL INDEX // 1990–1999 MONOCHROME PUBLICATION
              </div>
            </div>
          </div>

          <nav aria-label="Primary" className="flex flex-wrap items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isCurrent =
                activeView === item.view ||
                (activeView === "dossier" && item.view === "archive");
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => navigateTo(item.view)}
                  aria-current={isCurrent ? "page" : undefined}
                  data-testid={`ninety9-nav-${item.view}`}
                  className={`min-h-[38px] border-2 border-[#000000] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-[#000000] text-[#FFFFFF] n99-shadow-sm"
                      : "bg-[#FFFFFF] text-[#000000] hover:bg-[#D9D9D9]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleRandomNav}
              aria-current={activeView === "random-transmit" ? "page" : undefined}
              data-testid="ninety9-nav-random"
              className={`min-h-[38px] border-2 border-[#000000] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeView === "random-transmit"
                  ? "bg-[#000000] text-[#FFFFFF] n99-shadow-sm"
                  : "bg-[#D9D9D9] text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] n99-shadow-sm"
              }`}
            >
              [RANDOM] 99.4 MHZ
            </button>
          </nav>
        </div>
      </div>

      {remixEditionLabel && remixEditionLabel.trim().length > 0 && (
        <div
          data-testid="ninety9-remix-edition-banner"
          className="border-t-2 border-[#000000] bg-[#000000] px-4 py-1.5 text-[#FFFFFF]"
        >
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold uppercase tracking-widest">
            <span>ACTIVE GENUI EDITION // {remixEditionLabel}</span>
            <span>5-TONE MONOCHROME VERIFIED</span>
          </div>
        </div>
      )}
    </header>
  );
};

export const Footer: React.FC = () => {
  const stats = getArchiveStats();
  const navigateTo = useNinety9Store((s) => s.navigateTo);
  const retransmitRandomPacket = useNinety9Store((s) => s.retransmitRandomPacket);

  return (
    <footer className="mt-16 border-t-2 border-[#000000] bg-[#FFFFFF] px-4 py-10 text-[#000000]">
      <div className="mx-auto grid max-w-[1380px] grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="border-2 border-[#000000] bg-[#000000] px-2 py-0.5 font-mono text-sm font-bold text-[#FFFFFF]">
              99
            </span>
            <span className="font-mono text-sm font-bold uppercase tracking-wider">
              NINETY9 WORKSTATION ARCHIVE
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#292929]">
            Single-palette editorial preservation index capturing 1990–1999 music,
            cinema, television, hardware, Web 1.0, and youth subcultures inside strict
            1-bit/5-tone monochrome discipline.
          </p>
          <div className="font-mono text-[11px] font-bold text-[#000000]">
            PALETTE LOCK: {Object.values(MONOCHROME_PALETTE).join(" · ")}
          </div>
        </div>

        <div className="space-y-2.5 font-mono text-xs">
          <div className="border-b border-[#000000] pb-1 font-bold uppercase">
            DIRECTORY NODES
          </div>
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={`footer-${item.view}`}
                type="button"
                onClick={() => navigateTo(item.view)}
                className="text-left font-bold text-[#000000] hover:underline cursor-pointer"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                retransmitRandomPacket();
                navigateTo("random-transmit");
              }}
              className="text-left font-bold text-[#000000] hover:underline cursor-pointer"
            >
              [05] TRANSMIT
            </button>
          </div>
        </div>

        <div className="border-2 border-[#000000] bg-[#D9D9D9] p-4 space-y-2 n99-shadow-sm">
          <div className="font-mono text-[11px] font-bold uppercase text-[#000000]">
            ARCHIVE TELEMETRY READOUT
          </div>
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div>
              <dt className="text-[10px] text-[#292929]">DOSSIERS</dt>
              <dd className="font-bold text-[#000000]">{stats.totalEntries} PLATES</dd>
            </div>
            <div>
              <dt className="text-[10px] text-[#292929]">SECTORS</dt>
              <dd className="font-bold text-[#000000]">
                {stats.totalCategories} INDEXED
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-[#292929]">CHRONOLOGY</dt>
              <dd className="font-bold text-[#000000]">
                {stats.yearSpan[0]}–{stats.yearSpan[1]}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-[#292929]">MILESTONES</dt>
              <dd className="font-bold text-[#000000]">
                {stats.totalMilestones} EVENTS
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1380px] flex-wrap items-center justify-between gap-2 border-t border-[#000000] pt-4 font-mono text-[11px] text-[#292929]">
        <span>© 1990–1999 // NINETY9 DIGITAL PRESERVATION SOCIETY</span>
        <span>POWERED BY @GENUI-STUDIO/CORE // ZOD-VERIFIED MONOCHROME ENGINE</span>
      </div>
    </footer>
  );
};
