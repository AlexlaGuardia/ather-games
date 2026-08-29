// The green's terrain oracle. Run: npx tsx src/app/shimmer/voxel/green-terrain.test.ts
//
// ★ THE PROPERTY: **the ground and the seating must agree.** Two pure modules decide where a seat is
// and how worn a cell is; this one turns both into ground. The failure that matters is not a crash —
// it is a bank half a block under a seat, or an aisle that is clear of audience and blocked by a
// step, and both of those look like architecture.
import { greenProfileAt, greenSurfaceAt, type GreenMats } from './green-terrain'
import { holdRows, bowlCentre, DEFAULT_ROWS } from './hold-rows'
import { bowlAt, DEFAULT_FLOOR } from './ring-floor'
import { DOWNBARROW_HEARTS } from './burrowtown'
import type { Box } from './jigsaw'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const GREEN: Box = { x0: 100, x1: 130, z0: 200, z1: 230 }
const C = bowlCentre(GREEN)
const ENTRY = 0
const M: GreenMats = { grass: 5, bare: 8, scorch: 40, tier: 4 }

// ── 1. ★★★ THE GROUND UNDER A SEAT IS AT THE SEAT'S OWN HEIGHT ────────────────────────────────
// The integration assert, and the one worth having: `hold-rows` says a seat sits at `row * rise`,
// and this file banks the ground up under it. If the two disagree the audience floats or is buried,
// and each module stays perfectly correct about its own half.
{
  const seats = holdRows(GREEN, ENTRY)
  ok(seats.length > 30, `★★ BLIND CHECK: ${seats.length} seats to stand on`)
  let wrong = 0, checked = 0
  for (const s of seats) {
    const ground = greenProfileAt(GREEN, Math.round(s.x), Math.round(s.z), ENTRY)
    checked++
    // The seat's own y is measured in courses above the green; the bank is one course taller,
    // because a seat sits ON the bank rather than inside it.
    if (ground !== s.y + DEFAULT_ROWS.rise) wrong++
  }
  ok(checked > 30 && wrong === 0,
    `★★★ every seat has its own bank under it (${wrong} of ${checked} floating or buried)`)
}

// ── 2. ★★★ THE AISLE IS FLAT, OR THE BEAT CANNOT BE WALKED ────────────────────────────────────
// S4 walks the player *"past the audience on the way in"*. `holdRows` leaves the seats out of that
// wedge; if the GROUND does not agree, the aisle is clear of audience and blocked by a step.
{
  for (const entry of [0, 1.4, -2.1, Math.PI]) {
    let blocked = 0
    for (let r = DEFAULT_ROWS.innerRadius - 1; r <= DEFAULT_ROWS.innerRadius + DEFAULT_ROWS.rows * DEFAULT_ROWS.rowStep + 1; r += 0.5) {
      const x = Math.round(C.x + Math.cos(entry) * r), z = Math.round(C.z + Math.sin(entry) * r)
      if (greenProfileAt(GREEN, x, z, entry) > 0) blocked++
    }
    ok(blocked === 0, `★★★ the way in at ${entry.toFixed(2)} rad is walkable (${blocked} banked cells across it)`)
  }
}

// ── 3. ★★ THE PROFILE DIPS IN THE MIDDLE AND BANKS UP OUTSIDE ─────────────────────────────────
{
  ok(greenProfileAt(GREEN, C.x, C.z, ENTRY) < 0, '★★ the middle dips')
  ok(greenProfileAt(GREEN, C.x + 40, C.z, ENTRY) === 0, '★ and well outside, the green is left alone')
  let banked = 0
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const r = DEFAULT_ROWS.innerRadius + DEFAULT_ROWS.rowStep
    if (greenProfileAt(GREEN, Math.round(C.x + Math.cos(a) * r), Math.round(C.z + Math.sin(a) * r), ENTRY) > 0) banked++
  }
  ok(banked > 40, `★★★ there is a real bank around the rim (${banked} cells of ~126 sampled) — a ring of seats on flat ground is a circle of chairs, not a stand`)
  // ⚠ Rows must step UP outward, or the back row cannot see over the front.
  // ⚠ SAMPLED AWAY FROM THE AISLE. The first version of this walked out along +x with `ENTRY = 0` —
  // which is the way in, where the ground is correctly FLAT — and read 0 → 0. The assert was
  // measuring the one bearing that must not bank, and the failure was the aisle working.
  const away = Math.PI
  const stepAt = (r: number) =>
    greenProfileAt(GREEN, Math.round(C.x + Math.cos(away) * r), Math.round(C.z + Math.sin(away) * r), ENTRY)
  const inner = stepAt(DEFAULT_ROWS.innerRadius)
  const outer = stepAt(DEFAULT_ROWS.innerRadius + DEFAULT_ROWS.rowStep * 2)
  ok(outer > inner && inner > 0,
    `★★ each row banks higher than the one inside it, off the aisle (${inner} → ${outer})`)
}

