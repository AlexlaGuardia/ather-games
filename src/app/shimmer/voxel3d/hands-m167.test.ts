// M167: the worn pruner and worn spike look as Alex locked them (athernyx a8b1db5). Looks only: the rig's focus models and
// the bag icons. These asserts pin the parts of the locked pictures a later edit could quietly lose.
import * as THREE from 'three'
import { createHands, M167 } from './hands'
import { ITEM_ICONS, ITEM_PALETTES } from '../sprites/items'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const h = createHands()
const groupOf = (name: string) => { let g: THREE.Object3D | undefined; h.group.traverse(o => { if (o.name === name) g = o }); return g }
const meshes = (g: THREE.Object3D | undefined) => (g?.children ?? []).filter((c): c is THREE.Mesh => c instanceof THREE.Mesh)
const hexOf = (m: THREE.Mesh) => (m.material as THREE.MeshLambertMaterial).color.getHex()
const geoP = (m: THREE.Mesh) => (m.geometry as THREE.CylinderGeometry).parameters as { radiusTop?: number; radiusBottom?: number; radialSegments?: number } | undefined

// ── the rig ──
const pr = groupOf('m167-worn-pruner'), sp = groupOf('m167-worn-spike')
ok(!!pr && !!sp, 'both worn focus models are in the rig, by name')
ok(h.sig.looks?.forestry === `m167-worn-pruner/${pr?.children.length}`, `the probe names the pruner (${h.sig.looks?.forestry})`)
ok(h.sig.looks?.prospecting === `m167-worn-spike/${sp?.children.length}`, `the probe names the spike (${h.sig.looks?.prospecting})`)
const P = meshes(pr), S = meshes(sp)
ok(P.length >= 12, `pruner has heft and detail: ${P.length} parts (the old blade had 2)`)
ok(S.length >= 14, `spike has heft and detail: ${S.length} parts (the old spike had 3)`)
// pruner: a two-tone leaf either side of the rib, a bark haft, a dark butt
ok(P.some(m => hexOf(m) === M167.steel) && P.some(m => hexOf(m) === M167.steelDark), 'pruner head: a lit half and a shadow half')
ok(P.some(m => hexOf(m) === M167.bark) && P.some(m => hexOf(m) === M167.wood), 'pruner haft: bark wrap and a dark butt')
const leaf = P.filter(m => m.geometry instanceof THREE.SphereGeometry)
ok(leaf.length === 2 && leaf.every(m => m.scale.x > m.scale.y * 2 && m.scale.z > m.scale.x * 2), 'the leaf is FLAT and longer than wide (two squashed halves)')
ok(leaf.every(m => m.position.z < -0.15), 'the leaf sits forward of the fist')
// spike: faceted (6 sides), BLUNT (the end is cut, not a point), thick
const hexes = S.filter(m => geoP(m)?.radialSegments === 6)
ok(hexes.length === 2, 'spike: a faceted shaft and a faceted end')
const tip = hexes.find(m => (geoP(m)?.radiusTop ?? 1) < 1)
ok(!!tip && (geoP(tip)!.radiusTop ?? 0) > 0.25, `★ spike end is BLUNT: the end keeps ${(geoP(tip!)?.radiusTop ?? 0) * 100}% of the shaft width`)
const shaft = hexes.find(m => m !== tip)
ok(!!shaft && shaft.scale.x >= 0.028, `spike shaft is thick (r ${shaft?.scale.x})`)
ok(S.filter(m => hexOf(m) === M167.cordDeep).length >= 6, 'spike grip: a cross wrap of cord turns')
ok(S.some(m => hexOf(m) === M167.knob && m.geometry instanceof THREE.SphereGeometry), 'spike: the wooden knob')
ok(S.every(m => (m.material as THREE.Material) instanceof THREE.MeshLambertMaterial), 'plain steel by colour, never a metal material')

// the harness pin: `look` holds a focus up even when the host names none this frame
{
  const cam = new THREE.PerspectiveCamera(); cam.updateMatrixWorld()
  h.sig.family = null; h.sig.look = 'prospecting'; h.tick(cam, 0, 1 / 60)
  ok(!!sp?.visible && !pr?.visible, 'look pins the spike in the fist over a null family')
  h.sig.look = null; h.sig.family = null; h.tick(cam, 1 / 60, 1 / 60)
  ok(!sp?.visible, 'look cleared: the host rules again')
}

// ── the icons ──
const ink = (id: string) => { const f = ITEM_ICONS[id]?.frames[0]; const n = new Map<number, number>(); f?.forEach(v => n.set(v, (n.get(v) ?? 0) + 1)); return n }
const b = ink('worn_blade'), s = ink('worn_spike')
ok((b.get(1) ?? 0) >= 20 && (b.get(2) ?? 0) >= 20, 'pruner icon: lit and shadow halves of the leaf')
ok((b.get(3) ?? 0) >= 12 && (b.get(6) ?? 0) >= 8, 'pruner icon: bark haft and a dark butt')
ok((s.get(5) ?? 0) >= 8 && (s.get(7) ?? 0) >= 8, 'spike icon: cross wrap in two tones')
ok(ITEM_PALETTES.worn_blade[0] === '#7d97aa' && ITEM_PALETTES.worn_spike[1] === '#4f6274', 'icon palettes = the locked steel')
// the icon's top-right corner is empty: the spike is not drawn to a point into the corner (its end is cut blunt)
const sf = ITEM_ICONS.worn_spike.frames[0]
ok(sf[0 * 32 + 31] === 0 && sf[1 * 32 + 31] === 0, 'spike icon: no point run into the corner')

console.log(`hands-m167: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
