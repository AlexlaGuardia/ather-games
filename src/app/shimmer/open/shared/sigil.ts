// M93 s1: GUN SIGIL TUNING, the pure maths. A sigil is a SETTING on a gun; runes are cut into it (Enchant Temple, later
// slice) and each rune = two positives + one negative on the gun's calibration, read off CANON game/weapons.md >
// SIGIL TUNING (the 20-rune table, LOCKED 2026-11-22). Canon owns the MEANING and the DIRECTION; every number here is a
// build dial (Jin's). Pure: no react, no three. NOTHING here reads or writes `damage` (sigils are tuning, not damage).
import { ECON } from './vitals-economy'

// ── the rule set ─────────────────────────────────────────────────────────────────────────────────────────────────
/** canon cap: a sigil takes up to a runeword's three runes */
export const SIGIL_CAP = 3
/** guns that can never take a sigil (canon: the Charred Rifle, Prototype). Mirrors RangeGun.noSigil in gunplay.ts. */
export const SIGILLESS_GUNS: readonly string[] = ['charred-rifle']
/** sigil sockets on a gun: 0 for the Prototype, 1 for every shop gun for now (a build dial, Jin's) */
export const sigilSlots = (gunId: string): number => (SIGILLESS_GUNS.includes(gunId) ? 0 : 1)

// ── the dials (Jin's dials, NOT canon) ───────────────────────────────────────────────────────────────────────────
export interface SigilDials { /** per level, multiplicative */ step: Record<TunedStat, number>; /** multiplier floor */ min: number; /** multiplier ceiling */ max: number }
export const SIGIL_DIALS: SigilDials = {
  step: { velocity: 0.1, range: 0.1, recoil: 0.1, spread: 0.1, handling: 0.1, reloadSpeed: 0.1, fireRate: 0.1, manaCost: 0.1, mobility: 0.1, heat: 0.1 },
  min: 0.5, max: 1.6,
}

// ── effects ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** the 10 effects that move a number today (the calibration). recoil + recoilControl share `recoil`; weight + mobility share `mobility`. */
export type TunedStat = 'velocity' | 'range' | 'recoil' | 'spread' | 'handling' | 'reloadSpeed' | 'fireRate' | 'manaCost' | 'mobility' | 'heat'
export type EffectKey =
  | 'penetration' | 'velocity' | 'recoil' | 'recoilControl' | 'steadyWhenHit' | 'fireRate' | 'burn' | 'tracerGlow' | 'heat'
  | 'reloadSpeed' | 'sustain' | 'handling' | 'manaCost' | 'range' | 'chain' | 'overload' | 'spread' | 'knockback'
  | 'structureDamage' | 'guidance' | 'mobility' | 'chargeShot' | 'speedAfterKill' | 'mark' | 'clearSight' | 'stealth'
  | 'stoppingPower' | 'durability' | 'precision' | 'sigilHold' | 'melt' | 'lingeringGround' | 'blind' | 'wear'
  | 'selfRepair' | 'weight' | 'chill' | 'hardRounds' | 'knock' | 'suppressed' | 'cover' | 'adaptive' | 'hiddenTracers' | 'dampening'

/** THE MAPPING TABLE: effect key -> the stat it acts on (absent = an inert TAG until a later slice wires it).
 *  Polarity is ALWAYS "+ better for the wielder, - worse"; the stat's own direction is `LOWER_IS_BETTER`. */
export const STAT_OF: Partial<Record<EffectKey, TunedStat>> = {
  velocity: 'velocity',          // projSpeed
  range: 'range',                // projLife
  recoil: 'recoil',              // kickPitch + kickYaw
  recoilControl: 'recoil',       // same field; + = less kick
  spread: 'spread',              // hipSpread + adsSpread + bloomPerShot + bloomMax
  handling: 'handling',          // adsMove (aimed handling; no aim/swap-speed field exists, so the aimed move multiplier stands in)
  reloadSpeed: 'reloadSpeed',    // reloadTime
  fireRate: 'fireRate',          // fireCd
  manaCost: 'manaCost',          // reload mana (gun.reloadMana, else ECON.reloadMana)
  mobility: 'mobility',          // returned `moveMult` (no field)
  weight: 'mobility',            // - = slower with it out, same moveMult
  heat: 'heat',                  // returned `heatMult` (RangeGun has no heat field)
}
/** for these a GOOD level shrinks the number (less kick, tighter cone, faster reload, shorter cooldown, cheaper reload, cooler) */
export const LOWER_IS_BETTER: ReadonlySet<TunedStat> = new Set<TunedStat>(['recoil', 'spread', 'reloadSpeed', 'fireRate', 'manaCost', 'heat'])

