// npx tsx src/app/shimmer/open/ather/wilds-merge.test.ts
// BETA M120 s2: THE MERGING HOLLOW (canon c01931e: grey that meets grey pools; mass + strength add, endlessly; drained ground
// only; a round still disperses it). The crawler kind, its pooling, its scaling, and the keeper rule in the offline sim.
import { newCombat, spawnHollow, stepCombat, populate, walkerOf, crawlerScale, crawlerGrowth, weightOf, CRAWLER, type Combat, type Hollow } from './combat'
import { encodeSnap, applySnap } from '../shared/fight-share'
import { FLAT, championFight, packFight, summarise } from './wilds-sim'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const DT = 1 / 60, far = { x: 500, y: 0, z: 500 }
const run = (c: Combat, secs: number, feet = far) => { for (let t = 0; t < secs; t += DT) stepCombat(c, FLAT, feet, DT) }
const pair = (drained: ((x: number, z: number) => boolean) | undefined, kinds: ['crawler' | 'shambler', 'crawler' | 'shambler'] = ['crawler', 'crawler']) => {
  const c = newCombat(3); c.drained = drained
  const a = spawnHollow(c, FLAT, 0, 0, kinds[0]), b = spawnHollow(c, FLAT, 0.8, 0, kinds[1])
  a.state = b.state = 'stagger'; a.t = b.t = 99   // hold them still: only the merge is under test
  return { c, a, b }
}

// (1) two crawlers touching on drained ground POOL: one body, mass 2, hp + maxHp summed, strength summed, bigger body
{
  const { c, a, b } = pair(() => true)
  const hp = a.hp + b.hp
  run(c, 0.1)
  const m = c.hollows[0]
  ok(c.hollows.length === 1, `two touching crawlers became one (${c.hollows.length} bodies)`)
  ok(m?.mass === 2 && m.hp === hp && m.maxHp === 2 * CRAWLER.hp, `mass ${m?.mass}, hp ${m?.hp}/${m?.maxHp} (want 2, ${hp}/${2 * CRAWLER.hp})`)
  ok(m && walkerOf(m).damage === 2 * CRAWLER.damage, `strength added: hits for ${m && walkerOf(m).damage} (one alone: ${CRAWLER.damage})`)
  ok(m && crawlerScale(m.mass) > 1.2 * crawlerScale(1) && walkerOf(m).radius > CRAWLER.radius * crawlerScale(1), `body grew x${m && (crawlerScale(m.mass) / crawlerScale(1)).toFixed(2)} over a lone one`)
  ok(c.merges === 1, `merge counted (${c.merges})`)
}

// (2) OFF drained ground they do not pool (cleared country), nor when the page has said nothing; a shambler never pools
{
  const off = pair(() => false); run(off.c, 0.5)
  ok(off.c.hollows.length === 2 && !off.c.merges, 'two crawlers on cleared ground stay two')
  const none = pair(undefined); run(none.c, 0.5)
  ok(none.c.hollows.length === 2, 'no drained map: no pooling')
  const half = pair((x) => x < 0.4); run(half.c, 0.5)
  ok(half.c.hollows.length === 2, 'one of the two off drained ground: no pooling')
  const mixed = pair(() => true, ['crawler', 'shambler']); run(mixed.c, 0.5)
  ok(mixed.c.hollows.length === 2, 'a crawler and a shambler never pool')
}

