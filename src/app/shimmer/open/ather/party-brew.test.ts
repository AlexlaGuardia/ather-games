// party-brew.ts: a brewing's claims, dependency order, the curve, the split and the per-hand boon roll.
import { openBrewing, join, claim, openSteps, pool, pourReady, pour, yieldMult, totalBottles, contribution, busy, MAX_HANDS, adoptBrewing, hostClaim, stepViews, isClaim, isGrant, isPour, type Brewing } from './party-brew'
import { ALC_POTIONS, potionId } from './alchemy-set'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

const H = ALC_POTIONS.health   // crush(0) ‖ steep(1) -> still(2, needs steep) -> desk(3, needs dust + extract)
const T = (k: number) => H.steps[k].ms
const bag = { shimmerscale: 4, 'crop:goldleaf:A': 2, 'crop:dewdrop_vine:A': 2 }
const scale = { shimmerscale: 2 }, crops = { 'crop:goldleaf:A': 2, 'crop:dewdrop_vine:A': 2 }

// ── the curve: solo = makes, more hands more bottles, diminishing, flattening near four
ok(yieldMult(1) === 1 && totalBottles(H.makes, 1) === H.makes, 'solo pours exactly a solo brew (the host never loses)')
{ const g = [1, 2, 3, 4, 5, 6].map(yieldMult), d = g.slice(1).map((v, i) => v - g[i])
  ok(d.every((x, i) => x > 0 && (i === 0 || x < d[i - 1])), `rising with diminishing steps (${g.map(v => v.toFixed(2)).join(' ')})`)
  ok(d[3] < 0.15 && d[4] < 0.1, `flattens near four (+${d[3].toFixed(2)} at 5, +${d[4].toFixed(2)} at 6)`) }
for (let n = 1; n <= MAX_HANDS; n++) ok(totalBottles(H.makes, n) >= n, `every hand gets a bottle at ${n} hands (${totalBottles(H.makes, n)})`)

// ── claims: dependency order, own bag, one step at a time
{ let b = openBrewing('host', 'health')!
  ok(openBrewing('host', 'nope') === null, 'an unknown potion does not open')
  b = join(join(b, 'g1'), 'g1')
  ok(b.hands.join() === 'host,g1', 'join once')
  ok(openSteps(b, 0).join() === '0,1', `open at start: crush and steep side by side (${openSteps(b, 0)})`)
  ok(claim(b, 'stranger', 0, bag, 0) === null, 'a hand not in the brewing cannot claim')
  ok(claim(b, 'host', 2, bag, 0) === null, 'the still is not open before the steep is made')
  const c0 = claim(b, 'g1', 0, scale, 0)!
  ok(!!c0 && c0.spend.length === 1 && c0.spend[0].id === 'shimmerscale' && c0.spend[0].n === 2, 'the guest crushes from ITS bag')
  b = c0.b
  ok(claim(b, 'g1', 1, crops, 1) === null && busy(b, 'g1', 1), 'one step per hand at a time')
  ok(claim(b, 'host', 0, bag, 1) === null, 'a claimed step cannot be claimed twice')
  ok(claim(b, 'host', 1, { 'crop:goldleaf:A': 1 }, 1) === null, 'a short bag cannot claim')
  b = claim(b, 'host', 1, crops, 0)!.b
  ok(openSteps(b, T(1) - 1).length === 0, 'nothing new opens before the steep is done')
  ok(openSteps(b, T(1)).join() === '2', `the still opens when the steep is made (${openSteps(b, T(1))})`)
  ok(Object.keys(pool(b, T(1))).some(id => id.startsWith('alc:goldleaf_steep')), 'the steep sits in the shared pool')
  // the guest (free again) runs the still from the POOL, spending nothing of its own
  const c2 = claim(b, 'g1', 2, {}, T(1))!
  ok(!!c2 && c2.spend.length === 0, 'an intermediate step spends from the pool, not the bag')
  b = c2.b
  ok(!Object.keys(pool(b, T(1))).some(id => id.startsWith('alc:goldleaf_steep') && pool(b, T(1))[id] > 0), 'the pool steep was used up')
  const t3 = T(1) + T(2)
  ok(openSteps(b, t3).join() === '3', 'the Desk opens once dust and extract are made')
  ok(!pourReady(b, t3), 'no pour before the Desk step')
  b = claim(b, 'host', 3, {}, t3)!.b
  ok(!pourReady(b, t3 + T(3) - 1) && pourReady(b, t3 + T(3)), 'the pour is ready when the Desk step finishes')
  // ── the pour: every hand a bottle, the rest by contribution, the boon once per hand
  const c = contribution(b)
  ok(c.g1.steps === 2 && c.g1.gave === 2 && c.host.steps === 2 && c.host.gave === 4, `contribution counted (${JSON.stringify(c)})`)
  const p = pour(b, t3 + T(3), 0)!
  const total = totalBottles(H.makes, 2)
  ok(p.bottle === potionId('health', 'A') || p.bottle.startsWith('potion:health:'), `the bottle is graded health (${p.bottle})`)
  ok(p.per.host + p.per.g1 === total && p.per.host >= 1 && p.per.g1 >= 1, `two hands split ${total}: host ${p.per.host}, guest ${p.per.g1}`)
  ok(p.per.host >= p.per.g1, 'the host gave more units, so it is not behind')
  ok(pour(p.b, t3 + T(3)) === null && openSteps(p.b, t3 + T(3)).length === 0, 'a brewing pours once')
  // boon: one roll per hand, hits add one each
  let rolls = 0; const r = pour(b, t3 + T(3), 0.25, () => { rolls++; return rolls === 1 ? 0.1 : 0.9 })!
  ok(rolls === 2 && r.extra.host === 1 && r.extra.g1 === 0 && r.per.host === p.per.host + 1, `boon: one roll per hand (${rolls}), the hit adds one`)
  ok(pour(b, t3 + T(3), 0, () => 0)!.extra.host === 0, 'no alchemist (chance 0) never adds') }

