// Ring oracle. Run: npx tsx src/app/shimmer/voxel/render-light-ring.test.ts
//
// Every defect this module can have is invisible in a screenshot taken from the wrong place, and
// three of them are invisible from EVERY place until you are underground at the ring's edge: a face
// mapping that puts a neighbour's light on the wrong side, a dirty rule that never re-runs anyone,
// and a slot that two columns share. So the asserts are about the RULES, and §7 runs the whole loop
// against a real two-column fixture because a rule that is individually right can still fail to
// settle.
import {
  BUILD_RADIUS, SAMPLE_RADIUS, RING_N, slotOf, ringKey,
  newLightRing, recenterRing, nextDirtyColumn, incomingFor, publishSpill,
  invalidateColumn, sampleable, eligible, drainUploads,
} from './render-light-ring'
import {
  computeRenderLight, newBorders, li, HEIGHT, SPAN, MAX_LIGHT,
  FACE_XM, FACE_XP, FACE_ZM, FACE_ZP,
} from './render-light'
import { MAT } from './depth'
import { AIR } from './section'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── §1 the apron exists, which is the premise of every sampling assert ───────────────────────
ok(SAMPLE_RADIUS === BUILD_RADIUS - 1, '§1 the sample radius is one inside the build radius')
ok(RING_N === BUILD_RADIUS * 2 + 1, '§1 the torus is exactly as wide as the built ring')

// ── §2 slots: a torus, and negative columns are the whole reason this is not `%` ─────────────
ok(slotOf(0) === 0 && slotOf(1) === 1, '§2 slots start where you would expect')
ok(slotOf(-1) === RING_N - 1, `§2 ★ a NEGATIVE column wraps to the far slot, not to -1 (got ${slotOf(-1)})`)
{
  // Within one ring no two columns may share a slot, or one place's darkness lands on another's
  // geometry. Across `RING_N` they must, because that is the reuse the torus exists for.
  const seen = new Set<number>()
  for (let c = -BUILD_RADIUS; c <= BUILD_RADIUS; c++) seen.add(slotOf(c))
  ok(seen.size === RING_N, `§2 ★★ every column in a ring gets its own slot (${seen.size} of ${RING_N})`)
  ok(slotOf(7) === slotOf(7 + RING_N) && slotOf(-3) === slotOf(-3 + RING_N),
    '§2 ★ and a column RING_N away reuses it — the column that just left')
}

// ── §3 recentring: what enters, what leaves ──────────────────────────────────────────────────
{
  const r = newLightRing()
  const gone0 = recenterRing(r, 0, 0)
  ok(r.cols.size === RING_N * RING_N, `§3 a fresh ring holds ${RING_N * RING_N} columns (got ${r.cols.size})`)
  ok(r.dirty.size === RING_N * RING_N, '§3 and every one of them is dirty')
  ok(gone0.length === 0, '§3 nothing left a ring that had nothing')

  ok(recenterRing(r, 0, 0).length === 0 && r.cols.size === RING_N * RING_N,
    '§3 ★ recentring to the same column is a no-op, not a rebuild — it must not re-dirty the ring')

  r.dirty.clear()
  const gone = recenterRing(r, 1, 0)
  ok(gone.length === RING_N, `§3 ★ stepping one column east evicts exactly one edge strip (${gone.length})`)
  ok(gone.every(k => k.startsWith(`${-BUILD_RADIUS},`)), '§3 ★ and it is the WEST strip that leaves')
  ok(r.dirty.size === RING_N, `§3 ★ exactly the new east strip is dirty (${r.dirty.size})`)
  ok(r.cols.size === RING_N * RING_N, '§3 and the ring is still full')
}

// ── §4 order: the column under the keeper's feet is the one they can see ─────────────────────
{
  const r = newLightRing()
  recenterRing(r, 10, 20)
  const first = nextDirtyColumn(r)
  ok(first?.cx === 10 && first?.cz === 20, `§4 ★ the centre is built first (got ${first?.cx},${first?.cz})`)
  // Walk the whole ring and assert the distance never decreases — the ring warms outward.
  let last = -1, n = 0
  for (;;) {
    const c = nextDirtyColumn(r)
    if (!c) break
    const d = Math.max(Math.abs(c.cx - 10), Math.abs(c.cz - 20))
    if (d < last) { ok(false, `§4 order went backwards: ${d} after ${last}`); break }
    last = d; n++
    publishSpill(r, c.cx, c.cz, newBorders())
  }
  ok(n === RING_N * RING_N, `§4 ★★ every column is offered exactly once and the queue drains (${n})`)
  ok(nextDirtyColumn(r) === null, '§4 a drained queue answers null rather than looping')
}

