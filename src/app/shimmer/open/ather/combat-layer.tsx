'use client'

// The Wilds' combat, drawn and driven: reads the camera (the keeper's eye), fires on mouse-down under pointer lock,
// steps combat.ts, and draws Hollows, rounds and grey matter. The rules are in combat.ts; this is the glue.

import { frameStats } from '../shared/keeper-look'
import { getLook } from '../shared/look-store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RANGE_GUNS } from '../shared/gunplay'
import { weaponDef } from '../../engine/weapons'
import { newCombat, stepCombat, applyNetHit, fire, reload, populate, revive, spawnHollow, HEAD_Y, fxOn, SHAMBLER, FLOATER, type Combat, type Terrain, type CombatEvent, type Hollow, type HollowKind } from './combat'
import { live as liveSolids } from './dynamic-solids'
import { runCast, stepFields, stepPieces, channelAim, type ChannelRun, type CastHit } from './combat-casts'
import type { CastSpec } from '../../play3d/cast'
import { touch } from '../shared/touch'
import { wakeChampion, tellOf, CHAMP } from './champion'
import { WAKE_R, STRAY_R, type WildsNode } from './nodes'
import { playShot, playEmpty, playReload } from '../shared/gun-sound'
import { play as sfx } from '../shared/sfx'   // M36 batch 2: Hollow sounds (proposed = silent until Alex's yay)
import { setAmmoFeed } from '../shared/morel'
import { openNet } from '../shared/open-mp'
import { sharing, hostOf, encodeSnap, applySnap, SNAP_KIND, SNAP_HZ, HIT_KIND, KILL_KIND, encodeHits, decodeHits, newDrops, decodeKills, layDrop, type Snap, type HitRow, type KillRow } from '../shared/fight-share'   // BETA M28 shared fights   // M33: Morel's bubble reads the gun straight from here
import { goopMaterial, groundEnv, borrowedGround, greyAt, greyStep, BORROW } from './hollow-goop'
import { sprout, poseSprout, lumpyGeometry } from './hollow-body'   // M34: Alex's pick A, the rooted sprout   // M34: no light of its own; borrows the ground
import { borrowedSky } from '../../voxel3d/sky-env'
import { dayProgress, daylight } from '../../engine/day-cycle'

export interface CombatHud {
  hp: number; maxHp: number; ammo: number; clip: number; reloading: boolean; hurtAt: number; hitAt: number; gun: string
  /** the trigger is held on a drawn gun (BETA M33: Morel's ammo bubble shows while it is) */
  firing?: boolean
  /** The node champion's bars, when one is up: bar 0..2 is the one being worn down. */
  champ: { bar: number; hp: number; barHp: number; bars: number; open: boolean } | null
}

/** Seconds after the layer goes active before a champion may wake (the camera catches up to the walker). */
const SETTLE = 1.5
const EYE = 1.62   // locomotion eye height over the feet (approx; damage only needs the feet)

/** The light a cast leaves under a Hollow it holds (the Hollow itself stays colourless goop): one colour per effect,
 *  the strongest first. */
function fxTint(h: Hollow | undefined): string | null {
  if (!h?.fx) return null
  if (fxOn(h, 'rooted')) return '#d9a441'
  if (fxOn(h, 'blinded')) return '#f4efc8'
  if (fxOn(h, 'disarmed')) return '#b48be0'
  if (fxOn(h, 'slowed')) return '#7fc7ea'
  if (fxOn(h, 'burning')) return '#ef7a3c'
  if (fxOn(h, 'staggered') || fxOn(h, 'vulnerable')) return '#e7e2d4'
  return null
}
const PUDDLE = '#55585b'

/** BETA M34 (shared by every look option, docs/looks/hollows.html): what a Hollow's surface borrows. `groundAt` = the biome
 *  colour under a point (the page's Wilds); `nodes` = the infected nodes (the drain). Read through a ref so bodies never re-render. */
export interface GoopWorld { groundAt: (x: number, z: number) => string; nodes: readonly { x: number; z: number }[] }
const GRASS = '#9cc46a'

/** One Hollow's goop material, re-aimed at the ground under it every half second (a cached env per ground colour), its
 *  borrow scaled by the hour. emissive stays BLACK, always: Alex dropped the white hit flash (M34, 11-19). */
function useGoop(c: React.MutableRefObject<Combat>, id: number, world: React.MutableRefObject<GoopWorld>) {
  const mat = useMemo(() => goopMaterial(), [])
  const next = useRef(0), key = useRef('')
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    const h = c.current.hollows.find(k => k.id === id); if (!h) return
    if (clock.elapsedTime >= next.current) {
      next.current = clock.elapsedTime + 0.5
      const W = world.current, g = borrowedGround(W.groundAt(h.x, h.z), greyStep(greyAt(h.x, h.z, W.nodes)))
      // __noBorrow (beta-m9-heap --nosheen): the A/B leg that leaves the env maps out, to see what they cost the heap
      if (g !== key.current && !(window as unknown as { __noBorrow?: boolean }).__noBorrow) { key.current = g; mat.envMap = groundEnv(g); mat.needsUpdate = true }
      mat.envMapIntensity = BORROW * borrowedSky(daylight(dayProgress()))
    }
  })
  return mat
}

/** The goop that leaves and comes back: DRIP_N drips shed off the body, fall, and crawl back to it (the brief's "always
 *  visibly losing itself"); the last instance is the LUMP a hit flings off backwards, which lands and crawls home. One
 *  instanced draw for all of it. Positions are the Hollow's LOCAL space (the parent group carries x/z/yaw). */
