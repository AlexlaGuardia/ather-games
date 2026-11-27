// M152 s1: the DB2 Twins' NUMBERS, proposed for Alex (nothing in the game reads TWINS_GUN yet: it is not in RANGE_GUNS).
// The sim drives the real combat.ts (fire / stepTrigger / stepCombat / the newcomer bot in wilds-sim.ts) exactly as the M151 gun
// sim did (scripts/m151-newcomer-sim.mts), so the table is the engine's, not a spreadsheet's. Deterministic: seeded throughout.
//   npx tsx scripts/m152-twins-sim.mts            (prints the markdown table)
// Canon (game/weapons.md, RULED CANON_GAPS › The DB2 Twins): a sidearm, akimbo sawn-offs, point-blank, long reload; one core in two
// halves. Shape (Alex, BETA M152): two barrels x two shots = four before the reload (early reload allowed), LEFT gun first, 0.2 s
// apart held, huge shove point blank, nearly nothing past ~8 m, one-dump power with a low sustained rate. Numbers = build (Jin).
import type { RangeGun } from './gunplay'
import { RANGE_GUNS, headOf } from './gunplay'
import { newCombat, spawnHollow, stepCombat, stepTrigger, heldGun, swapGun, stepAway, M151, BODY_Y, type Combat } from '../ather/combat'
import { FLAT, SIM, championFight, packFight, summarise, type Summary } from '../ather/wilds-sim'
import { groupPack } from '../ather/combat'

/** metres the Twins' pellets fly before they are spent (reach = projSpeed x projLife) */
export const TWINS_REACH = 8.5
/** M245: the Twins' damage a shell (all 8 pellets on) */
export const TWINS_SHELL = 99
export const TWINS_GUN: RangeGun = {
  id: 'twins', name: 'DB2 TWINS', slot: 'SIDEARM', auto: false,
  // four rounds (L, R, L, R), 0.2 s apart held, then the long reload. Early reload allowed (the engine's reload on a part clip).
  fireCd: 0.2, clip: 4, reloadTime: 3.2, reloadMana: 14,
  projSpeed: 68, projLife: TWINS_REACH / 68,
  // a sawn-off cone: wide, so the pellets on a body fall away fast with range; ADS tightens it a little (no zoom)
  // M245 (Alex 11-27: "Twins 99 per slug"): 99 a shell = 8 pellets x 12.375 (was 4.2 = 33.6 a shell); head = body x HEAD_MULT (1.25x a pellet)
  damage: TWINS_SHELL / 8, crit: headOf('twins', TWINS_SHELL / 8), hipSpread: 11, adsSpread: 8.8, bloomPerShot: 0, bloomMax: 0, bloomDecay: 6, adsBloomScale: 0,
  kickPitch: 0.05, kickYaw: 0.014, converge: 6, headR: 0.05, trailR: 0.04, hipMove: 0.88, adsMove: 0.72,
  burst: 1, burstGap: 0, pellets: 8, shove: 0.55, color: '#a27e3c',
}
/** which gun of the pair fires the n-th round of a clip (0-based): LEFT first (rune 1), then right, alternating */
export const twinsBarrel = (n: number): 'left' | 'right' => (n % 2 === 0 ? 'left' : 'right')

const DT = 1 / 240
const gunOf = (id: string): RangeGun => id === 'twins' ? TWINS_GUN : RANGE_GUNS.find(g => g.id === id)!
/** run fn with the Twins on the rack and held-fire on (as the game will), then put everything back */
export function withTwins<T>(fn: () => T): T {
  const hold = M151.hold, had = RANGE_GUNS.includes(TWINS_GUN)
  M151.hold = [...hold, 'twins']; if (!had) RANGE_GUNS.push(TWINS_GUN)
  try { return fn() } finally { M151.hold = hold; if (!had) { const i = RANGE_GUNS.indexOf(TWINS_GUN); if (i >= 0) RANGE_GUNS.splice(i, 1) } }
}
function rangeCombat(id: string, seed: number, d: number) {
  const c = newCombat(seed), g = gunOf(id); c.gun = g; c.keeper.ammo = g.clip
  const h = spawnHollow(c, FLAT, 0, -d, 'shambler'); h.hp = h.maxHp = 1e6
  return { c, h }
}
const EYE = { x: 0, y: 1.62, z: 0 }
const aimAt = (d: number) => { const dy = BODY_Y - EYE.y, l = Math.hypot(dy, d); return { x: 0, y: dy / l, z: -d / l } }
const aimAtPos = (h: { x: number; z: number }) => { const dx = h.x, dz = h.z, dy = BODY_Y - EYE.y, l = Math.hypot(dx, dy, dz); return { x: dx / l, y: dy / l, z: dz / l } }
const pin = (h: { x: number; z: number; state: string }, d: number) => { h.x = 0; h.z = -d; h.state = 'wander' }