// ── a hand that brought nothing and ran nothing still leaves with a bottle (more, never only)
{ let b: Brewing = join(openBrewing('host', 'health')!, 'idle')
  const t1 = T(0), t2 = t1 + T(1), t3 = t2 + T(2)
  b = claim(b, 'host', 0, bag, 0)!.b; b = claim(b, 'host', 1, bag, t1)!.b
  b = claim(b, 'host', 2, {}, t2)!.b; b = claim(b, 'host', 3, {}, t3)!.b
  const p = pour(b, t3 + T(3))!
  ok(p.per.idle === 1 && p.per.host === totalBottles(H.makes, 2) - 1 && p.per.host >= H.makes, `the idle hand gets 1, the host keeps at least a solo pour (${p.per.host})`) }
// solo brewing = solo brew
{ let b = openBrewing('host', 'health')!
  b = claim(b, 'host', 0, bag, 0)!.b; b = claim(b, 'host', 1, { ...bag }, T(0))!.b
  b = claim(b, 'host', 2, {}, T(0) + T(1))!.b; b = claim(b, 'host', 3, {}, T(0) + T(1) + T(2))!.b
  const p = pour(b, T(0) + T(1) + T(2) + T(3))!
  ok(p.per.host === H.makes, `solo pours makes (${p.per.host})`) }
// cap
{ let b = openBrewing('h', 'health')!; for (let i = 0; i < 10; i++) b = join(b, `g${i}`)
  ok(b.hands.length === MAX_HANDS, `hands cap at ${MAX_HANDS}`) }

// ── slice 3b: the relay's pure half ──
{ let b = openBrewing('host', 'health')!
  ok(JSON.stringify(adoptBrewing(JSON.parse(JSON.stringify(b)))) === JSON.stringify(b), 'a brewing survives the relay round trip')
  ok(adoptBrewing(null) === null && adoptBrewing({ ...b, potion: 'nope' }) === null && adoptBrewing({ ...b, hands: [] }) === null, 'junk brewings refused')
  ok(adoptBrewing({ ...b, runs: { 9: { by: 'g', spent: [], start: 0, ms: 1 } } }) === null, 'a run on a step the recipe lacks is refused')
  ok(adoptBrewing({ ...b, runs: { 0: { by: 'g', spent: [{ id: 'x', n: -1 }], start: 0, ms: 1 } } }) === null, 'a negative spend is refused')
  ok(adoptBrewing({ ...b, hands: Array.from({ length: MAX_HANDS + 1 }, (_, i) => 'h' + i) }) === null, 'more hands than the cap refused')
  // the host's answer: joins a new hand, says why not
  const r0 = hostClaim(b, 'g1', 0, scale, 0)
  ok(!('why' in r0) && r0.b.hands.join() === 'host,g1' && r0.spend[0].id === 'shimmerscale', 'a guest claim joins it and spends from its bag')
  b = (r0 as { b: Brewing }).b
  const why = (r: ReturnType<typeof hostClaim>) => ('why' in r ? r.why : '')
  ok(why(hostClaim(b, 'g2', 0, scale, 1)).includes('Someone has'), 'a taken step: "someone has that step"')
  ok(why(hostClaim(b, 'g1', 1, crops, 1)).includes('already working'), 'a busy hand: "already working a step"')
  ok(why(hostClaim(b, 'g2', 2, bag, 1)).includes('earlier one'), 'a step not open yet: "needs an earlier one"')
  ok(why(hostClaim(b, 'g2', 1, {}, 1)).includes('short'), 'a short bag: "short of what that step takes"')
  ok(!('why' in hostClaim(b, 'g2', 1, crops, 1)), 'a free hand takes the other open step')
  let full = b; for (let i = 0; i < 9; i++) full = join(full, 'x' + i)
  ok(why(hostClaim(full, 'late', 1, crops, 1)).includes('full'), 'a full brewing: "full"')
  ok(why(hostClaim({ ...b, poured: true }, 'g2', 1, crops, 1)).includes('poured'), 'a poured brewing takes no claims')
  // the panel's view
  const v = stepViews(b, 1)
  ok(v[0].state === 'running' && v[0].by === 'g1' && v[0].frac! > 0 && v[0].frac! < 1, 'a claimed step runs, by whom, how far')
  ok(v[1].state === 'open' && v[2].state === 'waiting' && v[3].state === 'waiting', 'open / waiting by dependency')
  ok(stepViews(b, T(0) + 1)[0].state === 'done', 'a finished step reads done')
  // message guards
  ok(isClaim({ k: 1, have: {} }) && !isClaim({ k: 'a', have: {} }) && !isClaim({ k: 1 }), 'claim shape')
  ok(isGrant({ k: 0, spend: [{ id: 'a', n: 1 }] }) && !isGrant({ k: 0, spend: [{ id: 'a', n: 0 }] }), 'grant shape')
  ok(isPour({ bottle: 'p', n: 2, extra: 0 }) && !isPour({ bottle: 'p', n: 0, extra: 0 }) && !isPour({ bottle: 'p', n: 99, extra: 0 }), 'pour shape (1..30 bottles)')
}

console.log(`party-brew: ${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0)
