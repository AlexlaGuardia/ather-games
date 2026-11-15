'use client'

// THE GUN SHOP's test lane, live (Alex 11-15: "a gunshop where each class of gun has a rack ... so i can go there and
// test them one at a time"). cavern.ts places the shop (racks, firing line, targets); shared/gunplay.ts is the sim;
// shared/tracers.tsx is the look. This file is the glue: walk to a rack, E takes its gun, click fires down the lane,
// R reloads, and the plates swing and spark when they are hit. Leave the shop and the gun goes back on its rack (the
// market is not a range: guns are only drawn behind the counter).
//
// The page mounts <GunRange cave/> inside the Canvas and reads `useGunHud()` for the template's hotbar + status chips
// (open/shared/game-hud.tsx owns every HUD placement; text goes through hudSay). `rangeHolds()` tells the page that R
// is a reload right now, not "back to the road".

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Cavern } from './cavern'
import { caveRoomAt } from './cavern'
import { gunForSlate, holdGun, stepGun, stepRounds, reloadGun, PLATE, type GunState, type Round, type Target, type RangeGun } from './shared/gunplay'
import { Tracers, TracerFx } from './shared/tracers'
import { hudSay } from './shared/game-hud'
import { touch } from './shared/touch'

// ── the store the page's HUD reads ──────────────────────────────────────────────────────────────────────────────────
type GunHud = { gun: RangeGun | null; ammo: number; reloading: boolean; inShop: boolean }
let hudState: GunHud = { gun: null, ammo: 0, reloading: false, inShop: false }
/** 0..1, how far into the sights you are (eased, so the zoom glides rather than snaps). Read every frame by the page. */
let adsT = 0, adsFov = 50
const subs = new Set<() => void>()
const setHud = (h: Partial<GunHud>) => {
  const next = { ...hudState, ...h }
  if (next.gun === hudState.gun && next.ammo === hudState.ammo && next.reloading === hudState.reloading && next.inShop === hudState.inShop) return
  hudState = next; subs.forEach(f => f())
}
/** The held gun for the template: a hotbar entry and the ammo chip. */
export function useGunHud() {
  const h = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => hudState, () => hudState)
  const entries = h.gun ? [{ itemId: h.gun.id, count: h.ammo, icon: `/open/icons/gun-${h.gun.id}.svg`, name: `${cap(h.gun.name)} · ${h.gun.slot.toLowerCase()}` }] : []
  const status = h.gun ? [{ label: cap(h.gun.name), value: h.reloading ? 'reloading' : `${h.ammo}/${h.gun.clip}`, accent: h.reloading }] : []
  return { entries, status, holding: !!h.gun }
}
/** True while a gun is in hand in the shop: R reloads instead of sending you back to the road. */
export const rangeHolds = () => !!hudState.gun
/** ★ AIM DOWN SIGHTS (Alex 11-15). Hold right-click (phone: the aim button). The page asks two things every frame:
 *  the field of view to use (null = yours, not aiming), and how much to slow the look so the zoomed view does not
 *  whip (scaled by the zoom, the standard "same feel at every zoom" trick). */
export const rangeFov = (base: number) => (adsT > 0.001 ? base + (adsFov - base) * adsT : null)
export const rangeLookScale = (base: number) => (adsT > 0.001 ? (base + (adsFov - base) * adsT) / base : 1)
/** The phone's aim button code (a held touch key, same mechanism as jump/slide). */
export const AIM_CODE = 'GunAim'
/** Sights per class: how far each zooms. The Lance is the scope; the Roar barely zooms at all. */
const ADS_FOV_OF: Record<string, number> = { SIDEARM: 58, SHORTBARREL: 55, LONGBARREL: 48, BREACHER: 62, REACHER: 28 }
const cap = (s: string) => s[0] + s.slice(1).toLowerCase()

