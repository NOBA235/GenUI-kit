# NINETY9 — Monochrome Technical Schematic & Archival Photo Manifest

Visual assets combine deterministic 5-tone monochrome vector schematics with verified open-source 1990s Wikimedia Commons & Public Domain photographs stored locally under `public/images/ninety9/` (zero external CDN requests at runtime, strict 5-tone grayscale print styling).

## 1. Open-Source 1990s Archival Photographs (`public/images/ninety9/photos/*` — 52 Files)
Verified Public Domain and Creative Commons (CC0 / CC BY / CC BY-SA) historical photographs covering:
- **All 34 Archive Entries:** Cultural figures (`Kurt Cobain`, `Trent Reznor`, `David Lynch`, `Quentin Tarantino`, `Michael Jordan`, `Gillian Anderson & David Duchovny`, `John Romero`), landmarks & events (`1992 USA Dream Team`, `Queensbridge Houses`, `Tom's Restaurant NYC`, `Times Square Dec 31 1999`, `Akihabara 1999`, `Lafayette St`), and authentic hardware/media (`Sony PlayStation SCPH-1000`, `Nintendo 64`, `Original Game Boy`, `Sony MZ-1 MiniDisc`, `Apple iMac G3`, `US Robotics Pilot 1000`, `Nokia 8110`, `Technics SL-1200MK2`, `Roland TR-909`, `Windows 95 Floppies/CD-ROM`, `NCSA Mosaic`, `Netscape Navigator 1.0N`, `USRobotics Courier Modem`, `Tamagotchi`, `VHS Cassette`).
- **All 12 Sector Plates:** Historical turning points and icons (`Berlin Wall 1990`, `Hubble Space Telescope Launch 1990`, `CERN NeXTcube First Web Server`, `President Nelson Mandela 1998`, `Motorola StarTAC 1996`, `Westrex 35mm Cinema Projector`, `Jerry Seinfeld 1997`, `Nas`, `3.5-Inch Shareware Floppy`).
- **6 Landmark Highlights:** `Sir Tim Berners-Lee`, `Dolly the Sheep (1996)`, `Nokia 5110 (1998)`, `Sony Discman D-121`, `Silicon Graphics Indigo (1991)`, `U.S. President Bill Clinton (1999)`.

All credits and license badges render natively inside `<figcaption>` elements via `ArchivalMediaPlate` with automatic SVG fallback.

## 2. Entry Technical Plates (`public/images/ninety9/entries/*.svg` — 34 Files)
Each of the 34 archival dossiers pairs a custom halftone-dithered vector schematic matching its `illustrationMotif` (`optical-disc`, `cinema-frame`, `crt-oscilloscope`, `cel-grid`, `controller-pcb`, `workstation-mac`, `silicon-chip`, `browser-window`, `runway-monolith`, `rave-speaker`, `toy-lcd`, `arena-court`, `network-topology`).

## 3. Category Sector Plates (`public/images/ninety9/categories/*.svg` — 12 Files)
Each of the 12 archive sectors (`01 — MUSIC` through `12 — POP CULTURE`) ships a matching monochrome classification diagram (`music.svg` through `pop-culture.svg`) rendered inside the Category Essays view and Dossier plate switcher.

## 4. Regeneration Scripts
- Re-run `npx tsx scripts/generate-ninety9-assets.ts` to deterministically regenerate all 46 SVGs while validating palette compliance (`#FFFFFF`, `#000000`, `#D9D9D9`, `#808080`, `#292929`).
- Re-run `node scripts/fetch-ninety9-photos.mjs` to fetch/verify all 52 Wikimedia Commons open-source photographs and regenerate `content/photos.ts`.
