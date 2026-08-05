/**
 * THE PHANTOM BLOCK IN THE CORNER (found + fixed 2026-08-05, reported by Alex).
 *
 * Symptom, in his words: "it always keeps at least one copy of each block — one warp, a mist,
 * etc — and usually just stacks them in a corner." Deleting the last tile of a kind looked
 * impossible: a ghost of it stayed at the map's corner forever.
 *
 * Cause: every instanced layer allocates `Math.max(cells.length, 1)`. The `1` is a real guard —
 * an InstancedMesh of count 0 was crashing the canvas, see the WallTops comment. But allocation
 * is not draw count. With zero cells the spare instance's matrix is NEVER written, so it keeps
 * the IDENTITY matrix and renders at world origin (0,0,0). One ghost per layer, all at the same
 * spot, which is why they appeared "stacked in a corner".
 *
 * WallTops was the only layer that already set `mesh.count` — its own comment explains the
 * allocation guard, and the fix never propagated to the other four. That is the lesson: when a
 * workaround has a subtle second half, the comment explaining the FIRST half is what gets copied.
 *
 * Run: `node src/app/shimmer/play3d/phantom-instance.test.mjs` (plain node — this tests three.js
 * behaviour, not our module graph, so it deliberately does not go through tsx).
 */
import * as THREE from 'three'
function build(cells, clamp) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), Math.max(cells.length, 1))
  const m = new THREE.Matrix4()
  cells.forEach(([c, r], i) => { m.setPosition(c, 0, r); mesh.setMatrixAt(i, m) })
  if (clamp) mesh.count = cells.length
  return mesh
}

const drawnAt = (mesh) => {
  const out = [], m = new THREE.Matrix4(), v = new THREE.Vector3()
  for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); v.setFromMatrixPosition(m); out.push(`${v.x},${v.y},${v.z}`) }
  return out
}

let fails = 0
const chk = (label, cond) => { console.log((cond ? '  ok  ' : '  FAIL') + '  ' + label); if (!cond) fails++ }

// the bug: zero cells, unclamped
const buggy = build([], false)
chk('unclamped empty mesh DRAWS 1 instance', buggy.count === 1)
chk('...and it sits at the world origin (the map corner)', drawnAt(buggy)[0] === '0,0,0')

// the fix
const fixed = build([], true)
chk('clamped empty mesh draws nothing', fixed.count === 0)
chk('...so no ghost at the origin', drawnAt(fixed).length === 0)

// and the clamp must not eat real cells
const real = build([[3, 4], [5, 6]], true)
chk('clamped mesh still draws every real cell', real.count === 2)
chk('...at the right coords', drawnAt(real).join(' ') === '3,0,4 5,0,6')

// the last-one-deleted case Alex actually hit: 1 cell -> 0
const wasOne = build([[9, 9]], true)
chk('deleting the last cell leaves zero drawn', wasOne.count === 1 && build([], true).count === 0)

console.log(fails ? `\n${fails} FAILED` : '\nphantom-instance: all pass')
process.exit(fails ? 1 : 0)
