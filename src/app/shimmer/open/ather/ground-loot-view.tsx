'use client'
// GROUND LOOT, SEEN AND PICKED UP (BETA M141 s1). Rules + save: ground-loot.ts. Within LOOT_PULL_M a drop that fits is claimed, flies
// to the keeper and is paid into the bag on arrival; one that does not fit stays, and the bag says so once per walk-up.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getInv, setInv } from '../shared/bag'
import { give, itemDef } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { play as sfx } from '../shared/sfx'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DEWL, DEWL_FIRST, markFirstDewl } from './dewl'
import { CRYSTAL_ITEM, type CrystalKind } from './prospecting'
import { CRYSTAL_LOOK } from './crystal-nodes'
import { claimLoot, inPull, lootNow, payLoot, releaseLoot, type Loot, type LootPlace, type Spot3 } from './ground-loot'

const ME = 'keeper', FLY_S = 0.4, FALL_MS = 450, SAY_S = 0.9, MAX = 48, SEE_M = 70
export const LOOT_FULL = 'Your bag is full.'   // the wording the bag already uses (melee-view, shipyard-plot)
const LOGS: Record<string, string> = { goldwood_log: '#b88a4e', shimmeroak_log: '#7a5636', starwillow_log: '#cdb27a', dawnwood_log: '#9a5e2e' }
const SHARD: Record<string, string> = Object.fromEntries(Object.entries(CRYSTAL_ITEM).map(([k, id]) => [id, CRYSTAL_LOOK[k as Exclude<CrystalKind, 'egg'>].color]))
/** which shape, which colour: a log, a gem, or a small lump (sapling, mast, blankstone, what a perk found) */
const lookOf = (id: string): { m: 0 | 1 | 2 | 3; c: string } => id === DEWL ? { m: 3, c: '#4fc3ee' } : LOGS[id] ? { m: 0, c: LOGS[id] } : SHARD[id] ? { m: 1, c: SHARD[id] } : { m: 2, c: id.endsWith('_sapling') ? '#7fbf5a' : id === 'mast' ? '#8a5a34' : id === 'blankstone' ? '#a7a39b' : '#d9b65c' }
// M159: a dewl (look LOCKED by Alex 11-25): a blue faceted teardrop, tiny bubbles inside. Drawn here in code.
const tear = () => new THREE.LatheGeometry([[0, -0.15], [0.07, -0.135], [0.125, -0.07], [0.135, -0.01], [0.1, 0.075], [0.045, 0.17], [0, 0.24]].map(([r, y]) => new THREE.Vector2(r, y)), 8)
const bubbles = () => mergeGeometries([[0.03, -0.05, 0.05, 0.016], [-0.05, 0.02, 0.03, 0.011], [0.01, 0.08, -0.03, 0.009], [-0.02, -0.08, -0.05, 0.013], [0.06, 0.03, -0.04, 0.009], [-0.06, -0.03, -0.02, 0.008]].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 0).translate(x, y, z)))
const fits = (d: Loot) => give(getInv(), d.item, 1).left === 0

