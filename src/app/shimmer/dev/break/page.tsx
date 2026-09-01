'use client'

// THE CHIPS — every bucket breaking side by side, so the feel can be judged instead of argued.
//
// ★★★ WHY THIS PAGE EXISTS. The block-break effect's whole promise is that stone does not come
// apart like a leaf. That is a claim about MOTION, and motion is the one thing a test cannot check
// and a screenshot cannot show. So the six buckets stand in a row and break on the same clock:
// what you are looking for is whether they read as six different materials or as one particle
// system wearing six colours. `dev/grey` made the same argument for a silhouette — a look judged by
// arithmetic is a look nobody looked at.
//
// ★ IT IMPORTS THE SHIPPED MODULES, NOT A COPY OF THEM. `createBreakFx` and the recipes are exactly
// what the world will call, and the demo blocks are painted from `MATERIAL_COLOR` — the same value
// the chips take their colour from, so a block and its own debris cannot drift apart on this page.
// A preview that re-derives can be perfectly correct while the game is wrong (`dev/ring`'s rule).
//
// ⚠ WHAT THIS PAGE IS NOT. It is not the game: there is no terrain, no keeper, no tool, and the
// swing here is a fixed 1.5s ramp rather than a real `tickBreak`. It answers "does a chip of this
// material look like that material coming apart" and nothing else. The wiring into real mining is
// hub's call and is not done — nothing here proves anything about the world.
//
// Run: tools/devwin.sh play  ->  http://localhost:3203/shimmer/dev/break   (any lane but hub)

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createBreakFx } from '../../voxel3d/break-fx'
import { bucketOf, recipeFor, swingChips, chipColor, ALL_BUCKETS, type BreakBucket } from '../../voxel3d/break-fx-spec'
import { ALL_BLOCKS } from '../../voxel/registry'
import { blockX, fitDistance } from './framing'
import { MATERIAL_COLOR } from '../../voxel3d/attrs'
import { baseOf } from '../../voxel/depth'

/** Seconds a demo swing takes before the block gives. Not a real break time — a judging clock. */
const SWING_S = 1.5
/** Pause between one block giving and the row starting again, so the burst has room to land. */
const REST_S = 1.1

/**
 * One real block per bucket, taken from the REGISTRY rather than named by hand.
 *
 * ⚠ A hand-picked list here would be a second claim about which materials are which bucket, sitting
 * one directory from the function whose job that is — the mirror shape `break-fx-spec.ts`'s header
 * refuses. Asking the registry means this page shows whatever the classifier actually does today,
 * including the day it starts doing it wrong.
 */
function demoBlocks(): { bucket: BreakBucket; material: number; name: string }[] {
  const out: { bucket: BreakBucket; material: number; name: string }[] = []
  for (const b of ALL_BUCKETS) {
    const hit = ALL_BLOCKS.find(d =>
      d.hardness !== Infinity && d.material === baseOf(d.material) && bucketOf(d.material) === b)
    if (hit) out.push({ bucket: b, material: hit.material, name: hit.name })
  }
  return out
}

function Row({ onStats }: { onStats: (live: number, dropped: number) => void }) {
  const blocks = useMemo(demoBlocks, [])
  const fx = useMemo(() => createBreakFx(0x5eed), [])
  useEffect(() => () => fx.dispose(), [fx])

  // A world-sized chip needs the viewport to become pixels. Recomputed on resize only — the camera
  // does not move on this page, and a per-frame uniform write is the kind of cost this page exists
  // to keep out of the measurement.
  const { size, camera } = useThree()
  useEffect(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50
    fx.setPixelScale(size.height / (2 * Math.tan((fov * Math.PI) / 360)))
  }, [fx, size.height, camera])

  // Phase runs 0 → SWING_S (chips fly off the front face), then the block gives and rests.
  const phase = useRef(0)
  const carry = useRef<number[]>(blocks.map(() => 0))   // fractional chips owed, per block
  const [hidden, setHidden] = useState<boolean[]>(() => blocks.map(() => false))

  useFrame((_s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    phase.current += dt

    if (phase.current <= SWING_S) {
      const p = phase.current / SWING_S
      blocks.forEach((b, i) => {
        const bucket = bucketOf(b.material)
        if (!bucket) return
        // The real ramp function, so what you judge here is the curve that ships.
        carry.current[i] += swingChips(bucket, p, dt)
        const n = Math.floor(carry.current[i])
        if (n > 0) {
          carry.current[i] -= n
          // Struck on the +Z face — the one turned toward the camera.
          fx.chip(i * 2 - blocks.length, 0, 0, 0, 0, 1, b.material, n)
        }
      })
    } else if (phase.current <= SWING_S + dt && phase.current > SWING_S) {
      // (unreachable in practice; the give is handled below so a long frame cannot skip it)
    }

    if (phase.current > SWING_S && !hidden[0]) {
      blocks.forEach((b, i) => fx.burst(i * 2 - blocks.length, 0, 0, b.material))
      setHidden(blocks.map(() => true))
    }
    if (phase.current > SWING_S + REST_S) {
      phase.current = 0
      carry.current = blocks.map(() => 0)
      setHidden(blocks.map(() => false))
    }

    fx.tick(dt)
    onStats(fx.live(), fx.dropped())
  })

  return (
    <>
      <primitive object={fx.points} />
      {blocks.map((b, i) => (
        <mesh key={b.bucket} position={[blockX(i, blocks.length), 0, 0]} visible={!hidden[i]}>
          <boxGeometry args={[1, 1, 1]} />
          {/* The demo block wears the chips' own colour — one source, so they cannot disagree. */}
          <meshLambertMaterial color={chipColor(b.material)} />
        </mesh>
      ))}
      <gridHelper args={[40, 40, 0x3a3a44, 0x2a2a33]} position={[0, -0.5, 0]} />
      <FitRow count={blocks.length} />
    </>
  )
}

