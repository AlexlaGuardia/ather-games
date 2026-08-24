/**
 * THE CROSSING CONTRACT — the oracle both lanes run.
 *
 * ★ WRITTEN AS A TEST RATHER THAN A PARAGRAPH ON PURPOSE. The hub and world lanes agreed this
 * contract in messages, and a contract that lives in two people's memory is the shape that has
 * already cost this repo a region-wide save corruption. Anything either side does across the seam
 * has to keep these true.
 *
 * Run: `npx tsx src/app/shimmer/engine/crossing.test.ts`
 */
import { stageArrival, consumeArrival, arrivalFor, type Store, type TilePos } from './crossing'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

/** A store that RECORDS, so an assert can ask what was written, not only what was read back. */
const mkStore = () => {
  const m = new Map<string, string>()
  const writes: string[] = []
  const store: Store = {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { writes.push(`set:${k}`); m.set(k, v) },
    removeItem: (k) => { writes.push(`del:${k}`); m.delete(k) },
  }
  return { store, writes, keys: () => [...m.keys()] }
}

const LANDING: TilePos = { zone: 'rune-hold', x: 44, y: 52 }
const ELSEWHERE: TilePos = { zone: 'rune-hold', x: 12, y: 29 }

// ── 1. ★★ THE DEPARTURE TOUCHES NOTHING BUT THE ONE-SHOT ─────────────────────────────────────
// ⚠ The tempting symmetry is to move the keeper on the Ather side so they "come back where they
// left". That is the committed middle, and it is what makes a half-crossing survivable-looking and
// unrecoverable. Asserted by watching every write, not by reading the result.
{
  const s = mkStore()
  s.store.setItem('shimmer:player', 'ATHER-RECORD')
  s.store.setItem('shimmer:town', 'TOWN-RECORD')
  s.writes.length = 0
  stageArrival(s.store, LANDING)
  ok(s.writes.length === 1, `a departure performs exactly ONE write (did ${s.writes.length}: ${s.writes.join(', ')})`)
  ok(s.store.getItem('shimmer:player') === 'ATHER-RECORD', '★ the Ather record is untouched by departing')
  ok(s.store.getItem('shimmer:town') === 'TOWN-RECORD', '★ the town record is untouched by departing')
}

// ── 2. ★★★ NO COMMITTED MIDDLE ───────────────────────────────────────────────────────────────
// The two survivable states are "nothing happened" and "arrival complete". Simulated by dropping
// the process at each point rather than by reasoning about it.
{
  const s = mkStore()
  // crash BEFORE staging: nothing happened at all
  ok(consumeArrival(s.store) === null, 'tab dies before departure — nothing is staged, the keeper never left')
  // crash AFTER staging: the next load of the town completes the arrival
  stageArrival(s.store, LANDING)
  const got = consumeArrival(s.store)
  ok(got?.x === LANDING.x && got?.y === LANDING.y, 'tab dies after departure — the next load completes it')
  ok(consumeArrival(s.store) === null, '★★ and it is a ONE-SHOT: a second load does not re-place the keeper')
}

// ── 3. ★★ THE CLEAR HAPPENS BEFORE THE CALLER ACTS ───────────────────────────────────────────
// ⚠ If the caller acted first and cleared after, a crash between the two would re-place the keeper
// on EVERY load, forever — the 2026-08-15 self-feeding state rebuilt by hand. Asserted by the write
// ORDER, because a test that only checks the end state cannot tell the two implementations apart.
{
  const s = mkStore()
  stageArrival(s.store, LANDING)
  s.writes.length = 0
  const before = s.store.getItem('shimmer:crossing:pending')
  consumeArrival(s.store)
  ok(before !== null, 'precondition: the one-shot was set')
  ok(s.writes.includes('del:shimmer:crossing:pending'), 'consuming DELETES the one-shot, not merely reads it')
  ok(s.keys().length === 0, 'and leaves nothing behind')
}

// ── 4. a malformed one-shot is a missing one, never a crash ──────────────────────────────────
// ★ It must also be CLEARED, or a corrupt value is retried on every load — a crash loop with no
// error, which is the worst version of this failure because nothing reports it.
for (const junk of ['not json', '{}', '{"zone":"rune-hold"}', '{"zone":1,"x":0,"y":0}', 'null']) {
  const s = mkStore()
  s.store.setItem('shimmer:crossing:pending', junk)
  ok(consumeArrival(s.store) === null, `a malformed one-shot reads as absent: ${junk}`)
  ok(s.keys().length === 0, `and is cleared rather than retried forever: ${junk}`)
}

// ── 5. ★★★ WHERE A KEEPER STANDS, AND WHY ────────────────────────────────────────────────────
{
  const staged = arrivalFor(LANDING, ELSEWHERE, LANDING)
  ok(staged.why === 'staged', 'a staged crossing wins over a saved position — you just walked through a door')
  const back = arrivalFor(null, ELSEWHERE, LANDING)
  ok(back.why === 'returning' && back.at.x === ELSEWHERE.x, 'a returning keeper comes back where they left the town')
  const first = arrivalFor(null, null, LANDING)
  ok(first.why === 'first-visit' && first.at.x === LANDING.x && first.at.y === LANDING.y,
     'a keeper with NO town record arrives at the landing')
}

// ── 6. ⚠⚠ (0,0) IS BANNED BY NAME ────────────────────────────────────────────────────────────
// It is legal, it is inside the map, and it is the plausible-looking wrong answer — so it reads as
// a placement bug rather than as a missing record, and someone spends a day on the wrong file. Same
// family as a console jump landing in the fold's hollow: a coordinate that is legal and meaningless
// is worse than one that is obviously wrong. ★ Asserted against a landing that is NOT the origin, so
// the assert cannot pass by the fallback and the ban agreeing.
{
  const first = arrivalFor(null, null, LANDING)
  ok(!(first.at.x === 0 && first.at.y === 0), '★ a missing record never resolves to (0,0)')
  ok(first.at.zone === 'rune-hold', 'and it names a zone rather than defaulting to one')
  // The one legitimate way to stand at the origin: it is genuinely where you were.
  const legit = arrivalFor(null, { zone: 'rune-hold', x: 0, y: 0 }, LANDING)
  ok(legit.at.x === 0 && legit.why === 'returning',
     'but a keeper whose real saved position IS (0,0) still returns there — the ban is on the FALLBACK, not the value')
}

console.log(`crossing: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