export interface RuneEffect { key: EffectKey; label: string; polarity: 1 | -1 }
export interface RuneDef { id: string; state: string; effects: [RuneEffect, RuneEffect, RuneEffect] }
const up = (key: EffectKey, label: string): RuneEffect => ({ key, label, polarity: 1 })
const dn = (key: EffectKey, label: string): RuneEffect => ({ key, label, polarity: -1 })

/** the 20 runes, exactly the canon table: two positives then the negative. Rune ids = the birth store's ids (play3d/birth/runes.data.ts). */
export const RUNES: readonly RuneDef[] = [
  { id: 'manalic', state: 'Solid', effects: [up('penetration', 'Penetration (FMJ)'), up('velocity', 'Velocity'), dn('recoil', 'Recoil')] },
  { id: 'barrier', state: 'Compact', effects: [up('recoilControl', 'Recoil control'), up('steadyWhenHit', 'Steady when hit'), dn('fireRate', 'Fire rate')] },
  { id: 'star', state: 'Ignite', effects: [up('burn', 'Burn'), up('tracerGlow', 'Tracer glow'), dn('heat', 'Heat')] },
  { id: 'life', state: 'Flow', effects: [up('reloadSpeed', 'Reload speed'), up('sustain', 'Sustain'), dn('velocity', 'Velocity')] },
  { id: 'enchant', state: 'Bind', effects: [up('handling', 'Handling'), up('manaCost', 'Mana cost'), dn('range', 'Range')] },
  { id: 'lightning', state: 'Expanding', effects: [up('chain', 'Chain'), up('overload', 'Overload'), dn('spread', 'Spread')] },
  { id: 'tempest', state: 'Ignite', effects: [up('knockback', 'Knockback'), up('structureDamage', 'Structure damage'), dn('manaCost', 'Mana cost')] },
  { id: 'breeze', state: 'Flow', effects: [up('guidance', 'Guidance'), up('mobility', 'Mobility'), dn('recoil', 'Recoil')] },
  { id: 'static', state: 'Scatter', effects: [up('chargeShot', 'Charge shot'), up('speedAfterKill', 'Speed after a kill'), dn('fireRate', 'Fire rate')] },
  { id: 'illuminate', state: 'Bind', effects: [up('mark', 'Mark'), up('clearSight', 'Clear sight'), dn('stealth', 'Stealth')] },
  { id: 'stone', state: 'Solid', effects: [up('stoppingPower', 'Stopping power'), up('durability', 'Durability'), dn('handling', 'Handling')] },
  { id: 'gem', state: 'Compact', effects: [up('precision', 'Precision'), up('sigilHold', 'Sigil hold'), dn('reloadSpeed', 'Reload speed')] },
  { id: 'magma', state: 'Ignite', effects: [up('melt', 'Melt'), up('lingeringGround', 'Lingering ground'), dn('velocity', 'Velocity')] },
  { id: 'dust', state: 'Scatter', effects: [up('blind', 'Blind'), up('wear', 'Wear'), dn('range', 'Range')] },
  { id: 'metalergy', state: 'Bind', effects: [up('selfRepair', 'Self-repair'), up('recoilControl', 'Recoil control'), dn('weight', 'Weight')] },
  { id: 'freeze', state: 'Solid', effects: [up('chill', 'Chill'), up('hardRounds', 'Hard rounds'), dn('heat', 'Heat')] },
  { id: 'hydro', state: 'Compact', effects: [up('velocity', 'Velocity'), up('knock', 'Knock'), dn('manaCost', 'Mana cost')] },
  { id: 'mist', state: 'Expanding', effects: [up('suppressed', 'Suppressed'), up('cover', 'Cover'), dn('range', 'Range')] },
  { id: 'fluid', state: 'Flow', effects: [up('adaptive', 'Adaptive'), up('reloadSpeed', 'Reload speed'), dn('stoppingPower', 'Stopping power')] },
  { id: 'vapor', state: 'Scatter', effects: [up('hiddenTracers', 'Hidden tracers'), up('dampening', 'Dampening'), dn('spread', 'Spread')] },
]
export const runeById = (id: string): RuneDef | undefined => RUNES.find(r => r.id === id)

// ── the sigil ────────────────────────────────────────────────────────────────────────────────────────────────────
/** a sigil sits on one gun; `runes` are rune ids in cut order (the 1st is the foundation) */
export interface Sigil { gunId: string; runes: readonly string[] }
export const blankSigil = (gunId: string): Sigil => ({ gunId, runes: [] })

export type CutResult = { ok: true } | { ok: false; reason: 'no-socket' | 'unknown-rune' | 'cap' | 'same-state' | 'duplicate' }