// ── §4b the host may refuse a column, and refusing must not retire it ────────────────────────
// The host refuses a column whose voxels have not streamed in yet. ⚠ If that cleared the dirty
// flag the column would never be built once it arrived and would render fully lit forever — the
// failure would be a permanently bright patch that nobody could tie back to a streaming race.
{
  const r = newLightRing()
  recenterRing(r, 0, 0)
  const centre = ringKey(0, 0)
  const first = nextDirtyColumn(r, c => ringKey(c.cx, c.cz) !== centre)
  ok(first !== null && ringKey(first.cx, first.cz) !== centre, '§4b a refused column is skipped over')
  ok(r.dirty.has(centre), '§4b ★★ and it is STILL dirty — a refusal is temporary, not a decision')
  ok(nextDirtyColumn(r)?.cx === 0 && nextDirtyColumn(r)?.cz === 0,
    '§4b ★ so it is offered again the moment the host stops refusing it')
  ok(nextDirtyColumn(r, () => false) === null, '§4b refusing everything answers null rather than looping')
}

// ── §4c every column gets a first turn before any column gets a second ───────────────────────
// ★★★ THE THROUGHPUT PROPERTY, AND IT WAS A MEASURED BUG. Sorting by distance with `ready` as a
// TIEBREAK means a re-dirtied column beside the keeper outranks an unbuilt column further out
// forever, so the ring warms as a slowly expanding, endlessly resettling blob — 77 passes produced
// 14 built columns in the running page, and the outer ring never got a turn at all. The two states
// are not comparable: an unbuilt column renders fully lit, which underground is a bright hole where
// a cave should be; a re-settling one is already close and gets a shade darker.
//
// ⚠ The fixture publishes a spill that CHANGES every time, so every publish re-dirties a neighbour.
// A fixture publishing zeros wakes nobody and could not tell the two orderings apart.
{
  const r = newLightRing()
  recenterRing(r, 0, 0)
  const seen = new Set<string>()
  let n = 0, repeatedAt = -1
  for (let i = 0; i < RING_N * RING_N; i++) {
    const c = nextDirtyColumn(r)
    if (!c) break
    const k = ringKey(c.cx, c.cz)
    if (seen.has(k) && repeatedAt < 0) repeatedAt = i
    seen.add(k); n++
    const spill = newBorders()
    for (let f = 0; f < 4; f++) spill.sky[(f * HEIGHT + 40) * SPAN + 1] = 1 + (i % 14)
    publishSpill(r, c.cx, c.cz, spill)
  }
  ok(repeatedAt < 0,
    `§4c ★★★ no column is served twice before all ${RING_N * RING_N} have been served once (repeat at ${repeatedAt})`)
  ok(seen.size === RING_N * RING_N,
    `§4c ★★ so the whole ring gets a first field, outer columns included (${seen.size} of ${RING_N * RING_N})`)
  ok(n === RING_N * RING_N && r.dirty.size > 0,
    '§4c ★ and the fixture really did re-dirty as it went — otherwise the assert above is vacuous')
}

