#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const PHOTO_DIR = path.join(REPO_ROOT, "public", "images", "ninety9", "photos");
const TS_OUT = path.join(
  REPO_ROOT,
  "packages",
  "templates",
  "src",
  "ninety9-archive",
  "content",
  "photos.ts"
);

const USER_AGENT =
  "Ninety9Archive/1.0 (https://github.com/genui-kit/genui-kit; archival-monochrome-dataset)";

/**
 * Curated open-source 1990s photographs mapped to Wikimedia Commons File titles.
 * Covers all 34 archive entries, all 12 sectors, and 6 landmark 1990s historical
 * figures, scientific milestones, and iconic portable hardware.
 */
const PHOTO_TARGETS = [
  // === 34 ARCHIVE ENTRIES ===
  {
    key: "nirvana-nevermind",
    kind: "entry",
    commonsTitle: "File:Photo of Kurt Cobain from US Embassy in Bern.jpg",
    localFile: "nirvana-nevermind.jpg",
    subject: "Kurt Cobain (Nirvana)",
    yearTaken: "1992",
    caption: "Archival portrait photograph of Nirvana frontman Kurt Cobain during the Nevermind era.",
    alt: "Monochrome archival portrait photograph of Nirvana frontman Kurt Cobain in the early 1990s",
  },
  {
    key: "lollapalooza-91",
    kind: "entry",
    commonsTitle: "File:Trent Reznor Lollapalooza 1991.jpg",
    localFile: "lollapalooza-91.jpg",
    subject: "Trent Reznor at Lollapalooza 1991",
    yearTaken: "1991",
    caption: "Nine Inch Nails frontman Trent Reznor performing live onstage during the inaugural 1991 Lollapalooza tour.",
    alt: "Monochrome live concert photograph of Trent Reznor performing at Lollapalooza in 1991",
  },
  {
    key: "nas-illmatic",
    kind: "entry",
    commonsTitle: "File:Queensbridge Houses.jpg",
    localFile: "nas-illmatic.jpg",
    subject: "Queensbridge Houses, Long Island City",
    yearTaken: "1990s ERA SITE",
    caption: "Six-story brick housing complex in Queensbridge, Long Island City—setting and subject of Nas's 1994 debut Illmatic.",
    alt: "Monochrome exterior photograph of Queensbridge Houses residential buildings in Queens, New York",
  },
  {
    key: "daft-punk-homework",
    kind: "entry",
    commonsTitle: "File:Tr-909.jpg",
    localFile: "daft-punk-homework.jpg",
    subject: "Roland TR-909 Rhythm Composer",
    yearTaken: "ANALOG HARDWARE",
    caption: "Roland TR-909 programmable drum machine that powered Daft Punk's raw Paris bedroom Homework sessions.",
    alt: "Monochrome overhead hardware photograph of a Roland TR-909 rhythm composer drum machine",
  },
  {
    key: "jurassic-park",
    kind: "entry",
    commonsTitle: "File:Tyrannosaurus rex RTMP.jpg",
    localFile: "jurassic-park.jpg",
    subject: "Tyrannosaurus rex Specimen Mount",
    yearTaken: "MUSEUM PLATE",
    caption: "Full-scale Tyrannosaurus rex skeletal specimen—reference anatomy for ILM's 1993 Jurassic Park CG animation.",
    alt: "Monochrome museum photograph of a towering Tyrannosaurus rex skeletal mount",
  },
  {
    key: "pulp-fiction",
    kind: "entry",
    commonsTitle: "File:Quentin Tarantino by Gage Skidmore.jpg",
    localFile: "pulp-fiction.jpg",
    subject: "Quentin Tarantino",
    yearTaken: "DIRECTOR PORTRAIT",
    caption: "Filmmaker Quentin Tarantino, writer and director of 1994 Palme d'Or winner Pulp Fiction.",
    alt: "Monochrome portrait photograph of filmmaker Quentin Tarantino speaking at a podium",
  },
  {
    key: "the-matrix",
    kind: "entry",
    commonsTitle: "File:Matrixphone.jpg",
    localFile: "the-matrix.jpg",
    subject: "Nokia 8110 Slider Cellular Phone",
    yearTaken: "1996 HARDWARE",
    caption: "Spring-loaded Nokia 8110 GSM handset customized for Thomas Anderson's extraction sequence in 1999's The Matrix.",
    alt: "Monochrome close-up photograph of a curved Nokia 8110 mobile phone with open sliding cover",
  },
  {
    key: "twin-peaks",
    kind: "entry",
    commonsTitle: "File:David Lynch (1990).jpg",
    localFile: "twin-peaks.jpg",
    subject: "David Lynch (1990)",
    yearTaken: "1990",
    caption: "Co-creator David Lynch photographed in 1990 during the broadcast run of Twin Peaks on ABC.",
    alt: "Monochrome 1990 archival portrait photograph of Twin Peaks co-creator David Lynch",
  },
  {
    key: "seinfeld",
    kind: "entry",
    commonsTitle: "File:Tom's Restaurant, NYC.jpg",
    localFile: "seinfeld.jpg",
    subject: "Tom's Restaurant, Morningside Heights NYC",
    yearTaken: "NYC LANDMARK",
    caption: "Broadway corner diner exterior serving as the establishing shot for Monk's Cafe throughout Seinfeld.",
    alt: "Monochrome exterior street photograph of Tom's Restaurant corner neon sign in New York City",
  },
  {
    key: "the-x-files",
    kind: "entry",
    commonsTitle: "File:Gillian Anderson & David Duchovny (9347343714).jpg",
    localFile: "the-x-files.jpg",
    subject: "Gillian Anderson & David Duchovny",
    yearTaken: "SERIES LEADS",
    caption: "Gillian Anderson (Dana Scully) and David Duchovny (Fox Mulder), stars of Chris Carter's The X-Files.",
    alt: "Monochrome archival photograph of The X-Files actors Gillian Anderson and David Duchovny",
  },
  {
    key: "batman-tas",
    kind: "entry",
    commonsTitle: "File:Chrysler Building at night (3551501582).jpg",
    localFile: "batman-tas.jpg",
    subject: "Art Deco Chrysler Spire at Night",
    yearTaken: "DARK DECO REF",
    caption: "Illuminated Art Deco Manhattan tower echoing Eric Radomski's 'Dark Deco' Gotham backgrounds.",
    alt: "Monochrome night photograph of the Art Deco Chrysler Building spire illuminated against a dark sky",
  },
  {
    key: "neon-genesis-evangelion",
    kind: "entry",
    commonsTitle: "File:Ochikei03 Sorce.jpg",
    localFile: "neon-genesis-evangelion.jpg",
    subject: "Akihabara Electric Town, Tokyo (Oct 1999)",
    yearTaken: "1999",
    caption: "Street-level photograph of Tokyo's Akihabara district in October 1999 during Gainax's cultural dominance.",
    alt: "Monochrome 1999 street photograph of neon signs and crowds in Akihabara, Tokyo",
  },
  {
    key: "doom-1993",
    kind: "entry",
    commonsTitle: "File:John Romero - GDC 2022.jpg",
    localFile: "doom-1993.jpg",
    subject: "John Romero (id Software)",
    yearTaken: "CREATOR PORTRAIT",
    caption: "Game designer John Romero, co-founder of id Software and level architect of 1993 shareware milestone DOOM.",
    alt: "Monochrome portrait photograph of DOOM co-creator John Romero",
  },
  {
    key: "sony-playstation",
    kind: "entry",
    commonsTitle: "File:PlayStation-SCPH-1000-with-Controller.jpg",
    localFile: "sony-playstation.jpg",
    subject: "Sony PlayStation (PS1) & Controller",
    yearTaken: "1994 HARDWARE",
    caption: "Original Sony PlayStation grey 32-bit CD-ROM console with wired dual-shoulder digital game controller.",
    alt: "Monochrome studio photograph of an original grey Sony PlayStation console and controller",
  },
  {
    key: "nintendo-64",
    kind: "entry",
    commonsTitle: "File:Nintendo 64.jpg",
    localFile: "nintendo-64.jpg",
    subject: "Nintendo 64 (NUS-001)",
    yearTaken: "1996 HARDWARE",
    caption: "Nintendo 64 64-bit cartridge system paired with its signature three-prong analog controller.",
    alt: "Monochrome hardware photograph of a Nintendo 64 console with cartridge slot and controller",
  },
  {
    key: "game-boy-pokemon",
    kind: "entry",
    commonsTitle: "File:Original Game Boy.jpg",
    localFile: "game-boy-pokemon.jpg",
    subject: "Nintendo Game Boy (DMG-01)",
    yearTaken: "1989-1996",
    caption: "8-bit DMG-01 dot-matrix handheld system revived worldwide in 1996 by Satoshi Tajiri's Pocket Monsters.",
    alt: "Monochrome archival photograph of an original Nintendo Game Boy handheld console",
  },
  {
    key: "sony-minidisc",
    kind: "entry",
    commonsTitle: "File:Sony MZ-1 and a disc 20040221.jpg",
    localFile: "sony-minidisc.jpg",
    subject: "Sony MZ-1 MiniDisc Recorder",
    yearTaken: "1992 HARDWARE",
    caption: "Sony's flagship 1992 MZ-1 portable magneto-optical recorder beside its protective 64mm MD cartridge.",
    alt: "Monochrome photograph of the boxy Sony MZ-1 portable MiniDisc recorder next to a disc cartridge",
  },
  {
    key: "windows-95",
    kind: "entry",
    commonsTitle: "File:Disquetes y CD-ROM de instalacion de Windows 95.jpg",
    localFile: "windows-95.jpg",
    subject: "Windows 95 Setup Diskettes & CD-ROM",
    yearTaken: "1995 SOFTWARE",
    caption: "Retail Microsoft Windows 95 physical installation media set combining optical CD-ROM and 3.5-inch DMF floppies.",
    alt: "Monochrome photograph of original Microsoft Windows 95 installation CD-ROM and floppy disks",
  },
  {
    key: "palmpilot-1000",
    kind: "entry",
    commonsTitle: "File:Pilot 1000.jpg",
    localFile: "palmpilot-1000.jpg",
    subject: "US Robotics Pilot 1000 PDA",
    yearTaken: "1996 HARDWARE",
    caption: "Jeff Hawkins's 1996 pocket organizer featuring resistive monochrome LCD and lower Graffiti handwriting area.",
    alt: "Monochrome photograph of a US Robotics Pilot 1000 personal digital assistant with LCD screen",
  },
  {
    key: "imac-g3",
    kind: "entry",
    commonsTitle: "File:IMac G3.JPG",
    localFile: "imac-g3.jpg",
    subject: "Apple iMac G3 (M6709)",
    yearTaken: "1998 WORKSTATION",
    caption: "Jony Ive's translucent egg-shaped 1998 iMac G3 desktop shipping USB-only with the internal floppy omitted.",
    alt: "Monochrome photograph of an Apple iMac G3 all-in-one CRT workstation and matching mouse",
  },
  {
    key: "minimalist-runway",
    kind: "entry",
    commonsTitle: "File:Paris Fashion Week.jpg",
    localFile: "minimalist-runway.jpg",
    subject: "Paris Fashion Editorial Appearance",
    yearTaken: "RUNWAY ARCHIVE",
    caption: "Tailored architectural minimalism photographed on site during Paris Fashion Week.",
    alt: "Monochrome full-length editorial fashion photograph at Paris Fashion Week",
  },
  {
    key: "supreme-nyc",
    kind: "entry",
    commonsTitle: "File:NYC, Lafayette St.jpg",
    localFile: "supreme-nyc.jpg",
    subject: "Lafayette Street, SoHo, New York",
    yearTaken: "LOWER MANHATTAN",
    caption: "SoHo street corridor along Lafayette Street in Lower Manhattan, home to 1994 skate culture epicenter 274 Lafayette.",
    alt: "Monochrome streetscape photograph looking down Lafayette Street in Lower Manhattan, New York",
  },
  {
    key: "ncsa-mosaic",
    kind: "entry",
    commonsTitle: "File:NCSA Mosaic Browser Screenshot.png",
    localFile: "ncsa-mosaic.png",
    subject: "NCSA Mosaic Graphical Web Browser",
    yearTaken: "1993 SOFTWARE",
    caption: "1993 NCSA Mosaic viewport rendering inline graphics alongside hyperlinked documents on desktop workstations.",
    alt: "Monochrome archival screenshot of the NCSA Mosaic graphical web browser interface",
  },
  {
    key: "netscape-navigator",
    kind: "entry",
    commonsTitle: "File:Netscape-1.0N.png",
    localFile: "netscape-navigator.png",
    subject: "Netscape Navigator 1.0N Client",
    yearTaken: "1994 SOFTWARE",
    caption: "Authentic capture of Netscape Navigator 1.0 with toolbar icons, bookmark directory, and inline frame layout.",
    alt: "Monochrome screenshot of Netscape Navigator 1.0 web browser window",
  },
  {
    key: "geocities-1994",
    kind: "entry",
    commonsTitle: "File:USRobotics Courier 2400 Modem with serial cable.jpg",
    localFile: "geocities-1994.jpg",
    subject: "USRobotics External Serial Modem",
    yearTaken: "DIAL-UP HARDWARE",
    caption: "External desktop RS-232 serial dial-up modem typifying the telephone-line gateway to GeoCities homesteads.",
    alt: "Monochrome photograph of a USRobotics external dial-up modem with LED indicators and serial cable",
  },
  {
    key: "cybercafe-culture",
    kind: "entry",
    commonsTitle: "File:The cyber cafe (internet cafe) at the National Communication Museum 03.jpg",
    localFile: "cybercafe-culture.jpg",
    subject: "1990s Cybercafe CRT Terminal Bank",
    yearTaken: "MUSEUM ARCHIVE",
    caption: "Public row of vintage beige CRT workstations and keyboards preserving the 1990s cybercafe social ritual.",
    alt: "Monochrome interior photograph of a reconstructed 1990s internet cafe with CRT computer desks",
  },
  {
    key: "zine-diy-press",
    kind: "entry",
    commonsTitle: "File:Zines.jpg",
    localFile: "zine-diy-press.jpg",
    subject: "Staple-Bound Independent Zines",
    yearTaken: "PRINT ARCHIVE",
    caption: "Hand-collated DIY print publications reproduced via photocopier and saddle-stitched for mail-order trade.",
    alt: "Monochrome photograph displaying a table of small-press handmade DIY zines and pamphlets",
  },
  {
    key: "underground-rave",
    kind: "entry",
    commonsTitle: "File:Technics SL-1200MK2 turntable.jpg",
    localFile: "underground-rave.jpg",
    subject: "Technics SL-1200MK2 Direct-Drive Deck",
    yearTaken: "CLUB HARDWARE",
    caption: "Quartz-locked pitch-fader turntable standardized across warehouse sound systems and UK pirate FM booths.",
    alt: "Monochrome close-up photograph of a Technics SL-1200MK2 direct-drive DJ turntable",
  },
  {
    key: "beanie-babies",
    kind: "entry",
    commonsTitle: "File:Mom's Beanies (9120344523).jpg",
    localFile: "beanie-babies.jpg",
    subject: "Ty Beanie Babies Plush Archive",
    yearTaken: "COLLECTIBLES",
    caption: "Shelved arrangement of pellet-stuffed plush Beanie Babies complete with iconic red heart-shaped swing tags.",
    alt: "Monochrome photograph of rows of collected plush Beanie Babies toys with tags",
  },
  {
    key: "tamagotchi",
    kind: "entry",
    commonsTitle: "File:Gele tamagotchi, objectnr 78041.JPG",
    localFile: "tamagotchi.jpg",
    subject: "Bandai Egg-Shaped Tamagotchi (1997)",
    yearTaken: "1997 OBJECT",
    caption: "Original 1997 keychain LCD virtual pet preserved by Museum Rotterdam showing three-button physical control.",
    alt: "Monochrome museum photograph of a 1997 egg-shaped Tamagotchi keychain virtual pet",
  },
  {
    key: "dream-team-1992",
    kind: "entry",
    commonsTitle: "File:Dream Team at the 1992 Summer Olympics.JPEG",
    localFile: "dream-team-1992.jpg",
    subject: "1992 USA Basketball Team, Barcelona",
    yearTaken: "1992",
    caption: "Official U.S. Air Force photograph of the 1992 USA Men's Olympic Basketball 'Dream Team' in Barcelona.",
    alt: "Monochrome 1992 archival photograph of the USA Dream Team basketball squad at the Barcelona Olympics",
  },
  {
    key: "last-dance-1998",
    kind: "entry",
    commonsTitle: "File:Steve Lipfosky -- Michael Jordan (1997).jpg",
    localFile: "last-dance-1998.jpg",
    subject: "Michael Jordan (#23 Chicago Bulls, 1997)",
    yearTaken: "1997",
    caption: "On-court sports photography of Chicago Bulls guard Michael Jordan during the 1997–98 championship run.",
    alt: "Monochrome action sports photograph of Michael Jordan in his number 23 jersey in 1997",
  },
  {
    key: "dvd-optical-transition",
    kind: "entry",
    commonsTitle: "File:VHS videocassette - front.jpg",
    localFile: "dvd-optical-transition.jpg",
    subject: "Magnetic VHS Cassette Cartridge",
    yearTaken: "ANALOG MEDIA",
    caption: "Standard helical-scan VHS magnetic tape shell displaced after 1997 by 4.7GB MPEG-2 optical DVD discs.",
    alt: "Monochrome photograph of a black magnetic VHS videocassette cartridge",
  },
  {
    key: "y2k-bug-1999",
    kind: "entry",
    commonsTitle: "File:Times Square on New Years' Eve 1999-2000, New York, USA.jpg",
    localFile: "y2k-bug-1999.jpg",
    subject: "Times Square Countdown (Dec 31, 1999)",
    yearTaken: "1999",
    caption: "Dense crowd beneath glowing Times Square marquees awaiting the 1999-to-2000 millennium clock rollover.",
    alt: "Monochrome photograph of New Year's Eve 1999 crowds in Times Square waiting for midnight 2000",
  },

  // === 12 SECTOR BANNERS (HISTORICAL FIGURES, EVENTS & GADGETS) ===
  {
    key: "sector-music",
    kind: "sector",
    commonsTitle: "File:Nasir Jones.jpg",
    localFile: "sector-music.jpg",
    subject: "Nasir 'Nas' Jones",
    yearTaken: "MUSIC ARCHIVE",
    caption: "Lyricist Nas performing live—symbol of the 1990s East Coast hip-hop and analog sampling zenith.",
    alt: "Monochrome concert portrait photograph of hip-hop artist Nas",
  },
  {
    key: "sector-cinema",
    kind: "sector",
    commonsTitle: "File:Westrex 2001W 35mm film projector.jpg",
    localFile: "sector-cinema.jpg",
    subject: "Westrex 2001W 35mm Film Projector",
    yearTaken: "BOOTH HARDWARE",
    caption: "35mm theatrical motion picture projector representing pre-digital celluloid exhibition in the 1990s.",
    alt: "Monochrome booth photograph of a Westrex 35mm celluloid cinema film projector",
  },
  {
    key: "sector-television",
    kind: "sector",
    commonsTitle: "File:Jerry Seinfeld (1997).jpg",
    localFile: "sector-television.jpg",
    subject: "Jerry Seinfeld (1997)",
    yearTaken: "1997",
    caption: "Comedian Jerry Seinfeld photographed onstage in 1997 at the peak of NBC's Thursday broadcast era.",
    alt: "Monochrome 1997 stage photograph of comedian Jerry Seinfeld holding a microphone",
  },
  {
    key: "sector-animation",
    kind: "sector",
    commonsTitle: "File:Akihabara 2011012302.jpg",
    localFile: "sector-animation.jpg",
    subject: "Chuo-dori Strip, Akihabara Tokyo",
    yearTaken: "ANIME DISTRICT",
    caption: "Heart of Tokyo's Akihabara retail corridor—epicenter of 1990s laserdisc, soundtrack, and studio merchandise.",
    alt: "Monochrome street photograph of Akihabara electronics and anime retail storefronts in Tokyo",
  },
  {
    key: "sector-gaming",
    kind: "sector",
    commonsTitle: "File:Floppydisk 90mm(3.5inch).jpg",
    localFile: "sector-gaming.jpg",
    subject: "3.5-Inch High-Density Floppy Diskette",
    yearTaken: "1.44MB MEDIA",
    caption: "Rigid shuttered 3.5-inch magnetic diskette that carried early 1990s PC shareware across dorms and BBS boards.",
    alt: "Monochrome photograph of a 3.5-inch plastic 1.44MB computer floppy disk",
  },
  {
    key: "sector-hardware",
    kind: "sector",
    commonsTitle: "File:MotorolaStarTAC.jpg",
    localFile: "sector-hardware.jpg",
    subject: "Motorola StarTAC Clamshell Phone (1996)",
    yearTaken: "1996 HARDWARE",
    caption: "1996 Motorola StarTAC pocket clamshell mobile phone—the decade's defining portable executive communicator.",
    alt: "Monochrome studio photograph of a flipped-open 1996 Motorola StarTAC clamshell phone",
  },
  {
    key: "sector-fashion",
    kind: "sector",
    commonsTitle: "File:411 Lafayette St.jpg",
    localFile: "sector-fashion.jpg",
    subject: "Cast-Iron Architecture, Lafayette St NYC",
    yearTaken: "SOHO / NOHO",
    caption: "Manhattan cast-iron facade district anchoring independent 1990s downtown design studios and labels.",
    alt: "Monochrome architectural photograph of historic cast-iron buildings along Lafayette Street, New York",
  },
  {
    key: "sector-web-1-0",
    kind: "sector",
    commonsTitle: "File:First Web Server.jpg",
    localFile: "sector-web-1-0.jpg",
    subject: "CERN NeXTcube First World Wide Web Server",
    yearTaken: "1990-1993 CERN",
    caption: "Tim Berners-Lee's NeXTcube at CERN bearing the red marker note: 'This machine is a server. DO NOT POWER IT DOWN!!'",
    alt: "Monochrome museum photograph of the NeXTcube workstation used at CERN as the first World Wide Web server",
  },
  {
    key: "sector-youth-culture",
    kind: "sector",
    commonsTitle: "File:Berlin wall 1990.jpg",
    localFile: "sector-youth-culture.jpg",
    subject: "Dismantling the Berlin Wall (1990)",
    yearTaken: "1990 EVENT",
    caption: "1990 field photograph along the opened Berlin Wall—historic prelude to Berlin's 1990s underground club & rave boom.",
    alt: "Monochrome 1990 historical photograph of people gathered beside openings in the Berlin Wall",
  },
  {
    key: "sector-toys-collectibles",
    kind: "sector",
    commonsTitle: "File:Tamagotchis.jpg",
    localFile: "sector-toys-collectibles.jpg",
    subject: "1990s Tamagotchi Digital Pet Lineup",
    yearTaken: "1996-1998",
    caption: "Three keychain virtual pet shells displaying segmented LCD care icons and ball-chain clips.",
    alt: "Monochrome close-up photograph of three colorful egg-shaped Tamagotchi keychain toys side by side",
  },
  {
    key: "sector-sports",
    kind: "sector",
    commonsTitle: "File:Nelson Mandela 1998.JPG",
    localFile: "sector-sports.jpg",
    subject: "President Nelson Mandela (1998)",
    yearTaken: "1998 HISTORY",
    caption: "South African President Nelson Mandela—whose 1994 election and 1995 Rugby World Cup solidarity defined the decade.",
    alt: "Monochrome archival 1998 portrait photograph of President Nelson Mandela",
  },
  {
    key: "sector-pop-culture",
    kind: "sector",
    commonsTitle: "File:Hubble Space Telescope in Cargo Bay (28046214380).jpg",
    localFile: "sector-pop-culture.jpg",
    subject: "Hubble Space Telescope Launch (April 1990)",
    yearTaken: "APRIL 1990",
    caption: "NASA Shuttle Discovery deploying the Hubble Space Telescope on April 25, 1990—redefining 1990s cosmic iconography.",
    alt: "Monochrome 1990 NASA photograph of the Hubble Space Telescope hovering above Space Shuttle Discovery cargo bay",
  },

  // === 6 HISTORICAL FIGURES, MILESTONES & ICONIC GADGETS CONTACT PLATES ===
  {
    key: "highlight-tim-berners-lee",
    kind: "highlight",
    commonsTitle: "File:Tim Berners-Lee.jpg",
    localFile: "highlight-tim-berners-lee.jpg",
    subject: "Sir Tim Berners-Lee (WWW Inventor)",
    yearTaken: "WEB ARCHITECT",
    caption: "World Wide Web inventor Tim Berners-Lee, author of HTTP, HTML, and the first CERN browser in 1990.",
    alt: "Monochrome portrait photograph of World Wide Web inventor Tim Berners-Lee",
  },
  {
    key: "highlight-dolly-sheep",
    kind: "highlight",
    commonsTitle: "File:Dolly the sheep 2016.JPG",
    localFile: "highlight-dolly-sheep.jpg",
    subject: "Dolly the Cloned Sheep (1996)",
    yearTaken: "1996 SCIENCE",
    caption: "Dolly the sheep (born July 5, 1996 at Roslin Institute, Scotland)—first mammal cloned from an adult somatic cell.",
    alt: "Monochrome museum display photograph of cloned sheep Dolly behind glass",
  },
  {
    key: "highlight-nokia-5110",
    kind: "highlight",
    commonsTitle: "File:Nokia 5110 (1998).jpg",
    localFile: "highlight-nokia-5110.jpg",
    subject: "Nokia 5110 GSM Phone & Snake (1998)",
    yearTaken: "1998 GADGET",
    caption: "1998 Nokia 5110 candybar cellular telephone with monochrome pixel display that bundled Snake.",
    alt: "Monochrome photograph of a 1998 Nokia 5110 mobile telephone",
  },
  {
    key: "highlight-sony-discman",
    kind: "highlight",
    commonsTitle: "File:Discman D121.jpg",
    localFile: "highlight-sony-discman.jpg",
    subject: "Sony Discman D-121 Portable CD Player",
    yearTaken: "1990s GADGET",
    caption: "Clamshell Sony Discman D-121 portable compact disc player powering 1990s commuter headphone listening.",
    alt: "Monochrome studio photograph of a round black Sony Discman portable CD player",
  },
  {
    key: "highlight-sgi-indigo",
    kind: "highlight",
    commonsTitle: "File:SGI Indigo graphics computer (1991).jpg",
    localFile: "highlight-sgi-indigo.jpg",
    subject: "Silicon Graphics Indigo Workstation (1991)",
    yearTaken: "1991 HARDWARE",
    caption: "1991 SGI Iris Indigo purple-bezel UNIX RISC graphics tower that rendered Hollywood's 1990s CGI breakthrough.",
    alt: "Monochrome photograph of a 1991 Silicon Graphics Indigo RISC graphics workstation tower",
  },
  {
    key: "highlight-bill-clinton",
    kind: "highlight",
    commonsTitle: "File:Bill Clinton 1999.jpg",
    localFile: "highlight-bill-clinton.jpg",
    subject: "U.S. President Bill Clinton (1999)",
    yearTaken: "1999 HISTORY",
    caption: "White House official 1999 photograph from the Telecommunications Act & dot-com expansion era.",
    alt: "Monochrome official 1999 White House portrait photograph of President Bill Clinton",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function curlJson(url) {
  const out = execFileSync(
    "curl.exe",
    ["-6", "-sL", "--max-time", "20", "-A", USER_AGENT, url],
    { encoding: "utf8" }
  );
  return JSON.parse(out);
}

function fetchMetadata(titles) {
  const map = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20).join("|");
    const apiUrl =
      "https://commons.wikimedia.org/w/api.php?action=query&titles=" +
      encodeURIComponent(batch) +
      "&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=640&format=json";
    const data = curlJson(apiUrl);
    const normMap = new Map(
      (data.query?.normalized || []).map((n) => [n.to, n.from])
    );
    for (const page of Object.values(data.query?.pages || {})) {
      const ii = page.imageinfo?.[0];
      const origTitle = normMap.get(page.title) || page.title;
      if (!ii) continue;
      const stripHtml = (s) =>
        (s || "")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
      const rawUrl = (ii.thumburl || ii.url).split("?")[0];
      map.set(origTitle, {
        canonicalTitle: page.title,
        width: ii.thumbwidth || ii.width,
        height: ii.thumbheight || ii.height,
        mime: ii.mime,
        license: ii.extmetadata?.LicenseShortName?.value || "Wikimedia Commons",
        artist:
          stripHtml(ii.extmetadata?.Artist?.value).slice(0, 80) ||
          "Wikimedia Commons Contributor",
        sourceUrl:
          ii.descriptionurl ||
          `https://commons.wikimedia.org/wiki/${encodeURIComponent(origTitle.replace(/ /g, "_"))}`,
        downloadUrl: rawUrl,
      });
    }
  }
  return map;
}

