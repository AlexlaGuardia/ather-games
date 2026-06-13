// Variant system — 4 universal classes that cascade through the evolution tree
// A spirit's variant class is set at birth and persists through all forms.
// Each class has its own palette per spirit, making every variant visually unique.
//
// The variant key selects which palette to use at render time.
// Evolution forms inherit the variant class (not the palette colors —
// each form has its own set of variant palettes since sprites are unique).

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type VariantClass = 'ajin' | 'xian' | 'owar' | 'luvi'

export const VARIANT_CLASSES: VariantClass[] = ['ajin', 'xian', 'owar', 'luvi']

export interface VariantClassDef {
  name: string
  rarity: Rarity
  description: string   // lore flavor
}

// Class definitions — universal across all species
export const VARIANT_CLASS_DEFS: Record<VariantClass, VariantClassDef> = {
  ajin:  { name: 'Ajin',  rarity: 'uncommon', description: 'Warm-blooded — golden and ember tones' },
  xian:  { name: 'Xian',  rarity: 'uncommon', description: 'Cold-forged — frost and steel tones' },
  owar:  { name: 'Owar',  rarity: 'rare',     description: 'Shadow-touched — deep and muted tones' },
  luvi:  { name: 'Luvi',  rarity: 'epic',     description: 'Light-born — luminous and ethereal tones' },
}

export interface VariantDef {
  rarity: Rarity
  encounterRate: number // percentage (0-100)
}

export type VariantConfig = Record<string, Record<string, VariantDef>>

// Default encounter rates — same for all species, tunable per species in editor
// base + 4 classes = 100%
// NOTE: must be literal objects (not function calls) so save-sprite regex parser can read them
export const VARIANT_CONFIG: VariantConfig = {
  fox: {
    base:   { rarity: 'common',    encounterRate: 100 },
    ajin:   { rarity: 'uncommon',  encounterRate: 0 },
    xian:   { rarity: 'uncommon',  encounterRate: 0 },
    owar:   { rarity: 'rare',      encounterRate: 0 },
    luvi:   { rarity: 'epic',      encounterRate: 0 },
  },
  axolotl: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  'water-bear': {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  turtle: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  owl: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  frog: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  firefly: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  rabbit: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  hummingbird: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
  bat: {
    base: { rarity: 'common',   encounterRate: 70 },
    ajin: { rarity: 'uncommon', encounterRate: 12 },
    xian: { rarity: 'uncommon', encounterRate: 10 },
    owar: { rarity: 'rare',     encounterRate: 5 },
    luvi: { rarity: 'epic',     encounterRate: 3 },
  },
}

/** Resolve any spirit ID to its base species for rate lookup.
 *  Lazy-imports grimoire to avoid circular deps. */
function resolveBaseSpecies(id: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEntry } = require('../spirits/grimoire')
    const entry = getEntry(id)
    return entry?.baseSpecies ?? id
  } catch {
    return id
  }
}

/** Roll a variant from encounter rates. Returns variant key ('base', 'ajin', etc.).
 *  Rates always come from the base species — evolution forms inherit. */
export function rollVariant(species: string, config: VariantConfig = VARIANT_CONFIG): string {
  const base = resolveBaseSpecies(species)
  const variants = config[base]
  if (!variants) return 'base'

  const roll = Math.random() * 100
  let cumulative = 0
  for (const [key, def] of Object.entries(variants)) {
    cumulative += def.encounterRate
    if (roll < cumulative) return key
  }
  return 'base'
}

/** Get variant rates for any spirit (resolves to base species). */
export function getVariantRates(species: string, config: VariantConfig = VARIANT_CONFIG): Record<string, VariantDef> | undefined {
  const base = resolveBaseSpecies(species)
  return config[base]
}

// Rarity display config
export const RARITY_COLORS: Record<Rarity, { bg: string; text: string; border: string }> = {
  common:    { bg: 'bg-white/5',       text: 'text-text-dim',    border: 'border-white/10' },
  uncommon:  { bg: 'bg-green-500/10',  text: 'text-green-400',   border: 'border-green-500/20' },
  rare:      { bg: 'bg-blue-500/10',   text: 'text-blue-400',    border: 'border-blue-500/20' },
  epic:      { bg: 'bg-violet-500/10', text: 'text-violet-400',  border: 'border-violet-500/20' },
  legendary: { bg: 'bg-gold/10',       text: 'text-gold',        border: 'border-gold/20' },
}

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