// ── §5 the face mapping — the assert most likely to be quietly inverted ──────────────────────
// A wrong OPPOSITE here does not throw and does not look like a bug: it lights the far side of a
// column instead of the near one, which reads as a generator artefact and gets filed against
// worldgen. Both directions are checked, because a mapping that is self-consistently backwards
// passes any test that only looks at one axis.
{
  const r = newLightRing()
  recenterRing(r, 0, 0)
  const west = newBorders()
  west.sky[(FACE_XP * HEIGHT + 70) * SPAN + 3] = 9    // the WEST neighbour spills east, at y=70, s=3
  publishSpill(r, -1, 0, west)
  const south = newBorders()
  south.blk[(FACE_ZP * HEIGHT + 40) * SPAN + 11] = 6  // the -z neighbour spills +z
  publishSpill(r, 0, -1, south)

  const inc = incomingFor(r, 0, 0)
  ok(inc.sky[(FACE_XM * HEIGHT + 70) * SPAN + 3] === 9,
    `§5 ★★ the west neighbour's +x spill arrives on OUR -x face (got ${inc.sky[(FACE_XM * HEIGHT + 70) * SPAN + 3]})`)
  ok(inc.blk[(FACE_ZM * HEIGHT + 40) * SPAN + 11] === 6,
    `§5 ★★ and the -z neighbour's +z spill arrives on our -z face (got ${inc.blk[(FACE_ZM * HEIGHT + 40) * SPAN + 11]})`)
  let stray = 0
  for (let i = 0; i < inc.sky.length; i++) if (inc.sky[i] || inc.blk[i]) stray++
  ok(stray === 2, `§5 ★ and NOTHING else arrived — a mapping that smears would still pass the two above (${stray})`)

  // A neighbour that has never published contributes nothing, rather than a zeroed-but-present
  // border that would read as "measured dark" instead of "not measured".
  const r2 = newLightRing()
  recenterRing(r2, 0, 0)
  const inc2 = incomingFor(r2, 0, 0)
  let any = 0
  for (let i = 0; i < inc2.sky.length; i++) if (inc2.sky[i] || inc2.blk[i]) any++
  ok(any === 0, '§5 an unbuilt neighbour hands over nothing')
}

// ── §6 the dirty rule, including the direction that only a PLACED block produces ─────────────
{
  const r = newLightRing()
  recenterRing(r, 0, 0)
  r.dirty.clear()
  const hot = newBorders()
  hot.sky[(FACE_XP * HEIGHT + 50) * SPAN + 2] = 12
  ok(publishSpill(r, 0, 0, hot) === true, '§6 a publish whose spill changed wakes somebody')
  // ★★ EXACTLY THE NEIGHBOUR THE LIGHT LEFT TOWARDS. Light out of the +x face reaches the column at
  // +x and no other, so waking all four is three columns recomputing an identical field to publish
  // an identical spill — measured as most of why 77 passes only built 14 columns.
  ok(r.dirty.has(ringKey(1, 0)), '§6 ★★ the +x spill wakes the +x neighbour')
  ok(!r.dirty.has(ringKey(-1, 0)) && !r.dirty.has(ringKey(0, 1)) && !r.dirty.has(ringKey(0, -1)),
    `§6 ★★★ and NOBODY else — light that leaves by one face reaches one column (${[...r.dirty].join(' ')})`)
  ok(!r.dirty.has(ringKey(0, 0)), '§6 ★ and the publishing column clears its own dirty flag')

  // Non-vacuity for the face mapping: a spill on a DIFFERENT face must wake a DIFFERENT column, or
  // the assert above is satisfied by a rule that always wakes +x.
  r.dirty.clear()
  const southbound = newBorders()
  southbound.blk[(FACE_ZM * HEIGHT + 30) * SPAN + 5] = 9
  publishSpill(r, 0, 0, southbound)
  ok(r.dirty.has(ringKey(0, -1)),
    `§6 ★★ a -z spill wakes the -z neighbour (${[...r.dirty].join(' ')})`)
  ok(r.dirty.has(ringKey(1, 0)),
    '§6 ★ and +x too, because the +x face went back to zero — a DROP is a change')

  r.dirty.clear()
  const same = newBorders()
  same.blk[(FACE_ZM * HEIGHT + 30) * SPAN + 5] = 9
  ok(publishSpill(r, 0, 0, same) === false && r.dirty.size === 0,
    '§6 ★★ an identical re-publish wakes nobody — this is what makes the queue drain instead of spin')

  // ★★ THE ONE A "RAISED" RULE WOULD MISS. A placed block LOWERS the spill; if that does not wake
  // the neighbour it keeps the light of a wall that no longer has a hole in it, forever.
  r.dirty.clear()
  const dimmer = newBorders()
  dimmer.blk[(FACE_ZM * HEIGHT + 30) * SPAN + 5] = 4
  ok(publishSpill(r, 0, 0, dimmer) === true && r.dirty.has(ringKey(0, -1)),
    '§6 ★★★ a spill that DROPS wakes the neighbour too — phantom light is the placed-block failure')

  // A slice that finishes for a column the ring has already walked past must not resurrect it.
  const r3 = newLightRing()
  recenterRing(r3, 0, 0)
  ok(publishSpill(r3, 99, 99, newBorders()) === false, '§6 a publish for a column outside the ring is dropped')
}

