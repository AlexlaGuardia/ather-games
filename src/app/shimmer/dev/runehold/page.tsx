'use client'
// RUNE HOLD — greybox, walkable, with the mannequin on a live toggle.
//
// ★ THIS EXISTS TO SETTLE ONE QUESTION: how tall is the keeper? `metrics.ts` calls the pick *"Alex's
// to overturn in one line"*, `rune-hold.ts` is authored so flipping it re-derives the whole town, and
// neither of those helps him decide. Proportion is felt, not read.
//
// ── ★★ THE TOGGLE MOVES BOTH HALVES AT ONCE, AND THAT IS THE REQUIREMENT ─────────────────────
// There are TWO bodies in play: the one the TOWN was authored against, and the one the WALKER has.
// A matched pair is the only thing worth judging. Flipping one alone hands you the MISMATCH, which
// reads as *"this layout is wrong"* when what is actually wrong is that the halves disagree — both
// internally consistent about different things, which is the prebuilt-worker trap wearing a third
// costume.
//
//   1 · VOXEL PAIR    town + walker at 1.62 / 1.02 / r0.30   (the current pick)
//   2 · PLAY3D PAIR   town + walker at 1.15 / 0.50 / r0.40   (what Shimmer3D ships today)
//   3 · MISMATCH      voxel-authored town, play3d walker — ⚠ NOT A CANDIDATE. It is here on purpose:
//                     one second in it shows why pinning the body was a bug at all, because a wall
//                     that hides you in one world does not in the other. Labelled so it can never be
//                     mistaken for an option.
//
// ★ LIVE, NOT TWO BUILDS. Two deploys would make this a memory against a measurement — walk a street,
// wait, compare it to one you walked five minutes ago. This repo has logged that failure three times
// in two days. Everything here is client state; the toggle is instant.
//
// ⚠⚠ THE PHYSICS IS A PREVIEW COLLIDER AND IS NOT THE GAME'S, AND I WILL NOT PRETEND OTHERWISE.
// `metrics.ts` says plainly there is no continuous collider yet — play3d's floor resolver reads TILE
// TIERS and this geometry is continuous. What is honest here is that the greybox is nothing but
// axis-aligned boxes, so "stand on the top, stop at the side" is unambiguous for THIS geometry and
// nothing is being guessed. The VERBS are the shipped kit (`KIT`, same numbers both walkers) and the
// BODY is the real mannequin; what is simplified is slide, mantle and climb, which are not what is
// being judged. **Judge proportion here. Do not judge movement feel here.**
//
// ⚠ Canon, so "make it walkable" cannot quietly open a second door: v1 opens exactly ONE — the
// Spirit Corner (`world/rune-hold.md:127`), Gregory's (`:77`). The rest stay visible and shut, and
// `rune-hold.test.ts` counts them.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE } from '../../voxel3d/tex/tiles'
import { MAT } from '../../voxel/depth'
import { MATERIAL_COLOR } from '../../voxel3d/attrs'
import { runeHold, townFaults, type Town } from '../../play3d/rune-hold'
import { BODIES, KIT, metricsFor, STEP_FLOW, LEDGE_VAULT, LEDGE_MANTLE, readsAs, type Body } from '../../play3d/metrics'

type Pair = 'voxel' | 'play3d' | 'mismatch' | 'seam'
const TOWN_BODY: Record<Pair, Body> = { voxel: BODIES.voxel, play3d: BODIES.play3d, mismatch: BODIES.voxel, seam: BODIES.voxel }
const WALK_BODY: Record<Pair, Body> = { voxel: BODIES.voxel, play3d: BODIES.play3d, mismatch: BODIES.play3d, seam: BODIES.voxel }

interface Box { x0: number; x1: number; z0: number; z1: number; top: number; solid: boolean }

