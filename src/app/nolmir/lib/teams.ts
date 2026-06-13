// THE CHALLENGER ROSTER — who answers the beacon.
// A team is a DOCUMENT (multiplayer-shaped, like everything here): name,
// comp, temperament, tier. The sim never knows whether a roster doc was
// hand-authored, generated, or — someday — another player's raid squad.
//
// Every team fields the same trinity: a LEAD (the anchor — the squad holds
// formation around them), a TANK (the wall), a HEALER (the reason fights
// last). Kill the lead and the team breaks. Kill the healer and they wilt.

import { Rng } from './rng'

export type Temperament = 'reckless' | 'cautious' | 'balanced'
export type Role = 'lead' | 'tank' | 'healer'

export interface TeamDoc {
  id: string
  name: string
  tier: 1 | 2 | 3
  temperament: Temperament
  line: string // flavor — toasts and ledger color
  // the curated comp — three profile ids, ALIGNED TO TEAM_COMP order
  // [tank, lead, healer]. The same creatures you field as guards answer the
  // beacon as challengers (slice 5). Authored category→slot: a bulwark walls
  // (tank), a vanguard anchors (lead), a sustain mends (healer). The roster's
  // lone sustain (Rime) fills every healer slot today — the coverage gap a new
  // mender will close (see profiles.ts CATEGORY_FORMATION).
  members: [string, string, string]
}

export const ROSTER: TeamDoc[] = [
  // tier 1 — the hungry and the lost
  { id: 'ash-pilgrims', name: 'Ash Pilgrims', tier: 1, temperament: 'cautious', line: 'they walk in, praying', members: ['bastion', 'lancer', 'rime'] },
  { id: 'gutter-kin', name: 'Gutter Kin', tier: 1, temperament: 'reckless', line: 'nothing to lose, and it shows', members: ['bastion', 'maw', 'suture'] },
  { id: 'pale-sworn', name: 'Pale Sworn', tier: 1, temperament: 'balanced', line: 'oath-bound, unproven', members: ['bastion', 'lancer', 'suture'] },
  { id: 'rust-chorus', name: 'Rust Chorus', tier: 1, temperament: 'reckless', line: 'they sing going in', members: ['throe', 'maw', 'rime'] },
  // tier 2 — the ones who came back
  { id: 'vein-reavers', name: 'Vein Reavers', tier: 2, temperament: 'reckless', line: 'they have tasted a vault before', members: ['throe', 'maw', 'rime'] },
  { id: 'cinder-wards', name: 'Cinder Wards', tier: 2, temperament: 'cautious', line: 'burned once. never again', members: ['bastion', 'lancer', 'suture'] },
  { id: 'hollow-vanguard', name: 'Hollow Vanguard', tier: 2, temperament: 'balanced', line: 'veterans of three dead nodes', members: ['throe', 'lancer', 'suture'] },
  // tier 3 — the ones other crucibles whisper about
  { id: 'sunder-court', name: 'Sunder Court', tier: 3, temperament: 'balanced', line: 'they fight like it is bookkeeping', members: ['throe', 'sear', 'rime'] },
  { id: 'last-light', name: 'Last Light', tier: 3, temperament: 'cautious', line: 'no one has seen their healer fall', members: ['bastion', 'sear', 'bloom'] },
  { id: 'mawkind', name: 'Mawkind', tier: 3, temperament: 'reckless', line: 'the beacon did not call them. they heard anyway', members: ['throe', 'maw', 'bloom'] },
]

// ---- unlocks — louder crucibles draw harder challengers ----
// Tier gates ride HEAT (how bright the forge burns on whatever senses
// these things — see forgeHeat) and total exp (the crucible's history).

import { HEAT_TIER_2, HEAT_TIER_3 } from './starforge'

export function unlockedTier(progress: { heat: number; exp: number }): 1 | 2 | 3 {
  if (progress.heat >= HEAT_TIER_3 || progress.exp >= 9000) return 3
  if (progress.heat >= HEAT_TIER_2 || progress.exp >= 1500) return 2
  return 1
}