const DRIP_N = 5
function Sheds({ c, id, mat, top }: { c: React.MutableRefObject<Combat>; id: number; mat: THREE.Material; top: number }) {
  const im = useRef<THREE.InstancedMesh>(null)
  const st = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), lastFlash: 0, lumpT: -1, seed: Array.from({ length: DRIP_N }, (_, k) => ({ a: k * 1.256 + id, ph: (k * 0.37 + id * 0.11) % 1 })) }), [id])
  useFrame(({ clock }, dt) => {
    const h = c.current.hollows.find(k => k.id === id), M = im.current; if (!h || !M) return
    const t = clock.elapsedTime, { m, p, q, s } = st
    st.seed.forEach((d, k) => {
      const u = (t * 0.32 + d.ph) % 1, r0 = 0.3, gx = Math.cos(d.a) * 0.55, gz = Math.sin(d.a) * 0.55
      if (u < 0.45) { const f = u / 0.45; p.set(Math.cos(d.a) * r0, top - f * f * (top - 0.04), Math.sin(d.a) * r0); s.set(0.07, 0.09 + f * 0.04, 0.07) }
      else if (u < 0.6) { p.set(gx, 0.03, gz); s.set(0.1, 0.035, 0.1) }
      else { const f = (u - 0.6) / 0.4; p.set(gx * (1 - f), 0.03 + f * (top * 0.6), gz * (1 - f)); s.setScalar(0.07 * (1 - f * 0.5)) }
      M.setMatrixAt(k, m.compose(p, q.identity(), s))
    })
    // the lump: a fresh hit (the flash rising) throws one off backwards; it lands, then crawls back
    if (h.hitFlash > st.lastFlash + 0.02) st.lumpT = 0
    st.lastFlash = h.hitFlash
    if (st.lumpT >= 0) {
      st.lumpT += dt
      const T1 = 0.35, T2 = 1.5, u = st.lumpT
      if (u < T1) { const f = u / T1; p.set(0.15, top * 0.8 + Math.sin(f * Math.PI) * 0.5 - f * top * 0.75, -0.3 - f * 1.1); s.setScalar(0.16) }
      else if (u < T2) { const f = (u - T1) / (T2 - T1); p.set(0.15 * (1 - f), 0.05 + f * top * 0.5, -1.4 * (1 - f)); s.set(0.17, 0.09 + f * 0.06, 0.17) }
      else st.lumpT = -1
      M.setMatrixAt(DRIP_N, m.compose(p, q.identity(), s))
    } else M.setMatrixAt(DRIP_N, m.compose(p.set(0, -50, 0), q.identity(), s.setScalar(0.001)))
    M.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={im} args={[undefined, undefined, DRIP_N + 1]} material={mat} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /></instancedMesh>
}

/** One Hollow, ROOTED SPROUT (Alex's M34 pick, ather/hollow-body.ts): lumps of goop gathered on a seed, drawn as ONE instanced
 *  mesh, posed every frame from the sim's state. The TELL: through the wind-up it gathers in toward its core and rises, then
 *  the lunge falls forward onto you. A hit knocks it back and flings a lump (no flash: Alex dropped it, 11-19). The floater is
 *  the same substance in the caster's amount: no legs, dense only at the reach, and its spit charge is the same gather-and-rise. */
function SproutBody({ c, id, kind, world }: { c: React.MutableRefObject<Combat>; id: number; kind: HollowKind; world: React.MutableRefObject<GoopWorld> }) {
  const g = useRef<THREE.Group>(null), im = useRef<THREE.InstancedMesh>(null), puddle = useRef<THREE.MeshBasicMaterial>(null)
  const mat = useGoop(c, id, world)
  const S = useMemo(() => sprout(kind), [kind])
  const mats = useMemo(() => S.lumps.map(() => new THREE.Matrix4()), [S])
  const st = useRef({ tell: 0, fall: 0, walk: 0 })
  useFrame(({ clock }, dt) => {
    const h = c.current.hollows.find(k => k.id === id), M = im.current; if (!h || !g.current || !M) return
    g.current.position.set(h.x, h.y, h.z); g.current.rotation.y = h.yaw
    const e = 1 - Math.exp(-dt * 14), s = st.current
    const tellTo = h.state === 'windup' ? 1 - h.t / SHAMBLER.windup : h.state === 'charge' ? 1 - h.t / FLOATER.charge : 0
    s.tell += (Math.max(0, Math.min(1, tellTo)) - s.tell) * (tellTo > s.tell ? 1 : e)   // the gather is read straight off the sim; the let-go eases
    s.fall += ((h.state === 'lunge' ? 1 : 0) - s.fall) * e
    s.walk += ((h.state === 'chase' ? 1 : h.state === 'wander' ? 0.45 : 0) - s.walk) * e
    poseSprout(S, { t: clock.elapsedTime + id * 1.3, tell: s.tell, fall: s.fall, walk: s.walk, knock: Math.min(1, h.hitFlash * 8) }, mats)
    for (let i = 0; i < mats.length; i++) M.setMatrixAt(i, mats[i])
    M.instanceMatrix.needsUpdate = true
    if (puddle.current) { const tint = fxTint(h); puddle.current.color.set(tint ?? PUDDLE); puddle.current.opacity = tint ? 0.85 : 0.55 }
  })
  return (
    <group ref={g}>
      <instancedMesh ref={im} args={[lumpyGeometry(), mat, S.lumps.length]} frustumCulled={false} />
      <Sheds c={c} id={id} mat={mat} top={S.floats ? -0.2 : S.core} />
      {/* the drip: a puddle that follows a walker (a cast's tint shows under it) */}
      {!S.floats && <mesh position-y={0.03} rotation-x={-Math.PI / 2}><circleGeometry args={[0.55, 9]} /><meshBasicMaterial ref={puddle} color={PUDDLE} transparent opacity={0.55} /></mesh>}
    </group>
  )
}

/** DISPERSAL (brief: "cohesion lost", then "a brief bloom of the ground's own colour at the spot", from the FLOOR, never the
 *  body). Where a Hollow died: its goop sags flat and spreads, and the ground's own colour comes up in a ring under it. The
 *  sim drops a dead Hollow at once, so this plays from where it LAST stood. A pool of 6; one goop puddle + one ring each. */
export interface Dispersal { x: number; y: number; z: number; at: number; colour: string }
const DISPERSE_T = 2.2
const WHITE = new THREE.Color('#ffffff')
/** what the dispersals actually DREW (frames with a sag, the brightest ring): a 1-2 fps box shoots slower than a death lasts */
export const DISPERSE_SEEN = { sagFrames: 0, ringPeak: 0 }
function Dispersals({ list }: { list: React.MutableRefObject<Dispersal[]> }) {
  const goop = useMemo(() => goopMaterial(), [])
  const pool = useRef<{ g: THREE.Group | null; sag: THREE.Mesh | null; ring: THREE.Mesh | null }[]>(Array.from({ length: 6 }, () => ({ g: null, sag: null, ring: null })))
  useEffect(() => () => goop.dispose(), [goop])
  useFrame(() => {
    const now = performance.now() / 1000   // the same clock the layer stamps a death with
    list.current = list.current.filter(d => now - d.at < DISPERSE_T)
    pool.current.forEach((slot, k) => {
      const d = list.current[k], G = slot.g; if (!G) return
      G.visible = !!d; if (!d || !slot.sag || !slot.ring) return
      const u = (now - d.at) / DISPERSE_T
      G.position.set(d.x, d.y, d.z)
      const f = Math.min(1, u / 0.35)   // the sag: the body's height goes, its width spreads
      slot.sag.scale.set(0.45 + f * 0.6, Math.max(0.02, 0.9 * (1 - f)), 0.45 + f * 0.6); slot.sag.position.y = 0.9 * (1 - f) * 0.5 + 0.02
      slot.sag.visible = u < 0.6
      if (slot.sag.visible) DISPERSE_SEEN.sagFrames++
      // the ground's OWN hue, risen: brightened toward white and added, so grass blooms on grass (its exact colour on itself is invisible)
      const r = slot.ring.material as THREE.MeshBasicMaterial, b = Math.max(0, (u - 0.2) / 0.8)
      r.color.set(d.colour).lerp(WHITE, 0.45); r.opacity = b > 0 ? Math.sin(Math.min(1, b) * Math.PI) * 0.95 : 0
      DISPERSE_SEEN.ringPeak = Math.max(DISPERSE_SEEN.ringPeak, r.opacity)
      slot.ring.scale.setScalar(0.6 + b * 1.6)
    })
  })
  return <>{pool.current.map((slot, k) => (
    <group key={k} ref={el => { slot.g = el }} visible={false}>
      <mesh ref={el => { slot.sag = el }} material={goop}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <mesh ref={el => { slot.ring = el }} position-y={0.04} rotation-x={-Math.PI / 2}><ringGeometry args={[0.15, 1, 28]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
    </group>
  ))}</>
}

/** An infected node: a sump of grey goop on the ground, a slumped mound with drips, and a faint grey plume you can
 *  find from across the tile. No colour of its own, like the Hollows that come out of it. */
function NodeMound({ n, y }: { n: WildsNode; y: number }) {
  const mound = useRef<THREE.Mesh>(null), plume = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#26272a', emissive: '#5f6165', specular: '#eef3f6', shininess: 80, flatShading: true }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (mound.current) { const k = 1 + Math.sin(t * 0.9) * 0.05; mound.current.scale.set(k, 0.55 + Math.sin(t * 0.9 + 1) * 0.04, k) }
    if (plume.current) (plume.current.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(t * 0.6) * 0.04
  })
  return (
    <group position={[n.x, y, n.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06}><circleGeometry args={[7.5, 18]} /><meshBasicMaterial color="#4a4c50" transparent opacity={0.7} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}><ringGeometry args={[7.2, 8.6, 18]} /><meshBasicMaterial color="#6a6d72" transparent opacity={0.35} /></mesh>
      <mesh ref={mound} position-y={0.2} material={mat}><icosahedronGeometry args={[2.4, 1]} /></mesh>
      {[[2.6, 0.4], [-2.2, 1.9], [0.6, -2.9], [-3.4, -1.2], [3.6, -2.4]].map(([x, z], k) => (
        <mesh key={k} position={[x, 0.5 + (k % 3) * 0.2, z]} material={mat}><coneGeometry args={[0.32, 1.4 + (k % 2) * 0.8, 5]} /></mesh>
      ))}
      <mesh ref={plume} position-y={18}><cylinderGeometry args={[1.4, 3.2, 36, 9, 1, true]} /><meshBasicMaterial color="#8a8d92" transparent opacity={0.14} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
  )
}

/** The node's champion: a shambler grown huge and heavy, a crown of drips, arms like dragged sacks. It sinks into the
 *  ooze between bars. Rears for a slam, leans in for a lunge, swells and brightens for a volley. */
function ChampionBody({ c }: { c: React.MutableRefObject<Combat> }) {
  const g = useRef<THREE.Group>(null), body = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhongMaterial({ color: '#26272a', emissive: '#6d6f73', specular: '#eef3f6', shininess: 80, flatShading: true }), [])
  useFrame(({ clock }) => {
    const h = c.current.champ; if (!g.current) return
    g.current.visible = !!h; if (!h) return
    const t = clock.elapsedTime, S = CHAMP.height / 1.75
    g.current.position.set(h.x, h.y - h.sink * CHAMP.height * 1.05, h.z)
    g.current.rotation.y = h.yaw
    const p = h.state === 'windup' ? Math.min(1, 1 - h.t / 0.9) : 0
    const lean = h.state === 'windup' ? (h.attack === 'slam' ? -0.4 * p : h.attack === 'lunge' ? -0.25 : -0.1) : h.state === 'act' ? (h.attack === 'slam' ? 0.5 : h.attack === 'lunge' ? 0.6 : 0.1) : h.state === 'recover' ? 0.3 : 0.08
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, lean, 0.2)
    g.current.rotation.z = Math.sin(t * 1.2) * 0.07
    const swell = h.state === 'windup' && h.attack === 'volley' ? 1 + p * 0.22 : 1
    g.current.scale.setScalar(S)
    if (body.current) body.current.scale.set(swell * (1 + Math.sin(t * 1.6) * 0.04), 1 - Math.sin(t * 1.6) * 0.03, swell)
    const glow = h.state === 'windup' ? p * 0.45 : 0, f = h.hitFlash * 4
    mat.emissive.setRGB(0.43 + f + glow, 0.435 + f + glow, 0.45 + f + glow)
  })
  return (
    <group ref={g} visible={false}>
      <mesh ref={body} position-y={0.85} material={mat}><capsuleGeometry args={[0.42, 0.75, 3, 8]} /></mesh>
      <mesh position-y={HEAD_Y} position-z={0.1} material={mat}><icosahedronGeometry args={[0.26, 1]} /></mesh>
      {[[-0.14, 0], [0.12, 0.06], [0, -0.13], [0.15, -0.1], [-0.1, 0.12]].map(([x, z], k) => (
        <mesh key={k} position={[x, HEAD_Y + 0.24, z + 0.08]} material={mat}><coneGeometry args={[0.05, 0.22 + (k % 2) * 0.1, 4]} /></mesh>
      ))}
      <mesh position={[0.46, 0.9, 0.22]} rotation-x={-0.7} material={mat}><capsuleGeometry args={[0.15, 0.85, 2, 6]} /></mesh>
      <mesh position={[-0.46, 0.9, 0.22]} rotation-x={-0.85} material={mat}><capsuleGeometry args={[0.15, 0.85, 2, 6]} /></mesh>
      <mesh position-y={0.03} rotation-x={-Math.PI / 2}><circleGeometry args={[0.8, 12]} /><meshBasicMaterial color="#55585b" transparent opacity={0.55} /></mesh>
    </group>
  )
}