/** Every box the walker can stand on or bump into, derived from the town — never restated. */
function boxesOf(t: Town): Box[] {
  const out: Box[] = [
    { x0: t.square.x - t.square.size / 2, x1: t.square.x + t.square.size / 2,
      z0: t.square.z - t.square.size / 2, z1: t.square.z + t.square.size / 2, top: 0, solid: false },
  ]
  for (const m of t.masses)
    out.push({ x0: m.x - m.w / 2, x1: m.x + m.w / 2, z0: m.z - m.d / 2, z1: m.z + m.d / 2, top: m.y + m.h, solid: true })
  for (const s of t.streets) {
    const [ax, az] = s.from, [bx, bz] = s.to
    const pad = s.width / 2
    out.push({ x0: Math.min(ax, bx) - pad, x1: Math.max(ax, bx) + pad,
               z0: Math.min(az, bz) - pad, z1: Math.max(az, bz) + pad,
               top: Math.max(s.fromTerrace, s.toTerrace) * t.terraceRise, solid: false })
  }
  out.push({ x0: t.station.x - t.station.w / 2, x1: t.station.x + t.station.w / 2,
             z0: t.station.z - t.station.d / 2, z1: t.station.z + t.station.d / 2, top: t.station.h, solid: true })
  return out
}


// ── ★★★ THE SEAM BENCH ────────────────────────────────────────────────────────────────────────
// Canon (`two-lines-two-games.md` › ONE STYLE, TWO MATERIALS) rules that the Ather is quantized and
// Athernyx continuous, and that **a material change must never become an art-direction change**:
// palette, lighting language and the asset pipeline stay unified across the seam, only the FORM
// differs. Its acceptance test is *"a screenshot from either side must be instantly recognisable as
// the same game."* This is that screenshot, taken with both sides in one frame under one light.
//
// ★ IT RENDERS THE REAL TILE GENERATOR. `buildTileArray`/`sliceLayer` are the same functions that
// paint the world's blocks — nothing here restates the art. A bench with its own copy of the
// textures would agree with the game right up until someone repainted one of them, and it would
// agree hardest at the moment you came looking.
//
// ⚠ AND THE NUMBER IS THE POINT, NOT THE PICTURE. A block is one world unit and its tile is 64px, so
// the Ather is authored at **64 texels per metre**. The continuous wall beside it is textured at the
// SAME density (repeat = its size in metres), because texel density is the thing that actually makes
// two pipelines read as two games — and unlike palette, it is measurable rather than a matter of eye.
// If the wall shimmers or tiles visibly while the cube does not, that is the finding.
//
// ⚠⚠ WHAT THIS CANNOT TELL YOU YET: `tiles.ts` says in its own header that these tiles are
// PLACEHOLDER — *"THIS IS NOT SHIMMER'S ART AND MUST NEVER BECOME IT… the look call is Alex's, on
// painted tiles, later."* So the bench answers *does the pipeline match* and not *does the art look
// right*. Matching a 3D kit to a stand-in would mean authoring the kit twice.
const TILE_PX = 64

function useTileTex(material: number, face: number, repeat: number) {
  return useMemo(() => {
    const all = buildTileArray(TILE_PX)
    const layer = sliceLayer(all, TILE_PX, layerOf(material, face))
    const t = new THREE.DataTexture(new Uint8Array(layer.buffer.slice(0)), TILE_PX, TILE_PX, THREE.RGBAFormat)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    // Nearest keeps a 64px tile crisp instead of smearing it, which is how the voxel world draws it.
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearMipMapLinearFilter
    t.generateMipmaps = true
    t.needsUpdate = true
    return t
  }, [material, face, repeat])
}

