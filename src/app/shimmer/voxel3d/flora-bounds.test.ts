/**
 * ── THE RETICLE'S OUTLINE, HELD AGAINST THE PLANT IT OUTLINES ─────────────────────────────────
 *
 * Alex, 2026-09-09: *"when grass, flowers or some other misc item block is selected its outlining
 * the whole block instead of just the item."*
 *
 * ★★★ THE WITNESS IS THE SHIPPED RENDERER'S OWN BUFFERS, AND THAT CHOICE IS THE WHOLE FILE.
 * The cheap version of this test restates the widths from `FLORA_PARTS` and checks the arithmetic —
 * which is a copy compared against its original, agreeing perfectly and proving nothing (this
 * file's `CAP` and its geometry factories both carry that scar). So nothing here knows how wide a
 * tuft is. Every expectation is built by running `createFloraRenderer().sync(...)` — the same call
 * `VoxelWorld` makes — then reading the instance matrices and vertex buffers back OUT of the meshes
 * that would have been drawn, and measuring those. If `sync` ever stops composing through
 * `floraMatrix`, or a width moves in only one of the two places, these go red.
 *
 * ⚠ AND CONTAINMENT ALONE IS NOT THE ASSERT. A box that contains the plant is satisfied by the very
 * bug being fixed — the full 1x1x1 cube contains every plant in the world. TIGHTNESS is what
 * discriminates, so every face is held to the drawn extreme within 1e-6, and there is a separate
 * assert that the box is visibly SMALLER than a cube for the kinds Alex named.
 */
// Run: npx tsx src/app/shimmer/voxel3d/flora-bounds.test.ts
//
// ⚠ PLAIN `tsx`, NOT vitest — vitest is NOT a dependency of this repo and no other test imports it.
// The first draft of this file did, and `npx` silently fetched it from the network and printed
// "61 passed", which is a green from a runner that `npm run sweep` does not use: the sweep runs
// `npx tsx` over every *.test.ts, so the guard would have existed only on the machine that wrote
// it. A test the sweep cannot run is not a guard, and this one failed toward looking fine.
import * as THREE from 'three'
import { createFloraRenderer, floraBounds, FLORA_PARTS } from './flora-mesh'
import { FLORA } from '../voxel/flora'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const near = (a: number, b: number, tol: number, msg: string) =>
  ok(Math.abs(a - b) < tol, `${msg} (got ${a}, want ${b}, tol ${tol})`)

const SPOT_X = 5, SPOT_Z = 7, GROUND_Y = 40, SEED = 1234

/** The box the renderer ACTUALLY draws for one spot: every instance matrix in the group, applied
 *  to that mesh's real vertices. No knowledge of any width, height or offset. */
function drawnBox(kind: number, variant: number, alongX = true) {
  const r = createFloraRenderer()
  r.sync([{ key: '0,0', x0: 0, z0: 0 }], SEED, (x, z) =>
    x === SPOT_X && z === SPOT_Z
      ? { y: GROUND_Y, kind, variant, mat: 0, ground: 0, alongX }
      : null)

  const mtx = new THREE.Matrix4()
  const v = new THREE.Vector3()
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  let instances = 0
  for (const child of r.group.children) {
    const im = child as THREE.InstancedMesh
    if (!(im as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || im.count === 0) continue
    const pos = im.geometry.getAttribute('position')
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, mtx)
      instances++
      for (let p = 0; p < pos.count; p++) {
        v.fromBufferAttribute(pos as THREE.BufferAttribute, p).applyMatrix4(mtx)
        if (v.x < x0) x0 = v.x; if (v.y < y0) y0 = v.y; if (v.z < z0) z0 = v.z
        if (v.x > x1) x1 = v.x; if (v.y > y1) y1 = v.y; if (v.z > z1) z1 = v.z
      }
    }
  }
  r.dispose()
  return { x0, y0, z0, x1, y1, z1, instances }
}

const KINDS: [string, number][] = [
  ['tuft', FLORA.TUFT], ['tall grass', FLORA.TALL], ['flower', FLORA.FLOWER],
  ['herb', FLORA.HERB], ['crop', FLORA.CROP],
  ['rock', FLORA.ROCK], ['deadfall', FLORA.DEADFALL], ['mushroom', FLORA.MUSHROOM],
]
// Spread across the roll: jitter, turn and height all ride on `variant`, so one value would test
// one plant rather than the family. 0 and ~1 are the ends the jitter reaches furthest at.
const VARIANTS = [0, 0.17, 0.33, 0.5, 0.66, 0.83, 0.999]