function isValidImageBuffer(buf) {
  if (!buf || buf.length < 3000) return false;
  // JPEG SOI FFD8FF or PNG 89504E47
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  return isJpg || isPng;
}

function downscaleIfLarge(filePath, targetExt) {
  const stat = fs.statSync(filePath);
  if (stat.size <= 45 * 1024 && targetExt === ".jpg") {
    return;
  }
  if (targetExt === ".png" && stat.size <= 90 * 1024) {
    return;
  }
  // Use Windows .NET System.Drawing via PowerShell to keep files crisp (<= 480px wide) and compact!
  const safePath = filePath.replace(/'/g, "''");
  const psScript = `
Add-Type -AssemblyName System.Drawing
$p = '${safePath}'
$img = [System.Drawing.Image]::FromFile($p)
$maxW = 480
$w = $img.Width
$h = $img.Height
if ($w -gt $maxW) {
  $newW = $maxW
  $newH = [int][Math]::Round($h * ($maxW / $w))
} else {
  $newW = $w
  $newH = $h
}
$bmp = New-Object System.Drawing.Bitmap($newW, $newH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $newW, $newH)
$g.Dispose()
$img.Dispose()
$tmp = $p + '.tmp'
if ('${targetExt}' -eq '.png') {
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
} else {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
  $enc = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]74)
  $bmp.Save($tmp, $codec, $enc)
}
$bmp.Dispose()
Move-Item -Force $tmp $p
`;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", psScript], {
    stdio: "pipe",
  });
}

