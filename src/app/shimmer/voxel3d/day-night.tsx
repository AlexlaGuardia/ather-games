'use client'
// The voxel world's sky — the clock made visible.
//
// ★ THE CLOCK IS `engine/day-cycle.ts`, IMPORTED UNCHANGED (port step 4, same move as skills/tools/
// weapons: it has no reference to zones, tiles or grids, so moving the world out from under it costs
// nothing). One clock for the whole game: the garden's dusk and this world's dusk are the same dusk,
// two people standing in either are in the same hour, and `?hour=19` pins both for an art pass.
//
// ── What this drives vs what the light FIELD drives ──────────────────────────────────────────
// This file is the LOOK: scene lights, sky, fog. `voxel/light.ts` is the DATA: per-voxel sky/block
// channels for the spawn gate, deliberately not fed into any mesh (see its header — per-voxel light
// as a vertex attribute breaks greedy meshing). The two meet only at the clock: the spawn cycle
// reads `dayFactor(dayProgress())`, this rig reads `daylight(dayProgress())`. Their dark windows
// line up within minutes (daylight bottoms ~18:51, dayFactor at 19:12), which is close enough that
// "it looks like night" and "the night tide has range" agree to the eye.
//
// ── The night is authored, not computed ──────────────────────────────────────────────────────
// Canon rule (design-briefs/shimmer-garden-atmosphere.md, ruled 2026-07-21): *"night is NOT grey.
// It is a hue shift, not a drop toward grey."* So night here is a hand-picked saturated deep blue
// with a silver moon, lerped against the day palette — never a brightness multiplier on the day
// look, which is exactly the "darken and desaturate" failure the brief names. The DAY palette is
// today's shipped values verbatim (bg #8fb7d9, hemi 1.5, dir 1.5, amb 0.4): noon must not change
// under Alex just because the sky learned to move.
//
// ── Two key lights, not one repositioned ─────────────────────────────────────────────────────
// The sun tracks its real path (azimuth/elevation off the same curve the garden uses); the moon is
// parked high and silver. Each has its own intensity curve, so the handover is a crossfade. A single
// light that flips from the western horizon to the eastern one at sundown pops every face's shading
// on one frame — the exact hard-switch `dayFactor`'s ramp exists to avoid, wearing a lighting hat.

import { useRef, useLayoutEffect, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { dayProgress, daylight, sunElevation, sunAzimuth } from '../engine/day-cycle'
import { UNDER, fogUnder, domeVeil, stepUnder, newUnderState } from './underwater'

// ── The sky dome (2026-08-08, Alex: "add a sky background… sun cycle but no moon in the Ather") ──
// A camera-following inverted sphere with the whole sky in ONE fragment shader: vertical gradient
// (horizon → zenith, both lerped by the same day/night clock as everything else), plus the sun —
// a crisp disc and a halo that widens and warms as the sun drops, so dawn/dusk read at the horizon
// where blocks can't. Drawing the sun IN the sky shader instead of as a billboard costs nothing
// per frame, can never sort wrong against the world, and sets below the horizon for free (the
// disc rides the RAW elevation; the directional light keeps its clamped park).
// Clouds are deliberately absent — held for their own pass (Alex, same ruling).
// ⚠ NO MOON. The Ather has no moon (Alex ruling 2026-08-08, logged in CANON_GAPS — what silvers
// the night is Magii's to name). The night dome is gradient + nothing; the silver night LIGHT
// below survives because an unlit renderer is a fail state, but it is no longer lunar fiction.
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uDay;   // daylight(), 1 noon .. 0 midnight
  uniform float uWarm;  // low-sun warmth, peaks in the twilight band, 0 at noon and at night
  // ★ THE DOME SETS fog:false, SO SCENE FOG CANNOT HIDE IT — every other atmosphere effect here
  // gets away with that because gloom and mist both leave you standing under open sky. Underwater
  // it is the one thing that would read as a renderer fault: the world closed to arm's length with
  // a bright blue sky still overhead. So the veil is applied in the shader, last, over everything
  // including the sun disc.
  uniform vec3 uWater; uniform float uVeil;
  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, pow(up, 0.6));
    float s = clamp(dot(d, normalize(uSunDir)), 0.0, 1.0);
    float disc = smoothstep(0.99935, 0.99965, s);
    float halo = pow(s, 90.0) * 0.30 * uDay + pow(s, 7.0) * 0.22 * uWarm;
    vec3 col = sky + uSun * (halo + disc * (0.9 * uDay + 0.35 * uWarm));
    col = mix(col, uWater, uVeil);
    gl_FragColor = vec4(col, 1.0);
  }
