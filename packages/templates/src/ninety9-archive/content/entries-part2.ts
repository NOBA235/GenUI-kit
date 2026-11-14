import type { ArchiveEntry } from "../lib/archive/types.js";

export const ENTRIES_PART_2: readonly ArchiveEntry[] = [
  {
    id: "N99-1993-013",
    slug: "doom-1993",
    serialNumber: "ARC-05-013",
    title: "DOOM (id Software Shareware)",
    subtitle: "id Tech 1 BSP Engine • Episode 1 FTP Release, Deathmatch & User WAD Architecture",
    year: 1993,
    monthLabel: "DEC 1993",
    category: "gaming",
    categoryCode: "05",
    type: "PC SOFTWARE",
    origin: "Mesquite, Texas, US",
    creatorOrPublisher: "John Carmack, John Romero & id Software",
    summary:
      "Uploaded onto University of Wisconsin FTP servers December 10, 1993, DOOM brought fluid textured corridors, IPX LAN Deathmatch, and open WAD file customization directly to university workstations and home 486 PCs.",
    specs: [
      { label: "ENGINE ARCHITECTURE", value: "id Tech 1 (2D Binary Space Partition)" },
      { label: "DATA CONTAINER", value: ".WAD ('Where's All the Data?')" },
      { label: "NETWORK PROTOCOL", value: "4-Player IPX/SPX & Null-Modem Serial" },
      { label: "SYSTEM BASELINE", value: "Intel 80386/486DX • 4MB RAM" },
    ],
    sections: [
      {
        index: "01 // BSP & MODDING COVENANT",
        heading: "Separating Binary Space Partition Engines From User WAD Assets",
        body:
          "John Carmack engineered Binary Space Partition trees originally invented at Xerox PARC so mid-tier 486 CPUs could sort jagged polygonal rooms with sloped ceilings and flickering sectors at thirty-five frames per second. Critically, Carmack placed every sprite, wall texture, map node, and Bobby Prince MIDI track into external WAD archives—openly inviting players to assemble custom total-conversion levels without recompiling a single line of C.",
      },
      {
        index: "02 // NETWORKED ARENA BIRTH",
        heading: "Coined 'Deathmatch' and Strained Campus Ethernet Backbones",
        body:
          "By bundling four-player IPX LAN synchronization into shareware Episode 1 ('Knee-Deep in the Dead'), id Software immediately turned computer labs and aerospace defense Intranets into frantic night-shift combat arenas—forcing sysadmins across Intel, MIT, and Carnegie Mellon to patch DOOM packet filters by early 1994.",
      },
    ],
    pullQuote: {
      quote: "I think there's going to be more bandwidth consumed by DOOM than anything else in university history.",
      attribution: "John Romero, 1993 Launch Note (Mesquite TX)",
    },
    culturalImpact:
      "Installed on more computers than Windows 95 before 1995's fall peak, DOOM directly established the first-person shooter grammar, esports deathmatch tournament culture, and open user-mod communities.",
    historicalLegacy:
      "Open-sourcing DOOM's Linux source code in December 1997 cemented Carmack's portability architecture as computer graphics folklore—eventually ported onto oscilloscopes, printers, and embedded calculators.",
    citations: [
      {
        source: "Masters of Doom (David Kushner)",
        detail: "Random House Development History",
        year: "2003",
      },
      {
        source: "University of Wisconsin-Parkside FTP Logs",
        detail: "doom1_0.zip December 10, 1993 Distribution Mirror",
        year: "1993",
      },
    ],
    tags: ["fps", "wad", "shareware", "bsp", "carmack"],
    relatedSlugs: ["windows-95", "sony-playstation", "ncsa-mosaic"],
    illustrationPath: "/images/ninety9/entries/doom-1993.svg",
    illustrationMotif: "controller-pcb",
  },
  {
    id: "N99-1994-014",
    slug: "sony-playstation",
    serialNumber: "ARC-05-014",
    title: "Sony PlayStation (SCPH-1000)",
    subtitle: "32-Bit MIPS Geometry Transformation Engine, 650MB CD-ROM & Geometric Iconography",
    year: 1994,
    monthLabel: "DEC 1994",
    category: "gaming",
    categoryCode: "05",
    type: "CONSOLE",
    origin: "Tokyo, Japan",
    creatorOrPublisher: "Ken Kutaragi / Sony Computer Entertainment",
    summary:
      "Born after Nintendo walked away from a joint Super Famicom CD contract, Ken Kutaragi built a pure 32-bit polygon workstation priced to invade clubbing twenty-somethings' living rooms on silver CD-ROM discs.",
    specs: [
      { label: "MODEL / CLOCK", value: "SCPH-1000 • MIPS R3000A @ 33.8MHz" },
      { label: "POLYGON COPROCESSOR", value: "GTE 360,000 Flat-Shaded Polys/s" },
      { label: "OPTICAL STORAGE", value: "2x CD-ROM (660MB / Black Bottom Polycarb)" },
      { label: "CONTROLLER SPEC", value: "Teiyu Goto Triangle/Circle/Cross/Square" },
    ],
    sections: [
      {
        index: "01 // FROM SCORNED PARTNERSHIP TO SILICON",
        heading: "Kutaragi's Pure Polygon Gamble Over 2D Sprite Tradition",
        body:
          "While competitors initially straddled expensive 2D cartridge hybrids, Kutaragi staked Sony Computer Entertainment's silicon budget entirely on hardware fixed-point 3D matrix transformations via the Geometry Transformation Engine (GTE) alongside cheap 650MB CD pressing—cutting publisher manufacturing cost per copy from $20 ROM silicon down to two dollars of stamped plastic.",
      },
      {
        index: "02 // INDUSTRIAL & GRAPHIC SIGNALS",
        heading: "Black Discs, Wipeout Club Flyers, and Four Geometric Symbols",
        body:
          "Partnering with Sheffield studio The Designers Republic on Psygnosis's WipEout soundtracked by Leftfield and Orbital, Sony deliberately stripped console marketing out of toy aisles and bolted PlayStation pods straight into UK nightclubs—forever aging video game taste toward minimalist matte gray plastic.",
      },
    ],
    pullQuote: {
      quote: "The triangle refers to viewpoint, the square refers to sheet of paper, and the circle and cross mean yes and no.",
      attribution: "Teiyu Goto, PlayStation Controller Industrial Design Note (1994)",
    },
    culturalImpact:
      "Surpassed 102 million cumulative hardware units as the first home system to break nine figures, pioneering cinematic CD storytelling through Metal Gear Solid, Resident Evil, and Final Fantasy VII.",
    historicalLegacy:
      "Shifted consumer console development out of proprietary 16-bit cartridge houses onto cross-disciplinary 3D studios, redbook CD audio mastering, and adult demographic art direction.",
    citations: [
      {
        source: "Sony Computer Entertainment Investor Filings",
        detail: "SCPH-1000 Dec 3, 1994 Launch & 100M Shipment Ledger",
        year: "2004",
      },
      {
        source: "The Designers Republic Monograph",
        detail: "WipEout 1995 Packaging & Nightclub Kiosk System",
        year: "1996",
      },
    ],
    tags: ["ps1", "cd-rom", "kutaragi", "3d-polygons", "sony"],
    relatedSlugs: ["nintendo-64", "sony-minidisc", "daft-punk-homework"],
    illustrationPath: "/images/ninety9/entries/sony-playstation.svg",
    illustrationMotif: "controller-pcb",
  },
  {
    id: "N99-1996-015",
    slug: "nintendo-64",
    serialNumber: "ARC-05-015",
    title: "Nintendo 64 (NUS-001)",
    subtitle: "Silicon Graphics Reality Coprocessor • Analog Thumbstick Kinematics & Perspective-Correct 3D",
    year: 1996,
    monthLabel: "JUN 1996",
    category: "gaming",
    categoryCode: "05",
    type: "CONSOLE",
    origin: "Kyoto / Mountain View, JP/US",
    creatorOrPublisher: "Genyo Takeda, Shigeru Miyamoto & SGI",
    summary:
      "Cramming Silicon Graphics workstation texture filtering and a dedicated three-prong analog joystick onto zero-load-time cartridges, the Nintendo 64 invented free-roaming 3D camera choreography and four-player couch multiplayer.",
    specs: [
      { label: "CPU ARCHITECTURE", value: "NEC VR4300 64-Bit RISC @ 93.75MHz" },
      { label: "GRAPHICS CHIP", value: "SGI Reality Coprocessor (Tri-Linear)" },
      { label: "MEDIA FORMAT", value: "Mask ROM Cartridge (4MB – 64MB)" },
      { label: "CONTROL INNOVATION", value: "Optical Analog Thumbstick & Z-Trigger" },
    ],
    sections: [
      {
        index: "01 // ANALOG KINESTHETICS",
        heading: "Designing Mario 64 Camera Angles Alongside Thumbstick Potentiometers",
        body:
          "Up through 1995, directional D-pads forced binary eight-way acceleration that turned 3D movement stiff. Shigeru Miyamoto and hardware engineers co-designed the central optical thumbstick directly beside Super Mario 64's Lakitu cameraman—proving smooth 360-degree walking velocity and Z-target combat lock in Ocarina of Time felt intuitive inside three minutes.",
      },
      {
        index: "02 // FOUR-PORT LIVING ROOM COUCH",
        heading: "GoldenEye 007 Split-Screen Architecture Without System Link",
        body:
          "While competitors still required multitaps for extra players, building four controller ports directly onto the N64's front skirt unlocked Rare's four-way split-screen GoldenEye 007 and Super Smash Bros.—forging tactile dormitory multiplayer rituals that predated Xbox Live broadband.",
      },
    ],
    pullQuote: {
      quote: "Before designing courses, we spent months refining how good it felt just to make Mario walk slowly across an empty room.",
      attribution: "Shigeru Miyamoto, Super Mario 64 Shoshinkai Notes (1996)",
    },
    culturalImpact:
      "Pioneered bilinear texture filtering, rumble feedback paks, analog thumbsticks, and contextual 3D camera targeting—nearly every modern game controller owes its left thumbstick layout to 1996 Kyoto.",
    historicalLegacy:
      "Captured the peak engineering tension between fast zero-seek silicon cartridges and the rise of storage-rich optical discs.",
    citations: [
      {
        source: "Silicon Graphics Press Release",
        detail: "Project Reality 64-Bit MIPS Co-Engineering Spec",
        year: "1993",
      },
      {
        source: "Nintendo Hardware Sales Ledger",
        detail: "Consolidated NUS-001 32.93M Global Shipments",
        year: "2002",
      },
    ],
    tags: ["n64", "sgi", "miyamoto", "analog-stick", "multiplayer"],
    relatedSlugs: ["sony-playstation", "game-boy-pokemon", "jurassic-park"],
    illustrationPath: "/images/ninety9/entries/nintendo-64.svg",
    illustrationMotif: "controller-pcb",
  },
  {
    id: "N99-1996-016",
    slug: "game-boy-pokemon",
    serialNumber: "ARC-05-016",
    title: "Game Boy & Pokémon Red/Green Architecture",
    subtitle: "Gunpei Yokoi Lateral Silicon + Satoshi Tajiri Game Link Serial Trading Protocol",
    year: 1996,
    monthLabel: "FEB 1996",
    category: "gaming",
    categoryCode: "05",
    type: "HANDHELD",
    origin: "Kyoto / Tokyo, Japan",
    creatorOrPublisher: "Gunpei Yokoi (Hardware) & Satoshi Tajiri / Game Freak",
    summary:
      "Seven years after Yokoi's frugal 4-shade olive LCD Game Boy launched on 'Lateral Thinking with Withered Technology', Satoshi Tajiri used its overlooked serial Link Cable to resurrect bug-collecting childhood across 151 pocket monsters.",
    specs: [
      { label: "PORTABLE SILICON", value: "Sharp LR35902 (8-Bit @ 4.19MHz)" },
      { label: "DISPLAY MATRIX", value: "160x144px 4-Shade Olive Reflective LCD" },
      { label: "SOFTWARE LINK", value: "DMG-04 Serial Data Transfer Cable" },
      { label: "INITIAL EDITION", value: "Pocket Monsters Red/Green (Feb 1996)" },
    ],
    sections: [
      {
        index: "01 // WITHERED TECHNOLOGY TRIUMPH",
        heading: "Battery Longevity Over Backlit Color Gluttony",
        body:
          "Competitors like Atari Lynx and Sega Game Gear burned six AA cells inside three hours chasing color screens. Yokoi built Sharp's crisp monochrome reflective LCD to squeeze thirty hours from four batteries—creating a rugged gray brick still running strong inside teenagers' backpacks seven years later when Game Freak shipped Red and Green.",
      },
      {
        index: "02 // SOCIAL CABLE HARDWARE LOGIC",
        heading: "Turning Two Cartridge Variations Into Physical Playground Diplomacy",
        body:
          "Observing insects crawl between linked hardware, Tajiri noticed no studio utilized Yokoi's serial Link Cable beyond Tetris duels. By locking twelve evolution paths and creature encounters exclusively across Red vs Green/Blue trade handshakes, Pokémon mandated face-to-face schoolyard negotiation—creating an offline viral mesh network before Wi-Fi.",
      },
    ],
    pullQuote: {
      quote: "In my mind I envisioned real insects walking silently back and forth right through the connecting Game Link cable.",
      attribution: "Satoshi Tajiri, Time Asia Interview (1999)",
    },
    culturalImpact:
      "Extended Game Boy's commercial lifespan past a decade, kicked off the highest-grossing media franchise on Earth, and united handheld RPG design with playground trading economies.",
    historicalLegacy:
      "Validated Gunpei Yokoi's design maxim globally: mature, low-power monochrome hardware paired with social mechanics routinely outperforms power-hungry specs.",
    citations: [
      {
        source: "Nikkei Business / Game Freak Chronicles",
        detail: "1996 Shogakukan CoroCoro Comic Promotion Records",
        year: "1996",
      },
      {
        source: "Nintendo Co., Ltd. Hardware Archives",
        detail: "DMG-01 / MGB / CGB 118.69M Cumulative Shipments",
        year: "2003",
      },
    ],
    tags: ["game-boy", "pokemon", "link-cable", "lcd", "handheld"],
    relatedSlugs: ["tamagotchi", "nintendo-64", "beanie-babies"],
    illustrationPath: "/images/ninety9/entries/game-boy-pokemon.svg",
    illustrationMotif: "toy-lcd",
  },
  {
    id: "N99-1992-017",
    slug: "sony-minidisc",
    serialNumber: "ARC-06-017",
    title: "Sony MiniDisc (MZ-1 Recorder)",
    subtitle: "64mm Magneto-Optical Shutter Cartridge, ATRAC Compression & Anti-Shock Buffer",
    year: 1992,
    monthLabel: "NOV 1992",
    category: "hardware",
    categoryCode: "06",
    type: "PORTABLE AUDIO",
    origin: "Tokyo, Japan",
    creatorOrPublisher: "Sony Corporation",
    summary:
      "Bridging the fragile optical CD and scratch-prone cassette era, Sony encapsulated a 64mm magneto-optical disc inside a locking plastic shutter backed by 10-second DRAM shock protection and home track editing.",
    specs: [
      { label: "INAUGURAL UNIT", value: "Sony MZ-1 Portable Recorder (Nov 1992)" },
      { label: "DISC GEOMETRY", value: "64mm MO Disc • 74 Min ATRAC 292kbps" },
      { label: "MEMORY BUFFER", value: "1MB/4MB Anti-Shock Read-Ahead Cache" },
      { label: "TRACK CONTROL", value: "Non-Destructive UTOC Title / Divide" },
    ],
    sections: [
      {
        index: "01 // PSYCHOACOUSTIC ENGINEERING",
        heading: "Inventing ATRAC Perceptual Coding Before Consumer MP3s",
        body:
          "Because fitting 74 minutes of uncompressed 16-bit PCM stereo onto a pocket 64mm disc proved physically impossible in 1992, Sony engineers coded Adaptive Transform Acoustic Coding (ATRAC). By masking quieter frequency bins below loud human auditory thresholds, MiniDisc slashed storage needs 5:1 while retaining clean portable headphone warmth.",
      },
      {
        index: "02 // TACTILE CARTRIDGE ERGONOMICS",
        heading: "Slipping Click Shutters and Broadcast Radio Desks",
        body:
          "Even while MP3 startups rose late in the decade, MiniDisc ruled Tokyo commuter trains, field broadcast journalism desks, and independent bootleggers thanks to optical TOC editing—letting users split, merge, reorder, and type track titles directly on palm-sized backlit remotes without ever spinning up a PC.",
      },
    ],
    pullQuote: {
      quote: "The cassette tape belongs to the 1980s; MiniDisc combines rugged cartridge armor with optical instantaneous track skipping.",
      attribution: "Sony Corporation Tokyo Announcement Brief (1991)",
    },
    culturalImpact:
      "Defined Japanese personal audio fashion and BBC radio reporter workflows for over fifteen years, famously flashed inside Neo's covert floppy-disc apartment handoff in The Matrix.",
    historicalLegacy:
      "Served as the tactile bridge connecting analog magnetic Walkmans with pure solid-state flash players of the 2000s.",
    citations: [
      {
        source: "Sony Technical Information Archive",
        detail: "ATRAC Version 1–4.5 & MZ-1 Engineering Spec Sheet",
        year: "1992",
      },
      {
        source: "Audio Engineering Society (AES)",
        detail: "Preprint #3452 Magneto-Optical Consumer Coding Paper",
        year: "1993",
      },
    ],
    tags: ["minidisc", "sony", "atrac", "magneto-optical", "portable"],
    relatedSlugs: ["sony-playstation", "palmpilot-1000", "the-matrix"],
    illustrationPath: "/images/ninety9/entries/sony-minidisc.svg",
    illustrationMotif: "optical-disc",
  },
  {
    id: "N99-1995-018",
    slug: "windows-95",
    serialNumber: "ARC-06-018",
    title: "Microsoft Windows 95 (Chicago)",
    subtitle: "32-Bit Protected Kernel, Plug-and-Play Hardware Registry & the Taskbar Start Button",
    year: 1995,
    monthLabel: "AUG 1995",
    category: "hardware",
    categoryCode: "06",
    type: "OS RELEASE",
    origin: "Redmond, Washington, US",
    creatorOrPublisher: "Microsoft Corporation (Brad Silverberg / GUI Team)",
    summary:
      "Unveiled at midnight August 24, 1995 to Brian Eno's startup chime and the Rolling Stones' 'Start Me Up', Windows 95 fused DOS underneath a unified 32-bit desktop taskbar that standardized modern PC computing.",
    specs: [
      { label: "RELEASE BUILD", value: "Version 4.00.950 (13 Floppies / CD-ROM)" },
      { label: "STARTUP AUDIO", value: "Brian Eno 3.25s Synthesizer Chime" },
      { label: "DESKTOP SHELL", value: "Start Button, Taskbar & Explorer Tree" },
      { label: "LAUNCH VOLUME", value: "7 Million Retail Copies in 5 Weeks" },
    ],
    sections: [
      {
        index: "01 // GUI & LONG FILENAME BREAK",
        heading: "Banishing 8.3 DOS Truncation Behind Hierarchical Explorer",
        body:
          "Windows 3.1 felt like an accessory bolted awkwardly onto typed C:\\> prompts. Windows 95 completely overhauled desktop ergonomics via VFAT long filenames up to 255 characters, preemptive multitasking for Win32 binaries, right-click context menus, and a persistent lower Taskbar Start button anchored cleanly in the bottom-left pixel coordinate.",
      },
      {
        index: "02 // MODEM PLUG & THE MASS CONSUMER WEB",
        heading: "Native TCP/IP Winsock Stack Inside Millions of Home PCs",
        body:
          "Crucially, bundling native 32-bit TCP/IP dial-up networking and Plug-and-Play SoundBlaster/modem detection converted home computers overnight from spreadsheets into mainstream internet kiosks—sending millions rushing onto Netscape and MSN the very afternoon they finished unpacking retail boxes.",
      },
    ],
    pullQuote: {
      quote: "The task was to create something timeless, tiny, hopeful, and crisp in under four seconds.",
      attribution: "Brian Eno, on composing 'The Microsoft Sound' (1995)",
    },
    culturalImpact:
      "Sparked overnight CompUSA store lines reminiscent of rock concerts, established the Start Menu spatial mental model across decades of office terminals, and cemented x86 PC dominance.",
    historicalLegacy:
      "Marked the exact watershed when graphical operating systems switched from specialist hobbyist workstations into default household domestic appliances.",
    citations: [
      {
        source: "Microsoft Press Official Launch Kit",
        detail: "Chicago Usability Lab Research & Aug 24, 1995 Shipment Audit",
        year: "1995",
      },
      {
        source: "SFGate / Brian Eno Archive Interview",
        detail: "Quadra 700 'The Microsoft Sound' Composition Notes",
        year: "1996",
      },
    ],
    tags: ["windows-95", "gui", "start-menu", "tcp-ip", "os"],
    relatedSlugs: ["netscape-navigator", "doom-1993", "imac-g3"],
    illustrationPath: "/images/ninety9/entries/windows-95.svg",
    illustrationMotif: "workstation-mac",
  },
  {
    id: "N99-1996-019",
    slug: "palmpilot-1000",
    serialNumber: "ARC-06-019",
    title: "PalmPilot 1000 / Pilot PDA",
    subtitle: "Motorola DragonBall 68328 • Block-of-Wood Prototyping & Single-Stroke Graffiti Ink",
    year: 1996,
    monthLabel: "MAR 1996",
    category: "hardware",
    categoryCode: "06",
    type: "PDA HARDWARE",
    origin: "Los Altos / Sunnyvale, California, US",
    creatorOrPublisher: "Jeff Hawkins, Donna Dubinsky & Ed Colligan / U.S. Robotics",
    summary:
      "Designed first as a carved pine block carried around in Jeff Hawkins's shirt pocket, the monochrome Pilot 1000 solved Apple Newton's size and handwriting traps with single-button HotSync cradles and Graffiti strokes.",
    specs: [
      { label: "PROCESSOR / RAM", value: "Motorola 68328 @ 16MHz • 128KB SRAM" },
      { label: "DISPLAY GLASS", value: "160x160 Monochrome Resistive LCD" },
      { label: "INPUT LANGUAGE", value: "Single-Stroke 'Graffiti' Recognition" },
      { label: "BATTERY LIFE", value: "8–12 Weeks on 2x AAA Alkaline" },
    ],
    sections: [
      {
        index: "01 // SUBTRACTIVE DESIGN DISCIPLINE",
        heading: "The Carved Pine Pocket Mockup Manifesto",
        body:
          "After Apple's heavy Newton MessagePad faltered trying to decipher messy cursive in 1993, Jeff Hawkins insisted every Pilot decision pass his carved wooden block test: if it didn't slip effortlessly into a dress shirt pocket, power on instantaneously without boot screens, and cost under $300, features got cut ruthlessly. Rather than forcing silicon to read arbitrary handwriting, Palm taught users clean single-stroke Graffiti symbols.",
      },
      {
        index: "02 // ONE-TOUCH HOTSYNC CRADLE",
        heading: "Treating Handheld Silicon as a PC Companion, Not Replacement",
        body:
          "Pressing one mechanical button atop its RS-232 serial desktop cradle synchronized calendars, to-do lists, and contacts bidirectionally in under fifteen seconds—inventing the ambient personal-sync ritual later perfected across BlackBerry and smartphones.",
      },
    ],
    pullQuote: {
      quote: "The Pilot isn't a tiny computer; it's a fast, instant paper extension anchored by one HotSync button.",
      attribution: "Jeff Hawkins, Palm Computing Engineering Brief (1996)",
    },
    culturalImpact:
      "Sold over one million units in eighteen months, creating an obsessed homebrew PalmOS software ecosystem ranging from underground subway maps to infrared beam card swaps.",
    historicalLegacy:
      "Demonstrated that constraint-focused monochrome UI design and reliable companion syncing beat over-engineered standalone aspirations every single time.",
    citations: [
      {
        source: "Computer History Museum",
        detail: "Jeff Hawkins Carved Wood Block Mockup & Pilot 1000 Artifact",
        year: "2004",
      },
      {
        source: "Andrea Butter — Piloting Palm",
        detail: "John Wiley & Sons Founding Narrative",
        year: "2002",
      },
    ],
    tags: ["pda", "palmpilot", "graffiti", "hardware", "monochrome"],
    relatedSlugs: ["sony-minidisc", "imac-g3", "tamagotchi"],
    illustrationPath: "/images/ninety9/entries/palmpilot-1000.svg",
    illustrationMotif: "silicon-chip",
  },
  {
    id: "N99-1998-020",
    slug: "imac-g3",
    serialNumber: "ARC-06-020",
    title: "Apple iMac G3 (M6709LL/A)",
    subtitle: "Jony Ive Translucent Enclosure • Purging Floppy Drives for USB & Plug-In Simplicity",
    year: 1998,
    monthLabel: "AUG 1998",
    category: "hardware",
    categoryCode: "06",
    type: "WORKSTATION",
    origin: "Cupertino, California, US",
    creatorOrPublisher: "Jony Ive & Steve Jobs / Apple Computer",
    summary:
      "Wrapped inside sculpted translucent polycarbonate showcasing its internal CRT shadow mask and RF shielding, the 1998 iMac dropped both the 3.5-inch floppy slot and serial ports to drag the consumer web into living rooms.",
    specs: [
      { label: "SILICON HEART", value: "PowerPC 750 G3 @ 233MHz • 32MB RAM" },
      { label: "CRT DISPLAY", value: "15-Inch Shadow Mask (1024x768 @ 75Hz)" },
      { label: "PORT REBELLION", value: "Zero Floppy / ADB • Dual 12Mbps USB" },
      { label: "ENCLOSURE DESIGN", value: "Translucent Polycarbonate & Carry Handle" },
    ],
    sections: [
      {
        index: "01 // INSIDE-OUT INDUSTRIAL HONESTY",
        heading: "Making RF Cages and Cathode Geometry Visible From Across the Room",
        body:
          "Throughout two decades of beige steel towers, computer hardware treated internal transformers as embarrassing industrial guts. Working with specialized candy-packaging injection molders, Jony Ive's industrial team crafted translucent housing that invited users directly inside to inspect sheet-metal bracing, top carry handle ergonomics, and crisp cathode tube symmetry—even before stripping out beige plastics everywhere else.",
      },
      {
        index: "02 // CONTROVERSIAL LEGACY PURGE",
        heading: "Ending the 3.5-Inch Floppy Disk Era in One Bold Stroke",
        body:
          "Denounced violently by conservative trade press for shipping without a 1.44MB floppy slot, Apple bet instead on 24x CD-ROMs, 56K internal modems, and USB peripherals—rapidly transforming USB from dormant motherboard curiosity into the universal plug standard across keyboards, scanners, and MP3 players.",
      },
    ],
    pullQuote: {
      quote: "The 'i' in iMac stands for Internet, Individual, Instruct, Inform, Inspire.",
      attribution: "Steve Jobs, Flint Center Keynote Slide (May 6, 1998)",
    },
    culturalImpact:
      "Rescued Apple from near-bankruptcy by shifting 800,000 units inside 139 days while triggering a half-decade epidemic of translucent electronics across vacuum cleaners, alarm clocks, and N64 shells.",
    historicalLegacy:
      "Crystallized the late-nineties industrial paradigm that personal computers are tactile furniture rather than sterile beige accounting appliances.",
    citations: [
      {
        source: "Apple Computer Press Archive",
        detail: "M6709LL/A iMac Bondi Launch & USB Peripheral Spec",
        year: "1998",
      },
      {
        source: "Victoria & Albert Museum Design Index",
        detail: "Permanent Collection Industrial Hardware Accession Note",
        year: "2001",
      },
    ],
    tags: ["apple", "imac", "jony-ive", "usb", "crt"],
    relatedSlugs: ["windows-95", "palmpilot-1000", "cybercafe-culture"],
    illustrationPath: "/images/ninety9/entries/imac-g3.svg",
    illustrationMotif: "workstation-mac",
  },
  {
    id: "N99-1993-021",
    slug: "minimalist-runway",
    serialNumber: "ARC-07-021",
    title: "90s Minimalist Runway Architecture",
    subtitle: "Helmut Lang, Jil Sander & Prada Utility Nylon • Anti-Ornamentation Sartorial Shift",
    year: 1993,
    monthLabel: "MAR 1993",
    category: "fashion",
    categoryCode: "07",
    type: "FASHION MOVEMENT",
    origin: "Vienna / Hamburg / Milan, EU",
    creatorOrPublisher: "Helmut Lang, Jil Sander & Miuccia Prada",
    summary:
      "Clearing gold shoulder pads, cocktail ruffles, and ostentatious house logos off Parisian and Milanese catwalks in one sharp stroke, European minimalists replaced luxury display with precision technical nylon and austere tailoring.",
    specs: [
      { label: "KEY ATELIERS", value: "Helmut Lang, Jil Sander, Prada Sport" },
      { label: "TEXTILE INNOVATION", value: "Matte Industrial Pocono Nylon & Wool" },
      { label: "SILHOUETTE CODE", value: "Razor Trousers • Collarless Blazers" },
      { label: "MEDIA PLATFORM", value: "First Online Fashion Week Stream (1998)" },
    ],
    sections: [
      {
        index: "01 // ANTI-ORNAMENT REDUCTION",
        heading: "Stripping Excess Tailoring to Architectural Structure",
        body:
          "Following the 1990 recession, conspicuous eighty-dollar-button glamour suddenly read tone-deaf on international streets. In Hamburg and Vienna, Jil Sander and Helmut Lang stripped garments down to severe monochrome uniforms: narrow straight-leg trousers, crisp collarless coats, subtle hidden plackets, and cold synthetic parachute nylons that made practicality feel startlingly avant-garde.",
      },
      {
        index: "02 // INDUSTRIAL TEXTILE CROSSOVER",
        heading: "Prada Pocono Nylon and Helmut Lang's Pre-Internet Fashion Show",
        body:
          "Miuccia Prada proved matte parachute canvas could carry higher desirability than reptile leather, while Lang radically canceled his physical Fall/Winter 1998 Manhattan runway altogether—mailing CD-ROMs and uploading digital images online before fashion conglomerates even maintained corporate websites.",
      },
    ],
    pullQuote: {
      quote: "I work on reduction until nothing unnecessary remains to disturb the silhouette.",
      attribution: "Jil Sander, Paris Fashion Press Archive (1994)",
    },
    culturalImpact:
      "Elevated monochrome tailoring, austere styling, and industrial utility fabrics into the permanent global dress code of architects, museum curators, and software designers.",
    historicalLegacy:
      "Built the direct conceptual genealogy behind modern stealth luxury, technical gorpcore outerwear, and digital runway publishing.",
    citations: [
      {
        source: "Metropolitan Museum of Art Costume Institute",
        detail: "Radical Minimalism & Industrial Textiles Survey",
        year: "2002",
      },
      {
        source: "The New York Times Fashion Archive",
        detail: "Helmut Lang Online Runway Precedent Report",
        year: "1998",
      },
    ],
    tags: ["minimalism", "helmut-lang", "jil-sander", "prada", "tailoring"],
    relatedSlugs: ["supreme-nyc", "imac-g3", "pulp-fiction"],
    illustrationPath: "/images/ninety9/entries/minimalist-runway.svg",
    illustrationMotif: "runway-monolith",
  },
  {
    id: "N99-1994-022",
    slug: "supreme-nyc",
    serialNumber: "ARC-07-022",
    title: "90s Streetwear & Supreme (274 Lafayette St)",
    subtitle: "James Jebbia Downtown Skate Shop • Gallery Merchandising & Limited Thursday Drop Model",
    year: 1994,
    monthLabel: "APR 1994",
    category: "fashion",
    categoryCode: "07",
    type: "STREETWEAR LABEL",
    origin: "SoHo, New York City, US",
    creatorOrPublisher: "James Jebbia / Lafayette Street Collective",
    summary:
      "Opening along empty SoHo cobblestones in April 1994 with clothes stacked neatly along peripheral walls so skateboarders could roll straight across the wide floorboards, Supreme bridged downtown skate crew solidarity with Barbara Kruger graphic rigor.",
    specs: [
      { label: "FLAGSHIP COORDINATES", value: "274 Lafayette St, Manhattan NYC" },
      { label: "INAUGURAL STOCK", value: "4 Box Logo Tee Cuts • Heavy Fleece" },
      { label: "VISUAL CODE", value: "Futura Heavy Oblique Typography" },
      { label: "RETAIL INNOVATION", value: "Art-Gallery Spacing & Scarcity Drops" },
    ],
    sections: [
      {
        index: "01 // SPATIAL GALLERY DESIGN",
        heading: "Wide Central Parquet Floor Where Skaters Could Roll Inside",
        body:
          "Before Supreme, skate shops packed dusty racks wall-to-wall under fluorescent tubes. Trained at Union NYC and Stussy alongside Shawn Stussy, James Jebbia left the entire center of 274 Lafayette bare—framing single-rack heavy crewneck tees, skate decks, and Larry Clark films with clean museum lighting while local downtown kids Gio Estevez, Justin Pierce, and Harold Hunter held court.",
      },
      {
        index: "02 // COUNTERCULTURE SCARCITY ENGINE",
        heading: "Rejecting Wholesale Mall Expansion for Tight Batch Runs",
        body:
          "Refusing to dilute brand cachet across suburban department stores, Supreme deliberately manufactured tiny quantities per graphic—turning weekly seasonal releases into scarce urban collector artifacts long before e-commerce bots existed.",
      },
    ],
    pullQuote: {
      quote: "Skateboarding wasn't cute; it had an edge, an art-world cross-pollination specific to lower Manhattan.",
      attribution: "James Jebbia, Retrospective Design Interview (2010)",
    },
    culturalImpact:
      "Married nineties NYC hip-hop, independent film ('Kids', 1995), gallery photography, and punk attitude into the scarcity drop template replicated globally across luxury houses today.",
    historicalLegacy:
      "Transformed graphic screenprinted cotton tees and skate hardware from disposable teen consumables into institutional auction collectibles.",
    citations: [
      {
        source: "Rizzoli New York Monograph",
        detail: "Supreme Archive Vol. 1 (1994–2009 Photographic Index)",
        year: "2010",
      },
      {
        source: "Complex / Glenn O'Brien Essay",
        detail: "274 Lafayette Street Counterculture Context",
        year: "2008",
      },
    ],
    tags: ["streetwear", "supreme", "lafayette", "skateboarding", "drops"],
    relatedSlugs: ["minimalist-runway", "nas-illmatic", "last-dance-1998"],
    illustrationPath: "/images/ninety9/entries/supreme-nyc.svg",
    illustrationMotif: "runway-monolith",
  },
  {
    id: "N99-1993-023",
    slug: "ncsa-mosaic",
    serialNumber: "ARC-08-023",
    title: "NCSA Mosaic 1.0 Graphical Browser",
    subtitle: "University of Illinois at Urbana-Champaign • Inline Images Meet Hypertext Navigation",
    year: 1993,
    monthLabel: "JAN 1993",
    category: "web-1-0",
    categoryCode: "08",
    type: "WEB BROWSER",
    origin: "Urbana-Champaign, Illinois, US",
    creatorOrPublisher: "Marc Andreessen, Eric Bina & NCSA Team",
    summary:
      "Coded on X Window UNIX workstations during frosty Illinois winter nights by Marc Andreessen and Eric Bina, Mosaic 1.0 rendered inline photographs directly beside blue hypertext links—turning abstract academic hypertext into an exploded visual medium.",
    specs: [
      { label: "INITIAL TARGET OS", value: "X Window System (UNIX Alpha v0.5 Jan '93)" },
      { label: "RENDER BREAKTHROUGH", value: "Inline <IMG> Bitmap Mixing in Flow" },
      { label: "PORTED TARGETS", value: "X11, Windows 3.1 & Mac System 7" },
      { label: "TRAFFIC MULTIPLIER", value: "50,000+ Downloads Monthly by Late '93" },
    ],
    sections: [
      {
        index: "01 // BREAKING THE IMAGE BARRIER",
        heading: "Adding the Missing <IMG> Tag Inside Text Flow",
        body:
          "Earlier World Wide Web clients built at CERN forced images to pop out inside cumbersome external helper windows. Before writing a line of Motif GUI layout code, Andreessen and Bina made a deceptively simple structural leap: implementing inline bitmap GIF/XBM decoding right inside scrolled hypertext alongside Back/Forward history buttons.",
      },
      {
        index: "02 // CROSS-PLATFORM ACCESSIBILITY",
        heading: "Escaping UNIX Terminals Into Macs & Windows Laptops",
        body:
          "When NCSA released clean point-and-click installers for Macintosh and Microsoft Windows late in 1993, professors, librarians, and high-school tinkerers no longer needed Gopher commands or Emacs proficiency to explore CERN's nascent network of fifty web servers.",
      },
    ],
    pullQuote: {
      quote: "The killer feature wasn't rocket science; it was putting the picture right next to the words on the page.",
      attribution: "Marc Andreessen, NCSA Technical Oral History (1998)",
    },
    culturalImpact:
      "Sparked exponential World Wide Web host growth—increasing tracked HTTP sites from ~130 in mid-1993 to over 10,000 by end-1994—and birthed modern Web page layout aesthetics.",
    historicalLegacy:
      "Laid the core URL bar, forward/back stack, inline image DOM model, and purple visited-link visual conventions still running inside every browser tab today.",
    citations: [
      {
        source: "National Center for Supercomputing Applications (NCSA)",
        detail: "January 23, 1993 Mosaic v0.5 / Nov 1993 v1.0 Release Notes",
        year: "1993",
      },
      {
        source: "Gary Wolfe — Wired Magazine Issue 2.10",
        detail: "The (Second Phase of the) Revolution Has Begun",
        year: "1994",
      },
    ],
    tags: ["mosaic", "http", "html", "ncsa", "browser"],
    relatedSlugs: ["netscape-navigator", "geocities-1994", "windows-95"],
    illustrationPath: "/images/ninety9/entries/ncsa-mosaic.svg",
    illustrationMotif: "browser-window",
  },
  {
    id: "N99-1994-024",
    slug: "netscape-navigator",
    serialNumber: "ARC-08-024",
    title: "Netscape Navigator 1.0",
    subtitle: "Mozilla Communications • Progressive JPEG Streaming, SSL Encryption & JavaScript Birth",
    year: 1994,
    monthLabel: "OCT 1994",
    category: "web-1-0",
    categoryCode: "08",
    type: "WEB BROWSER",
    origin: "Mountain View, California, US",
    creatorOrPublisher: "Jim Clark, Marc Andreessen & Brendan Eich / Netscape",
    summary:
      "Rising directly from NCSA Mosaic's original core programmers under Jim Clark's backing, Navigator delivered progressive multi-threaded page painting over 14.4k modems, SSL encrypted checkout locks, and Brendan Eich's 10-day Mocha/JavaScript engine.",
    specs: [
      { label: "RELEASE CODE", value: "Mozilla 0.9 / Navigator 1.0 (Dec 1994)" },
      { label: "MODEM INNOVATION", value: "Progressive Rendering While Downloading" },
      { label: "SECURITY LAYER", value: "Secure Sockets Layer (SSL) Padlock" },
      { label: "CLIENT RUNTIME", value: "LiveScript -> JavaScript (Navigator 2.0)" },
    ],
    sections: [
      {
        index: "01 // STREAMING OVER 14.4K MODEMS",
        heading: "Displaying Layout Text Immediately While Bitmaps Interlaced",
        body:
          "Early Mosaic froze blank white until every image on a page completed transferring across slow copper telephone lines. Netscape opened concurrent HTTP sockets so readers saw formatted paragraphs within two seconds while interlaced GIFs snapped sequentially into sharp monochrome and color focus—transforming modem impatience into addictive browsing flow.",
      },
      {
        index: "02 // COMMERCE LOCKS & TEN-DAY JAVASCRIPT",
        heading: "Inventing HTTPS Trust & Dynamic Programmable Pages",
        body:
          "Even more decisively, Netscape engineer Taher Elgamal's SSL protocol introduced the broken-vs-solid blue key icon guaranteeing encrypted credit cards, while Brendan Eich wrote Mocha/JavaScript inside Navigator 2.0 across ten intense May 1995 days—unlocking interactive client-side software inside web browsers forever.",
      },
    ],
    pullQuote: {
      quote: "The browser won't stay a passive viewer; it is becoming the universal programmable operating surface.",
      attribution: "Netscape Navigator 1995 August IPO Prospectus",
    },
    culturalImpact:
      "Netscape's explosive August 9, 1995 IPO officially ignited the Silicon Valley Dot-Com investment boom while commanding over 80% global browser market share through 1996.",
    historicalLegacy:
      "Direct ancestor of HTTPS security infrastructure, JavaScript/ECMAScript application programming, and the open-source Mozilla Foundation.",
    citations: [
      {
        source: "Netscape Communications Corp. Press Release",
        detail: "October 13, 1994 Public Beta Release Archive",
        year: "1994",
      },
      {
        source: "IEEE Computer Society",
        detail: "Brendan Eich — JavaScript First 20 Years Retrospective",
        year: "2020",
      },
    ],
    tags: ["netscape", "ssl", "javascript", "dot-com", "web-1-0"],
    relatedSlugs: ["ncsa-mosaic", "geocities-1994", "windows-95"],
    illustrationPath: "/images/ninety9/entries/netscape-navigator.svg",
    illustrationMotif: "browser-window",
  },
  {
    id: "N99-1994-025",
    slug: "geocities-1994",
    serialNumber: "ARC-08-025",
    title: "GeoCities Virtual Homesteading",
    subtitle: "Beverly Hills Internet • Themed Web Neighborhoods, <BLINK> Tags & Raw HTML Folk Art",
    year: 1994,
    monthLabel: "NOV 1994",
    category: "web-1-0",
    categoryCode: "08",
    type: "WEB PLATFORM",
    origin: "Beverly Hills / Santa Monica, US",
    creatorOrPublisher: "David Bohnett & John Rezner",
    summary:
      "Organized into real-world conceptual neighborhoods—Area51 for sci-fi, SiliconValley for code, SoHo for painters—GeoCities handed millions their first free 2MB HTML plot without needing corporate DNS hosting.",
    specs: [
      { label: "FOUNDING DATE", value: "November 1994 (Beverly Hills Internet)" },
      { label: "FREE HOMESTEAD QUOTA", value: "2 MB Storage -> Upgraded to 11 MB" },
      { label: "SPATIAL METAPHOR", value: "29 Themed Zip-Code Neighborhoods" },
      { label: "PEAK SCALE (1999)", value: "38 Million Hosted Citizen Pages" },
    ],
    sections: [
      {
        index: "01 // CIVIC HYPER-NEIGHBORHOODS",
        heading: "Mapping Cyberspace Onto Physical City Coordinates",
        body:
          "Rather than burying personal homepages under meaningless ~/user hashes, Bohnett grouped sites by human affinity: Hollywood housed cinema obsessives, Tokyo indexed anime shrines, and Athens sheltered writers. Stepping through themed street addresses linked strangers together inside self-policed neighborhood rings before centralized search engines dominated.",
      },
      {
        index: "02 // VERNACULAR WEB AESTHETICS",
        heading: "Guestbooks, Under-Construction GIFs & View-Source Pedagogy",
        body:
          "GeoCities taught an entire generation to press 'View Source' inside Netscape and stitch handmade HTML tables, MIDI auto-plays, hit counters, and handwritten Webrings onto free server space—prioritizing weird personal voice years before uniform corporate social profile templates smoothed every homepage into identical feeds.",
      },
    ],
    pullQuote: {
      quote: "Everybody deserves a neighborhood address where their own odd obsession has equal real estate beside corporations.",
      attribution: "David Bohnett, GeoCities Community Charter (1995)",
    },
    culturalImpact:
      "Became the third-most-visited domain worldwide behind Yahoo! and AOL by 1998—bought by Yahoo! for $3.57 billion—teaching millions practical web literacy via hobbyist fan shrines.",
    historicalLegacy:
      "When Yahoo! shuttered US GeoCities in 2009, Archive Team's heroic scraping rescue preserved terabytes of irreplaceable nineties Web 1.0 folk-art memory.",
    citations: [
      {
        source: "Internet Archive / Archive Team",
        detail: "2009 GeoCities Special Preservation Crawl Metrics",
        year: "2009",
      },
      {
        source: "SEC Yahoo! / GeoCities Merger Proxy",
        detail: "January 1999 Acquisition & 38M Page Accounting",
        year: "1999",
      },
    ],
    tags: ["geocities", "html", "webring", "folk-art", "web-1-0"],
    relatedSlugs: ["netscape-navigator", "ncsa-mosaic", "cybercafe-culture"],
    illustrationPath: "/images/ninety9/entries/geocities-1994.svg",
    illustrationMotif: "browser-window",
  },
  {
    id: "N99-1995-026",
    slug: "cybercafe-culture",
    serialNumber: "ARC-08-026",
    title: "Early Cybercafés (Cyberia & Alt.Coffee)",
    subtitle: "Physical Third-Place Terminals • Public T1/ISDN Espresso Counters & Counterculture Mailboxes",
    year: 1995,
    monthLabel: "FEB 1995",
    category: "web-1-0",
    categoryCode: "08",
    type: "SUBCULTURE",
    origin: "London / East Village NYC, UK/US",
    creatorOrPublisher: "Eva Pascoe, Genevieve Bell & Neighborhood Operators",
    summary:
      "Before home broadband or pocket data plans existed, urban cybercafes installed Sun workstations, PowerMacs, and high-speed ISDN lines beside espresso counters—turning dial-up isolation into lively late-night public salons.",
    specs: [
      { label: "LANDMARK VENUES", value: "Cyberia (London '94) • Alt.Coffee NYC ('95)" },
      { label: "SHARED BACKBONE", value: "128kbps Dual-Channel ISDN / Fractional T1" },
      { label: "HOURLY TARIFF", value: "£2.50 / $5.00 Per Terminal Session" },
      { label: "COMMON PROTOCOLS", value: "IRC, Pine Email, Mosaic & Early Quake" },
    ],
    sections: [
      {
        index: "01 // PHYSICAL DIGITAL CROSSINGS",
        heading: "Escaping Dial-Up Solitude Into Shared Espresso Salons",
        body:
          "In 1994–1995 most city residents lacked residential ISDN modems or couldn't tie up apartment landlines for hours. Venues like Whitfield Street's Cyberia in London and Avenue A's Alt.Coffee in Manhattan packed scuffed CRT tables alongside couches, zine racks, and espresso machines—letting DJs, writers, travelers, and coders read Pine email and browse experimental sites together in public.",
      },
      {
        index: "02 // GLOBAL TRAVEL & LAN PROVING GROUND",
        heading: "From Backpacker Relay Stations to PC Bang Boom",
        body:
          "Within three years, independent cybercafes sprouted across every continent from Tokyo to Budapest and Seoul's explosive StarCraft PC bang networks—proving network access could function as affordable neighborhood civic commons rather than purely corporate enterprise plumbing.",
      },
    ],
    pullQuote: {
      quote: "People came for the fast line to check email, then stayed till two in the morning arguing architecture across tables.",
      attribution: "Eva Pascoe, Cyberia London Co-Founder Recollection (1996)",
    },
    culturalImpact:
      "Popularized public Wi-Fi cafe culture long before wireless cards existed, hosting net-art festivals, experimental IRC transmissions, and independent digital print workshops.",
    historicalLegacy:
      "Demonstrated enduring human craving for shared third-place neighborhood socialization wrapped around emerging network tools.",
    citations: [
      {
        source: "The New York Times Archives",
        detail: "Alt.Coffee & Silicon Alley Cybercafe Feature Report",
        year: "1995",
      },
      {
        source: "Museum of London Digital Collection",
        detail: "39 Whitfield Street Cyberia Archival Artifacts",
        year: "1996",
      },
    ],
    tags: ["cybercafe", "isdn", "irc", "third-place", "web-1-0"],
    relatedSlugs: ["geocities-1994", "netscape-navigator", "imac-g3"],
    illustrationPath: "/images/ninety9/entries/cybercafe-culture.svg",
    illustrationMotif: "network-topology",
  },
];
