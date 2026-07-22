// Potion drink effects — what a brewed bottle DOES. One source of truth for all 13 potions:
// instant restores (mana/HP/shield), the instant crop-advance, and the timed cozy buffs.
// Before this file, 9 of the 13 POTION_DEFS were brew-for-XP dead ends (all of tier 3/4 and
// every crop-based potion) — the gather→brew loop never paid off. Now every bottle matters.
//
// Pure + time-based (pass nowMs), mirrors rinning.ts — testable without the DOM. The walker
// owns the ActiveBuffs record (a ref) and drives everything from its tick loop.
//
// Effect NAMES/flavor lean on the potions' canon names; magnitudes/durations are build-side
// feel dials (Jin's lane, per SHIMMER-CANON-BOUNDARY) — tune them at the top of this file.

// ── feel dials ─────────────────────────────────────────────────────────────────────────────
export const FLEETFOOT_SPEED = 1.12    // moonvine_tonic — ground speed mult (matches slide-hop's ×1.12 feel step)
export const ANGLER_BITE = 0.5         // glowfin_brew — bites land this × sooner…
export const ANGLER_WINDOW = 2         // …and the `!` window stays up this × longer
export const KINDRED_MULT = 2          // bond_philter — companion @15 assist bonus ×2
export const STARLIGHT_XP = 1.5        // starlight_tincture — gathering XP mult (forestry/prospecting/rinning/farming)
export const DEEPSIGHT_FIND = 0.15     // deep_essence — flat bonus-find chance added to every gather
export const ATHER_REGEN = 10          // ather_infusion — mana regen ×10 (1/min → 1 per 6s: a felt trickle)
export const DAWN_XP = 1.25            // dawn_cordial — the master's brew: a broad, gentle everything-lift
export const DAWN_FIND = 0.10
export const DAWN_SPEED = 1.06
export const HARVEST_BREW_ADVANCE_MS = 3 * 60_000  // harvest_brew — planted crops jump 3 min of growth

export type BuffId =
  | 'fleetfoot'   // moonvine_tonic    — move speed
  | 'anglers_eye' // glowfin_brew      — rinning bites sooner + wider window
  | 'kindred'     // bond_philter      — companion assist doubled
  | 'starlight'   // starlight_tincture— gathering XP up
  | 'deepsight'   // deep_essence      — bonus-find on gathers
  | 'dreamwalk'   // dreamroot_elixir  — wild spirits stay calm (no mist encounters)
  | 'ather_flow'  // ather_infusion    — mana regen up
  | 'dawn'        // dawn_cordial      — small XP + find + speed lift, long

/** buffId → untilMs (epoch). Drinking the same potion refreshes, never stacks. */
export type ActiveBuffs = Record<string, number>

export const BUFF_DEFS: Record<BuffId, { name: string; glyph: string; color: string; durationMs: number; line: string }> = {
  fleetfoot:   { name: 'Fleetfoot',     glyph: '🌿', color: '#8fd06a', durationMs: 6 * 60_000,  line: `move +${Math.round((FLEETFOOT_SPEED - 1) * 100)}% · 6m` },
  anglers_eye: { name: "Angler's Eye",  glyph: '🎣', color: '#6ac6d0', durationMs: 8 * 60_000,  line: 'bites come sooner, linger longer · 8m' },
  kindred:     { name: 'Kindred',       glyph: '🐾', color: '#d0a86a', durationMs: 8 * 60_000,  line: `companion assist ×${KINDRED_MULT} · 8m` },
  starlight:   { name: 'Starlight',     glyph: '✨', color: '#c8b8ff', durationMs: 8 * 60_000,  line: `gathering XP ×${STARLIGHT_XP} · 8m` },
  deepsight:   { name: 'Deepsight',     glyph: '🔮', color: '#8a9fe6', durationMs: 8 * 60_000,  line: `+${Math.round(DEEPSIGHT_FIND * 100)}% bonus finds · 8m` },
  dreamwalk:   { name: 'Dreamwalk',     glyph: '🌙', color: '#b08ae6', durationMs: 8 * 60_000,  line: 'wild spirits stay calm · 8m' },
  ather_flow:  { name: 'Ather Flow',    glyph: '◈',  color: '#4aa3e6', durationMs: 10 * 60_000, line: `mana regen ×${ATHER_REGEN} · 10m` },
  dawn:        { name: 'Dawn',          glyph: '🌅', color: '#ffd98a', durationMs: 15 * 60_000, line: 'XP · finds · speed, all lifted · 15m' },
}

/** potionId → the timed buff drinking it grants. */
export const POTION_BUFFS: Record<string, BuffId> = {
  moonvine_tonic: 'fleetfoot',
  glowfin_brew: 'anglers_eye',
  bond_philter: 'kindred',
  starlight_tincture: 'starlight',
  deep_essence: 'deepsight',
  dreamroot_elixir: 'dreamwalk',
  ather_infusion: 'ather_flow',
  dawn_cordial: 'dawn',
}