/** The tells, drawn on the ground in a warm warning tone (UI, not the Hollows' colour): a ring that fills for a slam,
 *  a strip along the locked line for a lunge, a fan for a volley. Fill = how far through the windup. */
function Tells({ c, heightAt }: { c: React.MutableRefObject<Combat>; heightAt: (x: number, z: number) => number }) {
  const ring = useRef<THREE.Mesh>(null), fill = useRef<THREE.Mesh>(null), strip = useRef<THREE.Group>(null), fan = useRef<THREE.Group>(null)
  const stripMat = useRef<THREE.MeshBasicMaterial>(null), fanMat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const tl = tellOf(c.current.champ)
    for (const m of [ring, fill, strip, fan]) if (m.current) m.current.visible = false
    if (!tl) return
    const y = heightAt(tl.x, tl.z) + 0.12, yaw = Math.atan2(tl.ax, tl.az)
    if (tl.kind === 'slam' && ring.current && fill.current) {
      ring.current.visible = fill.current.visible = true
      ring.current.position.set(tl.x, y, tl.z); fill.current.position.set(tl.x, y + 0.01, tl.z)
      fill.current.scale.setScalar(Math.max(0.01, tl.p))
    } else if (tl.kind === 'lunge' && strip.current) {
      strip.current.visible = true
      strip.current.position.set(tl.x, y, tl.z); strip.current.rotation.set(0, yaw, 0)
      if (stripMat.current) stripMat.current.opacity = 0.25 + tl.p * 0.4
    } else if (tl.kind === 'volley' && fan.current) {
      fan.current.visible = true
      fan.current.position.set(tl.x, y, tl.z); fan.current.rotation.set(0, yaw, 0)
      if (fanMat.current) fanMat.current.opacity = 0.18 + tl.p * 0.35
    }
  })
  const warm = { color: '#ffb36b', transparent: true, depthWrite: false, side: THREE.DoubleSide }
  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[CHAMP.slam.r - 0.25, CHAMP.slam.r, 40]} /><meshBasicMaterial {...warm} opacity={0.85} /></mesh>
      <mesh ref={fill} rotation-x={-Math.PI / 2} visible={false}><circleGeometry args={[CHAMP.slam.r, 40]} /><meshBasicMaterial {...warm} opacity={0.32} /></mesh>
      {/* in a yaw group, local +z is the locked aim; a plane rotated flat runs its length along z */}
      <group ref={strip} visible={false}>
        <mesh rotation-x={-Math.PI / 2} position-z={(CHAMP.lunge.len + 1.5) / 2}><planeGeometry args={[CHAMP.lunge.width, CHAMP.lunge.len + 1.5]} /><meshBasicMaterial ref={stripMat} {...warm} opacity={0.4} /></mesh>
      </group>
      <group ref={fan} visible={false}>
        {/* after the flat turn, sector angle θ points at (cos θ, 0, −sin θ): θ = −π/2 is +z */}
        <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[14, 16, -Math.PI / 2 - CHAMP.volley.fan, CHAMP.volley.fan * 2]} /><meshBasicMaterial ref={fanMat} {...warm} opacity={0.3} /></mesh>
      </group>
    </>
  )
}