// ── §7 invalidation and sampling ─────────────────────────────────────────────────────────────
{
  const r = newLightRing()
  recenterRing(r, 0, 0)
  r.dirty.clear()
  invalidateColumn(r, 0, 0)
  ok(r.dirty.size === 9, `§7 ★ an edit re-runs the full 3x3 (${r.dirty.size})`)
  ok(r.dirty.has(ringKey(1, 1)), '§7 ★★ INCLUDING the diagonal — a corner lantern reaches it and an "adjacent" rule does not')

  r.dirty.clear()
  invalidateColumn(r, BUILD_RADIUS, BUILD_RADIUS)
  ok(r.dirty.size === 4, `§7 an edit at the ring corner marks only what is in the ring (${r.dirty.size})`)

  ok(!sampleable(r, 0, 0), '§7 ★ a column with no field is NOT sampleable — it renders as the game does today')
  publishSpill(r, 0, 0, newBorders())
  ok(sampleable(r, 0, 0), '§7 and a built centre column is')
  const apron = { cx: BUILD_RADIUS, cz: 0 }
  publishSpill(r, apron.cx, apron.cz, newBorders())
  ok(!sampleable(r, apron.cx, apron.cz),
    '§7 ★★ the outermost BUILT ring is never sampled — it exists to feed spill inward, and it is dark by construction')
  ok(sampleable(r, SAMPLE_RADIUS, 0) === false, '§7 (unbuilt at the sample edge is still not sampleable)')
}

// ── §8 it settles, on a fixture where light genuinely has to cross a border ──────────────────
// ★★ THE RULES ABOVE ARE EACH RIGHT IN ISOLATION AND THAT IS NOT THE CLAIM THE HOST NEEDS. This
// runs the real loop — pick nearest dirty, assemble incoming, compute, publish — over a shaft that
// lands two blocks from a column border, and asserts BOTH that it stops and that the light arrived
// next door at exactly the level the decay rule predicts. A loop that stopped early would leave the
// neighbour dark and still "settle".
{
  const H0 = 100
  // Sealed rock with one shaft down at world (14,2) and a tunnel running east at y=61.
  const open = (x: number, y: number, z: number): boolean =>
    y > H0
    || (x === 14 && z === 2 && y >= 60)
    || (y === 61 && z === 2 && x >= 14 && x <= 40)
  const matAt = (x: number, y: number, z: number): number => (open(x, y, z) ? AIR : MAT.STONE)
  const heightAt = () => H0

  const r = newLightRing()
  recenterRing(r, 1, 0)
  const fields = new Map<string, { sky: Uint8Array }>()
  let passes = 0
  for (;;) {
    const c = nextDirtyColumn(r)
    if (!c) break
    if (++passes > 4000) break
    const f = computeRenderLight(c.cx * SPAN, c.cz * SPAN, matAt, incomingFor(r, c.cx, c.cz))
    publishSpill(r, c.cx, c.cz, f.spill)
    fields.set(ringKey(c.cx, c.cz), f)
  }
  ok(passes <= 4000, `§8 ★★★ the loop SETTLES — no dirty column left after ${passes} passes`)
  ok(passes > RING_N * RING_N,
    `§8 ★ and it really did re-run columns rather than sweeping once (${passes} > ${RING_N * RING_N})`)

  // Sky falls free down the shaft at full strength to y=61, then decays one per block east. World
  // x=16 is column 1's local x=0, two steps from the shaft, so it must be exactly 13.
  const c1 = fields.get(ringKey(1, 0))
  ok(!!c1, '§8 column 1 was visited')
  const arrived = c1 ? c1.sky[li(0, 61, 2)] : -1
  ok(arrived === MAX_LIGHT - 2,
    `§8 ★★★ light crossed the border and arrived at exactly the decayed level (got ${arrived}, want ${MAX_LIGHT - 2})`)

  // Non-vacuity: the same column computed with no incoming at all is pitch dark there, so the
  // assert above is about the border machinery and not about a tunnel that lights itself.
  const alone = computeRenderLight(SPAN, 0, matAt, null)
  ok(alone.sky[li(0, 61, 2)] === 0,
    `§8 ★★ and it is dark without the ring — the assert is about spill, not about the fixture (${alone.sky[li(0, 61, 2)]})`)

  // ★★ AND LIGHT CANNOT CROSS TWO BORDERS, which is not trivia — it is the fact the apron width and
  // the 3x3 invalidation both rest on. 15 levels of reach against a 16-wide column means a source
  // in one column can only ever touch the columns it touches.
  const c2 = fields.get(ringKey(2, 0))
  let anyLit = 0
  if (c2) for (let i = 0; i < c2.sky.length; i++) if (c2.sky[i] > 0 && c2.sky[i] < MAX_LIGHT) anyLit++
  ok(!!c2 && anyLit === 0,
    `§8 ★★ nothing dimly lit two columns away — light reaches 15 and a column is 16 wide (${anyLit} cells)`)
}

