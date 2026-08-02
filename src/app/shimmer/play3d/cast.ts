// cast.ts — birth-rune v2: the castable "word". Maps a rune → its cast spec (archetype + numbers +
// look). Phase 1 implements the PROJECTILE archetype (the 8 offense runes); ward/restore/surge are
// tagged but not yet built (later phases). CANON: CANON/game/shimmer-birth-rune.md — offense runes
// are the ones whose damage identity lands here in v2 (their v1 affinity was a +mana placeholder).
//
// Boundary: which archetype a rune is = canon (from the essence→lean table). The numbers below are
// Jin's to tune. Phase-1 offense is deliberately uniform (per-rune COLOR only); per-rune damage/feel
// variance (Magma heavy+slow, Lightning fast+light, Freeze burst) is a follow-on tune.

import { RUNES } from './birth/runes.data'

export type CastArchetype = 'projectile' | 'ward' | 'restore' | 'surge' | 'none'

export interface CastSpec {
  archetype: CastArchetype
  manaCost: number
  cooldownMs: number
  damage: number      // projectile: HP removed per hit
  projSpeed: number   // world units / sec
  projLife: number    // seconds before it fizzles
  glow: string        // projectile color (from the rune's canon Visual)
  core: string        // bright inner color
  label: string       // rune name, for HUD/feedback
}

// Lean → archetype, straight from CANON/game/shimmer-birth-rune.md.
const OFFENSE = new Set(['star', 'tempest', 'lightning', 'magma', 'freeze', 'hydro', 'dust', 'static'])
const WARD = new Set(['barrier', 'stone'])
const RESTORE = new Set(['life'])
const SURGE = new Set(['breeze', 'fluid'])

// Phase-1 projectile numbers (uniform; tune freely — canon only fixes the archetype).
const PROJ = { manaCost: 8, cooldownMs: 700, damage: 16, projSpeed: 44, projLife: 1.4 }

const NONE: CastSpec = { archetype: 'none', manaCost: 0, cooldownMs: 0, damage: 0, projSpeed: 0, projLife: 0, glow: '#a9d0f5', core: '#ffffff', label: '' }

/** Resolve a birth rune id to its cast spec. Non-offense runes return their archetype tag with no
 *  phase-1 effect (archetype !== 'projectile' → the cast is a no-op until that archetype ships). */
export function runeCast(runeId: string | null | undefined): CastSpec {
  if (!runeId) return NONE
  const rune = RUNES.find(r => r.id === runeId)
  const glow = rune?.glow ?? NONE.glow
  const core = rune?.core ?? NONE.core
  const label = rune?.name ?? ''
  if (OFFENSE.has(runeId)) return { archetype: 'projectile', ...PROJ, glow, core, label }
  if (WARD.has(runeId)) return { ...NONE, archetype: 'ward', glow, core, label }
  if (RESTORE.has(runeId)) return { ...NONE, archetype: 'restore', glow, core, label }
  if (SURGE.has(runeId)) return { ...NONE, archetype: 'surge', glow, core, label }
  return { ...NONE, glow, core, label }  // utility runes stay passive (their v1 affinity)
}