// ── 4. ★★★ DOCTRINE TOUCHES THE SURFACE AND NEVER THE SHAPE ───────────────────────────────────
// `ring-floor.ts` records why: freeing takes the colour back and does not un-dig the hollow. If the
// profile could see `taken`, the reward beat would flatten the bowl the act was staged in.
{
  let differs = 0
  for (let x = -16; x <= 16; x++) for (let z = -16; z <= 16; z++) {
    const a = greenProfileAt(GREEN, C.x + x, C.z + z, ENTRY)
    if (a !== greenProfileAt(GREEN, C.x + x, C.z + z, ENTRY)) differs++
  }
  ok(differs === 0, '★★★ the profile takes no doctrine argument at all — the shape cannot depend on who owns the hill')

  let free = 0, taken = 0
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
    if (greenSurfaceAt(GREEN, C.x + x, C.z + z, ENTRY, false, M) === M.scorch) free++
    if (greenSurfaceAt(GREEN, C.x + x, C.z + z, ENTRY, true, M) === M.scorch) taken++
  }
  ok(free === 0, `★★★ a FREE green is never scorched (${free} cells)`)
  ok(taken > 0, `★★ while a taken one is (${taken}) — the guard is not simply always-clean`)
}

// ── 5. ★★ THE SURFACE IS MADE OF WHAT THE CALLER SAID ─────────────────────────────────────────
// ⚠ Materials are passed IN — `depth.ts` and `attrs.ts` are a module cycle, so nothing here may
// import MAT. A hardcoded id would close the cycle at import time and fail as a BLANK WORLD.
{
  const odd: GreenMats = { grass: 901, bare: 902, scorch: 903, tier: 904 }
  const seen = new Set<number>()
  for (let x = -16; x <= 16; x++) for (let z = -16; z <= 16; z++) {
    seen.add(greenSurfaceAt(GREEN, C.x + x, C.z + z, ENTRY, true, odd))
  }
  const emitted = [...seen].filter(v => v !== 0)
  ok(emitted.length > 0 && emitted.every(v => v >= 901 && v <= 904),
    `★★★ every emitted material came from the caller's bundle (${emitted.join(', ')}) — nothing here knows a MAT id`)
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'green-terrain.ts'), 'utf8')
  ok(src.length > 2000, '★★ BLIND CHECK: the module was read')
  ok(!/from '\.\/depth'|MAT\./.test(src),
    '★★★ and it imports no MAT — the module cycle would close at import time and fail as a blank world, not a compile error')
}

// ── 6. ★★ OUTSIDE THE BOWL AND OFF THE BANKS, THIS FILE HAS NO OPINION ────────────────────────
// 0 means "the green's own business". A module that answered everywhere would pave the whole piece.
{
  ok(greenSurfaceAt(GREEN, C.x + 40, C.z + 40, ENTRY, true, M) === 0,
    '★★ well outside, nothing is emitted')
  let opinions = 0, cells = 0
  for (let x = 0; x <= 30; x++) for (let z = 0; z <= 30; z++) {
    cells++
    if (greenSurfaceAt(GREEN, GREEN.x0 + x, GREEN.z0 + z, ENTRY, true, M) !== 0) opinions++
  }
  ok(opinions < cells * 0.75,
    `★★★ the green is not paved end to end (${opinions} of ${cells} cells claimed) — the bowl and its banks are a feature IN a green, not the whole of it`)
  ok(opinions > cells * 0.15, `★★ but the set piece is substantial (${opinions} of ${cells})`)
}

// ── 7. ★★ EVERY GREEN THE POOL PRODUCES WORKS ─────────────────────────────────────────────────
{
  for (const g of DOWNBARROW_HEARTS) {
    const box: Box = { x0: 0, x1: g.w - 1, z0: 0, z1: g.d - 1 }
    const seats = holdRows(box, 0)
    let wrong = 0
    for (const s of seats) {
      if (greenProfileAt(box, Math.round(s.x), Math.round(s.z), 0) !== s.y + DEFAULT_ROWS.rise) wrong++
    }
    ok(wrong === 0, `★★★ '${g.id}': all ${seats.length} seats sit on their own bank (${wrong} wrong)`)
    ok(bowlAt(box, bowlCentre(box).x, bowlCentre(box).z).drop > 0, `★★ '${g.id}' has its bowl`)
  }
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the ground and the seating agree — ${pass} passed`)