// ── the models: boxes painted by class, one silhouette per Slate ────────────────────────────────────────────────────
type Part = { o: [number, number, number]; s: [number, number, number]; tint?: boolean; dark?: boolean }
const SHAPES: Record<string, Part[]> = {
  // the gun points down -z in its own frame; y up
  SIDEARM: [{ o: [0, 0, -0.08], s: [0.05, 0.07, 0.24], tint: true }, { o: [0, -0.08, 0.02], s: [0.045, 0.13, 0.06], dark: true }],
  SHORTBARREL: [{ o: [0, 0, -0.12], s: [0.07, 0.09, 0.36], tint: true }, { o: [0, -0.1, -0.12], s: [0.04, 0.16, 0.05], dark: true }, { o: [0, -0.07, 0.04], s: [0.05, 0.12, 0.06], dark: true }, { o: [0, 0, -0.34], s: [0.03, 0.03, 0.1], dark: true }],
  LONGBARREL: [{ o: [0, 0, -0.18], s: [0.07, 0.1, 0.6], tint: true }, { o: [0, -0.11, -0.12], s: [0.045, 0.16, 0.06], dark: true }, { o: [0, -0.03, 0.18], s: [0.06, 0.12, 0.22], dark: true }, { o: [0, 0, -0.56], s: [0.03, 0.03, 0.2], dark: true }],
  BREACHER: [{ o: [0, 0, -0.18], s: [0.09, 0.11, 0.56], tint: true }, { o: [0, 0.035, -0.5], s: [0.07, 0.07, 0.24], dark: true }, { o: [0, -0.04, -0.3], s: [0.07, 0.05, 0.2], dark: true }, { o: [0, -0.04, 0.16], s: [0.07, 0.13, 0.22], dark: true }],
  REACHER: [{ o: [0, 0, -0.2], s: [0.06, 0.09, 0.72], tint: true }, { o: [0, 0.09, -0.12], s: [0.05, 0.05, 0.24], dark: true }, { o: [0, 0, -0.7], s: [0.025, 0.025, 0.36], dark: true }, { o: [0, -0.04, 0.22], s: [0.06, 0.13, 0.24], dark: true }],
}
const gunLen = (g: RangeGun) => -SHAPES[g.slot].reduce((a, p) => Math.min(a, p.o[2] - p.s[2] / 2), 0)
function GunModel({ gun, scale = 1 }: { gun: RangeGun; scale?: number }) {
  const parts = SHAPES[gun.slot]
  return (
    <group scale={scale}>
      {parts.map((p, i) => (
        <mesh key={i} position={p.o}><boxGeometry args={p.s} /><meshBasicMaterial color={p.tint ? gun.color : p.dark ? '#2a2622' : '#555'} toneMapped={false} /></mesh>
      ))}
    </group>
  )
}

/** A plate on its post: swings back on a hinge at its foot when hit, flashes white (gold on a head shot). */
function Plate({ t, y }: { t: Target; y: number }) {
  const hinge = useRef<THREE.Group>(null), mat = useRef<THREE.MeshBasicMaterial>(null), head = useRef<THREE.MeshBasicMaterial>(null)
  const base = useMemo(() => new THREE.Color('#d8d2c2'), []), white = useMemo(() => new THREE.Color('#ffffff'), []), gold = useMemo(() => new THREE.Color('#ffd36b'), [])
  useFrame(() => {
    if (hinge.current) hinge.current.rotation.x = -t.swing
    const c = t.lastZone === 'head' ? gold : white
    mat.current?.color.copy(base).lerp(c, t.flash)
    head.current?.color.copy(base).lerp(c, t.lastZone === 'head' ? t.flash : t.flash * 0.4)
  })
  return (
    <group position={[t.x, y, t.z]} rotation-y={t.yaw}>
      <group ref={hinge} position-y={0.8}>
        <mesh position-y={PLATE.cy - 0.8}><boxGeometry args={[PLATE.w, PLATE.h, 0.04]} /><meshBasicMaterial ref={mat} color={base} toneMapped={false} /></mesh>
        <mesh position-y={PLATE.headY - 0.8} rotation-x={HEAD_FIX}><cylinderGeometry args={[PLATE.headR, PLATE.headR, 0.04, 14]} /><meshBasicMaterial ref={head} color={base} toneMapped={false} /></mesh>
        {/* the rings, so a hit has somewhere to be */}
        <mesh position={[0, PLATE.cy - 0.8, 0.025]}><ringGeometry args={[0.12, 0.15, 20]} /><meshBasicMaterial color="#8c2f24" /></mesh>
      </group>
    </group>
  )
}
// the plate's head disc is a cylinder lying along y; stand it up facing the lane
const HEAD_FIX = Math.PI / 2

const REACH = 1.9            // metres from a rack to take its gun
const TALLY_QUIET = 1.4      // seconds of no fire before the lane reads the string out

