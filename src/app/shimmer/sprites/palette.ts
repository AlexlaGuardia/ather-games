// Species color palettes — 10-slot master palette per species
// Covers all forms (base -> second -> awakened) with the same index layout.
// Variant classes (ajin, xian, owar, luvi) swap the entire 10-color set.
//
// Index layout (consistent across all species):
//   [0] primary body       [1] secondary/highlight   [2] dark accent/shadow
//   [3] eyes/pupil         [4] white/light            [5] tertiary accent
//   [6] detail/extra       [7] evolution slot 1       [8] evolution slot 2
//   [9] evolution slot 3
//
// Slots 7-9 are reserved for second/awakened form colors.
// Paint them in the Spirit Editor when you create evolved sprites.
//
// Keys: species -> variant ('base', 'ajin', 'xian', 'owar', 'luvi')
// Variant class cascades through evolution — the key follows the spirit,
// but each form has its own palette set (sprites are unique per form).

export const PALETTES: Record<string, Record<string, readonly string[]>> = {
  fox: {
    base: ['#dcb273', '#546f63', '#c52b2b', '#0a0a0a', '#f4e7f3', '#694126', '#8b704b', '#1a1a2e', '#705838', '#503820'],
    mana: ['#d1a582', '#647075', '#800000', '#1a1a2e', '#efebeb', '#754b45', '#907162', '#a17d66', '#7b5d53', '#614440'],
    ajin: ['#e8c080', '#6b7558', '#d04030', '#0a0a0a', '#f8f0e0', '#885030', '#a08050', '#2a1a10', '#886040', '#604020'],
    xian: ['#b0b8c0', '#506878', '#882838', '#0a0a0a', '#e8f0f8', '#506068', '#708090', '#182030', '#586878', '#384858'],
    owar: ['#8a7858', '#384838', '#601818', '#050505', '#c0b8b0', '#403020', '#584830', '#101018', '#403020', '#281810'],
    luvi: ['#f0d8a0', '#78a088', '#e04848', '#0a0a0a', '#ffffff', '#a06838', '#c8a070', '#282848', '#a08060', '#785040'],
  },
  axolotl: {
    base: ['#e87a9a', '#ffd0b8', '#4a1848', '#1a1a2e', '#efebeb', '#a65970', '#c86888', '#d088a0', '#803858', '#602040'],
    ajin: ['#e8a078', '#ffd8c0', '#583018', '#1a1a2e', '#f8f0e0', '#b87050', '#d89068', '#d8a080', '#906038', '#704020'],
    xian: ['#a088c0', '#d0c8e0', '#281848', '#1a1a2e', '#e8f0f8', '#7858a0', '#9878b0', '#a080c0', '#604080', '#402060'],
    owar: ['#885060', '#a08890', '#281028', '#0a0a10', '#c0b8b0', '#604048', '#784858', '#804868', '#502838', '#381020'],
    luvi: ['#f0a0b8', '#ffe0d0', '#682068', '#1a1a2e', '#ffffff', '#c87088', '#e088a0', '#e0a8c0', '#a05070', '#803058'],
  },
  'water-bear': {
    base: ['#8a9aaa', '#c8d8c0', '#2a3058', '#d58504', '#efebeb', '#5a6a78', '#1a1a2e', '#ff0000', '#687888', '#485060'],
    ajin: ['#a8a088', '#d8d0b0', '#383020', '#d58504', '#f8f0e0', '#787060', '#282010', '#e85020', '#787058', '#585038'],
    xian: ['#7088a8', '#b0c8d8', '#182848', '#d58504', '#e8f0f8', '#486078', '#101828', '#c83040', '#506880', '#304058'],
    owar: ['#586068', '#889080', '#181828', '#a06804', '#c0b8b0', '#384048', '#0a0a18', '#a01010', '#404850', '#283038'],
    luvi: ['#a8b8c8', '#e0f0d8', '#384070', '#f0a020', '#ffffff', '#7888a0', '#282838', '#ff3030', '#88a0b0', '#607080'],
  },
  turtle: {
    base: ['#e8d4ad', '#a5c4b9', '#bca68c', '#1a1a2e', '#1e6261', '#b7722b', '#4a7038', '#68a050', '#2a4820', '#1a3010'],
    ajin: ['#e8c890', '#c0b898', '#b89870', '#1a1a2e', '#686030', '#c08028', '#587028', '#78a040', '#384818', '#283010'],
    xian: ['#c0c8c0', '#90b0b8', '#8890a0', '#1a1a2e', '#185870', '#808888', '#387068', '#509878', '#204838', '#103028'],
    owar: ['#988868', '#687868', '#685840', '#0a0a18', '#103838', '#684818', '#283820', '#386830', '#182810', '#101808'],
    luvi: ['#f0e0c0', '#c8e0d8', '#d0b8a0', '#1a1a2e', '#288080', '#d89040', '#60a050', '#88c870', '#408030', '#284820'],
  },
  owl: {
    base: ['#b3b7bd', '#e8d8b0', '#3a2818', '#1a1a2e', '#efebeb', '#f4d151', '#5a4830', '#a08048', '#6a5038', '#483020'],
    ajin: ['#c0a898', '#e8d0a0', '#382010', '#1a1a2e', '#f8f0e0', '#e8b840', '#604828', '#a88038', '#705028', '#503018'],
    xian: ['#98a0b0', '#c8d0c8', '#282838', '#1a1a2e', '#e8f0f8', '#b0b8c0', '#485060', '#788098', '#506070', '#384050'],
    owar: ['#686870', '#988868', '#1a1008', '#0a0a10', '#c0b8b0', '#988830', '#382818', '#605028', '#403018', '#281808'],
    luvi: ['#d0d0d8', '#f0e8c8', '#483828', '#1a1a2e', '#ffffff', '#f8e068', '#786038', '#c8a060', '#887048', '#604028'],
  },
  frog: {
    base: ['#1e5f59', '#ecdba0', '#16433c', '#1a1a2e', '#efebeb', '#d8a030', '#2a5a20', '#388828', '#1a4810', '#103008'],
    ajin: ['#387040', '#e8d090', '#284828', '#1a1a2e', '#f8f0e0', '#d09028', '#385818', '#488820', '#284010', '#182808'],
    xian: ['#285868', '#c8d0b8', '#183840', '#1a1a2e', '#e8f0f8', '#9098a0', '#204848', '#287858', '#184030', '#102820'],
    owar: ['#103830', '#a09060', '#0a2018', '#0a0a10', '#c0b8b0', '#886018', '#183010', '#204818', '#102808', '#081800'],
    luvi: ['#308070', '#f0e8b8', '#207050', '#1a1a2e', '#ffffff', '#f0c048', '#38782e', '#50b040', '#286818', '#184810'],
  },
  firefly: {
    base: ['#4b2a1e', '#e8c830', '#8d5020', '#010101', '#efebeb', '#d89020', '#88a8c0', '#505060', '#303038', '#202028'],
    ajin: ['#583020', '#e8b020', '#905028', '#010101', '#f8f0e0', '#d08018', '#a09878', '#585040', '#383028', '#282018'],
    xian: ['#382838', '#b0c8e0', '#604068', '#010101', '#e8f0f8', '#8098b0', '#7090b0', '#404858', '#282838', '#181828'],
    owar: ['#281810', '#a08818', '#583010', '#010101', '#c0b8b0', '#886010', '#586068', '#303038', '#181820', '#101018'],
    luvi: ['#604028', '#f8e048', '#b06828', '#010101', '#ffffff', '#f0b030', '#a8c8e0', '#686878', '#484050', '#383040'],
  },
  rabbit: {
    base: ['#e8d8c0', '#e8a0a8', '#5a4030', '#010101', '#efebeb', '#8a6040', '#f0f0e8', '#c8b8a0', '#a08868', '#786048'],
    ajin: ['#e8d0a8', '#e8a890', '#584028', '#010101', '#f8f0e0', '#906838', '#e8e0d0', '#c8b090', '#987850', '#705838'],
    xian: ['#c8c8d0', '#c0a0b8', '#404050', '#010101', '#e8f0f8', '#687078', '#e0e0e8', '#a8a8b8', '#787888', '#585868'],
    owar: ['#989080', '#886068', '#302018', '#010101', '#c0b8b0', '#584030', '#a0a098', '#888070', '#605848', '#403830'],
    luvi: ['#f0e8d0', '#f0b8c0', '#685040', '#010101', '#ffffff', '#a87858', '#f8f8f0', '#e0d0b8', '#b8a080', '#907858'],
  },
  hummingbird: {
    base: ['#d6dbd8', '#ffffff', '#183018', '#1a1a2e', '#d3c7a7', '#40c8a0', '#484838', '#288040', '#185028', '#103018'],
    ajin: ['#d8d0c0', '#fff8e0', '#282810', '#1a1a2e', '#d8c898', '#60b878', '#504830', '#389838', '#284818', '#183008'],
    xian: ['#c0c8d8', '#e8f0ff', '#101828', '#1a1a2e', '#b0b8c8', '#3098c0', '#383848', '#2070a0', '#184868', '#103050'],
    owar: ['#889088', '#c0c0b8', '#081008', '#0a0a18', '#888878', '#288068', '#282820', '#185028', '#103018', '#081808'],
    luvi: ['#e8f0e8', '#ffffff', '#284028', '#1a1a2e', '#e8e0c0', '#60e8c0', '#606850', '#40b060', '#287838', '#184828'],
  },
  bat: {
    base: ['#584868', '#c8b0d8', '#1a1028', '#1a1a2e', '#efebeb', '#8858a8', '#3a2848', '#483858', '#2a1838', '#1a1028'],
    ajin: ['#685848', '#d8c0b0', '#281810', '#1a1a2e', '#f8f0e0', '#906838', '#483028', '#584038', '#382018', '#281008'],
    xian: ['#404868', '#a0b0d0', '#101028', '#1a1a2e', '#e8f0f8', '#5868a0', '#282848', '#384058', '#201838', '#101028'],
    owar: ['#302830', '#887888', '#0a0810', '#0a0a10', '#c0b8b0', '#503858', '#181018', '#282028', '#180818', '#100810'],
    luvi: ['#786888', '#e0d0f0', '#282038', '#1a1a2e', '#ffffff', '#a878c8', '#483860', '#604870', '#382848', '#282038'],
  },
} as const

