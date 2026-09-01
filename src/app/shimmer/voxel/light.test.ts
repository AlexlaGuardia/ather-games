// Run: npx tsx src/app/shimmer/voxel/light.test.ts
//
// The asserts that earn their place are the four behavioural ones, because each is a property the
// whole spawn feature rests on and each fails silently:
//
//   1. a cave stays dark at noon              — else mobs never spawn underground
//   2. the surface darkens at night           — else they never spawn outside
//   3. a torch is safe at midnight            — else lighting your base does nothing
//   4. sky falls straight down without decay  — else deep shafts go dark and caves leak eligibility
//
// Everything above them is packing arithmetic, which is worth pinning only because both channels
// share one byte and a nibble bug would be invisible in-game until it was load-bearing.

import {
  MAX_LIGHT, packLight, skyOf, blockOf, computeLight, dayFactor, effectiveLight, spawnDark,
  beginLight, stepLight,
  type LightBounds,
} from './light'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

console.log('packing')
{
  check('round-trips both channels', skyOf(packLight(12, 3)) === 12 && blockOf(packLight(12, 3)) === 3)
  check('channels do not bleed', skyOf(packLight(0, 15)) === 0 && blockOf(packLight(15, 0)) === 0)
  check('clamps high', skyOf(packLight(99, 0)) === MAX_LIGHT && blockOf(packLight(0, 99)) === MAX_LIGHT)
  check('clamps low', skyOf(packLight(-5, 0)) === 0 && blockOf(packLight(0, -5)) === 0)
  check('stays inside a byte', packLight(15, 15) === 255)
}

console.log('dayFactor')
{
  check('noon is full', dayFactor(0.5) === 1)
  check('midnight is nothing', dayFactor(0) === 0 && dayFactor(0.99) === 0)
  check('dusk is partial', dayFactor(0.75) > 0 && dayFactor(0.75) < 1)
  check('dawn is partial', dayFactor(0.25) > 0 && dayFactor(0.25) < 1)
  // A hard switch would pop an entire world of spawns into existence on one frame.
  check('★ the transition is gradual, not a step', dayFactor(0.22) < dayFactor(0.26) && dayFactor(0.26) < dayFactor(0.29))
  check('wraps past 1 without a caller guard', dayFactor(1.5) === dayFactor(0.5))
  check('tolerates negatives', dayFactor(-0.5) === dayFactor(0.5))
}

// ── a world: open sky above y=8, solid rock below, with a sealed cave at y=3 ──────────────────
const bounds: LightBounds = { x0: 0, y0: 0, z0: 0, sx: 8, sy: 16, sz: 8 }
const SURFACE = 8
const isCave = (x: number, y: number, z: number) => y === 3 && x >= 2 && x <= 5 && z >= 2 && z <= 5
const solid = (x: number, y: number, z: number) => y < SURFACE && !isCave(x, y, z)

const field = computeLight(bounds, {
  opaque: solid,
  emit: () => 0,
  // Nothing above this slice, so "open to sky" is just "nothing solid above you".
  openToSky: (x, z, y) => { for (let yy = y + 1; yy < bounds.y0 + bounds.sy; yy++) if (solid(x, yy, z)) return false; return true },
})

console.log('sky flood')
{
  check('open air above the surface is full sky', field.sky(4, 12, 4) === MAX_LIGHT)
  check('the surface voxel itself is full sky', field.sky(4, SURFACE, 4) === MAX_LIGHT)
  check('solid rock holds no light', field.sky(4, 5, 4) === 0 && field.block(4, 5, 4) === 0)
  // ★ THE ONE THAT MATTERS FOR CAVES. A sealed pocket under rock must never see the sun.
  check('★ a sealed cave is pitch dark', field.sky(3, 3, 3) === 0 && field.block(3, 3, 3) === 0,
    `sky=${field.sky(3, 3, 3)}`)
  check('out of bounds reads dark, not bright', field.get(-1, 0, 0) === 0 && field.get(99, 99, 99) === 0)
}