/** One pair: a 1m Ather block and a continuous wall of the same material, same texel density. */
function SeamPair({ material, face, x, label }: { material: number; face: number; x: number; label: string }) {
  const WALL_W = 4, WALL_H = 3
  const cube = useTileTex(material, face, 1)          // 1 unit  → 64 texels/m
  const wall = useTileTex(material, face, WALL_W)     // 4 units → 64 texels/m, tiled 4x
  const hex = MATERIAL_COLOR[material] ?? 0x888888
  return (
    <group position={[x, 0, -6]}>
      {/* Ather side: quantized. One block, one tile, no repeat. */}
      <mesh position={[-1.2, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={cube} />
      </mesh>
      {/* Athernyx side: continuous. A wall face at the same texel density. */}
      <mesh position={[1.6, WALL_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_W, WALL_H, 0.4]} />
        <meshStandardMaterial map={wall} />
      </mesh>
      {/* ★ AND A FLAT CHIP OF THE SAME PALETTE ENTRY, UNTEXTURED. If the kit is ever built from
          colour alone, this is what it would read as — the control for the whole comparison, and it
          comes from `MATERIAL_COLOR`, the one source the tile generator itself derives from. */}
      <mesh position={[1.6, WALL_H + 0.35, 0]}>
        <boxGeometry args={[WALL_W, 0.5, 0.4]} />
        <meshStandardMaterial color={hex} />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[6, 0.04, 4]} />
        <meshStandardMaterial color="#6b6257" />
      </mesh>
      <primitive object={new THREE.Object3D()} name={label} />
    </group>
  )
}

function SeamBench() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 60, 20]} intensity={1.1} castShadow />
      <SeamPair material={MAT.STONE} face={SIDE} x={-9} label="stone" />
      <SeamPair material={MAT.TOPSOIL} face={TOP} x={0} label="topsoil" />
      <SeamPair material={MAT.PACKED_CLOUD} face={SIDE} x={9} label="cloud" />
    </>
  )
}