// ── 1. every face of the box sits on the drawn extreme ────────────────────────────────────────
{
  for (const [name, kind] of KINDS) {
    for (const variant of VARIANTS) {
      {
        const at = `${name} @ variant ${variant}`
        const drawn = drawnBox(kind, variant)
        // ⚠ A POSITIVE CONTROL FIRST. If `sync` drew nothing — a kind that fell through its chain,
        // a pool at cap, a probe the loop never called — `drawn` is all Infinity and every
        // comparison below is vacuously true. An empty measurement window can only return one
        // answer; this is the line that stops that answer being counted as a pass.
        ok(drawn.instances > 0, `${at}: the renderer drew nothing to measure against`)
        ok(Number.isFinite(drawn.x0), `${at}: drawn box is not finite`)

        const b = floraBounds(kind, SPOT_X, GROUND_Y, SPOT_Z, variant, true)
        ok(b !== null, `${at}: floraBounds returned null`)
        if (!b) continue
        // ⚠ THE TOLERANCE IS FLOAT32, AND IT IS A MEASUREMENT OF THE INSTRUMENT, NOT A CONCESSION.
        // `sync` writes into an `instanceMatrix` backed by a Float32Array, so reading it back is
        // the only precision the GPU ever had; at a world height of 40 that quantum is ~5e-6 and a
        // 5e-7 assert was failing on it. Any real drift — a width moved in one place, a root
        // offset changed, `sync` composing its own matrix again — is 1e-2 or larger, four orders
        // above this. Verified by mutation, not by argument.
        near(b.x0, drawn.x0, 1e-5, `${at} x0`); near(b.y0, drawn.y0, 1e-5, `${at} y0`)
        near(b.z0, drawn.z0, 1e-5, `${at} z0`); near(b.x1, drawn.x1, 1e-5, `${at} x1`)
        near(b.y1, drawn.y1, 1e-5, `${at} y1`); near(b.z1, drawn.z1, 1e-5, `${at} z1`)
      }
    }
  }
}

// ── 2. the outline is smaller than the block — the thing Alex reported ────────────────────────
{
  // The plant VOXEL spans [GROUND_Y+1, GROUND_Y+2]; the old outline was exactly that cube.
  const CELL_Y0 = GROUND_Y + 1
  for (const [name, kind] of [['tuft', FLORA.TUFT], ['flower', FLORA.FLOWER], ['rock', FLORA.ROCK]] as [string, number][]) {
    {
      for (const variant of VARIANTS) {
        const b = floraBounds(kind, SPOT_X, GROUND_Y, SPOT_Z, variant, true)!
        ok(b.x1 - b.x0 < 0.95, `${name} @ ${variant} is as wide as its cell (${(b.x1 - b.x0).toFixed(3)})`)
        ok(b.z1 - b.z0 < 0.95, `${name} @ ${variant} is as deep as its cell (${(b.z1 - b.z0).toFixed(3)})`)
        // ⚠ NOT A HEIGHT ASSERT. A wildflower at the top of its roll stands 0.99 of a cell and is
        // CORRECT — the complaint was never "too tall", it was a box that enclosed the cell. So
        // the claim is about how much of the cell is enclosed: the old cube was 1.0 by
        // construction, and anything here is under half of it.
        const vol = (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0)
        ok(vol < 0.5, `${name} @ ${variant} fills ${(100 * vol).toFixed(0)}% of its cell — the old cube was 100%`)
        // ⚠ AND IT SITS WHERE THE PLANT SITS, not where the cell does. A tuft is rooted BELOW the
        // cell floor, so a box that merely fits inside the cell would still be wrong.
        ok(b.y0 < CELL_Y0, `${name} @ ${variant} does not start below the cell floor where it is rooted`)
      }
    }
  }

  {
    // Tall grass is 1.05 tall before the height roll, so at a high roll it genuinely leaves its
    // cell. An outline clamped to the cell would be wrong in the other direction.
    const tall = floraBounds(FLORA.TALL, SPOT_X, GROUND_Y, SPOT_Z, 0.999, true)!
    ok(tall.y1 > GROUND_Y + 2, 'tall grass at a high roll leaves its cell — the box follows the plant, not the grid')
  }
}

// ── 3. every kind the renderer draws is measurable ────────────────────────────────────────────
{
  {
    // ⚠ A kind missing from `FLORA_PARTS` would make `floraBounds` return null and the outline
    // fall back to the cube — the old bug, silently, for that one kind. This is the assert that
    // notices a ninth kind being added to the enum and not to the table.
    for (const kind of [FLORA.TUFT, FLORA.TALL, FLORA.FLOWER, FLORA.HERB, FLORA.CROP]) {
      ok((FLORA_PARTS[kind]?.length ?? 0) > 0, `cross kind ${kind} has no entry in FLORA_PARTS`)
      ok(floraBounds(kind, 0, 0, 0, 0.4) !== null, `cross kind ${kind} has no measurable box`)
    }
    for (const kind of [FLORA.ROCK, FLORA.DEADFALL, FLORA.MUSHROOM]) {
      ok(floraBounds(kind, 0, 0, 0, 0.4, true) !== null, `scatter kind ${kind} has no measurable box`)
    }
  }
}

console.log(`\nflora bounds: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the reticle outlines what the renderer draws')