console.log('★ sky falls straight down without decay')
{
  // A 1-wide shaft punched to the cave floor. If downward propagation decayed, a deep shaft would
  // go dark partway and the bottom would stay spawn-eligible under an open sky.
  const shaft = (x: number, y: number, z: number) => x === 4 && z === 4 && y < SURFACE
  const opaque2 = (x: number, y: number, z: number) => solid(x, y, z) && !shaft(x, y, z)
  const f2 = computeLight(bounds, {
    opaque: opaque2,
    emit: () => 0,
    openToSky: (x, z, y) => { for (let yy = y + 1; yy < bounds.y0 + bounds.sy; yy++) if (opaque2(x, yy, z)) return false; return true },
  })
  check('★ the bottom of a 8-deep shaft is still full sky', f2.sky(4, 0, 4) === MAX_LIGHT, `got ${f2.sky(4, 0, 4)}`)
  // ...but sideways off the shaft it decays, or the whole cave would light up through one hole.
  check('sideways from the shaft decays', f2.sky(5, 3, 4) < MAX_LIGHT && f2.sky(5, 3, 4) > 0,
    `got ${f2.sky(5, 3, 4)}`)
  check('far side of the cave is darker than the near side', f2.sky(2, 3, 4) < f2.sky(5, 3, 4) || f2.sky(2, 3, 4) === 0)
}

console.log('block light')
{
  // One torch in the sealed cave.
  const f3 = computeLight(bounds, {
    opaque: solid,
    emit: (x, y, z) => (x === 3 && y === 3 && z === 3 ? MAX_LIGHT : 0),
    openToSky: (x, z, y) => { for (let yy = y + 1; yy < bounds.y0 + bounds.sy; yy++) if (solid(x, yy, z)) return false; return true },
  })
  check('the torch voxel is fully lit', f3.block(3, 3, 3) === MAX_LIGHT)
  check('light decays with distance', f3.block(4, 3, 3) === MAX_LIGHT - 1 && f3.block(5, 3, 3) === MAX_LIGHT - 2)
  check('rock does not carry block light', f3.block(3, 5, 3) === 0)
  check('the torch adds no sky light', f3.sky(3, 3, 3) === 0, 'channels must stay independent')

  // ★ THE PROPERTY THAT MAKES LIGHTING A BASE WORTH DOING.
  check('★ a torch is safe at midnight', spawnDark(f3.get(3, 3, 3), dayFactor(0)) === false)
  check('★ ...and so is the block beside it', spawnDark(f3.get(4, 3, 3), dayFactor(0)) === false)
}

console.log('★ spawn eligibility — the four behaviours')
{
  const noon = dayFactor(0.5), midnight = dayFactor(0)
  const caveCell = field.get(3, 3, 3)
  const surfaceCell = field.get(4, SURFACE, 4)

  check('★ 1. a cave is spawnable at NOON', spawnDark(caveCell, noon) === true)
  check('★ 2. the surface is NOT spawnable at noon', spawnDark(surfaceCell, noon) === false)
  check('★ 3. the surface IS spawnable at midnight', spawnDark(surfaceCell, midnight) === true)
  check('★ 4. the cave is spawnable at midnight too', spawnDark(caveCell, midnight) === true)

  // Block light is a VETO, not a contribution — a bright day must not mask an unlit corner and a
  // dark night must not overwhelm a torch. Folding the two into a sum breaks both directions.
  check('★ block light vetoes regardless of the hour', spawnDark(packLight(0, 1), midnight) === false)
  check('★ ...even one single level of it', spawnDark(packLight(15, 1), noon) === false)
  check('zero of both is always dark', spawnDark(packLight(0, 0), noon) === true)

  check('effectiveLight scales sky by the clock', effectiveLight(packLight(15, 0), 0.5) === 7.5)
  check('effectiveLight takes the max, not the sum', effectiveLight(packLight(10, 4), 1) === 10)
}

