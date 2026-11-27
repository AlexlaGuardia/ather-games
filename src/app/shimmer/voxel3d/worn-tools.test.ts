// M230: the live open game hangs the M167 worn models at the node for the WORN tools only; a crafted tier keeps its own look.
//   npx tsx src/app/shimmer/voxel3d/worn-tools.test.ts
import * as THREE from 'three'
import { buildWornTool, focusLook, WORN_NAME, WORN_SPAN, WORN_TOOL_ID, M167 } from './worn-tools'
import { TOOL_DEFS } from '../engine/tools'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// ── which look hangs ──
ok(focusLook('tree', 'worn_blade') === 'worn' && focusLook('crystal', 'worn_spike') === 'worn', 'the worn pruner / worn spike hang the M167 models')
for (const [id, d] of Object.entries(TOOL_DEFS)) {
  if (d.skillId !== 'forestry' && d.skillId !== 'prospecting') continue
  const node = d.skillId === 'forestry' ? 'tree' : 'crystal'
  if (id === WORN_TOOL_ID.pruner || id === WORN_TOOL_ID.spike) continue
  ok(focusLook(node, id) === 'tier', `${id} keeps its own look (only the WORN tier changes)`)
}
ok(focusLook('tree', 'worn_spike') === 'tier' && focusLook('crystal', 'worn_blade') === 'tier', 'a worn tool of the other family is not hung at the wrong node')
ok(focusLook('tree', undefined) === 'tier', 'no tool: the placeholder path')
ok(TOOL_DEFS[WORN_TOOL_ID.pruner]?.skillId === 'forestry' && TOOL_DEFS[WORN_TOOL_ID.spike]?.skillId === 'prospecting', 'the worn ids are real tool ids')

// ── the builder: names + the span the hang centres on ──
const cube = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 10, 8)
const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, colour: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colour })); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m
}
for (const kind of ['pruner', 'spike'] as const) {
  const g = buildWornTool(kind, new THREE.Group(), part, cube, sphere)
  ok(g.name === WORN_NAME[kind] && g.name.startsWith('m167-worn-'), `${kind}: named ${g.name}`)
  g.updateMatrixWorld(true)
  const b = new THREE.Box3().setFromObject(g)
  ok(Math.abs(b.max.z - WORN_SPAN[kind].butt) < 0.012 && Math.abs(-b.min.z - WORN_SPAN[kind].tip) < 0.012, `${kind}: WORN_SPAN matches the built model (z ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)})`)
  ok(g.children.every(c => c instanceof THREE.Mesh && ((c.material as THREE.MeshLambertMaterial).color.getHex() !== 0)), `${kind}: every part has a colour`)
}
const pr = buildWornTool('pruner', new THREE.Group(), part, cube, sphere)
ok(pr.children.some(c => ((c as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex() === M167.steel), 'pruner: the locked steel')

console.log(`worn-tools: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
