'use client'
// GROUND LOOT, SEEN AND PICKED UP (BETA M141 s1). Rules + save: ground-loot.ts. Within LOOT_PULL_M a drop that fits is claimed, flies
// to the keeper and is paid into the bag on arrival; one that does not fit stays, and the bag says so once per walk-up.
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getInv, setInv } from '../shared/bag'
import { give, itemDef } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { play as sfx } from '../shared/sfx'
import { CRYSTAL_ITEM, type CrystalKind } from './prospecting'
import { CRYSTAL_LOOK } from './crystal-nodes'
import { claimLoot, inPull, lootNow, payLoot, releaseLoot, type Loot, type Spot3 } from './ground-loot'

const ME = 'keeper', FLY_S = 0.4, FALL_MS = 450, SAY_S = 0.9, MAX = 48, SEE_M = 70
export const LOOT_FULL = 'Your bag is full.'   // the wording the bag already uses (melee-view, shipyard-plot)
const LOGS: Record<string, string> = { goldwood_log: '#b88a4e', shimmeroak_log: '#7a5636', starwillow_log: '#cdb27a', dawnwood_log: '#9a5e2e' }
const SHARD: Record<string, string> = Object.fromEntries(Object.entries(CRYSTAL_ITEM).map(([k, id]) => [id, CRYSTAL_LOOK[k as Exclude<CrystalKind, 'egg'>].color]))
/** which shape, which colour: a log, a gem, or a small lump (sapling, mast, blankstone, what a perk found) */
const lookOf = (id: string): { m: 0 | 1 | 2; c: string } => LOGS[id] ? { m: 0, c: LOGS[id] } : SHARD[id] ? { m: 1, c: SHARD[id] } : { m: 2, c: id.endsWith('_sapling') ? '#7fbf5a' : id === 'mast' ? '#8a5a34' : id === 'blankstone' ? '#a7a39b' : '#d9b65c' }
const fits = (d: Loot) => give(getInv(), d.item, 1).left === 0

export function GroundLoot({ keeper, ground, can }: {
  /** the keeper's feet */
  keeper: () => Spot3
  ground: (x: number, z: number) => number
  /** false while they cannot pick up (down, falling, travelling) */
  can: () => boolean
}) {
  const meshes = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)]
  const fly = useRef(new Map<string, { t: number; x: number; y: number; z: number }>())
  const full = useRef(false), got = useRef(new Map<string, number>()), gotT = useRef(0)
  const T = useRef({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() })
  const drop = () => { for (const id of fly.current.keys()) releaseLoot(id, ME); fly.current.clear() }
  useEffect(() => {
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), loot: () => lootNow().map(d => ({ ...d })) }   // checks: READ only
    const f = fly.current
    return () => { for (const id of f.keys()) releaseLoot(id, ME); f.clear() }   // left the Wilds mid-flight: it is on the ground
  }, [])
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.1, dtRaw), now = Date.now(), all = lootNow(now), f = keeper(), tm = T.current
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
      hudSay([...got.current].map(([id, n]) => `${n > 1 ? n + ' × ' : ''}${itemDef(id).name}`).join(' · '), 'info'); got.current.clear()
    }
    const count = [0, 0, 0], t = now / 1000
    for (const d of all) {
      const L = lookOf(d.item), mesh = meshes[L.m].current
      if (!mesh || count[L.m] >= MAX || Math.abs(d.x - f.x) > SEE_M || Math.abs(d.z - f.z) > SEE_M) continue
      const g = ground(d.x, d.z), y = Number.isFinite(g) ? g : d.y, w = fly.current.get(d.id), k = (d.x * 7 + d.z * 13) % 6.28
      const fall = Math.max(0, 1 - (now - d.at) / FALL_MS)
      tm.p.set(d.x, y + 0.3 + Math.sin(t * 2 + k) * 0.05 + 2.2 * (1 - (1 - fall) * (1 - fall)), d.z)
      let s = 1
      if (w) { const u = Math.min(1, w.t / FLY_S), e = u * u; tm.p.lerp(tm.s.set(f.x, f.y + 0.9, f.z), e); tm.p.y += Math.sin(u * Math.PI) * 0.4; s = 1 - 0.5 * e }
      mesh.setMatrixAt(count[L.m], tm.m.compose(tm.p, tm.q.setFromEuler(tm.e.set(L.m === 0 ? 1.25 : 0.2, t * 0.8 + k, 0)), tm.s.set(s, s * (L.m === 1 ? 1.6 : 1), s)))
      mesh.setColorAt(count[L.m], tm.c.set(L.c)); count[L.m]++
    }
    meshes.forEach((r, i) => { const m = r.current; if (!m) return; m.count = count[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true })
  })
  return (
    <>
      <instancedMesh ref={meshes[0]} args={[undefined, undefined, MAX]} frustumCulled={false}><cylinderGeometry args={[0.11, 0.11, 0.5, 7]} /><meshLambertMaterial flatShading /></instancedMesh>
      <instancedMesh ref={meshes[1]} args={[undefined, undefined, MAX]} frustumCulled={false}><octahedronGeometry args={[0.17, 0]} /><meshLambertMaterial emissive="#555566" flatShading /></instancedMesh>
      <instancedMesh ref={meshes[2]} args={[undefined, undefined, MAX]} frustumCulled={false}><dodecahedronGeometry args={[0.15, 0]} /><meshLambertMaterial flatShading /></instancedMesh>
    </>
  )
}
