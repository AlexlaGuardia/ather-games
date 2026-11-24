// npx tsx src/app/shimmer/open/ather/wilds-teeth.test.ts
// BETA M120 s1 (Alex 11-24 'the wilds rn are pretty tame'): Hollows in PACKS, more HP, a faster shambler, the floater's
// zip-zip-hold-burst whose shots SPLASH; and the 09-24 keeper rule kept honest in the offline sim (wilds-sim.ts).
import { newCombat, spawnHollow, stepCombat, populate, groupPack, SHAMBLER, FLOATER, PACK, type Combat, type Hollow } from './combat'
import { WAVE_HP } from './champion'
import { weaponDef } from '../../engine/weapons'
import { FLAT, packFight, championFight, summarise } from './wilds-sim'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const DT = 1 / 60
const far = { x: 500, y: 0, z: 500 }
const centroid = (hs: Hollow[]) => ({ x: hs.reduce((a, h) => a + h.x, 0) / hs.length, z: hs.reduce((a, h) => a + h.z, 0) / hs.length })

// (1) populate spawns PACKS: every stray belongs to one, 3-5 strong (a top-up may be short), clumped, at most one floater each
{
  const c = newCombat(41)
  populate(c, FLAT, 0, 0, 11)
  const packs = new Map<number, Hollow[]>()
  for (const h of c.hollows) { ok(!!h.pack, `stray ${h.id} has no pack`); packs.set(h.pack!, [...(packs.get(h.pack!) ?? []), h]) }
  ok(c.hollows.length === 11, `populate filled to 11 (${c.hollows.length})`)
  ok(packs.size >= 2 && packs.size <= 4, `11 Hollows came as 2-4 packs (${packs.size})`)
  for (const ms of packs.values()) {
    ok(ms.length <= PACK.max, `a pack of ${ms.length} (max ${PACK.max})`)
    ok(ms.filter(h => h.kind === 'floater').length <= PACK.floaters, 'a pack with more than one floater')
    const m = centroid(ms)
    ok(ms.every(h => Math.hypot(h.x - m.x, h.z - m.z) < PACK.spread + 1.5), 'a pack member spawned away from its pack')
  }
  ok([...packs.values()].filter(ms => ms.length >= PACK.min).length >= packs.size - 1, 'more than one short pack')
}

// (2) a pack MOVES TOGETHER: unnoticed, it drifts as one (its heading moves; nobody strays from the clump)
{
  const c = newCombat(7)
  const ids = [0, 1, 2, 3].map(i => spawnHollow(c, FLAT, i * 1.5, (i % 2) * 1.5, i === 3 ? 'floater' : 'shambler').id)
  groupPack(c, ids)
  const c0 = centroid(c.hollows)
  let spreadMax = 0
  for (let t = 0; t < 40; t += DT) {
    stepCombat(c, FLAT, far, DT)
    const m = centroid(c.hollows); spreadMax = Math.max(spreadMax, ...c.hollows.map(h => Math.hypot(h.x - m.x, h.z - m.z)))
  }
  const c1 = centroid(c.hollows)
  ok(Math.hypot(c1.x - c0.x, c1.z - c0.z) > 4, `the pack went somewhere in 40 s (${Math.hypot(c1.x - c0.x, c1.z - c0.z).toFixed(1)} m)`)
  ok(spreadMax < PACK.spread + 4, `and kept together (a member strayed ${spreadMax.toFixed(1)} m from the middle)`)
  // control: the same four as loose strays scatter (the test can see the difference)
  const u = newCombat(7); [0, 1, 2, 3].forEach(i => spawnHollow(u, FLAT, i * 1.5, (i % 2) * 1.5, i === 3 ? 'floater' : 'shambler'))
  let uMax = 0
  for (let t = 0; t < 40; t += DT) { stepCombat(u, FLAT, far, DT); const m = centroid(u.hollows); uMax = Math.max(uMax, ...u.hollows.map(h => Math.hypot(h.x - m.x, h.z - m.z))) }
  ok(uMax > spreadMax + 2, `control: loose strays drift apart (${uMax.toFixed(1)} vs pack ${spreadMax.toFixed(1)})`)
}

// (3) one member notices the keeper: the WHOLE pack comes (the rest are past notice range, inside forget)
{
  const c = newCombat(3)
  const near = spawnHollow(c, FLAT, 20, 0), back = [spawnHollow(c, FLAT, 28, 2), spawnHollow(c, FLAT, 29, -2)]
  groupPack(c, [near.id, ...back.map(h => h.id)])
  const feet = { x: 0, y: 0, z: 0 }
  for (let i = 0; i < 3; i++) stepCombat(c, FLAT, feet, DT)
  ok(back.every(h => Math.hypot(h.x, h.z) > SHAMBLER.notice - 0.5), 'setup: the back two are past notice range')
  ok(c.hollows.every(h => h.state === 'chase'), `the whole pack is on the keeper (${c.hollows.map(h => h.state).join(',')})`)
  const lone = newCombat(3); spawnHollow(lone, FLAT, 20, 0); const lb = spawnHollow(lone, FLAT, 28, 2)
  for (let i = 0; i < 3; i++) stepCombat(lone, FLAT, feet, DT)
  ok(lb.state === 'wander', 'control: an unpacked stray that far does not come')
}

// (4) the shambler is faster (old chase 1.7 m/s): measured closing speed on flat ground
{
  const c = newCombat(5), h = spawnHollow(c, FLAT, 20, 0); h.state = 'chase'
  const d0 = Math.hypot(h.x, h.z)
  for (let t = 0; t < 3; t += DT) stepCombat(c, FLAT, { x: 0, y: 0, z: 0 }, DT)
  const v = (d0 - Math.hypot(h.x, h.z)) / 3
  ok(v > 1.7 * 1.08, `shambler closes at ${v.toFixed(2)} m/s (was ~1.7)`)
}