export function GroundLoot({ keeper, ground, can, place = 'wilds' }: {
  /** M153 s1b: which list lies here */
  place?: LootPlace
  /** the keeper's feet */
  keeper: () => Spot3
  ground: (x: number, z: number) => number
  /** false while they cannot pick up (down, falling, travelling) */
  can: () => boolean
}) {
  const meshes = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)], inner = useRef<THREE.InstancedMesh>(null)
  const dewlGeo = useMemo(() => [tear(), bubbles()], []); useEffect(() => () => dewlGeo.forEach(g => g?.dispose()), [dewlGeo])
  const fly = useRef(new Map<string, { t: number; x: number; y: number; z: number }>())
  const full = useRef(false), got = useRef(new Map<string, number>()), gotT = useRef(0)
  const T = useRef({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() })
  const drop = () => { for (const id of fly.current.keys()) releaseLoot(id, ME); fly.current.clear() }
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), loot: () => lootNow(Date.now(), place).map(d => ({ ...d })) }   // checks: READ only
    const f = fly.current
    return () => { for (const id of f.keys()) releaseLoot(id, ME); f.clear() }   // left the Wilds mid-flight: it is on the ground
  }, [place])
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.1, dtRaw), now = Date.now(), all = lootNow(now, place), f = keeper(), tm = T.current
    if (!can()) drop()
    else {
      let blocked = false
      for (const d of all) {
        if (fly.current.has(d.id) || !inPull(d, f, now)) continue
        if (!fits(d)) { blocked = true; continue }
        if (claimLoot(d.id, ME)) fly.current.set(d.id, { t: 0, x: d.x, y: d.y, z: d.z })
      }
      if (blocked && !full.current) { full.current = true; hudSay(LOOT_FULL, 'info') }
      if (!blocked) full.current = false
      for (const [id, w] of fly.current) {
        w.t += dt; if (w.t < FLY_S) continue
        fly.current.delete(id)
        const r = payLoot(id, ME, (item, n) => { const g = give(getInv(), item, n); if (g.left < n) setInv(g.inv); return g.left }, now)
        if (r && r.got > 0) { sfx('pickup-item'); got.current.set(r.item, (got.current.get(r.item) ?? 0) + r.got); gotT.current = SAY_S }
      }
    }
    if (got.current.size && (gotT.current -= dt) <= 0) {   // one line for what came together
      hudSay([...got.current].map(([id, n]) => `${n > 1 ? n + ' × ' : ''}${itemDef(id).name}`).join(' · '), 'info'); if (got.current.has(DEWL)) { const m = markFirstDewl(getInv()); if (m) { setInv(m); hudSay(DEWL_FIRST, 'info', 6) } }   // M159: once ever
      got.current.clear()
    }
    const count = [0, 0, 0, 0], t = now / 1000
    for (const d of all) {
      const L = lookOf(d.item), mesh = meshes[L.m].current
      if (!mesh || count[L.m] >= MAX || Math.abs(d.x - f.x) > SEE_M || Math.abs(d.z - f.z) > SEE_M) continue
      const g = ground(d.x, d.z), y = Number.isFinite(g) ? g : d.y, w = fly.current.get(d.id), k = (d.x * 7 + d.z * 13) % 6.28
      const fall = Math.max(0, 1 - (now - d.at) / FALL_MS)
      tm.p.set(d.x, y + 0.3 + Math.sin(t * 2 + k) * 0.05 + 2.2 * (1 - (1 - fall) * (1 - fall)), d.z)
      let s = 1
      if (w) { const u = Math.min(1, w.t / FLY_S), e = u * u; tm.p.lerp(tm.s.set(f.x, f.y + 0.9, f.z), e); tm.p.y += Math.sin(u * Math.PI) * 0.4; s = 1 - 0.5 * e }
      mesh.setMatrixAt(count[L.m], tm.m.compose(tm.p, tm.q.setFromEuler(tm.e.set(L.m === 0 ? 1.25 : 0.2, t * 0.8 + k, 0)), tm.s.set(s, s * (L.m === 1 ? 1.6 : 1), s)))
      if (L.m === 3) inner.current?.setMatrixAt(count[3], tm.m)
      mesh.setColorAt(count[L.m], tm.c.set(L.c)); count[L.m]++
    }
    if (inner.current) { inner.current.count = count[3]; inner.current.instanceMatrix.needsUpdate = true }
    meshes.forEach((r, i) => { const m = r.current; if (!m) return; m.count = count[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true })
  })
  return (
    <>
      <instancedMesh ref={meshes[0]} args={[undefined, undefined, MAX]} frustumCulled={false}><cylinderGeometry args={[0.11, 0.11, 0.5, 7]} /><meshLambertMaterial flatShading /></instancedMesh>
      <instancedMesh ref={meshes[1]} args={[undefined, undefined, MAX]} frustumCulled={false}><octahedronGeometry args={[0.17, 0]} /><meshLambertMaterial emissive="#555566" flatShading /></instancedMesh>
      <instancedMesh ref={meshes[2]} args={[undefined, undefined, MAX]} frustumCulled={false}><dodecahedronGeometry args={[0.15, 0]} /><meshLambertMaterial flatShading /></instancedMesh>
      <instancedMesh ref={inner} args={[dewlGeo[1]!, undefined, MAX]} frustumCulled={false}><meshBasicMaterial color="#e9fbff" /></instancedMesh>
      <instancedMesh ref={meshes[3]} args={[dewlGeo[0]!, undefined, MAX]} frustumCulled={false} renderOrder={1}><meshLambertMaterial emissive="#0d4f86" flatShading transparent opacity={0.8} depthWrite={false} /></instancedMesh>
    </>
  )
}