export function canCut(sigil: Sigil, runeId: string): CutResult {
  if (sigilSlots(sigil.gunId) < 1) return { ok: false, reason: 'no-socket' }
  const rune = runeById(runeId)
  if (!rune) return { ok: false, reason: 'unknown-rune' }
  if (sigil.runes.length >= SIGIL_CAP) return { ok: false, reason: 'cap' }
  if (sigil.runes.includes(runeId)) return { ok: false, reason: 'duplicate' }
  if (sigil.runes.some(r => runeById(r)?.state === rune.state)) return { ok: false, reason: 'same-state' }
  return { ok: true }
}

/** cut a rune in: a new sigil, or the same sigil unchanged when refused (check `canCut` for the reason) */
export function cut(sigil: Sigil, runeId: string): Sigil {
  return canCut(sigil, runeId).ok ? { ...sigil, runes: [...sigil.runes, runeId] } : sigil
}

/** per-effect level: the sum of polarities over the cut runes (a stat effect or a tag) */
function levels(sigil: Sigil): Partial<Record<EffectKey, number>> {
  const out: Partial<Record<EffectKey, number>> = {}
  for (const id of sigil.runes) for (const e of runeById(id)?.effects ?? []) out[e.key] = (out[e.key] ?? 0) + e.polarity
  return out
}
/** the inert TAGS (every effect with no stat yet), key -> level. Nothing acts on these until a later slice. */
export function sigilEffects(sigil: Sigil): Partial<Record<EffectKey, number>> {
  const out: Partial<Record<EffectKey, number>> = {}
  for (const [k, v] of Object.entries(levels(sigil)) as [EffectKey, number][]) if (!STAT_OF[k]) out[k] = v
  return out
}
/** goodness level per calibrated stat (+ = better for the wielder), only the stats the sigil touches */
export function statLevels(sigil: Sigil): Partial<Record<TunedStat, number>> {
  const out: Partial<Record<TunedStat, number>> = {}
  for (const [k, v] of Object.entries(levels(sigil)) as [EffectKey, number][]) { const s = STAT_OF[k]; if (s) out[s] = (out[s] ?? 0) + v }
  return out
}

/** multiplier for a stat at a goodness level: multiplicative per level, clamped so nothing reaches 0 or runs away */
export function statMult(stat: TunedStat, level: number, d: SigilDials = SIGIL_DIALS): number {
  const f = Math.pow(1 + d.step[stat], LOWER_IS_BETTER.has(stat) ? -level : level)
  return Math.min(d.max, Math.max(d.min, f))
}

/** reload mana with the sigil: HALVED when the 1st cut rune is the keeper's birth rune (canon). Pass the already
 *  manaCost-tuned cost. Any other position, no birth rune, or an empty sigil: unchanged. */
export function reloadManaWith(sigil: Sigil, birthRune: string | null | undefined, baseCost: number): number {
  return birthRune && sigil.runes[0] === birthRune ? baseCost / 2 : baseCost
}

// ── tuning a gun ─────────────────────────────────────────────────────────────────────────────────────────────────
/** the RangeGun fields the tuning reads and writes (gunplay.ts RangeGun is assignable to this). `damage` is not here on purpose. */
export interface TunableGun {
  projSpeed: number; projLife: number; kickPitch: number; kickYaw: number
  hipSpread: number; adsSpread: number; bloomPerShot: number; bloomMax: number
  adsMove: number; reloadTime: number; fireCd: number; reloadMana?: number
}
export type Tuned<G extends TunableGun> = G & { moveMult: number; heatMult: number; reloadMana: number }

export function tuneGun<G extends TunableGun>(base: G, sigil: Sigil, birthRune?: string | null, d: SigilDials = SIGIL_DIALS): Tuned<G> {
  const L = sigilSlots(sigil.gunId) < 1 ? {} : statLevels(sigil)   // a socketless gun is never tuned
  const m = (s: TunedStat) => statMult(s, L[s] ?? 0, d)
  const cost = (base.reloadMana ?? ECON.reloadMana) * m('manaCost')
  const sigiled = sigilSlots(sigil.gunId) >= 1
  return {
    ...base,
    projSpeed: base.projSpeed * m('velocity'),
    projLife: base.projLife * m('range'),
    kickPitch: base.kickPitch * m('recoil'),
    kickYaw: base.kickYaw * m('recoil'),
    hipSpread: base.hipSpread * m('spread'),
    adsSpread: base.adsSpread * m('spread'),
    bloomPerShot: base.bloomPerShot * m('spread'),
    bloomMax: base.bloomMax * m('spread'),
    adsMove: base.adsMove * m('handling'),
    reloadTime: base.reloadTime * m('reloadSpeed'),
    fireCd: base.fireCd * m('fireRate'),
    reloadMana: sigiled ? reloadManaWith(sigil, birthRune, cost) : cost,
    moveMult: m('mobility'),
    heatMult: m('heat'),
  }
}
