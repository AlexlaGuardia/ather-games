// Gregory — the tutorial-quest NPC standing near spawn in Moonwell Glade.
//
// ★ HOST SIDE. This file may import three; `voxel/` may not.
//
// ★ PLACEHOLDER FIGURE, DELIBERATELY. A few stacked boxes off ONE shared geometry and a small
// warm-toned material set — Greg's actual look is a character-art decision (Alex's call), same
// rule `piece-mesh.ts` states for the six building pieces. This only needs to read as "a person
// standing here" and carry a name label. Static: no per-frame animation, matching the brief.
//
// ★ render-audit.test.ts's rule: every GPU resource must be constructed somewhere that runs once.
// `createGregMesh` and `buildNameSprite` are both factories (the audit recognises the
// create/make/build-prefixed-function shape), so the geometry/materials/texture built inside them
// are exempt from the "constructed per-object" check — the CALLER (VoxelWorld.tsx) is what must
// call this once, via useMemo, which it does.

import * as THREE from 'three'

export interface GregMesh {
  group: THREE.Group
  dispose: () => void
}

const BODY_COLOR = 0x8a6a34   // warm robe brown — matches the piece-mesh TINT palette's wood tones
const HEAD_COLOR = 0xd9a066   // warm skin tone

// ── ★ THE PARTS, AS NUMBERS THE BOUNDS CAN ALSO READ (2026-08-13) ─────────────────────────────
// These were four `.scale.set(...)`/`.position.set(...)` literals inline in the factory. They are
// hoisted because E-to-talk is now a ray test against Greg's BODY (see aim.ts), and a second set of
// dimensions written next to that test is the frame-map trap in miniature: make him taller here and
// the box you can click stays the old height, silently, with nothing failing. The mesh and the
// hitbox are now the same numbers by construction.
const PART = {
  body: { w: 0.62, h: 1.15, d: 0.4, y: 0.78 },
  head: { s: 0.44, y: 1.6 },
  arm: { w: 0.16, h: 0.85, d: 0.2, x: 0.42, y: 0.8 },
} as const

/**
 * Greg's body in LOCAL space — what a crosshair has to be on to talk to him. Derived from `PART`,
 * so it is the figure that is actually drawn rather than a description of it.
 * `halfW` spans the arms (the widest part); `y0`/`y1` run the sole of the robe to the top of the head.
 */
export const GREG_BOUNDS = {
  halfW: PART.arm.x + PART.arm.w / 2,
  y0: PART.body.y - PART.body.h / 2,
  y1: PART.head.y + PART.head.s / 2,
} as const

/**
 * "Gregory", drawn onto a canvas and wrapped as a billboard sprite. `THREE.Sprite` always faces the
 * camera by construction, so this is the "always-facing" name label the brief asks for with no
 * per-frame code at all.
 */
export function buildNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = '600 34px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fefaf0'
  ctx.fillText(name, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.6, 0.4, 1)
  return sprite
}

/** A figure's look: the label over its head and its two placeholder colours. */
export interface FigureLook {
  name: string
  robe?: number
  skin?: number
  /** Whole-body scale. 1 = Greg (a mortal). The folk wore 0.5 of this from 09-15 to 09-16, until
   *  `moglin-figure.ts` gave them a body of their own. The label never scales. */
  scale?: number
}

/** Build Greg once — the same figure as every folk, in his own colours (`createFigure`). */
export function createGregMesh(): GregMesh {
  return createFigure({ name: 'Gregory' })
}

/**
 * Build one standing figure. ONE shared unit-cube geometry, scaled per part (body, head, two arms)
 * via each mesh's own `.scale` — the geometry itself never changes — plus two materials (robe /
 * skin). Greg is the only one today; the five Glade folk are `moglin-figure.ts` since 09-16.
 */
export function createFigure(look: FigureLook): GregMesh {
  return createFigures([look])[0]
}

/**
 * Several figures from ONE call. One shared cube geometry across all of them, and
 * the materials CACHED BY COLOUR: two folk in the same skin share a material, and the count is
 * bounded by the palette, not the population (the render audit's rule; `dispose` releases the
 * cache once, when the last figure goes).
 */
export function createFigures(looks: readonly FigureLook[]): GregMesh[] {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mats = new Map<number, THREE.MeshLambertMaterial>()
  for (const colour of looks.flatMap(l => [l.robe ?? BODY_COLOR, l.skin ?? HEAD_COLOR])) {
    if (mats.has(colour)) continue
    mats.set(colour, new THREE.MeshLambertMaterial({ color: colour }))
  }
  let alive = looks.length
  // The shared geometry and the material cache go when the LAST figure has been disposed.
  const release = () => {
    if (--alive > 0) return
    geo.dispose()
    for (const m of mats.values()) m.dispose()
    mats.clear()
  }
  return looks.map(look => buildFigure(geo, mats.get(look.robe ?? BODY_COLOR)!, mats.get(look.skin ?? HEAD_COLOR)!, look.name, look.scale ?? 1, release))
}

/** One figure from shared parts. Constructs no material of its own — only the name label's. */
function buildFigure(geo: THREE.BufferGeometry, bodyMat: THREE.Material, headMat: THREE.Material, name: string, scale: number, release: () => void): GregMesh {
  const group = new THREE.Group()
  // The BODY scales; the label does not (a name you cannot read is not a label). So the parts sit
  // in a scaled child group and the sprite rides above it at the scaled crown.
  const parts = new THREE.Group()
  parts.scale.setScalar(scale)
  group.add(parts)

  const body = new THREE.Mesh(geo, bodyMat)
  body.scale.set(PART.body.w, PART.body.h, PART.body.d)
  body.position.set(0, PART.body.y, 0)
  parts.add(body)

  const head = new THREE.Mesh(geo, headMat)
  head.scale.set(PART.head.s, PART.head.s, PART.head.s)
  head.position.set(0, PART.head.y, 0)
  parts.add(head)

  const armL = new THREE.Mesh(geo, bodyMat)
  armL.scale.set(PART.arm.w, PART.arm.h, PART.arm.d)
  armL.position.set(-PART.arm.x, PART.arm.y, 0)
  parts.add(armL)

  const armR = new THREE.Mesh(geo, bodyMat)
  armR.scale.set(PART.arm.w, PART.arm.h, PART.arm.d)
  armR.position.set(PART.arm.x, PART.arm.y, 0)
  parts.add(armR)

  const label = buildNameSprite(name)
  label.position.y = GREG_BOUNDS.y1 * scale + 0.45
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