/** A cast's flash: a ring that opens on the ground where it landed, or the bolt's line from the hand to what it struck
 *  (and on to each body it chained to). Lives FX_S seconds. */
const FX_S = 0.6
type LiveFx = CastHit & { at: number; from: { x: number; y: number; z: number }; colour: string }
const CAST_COLOUR: Record<string, string> = { terrain: '#b8b8c0', field: '#ffd9a0', status: '#9fd8ff', projectile: '#fff0b8', restore: '#9be59b', infusion: '#ffcf7a' }
/** The placed fields (combat-casts.ts › stepFields): a faint disc and a ring on the ground for as long as each lasts. */
function FieldDiscs({ c }: { c: React.MutableRefObject<Combat> }) {
  const discs = useRef<(THREE.Mesh | null)[]>([]), rings = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const fs = c.current.fields ?? [], now = c.current.clock ?? 0
    for (let i = 0; i < 4; i++) {
      const f = fs[fs.length - 1 - i], d = discs.current[i], r = rings.current[i]
      if (d) d.visible = !!f
      if (r) r.visible = !!f
      if (!f) continue
      const fade = Math.min(1, (f.until - now) / 0.8), pulse = 0.85 + 0.15 * Math.sin(now * 4)
      for (const [m, op, lift] of [[d, 0.18, 0.06], [r, 0.8, 0.09]] as const) {
        if (!m) continue
        m.position.set(f.x, f.y + lift, f.z); m.scale.set(f.r * pulse, f.r * pulse, f.r * pulse)
        const mat = m.material as THREE.MeshBasicMaterial; mat.color.set(f.colour); mat.opacity = op * fade
      }
    }
  })
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <group key={i}>
          <mesh ref={el => { discs.current[i] = el }} rotation-x={-Math.PI / 2} visible={false}><circleGeometry args={[1, 32]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <mesh ref={el => { rings.current[i] = el }} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[0.92, 1, 40]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </>
  )
}

/** The raised terrain (stepPieces): plain stone-grey blocks, one per cell, as tall as the cell stands. The canon look is not locked. */
const MAX_BLOCKS = 384
function PieceBlocks({ c }: { c: React.MutableRefObject<Combat> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const im = mesh.current; if (!im) return
    const ps = c.current.pieces ?? [], now = c.current.clock ?? 0
    let n = 0
    for (const p of ps) {
      const sink = Math.min(1, (p.until - now) / 0.6)   // sinks back into the ground over its last moments
      for (const q of p.cells) {
        if (n >= MAX_BLOCKS) break
        const h = Math.max(0.05, q.rise * sink)
        m.makeScale(0.98, h, 0.98); m.setPosition(q.x, q.base + h / 2, q.z); im.setMatrixAt(n++, m)
      }
    }
    im.count = n; im.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_BLOCKS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#8a8a92" roughness={1} />
    </instancedMesh>
  )
}

/** The veil's decoy (c.decoy): a plain translucent keeper-height pillar where the false keeper stands. Not canon art. */
function DecoyPillar({ c }: { c: React.MutableRefObject<Combat> }) {
  const m = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const me = m.current; if (!me) return
    const d = c.current.decoy, now = c.current.clock ?? 0
    me.visible = !!d && d.until > now
    if (!d || !me.visible) return
    me.position.set(d.x, d.y + 0.9, d.z)
    const mat = me.material as THREE.MeshBasicMaterial; mat.opacity = 0.35 * Math.min(1, (d.until - now) / 0.6) * (0.85 + 0.15 * Math.sin(now * 9))
  })
  return <mesh ref={m} visible={false}><cylinderGeometry args={[0.3, 0.3, 1.8, 12]} /><meshBasicMaterial color="#ffb07a" transparent opacity={0.35} depthWrite={false} /></mesh>
}

