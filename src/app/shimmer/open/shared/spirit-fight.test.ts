// npx tsx src/app/shimmer/open/shared/spirit-fight.test.ts   (BETA M127 s1: the fight brain of following spirits)
import { RANGE_GUNS } from './gunplay'
import { M151 } from '../ather/combat'
import { readFileSync } from 'fs'
import { newCombat, spawnHollow, stepCombat, SHAMBLER, LURE_STOP, type Combat, type HollowKind } from '../ather/combat'
import { FLAT, SIM, championFight, packFight, summarise } from '../ather/wilds-sim'
import { FIGHT, score, pick, joins, mayDeal, tethered, workSpot, newSpiritFight, stepSpirits, noteKeeper, healthOf, sharedTarget, fightSlot, setLiveFight, leadSpot, sideOf, drawable, whoTurns, type Situation, type Helper } from './spirit-fight'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const DT = 1 / 60, feet = { x: 0, y: 0, z: 0 }, eye = { x: 0, y: 1.62, z: 0 }, aim = { x: 0, y: 0, z: -1 }
const S = (o: Partial<Situation> = {}): Situation => ({ targetD: null, hpFrac: 1, near: 0, engaged: 1, sinceHelp: 99, canDamage: true, canSlow: true, roll: 0.5, ...o })

// (1) scoring
ok(pick(score(S())) === 'nothing', 'no target, nothing wrong: nothing')
ok(pick(score(S({ targetD: 4, roll: 0 }))) === 'hit', 'a target close in, in the mood: HIT')
ok(pick(score(S({ targetD: 4, roll: 1 }))) === 'nothing', 'the same target, not in the mood: nothing')
ok(score(S({ targetD: null })).hit === 0 && score(S({ targetD: 4, canDamage: false })).hit === 0, 'no target or no damage budget: no HIT')
ok(score(S({ targetD: FIGHT.hitRange + 1 })).hit === 0, 'a far target is left alone')
ok(pick(score(S({ hpFrac: 0.1, targetD: 4 }))) === 'mend' && score(S({ hpFrac: 0.8 })).mend === 0 && score(S({ hpFrac: 0 })).mend === 0, 'MEND only for a keeper low (and up)')
ok(pick(score(S({ near: 5 }))) === 'slow' && score(S({ near: FIGHT.slowN - 1 })).slow === 0 && score(S({ near: 5, canSlow: false })).slow === 0, 'SLOW only when Hollows bunch, and not twice')
ok(score(S({ sinceHelp: 0 })).nothing > score(S({ sinceHelp: 20 })).nothing + 0.3, 'a fresh help by anyone makes nothing likelier')
{ let n = 0; for (let i = 0; i < 1000; i++) if (pick(score(S({ targetD: 8, engaged: 2, roll: i / 1000 }))) === 'nothing') n++; ok(n > 300 && n < 700, `nothing is a COMMON answer with an ordinary target (${n}/1000)`) }

// (2) tether, stand, budget, join odds
ok(FIGHT.tether === 10, "Alex's 10 m")
ok(!tethered(9.9, false) && tethered(10.1, false) && tethered(8, true) && !tethered(5.9, true), 'past 10 m she comes back, to 6 m, before anything else')
for (const d of [1, 5, 12, 40]) for (const l of [-1, 0, 1]) { const p = workSpot(feet, { x: 0, z: -d }, l); ok(Math.hypot(p.x, p.z) <= FIGHT.stand + 1e-9, `workSpot ${d}/${l} never past ${FIGHT.stand} m of the keeper`) }
ok(mayDeal(0, 100, 12) && !mayDeal(0, 100, 12.1) && !mayDeal(0, 0, 1), 'the damage budget is a part of the KEEPER\'s own')
{ let n = 0; for (let i = 0; i < 4000; i++) if (joins('pa', i, 5)) n++; ok(Math.abs(n / 4000 - FIGHT.join) < 0.03, `join odds ${n / 4000} (dial ${FIGHT.join})`)
  ok(joins('pa', 3, 5) === joins('pa', 3, 5), 'one answer a fight'); let diff = 0; for (let i = 0; i < 200; i++) if (joins('pa', i, 5) !== joins('pb', i, 5)) diff++; ok(diff > 30, 'each spirit chooses for herself') }