// (3) an idle brood on drained ground finds itself: three strays 6 m apart pool into one of mass 3 (endless: a fourth adds on)
{
  const c = newCombat(5); c.drained = () => true
  for (let i = 0; i < 3; i++) spawnHollow(c, FLAT, i * 6, 0, 'crawler')
  run(c, 20)
  ok(c.hollows.length === 1 && c.hollows[0].mass === 3 && c.hollows[0].hp === 3 * CRAWLER.hp, `a brood of 3 pooled to ${c.hollows.map(h => `mass ${h.mass} hp ${h.hp}`).join(', ')}`)
  spawnHollow(c, FLAT, c.hollows[0].x + 5, c.hollows[0].z, 'crawler'); run(c, 15)
  ok(c.hollows.length === 1 && c.hollows[0].mass === 4, `a fourth adds on (mass ${c.hollows.map(h => h.mass).join(',')})`)
  // the same brood on cleared ground does not seek: three stay three
  const q = newCombat(5); q.drained = () => false
  for (let i = 0; i < 3; i++) spawnHollow(q, FLAT, i * 6, 0, 'crawler')
  run(q, 20)
  ok(q.hollows.length === 3, `on cleared ground the brood stays apart (${q.hollows.length})`)
}

// (4) the speed tradeoff: a mass-4 one closes slower than a lone one, and flinches less
{
  const closing = (mass: number) => {
    const c = newCombat(8), h = spawnHollow(c, FLAT, 18, 0, 'crawler'); h.mass = mass; h.state = 'chase'
    const d0 = Math.hypot(h.x, h.z); run(c, 2, { x: 0, y: 0, z: 0 }); return (d0 - Math.hypot(h.x, h.z)) / 2
  }
  const v1 = closing(1), v4 = closing(4)
  ok(v1 > 1.8 && v4 < v1 * 0.8 && v4 > 1, `closing speed mass 1 ${v1.toFixed(2)} m/s, mass 4 ${v4.toFixed(2)} m/s`)
  const h4 = { kind: 'crawler', mass: 4 } as Hollow
  ok(walkerOf(h4).stagger < CRAWLER.stagger / 2, 'a big one barely flinches')
}

// (5) the tapered scale: readable at any size (monotone, log, capped)
{
  const s = [1, 2, 4, 8, 32, 1000].map(crawlerScale)
  ok(s.every((v, i) => i === 0 || v > s[i - 1] || v === CRAWLER.scaleBase * CRAWLER.scaleMax) && s[2] < 2 * s[0] && s[5] <= CRAWLER.scaleBase * CRAWLER.scaleMax, `scale ${s.map(v => v.toFixed(2)).join(' / ')}`)
}

// (5b) M122 (Alex 11-24): a lone crawler STARTS at HALF the M120 size (1 -> 0.5); the merge curve multiplies from that base,
// so mass 2/3 still read bigger than mass 1, and the hit radius + reach follow the body
{
  const old = (m: number) => Math.min(4, 1 + 0.55 * Math.log(Math.max(1, m)))   // the M120 s2 curve, frozen here
  ok(crawlerScale(1) === 0.5 && crawlerScale(1) === old(1) / 2, `mass-1 crawler is half the old size (${crawlerScale(1)} vs ${old(1)})`)
  ok([2, 3, 8].every(m => Math.abs(crawlerScale(m) - old(m) / 2) < 1e-12), `every mass is half its old size (2: ${crawlerScale(2).toFixed(3)}, 3: ${crawlerScale(3).toFixed(3)})`)
  ok(crawlerScale(2) > crawlerScale(1) && crawlerScale(3) > crawlerScale(2), 'mass 2 and 3 still read bigger than mass 1')
  const lone = { kind: 'crawler', mass: 1 } as Hollow
  ok(Math.abs(walkerOf(lone).radius - CRAWLER.radius / 2) < 1e-12 && Math.abs(walkerOf(lone).hitReach - CRAWLER.hitReach / 2) < 1e-12 && Math.abs(walkerOf(lone).lungeRange - CRAWLER.lungeRange / 2) < 1e-12, `footprint ${walkerOf(lone).radius} + reach ${walkerOf(lone).hitReach} + lunge follow the body`)
  ok(crawlerGrowth(1) === 1 && [2, 3, 8].every(m => crawlerGrowth(m) === old(m)), 'shot sphere + pooling touch keep the M120 curve (keeper rule, see combat.ts)')
}

