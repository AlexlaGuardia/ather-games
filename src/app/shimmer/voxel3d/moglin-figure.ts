// A free Moglin, standing — the five folk of Moonwell Glade.
//
// ★ HOST SIDE. This file may import three; `voxel/` may not. Same contract as `greg.ts`.
//
// ★ BUILT AGAINST THE LOCKED BRIEF, NOT INVENTED. `design-briefs/moglins.md` (base 🔒 2026-06-24):
// child-sized soft folk, ABOUT THREE FEET, teddy-bear-soft; canon anatomy fur / whiskers / paws /
// rounded ears; big round dark eyes, short whiskered muzzle, small paws held close; palette
// drab-but-warm — moss-brown, dun, clay-tan, dust-fawn — and ⚠ NEVER GREY (the loaded cosmology
// word; `no-grey` below is the assert). The free folk wear NO COLLAR and NO METAL, ever: metal on
// a Moglin thing means a hold. What tells the five apart is their GARB — the brief differentiates
// sub-types by garb, scale and wear, never by species — so the trade colour lives on an APRON and
// the fur stays inside the earth palette. Jimbo's honey-tan is the fifth coat.
//
// ★ RIGID PARTS, ONE SHARED SPHERE. The same technique `play3d/MoglinDoll.tsx` proved for the clay
// doll and `HollowRig` for the Hollows: a part is a mesh, and a figure is a group of scaled copies
// of ONE unit geometry. No GLB, no skin, no rig — the folk stand still like Greg, so there is no
// pose to drive. Whether a Moglin gets limbs (the doll's question, still Alex's) does not arise:
// paws held close to the chest are the brief's own rest pose.
//
// ⚠ THE FIGURE AND THE HITBOX ARE THE SAME NUMBERS. `MOGLIN_BOUNDS` is derived from `M` below, the
// way `GREG_BOUNDS` is from `PART` — the E-to-talk ray reads the bounds, so a taller head here is a
// taller box there with no second edit (the frame-map trap, `greg.ts` 08-13).

import * as THREE from 'three'
import { buildNameSprite, type GregMesh } from './greg'

/** Three feet, in a world where a block is a metre — `MOGLIN_SCALE` said the same number of Greg. */
export const MOGLIN_HEIGHT = 0.91

/**
 * The parts, in blocks. Every sphere is the unit sphere scaled; `r` is the radius, `ry` a vertical
 * stretch (the body is an egg, not a ball). Child proportions on purpose: the head is nearly a
 * quarter of the height, which is what makes "child-sized" read at a glance across a garden.
 */
const M = {
  body:    { r: 0.19, ry: 1.3, y: 0.36 },                  // the egg: 0.11 .. 0.61
  head:    { r: 0.21, y: MOGLIN_HEIGHT - 0.21 },           // crown at exactly MOGLIN_HEIGHT
  muzzle:  { r: 0.095, y: 0.65, z: 0.155 },                // short, lighter fur
  nose:    { r: 0.032, y: 0.685, z: 0.245 },
  eye:     { r: 0.036, x: 0.085, y: 0.735, z: 0.175 },     // big, round, dark
  ear:     { r: 0.075, x: 0.155, y: 0.875 },               // rounded, on the crown's shoulders
  paw:     { r: 0.055, x: 0.12, y: 0.43, z: 0.15 },        // held close to the chest
  foot:    { r: 0.07, ry: 0.6, x: 0.095, y: 0.05, z: 0.03 },
  tail:    { r: 0.05, y: 0.22, z: -0.19 },
  whisker: { len: 0.13, t: 0.006, x: 0.075, y: 0.67, z: 0.2, rows: [0.02, -0.01, -0.04] },
  apron:   { w: 0.25, h: 0.27, d: 0.02, y: 0.33, z: 0.185 },
} as const

/**
 * A folk's body in LOCAL space, for the crosshair. `halfW` spans the ears (the widest part) and
 * `y0`/`y1` run the soles to the ear tips — derived, so it is the figure that is drawn, and
 * `moglin-figure.test.ts` walks every part to prove the box holds all of it. The HEAD's crown is
 * the three feet; the ears ride a hand above it, the way a teddy's do.
 */
export const MOGLIN_BOUNDS = {
  halfW: M.ear.x + M.ear.r,
  y0: 0,
  y1: Math.max(M.head.y + M.head.r, M.ear.y + M.ear.r),
} as const

