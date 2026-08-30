'use client'

// Home Plot ring preview — the spirits that live about your fold, standing still enough to look at.
//
// ★ IT MOUNTS `createPlotRing` ITSELF, the same rule `dev/seam` and `dev/hud` follow: a preview that
// re-derives can be perfectly correct while the game is wrong. So this imports the pass the world
// will import and supplies only what the host owes it — a roster, a ground probe and a keeper.
//
// ★ WHY IT EXISTS AT ALL: the ring's host wiring lives in `VoxelWorld.tsx`, which is the hub lane's
// file, and this repo's standing weakness is shipping a system that is built, tested and never once
// LOOKED at. This page is how the world lane looks at it without editing another lane's file — an
// uncommitted edit in a shared tree is what the 2026-08-20 PATTERNS entry is about.
//
// ⚠ THE GROUND IS FLAT AND THE FOLD IS REAL, AND ONLY ONE OF THOSE IS A STAND-IN. `accept` runs the
// shipped `withinCap` against a real `plotForTier`, so what you see is the actual fold boundary at
// that tier. `groundAt` returns a constant, so judge PLACEMENT and WALK here and judge FOOTING in
// the world — a resident standing on a slope is a question this page cannot answer.
//
// Run: tools/devwin.sh world  →  http://localhost:3201/shimmer/dev/ring

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createPlotRing } from '../../voxel3d/plot-ring-pass'
import { ringCap, DEFAULT_RING } from '../../voxel3d/plot-ring'
import { plotForTier, withinCap, PLOT_TIERS } from '../../voxel/plot'
import { SPECIES_IDS } from '../../sprites/registry'
import { DAY } from '../../voxel3d/day-night'
import { EYE_STAND } from '../../voxel3d/locomotion'

const SEED = 1337
/** The ground plane the stand-in keeper and every resident stands on. */
const GY = 0
/** How fast the keeper ambles when `walk` is on — fast enough to force a recycle in seconds. */
const WALK = 14

function Ring({ tier, roster, walk, yaw, onStats }: {
  tier: number; roster: number; walk: boolean; yaw: number
  onStats: (s: { drawn: number; cap: number; x: number; onScreen: number; nearest: number }) => void
}) {
  const ring = useMemo(() => createPlotRing(SEED), [])
  const scene = useRef<THREE.Group>(null)
  const keeper = useRef({ x: 0, z: 0, yaw: 0 })
  const added = useRef(false)

  // The stand-in roster: N spirits, each an id bound to one of the painted species, so the body
  // choice (portrait first, sprite second) runs for real rather than against a fixture.
  const ids = useMemo(() => Array.from({ length: roster }, (_, i) => `r${i}`), [roster])
  const speciesOf = useMemo(() => {
    const m = new Map(ids.map((id, i) => [id, SPECIES_IDS[i % SPECIES_IDS.length]] as const))
    return (id: string) => m.get(id) ?? null
  }, [ids])

  useFrame((_s, dt) => {
    const g = scene.current
    if (!g) return
    if (!added.current) { g.add(ring.group); added.current = true }
    const k = keeper.current
    k.yaw = (yaw * Math.PI) / 180
    if (walk) { k.x += Math.cos(k.yaw) * WALK * dt; k.z += Math.sin(k.yaw) * WALK * dt }
    const cfg = plotForTier(tier)
    ring.tick(
      k, performance.now(), dt, cfg, ids, speciesOf,
      (x, z) => withinCap(x, z, SEED, cfg),
      () => GY,
    )
    // ★ A SCREENSHOT SAYS SOMETHING IS WRONG AND NEVER WHY (world-shot.mts's own lesson). This
    // reads the REAL object positions out of the pass's group, so the readout can disagree with the
    // picture — which is the only way to tell a placement bug from a rendering one. It caught
    // exactly that on 2026-08-27: the model said two residents were on screen and the screen was
    // empty, and the fault was neither the placement rule nor the camera.
    let onScreen = 0, nearest = Infinity
    for (const o of ring.group.children) {
      const dx = o.position.x - k.x, dz = o.position.z - k.z
      const dist = Math.hypot(dx, dz)
      let off = Math.atan2(dz, dx) - k.yaw
      while (off > Math.PI) off -= Math.PI * 2
      while (off < -Math.PI) off += Math.PI * 2
      if (Math.abs(off) < (53 * Math.PI) / 180 && dist < DAY.fogFar) onScreen++
      if (dist < nearest) nearest = dist
    }
    onStats({ drawn: ring.count(), cap: ringCap(cfg), x: Math.round(k.x), onScreen, nearest })
  })

  // The camera rides the keeper's eyes, so "out of view" on screen is the same question the pass
  // is answering. A free camera would let you watch a recycle the pass believed was unwitnessed.
  useFrame(({ camera }) => {
    const k = keeper.current
    // ⚠ `EYE_STAND`, NOT A RE-TYPED `1.62`. The claim this camera makes is *"you are seeing what
    // the keeper sees"*, and a literal makes that claim true only until the walker's eye moves.
    // `dev/hold` shipped a whole set piece judged from 32 blocks up for want of this idea.
    camera.position.set(k.x, GY + EYE_STAND, k.z)
    camera.lookAt(k.x + Math.cos(k.yaw) * 10, GY + 1.4, k.z + Math.sin(k.yaw) * 10)
  })

  return <group ref={scene} />
}