/**
 * Keep every bucket inside the frame, at any window shape.
 *
 * ★★ WHY THIS IS NOT A BIGGER `z` LITERAL. On 2026-09-01 this page was cropping its FIRST bucket
 * off the left edge at a 1500px viewport, and the first bucket is **stone** — the one the caption
 * builds its whole argument on (*"stone should snap and die"*). Two separate faults stacked:
 * the row was laid out from `i * 2 - blocks.length`, which for 7 blocks runs x=-7..+5 and is
 * centred on **-1**, not 0; and even centred, ±6.5 of cubes does not fit the ±6.30 the frustum
 * gives at that aspect. A hand-picked camera distance fixes today's window and silently re-crops
 * on a laptop, a phone, or the day an eighth bucket is added.
 *
 * ⚠ SO THE DISTANCE IS DERIVED FROM THE THINGS THAT DECIDE IT — the block COUNT, the fov and the
 * live aspect. Add a bucket and the camera pulls back on its own. `ALL_BUCKETS` comes from the
 * shipped recipe table, so the count is not this page's to know.
 *
 * ⚠ AND A CROPPED LOOKING-GLASS IS THE WORST KIND OF WRONG: nothing is missing from the SCENE, so
 * the page looks correct and simply is not showing you one of the things it is comparing. The
 * caption still said "left to right: stone, crystal, ..." while stone was off-screen.
 */
function FitRow({ count }: { count: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)
    // ⚠ The derivation lives in `framing.ts` so the guard can assert the real invariant instead of
    // restating this arithmetic beside it. `fitDistance` never returns less than the authored z.
    cam.position.z = fitDistance(count, cam.fov, aspect)
    cam.updateProjectionMatrix()
  }, [camera, size, count])
  return null
}

export default function BreakFxPage() {
  const blocks = useMemo(demoBlocks, [])
  const [stats, setStats] = useState({ live: 0, dropped: 0 })
  const last = useRef(0)
  const onStats = (live: number, dropped: number) => {
    // Throttle the React state write — a setState every frame is its own frame cost, and this
    // page exists to judge frame FEEL.
    const now = performance.now()
    if (now - last.current < 120) return
    last.current = now
    setStats({ live, dropped })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#15141a', color: '#e8e6ef',
                  fontFamily: 'ui-monospace, monospace' }}>
      <Canvas camera={{ position: [0, 2.2, 9], fov: 50 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 8, 6]} intensity={0.9} />
        <Row onStats={onStats} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 16, fontSize: 12, lineHeight: 1.7,
                    background: 'rgba(21,20,26,.82)', padding: '10px 14px', borderRadius: 3,
                    border: '1px solid #33313d' }}>
        <div style={{ letterSpacing: '.14em', color: '#8a8496' }}>BLOCK-BREAK CHIPS · P0</div>
        <div>live <b style={{ color: '#e0b866' }}>{stats.live}</b>
             {'   '}dropped <b style={{ color: stats.dropped ? '#f0a184' : '#8a8496' }}>{stats.dropped}</b></div>
        <div style={{ color: '#8a8496' }}>
          {/* Naming the blocks on screen is the point: if the classifier puts a log in 'stone',
              you see it here rather than reading it in a test. */}
          {blocks.map(b => `${b.bucket}=${b.name}`).join('  ·  ')}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, fontSize: 11.5,
                    color: '#8a8496', lineHeight: 1.6 }}>
        Left to right: {blocks.map(b => b.bucket).join(', ')}. Each takes the same {SWING_S}s swing,
        then gives. Watch the MOTION, not the colour — stone should snap and die, wood should throw
        fewer and heavier, a leaf should hang, sand should barely leave the face.
        Recipes: {ALL_BUCKETS.map(b => `${b}(${recipeFor(b).burst}/${recipeFor(b).life}s)`).join(' ')}
      </div>
    </div>
  )
}

// Kept honest: `THREE` is imported for the types the R3F elements resolve against; if this file ever
// constructs a geometry or material of its own, render-audit's §1 applies to it like anywhere else.
void THREE