`
const SKY = {
  day: { zenith: '#6f9fd0', horizon: '#c9dff0' },
  night: { zenith: '#101a33', horizon: '#2a3a63' },
  sunHigh: '#fff4d6', sunLow: '#ffb45e',
}

// Day = the pre-clock look, verbatim. Night = the Ather's own hour: darker than the garden's
// Moonwell blue (this is untended country and darkness is about to mean something), but with a
// real floor — hemisphere and ambient never reach zero, because "you can't see" is a fail state
// the SPAWN layer is allowed to threaten and the renderer is not.
const DAY = {
  bg: '#8fb7d9', fogNear: 80, fogFar: 200,
  hemiSky: '#cfe6ff', hemiGround: '#3b3a4a', hemiIntensity: 1.5,
  sun: '#ffffff', sunIntensity: 1.5,
  ambient: 0.4,
}
const NIGHT = {
  bg: '#16223f', fogNear: 55, fogFar: 165,   // the dark stands closer — same world, smaller circle
  hemiSky: '#8ea8d8', hemiGround: '#252c47', hemiIntensity: 0.55,
  // ⚠ NOT A MOON. The Ather has no moon (Alex ruling 2026-08-08). This is the night's silver —
  // an authored illumination floor, because "you can't see" belongs to the spawn layer, never the
  // renderer. What the silver IS in-fiction (starlight? the Shimmer?) is an open canon gap.
  silver: '#cfe0ff', silverIntensity: 0.4,
  ambient: 0.15,
}

// ── ★ CANOPY GLOOM (2026-08-08 — "closed canopy, dim floor", the Thicket's ruled character) ────
// Under dense canopy the world dims and closes in: sun mostly gone (a canopy's whole job), sky
// light pulled toward light-through-leaves green, fog drawn near so the trees crowd you. The
// factor arrives via the `gloomAt` prop (the world samples its own forest mask — this file stays
// ignorant of worldgen), is SMOOTHED over ~half a second so walking under an edge reads as
// entering shade rather than a light switch, and is GATED BY DAYLIGHT: a canopy blocks sun, and
// at night there is little sun to block — which is also what keeps gloom from stacking on night
// down through the renderer's never-fully-dark floor. Dial block:
const GLOOM = {
  sunCut: 0.8,       // direct sun killed hardest — shafts are the ungloomed clearings' job
  hemiCut: 0.45,
  ambCut: 0.3,
  fogPull: 0.45,     // near/far both shrink by this × gloom
  leaf: '#4e6b48',   // what skylight becomes after a canopy: mossy, not grey (the night rule again)
  fogLeaf: '#3c5238',
  rate: 2.5,         // smoothing, ~1/s to settle
}

// ── ★ MIST PATCHES (2026-08-09 — see voxel/mist.ts for what they ARE) ──────────────────────────
// Standing in one, the world closes to arm's length and goes gold. Same lever as the gloom above
// and DELIBERATELY not the same rules, in two ways that matter:
//
//  1. NOT DAYLIGHT-GATED. A canopy dims by blocking sun, so gloom scales with `dl` and correctly
//     does nothing at night. Mist is not a shadow — it is mana made visible, it EMITS. It has to
//     hold at noon (that is the whole read) and at midnight, so it multiplies nothing by daylight.
//  2. IT BRIGHTENS WHERE GLOOM DIMS. The hemisphere light goes UP inside a patch, because a
//     glowing fog lights its own inside. Cutting light here — the reflex, copied from gloom —
//     produced a grey-brown murk that read as a dust storm.
//
// The fog pull is hard on purpose: it is what walls the patch, so the spar has a room to happen in
// without a single piece of geometry. Free arena, and a diegetic one.
const MIST = {
  fogPull: 0.72,     // near/far shrink by this × thickness — the wall
  hemiLift: 0.5,     // skylight GAINS this fraction: the fog is luminous, not shade
  sunCut: 0.35,      // direct sun scatters in it, so shadows go soft rather than dark
  gold: '#ffe9b8',   // canon's own word for it — golden mist, luminous mana
  fogGold: '#e8cf95',
  rate: 1.6,         // smoothing; slower than gloom so walking in is a gather, not a switch
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * ── ★★ THE DOME WRITES LINEAR AND NOTHING RE-ENCODES IT. MEASURED, NOT DEDUCED ────────────────
 *
 * Every other material in the world is a built-in one, so three appends `colorspace_fragment` and
 * its colours reach the screen sRGB-encoded. This dome is a raw `ShaderMaterial` writing
 * `gl_FragColor` itself, so whatever `THREE.Color` holds — which is LINEAR working space, because
 * `new THREE.Color('#rrggbb')` converts on the way in — is what lands in the framebuffer, un-encoded
 * and therefore dark.
 *
 * ⚠ THIS IS PRE-EXISTING AND IT IS NOT A BUG TO FIX HERE. It has been true since the dome shipped
 * (2026-08-08) and it means the sky's EFFECTIVE palette is the linear one — measured at noon, the
 * upper sky renders (82,126,184) where the `#6f9fd0` zenith would give (111,159,208). Alex judged
 * and approved the sky as it actually renders, so "correcting" the encode would silently restyle a
 * ruled look. Left alone deliberately; logged for him instead.
 *
 * ★ BUT IT BREAKS ANY COLOUR THAT HAS TO AGREE WITH SOMETHING OUTSIDE THE DOME. The underwater
 * veil does: scene fog paints the same water colour onto terrain through a built-in material,
 * which DOES encode. One frame contained both — 39,750 px of dome at (6,41,58) against 2,292 px of
 * fogged geometry at (43,111,131), one colour rendered two ways, with the wrong one covering most
 * of the screen. So the veil colour is pushed in PRE-ENCODED: reading the hex as though it were
 * already linear means no conversion happens and the sRGB numbers reach the framebuffer intact.
 */
