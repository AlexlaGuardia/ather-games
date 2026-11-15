'use client'
// PRUNING, SEEN (Alex 11-15: "set up the forestry animation, just being able to click a tree from about 10 blocks out and
// use mana to prune a tree from a distance and then the tree could drop a few logs and a small chance for a sapling").
//
//   AIM     — a ray from the eye through the crosshair, against every tree near the keeper (trunk as a cylinder, crown as
//             an ellipsoid, crownOf in forestry.ts, the SAME numbers the scene draws). The hit tree wears a gold ring.
//   CHANNEL — mana runs from the blade in your hand to the crown as a stream of motes (canon: a focus channels, the light
//             cuts, nothing is swung), the crown shivers (wilds-scene sways it), leaves come down.
//   DROPS   — when the cut lands: the logs (and a sapling, if one fell) pop out of the crown, fall, settle a breath on the
//             ground, then fly to the keeper. The bag already has them (forestry.ts paid at the cut); this is the arrival.
//
// Everything here is look. The rules (range, mana, gates, payout) are forestry.ts; the page wires the click.

import { useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Tree } from './wilds'
import type { WildsWorld } from './wilds-world'
import { crownOf, TRUNK, PRUNE_RANGE } from './forestry'

export interface Aim { tree: Tree | null; dist: number }
export interface ForestryFx {
  /** Run the channel at `tree`; `cut()` is called when the light lands and returns what fell (ids and counts). */
  start(tree: Tree, cut: () => { id: string; n: number }[], arrived: () => void): boolean
  busy(): boolean
}
export const CHANNEL_MS = 900
const MOTES = 16, LEAVES = 14, MAX_DROPS = 8

/** Ray (origin o, unit dir d) against a vertical cylinder at (cx, cz) radius r between y0..y1: the distance, or Infinity. */
function rayCyl(o: THREE.Vector3, d: THREE.Vector3, cx: number, cz: number, r: number, y0: number, y1: number): number {
  const ox = o.x - cx, oz = o.z - cz, a = d.x * d.x + d.z * d.z
  if (a < 1e-9) return Infinity
  const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r, disc = b * b - 4 * a * c
  if (disc < 0) return Infinity
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t < 0) return Infinity
  const y = o.y + d.y * t
  return y >= y0 && y <= y1 ? t : Infinity
}
/** Ray against an axis-aligned ellipsoid (centre c, radii rx, ry, rx): the near distance, or Infinity. */
function rayEll(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, rx: number, ry: number): number {
  const ox = (o.x - cx) / rx, oy = (o.y - cy) / ry, oz = (o.z - cz) / rx, dx = d.x / rx, dy = d.y / ry, dz = d.z / rx
  const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), c = ox * ox + oy * oy + oz * oz - 1, disc = b * b - 4 * a * c
  if (disc < 0) return Infinity
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  return t >= 0 ? t : Infinity
}

const DROP_LOOK: Record<string, { color: string; sapling: boolean }> = {
  goldwood_log: { color: '#b88a4e', sapling: false }, shimmeroak_log: { color: '#7a5636', sapling: false },
  starwillow_log: { color: '#cdb27a', sapling: false }, dawnwood_log: { color: '#9a5e2e', sapling: false },
}
interface Drop { p: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler; phase: 'fly' | 'rest' | 'home'; t: number; from?: THREE.Vector3; sapling: boolean; color: THREE.Color }

