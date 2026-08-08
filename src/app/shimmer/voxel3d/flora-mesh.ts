// Ground-cover renderer — flora.ts's selection field, standing up in the world.
//
// ★ ONE InstancedMesh PER KIND, NON-NEGOTIABLE (piece-mesh's rule, same reasoning): a meadow is
// tens of thousands of tufts, and anything per-tuft is the WebGL-context-loss bug. Four draws
// total: tufts, tall grass, flower stems, flower heads (heads split out so instanceColor can tint
// the bloom without turning the stem pink).
//
// ★ THE RENDERER OWNS SURFACE TRUTH. flora.ts says what WOULD grow; the probe (VoxelWorld's live
// voxel read) says whether the actual ground is still topsoil with air above — so player-dug holes
// shed their tufts and placed blocks never wear a flower hat. Per-column spot lists are cached and
// invalidated on edit; a sync assembles instance buffers from cache, so the per-frame cost of the
// whole feature is one uniform write.
//
// ★ WIND IS A SHADER, PHASE IS POSITION. The sway reads instanceMatrix translation for its phase
// ((x+z)·k = a travelling wave, so gusts ROLL across a meadow instead of every blade metronoming
// in sync), weighted by uv.y so roots stay planted. CPU never touches a standing instance.

import * as THREE from 'three'
import { floraAt, FLORA } from '../voxel/flora'

const SECTION = 16

/** Instance caps — generous against radius-12 meadow country; sync stops quietly at the cap. */
const CAP = { tuft: 24000, tall: 6000, flower: 9000 } as const

/** Placeholder palette, tiles.ts's register: greens off TOPSOIL, heads in mana-adjacent pastels. */
const BLADE_GREEN: [number, number, number] = [86, 158, 66]
const HEAD_TINTS = [0xf2f4ee, 0xe8c95a, 0xb08ae0, 0x8ec7e8, 0xe8a0b4]

interface Spot { x: number; y: number; z: number; kind: number; variant: number }

export interface FloraRenderer {
  group: THREE.Group
  /** Rebuild buffers from the loaded columns. Column spot lists are cached until invalidated. */
  sync(cols: { key: string; x0: number; z0: number }[], seed: number, probe: (x: number, z: number) => number): void
  /** Drop a column's cached spots (its ground changed — an edit landed). */
  invalidate(colKey: string): void
  tick(elapsed: number): void
  dispose(): void
}

/** A crossed pair of 1×1 quads, base at y=0, uv.y 0 at the root — the sway weight rides on it.
 *  Normals point UP so a blade lights like the ground it grows from (the standard grass-card
 *  trick; a real face normal would moonlight one side of every blade). */
