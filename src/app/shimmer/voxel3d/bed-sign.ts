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
//   2. THE CROP SIGN — a stake at the cell's corner carrying the crop's YIELD icon on a cross of
//      two cards (readable from every side, like a flora tuft). The yield, not the seed: a seed
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
    // ⚠ TUNED AGAINST THE LIT WORLD (first prod shot 09-18): 58 came out PALER than the bare bed —
    // the lighting lifts a top face ~3.6×, the same lesson `tiles.ts` wrote on the bed tile. 38 sits
    // beside the wet patch's 0x2a1d12 and reads as worked, damp earth next to the dry furrows.
    const v = 38 + crest + trough + grit
    const i = (y * ICON + x) * 4
    px[i] = Math.max(0, Math.min(255, v * 1.12)); px[i + 1] = Math.max(0, Math.min(255, v * 0.94)); px[i + 2] = Math.max(0, Math.min(255, v * 0.74)); px[i + 3] = 255
  }
  const t = new THREE.DataTexture(px, ICON, ICON)
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true
  return t
}

/** The atlas grid: sixteen 32px cells in a 4×4, one texture for every sign. */
const ATLAS_COLS = 4
const ATLAS_PX = ICON * ATLAS_COLS

/**
 * ONE texture holding every crop's icon — the render audit's rule (a GPU resource per object is
 * the context-loss bug), and also just the right shape: sixteen signs share one material and
 * differ only in which cell their card's UVs point at. Rows are flipped so +v is up.
 */
function iconAtlas(items: ReadonlyArray<string>): { tex: THREE.DataTexture; cell: Map<string, number> } {
  const px = new Uint8Array(ATLAS_PX * ATLAS_PX * 4)
  const cell = new Map<string, number>()
  items.forEach((item, i) => {
    if (i >= ATLAS_COLS * ATLAS_COLS) return
    const src = iconPixelsFor(item, ICON)
    if (!src) return
    const cx = (i % ATLAS_COLS) * ICON, cy = Math.floor(i / ATLAS_COLS) * ICON
    for (let y = 0; y < ICON; y++) {
      const row = src.subarray(y * ICON * 4, (y + 1) * ICON * 4)
      px.set(row, ((ATLAS_PX - 1 - (cy + y)) * ATLAS_PX + cx) * 4)
    }
    cell.set(item, i)
  })
  const tex = new THREE.DataTexture(px, ATLAS_PX, ATLAS_PX)
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true
  return { tex, cell }
}

/** Where the stake stands in its cell, and how tall: the near-left corner, clear of the crop's root. */
const STAKE = { x: 0.16, z: 0.16, h: 0.46, w: 0.05 }
const CARD = 0.42

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
  // 3. the cards — a cross of two planes per crop, wearing that crop's yield icon
  const crossGeo = (() => {
    const a = new THREE.PlaneGeometry(CARD, CARD)
    const b = new THREE.PlaneGeometry(CARD, CARD); b.rotateY(Math.PI / 2)
    const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array])
    const nrm = new Float32Array([...a.attributes.normal.array, ...b.attributes.normal.array])
    const uv = new Float32Array([...a.attributes.uv.array, ...b.attributes.uv.array])
    const ia = a.getIndex()!, ib = b.getIndex()!
    const idx = [...Array.from(ia.array), ...Array.from(ib.array).map(i => i + a.attributes.position.count)]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.translate(0, STAKE.h + CARD * 0.36, 0)   // the card's foot sits on the stake's top
    a.dispose(); b.dispose()
    return g
  })()
  const cards = new Map<string, THREE.InstancedMesh>()
  const unsigned: string[] = []
  const atlas = iconAtlas(CROP_IDS.map(signItemOf).filter((x): x is string => !!x))
  const cardMat = new THREE.MeshLambertMaterial({ map: atlas.tex, alphaTest: 0.5, side: THREE.DoubleSide })
  const cardGeos: THREE.BufferGeometry[] = []
  for (const cropId of CROP_IDS) {
    const item = signItemOf(cropId)
    const c = item ? atlas.cell.get(item) : undefined
    if (c === undefined) { unsigned.push(cropId); continue }
    // The cross, with its UVs moved onto this crop's atlas cell. Geometry per crop, texture shared.
    const g = crossGeo.clone()
    const uv = g.attributes.uv as THREE.BufferAttribute
    const ox = (c % ATLAS_COLS) / ATLAS_COLS, oy = 1 - (Math.floor(c / ATLAS_COLS) + 1) / ATLAS_COLS
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + uv.getX(i) / ATLAS_COLS, oy + uv.getY(i) / ATLAS_COLS)
    uv.needsUpdate = true
    cardGeos.push(g)
    const m = new THREE.InstancedMesh(g, cardMat, SIGN_BUDGET)
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
      sownGeo.dispose(); stakeGeo.dispose(); crossGeo.dispose(); sownMat.dispose(); stakeMat.dispose()
      for (const g of cardGeos) g.dispose()
      cardMat.dispose(); sownTex.dispose(); atlas.tex.dispose()
    },
  }
}
