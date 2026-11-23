// M106 fix: EVERY pickup path keeps a growing Spirit Planter's seed. Run: npx tsx src/app/shimmer/open/ather/piece-lift.test.ts
// The two ways a placed piece comes back to the bag: the piece card's 'Pick up' (workshop.tsx -> liftPiece) and the third melee
// hit (melee-view.tsx -> breakTarget). Both: a growing pot rides along and the next planter set down has it, seed + planting time
// + tends intact; a spirit's planter stays; nothing moves on a full bag.
import { liftPiece } from './piece-lift'
import { breakTarget } from './melee'
import { freshWorks, placePiece, type Works } from './rooms'
import { plant, tend, settlePot, ripen, bloomAt, growDay, seedOf, BLOOM_MS, type Pots } from './spirit-seeds'
import { GAME_DAY_MS } from './nodes'
import { newInv, give, countOf, type Inv } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const t0 = 40 * GAME_DAY_MS + 1000
const w: Works = { ...freshWorks(), pieces: [{ id: 'sp1', item: 'spirit_planter', x: 0, z: -1.5, q: 0, placedAt: 1 }, { id: 's1', item: 'goldwood_stool', x: 3, z: -1.5, q: 0, placedAt: 1 }] }
const planted = tend(plant({}, 'sp1', seedOf('owl'), t0)!, 'sp1', t0 + 10)!   // tended on day 1
const pot = planted.sp1
const later = t0 + GAME_DAY_MS + 5   // a game day on: day 2 of its growing

type Path = (w: Works, id: string, inv: Inv, pots: Pots) => { works: Works; inv: Inv; pots: Pots } | string | null
const paths: [string, Path][] = [
  ['E pick up', (w, id, inv, pots) => liftPiece(w, id, inv, pots)],
  ['melee', (w, id, inv, pots) => breakTarget(w, { kind: 'piece', id }, inv, pots)],
]
for (const [name, lift] of paths) {
  const r = lift(w, 'sp1', newInv(), planted)
  ok(!!r && typeof r === 'object', `${name}: a growing planter comes up`)
  if (!r || typeof r !== 'object') continue
  ok(countOf(r.inv, 'spirit_planter') === 1 && !r.works.pieces.some(p => p.id === 'sp1'), `${name}: the planter is in the bag`)
  ok(!r.pots.sp1 && Object.values(r.pots).length === 1, `${name}: the pot left the old spot but was not dropped`)
  // set it down again (a new piece id), the way confirmPlace does: placePiece, then settle
  const c = placePiece(r.works, new Set(['sq-0-0']), r.inv, 'spirit_planter', 0, -1.5, 0, later)
  const id = c ? c.piece.id : 'sp-new'
  const back = settlePot(r.pots, id)
  ok(back[id]?.seed === pot.seed, `${name}: placed again, the seed is in it`)
  ok(back[id]?.at === pot.at && JSON.stringify(back[id]?.tends) === JSON.stringify(pot.tends), `${name}: planting time + tends intact`)
  ok(!!back[id] && growDay(back[id], later) === 2 && bloomAt(back[id]) === bloomAt(pot), `${name}: still day 2, same bloom time`)
  ok(ripen(back, bloomAt(pot)).bloomed[0]?.species === 'owl', `${name}: it blooms on its day`)
  // a spirit's planter stays; a stool is not touched by pots; a full bag moves nothing
  const bloomed = ripen(planted, t0 + BLOOM_MS + 1).pots
  ok(lift(w, 'sp1', newInv(), bloomed) === 'spirit', `${name}: a planter a spirit lives in stays`)
  const s = lift(w, 's1', newInv(), planted)
  ok(!!s && typeof s === 'object' && s.pots === planted, `${name}: any other piece leaves the pots alone`)
  let full = newInv(); for (let i = 0; i < 64; i++) full = give(full, 'goldwood_log', 999).inv
  const f = lift(w, 'sp1', full, planted)
  ok(f === null || f === 'full', `${name}: a full bag: nothing moves (the pot stays put)`)
}

console.log(`piece-lift: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