// ============================================
// Element tinting for evolved forms
// ============================================

// Element hue tints (subtle shift toward element color)
const ELEMENT_TINTS: Record<string, [number, number, number]> = {
  mana:  [0.65, 0.45, 0.75],  // purple tint
  storm: [0.40, 0.55, 0.80],  // blue tint
  earth: [0.70, 0.55, 0.30],  // brown/amber tint
  water: [0.30, 0.65, 0.65],  // teal tint
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

/** Auto-generate a tinted palette from base. Used as starting point before hand-painting. */
export function autoTintPalette(species: string, element: string): readonly string[] {
  const base = PALETTES[species]?.base
  if (!base) return PALETTES.fox.base
  const tint = ELEMENT_TINTS[element]
  if (!tint) return base

  const TINT_SLOTS = new Set([0, 1, 5, 6, 7, 8, 9]) // body + accent + evolution slots
  const blend = 0.2

  return base.map((hex, i) => {
    if (!TINT_SLOTS.has(i)) return hex
    const [r, g, b] = hexToRgb(hex)
    const tr = tint[0] * 255
    const tg = tint[1] * 255
    const tb = tint[2] * 255
    return rgbToHex(
      r + (tr - r) * blend,
      g + (tg - g) * blend,
      b + (tb - b) * blend,
    )
  })
}

/** Get palette for an evolved spirit. Prefers hand-painted over auto-tint. */
export function getEvolvedPalette(species: string, element: string): readonly string[] {
  // Check for hand-painted element palette first
  const handPainted = PALETTES[species]?.[element]
  if (handPainted) return handPainted
  // Fall back to auto-tint
  return autoTintPalette(species, element)
}

/** Get palette for a spirit by variant class. Falls back to base. */
export function getVariantPalette(species: string, variant: string): readonly string[] {
  return PALETTES[species]?.[variant] ?? PALETTES[species]?.base ?? PALETTES.fox.base
}
