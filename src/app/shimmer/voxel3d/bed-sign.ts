// The sown bed — what a planted bed's top face becomes, and the sign that says what is in it.
//
// ── ★ WHY (2026-09-18, Alex: "revamp the top face of the bed so it changes depending on whether
//    its got something planted and maybe even show what kind of plant is growing there") ────────
// A planted bed drew the crop (`planted-feed.ts`, five stages) but the SOIL under it was the same
// raked-furrow tile as an empty bed, and until the head came in every crop was a green nub of a
// slightly different green. Two answers, both overlays on the top face, both fed by the same
// planted beat the crop renderer takes:
//
//   1. THE SOWN PATCH — a mounded, raked seedbed drawn over the furrows of every planted cell, so
//      "sown" reads from across the plot, before the sprout and at night.
//   2. THE CROP SIGN — a short post at the cell's corner with a plank BOARD on it, the crop's
//      YIELD icon painted on the board, turned 45° so no side of the bed sees it edge-on. The yield, not the seed: a seed
//      packet is what you put in, the grain is what you are waiting for, and every yield item has
//      hand-painted art (`item-icon.ts` › painted) while the seeds all look like seeds.
//
// ★ NOT A FOURTH BED MATERIAL, for the reason `wet-patch.ts` gives: three woods × planted would be
// three block ids and a `setVoxel` on every plant and harvest. A quad per planted cell is one draw.
//
// ★ ONE InstancedMesh PER CROP for the signs (sixteen at most), ONE texture for all of them: an
// atlas of the icons, and each crop's cross carries UVs onto its cell. A per-instance UV offset
// would mean a patched shader for a plane the size of a hand; sixteen tiny draws is the cheap end
// of that trade, and one atlas is what the render audit's no-texture-per-object rule asks for.
import * as THREE from 'three'
import { CROP_DEFS, CROP_IDS } from '../voxel/crops'
import { iconPixelsFor } from './tex/item-icon'
import type { PlantedSpot } from './planted-feed'

/** Planted cells drawn at once — the plot cap is 20 beds; a keeper can stack more. */
export const SIGN_BUDGET = 128
const ICON = 32

export interface BedSigns {
  group: THREE.Group
  /** Rewrite every sown patch + sign from the planted feed. On the beat, never per frame. */
  set(spots: ReadonlyArray<PlantedSpot>): void
  /** For the readout: patches and signs drawn, and crops with no icon (their sign is a bare stake). */
  counts(): { sown: number; signs: number; unsigned: string[] }
  dispose(): void
}

/** The crop's yield item — the picture on its sign — or null for a crop that pays in something else. */
export const signItemOf = (cropId: string): string | null => CROP_DEFS[cropId]?.yields?.[0]?.itemId ?? null

/**
 * The sown patch's texture: dark turned earth with three raked mounds running along x, each a
 * bright crest and a shadow trough. Pixel art at 32, nearest-filtered, so it sits with the tiles.
 * ★ It is DARKER than the bare bed's tile on purpose — sown earth is worked and damp, and the
 * contrast is what makes a planted cell read from the plot's edge.
 */
function sownTexture(): THREE.DataTexture {
  const px = new Uint8Array(ICON * ICON * 4)
  const h = (x: number, y: number) => { let n = (x * 73856093) ^ (y * 19349663) ^ 0x5bd1e995; n = Math.imul(n ^ (n >>> 13), 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296 }
  for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) {
    // Three mounds: rows centred at 5, 16, 27 — crest above centre, trough below.
    const rel = ((y + 6) % 11) - 5          // −5..5 across a mound, 0 at its centre line
    const crest = rel === -1 || rel === 0 ? 14 : rel === -2 || rel === 1 ? 6 : 0
    const trough = rel === 3 || rel === 4 ? -12 : rel === 5 || rel === -5 ? -6 : 0
    const grit = (h(x, y) - 0.5) * 8
    // ⚠ THESE ARE sRGB BYTES, AND THE TEXTURE SAYS SO (second prod shot 09-18): a DataTexture is
    // linear by default, so 58 — and then 38 — both came out PALER than the bare bed: three read
    // them as linear light and the swapchain re-encoded them, lifting 38/255 to ~105/255 before
    // any lamp touched it. `colorSpace = SRGBColorSpace` below makes these the same kind of number
    // as the wet patch's `0x2a1d12` (a THREE.Color is sRGB-managed) — 56 sits a shade above it.
    const v = 56 + crest + trough + grit
    const i = (y * ICON + x) * 4
    px[i] = Math.max(0, Math.min(255, v * 1.12)); px[i + 1] = Math.max(0, Math.min(255, v * 0.94)); px[i + 2] = Math.max(0, Math.min(255, v * 0.74)); px[i + 3] = 255
  }
  const t = new THREE.DataTexture(px, ICON, ICON)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true
  return t
}

