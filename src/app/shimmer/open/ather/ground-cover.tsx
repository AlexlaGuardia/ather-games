'use client'
// GROUND COVER PREVIEW (Alex 11-15, after picking tiles + toon: "is there any way you can show me some previews of the
// ground cover"). Three densities to compare, behind ?cover= (dev): none (what ships) · tufts · meadow · lush.
//
// ★ THE SAME GRASS THE VOXEL WORLD DRAWS. The blades, the tall stands and the flower heads are voxel3d/tex/flora-tex.ts's
// procedural fills (no art files): the four tuft variants and four tall variants as one atlas each, the heads painted
// white and tinted by the bloom hues. Tinted the way flora-mesh.ts tints them, `ground / BLADE_GREEN`, so a tuft
// wears the Ather's own grass colour. Crossed cards, normals pointing UP so a card lights like the ground under it
// (no dark backs), cutout alpha.
//
// ★ ONLY ROUND THE KEEPER. A 300 m plot and its valley are far too much ground to carpet: cover is scattered in 3 m
// cells within COVER_R of the keeper, deterministic per cell (walking back finds the same tuft), re-laid when the
// keeper has moved a few metres. Nothing on a path; nothing too steep to root.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { bladeAtlasPixels, bladePixels, tallBladePixels, headPixels, HEAD_TINTS, TUFT_SEED, TUFT_BLADES, TALL_SEED, TALL_BLADES, GRASS_VARIANTS, BLADE_TILE, TALL_TILE_H } from '../../voxel3d/tex/flora-tex'
import { P } from './palette'

export type Cover = 'none' | 'tufts' | 'meadow' | 'lush'
export const COVERS: Cover[] = ['none', 'tufts', 'meadow', 'lush']
/** ★ Alex 11-15, shown the four: "that looks pretty good" (on the meadow recommendation) → meadow ships by default;
 *  ?cover= stays as a dev override (none / tufts / meadow / lush). */
export function coverFromUrl(): Cover {
  if (typeof window === 'undefined') return 'meadow'
  const q = new URLSearchParams(location.search).get('cover') as Cover | null
  return q && COVERS.includes(q) ? q : 'meadow'
}
export const COVER_R = 46
const CELL = 3, MAX = 4200, RELAY = 5