// ── ★★★ THE CALIBRATION ROOM ──────────────────────────────────────────────────────────────────
// Alex on the first greybox: *"its basically just a blank space with a bunch of abstract shapes."*
// He was right, and the fault is in the instrument, not the report. **A town cannot answer "how tall
// is the keeper."** Proportion is judged against things whose size you already know — a doorway you
// walk through, a step you climb, a corridor with a wall on each side. Isolated masses on a
// featureless plane give the eye nothing to measure against, so a keeper at 1.62 and one at 1.15
// look equally plausible and the toggle proves nothing. **I built a town when the question wanted a
// ruler.**
//
// ★ THE GRID IS THE SINGLE BIGGEST FIX AND IT IS ONE LINE. A flat unlit plane has no depth cue at
// all — no texture gradient, so no distance, so no scale. A 1m grid gives every other object a unit
// to be read in, and makes "square 14.4 versus 19.2" something you can SEE rather than something the
// readout claims.
//
// Everything here is derived from the walker's own body or the shared kit. Nothing is a chosen
// number, so the whole room re-proportions on the toggle exactly as the town does.
function Calibration({ body }: { body: Body }) {
  const M = metricsFor(body)
  const W = M.widths
  // Heights the walker has a verb for — the ladder `readsAs` classifies, stood up as objects.
  const rungs: [number, string, string][] = [
    [STEP_FLOW, '#3f7d3f', 'step: crossed at speed'],
    [LEDGE_VAULT, '#7d7d3f', 'vault: one press'],
    [M.cover.slide, '#2e6fb4', 'slide cover'],
    [M.cover.stand, '#b4472e', 'standing cover'],
    [LEDGE_MANTLE, '#7d3f7d', 'mantle: jump + grab'],
  ]
  // Lane widths, as corridors with a wall on EACH side — a width is only felt from inside one.
  const lanes: [number, string][] = [
    [W.passMin, 'pass'], [W.laneSingle, 'single'], [W.lanePair, 'pair'], [W.laneStreet, 'street'],
  ]
  const wallH = M.cover.stand * 1.6
  return (
    <group>
      {/* ★ 1m grid — the depth cue the first version had none of. */}
      <gridHelper args={[80, 80, '#94897a', '#7d746a']} position={[0, 0.01, 0]} />

      {/* A DOORWAY at the walker's own scale: head clearance is eye + the gap a real door leaves.
          This is the single most legible proportion test in the room — you either duck or you don't. */}
      <group position={[-3, 0, -4]}>
        {[-1, 1].map(sx => (
          <mesh key={sx} position={[sx * (W.lanePair / 2), (body.eyeStand + 0.5) / 2, 0]} castShadow>
            <boxGeometry args={[0.25, body.eyeStand + 0.5, 0.4]} />
            <meshStandardMaterial color="#8a8079" />
          </mesh>
        ))}
        <mesh position={[0, body.eyeStand + 0.5 + 0.15, 0]} castShadow>
          <boxGeometry args={[W.lanePair + 0.5, 0.3, 0.4]} /><meshStandardMaterial color="#8a8079" />
        </mesh>
      </group>

      {/* THE RUNGS — one post per tier the movement kit produces, in front of you, to walk up to. */}
      {rungs.map(([h, colour], i) => (
        <mesh key={colour} position={[i * 1.4 - 2.8, h / 2, -8]} castShadow receiveShadow>
          <boxGeometry args={[1.1, h, 1.1]} /><meshStandardMaterial color={colour} />
        </mesh>
      ))}

      {/* A STAIR of the vault tier — canon's terraces repeat this face dozens of times up the town,
          so it is the one you will meet most and the one worth feeling under you. */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} position={[6 + i * 1.6, (LEDGE_VAULT * (i + 1)) / 2, -6]} castShadow receiveShadow>
          <boxGeometry args={[1.5, LEDGE_VAULT * (i + 1), 3]} /><meshStandardMaterial color="#6f6a62" />
        </mesh>
      ))}

      {/* CORRIDORS — a width is only felt from inside, so each lane class gets two walls and a floor
          you can walk down. This is where a 0.10m difference in shoulder actually shows up. */}
      {/* ⚠ z starts BEYOND the spawn point. The first cut put the nearest corridor at z=6 while the
          keeper spawns at z = square/2 - 1 ≈ 6.2 — so you opened the page standing INSIDE a wall pair,
          looking down a dark tunnel, which is a worse first frame than the empty plane it replaced.
          A calibration room you spawn inside of is not a calibration room. */
      {lanes.map(([w, name], i) => {
        const z = 15 + i * 7
        return (
          <group key={name} position={[0, 0, z]}>
            {[-1, 1].map(sx => (
              <mesh key={sx} position={[sx * (w / 2 + 0.15), wallH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.3, wallH, 9]} /><meshStandardMaterial color="#8f8579" />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Player({ town, body, pairKey }: { town: Town; body: Body; pairKey: Pair }) {
  const { camera, gl } = useThree()
  const pos = useRef({ x: 0, y: 0, z: town.square.size / 2 - 1 })
  const vy = useRef(0)
  const yaw = useRef(0), pitch = useRef(0)
  const keys = useRef<Record<string, boolean>>({})
  const boxes = useMemo(() => boxesOf(town), [town])

  // ⚠ RESET ON A PAIR CHANGE. The two towns are different SIZES, so a position that was on the
  // square in one can be inside a wall in the other — and a keeper who toggles and finds himself
  // stuck reads it as the layout being broken.
  useEffect(() => { pos.current = { x: 0, y: 0, z: town.square.size / 2 - 1 }; vy.current = 0 }, [pairKey, town])

  useEffect(() => {
    const el = gl.domElement
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return
      yaw.current -= e.movementX * 0.0022
      pitch.current = Math.max(-1.4, Math.min(1.4, pitch.current - e.movementY * 0.0022))
    }
    const click = () => { void el.requestPointerLock?.() }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move); el.addEventListener('click', click)
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move); el.removeEventListener('click', click)
    }
  }, [gl])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const p = pos.current
    const r = body.radius
    const overlaps = (b: Box, x: number, z: number) => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1

    // ── floor: the highest surface under the footprint that is not above a free step ──────────
    let floor = 0
    for (const b of boxes) if (overlaps(b, p.x, p.z) && b.top <= p.y + STEP_FLOW + 0.001) floor = Math.max(floor, b.top)

    // ── intent ───────────────────────────────────────────────────────────────────────────────
    const k = keys.current
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)
    const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)
    const len = Math.hypot(f, s) || 1
    const sp = KIT.RUN_SPEED
    const dx = ((Math.sin(yaw.current) * -f + Math.cos(yaw.current) * s) / len) * sp * dt
    const dz = ((Math.cos(yaw.current) * -f - Math.sin(yaw.current) * s) / len) * sp * dt

    // Axis-separated so sliding along a wall works instead of sticking. A solid box blocks whenever
    // its top is more than a free step above the feet — which is exactly `readsAs`'s flow tier, so
    // what stops you here is the same rule the oracle asserts the town against.
    const blocked = (x: number, z: number) =>
      boxes.some(b => b.solid && overlaps(b, x, z) && b.top > p.y + STEP_FLOW + 0.001)
    if (!blocked(p.x + dx, p.z)) p.x += dx
    if (!blocked(p.x, p.z + dz)) p.z += dz

    // ── gravity + jump ───────────────────────────────────────────────────────────────────────
    const grounded = p.y <= floor + 0.02 && vy.current <= 0
    if (grounded) { p.y = floor; vy.current = 0; if (k.Space) vy.current = KIT.JUMP_V0 }
    else vy.current -= KIT.GRAVITY * dt
    p.y += vy.current * dt
    if (p.y < floor) { p.y = floor; vy.current = 0 }

    camera.position.set(p.x, p.y + body.eyeStand, p.z)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current
  })
  return null
}