function getDimensions(filePath) {
  const safePath = filePath.replace(/'/g, "''");
  const out = execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.Drawing; $i = [System.Drawing.Image]::FromFile('${safePath}'); Write-Output "$($i.Width)x$($i.Height)"; $i.Dispose()`,
    ],
    { encoding: "utf8" }
  ).trim();
  const [w, h] = out.split("x").map(Number);
  return { width: w || 640, height: h || 480 };
}

async function main() {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const titles = [...new Set(PHOTO_TARGETS.map((t) => t.commonsTitle))];
  console.log(`Querying Wikimedia Commons for ${titles.length} archival assets...`);
  const metaMap = fetchMetadata(titles);

  const records = [];
  for (const target of PHOTO_TARGETS) {
    const meta = metaMap.get(target.commonsTitle);
    if (!meta) {
      throw new Error(`Missing Wikimedia metadata for ${target.commonsTitle}`);
    }
    const destPath = path.join(PHOTO_DIR, target.localFile);
    const ext = path.extname(target.localFile).toLowerCase();

    let downloaded = fs.existsSync(destPath) && isValidImageBuffer(fs.readFileSync(destPath));
    if (!downloaded) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          execFileSync(
            "curl.exe",
            [
              "-6",
              "-f",
              "-sL",
              "--max-time",
              "25",
              "-A",
              USER_AGENT,
              meta.downloadUrl,
              "-o",
              destPath,
            ],
            { stdio: "pipe" }
          );
          const buf = fs.readFileSync(destPath);
          if (isValidImageBuffer(buf)) {
            downloaded = true;
            break;
          }
        } catch (err) {
          if (attempt === 3) {
            throw new Error(
              `Failed downloading ${target.commonsTitle} (${meta.downloadUrl}): ${err.message}`
            );
          }
        }
        await sleep(500 * attempt);
      }
      await sleep(180);
    }

    downscaleIfLarge(destPath, ext);
    const dims = getDimensions(destPath);
    const sizeKb = (fs.statSync(destPath).size / 1024).toFixed(1);
    console.log(
      `OK ${target.localFile} (${dims.width}x${dims.height}, ${sizeKb} KB) [${meta.license}]`
    );

    records.push({
      key: target.key,
      kind: target.kind,
      src: `/images/ninety9/photos/${target.localFile}`,
      alt: target.alt,
      caption: target.caption,
      subject: target.subject,
      yearTaken: target.yearTaken,
      artist: meta.artist,
      license: meta.license,
      sourceTitle: meta.canonicalTitle,
      sourceUrl: meta.sourceUrl,
      width: dims.width,
      height: dims.height,
    });
  }

  const tsContent = `import { z } from "zod";

export const ArchivalPhotoSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["entry", "sector", "highlight"]),
  src: z.string().startsWith("/images/ninety9/photos/"),
  alt: z.string().min(5),
  caption: z.string().min(5),
  subject: z.string().min(2),
  yearTaken: z.string().min(2),
  artist: z.string().min(1),
  license: z.string().min(1),
  sourceTitle: z.string().startsWith("File:"),
  sourceUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type ArchivalPhotoRecord = z.infer<typeof ArchivalPhotoSchema>;

/**
 * 52 verified open-source Wikimedia Commons & Public Domain 1990s archival photographs
 * covering all 34 entries, all 12 sectors, and 6 landmark historical figures/gadgets.
 * Auto-indexed by scripts/fetch-ninety9-photos.mjs.
 */
export const ARCHIVAL_PHOTOS: readonly ArchivalPhotoRecord[] = ${JSON.stringify(
    records,
    null,
    2
  )};

export const ENTRY_PHOTOS: Readonly<Record<string, ArchivalPhotoRecord>> =
  Object.fromEntries(
    ARCHIVAL_PHOTOS.filter((p) => p.kind === "entry").map((p) => [p.key, p])
  );

export const SECTOR_PHOTOS: Readonly<Record<string, ArchivalPhotoRecord>> =
  Object.fromEntries(
    ARCHIVAL_PHOTOS.filter((p) => p.kind === "sector").map((p) => [
      p.key.replace(/^sector-/, ""),
      p,
    ])
  );

export const HIGHLIGHT_PHOTOS: readonly ArchivalPhotoRecord[] =
  ARCHIVAL_PHOTOS.filter((p) => p.kind === "highlight");
`;

  fs.writeFileSync(TS_OUT, tsContent, "utf8");
  console.log(`\nWrote ${records.length} verified open-source photos to ${PHOTO_DIR}`);
  console.log(`Generated ${TS_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