export function ForestryFX({ ww, aim, fx, ground }: {
  ww: WildsWorld
  aim: MutableRefObject<Aim>
  fx: MutableRefObject<ForestryFx | null>
  ground: (x: number, z: number) => number
}) {
  const { camera } = useThree()
  const ring = useRef<THREE.Mesh>(null), motes = useRef<THREE.InstancedMesh>(null), leaves = useRef<THREE.InstancedMesh>(null)
  const logs = useRef<THREE.InstancedMesh>(null), saps = useRef<THREE.InstancedMesh>(null)
  const ch = useRef<{ tree: Tree; t0: number; cut: () => { id: string; n: number }[]; arrived: () => void; done: boolean } | null>(null)
  const drops = useRef<Drop[]>([]), arrivedCb = useRef<(() => void) | null>(null)
  const lf = useRef<{ p: THREE.Vector3; v: THREE.Vector3; t: number }[]>([])
  const tmp = useRef({ o: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Euler() })

  fx.current = {
    busy: () => !!ch.current && !ch.current.done,
    start(tree, cut, arrived) {
      if (ch.current && !ch.current.done) return false
      ch.current = { tree, t0: performance.now(), cut, arrived, done: false }
      return true
    },
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), T = tmp.current, now = performance.now()
    // ── aim: the nearest tree under the crosshair, within reach of the keeper
    camera.getWorldPosition(T.o); camera.getWorldDirection(T.d)
    let best: Tree | null = null, bd = Infinity
    for (const t of ww.treesNear(T.o.x, T.o.z, PRUNE_RANGE + 4)) {
      if (Math.hypot(t.x - T.o.x, t.z - T.o.z) > PRUNE_RANGE + TRUNK[t.kind]) continue
      const c = crownOf(t)
      const hit = Math.min(rayCyl(T.o, T.d, t.x, t.z, TRUNK[t.kind] + 0.25, t.y - 0.5, c.cy), rayEll(T.o, T.d, t.x, c.cy, t.z, c.r * 0.95, c.hh * (t.kind === 'starwillow' ? 2 : 1) * 0.95))
      if (hit < bd && hit <= PRUNE_RANGE + 6) { bd = hit; best = t }
    }
    aim.current = { tree: best, dist: bd }
    const shown = ch.current && !ch.current.done ? ch.current.tree : best
    if (ring.current) {
      ring.current.visible = !!shown
      if (shown) { ring.current.position.set(shown.x, shown.y + 0.08, shown.z); const k = 1 + Math.sin(now / 180) * 0.06; ring.current.scale.set(k * (TRUNK[shown.kind] + 0.9), k * (TRUNK[shown.kind] + 0.9), 1) }
    }

    // ── the channel: motes from the blade (low right of the eye) to the crown
    const c = ch.current, mm = motes.current
    if (mm) {
      mm.count = 0
      if (c && !c.done) {
        const u = (now - c.t0) / CHANNEL_MS, cr = crownOf(c.tree)
        const right = new THREE.Vector3().crossVectors(T.d, camera.up).normalize()
        const from = T.o.clone().addScaledVector(T.d, 0.7).addScaledVector(right, 0.28).add(new THREE.Vector3(0, -0.32, 0))
        const to = new THREE.Vector3(c.tree.x, cr.cy - cr.hh * 0.4, c.tree.z)
        for (let i = 0; i < MOTES; i++) {
          const f = ((i / MOTES) + u * 1.8) % 1, lift = Math.sin(f * Math.PI) * 0.6
          T.p.lerpVectors(from, to, f).add(new THREE.Vector3(Math.sin(i * 2.1 + now / 90) * 0.08, lift + Math.cos(i * 1.7 + now / 110) * 0.08, 0))
          const sc = 0.07 + 0.05 * Math.sin(f * Math.PI)
          mm.setMatrixAt(i, T.m.compose(T.p, T.q.setFromEuler(T.e.set(now / 200 + i, now / 300, 0)), T.s.set(sc, sc, sc)))
        }
        mm.count = MOTES; mm.instanceMatrix.needsUpdate = true
        // leaves start to come down as the light bites
        if (lf.current.length < LEAVES && Math.random() < 0.35) lf.current.push({ p: new THREE.Vector3(c.tree.x + (Math.random() - 0.5) * cr.r * 1.4, cr.cy - cr.hh * 0.3, c.tree.z + (Math.random() - 0.5) * cr.r * 1.4), v: new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.4 - Math.random() * 0.6, (Math.random() - 0.5) * 0.6), t: 0 })
        if (u >= 1) {
          c.done = true
          // the cut: what fell comes out of the crown
          const got = c.cut(), cr2 = crownOf(c.tree)
          arrivedCb.current = c.arrived
          for (const g of got) {
            const look = DROP_LOOK[g.id], sapling = !look
            for (let n = 0; n < g.n && drops.current.length < MAX_DROPS; n++) {
              const a = Math.random() * Math.PI * 2, out = 1.2 + Math.random() * 1.6
              drops.current.push({
                p: new THREE.Vector3(c.tree.x, cr2.cy - cr2.hh * 0.6, c.tree.z), v: new THREE.Vector3(Math.cos(a) * out, 2.2 + Math.random() * 1.6, Math.sin(a) * out),
                spin: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3), rot: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
                phase: 'fly', t: 0, sapling, color: new THREE.Color(sapling ? '#7fbf5a' : look.color),
              })
            }
          }
          if (!got.length) c.arrived()
        }
      }
    }

    // ── leaves: flutter down, gone after a few seconds
    const lm = leaves.current
    if (lm) {
      lf.current = lf.current.filter(l => (l.t += dt) < 3.2)
      lf.current.forEach((l, i) => {
        l.p.addScaledVector(l.v, dt); l.p.x += Math.sin(l.t * 5 + i) * dt * 0.6
        const g = ground(l.p.x, l.p.z); if (Number.isFinite(g) && l.p.y < g + 0.05) { l.p.y = g + 0.05; l.v.set(0, 0, 0) }
        lm.setMatrixAt(i, T.m.compose(l.p, T.q.setFromEuler(T.e.set(l.t * 3 + i, l.t * 2, i)), T.s.set(0.18, 0.02, 0.12)))
      })
      lm.count = lf.current.length; lm.instanceMatrix.needsUpdate = true
    }

    // ── drops: arc out, land, rest a breath, fly home
    const keeper = T.o.clone().add(new THREE.Vector3(0, -0.7, 0))
    for (const d of drops.current) {
      d.t += dt
      if (d.phase === 'fly') {
        d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt)
        d.rot.x += d.spin.x * dt; d.rot.y += d.spin.y * dt; d.rot.z += d.spin.z * dt
        const g = ground(d.p.x, d.p.z)
        if (Number.isFinite(g) && d.p.y <= g + 0.14 && d.v.y < 0) { d.p.y = g + 0.14; d.phase = 'rest'; d.t = 0; d.rot.set(d.sapling ? 0 : Math.PI / 2, d.rot.y, 0) }
      } else if (d.phase === 'rest') {
        if (d.t > 0.55) { d.phase = 'home'; d.t = 0; d.from = d.p.clone() }
      } else if (d.from) {
        const u = Math.min(1, d.t / 0.45), e = u * u * (3 - 2 * u)
        d.p.lerpVectors(d.from, keeper, e).y += Math.sin(u * Math.PI) * 0.9
      }
    }
    const before = drops.current.length
    drops.current = drops.current.filter(d => !(d.phase === 'home' && d.t >= 0.45))
    if (before && !drops.current.length && arrivedCb.current) { arrivedCb.current(); arrivedCb.current = null }
    const lg = logs.current, sp = saps.current
    if (lg && sp) {
      let nl = 0, ns = 0
      for (const d of drops.current) {
        const shrink = d.phase === 'home' ? 1 - Math.min(1, d.t / 0.45) * 0.6 : 1
        T.q.setFromEuler(d.rot)
        if (d.sapling) { sp.setMatrixAt(ns, T.m.compose(d.p, T.q, T.s.set(shrink, shrink, shrink))); sp.setColorAt(ns, d.color); ns++ }
        else { lg.setMatrixAt(nl, T.m.compose(d.p, T.q, T.s.set(shrink, shrink, shrink))); lg.setColorAt(nl, d.color); nl++ }
      }
      lg.count = nl; sp.count = ns
      lg.instanceMatrix.needsUpdate = true; sp.instanceMatrix.needsUpdate = true
      if (lg.instanceColor) lg.instanceColor.needsUpdate = true
      if (sp.instanceColor) sp.instanceColor.needsUpdate = true
    }
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.82, 1, 32]} /><meshBasicMaterial color="#f3dc8a" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <instancedMesh ref={motes} args={[undefined, undefined, MOTES]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#f6e7a6" />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, LEAVES]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} /><meshLambertMaterial color="#c9c25e" />
      </instancedMesh>
      <instancedMesh ref={logs} args={[undefined, undefined, MAX_DROPS]} frustumCulled={false}>
        <cylinderGeometry args={[0.11, 0.11, 0.55, 7]} /><meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={saps} args={[undefined, undefined, 2]} frustumCulled={false}>
        <coneGeometry args={[0.16, 0.42, 6]} /><meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  )
}
