'use client'
// ── THE GUN IN THE KEEPER'S HANDS (Alex 11-18: "work on the visuals of the weapons in the players hands plus aiming down sight
// with a clean red-dot 1x scope on shottys and smgs, a 2x on long barrels and a 3x on the snipers") ──────────────────────────────
// Until now a drawn gun HID the gloves and drew nothing (open-hands: "the gun is out (it draws its own)"; only the continent's
// shop range drew boxes). This is the held gun for the open world: one rig, the Ather's Wilds and the continent on foot.
//
//   · ONE silhouette per Slate, code-built at real size (metres, -z forward, y up), Kael's Charred Rifle its own; the GLOVES hold it
//     (open-hands' buildHand: the right on the grip, the left on the foregrip), so drawing a gun no longer makes the hands vanish.
//   · THE SIGHT on top (shared/optics.ts): a red dot is a short tube with a lens and a dot ON THE GLASS; aiming carries the gun up so
//     the optic's sight line lies exactly on the camera's axis, which puts the dot dead centre by construction (no HUD crosshair).
//     A 2x / 3x is a scope tube; near full ADS the model gives way to the scope ring (<ScopeRing/>), the cheap read on a phone.
//   · ADS is owned HERE: `step()` eases adsT from `aiming`, and the page asks `fpGunAds()` for the zoom (adsFov), the look slow-down
//     (adsLookScale) and the tighter cone (adsT > ADS_TIGHT). One source, so the gun, the zoom and the spread can never disagree.
//   · Pose like open-hands: the page calls step() from the walker's onTick AFTER the camera is placed (never a frame behind), and
//     the rig draws over the world with the same depth-clear sentinel trick (ORDER).
//
// ★ THE SIGHT'S LOOK IS CANON (world/manalic-weapons.md › Sights, RULED 11-18 /magii + Alex): a lens of ground Ather crystal with a
// mark ETCHED into it that lights faintly when mana runs through the gun; no free light, "so it never reads as a modern red dot". The
// cut and its tint are the owner's (shared/sight-marks.ts; look, never power). Here: the lens is pale crystal, the mark a canvas
// texture on it whose glow is markGlow() (faint while drawn, a flare as a round leaves or a charge builds). Copy: none.
import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { buildHand, ORDER } from './open-hands'
import { opticOf, throughScope, type Optic } from './optics'
import { MARKS, TINTS, drawMark, markGlow, defaultLook, type SightLook } from './sight-marks'
import { getSightLooks, lookFor } from './sight-looks'
import type { RangeGun } from './gunplay'

