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
  windBlocks: solid,
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
    windBlocks: opaque2,
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
    windBlocks: solid,
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

console.log('★ wind — the third precondition (canon 2026-09-07)')
{
  // Canon: a Hollow needs a SEED, seeds are wind-borne, so sealed rock gets none however dark.
  // This file's world already has exactly the right shape: a SEALED cave under solid rock.
  check('★★ open air above the surface is reached by the wind', field.windAt(4, 12, 4) === true)
  check('★★ the surface voxel itself is reached', field.windAt(4, SURFACE, 4) === true)
  check('★★★ A SEALED CAVE IS NOT — no wind, therefore no seed, therefore nothing may body there',
    field.windAt(3, 3, 3) === false)
  // ⚠ AND THE CONTRAST THAT KEEPS THIS FROM BEING A RESTATEMENT OF THE LIGHT TEST: that same cave
  // is *spawn-dark* at every hour and always was. Dark and seedless are different questions, which
  // is the entire reason this channel exists rather than being derived from the sky one.
  check('★★★ ...while being perfectly DARK — dark and seedless are different questions',
    spawnDark(field.get(3, 3, 3), dayFactor(0.5)) === true)
  check('solid rock is not wind-reached either', field.windAt(4, 5, 4) === false)
  // ⚠ OUT OF BOUNDS IS `false`, THE OPPOSITE DEFAULT FROM `get`, AND DELIBERATELY SO: absent light
  // reads dark (permissive to a spawn), absent wind reads sealed (refusing one). Both fail safe.
  check('★★ out of bounds reads NO WIND, where out of bounds reads DARK',
    field.windAt(-1, 0, 0) === false && field.windAt(99, 99, 99) === false && field.get(-1, 0, 0) === 0)
}