// (6) a round DISPERSES it however big: a mass-6 crawler is shot until it ends; nothing splits off
{
  const c = newCombat(4); c.drained = () => true
  const h = spawnHollow(c, FLAT, 0, -8, 'crawler'); h.mass = 6; h.hp = h.maxHp = 6 * CRAWLER.hp; h.state = 'stagger'; h.t = 99
  let killed = false, shots = 0
  const y = h.y + CRAWLER.bodyY * crawlerScale(6)
  for (let i = 0; i < 200 && !killed; i++) {
    c.rounds.push({ x: 0, y, z: -1, vx: 0, vy: 0, vz: -80, life: 1, dmg: 12, crit: 24 }); shots++
    for (let k = 0; k < 4; k++) { stepCombat(c, FLAT, { x: 0, y: 0, z: 0 }, DT); if (c.events.some(e => e.kind === 'hit' && e.killed)) killed = true }
  }
  ok(killed && c.hollows.length === 0, `dispersed after ${shots} rounds; ${c.hollows.length} left (no split)`)
  ok(shots >= Math.ceil(6 * CRAWLER.hp / 12) - 1, `it took its summed hp to disperse (${shots} rounds of 12)`)
  ok(c.drops.length === 1 && c.drops[0].amount >= 6, `it leaves grey matter by its mass (${c.drops[0]?.amount})`)
}

// (7) the perf bound: populate counts a crawler by its MASS, so pooling never pulls fresh spawns in
{
  const c = newCombat(9); c.drained = () => true
  const big = spawnHollow(c, FLAT, 60, 0, 'crawler'); big.mass = 6
  populate(c, FLAT, 0, 0, 7)
  const weight = c.hollows.reduce((a, h) => a + weightOf(h), 0)
  ok(weight <= 7 && c.hollows.length <= 2, `a mass-6 one near the keeper: populate topped up to weight ${weight} (${c.hollows.length} bodies)`)
  // over a long run with broods, the body count never climbs past the target
  const d = newCombat(21); d.drained = () => true
  let maxN = 0, sawCrawler = false
  for (let t = 0; t < 90; t += DT) { if (Math.round(t * 60) % 90 === 0) populate(d, FLAT, 0, 0, 11); stepCombat(d, FLAT, far, DT); maxN = Math.max(maxN, d.hollows.length); sawCrawler ||= d.hollows.some(h => h.kind === 'crawler') }
  ok(sawCrawler && maxN <= 11, `90 s of top-ups: crawler broods spawn (${sawCrawler}), bodies peak at ${maxN} (target 11)`)
}

// (8) a guest draws the same size: mass rides the fight-share snapshot
{
  const c = newCombat(2); const h = spawnHollow(c, FLAT, 3, 0, 'crawler'); h.mass = 5
  const g = newCombat(2); applySnap(g, FLAT, encodeSnap(c, { x: 0, z: 0 }))
  ok(g.hollows[0]?.kind === 'crawler' && g.hollows[0]?.mass === 5, `guest sees ${g.hollows[0]?.kind} mass ${g.hollows[0]?.mass}`)
}

// (9) THE KEEPER RULE (09-24) in the offline sim: a brood pooling on the node's ground must not make the first champion a wall.
// Without crawlers (s1): 193/200. A newcomer also clears a pooled brood.
{
  const seeds = Array.from({ length: 200 }, (_, i) => 1001 + i * 13)
  const champ = summarise(seeds.map(s => championFight(s, 3)))
  const brood = summarise(seeds.slice(0, 60).map(s => packFight(s, ['crawler', 'crawler', 'crawler', 'crawler'], undefined, true)))
  console.log(`  sim champion + 3 crawlers: ${JSON.stringify(champ)}\n  sim 4 crawlers pooling  : ${JSON.stringify(brood)}`)
  ok(champ.died / champ.n <= 0.06, `champion + pooled brood deaths ${champ.died}/${champ.n} (at most 6%)`)
  ok(brood.died === 0 && brood.cleared === brood.n, 'a newcomer died to a pooled brood')
}

console.log(`wilds-merge: ${pass}/${fail}`)
if (fail) process.exit(1)
