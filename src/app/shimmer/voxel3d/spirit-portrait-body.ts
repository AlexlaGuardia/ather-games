// ── A wild spirit, wearing its canon portrait ─────────────────────────────────────────────────
//
// Implements `CreatureBody` and nothing else, which is the whole point: Alex ruled billboards are
// placeholders for a future 3D model and that `CreatureBody` is the entire contract, so nothing may
// branch on what is behind it. This is a second implementation of that interface, not a new kind of
// thing — the modelled version replaces either of us without a caller noticing.
//
// ★ WHY THE PAINTING AND NOT THE PIXEL SPRITE. The 32×32 creature sprites were never finished — they
// are concept, and they currently render wrong on top of that (16×16 art in a 32×32 buffer, read at
// 32; see `scripts/sprite-edge-shot.mts`). The canon base forms ARE finished, locked, and canon-
// approved. Between an unfinished placeholder that draws as a smear and a locked painting, the
// painting is the better placeholder.
//
// ★ A CUTOUT, NOT THE GRIMOIRE'S OVAL, AND THE FRAME IS THE WHOLE DIFFERENCE. In a panel a framed
// oval reads as a portrait card, which is right. In the world a frame reads as a menu element
// standing in the grass, and `shimmer-geography.md` rules the ring "visible, wandering, underfoot —
// why the garden reads as inhabited rather than as a menu". Same art, opposite treatment.
//
// ★ AND A CAMERA-FACING QUAD ONLY EVER SHOWS THE FRONT, which is exactly what a portrait is. The
// pixel sprites' three facings are what a TOP-DOWN game needs; a billboard turns to you by
// construction, so the front view is not a compromise here. What IS lost is the back view, so the
// body flips on the horizontal to at least face its own direction of travel.

import * as THREE from 'three'
import type { CreatureBody } from './creature-billboard'
import type { Pose } from './creature-atlas'

/** Portrait paths, by species code. Absent = this species has no cutout and the caller falls back. */
export const PORTRAIT_OF: Readonly<Record<string, string>> = Object.freeze({
  fox: '/spirits/world/fox.webp',
  owl: '/spirits/world/owl.webp',
  turtle: '/spirits/world/turtle.webp',
  axolotl: '/spirits/world/axolotl.webp',
  bat: '/spirits/world/bat.webp',
  firefly: '/spirits/world/firefly.webp',
  frog: '/spirits/world/frog.webp',
  rabbit: '/spirits/world/rabbit.webp',
  'water-bear': '/spirits/world/water-bear.webp',
  hummingbird: '/spirits/world/hummingbird.webp',
})

/**
 * ── ★ THE FOLK, AND WHY THEY ARE A SEPARATE TABLE ─────────────────────────────────────────────
 * `PORTRAIT_OF` is asserted to cover EXACTLY the live species list, which is what stops a species
 * quietly losing its art. Folding Moglins into it would have bought three entries at the cost of
 * that assert — the roster check would have had to loosen to "at least", and an "at least" check
 * cannot notice a missing owl. Two tables, two exact claims.
 *
 * ⚠ THE MOGLIN ART IS THE WRONG READ AND SHIPS ANYWAY, ON PURPOSE. `moglin-canon.png` is the shy,
 * content, arms-folded BASE — which canon makes the DEFLATED state, the payoff after you free his
 * spirit. The Thornlord swagger a patrol should actually wear is "sub-type renders in progress"
 * and has no locked ref, so every patrol currently looks already-defeated, inverting the beat the
 * cozy line is built on. Alex ruled a placeholder beats the brown box it replaces. Named here so
 * the next reader finds the gap instead of assuming the look was chosen.
 */
export const FOLK_PORTRAIT: Readonly<Record<string, string>> = Object.freeze({
  moglin: '/spirits/world/moglin.webp',
  jimbo: '/spirits/world/jimbo.webp',
  hemlock: '/spirits/world/hemlock.webp',
})

