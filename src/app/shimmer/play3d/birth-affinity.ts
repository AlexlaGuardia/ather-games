// birth-affinity.ts — v1 passive affinity granted by a keeper's BIRTH RUNE.
//
// CANON: CANON/game/shimmer-birth-rune.md ("your birth rune is you"). Each rune's lean follows
// its canon ESSENCE (runes.md); this file is the build-side numbers for that lean. The category
// per rune is canon (Magii); the magnitudes here are Jin's to tune (see the boundary in the
// canon file). v1 = passive affinity; v2 = the same rune becomes a castable "word" (offense
// runes get their damage identity there — in v1 they carry raw magical charge instead).

export type AffinityLean = 'vitality' | 'defense' | 'mobility' | 'utility' | 'offense'

export interface Affinity {
  /** flat bonus to max HP (vitality) */
  hpBonus: number
  /** flat bonus to max shield (defense) */
  shieldBonus: number
  /** ground-speed multiplier (mobility) */
  speedMult: number
  /** harvest find/yield multiplier (utility) */
  gatherMult: number
  /** flat bonus to the max mana pool (offense v1 proxy: raw charge; damage lands in v2) */
  manaBonus: number
  /** the lean category (from the canon table) */
  lean: AffinityLean
  /** short player-facing line, shown on the birth summary */
  label: string
}

// v1 magnitudes — deliberately gentle; a lean, not a power spike. Tune freely (canon only fixes
// the category, not the number).
const HP = 25
const SHIELD = 25
const SPEED = 1.08
const GATHER = 1.15
const MANA = 20

const NONE: Omit<Affinity, 'lean' | 'label'> = { hpBonus: 0, shieldBonus: 0, speedMult: 1, gatherMult: 1, manaBonus: 0 }

const vitality = (label: string): Affinity => ({ ...NONE, hpBonus: HP, lean: 'vitality', label })
const defense = (label: string): Affinity => ({ ...NONE, shieldBonus: SHIELD, lean: 'defense', label })
const mobility = (label: string): Affinity => ({ ...NONE, speedMult: SPEED, lean: 'mobility', label })
const utility = (label: string): Affinity => ({ ...NONE, gatherMult: GATHER, lean: 'utility', label })
const offense = (label: string): Affinity => ({ ...NONE, manaBonus: MANA, lean: 'offense', label })

// Per-rune lean — transcribed from CANON/game/shimmer-birth-rune.md's essence→lean table.
// Keys are rune ids from birth/runes.data.ts.
const AFFINITY: Record<string, Affinity> = {
  // Mana
  manalic:  utility('Manalic — a builder’s hands (+harvest yield)'),
  barrier:  defense('Barrier — a second skin (+shield)'),
  star:     offense('Star — a sun in your chest (+magical charge)'),
  life:     vitality('Life — a sturdier constitution (+health)'),
  enchant:  utility('Enchant — magic bound to matter (+harvest yield)'),
  // Storm
  lightning: offense('Lightning — a jolt in the spine (+magical charge)'),
  tempest:   offense('Tempest — rage given form (+magical charge)'),
  breeze:    mobility('Breeze — weightless on your feet (+move speed)'),
  static:    offense('Static — charge that gathers (+magical charge)'),
  illuminate: utility('Illuminate — a noticing knack (+harvest yield)'),
  // Earth
  stone:     defense('Stone — you hold your ground (+shield)'),
  gem:       utility('Gem — a crystalline eye (+harvest yield)'),
  magma:     offense('Magma — molten and unstoppable (+magical charge)'),
  dust:      offense('Dust — a thousand cuts (+magical charge)'),
  metalergy: utility('Metalergy — the metal knows you (+harvest yield)'),
  // Water
  freeze:    offense('Freeze — sharp and unforgiving (+magical charge)'),
  hydro:     offense('Hydro — a punch, not a splash (+magical charge)'),
  mist:      utility('Mist — a presence you sense first (+harvest yield)'),
  fluid:     mobility('Fluid — you move like water (+move speed)'),
  vapor:     utility('Vapor — the quiet support (+harvest yield)'),
}

/** The neutral affinity — no birth rune (legacy save, or private-mode where nothing was stored). */
export const NEUTRAL_AFFINITY: Affinity = { ...NONE, lean: 'utility', label: '' }

/** Resolve a birth rune id to its v1 affinity. Unknown/null id → neutral (no effect). */
export function birthAffinity(runeId: string | null | undefined): Affinity {
  if (!runeId) return NEUTRAL_AFFINITY
  return AFFINITY[runeId] ?? NEUTRAL_AFFINITY
}