// (5) HP raised: a Repeater body shot no longer drops a shambler in three, nor a floater in two
{
  const r = weaponDef('repeater')!
  ok(Math.ceil(SHAMBLER.hp / r.damage) >= 4 && Math.ceil(FLOATER.hp / r.damage) >= 3, `body shots to kill: shambler ${Math.ceil(SHAMBLER.hp / r.damage)}, floater ${Math.ceil(FLOATER.hp / r.damage)}`)
  ok(WAVE_HP.shambler < SHAMBLER.hp, 'a champion wave add keeps the old body (the keeper rule)')
}

// (6) the floater ZIPS 2-3 spots, then holds and fires a 3-shot burst
const floaterRun = (seed: number) => {
  const c = newCombat(seed), f = spawnHollow(c, FLAT, 14, 0, 'floater'); f.state = 'chase'; f.t = 0
  const feet = { x: 0, y: 0, z: 0 }
  let zips = 0, wasZip = false, firstSpit = -1, spitsAt: number[] = [], minD = Infinity, fastest = 0
  for (let t = 0; t < 12; t += DT) {
    const x0 = f.x, z0 = f.z, n0 = c.spits.length
    stepCombat(c, FLAT, feet, DT)
    fastest = Math.max(fastest, Math.hypot(f.x - x0, f.z - z0) / DT)
    const zipping = f.zx !== undefined
    if (wasZip && !zipping && firstSpit < 0) zips++
    wasZip = zipping
    if (c.spits.length > n0) { spitsAt.push(t); if (firstSpit < 0) firstSpit = t }
    minD = Math.min(minD, Math.hypot(f.x, f.z))
    c.keeper.hp = 100   // keep the target alive; only the floater is under test
  }
  return { zips, spitsAt, minD, fastest }
}
{
  const runs = [11, 12, 13, 14, 15].map(floaterRun)
  ok(runs.every(r => r.zips >= 2 && r.zips <= 3), `zips before the first burst: ${runs.map(r => r.zips).join(',')} (want 2-3)`)
  ok(runs.every(r => r.fastest > FLOATER.speed * 2.5), `a zip is FAST (top ${runs.map(r => r.fastest.toFixed(1)).join(',')} m/s)`)
  ok(runs.every(r => r.spitsAt.length >= 3 && r.spitsAt[2] - r.spitsAt[0] < 0.7), `a 3-shot burst (${runs.map(r => r.spitsAt.slice(0, 3).map(t => t.toFixed(2)).join('/')).join(' ')})`)
  ok(runs.every(r => r.minD > 6), `it still keeps its distance (closest ${Math.min(...runs.map(r => r.minD)).toFixed(1)} m)`)
}

// (7) each shot SPLASHES where it lands: a near miss at the keeper's feet still stings; a far one does not
const landAt = (off: number) => {
  const c: Combat = newCombat(9), feet = { x: 0, y: 0, z: 0 }
  c.spits.push({ x: off, y: 0.4, z: -2, vx: 0, vy: -1, vz: 4, life: 3, dmg: FLOATER.damage, splash: FLOATER.splash })
  const evs: string[] = []
  for (let t = 0; t < 1.5; t += DT) { stepCombat(c, FLAT, feet, DT); for (const e of c.events) evs.push(e.kind) }
  return { lost: 100 - c.keeper.hp, splashed: evs.includes('splash') }
}
{
  const nearMiss = landAt(1.1), wide = landAt(FLOATER.splashR + 1.2)
  ok(nearMiss.splashed && nearMiss.lost === FLOATER.splash, `a near miss splashes the keeper for ${FLOATER.splash} (lost ${nearMiss.lost})`)
  ok(wide.splashed && wide.lost === 0, `a wide one splashes the ground only (lost ${wide.lost})`)
  // a champion's volley spit carries no splash: it is not the floater's
  const c = newCombat(9); c.spits.push({ x: 1.1, y: 0.4, z: -2, vx: 0, vy: -1, vz: 4, life: 3, dmg: 10 })
  for (let t = 0; t < 1.5; t += DT) stepCombat(c, FLAT, { x: 0, y: 0, z: 0 }, DT)
  ok(c.keeper.hp === 100, 'a spit with no splash does not splash')
}

// (8) THE KEEPER RULE (09-24) in the offline sim: a newcomer (wilds-sim BOT, Repeater, hip fire) clears a pack and the
// first champion, dying only occasionally. Pre-M120 measure (HEAD 387b0fc6, 200 seeds): champion 199/200, 1 death.
{
  const seeds = Array.from({ length: 200 }, (_, i) => 1001 + i * 13)
  const pack = summarise(seeds.slice(0, 60).map(s => packFight(s, ['shambler', 'shambler', 'shambler', 'floater'], groupPack)))
  const champ = summarise(seeds.map(s => championFight(s)))
  console.log(`  sim pack 3S+1F: ${JSON.stringify(pack)}\n  sim champion  : ${JSON.stringify(champ)}`)
  ok(pack.died === 0 && pack.cleared === pack.n, 'a newcomer died to a single pack')
  ok(pack.secs > 7, `a pack is no longer a 5 s walkover (${pack.secs} s)`)
  ok(champ.died / champ.n <= 0.06, `champion deaths ${champ.died}/${champ.n} (occasional = at most 6%)`)
}

console.log(`wilds-teeth: ${pass}/${fail}`)
if (fail) process.exit(1)