// Instant restores — moved here from the walker (2026-07-22) so every drink effect lives in one
// file. Amounts are the feel knob; only ids listed are drinkable for that resource.
// Mana: canon economy (see project_shimmer_mana_economy) — potions ARE the refill.
export const MANA_POTIONS: Record<string, number> = { mana_draught: 40, shard_tonic: 65 }
// Mend: HP/shield do NOT regen in outside-Ather combat; these are the only way back up.
export const HEAL_POTIONS: Record<string, { hp?: number; sh?: number }> = {
  shimmer_salve: { hp: 50 },
  crystal_elixir: { sh: 75 },
}

/** One-line "what drinking does" for the Alchemy menu — covers all 13 potions. */
export function potionEffectLine(potionId: string): string | null {
  const buff = POTION_BUFFS[potionId]
  if (buff) return BUFF_DEFS[buff].line
  if (potionId in MANA_POTIONS) return `restores ${MANA_POTIONS[potionId]} mana`
  const heal = HEAL_POTIONS[potionId]
  if (heal) return heal.hp ? `mends +${heal.hp} HP (outside the Ather)` : `re-forms +${heal.sh} shield (outside the Ather)`
  if (potionId === 'harvest_brew') return 'planted crops jump 3m of growth'
  return null
}

/** Drink a buff potion: set/refresh its timer. Returns the buff granted, or null if not a buff potion. */
export function drinkBuff(buffs: ActiveBuffs, potionId: string, nowMs: number): BuffId | null {
  const id = POTION_BUFFS[potionId]
  if (!id) return null
  buffs[id] = nowMs + BUFF_DEFS[id].durationMs
  return id
}

export function hasBuff(buffs: ActiveBuffs, id: BuffId, nowMs: number): boolean {
  return (buffs[id] ?? 0) > nowMs
}

/** The live buffs, soonest-to-expire last — feed the HUD chips. */
export function activeBuffList(buffs: ActiveBuffs, nowMs: number): { id: BuffId; name: string; glyph: string; color: string; remainMs: number }[] {
  return (Object.keys(BUFF_DEFS) as BuffId[])
    .filter(id => hasBuff(buffs, id, nowMs))
    .map(id => ({ id, name: BUFF_DEFS[id].name, glyph: BUFF_DEFS[id].glyph, color: BUFF_DEFS[id].color, remainMs: buffs[id] - nowMs }))
    .sort((a, b) => b.remainMs - a.remainMs)
}

/** Drop expired entries (save hygiene — keeps the persisted record tiny). */
export function pruneBuffs(buffs: ActiveBuffs, nowMs: number): ActiveBuffs {
  const out: ActiveBuffs = {}
  for (const [k, v] of Object.entries(buffs)) if (v > nowMs) out[k] = v
  return out
}

// ── the multipliers the walker reads at its hook points ────────────────────────────────────
export function gatherXpMult(buffs: ActiveBuffs, nowMs: number): number {
  return (hasBuff(buffs, 'starlight', nowMs) ? STARLIGHT_XP : 1) * (hasBuff(buffs, 'dawn', nowMs) ? DAWN_XP : 1)
}
/** Flat bonus-find chance ADDED on top of the companion's perk. */
export function bonusFind(buffs: ActiveBuffs, nowMs: number): number {
  return (hasBuff(buffs, 'deepsight', nowMs) ? DEEPSIGHT_FIND : 0) + (hasBuff(buffs, 'dawn', nowMs) ? DAWN_FIND : 0)
}
/** Multiplier on the companion's OWN assist bonus (bond_philter deepens the bond). */
export function kindredMult(buffs: ActiveBuffs, nowMs: number): number {
  return hasBuff(buffs, 'kindred', nowMs) ? KINDRED_MULT : 1
}
export function speedMult(buffs: ActiveBuffs, nowMs: number): number {
  return (hasBuff(buffs, 'fleetfoot', nowMs) ? FLEETFOOT_SPEED : 1) * (hasBuff(buffs, 'dawn', nowMs) ? DAWN_SPEED : 1)
}
export function manaRegenMult(buffs: ActiveBuffs, nowMs: number): number {
  return hasBuff(buffs, 'ather_flow', nowMs) ? ATHER_REGEN : 1
}
/** Scale factors for a fresh rin cast: {bite, window}. */
export function rinTune(buffs: ActiveBuffs, nowMs: number): { bite: number; window: number } {
  return hasBuff(buffs, 'anglers_eye', nowMs) ? { bite: ANGLER_BITE, window: ANGLER_WINDOW } : { bite: 1, window: 1 }
}
export function suppressEncounters(buffs: ActiveBuffs, nowMs: number): boolean {
  return hasBuff(buffs, 'dreamwalk', nowMs)
}
