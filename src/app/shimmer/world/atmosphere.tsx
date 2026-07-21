'use client'
// Shimmer Garden — atmosphere rig (art lane / Jin).
// Canon: design-briefs/shimmer-garden-atmosphere.md + game/shimmer-geography.md.
//   atmosphere = mana-resonance made visible. Tended plots glow HONEY-GOLD; Moonwell Glade
//   carries a cool SILVER accent; the greying desaturates the frayed edges (The Outfields).
//   The "golden mist" is luminous mana; the drifting MOTES are the Anemonyx's wind-borne
//   seeds (canon — the literal seed source), falling from the canopy, dense at the tended
//   heart and guttering where greyed.
// Boundary: hue identity + meaning are canon (that file). The numbers below (fog density,
//   mote counts, light intensity) are BUILD tuning — Jin's to dial on the FEEL pass.
//
// Mount (one line, inside the <Canvas> scene graph — replaces the old <color attach="background">):
//   <GardenAtmosphere zoneId={props.zone.id} />
// Owns scene.background + scene.fog imperatively, adds a warm hemisphere fill (leaves the
// existing shadow-casting sun untouched) and the mote field. Self-contained; no other edits.

import { useMemo, useRef, useLayoutEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── FEEL constants (tune these on the eyeball pass) ────────────────────────────
type Mood = {
  bg: string          // horizon / sky the mist dissolves into
  fog: string         // luminous-mana haze colour
  fogDensity: number  // FogExp2 density — higher = closer, thicker mist
  hemiSky: string     // warm fill from above
  hemiGround: string  // bounce from the ground
  hemiIntensity: number
  mote: string        // seed-mote glow colour
  moteCount: number
  moteOpacity: number
}

// The gold ⇄ grey axis. Default = tended honey-gold; Moonwell = gold + silver thread;
// greying = the frayed edge (The Outfields) desaturated toward cold grey.
const GOLD: Mood = {
  bg: '#f3ddb0', fog: '#eccf95', fogDensity: 0.014,
  hemiSky: '#ffe7b3', hemiGround: '#6b5836', hemiIntensity: 0.45,
  mote: '#ffd98a', moteCount: 200, moteOpacity: 0.85,
}
const MOONWELL: Mood = {
  bg: '#ecdcb6', fog: '#e2d3a2', fogDensity: 0.013,
  hemiSky: '#f4ead0', hemiGround: '#5e6168', hemiIntensity: 0.5,
  mote: '#eaf3ff', moteCount: 230, moteOpacity: 0.9,   // silver seed-motes at Greg's heart
}
const GREYING: Mood = {
  bg: '#cdc8bd', fog: '#c1bcb0', fogDensity: 0.02,
  hemiSky: '#d2cfc6', hemiGround: '#4a4a46', hemiIntensity: 0.3,
  mote: '#c8bd9e', moteCount: 90, moteOpacity: 0.5,     // sparse, guttering
}

// Only zones that are UNCONDITIONALLY frayed/accented get a non-default mood. Everything
// else is the tended heart. (Liberation-driven grey→gold is a later hook, not Phase 1.)
const ZONE_MOOD: Record<string, Mood> = {
  'moonwell-glade': MOONWELL,
  'the-outfields': GREYING,
}
const moodFor = (zoneId: string): Mood => ZONE_MOOD[zoneId] ?? GOLD

// Mote field extent — a box that rides with the camera so seeds are always drifting nearby.
const MOTE_HALF = 34   // half-width/depth of the field around the player
const MOTE_HEIGHT = 26 // vertical span the seeds fall through before wrapping
const MOTE_FALL = 0.45 // units/sec downward drift (seeds fall from the canopy)
const MOTE_SWAY = 0.5  // lateral drift amplitude
const MOTE_SIZE = 0.14 // world-size of a mote at unit distance

// Soft round glow sprite so motes read as luminous seeds, not hard squares.
function makeMoteSprite(): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.Texture(c)
  tex.needsUpdate = true
  return tex
}

function Motes({ mood }: { mood: Mood }) {
  const { camera } = useThree()
  const ptsRef = useRef<THREE.Points>(null)
  const sprite = useMemo(makeMoteSprite, [])

  // Base positions (local to the field's origin) + a per-mote sway phase.
  const { positions, phases } = useMemo(() => {
    const n = mood.moteCount
    const pos = new Float32Array(n * 3)
    const ph = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 2 * MOTE_HALF - MOTE_HALF
      pos[i * 3 + 1] = (Math.sin(i * 78.233) * 12543.719 % 1) * MOTE_HEIGHT - MOTE_HEIGHT / 2
      pos[i * 3 + 2] = (Math.sin(i * 39.425) * 24634.213 % 1) * 2 * MOTE_HALF - MOTE_HALF
      ph[i] = (i * 0.618) % (Math.PI * 2)
    }
    return { positions: pos, phases: ph }
  }, [mood.moteCount])

  useFrame((state, dt) => {
    const pts = ptsRef.current
    if (!pts) return
    // Field rides with the camera so seeds are always around the player.
    pts.position.set(camera.position.x, camera.position.y, camera.position.z)
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = state.clock.elapsedTime
    const d = Math.min(dt, 0.05) // clamp so a tab-out doesn't teleport the field
    for (let i = 0; i < phases.length; i++) {
      let y = arr[i * 3 + 1] - MOTE_FALL * d
      if (y < -MOTE_HEIGHT / 2) y += MOTE_HEIGHT // wrap back up to the canopy
      arr[i * 3 + 1] = y
      arr[i * 3] += Math.sin(t * 0.3 + phases[i]) * MOTE_SWAY * d
      arr[i * 3 + 2] += Math.cos(t * 0.24 + phases[i]) * MOTE_SWAY * d
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ptsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite ?? undefined}
        color={mood.mote}
        size={MOTE_SIZE}
        sizeAttenuation
        transparent
        opacity={mood.moteOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function GardenAtmosphere({ zoneId }: { zoneId: string }) {
  const { scene } = useThree()
  const mood = useMemo(() => moodFor(zoneId), [zoneId])

  // Own background + fog imperatively; restore whatever was there on unmount.
  useLayoutEffect(() => {
    const prevBg = scene.background
    const prevFog = scene.fog
    scene.background = new THREE.Color(mood.bg)
    scene.fog = new THREE.FogExp2(mood.fog, mood.fogDensity)
    return () => {
      scene.background = prevBg
      scene.fog = prevFog
    }
  }, [scene, mood])

  return (
    <>
      {/* warm mana-light fill from the sky; the existing directional sun stays the key + shadow caster */}
      <hemisphereLight args={[mood.hemiSky, mood.hemiGround, mood.hemiIntensity]} />
      <Motes mood={mood} />
    </>
  )
}

export default GardenAtmosphere