// ── §9 a field is not fit to look at the moment it exists ────────────────────────────────────
// ★★★ THE ASSERT THAT COST A BLACK WALL. A column built before its neighbours reads their spill as
// zero, so it is under-lit within fifteen blocks of each of its four borders — nearly all of it.
// Measured in the running page, not reasoned: 2 of 81 columns built photographed a solid black
// cliff at noon; the same place with 20 built rendered correctly. Both were "working".
{
  const r = newLightRing()
  recenterRing(r, 0, 0)
  const field = () => new Uint8Array(SPAN * HEIGHT * SPAN)

  publishSpill(r, 0, 0, newBorders(), field())
  ok(r.cols.get(ringKey(0, 0))!.ready, '§9 the centre has a field')
  ok(!eligible(r, 0, 0), '§9 ★★★ and it is NOT fit to upload — its four neighbours have none')
  ok(drainUploads(r, 0, 0).length === 0, '§9 ★★ so nothing is handed to the texture, and it stays daylight')

  for (const [nx, nz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) publishSpill(r, nx, nz, newBorders(), field())
  ok(eligible(r, 0, 0), '§9 ★★ with all four built it becomes fit')
  // ⚠ THE DRAIN IS THE 3x3, NOT THE PUBLISHER. Finishing (0,1) is what made (0,0) fit, and (0,0)'s
  // bytes are already in hand — asking it to rebuild to be uploaded would cost a whole pass.
  const drained = drainUploads(r, 0, 1)
  ok(drained.some(c => c.cx === 0 && c.cz === 0),
    `§9 ★★★ publishing a NEIGHBOUR drains the column it made fit (${drained.map(c => `${c.cx},${c.cz}`).join(' ')})`)
  ok(drainUploads(r, 0, 1).length === 0, '§9 ★ and a drained column is not handed over twice')
  ok(drained.every(c => c.packed !== null), '§9 everything drained carries its bytes')

  // ★ THE APRON FALLS OUT OF THE SAME SENTENCE. An outer-ring column has neighbours that are not in
  // the ring at all, so it can never be eligible and can never reach the texture — no second rule.
  publishSpill(r, BUILD_RADIUS, 0, newBorders(), field())
  publishSpill(r, BUILD_RADIUS - 1, 0, newBorders(), field())
  ok(!eligible(r, BUILD_RADIUS, 0),
    '§9 ★★★ the outermost ring can NEVER be eligible — the apron rule, derived rather than restated')

  // ⚠⚠ A PUBLISH CAN CARRY A SPILL WITHOUT A FIELD, and the two are not the same event. The first
  // version of this assert built the centre with no bytes and left its neighbours unbuilt — so the
  // neighbour check answered first and a mutation deleting the bytes check passed clean. The
  // neighbours are built HERE so that nothing but `!c.packed` can produce the answer.
  const r2 = newLightRing()
  recenterRing(r2, 0, 0)
  for (const [nx, nz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) publishSpill(r2, nx, nz, newBorders(), field())
  publishSpill(r2, 0, 0, newBorders())
  ok(r2.cols.get(ringKey(0, 0))!.ready, '§9 a spill-only publish still counts as built, for the border rules')
  ok(r2.cols.get(ringKey(0, 0))!.packed === null && !r2.cols.get(ringKey(0, 0))!.texDirty,
    '§9 a publish without bytes leaves nothing to upload')
  ok(!eligible(r2, 0, 0),
    '§9 ★★ and it is NOT eligible even with all four neighbours built — there is nothing to upload')
  ok(drainUploads(r2, 0, 0).every(c => c.cx !== 0 || c.cz !== 0), '§9 ★ so the drain never yields it')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the ring settles and the light arrives on the right face — ${pass} passed`)