function domeColor(hex: string): THREE.Color {
  return new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace)
}

/** Preallocated colour pairs — this mutates live objects inside useFrame, so no per-frame `new`. */
function makePairs() {
  const pair = (d: string, n: string) => ({ d: new THREE.Color(d), n: new THREE.Color(n), out: new THREE.Color() })
  return {
    bg: pair(DAY.bg, NIGHT.bg), hemiSky: pair(DAY.hemiSky, NIGHT.hemiSky), hemiGround: pair(DAY.hemiGround, NIGHT.hemiGround),
    zenith: pair(SKY.day.zenith, SKY.night.zenith), horizon: pair(SKY.day.horizon, SKY.night.horizon),
    sun: pair(SKY.sunHigh, SKY.sunLow),
    leaf: pair(GLOOM.leaf, GLOOM.leaf), fogLeaf: pair(GLOOM.fogLeaf, GLOOM.fogLeaf),
    gold: pair(MIST.gold, MIST.gold), fogGold: pair(MIST.fogGold, MIST.fogGold),
    // Underwater has NO day/night pair, and that is the design rather than an omission: water is a
    // medium, not weather, so it does not take a palette from the hour. See `underwater.ts` §4.
    water: new THREE.Color(UNDER.water), underSky: new THREE.Color(UNDER.sky),
  }
}
const lerpInto = (p: { d: THREE.Color; n: THREE.Color; out: THREE.Color }, t: number) => p.out.copy(p.d).lerp(p.n, t)