// a scripted fight: a keeper who hits `target` every 0.4 s for 10; spirits stand where `pos` says
type Opt = { secs?: number; seed?: number; n?: number; pos?: (i: number, F: ReturnType<typeof newSpiritFight>, t: number) => { x: number; z: number }; keeperHits?: boolean; hp?: number; each?: (F: ReturnType<typeof newSpiritFight>, C: Combat, who: Helper[], t: number, done: ReturnType<typeof stepSpirits>) => void }
function fight(o: Opt = {}) {
  const C = newCombat(9), F = newSpiritFight(o.seed ?? 1), secs = o.secs ?? 20
  const A = spawnHollow(C, FLAT, 0, -8), B = spawnHollow(C, FLAT, 6, -8)
  A.hp = A.maxHp = B.hp = B.maxHp = 1e4
  let kills = 0, hitNext = 0.3
  for (let t = 0; t < secs; t += DT) {
    for (const h of [A, B]) { h.x = h === A ? 0 : 6; h.z = -8; h.state = 'stagger'; h.t = 9 }
    if (o.hp !== undefined) C.keeper.hp = o.hp; else C.keeper.hp = 100
    const before = healthOf(C)
    const who: Helper[] = Array.from({ length: o.n ?? 3 }, (_, i) => { const p = o.pos?.(i, F, t) ?? { x: i - 1, z: -4 }; return { id: 'p' + i, ...p } })
    const done = stepSpirits(F, C, feet, eye, { x: 0, y: -1, z: 0 }, who, DT)
    o.each?.(F, C, who, t, done)
    if (o.keeperHits !== false && t >= hitNext) { hitNext += 0.4; C.rounds.push({ x: A.x, y: 0.85, z: A.z + 1, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 10 }) }
    stepCombat(C, FLAT, feet, DT); for (const e of C.events) if (e.kind === 'hit' && e.killed) kills++
    noteKeeper(F, C, before)
  }
  return { F, C, A, B, kills }
}
// (3) the shared target, the cap, nothing
{
  let wrong = 0, hits = 0, over = 0, gaps = Infinity, last = -9; const per: Record<string, number> = {}; let coolBad = 0, worstShare = 0, none = 0, helped = 0
  for (let seed = 1; seed <= 12; seed++) { last = -9; for (const k in per) delete per[k]
    const r = fight({ seed, secs: 30, each: (F, C, _w, t, done) => { for (const d of done) { if (d.kind === 'hit') { hits++; if (d.target !== C.hollows[0].id) wrong++ }
      gaps = Math.min(gaps, t - last); last = t; if (per[d.id] !== undefined && t - per[d.id] < FIGHT.cooldown - 0.05) coolBad++; per[d.id] = t }
      if (F.spiritDealt > FIGHT.share * F.keeperDealt + 1e-6) over++ } })
    worstShare = Math.max(worstShare, r.F.spiritDealt / Math.max(1, r.F.keeperDealt))
    ok(r.F.helps <= FIGHT.helps, `seed ${seed}: at most ${FIGHT.helps} helps a fight (${r.F.helps})`)
    ok(Math.abs(r.F.keeperDealt - (1e4 - r.A.hp - r.F.spiritDealt)) < 11, `seed ${seed}: the keeper's own damage is counted, the spirits' is not (${r.F.keeperDealt} / ${1e4 - r.A.hp} - ${r.F.spiritDealt})`)
    none += r.F.seen.nothing; helped += r.F.helps
    ok(r.B.hp === 1e4, `seed ${seed}: the Hollow the keeper is NOT on is untouched`)
  }
  ok(none > helped && helped > 10, `over the 12 fights nothing (${none}) is chosen more than helping (${helped})`)
  ok(hits > 8 && wrong === 0, `HITs land (${hits}), all on the keeper's target (${wrong} off it)`)
  ok(over === 0, `damage never past ${FIGHT.share} of the keeper's (worst ${worstShare.toFixed(3)})`)
  ok(gaps >= FIGHT.gap - 0.05 && coolBad === 0, `paced: ${gaps.toFixed(2)} s between any two helps, own cooldown kept (${coolBad} broken)`)
}
// many rich keepers: helps cap bites even with no damage budget trouble
{ const r = fight({ seed: 3, secs: 400 }); ok(r.F.helps === FIGHT.helps, `a long fight stops at the help budget (${r.F.helps})`) }
{ const r = fight({ keeperHits: false, secs: 30 }); ok(r.A.hp === 1e4 && r.B.hp === 1e4, 'a keeper who does nothing gets no damage done') }
// (4) tether: a joined spirit held past 10 m never acts and has no fight slot; back near, she may
{
  let acted = 0, slot = 0
  for (let seed = 1; seed <= 6; seed++) fight({ seed, secs: 20, hp: 10, pos: () => ({ x: 0, z: -10.5 }), each: (F, _C, _w, _t, d) => { acted += d.length; slot += F.slots.size } })
  ok(acted === 0 && slot === 0, `past the tether: nothing but coming back (${acted} acts, ${slot} slots)`)
  let drew = 0, far = 0
  for (let seed = 1; seed <= 6; seed++) { const at = [0, 1, 2].map(() => ({ x: 0, z: 2 })); fight({ seed, secs: 30, pos: (i, F) => { const s = F.slots.get('p' + i) ?? { x: i - 1, z: 2 }, p = at[i], d = Math.hypot(s.x - p.x, s.z - p.z), m = Math.min(d, 6 * DT); if (d > 0) { p.x += (s.x - p.x) / d * m; p.z += (s.z - p.z) / d * m } if (F.slots.has('p' + i)) drew++; far = Math.max(far, Math.hypot(p.x, p.z)); return { ...p } } }) }
  ok(drew > 0 && far <= FIGHT.tether, `a fight moves her slot (${drew} frames) and she stays within 10 m (${far.toFixed(1)})`)
}
// (5) not joining = just near; MEND heals; SLOW slows; the fight ends and the formation has her
{
  let seed = 0; for (let s = 1; s < 5000 && !seed; s++) if (![0, 1, 2].some(i => joins('p' + i, 1, s))) seed = s
  const r = fight({ seed, secs: 30, hp: 10 }); ok(r.F.helps === 0 && r.F.seen.stayed === 3, `nobody chose to join: nothing is done (${r.F.helps})`)
  let sy = 0; for (let s = 1; s < 500 && !sy; s++) if ([0, 1, 2].every(i => joins('p' + i, 1, s))) sy = s
  const m = fight({ seed: sy, secs: 12, hp: 20 }); ok(m.F.seen.mend > 0, `a keeper low is mended (${m.F.seen.mend})`)
  const C = newCombat(2), F = newSpiritFight(sy); for (let i = 0; i < 4; i++) { const h = spawnHollow(C, FLAT, i, -3); h.state = 'stagger'; h.t = 99 }
  for (let t = 0; t < 6; t += DT) { stepSpirits(F, C, feet, eye, { x: 0, y: -1, z: 0 }, [0, 1, 2].map(i => ({ id: 'p' + i, x: i, z: 2 })), DT) }
  ok(F.seen.slow > 0 && C.hollows.every(h => (h.fx?.slowed ?? 0) > 0), `bunched Hollows are slowed (${F.seen.slow})`)
  C.hollows = []; for (let t = 0; t < FIGHT.quiet + 0.5; t += DT) stepSpirits(F, C, feet, eye, aim, [{ id: 'p0', x: 0, z: 2 }], DT)
  setLiveFight(F); ok(!F.on && fightSlot('p0') === null, 'the fight over: the formation owns her place again'); setLiveFight(null)
  const n = F.n; const h = spawnHollow(C, FLAT, 0, -5); h.state = 'chase'; stepSpirits(F, C, feet, eye, aim, [{ id: 'p0', x: 0, z: 2 }], DT); ok(F.on && F.n === n + 1 && F.helps === 0 && F.spiritDealt === 0, 'the next fight: a new choice, a new budget')
}
// (6) a HIT that finishes a Hollow: one kill event, one drop, the next step
{
  let sy = 0; for (let s = 1; s < 500 && !sy; s++) if (joins('p0', 1, s)) sy = s
  const C = newCombat(4), F = newSpiritFight(sy), h = spawnHollow(C, FLAT, 0, -5); h.hp = 3
  let kills = 0, hit = 0
  for (let t = 0; t < 30 && !kills; t += DT) { h.state = 'stagger'; h.t = 9; F.target = h.id; F.targetT = F.t; const b = healthOf(C); F.keeperDealt = 500
    hit += stepSpirits(F, C, feet, eye, aim, [{ id: 'p0', x: 0, z: -2 }], DT).filter(d => d.kind === 'hit').length; stepCombat(C, FLAT, { x: 40, y: 0, z: 0 }, DT)
    noteKeeper(F, C, b); kills += C.events.filter(e => e.kind === 'hit' && e.killed).length }
  for (let i = 0; i < 30; i++) { stepCombat(C, FLAT, { x: 40, y: 0, z: 0 }, DT); kills += C.events.filter(e => e.kind === 'hit' && e.killed).length }
  ok(hit === 1 && kills === 1 && C.drops.length === 1 && C.hollows.length === 0, `finished by a spirit: hits ${hit}, kills ${kills}, drops ${C.drops.length}`)
  ok(F.spiritDealt === 3 && F.keeperDealt === 500, `only the health it had counts, and as hers (${F.spiritDealt} / ${F.keeperDealt})`)
}
// (7) aim + merge
{
  const C = newCombat(5), F = newSpiritFight(1), a = spawnHollow(C, FLAT, 0, -12), b = spawnHollow(C, FLAT, 8, -12)
  const d = Math.hypot(8, 0.8 - 1.62, -12)
  ok(sharedTarget(F, C, eye, { x: 8 / d, y: (0.8 - 1.62) / d, z: -12 / d }) === b, 'no hit yet: the one aimed at'); F.t = 1; F.target = a.id; F.targetT = 1
  ok(sharedTarget(F, C, eye, { x: 8 / d, y: (0.8 - 1.62) / d, z: -12 / d }) === a, 'a fresh hit beats the aim'); F.t = 1 + FIGHT.targetHold + 0.1
  ok(sharedTarget(F, C, eye, { x: 0, y: 1, z: 0 }) === null, 'a stale hit and no aim: no target')
  C.events = [{ kind: 'merge', id: b.id, gone: a.id, mass: 2, x: 0, z: 0 }]; noteKeeper(F, C, healthOf(C)); ok(F.target === b.id, 'the target pooled into another: that one is the target')
}
// (8) CANON: a Hollow can not touch a spirit: combat.ts / champion.ts know nothing of one (s1b: only a lure spot); unless she joins in, a Hollow walks the same beside three
{
  for (const f of ['combat.ts', 'champion.ts']) ok(!/spirit-f(ight|ollow)|spiritLive|liveSpirits/.test(readFileSync(new URL(`../ather/${f}`, import.meta.url), 'utf8')), `${f} never sees a spirit`)
  const walk = (near: boolean) => { const C = newCombat(6), F = newSpiritFight(1), h = spawnHollow(C, FLAT, 3, -14); h.state = 'chase'
    for (let t = 0; t < 4; t += DT) { stepSpirits(F, C, feet, eye, { x: 0, y: 1, z: 0 }, near ? [0, 1, 2].map(i => ({ id: 'p' + i, x: h.x + 0.2 * i, z: h.z })) : [], DT); stepCombat(C, FLAT, feet, DT) } return [h.x, h.z, C.keeper.hp] }
  ok(JSON.stringify(walk(true)) === JSON.stringify(walk(false)), 'a Hollow with three spirits in its face walks exactly as if alone')
  ok(SHAMBLER.hp === 45, 'sized against the 45 hp shambler')
}
// (9) the switch: one, ON FOR EVERY KEEPER (★ MOVED 11-24, Alex's flip: it was the owner check), and off = no brain
{
  const w = readFileSync(new URL('../ather/wilds-spirits.tsx', import.meta.url), 'utf8'), l = readFileSync(new URL('../ather/combat-layer.tsx', import.meta.url), 'utf8'), p = readFileSync(new URL('../ather/page.tsx', import.meta.url), 'utf8')
  ok(/export function useSpiritFight\(\): boolean \{ return true \}/.test(w) && !/useIsOwner/.test(w), 'the switch is on for every keeper, no owner check')
  ok(/spirits = false/.test(l) && /if \(!spirits\) return/.test(l) && /spirits=\{spiritFight\}/.test(p) && /\{spiritFight && terrain/.test(p), 'brain and bodies both hang on it')
}
// (10) the newcomer sim: off = today's numbers; with a trio the 6% rule still holds and their part is small
{
  const seeds = Array.from({ length: 200 }, (_, i) => 1001 + i * 13)
  // M151 (Alex 11-25): the shipped newcomer (held Repeater at 0.22) dies 1 in 200, alone and with a trio: too few to weigh the trio by.
  // Alex 11-25 re-pinned after M163 / M177: M163's leg ball took it to 0 / 0, M177's faster rounds (Repeater 40 -> 72 m/s) to
  // 2 / 1 (600 seeds: 5 / 1, the same rate). Was 1 / 1.
  const now = summarise(seeds.map(s => championFight(s, 3))); SIM.trio = true; const nowT = summarise(seeds.map(s => championFight(s, 3))); SIM.trio = false
  console.log(`  M151 as shipped: champion + brood died ${now.died}/200 ${now.secs}s, with a trio ${nowT.died}/200`); ok(now.died === 2 && nowT.died === 1, `M151: ${now.died} / ${nowT.died} (Alex 11-25 re-pinned after M163 / M177: 2 / 1)`)
  for (const k of Object.keys(SIM.ran) as (keyof typeof SIM.ran)[]) SIM.ran[k] = k === 'chaseMin' ? Infinity : 0
  // the trio's weight is measured on the harder fight, the gun before M151 (tapped, 0.16 s)
  const rep = RANGE_GUNS.find(g => g.id === 'repeater')!, cd = rep.fireCd, hold = M151.hold; rep.fireCd = 0.16; M151.hold = []
  const off = summarise(seeds.map(s => championFight(s, 3))); ok(off.died === 9, `trio off: champion + brood deaths ${off.died}/200 (was 9)`)
  SIM.trio = true
  const on = summarise(seeds.map(s => championFight(s, 3))); const R = SIM.ran, champ = { ...R }
  for (const k of Object.keys(R) as (keyof typeof R)[]) R[k] = k === 'chaseMin' ? Infinity : 0
  const pk = summarise(seeds.map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'floater']))), pack = { ...R }
  SIM.trio = false; rep.fireCd = cd; M151.hold = hold
  console.log(`  trio on: champion+brood died ${on.died}/200 (off ${off.died}), ${on.secs}s vs ${off.secs}s; pack of 4 died ${pk.died}/200, ${pk.secs}s`)
  for (const [n, r] of [['champion+brood', champ], ['pack of 4', pack]] as const) console.log(`  ${n}: spirits' damage ${(100 * r.spirits / r.keeper).toFixed(1)}% of the keeper's (worst fight ${(100 * r.worst).toFixed(1)}%), a fight: hit ${(r.hit / r.fights).toFixed(1)} mend ${(r.mend / r.fights).toFixed(1)} slow ${(r.slow / r.fights).toFixed(1)} nothing ${(r.nothing / r.fights).toFixed(1)} chases ${(r.chases / r.fights).toFixed(2)} (${(r.chaseSecs / Math.max(1, r.chases)).toFixed(1)} s each, closest ${r.chaseMin.toFixed(2)} m)`)
  ok(champ.chases > 20 && Math.min(champ.chaseMin, pack.chaseMin) > 2, `sim chases ${champ.chases}, closest ${Math.min(champ.chaseMin, pack.chaseMin).toFixed(2)} m: nobody was reached`)
  ok(on.died > 0 && on.died < off.died, `s1b: the trio helps and the danger stays (${on.died} / ${off.died})`)
  ok(on.died <= 12, `trio on: ${on.died}/200 within the 6% rule`); ok(champ.worst <= 0.15 && pack.worst <= 0.15, 'never past 15% of the keeper in any one fight')
}
// (11) s1b THE CHASE: a Hollow may chase a spirit and be drawn off by her; it never reaches her, then it is the keeper's again
{
  const K = { x: 0, z: 0 }
  // geometry: far from it, her spot is well off it and inside the tether, on her own side; too near, straight off it
  for (let a = 0; a < 6.28; a += 0.3) for (const r of [0.5, 3, 7, 12]) for (const side of [-1, 1]) {
    const h = { x: Math.sin(a) * r, z: Math.cos(a) * r }, p = leadSpot(K, h, { x: h.x + 5, z: h.z }, side)
    if (!(Math.hypot(p.x, p.z) <= FIGHT.stand + 1e-9 && Math.hypot(p.x - h.x, p.z - h.z) > 5)) ok(false, `leadSpot ${a}/${r}/${side}`)
    const q = leadSpot(K, h, { x: h.x + 0.6, z: h.z }, side); if (Math.hypot(q.x, q.z) > FIGHT.stand + 1e-9 || Math.hypot(q.x - h.x, q.z - h.z) < Math.min(0.6, r)) ok(false, `leadSpot near ${a}/${r}`)
  }
  ok(sideOf(K, { x: 0, z: -5 }, { x: 2, z: -4 }) !== sideOf(K, { x: 0, z: -5 }, { x: -2, z: -4 }), 'she keeps to her own side of it')
  { const C = newCombat(3), h = spawnHollow(C, FLAT, 0, -6), f = spawnHollow(C, FLAT, 2, -6, 'floater'), o = spawnHollow(C, FLAT, 5, -5); h.state = f.state = o.state = 'chase'
    ok(drawable(h) && !drawable(f) && !drawable(undefined), 'a walker may be drawn; a floater (it shoots) never')
    for (const st of ['wander', 'windup', 'lunge'] as const) { h.state = st; ok(!drawable(h), `not one in ${st}`) } h.state = 'chase'
    h.fx = { blinded: 1 }; ok(!drawable(h), 'not a blinded one'); h.fx = {}
    ok(whoTurns(C, K, { x: 1, z: -2 }, h) === o, 'the one the keeper is not shooting turns first'); o.state = 'wander'; ok(whoTurns(C, K, { x: 1, z: -2 }, h) === h, 'else the one she hit')
    h.z = -FIGHT.drawR - 1; ok(whoTurns(C, K, { x: 1, z: -9 }, h) === null, 'never one far from the keeper') }
  // combat.ts alone: a lure pulls a walker, which stops short, never winds up at it, and forgets the keeper no longer than the lure
  for (const kind of ['shambler', 'crawler'] as HollowKind[]) {
    const C = newCombat(6), h = spawnHollow(C, FLAT, 9, -9, kind), spot = { x: 14, z: -9 }; h.state = 'chase'; let min = 99, wound = 0
    for (let t = 0; t < 8; t += DT) { C.lures = new Map([[h.id, spot]]); stepCombat(C, FLAT, feet, DT); min = Math.min(min, Math.hypot(h.x - spot.x, h.z - spot.z)); if (h.state !== 'chase') wound++ }
    ok(min <= LURE_STOP && min > LURE_STOP - 0.1 && wound === 0 && C.keeper.hp === 100, `${kind}: comes to the lure, stops ${min.toFixed(2)} m short, never winds up`)
    C.lures = undefined; for (let t = 0; t < 12 && C.keeper.hp === 100; t += DT) stepCombat(C, FLAT, feet, DT); ok(C.keeper.hp < 100, `${kind}: the lure gone, it comes back and reaches the keeper`)
    const D = newCombat(6), g = spawnHollow(D, FLAT, 0.8, 0, kind); g.state = 'chase'; for (let t = 0; t < 3; t += DT) { D.lures = new Map([[g.id, { x: 14, z: 0 }]]); stepCombat(D, FLAT, feet, DT) }
    ok(D.keeper.hp < 100, `${kind}: a keeper in its way is still lunged at`)
  }
  { const run = (f: (C: Combat) => void) => { const C = newCombat(8); for (let i = 0; i < 5; i++) spawnHollow(C, FLAT, i * 2 - 4, -12, i === 4 ? 'floater' : i === 3 ? 'crawler' : 'shambler').state = 'chase'
      for (let t = 0; t < 12; t += DT) { f(C); stepCombat(C, FLAT, feet, DT) } return JSON.stringify([C.hollows, C.spits, C.keeper.hp]) }
    ok(run(() => {}) === run(C => { C.lures = new Map([[999, { x: 0, z: 0 }]]) }) && run(() => {}) !== run(C => { C.lures = new Map([[1, { x: 9, z: -9 }]]) }), 'no lure of its own: a Hollow moves byte for byte as before') }
  // the whole brain, live Hollows: she leads it, one at a time, inside the tether, for FIGHT.chase s; never reached; then back
  let chases = 0, min = 99, far = 0, two = 0, longest = 0, acted = 0, floats = 0, stale = 0, moved = 0, toKeeper = 0, hurtAt = 0, leftover = 0
  for (let seed = 1; seed <= 40; seed++) {
    const C = newCombat(seed), F = newSpiritFight(seed), at = [0, 1, 2].map(i => ({ id: 'p' + i, x: i - 1, z: 2 })), T: Record<string, number> = {}
    const hs = (['shambler', 'shambler', 'crawler', 'floater'] as HollowKind[]).map((k, i) => { const h = spawnHollow(C, FLAT, i * 3 - 4, -11, k); h.state = 'chase'; h.hp = h.maxHp = 1e4; return h })
    let next = 0.3, wasLured = new Map<number, number>()
    for (let t = 0; t < 40; t += DT) {
      C.keeper.hp = 100; const before = healthOf(C)
      for (const s of at) { const g = F.slots.get(s.id) ?? { x: +s.id[1] - 1, z: 2 }, d = Math.hypot(g.x - s.x, g.z - s.z), m = Math.min(d, 6 * DT); if (d > 0) { s.x += (g.x - s.x) / d * m; s.z += (g.z - s.z) / d * m } }
      const pos = new Map(hs.map(h => [h.id, [h.x, h.z]])), done = stepSpirits(F, C, feet, eye, aim, at, DT)
      const on = [...F.minds].filter(([, m]) => m.chase); if (on.length > 1) two++
      for (const [id, m] of on) { T[id] = (T[id] ?? 0) + DT; longest = Math.max(longest, T[id]); if (done.some(d => d.id === id) && T[id] > 2 * DT) acted++ } for (const s of at) if (!F.minds.get(s.id)?.chase) T[s.id] = 0
      for (const id of C.lures?.keys() ?? []) { const h = C.hollows.find(q => q.id === id)!; if (h.kind === 'floater') floats++; if (!on.some(([, m]) => m.chase!.id === id)) { stale++; continue }
        const s = at.find(q => F.minds.get(q.id)?.chase?.id === id)!; min = Math.min(min, Math.hypot(s.x - h.x, s.z - h.z)); wasLured.set(id, t) }
      if (t >= next) { next += 0.5; const A = hs[0]; C.rounds.push({ x: A.x, y: 0.85, z: A.z + 0.8, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 10 }) }
      stepCombat(C, FLAT, feet, DT); noteKeeper(F, C, before)
      if (C.keeper.hp < 100) hurtAt++
      for (const h of hs) { const p = pos.get(h.id)!, l = wasLured.get(h.id), d1 = Math.hypot(h.x, h.z), d0 = Math.hypot(p[0], p[1]); if (C.lures?.has(h.id) && h.state === 'chase' && Math.hypot(h.x - p[0], h.z - p[1]) > 1e-6) moved++
        if (l !== undefined && t - l > 0.1 && t - l < 2 && h.state === 'chase' && d1 < d0) toKeeper++ }
      far = Math.max(far, ...at.map(s => Math.hypot(s.x, s.z)))
    }
    chases += F.seen.chases
    C.hollows = []; stepSpirits(F, C, feet, eye, aim, at, DT); if (C.lures) leftover++
  }
  ok(chases > 10 && moved > 100, `chases happen (${chases}; ${moved} frames on the move)`)
  ok(min > 1.6, `the Hollow chasing her never gets nearer than ${min.toFixed(2)} m`)
  ok(longest <= FIGHT.chase + 2 * DT, `a chase ends (longest ${longest.toFixed(2)} s, dial ${FIGHT.chase})`); ok(toKeeper > 20, `and it goes back to the keeper (${toKeeper} frames)`)
  ok(two === 0 && acted === 0 && floats === 0 && stale === 0 && leftover === 0, `one at a time, no helping meanwhile, no floater, no stale lure (${two} ${acted} ${floats} ${stale} ${leftover})`)
  ok(far <= FIGHT.tether, `inside the 10 m tether (${far.toFixed(1)})`); ok(hurtAt > 20, `the keeper is still in danger (${hurtAt} blows)`)
  // past the tether the chase is dropped; a party fight (no brain) drops it too
  { let sy = 1; while (!joins('p0', 1, sy)) sy++; const C = newCombat(2), F = newSpiritFight(sy), h = spawnHollow(C, FLAT, 0, -6); h.state = 'chase'
    stepSpirits(F, C, feet, eye, aim, [{ id: 'p0', x: 0, z: -2 }], DT); F.minds.get('p0')!.chase = { id: h.id, t: 3, side: 1 }
    stepSpirits(F, C, feet, eye, aim, [{ id: 'p0', x: 0, z: -2 }], DT); ok(!!C.lures?.has(h.id), 'the lure is laid')
    stepSpirits(F, C, feet, eye, aim, [{ id: 'p0', x: 0, z: 10.5 }], DT); ok(!C.lures && F.minds.get('p0')!.chase === null, 'past the tether: no chase') }
  const l = readFileSync(new URL('../ather/combat-layer.tsx', import.meta.url), 'utf8')
  ok((l.match(/c\.current\.lures = undefined/g) ?? []).length === 2, 'the brain off or unmounted: no lure is left behind')
}
console.log(`spirit-fight: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