function buildCrossGeometry(width: number, height: number, yBase = 0): THREE.BufferGeometry {
  const hw = width / 2
  const pos: number[] = []
  const uv: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  const quad = (ax: number, az: number, bx: number, bz: number) => {
    const base = pos.length / 3
    pos.push(ax, yBase, az, bx, yBase, bz, bx, yBase + height, bz, ax, yBase + height, az)
    uv.push(0, 0, 1, 0, 1, 1, 0, 1)
    nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  quad(-hw, 0, hw, 0)
  quad(0, -hw, 0, hw)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

/** Blade texture: tapered vertical strokes, cutout alpha. Deterministic — same seed, same tile. */
function makeBladeTexture(seed: number, blades: number, size = 16): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  let s = seed
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296 }
  for (let b = 0; b < blades; b++) {
    const bx = Math.floor(rnd() * size)
    const h = Math.floor(size * (0.55 + rnd() * 0.45))
    const lean = rnd() < 0.5 ? -1 : 1
    for (let y = 0; y < h; y++) {
      const x = Math.min(size - 1, Math.max(0, bx + (y > h * 0.6 ? lean : 0)))
      // ⚠ DataTexture row 0 is v=0 — the BOTTOM of the quad (no canvas-style flipY here). The
      // first version indexed (size-1-y) out of canvas habit, which painted every blade growing
      // DOWN from the quad's top edge and left the root row transparent — grass hovering a gap
      // above its own ground (Alex caught it on sight).
      const o = (y * size + x) * 4
      const shade = -24 + rnd() * 40 + (y / h) * 26      // tips catch more light
      data[o] = BLADE_GREEN[0] + shade
      data[o + 1] = BLADE_GREEN[1] + shade
      data[o + 2] = BLADE_GREEN[2] + shade * 0.6
      data[o + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, size, size)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** Flower-head texture: a white bloom (petal ring + core) the instanceColor tints. */
function makeHeadTexture(size = 8): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c) / (size / 2)
    if (d > 0.9) continue
    const o = (y * size + x) * 4
    const core = d < 0.3
    // Painted WHITE so instanceColor is the whole hue; the core dips warm so a bloom has a centre.
    data[o] = core ? 232 : 255
    data[o + 1] = core ? 206 : 255
    data[o + 2] = core ? 120 : 255
    data[o + 3] = 255
  }
  const t = new THREE.DataTexture(data, size, size)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

export function createFloraRenderer(): FloraRenderer {
  const uTime = { value: 0 }

  /** Lambert so flora lives under the same day-night lights as the pieces; the sway is injected
   *  and the material stays ONE compiled program per mesh (audit's whole point). */
  const swayMaterial = (map: THREE.Texture, amp: number): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  float ph = (instanceMatrix[3].x + instanceMatrix[3].z) * 0.35;
  float w = uv.y * ${amp.toFixed(3)};
  transformed.x += sin(uTime * 1.5 + ph) * w;
  transformed.z += cos(uTime * 1.1 + ph * 1.3) * w * 0.7;
  #endif
}`)
    }
    return m
  }

  const bladeTex = makeBladeTexture(0x5eaf, 5)
  const tallTex = makeBladeTexture(0x77c1, 4)
  const headTex = makeHeadTexture()

  // Widths chosen against the jitter so a blade can never overhang its cell (w/2 + 0.15 ≤ 0.5):
  // on a terrace step, grass leaning out over the riser reads as floating from below.
  const tuftGeo = buildCrossGeometry(0.7, 0.55)
  const tallGeo = buildCrossGeometry(0.7, 1.05)
  const stemGeo = buildCrossGeometry(0.5, 0.62)
  const headGeo = buildCrossGeometry(0.3, 0.3, 0.55)   // a small cross riding near the stem's top

  const tuftMat = swayMaterial(bladeTex, 0.05)
  const tallMat = swayMaterial(tallTex, 0.1)
  const stemMat = swayMaterial(bladeTex, 0.08)
  const headMat = swayMaterial(headTex, 0.08)

  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, CAP.tuft)
  const talls = new THREE.InstancedMesh(tallGeo, tallMat, CAP.tall)
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, CAP.flower)
  const heads = new THREE.InstancedMesh(headGeo, headMat, CAP.flower)
  heads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP.flower * 3), 3)
  for (const m of [tufts, talls, stems, heads]) {
    m.count = 0
    m.frustumCulled = false     // instances span the whole load radius; the default bounds lie
    m.receiveShadow = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }

  const group = new THREE.Group()
  group.add(tufts, talls, stems, heads)

  const cache = new Map<string, Spot[]>()
  const mtx = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const off = new THREE.Vector3()
  const tint = new THREE.Color()
  const Y_AXIS = new THREE.Vector3(0, 1, 0)

  const spotsFor = (k: string, x0: number, z0: number, seed: number, probe: (x: number, z: number) => number): Spot[] => {
    const hit = cache.get(k)
    if (hit) return hit
    const out: Spot[] = []
    for (let dz = 0; dz < SECTION; dz++) for (let dx = 0; dx < SECTION; dx++) {
      const x = x0 + dx, z = z0 + dz
      const f = floraAt(x, z, seed)
      if (!f) continue
      const y = probe(x, z)
      if (y < 0) continue
      out.push({ x, y, z, kind: f.kind, variant: f.variant })
    }
    cache.set(k, out)
    return out
  }

  return {
    group,
    sync(cols, seed, probe) {
      let nT = 0, nL = 0, nF = 0
      for (const c of cols) {
        for (const s of spotsFor(c.key, c.x0, c.z0, seed, probe)) {
          // Deterministic per-spot jitter off the variant roll: offset within the cell, a turn,
          // a little size. Same spot, same blades, forever.
          const jx = (s.variant * 7.13) % 1 - 0.5, jz = (s.variant * 3.71) % 1 - 0.5
          // Base sits a shade BELOW the surface top: a root emerging from the ground plane hides
          // any single-texel alpha seam; a root exactly ON it re-manufactures the hover.
          off.set(s.x + 0.5 + jx * 0.3, s.y + 0.97, s.z + 0.5 + jz * 0.3)
          quat.setFromAxisAngle(Y_AXIS, s.variant * Math.PI * 2)
          const grow = 0.75 + s.variant * 0.5
          scl.set(1, grow, 1)
          mtx.compose(off, quat, scl)
          if (s.kind === FLORA.TUFT) { if (nT < CAP.tuft) tufts.setMatrixAt(nT++, mtx) }
          else if (s.kind === FLORA.TALL) { if (nL < CAP.tall) talls.setMatrixAt(nL++, mtx) }
          else if (nF < CAP.flower) {
            stems.setMatrixAt(nF, mtx)
            heads.setMatrixAt(nF, mtx)
            heads.setColorAt(nF, tint.set(HEAD_TINTS[Math.floor(s.variant * 977) % HEAD_TINTS.length]))
            nF++
          }
        }
      }
      tufts.count = nT; talls.count = nL; stems.count = nF; heads.count = nF
      tufts.instanceMatrix.needsUpdate = true
      talls.instanceMatrix.needsUpdate = true
      stems.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true
      // Evicted columns fall out of `cols`, so their spots simply stop being written; drop their
      // cache too or a long walk grows it forever.
      if (cache.size > cols.length * 2 + 64) {
        const live = new Set(cols.map(c => c.key))
        for (const k of [...cache.keys()]) if (!live.has(k)) cache.delete(k)
      }
    },
    invalidate(colKey) { cache.delete(colKey) },
    tick(elapsed) { uTime.value = elapsed },
    dispose() {
      tuftGeo.dispose(); tallGeo.dispose(); stemGeo.dispose(); headGeo.dispose()
      tuftMat.dispose(); tallMat.dispose(); stemMat.dispose(); headMat.dispose()
      bladeTex.dispose(); tallTex.dispose(); headTex.dispose()
    },
  }
}