function Scene({ town, walker }: { town: Town; walker: Body }) {
  const M = metricsFor(walker)
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 60, 20]} intensity={1.1} castShadow />
      <mesh position={[town.square.x, -0.05, town.square.z]} receiveShadow>
        <boxGeometry args={[town.square.size, 0.1, town.square.size]} />
        <meshStandardMaterial color="#6b6257" />
      </mesh>
      {town.masses.map(m => (
        <mesh key={m.id} position={[m.x, m.y + m.h / 2, m.z]} castShadow receiveShadow>
          <boxGeometry args={[m.w, m.h, m.d]} />
          <meshStandardMaterial color={m.id === 'spirit-corner' ? '#c9a227' : '#8a8079'} />
        </mesh>
      ))}
      {town.streets.map(s => {
        const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1]
        return (
          <mesh key={s.id}
                position={[(s.from[0] + s.to[0]) / 2, Math.max(s.fromTerrace, s.toTerrace) * town.terraceRise - 0.02, (s.from[1] + s.to[1]) / 2]}
                rotation={[0, Math.atan2(dx, dz), 0]} receiveShadow>
            <boxGeometry args={[s.width, 0.04, Math.hypot(dx, dz)]} />
            <meshStandardMaterial color="#7d746a" />
          </mesh>
        )
      })}
      <mesh position={[town.station.x, town.station.h / 2, town.station.z]} castShadow>
        <boxGeometry args={[town.station.w, town.station.h, town.station.d]} />
        <meshStandardMaterial color="#5f6b7a" />
      </mesh>
      {/* Reference posts at the WALKER's own cover tiers — the whole comparison in two sticks. Red
          is standing cover (breaks your line of sight), blue is sliding cover. Derived, never a
          chosen height, so they move with the toggle exactly as the town does. */}
      <mesh position={[M.widths.lanePair, M.cover.stand / 2, -M.widths.lanePair]}>
        <boxGeometry args={[0.3, M.cover.stand, 0.3]} /><meshStandardMaterial color="#b4472e" />
      </mesh>
      <mesh position={[M.widths.lanePair * 2, M.cover.slide / 2, -M.widths.lanePair]}>
        <boxGeometry args={[0.3, M.cover.slide, 0.3]} /><meshStandardMaterial color="#2e6fb4" />
      </mesh>
    </>
  )
}

