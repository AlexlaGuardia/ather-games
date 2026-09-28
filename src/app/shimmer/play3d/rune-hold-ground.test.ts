/**
 * Rune Hold's smooth ground (Alex, 2026-09-28: "make the terrain smoother … the sides of the steps have a holographic
 * sheen"). Run: `npx tsx src/app/shimmer/play3d/rune-hold-ground.test.ts`
 *
 * ★ THE SHEEN WAS TWO SURFACES IN ONE PLACE. So the load-bearing asserts are: the ground has NO vertical face between
 * walkable cells (only the map-edge skirt drops), every smooth cell is covered, and the drawn height at a cell centre
 * is that cell's height — the point the walker and the townsfolk stand on.
 */
import { readFileSync } from 'node:fs'
import { RUNE_HOLD } from '../world/tilemap'
import { groundMesh, groundHeight, isSmooth, GROUND_LIFT, SKIRT_Y, SMOOTH_TILES } from './rune-hold-ground'
import { groundY } from './Townsfolk'
import { noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const g = RUNE_HOLD as number[][]
const heights = JSON.parse(readFileSync(new URL('../world/heightmaps.json', import.meta.url), 'utf8'))['rune-hold'] as number[][]
const rows = g.length, cols = g[0]!.length

// ── A. the town's ground is all smooth tiles ────────────────────────────────────────────────
{
  const walk = new Set<number>()
  for (const r of g) for (const v of r) if (v >= 0) walk.add(v & 0xff)
  const unsmooth = [...walk].filter(t => !SMOOTH_TILES.has(t) && t !== 103 && t !== 14)
  ok(unsmooth.length === 0, `every walkable ground tile in Rune Hold is drawn smooth (unhandled: ${unsmooth.join(',') || 'none'})`)
}

// ── B. ★ the mesh: covers every smooth cell, no vertical face inside the town ────────────────
{
  const m = groundMesh(g, heights)
  const P = m.positions, I = m.indices
  ok(m.quads > 0 && I.length % 3 === 0, `a mesh was built (${m.quads} quads)`)
  let vertical = 0, skirtTris = 0
  for (let t = 0; t < I.length; t += 3) {
    const ys = [I[t]!, I[t + 1]!, I[t + 2]!].map(k => P[k * 3 + 1]!)
    const xs = [I[t]!, I[t + 1]!, I[t + 2]!].map(k => P[k * 3]!)
    const zs = [I[t]!, I[t + 1]!, I[t + 2]!].map(k => P[k * 3 + 2]!)
    const isSkirt = ys.some(y => y === SKIRT_Y)
    if (isSkirt) { skirtTris++; continue }
    // a triangle with zero plan area is a wall — the thing that z-fought
    const area = Math.abs((xs[1]! - xs[0]!) * (zs[2]! - zs[0]!) - (xs[2]! - xs[0]!) * (zs[1]! - zs[0]!))
    if (area < 1e-6) vertical++
  }
  ok(vertical === 0, `★★ no vertical face between walkable cells — nothing left to z-fight (found ${vertical})`)
  ok(skirtTris > 0, 'the map edge drops a skirt, so the town shows no paper edge')
  // every skirt vertex sits on the map border
  let offBorder = 0
  for (let k = 0; k < P.length; k += 3) if (P[k + 1] === SKIRT_Y && !(Math.abs(P[k]! + 0.5) < 1e-6 || Math.abs(P[k]! - (cols - 0.5)) < 1e-6 || Math.abs(P[k + 2]! + 0.5) < 1e-6 || Math.abs(P[k + 2]! - (rows - 0.5)) < 1e-6)) offBorder++
  ok(offBorder === 0, `★ the skirt is only at the map border, never inside the town (${offBorder} off-border)`)
  // coverage: every smooth cell's centre is a vertex at its own height (+lift)
  const at = new Map<string, number>()
  for (let k = 0; k < P.length; k += 3) if (P[k + 1] !== SKIRT_Y) at.set(`${P[k]},${P[k + 2]}`, P[k + 1]!)
  let missing = 0, wrong = 0
  for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
    if (!isSmooth(g[z]![x])) continue
    const y = at.get(`${x},${z}`)
    if (y === undefined) missing++
    else if (Math.abs(y - (heights[z]![x]! + GROUND_LIFT)) > 1e-6) wrong++
  }
  ok(missing === 0, `★ every smooth cell is covered (${missing} missing)`)
  ok(wrong === 0, `★★ the drawn ground at a cell centre IS that cell's height — where the walker stands (${wrong} off)`)
}

// ── C. the townsfolk walk the surface that is drawn ─────────────────────────────────────────
{
  let worst = 0
  for (let k = 0; k < 400; k++) {
    const x = 5 + (k * 37 % 89) + 0.37, z = 5 + (k * 53 % 89) + 0.61
    worst = Math.max(worst, Math.abs(groundHeight(g, heights, x, z) - GROUND_LIFT - groundY(heights, x, z)))
  }
  ok(worst < 1e-6, `★ Townsfolk.groundY and the drawn ground agree everywhere sampled (worst ${worst.toFixed(6)})`)
}

// ── D. the host: the town draws it, the zone stops drawing stepped columns for it ───────────
{
  const scene = noComments(readFileSync(new URL('./RuneHoldScene.tsx', import.meta.url), 'utf8'))
  ok(/<SmoothGround /.test(scene) && !/look\.risers/.test(scene) && !/risers\.push/.test(scene), '★ Rune Hold draws SmoothGround, and the riser boxes are gone')
  const host = noComments(readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8'))
  ok(/ownGround=\{props\.zone\.id === RUNE_HOLD_ZONE \? SMOOTH_TILES : undefined\}/.test(host), 'the zone hands Rune Hold its own ground')
  ok(/if \(!ownGround \|\| editing\) return cs/.test(host), '★ the map editor still gets the stepped columns — it paints by clicking them')
}

console.log(`rune-hold-ground: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