// ── the tune (metres / radians, the viewmodel's own frame: the camera's) ──
// ★ TUNABLE LIKE THE HANDS (Alex 11-18: "a similar dev tool for the guns like we made for the hands so I can tweak it later"):
// /shimmer/dev/guns writes the LIVE numbers (VM) and saves them to this browser (GUN_TUNE_KEY, a device key); "Copy values" →
// paste to Jin → they become GUN_DEFAULTS for everyone. Every number is read per frame, so a slider moves the gun at once.
export interface GunTune {
  S: number; HIP_X: number; HIP_Y: number; HIP_Z: number
  ADS_DIST: number; ADS_IN: number; ADS_OUT: number
  BOB: number; BOB_ADS: number
  KICK_Z: number; KICK_PITCH: number; KICK_DECAY: number
  HAND: number
  R_DX: number; R_DY: number; R_DZ: number; R_PITCH: number; R_ROLL: number
  L_DX: number; L_DY: number; L_DZ: number; L_PITCH: number; L_ROLL: number
}
export const GUN_DEFAULTS: Readonly<GunTune> = {
  S: 0.55,                      // the gun's scale against its real size
  HIP_X: 0.17, HIP_Y: -0.2, HIP_Z: -0.5,   // where the grip sits at the hip: low right, close
  ADS_DIST: 0.34,               // how far ahead of the eye the sight sits when aiming
  ADS_IN: 0.15, ADS_OUT: 0.11,  // seconds to come up / drop out of the sights
  BOB: 0.012, BOB_ADS: 0.15,    // the run's bob, and how much of it survives in the sights
  KICK_Z: 0.05, KICK_PITCH: 0.12, KICK_DECAY: 14,  // recoil: back and up, then home
  HAND: 0.6,                    // the gloves' scale ON THE GUN: a fist (0.1 m box) at the gun's own scale, a touch fuller. NOT open-hands' 1.28,
                                // which sizes free hands to the screen; at that size a fist out-grew the pistol and hid the 1x sight (11-18 shot)
  // the gloves on the gun, offsets from each model's grip / foregrip point (metres) + their turn (radians)
  R_DX: 0.008, R_DY: -0.012, R_DZ: 0.012, R_PITCH: -0.35, R_ROLL: -0.45,
  L_DX: -0.006, L_DY: -0.02, L_DZ: 0, L_PITCH: 0.15, L_ROLL: 0.55,
}
// ★ PER GUN (Alex 11-19, tuning the Repeater: "do I have to pass you the values for each one"). The tune used to be ONE set for
//   every gun, so tuning the Repeater moved the Breacher too. Now: GUN_DEFAULTS is the base, GUN_BAKED[id] is a gun's tuned
//   numbers everyone gets (Alex's pastes land here), and this browser's per-gun slider moves sit on top (GUN_TUNE_KEY, v2 map).
export const GUN_BAKED: Readonly<Record<string, Partial<GunTune>>> = {
  // Alex 11-19, the Repeater: bigger in hand, closer and lower, a stronger kick that settles fast, fuller gloves
  repeater: { S: 1.18, HIP_X: 0.07, HIP_Y: -0.125, HIP_Z: -0.365, ADS_DIST: 0.155, ADS_IN: 0.13, ADS_OUT: 0.13, BOB: 0.008, BOB_ADS: 0.19,
    KICK_Z: 0.066, KICK_PITCH: 0.255, KICK_DECAY: 25, HAND: 0.94,
    R_DX: 0.026, R_DY: 0.036, R_DZ: 0.042, R_PITCH: -0.91, R_ROLL: -0.36, L_DX: -0.008, L_DY: 0.018, L_DZ: 0.036, L_PITCH: -0.58, L_ROLL: -0.69 },
}
/** LIVE numbers for the gun in hand: defaults, then the gun's baked tune, then this browser's tune for that gun. */
export const VM: GunTune = { ...GUN_DEFAULTS }
export const GUN_TUNE_KEY = 'open:gun-tune.v2'
export const GUN_TUNE_KEYS = Object.keys(GUN_DEFAULTS) as (keyof GunTune)[]
let tuned: Record<string, Partial<GunTune>> = {}, curGun = ''
/** what a gun is WITHOUT this browser's moves (the tuner greys a value that matches it) */
export const defaultsFor = (id: string): GunTune => ({ ...GUN_DEFAULTS, ...(GUN_BAKED[id] ?? {}) })
function apply() {
  const t = { ...defaultsFor(curGun), ...(tuned[curGun] ?? {}) }
  for (const k of GUN_TUNE_KEYS) VM[k] = typeof t[k] === 'number' && Number.isFinite(t[k]) ? t[k]! : GUN_DEFAULTS[k]
}
/** the gun in hand changed (fp-gun's step calls this; the tuner calls it when you pick a gun) */
export function selectGunTune(id: string): void { if (id === curGun) return; curGun = id; apply() }
export function loadGunTune(): void {
  try { const t = JSON.parse(localStorage.getItem(GUN_TUNE_KEY) ?? 'null'); tuned = t && typeof t === 'object' ? t : {} } catch { tuned = {} }
  apply()
}
export function setGunTune(patch: Partial<GunTune>): void {
  for (const k of GUN_TUNE_KEYS) if (typeof patch[k] === 'number') VM[k] = patch[k]!
  tuned[curGun] = Object.fromEntries(GUN_TUNE_KEYS.map(k => [k, VM[k]]))
  try { localStorage.setItem(GUN_TUNE_KEY, JSON.stringify(tuned)) } catch { /* private window */ }
}
/** this gun back to everyone's numbers (its baked tune, else the defaults) */
export function resetGunTune(): void { delete tuned[curGun]; try { localStorage.setItem(GUN_TUNE_KEY, JSON.stringify(tuned)) } catch { /* */ } apply() }
export const ADS_TIGHT = 0.6     // past this the cone is the sights' (gunplay ads)