/** The atlas grid: sixteen 32px cells in a 4×4, one texture for every sign. */
const ATLAS_COLS = 4
const ATLAS_PX = ICON * ATLAS_COLS

/** The board's plank, sRGB — a pale timber the painted icons sit on. */
const PLANK: [number, number, number] = [206, 176, 128]

/**
 * ONE texture holding every crop's icon — the render audit's rule (a GPU resource per object is
 * the context-loss bug), and also just the right shape: sixteen signs share one material and
 * differ only in which cell their board's UVs point at. Rows are flipped so +v is up.
 *
 * ★ EACH CELL IS A PAINTED BOARD, NOT A CUT-OUT (2026-09-18, Alex read the first sign as a stem
 * "glitched to the border, disconnected from the green scruff"): the sprite's transparent margin
 * left the glyph floating a hand above the post. Now the icon is TRIMMED to its ink, scaled to fill
 * the cell, and laid over a plank ground — so the board is a solid thing with a picture on it.
 */
function iconAtlas(items: ReadonlyArray<string>): { tex: THREE.DataTexture; cell: Map<string, number> } {
  const px = new Uint8Array(ATLAS_PX * ATLAS_PX * 4)
  const cell = new Map<string, number>()
  const grain = (x: number, y: number) => { let n = (x * 92821) ^ (y * 68917) ^ 0x1234567; n = Math.imul(n ^ (n >>> 13), 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296 }
  const PAD = 3
  items.forEach((item, i) => {
    if (i >= ATLAS_COLS * ATLAS_COLS) return
    const src = iconPixelsFor(item, ICON)
    if (!src) return
    // the ink's bounding box
    let x0 = ICON, y0 = ICON, x1 = -1, y1 = -1
    for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) if (src[(y * ICON + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    if (x1 < 0) return
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1
    const fit = (ICON - PAD * 2) / Math.max(bw, bh)
    const ox = Math.floor((ICON - bw * fit) / 2), oy = Math.floor((ICON - bh * fit) / 2)
    const cx = (i % ATLAS_COLS) * ICON, cy = Math.floor(i / ATLAS_COLS) * ICON
    for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) {
      // plank ground with a little grain, a darker rim so the board has an edge
      const rim = x === 0 || y === 0 || x === ICON - 1 || y === ICON - 1
      const g = (grain(x + cx, y) - 0.5) * 18 - (rim ? 46 : 0)
      let r = PLANK[0] + g, gg = PLANK[1] + g, b = PLANK[2] + g
      // the icon, nearest-sampled from its trimmed box
      const sx = Math.floor((x - ox) / fit) + x0, sy = Math.floor((y - oy) / fit) + y0
      if (x >= ox && y >= oy && sx <= x1 && sy <= y1 && sx >= x0 && sy >= y0) {
        const k = (sy * ICON + sx) * 4
        if (src[k + 3] > 0) { r = src[k]; gg = src[k + 1]; b = src[k + 2] }
      }
      const o = ((ATLAS_PX - 1 - (cy + y)) * ATLAS_PX + (cx + x)) * 4
      px[o] = Math.max(0, Math.min(255, r)); px[o + 1] = Math.max(0, Math.min(255, gg)); px[o + 2] = Math.max(0, Math.min(255, b)); px[o + 3] = 255
    }
    cell.set(item, i)
  })
  const tex = new THREE.DataTexture(px, ATLAS_PX, ATLAS_PX)
  tex.colorSpace = THREE.SRGBColorSpace   // painted sprite bytes are sRGB, like every icon on the HUD
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true
  return { tex, cell }
}

/** The post: the cell's near-left corner, clear of the crop's root; short, so the board is the thing. */
const STAKE = { x: 0.18, z: 0.18, h: 0.30, w: 0.05 }
/** The board: a plank the icon is painted on, standing on the post, turned 45° to the cell so no
 *  side of the bed sees it edge-on (a marker faces the path; a bed has four paths). */
const BOARD = { w: 0.40, h: 0.34, d: 0.035 }

export function createBedSigns(): BedSigns {
  const group = new THREE.Group()
  // 1. the sown patch — same flat quad as the wet patch, one step above it in the offset stack
  //    (the wet tint draws OVER the sown earth: a watered sown bed is dark on dark, as it should be).
  const sownGeo = new THREE.PlaneGeometry(0.9, 0.9); sownGeo.rotateX(-Math.PI / 2)
  const sownTex = sownTexture()
  const sownMat = new THREE.MeshLambertMaterial({ map: sownTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  const sown = new THREE.InstancedMesh(sownGeo, sownMat, SIGN_BUDGET)
  sown.count = 0; sown.frustumCulled = false; sown.renderOrder = 0
  group.add(sown)
  // 2. the stakes — one mesh, a thin dark post
  const stakeGeo = new THREE.BoxGeometry(STAKE.w, STAKE.h, STAKE.w); stakeGeo.translate(0, STAKE.h / 2, 0)
  const stakeMat = new THREE.MeshLambertMaterial({ color: 0x4a3423 })
  const stakes = new THREE.InstancedMesh(stakeGeo, stakeMat, SIGN_BUDGET)
  stakes.count = 0; stakes.frustumCulled = false
  group.add(stakes)
  // 3. the boards — one box per crop, its FRONT and BACK faces wearing that crop's atlas cell,
  //    the four edges plain plank. Box face order in three: +x, −x, +y, −y, +z, −z; groups 4 and 5
  //    are the two faces the picture is on.
  const boardGeo = (() => {
    const g = new THREE.BoxGeometry(BOARD.w, BOARD.h, BOARD.d)
    g.translate(0, STAKE.h + BOARD.h / 2 - 0.02, 0)
    g.rotateY(Math.PI / 4)
    return g
  })()
  const cards = new Map<string, THREE.InstancedMesh>()
  const unsigned: string[] = []
  const atlas = iconAtlas(CROP_IDS.map(signItemOf).filter((x): x is string => !!x))
  const faceMat = new THREE.MeshLambertMaterial({ map: atlas.tex })
  const edgeMat = new THREE.MeshLambertMaterial({ color: 0xb89a6a })
  // groups 0..3 = the edges, 4..5 = front/back — one material array, shared by every board
  const boardMats = [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat]
  const cardGeos: THREE.BufferGeometry[] = []
  for (const cropId of CROP_IDS) {
    const item = signItemOf(cropId)
    const c = item ? atlas.cell.get(item) : undefined
    if (c === undefined) { unsigned.push(cropId); continue }
    // The board, with the front/back faces' UVs moved onto this crop's atlas cell. Geometry per
    // crop, texture and materials shared. BoxGeometry lays each face's UVs over 0..1.
    const g = boardGeo.clone()
    const uv = g.attributes.uv as THREE.BufferAttribute
    const ox = (c % ATLAS_COLS) / ATLAS_COLS, oy = 1 - (Math.floor(c / ATLAS_COLS) + 1) / ATLAS_COLS
    for (const grp of g.groups.slice(4)) for (let i = grp.start; i < grp.start + grp.count; i++) {
      const vi = g.index!.getX(i)
      uv.setXY(vi, ox + uv.getX(vi) / ATLAS_COLS, oy + uv.getY(vi) / ATLAS_COLS)
    }
    uv.needsUpdate = true
    cardGeos.push(g)
    const m = new THREE.InstancedMesh(g, boardMats, SIGN_BUDGET)
    m.count = 0; m.frustumCulled = false
    cards.set(cropId, m); group.add(m)
  }

  const m4 = new THREE.Matrix4()
  let last = { sown: 0, signs: 0 }
  return {
    group,
    set(spots) {
      let ns = 0, nk = 0
      const nc = new Map<string, number>()
      for (const s of spots) {
        if (ns >= SIGN_BUDGET) break
        m4.makeTranslation(s.x + 0.5, s.y + 1.003, s.z + 0.5)
        sown.setMatrixAt(ns++, m4)
        m4.makeTranslation(s.x + STAKE.x, s.y + 1.0, s.z + STAKE.z)
        stakes.setMatrixAt(nk++, m4)
        const card = cards.get(s.cropId)
        if (card) { const n = nc.get(s.cropId) ?? 0; card.setMatrixAt(n, m4); nc.set(s.cropId, n + 1) }
      }
      sown.count = ns; sown.instanceMatrix.needsUpdate = true
      stakes.count = nk; stakes.instanceMatrix.needsUpdate = true
      let signs = 0
      for (const [id, card] of cards) { card.count = nc.get(id) ?? 0; card.instanceMatrix.needsUpdate = true; signs += card.count }
      last = { sown: ns, signs }
    },
    counts: () => ({ ...last, unsigned: [...unsigned] }),
    dispose() {
      sownGeo.dispose(); stakeGeo.dispose(); boardGeo.dispose(); sownMat.dispose(); stakeMat.dispose()
      for (const g of cardGeos) g.dispose()
      faceMat.dispose(); edgeMat.dispose(); sownTex.dispose(); atlas.tex.dispose()
    },
  }
}