export function VoxelDayNight(
  { gloomAt, mistAt, underwaterAt }: {
    gloomAt?: (x: number, z: number) => number
    /** Mist thickness 0..1 at a position — same prop shape as `gloomAt`, and the world supplies it
     *  so this file stays ignorant of worldgen. Sampled EVERY frame, unlike gloom: a patch is ~52
     *  blocks across where the canopy mask is a region, so gloom's 4Hz clock would step visibly. */
    mistAt?: (x: number, z: number) => number
    /** How submerged the CAMERA is, 0..1 — or **null** for "the world could not say", which is the
     *  honest answer at an unloaded frontier and means HOLD. Takes a y as well as x/z because this
     *  is the one atmosphere lever that is about a height: see `underwater.ts` on why the eye and
     *  the body are different questions. Same ignorance contract as the two above — the world
     *  supplies it, this file never learns what a water block is. */
    underwaterAt?: (x: number, y: number, z: number) => number | null
  } = {},
) {
  const { scene, camera } = useThree()
  const pairs = useRef(makePairs())
  /** Smoothed canopy gloom 0..1 and its sampling clock (the mask is ~16-block features, so 4Hz
   *  sampling is already oversampling — the smoothing is what the eye actually sees). */
  const gloom = useRef({ g: 0, target: 0, clock: 0 })
  /** Smoothed mist thickness. Smoothed for the same reason gloom is: the field is continuous but
   *  the camera is not, and a hard step in fog density reads as a graphics bug. */
  const mist = useRef({ m: 0 })
  /** Submersion + the crossing wash. Smoothing lives in `stepUnder` because the crossing cue has
   *  to key off the EASED value — a rippling surface flickers the raw target and would otherwise
   *  machine-gun the wash while you tread. */
  const under = useRef(newUnderState())
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const nightRef = useRef<THREE.DirectionalLight>(null)
  const ambRef = useRef<THREE.AmbientLight>(null)
  const fogRef = useRef<THREE.Fog | null>(null)
  const skyRef = useRef<THREE.Mesh>(null)

  // One material, one dome, built once — uniforms are mutated per frame, never reconstructed
  // (the render-audit rule: no GPU resource construction anywhere that runs more than once).
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    uniforms: {
      uZenith: { value: new THREE.Color(SKY.day.zenith) },
      uHorizon: { value: new THREE.Color(SKY.day.horizon) },
      uSun: { value: new THREE.Color(SKY.sunHigh) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0.4) },
      uDay: { value: 1 }, uWarm: { value: 0 },
      uWater: { value: domeColor(UNDER.water) }, uVeil: { value: 0 },
    },
    side: THREE.BackSide, depthWrite: false, fog: false,
  }), [])
  useEffect(() => () => skyMat.dispose(), [skyMat])

  // Own background + fog imperatively (the GardenAtmosphere pattern): mutating live objects keeps
  // the whole sky off React's render path. Restore on unmount so the route swaps clean.
  useLayoutEffect(() => {
    const prevBg = scene.background
    const prevFog = scene.fog
    const fog = new THREE.Fog(DAY.bg, DAY.fogNear, DAY.fogFar)
    scene.background = new THREE.Color(DAY.bg)
    scene.fog = fog
    fogRef.current = fog
    return () => { scene.background = prevBg; scene.fog = prevFog; fogRef.current = null }
  }, [scene])

  useFrame((_state, dt) => {
    const p = dayProgress()
    const dl = daylight(p)          // 1 noon .. 0 midnight, soft twilight band
    const sv = 1 - dl
    const P = pairs.current

    // ── canopy gloom: sample sparsely, smooth always, gate by daylight ───────────────────────
    const G = gloom.current
    if (gloomAt) {
      G.clock -= dt
      if (G.clock <= 0) { G.clock = 0.25; G.target = gloomAt(camera.position.x, camera.position.z) }
      G.g += (G.target - G.g) * Math.min(1, dt * GLOOM.rate)
    }
    const gd = G.g * dl             // gloom's active strength — a canopy only blocks what shines

    // ── mist: smoothed, and NOT gated by daylight (it emits; see the MIST block) ───────────────
    const M = mist.current
    if (mistAt) M.m += (mistAt(camera.position.x, camera.position.z) - M.m) * Math.min(1, dt * MIST.rate)
    const md = M.m

    // ── underwater: sampled at the CAMERA, which is the whole trick ────────────────────────────
    // `camera.position` IS the eye, so asking the rig is asking the right question by construction.
    // The nearby wrong question — `locomotion`'s `submerged` — is a BODY predicate (chest+feet) and
    // disagrees with the eye for the whole of treading. Don't route this through the player.
    const U = under.current
    stepUnder(U, underwaterAt ? underwaterAt(camera.position.x, camera.position.y, camera.position.z) : 0, dt)
    const ut = U.t

    const bg = scene.background
    if (bg instanceof THREE.Color) bg.copy(lerpInto(P.bg, sv)).lerp(P.water, ut)
    const fog = fogRef.current
    if (fog) {
      // Fog dissolves into the dome's HORIZON band now, not the flat bg — the terrain edge and
      // the sky meet in the same colour, which is what makes the dome read as distance.
      // Water lands LAST and lerps to an absolute: gloom and mist thicken the air you are looking
      // through and compose with each other, water REPLACES the medium. See `underwater.ts` §4 —
      // otherwise the same pond is a different pond at midnight under a canopy.
      fog.color.copy(lerpInto(P.horizon, sv)).lerp(lerpInto(P.fogLeaf, sv), 0.6 * gd)
        .lerp(lerpInto(P.fogGold, sv), 0.85 * md).lerp(P.water, ut)
      // The two pulls MULTIPLY rather than add: a mist patch in the Thicket should be the thickest
      // air in the game, and adding two fractions of the same distance would let them cancel out
      // into something milder than either — the one place the world must feel closed.
      const pull = (1 - GLOOM.fogPull * gd) * (1 - MIST.fogPull * md)
      const w = fogUnder(mix(DAY.fogNear, NIGHT.fogNear, sv) * pull,
                         mix(DAY.fogFar, NIGHT.fogFar, sv) * pull, ut, U.surge)
      fog.near = w.near
      fog.far = w.far
    }

    // ── the dome ─────────────────────────────────────────────────────────────────────────────
    const sky = skyRef.current
    if (sky) {
      sky.position.copy(camera.position)   // the horizon is unreachable by construction
      const e = sunElevation(p)
      const u = skyMat.uniforms
      ;(u.uZenith.value as THREE.Color).copy(lerpInto(P.zenith, sv))
      ;(u.uHorizon.value as THREE.Color).copy(lerpInto(P.horizon, sv))
      // Warmth peaks as the sun crosses the horizon band and is zero at noon and at night —
      // dl gates it so the same low elevation before dawn doesn't pre-warm the dark.
      const warm = dl * (1 - Math.min(1, Math.max(0, e) / 0.3))
      ;(u.uSun.value as THREE.Color).copy(lerpInto(P.sun, warm))
      // RAW elevation: the disc genuinely sets. The z lean matches the light's fixed 90/220 tilt
      // so the disc hangs where the shadows say the sun is.
      ;(u.uSunDir.value as THREE.Vector3).set(sunAzimuth(p), e, 0.41)
      u.uDay.value = dl
      u.uWarm.value = warm
      u.uVeil.value = domeVeil(ut)
    }
    const hemi = hemiRef.current
    if (hemi) {
      // Skylight under a canopy arrives leaf-filtered: pulled toward the moss green, never
      // toward grey (the same rule the night palette obeys — hue shift, not desaturation).
      hemi.color.copy(lerpInto(P.hemiSky, sv)).lerp(lerpInto(P.leaf, sv), 0.5 * gd)
        .lerp(lerpInto(P.gold, sv), 0.7 * md)
      hemi.groundColor.copy(lerpInto(P.hemiGround, sv)).lerp(lerpInto(P.gold, sv), 0.45 * md)
      // Gloom CUTS, mist LIFTS — a luminous fog lights its own inside. See the MIST block.
      hemi.color.lerp(P.underSky, ut)
      hemi.groundColor.lerp(P.underSky, ut)
      // Water LIFTS skylight like mist does, for the same reason and a canon one: `shimmer-
      // skilling.md` rules the Ather's waters "still, luminescent, and peaceful". Real water
      // attenuates, so realism and canon point opposite ways here and canon wins — going under is
      // a change of COLOUR, never a change of brightness.
      hemi.intensity = mix(DAY.hemiIntensity, NIGHT.hemiIntensity, sv)
        * (1 - GLOOM.hemiCut * gd) * (1 + MIST.hemiLift * md) * (1 + UNDER.hemiLift * ut)
    }
    const sun = sunRef.current
    if (sun) {
      // Real path: rises east (06:00), overhead at noon, sets west — dawn light RAKES, which is
      // most of what makes a morning read as a morning on axis-aligned blocks.
      const e = sunElevation(p)
      sun.position.set(sunAzimuth(p) * 220, 30 + Math.max(0, e) * 240, 90)
      // Mist scatters sun rather than blocking it: shadows go soft, the ground does not go dark.
      // A surface scatters direct sun rather than blocking it — shadows soften, they do not black out.
      sun.intensity = DAY.sunIntensity * dl * (1 - GLOOM.sunCut * gd) * (1 - MIST.sunCut * md)
        * (1 - UNDER.sunCut * ut)
    }
    const night = nightRef.current
    if (night) night.intensity = NIGHT.silverIntensity * sv
    const amb = ambRef.current
    if (amb) amb.intensity = mix(DAY.ambient, NIGHT.ambient, sv) * (1 - GLOOM.ambCut * gd)
  })

  return (
    <>
      {/* Radius clears the far plane check (520 < 600) and the mesh follows the camera, so it can
          never be culled wrong or walked out of — frustumCulled off because its bounds ARE wrong
          (deliberately: it teleports to the camera every frame). */}
      <mesh ref={skyRef} frustumCulled={false} renderOrder={-1} material={skyMat}>
        <sphereGeometry args={[520, 24, 12]} />
      </mesh>
      <hemisphereLight ref={hemiRef} args={[DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity]} />
      <directionalLight ref={sunRef} position={[80, 200, 40]} intensity={DAY.sunIntensity} />
      {/* The night silver sits high and still — NOT a moon (no moon in the Ather, Alex 2026-08-08);
          a wandering night light would double the shading churn for no read anyway. */}
      <directionalLight ref={nightRef} position={[-70, 200, -50]} color={NIGHT.silver} intensity={0} />
      <ambientLight ref={ambRef} intensity={DAY.ambient} />
    </>
  )
}

export default VoxelDayNight