// ── the models ──
type Part = { o: [number, number, number]; s: [number, number, number]; c: 'body' | 'dark' | 'metal' | 'ember' }
type Model = { parts: Part[]; grip: [number, number, number]; fore: [number, number, number]; top: number; sightZ: number }
const box = (o: Part['o'], s: Part['s'], c: Part['c'] = 'body'): Part => ({ o, s, c })
const MODELS: Record<string, Model> = {
  // the sidearm: slide over a frame, a short barrel, the grip raked back
  SIDEARM: { parts: [box([0, 0.02, -0.07], [0.034, 0.034, 0.2]), box([0, -0.005, -0.06], [0.03, 0.022, 0.17], 'dark'), box([0, 0.02, -0.185], [0.016, 0.016, 0.03], 'metal'), box([0, -0.07, 0.01], [0.03, 0.11, 0.045], 'dark')],
    grip: [0, -0.07, 0.01], fore: [0, -0.1, 0.0], top: 0.037, sightZ: -0.04 },
  // the SMG: a stubby receiver, a magazine down the middle, a short stock
  SHORTBARREL: { parts: [box([0, 0, -0.1], [0.05, 0.065, 0.3]), box([0, 0.002, -0.3], [0.022, 0.022, 0.12], 'metal'), box([0, -0.085, -0.13], [0.03, 0.12, 0.04], 'dark'), box([0, -0.06, 0.03], [0.034, 0.1, 0.045], 'dark'), box([0, -0.01, 0.13], [0.03, 0.05, 0.16], 'dark')],
    grip: [0, -0.06, 0.03], fore: [0, -0.04, -0.2], top: 0.033, sightZ: -0.08 },
  // the long barrel: a long receiver, the barrel out front, a full stock
  LONGBARREL: { parts: [box([0, 0, -0.12], [0.05, 0.075, 0.42]), box([0, 0.006, -0.44], [0.024, 0.024, 0.26], 'metal'), box([0, -0.075, -0.1], [0.03, 0.1, 0.045], 'dark'), box([0, -0.06, 0.1], [0.034, 0.1, 0.045], 'dark'), box([0, -0.02, 0.27], [0.04, 0.09, 0.24], 'dark'), box([0, -0.03, -0.27], [0.046, 0.04, 0.16], 'dark')],
    grip: [0, -0.06, 0.1], fore: [0, -0.06, -0.26], top: 0.038, sightZ: -0.06 },
  // the breacher: a fat receiver, a pump under a wide barrel
  BREACHER: { parts: [box([0, 0, -0.12], [0.065, 0.085, 0.42]), box([0, 0.012, -0.44], [0.04, 0.04, 0.24], 'metal'), box([0, -0.045, -0.36], [0.05, 0.04, 0.18], 'dark'), box([0, -0.07, 0.1], [0.036, 0.11, 0.05], 'dark'), box([0, -0.02, 0.26], [0.045, 0.1, 0.22], 'dark')],
    grip: [0, -0.07, 0.1], fore: [0, -0.07, -0.36], top: 0.043, sightZ: -0.06 },
  // the reacher: the longest, a thin barrel, a cheek rest
  REACHER: { parts: [box([0, 0, -0.14], [0.046, 0.07, 0.5]), box([0, 0.004, -0.56], [0.018, 0.018, 0.36], 'metal'), box([0, -0.07, 0.12], [0.032, 0.1, 0.045], 'dark'), box([0, -0.015, 0.3], [0.04, 0.1, 0.26], 'dark'), box([0, 0.045, 0.28], [0.03, 0.02, 0.12], 'dark'), box([0, -0.03, -0.3], [0.04, 0.04, 0.18], 'dark')],
    grip: [0, -0.07, 0.12], fore: [0, -0.06, -0.3], top: 0.035, sightZ: -0.04 },
}
// Kael's Charred Rifle: a long barrel, burnt dark, with the charge seam lit along it (canon 11-15: single fire, short charge-up)
const CHARRED: Model = { ...MODELS.LONGBARREL, parts: [...MODELS.LONGBARREL.parts, box([0.026, 0.01, -0.2], [0.004, 0.012, 0.3], 'ember')] }
export const modelOf = (g: Pick<RangeGun, 'id' | 'slot'>): Model => (g.id === 'charred-rifle' ? CHARRED : MODELS[g.slot] ?? MODELS.LONGBARREL)

