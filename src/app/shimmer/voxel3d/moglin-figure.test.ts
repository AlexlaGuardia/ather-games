// The free Moglin figure holds the brief's numbers, and its hitbox holds the figure.
//
// Three guards, each aimed at a way this could go quietly wrong:
//  1. THE BOX CONTAINS THE BODY. `MOGLIN_BOUNDS` is derived from the part table, but a part added
//     outside the ears or above them would be drawn and unclickable — the frame-map trap. So the
//     test walks every mesh the factory actually builds and proves each sits inside the box.
//  2. NEVER GREY, NO METAL. The brief's two hard words for a free Moglin. A coat is judged by its
//     channels (warm and saturated), and every material is judged by its class (Lambert, no
//     metalness) — a `MeshStandardMaterial` with a metalness slider is the door the rule closes.
//  3. THE PALETTE BOUNDS THE MATERIALS. Two folk in one coat share one fur material.
// Mutation-swept 2026-09-16: ear.y 0.875→0.95 (box loses the ears) · coat moss→0x6f6f6f (grey) ·
// Lambert→Standard (metal door) · mat cache disabled (count) — all four fire.
import * as THREE from 'three'
import { createMoglinFigures, MOGLIN_BOUNDS, MOGLIN_HEIGHT, MOGLIN_COATS, muzzleOf } from './moglin-figure'
import { FOLK } from './folk'

// The name label draws on a canvas; a node test has none. A stub that hands three a picture-shaped
// nothing is enough — the label's look is not under test here. (The factory reads `document` at
// call time, not import time, so the stub can follow the imports.)
;(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) }),
}

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const rgb = (hex: number) => ({ r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 })
const warm = (hex: number) => { const { r, g, b } = rgb(hex); return r >= g && g >= b }
const notGrey = (hex: number) => { const { r, g, b } = rgb(hex); return Math.max(r, g, b) - Math.min(r, g, b) >= 30 && r - b >= 30 }

// ── the brief's numbers ──
ok(Math.abs(MOGLIN_HEIGHT - 0.91) < 1e-9, 'three feet: 0.91 blocks (a block is a metre)')
ok(MOGLIN_BOUNDS.y0 === 0, 'soles on the floor')
ok(MOGLIN_BOUNDS.y1 >= MOGLIN_HEIGHT && MOGLIN_BOUNDS.y1 < 1.0, `box top ${MOGLIN_BOUNDS.y1.toFixed(3)}: at least the crown, still "about three feet", never four`)
ok(MOGLIN_BOUNDS.halfW > 0.15 && MOGLIN_BOUNDS.halfW < 0.35, `half-width ${MOGLIN_BOUNDS.halfW.toFixed(3)} is a child's, not a keeper's`)

// ── never grey ──
for (const [name, hex] of Object.entries(MOGLIN_COATS)) {
  ok(warm(hex) && notGrey(hex), `coat '${name}' #${hex.toString(16)} is drab-but-warm, never grey`)
  const m = muzzleOf(hex)
  const lum = (h: number) => { const { r, g, b } = rgb(h); return r + g + b }
  ok(lum(m) > lum(hex) && warm(m), `muzzle of '${name}' is lighter and still warm`)
}
// An apron may be any trade colour (Yarrow's green, Mallow's purple) — the rule it must keep is only
// that it is not a GREY, so it is judged on spread alone, not warmth.
const saturated = (hex: number) => { const { r, g, b } = rgb(hex); return Math.max(r, g, b) - Math.min(r, g, b) >= 30 }
for (const f of FOLK) ok(saturated(f.apron), `${f.id}: apron #${f.apron.toString(16)} is not a grey`)
ok(new Set(FOLK.map(f => f.coat)).size === FOLK.length, 'five folk, five coats — they read apart')

// ── the box contains the body, on the figures actually built ──
const figs = createMoglinFigures(FOLK.map(f => ({ name: f.name, coat: f.coat, apron: f.apron })))
ok(figs.length === FOLK.length, 'one figure per folk')
const mats = new Set<THREE.Material>()
let meshes = 0
for (const fig of figs) {
  let crown = 0
  fig.group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return
    meshes++
    mats.add(o.material as THREE.Material)
    ok(o.material instanceof THREE.MeshLambertMaterial, `no metal: ${o.uuid.slice(0, 6)} is Lambert (no metalness slider)`)
    // A sphere scaled by (r, r*ry, r) spans ±scale on each axis; a cube scaled by (w,h,d) spans
    // ±half. Rotated whiskers are thin enough that the unrotated span is an upper bound.
    const isCube = (o.geometry as THREE.BufferGeometry).type === 'BoxGeometry'
    const hx = isCube ? o.scale.x / 2 : o.scale.x
    const hy = isCube ? o.scale.y / 2 : o.scale.y
    const top = o.position.y + hy, bottom = o.position.y - hy
    const wide = Math.abs(o.position.x) + hx
    ok(top <= MOGLIN_BOUNDS.y1 + 1e-6, `${fig.group.children.length}: part at y ${top.toFixed(3)} is under the box top`)
    ok(bottom >= MOGLIN_BOUNDS.y0 - 1e-6, `part bottom ${bottom.toFixed(3)} is on or above the floor`)
    ok(wide <= MOGLIN_BOUNDS.halfW + 1e-6, `part at |x| ${wide.toFixed(3)} is inside the half-width`)
    crown = Math.max(crown, top)
  })
  ok(Math.abs(crown - MOGLIN_BOUNDS.y1) < 1e-6, `the box top IS the tallest part (${crown.toFixed(3)})`)
  const label = fig.group.children.find(c => c instanceof THREE.Sprite)
  ok(!!label && label.position.y > MOGLIN_BOUNDS.y1, 'name label rides above the box')
}
ok(meshes / figs.length >= 20, `a figure is ${meshes / figs.length} parts — a face, not a pill`)
// ── the palette bounds the materials ──
// five coats + five muzzles + one dark + five aprons = 16 for five distinct folk
ok(mats.size === 16, `materials cached by colour: ${mats.size} for five folk (16 expected)`)
const twins = createMoglinFigures([{ name: 'a', coat: 'dun', apron: 0x9a6b2f }, { name: 'b', coat: 'dun', apron: 0x9a6b2f }])
const twinMats = new Set<THREE.Material>()
for (const t of twins) t.group.traverse(o => { if (o instanceof THREE.Mesh) twinMats.add(o.material as THREE.Material) })
ok(twinMats.size === 4, `two folk in one coat share: ${twinMats.size} materials (fur, muzzle, dark, apron)`)
for (const f of [...figs, ...twins]) f.dispose()
ok(true, 'dispose runs through the last figure')

console.log(`moglin-figure: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