/**
 * ★ THE CONTROLS ARE ALSO URL PARAMS, so a headless shot can drive this page —
 * `?tier=2&resting=10&yaw=120&walk=1`. Without that, `page-shot.mts` can only ever photograph the
 * defaults, and the two states worth looking at (a turned keeper, a walking one) are exactly the
 * ones a screenshot of the defaults cannot reach. Read once on mount; the sliders own it after.
 */
// ⚠ APPLIED IN AN EFFECT, NOT IN THE `useState` INITIALISER. Reading `window.location.search`
// during render is a server/client branch: the server renders the defaults and the client renders
// the params, and React reports a HYDRATION MISMATCH — which ships a red issue badge sitting over
// the very picture this page exists to take. Caught by reading the page's console, not by looking
// at it; the render was correct either way. (world lane, 2026-08-27.)
function readParams(): Partial<{ tier: number; resting: number; yaw: number; walk: number }> {
  const q = new URLSearchParams(window.location.search)
  const num = (n: string) => { const v = q.get(n); const x = v === null ? NaN : Number(v); return Number.isFinite(x) ? x : undefined }
  return { tier: num('tier'), resting: num('resting'), yaw: num('yaw'), walk: num('walk') }
}

export default function RingPreview() {
  const [tier, setTier] = useState(0)
  const [roster, setRoster] = useState(6)
  const [walk, setWalk] = useState(false)
  const [yaw, setYaw] = useState(0)
  const [stats, setStats] = useState({ drawn: 0, cap: 0, x: 0, onScreen: 0, nearest: Infinity })
  useEffect(() => {
    const p = readParams()
    if (p.tier !== undefined) setTier(p.tier)
    if (p.resting !== undefined) setRoster(p.resting)
    if (p.yaw !== undefined) setYaw(p.yaw)
    if (p.walk !== undefined) setWalk(p.walk === 1)
  }, [])

  return (
    <div className="h-screen w-screen bg-[#0d1014] text-white/80">
      <div className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center gap-4 bg-black/50 px-4 py-2 text-[11px]">
        <span className="font-semibold uppercase tracking-[0.14em] text-amber-200/70">plot ring</span>
        <label className="flex items-center gap-2">
          tier
          <input type="range" min={0} max={PLOT_TIERS.length - 1} value={tier}
                 onChange={e => setTier(+e.target.value)} />
          <span className="tabular-nums text-white/50">r{PLOT_TIERS[tier]}</span>
        </label>
        <label className="flex items-center gap-2">
          resting
          <input type="range" min={0} max={14} value={roster}
                 onChange={e => setRoster(+e.target.value)} />
          <span className="tabular-nums text-white/50">{roster}</span>
        </label>
        <label className="flex items-center gap-2">
          yaw
          <input type="range" min={0} max={359} value={yaw} onChange={e => setYaw(+e.target.value)} />
          <span className="tabular-nums text-white/50">{yaw}°</span>
        </label>
        <button onClick={() => setWalk(w => !w)}
                className={`rounded px-2 py-0.5 ${walk ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10'}`}>
          {walk ? 'walking' : 'still'}
        </button>
        {/* ★ `drawn` vs `cap` is the readout that matters: the cap is what the fold allows, drawn is
            what the world accepted. A gap between them is a placement being refused, not a bug. */}
        <span className="tabular-nums text-white/45">
          drawn {stats.drawn} / cap {stats.cap} · on screen {stats.onScreen} · nearest{' '}
          {Number.isFinite(stats.nearest) ? Math.round(stats.nearest) : '-'} · x {stats.x} · sight {DEFAULT_RING.sight}
        </span>
      </div>
      {/* ★★ THE SHIPPED FOG, NOT AN APPROXIMATION OF IT — and without it this page LIES about the
          one property the placement rule depends on. The far band exists because a resident that
          appears at 200 blocks is hidden by fog rather than popping; a preview with clear air shows
          it popping and would argue the design out of existence. `fov` matches the world's 75. */}
      <Canvas camera={{ fov: 75, near: 0.1, far: 600 }}>
        <color attach="background" args={[DAY.bg]} />
        <fog attach="fog" args={[DAY.bg, DAY.fogNear, DAY.fogFar]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[20, 40, 10]} intensity={1.1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GY, 0]}>
          <planeGeometry args={[2400, 2400]} />
          <meshStandardMaterial color="#3f6b46" />
        </mesh>
        <Ring tier={tier} roster={roster} walk={walk} yaw={yaw} onStats={setStats} />
      </Canvas>
    </div>
  )
}