// seeded pick of distinct teams for a match — higher tiers shoulder in
// once unlocked, but the hungry keep coming
export function pickTeams(rng: Rng, maxTier: number, count: number): TeamDoc[] {
  const pool = ROSTER.filter((t) => t.tier <= maxTier)
  const weighted: TeamDoc[] = []
  for (const t of pool) {
    // weight: a team at the frontier tier appears ~2x a tier-1 stalwart
    const w = t.tier === maxTier ? 2 : 1
    for (let i = 0; i < w; i++) weighted.push(t)
  }
  const picked: TeamDoc[] = []
  let guard = 0
  while (picked.length < count && guard++ < 200) {
    const t = weighted[Math.floor(rng() * weighted.length)]
    if (!picked.some((p) => p.id === t.id)) picked.push(t)
  }
  // pad if the pool ran dry (never should — roster > MAX_TEAMS per tier)
  for (const t of pool) {
    if (picked.length >= count) break
    if (!picked.some((p) => p.id === t.id)) picked.push(t)
  }
  return picked
}

// ---- role stat blocks — the trinity, rolled per fighter ----

export interface RoleStats {
  hpMin: number
  hpMax: number
  atkMin: number
  atkMax: number
  speedMin: number // tiles per tick — a smooth rate (0.33 ≈ the old 3-ticks-per-step)
  speedMax: number
  ranged: boolean
}

export const ROLE_STATS: Record<Role, RoleStats> = {
  tank: { hpMin: 115, hpMax: 145, atkMin: 5, atkMax: 8, speedMin: 0.25, speedMax: 0.33, ranged: false },
  // the lead leads from the FRONT — melee captain, the anchor walks point
  lead: { hpMin: 80, hpMax: 100, atkMin: 7, atkMax: 10, speedMin: 0.34, speedMax: 0.5, ranged: false },
  healer: { hpMin: 60, hpMax: 80, atkMin: 2, atkMax: 4, speedMin: 0.34, speedMax: 0.5, ranged: true },
}

// tier is finally a threat, not a name — the whispered-about hit harder,
// last longer, and arrive a half-step quicker
export function tierMults(tier: 1 | 2 | 3): { hp: number; atk: number; speed: number } {
  if (tier === 3) return { hp: 1.2, atk: 1.2, speed: 1.08 }
  if (tier === 2) return { hp: 1.1, atk: 1.1, speed: 1.04 }
  return { hp: 1, atk: 1, speed: 1 }
}

// ---- challenger level (slice 5) — the shared level axis on the enemy side ----
// Mirrors a guard's level curve, but a challenger's level is HEAT-driven (the
// crucible draws stronger answers as it burns louder), not grind-earned.
//
// SHIPPED OFF (CHALLENGER_HEAT_PER_LEVEL = 0): the heat-379 vault economy is
// under watch, and beefier challengers raise the vault-fall rate. The mechanism
// is in place — set CHALLENGER_HEAT_PER_LEVEL to e.g. 200 (and a CAP) to turn on
// heat-scaled challengers once the economy read is in. At 0, level is always 1
// and stats are IDENTICAL to before — slice 5 is a pure identity/architecture
// unification, no balance change.
export const CHALLENGER_LEVEL_STAT = 0.04 // mirrors starforge LEVEL_STAT
export const CHALLENGER_HEAT_PER_LEVEL = 0 // 0 = off; >0 = heat per +1 level
export const CHALLENGER_LEVEL_CAP = 6

export function challengerLevel(heat: number): number {
  if (CHALLENGER_HEAT_PER_LEVEL <= 0) return 1
  return 1 + Math.min(CHALLENGER_LEVEL_CAP, Math.floor(Math.max(0, heat) / CHALLENGER_HEAT_PER_LEVEL))
}

export function challengerLevelMult(heat: number): number {
  return 1 + CHALLENGER_LEVEL_STAT * (challengerLevel(heat) - 1)
}

// spawn order — tank steps out first, lead holds the middle, healer trails
export const TEAM_COMP: Role[] = ['tank', 'lead', 'healer']

// retreat thresholds by temperament (share of max hp; reckless never runs)
export function retreatBelow(t: Temperament): number {
  if (t === 'cautious') return 0.4
  if (t === 'balanced') return 0.25
  return 0
}