/** mean damage ONE trigger pull (one shell / round) lands on a shambler-sized body d m out, aimed at its chest, hip fire */
export function shellAt(id: string, d: number, n = 200): number {
  return withTwins(() => {
    let sum = 0
    for (let s = 0; s < n; s++) {
      const { c, h } = rangeCombat(id, 7001 + s * 31, d)
      stepTrigger(c, EYE, aimAt(d), false, true, DT)
      for (let t = 0; t < 1.5 && c.rounds.length; t += DT) { pin(h, d); stepCombat(c, FLAT, { x: 0, y: 0, z: 0 }, DT) }
      sum += 1e6 - h.hp
    }
    return sum / n
  })
}
/** metres a free shambler standing d m out is shoved AWAY by `secs` of held fire (0 = one pull). Its own walk back in is not
 *  counted: only frames that move it outward add up. One shell is capped at combat.ts SHOVE_MAX (1.2 m). */
export function shoveAt(id: string, d: number, secs = 0, n = 100): number {
  return withTwins(() => {
    let sum = 0
    for (let s = 0; s < n; s++) {
      const { c, h } = rangeCombat(id, 9001 + s * 17, d)
      for (let t = 0; t <= secs + 0.5; t += DT) {
        if (t <= secs) stepTrigger(c, EYE, aimAtPos(h), false, true, DT)
        const r0 = Math.hypot(h.x, h.z)
        stepCombat(c, FLAT, { x: 0, y: 0, z: 0 }, DT)
        sum += Math.max(0, Math.hypot(h.x, h.z) - r0 - 0.01)   // a walk step is ~0.01 m a frame; a shove is a jump
      }
    }
    return sum / n
  })
}
/** seconds, trigger held from the first round, to land `hp` on a pinned shambler-sized body d m out (reloads included); Infinity past 30 s */
export function ttk(id: string, d: number, hp: number, n = 60): number {
  return withTwins(() => {
    let sum = 0
    for (let s = 0; s < n; s++) {
      const { c, h } = rangeCombat(id, 5003 + s * 23, d); let t = 0
      for (; t < 30 && 1e6 - h.hp < hp; t += DT) {
        pin(h, d)
        if (heldGun(c.gun)) stepTrigger(c, EYE, aimAt(d), false, true, DT)
        stepCombat(c, FLAT, { x: 0, y: 0, z: 0 }, DT)
      }
      if (t >= 30) return Infinity
      sum += t
    }
    return sum / n
  })
}
/** the gun's paper numbers off one held minute with free mana: the first clip dumped, and sustained with reloads */
export function paper(id: string) {
  const g = gunOf(id), shell = g.damage * (g.pellets ?? 1)
  const dumpSecs = (g.clip - 1) * g.fireCd
  return {
    shell, clipDamage: shell * g.clip, dumpSecs,
    /** damage in the first 0.6 s of a fresh clip, every pellet on (the "one dump") */
    burst06: shell * Math.min(g.clip, Math.floor(0.6 / g.fireCd + 1e-9) + 1),
    held: shell / g.fireCd,
    sustained: (shell * g.clip) / (g.clip * g.fireCd + g.reloadTime),
    reach: g.projSpeed * g.projLife,
  }
}
/** the 6% rule (wilds-teeth (8), M151): a newcomer bot with THIS gun alone, 200 seeds: champion (3 crawler adds) and a 3S+1F pack */
export function newcomer(id: string, seeds = 200): { champ: Summary; pack: Summary } {
  return withTwins(() => {
    const was = SIM.gun; SIM.gun = id
    try {
      const S = Array.from({ length: seeds }, (_, i) => 1001 + i * 13)
      const pack = summarise(S.slice(0, 60).map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'floater'], groupPack)))
      const champ = summarise(S.map(s => championFight(s, 3)))
      return { champ, pack }
    } finally { SIM.gun = was }
  })
}
/** the Twins draw when the target is this close (the bot's hand on the swap), else the primary */
export const PAIR_DRAW = 6
/** the 6% rule as the Twins will be carried: the newcomer's default primary (Repeater) PLUS the Twins as the sidearm. The bot draws
 *  the Twins when what it shoots is inside PAIR_DRAW m and they have rounds, the Repeater otherwise; a gun out of hand reloads itself
 *  (combat.ts stepAway, the loadout's carried rule). */
export function newcomerPair(seeds = 200): { champ: Summary; pack: Summary; twinsShare: number } {
  return withTwins(() => {
    const carried = ['repeater', 'twins']; let twinsT = 0, allT = 0
    SIM.pick = (c, dist, dt) => {
      const want = dist <= PAIR_DRAW && (c.gun.id === 'twins' ? c.keeper.ammo > 0 || c.keeper.reloading > 0 : (c.rack?.twins?.ammo ?? TWINS_GUN.clip) > 0) ? TWINS_GUN : gunOf('repeater')
      if (c.gun.id !== want.id) swapGun(c, want)
      stepAway(c, dt, true, carried)
      allT += dt; if (c.gun.id === 'twins') twinsT += dt
    }
    try {
      const S = Array.from({ length: seeds }, (_, i) => 1001 + i * 13)
      const pack = summarise(S.slice(0, 60).map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'floater'], groupPack)))
      const champ = summarise(S.map(s => championFight(s, 3)))
      return { champ, pack, twinsShare: Math.round(twinsT / allT * 100) / 100 }
    } finally { SIM.pick = undefined }
  })
}
export type { Combat }
