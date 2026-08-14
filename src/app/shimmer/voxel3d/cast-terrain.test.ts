// ── Conjured terrain as REAL VOXELS — headless oracle ───────────────────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/cast-terrain.test.ts
//
// ★ WHAT IS AT STAKE HERE IS THE PLAYER'S SAVE, WHICH IS WHY THIS IS THE FIRST THING WRITTEN.
// Every other cast archetype is additive: a field burns, a bolt flies, and if the numbers are wrong
// somebody plays a worse fight. Terrain WRITES INTO THE WORLD. Two ways to get it wrong and both are
// unrecoverable for the player:
//
//   1. write over something that was there → expiry "restores" AIR over a chest, a bench, a sapling
//   2. fail to hand blocks back → the world keeps free unbreakable stone forever
//
// So the write rule is pure (`conjuredWriteCells`) and asserted here, rather than living inside a
// 5,000-line React component where nothing can reach it.
//
// ⚠ The HOST half — writing straight into sections so nothing enters the save, and the id-diff that
// reverts an evicted wall — is not testable headlessly (it needs live columns). What IS pinned here
// is the decision those two paths act on: exactly which cells a cast claims.

import { conjuredWriteCells, wallCells, ringCells, blockCells, shapeCells, conjure, expireConjured,
         MAX_CONJURED, resetConjuredIds } from '../engine/conjured-terrain'
import { MAT } from '../voxel/depth'
import { blockDef, canBreak, breakSeconds } from '../voxel/registry'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const H = 256
const allAir = () => true
const flat = (_x: number, _z: number) => 64

// ── 1. ★ IT NEVER OVERWRITES ANYTHING ──────────────────────────────────────────────────────────
{
  const cells = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }]
  // A chest sits at the second cell, one above the ground line.
  const occupied = new Set(['1,65,0'])
  const isAir = (x: number, y: number, z: number) => !occupied.has(`${x},${y},${z}`)

  const wrote = conjuredWriteCells(cells, 3, flat, isAir, H)
  chk('★ the occupied cell is NOT claimed', !wrote.some((c) => c.x === 1 && c.y === 65 && c.z === 0))
  chk('...so reverting to air can never destroy what was there',
    wrote.every((c) => isAir(c.x, c.y, c.z)))
  // ⚠ And it SKIPS rather than stops: a wall crossing a boulder carries on with a notch missing.
  chk('...but the rest of that column still builds around it',
    wrote.some((c) => c.x === 1 && c.y === 66), 'a blocked cell must not abort its column')
  chk('...and the cells beyond it are unaffected',
    wrote.filter((c) => c.x === 2).length === 3)
}

// ── 2. every column grows from ITS OWN ground ───────────────────────────────────────────────────
{
  // A slope: ground rises one per step in x.
  const slope = (x: number, _z: number) => 64 + x
  const wrote = conjuredWriteCells([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }], 2, slope, allAir, H)
  const lowest = (x: number) => Math.min(...wrote.filter((c) => c.x === x).map((c) => c.y))
  chk('a wall on a slope steps with the slope', lowest(0) === 65 && lowest(1) === 66 && lowest(2) === 67)
  chk('...so no column buries itself and none floats',
    wrote.every((c) => c.y > slope(c.x, c.z) && c.y <= slope(c.x, c.z) + 2))
}

// ── 3. shapes, heights and the world ceiling ───────────────────────────────────────────────────
{
  chk('a 5-long wall × 2 tall claims 10 voxels',
    conjuredWriteCells(wallCells(0, 0, 0, 1, 5), 2, flat, allAir, H).length === 10)
  chk('a 3-side block × 4 tall claims 36', conjuredWriteCells(blockCells(0, 0, 3), 4, flat, allAir, H).length === 36)
  chk('a ring is hollow, so it claims fewer than a block of the same span',
    conjuredWriteCells(ringCells(0, 0, 4), 3, flat, allAir, H).length <
    conjuredWriteCells(blockCells(0, 0, 9), 3, flat, allAir, H).length)
  // Cast on a mountaintop: it must clamp, not write outside the world.
  const nearTop = (_x: number, _z: number) => H - 2
  const capped = conjuredWriteCells([{ x: 0, z: 0 }], 6, nearTop, allAir, H)
  chk('a cast near the world ceiling clamps instead of writing out of bounds',
    capped.length === 1 && capped[0].y === H - 1, `${capped.length} cells`)
  chk('nothing is ever claimed below the world', !conjuredWriteCells([{ x: 0, z: 0 }], 3, () => -5, allAir, H).some((c) => c.y < 0))
}

// ── 4. ★ CAST MATTER CANNOT BE QUARRIED — the anti-exploit, at the registry ────────────────────
// Without this a keeper casts a 16-mana Stonewall, mines it for rubble, and repeats forever. It is
// enforced by `hardness: Infinity` rather than a guard in the mining path, so no future dig route
// can miss it.
{
  const def = blockDef(MAT.CONJURED)
  chk('MAT.CONJURED is registered', !!def)
  chk('★ it can never be broken, by any tool at any tier',
    !canBreak(MAT.CONJURED, 99, 'prospecting') && !canBreak(MAT.CONJURED, 0, null))
  chk('...because breaking it takes forever, at the registry', breakSeconds(MAT.CONJURED, 99, 'prospecting') === Infinity)
  chk('...and it would pay nothing even if something forced it', (def?.drops.length ?? -1) === 0)
  chk('it is not placeable by hand — a keeper casts it or does without', def?.placeable !== true)
}

// ── 5. the cap evicts, which is why the host keeps a written-cell RECORD ───────────────────────
// The pure module has no idea the host wrote voxels, so an evicted wall would keep its blocks
// forever unless the host notices the id vanish. This pins the eviction the host has to watch for.
{
  resetConjuredIds()
  const T0 = 1_000_000
  let list = conjure([], 'first', wallCells(0, 0, 0, 1, 3), 60, 2, T0)
  const firstId = list[0].id
  for (let i = 1; i <= MAX_CONJURED; i++) list = conjure(list, `m${i}`, wallCells(i, 0, 0, 1, 3), 60, 2, T0)
  chk('the cap holds', list.length === MAX_CONJURED)
  chk('★ and the OLDEST is evicted — the host must hand its blocks back',
    !list.some((c) => c.id === firstId))
  chk('a paid cast always survives its own frame', list.some((c) => c.moveId === `m${MAX_CONJURED}`))

  // Expiry is the ordinary route to the same revert.
  const short = conjure([], 'brief', wallCells(0, 0, 0, 1, 2), 5, 1, T0)
  chk('a wall expires on its own clock', expireConjured(short, T0 + 5001).length === 0)
  chk('...and is identity while it is still standing', expireConjured(short, T0 + 100) === short)
}

// ── 6. the shape a move asks for is the shape it gets ──────────────────────────────────────────
{
  chk('shapeCells routes wall/ring/block distinctly',
    shapeCells('wall', 0, 0, 0, 1, 5).length === 5 &&
    shapeCells('block', 0, 0, 0, 1, 3).length === 9 &&
    shapeCells('ring', 0, 0, 4, 0, 4).length > 8)
}

console.log(`\nconjured terrain (voxel): ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