// ── ★★★ THE STEPPED BUILD MUST EQUAL THE ONE-SHOT BUILD, CELL FOR CELL ────────────────────────
//
// The whole justification for slicing the flood (2026-09-01) is that it changes WHEN the work
// happens and nothing else. That is a claim about output, so it is checked as one: the same box
// built at several slice sizes, compared byte by byte against `computeLight`.
//
// ⚠ THE SLICE SIZES MATTER MORE THAN THE COUNT. 0 forces a pause at every single check interval,
// which is the case that actually exercises resumption — a generous budget finishes in one call
// and would assert nothing about the seam. A test that only ran the fast slice would be green
// while resumption was completely broken.
{
  // A box with terrain, an overhang and an emitter, so every phase has real work: both seed loops
  // are non-empty and both floods spread.
  // ⚠⚠ THE BOX IS NON-SQUARE AND LARGER THAN `STEP_CHECK` ON PURPOSE, AND BOTH WERE FOUND BY
  // MUTATION, NOT BY DESIGN (2026-09-01). The first version was 12x10x12 and TWO mutations passed
  // it clean:
  //   · swapping the sky seed's `c / sx` for `c / sz` is a NO-OP when sx === sz, so the mutation
  //     could not apply — a mutation that cannot apply is indistinguishable from a guard that works
  //   · the sky seed was 144 units against a 256-unit check interval, so it never paused and never
  //     resumed; a mutation resetting the seed cursor every slice therefore changed nothing
  // 20 x 14 makes the axes distinguishable (280 seed columns, 2800 cells), so both phases actually
  // cross a check boundary and both axes are separable. ⚠ Do not "tidy" these back to equal.
  const bounds: LightBounds = { x0: 0, y0: 0, z0: 0, sx: 20, sy: 10, sz: 14 }
  const solid = (x: number, y: number, z: number) => y < 3 || (y === 6 && x > 3 && x < 15 && z > 3 && z < 11)
  const inputs = {
    opaque: (x: number, y: number, z: number) => solid(x, y, z),
    emit: (x: number, y: number, z: number) => (x === 5 && y === 4 && z === 5 ? 14 : 0),
    openToSky: (x: number, z: number, y: number) => y >= 3,
  }

  const oneShot = computeLight(bounds, inputs)
  check('the reference field is not trivially empty', oneShot.data.some(v => v !== 0))
  check('the emitter actually lit something', oneShot.block(6, 4, 5) > 0)
  check('the overhang shades the cell beneath it', oneShot.sky(5, 5, 5) < MAX_LIGHT)

  for (const budget of [0, 0.05, 0.5, Infinity]) {
    const w = beginLight(bounds, inputs)
    let slices = 0
    // ⚠ A BOUND, NOT A `while (true)`: a resumption bug that fails to advance would otherwise hang
    // the suite with no output, and a hang is the one failure a sweep cannot report usefully.
    while (!stepLight(w, budget) && slices < 100000) slices++
    check(`stepped @${budget}ms finishes`, w.phase === 4 && w.field !== null, `slices=${slices}`)
    const same = w.field !== null && w.field.data.length === oneShot.data.length
      && w.field.data.every((v, i) => v === oneShot.data[i])
    check(`stepped @${budget}ms is byte-identical to computeLight`, same)
    // The interesting half: a tiny budget must ACTUALLY have paused, or this case proved nothing.
    if (budget !== Infinity) {
      check(`stepped @${budget}ms really resumed rather than finishing in one call`, slices > 0, `slices=${slices}`)
    }
  }

  // A partial field must never be readable — the host's "skip, never guess" rule one layer down.
  const partial = beginLight(bounds, inputs)
  stepLight(partial, 0)
  check('★ a partial build exposes no field', partial.phase !== 4 ? partial.field === null : true)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
