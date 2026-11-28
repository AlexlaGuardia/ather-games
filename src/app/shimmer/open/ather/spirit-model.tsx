'use client'
// M102 (sprites, 2026-11-23): THE VULNYX, IN GAME, OWNER-ONLY PREVIEW. Alex 11-23 07:4x picked the NO-MOUTH Hunyuan
// game-ready mesh (docs/looks/proto-2026-11-23/vulnyx-gameready.glb) as a TEMP, game-only spirit style and asked "how
// will it look in game?". This file answers that: the mesh UNCHANGED in shape (no face edits), stood on a bloomed Spirit
// Planter, behind `?spirits=3d` AND the owner cookie (/api/owner, the gate the Options Dev tab uses). Players see the
// gold orb exactly as before. M102 Manalotl wire-in: PER SPECIES now (spirit-models.ts): a bloomed planter shows its own
// species' model when one is listed (Vulnyx, Manalotl) and the gold orb otherwise.
//
// Look (art-medium law: living things stay LIVE GLOW): toon 3-step on the mesh's own vertex colours + a warm emissive
// floor so she never goes dark at night, a gold fresnel rim, a pale-gold translucent hull where other figures carry an ink
// hull, and the glb's own eye mesh (iris, pupil, outline, catchlight are in it as vertex colours) drawn unlit. Idle: a gentle bob + breath + slow head-turn yaw of the whole body, and a soft tail sway done in the
// vertex shader (weight = how far along the tail axis a vertex sits). No rig: the glb has no skin or vertex groups.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { makeTrot, type SpiritNav, type Trot } from './spirit-trot'
import { isFollowing, keeperAt, spiritHeld, spiritLive, subscribeFollow } from './spirit-follow'   // M109 s1
import { spiritCheer } from './spirit-feed'   // M109 s2: fed = her happy beat
import { inParty, spiritCall, subscribeParty } from './spirit-party'   // M109 s3: called home from the grimoire; s4: the party keeps near
import { isTrainStat, trainPlay } from './spirit-stats'   // M110 s1: a finished play at a training piece = a small gain

import { SPIRIT_ELEMENTS, SPIRIT_MODELS, groundLift, lowPoints, rigLook, type SpiritElement, type SpiritLook } from './spirit-models'
import { groundMoved, rigClip, type RigClip } from './spirit-rig'   // M132 s2
import { GROUNDED, flyClip, flyStep, travels, type FlyState } from './spirit-fly'   // M173
import { hullPush, makeRigBody, rigCount, type RigBody } from './spirit-rig-body'
import type { Species } from '../../spirits/spirit'
import { slotOf } from './spirit-seeds'   // M122: a spirit's slot in her planter
import { fightSlot } from '../shared/spirit-fight'   // M127 s1
import { joinFormation, leaveFormation, tickFormation, formationSlot, reportFormationPos, inFormation } from '../shared/follow-formation'   // M126 s1
import { skitSlot } from '../shared/idle-skits'   // M126 s2
import { fetchLift, fetchSlot, joinFetch, leaveFetch } from './spirit-fetch'   // M141 s2 (s3: her style's lift)
import { bodyRadius } from './obstacles'
import { gardenFollow, gardenGround } from './garden-follow'   // M126
import { GROUND_Y } from './plot'
import { GROWN } from '../../sprites/creature-size'
import { accentOf, accentAt } from './spirit-accent'   // M204 s2: her glow accent from her bar
import { isFxForm, makeSpiritFx, type SpiritFx } from './spirit-fx'   // M204 s2: the second forms' effects

export const VULNYX_URL = SPIRIT_MODELS.fox!.url
/** World height of the model (the glb is 1 unit tall). Small and lithe: ~0.55 m, about a third of a keeper. */
export const VULNYX_H = SPIRIT_MODELS.fox!.h

// ── the (former) gate. M107 ship (Alex 11-23): the MODELS and their roam/trot went to every keeper. M123 s2 (Alex 11-24, "yea
// lets fold that in"): the rest that grew on top ships to EVERY keeper too: E-talk (Feed / Follow / Open panel), the party of 8
// + who comes along, the grimoire roster face, the training pieces + Allow and their plays, Greg's grimoire hand-over. The hook
// stays as the one switch (true for all) so a future gate is one line. Owner-only DEBUG stays owner-only elsewhere
// (spirit-panels.tsx Bloom now / +1 day, workshop.tsx Blueprints). ───────────────────────────────────────────────────────
export function useSpiritsDev(): boolean {
  return true
}

/** M132 s2 THE ONE SWITCH: the rigged bodies, EVERY keeper's since 11-24 (Alex: "rigs too"; it was the owner check). `?rig=0` = the
 *  old models, for the before / after frame measure. Read once per page. Canvas only, so no hydration to match. */
let rigOn: boolean | null = null
export function useSpiritRig(): boolean {
  return rigOn ??= typeof window === 'undefined' || new URLSearchParams(window.location.search).get('rig') !== '0'
}

