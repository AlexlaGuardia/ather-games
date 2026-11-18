'use client'

// The path network, drawn (network.ts says where): a worn path ribbon over each loaded tile, the generated free-Moglin
// settlements (DUG, never built: canon, "free Moglins dig"; Tuckbank is tucked into a bank), and THE THISTLEDOWN FAIR's
// big top (RULED 11-17: a travelling fair of free Moglins; the tent's look is build, thistle purple and down-white).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Wilds } from './wilds'
import { pathsIn, PATH_W, fairDoor, FAIR_NAME, SEASON, type Network, type Settlement, type Fair } from './network'
import { folkOf, stillHome } from './settlement-folk'
import { loadVillage } from './moglins'
import { folkSpots, type Spot } from './folk-spots'
import { setMapSettlements } from './tile-picture'
import { MoglinModel, furOf } from '../shared/moglin-model'

// ── the paths ────────────────────────────────────────────────────────────────────────────────────────────────────
const PATH_COLOUR = new THREE.Color('#c8b285'), PATH_EDGE = new THREE.Color('#a99467')
/** One tile's path pieces as a ribbon draped on the ground, in the TILE's local frame (it sits in the tile's group). */
export function TilePaths({ net, W, off }: { net: Network; W: Wilds; off: { x: number; z: number } }) {
  const geo = useMemo(() => {
    const hx = W.meta.sizeX / 2, hz = W.meta.sizeZ / 2
    const lines = pathsIn(net, off.x - hx, off.z - hz, off.x + hx, off.z + hz, 2)
    if (!lines.length) return null
    const pos: number[] = [], col: number[] = [], idx: number[] = []
    for (const L of lines) {
      const base = pos.length / 3
      for (let k = 0; k < L.length; k++) {
        const [x, z] = L[k], [px, pz] = L[Math.max(0, k - 1)], [nx, nz] = L[Math.min(L.length - 1, k + 1)]
        let tx = nx - px, tz = nz - pz; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l
        const w = PATH_W / 2 * (0.9 + 0.2 * Math.sin(k * 0.37))   // a worn path wanders in width
        for (const side of [-1, 1]) {
          const lx = x - off.x - tz * w * side, lz = z - off.z + tx * w * side
          pos.push(lx, W.heightAt(lx, lz) + 0.06, lz)
          const c = side < 0 ? PATH_EDGE : PATH_COLOUR; col.push(c.r, c.g, c.b)
        }
        if (k) { const a = base + (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx); g.computeVertexNormals()
    return g
  }, [net, W, off.x, off.z])
  if (!geo) return null
  return <mesh geometry={geo}><meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} side={THREE.DoubleSide} /></mesh>
}

// ── a settlement: a grassy knoll dug with round doors, a well, a signpost, lanterns ────────────────────────────────
const h01 = (s: string, k: number) => { let h = 2166136261 ^ k; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000 }
function SettlementModel({ s, y }: { s: Settlement; y: number }) {
  const doors = 3 + Math.floor(h01(s.id, 1) * 3), turn = h01(s.id, 2) * Math.PI * 2
  return (
    <group position={[s.x, y, s.z]} rotation-y={turn}>
      {/* the knoll the folk dug into */}
      <mesh position={[0, -1.2, -6]} scale={[11, 5.2, 8]}><sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#7fae5a" flatShading /></mesh>
      {Array.from({ length: doors }, (_, k) => {
        const a = -0.9 + (k / Math.max(1, doors - 1)) * 1.8, dx = Math.sin(a) * 10.4, dz = -6 + Math.cos(a) * 7.2
        return (
          <group key={k} position={[dx, 0.05, dz]} rotation-y={a}>
            <mesh position={[0, 1.05, 0.05]}><circleGeometry args={[1.05, 16]} /><meshLambertMaterial color="#5a3d26" /></mesh>
            <mesh position={[0, 1.05, 0.02]}><ringGeometry args={[1.05, 1.32, 16]} /><meshLambertMaterial color="#a48a64" /></mesh>
            <mesh position={[0.55, 1.0, 0.12]}><sphereGeometry args={[0.07, 6, 5]} /><meshBasicMaterial color="#f4d58a" /></mesh>
            <mesh position={[1.7, 0.9, 0.6]}><cylinderGeometry args={[0.05, 0.05, 1.8, 5]} /><meshLambertMaterial color="#6b4a30" /></mesh>
            <mesh position={[1.7, 1.9, 0.6]}><sphereGeometry args={[0.2, 8, 6]} /><meshLambertMaterial color="#ffe6a6" emissive="#ffcf6a" emissiveIntensity={0.9} /></mesh>
          </group>
        )
      })}
      {/* the well in the green before the doors */}
      <group position={[0, 0, 5]}>
        <mesh position-y={0.45}><cylinderGeometry args={[1.1, 1.2, 0.9, 12, 1, true]} /><meshLambertMaterial color="#9c9384" side={THREE.DoubleSide} flatShading /></mesh>
        <mesh position-y={0.3}><circleGeometry args={[1.05, 12]} /><meshLambertMaterial color="#3d5a6e" /></mesh>
        {[-1, 1].map(side => <mesh key={side} position={[side * 1.05, 1.3, 0]}><boxGeometry args={[0.14, 1.8, 0.14]} /><meshLambertMaterial color="#6b4a30" /></mesh>)}
        <mesh position-y={2.25} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 2.3, 6]} /><meshLambertMaterial color="#6b4a30" /></mesh>
      </group>
      {/* the signpost: the place's name is spoken on the message line as you walk in */}
      <group position={[7, 0, 10]} rotation-y={-turn}>
        <mesh position-y={1.1}><cylinderGeometry args={[0.08, 0.1, 2.2, 6]} /><meshLambertMaterial color="#6b4a30" /></mesh>
        <mesh position={[0, 1.85, 0.1]}><boxGeometry args={[1.6, 0.45, 0.08]} /><meshLambertMaterial color="#b89a6a" /></mesh>
      </group>
    </group>
  )
}
export function Settlements({ net, loaded }: { net: Network; loaded: (x: number, z: number) => number | null }) {
  return <>
    {net.settlements.map(s => { const y = loaded(s.x, s.z); return y === null ? null : <SettlementModel key={s.id} s={s} y={y} /> })}
    <SettlementFolk net={net} loaded={loaded} />
  </>
}

