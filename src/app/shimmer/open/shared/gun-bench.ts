// M150 s5 (Alex 11-27): THE GUN BENCH's GAMEPLAY dials and its bench-only guns. PURE (no three, no react).
// "let's be sure all guns in the bench have sliders to not only tune the fire rate but the dimensions of the gun too": the fire rate is
// the tuner's rhythm dials (fp-gun setRhythm); this file is the rest of a gun's numbers (damage a round, crit, pellets, burst, round
// speed, charge, clip, reload), saved per gun to this browser and copied with "Copy values". ⚠ BENCH ONLY: the game never reads these
// stats (the tuner's Fire preview and its read-out do); a number goes live when Jin bakes it into gunplay.ts on Alex's word.
import { RANGE_GUNS, BACKBONE_DAMAGE, M177_SPEED, type RangeGun } from './gunplay'
import { TWINS_GUN } from './twins-sim'

/** M9 GRINDER (canon game/weapons.md › Models, Magii 842ef49, Alex 11-27: "a third full auto long gun with a slower fire rate but higher
 *  damage per bullet"): a full-auto longbarrel. BENCH ONLY (no player holds it until Alex says). Numbers = build (Jin), Alex tunes:
 *  0.22 s a round held (the Backbone's average is 0.21 s a round, 0.09 inside a burst) at 13.5 a round (1.3x the Backbone's 10.4) =
 *  61.4 a second held: above the Backbone's 49.5, under the Spitter's 63.6 and the Roar's 78.8 point blank (the band). 1.6x the
 *  Backbone (16.6) at 0.22 s would be 75.6 a second, a Roar at range, so it starts at 1.3x; the damage dial goes to 1.6x and past. */
export const GRINDER_DAMAGE = 13.5
export const GRINDER_GUN: RangeGun = {
  id: 'grinder', name: 'M9 GRINDER', slot: 'LONGBARREL', auto: true,
  fireCd: 0.22, projSpeed: M177_SPEED.backbone, projLife: 92 / M177_SPEED.backbone,   // the Backbone's reach (46 m/s x 2.0 s)
  damage: GRINDER_DAMAGE, crit: Math.round(GRINDER_DAMAGE * 19 / 12 * 10) / 10, clip: 40, reloadTime: 2.2, reloadMana: 13,
  hipSpread: 2.0, adsSpread: 0.22, bloomPerShot: 0.32, bloomMax: 3.0, bloomDecay: 5, adsBloomScale: 0.4, kickPitch: 0.014, kickYaw: 0.006,
  converge: 40, headR: 0.08, trailR: 0.065, hipMove: 0.76, adsMove: 0.46,
  burst: 1, burstGap: 0, pellets: 1, shove: 0.08, color: '#8a7650',
}
/** every gun on the bench: the range's, then the bench-only Twins (M152) and Grinder */
export const BENCH_GUNS: RangeGun[] = [...RANGE_GUNS, TWINS_GUN, GRINDER_GUN]
export const BENCH_ONLY_GUNS = new Set(['twins', 'grinder'])
/** the Backbone's damage, for the read-out's "x the Backbone" */
export const benchVsBackbone = (g: RangeGun) => g.damage / BACKBONE_DAMAGE

export interface GunStats { damage: number; crit: number; pellets: number; burst: number; projSpeed: number; charge: number; clip: number; reloadTime: number }
export type StatKey = keyof GunStats
/** `only`: the dial shows only on a gun that has the feature (pellets on a shell gun, burst on a burst gun, charge on a charged gun) */
export const STAT_DIALS: { k: StatKey; label: string; min: number; max: number; step: number; only?: (g: RangeGun) => boolean }[] = [
  { k: 'damage', label: 'damage a round', min: 1, max: 80, step: 0.1 },
  { k: 'crit', label: 'head damage', min: 1, max: 120, step: 0.1 },
  { k: 'pellets', label: 'pellets', min: 2, max: 16, step: 1, only: g => g.pellets > 1 },
  { k: 'burst', label: 'rounds a burst', min: 2, max: 6, step: 1, only: g => g.burst > 1 },
  { k: 'projSpeed', label: 'round speed', min: 20, max: 220, step: 1 },
  { k: 'charge', label: 'charge (s)', min: 0.05, max: 1.5, step: 0.01, only: g => (g.charge ?? 0) > 0 },
  { k: 'clip', label: 'clip', min: 1, max: 120, step: 1 },
  { k: 'reloadTime', label: 'reload (s)', min: 0.3, max: 5, step: 0.05 },
]
export const statsOf = (g: RangeGun): GunStats => ({ damage: g.damage, crit: g.crit, pellets: g.pellets, burst: g.burst, projSpeed: g.projSpeed, charge: g.charge ?? 0, clip: g.clip, reloadTime: g.reloadTime })
const clampStat = (k: StatKey, v: unknown): number | undefined => {
  const d = STAT_DIALS.find(x => x.k === k)!
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(d.min, Math.min(d.max, v)) : undefined
}
/** a saved (or pasted) set of moves: only real dials, in range */
export function cleanStats(s: Partial<Record<StatKey, unknown>> | null | undefined): Partial<GunStats> {
  const out: Partial<GunStats> = {}
  for (const d of STAT_DIALS) { const v = clampStat(d.k, s?.[d.k]); if (v !== undefined) out[d.k] = v }
  return out
}
/** the gun with the bench's moves on it. Same object back when nothing moved. A faster round keeps the gun's REACH (speed x life). */
export function benchGun<G extends RangeGun>(g: G, s: Partial<GunStats> | null | undefined): G {
  const m = cleanStats(s)
  const own = STAT_DIALS.filter(d => m[d.k] !== undefined && (!d.only || d.only(g)))
  if (!own.length) return g
  const out = { ...g } as G
  for (const d of own) (out as unknown as Record<string, number>)[d.k] = m[d.k]!
  if (m.projSpeed !== undefined) out.projLife = (g.projSpeed * g.projLife) / m.projSpeed
  return out
}
/** damage a second, trigger held steady (a charge waits before each round) */
export const heldDps = (g: RangeGun) => (g.burst * g.pellets * g.damage) / ((g.burst - 1) * g.burstGap + g.fireCd + (g.charge ?? 0))

// ── saved on this browser (a dev tool's numbers, a DEVICE key: keeper-local.test DEVICE_KEYS) ──
export const GUN_STATS_KEY = 'open:gun-stats.v1'
export function loadStats(): Record<string, Partial<GunStats>> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(GUN_STATS_KEY)
    const o = raw ? JSON.parse(raw) : null, out: Record<string, Partial<GunStats>> = {}
    if (o && typeof o === 'object') for (const g of BENCH_GUNS) if (o[g.id]) { const c = cleanStats(o[g.id]); if (Object.keys(c).length) out[g.id] = c }
    return out
  } catch { return {} }
}
export function saveStats(id: string, s: Partial<GunStats> | null): Record<string, Partial<GunStats>> {
  const all = loadStats()
  const c = s ? cleanStats(s) : {}
  if (Object.keys(c).length) all[id] = c; else delete all[id]
  try { localStorage.setItem(GUN_STATS_KEY, JSON.stringify(all)) } catch { /* private window */ }
  return all
}