/**
 * ⚠⚠ NULL PROTOTYPE, AND IT IS LOAD-BEARING — the same defect `sprites/registry.ts` documents on
 * `SPECIES_ART`, in a file that had not carried the lesson across. Species ids reach `hasPortrait`
 * from SAVED DATA (the mist ledger and keeper saves are localStorage, which a player can edit). On
 * an ordinary object literal `ALL_PORTRAITS['__proto__']` walks the chain and returns
 * `Object.prototype` — TRUTHY — so `hasPortrait('__proto__')` answered **true**, the gate both
 * callers use let it through, and `portraitUrl` then handed an OBJECT to `TextureLoader.load`.
 * `constructor` and `toString` do the same. Caught by `portrait-assets.test.ts` on its first run.
 *
 * The two source tables are spread into a fresh null-prototype object rather than being rebuilt,
 * so they stay exactly the two exact claims the header above describes.
 */
const ALL_PORTRAITS: Readonly<Record<string, string>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, string>, PORTRAIT_OF, FOLK_PORTRAIT),
)

export const hasPortrait = (key: string): boolean => key in ALL_PORTRAITS

/**
 * ── ★ THE COLLAR BADGE (Alex, 2026-08-27) ─────────────────────────────────────────────────────
 * A spirit a Moglin is dragging wears an iron-band-and-lock mark in the corner of its portrait.
 * Placeholder for canon's full treatment (`moglins.md:88` locks the collared read as glow
 * extinguished, body drained, eyes downcast, and calls it reusable for any spirit by re-running the
 * edit on a new source). The badge gets the SIGNAL on screen now — canon calls the collar "the
 * villain signal in any frame", and the alternative on screen today is a purple box.
 *
 * ⚠ THE BADGE IS BAKED INTO ITS OWN TEXTURE, so a collared body costs one shared sheet rather than a
 * second draw call per resident on an 84%-GPU-bound world. `scripts/collar-badge.py` stamps them.
 */
/**
 * ⚠⚠ `PORTRAIT_OF`, NOT `ALL_PORTRAITS`, AND THAT IS THE WHOLE GUARANTEE. Folk are never collared —
 * they are the ones doing the collaring — and until 2026-08-27 that rule lived only in this file's
 * prose, in the commit message that added the badge (*"and no Moglin ever does"*), and in
 * `scripts/collar-badge.py`'s own species list. **The runtime enforced none of it.** Reading
 * `ALL_PORTRAITS` here happily produced `/spirits/world/moglin-collared.webp`, which has never
 * existed, and — because a string is not `undefined` — `sheetFor`'s `?? ALL_PORTRAITS[species]`
 * could not fall back. A collared folk would have loaded a 404 into a texture and drawn NOTHING,
 * silently, on a path whose fallback reads as if it handles exactly that.
 *
 * ★ It was latent, not live: no caller passes `collared` for a folk today. It is one step away —
 * the Moglin portrait swap is the step — and the two tables above already say why they are split.
 * This makes the code say it too.
 */
const collaredUrl = (species: string): string | undefined => {
  // ⚠ `hasOwnProperty`, not a bare index: `PORTRAIT_OF` is a plain literal, so `PORTRAIT_OF['__proto__']`
  // returns `Object.prototype` and `.replace` on it throws. Same chain walk as `ALL_PORTRAITS` above.
  const base = Object.prototype.hasOwnProperty.call(PORTRAIT_OF, species) ? PORTRAIT_OF[species] : undefined
  return base ? base.replace(/\.webp$/, '-collared.webp') : undefined
}

/**
 * The texture URL a body will actually load. EXPORTED so `portrait-assets.test.ts` can assert
 * against the shipped resolution instead of restating it.
 *
 * ⚠ A TEST THAT REBUILT THIS RULE WOULD PROVE NOTHING ABOUT THE GAME. The bug this file just fixed
 * lived precisely in the gap between what the prose said and what the resolution did, and a copy of
 * the rule in a test file would have been written from the prose. `sheetFor` calls this; so does the
 * oracle; there is one path.
 */
export function portraitUrl(species: string, collared = false): string | undefined {
  return (collared ? collaredUrl(species) : undefined) ?? ALL_PORTRAITS[species]
}

