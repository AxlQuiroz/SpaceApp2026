/**
 * DEFINICIONES DE SPRITES (arte original, pixel por pixel).
 *
 * Cada frame es un array de 16 strings de 16 caracteres. Cada carácter es un
 * color de PIXEL_PALETTE ('.' = transparente). <PixelSprite> los dibuja como
 * SVG con shape-rendering="crispEdges", así nunca se ven borrosos.
 *
 * Para reemplazarlos por arte hecho a mano: guarda un spritesheet horizontal
 * (frames de izquierda a derecha) en /public/sprites/<archivo>.png y pon
 * `external: { src: "/sprites/<archivo>.png", frameSize: 16 }` en la animación.
 */

export const PIXEL_PALETTE: Record<string, string> = {
  K: "#0a0e16", // contorno
  W: "#eef3f8", // traje blanco
  G: "#8796ad", // gris metal
  g: "#56667f", // gris oscuro
  b: "#3d4b63", // acero
  C: "#3ee6f0", // cian neón
  c: "#1a8c9e", // cian oscuro
  L: "#9be43a", // lima
  D: "#4f8a1d", // lima oscuro
  Y: "#ffb23e", // ámbar
  O: "#f27a2a", // naranja
  A: "#ff4057", // alerta
  R: "#c2562f", // marte
  S: "#fff6d6", // estrella / luna
  M: "#8b8378", // regolito
};

export type Frame = string[];

export type SpriteAnimation = {
  frames: Frame[];
  /** cuadros por segundo */
  fps: number;
  /** spritesheet externo opcional que sustituye a `frames` */
  external?: { src: string; frameSize: number; frameCount: number };
};

export type SpriteDef = Record<string, SpriteAnimation>;

/* ------------------------------------------------------------------ */
/* Utilidades para derivar frames sin redibujar todo                   */
/* ------------------------------------------------------------------ */

/** Pinta píxeles sueltos encima de un frame: [x, y, color]. */
export function overlay(frame: Frame, pixels: [number, number, string][]): Frame {
  const rows = frame.map((r) => r.split(""));
  for (const [x, y, c] of pixels) if (rows[y] && x >= 0 && x < rows[y].length) rows[y][x] = c;
  return rows.map((r) => r.join(""));
}

/** Cambia colores: { C: "L" } convierte todo el cian en lima. */
export function recolor(frame: Frame, map: Record<string, string>): Frame {
  return frame.map((r) => r.replace(/./g, (ch) => map[ch] ?? ch));
}

/** Desplaza el frame verticalmente (positivo = abajo). */
export function shiftY(frame: Frame, dy: number): Frame {
  const blank = ".".repeat(frame[0].length);
  if (dy > 0) return [...Array(dy).fill(blank), ...frame.slice(0, frame.length - dy)];
  return [...frame.slice(-dy), ...Array(-dy).fill(blank)];
}

/* ------------------------------------------------------------------ */
/* ASTRONAUTA                                                          */
/* ------------------------------------------------------------------ */

const ASTRO_BASE: Frame = [
  "................",
  ".....KKKKKK.....",
  "....KWWWWWWK....",
  "...KWWCCCCWWK...",
  "...KWCCcCCCWK...",
  "...KWCcCCCCWK...",
  "...KWWCCCCWWK...",
  "....KWWWWWWK....",
  "...KKOOOOOOKK...",
  "..KWWWWWWWWWWK..",
  "..KWGWWWWWWGWK..",
  "..KWGWWOOWWGWK..",
  "...KKWWWWWWKK...",
  "....KWWKKWWK....",
  "....KGGKKGGK....",
  "....KKKKKKKK....",
];

const ASTRO_STEP: Frame = [
  ...ASTRO_BASE.slice(0, 13),
  "...KWWK..KWWK...",
  "...KGGK..KGGK...",
  "...KKKK..KKKK...",
];

const ASTRO_WRENCH: [number, number, string][] = [
  [13, 7, "G"],
  [15, 7, "G"],
  [14, 8, "G"],
  [14, 9, "G"],
];