/** A HELD channel (Meltbore): a thin hot line from the glove to where the aim meets the ground, while the key is down. */
function ChannelBeam({ channel, T }: { channel: React.MutableRefObject<ChannelRun | null>; T: Terrain }) {
  const m = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3() }), [])
  useFrame(() => {
    const me = m.current; if (!me) return
    const ch = channel.current
    me.visible = !!ch
    if (!ch) return
    camera.getWorldDirection(v.d)
    const p = channelAim(T, camera.position, v.d, 12)
    v.a.set(camera.position.x + v.d.x * 0.6, camera.position.y - 0.25, camera.position.z + v.d.z * 0.6); v.b.set(p.x, p.y, p.z)
    const len = v.a.distanceTo(v.b); me.position.copy(v.a).lerp(v.b, 0.5)
    me.quaternion.setFromUnitVectors(v.up, v.b.clone().sub(v.a).normalize()); me.scale.set(1, Math.max(0.1, len), 1)
    ;(me.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.2 * Math.sin(ch.sustain.held * 30)
  })
  return <mesh ref={m} visible={false}><cylinderGeometry args={[0.05, 0.05, 1, 6, 1, true]} /><meshBasicMaterial color="#ff8c50" transparent opacity={0.8} depthWrite={false} /></mesh>
}

function CastFlash({ fx }: { fx: React.MutableRefObject<LiveFx[]> }) {
  const rings = useRef<(THREE.Mesh | null)[]>([]), lines = useRef<(THREE.Mesh | null)[]>([])
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion() }), [])
  useFrame(() => {
    const now = performance.now() / 1000
    fx.current = fx.current.filter(f => now - f.at < FX_S)
    for (let i = 0; i < 4; i++) {
      const f = fx.current[i], ring = rings.current[i], line = lines.current[i]
      if (ring) ring.visible = false
      if (line) line.visible = false
      if (!f) continue
      const u = (now - f.at) / FX_S
      if (ring && f.kind !== 'bolt') {
        ring.visible = true; ring.position.set(f.x, f.y + 0.08, f.z); const r = f.r * (0.4 + 0.6 * Math.min(1, u * 2.2)); ring.scale.set(r, r, r)
        const m = ring.material as THREE.MeshBasicMaterial; m.color.set(f.colour); m.opacity = 0.75 * (1 - u)
      }
      if (line && f.kind === 'bolt') {
        line.visible = true
        v.a.set(f.from.x, f.from.y, f.from.z); v.b.set(f.x, f.y, f.z)
        const len = v.a.distanceTo(v.b); line.position.copy(v.a).lerp(v.b, 0.5)
        v.q.setFromUnitVectors(v.up, v.b.clone().sub(v.a).normalize()); line.quaternion.copy(v.q); line.scale.set(1, len, 1)
        const m = line.material as THREE.MeshBasicMaterial; m.color.set(f.colour); m.opacity = 0.9 * (1 - u)
      }
    }
  })
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <group key={i}>
          <mesh ref={el => { rings.current[i] = el }} rotation-x={-Math.PI / 2} visible={false}><ringGeometry args={[0.85, 1, 32]} /><meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <mesh ref={el => { lines.current[i] = el }} visible={false}><cylinderGeometry args={[0.05, 0.05, 1, 5, 1, true]} /><meshBasicMaterial transparent depthWrite={false} /></mesh>
        </group>
      ))}
    </>
  )
}

/** The sights, shared with the page's held gun (shared/fp-gun.tsx). IN: `aiming` (right mouse here, the phone's aim button from the
 *  page) and `ads` (the gun's eased adsT past ADS_TIGHT: the tighter cone). OUT: when a round last left (ms, recoil + the mark's
 *  flare) and how far a charge has built (0..1, the Charred Rifle). */
export interface SightLink { aiming: boolean; ads: boolean; firedAt: number; charge: number }

