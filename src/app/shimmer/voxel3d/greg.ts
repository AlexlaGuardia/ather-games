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
  body.scale.set(0.62, 1.15, 0.4)
  body.position.set(0, 0.78, 0)
  group.add(body)

  const head = new THREE.Mesh(geo, headMat)
  head.scale.set(0.44, 0.44, 0.44)
  head.position.set(0, 1.6, 0)
  group.add(head)

  const armL = new THREE.Mesh(geo, bodyMat)
  armL.scale.set(0.16, 0.85, 0.2)
  armL.position.set(-0.42, 0.8, 0)
  group.add(armL)

  const armR = new THREE.Mesh(geo, bodyMat)
  armR.scale.set(0.16, 0.85, 0.2)
  armR.position.set(0.42, 0.8, 0)
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
