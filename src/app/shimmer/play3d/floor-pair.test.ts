/**
 * GREG'S PAIR, per birth rune (09-11 glove size; 09-28 one fixed pair per birth).
 * Run: `npx tsx src/app/shimmer/play3d/floor-pair.test.ts`
 */
import { FLOOR_SEATS, floorCandidates, floorVessel, floorWordFor, seatCapOf, FLOOR_TIER } from './vessels'
import { KEEPER_MOVES, moveById } from './keeper-moves'
import { lettersOf } from './gems'
import { laneRunes } from './cast'
import { ELEMENTS, runesOf } from './birth/runes.data'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const bodyOnly: string[] = []
const births = ELEMENTS.flatMap(e => runesOf(e.id).map(r => r.id))

for (const b of births) {
  // the bracelet: a one-letter tactical, every birth
  const br = floorWordFor('bracelet', b)
  ok(!!br && lettersOf(moveById(br)!, b).length === FLOOR_SEATS, `★ ${b}: Greg's bracelet is cut for a one-letter word (${br})`)
  // ★★ the glove: EVERY birth gets a word now (12 of 17 got none while the floor was capped at one seat)
  const gl = floorWordFor('focus', b)
  const on = laneRunes(b, 'state')
  const sizes = KEEPER_MOVES.filter(x => x.tier === 'ultimate' && !x.birthExclusive && x.runes.every(r => on.has(r)))
    .map(x => lettersOf(x, b).length).filter(k => k >= 1)
  // ⚠ a lane whose ONLY signature is body-held (lightning, stone today) has nothing to write on paper: the
  // keeper already carries it in the body. Blank there is the honest answer, reported, never a silent miss.
  if (sizes.length === 0) { ok(gl === null, `${b}: no paper-needing signature on the lane, so the glove stays uncut`); bodyOnly.push(b); continue }
  ok(!!gl, `★★ ${b}: Greg's glove is cut for a word, never handed over blank`)
  if (!gl) continue
  const m = moveById(gl)!
  const n = lettersOf(m, b).length
  ok(n === Math.min(...sizes), `★★ ${b}: the glove's word (${gl}, ${n}) is the lane's SMALLEST signature (${Math.min(...sizes)})`)
  ok(n >= 1, `${b}: never a body-held word, which needs no paper`)
  ok(n <= seatCapOf(FLOOR_TIER, 'focus'), `${b}: the glove floor can bear its word's ${n} seats`)
  const v = floorVessel('focus', b)
  ok(v.gems.length === n, `★ ${b}: the glove arrives with all ${n} letters grown in (got ${v.gems.length})`)
  ok(floorCandidates('focus', b).every(x => lettersOf(x, b).length === n), `${b}: every glove candidate is the same smallest size`)
}
ok(seatCapOf(FLOOR_TIER, 'bracelet') === 1, 'the floor bracelet still bears one seat')

console.log(`glove uncut (signature is body-held): ${bodyOnly.join(' ') || 'none'}`)
console.log(`floor-pair: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗', f)
if (fails.length) process.exit(1)
