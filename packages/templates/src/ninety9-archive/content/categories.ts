import {
  CategoryManifestSchema,
  type CategoryManifest,
} from "../lib/archive/types.js";

const RAW_CATEGORIES: readonly CategoryManifest[] = [
  {
    code: "01",
    slug: "music",
    label: "01 — MUSIC",
    shortLabel: "MUSIC",
    tagline: "Alt-rock upheaval, East Coast hip-hop craftsmanship, and drum-machine French Touch.",
    essay:
      "Between 1990 and 1999, popular music fractured away from polished eighties stadium gloss into three seismic dialects recorded simultaneously on analog tape, SP-1200 samplers, and Roland hardware boxes. Seattle basement distortion dragged punk dynamics straight onto Billboard No. 1; Queensbridge lyricists turned dusty jazz vinyl loops into cinematic street reportage; and Paris apartment producers proved two affordable synths and a compressor could conquer global club Floors. Alongside Lollapalooza's travelling big-top coalition, the decade codified how subcultural recordings could retain abrasive fidelity even at multi-platinum scale.",
    decadeShiftNote:
      "Shifted distribution from major-label gatekept vinyl/cassette cycles toward compact disc dominance, SoundScan point-of-sale honesty, and early MP3 peer-to-peer ripping by 1999.",
    keyYears: [1991, 1994, 1997],
    illustrationPath: "/images/ninety9/categories/music.svg",
    illustrationMotif: "optical-disc",
  },
  {
    code: "02",
    slug: "cinema",
    label: "02 — CINEMA",
    shortLabel: "CINEMA",
    tagline: "Independent structural audacity meets photoreal CGI and bullet-time optics.",
    essay:
      "Nineties cinema stands astride the last great era of photochemical 35mm theatrical spectacle and the first breathless proofs of computer-generated photorealism. At one pole, Sundance and Cannes validated jagged, non-linear independent storytelling built around sharp dialogue, needle-drop soundtracks, and morally ambivalent crime anthology structures. At the opposite pole, Silicon Graphics workstations calibrated leather-skinned dinosaurs and bullet-time array photography that permanently altered blocking, camera physics, and virtual world-building before digital intermediate projection took hold.",
    decadeShiftNote:
      "Bridged optical matte painting and practical animatronics to hybrid SGI render pipelines and 6-track DTS theatrical sound.",
    keyYears: [1993, 1994, 1999],
    illustrationPath: "/images/ninety9/categories/cinema.svg",
    illustrationMotif: "cinema-frame",
  },
  {
    code: "03",
    slug: "television",
    label: "03 — TELEVISION",
    shortLabel: "TELEVISION",
    tagline: "Prime-time auteur surrealism, conversational meta-sitcoms, and paranoid serialized mythology.",
    essay:
      "Before prestige cable fragmented the living room, network television in the nineties conducted radical structural experiments inside strict 44-minute and 22-minute commercial broadcast containers. From Pacific Northwest timber mysteries laced with avant-garde dream logic to fast-talking Manhattan observational comedy that refused sentimental hugging, creators proved mass-market audiences craved recurring puzzle mythologies, self-referential irony, and atmospheric cinematography worthy of theatrical features. Weekly airing schedules turned watercoolers and Usenet newsgroups into synchronized interpretive laboratories.",
    decadeShiftNote:
      "Transformed episodic reset-button broadcasting into long-arc serialized narrative mythology dissected in real time on early online forums.",
    keyYears: [1990, 1993],
    illustrationPath: "/images/ninety9/categories/television.svg",
    illustrationMotif: "crt-oscilloscope",
  },
  {
    code: "04",
    slug: "animation",
    label: "04 — ANIMATION",
    shortLabel: "ANIMATION",
    tagline: "Black-paper Dark Deco noir and existential mecha deconstruction on cel film.",
    essay:
      "Animation shed its Saturday-morning toy-commercial stigma during the nineties as directors pushed traditional ink-and-paint cels toward psychological weight and architectural grandeur. In Burbank, animators painted directly over pitch-black cardstock to drown Gotham Art Deco skylines in shadows paired with live acoustic orchestra scores. In Tokyo, Gainax weaponized stark typographic title cards, prolonged static frames, and brutal acoustic silence to turn giant-robot genre tropes into an unflinching portrait of adolescent alienation right before digital ink-and-paint swept the medium.",
    decadeShiftNote:
      "Captured the peak craft of hand-inked acetates, multi-plane optical cameras, and bespoke chiaroscuro background painting.",
    keyYears: [1992, 1995],
    illustrationPath: "/images/ninety9/categories/animation.svg",
    illustrationMotif: "cel-grid",
  },
  {
    code: "05",
    slug: "gaming",
    label: "05 — GAMING",
    shortLabel: "GAMING",
    tagline: "Pocket monochrome trading quests, shareware BSP corridors, and the 32/64-bit polygon leap.",
    essay:
      "No consumer entertainment medium underwent a sharper dimensional mutation in ten years than interactive software between 1990 and 1999. The decade opened on two-dimensional sprite cartridges and 4-shade olive-green handheld screens, then detonated across shareware PC BSP engines that invented online deathmatch and user-created WAD mods overnight. By mid-decade, optical CD-ROM storage on PlayStation and analog-stick free cameras on Nintendo 64 rebuilt spatial navigation in real-time 3D polygons, establishing grammar still used across modern game engines.",
    decadeShiftNote:
      "Transitioned from 16-bit tiled pixel framebuffers to hardware perspective-correct Z-buffered 3D geometry and networked TCP/IP arena play.",
    keyYears: [1993, 1994, 1996],
    illustrationPath: "/images/ninety9/categories/gaming.svg",
    illustrationMotif: "controller-pcb",
  },
  {
    code: "06",
    slug: "hardware",
    label: "06 — HARDWARE",
    shortLabel: "HARDWARE",
    tagline: "Magneto-optical audio discs, Start-Menu desktops, pocket PDAs, and USB translucency.",
    essay:
      "Industrial design in nineties personal electronics wrestled computing away from beige corporate cubicles and into backpacks, shirt pockets, and studio desks. Engineers packed anti-skip shock memory into pocket magneto-optical audio discs, taught 68K silicon how to recognize single-stroke Graffiti ink on monochrome resistive glass, standardized 32-bit Plug-and-Play consumer PCs, and finally purged serial legacy ports under sculpted translucent shells. Every click wheel, hinge latch, and tactile CRT curve documented a tactile optimism about personal machinery.",
    decadeShiftNote:
      "Collapsed room-sized computing conventions into personal portable terminals and plug-and-play USB consumer industrial design.",
    keyYears: [1992, 1995, 1996, 1998],
    illustrationPath: "/images/ninety9/categories/hardware.svg",
    illustrationMotif: "workstation-mac",
  },
  {
    code: "07",
    slug: "fashion",
    label: "07 — FASHION",
    shortLabel: "FASHION",
    tagline: "Architectural industrial nylon minimalism alongside downtown Manhattan skate-drop scarcity.",
    essay:
      "Sartorial identity in the nineties staged a decisive rebellion against gold-buttoned eighties power tailoring through two sharply contrasting uniforms: sterile European runway minimalism and downtown American street-level authenticity. High-fashion ateliers replaced couture ornament with matte bonded nylon, razor-straight wool tailoring, and photographic transparency. Simultaneously, skate-shop storefronts on Lafayette Street fused art-gallery discipline with limited-batch graphic tees and heavy fleece, laying the complete scarcity-drop blueprint that governs global streetwear today.",
    decadeShiftNote:
      "Replaced logo-heavy glamour excess with clinical architectural minimalism and limited-edition downtown skate-gallery drops.",
    keyYears: [1993, 1994],
    illustrationPath: "/images/ninety9/categories/fashion.svg",
    illustrationMotif: "runway-monolith",
  },
  {
    code: "08",
    slug: "web-1-0",
    label: "08 — WEB 1.0",
    shortLabel: "WEB 1.0",
    tagline: "Inline GIF images, tiled backgrounds, handmade HTML neighborhoods, and espresso-fueled ISDN terminals.",
    essay:
      "Before algorithmic feeds standardized internet layout into endless vertical rectangles, the early World Wide Web was an eccentric frontier assembled in raw text editors over dial-up handshakes. When graphical browsers first embedded inline bitmap images beside underlined blue hyperlinks, universities, hobbyists, and neighborhood cafes suddenly connected onto one shared hypertext canvas. Personal homesteads stacked animated construction cones, webring navigation bars, and MIDI SoundFonts with zero corporate permission, turning personal bandwidth into folk architecture.",
    decadeShiftNote:
      "Moved hypertext out of academic Gopher/UNIX shells into graphical consumer browsers, SSL commerce, and public neighborhood cybercafes.",
    keyYears: [1993, 1994, 1995],
    illustrationPath: "/images/ninety9/categories/web-1-0.svg",
    illustrationMotif: "browser-window",
  },
  {
    code: "09",
    slug: "youth-culture",
    label: "09 — YOUTH CULTURE",
    shortLabel: "YOUTH CULTURE",
    tagline: "Photocopied DIY punk manifestos, secret orbital rave warehouses, and analog flyer networks.",
    essay:
      "Nineties youth movements thrived in the productive friction between physical print scarcity and whispered nocturnal coordination. Without smartphones, finding a three-thousand-person field party outside London or a basement hardcore matinee in Olympia required calling secret voicemail dropbox numbers at midnight, decoding Xeroxed half-tone flyers taped to telephone poles, and reading hand-stapled zines traded by postal money order. Those analog friction barriers cultivated fierce regional scenes whose graphics, slang, and egalitarian ideals rippled globally.",
    decadeShiftNote:
      "Thrived inside analog word-of-mouth infrastructure—inked flyers, Voicemail info lines, pirate FM transmitters, and cut-and-paste zines.",
    keyYears: [1991, 1992],
    illustrationPath: "/images/ninety9/categories/youth-culture.svg",
    illustrationMotif: "rave-speaker",
  },
  {
    code: "10",
    slug: "toys-collectibles",
    label: "10 — TOYS & COLLECTIBLES",
    shortLabel: "TOYS & COLLECTIBLES",
    tagline: "Pocket LCD nurture loops and heart-tag plush retirement speculation booms.",
    essay:
      "During the mid-to-late nineties, humble novelty objects collided headlong with early internet auction liquidity and engineered supply scarcity. From Bandai keychains that transformed three tiny plastic buttons and an 8-bit buzzer into genuine emotional caregiving anxiety during math class, to small bean-filled plush animals whose arbitrary store retirements fueled speculative price guides and proto-eBay bidding wars, the era discovered how software timers and catalog rarity could electrify global playground economics.",
    decadeShiftNote:
      "Merged tactile pocket keychains and retail plush scarcities with early web price-tracking databases and peer auctions.",
    keyYears: [1993, 1996],
    illustrationPath: "/images/ninety9/categories/toys-collectibles.svg",
    illustrationMotif: "toy-lcd",
  },
  {
    code: "11",
    slug: "sports",
    label: "11 — SPORTS",
    shortLabel: "SPORTS",
    tagline: "Satellite NBA globalization, Olympic basketball royalty, and the 1998 farewell jumper.",
    essay:
      "Nineties athletics witnessed the permanent marriage of elite live competition with twenty-four-hour satellite highlight packaging and global sneaker iconography. When the 1992 Olympic Dream Team stepped onto the parquet in Barcelona, professional American basketball converted instantaneously into worldwide pop mythology. Six years later, a single final possession in Salt Lake City—captured in crisp slow-motion grain—closed an unmatched championship dynasty and delivered one of broadcast television's most dissected sculptural silhouettes.",
    decadeShiftNote:
      "Turned regional stadium broadcasts into simultaneous global satellite mythmaking anchored by signature footwear and slow-motion telemetry.",
    keyYears: [1992, 1998],
    illustrationPath: "/images/ninety9/categories/sports.svg",
    illustrationMotif: "arena-court",
  },
  {
    code: "12",
    slug: "pop-culture",
    label: "12 — POP CULTURE",
    shortLabel: "POP CULTURE",
    tagline: "Silver 4.7GB optical cinema archiving and the global countdown to 1999-12-31T23:59:59Z.",
    essay:
      "The closing chapters of the nineties crystallized humanity's ambivalence toward both high-density home media abundance and fragile legacy infrastructure. Consumers retired bulging bookshelves of VHS magnetic ribbon in favor of laser-etched 4.7-gigabyte optical discs packed with chapter menus and director commentaries. Yet beneath that glittering digital confidence lurked two-digit legacy COBOL date registers—triggering worldwide engineering audits, bunker survivalist kits, and collective midnight breath-holding as computer clocks ticked toward 2000.",
    decadeShiftNote:
      "Bookended home analog tape consumption with digital optical mastering while forcing an unprecedented global audit of legacy software.",
    keyYears: [1997, 1999],
    illustrationPath: "/images/ninety9/categories/pop-culture.svg",
    illustrationMotif: "network-topology",
  },
];

export const CATEGORIES: readonly CategoryManifest[] = RAW_CATEGORIES.map((c) =>
  CategoryManifestSchema.parse(c),
);
