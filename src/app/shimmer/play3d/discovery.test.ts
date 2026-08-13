// The map-memory oracle. Run: npx tsx src/app/shimmer/play3d/discovery.test.ts
//
// Everything here fails SILENTLY in play if it breaks, which is why it is asserted rather than
// eyeballed: a fog bug does not throw, it just draws the world slightly wrong forever, and the
// player reads it as "the map is buggy" without ever being able to say how.
//
// The one that would have shipped: a stride mismatch after a world resize. Same bits, new width —
// nothing errors, the keeper's whole history just skews diagonally across the map.

import {
  CELL, SEE_RADIUS, emptySeen, isSeen, see, seenFraction, encodeSeen, decodeSeen, cellsFor,
} from './discovery'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const COLS = 200, ROWS = 160

// ── 1. a fresh world is entirely cloud ─────────────────────────────────────────────────────────
{
  const s = emptySeen(COLS, ROWS)
  ok(seenFraction(s) === 0, 'a keeper who has walked nowhere has opened nothing')
  ok(!isSeen(s, 0, 0) && !isSeen(s, 10, 10), 'no cell reads as seen')
  const { cw, ch } = cellsFor(COLS, ROWS)
  ok(s.cw === cw && s.ch === ch && s.bits.length === Math.ceil((cw * ch) / 8),
    'the bitset is sized to the world, one bit per cell')
}

// ── 2. standing somewhere opens a disc around it ───────────────────────────────────────────────
{
  const s = emptySeen(COLS, ROWS)
  const opened = see(s, 100, 80)
  ok(opened > 0, 'standing still opens ground')
  ok(isSeen(s, Math.floor(100 / CELL), Math.floor(80 / CELL)), 'the cell under the keeper is open')
  ok(!isSeen(s, Math.floor(100 / CELL), Math.floor((80 + SEE_RADIUS * 3) / CELL)),
    'and somewhere well outside the radius is not')
  // ★ A DISC, NOT A SQUARE. The diagonal must fall short of the axis — a square reveals its
  // corners 41% further out, which stamps visible boxes along a walked path.
  const c = { x: Math.floor(100 / CELL), y: Math.floor(80 / CELL) }
  const edge = Math.floor(SEE_RADIUS / CELL)
  ok(isSeen(s, c.x + edge - 1, c.y), 'the disc reaches along the axis')
  ok(!isSeen(s, c.x + edge, c.y + edge), '★ but not into the corner — this is a disc, not a box')
}

// ── 3. ★ RE-WALKING OPENS NOTHING, AND THAT IS THE PERFORMANCE CONTRACT ────────────────────────
// The caller skips its redraw AND its save on a 0. If this ever returns non-zero for ground already
// open, the map re-serialises the whole world every frame a player stands still breathing on it.
{
  const s = emptySeen(COLS, ROWS)
  const first = see(s, 60, 60)
  ok(first > 0, 'the first look opens ground')
  ok(see(s, 60, 60) === 0, '★ looking at the same spot again opens nothing')
  ok(see(s, 60 + CELL * 20, 60) > 0, 'walking somewhere new opens more')
  // `rev` is what the renderer caches its stencil against — if it moved without ground opening,
  // the minimap would rebuild a 2000-cell mask on every frame a player stood still.
  const r0 = s.rev
  ok(see(s, 60, 60) === 0 && s.rev === r0, '★ rev does not move when nothing opens')
  ok(see(s, 60, 130) > 0, 'fixture: (60,130) is fresh ground inside the world')
  ok(s.rev === r0 + 1, 'and moves exactly once when ground does open')
}

// ── 4. the edges of the world do not wrap or throw ─────────────────────────────────────────────
// A keeper standing in the corner is ordinary. Off-grid writes would corrupt the far side of the
// map — the classic row-major wrap — and it would look like a real, explored place.
{
  const s = emptySeen(COLS, ROWS)
  see(s, 0, 0)
  ok(isSeen(s, 0, 0), 'the corner opens')
  ok(!isSeen(s, s.cw - 1, 0), '★ and nothing wraps around to the far edge of the same row')
  see(s, COLS - 1, ROWS - 1)
  ok(isSeen(s, s.cw - 1, s.ch - 1), 'the opposite corner opens too')
  ok(see(s, -500, -500) === 0, 'standing far outside the world opens nothing and does not throw')

  // ★ READING off-grid must be false, not the far end of the previous row. The renderer asks about
  // cells beyond the edge constantly — the minimap crops a fixed box around the player, so standing
  // near any border queries negative and over-wide columns every frame. Without the guard,
  // `isSeen(-1, y)` indexes the last cell of row y-1 and the map MIRRORS its opposite edge into the
  // margin: explored-looking ground in a place nobody has been.
  ok(!isSeen(s, 5, -1) && !isSeen(s, 5, s.ch), 'rows out of range are unseen too')
}

