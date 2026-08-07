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

import { useRef, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { dayProgress, daylight, sunElevation, sunAzimuth } from '../engine/day-cycle'

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
  moon: '#cfe0ff', moonIntensity: 0.4,
  ambient: 0.15,
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** Preallocated colour pairs — this mutates live objects inside useFrame, so no per-frame `new`. */
function makePairs() {
  const pair = (d: string, n: string) => ({ d: new THREE.Color(d), n: new THREE.Color(n), out: new THREE.Color() })
  return { bg: pair(DAY.bg, NIGHT.bg), hemiSky: pair(DAY.hemiSky, NIGHT.hemiSky), hemiGround: pair(DAY.hemiGround, NIGHT.hemiGround) }
}
const lerpInto = (p: { d: THREE.Color; n: THREE.Color; out: THREE.Color }, t: number) => p.out.copy(p.d).lerp(p.n, t)

export function VoxelDayNight() {
  const { scene } = useThree()
  const pairs = useRef(makePairs())
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const moonRef = useRef<THREE.DirectionalLight>(null)
  const ambRef = useRef<THREE.AmbientLight>(null)
  const fogRef = useRef<THREE.Fog | null>(null)

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

  useFrame(() => {
    const p = dayProgress()
    const dl = daylight(p)          // 1 noon .. 0 midnight, soft twilight band
    const sv = 1 - dl
    const P = pairs.current

    const bg = scene.background
    if (bg instanceof THREE.Color) bg.copy(lerpInto(P.bg, sv))
    const fog = fogRef.current
    if (fog) {
      fog.color.copy(lerpInto(P.bg, sv))   // fog dissolves into the sky, both hours
      fog.near = mix(DAY.fogNear, NIGHT.fogNear, sv)
      fog.far = mix(DAY.fogFar, NIGHT.fogFar, sv)
    }
    const hemi = hemiRef.current
    if (hemi) {
      hemi.color.copy(lerpInto(P.hemiSky, sv))
      hemi.groundColor.copy(lerpInto(P.hemiGround, sv))
      hemi.intensity = mix(DAY.hemiIntensity, NIGHT.hemiIntensity, sv)
    }
    const sun = sunRef.current
    if (sun) {
      // Real path: rises east (06:00), overhead at noon, sets west — dawn light RAKES, which is
      // most of what makes a morning read as a morning on axis-aligned blocks.
      const e = sunElevation(p)
      sun.position.set(sunAzimuth(p) * 220, 30 + Math.max(0, e) * 240, 90)
      sun.intensity = DAY.sunIntensity * dl
    }
    const moon = moonRef.current
    if (moon) moon.intensity = NIGHT.moonIntensity * sv
    const amb = ambRef.current
    if (amb) amb.intensity = mix(DAY.ambient, NIGHT.ambient, sv)
  })

  return (
    <>
      <hemisphereLight ref={hemiRef} args={[DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity]} />
      <directionalLight ref={sunRef} position={[80, 200, 40]} intensity={DAY.sunIntensity} />
      {/* The moon sits high and still — a wandering moon doubles the shading churn for no read. */}
      <directionalLight ref={moonRef} position={[-70, 200, -50]} color={NIGHT.moon} intensity={0} />
      <ambientLight ref={ambRef} intensity={DAY.ambient} />
    </>
  )
}

export default VoxelDayNight