export function GunRange({ cave }: { cave: Cavern }) {
  const { camera, gl } = useThree()
  const shop = cave.gunShop
  const gun = useRef<GunState | null>(null)
  const rounds = useRef<Round[]>([])
  const fx = useMemo(() => new TracerFx(), [])
  const targets = useRef<Target[]>(shop.targets.map(t => ({ id: t.id, x: t.x, y: cave.y, z: t.z, yaw: t.yaw, swing: 0, swingV: 0, hits: 0, flash: 0, lastZone: null })))
  const trigger = useRef(false)
  const aimHeld = useRef(false)
  const near = useRef<string | null>(null)
  const tally = useRef({ shots: 0, hits: 0, heads: 0, best: 0, quiet: 0 })
  const kick = useRef(0)
  const vm = useRef<THREE.Group>(null)
  const seed = useRef(7)
  const rand = () => { seed.current = (seed.current * 16807) % 2147483647; return seed.current / 2147483647 }
  const inShopNow = useRef(false)

  const take = (slate: string) => {
    const g = gunForSlate(slate); if (!g) return
    gun.current = holdGun(g); tally.current = { shots: 0, hits: 0, heads: 0, best: 0, quiet: 0 }
    setHud({ gun: g, ammo: g.clip, reloading: false })
    hudSay(`${cap(g.name)} · ${g.slot.toLowerCase()} · ${g.burst > 1 ? `${g.burst}-round burst` : g.pellets > 1 ? `${g.pellets} pellets` : g.auto ? 'full auto' : 'semi-auto'} · hold to fire, right-click aims, R reloads`, 'item')
  }
  const putBack = (why: string) => {
    if (!gun.current) return
    hudSay(`${cap(gun.current.gun.name)} back on its rack · ${why}`, 'info')
    gun.current = null; trigger.current = false; aimHeld.current = false; setHud({ gun: null })
  }

  useEffect(() => {
    const locked = () => document.pointerLockElement === gl.domElement
    const down = (e: MouseEvent) => {
      if (!gun.current || !locked()) return
      if (e.button === 0) trigger.current = true
      if (e.button === 2) aimHeld.current = true
    }
    const up = (e: MouseEvent) => { if (e.button === 0) trigger.current = false; if (e.button === 2) aimHeld.current = false }
    const noMenu = (e: MouseEvent) => { if (gun.current) e.preventDefault() }
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyE' && near.current) {
        if (gun.current?.gun.slot === near.current) putBack('swapped out')
        else take(near.current)
      }
      if (e.code === 'KeyR' && gun.current) { reloadGun(gun.current); setHud({ reloading: gun.current.reloading > 0 }) }
    }
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('keydown', key); window.addEventListener('contextmenu', noMenu)
    // probes for a scripted check on prod
    ;(window as unknown as { __range?: unknown }).__range = {
      take, fire: (on: boolean) => { trigger.current = on }, aim: (on: boolean) => { aimHeld.current = on }, ads: () => adsT, state: () => ({ held: gun.current?.gun.id ?? null, ammo: gun.current?.ammo, rounds: rounds.current.length, hits: targets.current.map(t => t.hits) }),
      shop: () => shop,
    }
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('keydown', key); window.removeEventListener('contextmenu', noMenu); adsT = 0; setHud({ gun: null, inShop: false }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])

  const solid = (x: number, y: number, z: number) => !cave.inside(x, z) || y < cave.y || y > cave.y + cave.roofAt(x, z)
  const eye = useMemo(() => new THREE.Vector3(), []), aim = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    camera.getWorldPosition(eye); camera.getWorldDirection(aim)
    // where am I: the shop or its lane, on the cave's floor
    const onFloor = Math.abs(eye.y - 1.6 - cave.y) < 2.5
    const room = onFloor ? caveRoomAt(cave, eye.x, eye.z) : null
    const inShop = !!room && (room.id === 'guns' || room.id === 'lane')
    if (inShop !== inShopNow.current) { inShopNow.current = inShop; setHud({ inShop }) }
    if (!inShop && gun.current) putBack('guns stay behind the counter')
    // the rack in reach
    let nr: string | null = null, nd = REACH
    if (inShop) for (const r of shop.racks) { const d = Math.hypot(r.x - eye.x, r.z - eye.z); if (d < nd) { nd = d; nr = r.slate } }
    if (nr !== near.current) {
      near.current = nr
      const g = nr ? gunForSlate(nr) : null
      if (g) hudSay(gun.current?.gun.id === g.id ? `${cap(g.name)} rack · E puts it back` : `${cap(g.name)} · ${g.slot.toLowerCase()} rack · E to take`, 'item')
    }
    // the gun
    const g = gun.current
    if (!g) adsT = Math.max(0, adsT - dt / 0.11)
    if (g) {
      // the sights: ease in over ~0.15 s, out a touch faster; reloading drops you out of them
      const aiming = (aimHeld.current || touch.held.has(AIM_CODE)) && g.reloading <= 0
      adsT = Math.max(0, Math.min(1, adsT + (aiming ? dt / 0.15 : -dt / 0.11)))
      adsFov = ADS_FOV_OF[g.gun.slot] ?? 50
      const fired = stepGun(g, dt, trigger.current || touch.fire, eye, aim, rand, rounds.current, adsT > 0.6)
      for (const f of fired) {
        // at the held gun's muzzle (the viewmodel: 0.16 right, 0.15 down, its barrel ~0.5 m + its length out)
        const a = adsT * adsT * (3 - 2 * adsT)
        const tip = new THREE.Vector3(0.16 * (1 - a), -0.15 + a * 0.045, -0.42 - gunLen(g.gun) * 0.5).applyQuaternion(camera.quaternion).add(eye)
        fx.flashes.push({ x: tip.x, y: tip.y, z: tip.z, dx: f.dx, dy: f.dy, dz: f.dz })
        kick.current = Math.min(1, kick.current + 0.45 + g.gun.kickPitch * 12)
        tally.current.shots++
      }
      if (fired.length) tally.current.quiet = 0
      setHud({ ammo: g.ammo, reloading: g.reloading > 0 })
    }
    const { hits, impacts } = stepRounds(rounds.current, dt, targets.current, solid, shop.line)
    for (const im of impacts) fx.impacts.push(im)
    for (const h of hits) { tally.current.hits++; if (h.zone === 'head') tally.current.heads++; tally.current.best = Math.max(tally.current.best, h.range) }
    // the lane reads your string out once you stop shooting
    const T = tally.current
    if (T.shots > 0) {
      T.quiet += dt
      if (T.quiet > TALLY_QUIET && g) {
        hudSay(`${cap(g.gun.name)} · ${T.hits}/${T.shots * g.gun.pellets} on the plates${T.heads ? ` · ${T.heads} head` : ''}${T.best ? ` · longest ${Math.round(T.best)} m` : ''}`, 'info')
        tally.current = { shots: 0, hits: 0, heads: 0, best: 0, quiet: 0 }
      }
    }
    // the viewmodel: held lower right, kicks back and up on each round, dips while reloading
    kick.current = Math.max(0, kick.current - dt * 7)
    if (vm.current) {
      vm.current.visible = !!g
      if (g) {
        const rel = g.reloading > 0 ? Math.sin(Math.min(1, 1 - g.reloading / g.gun.reloadTime) * Math.PI) : 0
        vm.current.position.copy(camera.position)
        vm.current.quaternion.copy(camera.quaternion)
        // hip: low right. Sights: centred and LOW, so you look along its top (centred on the eye it hid the target)
        const a = adsT * adsT * (3 - 2 * adsT)
        vm.current.translateX(0.16 * (1 - a)); vm.current.translateY(-0.15 + a * 0.045 - rel * 0.12); vm.current.translateZ(-0.5 + a * 0.08 + kick.current * (0.05 - a * 0.03))
        vm.current.rotateX(kick.current * 0.18 - rel * 0.6)
      }
    }
  })

  const held = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => hudState.gun, () => null)
  return (
    <>
      {/* the guns on the racks: two of each, painted by class */}
      {shop.racks.map(r => {
        const g = gunForSlate(r.slate)!
        return (
          <group key={r.slate} position={[r.x, cave.y, r.z]} rotation-y={r.yaw}>
            {[1.42, 2.02].map(h => (
              <group key={h} position={[0, h, 0.08]} rotation-y={Math.PI / 2}><GunModel gun={g} scale={1.6} /></group>
            ))}
            {/* a class-coloured strip under the shelf: the rack reads from across the shop */}
            <mesh position={[0, 0.3, 0.27]}><boxGeometry args={[1.3, 0.12, 0.02]} /><meshBasicMaterial color={g.color} toneMapped={false} /></mesh>
          </group>
        )
      })}
      {targets.current.map(t => <Plate key={t.id} t={t} y={cave.y} />)}
      <group ref={vm} visible={false}>{held && <GunModel gun={held} scale={0.5} />}</group>
      <Tracers rounds={() => rounds.current} fx={fx} />
    </>
  )
}