/** M204 s2: `?fx=0` = no form effects (the frame-cost measure's before). Read once per page. */
let fxOn: boolean | null = null
const useFx = (): boolean => (fxOn ??= typeof window === 'undefined' || new URLSearchParams(window.location.search).get('fx') !== '0')
/** M204 s2 HER GLOW ACCENT (spirit-accent.ts): the bar's colour mix as a live fresnel glow + a faint floor, x its strength */
// The colour FLOWS through her slots' colours (feed order) along her body length (bind-pose z) and slowly in time, so a mixed bar
// shows every colour fed. Strength: a faint floor + a fresnel rim.
const ACC_HEAD = 'uniform vec3 uAccC[10]; uniform float uAccN; uniform float uAccS; uniform float uAccT; varying float vAccP;\n'
const ACC_VERT = 'vAccP = position.z;'
const ACC_FRAG = `{ float aph = fract(uAccT * 0.08 + vAccP * 0.9) * uAccN; int a0 = int(floor(aph)); int a1 = int(mod(floor(aph) + 1.0, uAccN));
        vec3 ac = mix(uAccC[a0], uAccC[a1], smoothstep(0.55, 1.0, fract(aph)));
        gl_FragColor.rgb += ac * uAccS * (0.06 + 0.95 * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5)); }`
type AccU = { c: { value: THREE.Color }; s: { value: number }; n: { value: number }; t: { value: number }; slots: { value: THREE.Color[] } }
const accUniforms = (sh: { uniforms: Record<string, unknown>; vertexShader: string }, a: AccU) => {
  sh.uniforms.uAccC = a.slots; sh.uniforms.uAccN = a.n; sh.uniforms.uAccS = a.s; sh.uniforms.uAccT = a.t
  sh.vertexShader = 'varying float vAccP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n ${ACC_VERT}`)
}

// read-only probe for the check: how many spirit models are mounted right now (all, and by species). `trot` = the Vulnyx's
// pose (the M107 asserts read it), `trots[species]` = each species' latest pose.
type TrotProbe = { x: number; y: number; z: number; mode: string; home: { x: number; z: number }; rMin: number; rMax: number; beats: number; homes: number; tilt: number; h: number; hWorld?: number; len?: number; keepMax?: number; cheers: number; yMax: number; calling: boolean; near: boolean; plays: number; playing: string | null; playYMax: number; braceMax: number }
type RigProbe = { id: string; sp: Species; h: number; yaw: number; x: number; y: number; z: number; mode: string; v: number; /** M173: a flier's metres off the ground (0 walking) */ alt: number; body: RigBody }
type Probe = { /** M204 s2 */ accents: Record<string, { hex: string; s: number; n: number; locked: boolean } | null>; fxs: Map<string, SpiritFx>; rigs: Map<string, RigProbe>; rigCount: typeof rigCount; mounted: number; url: string; h: number; species: Record<string, number>; urls: Record<string, number>; trot?: TrotProbe; trots: Record<string, TrotProbe> }
const probe = (): Probe => { const w = window as unknown as { __spiritModel?: Probe }; return (w.__spiritModel ??= { accents: {}, fxs: new Map(), mounted: 0, url: VULNYX_URL, h: VULNYX_H, species: {}, urls: {}, trots: {}, rigs: new Map(), rigCount }) }

/** M202 s1 OWNER PREVIEW of the second forms while no player path evolves a spirit yet (M201): `?form=mana|storm|earth|water`
 *  draws every evolvable garden spirit in that form, for the owner only (/api/owner). Players never see it. */
let formQ: SpiritElement | null | undefined
let ownerP: Promise<boolean> | null = null
export function useFormPreview(): SpiritElement | null {
  const [on, setOn] = useState(false)
  formQ ??= (() => { if (typeof window === 'undefined') return null; const f = new URLSearchParams(window.location.search).get('form'); return (SPIRIT_ELEMENTS as readonly string[]).includes(f ?? '') ? f as SpiritElement : null })()
  useEffect(() => {
    if (!formQ) return; let alive = true
    ;(ownerP ??= fetch('/api/owner', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { owner: false })).then(d => !!d.owner).catch(() => false)).then(v => { if (alive) setOn(v) })
    return () => { alive = false }
  }, [])
  return on ? formQ : null
}

let grad: THREE.DataTexture | null = null
const gradTex = () => { if (grad) return grad; grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true; return grad }