export function CombatLayer({ T, locked, frozen, active, safe, onEvents, onHud, reviveKey, nodes = [], ownerOf, armed = true, gunId, reloadTick = 0, casts, onCast, eats, sight, channel, groundAt }: {
  T: Terrain
  /** M34: the biome colour under a point (sRGB hex): what a Hollow's sheen borrows, and the colour its dispersal blooms */
  groundAt?: (x: number, z: number) => string
  locked: React.MutableRefObject<boolean>
  frozen: React.MutableRefObject<boolean>
  active: boolean
  safe?: { x: number; z: number; r: number }
  onEvents: (e: CombatEvent[]) => void
  onHud: (h: CombatHud) => void
  reviveKey: number
  /** Infected nodes on this tile: each wakes a champion when the keeper comes close. */
  nodes?: WildsNode[]
  /** Which node's ground a spot is (id), or undefined on a tile with no nodes: strays only well up where it is infected. */
  ownerOf?: (x: number, z: number) => string | undefined
  /** A gun is drawn (shared/stance.ts): only then does a click fire. */
  armed?: boolean
  /** WHICH gun is drawn (the loadout's primary or secondary, Alex 11-18): its stats replace the last gun's on a swap */
  gunId?: string | null
  /** bumped by the page when R is tapped with a single gun drawn: reload */
  reloadTick?: number
  /** casts the page has paid for (shared/casting.ts), run along the eye's aim on the next frame */
  casts?: React.MutableRefObject<CastSpec[]>
  /** meals the page has spent (ather/cooking.ts › DISHES): heal amounts, applied to the keeper on the next frame */
  eats?: React.MutableRefObject<number[]>
  /** what each one did (how many it touched), for the message line */
  onCast?: (spec: CastSpec, hit: CastHit | null) => void
  /** the channel the keeper is holding (shared/use-casts.ts), drawn as a held beam */
  channel?: React.MutableRefObject<ChannelRun | null>
  /** aim down the sights + what the held gun shows (see SightLink) */
  sight?: React.MutableRefObject<SightLink>
}) {
  const fx = useRef<LiveFx[]>([])
  const { camera, gl } = useThree()
  const c = useRef<Combat>(newCombat(Date.now() >>> 0))
  useEffect(() => { liveSolids.combat = c.current; return () => { if (liveSolids.combat === c.current) liveSolids.combat = null } }, [])
  useEffect(() => () => setAmmoFeed(null), [])
  // ── M28 SHARED FIGHTS (shared/fight-share.ts): in a party with someone here, the lowest id hosts the Hollows and relays a
  // snapshot; the others draw it (C.remote). Solo = today's game exactly. The latest snapshot waits here for the frame loop.
  const net = useRef({ snap: null as Snap | null, fresh: false, snapT: 0, host: true, share: false, hostId: '',
    // slice 3: hits a guest owes the host, hits the host owes its sim, kills a guest owes its drops; the host's drop-watch
    outHits: [] as { id: number; dmg: number }[], hitT: 0, inHits: [] as HitRow[], inKills: [] as KillRow[], seen: new Set<number>(), wasHost: false })
  useEffect(() => {
    let off: (() => void) | null = null
    const hook = () => { const n = openNet(); if (!n || off) return; off = n.onRelay(m => {
      const N = net.current
      if (m.kind === SNAP_KIND && m.from === N.hostId) { N.snap = m.data as Snap; N.fresh = true }
      else if (m.kind === HIT_KIND && N.host && N.share) N.inHits.push(...decodeHits(m.data).slice(0, 40 - N.inHits.length))
      else if (m.kind === KILL_KIND && m.from === N.hostId && !N.host) N.inKills.push(...decodeKills(m.data))
    }) }
    hook(); const t = setInterval(hook, 1000)   // the socket hook may mount after this layer
    const g = window as unknown as { __fight?: unknown }
    g.__fight = { host: () => net.current.host, sharing: () => net.current.share, hostId: () => net.current.hostId,
      ids: () => c.current.hollows.map(h => ({ id: h.id, x: +h.x.toFixed(1), z: +h.z.toFixed(1), hp: Math.ceil(h.hp) })),
      drops: () => c.current.drops.length }   // checks' hook: READ only
    return () => { clearInterval(t); off?.(); delete g.__fight }
  }, [])   // M33: leaving the Wilds, Morel's bubble has no gun to read   // the keeper's walker reads c.pieces as solids (dynamic-solids.ts)
  const [ids, setIds] = useState<{ id: number; kind: string }[]>([])
  // M34: what the goop borrows (read through a ref: bodies never re-render for it), last positions, dispersals in flight
  const goopWorld = useRef<GoopWorld>({ groundAt: groundAt ?? (() => GRASS), nodes })
  goopWorld.current = { groundAt: groundAt ?? (() => GRASS), nodes }
  const lastAt = useRef(new Map<number, { x: number; y: number; z: number }>())
  const lastState = useRef(new Map<number, string>())   // M36: the windup's EDGE (a tell sounds once, as the gather starts)
  const dispersals = useRef<Dispersal[]>([])
  const held = useRef(false)   // M33: the left button really down (trigger is cleared per shot on a semi-auto)
  const trigger = useRef(false), mouseAim = useRef(false), popT = useRef(0), hudT = useRef(0)
  const hud = useRef<CombatHud>({ hp: 100, maxHp: 100, ammo: 12, clip: 12, reloading: false, hurtAt: -9, hitAt: -9, gun: c.current.gun.name, champ: null })
  const roundsMesh = useRef<THREE.InstancedMesh>(null), dropsMesh = useRef<THREE.InstancedMesh>(null), spitsMesh = useRef<THREE.InstancedMesh>(null)
  const aim = useMemo(() => new THREE.Vector3(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), s = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), []), fwd = useMemo(() => new THREE.Vector3(0, 0, 1), [])

  const nodesRef = useRef(nodes); nodesRef.current = nodes
  const settled = useRef(0)
  useEffect(() => { if (!active) settled.current = 0 }, [active])
  const armedRef = useRef(armed); armedRef.current = armed
  // the drawn gun: any range gun (gunplay.ts, which holds the Charred Rifle, Backbone, Roar too) or an engine weapon. A swap
  // takes the new gun's stats and a full clip; a charge in progress is dropped.
  const charging = useRef(-1)
  useEffect(() => {
    if (!gunId) return
    const g = RANGE_GUNS.find(x => x.id === gunId) ?? weaponDef(gunId)
    if (!g || c.current.gun.id === g.id) return
    c.current.gun = g; c.current.keeper.ammo = g.clip; c.current.keeper.reloading = 0; c.current.keeper.bloom = 0; charging.current = -1
  }, [gunId])
  const ownerRef = useRef(ownerOf); ownerRef.current = ownerOf
  const spent = useRef(new Set<string>())   // cleared this visit: never re-woken before the page drops it
  // once the page's list has caught up (the cleared node dropped out, or the spread brought one back), forget the bridge
  useEffect(() => { spent.current.clear() }, [nodes])
  // ★ tell the page at once (M20, Alex 11-18 'spawned in the home plot with 2 hp'): revive() always set full health, but the
  // HUD only hears from the frame loop below, which stops off the Wilds, so the plot kept showing the last hp of the fight
  const onHudRef = useRef(onHud); onHudRef.current = onHud
  const onEventsRef = useRef(onEvents); onEventsRef.current = onEvents
  useEffect(() => {
    revive(c.current); setIds([])
    if (!reviveKey) return
    const k = c.current.keeper
    onHudRef.current({ ...hud.current, gun: c.current.gun.name, hp: k.hp, maxHp: k.maxHp, ammo: k.ammo, clip: c.current.gun.clip, reloading: false, champ: null })
  }, [reviveKey])
  useEffect(() => { if (reloadTick) reload(c.current) }, [reloadTick])
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button === 0 && locked.current && !frozen.current) { trigger.current = true; held.current = true }
      if (e.button === 2 && locked.current && !frozen.current) mouseAim.current = true   // hold right-click: the sights
    }
    const up = (e: MouseEvent) => { if (e.button === 0) { trigger.current = false; held.current = false } if (e.button === 2) mouseAim.current = false }
    const menu = (e: MouseEvent) => { if (locked.current) e.preventDefault() }   // right-click is the sights, never the browser menu
    window.addEventListener('contextmenu', menu)
    // R is the STANCE's now (shared/stance.ts: draw / swap / hold to stow); a tap with one gun drawn reloads via reloadTick
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up)
    // probes for tests and scripted shots
    const g = window as unknown as { __ather?: Record<string, unknown> }
    g.__ather = { ...(g.__ather ?? {}), combat: () => c.current, calls: () => gl.info.render.calls,   // M34: draw calls per frame (hollow-look-check)
      dispersing: () => dispersals.current.map(d => ({ ...d })), dispersed: () => ({ ...DISPERSE_SEEN }),   // M34: in flight / what was drawn (hollow-look-check)
      spawn: (dx = 0, dz = -10, kind: 'shambler' | 'floater' = 'shambler') => {
      const f = camera.getWorldDirection(new THREE.Vector3()); const x = camera.position.x + f.x * -dz + dx, z = camera.position.z + f.z * -dz
      spawnHollow(c.current, T, x, z, kind)
    }, camAim: () => { const f = camera.getWorldDirection(new THREE.Vector3()); return { x: f.x, y: f.y, z: f.z, cx: camera.position.x, cy: camera.position.y, cz: camera.position.z } }, nodes: () => nodesRef.current, fall: () => { c.current.keeper.hp = 0; onEventsRef.current([{ kind: 'down' }]) }, wake: (i = 0) => { const n = nodesRef.current[i]; if (n && !c.current.champ) wakeChampion(c.current, T, n) } }
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('contextmenu', menu) }
  }, [locked, frozen, camera, T, gl])

  useFrame((_, rawDt) => {
    if (!active) return
    const dt = Math.min(rawDt, 1 / 20), C = c.current
    { const f = frameStats(getLook()); C.keeper.hit = f.hit; C.keeper.takes = f.damage }   // M29: the keeper's FRAME
    const feet = { x: camera.position.x, y: camera.position.y - EYE, z: camera.position.z }
    popT.current -= dt
    // a champion rises out of an infected node when the keeper comes close, once they have SETTLED: for the first
    // frames after an arrival the camera still holds the last zone's spot (prod 11-15: the plot's threshold (0,10) sits
    // 22 m from the Wilds' centre node, and every arrival woke it from 600 m away)
    settled.current += dt
    if (!C.champ && C.keeper.hp > 0 && settled.current > SETTLE) for (const n of nodesRef.current) {
      if (!spent.current.has(n.id) && Math.hypot(n.x - feet.x, n.z - feet.z) < WAKE_R) { wakeChampion(C, T, n); break }
    }
    // M28: host or guest, decided from the live roster every frame (a leaver hands the Hollows to the next lowest id)
    {
      const n = openNet(), live = n && n.zone === 'open:wilds' ? n.live() : []
      const N = net.current
      N.share = !!n && sharing(n.party, live)
      N.hostId = N.share ? hostOf(n!.self, live) : ''
      N.host = !N.share || N.hostId === n!.self
      C.remote = !N.host
      if (C.remote) {
        if (N.fresh && N.snap) { applySnap(C, T, N.snap); N.fresh = false }
        // slice 3: my hits go to the host (batched ~10/s, addressed); the host's kills become MY drops
        if (C.netHits?.length) N.outHits.push(...C.netHits)
        N.hitT -= dt
        if (N.outHits.length && N.hitT <= 0) { N.hitT = 0.1; n!.relay(HIT_KIND, encodeHits(N.outHits), N.hostId); N.outHits = [] }
        for (const k of N.inKills) layDrop(C, T, k)
        N.inKills = []; N.inHits = []
      } else {
        for (const [id, dmg] of N.inHits) applyNetHit(C, id, dmg)   // a guest's round, applied like mine; a kill drops in the step below
        N.inHits = []; N.outHits = []; N.inKills = []
        if (N.share) { N.snapT -= dt; if (N.snapT <= 0) { N.snapT = 1 / SNAP_HZ; n!.relay(SNAP_KIND, encodeSnap(C, feet)) } }
      }
      C.netHits = []
    }
    if (!C.remote && popT.current <= 0) {
      popT.current = 1.5
      // strays thicken round an infected node; during a champion fight the waves are the only adds
      const near = nodesRef.current.some(n => !spent.current.has(n.id) && Math.hypot(n.x - feet.x, n.z - feet.z) < STRAY_R)
      const own = ownerRef.current
      const infested = own ? (x: number, z: number) => { const id = own(x, z); return !id || (!spent.current.has(id) && nodesRef.current.some(n => n.id === id)) } : undefined
      populate(C, T, feet.x, feet.z, C.champ ? 0 : near ? 11 : 7, safe, infested)
    }
    // a CHARGED gun (the Charred Rifle): the pull starts a short charge, the round leaves when it ends (still aimed by the eye)
    const charge = (C.gun as { charge?: number }).charge ?? 0
    // a round out, through the sights' cone when aiming; the held gun reads when it left (recoil, the mark's flare)
    // ★ every shot SPEAKS (Alex 11-19: a breath / sizzle / discharge per gun, shared/gun-sound.ts); an empty pull sputters
    const shoot = () => {
      const wasReloading = C.keeper.reloading > 0
      if (fire(C, camera.position, aim, !!sight?.current.ads)) { playShot(C.gun.id); if (sight) sight.current.firedAt = performance.now() }
      else if (C.keeper.ammo <= 0) playEmpty()
      if (!wasReloading && C.keeper.reloading > 0) playReload()   // the shot that emptied the clip (or the empty pull) started a reload
    }
    if (charging.current >= 0) {
      charging.current -= dt
      if (charging.current < 0) { camera.getWorldDirection(aim); shoot() }
      if (!armedRef.current || frozen.current) charging.current = -1
    } else if ((trigger.current || touch.fire) && !frozen.current && armedRef.current) {
      if (charge > 0) { if (C.keeper.ammo > 0 && C.keeper.reloading <= 0 && C.keeper.sinceShot >= C.gun.fireCd) charging.current = charge; else { camera.getWorldDirection(aim); shoot() } }
      else { camera.getWorldDirection(aim); shoot() }
      if (!C.gun.auto) { trigger.current = false; touch.fire = false }
    }
    // the sights: the mouse HOLDS them, the phone TOGGLES them (touch.aim); putting the gun away drops both
    if (!armedRef.current || frozen.current) { mouseAim.current = false; touch.aim = false }
    if (sight) sight.current.aiming = mouseAim.current || touch.aim
    if (sight) sight.current.charge = charging.current >= 0 && charge > 0 ? Math.max(0, Math.min(1, 1 - charging.current / charge)) : 0
    if (casts?.current.length) {
      camera.getWorldDirection(aim)
      for (const spec of casts.current) {
        const hit = runCast(C, T, camera.position, aim, spec)
        if (hit) fx.current.push({ ...hit, at: performance.now() / 1000, from: { x: camera.position.x + aim.x * 0.6, y: camera.position.y - 0.25, z: camera.position.z + aim.z * 0.6 }, colour: CAST_COLOUR[spec.archetype] ?? '#ffffff' })
        for (const t of hit?.to ?? []) fx.current.push({ kind: 'bolt', ...t, r: 0.4, hit: 0, at: performance.now() / 1000, from: { x: hit!.x, y: hit!.y, z: hit!.z }, colour: CAST_COLOUR[spec.archetype] ?? '#ffffff' })
        onCast?.(spec, hit)
      }
      casts.current = []
    }
    if (eats?.current.length) {
      const k = C.keeper
      for (const h of eats.current) if (k.hp > 0) k.hp = Math.min(k.maxHp, k.hp + h)
      eats.current = []
    }
    stepCombat(C, T, feet, dt)
    // slice 3: the host tells the party about every new drop (its kills and guests' kills alike); each keeper lays its own.
    // Becoming host (or starting to share) marks what already lies there, so old drops are never re-sent.
    { const N = net.current, n = openNet()
      if (N.host && N.share && n) { const k = newDrops(C, N.seen, !N.wasHost); N.wasHost = true; if (k.length) n.relay(KILL_KIND, { k }) }
      else N.wasHost = false }
    stepFields(C, T, feet); stepPieces(C)
    if (C.events.length) {
      const now = performance.now() / 1000
      for (const e of C.events) {
        if (e.kind === 'hurt') hud.current.hurtAt = now; if (e.kind === 'hit') hud.current.hitAt = now
        if (e.kind === 'hit' && e.killed) { const L = lastAt.current.get(e.id); if (L) dispersals.current.push({ ...L, at: performance.now() / 1000, colour: goopWorld.current.groundAt(L.x, L.z) }) }   // M34
        if (e.kind === 'hit') { const L = lastAt.current.get(e.id); sfx(e.killed ? 'hollow-disperse' : 'hollow-hit', L ? { at: { x: L.x, y: L.y + 0.8, z: L.z } } : {}) }   // M36
        if (e.kind === 'champ-down') {
          spent.current.add(e.nodeId)
          // its ground goes quiet at once: the Hollows standing on it melt back into nothing (no drops; the chunk is the pay)
          const own = ownerRef.current
          if (own) C.hollows = C.hollows.filter(h => own(h.x, h.z) !== e.nodeId)
        }
      }
      onEvents(C.events)
    }
    // M34: where each Hollow last stood (the sim drops a dead one at once; its dispersal plays from here)
    lastAt.current.clear(); for (const h of C.hollows) lastAt.current.set(h.id, { x: h.x, y: h.y, z: h.z })
    // M36: a Hollow's tell sounds once, on the edge into its windup (shambler) / charge (floater); guests read the host's states too
    { const was = lastState.current, now = new Map<number, string>()
      for (const h of C.hollows) { now.set(h.id, h.state); if ((h.state === 'windup' || h.state === 'charge') && was.get(h.id) !== h.state) sfx('hollow-windup', { at: { x: h.x, y: h.y + 0.8, z: h.z } }) }
      lastState.current = now }
    // keep the list of drawn bodies in step with the sim
    if (C.hollows.length !== ids.length || C.hollows.some((h, i) => h.id !== ids[i].id)) setIds(C.hollows.map(h => ({ id: h.id, kind: h.kind })))
    const sm = spitsMesh.current
    if (sm) {
      const n = Math.min(C.spits.length, 32)
      for (let i = 0; i < n; i++) { const sp = C.spits[i]; p.set(sp.x, sp.y, sp.z); m4.compose(p, q.identity(), s.set(1, 1, 1)); sm.setMatrixAt(i, m4) }
      sm.count = n; sm.instanceMatrix.needsUpdate = true
    }
    // rounds as streaks
    const rm = roundsMesh.current
    if (rm) {
      const n = Math.min(C.rounds.length, 64)
      for (let i = 0; i < n; i++) {
        const r = C.rounds[i]
        p.set(r.x, r.y, r.z); s.set(r.vx, r.vy, r.vz).normalize(); q.setFromUnitVectors(fwd, s)
        m4.compose(p, q, s.set(1, 1, 1)); rm.setMatrixAt(i, m4)
      }
      rm.count = n; rm.instanceMatrix.needsUpdate = true
    }
    const dm = dropsMesh.current
    if (dm) {
      const n = Math.min(C.drops.length, 64), t = performance.now() / 1000
      for (let i = 0; i < n; i++) {
        const d = C.drops[i]
        p.set(d.x, d.y + 0.45 + Math.sin(t * 2.4 + d.id) * 0.12, d.z); q.setFromAxisAngle(s.set(0, 1, 0), t * 1.5 + d.id)
        m4.compose(p, q, s.set(1, 1, 1).multiplyScalar(0.8 + d.amount * 0.15)); dm.setMatrixAt(i, m4)
      }
      dm.count = n; dm.instanceMatrix.needsUpdate = true
    }
    hudT.current -= dt
    if (hudT.current <= 0) {
      hudT.current = 0.08
      const k = C.keeper
      const ch = C.champ
      onHud({ ...hud.current, gun: C.gun.name, hp: k.hp, maxHp: k.maxHp, ammo: k.ammo, clip: C.gun.clip, reloading: k.reloading > 0,
        firing: armedRef.current && !frozen.current && (held.current || trigger.current || touch.fire),   // raw input; morel.ts adds a wall-clock grace per round
        champ: ch ? { bar: ch.bar, hp: ch.hp, barHp: CHAMP.barHp, bars: CHAMP.bars, open: ch.state !== 'rise' && ch.state !== 'submerge' && ch.state !== 'home' } : null })
      setAmmoFeed({ ammo: k.ammo, clip: C.gun.clip, reloading: k.reloading > 0, firing: armedRef.current && !frozen.current && (held.current || trigger.current || touch.fire) })
    }
  })

  if (!active) return null
  return (
    <>
      {nodes.filter(n => !spent.current.has(n.id)).map(n => <NodeMound key={n.id} n={n} y={T.heightAt(n.x, n.z)} />)}
      <ChampionBody c={c} />
      <CastFlash fx={fx} />
      <FieldDiscs c={c} />
      <DecoyPillar c={c} />
      {channel && <ChannelBeam channel={channel} T={T} />}
      <PieceBlocks c={c} />
      <Tells c={c} heightAt={T.heightAt} />
      {ids.map(h => <SproutBody key={h.id} c={c} id={h.id} kind={h.kind as HollowKind} world={goopWorld} />)}
      <Dispersals list={dispersals} />
      <instancedMesh ref={spitsMesh} args={[undefined, undefined, 32]} frustumCulled={false}>
        <icosahedronGeometry args={[0.3, 0]} /><meshPhongMaterial color="#3a3c40" emissive="#8a8d92" specular="#ffffff" shininess={90} flatShading />
      </instancedMesh>
      <instancedMesh ref={roundsMesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[0.05, 0.05, 0.9]} /><meshBasicMaterial color="#fff2c4" />
      </instancedMesh>
      <instancedMesh ref={dropsMesh} args={[undefined, undefined, 64]} frustumCulled={false}>
        <octahedronGeometry args={[0.22, 0]} /><meshPhongMaterial color="#9a9ca0" specular="#ffffff" shininess={90} flatShading emissive="#3a3c40" />
      </instancedMesh>
    </>
  )
}