const astronaut: SpriteDef = {
  idle: {
    fps: 2,
    frames: [ASTRO_BASE, overlay(ASTRO_BASE, [[7, 4, "C"], [9, 4, "c"], [6, 5, "C"], [8, 5, "c"]])],
  },
  walk: { fps: 6, frames: [ASTRO_BASE, ASTRO_STEP, shiftY(ASTRO_BASE, 0), ASTRO_STEP] },
  work: {
    fps: 4,
    frames: [overlay(ASTRO_BASE, ASTRO_WRENCH), overlay(ASTRO_BASE, ASTRO_WRENCH.map(([x, y, c]) => [x, y + 1, c]))],
  },
  sick: {
    fps: 2,
    frames: [
      recolor(ASTRO_BASE, { C: "L", c: "D" }),
      overlay(recolor(ASTRO_BASE, { C: "L", c: "D" }), [[13, 2, "C"], [13, 3, "C"]]),
    ],
  },
  celebrate: {
    fps: 4,
    frames: [
      overlay(shiftY(ASTRO_BASE, 0), [[1, 8, "W"], [1, 7, "W"], [14, 8, "W"], [14, 7, "W"], [0, 2, "Y"], [15, 4, "Y"]]),
      overlay(shiftY(ASTRO_BASE, -1), [[1, 6, "W"], [1, 5, "W"], [14, 6, "W"], [14, 5, "W"], [15, 1, "Y"], [0, 5, "Y"]]),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* ROBOT ASISTENTE R0-B1                                               */
/* ------------------------------------------------------------------ */

const ROBOT_BASE: Frame = [
  ".......Y........",
  ".......K........",
  "...KKKKKKKKKK...",
  "..KGGGGGGGGGGK..",
  "..KGKKKKKKKKGK..",
  "..KGKCCKKCCKGK..",
  "..KGKCCKKCCKGK..",
  "..KGKKKKKKKKGK..",
  "..KGGGKOOKGGGK..",
  "...KKKKKKKKKK...",
  ".....KGGGGK.....",
  "...KKGGGGGGKK...",
  "..KGKGGCCGGKGK..",
  "..KGKGGGGGGKGK..",
  "...K.KGGGGK.K...",
  ".....KKKKKK.....",
];

const robot: SpriteDef = {
  idle: {
    fps: 2,
    frames: [ROBOT_BASE, overlay(ROBOT_BASE, [[7, 0, "O"], [5, 5, "K"], [6, 5, "K"], [9, 5, "K"], [10, 5, "K"]])],
  },
  talk: {
    fps: 6,
    frames: [ROBOT_BASE, overlay(ROBOT_BASE, [[7, 8, "Y"], [8, 8, "Y"], [6, 8, "O"], [9, 8, "O"]])],
  },
};

/* ------------------------------------------------------------------ */
/* MÓDULO: INVERNADERO (normal / dañado / sin energía)                 */
/* ------------------------------------------------------------------ */

const GREENHOUSE: Frame = [
  "................",
  ".....KKKKKK.....",
  "...KKCCCCCCKK...",
  "..KCCCcCCCCCCK..",
  ".KCCCCCCCCCCCCK.",
  ".KCCCCLLCCCCCCK.",
  ".KCCCLLLLCCCCCK.",
  "KCCCCCLLCCLLCCCK",
  "KCCLLCCDCLLLLCCK",
  "KCLLLLCDCCLLCCCK",
  "KCCLLCCDCCCDCCCK",
  "KCCCDCCDCCCDCCCK",
  "KKKKKKKKKKKKKKKK",
  "KGGGGGGGGGGGGGGK",
  "KGLLGGGGGGGGLLGK",
  "KKKKKKKKKKKKKKKK",
];

const greenhouse: SpriteDef = {
  normal: { fps: 1, frames: [GREENHOUSE] },
  damaged: {
    fps: 3,
    frames: [
      overlay(GREENHOUSE, [[5, 3, "K"], [6, 4, "K"], [6, 5, "K"], [7, 6, "K"], [8, 7, "K"], [14, 14, "A"], [13, 14, "A"]]),
      overlay(GREENHOUSE, [[5, 3, "K"], [6, 4, "K"], [6, 5, "K"], [7, 6, "K"], [8, 7, "K"], [14, 14, "g"], [13, 14, "g"]]),
    ],
  },
  unpowered: { fps: 1, frames: [recolor(GREENHOUSE, { C: "b", c: "g", L: "g", D: "b" })] },
};

/* ------------------------------------------------------------------ */
/* ICONOS 16x16                                                        */
/* ------------------------------------------------------------------ */

const icon = (frame: Frame): SpriteAnimation => ({ fps: 1, frames: [frame] });

const BASE_ICONS = {
  oxygen: icon([
    "................",
    ".....KKKKKK.....",
    "...KKCCCCCCKK...",
    "..KCCWWCCCCCCK..",
    "..KCWWCCCCCCCK..",
    ".KCCWCCCCCCCCCK.",
    ".KCCCCCCCCCCCCK.",
    ".KCCCCCCCCCCCCK.",
    ".KCCCCCCCCCCCCK.",
    ".KCCCCCCCCCCccK.",
    "..KCCCCCCCCccK..",
    "..KCCCCCCCccCK..",
    "...KKCCCCccKK...",
    ".....KKKKKK.....",
    "..........KK....",
    ".........KCCK...",
  ]),
  food: icon([
    "................",
    ".......K.LL.....",
    "......KCKLLL....",
    "......KCK.L.....",
    ".....KCCCK......",
    ".....KCCCK......",
    "....KCWCCCK.....",
    "....KCWCCCK.....",
    "...KCWCCCCCK....",
    "...KCCCCCCCK....",
    "...KCCCCCCcK....",
    "...KCCCCCccK....",
    "....KCCCccK.....",
    ".....KKKKK......",
    "................",
    "................",
  ]),
  energy: icon([
    "................",
    ".........KKKK...",
    "........KYYYK...",
    ".......KYYYK....",
    "......KYYYK.....",
    ".....KYYYK......",
    "....KYYYYKKKK...",
    "...KYYYYYYYYK...",
    "...KKKKYYYYK....",
    "......KYYYK.....",
    ".....KYYYK......",
    "....KYYK........",
    "...KYYK.........",
    "...KYK..........",
    "...KK...........",
    "................",
  ]),
  day: icon([
    "................",
    ".....KKKKK......",
    "...KKSSSSK......",
    "..KSSSSKK.......",
    "..KSSSK.......Y.",
    ".KSSSK..........",
    ".KSSSK......Y...",
    ".KSSSK..........",
    ".KSSSK..........",
    ".KSSSSK.........",
    "..KSSSSKK.....K.",
    "..KSSSSSSKKKKKK.",
    "...KKSSSSSSSKK..",
    ".....KKKKKKK....",
    "................",
    "................",
  ]),
  repair: icon([
    "................",
    "...........KK...",
    "..........KGGK..",
    "..........KGGGK.",
    "...........KGGK.",
    "..........KGGK..",
    ".........KGGK...",
    "........KGGK....",
    ".......KGGK.....",
    "......KGGK......",
    ".....KGGK.......",
    "..KKKGGK........",
    ".KGGGGK.........",
    ".KGKKK..........",
    ".KGK............",
    "..K.............",
  ]),
  farm: icon([
    "................",
    "................",
    "..KKK.....KKK...",
    ".KLLLK...KLLLK..",
    ".KLLLLK.KLLLLK..",
    "..KLLLLKLLLLK...",
    "...KKKLDLKKK....",
    "......KDK.......",
    "......KDK.......",
    "......KDK.......",
    "..KKKKKDKKKKK...",
    "..KRRRRRRRRRK...",
    "...KRRRRRRRK....",
    "...KRRRRRRRK....",
    "....KKKKKKK.....",
    "................",
  ]),
  solar: icon(recolor([
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KbbbKbbbKbbbbK.",
    ".KbCbKbbbKbbbbK.",
    ".KbbbKbbbKbbbbK.",
    ".KKKKKKKKKKKKKK.",
    ".KbbbKbbbKbbbbK.",
    ".KbbbKbCbKbbbbK.",
    ".KbbbKbbbKbbbbK.",
    ".KKKKKKKKKKKKKK.",
    ".......KK.......",
    ".......KK.......",
    ".......KK.......",
    ".....KKKKKK.....",
    "....KGGGGGGK....",
    "....KKKKKKKK....",
  ], { b: "c" })),
  rest: icon([
    "................",
    "..........CCCC..",
    "............C...",
    "...........C....",
    "..........CCCC..",
    "......CCC.......",
    ".......C........",
    "......CCC.......",
    "................",
    "KK..............",
    "KGKKKKKKKKKKKKK.",
    "KGKWWKSSSSSSSSK.",
    "KGKWWKSSSSSSSSK.",
    "KGKKKKKKKKKKKKK.",
    "KGK..........KGK",
    "KKK..........KKK",
  ]),
  sun: icon([
    "................",
    ".......Y........",
    "..Y....Y....Y...",
    "...Y.......Y....",
    ".....KKKKKK.....",
    "....KYYYYYYK....",
    "...KYYOYYYYYK...",
    ".YYKYOYYYYYYKYY.",
    ".YYKYYYYYYOYKYY.",
    "...KYYYYYYOYK...",
    "....KYYYYYYK....",
    ".....KKKKKK.....",
    "...Y.......Y....",
    "..Y....Y....Y...",
    ".......Y........",
    "................",
  ]),
  lock: icon([
    "................",
    "................",
    ".....KKKKKK.....",
    "....KGGGGGGK....",
    "....KGKKKKGK....",
    "....KGK..KGK....",
    "....KGK..KGK....",
    "..KKKKKKKKKKKK..",
    "..KYYYYYYYYYYK..",
    "..KYYYYKKYYYYK..",
    "..KYYYYKKYYYYK..",
    "..KYYYYYKYYYYK..",
    "..KYYYYYKYYYYK..",
    "..KOOOOOOOOOOK..",
    "..KKKKKKKKKKKK..",
    "................",
  ]),
  explore: icon([
    "................",
    "...KKKKKKKK.....",
    "...KLLLLLLLK....",
    "...KLLWLLLLLK...",
    "...KLLLLLLLK....",
    "...KLLLLLLK.....",
    "...KKKKKKK......",
    "...KG...........",
    "...KG...........",
    "...KG...........",
    "...KG...........",
    "...KG...........",
    ".MMKGMMM........",
    "MMMMMMMMMM......",
    "MMMMMMMMMMMM....",
    "................",
  ]),
  tank: icon([
    "................",
    "......KKKK......",
    ".....KGGGGK.....",
    "......KGGK......",
    "....KKKKKKKK....",
    "...KCCCCCCCcK...",
    "...KCWCCCCCcK...",
    "...KCWCCCCCcK...",
    "...KCCCCCCCcK...",
    "...KWWWWWWWWK...",
    "...KCCCCCCCcK...",
    "...KCCCCCCCcK...",
    "...KCCCCCCCcK...",
    "...KcccccccKK...",
    "....KKKKKKKK....",
    "................",
  ]),
  shelter: icon([
    "................",
    ".......KK.......",
    "......KGGK......",
    ".....KGGGGK.....",
    "....KGGGGGGK....",
    "...KGGGGGGGGK...",
    "..KGGGGGGGGGGK..",
    ".KKKKKKKKKKKKKK.",
    "..KbbbbbbbbbbK..",
    "..KbbKKKKKKbbK..",
    "..KbbKYYYYKbbK..",
    "..KbbKYYYYKbbK..",
    "..KbbKYYYYKbbK..",
    "..KbbKYYYYKbbK..",
    "..KKKKKKKKKKKK..",
    "................",
  ]),
  exit: icon([
    "................",
    "..KKKKKKK.......",
    "..KbbbbbK.......",
    "..KbbbbbK..K....",
    "..KbbbbbK..KK...",
    "..KbbbbbKKKKLK..",
    "..KbbbbLLLLLLLK.",
    "..KbbbbbKKKKLK..",
    "..KbbbbbK..KK...",
    "..KbbbbbK..K....",
    "..KbbbbbK.......",
    "..KbbbbbK.......",
    "..KKKKKKK.......",
    "................",
    "................",
    "................",
  ]),
  ration: icon([
    "................",
    "........K.......",
    ".......KD.LL....",
    "........KLLL....",
    "....KKKKDKKKK...",
    "...KRRRRKRRRRK..",
    "..KRWRRRRRRRRRK.",
    "..KRWRRRRRRRRRK.",
    "..KRRRRRRRRRRRK.",
    "..KRRRRRRRRRRRK.",
    "..KRRRRRRRRRRRK.",
    "...KRRRRRRRRRK..",
    "...KRRRRRRRRRK..",
    "....KRRRKRRRK...",
    ".....KKK.KKK....",
    "................",
  ]),
  gear: icon([
    "................",
    "......KKKK......",
    "...KK.KGGK.KK...",
    "..KGGKKGGKKGGK..",
    "..KGGGGGGGGGGK..",
    "...KGGGKKGGGK...",
    ".KKKGGK..KGGKKK.",
    ".KGGGK....KGGGK.",
    ".KGGGK....KGGGK.",
    ".KKKGGK..KGGKKK.",
    "...KGGGKKGGGK...",
    "..KGGGGGGGGGGK..",
    "..KGGKKGGKKGGK..",
    "...KK.KGGK.KK...",
    "......KKKK......",
    "................",
  ]),
  heart: icon([
    "................",
    "................",
    "..KKKK...KKKK...",
    ".KAAAAK.KAAAAK..",
    "KAWWAAAKAAAAAAK.",
    "KAWAAAAAAAAAAAK.",
    "KAAAAAAAAAAAAAK.",
    ".KAAAAAAAAAAAK..",
    "..KAAAAAAAAAK...",
    "...KAAAAAAAK....",
    "....KAAAAAK.....",
    ".....KAAAK......",
    "......KAK.......",
    ".......K........",
    "................",
    "................",
  ]),
  warning: icon([
    "................",
    ".......KK.......",
    "......KYYK......",
    "......KYYK......",
    ".....KYYYYK.....",
    ".....KYKKYK.....",
    "....KYYKKYYK....",
    "....KYYKKYYK....",
    "...KYYYKKYYYK...",
    "...KYYYKKYYYK...",
    "..KYYYYYYYYYYK..",
    "..KYYYYKKYYYYK..",
    ".KYYYYYKKYYYYYK.",
    ".KYYYYYYYYYYYYK.",
    ".KKKKKKKKKKKKKK.",
    "................",
  ]),
  flask: icon([
    "................",
    ".....KKKKKK.....",
    "......KWWK......",
    "......KWWK......",
    "......KWWK......",
    ".....KWWWWK.....",
    "....KWWWWWWK....",
    "....KWWWWWWK....",
    "...KLLLLLLLLK...",
    "...KLLWLLLLLK...",
    "..KLLLLLLLLLLK..",
    "..KLLLLLLLDLLK..",
    "..KLLLLLLLLLLK..",
    "..KDLLLLLLLLDK..",
    "...KKKKKKKKKK...",
    "................",
  ]),
  next: icon([
    "................",
    "................",
    "..KK....KK......",
    "..KLK...KLK.....",
    "..KLLK..KLLK....",
    "..KLLLK.KLLLK...",
    "..KLLLLKKLLLLK..",
    "..KLLLLLKLLLLLK.",
    "..KLLLLLKLLLLLK.",
    "..KLLLLKKLLLLK..",
    "..KLLLK.KLLLK...",
    "..KLLK..KLLK....",
    "..KLK...KLK.....",
    "..KK....KK......",
    "................",
    "................",
  ]),
  antenna: icon([
    "................",
    "..KKKKKKK.......",
    ".KGGGGGGGK...C..",
    ".KGWGGGGGGK.C.C.",
    "..KGGGGGGGGK..C.",
    "...KGGGGGGGK.C..",
    "....KGGGGGGK....",
    ".....KGGGGK.....",
    "......KGGK......",
    ".......KK.......",
    ".......KK.......",
    "......KGGK......",
    ".....KGGGGK.....",
    "....KKKKKKKK....",
    "................",
    "................",
  ]),
  medal: icon([
    "................",
    "...KKK....KKK...",
    "...KCCK..KCCK...",
    "....KCCKKCCK....",
    ".....KCCCCK.....",
    "......KKKK......",
    ".....KYYYYK.....",
    "....KYYYYYYK....",
    "...KYYYSYYYYK...",
    "...KYYSSSYYYK...",
    "...KYYYSYYYYK...",
    "...KYYYYYYYOK...",
    "....KYYYYYOK....",
    ".....KOOOOK.....",
    "......KKKK......",
    "................",
  ]),
  book: icon([
    "................",
    "................",
    "..KKKKKK.KKKKKK.",
    ".KWWWWWWKWWWWWWK",
    ".KWggggWKWggggWK",
    ".KWWWWWWKWWWWWWK",
    ".KWggggWKWgggWWK",
    ".KWWWWWWKWWWWWWK",
    ".KWgggWWKWggggWK",
    ".KWWWWWWKWWWWWWK",
    ".KWggggWKWggWWWK",
    ".KWWWWWWKWWWWWWK",
    ".KCCCCCCKCCCCCCK",
    "..KKKKKKKKKKKKK.",
    "................",
    "................",
  ]),
  mars: icon([
    "................",
    ".....KKKKKK.....",
    "...KKRRRRRRKK...",
    "..KRRRRORRRRRK..",
    "..KRRRRRRRRRRK..",
    ".KRROORRRRRMRRK.",
    ".KRRORRRRRMMRRK.",
    ".KRRRRRRRRRRRRK.",
    ".KRRRRRORRRRRRK.",
    ".KRRRRRRRRRRRRK.",
    ".KMRRRRRRRROORK.",
    "..KRRRRRRRRRRK..",
    "..KRRRMMRRRRRK..",
    "...KKRRRRRRKK...",
    ".....KKKKKK.....",
    "................",
  ]),
} satisfies Record<string, SpriteAnimation>;

// Variantes por recoloreo (sin redibujar)
export const ICONS = {
  ...BASE_ICONS,
  repairWater: icon(recolor(BASE_ICONS.repair.frames[0], { G: "C" })),
  repairSolar: icon(recolor(BASE_ICONS.repair.frames[0], { G: "Y" })),
};

export type IconName = keyof typeof ICONS;

/* ------------------------------------------------------------------ */
/* PANEL SOLAR de superficie (normal / dañado por polvo)               */
/* ------------------------------------------------------------------ */

const PANEL = recolor(BASE_ICONS.solar.frames[0], { b: "c" });
const DUST: [number, number, string][] = [
  [2, 2, "M"], [3, 2, "M"], [6, 3, "M"], [7, 3, "M"], [11, 2, "M"], [12, 3, "M"],
  [3, 6, "M"], [4, 7, "M"], [10, 7, "M"], [11, 6, "M"], [12, 8, "M"], [7, 8, "M"],
];

const solarPanel: SpriteDef = {
  normal: { fps: 2, frames: [PANEL, overlay(PANEL, [[3, 3, "C"], [7, 7, "C"], [11, 3, "C"]])] },
  damaged: {
    fps: 3,
    frames: [overlay(PANEL, DUST), overlay(overlay(PANEL, DUST), [[14, 1, "A"], [14, 2, "A"]])],
  },
};

/* ------------------------------------------------------------------ */
/* GENERADOR DE OXÍGENO (burbujas que suben / apagado)                 */
/* ------------------------------------------------------------------ */

const O2GEN: Frame = [
  "................",
  "....KKKKKKKK....",
  "...KGGGGGGGGK...",
  "...KGKKKKKKGK...",
  "...KGKCCCCKGK...",
  "...KGKCCCCKGK...",
  "...KGKCCCCKGK...",
  "...KGKCCCCKGK...",
  "...KGKCCCCKGK...",
  "...KGKKKKKKGK...",
  "...KGGGLGGGGK...",
  "...KGGGGGGGGK...",
  "..KKKKKKKKKKKK..",
  "..KggggggggggK..",
  "..KKKKKKKKKKKK..",
  "................",
];

const oxygenGen: SpriteDef = {
  on: {
    fps: 4,
    frames: [
      overlay(O2GEN, [[7, 8, "W"], [8, 6, "W"], [7, 4, "W"]]),
      overlay(O2GEN, [[8, 7, "W"], [7, 5, "W"], [8, 8, "W"]]),
      overlay(O2GEN, [[7, 6, "W"], [8, 4, "W"], [7, 8, "W"]]),
    ],
  },
  off: { fps: 1, frames: [recolor(O2GEN, { C: "b", L: "A" })] },
};

/* ------------------------------------------------------------------ */
/* TANQUE DE RECICLAJE DE AGUA (normal / con fuga)                     */
/* ------------------------------------------------------------------ */

const WATERTANK: Frame = [
  "................",
  "...KKKKKKKKKK...",
  "..KGGGGGGGGGGK..",
  "..KGbbbbbbbbGK..",
  "..KGbbbbbbbbGK..",
  "..KGCCCCCCCCGK..",
  "..KGCCCCCCCCGK..",
  "..KGCCCCCCCCGK..",
  "..KGCCCCCCCCGK..",
  "..KGCCCCCCCCGK..",
  "..KGGGGLGGGGGK..",
  "..KKKKKKKKKKKK..",
  "....KGK..KGK....",
  "....KGK..KGK....",
  "...KKKKKKKKKK...",
  "................",
];

const waterTank: SpriteDef = {
  normal: {
    fps: 2,
    frames: [
      overlay(WATERTANK, [[5, 6, "W"], [9, 8, "W"]]),
      overlay(WATERTANK, [[6, 5, "W"], [10, 7, "W"]]),
    ],
  },
  leak: {
    fps: 4,
    frames: [
      overlay(WATERTANK, [[7, 10, "A"], [13, 6, "C"], [14, 8, "C"]]),
      overlay(WATERTANK, [[7, 10, "Y"], [13, 7, "C"], [14, 10, "C"]]),
      overlay(WATERTANK, [[7, 10, "A"], [14, 9, "C"], [14, 12, "C"]]),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* ASTRONAUTA EXPLORADOR con bandera                                   */
/* ------------------------------------------------------------------ */

const FLAG: [number, number, string][] = [
  [14, 2, "G"], [14, 3, "G"], [14, 4, "G"], [14, 5, "G"], [14, 6, "G"], [14, 7, "G"], [14, 8, "G"],
  [15, 2, "L"], [15, 3, "L"],
];
astronaut.explore = { fps: 6, frames: [overlay(ASTRO_BASE, FLAG), overlay(ASTRO_STEP, FLAG)] };

/* ------------------------------------------------------------------ */
/* MOXIE: el generador de oxígeno marciano (mismo dibujo, colores cálidos) */
/* ------------------------------------------------------------------ */

const moxie: SpriteDef = {
  on: { fps: oxygenGen.on.fps, frames: oxygenGen.on.frames.map((f) => recolor(f, { G: "Y", g: "O" })) },
  off: { fps: 1, frames: oxygenGen.off.frames.map((f) => recolor(f, { G: "M" })) },
};

export const SPRITES = {
  astronaut,
  robot,
  greenhouse,
  solarPanel,
  oxygenGen,
  moxie,
  waterTank,
} satisfies Record<string, SpriteDef>;

export type SpriteName = keyof typeof SPRITES;
