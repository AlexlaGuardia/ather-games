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

// ── ★★★ FACET 4 — ATTUNEMENT RESISTANCE (canon `shimmer-birth-rune.md` § v3, 2026-08-26) ─────────
//
// *"A thing is not readily unmade by the substance it is made of."* A keeper carries a modest
// standing resistance to what they are born of — Star-born are hard to burn, Freeze-born hard to
// chill, Stone-born hard to crush.
//
// ⚠⚠ **THIS CANNOT FIRE YET, AND THAT IS WHY IT IS WRITTEN THIS WAY.** Measured 2026-08-26 before
// building: **no damage source in the shipped game declares an element or a rune.** play3d's
// `hurtPlayer` takes a bare number from a firing-range drone and from Wren's reflected shot; the
// voxel world routes moglin posture through `pressure()`, which never wounds by design; no foe
// module carries an `element` field; and `vitals.damage()` has no production caller at all. The
// input this rule consumes does not exist until real-time world enemies CAST (focus row 294 — written
// WITHOUT a leading hash on purpose: `tokens.test.ts` finds colour-bearing files by scanning for a
// hash followed by three to eight hex characters, and a three-digit row number written that way IS
// a valid short hex colour — so the citation alone files a pure logic module as colour-bearing and
// fails that guard. ⚠ This note is deliberately phrased with no such token in it either: the first
// draft explained the trap by quoting it, which re-armed it one line below the fix. Documenting a
// marker creates a marker.)
// It is built as a pure rule with the wiring point in place so the first casting foe lights it up,
// and it is said out loud here rather than left for someone to discover it never ran.
//
// ⛔ **NO WEAKNESS MATRIX. NO COUNTER-WHEEL.** Canon is emphatic: there is no element a birth rune
// is vulnerable to, the system is Element × State and not a type chart, and a wheel would be a real
// invention. This function returns a resistance or zero. It never returns a penalty, and the guard
// asserts that it cannot.

/**
 * ⚠ **KEYED ON THE RUNE, NOT THE ELEMENT AXIS — flagged to Magii, deliberately not guessed silently.**
 *
 * The canon prose says *"their own birth **element**"*, but all three of its own worked examples name
 * the RUNE's substance: Star is `mana`/Ignite, and "hard to burn" does not follow from the mana
 * element (which also holds Life and Barrier) — it follows from Star being the fire rune. Freeze
 * (`water`/Solid) → chill and Stone (`earth`/Solid) → crush read the same way, and the three name
 * three different elements. Canon's four Elements are Mana/Storm/Earth/Water, so "birth element"
 * there is the everyday sense of the word, not this build's `element` axis.
 *
 * Keying on the rune satisfies every example and is the NARROWER reading, which is the safe
 * direction for a resistance: it under-applies rather than over-applies. Sent to Magii to rule.
 * If they rule the element axis instead, this is a one-line change — and it costs nothing today,
 * because nothing can fire it (see above).
 */
export const SELF_ATTUNEMENT_RESIST = 0.25

/**
 * The fraction of an incoming hit a keeper shrugs off because it is their own attunement.
 * `0` for everything else — including an untyped source, which today is every source.
 *
 * Magnitude is Jin's (canon fixes only that it exists and is self-only). 0.25 is *"this costs me
 * less than it costs you"*, never *"this cannot touch me"* — Veyra shapes fire barehanded and is
 * still a woman who can burn.
 */
export function attunementResist(birth: string | null | undefined, sourceRune: string | null | undefined): number {
  if (!birth || !sourceRune) return 0
  return birth === sourceRune ? SELF_ATTUNEMENT_RESIST : 0
}

/**
 * Fold two 0..1 resistances into one.
 *
 * ★ MULTIPLICATIVE, AND THAT IS THE RULE CARRYING CANON'S "NEVER IMMUNITY" RATHER THAN A COMMENT
 * ASKING FOR IT. Added, Bulwark (0.55) plus attunement (0.25) is 0.80 and a third source would
 * cross 1.0 into healing-from-damage. Folded as `1 - (1-a)(1-b)` the result approaches 1 and can
 * only REACH it if one input is already a total immunity — so canon's ceiling is a property of the
 * arithmetic, not something every future call site has to remember to clamp.
 */
export function combineResist(a: number, b: number): number {
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  return 1 - (1 - clamp(a)) * (1 - clamp(b))
}
