import { TimelineMilestoneSchema, type TimelineMilestone } from "../lib/archive/types.js";

const RAW_TIMELINE_MILESTONES: TimelineMilestone[] = [
  {
    id: "TL-1990-01",
    year: 1990,
    quarter: "Q2",
    dateLabel: "APRIL 8, 1990",
    headline: "TWIN PEAKS PREMIERES ON ABC NETWORK TELEVISION",
    category: "television",
    significance:
      "David Lynch and Mark Frost introduce surrealist long-form serialization and cinematic sound design to prime-time network broadcasting.",
    linkedEntrySlug: "twin-peaks",
  },
  {
    id: "TL-1990-02",
    year: 1990,
    quarter: "Q2",
    dateLabel: "MAY 31, 1990",
    headline: "SEINFELD LAUNCHES SEASON ONE OBSERVATIONAL SITCOM ERA",
    category: "television",
    significance:
      "Larry David and Jerry Seinfeld dismantle domestic sitcom melodrama in favor of interlocking metropolitan farce and unsentimental wit.",
    linkedEntrySlug: "seinfeld",
  },
  {
    id: "TL-1991-01",
    year: 1991,
    quarter: "Q3",
    dateLabel: "JULY 18, 1991",
    headline: "LOLLAPALOOZA TOURS AS ALTERNATIVE NOMADIC FESTIVAL",
    category: "music",
    significance:
      "Perry Farrell fuses alternative rock, hip-hop, industrial electronics, and zine booths into a nationwide countercultural caravan.",
    linkedEntrySlug: "lollapalooza-91",
  },
  {
    id: "TL-1991-02",
    year: 1991,
    quarter: "Q3",
    dateLabel: "SEPTEMBER 24, 1991",
    headline: "NIRVANA RELEASES NEVERMIND AND TOPPLES HAIR METAL",
    category: "music",
    significance:
      "Pacific Northwest basement punk and quiet-loud distortion overtake corporate arena pop at the summit of the Billboard album chart.",
    linkedEntrySlug: "nirvana-nevermind",
  },
  {
    id: "TL-1991-03",
    year: 1991,
    quarter: "Q4",
    dateLabel: "NOVEMBER 1991",
    headline: "PHOTOCOPIED DIY ZINES SURGE ACROSS RECORD STORES",
    category: "youth-culture",
    significance:
      "Riot Grrrl pamphlets, skate broadsheets, and punk cut-and-paste periodicals establish decentralized peer publishing before the web.",
    linkedEntrySlug: "zine-diy-press",
  },
  {
    id: "TL-1992-01",
    year: 1992,
    quarter: "Q3",
    dateLabel: "AUGUST 1992",
    headline: "1992 USA DREAM TEAM DOMINATES BARCELONA OLYMPICS",
    category: "sports",
    significance:
      "NBA icons compete on the Olympic court for the first time, globalizing American basketball footwear, broadcasts, and athlete branding.",
    linkedEntrySlug: "dream-team-1992",
  },
  {
    id: "TL-1992-02",
    year: 1992,
    quarter: "Q3",
    dateLabel: "SEPTEMBER 5, 1992",
    headline: "BATMAN: THE ANIMATED SERIES DEBUTS ON BLACK PAPER",
    category: "animation",
    significance:
      "Bruce Timm and Eric Radomski paint Art Deco Gotham directly over black cardstock, elevating television animation to noir cinema.",
    linkedEntrySlug: "batman-tas",
  },
  {
    id: "TL-1992-03",
    year: 1992,
    quarter: "Q4",
    dateLabel: "NOVEMBER 1, 1992",
    headline: "SONY SHIPS MINIDISC MAGNETO-OPTICAL AUDIO FORMAT",
    category: "hardware",
    significance:
      "Caged 64mm discs and ATRAC psychoacoustic compression give commuters skip-free digital recording before solid-state flash MP3 players.",
    linkedEntrySlug: "sony-minidisc",
  },
  {
    id: "TL-1993-01",
    year: 1993,
    quarter: "Q1",
    dateLabel: "JANUARY 23, 1993",
    headline: "NCSA MOSAIC BRINGS INLINE GRAPHICS TO THE WEB",
    category: "web-1-0",
    significance:
      "Marc Andreessen and Eric Bina display bitmap images beside hypertext documents, transforming academic networks into a visual medium.",
    linkedEntrySlug: "ncsa-mosaic",
  },
  {
    id: "TL-1993-02",
    year: 1993,
    quarter: "Q2",
    dateLabel: "JUNE 11, 1993",
    headline: "JURASSIC PARK MERGES ANIMATRONICS WITH PHOTOREAL CGI",
    category: "cinema",
    significance:
      "Industrial Light & Magic renders convincing dinosaurs on Silicon Graphics workstations, permanently rewriting Hollywood post-production pipelines.",
    linkedEntrySlug: "jurassic-park",
  },
  {
    id: "TL-1993-03",
    year: 1993,
    quarter: "Q3",
    dateLabel: "SEPTEMBER 10, 1993",
    headline: "THE X-FILES CODIFIES SERIALIZED CONSPIRACY TELEVISION",
    category: "television",
    significance:
      "Chris Carter balances standalone paranormal cases with overarching mythology and cultivates one of television's first Usenet fandoms.",
    linkedEntrySlug: "the-x-files",
  },
  {
    id: "TL-1993-04",
    year: 1993,
    quarter: "Q4",
    dateLabel: "DECEMBER 10, 1993",
    headline: "ID SOFTWARE UPLOADS DOOM SHAREWARE TO UNIVERSITY FTP",
    category: "gaming",
    significance:
      "Binary Space Partitioning 2.5D corridors, WAD level editors, and four-player IPX deathmatch establish modern PC first-person shooter culture.",
    linkedEntrySlug: "doom-1993",
  },
  {
    id: "TL-1994-01",
    year: 1994,
    quarter: "Q2",
    dateLabel: "APRIL 19, 1994",
    headline: "NAS RELEASES ILLMATIC FROM QUEENSBRIDGE HOUSINGS",
    category: "music",
    significance:
      "A 39-minute multi-producer masterpiece compresses street reportage, jazz-inflected breakbeats, and multisylabic internal rhyme into East Coast canon.",
    linkedEntrySlug: "nas-illmatic",
  },
  {
    id: "TL-1994-02",
    year: 1994,
    quarter: "Q2",
    dateLabel: "MAY 1994",
    headline: "SUPREME OPENS SKATE COUNTER CULTURE ON LAFAYETTE STREET",
    category: "fashion",
    significance:
      "James Jebbia marries downtown New York skate utility with art-world drop scarcity, laying the economic blueprint for global streetwear.",
    linkedEntrySlug: "supreme-nyc",
  },
  {
    id: "TL-1994-03",
    year: 1994,
    quarter: "Q4",
    dateLabel: "OCTOBER 14, 1994",
    headline: "PULP FICTION REWRITES INDEPENDENT CINEMA STRUCTURE",
    category: "cinema",
    significance:
      "Quentin Tarantino's nonlinear screenplay and Miramax distribution prove ragged independent film can earn studio-scale cultural ubiquity.",
    linkedEntrySlug: "pulp-fiction",
  },
  {
    id: "TL-1994-04",
    year: 1994,
    quarter: "Q4",
    dateLabel: "DECEMBER 3, 1994",
    headline: "SONY LAUNCHES PLAYSTATION REAL-TIME 3D CONSOLE IN JAPAN",
    category: "gaming",
    significance:
      "CD-ROM storage economics and dedicated polygon geometry hardware shift console demographics toward late-night clubgoers and young adults.",
    linkedEntrySlug: "sony-playstation",
  },
  {
    id: "TL-1995-01",
    year: 1995,
    quarter: "Q3",
    dateLabel: "AUGUST 24, 1995",
    headline: "MICROSOFT RELEASES WINDOWS 95 WITH START MENU & TCP/IP",
    category: "hardware",
    significance:
      "32-bit Plug and Play architecture, taskbar ergonomics, and built-in Winsock networking onboard millions of household PCs onto the Internet.",
    linkedEntrySlug: "windows-95",
  },
  {
    id: "TL-1995-02",
    year: 1995,
    quarter: "Q4",
    dateLabel: "OCTOBER 4, 1995",
    headline: "NEON GENESIS EVANGELION PREMIERES ON TV TOKYO",
    category: "animation",
    significance:
      "Hideaki Anno and Studio Gainax fracture giant-mecha conventions into raw psychological existentialism and bold typographic title frames.",
    linkedEntrySlug: "neon-genesis-evangelion",
  },
  {
    id: "TL-1996-01",
    year: 1996,
    quarter: "Q1",
    dateLabel: "FEBRUARY 27, 1996",
    headline: "POKEMON RED AND GREEN LINK POCKET GAME BOYS BY CABLE",
    category: "gaming",
    significance:
      "Satoshi Tajiri turns monochrome LCD link-cable trading into an intergenerational monster-collecting ritual and global multimedia empire.",
    linkedEntrySlug: "game-boy-pokemon",
  },
  {
    id: "TL-1996-02",
    year: 1996,
    quarter: "Q2",
    dateLabel: "JUNE 23, 1996",
    headline: "NINTENDO 64 INTRODUCES ANALOG THUMBSTICK IN SUPER MARIO 64",
    category: "gaming",
    significance:
      "Full 360-degree thumbstick navigation and three-dimensional camera framing establish spatial grammar for every third-person console game after.",
    linkedEntrySlug: "nintendo-64",
  },
  {
    id: "TL-1996-03",
    year: 1996,
    quarter: "Q4",
    dateLabel: "NOVEMBER 23, 1996",
    headline: "BANDAI RELEASES KEYCHAIN TAMAGOTCHI VIRTUAL PET",
    category: "toys-collectibles",
    significance:
      "Pixelated 32x16 egg-shaped LCD companions demand real-time feed and sleep vigilance, rehearsing pocket-screen emotional attachment.",
    linkedEntrySlug: "tamagotchi",
  },
  {
    id: "TL-1997-01",
    year: 1997,
    quarter: "Q1",
    dateLabel: "JANUARY 20, 1997",
    headline: "DAFT PUNK RELEASES HOMEWORK FRENCH HOUSE DEBUT",
    category: "music",
    significance:
      "Bedroom drum machines, filtered disco loops, and anonymous robot persona bridge underground Chicago house onto global MTV rotation.",
    linkedEntrySlug: "daft-punk-homework",
  },
  {
    id: "TL-1997-02",
    year: 1997,
    quarter: "Q1",
    dateLabel: "MARCH 1997",
    headline: "DVD FORMAT LAUNCHES 4.7GB OPTICAL HOME CINEMA ERA",
    category: "pop-culture",
    significance:
      "MPEG-2 optical discs replace magnetic VHS rewind rituals with instant chapter menus, widescreen transfers, and director audio commentaries.",
    linkedEntrySlug: "dvd-optical-transition",
  },
  {
    id: "TL-1998-01",
    year: 1998,
    quarter: "Q2",
    dateLabel: "JUNE 14, 1998",
    headline: "MICHAEL JORDAN COMPLETES SIXTH TITLE IN LAST DANCE FINALS",
    category: "sports",
    significance:
      "A final crossover jumper in Utah closes the Chicago Bulls dynasty and caps television basketball's highest-rated Finals broadcast.",
    linkedEntrySlug: "last-dance-1998",
  },
  {
    id: "TL-1998-02",
    year: 1998,
    quarter: "Q3",
    dateLabel: "AUGUST 15, 1998",
    headline: "APPLE IMAC G3 SHIPS WITHOUT A FLOPPY DRIVE OVER USB",
    category: "hardware",
    significance:
      "Jony Ive's translucent Bondi Blue all-in-one computer drops legacy ports for universal serial connectivity and one-cord internet setup.",
    linkedEntrySlug: "imac-g3",
  },
  {
    id: "TL-1999-01",
    year: 1999,
    quarter: "Q1",
    dateLabel: "MARCH 31, 1999",
    headline: "THE MATRIX PREMIERES GREEN-TINTED BULLET-TIME CINEMA",
    category: "cinema",
    significance:
      "The Wachowskis fuse Hong Kong wire choreography, Baudrillard philosophy, and still-camera array rig effects into the decade's closing myth.",
    linkedEntrySlug: "the-matrix",
  },
  {
    id: "TL-1999-02",
    year: 1999,
    quarter: "Q4",
    dateLabel: "DECEMBER 31, 1999",
    headline: "GLOBAL Y2K DATE-ROLLOVER AUDIT TESTS CRITICAL INFRASTRUCTURE",
    category: "pop-culture",
    significance:
      "Years of COBOL remediation prevent banking and utility outages at midnight, closing the 1990s in sober digital self-awareness.",
    linkedEntrySlug: "y2k-bug-1999",
  },
];

const QUARTER_ORDER: Record<TimelineMilestone["quarter"], number> = {
  Q1: 1,
  Q2: 2,
  Q3: 3,
  Q4: 4,
};

export const TIMELINE_MILESTONES: readonly TimelineMilestone[] =
  RAW_TIMELINE_MILESTONES.map((item) => TimelineMilestoneSchema.parse(item)).sort(
    (a, b) =>
      a.year - b.year ||
      QUARTER_ORDER[a.quarter] - QUARTER_ORDER[b.quarter] ||
      a.id.localeCompare(b.id)
  );
