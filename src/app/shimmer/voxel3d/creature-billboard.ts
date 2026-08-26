// creature-billboard.ts — the THREE shell over `creature-atlas.ts`. A painted spirit, facing you.
//
// ★ HOST SIDE. This file may import three; `voxel/` may not, and `creature-atlas.ts` deliberately
// does not either. Every decision that can be wrong — which frame faces you, where it sits in the
// sheet, how a flank mirrors — lives in that module under 70 asserts. This file owns no arithmetic;
// if you find yourself computing a UV here, it belongs next door.
//
// ── ★★ A PLACEHOLDER WITH A DELETION PLAN (Alex ruled 2026-08-26) ────────────────────────────────
// *"billboard them, but these will only be placeholders for the future 3D models."* `CreatureBody` is
// the entire contract a caller may know. A modelled implementation satisfies the same three members
// and the swap is this one factory. ⚠ NOTHING OUTSIDE THIS FILE MAY LEARN A SPIRIT IS A FLAT QUAD —
// no `isSprite`, no reading `.material`, no assuming the object is a `THREE.Sprite`. The day
// something branches on that, "for now" has become forever and the models arrive into a codebase
// that has grown around the stand-in.
//
// ── ⚠ WHAT THIS FILE HAS NOT EARNED ──────────────────────────────────────────────────────────────
// It has NOT been seen in a browser. The atlas arithmetic is proven; "a rabbit appears in the mist"
// is a different claim and nobody has made it yet. Wiring + a look are the next step, and the deploy
// belongs to hub.

import * as THREE from 'three'
import {
  buildCreatureAtlas, facingFor, frameAt, cellUV,
  type CreatureArt, type CreatureAtlas, type Pose,
} from './creature-atlas'

/**
 * What a caller is allowed to know about a creature's body. Implemented today by a billboard; the
 * modelled version implements exactly this and nothing else changes.
 */
export interface CreatureBody {
  /** Add this to the scene. Do not inspect its type. */
  readonly object: THREE.Object3D
  /**
   * Point it at the camera and advance its animation.
   * `bodyYaw` is the direction the creature faces, `atan2(dz, dx)`, the same convention `stepFoe`
   * and the mist resident already use.
   */
  update(nowMs: number, bodyYaw: number, camX: number, camZ: number, pose: Pose): void
  dispose(): void
}

/**
 * ★ ONE SHEET PER SPECIES, BUILT ONCE AND CACHED FOREVER. `mist-pass.ts` gives the same reasoning for
 * its four element materials and it matters more here: Alex's desktop is an Intel UHD 630 where a
 * texture upload stalls the MAIN THREAD, so a three-Moglin patrol plus a mist resident must never be
 * four uploads of one rabbit. Keyed by the caller's species id — ⚠ pass a STABLE key, because a key
 * that varies per body silently turns this cache into a per-body allocator, which is the exact thing
 * `render-audit.test.ts` exists to catch.
 */
const SHEETS = new Map<string, { atlas: CreatureAtlas; tex: THREE.DataTexture }>()

export function buildCreatureSheet(key: string, art: CreatureArt, edge = 32): { atlas: CreatureAtlas; tex: THREE.DataTexture } {
  const hit = SHEETS.get(key)
  if (hit) return hit
  const atlas = buildCreatureAtlas(art, edge)
  const tex = new THREE.DataTexture(atlas.pixels, atlas.width, atlas.height, THREE.RGBAFormat)
  // ⚠ NEAREST, NO MIPMAPS. This is pixel art; a linear filter turns a 32px rabbit into a smear and
  // mipmaps average neighbouring CELLS together at distance, which bleeds one animation frame into
  // the next along the sheet.
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  // ⚠ `flipY` MUST STAY FALSE — `cellUV` maps row 0 to v = 0 on that assumption. Flipping it makes
  // every creature wear the animation of the slot mirrored about the sheet's middle: plausible, and
  // wrong in the way that never gets reported as a bug.
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  const made = { atlas, tex }
  SHEETS.set(key, made)
  return made
}

/**
 * One body. `key` must be the species id, not the individual's — see `buildCreatureSheet`.
 *
 * ⚠ THE TEXTURE IS CLONED PER BODY AND THE CLONE IS NOT A SECOND UPLOAD. `offset`/`repeat` live on
 * the Texture, not the material, so bodies sharing one texture object would all show the same frame.
 * A three.js clone shares `.source`, so the pixels are uploaded once and the clones differ only in
 * their UV window. ⚠ CLAIMED FROM THE THREE API, NOT MEASURED ON THE UHD 630 — if creature count
 * ever shows up in a frame profile, this line is the first thing to check.
 */
export function createCreatureBody(key: string, art: CreatureArt, opts: { edge?: number; height?: number } = {}): CreatureBody {
  const { atlas, tex } = buildCreatureSheet(key, art, opts.edge ?? 32)
  const own = tex.clone()
  own.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: own,
    transparent: true,
    // ⚠ An alpha TEST as well as transparency: a pure-alpha sprite sorts against every other
    // transparent thing in the scene, and mist is transparent. Cutting the fully-clear pixels out
    // stops a spirit from disappearing behind its own fog at certain angles.
    alphaTest: 0.5,
    depthWrite: true,
  })
  const sprite = new THREE.Sprite(material)
  const h = opts.height ?? 1.2
  sprite.scale.set(h, h, 1)

  let lastKey = ''
  const update = (nowMs: number, bodyYaw: number, camX: number, camZ: number, pose: Pose): void => {
    const viewerYaw = Math.atan2(camZ - sprite.position.z, camX - sprite.position.x)
    const f = facingFor(bodyYaw, viewerYaw)
    const at = frameAt(art, f.dir, pose, nowMs)
    // ⚠ Only touch the texture when the cell actually changes. Assigning offset/repeat every frame
    // for every body is how a cheap billboard becomes a per-frame cost on the machine least able to
    // absorb it.
    const k = `${at.dir}${pose}${at.frame}${f.mirror ? 'm' : ''}`
    if (k === lastKey) return
    const uv = cellUV(atlas, at.dir, pose, at.frame, f.mirror)
    if (!uv) return
    lastKey = k
    own.offset.set(uv.offsetX, uv.offsetY)
    own.repeat.set(uv.repeatX, uv.repeatY)
  }

  return {
    object: sprite,
    update,
    // ⚠ Disposes THIS BODY only. The shared sheet in `SHEETS` outlives every body on purpose — it is
    // the cache, and disposing it here would make the next spawn re-upload.
    dispose: () => { material.dispose(); own.dispose() },
  }
}