console.log('★ wind reaches a cave through a shaft — "a cave with a mouth"')
{
  // Canon is explicit that darkness-as-a-place survives: *a cave with a mouth, a deep overhang, a
  // warren* are all eligible. A channel that refused every cave would satisfy the sealed-cave
  // assert above and destroy the feature, so the opposite case is asserted too.
  const shaft = (x: number, y: number, z: number) => x === 4 && z === 4 && y < SURFACE
  const opaque3 = (x: number, y: number, z: number) => solid(x, y, z) && !shaft(x, y, z)
  const f4 = computeLight(bounds, {
    opaque: opaque3,
    windBlocks: opaque3,
    emit: () => 0,
    openToSky: (x, z, y) => { for (let yy = y + 1; yy < bounds.y0 + bounds.sy; yy++) if (opaque3(x, yy, z)) return false; return true },
  })
  check('★★★ the cave now has a mouth, so the wind gets all the way in', f4.windAt(2, 3, 4) === true)
  check('★★ and it did NOT before — the same cell, same world minus the shaft',
    field.windAt(2, 3, 4) === false)
  // ★ Wind does not decay, which is why it cannot be derived from the sky channel.
  // ⚠ THE FIRST VERSION OF THIS ASSERT DEMANDED `sky === 0` HERE AND WENT RED AT 13 — the cave is
  // four cells wide, so nothing in it is more than three steps from the shaft and sky cannot decay
  // to nothing. **The claim was wrong about the fixture, not about the code.** What this box CAN
  // show is that the two channels come apart at all; the full separation (wind reached, sky exactly
  // 0) needs a cave deeper than fifteen blocks and is asserted against the real world in
  // `voxel3d/hollow-wind.test.ts`, which is also where it matters.
  // ⚠⚠ THE VERTICAL FLOOD NEEDS ITS OWN CASE, AND A MUTATION SWEEP IS WHAT SAID SO. Dropping the
  // y-neighbours from `windSlice` left every assert above green: the shaft is open to the sky for
  // its whole length, so the SEED loop walks straight down it and the flood only ever had to
  // spread sideways. A mutation that removes vertical propagation must be caught by a chamber the
  // wind can only reach by DESCENDING through a cell that is not itself open to the sky.
  {
    // The shaft reaches the cave at y=3. A second chamber at y=1 hangs below it, joined by a one-
    // cell hole at (3,2,3) — nothing there is open to sky, so only a downward flood can fill it.
    // ⚠ THE CHAMBER MUST NOT TOUCH THE SHAFT, and the first version did. `lower` spanned x2..5 /
    // z2..5, which contains the shaft cell (4,·,4) — the shaft runs to y=0, so the chamber was
    // already sky-connected and sealing the hole changed nothing. **The negative control failed
    // and it was right to: the fixture had two paths and the assert claimed one.**
    const lower = (x: number, y: number, z: number) => y === 1 && x >= 2 && x <= 3 && z >= 2 && z <= 3
    const hole = (x: number, y: number, z: number) => y === 2 && x === 3 && z === 3
    const opaque4 = (x: number, y: number, z: number) =>
      solid(x, y, z) && !shaft(x, y, z) && !lower(x, y, z) && !hole(x, y, z)
    const f5 = computeLight(bounds, {
      opaque: opaque4,
      windBlocks: opaque4,
      emit: () => 0,
      openToSky: (x, z, y) => { for (let yy = y + 1; yy < bounds.y0 + bounds.sy; yy++) if (opaque4(x, yy, z)) return false; return true },
    })
    check('fixture: the lower chamber is not open to the sky', f5.sky(2, 1, 2) < MAX_LIGHT)
    check('fixture: and it does not touch the shaft', !shaft(2, 1, 2) && !shaft(3, 1, 3))
    check('★★★ the wind DESCENDS: a chamber reachable only by going down is still ventilated',
      f5.windAt(2, 1, 2) === true)
    check('★★ and the hole is what does it — seal it and the chamber goes sealed', (() => {
      const opaque5 = (x: number, y: number, z: number) => opaque4(x, y, z) || hole(x, y, z)
      const f6 = computeLight(bounds, {
        opaque: opaque5, windBlocks: opaque5, emit: () => 0,
        openToSky: (x, z, y) => { for (let yy = y + 1; yy < bounds.y0 + bounds.sy; yy++) if (opaque5(x, yy, z)) return false; return true },
      })
      return f6.windAt(2, 1, 2) === false
    })())
  }

  check('★★★ the channels come apart: wind is full strength where sky has already decayed',
    f4.windAt(2, 3, 4) === true && f4.sky(2, 3, 4) < MAX_LIGHT && f4.sky(2, 3, 4) > 0,
    `sky=${f4.sky(2, 3, 4)}`)
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
    windBlocks: (x: number, y: number, z: number) => solid(x, y, z),
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
    check(`stepped @${budget}ms finishes`, w.phase === 6 && w.field !== null, `slices=${slices}`)
    const same = w.field !== null && w.field.data.length === oneShot.data.length
      && w.field.data.every((v, i) => v === oneShot.data[i])
    check(`stepped @${budget}ms is byte-identical to computeLight`, same)
    // ⚠⚠ THE WIND CHANNEL IS COMPARED SEPARATELY, VIA `windAt`, BECAUSE IT LIVES IN ITS OWN ARRAY.
    // Adding a channel on 2026-09-07 left this equivalence asserting only `data` — so the stepped
    // and one-shot wind floods could have diverged completely and the guard stayed green. Widening
    // a structure leaves its consumers stale and quiet, and here the stale consumer IS the guard.
    let windSame = w.field !== null
    if (w.field) for (let y = bounds.y0; y < bounds.y0 + bounds.sy && windSame; y++)
      for (let z = bounds.z0; z < bounds.z0 + bounds.sz && windSame; z++)
        for (let x = bounds.x0; x < bounds.x0 + bounds.sx; x++)
          if (w.field.windAt(x, y, z) !== oneShot.windAt(x, y, z)) { windSame = false; break }
    check(`stepped @${budget}ms wind channel is identical too`, windSame)
    // The interesting half: a tiny budget must ACTUALLY have paused, or this case proved nothing.
    if (budget !== Infinity) {
      check(`stepped @${budget}ms really resumed rather than finishing in one call`, slices > 0, `slices=${slices}`)
    }
  }

  // A partial field must never be readable — the host's "skip, never guess" rule one layer down.
  const partial = beginLight(bounds, inputs)
  stepLight(partial, 0)
  check('★ a partial build exposes no field', partial.phase !== 6 ? partial.field === null : true)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