const hash = (a: number, b: number, s: number) => {
  let h = (a * 374761393 + b * 668265263 + s * 2246822519) ^ 0x27d4eb2f
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const patch = (x: number, z: number, f: number, s: number) =>   // soft blobs, 0..1, for clustering stands and flowers
  0.5 + 0.25 * Math.sin(x * f + s) * Math.cos(z * f * 1.13 - s * 0.7) + 0.25 * Math.sin((x + z) * f * 0.61 + s * 1.9)

/** The blade tile as BRIGHTNESS only, its linear mean at 0.5: the instance colour is then the grass colour itself.
 *  (Tinting the green tile by ground / BLADE_GREEN, flora-mesh's rule, multiplies R by ~3.5 and G by ~1.6 on the
 *  Ather's pale green, which skews every darker blade brown: the first preview's blades read olive.) */
function lumOnly(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length), lin = (v: number) => toLin(v)
  let sum = 0, n = 0
  for (let o = 0; o < data.length; o += 4) if (data[o + 3] > 0) { sum += 0.2126 * lin(data[o]) + 0.7152 * lin(data[o + 1]) + 0.0722 * lin(data[o + 2]); n++ }
  const k = n ? 0.5 / (sum / n) : 1
  for (let o = 0; o < data.length; o += 4) {
    const L = Math.min(1, (0.2126 * lin(data[o]) + 0.7152 * lin(data[o + 1]) + 0.0722 * lin(data[o + 2])) * k)
    const g = Math.round(255 * (L <= 0.0031308 ? L * 12.92 : 1.055 * L ** (1 / 2.4) - 0.055))
    out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = data[o + 3]
  }
  return out
}
function tex(data: Uint8Array, w: number, h: number) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true
  t.needsUpdate = true
  return t
}
/** Two crossed cards w × h, base on y = 0, sampling atlas column `col` of `n`; normals up. */
function crossed(w: number, h: number, col: number, n: number, y0 = 0): THREE.BufferGeometry {
  const u0 = col / n, u1 = (col + 1) / n, pos: number[] = [], uv: number[] = [], nor: number[] = []
  for (const a of [0, Math.PI / 2]) {
    const cx = Math.cos(a) * w / 2, cz = Math.sin(a) * w / 2
    const q = [[-cx, y0, -cz, u0, 0], [cx, y0, cz, u1, 0], [cx, y0 + h, cz, u1, 1], [-cx, y0, -cz, u0, 0], [cx, y0 + h, cz, u1, 1], [-cx, y0 + h, -cz, u0, 1]]
    for (const [x, y, z, u, v] of q) { pos.push(x, y, z); uv.push(u, v); nor.push(0, 1, 0) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}

const toLin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }

interface Kind { geo: THREE.BufferGeometry; mat: THREE.Material; key: string }

export function GroundCover({ cover, ground, skip, focus }: {
  cover: Cover
  ground: (x: number, z: number) => number
  /** true = nothing grows here (a path, the gate's pad...) */
  skip: (x: number, z: number) => boolean
  focus: React.MutableRefObject<{ x: number; z: number }>
}) {
  const kinds = useMemo(() => {
    const tuftT = tex(lumOnly(bladeAtlasPixels(TUFT_SEED, GRASS_VARIANTS, BLADE_TILE, BLADE_TILE, s => bladePixels(s, TUFT_BLADES))), BLADE_TILE * GRASS_VARIANTS, BLADE_TILE)
    const tallT = tex(lumOnly(bladeAtlasPixels(TALL_SEED, GRASS_VARIANTS, BLADE_TILE, TALL_TILE_H, s => tallBladePixels(s, TALL_BLADES))), BLADE_TILE * GRASS_VARIANTS, TALL_TILE_H)
    const headT = tex(headPixels(8), 8, 8)
    const mk = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide })
    const tuftM = mk(tuftT), tallM = mk(tallT), headM = mk(headT)
    const out: Kind[] = []
    for (let v = 0; v < GRASS_VARIANTS; v++) out.push({ geo: crossed(0.7, 0.5, v, GRASS_VARIANTS), mat: tuftM, key: `tuft${v}` })
    for (let v = 0; v < GRASS_VARIANTS; v++) out.push({ geo: crossed(0.6, 0.9, v, GRASS_VARIANTS), mat: tallM, key: `tall${v}` })   // knee-high, not head-high
    out.push({ geo: crossed(0.28, 0.28, 0, 1, 0.36), mat: headM, key: 'head' })
    return out
  }, [])
  useEffect(() => () => { for (const k of kinds) k.geo.dispose() }, [kinds])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const last = useRef({ x: Infinity, z: Infinity, cover: '' as string })

  useFrame(() => {
    const f = focus.current
    if (refs.current.length < kinds.length || refs.current.some(r => !r)) return   // not mounted yet: lay next frame
    if (cover === last.current.cover && Math.hypot(f.x - last.current.x, f.z - last.current.z) < RELAY) return
    last.current = { x: f.x, z: f.z, cover }
    const lists: { x: number; y: number; z: number; r: number; s: number; c: THREE.Color }[][] = kinds.map(() => [])
    if (cover !== 'none') {
      const c0 = new THREE.Color(), cx = Math.floor(f.x / CELL), cz = Math.floor(f.z / CELL), R = Math.ceil(COVER_R / CELL)
      for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) {
        if (a * a + b * b > R * R) continue
        const ia = cx + a, ib = cz + b
        const per = cover === 'tufts' ? 2 : cover === 'meadow' ? 2 : 3
        for (let n = 0; n < per; n++) {
          const x = (ia + hash(ia, ib, n * 3 + 1)) * CELL, z = (ib + hash(ia, ib, n * 3 + 2)) * CELL
          if (skip(x, z)) continue
          const y = ground(x, z); if (!Number.isFinite(y)) continue
          const sl = Math.abs(ground(x + 0.8, z) - y) + Math.abs(ground(x, z + 0.8) - y)
          if (!Number.isFinite(sl) || sl > 0.9) continue
          const roll = hash(ia, ib, n * 7 + 5), stand = patch(x, z, 0.09, 1.7), bloom = patch(x, z, 0.13, 4.2)
          // what grows here, by look
          let kind: 'tuft' | 'tall' | 'flower' | null = null
          if (cover === 'tufts') kind = roll < 0.62 ? 'tuft' : null
          else if (cover === 'meadow') kind = bloom > 0.78 && roll < 0.5 ? 'flower' : stand > 0.68 && roll < 0.55 ? 'tall' : roll < 0.45 ? 'tuft' : null
          else kind = bloom > 0.7 && roll < 0.55 ? 'flower' : stand > 0.55 && roll < 0.85 ? 'tall' : roll < 0.6 ? 'tuft' : null
          if (!kind) continue
          const r = hash(ia, ib, n * 11 + 9) * Math.PI * 2, s = 0.8 + hash(ia, ib, n * 13 + 3) * 0.5
          // the Ather's grass, a little varied and a shade deeper than the turf so a tuft reads against it (tile mean 0.5)
          c0.copy(P.grass).lerp(P.grassHi, hash(ia, ib, n * 17 + 7) * 0.7).lerp(P.gold, hash(ia, ib, n * 23 + 2) * 0.15)
          const tint = c0.clone().multiplyScalar(2 * 0.82)
          const v = Math.floor(hash(ia, ib, n * 19 + 1) * GRASS_VARIANTS)
          if (kind === 'tuft') lists[v].push({ x, y, z, r, s, c: tint })
          else if (kind === 'tall') lists[GRASS_VARIANTS + v].push({ x, y, z, r, s: s * 1.05, c: tint })
          else {
            lists[v].push({ x, y, z, r, s: s * 0.9, c: tint })   // the flower's leaves
            const hue = new THREE.Color(HEAD_TINTS[Math.floor(patch(x, z, 0.05, 9.1) * 4.99) % HEAD_TINTS.length])
            lists[kinds.length - 1].push({ x, y: y + (s - 1) * 0.3, z, r, s: 1, c: hue })
          }
        }
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
    kinds.forEach((_, k) => {
      const mesh = refs.current[k]; if (!mesh) return
      const L = lists[k], n = Math.min(L.length, MAX)
      for (let i = 0; i < n; i++) {
        const it = L[i]
        mesh.setMatrixAt(i, m.compose(p.set(it.x, it.y - 0.04, it.z), q.setFromAxisAngle(up, it.r), sc.set(it.s, it.s, it.s)))
        mesh.setColorAt(i, it.c)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  })

  return (
    <>
      {kinds.map((k, i) => (
        // ⚠ no JSX instanceColor: setColorAt makes the attribute on first use, and a JSX one attached after it replaced
        // it with zeros, so every blade drew BLACK (caught on the first preview shots, 11-15)
        <instancedMesh key={k.key} ref={el => { refs.current[i] = el }} args={[k.geo, k.mat, MAX]} frustumCulled={false} />
      ))}
    </>
  )
}