/** The sight line in the gun's own frame: centre of the optic's glass (where the dot is), above the receiver. */
export const sightOf = (m: Model, o: Optic) => ({ y: m.top + (o.scoped ? 0.032 : 0.028), z: m.sightZ })
/** Where the gun group sits so its sight lies on the camera axis ADS_DIST ahead: the dot is dead centre by construction. */
export const adsPos = (m: Model, o: Optic) => { const s = sightOf(m, o); return [0, -s.y * VM.S, -VM.ADS_DIST - s.z * VM.S] as const }

// ── the ADS store the page reads (zoom, look slow-down, the cone) and the scope ring renders from ──
let adsT = 0, optic: Optic | null = null, look: SightLook | null = null, glow = 0
const subs = new Set<() => void>()
let snap = { t: 0, optic: null as Optic | null, look: null as SightLook | null, glow: 0 }
// re-render the ring only when it appears / goes, or its mark or glow moves enough to see
const publish = () => {
  const scoped = !!optic && throughScope(optic, adsT), was = !!snap.optic && throughScope(snap.optic, snap.t)
  if (scoped !== was || (scoped && (look !== snap.look || Math.abs(glow - snap.glow) > 0.04))) { snap = { t: adsT, optic, look, glow }; subs.forEach(f => f()) }
}
export const fpGunAds = () => ({ t: adsT, optic })

function buildModel(m: Model, color: string, o: Optic, mats: Record<Part['c'] | 'glass' | 'dot', THREE.Material>): THREE.Group {
  const g = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], r?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...p); if (r) mesh.rotation.set(...r); mesh.renderOrder = ORDER; mesh.frustumCulled = false; g.add(mesh)
  }
  ;(mats.body as THREE.MeshStandardMaterial).color.set(color)
  for (const p of m.parts) add(new THREE.BoxGeometry(...p.s), mats[p.c], p.o)
  const s = sightOf(m, o)
  add(new THREE.BoxGeometry(0.022, 0.012, 0.05), mats.dark, [0, m.top + 0.004, s.z])   // the mount
  if (!o.scoped) {
    // the red dot: a short open tube, a tinted lens, the dot on the glass at the sight line
    add(new THREE.CylinderGeometry(0.019, 0.019, 0.034, 14, 1, true), mats.dark, [0, s.y, s.z], [Math.PI / 2, 0, 0])
    add(new THREE.CircleGeometry(0.017, 16), mats.glass, [0, s.y, s.z - 0.012])
    add(new THREE.PlaneGeometry(0.012, 0.012), mats.dot, [0, s.y, s.z - 0.0115])   // the etched mark, ON the glass
  } else {
    // a scope: the tube, the bells, the lenses
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 14), mats.dark, [0, s.y, s.z], [Math.PI / 2, 0, 0])
    add(new THREE.CylinderGeometry(0.02, 0.016, 0.03, 14), mats.dark, [0, s.y, s.z - 0.075], [Math.PI / 2, 0, 0])
    add(new THREE.CylinderGeometry(0.016, 0.019, 0.025, 14), mats.dark, [0, s.y, s.z + 0.07], [Math.PI / 2, 0, 0])
    add(new THREE.CircleGeometry(0.018, 16), mats.glass, [0, s.y, s.z - 0.091])
    add(new THREE.CircleGeometry(0.015, 16), mats.glass, [0, s.y, s.z + 0.083])   // the eyepiece
  }
  g.scale.setScalar(VM.S)
  return g
}

export interface FpGunInput {
  gun: RangeGun | null    // what R has drawn (null = stowed: the rig hides)
  aiming: boolean         // right mouse / the phone's aim button held
  speed: number           // horizontal m/s, from the walker
  firedAt: number         // ms of the last round out (recoil)
  reloading: boolean      // drops you out of the sights
  charging?: number       // 0..1, a charged gun's build (the Charred Rifle): mana running, so the mark flares
  look?: SightLook        // override the owner's cut (tests); by default the keeper's own (sight-looks.ts) or the plain default
  now: number             // ms
}
export interface FpGunApi { step: (i: FpGunInput, dt: number) => void }