/**
 * ★ ONE TEXTURE AND ONE MATERIAL PER SPECIES, SHARED BY EVERY BODY — and unlike the atlas path this
 * can genuinely share, which is a fix rather than a shortcut. `createCreatureBody` must clone its
 * texture per body because each body needs its own UV WINDOW into the sheet; a portrait is a single
 * image with no window, so every resident of a species can point at the same material. That removes
 * a SpriteMaterial per resident on a world Alex profiled at 84% GPU-bound.
 * ⚠ Which is also why `dispose()` here does NOT free them: they outlive any one body on purpose.
 */
const SHEETS = new Map<string, { tex: THREE.Texture; mat: THREE.SpriteMaterial; aspect: { v: number } }>()

function sheetFor(species: string, collared = false): { tex: THREE.Texture; mat: THREE.SpriteMaterial; aspect: { v: number } } {
  // ⚠ THE CACHE KEY CARRIES THE COLLAR. Keyed on species alone, the first resident of a species to
  // be built would decide whether every later one wears a collar — a free Vulnyx and a dragged one
  // would share a sheet, and which look you got would depend on spawn order. That is the kind of
  // bug that reproduces only sometimes and reads as a data problem.
  const key = collared ? `${species}:collared` : species
  const hit = SHEETS.get(key)
  if (hit) return hit
  // ⚠ THE PRECONDITION, MADE LOUD. Both callers gate on `hasPortrait` first, so this cannot fire in
  // the shipped paths — but `createPortraitBody` is exported, and indexing a `Record<string, string>`
  // hands back `string` for a key that is not there, so TypeScript has never been able to say this.
  // Before `portraitUrl` was extracted, an unknown species passed `undefined` straight to
  // `TextureLoader.load` and drew an invisible sprite. Refusing loudly matches what this file already
  // does elsewhere: an unrecognised id must be visible, not papered over.
  const url = portraitUrl(species, collared)
  if (!url) throw new Error(`spirit-portrait-body: no portrait for '${species}' — gate on hasPortrait() first`)
  const aspect = { v: 1 }
  // ⚠ THE ASPECT IS NOT KNOWN UNTIL THE IMAGE LANDS, and these are not square — Dewbear is 256×178.
  // Guessing square would squash every one of them, so the scale is applied in the load callback
  // and the box carries the value so bodies created before the load still correct themselves.
  const tex = new THREE.TextureLoader().load(url, t => {
    aspect.v = (t.image?.width ?? 1) / (t.image?.height ?? 1)
  })
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    // ⚠ An alpha TEST as well as transparency, for the reason `createCreatureBody` gives: a purely
    // transparent sprite sorts against every other transparent thing in the scene, and mist IS
    // transparent, so a spirit disappears behind its own fog at some angles. The cutout's edge is
    // soft, so this sits low enough to keep the antialiased rim.
    alphaTest: 0.28,
    depthWrite: true,
  })
  const made = { tex, mat, aspect }
  SHEETS.set(key, made)
  return made
}

/**
 * A spirit standing in the world wearing its canon portrait.
 * `height` is in world units and is the creature's TALLNESS; width follows the art's own aspect.
 */
export function createPortraitBody(species: string, opts: { height?: number; collared?: boolean } = {}): CreatureBody {
  const { mat, aspect } = sheetFor(species, opts.collared === true)
  const sprite = new THREE.Sprite(mat)
  const h = opts.height ?? 1.2
  let facing = 1
  const applyScale = () => sprite.scale.set(h * aspect.v * facing, h, 1)
  applyScale()

  const update = (_nowMs: number, bodyYaw: number, camX: number, camZ: number, _pose: Pose): void => {
    // Which side of the creature the viewer is on. A portrait has no back, so the most it can
    // honestly say is which way it is heading — flip so it walks the way it looks.
    const viewerYaw = Math.atan2(camZ - sprite.position.z, camX - sprite.position.x)
    let d = bodyYaw - viewerYaw
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    const want = d < 0 ? 1 : -1
    if (want !== facing) { facing = want; applyScale() }
    else if (sprite.scale.y !== h) applyScale()   // the image landed and the aspect changed
  }

  return {
    object: sprite,
    update,
    // ⚠ Deliberately does not free the texture or material — they are shared by every body of this
    // species and cached for the page's life. Freeing them here would blank every other resident.
    dispose: () => { sprite.removeFromParent() },
  }
}
