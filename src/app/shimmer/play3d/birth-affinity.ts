// birth-affinity.ts — the always-on affinity LEAN granted by a keeper's BIRTH RUNE.
//
// ⚠ CALLED A "LEAN", NEVER A "PASSIVE" — RULED 2026-08-25 (Alex + /magii), and the word is the
// whole point. In canon a **passive** is a specific thing: a learned, advanced, elite MOVE
// (`runes.md:253-257`), held in one of three innate sockets, and **holding it pauses mana
// recovery**. This file is not that. It is a permanent stat lean that costs nothing, cannot be
// switched off, and needs no socket — which is precisely why it can be always-on without touching
// the double edge the mana economy rests on. Alex ruled it stays a **background mechanic**; the
// idea of surfacing it in the inventory's rune tab is on GBOARD, not built.
// ★ This file is why the ruling was free: the always-on birth-rune thing already existed and
// already shipped, covering all 20 runes with no authoring debt and no retcon.
//
// CANON: CANON/game/shimmer-birth-rune.md ("your birth rune is you"). Each rune's lean follows
// its canon ESSENCE (runes.md); this file is the build-side numbers for that lean. The category
// per rune is canon (Magii); the magnitudes here are Jin's to tune (see the boundary in the
// canon file). v1 = the affinity lean; v2 = the same rune becomes a castable "word" (offense
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

// ── The READOUT: what a player is shown about their own lean ───────────────────────────────────
//
// These two live HERE, beside the table they read, rather than in the panel that renders them.
// A UI that strips its own essence line with its own regex, or keeps its own list of which stat each
// lean touches, is a hand-written reader over a file it does not own — this repo's most-repeated bug
// (a rewrite whose pattern stops matching returns the input UNCHANGED and throws nothing, so the
// screen just quietly says the wrong thing). One definition, asked by both the panel and the oracle.

/**
 * The essence half of a lean's label — the CANON statement of what the rune is, with the build-side
 * "(+harvest yield)" tail removed because the panel renders the magnitudes itself.
 *
 * ⚠ Returns the label UNCHANGED when there is no tail, which is the honest outcome: the caller gets
 * a real sentence either way. The oracle asserts the strip actually leaves something, so a label
 * shape that this pattern would eat whole fails a test instead of blanking a panel.
 */
export function essenceOf(aff: Affinity): string {
  return aff.label.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/**
 * Every stat this affinity actually moves, phrased for a player, DERIVED by diffing against neutral
 * rather than switching on `lean`. Retune a rune to grant two things and both appear here with
 * nothing else edited; zero a magnitude and the list goes empty, which the oracle catches.
 */
export function leanEffects(aff: Affinity): string[] {
  const n = NEUTRAL_AFFINITY
  const sign = (d: number) => (d > 0 ? '+' : '')
  const out: string[] = []
  if (aff.hpBonus !== n.hpBonus) out.push(`${sign(aff.hpBonus - n.hpBonus)}${aff.hpBonus - n.hpBonus} max health`)
  if (aff.shieldBonus !== n.shieldBonus) out.push(`${sign(aff.shieldBonus - n.shieldBonus)}${aff.shieldBonus - n.shieldBonus} max shield`)
  if (aff.manaBonus !== n.manaBonus) out.push(`${sign(aff.manaBonus - n.manaBonus)}${aff.manaBonus - n.manaBonus} max mana`)
  if (aff.speedMult !== n.speedMult) out.push(`${sign(aff.speedMult - n.speedMult)}${Math.round((aff.speedMult / n.speedMult - 1) * 100)}% move speed`)
  if (aff.gatherMult !== n.gatherMult) out.push(`${sign(aff.gatherMult - n.gatherMult)}${Math.round((aff.gatherMult / n.gatherMult - 1) * 100)}% harvest yield`)
  return out
}