export const FpGun = forwardRef<FpGunApi>(function FpGun(_, ref) {
  const { camera } = useThree()
  const mats = useMemo(() => {
    const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, transparent: true, opacity: 1, ...extra })
    return {
      body: std('#888'), dark: std('#2a2622'), metal: std('#55524c', { roughness: 0.45, metalness: 0.4 }),
      ember: std('#ff7a2e', { emissive: new THREE.Color('#ff7a2e'), emissiveIntensity: 1.2 }),
      glass: new THREE.MeshBasicMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.16, depthWrite: false }),   // ground Ather crystal
      dot: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),   // the etching (map set per look)
    } as Record<Part['c'] | 'glass' | 'dot', THREE.Material>
  }, [])
  const rig = useMemo(() => {
    const root = new THREE.Group(), held = new THREE.Group()
    const sentinel = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
    sentinel.renderOrder = ORDER - 1; sentinel.frustumCulled = false; sentinel.position.set(0, 0, -0.3)
    sentinel.onBeforeRender = (renderer) => renderer.clearDepth()
    const R = buildHand(1, null), L = buildHand(-1, null)
    R.scale.setScalar(VM.HAND); L.scale.setScalar(VM.HAND)
    held.add(R, L); root.add(sentinel, held); root.visible = false
    return { root, held, R, L, model: null as THREE.Group | null, key: '' }
  }, [])
  const st = useRef({ phase: 0, kick: 0, lastFired: -Infinity })
  const markTex = useRef<{ key: string; tex: THREE.CanvasTexture | null }>({ key: '', tex: null })
  const setMark = (lk: SightLook) => {
    const key = `${lk.mark}:${lk.tint}`; if (markTex.current.key === key || typeof document === 'undefined') return
    const c = document.createElement('canvas'); c.width = c.height = 64
    const ctx = c.getContext('2d'); if (!ctx) return
    drawMark(ctx, lk.mark, 64, TINTS[lk.tint].hex)
    markTex.current.tex?.dispose(); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
    markTex.current = { key, tex }; const m = mats.dot as THREE.MeshBasicMaterial; m.map = tex; m.needsUpdate = true
  }
  useImperativeHandle(ref, () => ({
    step: (i, dt) => {
      const d = Math.min(dt, 0.1), s = st.current
      if (!i.gun) { adsT = Math.max(0, adsT - d / VM.ADS_OUT); optic = null; glow = 0; publish(); rig.root.visible = false; return }
      selectGunTune(i.gun.id)   // this gun's own tune (per gun since 11-19)
      const m = modelOf(i.gun), o = opticOf(i.gun)
      // (re)build when the gun changes
      const key = `${i.gun.id}:${o.id}`
      if (rig.key !== key) {
        if (rig.model) { rig.held.remove(rig.model); rig.model.traverse(x => { if (x instanceof THREE.Mesh) x.geometry.dispose() }) }
        rig.model = buildModel(m, i.gun.color, o, mats); rig.held.add(rig.model); rig.key = key
      }
      // the gloves on the gun (every frame, so the tuner moves them): the right fist wraps the grip from behind and below, the
      // left cups the foregrip, both under the sight line, never over it
      rig.model!.scale.setScalar(VM.S); rig.R.scale.setScalar(VM.HAND); rig.L.scale.setScalar(VM.HAND)
      rig.R.position.set(m.grip[0] * VM.S + VM.R_DX, m.grip[1] * VM.S + VM.R_DY, m.grip[2] * VM.S + VM.R_DZ); rig.R.rotation.set(VM.R_PITCH, 0, VM.R_ROLL)
      rig.L.position.set(m.fore[0] * VM.S + VM.L_DX, m.fore[1] * VM.S + VM.L_DY, m.fore[2] * VM.S + VM.L_DZ); rig.L.rotation.set(VM.L_PITCH, 0, VM.L_ROLL)
      // the sights: ease in / out; reloading drops you out
      const aiming = i.aiming && !i.reloading
      adsT = Math.max(0, Math.min(1, adsT + (aiming ? d / VM.ADS_IN : -d / VM.ADS_OUT)))
      look = i.look ?? lookFor(getSightLooks(), i.gun.id, o.scoped); setMark(look)   // the keeper's own cut (Character tab), else the plain default
      // the etching lights faintly while mana runs through a drawn gun, and flares as a round leaves or a charge builds
      glow = markGlow(true, i.now, i.firedAt, i.charging ?? 0); (mats.dot as THREE.MeshBasicMaterial).opacity = glow
      optic = o; publish()
      // recoil: a fresh round kicks, then it springs home
      if (i.firedAt > s.lastFired) { s.lastFired = i.firedAt; s.kick = Math.min(1.5, s.kick + 1) }
      s.kick *= Math.exp(-VM.KICK_DECAY * d)
      // the run's bob, damped in the sights
      s.phase += d * (4 + i.speed * 1.4)
      const bob = VM.BOB * Math.min(1, i.speed / 4) * (1 - adsT * (1 - VM.BOB_ADS))
      const e = adsT * adsT * (3 - 2 * adsT)   // smoothstep: the gun glides up, it does not slide linearly
      const a = adsPos(m, o)
      rig.held.position.set(
        VM.HIP_X + (a[0] - VM.HIP_X) * e + Math.cos(s.phase) * bob,
        VM.HIP_Y + (a[1] - VM.HIP_Y) * e + Math.abs(Math.sin(s.phase)) * bob,
        VM.HIP_Z + (a[2] - VM.HIP_Z) * e + s.kick * VM.KICK_Z * (1 - 0.6 * e))
      rig.held.rotation.set(s.kick * VM.KICK_PITCH * (1 - 0.5 * e), 0, 0)
      rig.root.position.copy(camera.position); rig.root.quaternion.copy(camera.quaternion)   // this frame's camera
      rig.root.visible = !throughScope(o, adsT)   // the scope ring takes the screen; the model gives way
    },
  }), [camera, rig, mats])
  useEffect(() => { loadGunTune() }, [])   // this browser's tune from /shimmer/dev/guns
  useEffect(() => {
    ;(window as unknown as { __fpGun?: unknown }).__fpGun = { ads: () => adsT, optic: () => optic?.id ?? null, shown: () => rig.root.visible, key: () => rig.key, mark: () => (look ? `${look.mark}:${look.tint}` : null), glow: () => glow }
    return () => {
      adsT = 0; optic = null; publish()
      rig.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
      Object.values(mats).forEach(m => m.dispose()); markTex.current.tex?.dispose()
    }
  }, [rig, mats])
  return <primitive object={rig.root} />
})