// ── THE FOLK, standing in their settlements (BETA M19, Alex 11-18) ───────────────────────────────────────────────────
/** where the keeper is (the first-person camera), for the talk's "nearest Moglin" (use-folk-talk.tsx); written each frame */
export const keeperNow = { x: 0, z: 0 }
/** settlements within this of the keeper mount their Moglins; the rest draw no rigs (11 x 5 never all live) */
export const FOLK_DRAW_R = 110
/** the Moglins drawn right now, world spots (checks + the talk read it): settlement id -> its home folk's spots */
export const folkDrawn = new Map<string, Spot[]>()

function SettlementFolk({ net, loaded }: { net: Network; loaded: (x: number, z: number) => number | null }) {
  useEffect(() => { setMapSettlements(net.settlements) }, [net])   // the maps draw them (tile-picture.ts)
  const [near, setNear] = useState<string[]>([])
  const [villageRev, setVillageRev] = useState(0)
  const acc = useRef(0)
  useFrame(({ camera }, dt) => {
    keeperNow.x = camera.position.x; keeperNow.z = camera.position.z
    acc.current += dt; if (acc.current < 1) return
    acc.current = 0
    const ids = net.settlements.filter(s => Math.hypot(s.x - camera.position.x, s.z - camera.position.z) < FOLK_DRAW_R && loaded(s.x, s.z) !== null).map(s => s.id)
    setNear(cur => (cur.join() === ids.join() ? cur : ids))
    setVillageRev(v => v + 1)   // a recruit happens in the talk: re-read who is still home once a second
  })
  const village = useMemo(() => loadVillage(), [villageRev])   // eslint-disable-line react-hooks/exhaustive-deps
  const drawn = useMemo(() => {
    const out: { s: Settlement; spots: Spot[] }[] = []
    for (const id of near) {
      const s = net.settlements.find(x => x.id === id); if (!s) continue
      const all = folkOf(s, SEASON), home = new Set(stillHome(all, village).map(f => f.id))
      out.push({ s, spots: folkSpots(s, all.map(f => f.id)).filter(p => home.has(p.id)) })   // laid out over ALL, so a recruit never shuffles the rest
    }
    return out
  }, [near, net, village])
  const key = drawn.map(d => `${d.s.id}:${d.spots.map(p => p.id).join('.')}`).join('|')
  useEffect(() => {
    folkDrawn.clear(); for (const d of drawn) folkDrawn.set(d.s.id, d.spots)
    ;(window as unknown as { __folk?: unknown }).__folk = { drawn: () => Object.fromEntries(folkDrawn), keeper: () => ({ ...keeperNow }), mapSettlements: () => net.settlements.length }
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps
  return <>{drawn.flatMap(d => d.spots.map((p, k) => {
    const y = loaded(p.x, p.z)   // the ground's height HERE, asked at draw (M18 reshapes ground near paths)
    return y === null ? null : (
      <group key={p.id} position={[p.x, y, p.z]} rotation-y={p.yaw}>
        <MoglinModel build="chibi" action="idle" tone={furOf(p.id)} seed={k * 1.7 + d.s.x * 0.01} />
      </group>
    )
  }))}</>
}

// ── the big top ──────────────────────────────────────────────────────────────────────────────────────────────────
const THISTLE = new THREE.Color('#8a5aa8'), DOWN = new THREE.Color('#f3ecdf')
/** striped by panel: a cone or a cylinder whose faces alternate thistle and down */
function striped(geo: THREE.BufferGeometry, panels: number): THREE.BufferGeometry {
  const g = geo.toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
    const k = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * panels) % 2, c = k ? THISTLE : DOWN
    for (let v = 0; v < 3; v++) col.set([c.r, c.g, c.b], (i + v) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals()
  return g
}
function Tent({ r, wall, peak, panels = 24 }: { r: number; wall: number; peak: number; panels?: number }) {
  const g = useMemo(() => ({
    wall: striped(new THREE.CylinderGeometry(r, r, wall, panels * 2, 1, true), panels),
    roof: striped(new THREE.ConeGeometry(r * 1.08, peak - wall, panels * 2, 1, true), panels),
  }), [r, wall, peak, panels])
  return (
    <group>
      <mesh geometry={g.wall} position-y={wall / 2}><meshLambertMaterial vertexColors side={THREE.DoubleSide} /></mesh>
      <mesh geometry={g.roof} position-y={wall + (peak - wall) / 2}><meshLambertMaterial vertexColors side={THREE.DoubleSide} /></mesh>
      <mesh position-y={peak + 1.4}><cylinderGeometry args={[0.12, 0.12, 2.8, 6]} /><meshLambertMaterial color="#6b4a30" /></mesh>
      <mesh position={[0.8, peak + 2.3, 0]}><planeGeometry args={[1.6, 0.8]} /><meshLambertMaterial color="#c9a2e0" side={THREE.DoubleSide} /></mesh>
    </group>
  )
}
export function BigTop({ fair, y }: { fair: Fair; y: number }) {
  const bunting = useMemo(() => Array.from({ length: 16 }, (_, k) => k), [])
  const d = fairDoor(fair)
  return (
    <group>
      <group position={[fair.x, y, fair.z]} rotation-y={fair.yaw}>
        <Tent r={13} wall={5.5} peak={15} />
        {/* the door: a dark mouth under a striped awning, facing the path */}
        <mesh position={[0, 2.2, 13.05]}><planeGeometry args={[4.2, 4.4]} /><meshBasicMaterial color="#2a1f2e" /></mesh>
        <mesh position={[0, 4.7, 14.2]} rotation-x={-0.5}><planeGeometry args={[5.4, 2.6]} /><meshLambertMaterial color="#8a5aa8" side={THREE.DoubleSide} /></mesh>
        {/* two small tents: the trader's stall (canon: the 08-13 trader rides with the fair) and the troupe's */}
        <group position={[-19, 0, 4]}><Tent r={4} wall={2.4} peak={6.5} panels={10} /></group>
        <group position={[18, 0, -3]}><Tent r={4.5} wall={2.6} peak={7} panels={10} /></group>
        {/* bunting from the peak out to six stakes */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2 + 0.3, sx = Math.sin(a) * 24, sz = Math.cos(a) * 24
          return (
            <group key={i}>
              <mesh position={[sx, 1.5, sz]}><cylinderGeometry args={[0.08, 0.1, 3, 5]} /><meshLambertMaterial color="#6b4a30" /></mesh>
              {bunting.map(k => {
                const t = (k + 0.5) / bunting.length, px = sx * t, pz = sz * t, py = 15 + (3 - 15) * t - Math.sin(t * Math.PI) * 2.2
                return <mesh key={k} position={[px, py - 0.25, pz]} rotation-y={a}><coneGeometry args={[0.32, 0.55, 3]} /><meshLambertMaterial color={k % 3 === 0 ? '#e7c766' : k % 3 === 1 ? '#8a5aa8' : '#f3ecdf'} /></mesh>
              })}
            </group>
          )
        })}
      </group>
      {/* lanterns either side of the door's walk */}
      {[-1, 1].map(side => (
        <group key={side} position={[d.x + Math.cos(fair.yaw) * 3.2 * side, y, d.z - Math.sin(fair.yaw) * 3.2 * side]}>
          <mesh position-y={1.2}><cylinderGeometry args={[0.06, 0.06, 2.4, 5]} /><meshLambertMaterial color="#6b4a30" /></mesh>
          <mesh position-y={2.5}><sphereGeometry args={[0.24, 8, 6]} /><meshLambertMaterial color="#ffe6a6" emissive="#ffcf6a" emissiveIntensity={1} /></mesh>
        </group>
      ))}
    </group>
  )
}
export { FAIR_NAME }
