// npx tsx src/app/shimmer/open/ather/training-use.test.ts
// BETA M239: spirits use the training pieces as they please. Choice weighting (her lean), the cap (spirit-stats.ts withPlay,
// reused not re-derived), and no two spirits on one piece (the shared occupancy table), driven through the real trot.
import { favouredStat, leanFor, pickToy, makeOccupancy, USE } from './training-use'
import { makeTrot, type Toy } from './spirit-trot'
import { SPECIES_BASE } from './spirit-growth'
import { TRAIN, TRAIN_STATS, withPlay, previewPlay, type StatBook } from './spirit-stats'
import { FURNITURE } from './furniture'
import { footBlocked, plotFootprints, bodyRadius } from './obstacles'
import { GROWN } from '../../sprites/creature-size'
import type { Species } from '../../spirits/spirit'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }

// 1. her favoured stat = her signature trainable stat (the highest of PWR/GRD/AGI/VIG in her fixed base)
const SPECIES = Object.keys(SPECIES_BASE) as Species[]
for (const sp of SPECIES) {
  const f = favouredStat(sp), b = SPECIES_BASE[sp]
  ok(TRAIN_STATS.every(k => b[k] <= b[f]), `${sp}: favoured ${f} is her highest trainable stat ${JSON.stringify(b)}`)
}
ok(new Set(SPECIES.map(favouredStat)).size >= 3, `the species lean different ways (${[...new Set(SPECIES.map(favouredStat))].join(',')})`)
// 2. leanFor: a hand-tuned manner wins; a flat / missing one leans to her signature stat
{
  const own = { agi: 1.5, vig: 1.3, pwr: 1, grd: 0.7 }
  ok(JSON.stringify(leanFor('fox', own)) === JSON.stringify({ pwr: 1, grd: 0.7, agi: 1.5, vig: 1.3 }), 'a species with its own manner keeps it')
  for (const sp of SPECIES) {
    const l = leanFor(sp, { pwr: 1, grd: 1, agi: 1, vig: 1 }), f = favouredStat(sp)
    ok(l[f] === USE.fav && TRAIN_STATS.filter(k => k !== f).every(k => l[k] === 1), `${sp}: flat manner -> ${f} x${USE.fav}, the rest 1`)
  }
  ok(leanFor('turtle')[favouredStat('turtle')] === USE.fav, 'no manner at all -> her signature stat')
}
// 3. pickToy: weighted by lean, every piece still possible (never forced, never shut out)
{
  const list = [{ stat: 'agi' }, { stat: 'pwr' }, { stat: 'grd' }, { stat: 'vig' }], lean = { agi: 1.5, pwr: 1, grd: 1, vig: 1 }
  const n = [0, 0, 0, 0], N = 20000
  for (let i = 0; i < N; i++) n[pickToy(list, lean, (i + 0.5) / N)]++
  ok(Math.abs(n[0] / N - 1.5 / 4.5) < 0.01 && n.every(c => Math.abs(c / N - (c === n[0] ? 1.5 : 1) / 4.5) < 0.01), `the favoured piece is picked 1.5:1 (${n.join('/')})`)
  ok(n.every(c => c > 0), 'every piece can be picked')
  ok(pickToy([], lean, 0.3) === -1, 'no pieces -> -1')
  ok(pickToy([{ stat: 'pwr' }], lean, 0.99) === 0, 'one piece -> it')
}
// 4. occupancy: claim / taken / release / the lease
{
  let t = 0; const occ = makeOccupancy(1000, () => t), a = {}, b = {}
  ok(occ.claim('p', a, t) && !occ.taken('p', a, t) && occ.taken('p', b, t), 'a claims: b sees it taken, a does not')
  ok(!occ.claim('p', b, t), 'b cannot claim a held piece')
  t = 900; ok(occ.claim('p', a, t), 'a refreshes'); t = 1800; ok(occ.taken('p', b, t), 'the refresh keeps it live')
  occ.release('p', b); ok(occ.taken('p', b, t), 'only the holder can let go')
  occ.release('p', a); ok(!occ.taken('p', b, t) && occ.claim('p', b, t), 'released: b takes it')
  t = 2801 + 1000; ok(!occ.taken('p', a, t) && occ.claim('p', a, t), 'a lapsed hold (an unmounted spirit) frees itself')
}
// 5. the cap: a play spends through spirit-stats.ts (reused), never past the per-stat cap or the pool
{
  let book: StatBook = { s: { form: 'base', g: { agi: TRAIN.cap - 1 }, plays: 0 } }
  let r = withPlay(book, 's', 'fox', 'agi'); book = r.book
  ok(r.rose === 1 && book.s.g.agi === TRAIN.cap, `one play under the cap spends 1 (agi ${book.s.g.agi})`)
  r = withPlay(book, 's', 'fox', 'agi')
  ok(r.rose === 0 && r.book.s.g.agi === TRAIN.cap && previewPlay(r.book.s, 'fox', 'agi').why === 'cap', 'at the cap a play spends nothing (she may still play)')
  const full: StatBook = { s: { form: 'base', g: { pwr: TRAIN.cap, grd: TRAIN.cap }, plays: 0 } }
  ok(withPlay(full, 's', 'fox', 'vig').rose === 0, 'an empty pool spends nothing')
}
// 6. through the real trot: two party spirits, ONE piece, one shared table: never both on it; both still get turns;
//    called home = she lets go at once
function scene(oneToy: boolean, seedA: number, seedB: number, secs: number) {
  let clock = 0; const occ = makeOccupancy(USE.lease, () => clock)
  const pcs = [{ id: 'hu', item: 'goldwood_hurdle', x: 0, z: 2.5 }, ...(oneToy ? [] : [{ id: 'ps', item: 'push_stone', x: 2.5, z: -2 }])]
  const toys: Toy[] = pcs.map(p => { const f = FURNITURE[p.item], kind = f.play ?? 'leap'
    return { id: p.id, x: p.x, z: p.z, ax: 0, az: 1, stat: f.train!, kind, size: kind === 'shove' ? f.d / 2 : undefined } })
  const F = plotFootprints(pcs), k = { x: 0, z: 0, yaw: 0 }
  const mk = (sp: Species, hx: number, seed: number) => { const r = bodyRadius(GROWN[sp]), rMin = Math.max(0.9, 0.45 + r + 0.08)
    const t = makeTrot({ home: { x: hx, z: -4 }, rMin, rMax: rMin + 0.6, roam: { maxLeg: 4.5, away: 3 }, toys: () => toys, occ, lean: leanFor(sp),
      blocked: (x, z, toy) => Math.abs(x) > 9 || Math.abs(z) > 9 || footBlocked(F, x, z, r, toy) }, seed)
    t.near(() => k); return t }
  const A = mk('fox', -3, seedA), B = mk('fox', 3, seedB)
  let both = 0, aPlay = 0, bPlay = 0
  const dt = 1 / 30
  for (let i = 0; i < secs * 30; i++) {
    clock += dt * 1000; A.step(dt); B.step(dt)
    const pa = A.playing(), pb = B.playing()
    if (pa && pa === pb) both++
    if (pa) aPlay++; if (pb) bPlay++
  }
  for (const s of [A, B]) s.onPlayed(null)
  return { A, B, occ, both, aPlay, bPlay, k, tick: () => { clock += dt * 1000; A.step(dt); B.step(dt) }, now: () => clock }
}
{
  let total = 0, aT = 0, bT = 0
  for (const [sa, sb] of [[3, 7], [11, 5], [21, 42]] as const) {
    const s = scene(true, sa, sb, 240); total += s.both; aT += s.aPlay; bT += s.bPlay
    ok(s.both === 0, `seeds ${sa}/${sb}: never two on the one hurdle (${s.both} frames)`)
  }
  ok(aT > 0 && bT > 0, `both spirits still get turns at the one piece (${aT} / ${bT} frames)`)
  // called home mid-play: she lets go of the piece on her next step
  const s = scene(true, 3, 7, 1)
  let found = false
  for (let i = 0; i < 240 * 30 && !found; i++) { s.tick(); if (s.A.playing()) found = true }
  ok(found, 'A gets to play the hurdle')
  ok(Object.keys(s.occ.holders(s.now())).join() === 'hu' && s.occ.taken('hu', {}, s.now()), 'while she plays the hurdle is held')
  s.B.near(null)   // B wanders home (no party), so only A could hold it
  s.A.call(() => s.k); s.tick()
  const held = Object.keys(s.occ.holders(s.now()))
  ok(!s.A.playing() && held.length === 0, `called home: she stops and the hurdle is free at once (${s.A.playing()}, held ${held.join(',')})`)
}
// 7. two pieces, two spirits: each may have her own; no frame with both on one
{
  const s = scene(false, 9, 13, 240)
  ok(s.both === 0, `two pieces: never two on one (${s.both})`)
}

console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