function SpiritModel({ sp, look, nav, id, avatar, dev, meals, gallery, clip }: { sp: Species; look: SpiritLook; nav?: SpiritNav
  /** M213: the /dev spirit gallery's copy: centred like the avatar, but counted by the probe, with her form fx, and playing `clip` in place */ gallery?: boolean
  /** M213: the clip the gallery plays (walk / run in place at the clip's own speed) */ clip?: RigClip
  /** M204 s2: her bar (the pot's meals): her glow accent */ meals?: readonly unknown[]
  /** M107 ship / M123 s2 (every keeper): she can be talked to, follow, keep with the party, play at training pieces */ dev?: boolean
  /** M109: the planter's id (her follow state + the E pick are keyed on it) */ id?: string
  /** M109: the spirit panel's turntable copy: not counted by the probe, not pickable */ avatar?: boolean }) {
  const gltf = useGLTF(look.url), scene = gltf.scene, rig = look.rig
  const g = useRef<THREE.Group>(null)
  const mealKey = (meals ?? []).join(), accent = useMemo(() => accentOf(mealKey ? mealKey.split(',') : []), [mealKey])
  const acc = useMemo<AccU>(() => ({ c: { value: new THREE.Color(0, 0, 0) }, s: { value: 0 }, n: { value: 1 }, t: { value: 0 }, slots: { value: Array.from({ length: 10 }, () => new THREE.Color(0, 0, 0)) } }), []), haloRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const fx = useRef<SpiritFx | null>(null), fxOk = useFx()
  const time = useMemo(() => ({ value: 0 }), []), sw = useMemo(() => ({ value: 0 }), []), lift = useMemo(() => ({ value: 0 }), []), tiltU = useMemo(() => ({ value: 0 }), [])
  // M107: the procedural trot (spirit-trot.ts) when a nav is given, with this species' dials; seeded by home so two
  // planters never move in step
  // M126: in the garden a follower walks the keeper's ground (doors, steps, floors, the way to the gate), not just her own roam
  const fnav = useMemo(() => (nav?.roam && id ? gardenFollow(bodyRadius(GROWN[sp] ?? { height: 0.5 }), GROUND_Y) : null), [nav, id, sp])
  const trot = useMemo<Trot | null>(() => nav ? makeTrot(fnav ? { ...nav, get follow() { return gardenGround() ? fnav : null } } : nav, Math.round(nav.home.x * 31 + nav.home.z * 17) + (id ? slotOf(id) : 0) * 101, look.trot) : null, [nav, look, id, fnav])   // M122: a second spirit on one planter trots her own way
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), bb: new THREE.Box3(), hAt: -1, fy: NaN, hWorld: 0, lWorld: 0, keepMax: 0 }), [])
  const parts = useMemo(() => {
    const body = scene.getObjectByName('body') as THREE.Mesh | undefined, eyes = scene.getObjectByName('eyes') as THREE.Mesh | undefined
    const glowM = look.glow ? scene.getObjectByName(look.glow.part) as THREE.Mesh | undefined : undefined
    if (!body || !eyes || rig) return null
    // the glb's COLOR_0 bytes are sRGB (how the picked render read them); three reads vertex colours as LINEAR, which
    // washes her out to cream. Convert once, into a float copy (the cached glb geometry is left as it came).
    const lin = (geo: THREE.BufferGeometry) => {
      const g = geo.clone(), a = g.getAttribute('color'); if (!a) return g
      const out = new Float32Array(a.count * 3), c = new THREE.Color()
      for (let i = 0; i < a.count; i++) { c.setRGB(a.getX(i), a.getY(i), a.getZ(i), THREE.SRGBColorSpace); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b }
      g.setAttribute('color', new THREE.BufferAttribute(out, 3)); return g
    }
    const bb = new THREE.Box3().setFromObject(scene), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2
    const skin = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: look.skin.emissive, emissiveIntensity: look.skin.emissiveI })
    const glow = look.glow ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: look.glow.emissive, emissiveIntensity: look.glow.lo }) : null
    // the outline of the picked render: a pale translucent hull at ~1/3 alpha (gold for the Vulnyx, rose for the Manalotl)
    const halo = new THREE.MeshBasicMaterial({ color: look.hull.color, transparent: true, opacity: look.hull.opacity, side: THREE.BackSide, depthWrite: false, toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    // the species' vertex bends, weights by vertex position (no rig): tail sway (running = faster + wider, the tail lags the
    // hop), the Vulnyx's ear flick, the Manalotl's head tilt (a roll of everything forward of the neck: head, frills, eyes)
    const { sway: S, tilt: T } = look, f = (n: number) => n.toFixed(4)
    const tail = `float tp = ${f(S.sign)} * position.${S.along}; float tw = smoothstep(${f(S.from)}, ${f(S.to)}, tp);
        transformed.${S.dir} += sin(uT * (${f(S.hz)} + uSw * ${f(S.hzRun)}) - tp * 3.0) * (${f(S.amp)} + ${f(S.ampRun)} * uSw) * tw * tw;
        transformed.y -= uLift * ${f(S.lag)} * tw * tw;`
    const ears = look.ears ? `float ew = smoothstep(0.84, 0.99, position.y) * (1.0 - smoothstep(0.15, 0.3, position.x));
        transformed.x += sin(uT * (2.3 + uSw * 7.0) + position.x * 9.0) * (0.012 + 0.014 * uSw) * ew;` : ''
    const head = T ? `float ha = smoothstep(${f(T.from)}, ${f(T.to)}, position.z) * uTilt * ${f(T.max)}; vec2 hd = transformed.xy - vec2(${f(T.px)}, ${f(T.py)});
        transformed.xy = vec2(${f(T.px)}, ${f(T.py)}) + vec2(cos(ha) * hd.x - sin(ha) * hd.y, sin(ha) * hd.x + cos(ha) * hd.y);` : ''
    // M126 s4: three keys a program by the TEXT of onBeforeCompile, the same for every species: without this key the second
    // species drawn is given the first one's compiled bends (scripts/m126-shader-check.mts saw it)
    for (const m of [skin, halo, eye, ...(glow ? [glow] : [])]) { m.customProgramCacheKey = () => `spiritBend|${m === skin || m === glow}|${tail}|${ears}|${head}`; m.onBeforeCompile = sh => {
      sh.uniforms.uT = time; sh.uniforms.uSw = sw; sh.uniforms.uLift = lift; sh.uniforms.uTilt = tiltU
      if (m === skin || m === glow) accUniforms(sh, acc)
      sh.vertexShader = 'uniform float uT; uniform float uSw; uniform float uLift; uniform float uTilt;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        ${tail}
        ${ears}
        ${head}`)
      // the warm rim light of the picked render: a bright gold fresnel line on the toon parts (not on the hull or eyes)
      if (m === skin || m === glow) sh.fragmentShader = ACC_HEAD + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.rgb += vec3(1.0, 0.86, 0.32) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * 0.45;
        ${ACC_FRAG}`)
    } }
    // grown-size slice: the low vertices (ground keep)
    const low = lowPoints([body, eyes, ...(glowM ? [glowM] : [])].flatMap(m => Array.from(m.geometry.getAttribute('position').array as ArrayLike<number>)), cx, cz)
    return { body: lin(body.geometry), eyes: eyes.geometry,   // eyes stay raw: their colours read brighter, as in the picked renders
      glowGeo: glowM ? lin(glowM.geometry) : null, skin, glow, halo, eye, cx, cz, low }
  }, [scene, time, look, acc])
  // M132 s2: a rigged spirit's body: her own bones + mixer, built and thrown away with her
  const [body, setBody] = useState<RigBody | null>(null), bodyRef = useRef<RigBody | null>(null), glowRef = useRef<THREE.MeshToonMaterial | null>(null)
  const step = useMemo(() => ({ x: NaN, z: 0, yaw: 0, v: 0, turn: 0, clip: 'idle' as RigClip, fly: GROUNDED as FlyState, sizeAt: -1, hWorld: 0, len: 0 }), [trot])
  useEffect(() => {
    if (!rig) return
    const rim = (m: THREE.Material) => { m.onBeforeCompile = sh => { accUniforms(sh, acc); sh.fragmentShader = ACC_HEAD + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.rgb += vec3(1.0, 0.86, 0.32) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * 0.45;
        ${ACC_FRAG}`) }; m.customProgramCacheKey = () => 'rigRimAcc' }
    const skin = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: look.skin.emissive, emissiveIntensity: look.skin.emissiveI })
    const glow = look.glow ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradTex(), emissive: look.glow.emissive, emissiveIntensity: look.glow.lo }) : null
    const halo = new THREE.MeshBasicMaterial({ color: look.hull.color, transparent: true, opacity: look.hull.opacity, side: THREE.BackSide, depthWrite: false, toneMapped: false })
    const eye = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    rim(skin); if (glow) rim(glow); hullPush(halo, rig.hull)
    const b = makeRigBody(gltf, rig, { skin, glow, halo, eye }, look.glow?.part)
    bodyRef.current = b; glowRef.current = glow; haloRef.current = halo; setBody(b)
    return () => { bodyRef.current = null; glowRef.current = null; haloRef.current = null; b.dispose(); for (const m of [skin, glow, halo, eye]) m?.dispose()
      // M213 fix: the gallery's one canvas outlives each spirit shown in it: free her GPU buffers as she goes (the geometry stays
      // cached and is uploaded again if she comes back)
      if (gallery) for (const m of Object.values(b.meshes)) m.geometry.dispose() }
  }, [gltf, look, rig, acc, gallery])
  // M204 s2: her accent's colour, and her translucent hull leaning to it (up to 0.6 of the way when locked); the probe reads it
  useEffect(() => {
    if (accent) { acc.c.value.setRGB(accent.rgb[0], accent.rgb[1], accent.rgb[2], THREE.SRGBColorSpace); acc.n.value = accent.n
      accent.slots.forEach((c, i) => acc.slots.value[i].setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace)) } else acc.n.value = 1
    const h = rig ? haloRef.current : parts?.halo
    if (h) { h.color.set(look.hull.color); if (accent) h.color.lerp(acc.c.value, 0.6 * accent.s) }
    if (id && !avatar) probe().accents[id] = accent ? { hex: accent.hex, s: accent.s, n: accent.n, locked: accent.locked } : null
  }, [accent, acc, body, parts, rig, look.hull.color, id, avatar])
  // M204 s2: her second form's effect (Vulnarc arcs, Vulnix bubbles + splash + shimmer, Vulnara's gold trail), beside her body
  useEffect(() => {
    if (!body || !rig || avatar || !fxOk || !isFxForm(look.name) || !g.current?.parent) return
    const f = makeSpiritFx(look.name, body.bones, look.h); g.current.parent.add(f.points); fx.current = f
    if (id) probe().fxs.set(id, f)
    return () => { fx.current = null; if (id) probe().fxs.delete(id); f.dispose() }
  }, [body, rig, avatar, fxOk, look.name, look.h, id])
  useEffect(() => { if (!id || !rig) return; return () => { probe().rigs.delete(id) } }, [id, rig])
  // M109 s1 FOLLOW: she walks with the keeper while her planter id is in the follow list (kept across reloads)
  useEffect(() => {
    if (!trot || !id || !dev) return
    // M126 s1: a following spirit takes her place in the one formation (shared/follow-formation.ts), spaced by her body
    const target = () => { tickFormation(keeperAt); return { x: keeperAt.x, z: keeperAt.z, yaw: keeperAt.yaw, slot: fightSlot(id) ?? fetchSlot(id) ?? skitSlot(id, keeperAt) ?? formationSlot(id) } }   // M141 s2: her fetch before her skit   // M127: a fight's spot first;   // M126 s2: idle = her skit's spot
    const sync = () => {
      const on = isFollowing(id)
      if (on && nav) joinFormation({ id, kind: 'spirit', r: bodyRadius(GROWN[sp] ?? { height: 0.5 }), blocked: (x, z) => (fnav && gardenGround() ? fnav.slotBlocked(x, z) : nav.blocked(x, z)), y: fnav ? (x, z, near) => (gardenGround() ? fnav.height(x, z, near) : null) : undefined })
      else leaveFormation(id)
      if (on) joinFetch(id, sp); else leaveFetch(id)   // M141 s2: only a following spirit fetches
      trot.follow(on ? target : null)
    }
    sync(); const off = subscribeFollow(sync)
    return () => { off(); spiritLive.delete(id); leaveFormation(id); leaveFetch(id) }
  }, [trot, id, dev, nav, sp, fnav])
  // M109 s4 THE PARTY KEEPS NEAR: while her planter id is in the party she picks her runs round the keeper (loose company)
  useEffect(() => {
    if (!trot || !id || !dev) return
    const sync = () => trot.near(inParty(id) ? () => keeperAt : null)
    sync(); return subscribeParty(sync)
  }, [trot, id, dev])
  // M110 s1 TRAINING: a play she chose and finished at a training piece adds its small gain to HER stat record (planter id)
  useEffect(() => {
    if (!trot || !id || !dev) return
    trot.onPlayed((toy, stat) => { if (isTrainStat(stat)) trainPlay(id, sp, stat, toy) })   // M118 s2: only where she is assigned
    return () => trot.onPlayed(null)
  }, [trot, id, sp, dev])
  useEffect(() => { if (avatar) return; const p = probe(), u = look.url; p.mounted++; p.species[sp] = (p.species[sp] ?? 0) + 1; p.urls[u] = (p.urls[u] ?? 0) + 1
    return () => { p.mounted--; p.species[sp]--; if (!--p.urls[u]) delete p.urls[u]; if (!p.species[sp]) delete p.trots[sp]; if (!p.species.fox) p.trot = undefined } }, [sp, avatar, look.url])
  useFrame(({ clock, gl }, dt) => {
    const t = clock.elapsedTime; time.value = t
    acc.s.value = accentAt(accent, t); acc.t.value = t
    if (fx.current) fx.current.update(t, Math.min(1, step.v / Math.max(0.1, look.h * 1.5)), gl.domElement.height)
    if (parts?.glow && look.glow) { const G = look.glow; parts.glow.emissiveIntensity = G.lo + (G.hi - G.lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * G.hz)) }
    if (glowRef.current && look.glow) { const G = look.glow; glowRef.current.emissiveIntensity = G.lo + (G.hi - G.lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * G.hz)) }
    if (!g.current) return
    if (!trot && rig && gallery) {   // M213: the gallery plays the clip it is told, walk / run on the spot at the clip's own pace
      const c = clip ?? 'idle', bd = bodyRef.current, gait = c === 'walk' || c === 'run' ? c : null
      step.v = gait ? rig.clipV[gait] * look.h : 0
      if (bd) { bd.step(dt, c, step.v * dt, look.h, { look: 0, sniff: 0, tilt: 0 })
        if (id) probe().rigs.set(id, { id, sp, h: look.h, yaw: 0, x: 0, y: 0, z: 0, mode: c, v: step.v, alt: 0, body: bd }) }
      return
    }
    if (!trot && rig) bodyRef.current?.step(dt, 'idle', 0, look.h, { look: 0, sniff: 0, tilt: 0 })
    if (trot && g.current.parent) {
      // the pose is in WORLD xz + yaw; the planter piece may be turned, so read through the parent's transform
      if (dev && id && spiritCheer.delete(id)) trot.cheer(() => keeperAt)   // M109 s2: fed
      if (dev && id && spiritCall.delete(id)) trot.call(() => keeperAt)   // M109 s3: called home
      const ps = id && spiritHeld.id === id ? trot.pose() : trot.step(dt), par = g.current.parent, { v, q, e } = tmp   // M109: held while talked to
      par.updateWorldMatrix(true, false); par.getWorldPosition(v); const baseY = v.y
      const breath = rig || ps.swing > 0 ? 0 : Math.sin(t * 2.2) * 0.015
      const roll = rig ? ps.wig : ps.roll + (look.tilt ? 0 : ps.tilt * 0.12)
      // M132 s2 rigged: her bones do the look round, the sniff, the tilt, the lying down and the breath, so her body stays level
      // on its feet (no tip, no squash) and turns only the way she walks
      const pitch = rig ? 0 : ps.pitch, bodyYaw = rig ? ps.yaw - ps.look : ps.yaw, sy = rig ? 1 - 0.14 * ps.brace : ps.sy, sx = rig ? 1 : ps.sx
      // grown-size slice: raise her by however far the tip would sink her lowest paw / tail / chin (0 standing level)
      const keep = parts ? groundLift(parts.low, look.h, pitch, roll, sx, sy + breath) : 0
      // M126: her floor while she follows (kept if she is told to stay up there); her own ground otherwise
      if (fnav && gardenGround()) {
        if (id && isFollowing(id)) fnav.stand(ps.x, ps.z); else if (!nav!.blocked(ps.x, ps.z)) fnav.put(baseY)
        if (Number.isNaN(tmp.fy)) tmp.fy = fnav.y() - baseY
        tmp.fy += (fnav.y() - baseY - tmp.fy) * (1 - Math.exp(-dt * 14)); if (Math.abs(tmp.fy) < 1e-3) tmp.fy = 0
      }
      const floor = Number.isNaN(tmp.fy) ? 0 : tmp.fy
      // M173: a flier's height while she travels (0 for a walker); the hold = whatever is walking through her (the deadzone)
      if (rig?.fly) { let near = Math.hypot(keeperAt.x - ps.x, keeperAt.z - ps.z)
        for (const o of spiritLive.values()) if (o.id !== id && Date.now() - o.at < 500) near = Math.min(near, Math.hypot(o.x - ps.x, o.z - ps.z))
        step.fly = flyStep(step.fly, rig.fly, travels(step.clip, ps.mode) && step.v > rig.runAt[1], near, dt) }
      const alt = step.fly.alt, fl = id ? fetchLift(id) : 0   // M141 s3: a hop's arc, a swoop's dive, a pluck's dip
      v.set(ps.x, baseY + floor + ps.y + keep + alt + fl, ps.z); par.worldToLocal(v); g.current.position.copy(v)
      par.getWorldQuaternion(q); e.setFromQuaternion(q)
      // a species with no head bend (none yet; the Vulnyx carries no tilt beat) would tip the whole body instead
      g.current.rotation.set(pitch, bodyYaw - e.y, roll, 'YXZ')
      tiltU.value = ps.tilt
      g.current.scale.set(sx, sy + breath, sx)
      const bd = bodyRef.current
      if (rig && bd) {
        // the feet cover the ground she really covered this frame (spirit-rig.ts)
        const dyaw = Math.atan2(Math.sin(bodyYaw - step.yaw), Math.cos(bodyYaw - step.yaw)), fresh = Number.isNaN(step.x), k = 1 - Math.exp(-dt * 14)
        const m = fresh ? 0 : groundMoved(ps.x - step.x, ps.z - step.z, bodyYaw, dyaw), travel = fresh ? 0 : Math.min(1.5, Math.hypot(ps.x - step.x, ps.z - step.z))
        step.v += (travel / Math.max(dt, 1e-3) - step.v) * k; step.turn += ((fresh ? 0 : Math.abs(dyaw)) / Math.max(dt, 1e-3) - step.turn) * k
        step.x = ps.x; step.z = ps.z; step.yaw = bodyYaw
        step.clip = rigClip(ps, step.v, step.turn, step.clip, rig.runAt, rig.lie)
        if (rig.fly) step.clip = flyClip(step.clip, alt + Math.max(0, fl))   // M141 s3: lifted by her fetch = on the wing
        bd.step(dt, step.clip, m, look.h, { look: ps.look, sniff: ps.sniff, tilt: ps.tilt })
        if (t - step.sizeAt > 0.5 && step.clip !== 'sit' && step.clip !== 'lie' && bd.state().w.sit + bd.state().w.lie < 0.01 && !(rig.fly && bd.state().w.run > 0.01)) { step.sizeAt = t; const s = bd.size(look.h); step.hWorld = s.height; step.len = s.len }
        if (id) probe().rigs.set(id, { id, sp, h: look.h, yaw: bodyYaw, x: ps.x, y: baseY + floor + ps.y, z: ps.z, mode: ps.mode, v: step.v, alt, body: bd })
      }
      sw.value += (ps.swing - sw.value) * Math.min(1, dt * 6); lift.value = ps.lift
      // the measured world height (the drawn meshes' box, hull included) for the check, twice a second
      if (!rig && t - tmp.hAt > 0.5) { tmp.hAt = t; const s = tmp.bb.setFromObject(g.current); tmp.hWorld = s.max.y - s.min.y; tmp.keepMax = Math.max(tmp.keepMax, keep)
        // grown-size slice: her nose-to-tail length off the scene box too, measured with her squared to the world axes (yaw
        // undone against the planter's turn, pitch / roll zeroed) and put straight back the same frame
        const r0 = g.current.rotation.clone(); g.current.rotation.set(0, -e.y, 0, 'YXZ'); g.current.updateMatrixWorld(true)
        const sq = tmp.bb.setFromObject(g.current); tmp.lWorld = look.sway.along === 'z' ? sq.max.z - sq.min.z : sq.max.x - sq.min.x
        g.current.rotation.copy(r0); g.current.updateMatrixWorld(true) }
      const pr = probe(), tp: TrotProbe = { x: ps.x, y: baseY + floor + ps.y, z: ps.z, mode: ps.mode, home: nav!.home, rMin: nav!.rMin, rMax: nav!.rMax, beats: trot.beats(), homes: trot.homes(), tilt: ps.tilt, h: look.h, hWorld: rig ? step.hWorld : tmp.hWorld, len: rig ? step.len : tmp.lWorld, keepMax: tmp.keepMax, cheers: trot.cheers(), calling: trot.calling(), near: trot.nearing(), plays: trot.plays(), playing: trot.playing(),
        playYMax: ps.mode === 'play' ? Math.max(pr.trots[sp]?.playYMax ?? 0, ps.y) : (pr.trots[sp]?.playYMax ?? 0),   // M110 s1: the bound's peak
        braceMax: Math.max(pr.trots[sp]?.braceMax ?? 0, trot.braced()),   // M110 s2: the shove's lean / the guard's crouch, at its deepest
        yMax: ps.mode === 'happy' ? Math.max(pr.trots[sp]?.mode === 'happy' ? pr.trots[sp].yMax : 0, ps.y) : (pr.trots[sp]?.yMax ?? 0) }   // M109 s2: the happy beat's peak hop
      pr.trots[sp] = tp; if (sp === 'fox') pr.trot = tp
      // M109: the E pick reads it. M173 s2: a hoverer is picked (and shoots) where she hangs, not at her feet
      const hov = rig?.hover
      if (dev && id) spiritLive.set(id, { id, sp, x: ps.x, y: baseY + floor + ps.y + alt + fl + (hov ? hov.low * look.h : 0), z: ps.z, h: hov ? (hov.top - hov.low) * look.h : look.h, at: Date.now() })
      if (id && inFormation(id)) reportFormationPos(id, ps.x, ps.z)   // M126 s1: the probe's real spacing
      return
    }
    g.current.position.y = Math.sin(t * 1.4) * 0.02 * look.h / 0.55
    g.current.scale.set(1, 1 + Math.sin(t * 2.2) * 0.015, 1)   // breath
    g.current.rotation.y = Math.sin(t * 0.35) * 0.45            // a slow look round
  })
  const H = look.h
  if (rig) {
    // the panel's copy turns round her middle (the tail is half of her), the garden's round her feet
    const pz = avatar || gallery ? rig.avatar.z : rig.pivot.z
    return <group ref={g} name={`spirit-model-${look.name}`} userData={{ spiritModel: look.name, rigged: true }}>
      {/* M224: the gallery drops her by avatar.y too, as the panel does: a hover rig's glb hangs her body ~4 units up (Hovari line,
          Luminara), so the gallery drew her above its camera's view and showed neither model nor art */}
      {body && <group scale={H} position={[-rig.pivot.x * H, avatar || gallery ? -(rig.avatar.y ?? 0) * H : 0, -pz * H]}><primitive object={body.root} /></group>}
    </group>
  }
  if (!parts) return null
  return (
    <group ref={g} name={`spirit-model-${look.name}`} userData={{ spiritModel: look.name }}>
      <group scale={H} position={[-parts.cx * H, 0, -parts.cz * H]}>
        <mesh geometry={parts.body} material={parts.skin} />
        <mesh geometry={parts.body} material={parts.halo} scale={1.06} position={[-parts.cx * 0.06, -0.03, -parts.cz * 0.06]} />
        {parts.glowGeo && parts.glow && <>
          <mesh geometry={parts.glowGeo} material={parts.glow} />
          <mesh geometry={parts.glowGeo} material={parts.halo} scale={1.06} position={[-parts.cx * 0.06, -0.03, -parts.cz * 0.06]} />
        </>}
        <mesh geometry={parts.eyes} material={parts.eye} />
      </group>
    </group>
  )
}

/** The species' model stood on a bloomed planter (null look = the caller shows the orb); `fallback` (the gold orb) shows
 *  while the glb loads. With `nav` (M107) it trots its own manner round home: the group sits at the ground and the perch
 *  height comes from `nav.perch`. */
export function SpiritOnPlanter({ sp, look, y, fallback, nav, id, dev, meals }: { sp: Species; look: SpiritLook; y: number; fallback: ReactNode; nav?: SpiritNav; id?: string; dev?: boolean
  /** M204 s2: her bar (the pot's meals) = her glow accent */ meals?: readonly unknown[] }) {
  const L = rigLook(sp, look, useSpiritRig())
  return <Suspense fallback={fallback}><group position-y={nav ? 0 : y}><SpiritModel key={L.url} sp={sp} look={L} nav={nav} id={id} dev={dev} meals={meals} /></group></Suspense>
}

/** M109 s1: the spirit panel's AVATAR: her live model (the same SpiritModel, idle: bob + breath + look round) on a slow
 *  turntable in its own small canvas. Framed by the species' height, so a heel-high Manalotl fills it like the Vulnyx. */
function Turntable({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.5 })
  return <group ref={g}>{children}</group>
}
export function SpiritAvatar({ sp, look, size, meals }: { sp: Species; look: SpiritLook; size: number; /** M204 s2: her bar = her accent */ meals?: readonly unknown[] }) {
  const L = rigLook(sp, look, useSpiritRig()), h = L.h, far = L.rig?.avatar.far ?? 1   // M132 s2: rigged she is long (tail behind), so the camera stands back
  return (
    <div data-spirit-avatar={sp} data-spirit-accent={accentOf(meals)?.hex ?? ''} style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', flex: 'none',
      background: 'radial-gradient(circle at 50% 42%, rgba(255,236,190,.55), rgba(58,39,22,.18) 72%)' }}>
      <Canvas key={L.url} dpr={[1, 1.5]} frameloop="always" gl={{ antialias: true, alpha: true }} camera={{ position: [0, h * 0.7 * far, h * 2.4 * far], fov: 32 }}
        onCreated={({ camera }) => camera.lookAt(0, h * 0.45, 0)}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[1.5, 3, 2.5]} intensity={1.3} />
        <Suspense fallback={null}><Turntable><SpiritModel sp={sp} look={L} avatar meals={meals} /></Turntable></Suspense>
      </Canvas>
    </div>
  )
}

/** M213 THE /dev SPIRIT GALLERY'S STAGE: the very SpiritModel the game mounts (her glb, rig, materials, form fx, glow accent), centred
 *  on a plain floor with orbit + zoom, playing the clip it is given. `meals` = the bar that lights her accent (none = no accent).
 *  M213 fix: ONE canvas (one WebGL context) for the whole gallery: a new spirit swaps the model inside it and re-frames the camera.
 *  A canvas per spirit lost each old context only 500 ms after unmount, so quick switches stacked contexts up (Alex's tab died).
 *  `look` null = an unbuilt form: the canvas stays, empty, under the gallery's locked art. */
/** M249: `scale` sizes her about her feet (the gallery's size slider), `frame` = the height the camera frames (else her own), and
 *  `children` stand on the same stage (the gallery's keeper + ruler). */
export function SpiritStage({ sp, look, clip, meals, scale = 1, frame, children }: { sp: Species; look: SpiritLook | null; clip: RigClip; meals?: readonly unknown[]
  scale?: number; frame?: number; children?: ReactNode }) {
  const on = useSpiritRig(), L = look ? rigLook(sp, look, on) : null, h = frame ?? (L?.h ?? 0.5) * scale, far = L?.rig?.avatar.far ?? 1
  return (
    <Canvas data-spirit-stage={L?.name ?? ''} dpr={[1, 2]} frameloop="always" gl={{ antialias: true, alpha: true }}
      camera={{ position: [h * 1.3 * far, h * 0.9 * far, h * 2.4 * far], fov: 32, near: 0.01, far: 100 }}>
      <StageFrame h={h} far={far} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[1.5, 3, 2.5]} intensity={1.3} />
      {L && <mesh rotation-x={-Math.PI / 2} position-y={-0.002}><circleGeometry args={[h * 1.6 * far, 48]} /><meshBasicMaterial color="#3a2a1c" transparent opacity={0.55} /></mesh>}
      {L && <group scale={scale} name="gallery-spirit"><Suspense fallback={null}><SpiritModel key={L.url} sp={sp} look={L} gallery clip={clip} id="gallery" meals={meals} /></Suspense></group>}
      {children}
      <OrbitControls makeDefault target={[0, h * 0.45, 0]} enablePan={false} minDistance={h * 0.6} maxDistance={h * 10 * far} />
    </Canvas>
  )
}
/** M233 v2a: a spirit in the CLASH RING (clash-ring.tsx): the same SpiritModel, centred like the gallery's copy and playing the
 *  clip it is given on the spot; the ring's group moves and turns her. Mount inside a Canvas. */
export function SpiritFigure({ sp, look, clip }: { sp: Species; look: SpiritLook; clip: RigClip }) {
  const L = rigLook(sp, look, useSpiritRig())
  return <Suspense fallback={null}><SpiritModel key={L.url} sp={sp} look={L} gallery clip={clip} /></Suspense>
}
/** the gallery camera framed on a new spirit (her height, her rig's step back), as a fresh canvas used to be */
function StageFrame({ h, far }: { h: number; far: number }) {
  const camera = useThree(s => s.camera), controls = useThree(s => s.controls) as { target: THREE.Vector3; update: () => void } | null
  useEffect(() => { camera.position.set(h * 1.3 * far, h * 0.9 * far, h * 2.4 * far); controls?.target.set(0, h * 0.45, 0); controls?.update() }, [camera, controls, h, far])
  return null
}