function Preview() {
  const [pair, setPair] = useState<Pair>('voxel')
  const [measure, setMeasure] = useState(true)
  const townBody = TOWN_BODY[pair], walkBody = WALK_BODY[pair]
  const town = useMemo(() => runeHold(townBody), [townBody])
  const faults = useMemo(() => townFaults(town), [town])
  const M = metricsFor(walkBody)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') setPair('voxel')
      if (e.code === 'Digit2') setPair('play3d')
      if (e.code === 'Digit3') setPair('mismatch')
      if (e.code === 'Digit4') setPair('seam')
      // ⚠ P DOES SOMETHING NOW. Alex pressed it expecting the voxel profiler and got nothing — a key
      // that answers nothing is exactly the silence failure this session put on the board, committed
      // by me an hour after writing it down. Here it toggles the measurements, which is this page's
      // equivalent of what P means everywhere else: show me the numbers behind what I am looking at.
      if (e.code === 'KeyP') setMeasure(m => !m)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="fixed inset-0 bg-[#a8b8c8]">
      <Canvas shadows camera={{ fov: 70, near: 0.05, far: 500 }}>
        {pair === 'seam' ? <SeamBench /> : <><Scene town={town} walker={walkBody} /><Calibration body={walkBody} /></>}
        <Player town={town} body={walkBody} pairKey={pair} />
      </Canvas>
      <div data-runehold className="absolute top-3 left-3 text-[11px] font-mono text-white/90 bg-black/60 rounded px-3 py-2 leading-relaxed pointer-events-none">
        <div className="font-semibold tracking-wide">RUNE HOLD · GREYBOX · click to look, WASD, space</div>
        <div className={pair === 'mismatch' ? 'text-amber-300' : 'text-white/90'}>
          {pair === 'seam'
            ? '4 · SEAM BENCH — 1m Ather block vs a continuous wall, same paint, same 64 texels/m'
            : pair === 'mismatch'
            ? '3 · MISMATCH — voxel town, play3d walker. ⚠ NOT A CANDIDATE, shown to make the bug visible'
            : pair === 'voxel' ? '1 · VOXEL PAIR (current pick)' : '2 · PLAY3D PAIR (what Shimmer3D ships)'}
        </div>
        <div>walker eye {walkBody.eyeStand.toFixed(2)} · slide {walkBody.eyeSlide.toFixed(2)} · r {walkBody.radius.toFixed(2)}</div>
        <div>town built for eye {townBody.eyeStand.toFixed(2)} · square {town.square.size.toFixed(1)} · street {metricsFor(townBody).widths.lanePair.toFixed(2)} · terrace {town.terraceRise.toFixed(2)}</div>
        <div>walker cover · slide {M.cover.slide.toFixed(2)} <span className="text-[#2e6fb4]">■</span> · stand {M.cover.stand.toFixed(2)} <span className="text-[#b4472e]">■</span></div>
        <div className={faults.length ? 'text-red-300' : 'text-emerald-300'}>
          {faults.length ? `${faults.length} FAULT: ${faults.map(f => f.why).join(', ')}` : 'town reads clean'}
        </div>
        {pair === 'seam' && (
          <div className="text-white/70">left cube = Ather (1m, 1 tile) · right wall = Athernyx (4m, tiled 4x) · chip above = raw palette entry
            <br />⚠ tiles are PLACEHOLDER art by their own header — this tests the PIPELINE, not the look</div>
        )}
        {measure && pair !== 'seam' && (
          <div className="text-white/70">
            doorway {(walkBody.eyeStand + 0.5).toFixed(2)} tall · rungs: step {STEP_FLOW.toFixed(2)} · vault {LEDGE_VAULT.toFixed(2)} · slide {M.cover.slide.toFixed(2)} · stand {M.cover.stand.toFixed(2)} · mantle {LEDGE_MANTLE.toFixed(2)}
            <br />corridors: pass {M.widths.passMin.toFixed(2)} · single {M.widths.laneSingle.toFixed(2)} · pair {M.widths.lanePair.toFixed(2)} · street {M.widths.laneStreet.toFixed(2)} · grid = 1m
          </div>
        )}
        <div className="text-white/50">1 / 2 / 3 / 4 to switch · P measurements · ⚠ preview collider, not the game&apos;s — judge proportion, not movement</div>
      </div>
    </div>
  )
}

// ⚠ Suspense is not optional: the App Router FAILS the production build on `useSearchParams` without
// one. Kept even though the params read has gone, because the boundary costs nothing and the next
// person to add a query param would otherwise break a deploy they did not touch.
export default function RuneHoldPreview() {
  return <Suspense fallback={<div className="fixed inset-0 bg-[#a8b8c8]" />}><Preview /></Suspense>
}
