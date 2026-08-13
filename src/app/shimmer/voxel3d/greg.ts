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
function buildNameSprite(): THREE.Sprite {
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
  ctx.fillText('Gregory', canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.6, 0.4, 1)
  sprite.position.set(0, 2.3, 0)
  return sprite
}

/**
 * Build Greg once. ONE shared unit-cube geometry, scaled per part (body, head, two arms) via each
 * mesh's own `.scale` — the geometry itself never changes — plus two materials (robe / skin).
 */
export function createGregMesh(): GregMesh {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const bodyMat = new THREE.MeshLambertMaterial({ color: BODY_COLOR })
  const headMat = new THREE.MeshLambertMaterial({ color: HEAD_COLOR })

  const group = new THREE.Group()

  const body = new THREE.Mesh(geo, bodyMat)
  body.scale.set(PART.body.w, PART.body.h, PART.body.d)
  body.position.set(0, PART.body.y, 0)
  group.add(body)

  const head = new THREE.Mesh(geo, headMat)
  head.scale.set(PART.head.s, PART.head.s, PART.head.s)
  head.position.set(0, PART.head.y, 0)
  group.add(head)

  const armL = new THREE.Mesh(geo, bodyMat)
  armL.scale.set(PART.arm.w, PART.arm.h, PART.arm.d)
  armL.position.set(-PART.arm.x, PART.arm.y, 0)
  group.add(armL)

  const armR = new THREE.Mesh(geo, bodyMat)
  armR.scale.set(PART.arm.w, PART.arm.h, PART.arm.d)
  armR.position.set(PART.arm.x, PART.arm.y, 0)
  group.add(armR)

  const label = buildNameSprite()
  group.add(label)

  return {
    group,
    dispose: () => {
      geo.dispose()
      bodyMat.dispose()
      headMat.dispose()
      const labelMat = label.material as THREE.SpriteMaterial
      labelMat.map?.dispose()
      labelMat.dispose()
    },
  }
}