// ── 4a. ★ AN OFF-GRID READ MUST NOT WRAP INTO THE NEIGHBOURING ROW ─────────────────────────────
// The renderer asks about cells beyond the edge constantly — the minimap crops a fixed box around
// the player, so standing near any border queries negative and over-wide columns every frame.
// Without the guard, `isSeen(-1, y)` indexes the LAST cell of row y-1: the map mirrors its opposite
// edge into the margin as explored-looking ground nobody has walked.
//
// ⚠ This has to be set up so the wrapped index lands on a cell that IS seen. The first version of
// this assert queried an empty world, got `false` from the wrap by luck, and passed under a mutation
// that deleted the guard entirely — green for the wrong reason, which is worse than no assert.
{
  const s = emptySeen(COLS, ROWS)
  see(s, (s.cw - 1) * CELL + CELL / 2, 4 * CELL + CELL / 2)   // opens the RIGHT edge of row 4
  see(s, CELL / 2, 5 * CELL + CELL / 2)                        // opens the LEFT edge of row 5
  ok(isSeen(s, s.cw - 1, 4), 'fixture: the end of row 4 is open')
  ok(isSeen(s, 0, 5), 'fixture: the start of row 5 is open')
  ok(!isSeen(s, -1, 5), '★ column -1 of row 5 is unseen — NOT the open cell at the end of row 4')
  ok(!isSeen(s, s.cw, 4), '★ and one past the right edge of row 4 is not the open start of row 5')
}

// ── 4b. ★ THE DISC IS CENTRED ON THE KEEPER, NOT HALF A CELL OFF ───────────────────────────────
// Measuring to a cell's CORNER instead of its centre shifts the whole reveal half a cell. It is
// invisible in a screenshot and it means the map opens further ahead of you than behind, forever.
{
  const s = emptySeen(COLS, ROWS)
  const tx = CELL * 25 + CELL / 2, ty = CELL * 20 + CELL / 2   // exactly on a cell centre
  see(s, tx, ty)
  const cx = Math.floor(tx / CELL), cy = Math.floor(ty / CELL)
  let symmetric = true
  for (let d = 1; d <= Math.ceil(SEE_RADIUS / CELL) + 1; d++) {
    if (isSeen(s, cx - d, cy) !== isSeen(s, cx + d, cy)) symmetric = false
    if (isSeen(s, cx, cy - d) !== isSeen(s, cx, cy + d)) symmetric = false
  }
  ok(symmetric, '★ the same distance opens on both sides of the keeper, on both axes')
}

// ── 5. a round trip through storage is exact ───────────────────────────────────────────────────
{
  const s = emptySeen(COLS, ROWS)
  see(s, 40, 40); see(s, 150, 120); see(s, 12, 99)
  const back = decodeSeen(encodeSeen(s), COLS, ROWS)!
  ok(!!back, 'a saved map loads')
  ok(back.cw === s.cw && back.ch === s.ch, 'the dimensions survive')
  let same = true
  for (let y = 0; y < s.ch; y++) for (let x = 0; x < s.cw; x++) if (isSeen(s, x, y) !== isSeen(back, x, y)) same = false
  ok(same, 'every cell comes back exactly as it went in')
}

// ── 6. ★ THE STRIDE CHECK — a resized world throws the record away instead of skewing it ───────
// Without this the same bits are read against a new width. Nothing errors. The keeper's history
// shears diagonally across the map and stays that way forever, looking like a renderer bug.
{
  const s = emptySeen(COLS, ROWS)
  see(s, 40, 40)
  const raw = encodeSeen(s)
  ok(decodeSeen(raw, COLS, ROWS) !== null, 'the same world still loads')
  ok(decodeSeen(raw, COLS + CELL * 4, ROWS) === null, '★ a wider world refuses the old record')
  ok(decodeSeen(raw, COLS, ROWS + CELL * 4) === null, '★ and so does a taller one')
}

// ── 7. corrupt input is refused, never half-read ───────────────────────────────────────────────
{
  ok(decodeSeen('', COLS, ROWS) === null, 'empty string')
  ok(decodeSeen('garbage', COLS, ROWS) === null, 'not the format')
  ok(decodeSeen('10,10,!!!not base64!!!', COLS, ROWS) === null, 'bad payload')
  const s = emptySeen(COLS, ROWS)
  ok(decodeSeen(`${s.cw},${s.ch},${btoa('short')}`, COLS, ROWS) === null,
    'a payload of the wrong LENGTH is refused — a truncated save must not read as a half-explored world')
}

// ── 8. the fraction tracks the walk ────────────────────────────────────────────────────────────
{
  const s = emptySeen(COLS, ROWS)
  ok(seenFraction(s) === 0, 'nothing walked')
  see(s, 100, 80)
  const one = seenFraction(s)
  ok(one > 0 && one < 0.2, `one standing spot is a small slice of the world (${(one * 100).toFixed(1)}%)`)
  for (let x = 0; x < COLS; x += CELL) for (let y = 0; y < ROWS; y += CELL) see(s, x, y)
  ok(seenFraction(s) > 0.99, 'walking the whole grid opens (almost) all of it')
  ok(seenFraction(s) <= 1, 'and never more than all of it')
}

console.log(fails.length ? `discovery: ${pass} pass, ${fails.length} FAIL` : `discovery oracle ${pass} CLEAN`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