/** The earth coats, from the brief's own words. Five, so five folk can each wear one. */
// ⚠ Lighter than the words sound. The first cut (moss 0x6f5a38) read NEAR-BLACK under a roof —
// Lambert fur in a lit room loses a third of its value, and a folk who stands indoors all day
// must be judged there, not on a swatch. These are the same hues a step up.
export const MOGLIN_COATS = {
  moss:  0x8c7449,   // moss-brown
  dun:   0xa38c62,   // dun
  clay:  0xba976a,   // clay-tan
  fawn:  0xc7b08c,   // dust-fawn
  honey: 0xb5966a,   // honey-tan — Jimbo's, a step up from `moglin-look.ts` MOGLIN_FUR_LIGHT
} as const
export type MoglinCoat = keyof typeof MOGLIN_COATS

/** Eyes and nose: a warm near-black. Not grey, not blue-black — the same reason as the coats. */
const DARK = 0x2b2016

export interface MoglinLook {
  name: string
  coat: MoglinCoat
  /** The trade's colour, worn as an apron. */
  apron: number
}

/** The muzzle is the coat lightened toward fawn — the belly-fur read, one step, never a new hue. */
export function muzzleOf(coat: number): number {
  const c = new THREE.Color(coat)
  return c.lerp(new THREE.Color(0xd8c3a0), 0.35).getHex()
}

/**
 * Several free Moglins from ONE call — the five folk. One unit sphere and one unit cube shared by
 * all of them; materials cached by colour so two folk in the same coat share one (the render
 * audit's rule: bounded by the palette, not the population). `dispose` releases the shared parts
 * once, when the last figure goes — `createFigures` in `greg.ts` is the same shape.
 */
export function createMoglinFigures(looks: readonly MoglinLook[]): GregMesh[] {
  const sphere = new THREE.SphereGeometry(1, 18, 14)
  const cube = new THREE.BoxGeometry(1, 1, 1)
  const mats = new Map<number, THREE.MeshLambertMaterial>()
  const mat = (colour: number) => {
    let m = mats.get(colour)
    if (!m) { m = new THREE.MeshLambertMaterial({ color: colour }); mats.set(colour, m) }
    return m
  }
  let alive = looks.length
  const release = () => {
    if (--alive > 0) return
    sphere.dispose(); cube.dispose()
    for (const m of mats.values()) m.dispose()
    mats.clear()
  }
  return looks.map(look => buildMoglin(sphere, cube, mat, look, release))
}

function buildMoglin(
  sphere: THREE.BufferGeometry, cube: THREE.BufferGeometry,
  mat: (colour: number) => THREE.Material, look: MoglinLook, release: () => void,
): GregMesh {
  const group = new THREE.Group()
  const coat = MOGLIN_COATS[look.coat]
  const fur = mat(coat)
  const light = mat(muzzleOf(coat))
  const dark = mat(DARK)

  const ball = (m: THREE.Material, r: number, x: number, y: number, z: number, ry = 1) => {
    const mesh = new THREE.Mesh(sphere, m)
    mesh.scale.set(r, r * ry, r)
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }

  ball(fur, M.body.r, 0, M.body.y, 0, M.body.ry)
  ball(fur, M.head.r, 0, M.head.y, 0)
  ball(light, M.muzzle.r, 0, M.muzzle.y, M.muzzle.z)
  ball(dark, M.nose.r, 0, M.nose.y, M.nose.z)
  for (const sx of [-1, 1]) {
    ball(dark, M.eye.r, sx * M.eye.x, M.eye.y, M.eye.z)
    ball(fur, M.ear.r, sx * M.ear.x, M.ear.y, 0)
    ball(light, M.ear.r * 0.55, sx * M.ear.x, M.ear.y, 0.045)   // the inner ear, a lighter disc
    ball(light, M.paw.r, sx * M.paw.x, M.paw.y, M.paw.z)
    ball(fur, M.foot.r, sx * M.foot.x, M.foot.y, M.foot.z, M.foot.ry)
    // Three whiskers a side, fanned a little, from the muzzle's cheek outward.
    for (const dy of M.whisker.rows) {
      const w = new THREE.Mesh(cube, dark)
      w.scale.set(M.whisker.len, M.whisker.t, M.whisker.t)
      w.position.set(sx * (M.whisker.x + M.whisker.len / 2), M.whisker.y + dy, M.whisker.z)
      w.rotation.z = sx * dy * 4
      group.add(w)
    }
  }
  ball(fur, M.tail.r, 0, M.tail.y, M.tail.z)

  // The garb: the trade's colour as a plain apron over the belly. No metal, no collar — ever.
  const apron = new THREE.Mesh(cube, mat(look.apron))
  apron.scale.set(M.apron.w, M.apron.h, M.apron.d)
  apron.position.set(0, M.apron.y, M.apron.z)
  group.add(apron)

  const label = buildNameSprite(look.name)
  label.position.y = MOGLIN_BOUNDS.y1 + 0.4
  group.add(label)

  return {
    group,
    dispose: () => {
      release()
      const labelMat = label.material as THREE.SpriteMaterial
      labelMat.map?.dispose()
      labelMat.dispose()
    },
  }
}