/** The scope ring (DOM, over the canvas): only while a scoped gun is at full ADS. A dark mask with a round window of crystal, the
 *  owner's ETCHED MARK at its glow (the same strokes as the lens, sight-marks.ts), the magnification under it. Mount once by the HUD. */
export function ScopeRing() {
  const s = useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => snap, () => snap)
  if (!s.optic || !throughScope(s.optic, s.t)) return null
  const lk = s.look ?? defaultLook(true), hex = TINTS[lk.tint].hex, w = 0.045
  return (
    <div data-hud="scope" data-mark={lk.mark} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4,
      background: 'radial-gradient(circle at 50% 50%, rgba(207,232,242,0.06) 0, rgba(207,232,242,0.06) min(36vh, 40vw), rgba(8,7,6,0.97) calc(min(36vh, 40vw) + 2px))' }}>
      <svg viewBox="-1 -1 2 2" style={{ position: 'absolute', left: '50%', top: '50%', width: 'min(18vh, 20vw)', height: 'min(18vh, 20vw)', transform: 'translate(-50%, -50%)', opacity: 0.25 + 0.75 * s.glow, filter: `drop-shadow(0 0 3px ${hex})` }}>
        {MARKS[lk.mark].strokes.map((k, n) => k.k === 'dot' ? <circle key={n} r={k.r} fill={hex} />
          : k.k === 'ring' ? <circle key={n} r={k.r} fill="none" stroke={hex} strokeWidth={w} />
          : <line key={n} x1={k.a[0]} y1={-k.a[1]} x2={k.b[0]} y2={-k.b[1]} stroke={hex} strokeWidth={w} strokeLinecap="round" />)}
      </svg>
      <div style={{ position: 'absolute', left: '50%', top: 'calc(50% + min(30vh, 33vw))', transform: 'translateX(-50%)', font: '600 11px system-ui', letterSpacing: '0.2em', color: 'rgba(207,232,242,0.45)' }}>{s.optic.mag}×</div>
    </div>
  )
}
